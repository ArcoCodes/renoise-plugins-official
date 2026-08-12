import { z } from "zod";

export const IdSchema = z.string().regex(/^[a-z][a-z0-9_-]{5,127}$/i);
export const IsoDateSchema = z.string().datetime();
export const TransformSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().finite(),
});

export const AssetRecordSchema = z.object({
  id: IdSchema,
  relativePath: z.string().regex(/^[^/\\][^\\]*$/).refine((value) => !value.split("/").includes("..")),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  createdAt: IsoDateSchema,
});

export const PreviewRecordSchema = z.object({
  schemaVersion: z.literal(1),
  assetId: IdSchema,
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  previewSha256: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string().regex(/^previews\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteLength: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  encoderVersion: z.number().int().positive(),
  createdAt: IsoDateSchema,
});

const BaseObjectSchema = z.object({
  id: IdSchema,
  parentId: IdSchema.nullable().default(null),
  transform: TransformSchema,
  zIndex: z.number().int(),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  style: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

const PointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
const objectVariant = <TType extends string, T extends z.ZodRawShape>(type: TType, data: T) =>
  BaseObjectSchema.extend({ type: z.literal(type), data: z.object(data) });
const ImageSourceSchema = z.union([
  z.object({}).strict(),
  z.object({ kind: z.literal("file-picker") }).strict(),
  z.object({
    kind: z.literal("renoise-task"),
    taskId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
    outputIndex: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    relation: z.literal("revision-of"),
    objectId: IdSchema,
    revisionIntentId: IdSchema.optional(),
    taskId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
    outputIndex: z.number().int().nonnegative().optional(),
  }).strict().refine(
    ({ taskId, outputIndex }) => (taskId === undefined) === (outputIndex === undefined),
    "Revision taskId and outputIndex must be provided together",
  ),
  z.object({
    kind: z.literal("video-frame"),
    videoAssetId: IdSchema,
    videoSha256: z.string().regex(/^[a-f0-9]{64}$/),
    timeMs: z.number().int().nonnegative(),
  }).strict(),
]);

export const WhiteboardObjectSchema = z.discriminatedUnion("type", [
  objectVariant("image", {
    assetId: IdSchema,
    alt: z.string().max(500).default(""),
    source: ImageSourceSchema.default({}),
  }),
  objectVariant("video-card", {
    assetId: IdSchema,
    playbackAssetId: IdSchema.optional(),
    posterAssetId: IdSchema.optional(),
    durationMs: z.number().int().nonnegative(),
    fileName: z.string().min(1).max(255),
    timeMs: z.number().int().nonnegative().default(0),
  }),
  objectVariant("ai-image", {
    assetId: IdSchema.optional(),
    status: z.enum(["empty", "generating", "ready", "error"]),
    requestId: z.string().optional(),
  }),
  objectVariant("text", {
    text: z.string().max(50_000),
    fontSize: z.number().positive().max(512).default(16),
    align: z.enum(["left", "center", "right"]).default("left"),
  }),
  objectVariant("sticky", {
    text: z.string().max(50_000),
    color: z.string().default("#F8F2D8"),
  }),
  objectVariant("rect", {}),
  objectVariant("ellipse", {}),
  objectVariant("line", { points: z.array(PointSchema).length(2) }),
  objectVariant("arrow", { points: z.array(PointSchema).length(2) }),
  objectVariant("freehand", { points: z.array(PointSchema).min(2), width: z.number().positive().max(100) }),
  objectVariant("group", { childIds: z.array(IdSchema).default([]) }),
]);

export const AnnotationRecordSchema = z.object({
  id: IdSchema,
  targetObjectIds: z.array(IdSchema).min(1),
  markObjectIds: z.array(IdSchema).min(1),
  sourceAssetSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sourceTimeMs: z.number().int().nonnegative().nullable().default(null),
  status: z.enum(["open", "resolved"]).default("open"),
  note: z.string().max(10_000).optional(),
  createdAt: IsoDateSchema,
});

export const PageSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  assets: z.record(IdSchema, AssetRecordSchema),
  objects: z.array(WhiteboardObjectSchema),
  annotations: z.array(AnnotationRecordSchema),
});

export const WhiteboardDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  page: PageSchema,
});

export const CameraSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().min(0.05).max(8),
});

export const ViewStateSchema = z.object({
  schemaVersion: z.literal(1),
  pageId: IdSchema,
  camera: CameraSchema,
  theme: z.enum(["light", "dark"]).default("light"),
  activeTargetId: IdSchema.optional(),
  promptDrafts: z.record(IdSchema, z.string().max(10_000)).default({}),
});

export const SelectionStateSchema = z.object({
  schemaVersion: z.literal(1),
  pageId: IdSchema,
  documentRevision: z.number().int().nonnegative(),
  selectedObjectIds: z.array(IdSchema),
  selectedAnnotationIds: z.array(IdSchema),
});

export const RevisionIntentSourceSchema = z.object({
  objectId: IdSchema,
  objectType: z.enum(["image", "video-card"]),
  assetId: IdSchema,
  assetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceTimeMs: z.number().int().nonnegative().nullable(),
  sourceVideoAssetId: IdSchema.optional(),
  sourceVideoSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).refine(
  ({ sourceVideoAssetId, sourceVideoSha256 }) => (sourceVideoAssetId === undefined) === (sourceVideoSha256 === undefined),
  "Video asset ID and SHA-256 must be provided together",
);

export const RevisionIntentSchema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  pageId: IdSchema,
  documentRevision: z.number().int().nonnegative(),
  instruction: z.string().trim().min(1).max(10_000),
  selectedObjectIds: z.array(IdSchema).min(1),
  selectedAnnotationIds: z.array(IdSchema),
  targetObjectIds: z.array(IdSchema).min(1),
  markObjectIds: z.array(IdSchema),
  sources: z.array(RevisionIntentSourceSchema).min(1),
  status: z.enum(["submitted", "completed"]),
  resultObjectIds: z.array(IdSchema),
  createdAt: IsoDateSchema,
  completedAt: IsoDateSchema.optional(),
  // New intents carry the exact project context that was visible when the
  // user pressed Send. Optional keeps previously persisted intents readable.
  contextSnapshot: WhiteboardDocumentSchema.optional(),
});

export type WhiteboardDocument = z.infer<typeof WhiteboardDocumentSchema>;
export type WhiteboardObject = z.infer<typeof WhiteboardObjectSchema>;
export type AnnotationRecord = z.infer<typeof AnnotationRecordSchema>;
export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type PreviewRecord = z.infer<typeof PreviewRecordSchema>;
export type ViewState = z.infer<typeof ViewStateSchema>;
export type SelectionState = z.infer<typeof SelectionStateSchema>;
export type RevisionIntent = z.infer<typeof RevisionIntentSchema>;

export function createEmptyDocument(pageId: string, name = "Review Board"): WhiteboardDocument {
  return WhiteboardDocumentSchema.parse({
    schemaVersion: 1,
    page: { id: pageId, name, revision: 0, assets: {}, objects: [], annotations: [] },
  });
}
