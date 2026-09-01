import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WhiteboardObject } from "../../../shared/document-schema.js";
import type { WhiteboardTool } from "../canvas/interaction-controller.js";
import { randomIdToken } from "../random-id.js";

type ImageTarget = Extract<WhiteboardObject, { type: "image" }>;
type Point = { x: number; y: number };
const MAX_EXPORT_EDGE = 4096;
const MAX_EXPORT_PIXELS = 16_777_216;
const MAX_EXPORT_BYTES = 19 * 1024 * 1024;

export type AnnotationDraftMark =
  | { id: string; kind: "pen"; points: Point[] }
  | { id: string; kind: "arrow"; start: Point; end: Point }
  | { id: string; kind: "rect"; start: Point; end: Point }
  | { id: string; kind: "text"; point: Point; text: string }
  | { id: string; kind: "pin"; point: Point; number: number };

type DraftState = {
  past: AnnotationDraftMark[][];
  present: AnnotationDraftMark[];
  future: AnnotationDraftMark[][];
};

type DraftAction =
  | { type: "replace"; marks: AnnotationDraftMark[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  if (action.type === "clear") return { past: [], present: [], future: [] };
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
  }
  return { past: [...state.past, state.present], present: action.marks, future: [] };
}

function markBounds(mark: AnnotationDraftMark, visualScale = 1) {
  if (mark.kind === "pin") return {
    minX: mark.point.x - 17 * visualScale,
    maxX: mark.point.x + 17 * visualScale,
    minY: mark.point.y - 42 * visualScale,
    maxY: mark.point.y,
  };
  if (mark.kind === "text") return {
    minX: mark.point.x,
    maxX: mark.point.x + Math.max(20, mark.text.length * 12) * visualScale,
    minY: mark.point.y - 20 * visualScale,
    maxY: mark.point.y + 4 * visualScale,
  };
  const points = mark.kind === "pen" ? mark.points : [mark.start, mark.end];
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    maxX: Math.max(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxY: Math.max(...points.map(({ y }) => y)),
  };
}

function visibleDrawMark(mark: AnnotationDraftMark, width: number, height: number, visualScale: number) {
  const threshold = Math.max(.001, Math.min(width, height) * .004);
  const rawBounds = markBounds(mark, visualScale);
  const strokePadding = mark.kind === "pen" || mark.kind === "arrow" ? 3 * visualScale : 0;
  const bounds = {
    minX: rawBounds.minX - strokePadding,
    maxX: rawBounds.maxX + strokePadding,
    minY: rawBounds.minY - strokePadding,
    maxY: rawBounds.maxY + strokePadding,
  };
  const visibleWidth = Math.min(width, bounds.maxX) - Math.max(0, bounds.minX);
  const visibleHeight = Math.min(height, bounds.maxY) - Math.max(0, bounds.minY);
  if (visibleWidth <= 0 || visibleHeight <= 0) return false;
  if (mark.kind === "rect") return rawBounds.maxX - rawBounds.minX >= threshold && rawBounds.maxY - rawBounds.minY >= threshold;
  if (mark.kind === "arrow") return Math.hypot(mark.end.x - mark.start.x, mark.end.y - mark.start.y) >= threshold;
  if (mark.kind === "pen") return mark.points.length >= 2 && Math.hypot(rawBounds.maxX - rawBounds.minX, rawBounds.maxY - rawBounds.minY) >= threshold;
  return visibleWidth >= Math.min(threshold, bounds.maxX - bounds.minX)
    && visibleHeight >= Math.min(threshold, bounds.maxY - bounds.minY);
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not generate the annotated PNG")),
    "image/png",
  ));
}

