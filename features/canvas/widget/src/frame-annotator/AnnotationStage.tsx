import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Arrow, Circle, Group, Layer, Line, Path, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  ANNOTATION_HIT_STROKE_MULTIPLIER,
  createAnnotationShapeId,
  pinNumberOf,
  type AnnotationOp,
  type AnnotationShape,
  type AnnotationTool,
} from "./annotation-types.js";

const STROKE_SAMPLE_STEP = 2;
type DraftShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "stroke"; points: number[] }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number };

function shapeBounds(shape: AnnotationShape) {
  if (shape.kind === "rect") return { left: shape.x, top: shape.y, right: shape.x + shape.width, bottom: shape.y + shape.height };
  if (shape.kind === "arrow") return { left: Math.min(shape.x1, shape.x2), top: Math.min(shape.y1, shape.y2), right: Math.max(shape.x1, shape.x2), bottom: Math.max(shape.y1, shape.y2) };
  if (shape.kind === "stroke") {
    const xs = shape.points.filter((_, index) => index % 2 === 0).map((value) => value + shape.x);
    const ys = shape.points.filter((_, index) => index % 2 === 1).map((value) => value + shape.y);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  }
  if (shape.kind === "text") return { left: shape.x, top: shape.y, right: shape.x + shape.text.length * shape.fontSize * .62, bottom: shape.y + shape.fontSize * 1.25 };
  return { left: shape.x - shape.radius, top: shape.y - shape.radius * 3.1, right: shape.x + shape.radius, bottom: shape.y };
}

export type AnnotationStageExportTarget = { toCanvas(config?: { pixelRatio?: number }): HTMLCanvasElement };

export interface AnnotationStageProps {
  shapes: readonly AnnotationShape[];
  selectedId: string | null;
  activeTool: AnnotationTool | null;
  activeColor: string;
  nativeWidth: number;
  nativeHeight: number;
  displayWidth: number;
  displayHeight: number;
  strokeWidth: number;
  fontSize: number;
  pinRadius: number;
  accentColor: string;
  onSelect: (shapeId: string | null) => void;
  onCommit: (nextShapes: AnnotationShape[], op: AnnotationOp) => void;
  stageRef?: MutableRefObject<AnnotationStageExportTarget | null>;
  onTextEditingChange?: (editing: boolean) => void;
}

function hitShapeId(target: Konva.Node | null | undefined) {
  if (!target || target === target.getStage()) return null;
  return target.name() || null;
}

