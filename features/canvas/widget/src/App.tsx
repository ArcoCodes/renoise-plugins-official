import { App as McpApp, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WhiteboardDocumentSchema,
  SelectionStateSchema,
  ViewStateSchema,
  createEmptyDocument,
  type AnnotationRecord,
  type SelectionState,
  type ViewState,
  type WhiteboardDocument,
  type WhiteboardObject,
  type RenoiseMaterialReference,
} from "../../shared/document-schema.js";
import {
  AssetGatewayDescriptorSchema,
  assetGatewayHealthUrl,
  assetGatewayImportUrl,
  assetGatewayMediaUrl,
  assetGatewayMaterialUrl,
  type AssetGatewayDescriptor,
  type GatewayImportKind,
} from "../../shared/asset-gateway.js";
import {
  fitMediaSize,
  reviewTargetIds,
  selectedMediaKind,
} from "../../shared/ui-helpers.js";
import { History } from "./canvas/history.js";
import { Composer, type ComposerItem, type OutputResolution } from "./composer/Composer.js";
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
import { formatComposerFrameTime, formatTimecode, prepareVideoFile } from "./inspector/video-utils.js";
import { ReviewLauncher } from "./launcher/ReviewLauncher.js";
import { AnnotationToolbar } from "./toolbar/AnnotationToolbar.js";
import type { AnnotationShape, AnnotationTool } from "./frame-annotator/annotation-types.js";
import { ReshootMediaStage, type ReshootMediaStageHandle } from "./review/ReshootMediaStage.js";
import { annotationShapesToObjects } from "./review/annotation-shape-to-object.js";
import { randomIdToken } from "./random-id.js";

declare const __RENOISE_WIDGET_BUILD_ID__: string;

type Payload = Record<string, any>;
type DisplayMode = "inline" | "fullscreen" | "pip";
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
  { name: "Renoise Visual Edit", version: "1.0.0" },
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

