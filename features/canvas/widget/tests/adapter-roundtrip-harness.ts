import { Canvas, FabricImage, Group } from "fabric";
import { WhiteboardDocumentSchema, type WhiteboardDocument, type WhiteboardObject } from "../../shared/document-schema.js";
import { documentFromCanvas, fabricObjectFromRecord, getMeta } from "../src/canvas/fabric-adapter.js";

declare global {
  interface Window {
    __roundTrip?: { source: WhiteboardDocument; first: WhiteboardDocument; reopened: WhiteboardDocument };
    __mediaLayout?: {
      image: { renderedWidth: number; renderedHeight: number; frameWidth: number; frameHeight: number };
      video: { renderedWidth: number; renderedHeight: number; frameWidth: number; frameHeight: number };
    };
  }
}

const now = "2026-07-30T00:00:00.000Z";
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==";
const base = (id: string, type: WhiteboardObject["type"], x: number, y: number, width: number, height: number, data: object, parentId: string | null = null) => ({
  id,
  type,
  parentId,
  transform: { x, y, width, height, rotation: type === "text" ? 7 : 0 },
  zIndex: x,
  locked: false,
  hidden: false,
  style: {},
  data,
  createdAt: now,
  updatedAt: now,
});

const source = WhiteboardDocumentSchema.parse({
  schemaVersion: 1,
  page: {
    id: "page_roundtrip",
    name: "DOM Round Trip",
    revision: 4,
    assets: {
      asset_image: { id: "asset_image", relativePath: "assets/image.png", mimeType: "image/png", sha256: "1".repeat(64), byteLength: 68, width: 2, height: 2, createdAt: now },
      asset_video: { id: "asset_video", relativePath: "assets/video.webm", mimeType: "video/webm", sha256: "2".repeat(64), byteLength: 128, createdAt: now },
      asset_poster: { id: "asset_poster", relativePath: "assets/poster.png", mimeType: "image/png", sha256: "3".repeat(64), byteLength: 68, width: 2, height: 2, createdAt: now },
    },
    annotations: [],
    objects: [
      base("object_image", "image", 20, 20, 160, 90, { assetId: "asset_image", alt: "frame", source: { kind: "file-picker" } }),
      base("object_video", "video-card", 200, 20, 240, 160, { assetId: "asset_video", posterAssetId: "asset_poster", durationMs: 12_345, fileName: "clip.webm", timeMs: 840 }),
      base("object_aiimg", "ai-image", 460, 20, 180, 140, { status: "generating", requestId: "request-1" }),
      base("object_text", "text", 20, 210, 180, 46, { text: "Renoise 文本", fontSize: 24, align: "center" }),
      base("object_sticky", "sticky", 220, 210, 190, 120, { text: "sticky note", color: "#F8F2D8" }),
      base("object_recta", "rect", 430, 210, 100, 80, {}),
      base("object_ellip", "ellipse", 550, 210, 110, 80, {}),
      base("object_linea", "line", 20, 360, 120, 40, { points: [{ x: 0, y: 0 }, { x: 120, y: 40 }] }),
      base("object_arrow", "arrow", 170, 360, 140, 50, { points: [{ x: 0, y: 0 }, { x: 140, y: 50 }] }),
      base("object_freeh", "freehand", 340, 350, 150, 70, { points: [{ x: 0, y: 20 }, { x: 40, y: 0 }, { x: 90, y: 60 }, { x: 150, y: 30 }], width: 5 }),
      base("object_group", "group", 520, 340, 180, 120, { childIds: ["object_childr", "object_childe"] }),
      base("object_childr", "rect", -70, -45, 70, 60, {}, "object_group"),
      base("object_childe", "ellipse", 15, -35, 65, 50, {}, "object_group"),
    ],
  },
});

async function hydrate(canvas: Canvas, document: WhiteboardDocument) {
  const records = [...document.page.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const record of records.filter(({ parentId }) => parentId === null)) {
    canvas.add(await fabricObjectFromRecord(record, async () => tinyPng, records, "light"));
  }
  canvas.requestRenderAll();
}

const firstCanvas = new Canvas(document.querySelector<HTMLCanvasElement>("#first")!, { width: 800, height: 600 });
await hydrate(firstCanvas, source);
const first = documentFromCanvas(firstCanvas, source);
firstCanvas.dispose();

const reopenedCanvas = new Canvas(document.querySelector<HTMLCanvasElement>("#reopened")!, { width: 800, height: 600 });
await hydrate(reopenedCanvas, first);
const reopened = documentFromCanvas(reopenedCanvas, first);
reopenedCanvas.requestRenderAll();

function mediaLayout(type: "image" | "video-card") {
  const frame = reopenedCanvas.getObjects().find((object) => getMeta(object)?.type === type);
  if (!(frame instanceof Group)) throw new Error(`Missing ${type} group`);
  const media = frame.getObjects().find((object) => object instanceof FabricImage);
  if (!(media instanceof FabricImage)) throw new Error(`Missing ${type} media`);
  return {
    renderedWidth: (media.width || 0) * Math.abs(media.scaleX || 1) * Math.abs(frame.scaleX || 1),
    renderedHeight: (media.height || 0) * Math.abs(media.scaleY || 1) * Math.abs(frame.scaleY || 1),
    frameWidth: (frame.width || 0) * Math.abs(frame.scaleX || 1),
    frameHeight: type === "video-card"
      ? ((frame.height || 0) - 52) * Math.abs(frame.scaleY || 1)
      : (frame.height || 0) * Math.abs(frame.scaleY || 1),
  };
}

window.__roundTrip = { source, first, reopened };
window.__mediaLayout = { image: mediaLayout("image"), video: mediaLayout("video-card") };
document.body.dataset.roundtripReady = "true";
