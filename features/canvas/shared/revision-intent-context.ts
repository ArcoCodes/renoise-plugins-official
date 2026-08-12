import type { RevisionIntent, WhiteboardDocument } from "./document-schema.js";

export type SourceVideoEditContext = {
  sourceVideoAssetId: string;
  sourceVideoSha256: string;
  sourceDurationMs: number | null;
  sourceFileName: string | null;
  annotatedTimeMs: number[];
  annotationBoundsMs: { startMs: number; endMs: number } | null;
  requiresTemporalRangeClarification: boolean;
};

export function describeRevisionIntent(
  revisionIntent: RevisionIntent,
  document: WhiteboardDocument,
) {
  const referenceAssetIds = [...new Set(revisionIntent.sources.map(({ assetId }) => assetId))];
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
    const annotatedTimeMs = [...group.times].sort((left, right) => left - right);
    return {
      sourceVideoAssetId: group.sourceVideoAssetId,
      sourceVideoSha256: group.sourceVideoSha256,
      sourceDurationMs: video?.type === "video-card" ? video.data.durationMs : null,
      sourceFileName: video?.type === "video-card" ? video.data.fileName : null,
      annotatedTimeMs,
      annotationBoundsMs: annotatedTimeMs.length >= 2
        ? { startMs: annotatedTimeMs[0], endMs: annotatedTimeMs.at(-1)! }
        : null,
      requiresTemporalRangeClarification: annotatedTimeMs.length < 2,
    };
  });
  const sourceVideoAssetIds = [...new Set(videoEditContexts.map(({ sourceVideoAssetId }) => sourceVideoAssetId))];

  return {
    defaultOperation: videoEditContexts.length ? "source-video-segment-edit" as const : "image-revision" as const,
    referenceAssetIds,
    sourceVideoAssetIds,
    preparableAssetIds: [...new Set([...sourceVideoAssetIds, ...referenceAssetIds])],
    videoEditContexts,
    preserveUnannotatedSourceVideo: videoEditContexts.length > 0,
    annotatedFramesAreStandaloneEndpoints: false,
    standaloneGenerationRequiresExplicitUserRequest: videoEditContexts.length > 0,
  };
}