export function App() {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [pendingProject, setPendingProject] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [autoOpenRequested, setAutoOpenRequested] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("inline");
  const [document, setDocument] = useState<WhiteboardDocument>(() => createEmptyDocument("page_local"));
  const [view, setView] = useState<ViewState>({
    schemaVersion: 1,
    pageId: "page_local",
    camera: { x: 0, y: 0, zoom: 1 },
    theme: "light",
    promptDrafts: {},
    materialReferencePools: {},
  });
  const [intentSelection, setIntentSelection] = useState<SelectionState>({
    schemaVersion: 1,
    pageId: "page_local",
    documentRevision: 0,
    selectedObjectIds: [],
    selectedAnnotationIds: [],
  });
  const [tool, setTool] = useState<AnnotationTool | null>(null);
  const [activeColor, setActiveColor] = useState("#FF3B30");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed" | "conflict">("saved");
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState({ markCount: 0, canUndo: false, canRedo: false, selectedId: null as string | null, textEditing: false });
  const [draftResetKey, setDraftResetKey] = useState(0);
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [activeTargetId, setActiveTargetId] = useState("");
  const [focusedComposerItemId, setFocusedComposerItemId] = useState("");
  const [videoTransfer, setVideoTransfer] = useState<{ phase: "upload" | "process" | "read"; loaded: number; total: number }>();
  const [stageBusy, setStageBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceOnNextMediaSelection = useRef(false);
  const annotatorRef = useRef<ReshootMediaStageHandle>(null);
  const intentSelectionRef = useRef(intentSelection);
  const documentRef = useRef(document);
  const viewRef = useRef(view);
  const sessionRef = useRef(sessionId);
  const authorizedRef = useRef(authorized);
  const pendingProjectRef = useRef(pendingProject);
  const activeTargetRef = useRef(activeTargetId);
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
  useEffect(() => { authorizedRef.current = authorized; }, [authorized]);
  useEffect(() => { pendingProjectRef.current = pendingProject; }, [pendingProject]);
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

  const clearSessionScopedState = useCallback(() => {
    clearTimeout(viewSaveTimer.current);
    assetGatewayRef.current = undefined;
    assetGatewayHealth.current = undefined;
    assetGatewayUnavailableUntil.current = 0;
    imageAssetBlobs.current.clear();
    imageAssetElements.current.clear();
    imageAssetUrls.current.clear();
    localAssetBlobUrls.current.clear();
    for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
    localBlobUrls.current.clear();
    const emptyDocument = createEmptyDocument("page_local");
    const emptyView = ViewStateSchema.parse({ schemaVersion: 1, pageId: "page_local", camera: { x: 0, y: 0, zoom: 1 }, theme: "light" });
    const emptySelection = SelectionStateSchema.parse({ schemaVersion: 1, pageId: "page_local", documentRevision: 0, selectedObjectIds: [], selectedAnnotationIds: [] });
    documentRef.current = emptyDocument;
    viewRef.current = emptyView;
    intentSelectionRef.current = emptySelection;
    activeTargetRef.current = "";
    setDocument(emptyDocument);
    setView(emptyView);
    setIntentSelection(emptySelection);
    setActiveTargetId("");
    setFocusedComposerItemId("");
    setTool(null);
    setDraftResetKey((value) => value + 1);
    history.current.reset(emptyDocument);
  }, []);

  const applyPayload = useCallback((payload: Payload) => {
    if (payload.authorization?.state === "pending_authorization") {
      authorizedRef.current = false;
      setAuthorized(false);
      clearSessionScopedState();
    }
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
    if (payload.authorization?.projectDir) {
      setPendingProject(payload.authorization.projectDir);
      pendingProjectRef.current = payload.authorization.projectDir;
    }
    if (payload.authorization?.state === "active") {
      authorizedRef.current = true;
      setAuthorized(true);
    }
    if (payload.requestedDisplayMode === "fullscreen") setAutoOpenRequested(true);
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
      const normalizedView = ViewStateSchema.parse(payload.view);
      setView(normalizedView);
      viewRef.current = normalizedView;
      const restoredTargetId = normalizedView.activeTargetId ?? "";
      setActiveTargetId(restoredTargetId);
      activeTargetRef.current = restoredTargetId;
    }
    if (payload.selection) {
      const restoredSelection = SelectionStateSchema.parse(payload.selection);
      setIntentSelection(restoredSelection);
      intentSelectionRef.current = restoredSelection;
    }
  }, [clearSessionScopedState, recordRecoveryDiagnostic]);

  useEffect(() => {
    app.ontoolinput = (params) => {
      const input = params.arguments ?? {};
      if (typeof input.canvasSessionId === "string") {
        if (sessionRef.current && input.canvasSessionId !== sessionRef.current) {
          authorizedRef.current = false;
          setAuthorized(false);
          clearSessionScopedState();
        }
        setSessionId(input.canvasSessionId);
        sessionRef.current = input.canvasSessionId;
      }
      if (typeof input.projectDir === "string") {
        if (authorizedRef.current || input.projectDir !== pendingProjectRef.current) {
          authorizedRef.current = false;
          setAuthorized(false);
          clearSessionScopedState();
          setSessionId("");
          sessionRef.current = "";
        }
        setPendingProject(input.projectDir);
        pendingProjectRef.current = input.projectDir;
      }
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
  }, [applyPayload, clearSessionScopedState, recordRecoveryDiagnostic]);

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

  useEffect(() => {
    if (!connected || !authorized || !autoOpenRequested) return;
    setAutoOpenRequested(false);
    if (displayMode !== "fullscreen") void requestFullscreen();
  }, [authorized, autoOpenRequested, connected, displayMode, requestFullscreen]);

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
      const authorize = (canvasSessionId: string) => call("authorize_renoise_whiteboard_workspace", { approvedProjectDir: pendingProject, canvasSessionId });
      let payload: Payload;
      try {
        payload = await authorize(sessionRef.current);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        if (!message.includes("AUTHORIZATION_REQUIRED")) throw caught;
        // A task switch can preserve the iframe while the local MCP process (and
        // its in-memory pending session) has restarted. Recreate only the exact
        // project shown in the approval UI, then consume the same user click.
        const recreated = await call("render_renoise_whiteboard_widget", { projectDir: pendingProject });
        applyPayload(recreated);
        payload = await authorize(String(recreated.canvasSessionId ?? ""));
      }
      applyPayload(payload);
      authorizedRef.current = true;
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

  const materialPreviewUrl = useCallback((materialId: number) => {
    const descriptor = assetGatewayRef.current;
    return descriptor ? assetGatewayMaterialUrl(descriptor, materialId) : undefined;
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

  const finalizeImportedTarget = async (targetId: string, replaceExisting: boolean) => {
    if (!replaceExisting) {
      activateTarget(targetId);
      return;
    }
    clearTimeout(viewSaveTimer.current);
    annotatorRef.current?.clear();
    setTool(null);
    setDraftStatus({ markCount: 0, canUndo: false, canRedo: false, selectedId: null, textEditing: false });
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
    setComposerResetKey((value) => value + 1);
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
        ...(prepared.width > 0 && prepared.height > 0
          ? { width: prepared.width, height: prepared.height }
          : {}),
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
          ...(prepared.width > 0 && prepared.height > 0
            ? { width: prepared.width, height: prepared.height }
            : {}),
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

  const importSelectedMedia = async (file: File, replaceExisting = false) => {
    if (stageBusy) throw new Error("The current media is still being processed. Try again shortly");
    setStageBusy(true);
    setTool(null);
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

  const chooseAnnotationTool = async (nextTool: AnnotationTool | null) => {
    if (stageBusy) return;
    const target = documentRef.current.page.objects.find(({ id }) => id === activeTargetRef.current);
    try {
      if (nextTool && target?.type === "video-card") void annotatorRef.current?.pauseAtReadyFrame();
      setTool(nextTool);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const persistAnnotatedSnapshot = async (
    target: Extract<WhiteboardObject, { type: "image" | "video-card" }>,
    snapshotBlob: Blob,
    sourceSize: { width: number; height: number },
    coordinateSize: { width: number; height: number },
    shapes: AnnotationShape[],
    frameTimeMs: number | null,
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
    const existingSource = target.type === "image" ? target.data.source : undefined;
    const existingFrame = existingSource && "kind" in existingSource && existingSource.kind === "video-frame" ? existingSource : undefined;
    const videoSha256 = target.type === "video-card" ? base.page.assets[target.data.assetId]?.sha256 : undefined;
    if (target.type === "video-card" && !videoSha256) throw new Error("Source-video integrity information is missing. Reload the annotation board");
    const videoFrame = target.type === "video-card"
      ? { kind: "video-frame" as const, videoAssetId: target.data.assetId, videoSha256: videoSha256!, timeMs: frameTimeMs ?? target.data.timeMs }
      : existingFrame;
    const snapshot: Extract<WhiteboardObject, { type: "image" }> = {
      id: objectId("snapshot"),
      type: "image",
      parentId: null,
      transform: target.type === "video-card"
        ? { ...target.transform, height: target.transform.width * coordinateSize.height / Math.max(1, coordinateSize.width), rotation: 0 }
        : { ...target.transform, rotation: 0 },
      zIndex: Math.max(0, ...base.page.objects.map(({ zIndex }) => zIndex)) + 1,
      locked: true,
      hidden: false,
      style: { role: "annotation-snapshot" },
      data: {
        assetId: payload.asset.id,
        alt: `${target.type === "video-card" ? `Video frame ${formatTimecode(videoFrame?.timeMs ?? 0)}` : target.data.alt || "Image"} · Annotated`,
        source: videoFrame ? { ...videoFrame } : { relation: "revision-of", objectId: target.id },
      },
      createdAt: now,
      updatedAt: now,
    };
    const markObjects = annotationShapesToObjects(shapes, snapshot, coordinateSize, now);
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
      const target = documentRef.current.page.objects.find(({ id }) => id === activeTargetRef.current);
      if (!target) throw new Error("Import an image or video first");
      if (target.type !== "image" && target.type !== "video-card") throw new Error("The current media does not support annotation");
      const draft = await annotatorRef.current?.snapshot();
      if (!draft) throw new Error("The annotation area is not ready yet");
      const snapshotId = await persistAnnotatedSnapshot(
        target,
        draft.blob,
        { width: draft.width, height: draft.height },
        draft.coordinateSize,
        draft.shapes,
        draft.timeMs,
      );
      await addIntentSource(snapshotId);
      setFocusedComposerItemId(snapshotId);
      annotatorRef.current?.clear();
      setDraftResetKey((value) => value + 1);
      setTool(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStageBusy(false);
    }
  };

  useEffect(() => {
    const keyMap: Record<string, AnnotationTool> = { p: "stroke", a: "arrow", r: "rect", t: "text" };
    const down = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input,textarea,[contenteditable=true]")) return;
      const shortcutTool = keyMap[event.key.toLowerCase()];
      if (shortcutTool) void chooseAnnotationTool(shortcutTool);
      if (event.key === "Escape") {
        if (draftStatus.selectedId) annotatorRef.current?.deselect();
        else if (draftStatus.markCount === 0) setTool(null);
      }
    };
    window.addEventListener("keydown", down);
    return () => { window.removeEventListener("keydown", down); };
  }, [chooseAnnotationTool, draftStatus.markCount, draftStatus.selectedId]);

  const activeTargetCandidate = document.page.objects.find(({ id }) => id === activeTargetId);
  const activeTargetBase = activeTargetCandidate?.type === "image" || activeTargetCandidate?.type === "video-card"
    ? activeTargetCandidate
    : undefined;
  const activeTarget = activeTargetBase;
  const composerItems = useMemo<ComposerItem[]>(() => intentSelection.selectedObjectIds.flatMap((id) => {
    const object = document.page.objects.find((candidate) => candidate.id === id);
    if (!object || (object.type !== "image" && object.type !== "video-card")) return [];
    if (object.type === "video-card") return [{
      id: object.id,
      assetId: object.data.posterAssetId ?? object.data.assetId,
      label: object.data.fileName,
      timeLabel: formatComposerFrameTime(object.data.timeMs),
    }];
    const source = object.data.source;
    const frame = "kind" in source && source.kind === "video-frame" ? source : undefined;
    return [{
      id: object.id,
      assetId: object.data.assetId,
      label: object.data.alt || "Image",
      ...(frame ? { timeLabel: formatComposerFrameTime(frame.timeMs) } : {}),
    }];
  }), [document.page.objects, intentSelection.selectedObjectIds]);
  const activePrompt = view.promptDrafts[document.page.id] ?? "";
  const materialPool = view.materialReferencePools[document.page.id] ?? [];
  const outputResolution: OutputResolution = view.outputResolution ?? "720p";
  const annotationSessionActive = Boolean(activeTarget) && (tool !== null || draftStatus.markCount > 0);
  const listComposerMaterials = useCallback(async (input: {
    search?: string;
    type?: "image" | "video";
    limit: number;
    offset: number;
  }) => {
    const payload = await call("list_renoise_whiteboard_materials", {
      canvasSessionId: sessionRef.current,
      ...input,
      type: "image",
    });
    return {
      materials: (payload.materials ?? []) as Array<RenoiseMaterialReference & {
        previewCapability?: boolean;
        previewUrl?: string;
      }>,
      hasMore: Boolean(payload.hasMore),
    };
  }, [call]);
  const updateComposerMaterialPool = useCallback((materials: RenoiseMaterialReference[]) => {
    const pageId = documentRef.current.page.id;
    persistView({
      ...viewRef.current,
      materialReferencePools: { ...viewRef.current.materialReferencePools, [pageId]: materials },
    });
  }, [persistView]);
  const updateComposerResolution = useCallback((nextResolution: OutputResolution) => {
    if (viewRef.current.outputResolution === nextResolution) return;
    persistView({ ...viewRef.current, outputResolution: nextResolution });
  }, [persistView]);

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
          <h1>Renoise Visual Edit</h1>
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
      <header className="reshoot-header">
        <button type="button" className="reshoot-close" aria-label="Return to conversation" title="Return to conversation" onClick={() => void returnToConversation()}>
          <X />
        </button>
        <h1>Renoise Visual Edit</h1>
        <div className="reshoot-header-actions">
          {activeTarget ? <button type="button" className="reshoot-replace-media" disabled={stageBusy || Boolean(videoTransfer)} onClick={() => openMediaPicker(true)}><Upload />Replace media</button> : null}
        </div>
      </header>
      <section className="review-workspace">
        <div className="review-stage-shell">
          <div className={`review-stage ${stageBusy ? "busy" : ""}`}>
            {activeTarget ? (
              <ReshootMediaStage
                key={activeTarget.id}
                ref={annotatorRef}
                target={activeTarget}
                activeTool={tool}
                activeColor={activeColor}
                readImageAsset={readDisplayAssetUrl}
                readVideoAsset={readVideoAsset}
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
        <ol className="reshoot-guide" aria-label="Annotation workflow">
          <li>{activeTarget?.type === "video-card" ? "Play the video and pause on the frame you want to edit." : "Review the image and locate the area you want to edit."}</li>
          <li>Use Marker to annotate what you want to change.</li>
        </ol>
        <AnnotationToolbar
          activeTool={tool}
          activeColor={activeColor}
          canUndo={draftStatus.canUndo}
          canRedo={draftStatus.canRedo}
          canAdd={Boolean(activeTarget) && draftStatus.markCount > 0}
          annotating={annotationSessionActive}
          busy={stageBusy || saveStatus === "saving"}
          keyboardEnabled={!draftStatus.textEditing}
          onToolChange={(nextTool) => void chooseAnnotationTool(nextTool)}
          onColorChange={(color) => {
            setActiveColor(color);
            annotatorRef.current?.recolorSelected(color);
          }}
          onUndo={() => annotatorRef.current?.undo()}
          onRedo={() => annotatorRef.current?.redo()}
          onDeleteSelected={() => annotatorRef.current?.deleteSelected()}
          onCancel={() => {
            annotatorRef.current?.clear();
            setDraftResetKey((value) => value + 1);
            setTool(null);
          }}
          onAdd={() => void addActiveToIntent()}
        />
        <Composer
        key={`${sessionId}:${document.page.id}:${composerResetKey}`}
        items={composerItems}
        activeItemId={composerItems.some(({ id }) => id === focusedComposerItemId) ? focusedComposerItemId : composerItems.at(-1)?.id}
        prompt={activePrompt}
        draftKey={`${sessionId}:${document.page.id}:${composerResetKey}`}
        materialPool={materialPool}
        outputResolution={outputResolution}
        disabled={stageBusy || Boolean(videoTransfer) || saveStatus === "saving"}
        readAsset={readAssetUrl}
        readAssetFallback={readDisplayAssetUrl}
        materialPreviewUrl={materialPreviewUrl}
        listMaterials={listComposerMaterials}
        onMaterialPoolChange={updateComposerMaterialPool}
        onItemChange={setFocusedComposerItemId}
        onImportImage={(file) => void importSelectedMedia(file)
          .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))}
        onPromptChange={updatePromptDraft}
        onOutputResolutionChange={updateComposerResolution}
        onSubmit={async ({ instruction, itemIds, materialIds }) => {
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
            outputResolution,
            materialIds,
          });
          const revisionIntentId = payload.revisionIntent?.id as string | undefined;
          if (!revisionIntentId) throw new Error("The server did not return an annotation request ID");
          applyPayload(payload);
          setActiveTargetId("");
          activeTargetRef.current = "";
          setTool(null);
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
