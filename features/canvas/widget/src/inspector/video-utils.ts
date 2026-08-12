export function formatTimecode(timeMs: number) {
  const safe = Math.max(0, Math.floor(timeMs));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const frames = Math.floor((safe % 1000) / 40);
  return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export function captureVideoFrame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error("当前视频帧尚未就绪");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建视频帧画布");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "seeked" | "loadeddata", timeoutMs = 10_000) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("视频读取超时"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      const detail = video.error?.message ? `：${video.error.message}` : "";
      reject(new Error(`当前宿主无法直接解码所选视频${detail}`));
    };
    video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
}

export type PreparedVideoFile = {
  posterDataUrl?: string;
  durationMs: number;
  width: number;
  height: number;
  browserDecodable: boolean;
  decodeFailure?: string;
};

export async function prepareVideoFile(file: File): Promise<PreparedVideoFile> {
  const source = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = source;
  try {
    await waitFor(video, "loadedmetadata");
    const durationMs = Number.isFinite(video.duration) ? Math.max(0, Math.round(video.duration * 1000)) : 0;
    if (video.duration > 0.08) {
      video.currentTime = Math.min(.2, video.duration / 2);
      await waitFor(video, "seeked");
    } else {
      await waitFor(video, "loadeddata");
    }
    let posterDataUrl: string | undefined;
    try {
      posterDataUrl = captureVideoFrame(video);
    } catch {
      // A missing poster is safe: Fabric renders an explicit video placeholder.
    }
    return {
      posterDataUrl,
      durationMs,
      width: video.videoWidth,
      height: video.videoHeight,
      browserDecodable: true,
    };
  } catch (caught) {
    return {
      durationMs: 0,
      width: 0,
      height: 0,
      browserDecodable: false,
      decodeFailure: caught instanceof Error ? caught.message : String(caught),
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(source);
  }
}
