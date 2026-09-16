import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createEmptyDocument, type WhiteboardObject } from "../../shared/document-schema.js";
import { MediaInspector } from "../src/inspector/MediaInspector.js";
import "../src/styles/theme.css";

declare global {
  interface Window {
    __mediaSetBroken?: () => void;
  }
}

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
  for (let index = 0; index < 12; index += 1) {
    context.fillStyle = index % 2 ? "#E64B22" : "#202020";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#FFFFFF";
    context.font = "20px sans-serif";
    context.fillText(`R ${index}`, 52, 52);
    await new Promise((resolve) => setTimeout(resolve, 45));
  }
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });
  stream.getTracks().forEach((track) => track.stop());
  return URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
}

const videoUrl = await generatedWebm();
const nativeCreateObjectUrl = URL.createObjectURL.bind(URL);
const nativeRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = (blob) => {
  const value = nativeCreateObjectUrl(blob);
  document.body.dataset.inspectorUrlsCreated = String(Number(document.body.dataset.inspectorUrlsCreated ?? 0) + 1);
  return value;
};
URL.revokeObjectURL = (value) => {
  document.body.dataset.inspectorUrlsRevoked = String(Number(document.body.dataset.inspectorUrlsRevoked ?? 0) + 1);
  nativeRevokeObjectUrl(value);
};
const documentState = createEmptyDocument("page_media");
const now = new Date().toISOString();
type VideoCard = Extract<WhiteboardObject, { type: "video-card" }>;
const record: VideoCard = {
  id: "object_video",
  type: "video-card",
  parentId: null,
  transform: { x: 0, y: 0, width: 420, height: 288, rotation: 0 },
  zIndex: 0,
  locked: false,
  hidden: false,
  style: {},
  data: { assetId: "asset_video", durationMs: 800, fileName: "generated.webm", timeMs: 0 },
  createdAt: now,
  updatedAt: now,
};
documentState.page.objects.push(record);

function Harness() {
  const [broken, setBroken] = useState(false);
  window.__mediaSetBroken = () => setBroken(true);
  const selected: VideoCard = broken ? { ...record, id: "object_broken", data: { ...record.data, assetId: "asset_broken" } } : record;
  return (
    <main className="whiteboard-app light">
      <MediaInspector
        selected={selected}
        document={documentState}
        readAsset={async (assetId) => {
          if (assetId === "asset_broken") throw new Error("fixture decode failed");
          return videoUrl;
        }}
        readVideoAsset={async (assetId, _signal, onProgress) => {
          if (assetId === "asset_broken") throw new Error("fixture decode failed");
          const blob = await fetch(videoUrl).then((response) => response.blob());
          onProgress(blob.size, blob.size);
          return blob;
        }}
        onCancelTransfer={() => undefined}
        onClose={() => undefined}
        onImportVideo={(file) => { document.body.dataset.importedVideo = file.name; }}
        onCaptureFrame={(_video, dataUrl, timeMs) => {
          document.body.dataset.captured = dataUrl;
          document.body.dataset.captureTime = String(timeMs);
        }}
        onTimeCommit={(_video, timeMs) => { document.body.dataset.committedTime = String(timeMs); }}
      />
    </main>
  );
}

createRoot(document.querySelector("#root")!).render(<Harness />);
