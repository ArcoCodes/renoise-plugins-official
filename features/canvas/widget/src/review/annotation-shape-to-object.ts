import type { WhiteboardObject } from "../../../shared/document-schema.js";
import type { AnnotationShape } from "../frame-annotator/annotation-types.js";
import { pinNumberOf } from "../frame-annotator/annotation-types.js";
import { randomIdToken } from "../random-id.js";

type ImageTarget = Extract<WhiteboardObject, { type: "image" }>;

export function annotationShapesToObjects(
  shapes: readonly AnnotationShape[],
  target: ImageTarget,
  coordinateSize: { width: number; height: number },
  createdAt = new Date().toISOString(),
): WhiteboardObject[] {
  if (coordinateSize.width <= 0 || coordinateSize.height <= 0) throw new Error("Annotation coordinates must be positive");
  const scaleX = target.transform.width / coordinateSize.width;
  const scaleY = target.transform.height / coordinateSize.height;
  const strokeScale = (scaleX + scaleY) / 2;
  const nativeStrokeWidth = Math.max(2, Math.round(Math.max(coordinateSize.width, coordinateSize.height) / 320));
  const point = (x: number, y: number) => ({ x: x * scaleX, y: y * scaleY });
  const base = (transform: WhiteboardObject["transform"]) => ({
    id: `mark_${randomIdToken()}`,
    parentId: null,
    transform,
    zIndex: target.zIndex + 1,
    locked: true,
    hidden: true,
    createdAt,
    updatedAt: createdAt,
  });

  return shapes.map((shape): WhiteboardObject => {
    if (shape.kind === "stroke") return {
      ...base({
        x: target.transform.x + shape.x * scaleX,
        y: target.transform.y + shape.y * scaleY,
        width: target.transform.width,
        height: target.transform.height,
        rotation: 0,
      }),
      type: "freehand",
      data: {
        points: Array.from({ length: shape.points.length / 2 }, (_, index) => point(shape.points[index * 2]!, shape.points[index * 2 + 1]!)),
        width: shape.strokeWidth * strokeScale,
      },
      style: { stroke: shape.color, strokeWidth: shape.strokeWidth * strokeScale, sourceOffsetX: shape.x, sourceOffsetY: shape.y },
    };
    if (shape.kind === "arrow") return {
      ...base({ ...target.transform, rotation: 0 }),
      type: "arrow",
      data: { points: [point(shape.x1, shape.y1), point(shape.x2, shape.y2)] },
      style: { stroke: shape.color, fill: shape.color, strokeWidth: shape.strokeWidth * strokeScale },
    };
    if (shape.kind === "rect") return {
      ...base({
        x: target.transform.x + shape.x * scaleX,
        y: target.transform.y + shape.y * scaleY,
        width: Math.max(1, shape.width * scaleX),
        height: Math.max(1, shape.height * scaleY),
        rotation: 0,
      }),
      type: "rect",
      data: {},
      style: { stroke: shape.color, strokeWidth: Math.max(1, nativeStrokeWidth * strokeScale), fill: "transparent" },
    };
    if (shape.kind === "text") return {
      ...base({
        x: target.transform.x + shape.x * scaleX,
        y: target.transform.y + shape.y * scaleY,
        width: Math.max(1, shape.text.length * shape.fontSize * .62 * scaleX),
        height: Math.max(1, shape.fontSize * 1.25 * scaleY),
        rotation: 0,
      }),
      type: "text",
      data: { text: shape.text, fontSize: shape.fontSize * strokeScale, align: "left" },
      style: { fill: shape.color },
    };
    const radiusX = shape.radius * scaleX;
    const radiusY = shape.radius * scaleY;
    return {
      ...base({
        x: target.transform.x + shape.x * scaleX - radiusX,
        y: target.transform.y + shape.y * scaleY - radiusY * 3.1,
        width: Math.max(1, radiusX * 2),
        height: Math.max(1, radiusY * 3.1),
        rotation: 0,
      }),
      type: "ellipse",
      data: {},
      style: { variant: "numbered-pin", number: pinNumberOf(shapes, shape.id), radius: shape.radius * strokeScale, fill: shape.color },
    };
  });
}
