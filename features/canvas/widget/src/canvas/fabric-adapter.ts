import {
  Ellipse,
  FabricImage,
  FabricObject,
  Circle,
  Group,
  IText,
  Line,
  Path,
  Rect,
  Textbox,
  Triangle,
  type Canvas,
} from "fabric";
import type { WhiteboardDocument, WhiteboardObject } from "../../../shared/document-schema.js";
import { FABRIC_THEME, type ThemeName } from "../../../shared/ui-helpers.js";

export type RenoiseMeta = {
  id: string;
  type: WhiteboardObject["type"];
  data: Record<string, unknown>;
  style: Record<string, unknown>;
  createdAt: string;
  parentId: string | null;
  locked?: boolean;
  sourceTransform?: WhiteboardObject["transform"];
};

export type FabricAssetSource = string | HTMLImageElement | HTMLCanvasElement;

async function fabricImageFromAsset(source: FabricAssetSource) {
  return typeof source === "string" ? FabricImage.fromURL(source) : new FabricImage(source);
}

export function getMeta(object: FabricObject): RenoiseMeta | undefined {
  return (object as FabricObject & { renoise?: RenoiseMeta }).renoise;
}

export function setMeta(object: FabricObject, meta: RenoiseMeta, theme: ThemeName = "light") {
  (object as FabricObject & { renoise?: RenoiseMeta }).renoise = meta;
  const palette = FABRIC_THEME[theme];
  object.set({
    borderColor: palette.controls,
    cornerColor: palette.controlFill,
    cornerStrokeColor: palette.controls,
    cornerSize: 10,
    transparentCorners: false,
    borderScaleFactor: 2,
  });
}

