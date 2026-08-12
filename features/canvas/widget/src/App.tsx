import { App as McpApp, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { ArrowLeft, Film, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WhiteboardDocumentSchema,
  SelectionStateSchema,
  createEmptyDocument,
  type AnnotationRecord,
  type SelectionState,
  type ViewState,
  type WhiteboardDocument,
  type WhiteboardObject,
} from "../../shared/document-schema.js";
import {
  AssetGatewayDescriptorSchema,
  assetGatewayHealthUrl,
  assetGatewayImportUrl,
  assetGatewayMediaUrl,
  type AssetGatewayDescriptor,
  type GatewayImportKind,
} from "../../shared/asset-gateway.js";
import {
  fitMediaSize,
  reviewTargetIds,
  selectedMediaKind,
} from "../../shared/ui-helpers.js";
import { History } from "./canvas/history.js";
import type { WhiteboardTool } from "./canvas/interaction-controller.js";
import { Composer, type ComposerItem } from "./composer/Composer.js";
import { jsonSafeMcpArguments } from "./mcp-arguments.js";
import type { RecoveryDiagnosticEvent } from "./diagnostics/recovery-diagnostics.js";
import {
  imageBlobToCanvas,
  imageDataUrlToBlob,
  imageUrlToElement,
  readImageInChunks,
  uploadImageInChunks,
} from "./inspector/chunked-image-client.js";
import { readVideoInChunks, uploadVideoInChunks } from "./inspector/chunked-video-client.js";
import { formatTimecode, prepareVideoFile } from "./inspector/video-utils.js";
import { ReviewLauncher } from "./launcher/ReviewLauncher.js";
import { AnnotationToolbar } from "./toolbar/AnnotationToolbar.js";
import { VideoReviewStage, type VideoReviewStageHandle } from "./review/VideoReviewStage.js";
import {
  FixedMediaAnnotator,
  type AnnotationDraftMark,
  type FixedMediaAnnotatorHandle,
} from "./review/FixedMediaAnnotator.js";
import { randomIdToken } from "./random-id.js";

declare const __RENOISE_WIDGET_BUILD_ID__: string;

type Payload = Record<string, any>;
type DisplayMode = "inline" | "fullscreen" | "pip";
type ImageObject = Extract<WhiteboardObject, { type: "image" }>;
type FrozenVideoDraft = { target: ImageObject; sourceVideoId: string };
const ANNOTATION_TOOLS = new Set<WhiteboardTool>(["pen", "arrow", "rectangle", "text", "pin"]);
function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableJsonValue(entry)]));
  }
  return value;
}
const sameDocumentContent = (left: WhiteboardDocument, right: WhiteboardDocument) => {
  const leftContent = structuredClone(left);
  const rightContent = structuredClone(right);
  leftContent.page.revision = 0;
  rightContent.page.revision = 0;
  leftContent.page.objects.forEach((object) => { object.updatedAt = object.createdAt; });
  rightContent.page.objects.forEach((object) => { object.updatedAt = object.createdAt; });
  return JSON.stringify(stableJsonValue(leftContent)) === JSON.stringify(stableJsonValue(rightContent));
};
const app = new McpApp(
  { name: "Renoise Annotation Board", version: "1.0.0" },
  { availableDisplayModes: ["inline", "fullscreen"] },
);

function structured(result: any): Payload {
  if (result?.isError) throw new Error(result?.content?.[0]?.text ?? "Whiteboard tool failed");
  return result?.structuredContent ?? {};
}

function objectId(prefix = "obj") {
  return `${prefix}_${randomIdToken()}`;
}

function resetDocumentForMediaReplacement(document: WhiteboardDocument, retainedAssetIds: string[]) {
  const next = structuredClone(document);
  const retained = new Set(retainedAssetIds);
  next.page.objects = [];
  next.page.annotations = [];
  next.page.assets = Object.fromEntries(Object.entries(next.page.assets)
    .filter(([assetId]) => retained.has(assetId)));
  return next;
}

