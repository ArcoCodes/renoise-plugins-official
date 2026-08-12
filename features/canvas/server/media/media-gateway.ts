import { randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { ZodError } from "zod";
import {
  AssetGatewayDescriptorSchema,
  type AssetGatewayDescriptor,
} from "../../shared/asset-gateway.js";
import { IdSchema } from "../../shared/document-schema.js";
import { WhiteboardError } from "../../shared/errors.js";
import { VIDEO_CHUNK_BYTES } from "../../shared/tool-contracts.js";
import type { SessionStore, CanvasSession } from "../session/session-store.js";
import type { ProjectStore } from "../storage/project-store.js";

const TOKEN_BYTES = 32;
const IMPORT_REQUEST_ID = /^upload_[a-f0-9]{32}$/;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

type AccessGrant = { token: string; expiresAt: number };

function applyCors(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  response.setHeader("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range, ETag");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function json(response: ServerResponse, status: number, value: unknown) {
  const body = Buffer.from(JSON.stringify(value));
  applyCors(response);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", body.length);
  response.end(body);
}

function errorStatus(error: unknown) {
  if (!(error instanceof WhiteboardError)) return 500;
  if (error.code === "AUTHORIZATION_REQUIRED" || error.code === "SESSION_EXPIRED") return 401;
  if (error.code === "ASSET_NOT_FOUND") return 404;
  if (error.code === "REVISION_CONFLICT") return 409;
  if (error.code === "FORBIDDEN_HOST") return 421;
  if (error.code === "INTERNAL") return 500;
  return 400;
}

function positiveInteger(value: string | null, name: string, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) {
    throw new WhiteboardError("INVALID_MEDIA", `${name} must be a non-negative integer`);
  }
  return number;
}

function parseRange(value: string | undefined, byteLength: number) {
  if (!value) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, byteLength - suffix);
    end = byteLength - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : byteLength - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= byteLength) {
    return null;
  }
  return { start, end: Math.min(end, byteLength - 1) };
}

async function readBoundedBody(request: IncomingMessage, expectedBytes: number, maximumBytes: number) {
  if (expectedBytes <= 0 || expectedBytes > maximumBytes) {
    throw new WhiteboardError("INVALID_MEDIA", `Upload must contain 1-${maximumBytes} bytes`);
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    received += chunk.length;
    if (received > expectedBytes || received > maximumBytes) {
      throw new WhiteboardError("INVALID_MEDIA", "Upload body exceeds its declared byteLength");
    }
    chunks.push(chunk);
  }
  if (received !== expectedBytes) {
    throw new WhiteboardError("INVALID_MEDIA", `Upload body is incomplete: ${received}/${expectedBytes} bytes`);
  }
  return Buffer.concat(chunks, received);
}

export class MediaGateway {
  private readonly grants = new Map<string, AccessGrant>();
  private readonly allowedHosts: ReadonlySet<string>;

  private constructor(
    private readonly server: Server,
    private readonly sessions: SessionStore,
    private readonly store: ProjectStore,
    readonly origin: string,
    port: number,
  ) {
    this.allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  }

  static async start(sessions: SessionStore, store: ProjectStore) {
    let gateway: MediaGateway | undefined;
    const server = createServer((request, response) => {
      if (!gateway) {
        json(response, 503, { ok: false, error: { code: "GATEWAY_STARTING", message: "Media gateway is starting" } });
        return;
      }
      void gateway.handle(request, response);
    });
    server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    server.unref();
    const address = server.address() as AddressInfo;
    gateway = new MediaGateway(server, sessions, store, `http://127.0.0.1:${address.port}`, address.port);
    return gateway;
  }

  describe(session: CanvasSession): AssetGatewayDescriptor {
    if (session.state !== "active") {
      throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Approve the whiteboard project before accessing media");
    }
    const now = Date.now();
    for (const [sessionId, expired] of this.grants) {
      if (expired.expiresAt <= now) this.grants.delete(sessionId);
    }
    let grant = this.grants.get(session.id);
    if (!grant || grant.expiresAt !== session.expiresAt) {
      grant = { token: randomBytes(TOKEN_BYTES).toString("hex"), expiresAt: session.expiresAt };
      this.grants.set(session.id, grant);
    }
    return AssetGatewayDescriptorSchema.parse({
      schemaVersion: 1,
      kind: "loopback-http",
      origin: this.origin,
      canvasSessionId: session.id,
      accessToken: grant.token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
    });
  }