export function applyFabricTheme(canvas: Canvas, theme: ThemeName) {
  const palette = FABRIC_THEME[theme];
  const visit = (object: FabricObject) => {
    object.set({
      borderColor: palette.controls,
      cornerColor: palette.controlFill,
      cornerStrokeColor: palette.controls,
    });
    const meta = getMeta(object);
    if (meta?.type === "text") {
      const current = (object as IText).fill;
      if (!meta.style.fill || current === FABRIC_THEME.light.text || current === FABRIC_THEME.dark.text) {
        object.set({ fill: palette.text });
      }
    }
    if (object instanceof Group) {
      object.getObjects().forEach((child) => {
        if (meta?.type === "ai-image" && child instanceof Textbox) child.set({ fill: palette.mutedText });
        visit(child);
      });
    }
  };
  canvas.getObjects().forEach(visit);
  canvas.requestRenderAll();
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function common(record: WhiteboardObject) {
  return {
    left: record.transform.x,
    top: record.transform.y,
    width: record.transform.width,
    height: record.transform.height,
    angle: record.transform.rotation,
    visible: !record.hidden,
    selectable: !record.locked,
    evented: !record.locked,
    originX: "left" as const,
    originY: "top" as const,
  };
}

export async function fabricObjectFromRecord(
  record: WhiteboardObject,
  readAsset: (assetId: string) => Promise<FabricAssetSource>,
  records: readonly WhiteboardObject[] = [record],
  theme: ThemeName = "light",
): Promise<FabricObject> {
  const options = common(record);
  const style = record.style as Record<string, unknown>;
  let object: FabricObject;
  switch (record.type) {
    case "image": {
      const image = await fabricImageFromAsset(await readAsset(record.data.assetId));
      const naturalWidth = image.width || record.transform.width;
      const naturalHeight = image.height || record.transform.height;
      const scale = Math.min(record.transform.width / naturalWidth, record.transform.height / naturalHeight);
      const renderedWidth = naturalWidth * scale;
      const renderedHeight = naturalHeight * scale;
      image.set({
        left: (record.transform.width - renderedWidth) / 2,
        top: (record.transform.height - renderedHeight) / 2,
        scaleX: scale,
        scaleY: scale,
      });
      object = new Group([
        new Rect({ left: 0, top: 0, width: record.transform.width, height: record.transform.height, fill: "rgba(0,0,0,0)", strokeWidth: 0 }),
        image,
      ], options);
      break;
    }
    case "video-card": {
      const width = Math.max(1, record.transform.width);
      const height = Math.max(1, record.transform.height);
      const posterHeight = Math.max(80, height - 52);
      const children: FabricObject[] = [
        new Rect({ left: 0, top: 0, width, height, rx: 18, ry: 18, fill: "#202020", stroke: "rgba(255,255,255,.18)", strokeWidth: 1 }),
        new Rect({ left: 0, top: 0, width, height: posterHeight, rx: 18, ry: 18, fill: "#2A2A2A" }),
      ];
      if (record.data.posterAssetId) {
        try {
          const poster = await fabricImageFromAsset(await readAsset(record.data.posterAssetId));
          const naturalWidth = Math.max(1, poster.width);
          const naturalHeight = Math.max(1, poster.height);
          const scale = Math.min(width / naturalWidth, posterHeight / naturalHeight);
          const renderedWidth = naturalWidth * scale;
          const renderedHeight = naturalHeight * scale;
          poster.set({
            left: (width - renderedWidth) / 2,
            top: (posterHeight - renderedHeight) / 2,
            scaleX: scale,
            scaleY: scale,
            clipPath: new Rect({ left: 0, top: 0, width: naturalWidth, height: naturalHeight, originX: "left", originY: "top", rx: 18 / scale, ry: 18 / scale }),
          });
          children.push(poster);
        } catch {
          // The video card remains a safe non-media placeholder if its poster is unavailable.
        }
      }
      children.push(
        new Circle({ left: width / 2, top: posterHeight / 2, radius: 23, originX: "center", originY: "center", fill: "rgba(0,0,0,.62)", stroke: "rgba(255,255,255,.7)", strokeWidth: 1 }),
        new Triangle({ left: width / 2 + 2, top: posterHeight / 2, width: 16, height: 18, angle: 90, originX: "center", originY: "center", fill: "#FFFFFF" }),
        new Textbox(record.data.fileName, { left: 14, top: posterHeight + 12, width: Math.max(60, width - 90), fontSize: 14, fill: "#FFFFFF", fontFamily: "Roboto Flex, Noto Sans SC, sans-serif", evented: false, selectable: false }),
        new Textbox(formatDuration(record.data.durationMs), { left: width - 74, top: posterHeight + 12, width: 60, textAlign: "right", fontSize: 13, fill: "#B8B8B8", fontFamily: "Roboto Flex, Noto Sans SC, sans-serif", evented: false, selectable: false }),
      );
      object = new Group(children, options);
      break;
    }
    case "rect":
      object = new Rect({ ...options, rx: 16, ry: 16, fill: color(style.fill, "transparent"), stroke: color(style.stroke, "#E64B22"), strokeWidth: numeric(style.strokeWidth, 2) });
      break;
    case "ellipse":
      if (style.variant === "numbered-pin") {
        const number = Math.max(1, Math.round(numeric(style.number, 1)));
        const markerColor = color(style.fill, "#0AA7C2");
        object = new Group([
          new Triangle({ left: 17, top: 35, width: 15, height: 15, angle: 180, originX: "center", originY: "center", fill: markerColor }),
          new Circle({ left: 0, top: 0, radius: 17, fill: markerColor, stroke: "#FFFFFF", strokeWidth: 3 }),
          new Textbox(String(number), { left: 1, top: 7, width: 32, textAlign: "center", fontSize: 17, fontWeight: 700, fill: "#FFFFFF", fontFamily: "Roboto Flex, Noto Sans SC, sans-serif", selectable: false, evented: false }),
        ], options);
      } else {
        object = new Ellipse({ ...options, rx: record.transform.width / 2, ry: record.transform.height / 2, fill: color(style.fill, "transparent"), stroke: color(style.stroke, "#E64B22"), strokeWidth: numeric(style.strokeWidth, 2) });
      }
      break;
    case "text":
      object = new IText(record.data.text, { ...options, fontSize: record.data.fontSize, textAlign: record.data.align, fill: color(style.fill, "#2B2B2B"), fontFamily: "Roboto Flex, Noto Sans SC, sans-serif" });
      break;
    case "sticky":
      object = new Textbox(record.data.text, { ...options, fontSize: 16, fill: "#37352F", backgroundColor: record.data.color, padding: 18, fontFamily: "Roboto Flex, Noto Sans SC, sans-serif" });
      break;
    case "line": {
      const [a, b] = record.data.points;
      object = new Line([a.x, a.y, b.x, b.y], { ...options, stroke: color(style.stroke, "#E64B22"), strokeWidth: numeric(style.strokeWidth, 2), strokeLineCap: "round" });
      break;
    }
    case "arrow": {
      const [a, b] = record.data.points;
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
      object = new Group([
        new Line([a.x, a.y, b.x, b.y], { stroke: color(style.stroke, "#E64B22"), strokeWidth: numeric(style.strokeWidth, 2), strokeLineCap: "round" }),
        new Triangle({ left: b.x, top: b.y, width: 12, height: 14, fill: color(style.stroke, "#E64B22"), angle, originX: "center", originY: "center" }),
      ], options);
      break;
    }
    case "freehand":
      object = new Path(record.data.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "), {
        ...options,
        fill: "",
        stroke: color(style.stroke, "#E64B22"),
        strokeWidth: record.data.width,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
      break;
    case "group": {
      const childIds = new Set(record.data.childIds);
      const childRecords = records.filter((child) => child.parentId === record.id && childIds.has(child.id));
      const children = await Promise.all(childRecords.map((child) => fabricObjectFromRecord(child, readAsset, records, theme)));
      object = new Group(children, options);
      break;
    }
    case "ai-image": {
      const palette = FABRIC_THEME[theme];
      const labels = {
        empty: "AI image\n等待生成",
        generating: "AI image\n生成中…",
        ready: "AI image\n已就绪",
        error: "AI image\n生成失败 · 可重试",
      } as const;
      const stateColors = {
        empty: { fill: "rgba(230,75,34,.06)", stroke: "#E64B22" },
        generating: { fill: "rgba(230,75,34,.12)", stroke: "#E64B22" },
        ready: { fill: "rgba(39,166,118,.10)", stroke: "#27A676" },
        error: { fill: "rgba(201,55,55,.10)", stroke: "#C93737" },
      } as const;
      const state = stateColors[record.data.status];
      const width = Math.max(1, record.transform.width);
      const height = Math.max(1, record.transform.height);
      const children: FabricObject[] = [
        new Rect({ left: 0, top: 0, width, height, rx: 24, ry: 24, fill: state.fill, stroke: state.stroke, strokeWidth: 2, strokeDashArray: record.data.status === "ready" ? undefined : [8, 6] }),
      ];
      if (record.data.status === "ready" && record.data.assetId) {
        try {
          const image = await fabricImageFromAsset(await readAsset(record.data.assetId));
          const naturalWidth = Math.max(1, image.width);
          const naturalHeight = Math.max(1, image.height);
          const scale = Math.min(width / naturalWidth, height / naturalHeight);
          image.set({
            left: (width - naturalWidth * scale) / 2,
            top: (height - naturalHeight * scale) / 2,
            scaleX: scale,
            scaleY: scale,
          });
          children.push(image);
        } catch {
          // Keep the ready holder visible when the opaque asset is temporarily unavailable.
        }
      }
      children.push(new Textbox(labels[record.data.status], {
        left: 20,
        top: Math.max(20, height / 2 - 24),
        width: Math.max(80, width - 40),
        textAlign: "center",
        fontSize: 15,
        lineHeight: 1.35,
        fill: palette.mutedText,
        fontFamily: "Roboto Flex, Noto Sans SC, sans-serif",
        evented: false,
        selectable: false,
      }));
      object = new Group(children, options);
      break;
    }
  }
  if (!object) throw new Error(`Unsupported whiteboard object ${(record as { type: string }).type}`);
  object.set({
    left: record.transform.x,
    top: record.transform.y,
    angle: record.transform.rotation,
    scaleX: record.transform.width / Math.max(1, object.width || record.transform.width),
    scaleY: record.transform.height / Math.max(1, object.height || record.transform.height),
  });
  setMeta(object, {
    id: record.id,
    type: record.type,
    data: record.data as Record<string, unknown>,
    style: record.style,
    createdAt: record.createdAt,
    parentId: record.parentId,
    locked: record.locked,
    sourceTransform: structuredClone(record.transform),
  }, theme);
  return object;
}

export function fabricAssetPlaceholderFromRecord(record: WhiteboardObject, theme: ThemeName = "light") {
  const palette = FABRIC_THEME[theme];
  const object = new Rect({
    ...common(record),
    fill: "rgba(230,75,34,.06)",
    stroke: "#E64B22",
    strokeWidth: 2,
    strokeDashArray: [10, 8],
    rx: 18,
    ry: 18,
  });
  setMeta(object, {
    id: record.id,
    type: record.type,
    data: record.data as Record<string, unknown>,
    style: record.style,
    createdAt: record.createdAt,
    parentId: record.parentId,
    locked: record.locked,
    sourceTransform: structuredClone(record.transform),
  }, theme);
  object.set({
    borderColor: palette.controls,
    cornerColor: palette.controlFill,
    cornerStrokeColor: palette.controls,
  });
  return object;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function recordFromFabricObject(object: FabricObject, zIndex = 0, parentId?: string | null): WhiteboardObject | null {
  const meta = getMeta(object);
  if (!meta) return null;
  const now = new Date().toISOString();
  const width = Math.max(1, (object.width || 1) * Math.abs(object.scaleX || 1));
  const height = Math.max(1, (object.height || 1) * Math.abs(object.scaleY || 1));
  const data = meta.type === "text" || meta.type === "sticky"
    ? { ...meta.data, text: (object as IText).text ?? String(meta.data.text ?? "") }
    : meta.type === "group" && object instanceof Group
      ? { childIds: object.getObjects().map((child) => getMeta(child)?.id).filter((id): id is string => Boolean(id)) }
      : meta.data;
  const preservedTransform = (parentId ?? meta.parentId) !== null ? meta.sourceTransform : undefined;
  return {
    id: meta.id,
    type: meta.type,
    parentId: parentId === undefined ? meta.parentId : parentId,
    transform: preservedTransform ?? {
      x: object.left ?? 0,
      y: object.top ?? 0,
      width,
      height,
      rotation: object.angle ?? 0,
    },
    zIndex,
    locked: meta.locked ?? false,
    hidden: !object.visible,
    data,
    style: meta.style,
    createdAt: meta.createdAt,
    updatedAt: now,
  } as WhiteboardObject;
}

export function recordsFromFabricObject(object: FabricObject, zIndex = 0, parentId: string | null = null): WhiteboardObject[] {
  const record = recordFromFabricObject(object, zIndex, parentId);
  if (!record) return [];
  if (!(object instanceof Group) || record.type !== "group") return [record];
  const children = object.getObjects().flatMap((child, childIndex) => {
    const childMeta = getMeta(child);
    if (childMeta) childMeta.parentId = record.id;
    return recordsFromFabricObject(child, childIndex, record.id);
  });
  return [record, ...children];
}

export function documentFromCanvas(canvas: Canvas, document: WhiteboardDocument): WhiteboardDocument {
  const next = structuredClone(document);
  next.page.objects = canvas.getObjects().flatMap((object, zIndex) => recordsFromFabricObject(object, zIndex));
  return next;
}
