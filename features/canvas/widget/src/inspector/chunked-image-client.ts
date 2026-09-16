import { base64ToBytes, bytesToBase64 } from "./chunked-video-client.js";

// App tool results are JSON/base64 encoded by the host. Keep each raw chunk small
// enough that the encoded result stays comfortably below host message limits.
export const IMAGE_CHUNK_BYTES = 24 * 1024;
const DEFAULT_CALL_TIMEOUT_MS = 8_000;

type CallTool = (name: string, args: Record<string, unknown>) => Promise<Record<string, any>>;

export function imageBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value.startsWith("data:image/")) reject(new Error("Image asset decoding failed"));
      else resolve(value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Image asset decoding failed"));
    reader.readAsDataURL(blob);
  });
}

export function imageDataUrlToBlob(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image asset data");
  return new Blob([base64ToBytes(match[2])], { type: match[1] });
}

export function imageBase64ToBlob(base64: string, mimeType: string) {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType)) {
    throw new Error("Invalid image asset type");
  }
  const bytes = base64ToBytes(base64);
  if (!bytes.byteLength) throw new Error("Invalid image asset data");
  return new Blob([bytes], { type: mimeType });
}

export async function imageBlobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  if (!blob.type.startsWith("image/")) throw new Error("Invalid image asset type");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("Image asset decoding failed");
  }
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("Invalid image asset dimensions");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The current host cannot create an image canvas");
    context.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function imageUrlToCanvas(source: string, timeoutMs = 3_000): Promise<HTMLCanvasElement> {
  const image = await imageUrlToElement(source, timeoutMs);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The current host cannot create an image canvas");
  context.drawImage(image, 0, 0);
  return canvas;
}

export async function imageUrlToElement(source: string, timeoutMs = 3_000): Promise<HTMLImageElement> {
  const image = document.createElement("img");
  if (/^https?:/i.test(source)) image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = source;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      image.decode(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Local media channel response timed out")), timeoutMs);
      }),
    ]);
  } catch (caught) {
    image.src = "";
    if (caught instanceof Error && caught.message === "Local media channel response timed out") throw caught;
    throw new Error("Image asset streaming failed");
  } finally {
    clearTimeout(timer);
  }
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Invalid image asset dimensions");
  return image;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Operation canceled", "AbortError");
}

async function withTimeout<T>(action: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Image asset read timed out")), timeoutMs);
    if (signal) {
      abort = () => reject(signal.reason ?? new DOMException("Operation canceled", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
    }
  });
  try {
    return await Promise.race([action, timeout]);
  } finally {
    clearTimeout(timer);
    if (signal && abort) signal.removeEventListener("abort", abort);
  }
}

async function retryCall<T>(action: () => Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await withTimeout(action(), timeoutMs, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw lastError;
}

export async function uploadImageInChunks({
  call,
  canvasSessionId,
  file,
  fileName,
  expectedRevision,
  width,
  height,
  signal,
  timeoutMs = DEFAULT_CALL_TIMEOUT_MS,
  onProgress,
}: {
  call: CallTool;
  canvasSessionId: string;
  file: Blob;
  fileName: string;
  expectedRevision: number;
  width: number;
  height: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (loaded: number, total: number) => void;
}) {
  throwIfAborted(signal);
  if (!file.size || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Only PNG, JPEG, WebP, and GIF images are supported");
  }
  const begun = await withTimeout(call("begin_renoise_whiteboard_image_upload", {
    canvasSessionId,
    expectedRevision,
    fileName,
    mimeType: file.type,
    byteLength: file.size,
    width,
    height,
  }), timeoutMs, signal);
  const uploadId = String(begun.uploadId ?? "");
  let offset = Number(begun.received ?? 0);
  let index = Number(begun.nextIndex ?? Math.floor(offset / IMAGE_CHUNK_BYTES));
  if (!uploadId || !Number.isSafeInteger(offset) || offset < 0 || offset > file.size || !Number.isSafeInteger(index) || index < 0) {
    throw new Error("Invalid image upload session response");
  }

  try {
    onProgress?.(offset, file.size);
    while (offset < file.size) {
      throwIfAborted(signal);
      const bytes = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + IMAGE_CHUNK_BYTES)).arrayBuffer());
      const response = await retryCall(() => call("append_renoise_whiteboard_image_upload", {
        canvasSessionId,
        uploadId,
        index,
        offset,
        dataBase64: bytesToBase64(bytes),
      }), timeoutMs, signal);
      const nextOffset = Number(response.received ?? offset + bytes.byteLength);
      const nextIndex = Number(response.nextIndex ?? index + 1);
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > file.size
        || !Number.isSafeInteger(nextIndex) || nextIndex <= index) {
        throw new Error("Invalid image upload offset response");
      }
      offset = nextOffset;
      index = nextIndex;
      onProgress?.(offset, file.size);
    }
    throwIfAborted(signal);
    return await withTimeout(
      call("finalize_renoise_whiteboard_image_upload", { canvasSessionId, uploadId }),
      timeoutMs,
      signal,
    );
  } catch (error) {
    await withTimeout(
      call("abort_renoise_whiteboard_image_upload", { canvasSessionId, uploadId }),
      Math.min(timeoutMs, 2_000),
    ).catch(() => undefined);
    throw error;
  }
}

export async function readImageInChunks({
  call,
  canvasSessionId,
  assetId,
  signal,
  timeoutMs = DEFAULT_CALL_TIMEOUT_MS,
  onProgress,
}: {
  call: CallTool;
  canvasSessionId: string;
  assetId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (loaded: number, total: number) => void;
}) {
  const begun = await retryCall(
    () => call("begin_renoise_whiteboard_image_read", { canvasSessionId, assetId }),
    timeoutMs,
    signal,
  );
  const readLeaseId = String(begun.readLeaseId ?? "");
  const total = Number(begun.byteLength);
  const mimeType = typeof begun.mimeType === "string" ? begun.mimeType : "";
  if (
    !readLeaseId
    || !Number.isSafeInteger(total)
    || total <= 0
    || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType)
  ) {
    throw new Error("Invalid image read session response");
  }

  const chunks: Uint8Array[] = [];
  let offset = 0;
  try {
    onProgress?.(offset, total);
    while (offset < total) {
      throwIfAborted(signal);
      const response = await retryCall(
        () => call("read_renoise_whiteboard_image_chunk", {
          canvasSessionId,
          readLeaseId,
          offset,
          length: Math.min(IMAGE_CHUNK_BYTES, total - offset),
        }),
        timeoutMs,
        signal,
      );
      const bytes = base64ToBytes(String(response.dataBase64 ?? ""));
      if (!bytes.byteLength || bytes.byteLength > IMAGE_CHUNK_BYTES || offset + bytes.byteLength > total) {
        throw new Error("Invalid image read chunk response");
      }
      chunks.push(bytes);
      offset += bytes.byteLength;
      onProgress?.(offset, total);
    }
    if (offset !== total) throw new Error("Incomplete image asset read");
    return new Blob(chunks, { type: mimeType });
  } finally {
    await withTimeout(
      call("close_renoise_whiteboard_image_read", { canvasSessionId, readLeaseId }),
      Math.min(timeoutMs, 2_000),
    ).catch(() => undefined);
  }
}
