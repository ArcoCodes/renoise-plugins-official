import type { RevisionIntent, WhiteboardDocument, WhiteboardObject } from "./document-schema.js";

export type SourceVideoEditContext = {
  sourceVideoAssetId: string;
  sourceVideoSha256: string;
  sourceDurationMs: number | null;
  sourceFileName: string | null;
  /** Generic source facts that map directly to renoise-cli source-media flags. */
  sourceMediaMeta: { width: number; height: number; durationSec?: number } | null;
  annotatedTimeMs: number[];
  /** @deprecated Annotation anchors are not automatically an explicit range. */
  annotationBoundsMs: { startMs: number; endMs: number } | null;
  candidateBoundsMs: { startMs: number; endMs: number } | null;
  temporalIntent: {
    mode: "single-anchor" | "unknown";
    explicit: false;
    anchorTimesMs: number[];
    startMs: null;
    endMs: null;
  };
  requiresTemporalRangeClarification: boolean;
};

type NormalizedBounds = { x: number; y: number; width: number; height: number };

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function markWorldBounds(mark: WhiteboardObject): { x: number; y: number; width: number; height: number } | null {
  if (mark.type === "line" || mark.type === "arrow" || mark.type === "freehand") {
    const points = mark.data.points;
    if (!points.length) return null;
    const xs = points.map(({ x }) => mark.transform.x + x);
    const ys = points.map(({ y }) => mark.transform.y + y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }
  if (["rect", "ellipse", "text", "sticky"].includes(mark.type)) return mark.transform;
  return null;
}

function normalizeMarkBounds(mark: WhiteboardObject, target: WhiteboardObject): NormalizedBounds | null {
  const bounds = markWorldBounds(mark);
  if (!bounds || target.transform.width <= 0 || target.transform.height <= 0) return null;
  const left = clampUnit((bounds.x - target.transform.x) / target.transform.width);
  const top = clampUnit((bounds.y - target.transform.y) / target.transform.height);
  const right = clampUnit((bounds.x + bounds.width - target.transform.x) / target.transform.width);
  const bottom = clampUnit((bounds.y + bounds.height - target.transform.y) / target.transform.height);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function markShape(mark: WhiteboardObject) {
  if (mark.type === "ellipse" && mark.style.variant === "numbered-pin") return "pin" as const;
  return mark.type;
}

export function describeRevisionIntent(
  revisionIntent: RevisionIntent,
  document: WhiteboardDocument,
) {
  const referenceAssetIds = [...new Set(revisionIntent.sources.map(({ assetId }) => assetId))];
  const objectById = new Map(document.page.objects.map((object) => [object.id, object]));
  const sourceByObjectId = new Map(revisionIntent.sources.map((source) => [source.objectId, source]));
  const resolveSourceMediaMetadata = (assetId: string) => {
    const video = document.page.objects.find((object) =>
      object.type === "video-card" && object.data.assetId === assetId);
    const candidateAssets = [
      document.page.assets[assetId],
      video?.type === "video-card" && video.data.playbackAssetId
        ? document.page.assets[video.data.playbackAssetId]
        : undefined,
      video?.type === "video-card" && video.data.posterAssetId
        ? document.page.assets[video.data.posterAssetId]
        : undefined,
    ];
    const dimensions = candidateAssets.find((asset) =>
      Number.isSafeInteger(asset?.width) && Number.isSafeInteger(asset?.height)
      && asset!.width! > 0 && asset!.height! > 0);
    if (!dimensions?.width || !dimensions.height) return null;
    const durationSec = video?.type === "video-card" && video.data.durationMs > 0
      ? video.data.durationMs / 1000
      : undefined;
    return {
      assetId,
      width: dimensions.width,
      height: dimensions.height,
      ...(durationSec !== undefined ? { durationSec } : {}),
    };
  };
  const resolveAuthoritativeAssetId = (source: RevisionIntent["sources"][number]) => {
    if (source.authoritativeSourceAssetId) return source.authoritativeSourceAssetId;
    if (source.sourceVideoAssetId) return source.sourceVideoAssetId;
    const object = objectById.get(source.objectId);
    if (object?.type === "image" && "relation" in object.data.source && object.data.source.relation === "revision-of") {
      const related = objectById.get(object.data.source.objectId);
      if (related?.type === "image" || related?.type === "video-card") return related.data.assetId;
    }
    return source.assetId;
  };
  const resolveGuideAssetId = (source: RevisionIntent["sources"][number]) => {
    if (source.annotationGuideAssetId) return source.annotationGuideAssetId;
    const object = objectById.get(source.objectId);
    if (source.sourceVideoAssetId || (object?.type === "image" && object.style.role === "annotation-snapshot")) {
      return source.assetId;
    }
    return null;
  };
  const groups = new Map<string, {
    sourceVideoAssetId: string;
    sourceVideoSha256: string;
    times: Set<number>;
  }>();

  for (const source of revisionIntent.sources) {
    if (!source.sourceVideoAssetId || !source.sourceVideoSha256) continue;
    const key = `${source.sourceVideoAssetId}:${source.sourceVideoSha256}`;
    const group = groups.get(key) ?? {
      sourceVideoAssetId: source.sourceVideoAssetId,
      sourceVideoSha256: source.sourceVideoSha256,
      times: new Set<number>(),
    };
    if (source.sourceTimeMs !== null) group.times.add(source.sourceTimeMs);
    groups.set(key, group);
  }

  const videoEditContexts: SourceVideoEditContext[] = [...groups.values()].map((group) => {
    const video = document.page.objects.find((object) =>
      object.type === "video-card" && object.data.assetId === group.sourceVideoAssetId);
    const sourceMediaMetadata = resolveSourceMediaMetadata(group.sourceVideoAssetId);
    const annotatedTimeMs = [...group.times].sort((left, right) => left - right);
    return {
      sourceVideoAssetId: group.sourceVideoAssetId,
      sourceVideoSha256: group.sourceVideoSha256,
      sourceDurationMs: video?.type === "video-card" ? video.data.durationMs : null,
      sourceFileName: video?.type === "video-card" ? video.data.fileName : null,
      sourceMediaMeta: sourceMediaMetadata
        ? {
          width: sourceMediaMetadata.width,
          height: sourceMediaMetadata.height,
          ...(sourceMediaMetadata.durationSec !== undefined
            ? { durationSec: sourceMediaMetadata.durationSec }
            : {}),
        }
        : null,
      annotatedTimeMs,
      // Multiple frames may be tracking anchors or independent edits. They are
      // a range only after the user/agent resolves that semantic distinction.
      annotationBoundsMs: null,
      candidateBoundsMs: annotatedTimeMs.length >= 2
        ? { startMs: annotatedTimeMs[0], endMs: annotatedTimeMs.at(-1)! }
        : null,
      temporalIntent: {
        mode: annotatedTimeMs.length === 1 ? "single-anchor" as const : "unknown" as const,
        explicit: false as const,
        anchorTimesMs: annotatedTimeMs,
        startMs: null,
        endMs: null,
      },
      requiresTemporalRangeClarification: annotatedTimeMs.length >= 2,
    };
  });
  const sourceVideoAssetIds = [...new Set(videoEditContexts.map(({ sourceVideoAssetId }) => sourceVideoAssetId))];
  const authoritativeSourceAssetIds = [...new Set(revisionIntent.sources.map(resolveAuthoritativeAssetId))];
  const sourceMediaMetadata = authoritativeSourceAssetIds
    .map(resolveSourceMediaMetadata)
    .filter((metadata): metadata is NonNullable<typeof metadata> => metadata !== null);
  const annotationGuideAssetIds = [...new Set(revisionIntent.sources
    .map(resolveGuideAssetId)
    .filter((assetId): assetId is string => Boolean(assetId)))];
  const preparableAssetIds = [...new Set([...authoritativeSourceAssetIds, ...annotationGuideAssetIds])];
  const sourceVideoAssetSet = new Set(sourceVideoAssetIds);
  const annotationGuideAssetSet = new Set(annotationGuideAssetIds);
  const uploadPlan = preparableAssetIds.map((assetId) => ({
    assetId,
    role: sourceVideoAssetSet.has(assetId) ? "reference_video" as const : "reference_image" as const,
    // `mask` is a library-visibility scope, not a provider mask role. The
    // authoritative image/video remains reusable; rendered guides stay hidden.
    scope: annotationGuideAssetSet.has(assetId) ? "mask" as const : "user" as const,
    purpose: annotationGuideAssetSet.has(assetId) ? "annotation_guide" as const : "authoritative_source" as const,
  }));

  const annotationBindings = revisionIntent.selectedAnnotationIds.flatMap((annotationId) => {
    const annotation = document.page.annotations.find(({ id }) => id === annotationId);
    if (!annotation) return [];
    return annotation.targetObjectIds.flatMap((targetObjectId) => {
      const target = objectById.get(targetObjectId);
      const source = sourceByObjectId.get(targetObjectId);
      if (!target || !source) return [];
      const regions = annotation.markObjectIds.flatMap((markObjectId) => {
        const mark = objectById.get(markObjectId);
        if (!mark) return [];
        const normalizedBounds = normalizeMarkBounds(mark, target);
        if (!normalizedBounds) return [];
        return [{ markObjectId, shape: markShape(mark), normalizedBounds }];
      });
      return [{
        annotationId,
        targetObjectId,
        sourceKind: source.sourceVideoAssetId ? "video-frame" as const : "image" as const,
        authoritativeSourceAssetId: resolveAuthoritativeAssetId(source),
        annotationGuideAssetId: resolveGuideAssetId(source),
        sourceVideoAssetId: source.sourceVideoAssetId ?? null,
        sourceTimeMs: source.sourceTimeMs,
        regions,
      }];
    });
  });

  return {
    defaultOperation: videoEditContexts.length ? "source-video-segment-edit" as const : "image-revision" as const,
    referenceAssetIds,
    sourceVideoAssetIds,
    authoritativeSourceAssetIds,
    sourceMediaMetadata,
    annotationGuideAssetIds,
    preparableAssetIds,
    uploadPlan,
    annotationBindings,
    annotationGuidesAreProviderMasks: false,
    videoEditContexts,
    preserveUnannotatedSourceVideo: videoEditContexts.length > 0,
    annotatedFramesAreStandaloneEndpoints: false,
    standaloneGenerationRequiresExplicitUserRequest: videoEditContexts.length > 0,
    materialIds: revisionIntent.materialReferences.map(({ materialId }) => materialId),
    materialReferences: revisionIntent.materialReferences,
    materialTokens: revisionIntent.materialReferences.map(({ materialId }) => `@material:${materialId}`),
  };
}
