import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Canvas as FabricCanvas,
  Circle,
  Ellipse,
  FabricImage,
  FabricObject,
  Group,
  IText,
  Line,
  PencilBrush,
  Point,
  Path,
  Rect,
  Shadow,
  Textbox,
  Triangle,
  type TPointerEventInfo,
} from "fabric";
import type { AnnotationRecord, WhiteboardDocument, WhiteboardObject } from "../../../shared/document-schema.js";
import {
  FABRIC_THEME,
  MutationScheduler,
  cameraToViewportTransform,
  constrainDrag,
  fitCameraForTarget,
  linkedMarkIds,
  recoverCameraForTarget,
  viewportTransformToCamera,
  type Camera,
  type ThemeName,
} from "../../../shared/ui-helpers.js";
import {
  applyFabricTheme,
  fabricAssetPlaceholderFromRecord,
  fabricObjectFromRecord,
  getMeta,
  setMeta,
  type FabricAssetSource,
} from "./fabric-adapter.js";
import { cursorForTool, interactivityForTool, type WhiteboardTool } from "./interaction-controller.js";
import type { RecoveryDiagnosticEvent } from "../diagnostics/recovery-diagnostics.js";
import { randomIdToken } from "../random-id.js";

type Props = {
  document: WhiteboardDocument;
  annotations: AnnotationRecord[];
  camera: Camera;
  theme: ThemeName;
  tool: WhiteboardTool;
  temporaryHand: boolean;
  activeTargetId?: string;
  onToolComplete: (tool: WhiteboardTool) => void;
  onReady: (canvas: FabricCanvas) => void;
  onChanged: (canvas: FabricCanvas) => void;
  onSelection: (ids: string[]) => void;
  onViewChanged: (camera: Camera) => void;
  onSceneResume?: (reason: string) => void;
  onDiagnostic?: (event: RecoveryDiagnosticEvent) => void;
  readAsset: (assetId: string) => Promise<FabricAssetSource>;
  fixedMedia?: boolean;
};

const schedulers = new WeakMap<FabricCanvas, MutationScheduler>();
const noop = () => undefined;
export function targetOverlayGeometry(bounds: { left: number; top: number; width: number; height: number }) {
  return {
    left: bounds.left - 6,
    top: bounds.top - 6,
    width: bounds.width + 12,
    height: bounds.height + 12,
    originX: "left" as const,
    originY: "top" as const,
  };
}
type HydrationFailure = { objectId: string; label: string; message: string };
type HydrationState =
  | { phase: "idle"; pending: 0; failures: HydrationFailure[] }
  | { phase: "loading"; pending: number; failures: HydrationFailure[] }
  | { phase: "failed"; pending: 0; failures: HydrationFailure[] };

export type FabricMediaHealth = {
  total: number;
  ready: number;
  invalid: number;
  volatileCanvas: number;
};

export function inspectFabricMediaSources(objects: FabricObject[]): FabricMediaHealth {
  const health: FabricMediaHealth = { total: 0, ready: 0, invalid: 0, volatileCanvas: 0 };
  const visit = (object: FabricObject) => {
    if (object instanceof FabricImage) {
      health.total += 1;
      const source = object.getElement();
      if (source instanceof HTMLImageElement) {
        if (source.complete && source.naturalWidth > 0 && source.naturalHeight > 0) health.ready += 1;
        else health.invalid += 1;
      } else if (source instanceof HTMLCanvasElement) {
        const context = source.width > 0 && source.height > 0 ? source.getContext("2d") : null;
        const contextLost = context && "isContextLost" in context && typeof context.isContextLost === "function"
          ? context.isContextLost()
          : false;
        if (context && !contextLost) health.ready += 1;
        else if (contextLost) health.volatileCanvas += 1;
        else health.invalid += 1;
      } else {
        health.invalid += 1;
      }
    }
    if (object instanceof Group) object.getObjects().forEach(visit);
  };
  objects.forEach(visit);
  return health;
}

type ScenePlan = {
  key: string;
  records: WhiteboardObject[];
  roots: WhiteboardObject[];
  rootIds: string[];
  mediaSourceCount: number;
  hasMediaRecords: boolean;
};

export function isRootRecord(record: Pick<WhiteboardObject, "parentId">) {
  return record.parentId == null;
}

export function scenePlanForDocument(document: WhiteboardDocument): ScenePlan {
  const records = document.page.objects;
  const roots = records.filter(isRootRecord);
  const rootIds = roots.map(({ id }) => id).sort();
  const mediaSourceCount = records.reduce((count, record) => {
    if (record.type === "image") return count + 1;
    if (record.type === "video-card" && record.data.posterAssetId) return count + 1;
    if (record.type === "ai-image" && record.data.status === "ready" && record.data.assetId) return count + 1;
    return count;
  }, 0);
  const identity = records
    .map((record) => `${record.id}:${record.type}:${record.parentId ?? "root"}`)
    .sort()
    .join("|");
  return {
    key: `${document.page.id}@${document.page.revision}|${identity}`,
    records,
    roots,
    rootIds,
    mediaSourceCount,
    hasMediaRecords: records.some(({ type }) => type === "image" || type === "video-card" || type === "ai-image"),
  };
}

function viewportIsUsable(element: HTMLElement | null) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 160 && rect.height >= 160 && element.getClientRects().length > 0;
}

export function runFabricTransaction(canvas: FabricCanvas, action: () => void) {
  const scheduler = schedulers.get(canvas);
  if (scheduler) scheduler.transaction(action);
  else action();
}

const id = () => `obj_${randomIdToken()}`;
const timestamp = () => new Date().toISOString();

