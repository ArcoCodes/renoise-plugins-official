import type { WhiteboardObject } from "../../shared/document-schema.js";
import type { AnnotationShape } from "../src/frame-annotator/annotation-types.js";
import { annotationShapesToObjects } from "../src/review/annotation-shape-to-object.js";

const now = "2026-01-01T00:00:00.000Z";
const target: Extract<WhiteboardObject, { type: "image" }> = {
  id: "snapshot_fixture",
  type: "image",
  parentId: null,
  transform: { x: 10, y: 20, width: 640, height: 360, rotation: 0 },
  zIndex: 1,
  locked: true,
  hidden: false,
  style: {},
  data: { assetId: "asset_fixture", alt: "fixture", source: {} },
  createdAt: now,
  updatedAt: now,
};
const shapes: AnnotationShape[] = [
  { id: "rect", kind: "rect", color: "#FF3B30", x: 100, y: 50, width: 200, height: 100 },
  { id: "stroke", kind: "stroke", color: "#34C759", x: 9, y: 11, points: [1, 2, 30, 40], strokeWidth: 6 },
  { id: "arrow", kind: "arrow", color: "#0A84FF", x1: 10, y1: 20, x2: 310, y2: 180, strokeWidth: 7 },
  { id: "text", kind: "text", color: "#FFFFFF", x: 30, y: 40, text: "Change this", fontSize: 28 },
  { id: "pin", kind: "pin", color: "#FFCC00", x: 400, y: 220, radius: 18 },
];

Object.assign(window, { __mappedAnnotationObjects: annotationShapesToObjects(shapes, target, { width: 1280, height: 720 }, now) });
