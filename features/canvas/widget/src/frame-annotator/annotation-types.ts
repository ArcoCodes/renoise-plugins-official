export type AnnotationToolKind = "rect" | "stroke" | "arrow" | "text" | "pin";
export type AnnotationTool = AnnotationToolKind | "eraser";

interface AnnotationShapeBase { id: string; color: string }
export interface RectShape extends AnnotationShapeBase {
  kind: "rect"; x: number; y: number; width: number; height: number;
}
export interface StrokeShape extends AnnotationShapeBase {
  kind: "stroke"; x: number; y: number; points: number[]; strokeWidth: number;
}
export interface ArrowShape extends AnnotationShapeBase {
  kind: "arrow"; x1: number; y1: number; x2: number; y2: number; strokeWidth: number;
}
export interface TextShape extends AnnotationShapeBase {
  kind: "text"; x: number; y: number; text: string; fontSize: number;
}
export interface PinShape extends AnnotationShapeBase {
  kind: "pin"; x: number; y: number; radius: number;
}
export type AnnotationShape = RectShape | StrokeShape | ArrowShape | TextShape | PinShape;
export type AnnotationOp = "create" | "move" | "resize" | "recolor" | "delete";

export function pinNumberOf(shapes: readonly AnnotationShape[], pinId: string) {
  let value = 0;
  for (const shape of shapes) {
    if (shape.kind !== "pin") continue;
    value += 1;
    if (shape.id === pinId) return value;
  }
  return value;
}

export function createAnnotationShapeId() {
  return `shape-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ANNOTATION_HIT_STROKE_MULTIPLIER = 6;
export const ANNOTATION_COLORS = ["#FF3B30", "#FFCC00", "#34C759", "#0A84FF", "#000000", "#FFFFFF"] as const;