function annotationForTarget(document: WhiteboardDocument, targetId: string, markObjectIds: string[]): AnnotationRecord {
  const target = document.page.objects.find(({ id }) => id === targetId);
  if (!target || (target.type !== "image" && target.type !== "video-card")) throw new Error("The annotation target must be an image, video, or video frame");
  const assetId = target.data.assetId;
  const assetSha256 = document.page.assets[assetId]?.sha256;
  const imageSource = target.type === "image" ? target.data.source : undefined;
  const frameSource = imageSource && "kind" in imageSource && imageSource.kind === "video-frame" ? imageSource : undefined;
  return {
    id: objectId("annotation"),
    targetObjectIds: [targetId],
    markObjectIds,
    sourceAssetSha256: frameSource?.videoSha256 ?? assetSha256,
    sourceTimeMs: frameSource?.timeMs ?? (target.type === "video-card" ? target.data.timeMs : null),
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export function annotationDraftObjects(
  marks: AnnotationDraftMark[],
  target: Extract<WhiteboardObject, { type: "image" }>,
  coordinateSize = { width: target.transform.width, height: target.transform.height },
  createdAt = new Date().toISOString(),
): WhiteboardObject[] {
  const scaleX = target.transform.width / coordinateSize.width;
  const scaleY = target.transform.height / coordinateSize.height;
  const point = ({ x, y }: { x: number; y: number }) => ({ x: x * scaleX, y: y * scaleY });
  const base = (mark: AnnotationDraftMark, transform: WhiteboardObject["transform"]) => ({
    id: mark.id,
    parentId: null,
    transform,
    zIndex: target.zIndex + 1,
    locked: true,
    hidden: true,
    createdAt,
    updatedAt: createdAt,
  });
  return marks.map((mark) => {
    if (mark.kind === "pen") return {
      ...base(mark, { ...target.transform, rotation: 0 }),
      type: "freehand",
      data: { points: mark.points.map(point), width: 3 },
      style: { stroke: "#FF4D4F" },
    };
    if (mark.kind === "arrow") return {
      ...base(mark, { ...target.transform, rotation: 0 }),
      type: "arrow",
      data: { points: [point(mark.start), point(mark.end)] },
      style: { stroke: "#FF4D4F", strokeWidth: 3 },
    };
    if (mark.kind === "rect") {
      const start = point(mark.start);
      const end = point(mark.end);
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      return {
        ...base(mark, {
          x: target.transform.x + x,
          y: target.transform.y + y,
          width: Math.max(1, Math.abs(end.x - start.x)),
          height: Math.max(1, Math.abs(end.y - start.y)),
          rotation: 0,
        }),
        type: "rect",
        data: {},
        style: { stroke: "#FF4D4F", strokeWidth: 3, fill: "transparent" },
      };
    }
    if (mark.kind === "text") {
      const anchor = point(mark.point);
      return {
      ...base(mark, {
        x: target.transform.x + anchor.x,
        y: target.transform.y + anchor.y,
        width: Math.max(1, mark.text.length * 20),
        height: 28,
        rotation: 0,
      }),
      type: "text",
      data: { text: mark.text, fontSize: 20, align: "left" },
      style: { fill: "#FF4D4F" },
      };
    }
    const anchor = point(mark.point);
    return {
      ...base(mark, {
        x: target.transform.x + anchor.x - 17,
        y: target.transform.y + anchor.y - 42,
        width: 34,
        height: 50,
        rotation: 0,
      }),
      type: "ellipse",
      data: {},
      style: { variant: "numbered-pin", number: mark.number, fill: "#0AA7C2" },
    };
  }) as WhiteboardObject[];
}

export function App() {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [pendingProject, setPendingProject] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("inline");
  const [document, setDocument] = useState<WhiteboardDocument>(() => createEmptyDocument("page_local"));
  const [view, setView] = useState<ViewState>({
    schemaVersion: 1,
    pageId: "page_local",
    camera: { x: 0, y: 0, zoom: 1 },
    theme: "light",
    promptDrafts: {},
  });
  const [intentSelection, setIntentSelection] = useState<SelectionState>({
    schemaVersion: 1,
    pageId: "page_local",
    documentRevision: 0,
    selectedObjectIds: [],
    selectedAnnotationIds: [],
  });
  const [tool, setTool] = useState<WhiteboardTool>("select");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed" | "conflict">("saved");
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState({ markCount: 0, canUndo: false, canRedo: false });
  const [draftResetKey, setDraftResetKey] = useState(0);
  const [activeTargetId, setActiveTargetId] = useState("");
  const [frozenVideoDraft, setFrozenVideoDraft] = useState<FrozenVideoDraft>();
  const [videoResumeTime, setVideoResumeTime] = useState<{ videoId: string; timeMs: number }>();
  const [videoTransfer, setVideoTransfer] = useState<{ phase: "upload" | "process" | "read"; loaded: number; total: number }>();
  const [stageBusy, setStageBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceOnNextMediaSelection = useRef(false);
  const videoStageRef = useRef<VideoReviewStageHandle>(null);
  const annotatorRef = useRef<FixedMediaAnnotatorHandle>(null);
  const intentSelectionRef = useRef(intentSelection);
  const documentRef = useRef(document);
  const viewRef = useRef(view);
  const sessionRef = useRef(sessionId);
  const activeTargetRef = useRef(activeTargetId);
  const frozenVideoDraftRef = useRef<FrozenVideoDraft | undefined>(undefined);
  const videoFreezeInFlight = useRef<Promise<string | undefined> | undefined>(undefined);
  const resumeAttempt = useRef("");
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const selectionSaveChain = useRef<Promise<unknown>>(Promise.resolve());
  const history = useRef(new History(document, 100, sameDocumentContent));
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const videoTransferController = useRef<AbortController | undefined>(undefined);
  const imageAssetBlobs = useRef(new Map<string, Promise<Blob>>());
  const imageAssetElements = useRef(new Map<string, Promise<HTMLImageElement | HTMLCanvasElement>>());
  const imageAssetUrls = useRef(new Map<string, Promise<string>>());
  const localAssetBlobUrls = useRef(new Map<string, string>());
  const localBlobUrls = useRef(new Set<string>());
  const assetGatewayRef = useRef<AssetGatewayDescriptor | undefined>(undefined);
  const assetGatewayHealth = useRef<Promise<boolean> | undefined>(undefined);
  const assetGatewayUnavailableUntil = useRef(0);
  const recordRecoveryDiagnostic = useCallback((event: RecoveryDiagnosticEvent) => {
    const status = event.status ?? "info";
    const method = status === "error" ? "error" : status === "warning" ? "warn" : "info";
    console[method](`[Renoise recovery] ${event.stage}: ${event.message}`, event.detail ?? "");
  }, []);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { intentSelectionRef.current = intentSelection; }, [intentSelection]);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  useEffect(() => { activeTargetRef.current = activeTargetId; }, [activeTargetId]);
  useEffect(() => {
    globalThis.document.documentElement.dataset.displayMode = displayMode;
    if (connected && displayMode !== "fullscreen") {
      requestAnimationFrame(() => {
        const root = globalThis.document.getElementById("root");
        if (root) void app.sendSizeChanged({ width: root.scrollWidth, height: root.scrollHeight });
      });
    }
  }, [connected, displayMode, authorized, document.page.annotations.length, document.page.objects.length]);
  useEffect(() => () => {
    clearTimeout(viewSaveTimer.current);
    videoTransferController.current?.abort();
    imageAssetBlobs.current.clear();
    imageAssetElements.current.clear();
    imageAssetUrls.current.clear();
    localAssetBlobUrls.current.clear();
    for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
    localBlobUrls.current.clear();
    assetGatewayHealth.current = undefined;
    assetGatewayUnavailableUntil.current = 0;
  }, []);

  const applyPayload = useCallback((payload: Payload) => {
    if (payload.canvasSessionId) {
      if (sessionRef.current && payload.canvasSessionId !== sessionRef.current) {
        assetGatewayRef.current = undefined;
        assetGatewayHealth.current = undefined;
        assetGatewayUnavailableUntil.current = 0;
        imageAssetBlobs.current.clear();
        imageAssetElements.current.clear();
        imageAssetUrls.current.clear();
        localAssetBlobUrls.current.clear();
        for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
        localBlobUrls.current.clear();
      }
      setSessionId(payload.canvasSessionId);
      sessionRef.current = payload.canvasSessionId;
      recordRecoveryDiagnostic({
        stage: "Session status",
        message: "Annotation-board session ID received.",
        status: "success",
        detail: `session=…${String(payload.canvasSessionId).slice(-8)}`,
      });
    }
    if (payload.authorization?.projectDir) setPendingProject(payload.authorization.projectDir);
    if (payload.authorization?.state === "active") setAuthorized(true);
    if (payload.assetGateway) {
      const parsed = AssetGatewayDescriptorSchema.safeParse(payload.assetGateway);
      if (parsed.success) {
        const previous = assetGatewayRef.current;
        const changed = !previous
          || previous.origin !== parsed.data.origin
          || previous.canvasSessionId !== parsed.data.canvasSessionId
          || previous.accessToken !== parsed.data.accessToken;
        assetGatewayRef.current = parsed.data;
        if (changed) {
          assetGatewayHealth.current = undefined;
          assetGatewayUnavailableUntil.current = 0;
          imageAssetBlobs.current.clear();
          imageAssetElements.current.clear();
          imageAssetUrls.current.clear();
          localAssetBlobUrls.current.clear();
          for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
          localBlobUrls.current.clear();
        }
        recordRecoveryDiagnostic({
          stage: "Local media channel",
          message: changed ? "New local media capability received." : "Local media capability is unchanged.",
          status: "success",
          detail: `expires=${parsed.data.expiresAt}`,
        });
      } else {
        recordRecoveryDiagnostic({ stage: "Local media channel", message: "The host returned an invalid local media descriptor.", status: "warning" });
      }
    }
    if (payload.document) {
      const normalizedDocument = WhiteboardDocumentSchema.parse(payload.document);
      setDocument(normalizedDocument);
      documentRef.current = normalizedDocument;
      history.current.reset(normalizedDocument);
      const mediaCount = normalizedDocument.page.objects.filter(({ type }: WhiteboardObject) => type === "image" || type === "video-card" || type === "ai-image").length;
      recordRecoveryDiagnostic({
        stage: "State read",
        message: `Annotation-board state loaded: ${normalizedDocument.page.objects.length} objects, ${mediaCount} media objects.`,
        status: "success",
        detail: `page=${normalizedDocument.page.id}, revision=${normalizedDocument.page.revision}`,
      });
    }
    if (payload.view) {
      setView(payload.view);
      viewRef.current = payload.view;
      const restoredTargetId = payload.view.activeTargetId ?? "";
      setActiveTargetId(restoredTargetId);
      activeTargetRef.current = restoredTargetId;
    }
    if (payload.selection) {
      const restoredSelection = SelectionStateSchema.parse(payload.selection);
      setIntentSelection(restoredSelection);
      intentSelectionRef.current = restoredSelection;
    }
  }, [recordRecoveryDiagnostic]);

  useEffect(() => {
    app.ontoolinput = (params) => {
      const input = params.arguments ?? {};
      if (typeof input.canvasSessionId === "string") {
        setSessionId(input.canvasSessionId);
        sessionRef.current = input.canvasSessionId;
      }
      if (typeof input.projectDir === "string") setPendingProject(input.projectDir);
      recordRecoveryDiagnostic({
        stage: "Host input",
        message: "Annotation-board launch parameters received.",
        status: "info",
        detail: typeof input.projectDir === "string" ? input.projectDir : undefined,
      });
    };
    app.ontoolresult = (params) => {
      recordRecoveryDiagnostic({ stage: "Host result", message: "Annotation-board launch result received.", status: "info" });
      applyPayload(params.structuredContent ?? {});
    };
    app.onhostcontextchanged = (context) => {
      if (context.displayMode) setDisplayMode(context.displayMode);
      recordRecoveryDiagnostic({
        stage: "Host context",
        message: "Host context changed.",
        status: "info",
        detail: `mode=${context.displayMode ?? "unchanged"}, size=${context.containerDimensions ? JSON.stringify(context.containerDimensions) : "unchanged"}`,
      });
    };
    recordRecoveryDiagnostic({
      stage: "MCP connection",
      message: "Connecting to the Codex host.",
      status: "info",
      detail: `widgetBuild=${__RENOISE_WIDGET_BUILD_ID__}`,
    });
    void app.connect(new PostMessageTransport(window.parent, window.parent))
      .then(() => {
        setConnected(true);
        setDisplayMode(app.getHostContext()?.displayMode ?? "inline");
        recordRecoveryDiagnostic({ stage: "MCP connection", message: "Connected to the Codex host.", status: "success" });
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : String(caught);
        recordRecoveryDiagnostic({ stage: "MCP connection", message: "Failed to connect to the Codex host.", status: "error", detail: message });
        setError("The current host did not complete the MCP App connection");
      });
    return () => { app.onhostcontextchanged = undefined; };
  }, [applyPayload, recordRecoveryDiagnostic]);

  const call = useCallback(async (name: string, args: Record<string, unknown>) => {
    return structured(await app.callServerTool({ name, arguments: jsonSafeMcpArguments(args) }));
  }, []);

  useEffect(() => {
    if (!connected || !sessionId || authorized || resumeAttempt.current === sessionId) return;
    resumeAttempt.current = sessionId;
    recordRecoveryDiagnostic({
      stage: "Session recovery",
      message: "No active authorization is available. Restoring the session from the server.",
      status: "info",
      detail: `session=…${sessionId.slice(-8)}`,
    });
    void call("get_renoise_whiteboard_state", { canvasSessionId: sessionId })
      .then((payload) => {
        applyPayload({
          ...payload,
          canvasSessionId: sessionId,
          authorization: { state: "active", projectDir: pendingProject },
        });
        setDraftResetKey((value) => value + 1);
        setSaveStatus("saved");
        setError("");
        recordRecoveryDiagnostic({ stage: "Session recovery", message: "Server session state restored.", status: "success" });
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : String(caught);
        recordRecoveryDiagnostic({ stage: "Session recovery", message: "Failed to restore server session state.", status: "error", detail: message });
        if (message.includes("SESSION_EXPIRED")) setError("The annotation-board session has expired. Reopen it from the conversation");
        else if (!message.includes("AUTHORIZATION_REQUIRED")) setError(message);
      });
  }, [applyPayload, authorized, call, connected, pendingProject, recordRecoveryDiagnostic, sessionId]);

  const requestFullscreen = useCallback(async () => {
    setError("");
    const available = app.getHostContext()?.availableDisplayModes ?? [];
    if (!available.includes("fullscreen")) {
      setError("This Codex host only supports inline rendering and cannot open the side panel or full-screen mode");
      return false;
    }
    try {
      const result = await app.requestDisplayMode({ mode: "fullscreen" });
      setDisplayMode(result.mode);
      if (result.mode !== "fullscreen") {
        setError("The Codex host did not switch to full-screen mode");
        return false;
      }
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    }
  }, []);

  const returnToConversation = useCallback(async () => {
    try {
      const result = await app.requestDisplayMode({ mode: "inline" });
      setDisplayMode(result.mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const saveDocument = useCallback((
    next: WhiteboardDocument | ((current: WhiteboardDocument) => WhiteboardDocument),
    recordHistory = true,
  ) => {
    if (!authorized || !sessionRef.current) {
      const unsaved = typeof next === "function" ? next(documentRef.current) : next;
      return Promise.resolve({ document: unsaved, saved: false });
    }
    setSaveStatus("saving");
    const snapshot = typeof next === "function" ? next : structuredClone(next);
    const operation = saveChain.current.then(async () => {
      // Functional mutations are evaluated only after all preceding saves finish.
      // This prevents a delayed Fabric flush from replacing media imported meanwhile.
      const candidate = typeof snapshot === "function"
        ? structuredClone(snapshot(documentRef.current))
        : structuredClone(snapshot);
      if (typeof snapshot === "function" && sameDocumentContent(candidate, documentRef.current)) {
        setSaveStatus("saved");
        return { document: documentRef.current, saved: true };
      }
      const expectedRevision = documentRef.current.page.revision;
      candidate.page.revision = expectedRevision;
      try {
        const payload = await call("save_renoise_whiteboard_state", {
          canvasSessionId: sessionRef.current,
          expectedRevision,
          document: candidate,
        });
        const saved = WhiteboardDocumentSchema.parse(payload.document);
        documentRef.current = saved;
        setDocument(saved);
        if (recordHistory) {
          history.current.push(saved);
        } else {
          history.current.replaceCurrent(saved);
        }
        setSaveStatus("saved");
        return { document: saved, saved: true };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        setSaveStatus(message.includes("REVISION_CONFLICT") ? "conflict" : "failed");
        setError(message);
        return { document: documentRef.current, saved: false };
      }
    });
    saveChain.current = operation;
    return operation;
  }, [authorized, call]);

  const persistView = useCallback((next: ViewState) => {
    setView(next);
    viewRef.current = next;
    clearTimeout(viewSaveTimer.current);
    viewSaveTimer.current = setTimeout(() => {
      if (!sessionRef.current) return;
      void call("save_renoise_whiteboard_view", { canvasSessionId: sessionRef.current, view: viewRef.current })
        .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
    }, 140);
  }, [call]);

  const activateTarget = useCallback((targetId: string) => {
    if (!reviewTargetIds(documentRef.current).includes(targetId)) return;
    activeTargetRef.current = targetId;
    setActiveTargetId(targetId);
    if (viewRef.current.activeTargetId === targetId) return;
    persistView({ ...viewRef.current, activeTargetId: targetId });
  }, [persistView]);

  const updatePromptDraft = useCallback((prompt: string) => {
    const targetId = documentRef.current.page.id;
    const current = viewRef.current;
    if ((current.promptDrafts[targetId] ?? "") === prompt) return;
    persistView({
      ...current,
      promptDrafts: { ...current.promptDrafts, [targetId]: prompt },
    });
  }, [persistView]);

  const targetIdSignature = document.page.objects
    .filter(({ type }) => type === "image" || type === "video-card")
    .map(({ id }) => id)
    .join("|");
  useEffect(() => {
    const targets = reviewTargetIds(documentRef.current);
    if (activeTargetRef.current && targets.includes(activeTargetRef.current)) return;
    const targetId = targets.at(-1);
    if (targetId) activateTarget(targetId);
  }, [activateTarget, targetIdSignature]);

  const saveSelection = useCallback(async (ids = intentSelectionRef.current.selectedObjectIds) => {
    if (!authorized || !sessionRef.current) return;
    const requestedIds = [...new Set(ids)];
    const optimistic = { ...intentSelectionRef.current, selectedObjectIds: requestedIds };
    intentSelectionRef.current = optimistic;
    setIntentSelection(optimistic);
    const previous = selectionSaveChain.current.catch(() => undefined);
    const operation = previous.then(async () => {
      await saveChain.current;
      const current = documentRef.current;
      const validTargets = new Set(current.page.objects
        .filter(({ type }) => type === "image" || type === "video-card")
        .map(({ id }) => id));
      const selectedObjectIds = requestedIds.filter((id) => validTargets.has(id));
      const annotations = current.page.annotations.filter(({ targetObjectIds }) =>
        targetObjectIds.some((id) => selectedObjectIds.includes(id)));
      const selection: SelectionState = {
        schemaVersion: 1,
        pageId: current.page.id,
        documentRevision: current.page.revision,
        selectedObjectIds,
        selectedAnnotationIds: annotations.map(({ id }) => id),
      };
      const payload = await call("save_renoise_whiteboard_selection", { canvasSessionId: sessionRef.current, selection });
      const saved = SelectionStateSchema.parse(payload.selection ?? selection);
      if (requestedIds.length === intentSelectionRef.current.selectedObjectIds.length
        && requestedIds.every((id, index) => intentSelectionRef.current.selectedObjectIds[index] === id)) {
        setIntentSelection(saved);
        intentSelectionRef.current = saved;
      }
      return saved;
    });
    selectionSaveChain.current = operation;
    return operation;
  }, [authorized, call]);

  const approve = async () => {
    setError("");
    recordRecoveryDiagnostic({ stage: "Directory authorization", message: "Approving the project directory.", status: "info", detail: pendingProject });
    try {
      const payload = await call("authorize_renoise_whiteboard_workspace", {
        approvedProjectDir: pendingProject,
      });
      applyPayload(payload);
      setAuthorized(true);
      setDraftResetKey((value) => value + 1);
      recordRecoveryDiagnostic({ stage: "Directory authorization", message: "Project directory approved.", status: "success" });
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      recordRecoveryDiagnostic({ stage: "Directory authorization", message: "Failed to approve the project directory.", status: "error", detail: message });
      setError(message);
      return false;
    }
  };

  const openReviewer = async () => {
    setError("");
    if (!authorized && !(await approve())) return;
    await requestFullscreen();
  };

  const refresh = useCallback(async ({ forceAssetRead = false, reason = "User refresh" } = {}) => {
    recordRecoveryDiagnostic({
      stage: "Forced recovery",
      message: forceAssetRead ? `${reason}: clear the media cache and reread project files.` : `${reason}: reread annotation-board state.`,
      status: "info",
    });
    if (forceAssetRead) {
      imageAssetBlobs.current.clear();
      imageAssetElements.current.clear();
      imageAssetUrls.current.clear();
      localAssetBlobUrls.current.clear();
      for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
      localBlobUrls.current.clear();
      assetGatewayHealth.current = undefined;
      assetGatewayUnavailableUntil.current = Date.now() + 10_000;
    }
    try {
      const payload = await call("get_renoise_whiteboard_state", { canvasSessionId: sessionRef.current });
      applyPayload(payload);
      setDraftResetKey((value) => value + 1);
      setSaveStatus("saved");
      recordRecoveryDiagnostic({ stage: "Forced recovery", message: "Annotation-board state reloaded. Rebuilding the media scene.", status: "success" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      recordRecoveryDiagnostic({ stage: "Forced recovery", message: "Failed to reread annotation-board state.", status: "error", detail: message });
      setError(message);
    }
  }, [applyPayload, call, recordRecoveryDiagnostic]);

  const ensureAssetGateway = useCallback(async () => {
    const descriptor = assetGatewayRef.current;
    if (!descriptor || Date.parse(descriptor.expiresAt) <= Date.now()) {
      recordRecoveryDiagnostic({ stage: "Local media channel", message: "The local media channel is missing or expired. Falling back to MCP chunked reads.", status: "warning" });
      return false;
    }
    if (assetGatewayUnavailableUntil.current > Date.now()) {
      recordRecoveryDiagnostic({ stage: "Local media channel", message: "The local media channel is backing off. Falling back to MCP chunked reads.", status: "warning" });
      return false;
    }
    const cached = assetGatewayHealth.current;
    if (cached) return cached;
    recordRecoveryDiagnostic({ stage: "Local media channel", message: "Probing the local media channel.", status: "info" });
    const pending = fetch(assetGatewayHealthUrl(descriptor), {
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    })
      .then((response) => response.ok)
      .catch(() => false);
    assetGatewayHealth.current = pending;
    void pending.then((available) => {
      if (available) {
        assetGatewayUnavailableUntil.current = 0;
        recordRecoveryDiagnostic({ stage: "Local media channel", message: "Local media channel probe succeeded.", status: "success" });
      } else {
        assetGatewayUnavailableUntil.current = Date.now() + 60_000;
        if (assetGatewayHealth.current === pending) assetGatewayHealth.current = undefined;
        recordRecoveryDiagnostic({ stage: "Local media channel", message: "The local media channel is unavailable. Falling back to MCP chunked reads.", status: "warning" });
      }
    });
    return pending;
  }, [recordRecoveryDiagnostic]);

  const gatewayMediaUrl = useCallback((assetId: string, variant: "canvas" | "original" = "original") => {
    const descriptor = assetGatewayRef.current;
    return descriptor ? assetGatewayMediaUrl(descriptor, assetId, variant) : undefined;
  }, []);

  const importThroughAssetGateway = useCallback(async (
    kind: GatewayImportKind,
    file: Blob,
    metadata: {
      expectedRevision: number;
      fileName: string;
      width?: number;
      height?: number;
      durationMs?: number;
      createPlaybackProxy?: boolean;
    },
    signal?: AbortSignal,
  ) => {
    const descriptor = assetGatewayRef.current;
    if (!descriptor || !(await ensureAssetGateway())) return undefined;
    let response: Response;
    try {
      response = await fetch(assetGatewayImportUrl(descriptor, kind, {
        ...metadata,
        byteLength: file.size,
        requestId: `upload_${randomIdToken()}`,
      }), {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
        signal,
      });
    } catch (caught) {
      if (signal?.aborted) throw caught;
      assetGatewayHealth.current = undefined;
      assetGatewayUnavailableUntil.current = Date.now() + 60_000;
      return undefined;
    }
    const payload = await response.json().catch(() => ({})) as Payload;
    if (!response.ok) {
      const message = payload.error?.message ?? `Local media gateway import failed (HTTP ${response.status})`;
      throw new Error(message);
    }
    return payload;
  }, [ensureAssetGateway]);

  const readAssetBlob = useCallback(async (assetId: string) => {
    const cached = imageAssetBlobs.current.get(assetId);
    if (cached) {
      recordRecoveryDiagnostic({ stage: "Asset cache", message: "Using the cached source image Blob.", status: "success", detail: `asset=${assetId}` });
      return cached;
    }
    recordRecoveryDiagnostic({ stage: "MCP chunked read", message: "Reading the image from the project file.", status: "info", detail: `asset=${assetId}` });
    let progressBucket = -1;
    let pending: Promise<Blob>;
    pending = readImageInChunks({
      call,
      canvasSessionId: sessionRef.current,
      assetId,
      onProgress: (loaded, total) => {
        const percent = Math.round(loaded / total * 100);
        const bucket = percent === 100 ? 100 : Math.floor(percent / 25) * 25;
        if (bucket === progressBucket) return;
        progressBucket = bucket;
        recordRecoveryDiagnostic({
          stage: "MCP chunked read",
          message: `Image read progress: ${percent}% (${loaded}/${total} bytes).`,
          status: percent === 100 ? "success" : "info",
          detail: `asset=${assetId}`,
        });
      },
    })
      .then((blob) => {
        recordRecoveryDiagnostic({ stage: "MCP chunked read", message: `Image file read complete: ${blob.size} bytes.`, status: "success", detail: `asset=${assetId}` });
        return blob;
      })
      .catch((chunkedError) => {
        const message = chunkedError instanceof Error ? chunkedError.message : String(chunkedError);
        recordRecoveryDiagnostic({ stage: "MCP chunked read", message: "Failed to read the image file.", status: "error", detail: `${assetId}: ${message}` });
        throw new Error(`Image recovery failed: ${message}`);
      })
      .catch((caught) => {
        if (imageAssetBlobs.current.get(assetId) === pending) imageAssetBlobs.current.delete(assetId);
        throw caught;
      });
    imageAssetBlobs.current.set(assetId, pending);
    return pending;
  }, [call, recordRecoveryDiagnostic]);

  const localBlobUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    localBlobUrls.current.add(url);
    return url;
  }, []);

  const readDecodedImageAsset = useCallback(async (assetId: string) => {
    const cached = imageAssetElements.current.get(assetId);
    if (cached) {
      recordRecoveryDiagnostic({ stage: "Asset cache", message: "Using the decoded persistent image element.", status: "success", detail: `asset=${assetId}` });
      return cached;
    }
    let pending: Promise<HTMLImageElement | HTMLCanvasElement>;
    pending = (async () => {
      const available = await ensureAssetGateway();
      if (available) {
        const source = available ? gatewayMediaUrl(assetId, "canvas") : undefined;
        if (source) {
          recordRecoveryDiagnostic({ stage: "Local media read", message: "Loading the image through the local media channel.", status: "info", detail: `asset=${assetId}` });
          try {
            const decoded = await imageUrlToElement(source);
            recordRecoveryDiagnostic({
              stage: "Local media read",
              message: `Image decoded to a persistent ${decoded.naturalWidth}×${decoded.naturalHeight} element.`,
              status: "success",
              detail: `asset=${assetId}`,
            });
            return decoded;
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : String(caught);
            assetGatewayHealth.current = undefined;
            assetGatewayUnavailableUntil.current = Date.now() + 60_000;
            recordRecoveryDiagnostic({
              stage: "Local media read",
              message: "Local media loading failed or timed out. Switching to MCP chunked reads.",
              status: "warning",
              detail: `${assetId}: ${message}`,
            });
          }
        }
      }
      const blob = await readAssetBlob(assetId);
      recordRecoveryDiagnostic({ stage: "Image decode", message: "Decoding the project image into an isolated canvas.", status: "info", detail: `asset=${assetId}` });
      const decoded = await imageBlobToCanvas(blob);
      recordRecoveryDiagnostic({
        stage: "Image decode",
        message: `Image decoded to an isolated ${decoded.width}×${decoded.height} canvas.`,
        status: "success",
        detail: `asset=${assetId}`,
      });
      return decoded;
    })()
      .catch((caught) => {
      if (imageAssetElements.current.get(assetId) === pending) imageAssetElements.current.delete(assetId);
      throw caught;
    });
    imageAssetElements.current.set(assetId, pending);
    return pending;
  }, [ensureAssetGateway, gatewayMediaUrl, readAssetBlob, recordRecoveryDiagnostic]);

  const readAssetUrl = useCallback(async (assetId: string) => {
    const cached = imageAssetUrls.current.get(assetId);
    if (cached) return cached;
    let pending: Promise<string>;
    pending = readAssetBlob(assetId)
      .then((blob) => {
        const existing = localAssetBlobUrls.current.get(assetId);
        if (existing) return existing;
        const source = localBlobUrl(blob);
        localAssetBlobUrls.current.set(assetId, source);
        return source;
      })
      .catch((caught) => {
      if (imageAssetUrls.current.get(assetId) === pending) imageAssetUrls.current.delete(assetId);
      throw caught;
    });
    imageAssetUrls.current.set(assetId, pending);
    return pending;
  }, [localBlobUrl, readAssetBlob]);

  const readDisplayAssetUrl = useCallback(async (assetId: string) => {
    const decoded = await readDecodedImageAsset(assetId);
    if (decoded instanceof HTMLCanvasElement) return decoded.toDataURL("image/png");
    if (decoded instanceof HTMLImageElement) return decoded.currentSrc || decoded.src;
    throw new Error("Could not create the fixed media preview");
  }, [readDecodedImageAsset]);

  const primeLocalImageAsset = useCallback((
    assetId: string,
    blob: Blob,
    sourceUrl: string,
    decodedSource?: HTMLImageElement | HTMLCanvasElement,
  ) => {
    const blobPromise = Promise.resolve(blob);
    let elementPromise: Promise<HTMLImageElement | HTMLCanvasElement>;
    elementPromise = (decodedSource ? Promise.resolve(decodedSource) : imageBlobToCanvas(blob)).catch((caught) => {
      if (imageAssetElements.current.get(assetId) === elementPromise) imageAssetElements.current.delete(assetId);
      throw caught;
    });
    imageAssetBlobs.current.set(assetId, blobPromise);
    imageAssetElements.current.set(assetId, elementPromise);
    imageAssetUrls.current.set(assetId, Promise.resolve(sourceUrl));
    if (sourceUrl.startsWith("blob:")) localAssetBlobUrls.current.set(assetId, sourceUrl);
    return elementPromise;
  }, []);

  const clearFrozenVideoDraft = useCallback(() => {
    const draft = frozenVideoDraftRef.current;
    if (!draft) return;
    const assetId = draft.target.data.assetId;
    const sourceUrl = localAssetBlobUrls.current.get(assetId);
    imageAssetBlobs.current.delete(assetId);
    imageAssetElements.current.delete(assetId);
    imageAssetUrls.current.delete(assetId);
    localAssetBlobUrls.current.delete(assetId);
    frozenVideoDraftRef.current = undefined;
    setFrozenVideoDraft(undefined);
    if (sourceUrl) requestAnimationFrame(() => {
      URL.revokeObjectURL(sourceUrl);
      localBlobUrls.current.delete(sourceUrl);
    });
  }, []);

  useEffect(() => {
    if (frozenVideoDraft && frozenVideoDraft.target.id !== activeTargetId) clearFrozenVideoDraft();
  }, [activeTargetId, clearFrozenVideoDraft, frozenVideoDraft]);

  const finalizeImportedTarget = async (targetId: string, replaceExisting: boolean) => {
    if (!replaceExisting) {
      activateTarget(targetId);
      return;
    }
    clearTimeout(viewSaveTimer.current);
    annotatorRef.current?.clear();
    clearFrozenVideoDraft();
    setVideoResumeTime(undefined);
    setTool("select");
    setDraftStatus({ markCount: 0, canUndo: false, canRedo: false });
    setDraftResetKey((value) => value + 1);
    activeTargetRef.current = targetId;
    setActiveTargetId(targetId);
    const promptDrafts = { ...viewRef.current.promptDrafts };
    delete promptDrafts[documentRef.current.page.id];
    const nextView: ViewState = {
      ...viewRef.current,
      pageId: documentRef.current.page.id,
      activeTargetId: targetId,
      promptDrafts,
    };
    viewRef.current = nextView;
    setView(nextView);
    await Promise.all([
      saveSelection([]),
      call("save_renoise_whiteboard_view", { canvasSessionId: sessionRef.current, view: nextView }),
    ]);
  };

  const importFile = async (file: File, replaceExisting = false) => {
    await saveChain.current;
    const sourceUrl = localBlobUrl(file);
    const decodedSource = await imageBlobToCanvas(file);
    const sourceSize = { width: decodedSource.width, height: decodedSource.height };
    const fitted = fitMediaSize(sourceSize.width, sourceSize.height, 720, 520);
    const streamed = await importThroughAssetGateway("image", file, {
      expectedRevision: documentRef.current.page.revision,
      fileName: file.name,
      width: sourceSize.width,
      height: sourceSize.height,
    });
    const payload = streamed ?? await uploadImageInChunks({
      call,
      canvasSessionId: sessionRef.current,
      file,
      fileName: file.name,
      expectedRevision: documentRef.current.page.revision,
      width: sourceSize.width,
      height: sourceSize.height,
    });
    const base = WhiteboardDocumentSchema.parse(payload.document);
    documentRef.current = base;
    const now = new Date().toISOString();
    const record: WhiteboardObject = {
      id: objectId(),
      type: "image",
      parentId: null,
      transform: { x: 120, y: 100, width: fitted.width, height: fitted.height, rotation: 0 },
      zIndex: Math.max(0, ...base.page.objects.map(({ zIndex }) => zIndex)) + 1,
      locked: false,
      hidden: false,
      style: {},
      data: { assetId: payload.asset.id, alt: file.name, source: { kind: "file-picker" } },
      createdAt: now,
      updatedAt: now,
    };
    const next = replaceExisting
      ? resetDocumentForMediaReplacement(base, [payload.asset.id])
      : structuredClone(base);
    next.page.objects.push(record);
    primeLocalImageAsset(
      payload.asset.id,
      file,
      sourceUrl,
      decodedSource,
    );
    const persisted = await saveDocument(next);
    if (!persisted.saved) throw new Error("The image was uploaded but could not be saved to the annotation board. Try again");
    await finalizeImportedTarget(record.id, replaceExisting);
    return record.id;
  };

  const importVideo = async (file: File, replaceExisting = false) => {
    setError("");
    await saveChain.current;
    const prepared = await prepareVideoFile(file);
    if (!prepared.browserDecodable) {
      recordRecoveryDiagnostic({
        stage: "Video compatibility processing",
        message: "The current host cannot decode the source video directly. The source will be preserved while a WebM playback proxy is generated.",
        status: "warning",
        detail: prepared.decodeFailure,
      });
    }
    videoTransferController.current?.abort();
    const controller = new AbortController();
    videoTransferController.current = controller;
    setVideoTransfer({ phase: "upload", loaded: 0, total: file.size });
    let payload: Payload;
    try {
      const streamed = await importThroughAssetGateway("video", file, {
        expectedRevision: documentRef.current.page.revision,
        fileName: file.name,
        durationMs: prepared.durationMs,
        createPlaybackProxy: !prepared.browserDecodable,
      }, controller.signal);
      if (streamed) {
        payload = streamed;
        setVideoTransfer({ phase: "upload", loaded: file.size, total: file.size });
      } else {
        payload = await uploadVideoInChunks({
          call,
          canvasSessionId: sessionRef.current,
          file,
          expectedRevision: documentRef.current.page.revision,
          durationMs: prepared.durationMs,
          createPlaybackProxy: !prepared.browserDecodable,
          signal: controller.signal,
          onProgress: ({ loaded, total, phase }) => setVideoTransfer({ phase, loaded, total }),
        });
      }
      if (prepared.posterDataUrl && !payload.posterAsset) {
        try {
          const posterBlob = imageDataUrlToBlob(prepared.posterDataUrl);
          const posterFileName = `${file.name.replace(/\.[^.]+$/, "")}-poster.png`;
          const streamedPoster = await importThroughAssetGateway("image", posterBlob, {
            expectedRevision: Number(payload.document?.page?.revision),
            fileName: posterFileName,
            width: prepared.width,
            height: prepared.height,
          }, controller.signal);
          const posterPayload = streamedPoster ?? await uploadImageInChunks({
            call,
            canvasSessionId: sessionRef.current,
            file: posterBlob,
            fileName: posterFileName,
            expectedRevision: Number(payload.document?.page?.revision),
            width: prepared.width,
            height: prepared.height,
            signal: controller.signal,
          });
          payload = {
            ...payload,
            posterAsset: posterPayload.asset,
            document: posterPayload.document,
            revision: posterPayload.revision,
          };
        } catch (caught) {
          if (controller.signal.aborted) throw caught;
          setError(`The video was imported, but its cover image could not be generated: ${caught instanceof Error ? caught.message : String(caught)}`);
        }
      }
    } finally {
      if (videoTransferController.current === controller) {
        videoTransferController.current = undefined;
        setVideoTransfer(undefined);
      }
    }
    const base = WhiteboardDocumentSchema.parse(payload.document);
    documentRef.current = base;
    const now = new Date().toISOString();
    const videoWidth = prepared.width || Number(payload.width);
    const videoHeight = prepared.height || Number(payload.height);
    const durationMs = Number(payload.durationMs ?? prepared.durationMs);
    if (!Number.isFinite(videoWidth) || videoWidth <= 0 || !Number.isFinite(videoHeight) || videoHeight <= 0
      || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("The video was uploaded, but the server did not return valid dimensions or duration");
    }
    const posterSize = fitMediaSize(videoWidth, videoHeight, 560, 360);
    const record: WhiteboardObject = {
      id: objectId(),
      type: "video-card",
      parentId: null,
      transform: { x: 120, y: 100, width: posterSize.width, height: posterSize.height + 52, rotation: 0 },
      zIndex: Math.max(0, ...base.page.objects.map(({ zIndex }) => zIndex)) + 1,
      locked: false,
      hidden: false,
      style: {},
      data: {
        assetId: payload.asset.id,
        playbackAssetId: payload.playbackAsset?.id,
        posterAssetId: payload.posterAsset?.id,
        durationMs,
        fileName: file.name,
        timeMs: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    const retainedAssetIds = [payload.asset.id, payload.playbackAsset?.id, payload.posterAsset?.id]
      .filter((assetId): assetId is string => Boolean(assetId));
    const next = replaceExisting
      ? resetDocumentForMediaReplacement(base, retainedAssetIds)
      : structuredClone(base);
    next.page.objects.push(record);
    const localPosterBlob = prepared.posterDataUrl ? imageDataUrlToBlob(prepared.posterDataUrl) : undefined;
    if (payload.posterAsset?.id && localPosterBlob) {
      primeLocalImageAsset(
          payload.posterAsset.id,
          localPosterBlob,
          localBlobUrl(localPosterBlob),
      );
    }
    const persisted = await saveDocument(next);
    if (!persisted.saved) throw new Error("The video was uploaded but could not be saved to the annotation board. Try again");
    await finalizeImportedTarget(record.id, replaceExisting);
    return record.id;
  };

  const readVideoAsset = useCallback(async (
    assetId: string,
    signal: AbortSignal,
    onProgress: (loaded: number, total: number) => void,
  ) => {
    if (await ensureAssetGateway()) {
      const source = gatewayMediaUrl(assetId, "original");
      if (source) return source;
    }
    return readVideoInChunks({
      call,
      canvasSessionId: sessionRef.current,
      assetId,
      signal,
      onProgress: ({ loaded, total }) => onProgress(loaded, total),
    });
  }, [call, ensureAssetGateway, gatewayMediaUrl]);

  const captureFrameDraft = async (video: Extract<WhiteboardObject, { type: "video-card" }>) => {
    const frozen = await videoStageRef.current?.freezeCurrentFrame();
    if (!frozen) return undefined;
    const videoSha256 = documentRef.current.page.assets[video.data.assetId]?.sha256;
    if (!videoSha256) throw new Error("Source-video integrity information is missing. Reload the annotation board");
    clearFrozenVideoDraft();
    const frameBlob = imageDataUrlToBlob(frozen.dataUrl);
    const assetId = objectId("draft_asset");
    const now = new Date().toISOString();
    const fitted = fitMediaSize(frozen.width, frozen.height, 640, 480);
    const record: ImageObject = {
      id: objectId("draft_frame"),
      type: "image",
      parentId: null,
      transform: {
        x: video.transform.x + video.transform.width + 40,
        y: video.transform.y,
        width: fitted.width,
        height: fitted.height,
        rotation: 0,
      },
      zIndex: Math.max(0, ...documentRef.current.page.objects.map(({ zIndex }) => zIndex)) + 1,
      locked: false,
      hidden: false,
      style: {},
      data: {
        assetId,
        alt: `Video frame ${formatTimecode(frozen.timeMs)}`,
        source: { kind: "video-frame", videoAssetId: video.data.assetId, videoSha256, timeMs: frozen.timeMs },
      },
      createdAt: now,
      updatedAt: now,
    };
    primeLocalImageAsset(
      assetId,
      frameBlob,
      localBlobUrl(frameBlob),
    );
    const draft = { target: record, sourceVideoId: video.id };
    frozenVideoDraftRef.current = draft;
    setFrozenVideoDraft(draft);
    setVideoResumeTime({ videoId: video.id, timeMs: frozen.timeMs });
    activeTargetRef.current = record.id;
    setActiveTargetId(record.id);
    return record.id;
  };

  const importSelectedMedia = async (file: File, replaceExisting = false) => {
    if (stageBusy) throw new Error("The current media is still being processed. Try again shortly");
    setStageBusy(true);
    setTool("select");
    try {
      const kind = selectedMediaKind(file);
      if (!kind) throw new Error("Only PNG, JPEG, WebP, and GIF images and MP4 and WebM videos are supported");
      const extension = file.name.toLowerCase().split(".").pop() ?? "";
      const inferredMime = kind === "video"
        ? extension === "webm" ? "video/webm" : "video/mp4"
        : extension === "png" ? "image/png"
          : extension === "webp" ? "image/webp"
            : extension === "gif" ? "image/gif"
              : "image/jpeg";
      const normalizedFile = file.type && file.type !== "application/octet-stream"
        ? file
        : new File([file], file.name, { type: inferredMime, lastModified: file.lastModified });
      return kind === "image"
        ? await importFile(normalizedFile, replaceExisting)
        : await importVideo(normalizedFile, replaceExisting);
    } finally {
      setStageBusy(false);
    }
  };

  const addIntentSource = async (targetId: string) => {
    const ids = [...intentSelectionRef.current.selectedObjectIds.filter((id) => id !== targetId), targetId];
    await saveSelection(ids);
  };

  const removeIntentSource = async (targetId: string) => {
    await saveSelection(intentSelectionRef.current.selectedObjectIds.filter((id) => id !== targetId));
  };

  const freezeActiveVideo = async () => {
    const target = documentRef.current.page.objects.find(({ id }) => id === activeTargetRef.current);
    if (target?.type !== "video-card") return target?.id;
    return captureFrameDraft(target);
  };

  const chooseAnnotationTool = async (nextTool: WhiteboardTool) => {
    if (stageBusy) return;
    if (!ANNOTATION_TOOLS.has(nextTool)) {
      setTool(nextTool);
      return;
    }
    const target = documentRef.current.page.objects.find(({ id }) => id === activeTargetRef.current);
    if (target?.type !== "video-card") {
      setTool(nextTool);
      return;
    }
    if (videoFreezeInFlight.current) return;
    videoStageRef.current?.pause();
    const pending = freezeActiveVideo();
    videoFreezeInFlight.current = pending;
    try {
      const frameId = await pending;
      if (!frameId) throw new Error("Could not freeze the current video frame");
      setTool(nextTool);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (videoFreezeInFlight.current === pending) videoFreezeInFlight.current = undefined;
    }
  };

  const persistAnnotatedSnapshot = async (
    target: Extract<WhiteboardObject, { type: "image" }>,
    snapshotBlob: Blob,
    sourceSize: { width: number; height: number },
    coordinateSize: { width: number; height: number },
    marks: AnnotationDraftMark[],
  ) => {
    await saveChain.current;
    const fileName = `annotation-${Date.now()}.png`;
    const streamed = await importThroughAssetGateway("image", snapshotBlob, {
      expectedRevision: documentRef.current.page.revision,
      fileName,
      width: sourceSize.width,
      height: sourceSize.height,
    });
    const payload = streamed ?? await uploadImageInChunks({
      call,
      canvasSessionId: sessionRef.current,
      file: snapshotBlob,
      fileName,
      expectedRevision: documentRef.current.page.revision,
      width: sourceSize.width,
      height: sourceSize.height,
    });
    const base = WhiteboardDocumentSchema.parse(payload.document);
    documentRef.current = base;
    const now = new Date().toISOString();
    const source = target.data.source;
    const videoFrame = "kind" in source && source.kind === "video-frame" ? source : undefined;
    const snapshot: Extract<WhiteboardObject, { type: "image" }> = {
      id: objectId("snapshot"),
      type: "image",
      parentId: null,
      transform: { ...target.transform, rotation: 0 },
      zIndex: Math.max(0, ...base.page.objects.map(({ zIndex }) => zIndex)) + 1,
      locked: true,
      hidden: false,
      style: { role: "annotation-snapshot" },
      data: {
        assetId: payload.asset.id,
        alt: `${target.data.alt || "Image"} · Annotated`,
        source: videoFrame ? { ...videoFrame } : { relation: "revision-of", objectId: target.id },
      },
      createdAt: now,
      updatedAt: now,
    };
    const markObjects = annotationDraftObjects(marks, snapshot, coordinateSize, now);
    const next = structuredClone(base);
    if (videoFrame) {
      const sourceVideo = next.page.objects.find((object) =>
        object.type === "video-card" && object.data.assetId === videoFrame.videoAssetId);
      if (sourceVideo?.type === "video-card") sourceVideo.data.timeMs = videoFrame.timeMs;
    }
    next.page.objects.push(snapshot, ...markObjects);
    next.page.annotations.push(annotationForTarget(next, snapshot.id, markObjects.map(({ id }) => id)));
    primeLocalImageAsset(payload.asset.id, snapshotBlob, localBlobUrl(snapshotBlob));
    const persisted = await saveDocument(next);
    if (!persisted.saved) throw new Error("The annotation snapshot was generated but could not be saved. Try again");
    return snapshot.id;
  };

  const addActiveToIntent = async () => {
    if (stageBusy) return;
    setStageBusy(true);
    try {
      const frozenDraft = frozenVideoDraftRef.current;
      const target = frozenDraft?.target.id === activeTargetRef.current
        ? frozenDraft.target
        : documentRef.current.page.objects.find(({ id }) => id === activeTargetRef.current);
      if (!target) throw new Error("Import an image or video first");
      if (target.type === "video-card") throw new Error("Pause the video or select an annotation tool to freeze the current frame first");
      if (target.type !== "image") throw new Error("The current media does not support annotation");
      const draft = await annotatorRef.current?.snapshot();
      if (!draft) throw new Error("The annotation area is not ready yet");
      const snapshotId = await persistAnnotatedSnapshot(
        target,
        draft.blob,
        { width: draft.width, height: draft.height },
        draft.coordinateSize,
        draft.marks,
      );
      await addIntentSource(snapshotId);
      annotatorRef.current?.clear();
      setDraftResetKey((value) => value + 1);
      setTool("select");
      if (frozenDraft) {
        clearFrozenVideoDraft();
        activateTarget(frozenDraft.sourceVideoId);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStageBusy(false);
    }
  };

  const returnToSourceVideo = async (discardDraftFrame = false) => {
    const frozenDraft = frozenVideoDraftRef.current;
    if (frozenDraft?.target.id === activeTargetRef.current) {
      const frameSource = frozenDraft.target.data.source;
      if ("kind" in frameSource && frameSource.kind === "video-frame") {
        setVideoResumeTime({ videoId: frozenDraft.sourceVideoId, timeMs: frameSource.timeMs });
      }
      clearFrozenVideoDraft();
      activateTarget(frozenDraft.sourceVideoId);
      return;
    }
    const target = documentRef.current.page.objects.find(({ id }) => id === activeTargetRef.current);
    if (target?.type !== "image") return;
    const source = target.data.source;
    if (!("kind" in source) || source.kind !== "video-frame") return;
    const video = documentRef.current.page.objects.find((object) =>
      object.type === "video-card" && object.data.assetId === source.videoAssetId);
    if (!video || video.type !== "video-card") return;
    const selected = intentSelectionRef.current.selectedObjectIds.includes(target.id);
    const linked = documentRef.current.page.annotations.some(({ targetObjectIds }) => targetObjectIds.includes(target.id));
    const shouldDiscard = discardDraftFrame && !selected && !linked;
    if (video.data.timeMs !== source.timeMs || shouldDiscard) {
      const next = structuredClone(documentRef.current);
      const nextVideo = next.page.objects.find(({ id }) => id === video.id);
      if (nextVideo?.type === "video-card") nextVideo.data.timeMs = source.timeMs;
      if (shouldDiscard) {
        next.page.objects = next.page.objects.filter(({ id }) => id !== target.id);
        const assetStillReferenced = next.page.objects.some((object) =>
          object.type === "image" ? object.data.assetId === target.data.assetId
            : object.type === "video-card" ? object.data.assetId === target.data.assetId || object.data.posterAssetId === target.data.assetId
              : false);
        if (!assetStillReferenced) delete next.page.assets[target.data.assetId];
      }
      await saveDocument(next);
    }
    activateTarget(video.id);
  };

  useEffect(() => {
    const keyMap: Record<string, WhiteboardTool> = { p: "pen", a: "arrow", r: "rectangle", t: "text", e: "eraser", m: "pin" };
    const down = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input,textarea,[contenteditable=true]")) return;
      const shortcutTool = keyMap[event.key.toLowerCase()];
      if (shortcutTool) void chooseAnnotationTool(shortcutTool);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) annotatorRef.current?.redo();
        else annotatorRef.current?.undo();
      }
      if (event.key === "Escape") setTool("select");
    };
    window.addEventListener("keydown", down);
    return () => { window.removeEventListener("keydown", down); };
  }, [chooseAnnotationTool]);

  const activeTargetCandidate = frozenVideoDraft?.target.id === activeTargetId
    ? frozenVideoDraft.target
    : document.page.objects.find(({ id }) => id === activeTargetId);
  const activeTargetBase = activeTargetCandidate?.type === "image" || activeTargetCandidate?.type === "video-card"
    ? activeTargetCandidate
    : undefined;
  const activeTarget = activeTargetBase?.type === "video-card" && videoResumeTime?.videoId === activeTargetBase.id
    ? { ...activeTargetBase, data: { ...activeTargetBase.data, timeMs: videoResumeTime.timeMs } }
    : activeTargetBase;
  const composerItems = useMemo<ComposerItem[]>(() => intentSelection.selectedObjectIds.flatMap((id) => {
    const object = document.page.objects.find((candidate) => candidate.id === id);
    if (!object || (object.type !== "image" && object.type !== "video-card")) return [];
    if (object.type === "video-card") return [{
      id: object.id,
      assetId: object.data.posterAssetId ?? object.data.assetId,
      label: object.data.fileName,
      timeLabel: formatTimecode(object.data.timeMs),
    }];
    const source = object.data.source;
    const frame = "kind" in source && source.kind === "video-frame" ? source : undefined;
    return [{
      id: object.id,
      assetId: object.data.assetId,
      label: object.data.alt || "Image",
      ...(frame ? { timeLabel: formatTimecode(frame.timeMs) } : {}),
    }];
  }), [document.page.objects, intentSelection.selectedObjectIds]);
  const activePrompt = view.promptDrafts[document.page.id] ?? "";
  const activeImageSource = activeTarget?.type === "image" ? activeTarget.data.source : undefined;
  const activeFrameSource = activeImageSource && "kind" in activeImageSource && activeImageSource.kind === "video-frame"
    ? activeImageSource
    : undefined;
  const annotationSessionActive = activeTarget?.type === "image" && (tool !== "select" || draftStatus.markCount > 0);

  const openMediaPicker = (replaceExisting: boolean) => {
    replaceOnNextMediaSelection.current = replaceExisting;
    if (fileInput.current) fileInput.current.value = "";
    fileInput.current?.click();
  };

  if (displayMode !== "fullscreen") {
    return (
      <ReviewLauncher
        authorized={authorized}
        connected={connected}
        projectDir={pendingProject}
        imageCount={document.page.objects.filter(({ type }) => type === "image").length}
        videoCount={document.page.objects.filter(({ type }) => type === "video-card").length}
        annotationCount={document.page.annotations.length}
        error={error}
        onOpen={() => void openReviewer()}
      />
    );
  }

  if (!authorized) {
    return (
      <main className="authorization-screen">
        <div className="authorization-card">
          <span className="authorization-icon">R</span>
          <h1>Renoise Annotation Board</h1>
          <p>The annotation board stores media, annotations, and requests in the project below. The server will access it only after you approve.</p>
          <code>{pendingProject || "Waiting for the host to provide a project directory…"}</code>
          <button className="approve-button" disabled={!connected || !pendingProject} onClick={() => void approve()}>Approve directory</button>
          {error && <p className="inline-error">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className={`whiteboard-app focused-review-app ${view.theme}`} data-theme={view.theme}>
      <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" onChange={(event) => {
        const file = event.target.files?.[0];
        const replaceExisting = replaceOnNextMediaSelection.current;
        replaceOnNextMediaSelection.current = false;
        if (file) void importSelectedMedia(file, replaceExisting).catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
        event.target.value = "";
      }} />
      <section className="review-workspace">
        <div className="review-stage-shell">
          <div className="review-stage-heading">
            <div className="review-stage-heading-main">
              {activeTarget ? <button type="button" disabled={stageBusy || Boolean(videoTransfer)} onClick={() => openMediaPicker(true)}><Upload />Replace media</button> : null}
              <span>{activeTarget?.type === "video-card" ? <Film /> : null}{activeTarget?.type === "video-card" ? activeTarget.data.fileName : activeTarget?.type === "image" ? activeTarget.data.alt || "Image" : "Waiting for media"}</span>
            </div>
            {activeFrameSource ? <button type="button" onClick={() => void returnToSourceVideo(true)}><ArrowLeft />Choose another video frame</button> : null}
          </div>
          <div className={`review-stage ${stageBusy ? "busy" : ""}`}>
            {activeTarget?.type === "video-card" ? (
              <VideoReviewStage
                ref={videoStageRef}
                video={activeTarget}
                readVideoAsset={readVideoAsset}
              />
            ) : activeTarget?.type === "image" ? (
              <FixedMediaAnnotator
                key={activeTarget.id}
                ref={annotatorRef}
                target={activeTarget}
                tool={tool}
                readAsset={readDisplayAssetUrl}
                resetKey={draftResetKey}
                onStateChange={setDraftStatus}
              />
            ) : (
              <button type="button" className="empty-media-stage" onClick={() => openMediaPicker(false)}><Upload /><strong>Add an image or video</strong><span>Supports PNG, JPEG, WebP, GIF, MP4, and WebM</span></button>
            )}
          </div>
          {videoTransfer ? (
            <div className="stage-transfer" role="status">
              <progress max={Math.max(1, videoTransfer.total)} value={videoTransfer.phase === "process" ? undefined : videoTransfer.loaded} />
              <span>{videoTransfer.phase === "process" ? "Creating a compatible playback file…" : `${Math.round(videoTransfer.loaded / Math.max(1, videoTransfer.total) * 100)}%`}</span>
              {videoTransfer.phase !== "process" ? <button type="button" onClick={() => videoTransferController.current?.abort(new DOMException("The user canceled the video upload", "AbortError"))}>Cancel</button> : null}
            </div>
          ) : null}
        </div>
      </section>
      <section className="review-action-dock" aria-label="Annotations and revision instructions">
        <AnnotationToolbar
          active={tool}
          canUndo={draftStatus.canUndo}
          canRedo={draftStatus.canRedo}
          canAdd={activeTarget?.type === "image" && draftStatus.markCount > 0}
          showCancel={annotationSessionActive}
          showAdd={annotationSessionActive}
          busy={stageBusy || saveStatus === "saving"}
          onChange={(nextTool) => void chooseAnnotationTool(nextTool)}
          onUndo={() => annotatorRef.current?.undo()}
          onRedo={() => annotatorRef.current?.redo()}
          onCancel={() => {
            annotatorRef.current?.clear();
            setDraftResetKey((value) => value + 1);
            setTool("select");
            if (activeFrameSource && !intentSelection.selectedObjectIds.includes(activeTargetId)) void returnToSourceVideo(true);
          }}
          onAdd={() => void addActiveToIntent()}
        />
        <Composer
        items={composerItems}
        activeItemId={composerItems.some(({ id }) => id === activeTarget?.id) ? activeTarget?.id : composerItems.at(-1)?.id}
        prompt={activePrompt}
        disabled={stageBusy || Boolean(videoTransfer) || saveStatus === "saving"}
        readAsset={readAssetUrl}
        readAssetFallback={readDisplayAssetUrl}
        onItemChange={activateTarget}
        onItemRemove={(targetId) => void removeIntentSource(targetId).catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))}
        onImportImage={(file) => void importSelectedMedia(file)
          .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))}
        onPromptChange={updatePromptDraft}
        onSubmit={async ({ instruction, itemIds }) => {
          await saveChain.current;
          const selectedIds = itemIds;
          if (!selectedIds.length) throw new Error("Complete an annotation and add its snapshot to the prompt first");
          const annotatedTargetIds = new Set(documentRef.current.page.annotations
            .filter(({ markObjectIds }) => markObjectIds.length > 0)
            .flatMap(({ targetObjectIds }) => targetObjectIds));
          if (selectedIds.some((id) => !annotatedTargetIds.has(id))) {
            throw new Error("Each image or video frame needs at least one annotation before submission");
          }
          const selectedObjects = new Map(documentRef.current.page.objects.map((object) => [object.id, object]));
          const hasVideoFrameAnnotation = selectedIds.some((id) => {
            const object = selectedObjects.get(id);
            if (object?.type !== "image") return object?.type === "video-card";
            const source = object.data.source;
            return "kind" in source && source.kind === "video-frame";
          });
          await saveSelection(selectedIds);
          // Prevent an older debounced draft write from racing the server's
          // submit-and-clear transaction and resurrecting the sent prompt.
          clearTimeout(viewSaveTimer.current);
          const payload = await call("submit_renoise_whiteboard_revision_intent", {
            canvasSessionId: sessionRef.current,
            expectedRevision: documentRef.current.page.revision,
            instruction,
          });
          const revisionIntentId = payload.revisionIntent?.id as string | undefined;
          if (!revisionIntentId) throw new Error("The server did not return an annotation request ID");
          applyPayload(payload);
          setActiveTargetId("");
          activeTargetRef.current = "";
          setTool("select");
          setDraftResetKey((value) => value + 1);
          await app.sendMessage({
            role: "user",
            content: [{
              type: "text",
              text: `${hasVideoFrameAnnotation ? "This is a time-local edit request for the source video. By default, remake the source-video segment at each annotated timestamp and preserve the rest of the original video. Unless my text explicitly asks for a new clip, do not interpret an annotation snapshot as the first or last frame of a separate video. " : ""}Generate the final result from the Renoise structured annotation request I just submitted and reply directly in this conversation. canvasSessionId=${sessionRef.current}, revisionIntentId=${revisionIntentId}.`,
            }],
          });
          await returnToConversation();
        }}
        />
      </section>
      {saveStatus === "conflict" ? (
        <div className="conflict-banner" role="alert">
          <span>The server version has changed. Reload before continuing.</span>
          <button onClick={() => void refresh({ forceAssetRead: true, reason: "Version conflict" })}>Reload</button>
        </div>
      ) : error ? <button className="error-toast" onClick={() => setError("")}>{error}</button> : null}
    </main>
  );
}
