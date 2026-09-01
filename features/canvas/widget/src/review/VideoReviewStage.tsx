import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Film } from "lucide-react";
import type { WhiteboardObject } from "../../../shared/document-schema.js";
import { captureVideoFrame, formatTimecode } from "../inspector/video-utils.js";

type VideoCard = Extract<WhiteboardObject, { type: "video-card" }>;

export type VideoReviewStageHandle = {
  freezeCurrentFrame: () => Promise<{
    dataUrl: string;
    timeMs: number;
    width: number;
    height: number;
  }>;
  pause: () => void;
};

async function waitForSeek(element: HTMLVideoElement) {
  if (!element.seeking) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video seek timed out. Try again"));
    }, 3_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      element.removeEventListener("seeked", done);
      element.removeEventListener("error", failed);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Video seek failed. Re-import the video")); };
    element.addEventListener("seeked", done, { once: true });
    element.addEventListener("error", failed, { once: true });
  });
}

export const VideoReviewStage = forwardRef<VideoReviewStageHandle, {
  video: VideoCard;
  readVideoAsset: (assetId: string, signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<Blob | string>;
}>(({ video, readVideoAsset }, forwardedRef) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [timeMs, setTimeMs] = useState(video.data.timeMs);
  const [progress, setProgress] = useState<{ loaded: number; total: number }>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    let cancelled = false;
    setSourceUrl("");
    setError("");
    setTimeMs(video.data.timeMs);
    void readVideoAsset(video.data.playbackAssetId ?? video.data.assetId, controller.signal, (loaded, total) => {
      if (!cancelled) setProgress({ loaded, total });
    }).then((source) => {
      if (cancelled) return;
      if (typeof source === "string") setSourceUrl(source);
      else {
        objectUrl = URL.createObjectURL(source);
        setSourceUrl(objectUrl);
      }
      setProgress(undefined);
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [readVideoAsset, video.data.assetId, video.data.playbackAssetId, video.data.timeMs, video.id]);

  useImperativeHandle(forwardedRef, () => ({
    pause: () => videoRef.current?.pause(),
    freezeCurrentFrame: async () => {
      const element = videoRef.current;
      if (!element || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        throw new Error("The current video frame is not ready yet");
      }
      element.pause();
      await waitForSeek(element);
      const frozenTimeMs = Math.max(0, Math.round(element.currentTime * 1_000));
      setTimeMs(frozenTimeMs);
      return {
        dataUrl: captureVideoFrame(element),
        timeMs: frozenTimeMs,
        width: element.videoWidth,
        height: element.videoHeight,
      };
    },
  }), []);

  return (
    <div className="native-video-stage" aria-label="Video frame preview">
      {error ? (
        <div className="stage-empty"><Film /><strong>Video cannot be played</strong><span>{error}</span></div>
      ) : sourceUrl ? (
        <>
          <video
            ref={videoRef}
            src={sourceUrl}
            controls
            crossOrigin={sourceUrl.startsWith("http") ? "anonymous" : undefined}
            preload="metadata"
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = Math.min(event.currentTarget.duration || 0, video.data.timeMs / 1_000);
            }}
            onTimeUpdate={(event) => setTimeMs(Math.round(event.currentTarget.currentTime * 1_000))}
            onError={(event) => {
              const detail = event.currentTarget.error?.message;
              setError(detail ? `Video playback failed: ${detail}` : "Video playback failed. Re-import it or retry compatibility processing");
            }}
          />
          <span className="stage-timecode" aria-label="Current video timecode">{formatTimecode(timeMs)}</span>
        </>
      ) : (
        <div className="stage-empty"><Film /><strong>Loading video</strong><span>{progress ? `${Math.round(progress.loaded / Math.max(1, progress.total) * 100)}%` : "Reading media…"}</span></div>
      )}
    </div>
  );
});

VideoReviewStage.displayName = "VideoReviewStage";
