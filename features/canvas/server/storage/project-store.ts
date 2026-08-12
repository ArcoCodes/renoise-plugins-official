import { createHash, randomUUID, type Hash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
  type FileHandle,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  createEmptyDocument,
  IdSchema,
  RevisionIntentSchema,
  SelectionStateSchema,
  PreviewRecordSchema,
  ViewStateSchema,
  WhiteboardDocumentSchema,
  type AssetRecord,
  type PreviewRecord,
  type SelectionState,
  type RevisionIntent,
  type ViewState,
  type WhiteboardDocument,
} from "../../shared/document-schema.js";
import { WhiteboardError } from "../../shared/errors.js";
import type { CanvasSession } from "../session/session-store.js";
import { VIDEO_CHUNK_BYTES } from "../../shared/tool-contracts.js";
import { createBrowserVideoProxy } from "../media/video-normalizer.js";

declare const __RENOISE_TEST_ADAPTERS__: boolean;

const execFileAsync = promisify(execFile);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 128 * 1024;
const PREVIEW_ENCODER_VERSION = 1;
const DEFAULT_MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const TASK_TIMEOUT_MS = 15_000;
const LEASE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_TRANSFER_TTL_MS = 15 * 60 * 1000;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};
const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  activePageId: IdSchema,
  updatedAt: z.string().datetime(),
});
const LockOwnerSchema = z.object({
  pid: z.number().int().positive(),
  token: z.string().regex(/^[a-f0-9]{32}$/),
  createdAt: z.string().datetime(),
});
const SubmissionTransactionSchema = z.object({
  schemaVersion: z.literal(1),
  pageId: IdSchema,
  revisionIntent: RevisionIntentSchema,
  document: WhiteboardDocumentSchema,
  selection: SelectionStateSchema,
  view: ViewStateSchema,
});
const CliMediaSchema = z.union([
  z.string().url(),
  z.object({
    url: z.string().url().optional(),
    downloadUrl: z.string().url().optional(),
    outputUrl: z.string().url().optional(),
    dataUrl: z.string().startsWith("data:image/").optional(),
  }).refine((value) => Boolean(value.url || value.downloadUrl || value.outputUrl || value.dataUrl), "Media result has no supported payload"),
]);
const TaskResultSchema = z.object({
  outputs: z.array(CliMediaSchema).optional(),
  results: z.array(CliMediaSchema).optional(),
}).passthrough().refine((value) => Boolean(value.outputs?.length || value.results?.length), "Task result has no outputs/results");

type VideoUpload = {
  id: string;
  sessionId: string;
  pageId: string;
  expectedRevision: number;
  fileName: string;
  mimeType: "video/mp4" | "video/webm";
  byteLength: number;
  durationMs: number;
  createPlaybackProxy: boolean;
  received: number;
  nextIndex: number;
  header: Buffer;
  hash: Hash;
  handle: FileHandle;
  temporaryPath: string;
  expiresAt: number;
  timer?: NodeJS.Timeout;
  busy?: "append" | "finalize" | "abort";
  lastAccepted?: {
    index: number;
    offset: number;
    byteLength: number;
    sha256: string;
  };
};

type ImageUpload = {
  id: string;
  sessionId: string;
  pageId: string;
  expectedRevision: number;
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  byteLength: number;
  width: number;
  height: number;
  received: number;
  nextIndex: number;
  header: Buffer;
  hash: Hash;
  handle: FileHandle;
  temporaryPath: string;
  expiresAt: number;
  timer?: NodeJS.Timeout;
  busy?: "append" | "finalize" | "abort";
  lastAccepted?: {
    index: number;
    offset: number;
    byteLength: number;
    sha256: string;
  };
};

type AssetReadLease = {
  id: string;
  sessionId: string;
  assetId: string;
  kind: "image" | "video";
  mimeType: AssetRecord["mimeType"];
  byteLength: number;
  handle: FileHandle;
  expiresAt: number;
  timer?: NodeJS.Timeout;
  busy?: "read" | "close";
};

type ImagePreviewInput = {
  dataUrl: string;
  width: number;
  height: number;
};

type VideoFinalizeResult = Awaited<ReturnType<ProjectStore["finalizeVideoUpload"]>>;
type VideoFinalizeJob = {
  uploadId: string;
  sessionId: string;
  pageId: string;
  status: "processing" | "complete" | "error";
  expiresAt: number;
  result?: VideoFinalizeResult;
  error?: unknown;
};

async function exists(path: string) {
  try { await lstat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function ensureInside(root: string, candidate: string) {
  const rel = relative(root, candidate);
  // isAbsolute covers Windows cross-drive results, where relative() returns an
  // absolute path (e.g. "D:\\evil") that never starts with "..".
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || resolve(candidate) === resolve(root, "..")) {
    throw new WhiteboardError("PATH_ESCAPE", "Resolved path escapes the authorized project");
  }
}

async function ensureSafeDirectory(projectDir: string, segments: string[]) {
  const canonicalProject = await realpath(projectDir);
  let current = canonicalProject;
  for (const segment of segments) {
    if (!segment || segment === "." || segment === ".." || basename(segment) !== segment) {
      throw new WhiteboardError("PATH_ESCAPE", "Unsafe whiteboard path segment");
    }
    const candidate = join(current, segment);
    try {
      const info = await lstat(candidate);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new WhiteboardError("PATH_ESCAPE", `${candidate} must be a real directory, not a symlink`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(candidate, { mode: 0o700 });
      const created = await lstat(candidate);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new WhiteboardError("PATH_ESCAPE", `${candidate} changed while it was created`);
      }
    }
    const canonical = await realpath(candidate);
    ensureInside(canonicalProject, canonical);
    current = canonical;
  }
  return current;
}

async function assertSafeFile(projectDir: string, path: string) {
  const canonicalProject = await realpath(projectDir);
  const canonicalParent = await realpath(dirname(path));
  ensureInside(canonicalProject, canonicalParent);
  if (await exists(path)) {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) throw new WhiteboardError("PATH_ESCAPE", `${path} must be a regular file`);
  }
}

