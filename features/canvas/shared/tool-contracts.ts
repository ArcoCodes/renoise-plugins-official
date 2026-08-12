import { z } from "zod";
import {
  IdSchema,
  SelectionStateSchema,
  ViewStateSchema,
  WhiteboardDocumentSchema,
} from "./document-schema.js";

export const SessionInput = { canvasSessionId: IdSchema };
export const RenderInput = {
  projectDir: z.string().min(1).describe("Absolute project directory shown to the user for explicit approval"),
  pageName: z.string().min(1).max(200).optional(),
};
export const AuthorizeInput = {
  approvedProjectDir: z.string().min(1),
};
export const GetStateInput = { ...SessionInput, sinceRevision: z.number().int().nonnegative().optional() };
export const SaveStateInput = {
  ...SessionInput,
  expectedRevision: z.number().int().nonnegative(),
  document: WhiteboardDocumentSchema,
};
export const SaveSelectionInput = { ...SessionInput, selection: SelectionStateSchema };
export const SubmitRevisionIntentInput = {
  ...SessionInput,
  expectedRevision: z.number().int().nonnegative(),
  instruction: z.string().trim().min(1).max(10_000),
};
export const GetRevisionIntentInput = {
  ...SessionInput,
  revisionIntentId: IdSchema.optional().describe("Exact persisted intent to read; omit to recover the latest intent for the authorized page"),
};
export const SaveViewInput = { ...SessionInput, view: ViewStateSchema };
// Compatibility-only MCP transport. Primary media IO uses the loopback gateway;
// keep fallback envelopes below conservative host postMessage limits.
export const VIDEO_CHUNK_BYTES = 24 * 1024;
export const VIDEO_CHUNK_BASE64_CHAR_LIMIT = Math.ceil(VIDEO_CHUNK_BYTES / 3) * 4;
const ImageMimeSchema = z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VideoMimeSchema = z.enum(["video/mp4", "video/webm"]);
const UploadIdSchema = z.string().regex(/^upload_[a-f0-9]{32}$/);
const ReadLeaseIdSchema = z.string().regex(/^read_[a-f0-9]{32}$/);
const MediaFileNameSchema = z.string().min(1).max(255).regex(/^[^/\\\0]+$/);
const ChunkBase64Schema = z.string()
  .min(4)
  .max(VIDEO_CHUNK_BASE64_CHAR_LIMIT)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const BeginImageUploadInput = {
  ...SessionInput,
  expectedRevision: z.number().int().nonnegative(),
  fileName: MediaFileNameSchema,
  mimeType: ImageMimeSchema,
  byteLength: z.number().int().positive(),
  width: z.number().int().positive().max(100_000),
  height: z.number().int().positive().max(100_000),
};
export const AppendImageUploadInput = {
  ...SessionInput,
  uploadId: UploadIdSchema,
  index: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  dataBase64: ChunkBase64Schema,
};
export const FinalizeImageUploadInput = { ...SessionInput, uploadId: UploadIdSchema };
export const AbortImageUploadInput = { ...SessionInput, uploadId: UploadIdSchema };
export const BeginVideoUploadInput = {
  ...SessionInput,
  expectedRevision: z.number().int().nonnegative(),
  fileName: MediaFileNameSchema,
  mimeType: VideoMimeSchema,
  byteLength: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  createPlaybackProxy: z.boolean().optional(),
};
export const AppendVideoUploadInput = {
  ...SessionInput,
  uploadId: UploadIdSchema,
  index: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  dataBase64: ChunkBase64Schema,
};
export const FinalizeVideoUploadInput = {
  ...SessionInput,
  uploadId: UploadIdSchema,
};
export const GetVideoUploadFinalizeStatusInput = { ...SessionInput, uploadId: UploadIdSchema };
export const AbortVideoUploadInput = { ...SessionInput, uploadId: UploadIdSchema };
export const BeginVideoReadInput = { ...SessionInput, assetId: IdSchema };
export const ReadVideoChunkInput = {
  ...SessionInput,
  readLeaseId: ReadLeaseIdSchema,
  offset: z.number().int().nonnegative(),
  length: z.number().int().positive().max(VIDEO_CHUNK_BYTES),
};
export const CloseVideoReadInput = { ...SessionInput, readLeaseId: ReadLeaseIdSchema };
export const BeginImageReadInput = { ...SessionInput, assetId: IdSchema };
export const ReadImageChunkInput = {
  ...SessionInput,
  readLeaseId: ReadLeaseIdSchema,
  offset: z.number().int().nonnegative(),
  length: z.number().int().positive().max(VIDEO_CHUNK_BYTES),
};
export const CloseImageReadInput = { ...SessionInput, readLeaseId: ReadLeaseIdSchema };
export const ExportInput = {
  ...SessionInput,
  kind: z.enum(["review", "board"]),
  dataUrl: z.string().startsWith("data:image/png;base64,"),
  annotationIds: z.array(IdSchema).default([]),
};
export const MODEL_VISIBLE_TOOLS = new Set([
  "render_renoise_whiteboard_widget",
  "get_renoise_whiteboard_revision_intent",
  "prepare_renoise_whiteboard_references",
]);
