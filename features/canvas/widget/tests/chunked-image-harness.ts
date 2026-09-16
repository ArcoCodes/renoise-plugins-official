import {
  imageBlobToCanvas,
  imageBlobToDataUrl,
  readImageInChunks,
  uploadImageInChunks,
  IMAGE_CHUNK_BYTES,
} from "../src/inspector/chunked-image-client.js";
import { base64ToBytes, bytesToBase64 } from "../src/inspector/chunked-video-client.js";

declare global {
  interface Window {
    __imageChunkResult?: Record<string, unknown>;
  }
}

const bytes = new Uint8Array(IMAGE_CHUNK_BYTES * 2 + 41_357);
for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
const calls: Array<{ name: string; args: Record<string, any> }> = [];
let lostChunkOnce = false;

const blob = await readImageInChunks({
  call: async (name, args) => {
    calls.push({ name, args });
    if (name === "begin_renoise_whiteboard_image_read") {
      return {
        readLeaseId: "read_fixture",
        byteLength: bytes.length,
        mimeType: "image/png",
      };
    }
    if (name === "read_renoise_whiteboard_image_chunk") {
      const offset = Number(args.offset);
      const length = Number(args.length);
      if (offset === IMAGE_CHUNK_BYTES && !lostChunkOnce) {
        lostChunkOnce = true;
        throw new Error("fixture response lost");
      }
      const end = Math.min(bytes.length, offset + length);
      return {
        dataBase64: bytesToBase64(bytes.subarray(offset, end)),
        byteLength: end - offset,
        eof: end === bytes.length,
      };
    }
    if (name === "close_renoise_whiteboard_image_read") return { ok: true };
    throw new Error(`Unexpected tool ${name}`);
  },
  canvasSessionId: "session_fixture",
  assetId: "asset_fixture",
  timeoutMs: 500,
});

const reopened = new Uint8Array(await blob.arrayBuffer());
const uploadCalls: Array<{ name: string; args: Record<string, any> }> = [];
let uploadReceived = 0;
let uploadNextIndex = 0;
let uploadResponseLostOnce = false;
let lastAccepted: { index: number; offset: number } | undefined;
const uploadResult = await uploadImageInChunks({
  call: async (name, args) => {
    uploadCalls.push({ name, args });
    if (name === "begin_renoise_whiteboard_image_upload") {
      return { uploadId: "upload_fixture", received: 0, nextIndex: 0, chunkBytes: IMAGE_CHUNK_BYTES };
    }
    if (name === "append_renoise_whiteboard_image_upload") {
      const index = Number(args.index);
      const offset = Number(args.offset);
      if (lastAccepted?.index === index && lastAccepted.offset === offset) {
        return { received: uploadReceived, nextIndex: uploadNextIndex };
      }
      if (index !== uploadNextIndex || offset !== uploadReceived) throw new Error("fixture upload is out of order");
      const uploaded = base64ToBytes(String(args.dataBase64));
      uploadReceived += uploaded.byteLength;
      uploadNextIndex += 1;
      lastAccepted = { index, offset };
      if (index === 1 && !uploadResponseLostOnce) {
        uploadResponseLostOnce = true;
        throw new Error("fixture upload response lost after commit");
      }
      return { received: uploadReceived, nextIndex: uploadNextIndex };
    }
    if (name === "finalize_renoise_whiteboard_image_upload") {
      return { asset: { id: "asset_uploaded" }, revision: 1 };
    }
    if (name === "abort_renoise_whiteboard_image_upload") return { aborted: true };
    throw new Error(`Unexpected upload tool ${name}`);
  },
  canvasSessionId: "session_fixture",
  file: new Blob([bytes], { type: "image/png" }),
  fileName: "desktop.png",
  expectedRevision: 0,
  width: 100,
  height: 200,
  timeoutMs: 500,
});
const dataUrl = await imageBlobToDataUrl(blob);
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const decodedCanvas = await imageBlobToCanvas(new Blob([base64ToBytes(tinyPng)], { type: "image/png" }));
const decodedPixel = decodedCanvas.getContext("2d")?.getImageData(0, 0, 1, 1).data;
window.__imageChunkResult = {
  calls,
  uploadCalls,
  uploadResult,
  uploadReceived,
  uploadResponseLostOnce,
  chunkBytes: IMAGE_CHUNK_BYTES,
  blobSize: blob.size,
  blobType: blob.type,
  expectedSize: bytes.length,
  firstByte: reopened[0],
  lastByte: reopened.at(-1),
  expectedLastByte: bytes.at(-1),
  dataUrlPrefix: dataUrl.slice(0, 22),
  dataUrlLength: dataUrl.length,
  decodedWidth: decodedCanvas.width,
  decodedHeight: decodedCanvas.height,
  decodedAlpha: decodedPixel?.[3],
  lostChunkOnce,
};
document.body.dataset.imageChunkReady = "true";