function attach(
  object: FabricObject,
  type: Parameters<typeof setMeta>[1]["type"],
  data: Record<string, unknown>,
  style: Record<string, unknown>,
  theme: ThemeName,
) {
  setMeta(object, { id: id(), type, data, style, createdAt: timestamp(), parentId: null, locked: false }, theme);
}

function findById(objects: FabricObject[], objectId: string): FabricObject | undefined {
  for (const object of objects) {
    if (getMeta(object)?.id === objectId) return object;
    if (object instanceof Group) {
      const child = findById(object.getObjects(), objectId);
      if (child) return child;
    }
  }
  return undefined;
}

const SOURCE_MEDIA_TYPES = new Set<WhiteboardObject["type"]>(["image", "video-card", "ai-image"]);

function applyToolInteractivity(object: FabricObject, tool: WhiteboardTool, fixedMedia = false) {
  const meta = getMeta(object);
  if (!meta) {
    object.set({ selectable: false, evented: false });
    return;
  }
  if (fixedMedia && SOURCE_MEDIA_TYPES.has(meta.type)) {
    object.set({ selectable: false, evented: false, lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true });
    return;
  }
  object.set(interactivityForTool(tool, meta?.type, meta?.locked));
}

function applyCanvasInteractivity(canvas: FabricCanvas, tool: WhiteboardTool, fixedMedia = false) {
  if (tool !== "select") canvas.discardActiveObject();
  canvas.getObjects().forEach((object) => applyToolInteractivity(object, tool, fixedMedia));
  canvas.requestRenderAll();
}

function cloneMetaTree(source: FabricObject, clone: FabricObject, theme: ThemeName, parentId: string | null = null) {
  const sourceMeta = getMeta(source);
  if (!sourceMeta) return;
  const nextId = id();
  setMeta(clone, { ...structuredClone(sourceMeta), id: nextId, parentId }, theme);
  if (source instanceof Group && clone instanceof Group) {
    source.getObjects().forEach((child, index) => cloneMetaTree(child, clone.getObjects()[index], theme, nextId));
    const meta = getMeta(clone);
    if (meta?.type === "group") meta.data = { childIds: clone.getObjects().map((child) => getMeta(child)?.id).filter(Boolean) };
  }
}

