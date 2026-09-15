import {
  forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle,
  useLayoutEffect, useRef, useState,
} from "react";
import { Film, Pause, Play } from "lucide-react";
import type { WhiteboardObject } from "../../../shared/document-schema.js";
import type { AnnotationStageExportTarget } from "../frame-annotator/AnnotationStage.js";
import type { AnnotationShape, AnnotationTool } from "../frame-annotator/annotation-types.js";
import { useAnnotationStack } from "../frame-annotator/use-annotation-stack.js";
import { formatTimecode } from "../inspector/video-utils.js";

const AnnotationStage = lazy(() => import("../frame-annotator/AnnotationStage.js"));
const MAX_EXPORT_EDGE = 4096;
const MAX_EXPORT_PIXELS = 16_777_216;
const MAX_EXPORT_BYTES = 19 * 1024 * 1024;
type MediaTarget = Extract<WhiteboardObject, { type: "image" | "video-card" }>;

export type ReshootMediaStageSnapshot = {
  blob: Blob;
  width: number;
  height: number;
  coordinateSize: { width: number; height: number };
  shapes: AnnotationShape[];
  timeMs: number | null;
};

export type ReshootMediaStageHandle = {
  clear: () => void;
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  recolorSelected: (color: string) => boolean;
  deselect: () => void;
  pauseAtReadyFrame: () => Promise<number | null>;
  snapshot: () => Promise<ReshootMediaStageSnapshot>;
};

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForVideoFrame(video: HTMLVideoElement) {
  if (video.seeking) await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Video seek timed out. Try again")), 3_000);
    const complete = () => { window.clearTimeout(timer); video.removeEventListener("seeked", complete); resolve(); };
    video.addEventListener("seeked", complete, { once: true });
  });
}

function isVisibleShape(shape: AnnotationShape, width: number, height: number) {
  const minimum = Math.max(.01, Math.min(4, Math.min(width, height) * .02));
  const intersects = (left: number, top: number, right: number, bottom: number) =>
    right > 0 && bottom > 0 && left < width && top < height;
  const contains = (x: number, y: number) => x >= 0 && y >= 0 && x <= width && y <= height;
  if (shape.kind === "rect") return shape.width >= minimum && shape.height >= minimum && intersects(shape.x, shape.y, shape.x + shape.width, shape.y + shape.height);
  if (shape.kind === "arrow") return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) >= minimum && (contains(shape.x1, shape.y1) || contains(shape.x2, shape.y2) || intersects(Math.min(shape.x1, shape.x2), Math.min(shape.y1, shape.y2), Math.max(shape.x1, shape.x2), Math.max(shape.y1, shape.y2)));
  if (shape.kind === "stroke") {
    const xs = shape.points.filter((_, index) => index % 2 === 0).map((value) => value + shape.x);
    const ys = shape.points.filter((_, index) => index % 2 === 1).map((value) => value + shape.y);
    const length = Array.from({ length: Math.max(0, xs.length - 1) }, (_, index) => Math.hypot(xs[index + 1]! - xs[index]!, ys[index + 1]! - ys[index]!)).reduce((sum, value) => sum + value, 0);
    return xs.length >= 2 && length >= minimum && xs.some((x, index) => contains(x, ys[index]!));
  }
  if (shape.kind === "text") return Boolean(shape.text.trim()) && intersects(shape.x, shape.y, shape.x + shape.text.length * shape.fontSize * .62, shape.y + shape.fontSize * 1.25);
  return intersects(shape.x - shape.radius, shape.y - shape.radius * 3.1, shape.x + shape.radius, shape.y);
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not generate the annotated PNG")),
    "image/png",
  ));
}

