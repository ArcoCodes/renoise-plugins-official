import { randomUUID } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, parse, resolve, sep } from "node:path";
import { WhiteboardError } from "../../shared/errors.js";

export type CanvasSession = {
  id: string;
  requestedProjectDir: string;
  projectDir?: string;
  pageId: string;
  requestedPageName: string;
  authorizationNonce?: string;
  state: "pending_authorization" | "active" | "expired";
  createdAt: number;
  expiresAt: number;
};

const TTL_MS = 12 * 60 * 60 * 1000;

function sessionId() {
  return `session_${randomUUID().replaceAll("-", "")}`;
}

function pageId() {
  return `page_${randomUUID().replaceAll("-", "")}`;
}

export class SessionStore {
  private readonly sessions = new Map<string, CanvasSession>();

  private evictExpired(now = Date.now()) {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }

  create(requestedProjectDir: string, requestedPageName = "Review Board"): CanvasSession {
    this.evictExpired();
    if (!isAbsolute(requestedProjectDir)) {
      throw new WhiteboardError("INVALID_PROJECT", "projectDir must be an absolute path");
    }
    const session: CanvasSession = {
      id: sessionId(),
      requestedProjectDir: resolve(requestedProjectDir),
      pageId: pageId(),
      requestedPageName,
      authorizationNonce: `auth_${randomUUID().replaceAll("-", "")}`,
      state: "pending_authorization",
      createdAt: Date.now(),
      expiresAt: Date.now() + TTL_MS,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async authorizePending(approvedProjectDir: string, pendingSessionId: string): Promise<CanvasSession> {
    const requestedProjectDir = resolve(approvedProjectDir);
    const pending = this.get(pendingSessionId, false);
    if (pending?.state !== "pending_authorization" || pending.requestedProjectDir !== requestedProjectDir) {
      throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Approve the exact pending whiteboard session shown by the widget");
    }
    if (!pending?.authorizationNonce) {
      throw new WhiteboardError(
        "AUTHORIZATION_REQUIRED",
        "Open the annotation board for this exact project before approving it",
      );
    }
    const authorized = await this.authorize(pending.id, approvedProjectDir, pending.authorizationNonce);
    for (const [id, session] of this.sessions) {
      if (id !== authorized.id
        && session.state === "pending_authorization"
        && session.requestedProjectDir === requestedProjectDir) {
        this.sessions.delete(id);
      }
    }
    return authorized;
  }

  get(id: string, requireActive = true): CanvasSession {
    const session = this.sessions.get(id);
    if (!session || Date.now() >= session.expiresAt) {
      if (session) session.state = "expired";
      throw new WhiteboardError("SESSION_EXPIRED", "Whiteboard session is missing or expired");
    }
    if (requireActive && session.state !== "active") {
      throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Approve the exact project directory in the whiteboard first");
    }
    return session;
  }

  async authorize(id: string, approvedProjectDir: string, authorizationNonce: string): Promise<CanvasSession> {
    const session = this.get(id, false);
    if (resolve(approvedProjectDir) !== session.requestedProjectDir) {
      throw new WhiteboardError("INVALID_PROJECT", "Approved directory must exactly match the directory shown by the widget");
    }
    const canonical = await realpath(approvedProjectDir);
    const info = await stat(canonical);
    if (!info.isDirectory()) throw new WhiteboardError("INVALID_PROJECT", "Approved path is not a directory");
    const root = parse(canonical).root;
    const canonicalHome = await realpath(homedir());
    if (canonical === root || canonical === canonicalHome) {
      throw new WhiteboardError("INVALID_PROJECT", "A filesystem root or user home cannot be authorized as a whiteboard project");
    }
    const normalized = canonical.endsWith(sep) ? canonical.slice(0, -1) : canonical;
    if (session.state === "active" && session.projectDir === normalized) return session;
    if (!session.authorizationNonce || authorizationNonce !== session.authorizationNonce) {
      throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Authorization nonce is missing, invalid, or already consumed");
    }
    session.projectDir = normalized;
    session.state = "active";
    session.authorizationNonce = undefined;
    return session;
  }
}