  async close() {
    await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
  }

  private authorize(url: URL, sessionId: string) {
    const parsedSessionId = IdSchema.parse(sessionId);
    const session = this.sessions.get(parsedSessionId);
    const grant = this.grants.get(parsedSessionId);
    const supplied = url.searchParams.get("access_token") ?? "";
    const expectedBytes = grant ? Buffer.from(grant.token, "hex") : Buffer.alloc(0);
    const suppliedBytes = /^[a-f0-9]{64}$/.test(supplied) ? Buffer.from(supplied, "hex") : Buffer.alloc(0);
    if (
      !grant
      || grant.expiresAt <= Date.now()
      || expectedBytes.length !== TOKEN_BYTES
      || suppliedBytes.length !== TOKEN_BYTES
      || !timingSafeEqual(expectedBytes, suppliedBytes)
    ) {
      throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Media capability is missing, invalid, or expired");
    }
    return session;
  }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    try {
      applyCors(response);
      // DNS-rebinding defense: a hostile page can point its own domain at
      // 127.0.0.1 and read loopback responses same-origin, so only accept
      // requests whose Host header names this gateway directly.
      const host = (request.headers.host ?? "").trim().toLowerCase();
      if (!this.allowedHosts.has(host)) {
        throw new WhiteboardError("FORBIDDEN_HOST", "Host header does not match the loopback media gateway");
      }
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }
      const url = new URL(request.url ?? "/", this.origin);
      const health = /^\/v1\/health\/([^/]+)$/.exec(url.pathname);
      if (health && (request.method === "GET" || request.method === "HEAD")) {
        const session = this.authorize(url, decodeURIComponent(health[1]));
        json(response, 200, { ok: true, canvasSessionId: session.id });
        return;
      }
      const asset = /^\/v1\/assets\/([^/]+)\/([^/]+)$/.exec(url.pathname);
      if (asset && (request.method === "GET" || request.method === "HEAD")) {
        await this.serveAsset(
          request,
          response,
          url,
          decodeURIComponent(asset[1]),
          decodeURIComponent(asset[2]),
        );
        return;
      }
      const upload = /^\/v1\/imports\/([^/]+)\/(image|video)$/.exec(url.pathname);
      if (upload && request.method === "POST") {
        await this.importAsset(request, response, url, decodeURIComponent(upload[1]), upload[2] as "image" | "video");
        return;
      }
      json(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "Unknown media gateway route" } });
    } catch (error) {
      const known = error instanceof WhiteboardError
        ? error
        : error instanceof ZodError
          ? new WhiteboardError("INVALID_MEDIA", error.message)
          : new WhiteboardError("INTERNAL", error instanceof Error ? error.message : String(error));
      if (!response.headersSent) {
        json(response, errorStatus(known), { ok: false, error: { code: known.code, message: known.message } });
      } else {
        response.destroy(known);
      }
    }
  }

  private async serveAsset(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    sessionId: string,
    assetId: string,
  ) {
    const session = this.authorize(url, sessionId);
    const document = await this.store.readDocument(session);
    const record = document.page.assets[IdSchema.parse(assetId)];
    if (!record) throw new WhiteboardError("ASSET_NOT_FOUND", "Asset does not belong to this whiteboard session");
    const file = await this.store.resolveVerifiedAssetFile(session, record);
    const etag = `"${file.sha256}"`;
    const range = parseRange(request.headers.range, file.byteLength);
    if (range === null) {
      response.statusCode = 416;
      response.setHeader("Content-Range", `bytes */${file.byteLength}`);
      response.end();
      return;
    }
    if (!range && request.headers["if-none-match"] === etag) {
      response.statusCode = 304;
      response.end();
      return;
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? file.byteLength - 1;
    const contentLength = end - start + 1;
    response.statusCode = range ? 206 : 200;
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", contentLength);
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    response.setHeader("ETag", etag);
    if (range) response.setHeader("Content-Range", `bytes ${start}-${end}/${file.byteLength}`);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    const stream = createReadStream(file.path, { start, end });
    stream.on("error", (error) => response.destroy(error));
    stream.pipe(response);
  }

  private async importAsset(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    sessionId: string,
    kind: "image" | "video",
  ) {
    const session = this.authorize(url, sessionId);
    const expectedRevision = positiveInteger(url.searchParams.get("expectedRevision"), "expectedRevision");
    const declaredBytes = positiveInteger(url.searchParams.get("byteLength"), "byteLength", this.store.mediaByteLimit(kind));
    const contentLength = positiveInteger(request.headers["content-length"] ?? null, "Content-Length", this.store.mediaByteLimit(kind));
    if (declaredBytes !== contentLength) {
      throw new WhiteboardError("INVALID_MEDIA", "Content-Length must match the declared byteLength");
    }
    const requestId = url.searchParams.get("requestId") ?? "";
    if (!IMPORT_REQUEST_ID.test(requestId)) throw new WhiteboardError("INVALID_MEDIA", "Invalid upload request ID");
    const fileName = url.searchParams.get("fileName") ?? "";
    if (!fileName || fileName.length > 255 || /[/\\\0]/.test(fileName)) {
      throw new WhiteboardError("INVALID_MEDIA", "Invalid upload file name");
    }
    const mimeType = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim();

    if (kind === "image") {
      if (!IMAGE_MIME_TYPES.has(mimeType)) throw new WhiteboardError("INVALID_MEDIA", `Unsupported image MIME ${mimeType || "unknown"}`);
      const width = positiveInteger(url.searchParams.get("width"), "width", 100_000);
      const height = positiveInteger(url.searchParams.get("height"), "height", 100_000);
      if (!width || !height) throw new WhiteboardError("INVALID_MEDIA", "Image dimensions must be positive");
      const bytes = await readBoundedBody(request, declaredBytes, this.store.mediaByteLimit("image"));
      const result = await this.store.importImageBytes(session, {
        bytes,
        mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        expectedRevision,
        width,
        height,
      });
      json(response, 201, { ok: true, requestId, fileName, ...result });
      return;
    }

    if (!VIDEO_MIME_TYPES.has(mimeType)) throw new WhiteboardError("INVALID_MEDIA", `Unsupported video MIME ${mimeType || "unknown"}`);
    const durationMs = positiveInteger(url.searchParams.get("durationMs"), "durationMs");
    const playbackProxyValue = url.searchParams.get("createPlaybackProxy");
    if (playbackProxyValue !== null && playbackProxyValue !== "1") {
      throw new WhiteboardError("INVALID_MEDIA", "createPlaybackProxy must be 1 when provided");
    }
    const started = await this.store.beginVideoUpload(session, {
      expectedRevision,
      fileName,
      mimeType: mimeType as "video/mp4" | "video/webm",
      byteLength: declaredBytes,
      durationMs,
      createPlaybackProxy: playbackProxyValue === "1",
    });
    let offset = 0;
    let index = 0;
    try {
      for await (const raw of request) {
        const incoming = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        for (let chunkOffset = 0; chunkOffset < incoming.length; chunkOffset += VIDEO_CHUNK_BYTES) {
          const chunk = incoming.subarray(chunkOffset, Math.min(incoming.length, chunkOffset + VIDEO_CHUNK_BYTES));
          if (offset + chunk.length > declaredBytes) {
            throw new WhiteboardError("INVALID_MEDIA", "Upload body exceeds its declared byteLength");
          }
          await this.store.appendVideoUploadBytes(session, {
            uploadId: started.uploadId,
            index,
            offset,
            bytes: chunk,
          });
          offset += chunk.length;
          index += 1;
        }
      }
      if (offset !== declaredBytes) {
        throw new WhiteboardError("INVALID_MEDIA", `Upload body is incomplete: ${offset}/${declaredBytes} bytes`);
      }
      const result = await this.store.finalizeVideoUpload(session, started.uploadId);
      json(response, 201, { ok: true, requestId, ...result });
    } catch (error) {
      await this.store.abortVideoUpload(session, started.uploadId).catch(() => undefined);
      throw error;
    }
  }
}
