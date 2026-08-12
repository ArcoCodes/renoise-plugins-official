import type { Canvas } from "fabric";
import type { AnnotationRecord } from "../../../shared/document-schema.js";
import { reviewBounds, reviewObjectIds } from "../../../shared/review-geometry.js";
import { getMeta } from "../canvas/fabric-adapter.js";

export function renderReviewSnapshot(canvas: Canvas, selectedIds: string[], annotations: AnnotationRecord[]) {
  const relevant = reviewObjectIds(selectedIds, annotations);
  const included = canvas.getObjects().filter((object) => relevant.has(getMeta(object)?.id ?? ""));
  if (!included.length) throw new Error("No selected review objects are present on the canvas");
  const bounds = reviewBounds(included.map((object) => object.getBoundingRect()));
  const visibility = canvas.getObjects().map((object) => [object, object.visible] as const);
  const activeObject = canvas.getActiveObject();
  const viewport = canvas.viewportTransform ? [...canvas.viewportTransform] as [number, number, number, number, number, number] : undefined;
  try {
    for (const object of canvas.getObjects()) object.visible = relevant.has(getMeta(object)?.id ?? "");
    canvas.discardActiveObject();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
    return canvas.toDataURL({
      format: "png",
      multiplier: 2,
      enableRetinaScaling: true,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  } finally {
    for (const [object, visible] of visibility) object.visible = visible;
    if (viewport) canvas.setViewportTransform(viewport);
    if (activeObject) canvas.setActiveObject(activeObject);
    canvas.requestRenderAll();
  }
}

/** Burn the target and its marks into an exact media-sized PNG for the intent chip. */
export function renderAnnotatedTargetSnapshot(canvas: Canvas, targetId: string, annotations: AnnotationRecord[]) {
  const relevant = reviewObjectIds([targetId], annotations);
  const target = canvas.getObjects().find((object) => getMeta(object)?.id === targetId);
  if (!target) throw new Error("当前媒体尚未完成渲染");
  const markCount = canvas.getObjects().filter((object) => {
    const id = getMeta(object)?.id;
    return Boolean(object.visible && id && id !== targetId && relevant.has(id));
  }).length;
  if (!markCount) throw new Error("请至少添加一个标注后再提交");
  const bounds = target.getBoundingRect();
  const visibility = canvas.getObjects().map((object) => [object, object.visible] as const);
  const activeObject = canvas.getActiveObject();
  const viewport = canvas.viewportTransform ? [...canvas.viewportTransform] as [number, number, number, number, number, number] : undefined;
  try {
    for (const [object, visible] of visibility) object.visible = visible && relevant.has(getMeta(object)?.id ?? "");
    canvas.discardActiveObject();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
    return canvas.toDataURL({
      format: "png",
      multiplier: 2,
      enableRetinaScaling: true,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  } finally {
    for (const [object, visible] of visibility) object.visible = visible;
    if (viewport) canvas.setViewportTransform(viewport);
    if (activeObject) canvas.setActiveObject(activeObject);
    canvas.requestRenderAll();
  }
}
