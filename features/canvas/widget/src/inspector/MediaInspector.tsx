import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Film, ImagePlus, Upload, X } from "lucide-react";
import type { WhiteboardDocument, WhiteboardObject } from "../../../shared/document-schema.js";
import { captureVideoFrame, formatTimecode } from "./video-utils.js";

type VideoCard = Extract<WhiteboardObject, { type: "video-card" }>;
type ImageRecord = Extract<WhiteboardObject, { type: "image" }>;

function sourceRecord(image: ImageRecord, document: WhiteboardDocument) {
  const source = image.data.source;
  return "relation" in source && source.relation === "revision-of" && typeof source.objectId === "string"
    ? document.page.objects.find((object): object is ImageRecord => object.id === source.objectId && object.type === "image")
    : undefined;
}

function RevisionCompare({ original, revision, readAsset }: {
  original: ImageRecord;
  revision: ImageRecord;
  readAsset: (assetId: string) => Promise<string>;
}) {
  const [position, setPosition] = useState(50);
  const [urls, setUrls] = useState<{ original?: string; revision?: string; error?: string }>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all([readAsset(original.data.assetId), readAsset(revision.data.assetId)])
      .then(([before, after]) => { if (!cancelled) setUrls({ original: before, revision: after }); })
      .catch((error) => { if (!cancelled) setUrls({ error: error instanceof Error ? error.message : String(error) }); });
    return () => { cancelled = true; };
  }, [original.data.assetId, revision.data.assetId, readAsset]);

  return (
    <section className="revision-compare" aria-label="Revision comparison">
      <div className="inspector-section-title">Revision comparison</div>
      {urls.error ? <p className="media-error">{urls.error}</p> : urls.original && urls.revision ? (
        <>
          <div className="compare-stage">
            <img src={urls.original} alt="Original version" />
            <div className="compare-revision" style={{ width: `${position}%` }}><img src={urls.revision} alt="Revised version" /></div>
            <span className="compare-divider" style={{ left: `${position}%` }} />
          </div>
          <input aria-label="Revision comparison position" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} />
          <div className="compare-labels"><span>Original</span><span>Revision</span></div>
        </>
      ) : <p className="media-muted">Loading comparison media…</p>}
    </section>
  );
}