export function AnnotationStage({
  shapes, selectedId, activeTool, activeColor, nativeWidth, nativeHeight,
  displayWidth, displayHeight, strokeWidth, fontSize, pinRadius, accentColor,
  onSelect, onCommit, stageRef, onTextEditingChange,
}: AnnotationStageProps) {
  const konvaStageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureActiveRef = useRef(false);
  const erasingRef = useRef(false);
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [liveArrow, setLiveArrow] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [textEditor, setTextEditor] = useState<{ shapeId: string | null; x: number; y: number; value: string } | null>(null);
  const [hoverKind, setHoverKind] = useState<"shape" | "anchor" | null>(null);
  const scale = nativeWidth > 0 ? displayWidth / nativeWidth : 1;
  const minShapeSize = Math.max(.01, Math.min(4, Math.min(nativeWidth, nativeHeight) * .02));

  useEffect(() => {
    if (stageRef) stageRef.current = konvaStageRef.current;
    return () => { if (stageRef) stageRef.current = null; };
  }, [stageRef]);
  useEffect(() => onTextEditingChange?.(textEditor !== null), [onTextEditingChange, textEditor]);

  const selectedShape = shapes.find((shape) => shape.id === selectedId) ?? null;
  const transformerEnabled = !textEditor && (selectedShape?.kind === "rect" || selectedShape?.kind === "text");
  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = layerRef.current;
    if (!transformer || !layer || !transformerEnabled || !selectedId) {
      transformer?.nodes([]);
      return;
    }
    const node = layer.findOne<Konva.Node>(`.${selectedId}`);
    transformer.nodes(node ? [node] : []);
  }, [selectedId, shapes, transformerEnabled]);

  const nativePointer = useCallback(() => {
    const pointer = konvaStageRef.current?.getPointerPosition();
    if (!pointer || scale <= 0) return null;
    return {
      x: Math.max(0, Math.min(nativeWidth, pointer.x / scale)),
      y: Math.max(0, Math.min(nativeHeight, pointer.y / scale)),
    };
  }, [nativeHeight, nativeWidth, scale]);

  const replaceShape = useCallback((shapeId: string, next: AnnotationShape, op: AnnotationOp) => {
    onCommit(shapes.map((shape) => shape.id === shapeId ? next : shape), op);
  }, [onCommit, shapes]);
  const clampTranslation = useCallback((shape: AnnotationShape, dx: number, dy: number) => {
    const bounds = shapeBounds(shape);
    return {
      dx: Math.max(-bounds.left, Math.min(nativeWidth - bounds.right, dx)),
      dy: Math.max(-bounds.top, Math.min(nativeHeight - bounds.bottom, dy)),
    };
  }, [nativeHeight, nativeWidth]);
  const deleteShapeAt = useCallback((target: Konva.Node | null | undefined) => {
    const id = hitShapeId(target);
    if (!id || !shapes.some((shape) => shape.id === id)) return;
    onSelect(null);
    setHoverKind(null);
    onCommit(shapes.filter((shape) => shape.id !== id), "delete");
  }, [onCommit, onSelect, shapes]);

  const handleDown = useCallback((event: KonvaEventObject<Event>) => {
    gestureActiveRef.current = true;
    if (textEditor) return;
    if (activeTool === "eraser") {
      erasingRef.current = true;
      deleteShapeAt(event.target);
      return;
    }
    const hitId = hitShapeId(event.target);
    if (hitId && shapes.some((shape) => shape.id === hitId)) {
      onSelect(hitId);
      return;
    }
    if (event.target !== event.target.getStage()) return;
    onSelect(null);
    if (!activeTool) return;
    const point = nativePointer();
    if (!point) return;
    if (activeTool === "rect") setDraft({ kind: "rect", x: point.x, y: point.y, width: 0, height: 0 });
    if (activeTool === "stroke") setDraft({ kind: "stroke", points: [point.x, point.y] });
    if (activeTool === "arrow") setDraft({ kind: "arrow", x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    if (activeTool === "pin") onCommit([...shapes, { id: createAnnotationShapeId(), kind: "pin", color: activeColor, x: point.x, y: point.y, radius: pinRadius }], "create");
    if (activeTool === "text") {
      event.evt.preventDefault();
      setTextEditor({ shapeId: null, x: point.x, y: point.y, value: "" });
    }
  }, [activeColor, activeTool, deleteShapeAt, nativePointer, onCommit, onSelect, pinRadius, shapes, textEditor]);

  const handleMove = useCallback((event: KonvaEventObject<Event>) => {
    if (erasingRef.current) { deleteShapeAt(event.target); return; }
    if (!draft) return;
    const point = nativePointer();
    if (!point) return;
    setDraft((current) => {
      if (!current) return current;
      if (current.kind === "rect") return { ...current, width: point.x - current.x, height: point.y - current.y };
      if (current.kind === "arrow") return { ...current, x2: point.x, y2: point.y };
      const lastX = current.points.at(-2) ?? point.x;
      const lastY = current.points.at(-1) ?? point.y;
      return Math.hypot(point.x - lastX, point.y - lastY) < STROKE_SAMPLE_STEP
        ? current : { kind: "stroke", points: [...current.points, point.x, point.y] };
    });
  }, [deleteShapeAt, draft, nativePointer]);

  const finishGesture = useCallback(() => {
    if (!gestureActiveRef.current) return;
    gestureActiveRef.current = false;
    erasingRef.current = false;
    if (!draft) return;
    setDraft(null);
    if (draft.kind === "rect") {
      if (Math.abs(draft.width) < minShapeSize || Math.abs(draft.height) < minShapeSize) return;
      onCommit([...shapes, {
        id: createAnnotationShapeId(), kind: "rect", color: activeColor,
        x: draft.width < 0 ? draft.x + draft.width : draft.x,
        y: draft.height < 0 ? draft.y + draft.height : draft.y,
        width: Math.abs(draft.width), height: Math.abs(draft.height),
      }], "create");
    } else if (draft.kind === "arrow") {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < minShapeSize) return;
      onCommit([...shapes, { id: createAnnotationShapeId(), kind: "arrow", color: activeColor, x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2, strokeWidth }], "create");
    } else if (draft.points.length >= 4) {
      onCommit([...shapes, { id: createAnnotationShapeId(), kind: "stroke", color: activeColor, x: 0, y: 0, points: draft.points, strokeWidth }], "create");
    }
  }, [activeColor, draft, minShapeSize, onCommit, shapes, strokeWidth]);

  useEffect(() => {
    window.addEventListener("mouseup", finishGesture);
    window.addEventListener("touchend", finishGesture);
    return () => {
      window.removeEventListener("mouseup", finishGesture);
      window.removeEventListener("touchend", finishGesture);
    };
  }, [finishGesture]);

  const commitTextEditor = useCallback(() => {
    if (!textEditor) return;
    const value = textEditor.value.trim();
    const editing = textEditor;
    setTextEditor(null);
    if (editing.shapeId) {
      const target = shapes.find((shape) => shape.id === editing.shapeId);
      if (!target || target.kind !== "text") return;
      if (!value) {
        onSelect(null);
        onCommit(shapes.filter((shape) => shape.id !== editing.shapeId), "delete");
      } else if (value !== target.text) replaceShape(target.id, { ...target, text: value }, "resize");
    } else if (value) {
      onCommit([...shapes, { id: createAnnotationShapeId(), kind: "text", color: activeColor, x: editing.x, y: editing.y, text: value, fontSize }], "create");
    }
  }, [activeColor, fontSize, onCommit, onSelect, replaceShape, shapes, textEditor]);

  const renderShape = (shape: AnnotationShape, isDraft = false) => {
    const common = {
      name: isDraft ? undefined : shape.id,
      listening: !isDraft,
      draggable: !isDraft && activeTool !== "eraser",
      onMouseEnter: isDraft ? undefined : () => setHoverKind("shape" as const),
      onMouseLeave: isDraft ? undefined : () => setHoverKind(null),
    };
    const dragEnd = (event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      if (shape.kind === "arrow") {
        const { dx: x, dy: y } = clampTranslation(shape, node.x(), node.y());
        node.position({ x: 0, y: 0 });
        replaceShape(shape.id, { ...shape, x1: shape.x1 + x, y1: shape.y1 + y, x2: shape.x2 + x, y2: shape.y2 + y }, "move");
      } else {
        const { dx, dy } = clampTranslation(shape, node.x() - shape.x, node.y() - shape.y);
        node.position({ x: shape.x + dx, y: shape.y + dy });
        replaceShape(shape.id, { ...shape, x: shape.x + dx, y: shape.y + dy }, "move");
      }
    };
    if (shape.kind === "rect") return <Rect key={shape.id} {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} stroke={shape.color} strokeWidth={strokeWidth} fillEnabled={false} hitStrokeWidth={strokeWidth * ANNOTATION_HIT_STROKE_MULTIPLIER} onDragEnd={dragEnd} onTransformEnd={(event) => {
      const node = event.target, sx = node.scaleX(), sy = node.scaleY();
      node.scale({ x: 1, y: 1 });
      replaceShape(shape.id, { ...shape, x: node.x(), y: node.y(), width: Math.max(minShapeSize, Math.abs(shape.width * sx)), height: Math.max(minShapeSize, Math.abs(shape.height * sy)) }, "resize");
    }} />;
    if (shape.kind === "stroke") return <Line key={shape.id} {...common} x={shape.x} y={shape.y} points={shape.points} stroke={shape.color} strokeWidth={shape.strokeWidth} lineCap="round" lineJoin="round" tension={.25} hitStrokeWidth={shape.strokeWidth * ANNOTATION_HIT_STROKE_MULTIPLIER} onDragEnd={dragEnd} />;
    if (shape.kind === "arrow") {
      const value = !isDraft && liveArrow?.id === shape.id ? liveArrow : shape;
      return <Arrow key={shape.id} {...common} points={[value.x1, value.y1, value.x2, value.y2]} stroke={shape.color} fill={shape.color} strokeWidth={shape.strokeWidth} pointerLength={shape.strokeWidth * 3} pointerWidth={shape.strokeWidth * 3} hitStrokeWidth={shape.strokeWidth * ANNOTATION_HIT_STROKE_MULTIPLIER} onDragEnd={dragEnd} />;
    }
    if (shape.kind === "text") return <Text key={shape.id} {...common} visible={textEditor?.shapeId !== shape.id} x={shape.x} y={shape.y} text={shape.text} fill={shape.color} fontSize={shape.fontSize} fontStyle="bold" onDragEnd={dragEnd} onDblClick={() => setTextEditor({ shapeId: shape.id, x: shape.x, y: shape.y, value: shape.text })} onDblTap={() => setTextEditor({ shapeId: shape.id, x: shape.x, y: shape.y, value: shape.text })} onTransformEnd={(event) => {
      const node = event.target;
      const nextSize = Math.max(8, shape.fontSize * Math.abs(node.scaleX()));
      node.scale({ x: 1, y: 1 });
      replaceShape(shape.id, { ...shape, x: node.x(), y: node.y(), fontSize: nextSize }, "resize");
    }} />;
    const pinScale = shape.radius / 7;
    const labelColor = shape.color.toLowerCase() === "#ffffff" ? "#1a1a1a" : "#ffffff";
    return <Group key={shape.id} {...common} x={shape.x} y={shape.y} onDragEnd={dragEnd}>
      <Path name={common.name} data="M12 2C8.13 2 5 5.13 5 8.5c0 5.25 7 13.5 7 13.5s7-8.25 7-13.5C19 5.13 15.87 2 12 2z" scaleX={pinScale} scaleY={pinScale} offsetX={12} offsetY={22} fill={shape.color} stroke="#fff" strokeWidth={1.4} />
      <Text listening={false} text={String(pinNumberOf(shapes, shape.id))} fill={labelColor} fontSize={shape.radius * 1.05} fontStyle="bold" align="center" width={shape.radius * 2} height={shape.radius * 2} x={-shape.radius} y={-20.5 * pinScale} />
    </Group>;
  };

  const draftShape: AnnotationShape | null = !draft ? null
    : draft.kind === "rect" ? { id: "draft", kind: "rect", color: activeColor, x: draft.x, y: draft.y, width: draft.width, height: draft.height }
      : draft.kind === "arrow" ? { id: "draft", kind: "arrow", color: activeColor, x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2, strokeWidth }
        : { id: "draft", kind: "stroke", color: activeColor, x: 0, y: 0, points: draft.points, strokeWidth };
  const selectedArrow = selectedShape?.kind === "arrow" ? selectedShape : null;

  return <div className="konva-annotation-stage" aria-label="Annotation layer" style={{ width: displayWidth, height: displayHeight, cursor: draft ? "crosshair" : hoverKind === "shape" ? "move" : hoverKind === "anchor" ? "grab" : activeTool ? "crosshair" : "default" }}>
    <Stage ref={konvaStageRef} width={displayWidth} height={displayHeight} scaleX={scale} scaleY={scale} onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={finishGesture} onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={finishGesture}>
      <Layer ref={layerRef}>
        {shapes.map((shape) => renderShape(shape))}
        {draftShape ? renderShape(draftShape, true) : null}
        {selectedArrow ? ([['start', selectedArrow.x1, selectedArrow.y1], ['end', selectedArrow.x2, selectedArrow.y2]] as const).map(([key, x, y]) => <Circle key={key} x={x} y={y} radius={strokeWidth * 2.5} fill="#fff" stroke={accentColor} strokeWidth={1.5 / scale} draggable onMouseEnter={() => setHoverKind("anchor")} onMouseLeave={() => setHoverKind(null)} onDragMove={(event) => setLiveArrow({ id: selectedArrow.id, x1: key === "start" ? event.target.x() : selectedArrow.x1, y1: key === "start" ? event.target.y() : selectedArrow.y1, x2: key === "end" ? event.target.x() : selectedArrow.x2, y2: key === "end" ? event.target.y() : selectedArrow.y2 })} onDragEnd={(event) => {
          setLiveArrow(null);
          const x = Math.max(0, Math.min(nativeWidth, event.target.x()));
          const y = Math.max(0, Math.min(nativeHeight, event.target.y()));
          replaceShape(selectedArrow.id, { ...selectedArrow, x1: key === "start" ? x : selectedArrow.x1, y1: key === "start" ? y : selectedArrow.y1, x2: key === "end" ? x : selectedArrow.x2, y2: key === "end" ? y : selectedArrow.y2 }, "resize");
        }} />) : null}
        <Transformer ref={transformerRef} rotateEnabled={false} enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]} borderStroke={accentColor} borderStrokeWidth={1 / scale} borderDash={[4 / scale, 3 / scale]} anchorStroke={accentColor} anchorFill="#fff" anchorSize={10 / scale} anchorCornerRadius={5 / scale} anchorStrokeWidth={1.5 / scale} boundBoxFunc={(_old, next) => {
          const x = Math.max(0, Math.min(nativeWidth - minShapeSize, next.x));
          const y = Math.max(0, Math.min(nativeHeight - minShapeSize, next.y));
          return { ...next, x, y, width: Math.max(minShapeSize, Math.min(nativeWidth - x, Math.abs(next.width))), height: Math.max(minShapeSize, Math.min(nativeHeight - y, Math.abs(next.height))) };
        }} />
      </Layer>
    </Stage>
    {textEditor ? (() => {
      const size = fontSize * scale;
      const canvas = measureCanvasRef.current ?? (measureCanvasRef.current = document.createElement("canvas"));
      const context = canvas.getContext("2d");
      if (context) context.font = `700 ${size}px Arial`;
      const width = Math.min(Math.max(context?.measureText(textEditor.value || " ").width ?? size * 3, size * 3), Math.max(size * 3, (nativeWidth - textEditor.x) * scale));
      return <textarea autoFocus className="annotation-text-overlay" value={textEditor.value} onChange={(event) => setTextEditor((current) => current ? { ...current, value: event.target.value } : null)} onBlur={commitTextEditor} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commitTextEditor(); }
        if (event.key === "Escape") { event.preventDefault(); setTextEditor(null); }
      }} style={{ left: textEditor.x * scale, top: textEditor.y * scale, width, color: activeColor, borderColor: accentColor, fontSize: size }} />;
    })() : null}
  </div>;
}

export default AnnotationStage;