function markerPath(context: CanvasRenderingContext2D, x: number, y: number, radius: number, number: number) {
  context.save();
  context.fillStyle = "#0AA7C2";
  context.strokeStyle = "#FFFFFF";
  context.lineWidth = Math.max(2, radius * .16);
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - radius * .55, y - radius * .9);
  context.lineTo(x + radius * .55, y - radius * .9);
  context.closePath();
  context.fill();
  context.beginPath();
  context.arc(x, y - radius * 1.35, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#FFFFFF";
  context.font = `700 ${radius * 1.05}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), x, y - radius * 1.35);
  context.restore();
}

function drawSnapshotMark(
  context: CanvasRenderingContext2D,
  mark: AnnotationDraftMark,
  scaleX: number,
  scaleY: number,
  visualScale: number,
) {
  const point = ({ x, y }: Point) => ({ x: x * scaleX, y: y * scaleY });
  const strokeScale = (scaleX + scaleY) / 2;
  context.save();
  context.strokeStyle = "#FF4D4F";
  context.fillStyle = "#FF4D4F";
  context.lineWidth = Math.max(3, 3 * visualScale * strokeScale);
  context.lineCap = "round";
  context.lineJoin = "round";
  if (mark.kind === "pen") {
    const [first, ...rest] = mark.points.map(point);
    if (first) {
      context.beginPath();
      context.moveTo(first.x, first.y);
      rest.forEach(({ x, y }) => context.lineTo(x, y));
      context.stroke();
    }
  } else if (mark.kind === "rect") {
    const start = point(mark.start);
    const end = point(mark.end);
    context.strokeRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  } else if (mark.kind === "arrow") {
    const start = point(mark.start);
    const end = point(mark.end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head = Math.max(12, 14 * visualScale * strokeScale);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  } else if (mark.kind === "text") {
    const anchor = point(mark.point);
    context.font = `600 ${Math.max(18, 20 * visualScale * strokeScale)}px sans-serif`;
    context.textBaseline = "top";
    context.fillText(mark.text, anchor.x, anchor.y);
  } else {
    const anchor = point(mark.point);
    markerPath(context, anchor.x, anchor.y, Math.max(14, 16 * visualScale * strokeScale), mark.number);
  }
  context.restore();
}

export type FixedMediaAnnotatorHandle = {
  clear: () => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => Promise<{
    blob: Blob;
    width: number;
    height: number;
    coordinateSize: { width: number; height: number };
    marks: AnnotationDraftMark[];
  }>;
};

export const FixedMediaAnnotator = forwardRef<FixedMediaAnnotatorHandle, {
  target: ImageTarget;
  tool: WhiteboardTool;
  readAsset: (assetId: string) => Promise<string>;
  resetKey: number;
  onStateChange: (state: { markCount: number; canUndo: boolean; canRedo: boolean }) => void;
}>(({ target, tool, readAsset, resetKey, onStateChange }, forwardedRef) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const stateRef = useRef<DraftState>({ past: [], present: [], future: [] });
  const [sourceUrl, setSourceUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [mediaSize, setMediaSize] = useState({ width: target.transform.width, height: target.transform.height });
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [state, dispatch] = useReducer(draftReducer, { past: [], present: [], future: [] });
  const [preview, setPreview] = useState<AnnotationDraftMark>();
  const [textEditor, setTextEditor] = useState<{ point: Point; value: string }>();
  const visualScale = Math.max(.001, Math.min(mediaSize.width, mediaSize.height) / 600);
  const gestureRef = useRef<
    | { kind: "draw"; tool: "pen" | "arrow" | "rectangle"; start: Point; points: Point[] }
    | undefined
  >(undefined);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    onStateChange({ markCount: state.present.length, canUndo: state.past.length > 0, canRedo: state.future.length > 0 });
  }, [onStateChange, state.future.length, state.past.length, state.present.length]);
  useEffect(() => {
    let cancelled = false;
    setSourceUrl("");
    setLoadError("");
    void readAsset(target.data.assetId)
      .then((url) => { if (!cancelled) setSourceUrl(url); })
      .catch((caught) => {
        if (!cancelled) setLoadError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => { cancelled = true; };
  }, [loadAttempt, readAsset, target.data.assetId]);
  useEffect(() => {
    dispatch({ type: "clear" });
    setPreview(undefined);
    setTextEditor(undefined);
  }, [resetKey, target.id]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = mediaSize.width / mediaSize.height;
      const containerAspect = width / Math.max(1, height);
      setFrameSize(containerAspect > aspect
        ? { width: height * aspect, height }
        : { width, height: width / aspect });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [mediaSize.height, mediaSize.width]);

  const replaceMarks = useCallback((marks: AnnotationDraftMark[]) => dispatch({ type: "replace", marks }), []);
  useImperativeHandle(forwardedRef, () => ({
    clear: () => dispatch({ type: "clear" }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    snapshot: async () => {
      const image = imageRef.current;
      const marks = stateRef.current.present;
      if (!image?.complete || !image.naturalWidth || !image.naturalHeight) throw new Error("The media is still loading. Try again shortly");
      const visibleMarks = marks.filter((mark) => visibleDrawMark(mark, mediaSize.width, mediaSize.height, visualScale));
      if (!visibleMarks.length) throw new Error("Add at least one clearly visible annotation before submitting");
      const exportScale = Math.min(
        1,
        MAX_EXPORT_EDGE / image.naturalWidth,
        MAX_EXPORT_EDGE / image.naturalHeight,
        Math.sqrt(MAX_EXPORT_PIXELS / (image.naturalWidth * image.naturalHeight)),
      );
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create the annotation snapshot");
      let blob: Blob | undefined;
      let boundedScale = exportScale;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        canvas.width = Math.max(1, Math.round(image.naturalWidth * boundedScale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * boundedScale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const scaleX = canvas.width / mediaSize.width;
        const scaleY = canvas.height / mediaSize.height;
        visibleMarks.forEach((mark) => drawSnapshotMark(context, mark, scaleX, scaleY, visualScale));
        blob = await canvasToPngBlob(canvas);
        if (blob.size <= MAX_EXPORT_BYTES) break;
        boundedScale *= Math.min(.82, Math.sqrt(MAX_EXPORT_BYTES / blob.size) * .9);
      }
      if (!blob || blob.size > MAX_EXPORT_BYTES) throw new Error("The annotated image is still too large. Resize the image and try again");
      return {
        blob,
        width: canvas.width,
        height: canvas.height,
        coordinateSize: { ...mediaSize },
        marks: structuredClone(visibleMarks),
      };
    },
  }), [mediaSize, visualScale]);

  const toPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(mediaSize.width, (event.clientX - bounds.left) / bounds.width * mediaSize.width)),
      y: Math.max(0, Math.min(mediaSize.height, (event.clientY - bounds.top) / bounds.height * mediaSize.height)),
    };
  };

  const commitText = () => {
    if (!textEditor) return;
    const value = textEditor.value.trim();
    if (value) replaceMarks([...stateRef.current.present, { id: `mark_${randomIdToken()}`, kind: "text", point: textEditor.point, text: value }]);
    setTextEditor(undefined);
  };

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = toPoint(event);
    const markId = (event.target as SVGElement).closest<SVGElement>("[data-mark-id]")?.dataset.markId;
    if (tool === "select") return;
    if (tool === "eraser") {
      if (markId) replaceMarks(stateRef.current.present.filter(({ id }) => id !== markId));
      return;
    }
    if (tool === "pin") {
      const number = stateRef.current.present.reduce((maximum, mark) => mark.kind === "pin" ? Math.max(maximum, mark.number) : maximum, 0) + 1;
      const pinPoint = {
        x: Math.max(17 * visualScale, Math.min(mediaSize.width - 17 * visualScale, point.x)),
        y: Math.max(42 * visualScale, Math.min(mediaSize.height, point.y)),
      };
      replaceMarks([...stateRef.current.present, { id: `mark_${randomIdToken()}`, kind: "pin", point: pinPoint, number }]);
      return;
    }
    if (tool === "text") {
      setTextEditor({
        point: {
          x: Math.max(0, Math.min(mediaSize.width - 20 * visualScale, point.x)),
          y: Math.max(20 * visualScale, Math.min(mediaSize.height - 4 * visualScale, point.y)),
        },
        value: "",
      });
      return;
    }
    if (tool !== "pen" && tool !== "arrow" && tool !== "rectangle") return;
    gestureRef.current = { kind: "draw", tool, start: point, points: [point] };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const point = toPoint(event);
    if (gesture.tool === "pen") {
      gesture.points.push(point);
      setPreview({ id: "preview", kind: "pen", points: [...gesture.points] });
    } else if (gesture.tool === "arrow") {
      setPreview({ id: "preview", kind: "arrow", start: gesture.start, end: point });
    } else {
      setPreview({ id: "preview", kind: "rect", start: gesture.start, end: point });
    }
  };

  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = undefined;
    if (!gesture) return;
    const point = toPoint(event);
    const id = `mark_${randomIdToken()}`;
    const mark: AnnotationDraftMark = gesture.tool === "pen"
      ? { id, kind: "pen", points: [...gesture.points, point] }
      : gesture.tool === "arrow"
        ? { id, kind: "arrow", start: gesture.start, end: point }
        : { id, kind: "rect", start: gesture.start, end: point };
    if (visibleDrawMark(mark, mediaSize.width, mediaSize.height, visualScale)) {
      replaceMarks([...stateRef.current.present, mark]);
    }
    setPreview(undefined);
  };

  const renderedMarks = preview?.id === "preview"
    ? [...state.present, preview]
    : state.present;

  return (
    <div ref={containerRef} className="fixed-annotator" aria-label="Fixed media annotation area">
      <div className="fixed-media-frame" style={{ width: frameSize.width, height: frameSize.height }}>
        {loadError ? (
          <button type="button" className="fixed-media-error" onClick={() => setLoadAttempt((value) => value + 1)}>
            <strong>Media failed to load</strong><span>{loadError}</span><em>Reload</em>
          </button>
        ) : sourceUrl ? <img
          ref={imageRef}
          src={sourceUrl}
          crossOrigin="anonymous"
          draggable={false}
          alt={target.data.alt || "Image to annotate"}
          onLoad={(event) => setMediaSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={() => setLoadError("The image could not be decoded. Reload and try again")}
        /> : <span>Loading media…</span>}
        {sourceUrl && !loadError ? <svg
          ref={svgRef}
          viewBox={`0 0 ${mediaSize.width} ${mediaSize.height}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => { gestureRef.current = undefined; setPreview(undefined); }}
          aria-label="Annotation layer"
        >
          <defs>
            <marker id="draft-arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#FF4D4F" /></marker>
          </defs>
          {renderedMarks.map((mark) => {
            if (mark.kind === "pen") return <polyline key={mark.id} data-mark-id={mark.id} points={mark.points.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="#FF4D4F" strokeWidth={3 * visualScale} strokeLinecap="round" strokeLinejoin="round" />;
            if (mark.kind === "arrow") return <line key={mark.id} data-mark-id={mark.id} x1={mark.start.x} y1={mark.start.y} x2={mark.end.x} y2={mark.end.y} stroke="#FF4D4F" strokeWidth={3 * visualScale} markerEnd="url(#draft-arrow-head)" />;
            if (mark.kind === "rect") return <rect key={mark.id} data-mark-id={mark.id} x={Math.min(mark.start.x, mark.end.x)} y={Math.min(mark.start.y, mark.end.y)} width={Math.abs(mark.end.x - mark.start.x)} height={Math.abs(mark.end.y - mark.start.y)} fill="none" stroke="#FF4D4F" strokeWidth={3 * visualScale} />;
            if (mark.kind === "text") return <text key={mark.id} data-mark-id={mark.id} x={mark.point.x} y={mark.point.y} fill="#FF4D4F" fontSize={20 * visualScale} fontWeight="600">{mark.text}</text>;
            return <g key={mark.id} data-mark-id={mark.id} transform={`translate(${mark.point.x} ${mark.point.y}) scale(${visualScale})`}>
              <path d="M0 0 L-9 -15 L9 -15 Z" fill="#0AA7C2" />
              <circle cy="-23" r="16" fill="#0AA7C2" stroke="#FFFFFF" strokeWidth="3" />
              <text y="-22" textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize="16" fontWeight="700">{mark.number}</text>
            </g>;
          })}
        </svg> : null}
        {textEditor ? (
          <input
            autoFocus
            className="annotation-text-editor"
            style={{ left: `${textEditor.point.x / mediaSize.width * 100}%`, top: `${textEditor.point.y / mediaSize.height * 100}%` }}
            value={textEditor.value}
            onChange={(event) => setTextEditor((current) => current ? { ...current, value: event.target.value } : current)}
            onBlur={commitText}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setTextEditor(undefined);
            }}
            placeholder="Enter annotation text"
          />
        ) : null}
      </div>
    </div>
  );
});

FixedMediaAnnotator.displayName = "FixedMediaAnnotator";
