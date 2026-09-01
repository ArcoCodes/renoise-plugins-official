import type { AnnotationRecord } from "./document-schema.js";

export function reviewObjectIds(selectedIds: readonly string[], annotations: readonly AnnotationRecord[]) {
  const relevant = new Set(selectedIds);
  for (const annotation of annotations) {
    if (annotation.targetObjectIds.some((id) => relevant.has(id)) || annotation.markObjectIds.some((id) => relevant.has(id))) {
      annotation.targetObjectIds.forEach((id) => relevant.add(id));
      annotation.markObjectIds.forEach((id) => relevant.add(id));
    }
  }
  return relevant;
}

export function reviewBounds(rectangles: ReadonlyArray<{ left: number; top: number; width: number; height: number }>, padding = 24) {
  if (!rectangles.length) throw new Error("Review export has no objects");
  const union = rectangles.reduce((result, rect) => ({
    left: Math.min(result.left, rect.left),
    top: Math.min(result.top, rect.top),
    right: Math.max(result.right, rect.left + rect.width),
    bottom: Math.max(result.bottom, rect.top + rect.height),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  return {
    left: union.left - padding,
    top: union.top - padding,
    width: Math.max(1, union.right - union.left + padding * 2),
    height: Math.max(1, union.bottom - union.top + padding * 2),
  };
}
