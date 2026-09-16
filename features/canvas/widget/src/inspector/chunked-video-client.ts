export const VIDEO_CHUNK_BYTES = 24 * 1024;
const APPEND_PACING_MS = 16;
const FINALIZE_SETTLE_MS = 750;
const TRANSIENT_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000] as const;

type CallTool = (name: string, args: Record<string, unknown>) => Promise<Record<string, any>>;
type Progress = (progress: { loaded: number; total: number; phase: "upload" | "process" | "read" }) => void;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Operation canceled", "AbortError");
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 32_768)));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isTransientTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:MCP.*(?:proxy|request)|-32000|timeout|timed out|network|transport|disconnected|response lost)/i.test(message);
}

async function retryTransport<T>(action: () => Promise<T>, signal?: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientTransportError(error) || attempt === TRANSIENT_RETRY_DELAYS_MS.length) throw error;
      await wait(TRANSIENT_RETRY_DELAYS_MS[attempt], signal);
    }
  }
  throw lastError;
}

function isMissingFinalizeJob(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:processing job does not exist|upload does not belong|has expired)/i.test(message);
}

async function startFinalizeWithRecovery({
  call,
  canvasSessionId,
  uploadId,
  signal,
}: {
  call: CallTool;
  canvasSessionId: string;
  uploadId: string;
  signal?: AbortSignal;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await call("finalize_renoise_whiteboard_video_upload", { canvasSessionId, uploadId });
    } catch (error) {
      lastError = error;
      if (!isTransientTransportError(error)) throw error;
      // A proxy may lose the response after the server has already accepted
      // the idempotent finalize. Recover that job before sending it again.
      try {
        const recovered = await call("get_renoise_whiteboard_video_upload_status", { canvasSessionId, uploadId });
        if (recovered.status === "processing" || recovered.status === "complete") return recovered;
      } catch (statusError) {
        if (!isTransientTransportError(statusError) && !isMissingFinalizeJob(statusError)) throw statusError;
      }
      if (attempt === TRANSIENT_RETRY_DELAYS_MS.length) break;
      await wait(TRANSIENT_RETRY_DELAYS_MS[attempt], signal);
    }
  }
  throw lastError;
}

async function wait(milliseconds: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException("Operation canceled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function uploadVideoInChunks({
  call,
  canvasSessionId,
  file,
  expectedRevision,
  durationMs,
  width,
  height,
  createPlaybackProxy,
  signal,
  onProgress,
}: {
  call: CallTool;
  canvasSessionId: string;
  file: File;
  expectedRevision: number;
  durationMs: number;
  width?: number;
  height?: number;
  createPlaybackProxy?: boolean;
  signal?: AbortSignal;
  onProgress?: Progress;
}) {
  throwIfAborted(signal);
  const begun = await call("begin_renoise_whiteboard_video_upload", {
    canvasSessionId,
    fileName: file.name,
    mimeType: file.type,
    byteLength: file.size,
    expectedRevision,
    durationMs,
    width,
    height,
    createPlaybackProxy,
  });
  const uploadId = String(begun.uploadId);
  let offset = Number(begun.received ?? begun.offset ?? begun.nextOffset ?? 0);
  let index = Number(begun.index ?? begun.nextIndex ?? Math.floor(offset / VIDEO_CHUNK_BYTES));
  if (!uploadId || !Number.isSafeInteger(offset) || offset < 0 || offset > file.size) throw new Error("Invalid video upload session response");
  try {
    onProgress?.({ loaded: offset, total: file.size, phase: "upload" });
    while (offset < file.size) {
      throwIfAborted(signal);
      const bytes = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + VIDEO_CHUNK_BYTES)).arrayBuffer());
      const response = await retryTransport(() => call("append_renoise_whiteboard_video_upload", {
        canvasSessionId,
        uploadId,
        index,
        offset,
        dataBase64: bytesToBase64(bytes),
      }), signal);
      const nextOffset = Number(response.received ?? response.nextOffset ?? offset + bytes.byteLength);
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > file.size) throw new Error("Invalid video upload offset response");
      offset = nextOffset;
      index = Number(response.nextIndex ?? index + 1);
      onProgress?.({ loaded: offset, total: file.size, phase: "upload" });
      if (offset < file.size) await wait(APPEND_PACING_MS, signal);
    }
    throwIfAborted(signal);
    onProgress?.({ loaded: 0, total: 1, phase: "process" });
    // Codex's MCP App proxy needs a short drain window after many bounded
    // postMessage calls. Without it, a valid finalize can be rejected locally
    // before the request reaches the plugin server.
    await wait(FINALIZE_SETTLE_MS, signal);
    const started = await startFinalizeWithRecovery({
      call,
      canvasSessionId,
      uploadId,
      signal,
    });
    if (started.status === "complete") return started;
    for (;;) {
      await wait(350, signal);
      const status = await retryTransport(
        () => call("get_renoise_whiteboard_video_upload_status", { canvasSessionId, uploadId }),
        signal,
      );
      if (status.status === "complete") {
        onProgress?.({ loaded: 1, total: 1, phase: "process" });
        return status;
      }
      if (status.status !== "processing") throw new Error("Invalid video compatibility-processing status response");
    }
  } catch (error) {
    await call("abort_renoise_whiteboard_video_upload", { canvasSessionId, uploadId }).catch(() => undefined);
    throw error;
  }
}

export async function readVideoInChunks({
  call,
  canvasSessionId,
  assetId,
  signal,
  onProgress,
}: {
  call: CallTool;
  canvasSessionId: string;
  assetId: string;
  signal?: AbortSignal;
  onProgress?: Progress;
}) {
  throwIfAborted(signal);
  const begun = await call("begin_renoise_whiteboard_video_read", { canvasSessionId, assetId });
  const readLeaseId = String(begun.readLeaseId);
  const total = Number(begun.byteLength);
  const mimeType = typeof begun.mimeType === "string" ? begun.mimeType : "video/mp4";
  if (!readLeaseId || !Number.isSafeInteger(total) || total < 0) throw new Error("Invalid video read session response");
  const chunks: Uint8Array[] = [];
  let offset = Number(begun.offset ?? 0);
  let index = Number(begun.index ?? 0);
  try {
    onProgress?.({ loaded: offset, total, phase: "read" });
    while (offset < total) {
      throwIfAborted(signal);
      const response = await call("read_renoise_whiteboard_video_chunk", {
        canvasSessionId,
        readLeaseId,
        offset,
        length: Math.min(VIDEO_CHUNK_BYTES, total - offset),
      });
      const bytes = base64ToBytes(String(response.dataBase64 ?? ""));
      if (!bytes.byteLength || bytes.byteLength > VIDEO_CHUNK_BYTES || offset + bytes.byteLength > total) {
        throw new Error("Invalid video read chunk response");
      }
      chunks.push(bytes);
      offset += bytes.byteLength;
      index += 1;
      onProgress?.({ loaded: offset, total, phase: "read" });
    }
    return new Blob(chunks, { type: mimeType });
  } finally {
    await call("close_renoise_whiteboard_video_read", { canvasSessionId, readLeaseId }).catch(() => undefined);
  }
}
