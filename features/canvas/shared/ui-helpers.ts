import type { AnnotationRecord, WhiteboardDocument } from "./document-schema.js";

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);

export function selectedMediaKind(file: { name: string; type: string }): "image" | "video" | undefined {
  const mimeType = file.type.toLowerCase().split(";", 1)[0];
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.has(mimeType)) return "video";
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if ((!mimeType || mimeType === "application/octet-stream") && IMAGE_EXTENSIONS.has(extension)) return "image";
  if ((!mimeType || mimeType === "application/octet-stream") && VIDEO_EXTENSIONS.has(extension)) return "video";
  return undefined;
}

export type Camera = { x: number; y: number; zoom: number };
export type ThemeName = "light" | "dark";

export const FABRIC_THEME = {
  light: {
    controls: "#141414",
    controlFill: "#FFFFFF",
    text: "#2B2B2B",
    mutedText: "#6F6F6F",
  },
  dark: {
    controls: "#FFFFFF",
    controlFill: "#303030",
    text: "#FFFFFF",
    mutedText: "#B8B8B8",
  },
} as const;

export function cameraToViewportTransform(camera: Camera): [number, number, number, number, number, number] {
  return [camera.zoom, 0, 0, camera.zoom, camera.x, camera.y];
}

export function viewportTransformToCamera(transform: readonly number[], zoom: number): Camera {
  return { x: transform[4] ?? 0, y: transform[5] ?? 0, zoom };
}

export function recoverCameraForTarget(
  camera: Camera,
  viewport: { width: number; height: number },
  bounds: { left: number; top: number; width: number; height: number },
  padding = 80,
): Camera {
  const values = [camera.x, camera.y, camera.zoom, viewport.width, viewport.height,
    bounds.left, bounds.top, bounds.width, bounds.height];
  if (!values.every(Number.isFinite) || camera.zoom <= 0 || viewport.width < 160 || viewport.height < 160
    || bounds.width <= 0 || bounds.height <= 0) return camera;

  const screenLeft = bounds.left * camera.zoom + camera.x;
  const screenTop = bounds.top * camera.zoom + camera.y;
  const screenWidth = bounds.width * camera.zoom;
  const screenHeight = bounds.height * camera.zoom;
  const visibleWidth = Math.max(0, Math.min(viewport.width, screenLeft + screenWidth) - Math.max(0, screenLeft));
  const visibleHeight = Math.max(0, Math.min(viewport.height, screenTop + screenHeight) - Math.max(0, screenTop));
  const usable = screenWidth >= 48 && screenHeight >= 48
    && visibleWidth >= Math.min(48, screenWidth * .4)
    && visibleHeight >= Math.min(48, screenHeight * .4);
  if (usable) return camera;

  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = Math.min(2, availableWidth / bounds.width, availableHeight / bounds.height);
  return {
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.left * zoom,
    y: (viewport.height - bounds.height * zoom) / 2 - bounds.top * zoom,
    zoom,
  };
}

/** Always fit one immutable review target to the available editor viewport. */
export function fitCameraForTarget(
  viewport: { width: number; height: number },
  bounds: { left: number; top: number; width: number; height: number },
  padding = 0,
): Camera {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = Math.max(.05, Math.min(8, availableWidth / bounds.width, availableHeight / bounds.height));
  return {
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.left * zoom,
    y: (viewport.height - bounds.height * zoom) / 2 - bounds.top * zoom,
    zoom,
  };
}

export function fitMediaSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (![sourceWidth, sourceHeight, maxWidth, maxHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Media dimensions must be finite positive numbers");
  }
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function constrainDrag(
  start: { x: number; y: number },
  point: { x: number; y: number },
  mode: "line" | "shape",
  constrained: boolean,
) {
  if (!constrained) return point;
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (mode === "shape") {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + Math.sign(dx || 1) * size, y: start.y + Math.sign(dy || 1) * size };
  }
  const length = Math.hypot(dx, dy);
  if (!length) return point;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}

export function linkedMarkIds(annotations: AnnotationRecord[], targetObjectIds: readonly string[]) {
  const targets = new Set(targetObjectIds);
  return [...new Set(annotations.flatMap((annotation) =>
    annotation.targetObjectIds.some((id) => targets.has(id)) ? annotation.markObjectIds : []))];
}

function objectClosure(document: WhiteboardDocument, seedIds: ReadonlySet<string>) {
  const ids = new Set(seedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const object of document.page.objects) {
      const belongsToIncludedParent = object.parentId !== null && ids.has(object.parentId);
      const includesChild = object.type === "group" && object.data.childIds.some((id) => ids.has(id));
      if ((ids.has(object.id) || belongsToIncludedParent || includesChild) && !ids.has(object.id)) {
        ids.add(object.id);
        changed = true;
      }
      if (object.type === "group" && ids.has(object.id)) {
        for (const childId of object.data.childIds) {
          if (!ids.has(childId)) {
            ids.add(childId);
            changed = true;
          }
        }
      }
    }
  }
  return ids;
}