export function MediaInspector({ selected, document, readAsset, readVideoAsset, transfer, onCancelTransfer, onClose, onImportVideo, onCaptureFrame, onTimeCommit }: {
  selected?: WhiteboardObject;
  document: WhiteboardDocument;
  readAsset: (assetId: string) => Promise<string>;
  readVideoAsset: (assetId: string, signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<Blob | string>;
  transfer?: { phase: "upload" | "read"; loaded: number; total: number };
  onCancelTransfer: () => void;
  onClose: () => void;
  onImportVideo: (file: File) => Promise<void> | void;
  onCaptureFrame: (video: VideoCard, dataUrl: string, timeMs: number) => Promise<void> | void;
  onTimeCommit: (video: VideoCard, timeMs: number) => Promise<void> | void;
}) {
  const video = selected?.type === "video-card" ? selected : undefined;
  const image = selected?.type === "image" ? selected : undefined;
  const original = useMemo(() => image ? sourceRecord(image, document) : undefined, [image, document]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCommit = useRef(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [timeMs, setTimeMs] = useState(video?.data.timeMs ?? 0);
  const [capturing, setCapturing] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [readProgress, setReadProgress] = useState<{ loaded: number; total: number }>();

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    const controller = new AbortController();
    setError("");
    setVideoUrl("");
    setReadProgress(undefined);
    setTimeMs(video?.data.timeMs ?? 0);
    if (video) {
      void readVideoAsset(video.data.assetId, controller.signal, (loaded, total) => {
        if (!cancelled) setReadProgress({ loaded, total });
      })
        .then((source) => {
          if (cancelled) return;
          if (typeof source === "string") setVideoUrl(source);
          else {
            objectUrl = URL.createObjectURL(source);
            setVideoUrl(objectUrl);
          }
          setReadProgress(undefined);
        })
        .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); });
    }
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [video?.id, video?.data.assetId, readVideoAsset]);

  const source = image?.data.source;
  const frameSource = source && "kind" in source && source.kind === "video-frame" ? source : undefined;

  return (
    <aside className="media-inspector" aria-label="Media inspector">
      <header>
        <span><Film />Media</span>
        <button onClick={onClose} aria-label="Close media inspector"><X /></button>
      </header>
      <input ref={inputRef} hidden type="file" accept="video/mp4,video/webm" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void onImportVideo(file);
        event.target.value = "";
      }} />
      <button className="media-import-button" disabled={transfer?.phase === "upload"} onClick={() => inputRef.current?.click()}><Upload />{transfer?.phase === "upload" ? "Uploading…" : "Import video"}</button>
      {transfer && (
        <div className="media-transfer" aria-label={transfer.phase === "upload" ? "Video upload progress" : "Video read progress"}>
          <progress max={Math.max(1, transfer.total)} value={transfer.loaded} />
          <span>{Math.round(transfer.loaded / Math.max(1, transfer.total) * 100)}%</span>
          <button onClick={onCancelTransfer}>Cancel</button>
        </div>
      )}
      {!selected && <p className="media-muted">Select a video card to play, seek, and capture a frame.</p>}

      {video && (
        <section className="video-section">
          <div className="inspector-section-title">{video.data.fileName}</div>
          {error ? <div className="video-error"><Film /><span>{error}</span><button onClick={() => inputRef.current?.click()}>Choose again</button></div> : videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                controls
                preload="metadata"
                poster={undefined}
                onLoadedMetadata={(event) => {
                  const element = event.currentTarget;
                  element.currentTime = Math.min(element.duration || 0, timeMs / 1000);
                }}
                onTimeUpdate={(event) => setTimeMs(Math.round(event.currentTarget.currentTime * 1000))}
                onSeeking={() => setSeeking(true)}
                onSeeked={(event) => {
                  const actualTimeMs = Math.round(event.currentTarget.currentTime * 1000);
                  setTimeMs(actualTimeMs);
                  setSeeking(false);
                  if (pendingCommit.current) {
                    pendingCommit.current = false;
                    void onTimeCommit(video, actualTimeMs);
                  }
                }}
                onError={() => setError("The video cannot be played. Re-import an MP4 or WebM file")}
              />
              <div className="timecode-row">
                <code aria-label="Current timecode">{formatTimecode(timeMs)}</code>
                <button
                  disabled={capturing || seeking}
                  onClick={() => {
                    if (!videoRef.current) return;
                    const actualTimeMs = Math.round(videoRef.current.currentTime * 1000);
                    setCapturing(true);
                    try {
                      const dataUrl = captureVideoFrame(videoRef.current);
                      void Promise.resolve(onCaptureFrame(video, dataUrl, actualTimeMs))
                        .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))
                        .finally(() => setCapturing(false));
                    } catch (caught) {
                      setCapturing(false);
                      setError(caught instanceof Error ? caught.message : String(caught));
                    }
                  }}
                >
                  <Camera />{capturing ? "Capturing…" : "Capture current frame"}
                </button>
              </div>
              <input
                aria-label="Video timeline"
                type="range"
                min="0"
                max={Math.max(1, video.data.durationMs)}
                step="40"
                value={Math.min(timeMs, Math.max(1, video.data.durationMs))}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTimeMs(next);
                  setSeeking(true);
                  if (videoRef.current) videoRef.current.currentTime = next / 1000;
                }}
                onPointerUp={() => {
                  const element = videoRef.current;
                  if (!element) return;
                  if (seeking || element.seeking) pendingCommit.current = true;
                  else void onTimeCommit(video, Math.round(element.currentTime * 1000));
                }}
                onKeyUp={() => {
                  const element = videoRef.current;
                  if (!element) return;
                  if (seeking || element.seeking) pendingCommit.current = true;
                  else void onTimeCommit(video, Math.round(element.currentTime * 1000));
                }}
              />
            </>
          ) : <p className="media-muted">{readProgress ? `Reading video… ${Math.round(readProgress.loaded / Math.max(1, readProgress.total) * 100)}%` : "Loading video…"}</p>}
        </section>
      )}

      {frameSource && (
        <section className="frame-provenance">
          <div className="inspector-section-title"><ImagePlus />Source video frame</div>
          <dl>
            <div><dt>Timecode</dt><dd>{formatTimecode(frameSource.timeMs)}</dd></div>
            <div><dt>Video asset</dt><dd>{frameSource.videoAssetId}</dd></div>
            <div><dt>Source checksum</dt><dd>{frameSource.videoSha256.slice(0, 12)}…</dd></div>
          </dl>
        </section>
      )}
      {image && original && <RevisionCompare original={original} revision={image} readAsset={readAsset} />}
    </aside>
  );
}
