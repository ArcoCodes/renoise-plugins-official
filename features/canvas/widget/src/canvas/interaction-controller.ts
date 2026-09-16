import type { WhiteboardObject } from "../../../shared/document-schema.js";

export const WHITEBOARD_TOOLS = [
  "select",
  "hand",
  "pen",
  "arrow",
  "line",
  "rectangle",
  "ellipse",
  "text",
  "sticky",
  "pin",
  "eraser",
] as const;

export type WhiteboardTool = typeof WHITEBOARD_TOOLS[number];

const SOURCE_MEDIA_TYPES = new Set<WhiteboardObject["type"]>(["image", "video-card", "ai-image"]);

export function interactivityForTool(
  tool: WhiteboardTool,
  objectType: WhiteboardObject["type"] | undefined,
  locked = false,
) {
  if (locked) return { selectable: false, evented: false };
  if (tool === "select") return { selectable: true, evented: true };
  if (tool === "eraser") {
    return { selectable: false, evented: Boolean(objectType && !SOURCE_MEDIA_TYPES.has(objectType)) };
  }
  return { selectable: false, evented: false };
}

export function cursorForTool(tool: WhiteboardTool) {
  if (tool === "hand") return "grab";
  if (tool === "select") return "default";
  if (tool === "text" || tool === "sticky") return "text";
  if (tool === "eraser") return "not-allowed";
  return "crosshair";
}