export const ReshootMediaStage = forwardRef<ReshootMediaStageHandle, {
  target: MediaTarget;
  activeTool: AnnotationTool | null;
  activeColor: string;
  resetKey: number;
  readImageAsset: (assetId: string) => Promise<string>;
  readVideoAsset: (assetId: string, signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<Blob | string>;
  onStateChange: (state: { markCount: number; canUndo: boolean; canRedo: boolean; selectedId: string | null; textEditing: boolean }) => void;
}>(({ target, activeTool, activeColor, resetKey, readImageAsset, readVideoAsset, onStateChange }, forwardedRef) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<AnnotationStageExportTarget | null>(null);
  const shapesRef = useRef<AnnotationShape[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [progress, setProgress] = useState<{ loaded: number; total: number }>();
  const [mediaSize, setMediaSize] = useState({ width: target.transform.width, height: target.transform.height });
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [timeMs, setTimeMs] = useState(target.type === "video-card" ? target.data.timeMs : 0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textEditing, setTextEditing] = useState(false);
  const stack = useAnnotationStack();
  const annotationMode = activeTool !== null || stack.shapes.length > 0;
  const playbackAssetId = target.type === "video-card" ? target.data.playbackAssetId ?? target.data.assetId : target.data.assetId;
  const longEdge = Math.max(mediaSize.width, mediaSize.height);
  const strokeWidth = Math.max(2, Math.round(longEdge / 320));
  const fontSize = Math.max(12, Math.round(longEdge / 32));
  const pinRadius = Math.max(14, longEdge * .022);
  shapesRef.current = stack.shapes;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    let cancelled = false;
    setSourceUrl("");
    setLoadError("");
    setProgress(undefined);
    setMediaSize({ width: target.transform.width, height: target.transform.height });
    if (target.type === "image") {
      void readImageAsset(target.data.assetId).then((url) => { if (!cancelled) setSourceUrl(url); })
        .catch((caught) => { if (!cancelled) setLoadError(caught instanceof Error ? caught.message : String(caught)); });
    } else {
      setTimeMs(target.data.timeMs);
      void readVideoAsset(playbackAssetId, controller.signal, (loaded, total) => {
        if (!cancelled) setProgress({ loaded, total });
      }).then((source) => {
        if (cancelled) return;
        if (typeof source === "string") setSourceUrl(source);
        else { objectUrl = URL.createObjectURL(source); setSourceUrl(objectUrl); }
        setProgress(undefined);
      }).catch((caught) => { if (!cancelled) setLoadError(caught instanceof Error ? caught.message : String(caught)); });
    }
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [playbackAssetId, readImageAsset, readVideoAsset, target.data.assetId, target.id, target.transform.height, target.transform.width, target.type]);

  useEffect(() => {
    stack.clear();
    setSelectedId(null);
    setTextEditing(false);
  // stack methods are stable; reset only when media/session changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, target.id]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const aspect = mediaSize.width / Math.max(1, mediaSize.height);
      setFrameSize(width / height > aspect ? { width: height * aspect, height } : { width, height: width / aspect });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [mediaSize.height, mediaSize.width]);

  useEffect(() => {
    onStateChange({ markCount: stack.shapes.length, canUndo: stack.canUndo, canRedo: stack.canRedo, selectedId, textEditing });
  }, [onStateChange, selectedId, stack.canRedo, stack.canUndo, stack.shapes.length, textEditing]);

  const pauseAtReadyFrame = useCallback(async () => {
    if (target.type !== "video-card") return null;
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error("The current video frame is not ready yet");
    video.pause();
    const value = Math.max(0, Math.round(video.currentTime * 1_000));
    setTimeMs(value);
    return value;
  }, [target.type]);

  useImperativeHandle(forwardedRef, () => ({
    clear: () => { stack.clear(); setSelectedId(null); },
    undo: () => { stack.undo(); setSelectedId(null); },
    redo: () => { stack.redo(); setSelectedId(null); },
    deleteSelected: () => {
      if (!selectedId) return;
      stack.commit(shapesRef.current.filter((shape) => shape.id !== selectedId), "delete");
      setSelectedId(null);
    },
    deselect: () => setSelectedId(null),
    recolorSelected: (color) => {
      if (!selectedId) return false;
      const next = shapesRef.current.map((shape) => shape.id === selectedId ? { ...shape, color } : shape);
      stack.commit(next, "recolor");
      return true;
    },
    pauseAtReadyFrame,
    snapshot: async () => {
      if (!shapesRef.current.length || !shapesRef.current.every((shape) => isVisibleShape(shape, mediaSize.width, mediaSize.height))) {
        throw new Error("Keep every annotation visibly inside the media before adding it to the prompt");
      }
      const element = target.type === "video-card" ? videoRef.current : imageRef.current;
      if (!element) throw new Error("The media is still loading. Try again shortly");
      if (target.type === "video-card") await pauseAtReadyFrame();
      if (target.type === "video-card") await waitForVideoFrame(videoRef.current!);
      setSelectedId(null);
      await nextFrame();
      await nextFrame();
      const nativeWidth = target.type === "video-card" ? videoRef.current?.videoWidth ?? 0 : imageRef.current?.naturalWidth ?? 0;
      const nativeHeight = target.type === "video-card" ? videoRef.current?.videoHeight ?? 0 : imageRef.current?.naturalHeight ?? 0;
      if (!nativeWidth || !nativeHeight) throw new Error("The media dimensions are unavailable");
      let boundedScale = Math.min(1, MAX_EXPORT_EDGE / nativeWidth, MAX_EXPORT_EDGE / nativeHeight, Math.sqrt(MAX_EXPORT_PIXELS / (nativeWidth * nativeHeight)));
      let blob: Blob | undefined;
      let canvas = document.createElement("canvas");
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const width = Math.max(1, Math.round(nativeWidth * boundedScale));
        const height = Math.max(1, Math.round(nativeHeight * boundedScale));
        const stage = stageRef.current;
        if (!stage) throw new Error("The annotation layer is not ready yet");
        const overlay = stage.toCanvas({ pixelRatio: width / Math.max(1, frameSize.width) });
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create the annotation snapshot");
        context.drawImage(element, 0, 0, width, height);
        if (overlay) context.drawImage(overlay, 0, 0, width, height);
        blob = await canvasToPngBlob(canvas);
        if (blob.size <= MAX_EXPORT_BYTES) break;
        boundedScale *= Math.min(.82, Math.sqrt(MAX_EXPORT_BYTES / blob.size) * .9);
      }
      if (!blob || blob.size > MAX_EXPORT_BYTES) throw new Error("The annotated image is still too large. Resize it and try again");
      return {
        blob, width: canvas.width, height: canvas.height,
        coordinateSize: { width: nativeWidth, height: nativeHeight },
        shapes: structuredClone(shapesRef.current),
        timeMs: target.type === "video-card" ? Math.max(0, Math.round(videoRef.current!.currentTime * 1_000)) : null,
      };
    },
  }), [frameSize.width, mediaSize.height, mediaSize.width, pauseAtReadyFrame, selectedId, stack, target.type]);

  return <div ref={containerRef} className="reshoot-media-stage" data-annotation-mode={annotationMode} aria-label="Media annotation area">
    {loadError ? <div className="stage-empty"><Film /><strong>Media cannot be displayed</strong><span>{loadError}</span></div> : sourceUrl ? <div className="reshoot-media-fit" style={{ width: frameSize.width, height: frameSize.height }}>
      {target.type === "image" ? <img ref={imageRef} src={sourceUrl} draggable={false} alt={target.data.alt || "Image to annotate"} onLoad={(event) => setMediaSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setLoadError("The image could not be decoded")} /> : <video ref={videoRef} src={sourceUrl} preload="metadata" crossOrigin={sourceUrl.startsWith("http") ? "anonymous" : undefined} onLoadedMetadata={(event) => {
        setMediaSize({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight });
        setDurationMs(Math.round((event.currentTarget.duration || 0) * 1_000));
        event.currentTarget.currentTime = Math.min(event.currentTarget.duration || 0, target.data.timeMs / 1_000);
      }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setTimeMs(Math.round(event.currentTarget.currentTime * 1_000))} onError={(event) => setLoadError(event.currentTarget.error?.message || "Video playback failed")} />}
      {annotationMode && mediaSize.width > 0 ? <Suspense fallback={null}><AnnotationStage shapes={stack.shapes} selectedId={selectedId} activeTool={activeTool} activeColor={activeColor} nativeWidth={mediaSize.width} nativeHeight={mediaSize.height} displayWidth={frameSize.width} displayHeight={frameSize.height} strokeWidth={strokeWidth} fontSize={fontSize} pinRadius={pinRadius} accentColor="#FF4D2E" onSelect={setSelectedId} onCommit={stack.commit} stageRef={stageRef} onTextEditingChange={setTextEditing} /></Suspense> : null}
      {target.type === "video-card" && !annotationMode ? <div className="reshoot-video-controls">
        <button type="button" aria-label={playing ? "Pause video" : "Play video"} onClick={() => { const video = videoRef.current; if (!video) return; if (video.paused) void video.play(); else video.pause(); }}>{playing ? <Pause /> : <Play />}</button>
        <input aria-label="Video position" type="range" min={0} max={Math.max(1, durationMs)} value={Math.min(timeMs, Math.max(1, durationMs))} onChange={(event) => { const video = videoRef.current; if (!video) return; video.currentTime = Number(event.currentTarget.value) / 1_000; setTimeMs(Number(event.currentTarget.value)); }} />
        <span>{formatTimecode(timeMs)} / {formatTimecode(durationMs)}</span>
      </div> : null}
      {target.type === "video-card" && annotationMode ? <span className="stage-timecode" aria-label="Current video timecode">{formatTimecode(timeMs)}</span> : null}
    </div> : <div className="stage-empty"><Film /><strong>Loading media</strong><span>{progress ? `${Math.round(progress.loaded / Math.max(1, progress.total) * 100)}%` : "Reading media…"}</span></div>}
  </div>;
});

ReshootMediaStage.displayName = "ReshootMediaStage";