export function FabricViewport({
  document,
  annotations,
  camera,
  theme,
  tool,
  temporaryHand,
  activeTargetId,
  onToolComplete,
  onReady,
  onChanged,
  onSelection,
  onViewChanged,
  onSceneResume,
  onDiagnostic,
  readAsset,
  fixedMedia = false,
}: Props) {
  const scenePlan = scenePlanForDocument(document);
  const element = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const toolRef = useRef(tool);
  const handRef = useRef(temporaryHand);
  const activeTargetIdRef = useRef(activeTargetId);
  const themeRef = useRef(theme);
  const annotationsRef = useRef(annotations);
  const onChangedRef = useRef(onChanged);
  const onSelectionRef = useRef(onSelection);
  const onViewChangedRef = useRef(onViewChanged);
  const onToolCompleteRef = useRef(onToolComplete);
  const onSceneResumeRef = useRef(onSceneResume ?? noop);
  const onDiagnosticRef = useRef(onDiagnostic ?? noop);
  const targetOverlay = useRef<Rect | null>(null);
  const targetOverlayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncTargetOverlayRef = useRef<(pulse?: boolean) => void>(() => undefined);
  const creation = useRef<{ start: Point; object: FabricObject } | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const linkedMove = useRef<{
    target: FabricObject;
    targetLeft: number;
    targetTop: number;
    marks: Array<{ object: FabricObject; left: number; top: number }>;
  } | null>(null);
  const hydrating = useRef(false);
  const lastHydrationAttempt = useRef(-1);
  const hydrationStateRef = useRef<HydrationState>({ phase: "idle", pending: 0, failures: [] });
  const viewportWasUsable = useRef<boolean | undefined>(undefined);
  const viewportWasVisible = useRef<boolean | undefined>(undefined);
  const hasHydratedScene = useRef(false);
  const sceneNeedsResume = useRef(false);
  const hydrationDeferredForViewport = useRef(false);
  const scenePlanRef = useRef(scenePlan);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [hydrationState, setHydrationState] = useState<HydrationState>({
    phase: "idle",
    pending: 0,
    failures: [],
  });

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { handRef.current = temporaryHand; }, [temporaryHand]);
  useLayoutEffect(() => {
    activeTargetIdRef.current = activeTargetId;
    syncTargetOverlayRef.current(true);
  }, [activeTargetId]);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  useEffect(() => { onSelectionRef.current = onSelection; }, [onSelection]);
  useEffect(() => { onViewChangedRef.current = onViewChanged; }, [onViewChanged]);
  useEffect(() => { onToolCompleteRef.current = onToolComplete; }, [onToolComplete]);
  useEffect(() => { onSceneResumeRef.current = onSceneResume ?? noop; }, [onSceneResume]);
  useEffect(() => { onDiagnosticRef.current = onDiagnostic ?? noop; }, [onDiagnostic]);
  useEffect(() => { hydrationStateRef.current = hydrationState; }, [hydrationState]);
  useLayoutEffect(() => { scenePlanRef.current = scenePlan; }, [scenePlan.key]);

  useEffect(() => {
    if (!element.current || !wrapper.current) return;
    const canvas = new FabricCanvas(element.current, {
      selection: true,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true,
      backgroundColor: "transparent",
    });
    canvasRef.current = canvas;
    canvas.setViewportTransform(cameraToViewportTransform(camera));
    onDiagnosticRef.current({
      stage: "Canvas initialization",
      message: "Fabric canvas created. Waiting for scene recovery.",
      status: "info",
    });
    const scheduler = new MutationScheduler(() => {
      if (!hydrating.current) onChangedRef.current(canvas);
    });
    schedulers.set(canvas, scheduler);

    const removeTargetOverlay = () => {
      clearTimeout(targetOverlayTimer.current);
      targetOverlayTimer.current = undefined;
      const overlay = targetOverlay.current;
      targetOverlay.current = null;
      if (overlay && canvas.getObjects().includes(overlay)) scheduler.suppress(() => canvas.remove(overlay));
    };
    const syncTargetOverlay = (pulse = false) => {
      if (fixedMedia) {
        removeTargetOverlay();
        return;
      }
      const targetId = activeTargetIdRef.current;
      const target = targetId ? findById(canvas.getObjects(), targetId) : undefined;
      if (!target) {
        removeTargetOverlay();
        canvas.requestRenderAll();
        return;
      }
      const bounds = target.getBoundingRect();
      const geometry = targetOverlayGeometry(bounds);
      let overlay = targetOverlay.current;
      if (!overlay) {
        overlay = new Rect({
          ...geometry,
          rx: 8,
          ry: 8,
          fill: "rgba(230,75,34,.015)",
          stroke: "#E64B22",
          strokeWidth: 2,
          strokeUniform: true,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        targetOverlay.current = overlay;
        scheduler.suppress(() => canvas.add(overlay!));
      } else {
        overlay.set(geometry);
        overlay.setCoords();
      }
      clearTimeout(targetOverlayTimer.current);
      const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      overlay.set({
        shadow: new Shadow({
          color: "rgba(230,75,34,.42)",
          blur: pulse && !reducedMotion ? 24 : 8,
        }),
      });
      if (pulse && !reducedMotion) {
        targetOverlayTimer.current = setTimeout(() => {
          if (targetOverlay.current !== overlay) return;
          overlay.set({ shadow: new Shadow({ color: "rgba(230,75,34,.24)", blur: 8 }) });
          canvas.requestRenderAll();
        }, 220);
      }
      canvas.requestRenderAll();
    };
    syncTargetOverlayRef.current = syncTargetOverlay;

    const recoverTargetView = () => {
      const targetId = activeTargetIdRef.current;
      const target = targetId ? findById(canvas.getObjects(), targetId) : undefined;
      if (!target || !wrapper.current || !viewportIsUsable(wrapper.current)) return;
      const current = viewportTransformToCamera(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0], canvas.getZoom());
      const viewport = { width: wrapper.current.clientWidth, height: wrapper.current.clientHeight };
      const bounds = target.getBoundingRect();
      const next = fixedMedia
        ? fitCameraForTarget(viewport, bounds)
        : recoverCameraForTarget(current, viewport, bounds);
      if (next.x === current.x && next.y === current.y && next.zoom === current.zoom) return;
      canvas.setViewportTransform(cameraToViewportTransform(next));
      canvas.requestRenderAll();
      onViewChangedRef.current(next);
    };
    const retryHydration = (reason: string) => {
      onDiagnosticRef.current({
        stage: "Recovery trigger",
        message: reason,
        status: "info",
        detail: `viewport=${wrapper.current?.clientWidth ?? 0}×${wrapper.current?.clientHeight ?? 0}`,
      });
      onSceneResumeRef.current(reason);
      setHydrationAttempt((value) => value + 1);
    };
    const resume = (reason: string, force = false) => {
      if (!viewportIsUsable(wrapper.current)) {
        onDiagnosticRef.current({
          stage: "Recovery wait",
          message: `${reason} was received, but the canvas container is currently unavailable.`,
          status: "warning",
        });
        hydrationDeferredForViewport.current = true;
        return;
      }
      const wasVisible = viewportWasVisible.current;
      viewportWasVisible.current = true;
      recoverTargetView();
      if (force) {
        sceneNeedsResume.current = false;
        retryHydration(reason);
      } else if (wasVisible === false || sceneNeedsResume.current) {
        sceneNeedsResume.current = false;
        canvas.requestRenderAll();
      }
    };
    const visibilityChanged = () => {
      if (globalThis.document.visibilityState !== "visible") {
        viewportWasVisible.current = false;
        if (hasHydratedScene.current) sceneNeedsResume.current = true;
        return;
      }
      resume("Document visibility restored");
    };
    const resize = () => {
      if (!wrapper.current) return;
      const usable = viewportIsUsable(wrapper.current);
      const becameUsable = viewportWasUsable.current === false && usable;
      viewportWasUsable.current = usable;
      if (!usable) return;
      canvas.setDimensions({ width: wrapper.current.clientWidth, height: wrapper.current.clientHeight });
      canvas.requestRenderAll();
      if (fixedMedia) recoverTargetView();
      if (becameUsable) {
        recoverTargetView();
        if (hydrationDeferredForViewport.current) {
          hydrationDeferredForViewport.current = false;
          retryHydration("Canvas container regained valid dimensions");
        } else if (sceneNeedsResume.current) {
          sceneNeedsResume.current = false;
          canvas.requestRenderAll();
        }
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper.current);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting) && viewportIsUsable(wrapper.current);
      const becameVisible = viewportWasVisible.current === false && visible;
      viewportWasVisible.current = visible;
      if (!visible) {
        if (hasHydratedScene.current) sceneNeedsResume.current = true;
        return;
      }
      if (!becameVisible) return;
      recoverTargetView();
      if (hydrationDeferredForViewport.current) {
        hydrationDeferredForViewport.current = false;
        retryHydration("Canvas returned to the visible area");
      } else if (sceneNeedsResume.current) {
        sceneNeedsResume.current = false;
        canvas.requestRenderAll();
      }
    }, { threshold: 0.01 });
    visibilityObserver.observe(wrapper.current);
    const focus = () => resume("Window refocused");
    const pageShow = () => resume("Page restored through pageshow");
    let lastPointerActivity = performance.now();
    let lastInteractionRecovery = 0;
    const pointerActivity = () => {
      const now = performance.now();
      const idleFor = now - lastPointerActivity;
      lastPointerActivity = now;
      if (idleFor < 1_000 || now - lastInteractionRecovery < 1_500 || !hasHydratedScene.current || !scenePlanRef.current.hasMediaRecords) return;
      lastInteractionRecovery = now;
      recoverTargetView();
      canvas.requestRenderAll();
    };
    let lastFrame = performance.now();
    let lastFrameRecovery = 0;
    let animationFrame = 0;
    const frame = (now: number) => {
      const gap = now - lastFrame;
      lastFrame = now;
      if (gap > 1_000 && now - lastFrameRecovery > 1_500 && hasHydratedScene.current && scenePlanRef.current.hasMediaRecords) {
        lastFrameRecovery = now;
        canvas.requestRenderAll();
      }
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
    let lastIntegrityRecovery = 0;
    let integritySceneKey = "";
    let integrityRecoveryCount = 0;
    let integrityPauseReported = false;
    const integrityTimer = setInterval(() => {
      const plan = scenePlanRef.current;
      if (!viewportIsUsable(wrapper.current) || !plan.hasMediaRecords || hydrationStateRef.current.phase === "loading") return;
      const desired = plan.rootIds;
      const current = canvas.getObjects()
        .map((object) => getMeta(object)?.id)
        .filter((value): value is string => Boolean(value))
        .sort();
      const mediaHealth = inspectFabricMediaSources(canvas.getObjects());
      const desiredMedia = plan.mediaSourceCount;
      const objectsIntact = desired.length === current.length && desired.every((value, index) => value === current[index]);
      const mediaIntact = mediaHealth.ready >= desiredMedia
        && mediaHealth.invalid === 0
        && mediaHealth.volatileCanvas === 0;
      const intact = objectsIntact && mediaIntact;
      if (intact) {
        integritySceneKey = plan.key;
        integrityRecoveryCount = 0;
        integrityPauseReported = false;
        canvas.requestRenderAll();
        return;
      }
      if (integritySceneKey !== plan.key) {
        integritySceneKey = plan.key;
        integrityRecoveryCount = 0;
        integrityPauseReported = false;
      }
      const now = performance.now();
      if (now - lastIntegrityRecovery < 1_500) return;
      if (integrityRecoveryCount >= 2) {
        if (!integrityPauseReported) {
          integrityPauseReported = true;
          onDiagnosticRef.current({
            stage: "Scene integrity",
            message: "Automatic recovery failed twice for the same document revision. Automatic rebuilds were paused to protect the current canvas.",
            status: "error",
            detail: `scene=${plan.key}, roots=${desired.length}, media=${desiredMedia}`,
          });
        }
        return;
      }
      lastIntegrityRecovery = now;
      integrityRecoveryCount += 1;
      onDiagnosticRef.current({
        stage: "Scene integrity",
        message: objectsIntact
          ? `Objects remain, but their media sources cannot render: ${mediaHealth.ready}/${desiredMedia} image elements are available.`
          : `The annotation board records ${desired.length} root objects, but Fabric contains ${current.length}.`,
        status: "warning",
        detail: `scene=${plan.key}, mediaTotal=${mediaHealth.total}, invalid=${mediaHealth.invalid}, volatileCanvas=${mediaHealth.volatileCanvas}`,
      });
      resume(objectsIntact ? "Media pixel source invalid; recovering from project files" : "Scene object count mismatch; recovering automatically", true);
    }, 1_000);
    globalThis.addEventListener("focus", focus);
    globalThis.addEventListener("pageshow", pageShow);
    wrapper.current.addEventListener("pointermove", pointerActivity, { passive: true });
    wrapper.current.addEventListener("pointerdown", pointerActivity, { passive: true });
    globalThis.document.addEventListener("visibilitychange", visibilityChanged);
    resize();

    const selection = () => onSelectionRef.current(canvas.getActiveObjects()
      .map((object) => getMeta(object)?.id)
      .filter((value): value is string => Boolean(value)));
    canvas.on("object:modified", ({ target }) => {
      if (target && getMeta(target)?.id === activeTargetIdRef.current) syncTargetOverlay();
      scheduler.schedule();
    });
    canvas.on("object:added", ({ target }) => {
      if (target) applyToolInteractivity(target, handRef.current ? "hand" : toolRef.current, fixedMedia);
      if (target && getMeta(target)?.id === activeTargetIdRef.current) queueMicrotask(() => syncTargetOverlay(true));
      if (!creation.current && target && getMeta(target)) scheduler.schedule();
    });
    canvas.on("object:removed", ({ target }) => {
      if (target === targetOverlay.current) targetOverlay.current = null;
      if (target && getMeta(target)?.id === activeTargetIdRef.current) queueMicrotask(() => syncTargetOverlay());
      if (target && getMeta(target)) scheduler.schedule();
    });
    canvas.on("text:changed", () => scheduler.schedule("text"));
    canvas.on("text:editing:exited", ({ target }) => {
      if (!target) return;
      const activeTool = handRef.current ? "hand" : toolRef.current;
      if (!handRef.current && (activeTool === "text" || activeTool === "sticky")) {
        toolRef.current = "select";
        canvas.selection = true;
        applyCanvasInteractivity(canvas, "select", fixedMedia);
        canvas.setActiveObject(target);
        onToolCompleteRef.current("select");
      } else {
        applyToolInteractivity(target, activeTool, fixedMedia);
        if (activeTool !== "select") canvas.discardActiveObject();
      }
      scheduler.schedule("text");
    });
    canvas.on("selection:created", selection);
    canvas.on("selection:updated", selection);
    canvas.on("selection:cleared", () => onSelectionRef.current([]));
    canvas.on("object:moving", ({ target }) => {
      if (target && getMeta(target)?.id === activeTargetIdRef.current) syncTargetOverlay();
      const movement = linkedMove.current;
      if (!movement || movement.target !== target) return;
      const dx = (target.left ?? 0) - movement.targetLeft;
      const dy = (target.top ?? 0) - movement.targetTop;
      movement.marks.forEach(({ object, left, top }) => {
        object.set({ left: left + dx, top: top + dy });
        object.setCoords();
      });
      canvas.requestRenderAll();
    });
    canvas.on("object:scaling", ({ target }) => {
      if (target && getMeta(target)?.id === activeTargetIdRef.current) syncTargetOverlay();
    });
    canvas.on("object:rotating", ({ target }) => {
      if (target && getMeta(target)?.id === activeTargetIdRef.current) syncTargetOverlay();
    });
    canvas.on("path:created", ({ path }) => {
      const drawnPath = path as Path;
      scheduler.transaction(() => {
        const pathData = drawnPath.path?.flatMap((segment) =>
          segment[0] === "M" || segment[0] === "L" ? [{ x: Number(segment[1]), y: Number(segment[2]) }] : []) ?? [];
        attach(
          drawnPath,
          "freehand",
          { points: pathData.length > 1 ? pathData : [{ x: 0, y: 0 }, { x: drawnPath.width || 1, y: drawnPath.height || 1 }], width: 3 },
          { stroke: "#E64B22" },
          themeRef.current,
        );
        applyToolInteractivity(drawnPath, handRef.current ? "hand" : toolRef.current, fixedMedia);
        canvas.discardActiveObject();
        scheduler.schedule();
      });
    });

    const persistCamera = () => {
      const transform = canvas.viewportTransform;
      if (transform) onViewChangedRef.current(viewportTransformToCamera(transform, canvas.getZoom()));
    };

    const startLinkedMove = (target: FabricObject | undefined) => {
      const targetId = target ? getMeta(target)?.id : undefined;
      if (!target || !targetId) {
        linkedMove.current = null;
        return;
      }
      const markIds = linkedMarkIds(annotationsRef.current, [targetId]);
      linkedMove.current = {
        target,
        targetLeft: target.left ?? 0,
        targetTop: target.top ?? 0,
        marks: markIds
          .map((markId) => findById(canvas.getObjects(), markId))
          .filter((object): object is FabricObject => Boolean(object) && object !== target)
          .map((object) => ({ object, left: object.left ?? 0, top: object.top ?? 0 })),
      };
    };

    const mouseDown = (event: TPointerEventInfo) => {
      const activeTool = handRef.current ? "hand" : toolRef.current;
      const native = event.e as PointerEvent;
      if (activeTool === "hand") {
        if (fixedMedia) return;
        panning.current = { x: native.clientX, y: native.clientY };
        canvas.selection = false;
        canvas.setCursor("grabbing");
        return;
      }
      const target = event.target as FabricObject | undefined;
      if (activeTool === "select") {
        startLinkedMove(target);
        if (native.altKey && target) {
          void target.clone().then((clone) => {
            cloneMetaTree(target, clone, themeRef.current);
            clone.set({ left: target.left ?? 0, top: target.top ?? 0 });
            scheduler.transaction(() => {
              canvas.add(clone);
              canvas.setActiveObject(clone);
              scheduler.schedule();
            });
            startLinkedMove(clone);
          });
        }
        return;
      }
      if (activeTool === "pen") return;
      if (activeTool === "eraser") {
        const targetType = target ? getMeta(target)?.type : undefined;
        if (target && targetType && !SOURCE_MEDIA_TYPES.has(targetType)) scheduler.transaction(() => canvas.remove(target));
        return;
      }
      const start = canvas.getScenePoint(native);
      const base = {
        left: start.x,
        top: start.y,
        originX: "left" as const,
        originY: "top" as const,
        stroke: "#E64B22",
        strokeWidth: 2,
        fill: "transparent",
        selectable: false,
        evented: false,
      };
      if (activeTool === "text") {
        const fill = FABRIC_THEME[themeRef.current].text;
        const text = new IText("Enter text", { ...base, fill, strokeWidth: 0, fontSize: 20, fontFamily: "Roboto Flex, Noto Sans SC, sans-serif" });
        attach(text, "text", { text: "Enter text", fontSize: 20, align: "left" }, {}, themeRef.current);
        text.set({ selectable: true, evented: true });
        scheduler.transaction(() => {
          canvas.add(text);
          canvas.setActiveObject(text);
          scheduler.schedule("text");
        });
        text.enterEditing();
        return;
      }
      if (activeTool === "pin") {
        const markerNumber = canvas.getObjects().reduce((maximum, candidate) => {
          const value = getMeta(candidate)?.style.number;
          return typeof value === "number" ? Math.max(maximum, Math.round(value)) : maximum;
        }, 0) + 1;
        const markerColor = "#0AA7C2";
        const marker = new Group([
          new Triangle({ left: 17, top: 35, width: 15, height: 15, angle: 180, originX: "center", originY: "center", fill: markerColor }),
          new Circle({ left: 0, top: 0, radius: 17, fill: markerColor, stroke: "#FFFFFF", strokeWidth: 3 }),
          new Textbox(String(markerNumber), { left: 1, top: 7, width: 32, textAlign: "center", fontSize: 17, fontWeight: 700, fill: "#FFFFFF", fontFamily: "Roboto Flex, Noto Sans SC, sans-serif", selectable: false, evented: false }),
        ], { left: start.x - 17, top: start.y - 42, selectable: false, evented: false });
        attach(marker, "ellipse", {}, { variant: "numbered-pin", number: markerNumber, fill: markerColor }, themeRef.current);
        scheduler.transaction(() => {
          canvas.add(marker);
          toolRef.current = "select";
          applyCanvasInteractivity(canvas, "select", fixedMedia);
          canvas.setActiveObject(marker);
          scheduler.schedule();
        });
        onToolCompleteRef.current("select");
        return;
      }
      if (activeTool === "sticky") {
        const sticky = new Textbox("Add annotation note", {
          ...base,
          width: 220,
          height: 140,
          fill: "#37352F",
          strokeWidth: 0,
          backgroundColor: "#F8F2D8",
          padding: 18,
          fontSize: 16,
          fontFamily: "Roboto Flex, Noto Sans SC, sans-serif",
        });
        attach(sticky, "sticky", { text: "Add annotation note", color: "#F8F2D8" }, {}, themeRef.current);
        sticky.set({ selectable: true, evented: true });
        scheduler.transaction(() => {
          canvas.add(sticky);
          canvas.setActiveObject(sticky);
          scheduler.schedule("text");
        });
        sticky.enterEditing();
        return;
      }
      let object: FabricObject;
      if (activeTool === "rectangle") {
        object = new Rect({ ...base, width: 1, height: 1, rx: 16, ry: 16 });
        attach(object, "rect", {}, { stroke: "#E64B22", strokeWidth: 2, fill: "transparent" }, themeRef.current);
      } else if (activeTool === "ellipse") {
        object = new Ellipse({ ...base, rx: .5, ry: .5 });
        attach(object, "ellipse", {}, { stroke: "#E64B22", strokeWidth: 2, fill: "transparent" }, themeRef.current);
      } else {
        object = new Line([0, 0, 1, 1], {
          left: start.x,
          top: start.y,
          stroke: "#E64B22",
          strokeWidth: 3,
          strokeLineCap: "round",
          selectable: false,
          evented: false,
        });
        attach(object, activeTool === "arrow" ? "arrow" : "line", { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, { stroke: "#E64B22", strokeWidth: 3 }, themeRef.current);
      }
      creation.current = { start, object };
      canvas.add(object);
    };

    const mouseMove = (event: TPointerEventInfo) => {
      const native = event.e as PointerEvent;
      if (panning.current) {
        const transform = canvas.viewportTransform;
        if (transform) {
          transform[4] += native.clientX - panning.current.x;
          transform[5] += native.clientY - panning.current.y;
          panning.current = { x: native.clientX, y: native.clientY };
          canvas.requestRenderAll();
        }
        return;
      }
      if (!creation.current) return;
      const rawPoint = canvas.getScenePoint(native);
      const { start, object } = creation.current;
      const point = constrainDrag(start, rawPoint, object instanceof Line ? "line" : "shape", native.shiftKey);
      if (object instanceof Rect) {
        object.set({ left: Math.min(start.x, point.x), top: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) });
      } else if (object instanceof Ellipse) {
        object.set({ left: Math.min(start.x, point.x), top: Math.min(start.y, point.y), rx: Math.abs(point.x - start.x) / 2, ry: Math.abs(point.y - start.y) / 2 });
      } else if (object instanceof Line) {
        object.set({ x2: point.x - start.x, y2: point.y - start.y });
      }
      object.setCoords();
      canvas.requestRenderAll();
    };

    const finishPointer = () => {
      linkedMove.current = null;
      if (panning.current) {
        panning.current = null;
        canvas.selection = toolRef.current === "select";
        persistCamera();
      }
      if (!creation.current) return;
      const { object, start } = creation.current;
      creation.current = null;
      let completedObject = object;
      scheduler.transaction(() => {
        const meta = getMeta(object);
        if (object instanceof Line && meta) {
          const x1 = 0;
          const y1 = 0;
          const x2 = object.x2 ?? 0;
          const y2 = object.y2 ?? 0;
          meta.data = { points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
          if (meta.type === "arrow") {
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
            const line = new Line([x1, y1, x2, y2], { stroke: "#E64B22", strokeWidth: 3, strokeLineCap: "round" });
            const triangle = new Triangle({ left: x2, top: y2, width: 12, height: 14, fill: "#E64B22", angle, originX: "center", originY: "center" });
            const arrow = new Group([line, triangle], { left: start.x, top: start.y, selectable: false, evented: false });
            setMeta(arrow, meta, themeRef.current);
            canvas.remove(object);
            canvas.add(arrow);
            completedObject = arrow;
          } else {
            completedObject = object;
          }
        }
        if (!handRef.current) {
          toolRef.current = "select";
          canvas.selection = true;
          applyCanvasInteractivity(canvas, "select", fixedMedia);
          canvas.setActiveObject(completedObject);
        } else {
          applyToolInteractivity(completedObject, "hand", fixedMedia);
          canvas.discardActiveObject();
        }
        scheduler.schedule();
      });
      if (!handRef.current) onToolCompleteRef.current("select");
    };

    const cancelPointer = () => {
      linkedMove.current = null;
      if (panning.current) {
        panning.current = null;
        canvas.selection = toolRef.current === "select";
        persistCamera();
      }
      if (!creation.current) return;
      const object = creation.current.object;
      creation.current = null;
      scheduler.suppress(() => canvas.remove(object));
      canvas.requestRenderAll();
    };

    canvas.on("mouse:down", mouseDown);
    canvas.on("mouse:move", mouseMove);
    canvas.on("mouse:up", finishPointer);
    canvas.on("mouse:wheel", ({ e }) => {
      if (!viewportIsUsable(wrapper.current)) return;
      e.preventDefault();
      e.stopPropagation();
      if (fixedMedia) return;
      const zoom = Math.max(.05, Math.min(8, canvas.getZoom() * (0.999 ** e.deltaY)));
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
      canvas.requestRenderAll();
      persistCamera();
    });
    canvas.upperCanvasEl.addEventListener("pointercancel", cancelPointer);
    syncTargetOverlay(true);
    onReady(canvas);
    return () => {
      clearTimeout(targetOverlayTimer.current);
      syncTargetOverlayRef.current = () => undefined;
      scheduler.cancel();
      schedulers.delete(canvas);
      observer.disconnect();
      visibilityObserver.disconnect();
      cancelAnimationFrame(animationFrame);
      clearInterval(integrityTimer);
      globalThis.removeEventListener("focus", focus);
      globalThis.removeEventListener("pageshow", pageShow);
      wrapper.current?.removeEventListener("pointermove", pointerActivity);
      wrapper.current?.removeEventListener("pointerdown", pointerActivity);
      globalThis.document.removeEventListener("visibilitychange", visibilityChanged);
      canvas.upperCanvasEl.removeEventListener("pointercancel", cancelPointer);
      canvas.dispose();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const activeTool = temporaryHand ? "hand" : tool;
    canvas.isDrawingMode = activeTool === "pen";
    canvas.selection = activeTool === "select";
    applyCanvasInteractivity(canvas, activeTool, fixedMedia);
    canvas.defaultCursor = cursorForTool(activeTool);
    canvas.hoverCursor = activeTool === "select" && !fixedMedia ? "move" : cursorForTool(activeTool);
    if (canvas.isDrawingMode) {
      const brush = new PencilBrush(canvas);
      brush.color = "#E64B22";
      brush.width = 3 / canvas.getZoom();
      canvas.freeDrawingBrush = brush;
    }
  }, [fixedMedia, tool, temporaryHand]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) applyFabricTheme(canvas, theme);
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (fixedMedia) return;
    const current = viewportTransformToCamera(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0], canvas.getZoom());
    if (current.x !== camera.x || current.y !== camera.y || current.zoom !== camera.zoom) {
      canvas.setViewportTransform(cameraToViewportTransform(camera));
      canvas.requestRenderAll();
    }
  }, [camera.x, camera.y, camera.zoom, fixedMedia]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!viewportIsUsable(wrapper.current)) {
      hydrationDeferredForViewport.current = true;
      onDiagnosticRef.current({
        stage: "Scene recovery",
        message: "Canvas dimensions are not available yet. Media recovery has been queued.",
        status: "warning",
      });
      setHydrationState(document.page.objects.some(({ type }) => type === "image" || type === "video-card" || type === "ai-image")
        ? { phase: "loading", pending: 1, failures: [] }
        : { phase: "idle", pending: 0, failures: [] });
      return;
    }
    hydrationDeferredForViewport.current = false;
    const desiredRootIds = scenePlan.rootIds;
    const currentRootIds = canvas.getObjects()
      .map((object) => getMeta(object)?.id)
      .filter((id): id is string => Boolean(id))
      .sort();
    const forcedRetry = lastHydrationAttempt.current >= 0 && lastHydrationAttempt.current !== hydrationAttempt;
    lastHydrationAttempt.current = hydrationAttempt;
    if (!forcedRetry && desiredRootIds.length === currentRootIds.length
      && desiredRootIds.every((id, index) => id === currentRootIds[index])) {
      hasHydratedScene.current = true;
      onDiagnosticRef.current({
        stage: "Scene check",
        message: `${currentRootIds.length} Fabric root objects match the annotation-board record. No rebuild is required.`,
        status: "success",
        detail: `scene=${scenePlan.key}, media=${scenePlan.mediaSourceCount}`,
      });
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      hydrating.current = true;
      const scheduler = schedulers.get(canvas);
      scheduler?.suppress(() => canvas.clear());
      const records = [...scenePlan.records].sort((a, b) => a.zIndex - b.zIndex);
      const roots = records.filter(isRootRecord);
      const childrenByParent = new Map<string, typeof records>();
      for (const record of records) {
        if (!record.parentId) continue;
        const children = childrenByParent.get(record.parentId) ?? [];
        children.push(record);
        childrenByParent.set(record.parentId, children);
      }
      const needsAsset = (record: (typeof records)[number]): boolean => {
        if (record.type === "image") return true;
        if (record.type === "video-card") return Boolean(record.data.posterAssetId);
        if (record.type === "ai-image") return record.data.status === "ready" && Boolean(record.data.assetId);
        if (record.type === "group") return (childrenByParent.get(record.id) ?? []).some(needsAsset);
        return false;
      };
      const entries = roots.map((record, index) => ({ record, index }));
      const immediate = entries.filter(({ record }) => !needsAsset(record));
      const deferred = entries.filter(({ record }) => needsAsset(record));
      const failures: HydrationFailure[] = [];

      onDiagnosticRef.current({
        stage: "Scene recovery",
        message: `Rebuilding ${roots.length} root objects; ${deferred.length} require media assets.`,
        status: "info",
        detail: `attempt=${hydrationAttempt}, forced=${forcedRetry}, scene=${scenePlan.key}, media=${scenePlan.mediaSourceCount}`,
      });

      setHydrationState(deferred.length
        ? { phase: "loading", pending: deferred.length, failures: [] }
        : { phase: "idle", pending: 0, failures: [] });

      for (const { record, index } of immediate) {
        if (cancelled) break;
        try {
          const object = await fabricObjectFromRecord(record, readAsset, records, themeRef.current);
          scheduler?.suppress(() => canvas.insertAt(index, object));
        } catch (caught) {
          console.error("[Renoise whiteboard] object hydration failed", {
            pageId: document.page.id,
            objectId: record.id,
            error: caught,
          });
        }
      }
      canvas.requestRenderAll();
      // From this point on every programmatic insertion is individually suppressed,
      // so user edits to already-visible marks can be persisted while media is loading.
      hydrating.current = false;

      await Promise.all(deferred.map(async ({ record, index }) => {
        try {
          onDiagnosticRef.current({
            stage: "Asset mount",
            message: `Restoring ${record.type === "image" ? record.data.alt || "image" : "media asset"}.`,
            status: "info",
            detail: `object=${record.id}`,
          });
          const object = await fabricObjectFromRecord(record, readAsset, records, themeRef.current);
          if (!cancelled) scheduler?.suppress(() => canvas.insertAt(index, object));
          if (!cancelled) onDiagnosticRef.current({
            stage: "Asset mount",
            message: `${record.type === "image" ? record.data.alt || "Image" : "Media asset"} mounted in Fabric.`,
            status: "success",
            detail: `object=${record.id}`,
          });
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          failures.push({
            objectId: record.id,
            label: record.type === "image" ? record.data.alt || "Image" : "Media asset",
            message,
          });
          console.error("[Renoise whiteboard] asset hydration failed", {
            pageId: document.page.id,
            objectId: record.id,
            assetId: record.type === "image" ? record.data.assetId : undefined,
            error: caught,
          });
          onDiagnosticRef.current({
            stage: "Asset mount",
            message: `${record.type === "image" ? record.data.alt || "Image" : "Media asset"} failed to mount.`,
            status: "error",
            detail: message,
          });
          if (!cancelled) {
            const placeholder = fabricAssetPlaceholderFromRecord(record, themeRef.current);
            scheduler?.suppress(() => canvas.insertAt(index, placeholder));
          }
        } finally {
          if (!cancelled) {
            setHydrationState((current) => current.phase === "loading"
              ? { ...current, pending: Math.max(0, current.pending - 1) }
              : current);
            canvas.requestRenderAll();
          }
        }
      }));

      if (!cancelled) {
        hasHydratedScene.current = true;
        syncTargetOverlayRef.current(true);
        const targetId = activeTargetIdRef.current;
        const target = targetId ? findById(canvas.getObjects(), targetId) : undefined;
        if (target && wrapper.current) {
          const current = viewportTransformToCamera(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0], canvas.getZoom());
          const viewport = { width: wrapper.current.clientWidth, height: wrapper.current.clientHeight };
          const bounds = target.getBoundingRect();
          const next = fixedMedia
            ? fitCameraForTarget(viewport, bounds)
            : recoverCameraForTarget(current, viewport, bounds);
          if (next.x !== current.x || next.y !== current.y || next.zoom !== current.zoom) {
            canvas.setViewportTransform(cameraToViewportTransform(next));
            onViewChangedRef.current(next);
          }
        }
        canvas.requestRenderAll();
        const mediaHealth = inspectFabricMediaSources(canvas.getObjects());
        const expectedMedia = scenePlan.mediaSourceCount;
        if (mediaHealth.ready < expectedMedia || mediaHealth.invalid > 0 || mediaHealth.volatileCanvas > 0) {
          failures.push({
            objectId: document.page.id,
            label: "Media scene",
            message: `Only ${mediaHealth.ready}/${expectedMedia} image elements can render`,
          });
        }
        setHydrationState(failures.length
          ? { phase: "failed", pending: 0, failures }
          : { phase: "idle", pending: 0, failures: [] });
        onDiagnosticRef.current({
          stage: "Scene recovery",
          message: failures.length
            ? `Scene recovery completed with ${failures.length} failed media assets.`
            : `Scene recovery completed: ${canvas.getObjects().filter((object) => Boolean(getMeta(object))).length} root objects, ${mediaHealth.ready}/${expectedMedia} image elements can render.`,
          status: failures.length ? "error" : "success",
          detail: `scene=${scenePlan.key}, mediaTotal=${mediaHealth.total}, invalid=${mediaHealth.invalid}, volatileCanvas=${mediaHealth.volatileCanvas}`,
        });
      }
    };
    void hydrate().catch((caught) => {
      if (cancelled) return;
      hydrating.current = false;
      const failure = {
        objectId: document.page.id,
        label: "Canvas",
        message: caught instanceof Error ? caught.message : String(caught),
      };
      console.error("[Renoise whiteboard] scene hydration failed", caught);
      onDiagnosticRef.current({
        stage: "Scene recovery",
        message: "The scene recovery process ended unexpectedly.",
        status: "error",
        detail: failure.message,
      });
      hasHydratedScene.current = true;
      setHydrationState({ phase: "failed", pending: 0, failures: [failure] });
    });
    return () => {
      cancelled = true;
      hydrating.current = false;
    };
  }, [scenePlan.key, hydrationAttempt]);

  return (
    <div ref={wrapper} className="fabric-viewport" aria-label="Renoise annotation whiteboard canvas">
      <canvas ref={element} />
      {hydrationState.phase === "loading" ? (
        <div className="canvas-hydration-status" role="status">
          Restoring {hydrationState.pending} media assets…
        </div>
      ) : hydrationState.phase === "failed" ? (
        <div className="canvas-hydration-status failed" role="alert">
          <span title={hydrationState.failures[0]?.message}>
            Failed to load {hydrationState.failures[0]?.label ?? "asset"}: {hydrationState.failures[0]?.message}
          </span>
          <button type="button" onClick={() => setHydrationAttempt((value) => value + 1)}>Retry</button>
        </div>
      ) : null}
    </div>
  );
}
