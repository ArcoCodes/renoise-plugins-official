import { useRef } from "react";
import { createRoot } from "react-dom/client";
import type { WhiteboardObject } from "../../shared/document-schema.js";
import { VideoReviewStage, type VideoReviewStageHandle } from "../src/review/VideoReviewStage.js";
import { prepareVideoFile, type PreparedVideoFile } from "../src/inspector/video-utils.js";
import "../src/styles/theme.css";

async function generatedWebm() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const context = canvas.getContext("2d")!;
  const stream = canvas.captureStream(15);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
  recorder.start(50);
  for (let index = 0; index < 14; index += 1) {
    context.fillStyle = index % 2 ? "#E64B22" : "#202020";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await new Promise((resolve) => setTimeout(resolve, 45));
  }
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });
  stream.getTracks().forEach((track) => track.stop());
  return new Blob(chunks, { type: "video/webm" });
}

const videoBlob = await generatedWebm();
(window as typeof window & { __prepareVideoFile?: (file: File) => Promise<PreparedVideoFile> }).__prepareVideoFile = prepareVideoFile;
const now = new Date().toISOString();
type VideoCard = Extract<WhiteboardObject, { type: "video-card" }>;
const video: VideoCard = {
  id: "object_video",
  type: "video-card",
  parentId: null,
  transform: { x: 0, y: 0, width: 420, height: 288, rotation: 0 },
  zIndex: 0,
  locked: false,
  hidden: false,
  style: {},
  data: { assetId: "asset_video", durationMs: 900, fileName: "generated.webm", timeMs: 0 },
  createdAt: now,
  updatedAt: now,
};

function Harness() {
  const stage = useRef<VideoReviewStageHandle>(null);
  return (
    <main className="whiteboard-app focused-review-app light">
      <div className="review-stage">
        <VideoReviewStage
          ref={stage}
          video={video}
          readVideoAsset={async (_assetId, _signal, onProgress) => {
            onProgress(videoBlob.size, videoBlob.size);
            return videoBlob;
          }}
        />
      </div>
      <button type="button" onClick={() => {
        const startedAt = performance.now();
        void stage.current?.freezeCurrentFrame().then((frame) => {
          document.body.dataset.frozenImage = frame.dataUrl;
          document.body.dataset.frozenTime = String(frame.timeMs);
          document.body.dataset.freezeLatency = String(performance.now() - startedAt);
        });
      }}>使用标注工具</button>
    </main>
  );
}

createRoot(document.querySelector("#root")!).render(<Harness />);
