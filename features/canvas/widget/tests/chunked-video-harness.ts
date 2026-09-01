import { base64ToBytes, bytesToBase64, readVideoInChunks, uploadVideoInChunks, VIDEO_CHUNK_BYTES } from "../src/inspector/chunked-video-client.js";
import { jsonSafeMcpArguments } from "../src/mcp-arguments.js";

declare global {
  interface Window {
    __chunkResult?: Record<string, unknown>;
  }
}

const bytes = new Uint8Array(VIDEO_CHUNK_BYTES * 2 + 12_345);
for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
const file = new File([bytes], "generated.webm", { type: "video/webm" });
const calls: Array<{ name: string; args: Record<string, any> }> = [];
const accepted = new Map<number, { offset: number; dataBase64: string; ack: { received: number; nextIndex: number } }>();
const acceptedCounts = new Map<number, number>();
let lostAckOnce = false;
let processingPolls = 0;
let finalizeAttempts = 0;

const call = async (name: string, args: Record<string, any>) => {
  calls.push({ name, args });
  if (name === "begin_renoise_whiteboard_video_upload") return { uploadId: "upload_fixture", received: 0, nextIndex: 0 };
  if (name === "append_renoise_whiteboard_video_upload") {
    const cached = accepted.get(args.index);
    if (cached) {
      if (cached.offset !== args.offset || cached.dataBase64 !== args.dataBase64) {
        throw new Error("retry changed canonical index/offset/payload");
      }
      return cached.ack;
    }
    const ack = { received: args.offset + base64ToBytes(args.dataBase64).byteLength, nextIndex: args.index + 1 };
    accepted.set(args.index, { offset: args.offset, dataBase64: args.dataBase64, ack });
    acceptedCounts.set(args.index, (acceptedCounts.get(args.index) ?? 0) + 1);
    if (args.index === 1 && !lostAckOnce) {
      lostAckOnce = true;
      throw new Error("fixture response lost after server accepted chunk");
    }
    return ack;
  }
  if (name === "finalize_renoise_whiteboard_video_upload") {
    finalizeAttempts += 1;
    if (finalizeAttempts <= 3) throw new Error("MCP error -32000: MCP proxy request failed");
    return { ok: true, uploadId: "upload_fixture", status: "processing" };
  }
  if (name === "get_renoise_whiteboard_video_upload_status") {
    if (finalizeAttempts <= 3) throw new Error("MCP error -32000: MCP proxy request failed");
    processingPolls += 1;
    if (processingPolls === 1) throw new Error("fixture transient MCP proxy failure");
    if (processingPolls < 3) return { ok: true, uploadId: "upload_fixture", status: "processing" };
    return { ok: true, uploadId: "upload_fixture", status: "complete", asset: { id: "asset_fixture" } };
  }
  if (name === "abort_renoise_whiteboard_video_upload") return { ok: true };
  if (name === "begin_renoise_whiteboard_video_read") return { readLeaseId: "read_fixture", byteLength: bytes.length, mimeType: "video/webm" };
  if (name === "read_renoise_whiteboard_video_chunk") {
    const end = Math.min(bytes.length, args.offset + args.length);
    return { dataBase64: bytesToBase64(bytes.subarray(args.offset, end)), byteLength: end - args.offset, eof: end === bytes.length };
  }
  if (name === "close_renoise_whiteboard_video_read") return { ok: true };
  throw new Error(`Unexpected tool ${name}`);
};
const proxyCall = (name: string, args: Record<string, unknown>) => call(name, jsonSafeMcpArguments(args));

const uploadStartedAt = performance.now();
const upload = await uploadVideoInChunks({
  call: proxyCall,
  canvasSessionId: "session_fixture",
  file,
  expectedRevision: 7,
  durationMs: 900,
});
const uploadDurationMs = performance.now() - uploadStartedAt;
const blob = await readVideoInChunks({
  call: proxyCall,
  canvasSessionId: "session_fixture",
  assetId: "asset_fixture",
});
const cancelCalls: string[] = [];
const controller = new AbortController();
let cancelled = false;
await uploadVideoInChunks({
  call: async (name, args) => {
    cancelCalls.push(name);
    if (name === "begin_renoise_whiteboard_video_upload") return { uploadId: "upload_cancel", received: 0, nextIndex: 0 };
    if (name === "append_renoise_whiteboard_video_upload") {
      controller.abort(new DOMException("fixture cancel", "AbortError"));
      return { received: base64ToBytes(String(args.dataBase64)).byteLength, nextIndex: 1 };
    }
    if (name === "abort_renoise_whiteboard_video_upload") return { ok: true };
    throw new Error(`Unexpected cancel tool ${name}`);
  },
  canvasSessionId: "session_fixture",
  file,
  expectedRevision: 7,
  durationMs: 900,
  signal: controller.signal,
}).catch((error) => { cancelled = error instanceof DOMException && error.name === "AbortError"; });
const reopened = new Uint8Array(await blob.arrayBuffer());
window.__chunkResult = {
  upload,
  calls,
  fileSize: file.size,
  blobSize: blob.size,
  blobType: blob.type,
  firstByte: reopened[0],
  lastByte: reopened.at(-1),
  expectedLastByte: bytes.at(-1),
  acceptedCounts: Object.fromEntries(acceptedCounts),
  lostAckOnce,
  processingPolls,
  finalizeAttempts,
  uploadDurationMs,
  cancelled,
  cancelCalls,
  sanitizedArguments: jsonSafeMcpArguments({
    canvasSessionId: "session_fixture",
    optional: undefined,
    nested: { keep: true, optional: undefined },
    list: ["first", undefined, "last"],
  }),
};
document.body.dataset.chunkReady = "true";