async function atomicJson(projectDir: string, path: string, value: unknown) {
  await assertSafeFile(projectDir, path);
  const temporary = join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${randomUUID()}`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  try {
    await assertSafeFile(projectDir, path);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function readJsonFile(projectDir: string, path: string) {
  await assertSafeFile(projectDir, path);
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function dataUrlFromResponse(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new WhiteboardError("INVALID_MEDIA", "Renoise task media URL must use HTTPS");
  const response = await fetch(parsed, { signal: AbortSignal.timeout(TASK_TIMEOUT_MS), redirect: "follow" });
  if (!response.ok || new URL(response.url).protocol !== "https:") {
    throw new WhiteboardError("INVALID_MEDIA", `Renoise media download failed with HTTP ${response.status}`);
  }
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!mime.startsWith("image/") || !(mime in MIME_EXTENSIONS)) throw new WhiteboardError("INVALID_MEDIA", `Unsupported Renoise image MIME ${mime || "unknown"}`);
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) throw new WhiteboardError("INVALID_MEDIA", "Renoise task media exceeds 20 MB");
  if (!response.body) throw new WhiteboardError("INVALID_MEDIA", "Renoise media response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new WhiteboardError("INVALID_MEDIA", "Renoise task media exceeds 20 MB");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function maxVideoBytes() {
  const configured = Number(process.env.RENOISE_WHITEBOARD_MAX_VIDEO_BYTES ?? DEFAULT_MAX_VIDEO_BYTES);
  if (!Number.isSafeInteger(configured) || configured < 1024 * 1024 || configured > 2 * 1024 * 1024 * 1024) {
    throw new WhiteboardError("INVALID_MEDIA", "RENOISE_WHITEBOARD_MAX_VIDEO_BYTES must be an integer between 1 MB and 2 GB");
  }
  return configured;
}

function validateMediaSignature(mimeType: string, bytes: Buffer) {
  const valid =
    (mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    || (mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (mimeType === "image/gif" && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii")))
    || (mimeType === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
    || (mimeType === "video/mp4" && bytes.subarray(4, 8).toString("ascii") === "ftyp")
    || (mimeType === "video/webm" && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])));
  if (!valid) throw new WhiteboardError("INVALID_MEDIA", `Media bytes do not match declared MIME ${mimeType}`);
}

function decodeChunkBase64(value: string) {
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > VIDEO_CHUNK_BYTES || bytes.toString("base64") !== value) {
    throw new WhiteboardError("INVALID_MEDIA", `Media chunks must be canonical base64 encoding of 1-${VIDEO_CHUNK_BYTES} bytes`);
  }
  return bytes;
}

export class ProjectStore {
  private readonly videoUploads = new Map<string, VideoUpload>();
  private readonly videoFinalizeJobs = new Map<string, VideoFinalizeJob>();
  private readonly imageUploads = new Map<string, ImageUpload>();
  private readonly videoReads = new Map<string, AssetReadLease>();
  private readonly verifiedAssetFiles = new Map<string, {
    dev: number;
    ino: number;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
    sha256: string;
  }>();
  private readonly assetVerificationTasks = new Map<string, Promise<{
    path: string;
    byteLength: number;
    mimeType: AssetRecord["mimeType"];
    sha256: string;
  }>>();
  private readonly transferTtlMs: number;

  constructor(options: { transferTtlMs?: number } = {}) {
    this.transferTtlMs = options.transferTtlMs ?? DEFAULT_TRANSFER_TTL_MS;
    if (!Number.isSafeInteger(this.transferTtlMs) || this.transferTtlMs < 10 || this.transferTtlMs > 24 * 60 * 60 * 1000) {
      throw new Error("transferTtlMs must be between 10 ms and 24 hours");
    }
  }

  private root(session: CanvasSession) {
    if (!session.projectDir) throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Session is not authorized");
    return join(session.projectDir, ".renoise", "whiteboard");
  }

  private pageDir(session: CanvasSession) {
    return join(this.root(session), "pages", session.pageId);
  }

  private revisionIntentPath(session: CanvasSession, revisionIntentId: string) {
    return join(this.root(session), "revision-intents", `${revisionIntentId}.json`);
  }

  private submissionTransactionPath(session: CanvasSession) {
    return join(this.root(session), "submission-transaction.json");
  }

  private assetPath(session: CanvasSession, relativePath: string) {
    return join(this.pageDir(session), relativePath);
  }

  private previewMetadataPath(session: CanvasSession, assetId: string) {
    return join(this.pageDir(session), "previews", `${assetId}.json`);
  }

  private armUploadExpiry(upload: VideoUpload) {
    clearTimeout(upload.timer);
    upload.expiresAt = Date.now() + this.transferTtlMs;
    upload.timer = setTimeout(() => {
      if (upload.busy) this.armUploadExpiry(upload);
      else void this.discardVideoUpload(upload.id);
    }, this.transferTtlMs);
    upload.timer.unref();
  }

  private armImageUploadExpiry(upload: ImageUpload) {
    clearTimeout(upload.timer);
    upload.expiresAt = Date.now() + this.transferTtlMs;
    upload.timer = setTimeout(() => {
      if (upload.busy) this.armImageUploadExpiry(upload);
      else void this.discardImageUpload(upload.id);
    }, this.transferTtlMs);
    upload.timer.unref();
  }

  private armReadExpiry(lease: AssetReadLease) {
    clearTimeout(lease.timer);
    lease.expiresAt = Date.now() + this.transferTtlMs;
    lease.timer = setTimeout(() => {
      if (lease.busy) this.armReadExpiry(lease);
      else void this.closeVideoReadLease(lease.id);
    }, this.transferTtlMs);
    lease.timer.unref();
  }

  private async discardVideoUpload(uploadId: string, force = false) {
    const upload = this.videoUploads.get(uploadId);
    if (!upload) return false;
    if (upload.busy && !force) return false;
    this.videoUploads.delete(uploadId);
    clearTimeout(upload.timer);
    await upload.handle.close().catch(() => undefined);
    await rm(upload.temporaryPath, { force: true });
    return true;
  }

  private async discardImageUpload(uploadId: string, force = false) {
    const upload = this.imageUploads.get(uploadId);
    if (!upload) return false;
    if (upload.busy && !force) return false;
    this.imageUploads.delete(uploadId);
    clearTimeout(upload.timer);
    await upload.handle.close().catch(() => undefined);
    await rm(upload.temporaryPath, { force: true });
    return true;
  }

  private async closeVideoReadLease(readLeaseId: string, force = false) {
    const lease = this.videoReads.get(readLeaseId);
    if (!lease) return false;
    if (lease.busy && !force) return false;
    this.videoReads.delete(readLeaseId);
    clearTimeout(lease.timer);
    await lease.handle.close().catch(() => undefined);
    return true;
  }

  async cleanupExpiredVideoTransfers(now = Date.now()) {
    const videoUploads = [...this.videoUploads.values()].filter(({ expiresAt }) => expiresAt <= now);
    const imageUploads = [...this.imageUploads.values()].filter(({ expiresAt }) => expiresAt <= now);
    const reads = [...this.videoReads.values()].filter(({ expiresAt }) => expiresAt <= now);
    const finalizeJobs = [...this.videoFinalizeJobs.values()].filter(({ status, expiresAt }) => status !== "processing" && expiresAt <= now);
    await Promise.all([
      ...videoUploads.map(({ id }) => this.discardVideoUpload(id)),
      ...imageUploads.map(({ id }) => this.discardImageUpload(id)),
      ...reads.map(({ id }) => this.closeVideoReadLease(id)),
    ]);
    for (const { uploadId } of finalizeJobs) this.videoFinalizeJobs.delete(uploadId);
    return { uploads: videoUploads.length + imageUploads.length, reads: reads.length };
  }

  private async ensureBase(session: CanvasSession) {
    if (!session.projectDir) throw new WhiteboardError("AUTHORIZATION_REQUIRED", "Session is not authorized");
    return ensureSafeDirectory(session.projectDir, [".renoise", "whiteboard"]);
  }

  private async ensurePage(session: CanvasSession) {
    await this.ensureBase(session);
    await ensureSafeDirectory(session.projectDir!, [".renoise", "whiteboard", "pages", session.pageId, "assets"]);
    await ensureSafeDirectory(session.projectDir!, [".renoise", "whiteboard", "pages", session.pageId, "previews"]);
    return this.pageDir(session);
  }

  mediaByteLimit(kind: "image" | "video") {
    return kind === "image" ? MAX_IMAGE_BYTES : maxVideoBytes();
  }

  async initialize(session: CanvasSession, pageName = session.requestedPageName) {
    const root = await this.ensureBase(session);
    const manifestPath = join(root, "manifest.json");
    if (await exists(manifestPath)) {
      const manifest = ManifestSchema.parse(await readJsonFile(session.projectDir!, manifestPath));
      session.pageId = manifest.activePageId;
    }
    await this.ensurePage(session);
    const boardPath = join(this.pageDir(session), "board.json");
    if (!(await exists(boardPath))) await atomicJson(session.projectDir!, boardPath, createEmptyDocument(session.pageId, pageName));
    const viewPath = join(root, "view-state.json");
    if (!(await exists(viewPath))) {
      await atomicJson(session.projectDir!, viewPath, {
        schemaVersion: 1,
        pageId: session.pageId,
        camera: { x: 0, y: 0, zoom: 1 },
        theme: "light",
        promptDrafts: {},
      });
    }
    const selectionPath = join(root, "selection.json");
    if (!(await exists(selectionPath))) {
      const document = WhiteboardDocumentSchema.parse(await readJsonFile(session.projectDir!, boardPath));
      await atomicJson(session.projectDir!, selectionPath, { schemaVersion: 1, pageId: session.pageId, documentRevision: document.page.revision, selectedObjectIds: [], selectedAnnotationIds: [] });
    }
    await ensureSafeDirectory(session.projectDir!, [".renoise", "whiteboard", "revision-intents"]);
    await atomicJson(session.projectDir!, manifestPath, { schemaVersion: 1, activePageId: session.pageId, updatedAt: new Date().toISOString() });
    await this.recoverSubmissionTransaction(session);
    await this.reconcileLegacySubmittedDraft(session);
  }

  private clearedDraftState(document: WhiteboardDocument, view: ViewState) {
    const clearedDocument = structuredClone(document);
    clearedDocument.page.revision = document.page.revision + 1;
    clearedDocument.page.objects = [];
    clearedDocument.page.annotations = [];
    const promptDrafts = { ...view.promptDrafts };
    delete promptDrafts[document.page.id];
    const clearedView = ViewStateSchema.parse({
      ...view,
      activeTargetId: undefined,
      promptDrafts,
    });
    const clearedSelection = SelectionStateSchema.parse({
      schemaVersion: 1,
      pageId: document.page.id,
      documentRevision: clearedDocument.page.revision,
      selectedObjectIds: [],
      selectedAnnotationIds: [],
    });
    return { clearedDocument, clearedView, clearedSelection };
  }

  private async applySubmissionTransaction(session: CanvasSession, transaction: z.infer<typeof SubmissionTransactionSchema>) {
    const root = this.root(session);
    await atomicJson(session.projectDir!, this.revisionIntentPath(session, transaction.revisionIntent.id), transaction.revisionIntent);
    await atomicJson(session.projectDir!, join(this.pageDir(session), "board.json"), transaction.document);
    await atomicJson(session.projectDir!, join(root, "selection.json"), transaction.selection);
    await atomicJson(session.projectDir!, join(root, "view-state.json"), transaction.view);
  }

  private async recoverSubmissionTransaction(session: CanvasSession) {
    const path = this.submissionTransactionPath(session);
    if (!(await exists(path))) return;
    const { lockPath, token } = await this.acquireLock(session);
    try {
      if (!(await exists(path))) return;
      const transaction = SubmissionTransactionSchema.parse(await readJsonFile(session.projectDir!, path));
      if (transaction.pageId !== session.pageId) throw new WhiteboardError("PATH_ESCAPE", "Submission transaction belongs to another page");
      await this.applySubmissionTransaction(session, transaction);
      await rm(path, { force: true });
    } finally {
      await this.releaseLock(lockPath, token);
    }
  }

  private async reconcileLegacySubmittedDraft(session: CanvasSession) {
    let latest: RevisionIntent;
    try { latest = await this.getLatestRevisionIntent(session); } catch { return; }
    if (latest.contextSnapshot) return;
    const { document, view, selection } = await this.getState(session);
    const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((id, index) => id === right[index]);
    const prompt = view.promptDrafts[document.page.id] ?? "";
    const hasUnsentInstruction = prompt.replace(/\[\[renoise-clip:[a-zA-Z0-9_-]+\]\]/g, "").trim().length > 0;
    if (latest.documentRevision !== document.page.revision
      || !sameIds(latest.selectedObjectIds, selection.selectedObjectIds)
      || !sameIds(latest.selectedAnnotationIds, selection.selectedAnnotationIds)
      || hasUnsentInstruction) return;
    const { lockPath, token } = await this.acquireLock(session);
    try {
      const revisionIntent = RevisionIntentSchema.parse({ ...latest, contextSnapshot: document });
      const { clearedDocument, clearedView, clearedSelection } = this.clearedDraftState(document, view);
      const transaction = SubmissionTransactionSchema.parse({
        schemaVersion: 1,
        pageId: session.pageId,
        revisionIntent,
        document: clearedDocument,
        selection: clearedSelection,
        view: clearedView,
      });
      await atomicJson(session.projectDir!, this.submissionTransactionPath(session), transaction);
      await this.applySubmissionTransaction(session, transaction);
      await rm(this.submissionTransactionPath(session), { force: true });
    } finally {
      await this.releaseLock(lockPath, token);
    }
  }

  private decodePreview(input: ImagePreviewInput) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(input.dataUrl);
    if (!match) throw new WhiteboardError("INVALID_MEDIA", "Preview must be a canonical base64 PNG, JPEG, or WebP image");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_PREVIEW_BYTES || bytes.toString("base64") !== match[2]) {
      throw new WhiteboardError("INVALID_MEDIA", `Preview must be between 1 byte and ${MAX_PREVIEW_BYTES} bytes`);
    }
    if (!Number.isSafeInteger(input.width) || !Number.isSafeInteger(input.height)
      || input.width <= 0 || input.height <= 0 || input.width > 1024 || input.height > 1024) {
      throw new WhiteboardError("INVALID_MEDIA", "Preview dimensions must be positive integers no larger than 1024 px");
    }
    validateMediaSignature(match[1], bytes);
    return { bytes, mimeType: match[1] as PreviewRecord["mimeType"] };
  }

  private async savePreviewBytes(
    session: CanvasSession,
    asset: AssetRecord,
    input: { bytes: Buffer; mimeType: PreviewRecord["mimeType"]; width: number; height: number },
  ): Promise<PreviewRecord> {
    if (!input.bytes.length || input.bytes.length > MAX_PREVIEW_BYTES) {
      throw new WhiteboardError("INVALID_MEDIA", `Preview must be between 1 byte and ${MAX_PREVIEW_BYTES} bytes`);
    }
    validateMediaSignature(input.mimeType, input.bytes);
    const extension = MIME_EXTENSIONS[input.mimeType];
    const relativePath = `previews/${asset.id}${extension}`;
    const target = this.assetPath(session, relativePath);
    const metadataPath = this.previewMetadataPath(session, asset.id);
    await Promise.all([
      assertSafeFile(session.projectDir!, target),
      assertSafeFile(session.projectDir!, metadataPath),
    ]);
    const temporary = join(dirname(target), `.${basename(target)}.tmp-${process.pid}-${randomUUID()}`);
    await writeFile(temporary, input.bytes, { flag: "wx", mode: 0o600 });
    let promoted = false;
    try {
      await rename(temporary, target);
      promoted = true;
      const preview = PreviewRecordSchema.parse({
        schemaVersion: 1,
        assetId: asset.id,
        sourceSha256: asset.sha256,
        previewSha256: createHash("sha256").update(input.bytes).digest("hex"),
        relativePath,
        mimeType: input.mimeType,
        byteLength: input.bytes.length,
        width: input.width,
        height: input.height,
        encoderVersion: PREVIEW_ENCODER_VERSION,
        createdAt: new Date().toISOString(),
      });
      await atomicJson(session.projectDir!, metadataPath, preview);
      return preview;
    } catch (error) {
      if (promoted) await rm(target, { force: true });
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async savePreviewDataUrl(session: CanvasSession, asset: AssetRecord, input: ImagePreviewInput) {
    const decoded = this.decodePreview(input);
    return this.savePreviewBytes(session, asset, { ...decoded, width: input.width, height: input.height });
  }

  async readDocument(session: CanvasSession) {
    await this.ensurePage(session);
    return WhiteboardDocumentSchema.parse(await readJsonFile(
      session.projectDir!,
      join(this.pageDir(session), "board.json"),
    ));
  }

  async getState(session: CanvasSession) {
    await this.ensurePage(session);
    const root = this.root(session);
    const document = await this.readDocument(session);
    const view = ViewStateSchema.parse(await readJsonFile(session.projectDir!, join(root, "view-state.json")));
    const selection = SelectionStateSchema.parse(await readJsonFile(session.projectDir!, join(root, "selection.json")));
    return { document, view, selection };
  }

  private async acquireLock(session: CanvasSession) {
    await this.ensurePage(session);
    const pageDir = this.pageDir(session);
    const lockPath = join(pageDir, ".write-lock");
    const token = randomUUID().replaceAll("-", "");
    const writeOwner = async () => {
      await writeFile(join(lockPath, "owner.json"), JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    };
    try {
      await mkdir(lockPath, { mode: 0o700 });
      await writeOwner();
      return { lockPath, token };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const ownerPath = join(lockPath, "owner.json");
    let owner;
    try {
      owner = LockOwnerSchema.parse(JSON.parse(await readFile(ownerPath, "utf8")));
    } catch {
      throw new WhiteboardError("REVISION_CONFLICT", "Write lock owner cannot be proven dead");
    }
    if (processIsAlive(owner.pid)) {
      throw new WhiteboardError("REVISION_CONFLICT", "Another live writer owns the page lock", { ownerPid: owner.pid });
    }
    const confirm = LockOwnerSchema.parse(JSON.parse(await readFile(ownerPath, "utf8")));
    if (confirm.token !== owner.token) throw new WhiteboardError("REVISION_CONFLICT", "Write lock changed during reclaim");
    const stalePath = join(pageDir, `.stale-lock-${owner.token}-${randomUUID().replaceAll("-", "")}`);
    await rename(lockPath, stalePath);
    const moved = LockOwnerSchema.parse(JSON.parse(await readFile(join(stalePath, "owner.json"), "utf8")));
    if (moved.token !== owner.token) {
      if (!(await exists(lockPath))) await rename(stalePath, lockPath);
      throw new WhiteboardError("REVISION_CONFLICT", "Write lock token changed during reclaim");
    }
    await rm(stalePath, { recursive: true, force: true });
    await mkdir(lockPath, { mode: 0o700 });
    await writeOwner();
    return { lockPath, token };
  }

  private async releaseLock(lockPath: string, token: string) {
    try {
      const owner = LockOwnerSchema.parse(JSON.parse(await readFile(join(lockPath, "owner.json"), "utf8")));
      if (owner.token === token) await rm(lockPath, { recursive: true, force: true });
    } catch {
      // Never remove a lock whose current ownership cannot be verified.
    }
  }

  async saveDocument(session: CanvasSession, input: WhiteboardDocument, expectedRevision: number, trustedNewAssetIds: string[] = []) {
    const { lockPath, token } = await this.acquireLock(session);
    try {
      const boardPath = join(this.pageDir(session), "board.json");
      const current = WhiteboardDocumentSchema.parse(await readJsonFile(session.projectDir!, boardPath));
      if (current.page.revision !== expectedRevision) {
        throw new WhiteboardError("REVISION_CONFLICT", `Expected revision ${expectedRevision}, current revision is ${current.page.revision}`, {
          currentRevision: current.page.revision,
        });
      }
      const parsed = WhiteboardDocumentSchema.parse(input);
      if (parsed.page.id !== session.pageId) throw new WhiteboardError("PATH_ESCAPE", "Document page does not belong to this session");
      const trustedNew = new Set(trustedNewAssetIds);
      for (const [assetId, asset] of Object.entries(parsed.page.assets)) {
        const trusted = current.page.assets[assetId];
        if ((!trusted && !trustedNew.has(assetId)) || (trusted && JSON.stringify(trusted) !== JSON.stringify(asset))) {
          throw new WhiteboardError("INVALID_MEDIA", "Document writes cannot create or mutate asset records");
        }
        if (!trusted) {
          if (asset.mimeType === "video/mp4" || asset.mimeType === "video/webm") {
            const lease = await this.beginVideoRead(session, asset);
            await this.closeVideoRead(session, lease.readLeaseId);
          } else {
            await this.readAssetBytes(session, asset);
          }
        }
      }
      const referencedAssetIds = new Set<string>();
      for (const object of parsed.page.objects) {
        if (object.type === "image") referencedAssetIds.add(object.data.assetId);
        if (object.type === "video-card") {
          referencedAssetIds.add(object.data.assetId);
          if (object.data.playbackAssetId) referencedAssetIds.add(object.data.playbackAssetId);
          if (object.data.posterAssetId) referencedAssetIds.add(object.data.posterAssetId);
        }
      }
      for (const assetId of referencedAssetIds) {
        if (!parsed.page.assets[assetId]) {
          throw new WhiteboardError("INVALID_MEDIA", `Object references missing asset ${assetId}`);
        }
      }
      const next = structuredClone(parsed);
      next.page.revision = expectedRevision + 1;
      await atomicJson(session.projectDir!, boardPath, next);
      const removedAssets = Object.values(current.page.assets).filter(({ id }) => !next.page.assets[id]);
      if (removedAssets.length) {
        await Promise.allSettled(removedAssets.map((asset) => this.removeAsset(session, asset)));
      }
      return next;
    } finally {
      await this.releaseLock(lockPath, token);
    }
  }

  async saveView(session: CanvasSession, input: ViewState): Promise<ViewState> {
    await this.ensurePage(session);
    const parsed = ViewStateSchema.parse(input);
    if (parsed.pageId !== session.pageId) throw new WhiteboardError("PATH_ESCAPE", "View page does not belong to this session");
    await atomicJson(session.projectDir!, join(this.root(session), "view-state.json"), parsed);
    return parsed;
  }

  async saveSelection(session: CanvasSession, input: SelectionState): Promise<SelectionState> {
    const parsed = SelectionStateSchema.parse(input);
    const { document } = await this.getState(session);
    if (parsed.pageId !== session.pageId || parsed.documentRevision !== document.page.revision) {
      throw new WhiteboardError("STALE_SELECTION", "Selection must be bound to the current page revision");
    }
    const objectIds = new Set(document.page.objects.map(({ id }) => id));
    if (parsed.selectedObjectIds.some((id) => !objectIds.has(id))) {
      throw new WhiteboardError("STALE_SELECTION", "Selection contains an object that does not exist");
    }
    const annotations = new Map(document.page.annotations.map((annotation) => [annotation.id, annotation]));
    for (const id of parsed.selectedAnnotationIds) {
      const annotation = annotations.get(id);
      if (!annotation) throw new WhiteboardError("STALE_SELECTION", `Selection contains unknown annotation ${id}`);
      if (![...annotation.targetObjectIds, ...annotation.markObjectIds].some((objectId) => parsed.selectedObjectIds.includes(objectId))) {
        throw new WhiteboardError("STALE_SELECTION", `Annotation ${id} is unrelated to the explicit object selection`);
      }
    }
    await atomicJson(session.projectDir!, join(this.root(session), "selection.json"), parsed);
    return parsed;
  }

  async submitRevisionIntent(
    session: CanvasSession,
    input: { expectedRevision: number; instruction: string },
  ) {
    const { lockPath, token } = await this.acquireLock(session);
    try {
    const { document, view, selection } = await this.getState(session);
    if (document.page.revision !== input.expectedRevision || selection.documentRevision !== input.expectedRevision) {
      throw new WhiteboardError("STALE_SELECTION", "Revision intent must use the current saved document and selection");
    }
    if (!selection.selectedObjectIds.length) {
      throw new WhiteboardError("STALE_SELECTION", "Select at least one source media object before submitting a revision");
    }
    const selectedIds = new Set(selection.selectedObjectIds);
    const selectedAnnotations = document.page.annotations.filter(({ id }) => selection.selectedAnnotationIds.includes(id));
    const targetIds = new Set(selectedAnnotations.flatMap(({ targetObjectIds }) => targetObjectIds));
    const markIds = new Set(selectedAnnotations.flatMap(({ markObjectIds }) => markObjectIds));
    for (const object of document.page.objects) {
      if (selectedIds.has(object.id) && (object.type === "image" || object.type === "video-card")) targetIds.add(object.id);
    }
    const byId = new Map(document.page.objects.map((object) => [object.id, object]));
    const sources = [...targetIds].map((objectId) => {
      const object = byId.get(objectId);
      if (!object || (object.type !== "image" && object.type !== "video-card")) {
        throw new WhiteboardError("STALE_SELECTION", `Revision target ${objectId} is not reviewable media`);
      }
      const assetId = object.data.assetId;
      const asset = document.page.assets[assetId];
      if (!asset) throw new WhiteboardError("ASSET_NOT_FOUND", `Revision target ${objectId} has no trusted asset`);
      const source = object.type === "image" ? object.data.source : undefined;
      const frameSource = source && "kind" in source && source.kind === "video-frame" ? source : undefined;
      const sourceTimeMs = frameSource?.timeMs ?? (object.type === "video-card" ? object.data.timeMs : null);
      return {
        objectId,
        objectType: object.type,
        assetId,
        assetSha256: asset.sha256,
        sourceTimeMs,
        ...(frameSource
          ? { sourceVideoAssetId: frameSource.videoAssetId, sourceVideoSha256: frameSource.videoSha256 }
          : object.type === "video-card"
            ? { sourceVideoAssetId: assetId, sourceVideoSha256: asset.sha256 }
            : {}),
      };
    });
    if (!sources.length) {
      throw new WhiteboardError("STALE_SELECTION", "The explicit selection contains no reviewable image or video");
    }
    const intent = RevisionIntentSchema.parse({
      schemaVersion: 1,
      id: `intent_${randomUUID().replaceAll("-", "")}`,
      pageId: document.page.id,
      documentRevision: document.page.revision,
      instruction: input.instruction,
      selectedObjectIds: selection.selectedObjectIds,
      selectedAnnotationIds: selection.selectedAnnotationIds,
      targetObjectIds: [...targetIds],
      markObjectIds: [...markIds],
      sources,
      status: "submitted",
      resultObjectIds: [],
      createdAt: new Date().toISOString(),
      contextSnapshot: document,
    });
    await ensureSafeDirectory(session.projectDir!, [".renoise", "whiteboard", "revision-intents"]);
    const { clearedDocument, clearedView, clearedSelection } = this.clearedDraftState(document, view);
    const transaction = SubmissionTransactionSchema.parse({
      schemaVersion: 1,
      pageId: session.pageId,
      revisionIntent: intent,
      document: clearedDocument,
      selection: clearedSelection,
      view: clearedView,
    });
    await atomicJson(session.projectDir!, this.submissionTransactionPath(session), transaction);
    await this.applySubmissionTransaction(session, transaction);
    await rm(this.submissionTransactionPath(session), { force: true });
    return { revisionIntent: intent, document: clearedDocument, selection: clearedSelection, view: clearedView };
    } finally {
      await this.releaseLock(lockPath, token);
    }
  }

  async getRevisionIntent(session: CanvasSession, revisionIntentId: string): Promise<RevisionIntent> {
    const parsedId = IdSchema.parse(revisionIntentId);
    await ensureSafeDirectory(session.projectDir!, [".renoise", "whiteboard", "revision-intents"]);
    const path = this.revisionIntentPath(session, parsedId);
    if (!(await exists(path))) throw new WhiteboardError("STALE_SELECTION", "Revision intent does not exist in this whiteboard project");
    const intent = RevisionIntentSchema.parse(await readJsonFile(session.projectDir!, path));
    if (intent.pageId !== session.pageId) throw new WhiteboardError("PATH_ESCAPE", "Revision intent belongs to another page");
    return intent;
  }

  async getLatestRevisionIntent(session: CanvasSession): Promise<RevisionIntent> {
    const directory = await ensureSafeDirectory(session.projectDir!, [".renoise", "whiteboard", "revision-intents"]);
    const intents: RevisionIntent[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const match = /^(intent_[a-f0-9]{32})\.json$/.exec(entry.name);
      if (!entry.isFile() || !match) continue;
      try {
        const intent = RevisionIntentSchema.parse(await readJsonFile(session.projectDir!, join(directory, entry.name)));
        if (intent.id === match[1] && intent.pageId === session.pageId) intents.push(intent);
      } catch {
        // An invalid history entry must not prevent recovery of other valid persisted intents.
      }
    }
    intents.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    const latest = intents[0];
    if (!latest) throw new WhiteboardError("STALE_SELECTION", "No persisted revision intent exists for this authorized page");
    return latest;
  }

  async completeRevisionIntent(session: CanvasSession, revisionIntentId: string, resultObjectId: string) {
    const intent = await this.getRevisionIntent(session, revisionIntentId);
    const next = RevisionIntentSchema.parse({
      ...intent,
      status: "completed",
      resultObjectIds: [...new Set([...intent.resultObjectIds, IdSchema.parse(resultObjectId)])],
      completedAt: new Date().toISOString(),
    });
    await atomicJson(session.projectDir!, this.revisionIntentPath(session, next.id), next);
    return next;
  }

  private async cleanupStaleUploadFiles(session: CanvasSession, now = Date.now()) {
    await this.ensurePage(session);
    const assetsDir = join(this.pageDir(session), "assets");
    const active = new Set([
      ...this.videoUploads.values(),
      ...this.imageUploads.values(),
    ].map(({ temporaryPath }) => temporaryPath));
    for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !/^\.upload_[a-f0-9]{32}\.part$/.test(entry.name)) continue;
      const path = join(assetsDir, entry.name);
      if (active.has(path)) continue;
      await assertSafeFile(session.projectDir!, path);
      const info = await stat(path);
      if (now - info.mtimeMs >= this.transferTtlMs) await rm(path, { force: true });
    }
  }

  async beginImageUpload(session: CanvasSession, input: {
    expectedRevision: number;
    fileName: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    byteLength: number;
    width: number;
    height: number;
  }) {
    await this.cleanupExpiredVideoTransfers();
    await this.cleanupStaleUploadFiles(session);
    if (input.byteLength <= 0 || input.byteLength > MAX_IMAGE_BYTES) {
      throw new WhiteboardError("INVALID_MEDIA", `Image must be between 1 byte and ${MAX_IMAGE_BYTES} bytes`);
    }
    if (!Number.isSafeInteger(input.width) || !Number.isSafeInteger(input.height)
      || input.width <= 0 || input.height <= 0 || input.width > 100_000 || input.height > 100_000) {
      throw new WhiteboardError("INVALID_MEDIA", "Source image dimensions are invalid");
    }
    const { document } = await this.getState(session);
    if (document.page.revision !== input.expectedRevision) {
      throw new WhiteboardError("REVISION_CONFLICT", `Expected revision ${input.expectedRevision}, current revision is ${document.page.revision}`, {
        currentRevision: document.page.revision,
      });
    }
    const id = `upload_${randomUUID().replaceAll("-", "")}`;
    const temporaryPath = join(this.pageDir(session), "assets", `.${id}.part`);
    await assertSafeFile(session.projectDir!, temporaryPath);
    const handle = await open(temporaryPath, "wx", 0o600);
    const upload: ImageUpload = {
      id,
      sessionId: session.id,
      pageId: session.pageId,
      expectedRevision: input.expectedRevision,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteLength: input.byteLength,
      width: input.width,
      height: input.height,
      received: 0,
      nextIndex: 0,
      header: Buffer.alloc(0),
      hash: createHash("sha256"),
      handle,
      temporaryPath,
      expiresAt: 0,
    };
    this.imageUploads.set(id, upload);
    this.armImageUploadExpiry(upload);
    return {
      uploadId: id,
      chunkBytes: VIDEO_CHUNK_BYTES,
      byteLength: input.byteLength,
      received: 0,
      nextIndex: 0,
      expiresAt: new Date(upload.expiresAt).toISOString(),
    };
  }

  private async acquireImageUpload(
    session: CanvasSession,
    uploadId: string,
    operation: NonNullable<ImageUpload["busy"]>,
  ) {
    const upload = this.imageUploads.get(uploadId);
    if (!upload || upload.sessionId !== session.id || upload.pageId !== session.pageId) {
      throw new WhiteboardError("ASSET_NOT_FOUND", "Image upload does not belong to this session");
    }
    if (upload.busy) throw new WhiteboardError("REVISION_CONFLICT", `Image upload is busy with ${upload.busy}`);
    if (upload.expiresAt <= Date.now()) {
      await this.discardImageUpload(upload.id);
      throw new WhiteboardError("ASSET_NOT_FOUND", "Image upload expired");
    }
    clearTimeout(upload.timer);
    upload.busy = operation;
    return upload;
  }

  private releaseImageUpload(upload: ImageUpload, operation: NonNullable<ImageUpload["busy"]>) {
    if (this.imageUploads.get(upload.id) !== upload || upload.busy !== operation) return;
    upload.busy = undefined;
    this.armImageUploadExpiry(upload);
  }

  private imageUploadAck(upload: ImageUpload) {
    return {
      uploadId: upload.id,
      received: upload.received,
      nextIndex: upload.nextIndex,
      complete: upload.received === upload.byteLength,
      expiresAt: new Date(Date.now() + this.transferTtlMs).toISOString(),
    };
  }

  async appendImageUpload(session: CanvasSession, input: {
    uploadId: string;
    index: number;
    offset: number;
    dataBase64: string;
  }) {
    const upload = await this.acquireImageUpload(session, input.uploadId, "append");
    try {
      const bytes = decodeChunkBase64(input.dataBase64);
      const chunkSha256 = createHash("sha256").update(bytes).digest("hex");
      const previous = upload.lastAccepted;
      if (previous && input.index === previous.index && input.offset === previous.offset) {
        if (bytes.length !== previous.byteLength || chunkSha256 !== previous.sha256) {
          throw new WhiteboardError("REVISION_CONFLICT", "Replayed image chunk differs from the last accepted payload");
        }
        return this.imageUploadAck(upload);
      }
      if (input.index !== upload.nextIndex || input.offset !== upload.received) {
        throw new WhiteboardError("REVISION_CONFLICT", "Image chunks must be appended exactly once in sequential index/offset order", {
          expectedIndex: upload.nextIndex,
          expectedOffset: upload.received,
        });
      }
      if (upload.received + bytes.length > upload.byteLength) {
        throw new WhiteboardError("INVALID_MEDIA", "Image chunk exceeds the declared byteLength");
      }
      const { bytesWritten } = await upload.handle.write(bytes, 0, bytes.length, upload.received);
      if (bytesWritten !== bytes.length) {
        await this.discardImageUpload(upload.id, true);
        throw new WhiteboardError("INVALID_MEDIA", "Image chunk could not be written completely");
      }
      upload.hash.update(bytes);
      if (upload.header.length < 16) {
        upload.header = Buffer.concat([upload.header, bytes.subarray(0, 16 - upload.header.length)]);
      }
      upload.received += bytes.length;
      upload.nextIndex += 1;
      upload.lastAccepted = {
        index: input.index,
        offset: input.offset,
        byteLength: bytes.length,
        sha256: chunkSha256,
      };
      return this.imageUploadAck(upload);
    } finally {
      this.releaseImageUpload(upload, "append");
    }
  }

  async abortImageUpload(session: CanvasSession, uploadId: string) {
    const upload = await this.acquireImageUpload(session, uploadId, "abort");
    try {
      await this.discardImageUpload(upload.id, true);
      return { uploadId, aborted: true };
    } finally {
      this.releaseImageUpload(upload, "abort");
    }
  }

  async finalizeImageUpload(session: CanvasSession, uploadId: string) {
    const upload = await this.acquireImageUpload(session, uploadId, "finalize");
    let asset: AssetRecord | undefined;
    try {
      if (upload.received !== upload.byteLength) {
        throw new WhiteboardError("INVALID_MEDIA", `Image upload is incomplete: ${upload.received}/${upload.byteLength} bytes`);
      }
      validateMediaSignature(upload.mimeType, upload.header);
      await upload.handle.sync();
      await upload.handle.close();
      const info = await stat(upload.temporaryPath);
      if (!info.isFile() || info.size !== upload.byteLength) {
        throw new WhiteboardError("INVALID_MEDIA", "Image upload size changed before finalize");
      }
      const id = `asset_${randomUUID().replaceAll("-", "")}`;
      const relativePath = `assets/${id}${MIME_EXTENSIONS[upload.mimeType]}`;
      const target = this.assetPath(session, relativePath);
      await assertSafeFile(session.projectDir!, target);
      await rename(upload.temporaryPath, target);
      asset = {
        id,
        relativePath,
        mimeType: upload.mimeType,
        sha256: upload.hash.digest("hex"),
        byteLength: upload.byteLength,
        width: upload.width,
        height: upload.height,
        createdAt: new Date().toISOString(),
      };
      const state = await this.getState(session);
      state.document.page.assets[asset.id] = asset;
      const document = await this.saveDocument(session, state.document, upload.expectedRevision, [asset.id]);
      this.imageUploads.delete(upload.id);
      return {
        uploadId: upload.id,
        asset,
        fileName: upload.fileName,
        document,
        revision: document.page.revision,
      };
    } catch (error) {
      if (asset) await this.removeAsset(session, asset);
      throw error;
    } finally {
      this.imageUploads.delete(upload.id);
      await upload.handle.close().catch(() => undefined);
      await rm(upload.temporaryPath, { force: true });
    }
  }

  async beginVideoUpload(session: CanvasSession, input: {
    expectedRevision: number;
    fileName: string;
    mimeType: "video/mp4" | "video/webm";
    byteLength: number;
    durationMs: number;
    createPlaybackProxy?: boolean;
  }) {
    await this.cleanupExpiredVideoTransfers();
    await this.cleanupStaleUploadFiles(session);
    if (input.byteLength <= 0 || input.byteLength > maxVideoBytes()) {
      throw new WhiteboardError("INVALID_MEDIA", `Video must be between 1 byte and ${maxVideoBytes()} bytes`);
    }
    const { document } = await this.getState(session);
    if (document.page.revision !== input.expectedRevision) {
      throw new WhiteboardError("REVISION_CONFLICT", `Expected revision ${input.expectedRevision}, current revision is ${document.page.revision}`, {
        currentRevision: document.page.revision,
      });
    }
    const id = `upload_${randomUUID().replaceAll("-", "")}`;
    const temporaryPath = join(this.pageDir(session), "assets", `.${id}.part`);
    await assertSafeFile(session.projectDir!, temporaryPath);
    const handle = await open(temporaryPath, "wx", 0o600);
    const upload: VideoUpload = {
      id,
      sessionId: session.id,
      pageId: session.pageId,
      expectedRevision: input.expectedRevision,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteLength: input.byteLength,
      durationMs: input.durationMs,
      createPlaybackProxy: input.createPlaybackProxy === true,
      received: 0,
      nextIndex: 0,
      header: Buffer.alloc(0),
      hash: createHash("sha256"),
      handle,
      temporaryPath,
      expiresAt: 0,
    };
    this.videoUploads.set(id, upload);
    this.armUploadExpiry(upload);
    return {
      uploadId: id,
      chunkBytes: VIDEO_CHUNK_BYTES,
      byteLength: input.byteLength,
      received: 0,
      nextIndex: 0,
      expiresAt: new Date(upload.expiresAt).toISOString(),
    };
  }

  private async acquireVideoUpload(session: CanvasSession, uploadId: string, operation: NonNullable<VideoUpload["busy"]>) {
    const upload = this.videoUploads.get(uploadId);
    if (!upload || upload.sessionId !== session.id || upload.pageId !== session.pageId) {
      throw new WhiteboardError("ASSET_NOT_FOUND", "Video upload does not belong to this session");
    }
    if (upload.busy) throw new WhiteboardError("REVISION_CONFLICT", `Video upload is busy with ${upload.busy}`);
    if (upload.expiresAt <= Date.now()) {
      await this.discardVideoUpload(upload.id);
      throw new WhiteboardError("ASSET_NOT_FOUND", "Video upload expired");
    }
    clearTimeout(upload.timer);
    upload.busy = operation;
    return upload;
  }

  private releaseVideoUpload(upload: VideoUpload, operation: NonNullable<VideoUpload["busy"]>) {
    if (this.videoUploads.get(upload.id) !== upload || upload.busy !== operation) return;
    upload.busy = undefined;
    this.armUploadExpiry(upload);
  }

  private videoUploadAck(upload: VideoUpload) {
    return {
      uploadId: upload.id,
      received: upload.received,
      nextIndex: upload.nextIndex,
      complete: upload.received === upload.byteLength,
      expiresAt: new Date(Date.now() + this.transferTtlMs).toISOString(),
    };
  }

  async appendVideoUpload(session: CanvasSession, input: {
    uploadId: string;
    index: number;
    offset: number;
    dataBase64: string;
  }) {
    return this.appendVideoUploadBytes(session, {
      uploadId: input.uploadId,
      index: input.index,
      offset: input.offset,
      bytes: decodeChunkBase64(input.dataBase64),
    });
  }

  async appendVideoUploadBytes(session: CanvasSession, input: {
    uploadId: string;
    index: number;
    offset: number;
    bytes: Buffer;
  }) {
    const upload = await this.acquireVideoUpload(session, input.uploadId, "append");
    try {
      const bytes = input.bytes;
      if (!bytes.length || bytes.length > VIDEO_CHUNK_BYTES) {
        throw new WhiteboardError("INVALID_MEDIA", `Video chunks must contain 1-${VIDEO_CHUNK_BYTES} bytes`);
      }
      const chunkSha256 = createHash("sha256").update(bytes).digest("hex");
      const previous = upload.lastAccepted;
      if (previous && input.index === previous.index && input.offset === previous.offset) {
        if (bytes.length !== previous.byteLength || chunkSha256 !== previous.sha256) {
          throw new WhiteboardError("REVISION_CONFLICT", "Replayed video chunk differs from the last accepted payload");
        }
        return this.videoUploadAck(upload);
      }
      if (input.index !== upload.nextIndex || input.offset !== upload.received) {
        throw new WhiteboardError("REVISION_CONFLICT", "Video chunks must be appended exactly once in sequential index/offset order", {
          expectedIndex: upload.nextIndex,
          expectedOffset: upload.received,
        });
      }
      if (upload.received + bytes.length > upload.byteLength) {
        throw new WhiteboardError("INVALID_MEDIA", "Video chunk exceeds the declared byteLength");
      }
      const { bytesWritten } = await upload.handle.write(bytes, 0, bytes.length, upload.received);
      if (bytesWritten !== bytes.length) {
        await this.discardVideoUpload(upload.id, true);
        throw new WhiteboardError("INVALID_MEDIA", "Video chunk could not be written completely");
      }
      upload.hash.update(bytes);
      if (upload.header.length < 16) {
        upload.header = Buffer.concat([upload.header, bytes.subarray(0, 16 - upload.header.length)]);
      }
      upload.received += bytes.length;
      upload.nextIndex += 1;
      upload.lastAccepted = {
        index: input.index,
        offset: input.offset,
        byteLength: bytes.length,
        sha256: chunkSha256,
      };
      return this.videoUploadAck(upload);
    } finally {
      this.releaseVideoUpload(upload, "append");
    }
  }

  async abortVideoUpload(session: CanvasSession, uploadId: string) {
    const upload = await this.acquireVideoUpload(session, uploadId, "abort");
    try {
      await this.discardVideoUpload(upload.id, true);
      return { uploadId, aborted: true };
    } finally {
      this.releaseVideoUpload(upload, "abort");
    }
  }

  async finalizeVideoUpload(session: CanvasSession, uploadId: string) {
    const upload = await this.acquireVideoUpload(session, uploadId, "finalize");
    let asset: AssetRecord | undefined;
    let playbackAsset: AssetRecord | undefined;
    let poster: AssetRecord | undefined;
    const playbackTemporaryPath = `${upload.temporaryPath}.playback.webm`;
    const posterTemporaryPath = `${upload.temporaryPath}.poster.png`;
    try {
      if (upload.received !== upload.byteLength) {
        throw new WhiteboardError("INVALID_MEDIA", `Video upload is incomplete: ${upload.received}/${upload.byteLength} bytes`);
      }
      validateMediaSignature(upload.mimeType, upload.header);
      await upload.handle.sync();
      await upload.handle.close();
      const info = await stat(upload.temporaryPath);
      if (!info.isFile() || info.size !== upload.byteLength) throw new WhiteboardError("INVALID_MEDIA", "Video upload size changed before finalize");
      const normalized = upload.createPlaybackProxy
        ? await createBrowserVideoProxy({
            inputPath: upload.temporaryPath,
            playbackPath: playbackTemporaryPath,
            posterPath: posterTemporaryPath,
            maximumPlaybackBytes: maxVideoBytes(),
          })
        : undefined;
      const sha256 = upload.hash.digest("hex");
      const id = `asset_${randomUUID().replaceAll("-", "")}`;
      const relativePath = `assets/${id}${MIME_EXTENSIONS[upload.mimeType]}`;
      const target = this.assetPath(session, relativePath);
      await assertSafeFile(session.projectDir!, target);
      await rename(upload.temporaryPath, target);
      asset = {
        id,
        relativePath,
        mimeType: upload.mimeType,
        sha256,
        byteLength: upload.byteLength,
        createdAt: new Date().toISOString(),
      };
      if (normalized) {
        const playbackId = `asset_${randomUUID().replaceAll("-", "")}`;
        const playbackRelativePath = `assets/${playbackId}.webm`;
        const playbackTarget = this.assetPath(session, playbackRelativePath);
        await assertSafeFile(session.projectDir!, playbackTarget);
        await rename(normalized.playbackPath, playbackTarget);
        playbackAsset = {
          id: playbackId,
          relativePath: playbackRelativePath,
          mimeType: "video/webm",
          sha256: normalized.playbackSha256,
          byteLength: normalized.playbackByteLength,
          width: normalized.width,
          height: normalized.height,
          createdAt: new Date().toISOString(),
        };
        const posterBytes = await readFile(normalized.posterPath);
        poster = (await this.saveImageBytes(session, posterBytes, "image/png", {
          width: normalized.posterWidth,
          height: normalized.posterHeight,
        })).asset;
      }
      const state = await this.getState(session);
      state.document.page.assets[asset.id] = asset;
      if (playbackAsset) state.document.page.assets[playbackAsset.id] = playbackAsset;
      if (poster) state.document.page.assets[poster.id] = poster;
      const trusted = [asset.id, ...(playbackAsset ? [playbackAsset.id] : []), ...(poster ? [poster.id] : [])];
      const document = await this.saveDocument(session, state.document, upload.expectedRevision, trusted);
      this.videoUploads.delete(upload.id);
      return {
        uploadId: upload.id,
        asset,
        playbackAsset,
        posterAsset: poster,
        fileName: upload.fileName,
        durationMs: normalized?.durationMs ?? upload.durationMs,
        width: normalized?.width,
        height: normalized?.height,
        document,
        revision: document.page.revision,
      };
    } catch (error) {
      if (asset) await this.removeAsset(session, asset);
      if (playbackAsset) await this.removeAsset(session, playbackAsset);
      if (poster) await this.removeAsset(session, poster);
      throw error;
    } finally {
      this.videoUploads.delete(upload.id);
      await upload.handle.close().catch(() => undefined);
      await rm(upload.temporaryPath, { force: true });
      await rm(playbackTemporaryPath, { force: true });
      await rm(posterTemporaryPath, { force: true });
    }
  }

  async startVideoUploadFinalize(session: CanvasSession, uploadId: string) {
    await this.cleanupExpiredVideoTransfers();
    const existing = this.videoFinalizeJobs.get(uploadId);
    if (existing) {
      this.assertVideoFinalizeJobOwner(session, existing);
      if (existing.status === "error") throw existing.error;
      if (existing.status === "complete" && existing.result) {
        return { status: "complete" as const, ...existing.result };
      }
      return { uploadId, status: "processing" as const };
    }
    const upload = this.videoUploads.get(uploadId);
    if (!upload || upload.sessionId !== session.id || upload.pageId !== session.pageId) {
      throw new WhiteboardError("INVALID_MEDIA", "Video upload does not belong to this session or has expired");
    }
    const job: VideoFinalizeJob = {
      uploadId,
      sessionId: session.id,
      pageId: session.pageId,
      status: "processing",
      expiresAt: Number.POSITIVE_INFINITY,
    };
    this.videoFinalizeJobs.set(uploadId, job);
    void this.finalizeVideoUpload(session, uploadId).then((result) => {
      job.result = result;
      job.status = "complete";
      job.expiresAt = Date.now() + this.transferTtlMs;
    }).catch((error: unknown) => {
      job.error = error;
      job.status = "error";
      job.expiresAt = Date.now() + this.transferTtlMs;
    });
    return { uploadId, status: "processing" as const };
  }

  getVideoUploadFinalizeStatus(session: CanvasSession, uploadId: string) {
    const job = this.videoFinalizeJobs.get(uploadId);
    if (!job) throw new WhiteboardError("INVALID_MEDIA", "Video processing job does not exist or has expired");
    this.assertVideoFinalizeJobOwner(session, job);
    if (job.status === "error") throw job.error;
    if (job.status === "complete" && job.result) return { status: "complete" as const, ...job.result };
    return { uploadId, status: "processing" as const };
  }

  private assertVideoFinalizeJobOwner(session: CanvasSession, job: VideoFinalizeJob) {
    if (job.sessionId !== session.id || job.pageId !== session.pageId) {
      throw new WhiteboardError("INVALID_MEDIA", "Video processing job does not belong to this session");
    }
  }

  private async beginAssetRead(session: CanvasSession, asset: AssetRecord, kind: AssetReadLease["kind"]) {
    await this.cleanupExpiredVideoTransfers();
    const path = this.assetPath(session, asset.relativePath);
    await assertSafeFile(session.projectDir!, path);
    const canonical = await realpath(path);
    ensureInside(await realpath(this.pageDir(session)), canonical);
    const handle = await open(canonical, "r");
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size !== asset.byteLength) throw new WhiteboardError("INVALID_MEDIA", "Asset size does not match its document record");
      const hash = createHash("sha256");
      const buffer = Buffer.allocUnsafe(VIDEO_CHUNK_BYTES);
      let offset = 0;
      let header = Buffer.alloc(0);
      while (offset < asset.byteLength) {
        const length = Math.min(buffer.length, asset.byteLength - offset);
        const { bytesRead } = await handle.read(buffer, 0, length, offset);
        if (!bytesRead) throw new WhiteboardError("INVALID_MEDIA", "Asset ended before its declared byteLength");
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        if (header.length < 16) header = Buffer.concat([header, chunk.subarray(0, 16 - header.length)]);
        offset += bytesRead;
      }
      if (hash.digest("hex") !== asset.sha256) throw new WhiteboardError("INVALID_MEDIA", "Asset hash does not match the document record");
      validateMediaSignature(asset.mimeType, header);
      const id = `read_${randomUUID().replaceAll("-", "")}`;
      const lease: AssetReadLease = {
        id,
        sessionId: session.id,
        assetId: asset.id,
        kind,
        mimeType: asset.mimeType,
        byteLength: asset.byteLength,
        handle,
        expiresAt: 0,
      };
      this.videoReads.set(id, lease);
      this.armReadExpiry(lease);
      return {
        readLeaseId: id,
        assetId: asset.id,
        mimeType: asset.mimeType,
        byteLength: asset.byteLength,
        chunkBytes: VIDEO_CHUNK_BYTES,
        expiresAt: new Date(lease.expiresAt).toISOString(),
      };
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw error;
    }
  }

  async beginVideoRead(session: CanvasSession, asset: AssetRecord) {
    if (asset.mimeType !== "video/mp4" && asset.mimeType !== "video/webm") {
      throw new WhiteboardError("INVALID_MEDIA", "Chunked video reads are only available for video assets");
    }
    return this.beginAssetRead(session, asset, "video");
  }

  async beginImageRead(session: CanvasSession, asset: AssetRecord) {
    if (!asset.mimeType.startsWith("image/")) {
      throw new WhiteboardError("INVALID_MEDIA", "Chunked image reads are only available for image assets");
    }
    return this.beginAssetRead(session, asset, "image");
  }

  private async acquireAssetRead(
    session: CanvasSession,
    readLeaseId: string,
    operation: NonNullable<AssetReadLease["busy"]>,
    kind: AssetReadLease["kind"],
  ) {
    const lease = this.videoReads.get(readLeaseId);
    if (!lease || lease.sessionId !== session.id || lease.kind !== kind) {
      throw new WhiteboardError("ASSET_NOT_FOUND", `${kind === "image" ? "Image" : "Video"} read lease does not belong to this session`);
    }
    if (lease.busy) throw new WhiteboardError("REVISION_CONFLICT", `Asset read lease is busy with ${lease.busy}`);
    if (lease.expiresAt <= Date.now()) {
      await this.closeVideoReadLease(lease.id);
      throw new WhiteboardError("ASSET_NOT_FOUND", "Asset read lease expired");
    }
    clearTimeout(lease.timer);
    lease.busy = operation;
    return lease;
  }

  private releaseAssetRead(lease: AssetReadLease, operation: NonNullable<AssetReadLease["busy"]>) {
    if (this.videoReads.get(lease.id) !== lease || lease.busy !== operation) return;
    lease.busy = undefined;
    this.armReadExpiry(lease);
  }

  private async readAssetChunk(
    session: CanvasSession,
    input: { readLeaseId: string; offset: number; length: number },
    kind: AssetReadLease["kind"],
  ) {
    const lease = await this.acquireAssetRead(session, input.readLeaseId, "read", kind);
    try {
      if (input.offset > lease.byteLength) throw new WhiteboardError("INVALID_MEDIA", "Asset read offset is beyond EOF");
      const length = Math.min(input.length, lease.byteLength - input.offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = length
        ? await lease.handle.read(buffer, 0, length, input.offset)
        : { bytesRead: 0 };
      if (bytesRead !== length) throw new WhiteboardError("INVALID_MEDIA", "Asset read returned an unexpected byte count");
      return {
        readLeaseId: lease.id,
        offset: input.offset,
        byteLength: bytesRead,
        dataBase64: buffer.subarray(0, bytesRead).toString("base64"),
        eof: input.offset + bytesRead === lease.byteLength,
        expiresAt: new Date(Date.now() + this.transferTtlMs).toISOString(),
      };
    } finally {
      this.releaseAssetRead(lease, "read");
    }
  }

  async readVideoChunk(session: CanvasSession, input: { readLeaseId: string; offset: number; length: number }) {
    return this.readAssetChunk(session, input, "video");
  }

  async readImageChunk(session: CanvasSession, input: { readLeaseId: string; offset: number; length: number }) {
    return this.readAssetChunk(session, input, "image");
  }

  private async closeAssetRead(session: CanvasSession, readLeaseId: string, kind: AssetReadLease["kind"]) {
    const lease = await this.acquireAssetRead(session, readLeaseId, "close", kind);
    try {
      await this.closeVideoReadLease(lease.id, true);
      return { readLeaseId, closed: true };
    } finally {
      this.releaseAssetRead(lease, "close");
    }
  }

  async closeVideoRead(session: CanvasSession, readLeaseId: string) {
    return this.closeAssetRead(session, readLeaseId, "video");
  }

  async closeImageRead(session: CanvasSession, readLeaseId: string) {
    return this.closeAssetRead(session, readLeaseId, "image");
  }

  private async saveImageBytes(
    session: CanvasSession,
    bytes: Buffer,
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
    options: { width?: number; height?: number; preview?: ImagePreviewInput } = {},
  ): Promise<{ asset: AssetRecord; preview?: PreviewRecord }> {
    await this.ensurePage(session);
    if ((options.width === undefined) !== (options.height === undefined)) {
      throw new WhiteboardError("INVALID_MEDIA", "Source image width and height must be provided together");
    }
    if (options.width !== undefined && (!Number.isSafeInteger(options.width) || !Number.isSafeInteger(options.height)
      || options.width <= 0 || options.height! <= 0 || options.width > 100_000 || options.height! > 100_000)) {
      throw new WhiteboardError("INVALID_MEDIA", "Source image dimensions are invalid");
    }
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new WhiteboardError("INVALID_MEDIA", `Media must be between 1 byte and ${MAX_IMAGE_BYTES} bytes`);
    }
    validateMediaSignature(mimeType, bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const id = `asset_${randomUUID().replaceAll("-", "")}`;
    const relativePath = `assets/${id}${MIME_EXTENSIONS[mimeType]}`;
    const target = join(this.pageDir(session), relativePath);
    await assertSafeFile(session.projectDir!, target);
    await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
    const asset = {
      id,
      relativePath,
      mimeType,
      sha256,
      byteLength: bytes.length,
      ...(options.width ? { width: options.width } : {}),
      ...(options.height ? { height: options.height } : {}),
      createdAt: new Date().toISOString(),
    };
    try {
      const preview = options.preview ? await this.savePreviewDataUrl(session, asset, options.preview) : undefined;
      return { asset, preview };
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
  }

  async saveDataUrlAsset(
    session: CanvasSession,
    dataUrl: string,
    options: { width?: number; height?: number; preview?: ImagePreviewInput } = {},
  ): Promise<{ asset: AssetRecord; dataUrl: string; preview?: PreviewRecord }> {
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) throw new WhiteboardError("INVALID_MEDIA", "Only bounded base64 PNG, JPEG, WebP, and GIF images are accepted; videos require chunked upload");
    const saved = await this.saveImageBytes(
      session,
      Buffer.from(match[2], "base64"),
      match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      options,
    );
    return { ...saved, dataUrl };
  }

  async importImageBytes(session: CanvasSession, input: {
    bytes: Buffer;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    expectedRevision: number;
    width?: number;
    height?: number;
  }) {
    const saved = await this.saveImageBytes(session, input.bytes, input.mimeType, {
      width: input.width,
      height: input.height,
    });
    try {
      const state = await this.getState(session);
      state.document.page.assets[saved.asset.id] = saved.asset;
      const document = await this.saveDocument(
        session,
        state.document,
        input.expectedRevision,
        [saved.asset.id],
      );
      return {
        asset: saved.asset,
        document,
        revision: document.page.revision,
      };
    } catch (error) {
      await this.removeAsset(session, saved.asset);
      throw error;
    }
  }

  async removeAsset(session: CanvasSession, asset: AssetRecord) {
    await this.ensurePage(session);
    const target = join(this.pageDir(session), asset.relativePath);
    await assertSafeFile(session.projectDir!, target);
    const metadataPath = this.previewMetadataPath(session, asset.id);
    let previewPath: string | undefined;
    try {
      const preview = PreviewRecordSchema.parse(await readJsonFile(session.projectDir!, metadataPath));
      if (preview.assetId === asset.id) previewPath = this.assetPath(session, preview.relativePath);
    } catch {
      // Missing or invalid preview metadata must not prevent authoritative asset cleanup.
    }
    await Promise.all([
      rm(target, { force: true }),
      rm(metadataPath, { force: true }),
      ...(previewPath ? [rm(previewPath, { force: true })] : []),
      ...[".png", ".jpg", ".jpeg", ".webp"].map((extension) => rm(
        this.assetPath(session, `previews/${asset.id}${extension}`),
        { force: true },
      )),
    ]);
  }

  async resolveVerifiedAssetFile(session: CanvasSession, asset: AssetRecord) {
    await this.ensurePage(session);
    const target = this.assetPath(session, asset.relativePath);
    await assertSafeFile(session.projectDir!, target);
    const canonical = await realpath(target);
    ensureInside(await realpath(this.pageDir(session)), canonical);
    const cacheKey = `${canonical}\0${asset.sha256}`;
    const pending = this.assetVerificationTasks.get(cacheKey);
    if (pending) return pending;

    const verification = (async () => {
      const handle = await open(canonical, "r");
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size !== asset.byteLength) {
          throw new WhiteboardError("INVALID_MEDIA", "Asset size does not match its document record");
        }
        const fingerprint = {
          dev: info.dev,
          ino: info.ino,
          size: info.size,
          mtimeMs: info.mtimeMs,
          ctimeMs: info.ctimeMs,
          sha256: asset.sha256,
        };
        const cached = this.verifiedAssetFiles.get(cacheKey);
        const unchanged = cached
          && cached.dev === fingerprint.dev
          && cached.ino === fingerprint.ino
          && cached.size === fingerprint.size
          && cached.mtimeMs === fingerprint.mtimeMs
          && cached.ctimeMs === fingerprint.ctimeMs
          && cached.sha256 === fingerprint.sha256;
        if (!unchanged) {
          const hash = createHash("sha256");
          const buffer = Buffer.allocUnsafe(Math.min(VIDEO_CHUNK_BYTES, Math.max(16, asset.byteLength)));
          let header = Buffer.alloc(0);
          let offset = 0;
          while (offset < asset.byteLength) {
            const length = Math.min(buffer.length, asset.byteLength - offset);
            const { bytesRead } = await handle.read(buffer, 0, length, offset);
            if (!bytesRead) throw new WhiteboardError("INVALID_MEDIA", "Asset ended before its declared byteLength");
            const chunk = buffer.subarray(0, bytesRead);
            hash.update(chunk);
            if (header.length < 16) header = Buffer.concat([header, chunk.subarray(0, 16 - header.length)]);
            offset += bytesRead;
          }
          validateMediaSignature(asset.mimeType, header);
          if (hash.digest("hex") !== asset.sha256) {
            throw new WhiteboardError("INVALID_MEDIA", "Asset hash does not match its document record");
          }
          this.verifiedAssetFiles.set(cacheKey, fingerprint);
        }
        return {
          path: canonical,
          byteLength: asset.byteLength,
          mimeType: asset.mimeType,
          sha256: asset.sha256,
        };
      } finally {
        await handle.close().catch(() => undefined);
      }
    })().finally(() => {
      if (this.assetVerificationTasks.get(cacheKey) === verification) {
        this.assetVerificationTasks.delete(cacheKey);
      }
    });
    this.assetVerificationTasks.set(cacheKey, verification);
    return verification;
  }

  async readAssetBytes(session: CanvasSession, asset: AssetRecord) {
    if (asset.mimeType === "video/mp4" || asset.mimeType === "video/webm") {
      throw new WhiteboardError("INVALID_MEDIA", "Video assets require begin/read/close chunk tools");
    }
    await this.ensurePage(session);
    const path = join(this.pageDir(session), asset.relativePath);
    await assertSafeFile(session.projectDir!, path);
    const canonical = await realpath(path);
    ensureInside(await realpath(this.pageDir(session)), canonical);
    const bytes = await readFile(canonical);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
      throw new WhiteboardError("INVALID_MEDIA", "Asset hash does not match the document record");
    }
    return bytes;
  }

  private async cleanupExpiredLeases() {
    const base = join(tmpdir(), "renoise-whiteboard-leases");
    if (!(await exists(base))) return;
    const baseInfo = await lstat(base);
    if (baseInfo.isSymbolicLink() || !baseInfo.isDirectory()) throw new WhiteboardError("PATH_ESCAPE", "Whiteboard lease root is unsafe");
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const leaseRoot = join(base, entry.name);
      try {
        const lease = z.object({ expiresAt: z.string().datetime() }).parse(JSON.parse(await readFile(join(leaseRoot, "lease.json"), "utf8")));
        if (Date.parse(lease.expiresAt) <= Date.now()) await rm(leaseRoot, { recursive: true, force: true });
      } catch {
        // Unknown directories are not ours to delete.
      }
    }
  }

  async materializeReferences(session: CanvasSession, assetIds: string[]) {
    const { document } = await this.getState(session);
    await this.cleanupExpiredLeases();
    const leaseBase = join(tmpdir(), "renoise-whiteboard-leases");
    if (!(await exists(leaseBase))) await mkdir(leaseBase, { mode: 0o700 });
    const leaseBaseInfo = await lstat(leaseBase);
    if (leaseBaseInfo.isSymbolicLink() || !leaseBaseInfo.isDirectory()) throw new WhiteboardError("PATH_ESCAPE", "Whiteboard lease root is unsafe");
    await chmod(leaseBase, 0o700);
    const leaseId = `lease_${randomUUID().replaceAll("-", "")}`;
    const leaseRoot = join(leaseBase, leaseId);
    await mkdir(leaseRoot, { mode: 0o700 });
    const expiresAt = new Date(Date.now() + LEASE_TTL_MS).toISOString();
    const prepared = [];
    for (const assetId of assetIds) {
      const asset = document.page.assets[assetId];
      if (!asset) throw new WhiteboardError("ASSET_NOT_FOUND", `Unknown session asset ${assetId}`);
      const source = await realpath(join(this.pageDir(session), asset.relativePath));
      ensureInside(await realpath(this.pageDir(session)), source);
      const target = join(leaseRoot, `${asset.id}${extname(source)}`);
      await writeFile(target, await readFile(source), { flag: "wx", mode: 0o400 });
      await chmod(target, 0o400);
      prepared.push({ assetId, materialPath: target, sha256: asset.sha256, mimeType: asset.mimeType });
    }
    await writeFile(join(leaseRoot, "lease.json"), `${JSON.stringify({ leaseId, canvasSessionId: session.id, expiresAt })}\n`, { flag: "wx", mode: 0o600 });
    const cleanup = setTimeout(() => { void rm(leaseRoot, { recursive: true, force: true }); }, LEASE_TTL_MS);
    cleanup.unref();
    return { leaseId, prepared, expiresAt };
  }

  validateExport(dataUrl: string) {
    const match = /^data:image\/png;base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) throw new WhiteboardError("INVALID_MEDIA", "Review export must be a base64 PNG");
    const bytes = Buffer.from(match[1], "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new WhiteboardError("INVALID_MEDIA", "Review export must be at most 20 MB");
    return { sha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length, persisted: false };
  }

  private async taskResultFromTestAdapter(taskId: string) {
    // The file-contract adapter exists only for tests; the production server
    // bundle compiles this branch away so the env variable cannot activate it.
    const contractRoot = __RENOISE_TEST_ADAPTERS__ ? process.env.RENOISE_TASK_RESULTS_DIR : undefined;
    if (!contractRoot) return null;
    const canonicalRoot = await realpath(contractRoot);
    const contractPath = join(canonicalRoot, `${taskId}.json`);
    ensureInside(canonicalRoot, contractPath);
    const parsed = z.object({
      outputs: z.array(z.object({ path: z.string().optional(), dataUrl: z.string().startsWith("data:image/").optional() }).refine((value) => Boolean(value.path || value.dataUrl))),
    }).parse(JSON.parse(await readFile(contractPath, "utf8")));
    return { canonicalRoot, outputs: parsed.outputs };
  }

  async assetFromTaskResult(session: CanvasSession, taskId: string, outputIndex: number) {
    const testContract = await this.taskResultFromTestAdapter(taskId);
    if (testContract) {
      const output = testContract.outputs[outputIndex];
      if (!output) throw new WhiteboardError("TASK_RESULT_UNAVAILABLE", "Test task output index does not exist");
      if (output.dataUrl) return this.saveDataUrlAsset(session, output.dataUrl);
      const resultPath = await realpath(output.path!);
      ensureInside(testContract.canonicalRoot, resultPath);
      const extension = extname(resultPath).toLowerCase();
      const mime = extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".webp" ? "image/webp" : null;
      if (!mime) throw new WhiteboardError("INVALID_MEDIA", "Test task result is not a supported image");
      const bytes = await readFile(resultPath);
      if (bytes.length > MAX_IMAGE_BYTES) throw new WhiteboardError("INVALID_MEDIA", "Test task result exceeds 20 MB");
      return this.saveDataUrlAsset(session, `data:${mime};base64,${bytes.toString("base64")}`);
    }

    const cli = process.env.RENOISE_CLI_PATH || "renoise";
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(cli, ["task", "result", taskId, "--json"], {
        timeout: TASK_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        shell: false,
      }));
    } catch (error) {
      throw new WhiteboardError("TASK_RESULT_UNAVAILABLE", `renoise task result failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    let contract;
    try { contract = TaskResultSchema.parse(JSON.parse(stdout)); } catch (error) {
      throw new WhiteboardError("TASK_RESULT_UNAVAILABLE", `Invalid Renoise task result JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const outputs = contract.outputs ?? contract.results ?? [];
    const output = outputs[outputIndex];
    if (!output) throw new WhiteboardError("TASK_RESULT_UNAVAILABLE", "Renoise task output index does not exist");
    if (typeof output !== "string" && output.dataUrl) return this.saveDataUrlAsset(session, output.dataUrl);
    const url = typeof output === "string" ? output : output.url ?? output.downloadUrl ?? output.outputUrl!;
    return this.saveDataUrlAsset(session, await dataUrlFromResponse(url));
  }
}