/** Build the small, editable scene for one review target without changing schema v1. */
export function focusedDocumentForTarget(document: WhiteboardDocument, targetId: string): WhiteboardDocument {
  const annotations = document.page.annotations.filter(({ targetObjectIds }) => targetObjectIds.includes(targetId));
  const ids = objectClosure(document, new Set([
    targetId,
    ...annotations.flatMap(({ markObjectIds }) => markObjectIds),
  ]));
  const next = structuredClone(document);
  next.page.objects = next.page.objects.filter(({ id }) => ids.has(id));
  next.page.annotations = annotations;
  return next;
}

/** Merge an edited focused scene back into the full project without dropping unrelated media. */
export function mergeFocusedScene(
  document: WhiteboardDocument,
  targetId: string,
  focused: WhiteboardDocument,
): WhiteboardDocument {
  const originalFocusedIds = new Set(focusedDocumentForTarget(document, targetId).page.objects.map(({ id }) => id));
  const next = structuredClone(document);
  const originalById = new Map(document.page.objects.map((object) => [object.id, object]));
  const originalTarget = originalById.get(targetId);
  const focusedTargetSource = focused.page.objects.find(({ id }) => id === targetId)
    ?? originalTarget;
  const focusedTarget = focusedTargetSource ? structuredClone(focusedTargetSource) : undefined;
  if (focusedTarget && originalTarget) focusedTarget.zIndex = originalTarget.zIndex;
  let nextZIndex = Math.max(-1, ...document.page.objects.map(({ zIndex }) => zIndex)) + 1;
  const editedObjects = focused.page.objects
    .filter(({ id }) => id !== targetId)
    .map((object) => {
      const existing = originalById.get(object.id);
      return { ...object, zIndex: existing?.zIndex ?? nextZIndex++ };
    });
  next.page.objects = [
    ...next.page.objects.filter(({ id }) => !originalFocusedIds.has(id)),
    ...(focusedTarget ? [structuredClone(focusedTarget)] : []),
    ...structuredClone(editedObjects),
  ];
  next.page.annotations = [
    ...next.page.annotations.filter(({ targetObjectIds }) => !targetObjectIds.includes(targetId)),
    ...structuredClone(focused.page.annotations.filter(({ targetObjectIds }) => targetObjectIds.includes(targetId))),
  ];
  next.page.assets = structuredClone(document.page.assets);
  next.page.revision = document.page.revision;
  return next;
}

export function annotationIdsForObjects(annotations: AnnotationRecord[], objectIds: readonly string[]) {
  const selected = new Set(objectIds);
  return annotations
    .filter(({ targetObjectIds, markObjectIds }) =>
      [...targetObjectIds, ...markObjectIds].some((id) => selected.has(id)))
    .map(({ id }) => id);
}

export function reviewTargetIds(document: WhiteboardDocument) {
  return document.page.objects
    .filter(({ type }) => type === "image" || type === "video-card")
    .map(({ id }) => id);
}

export function resolveEffectiveTargetId(
  document: WhiteboardDocument,
  selectedObjectIds: readonly string[],
  currentTargetId?: string,
) {
  const validTargets = new Set(reviewTargetIds(document));
  const selected = new Set(selectedObjectIds);
  const directTargets = selectedObjectIds.filter((id) => validTargets.has(id));
  if (directTargets.length) {
    return currentTargetId && directTargets.includes(currentTargetId) ? currentTargetId : directTargets[0];
  }
  const linkedTargets = [...new Set(document.page.annotations
    .filter(({ markObjectIds }) => markObjectIds.some((id) => selected.has(id)))
    .flatMap(({ targetObjectIds }) => targetObjectIds)
    .filter((id) => validTargets.has(id)))];
  if (linkedTargets.length) {
    return currentTargetId && linkedTargets.includes(currentTargetId) ? currentTargetId : linkedTargets[0];
  }
  return currentTargetId && validTargets.has(currentTargetId) ? currentTargetId : undefined;
}

export function defaultReviewTargetId(document: WhiteboardDocument, currentTargetId?: string) {
  const targets = reviewTargetIds(document);
  if (currentTargetId && targets.includes(currentTargetId)) return currentTargetId;
  return targets.at(-1);
}

export function unlinkAnnotations(document: WhiteboardDocument, objectIds: readonly string[]) {
  const ids = new Set(annotationIdsForObjects(document.page.annotations, objectIds));
  if (!ids.size) return document;
  const next = structuredClone(document);
  next.page.annotations = next.page.annotations.filter(({ id }) => !ids.has(id));
  return next;
}

export class MutationScheduler {
  #depth = 0;
  #pending = false;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly flush: () => void,
    private readonly normalDelay = 80,
    private readonly textDelay = 260,
  ) {}

  transaction(action: () => void) {
    this.#depth += 1;
    try {
      action();
    } finally {
      this.#depth -= 1;
      if (this.#depth === 0 && this.#pending) this.schedule();
    }
  }

  suppress(action: () => void) {
    const pendingBefore = this.#pending;
    this.#depth += 1;
    try {
      action();
    } finally {
      this.#depth -= 1;
      this.#pending = pendingBefore;
      if (this.#depth === 0 && pendingBefore) this.schedule();
    }
  }

  schedule(kind: "normal" | "text" = "normal") {
    this.#pending = true;
    if (this.#depth > 0) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (!this.#pending) return;
      this.#pending = false;
      this.flush();
    }, kind === "text" ? this.textDelay : this.normalDelay);
  }

  cancel() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#pending = false;
  }
}
