import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { createEmptyDocument, type SelectionState, type ViewState, type WhiteboardDocument } from "../../shared/document-schema.js";

declare global {
  interface Window {
    __mockCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
    __mockDisplayModes?: string[];
    __mockMessages?: Array<{ role: string; content: unknown[] }>;
    __mockDocument?: WhiteboardDocument;
    __mockView?: ViewState;
    __mockSelection?: SelectionState;
    __mockSessionActive?: boolean;
    __mockImageReadDelayMs?: number;
    __mockFailImageChunkReads?: boolean;
    __mockResourceReads?: string[];
    __mockResourceReadsAvailable?: boolean;
    __mockImportedAssetCount?: number;
    __mockStartEmpty?: boolean;
    __mockOmitRootParentIdInSaveResponse?: boolean;
    __startWhiteboardMockHost?: (iframe: HTMLIFrameElement) => Promise<void>;
  }
}

const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
window.__mockCalls = calls;
window.__mockDisplayModes = [];
window.__mockMessages = [];
window.__mockSessionActive = false;
window.__mockImageReadDelayMs = 300;
window.__mockFailImageChunkReads = false;
window.__mockResourceReads = [];
window.__mockResourceReadsAvailable = true;
window.__mockImportedAssetCount = 0;

const assetGateway = {
  schemaVersion: 1 as const,
  kind: "loopback-http" as const,
  origin: "http://127.0.0.1:48765",
  canvasSessionId: "session_mocked",
  accessToken: "c".repeat(64),
  expiresAt: "2099-01-01T00:00:00.000Z",
};

window.__startWhiteboardMockHost = async (iframe) => {
  let imageUpload: {
    id: string;
    fileName: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    byteLength: number;
    width: number;
    height: number;
    received: number;
    nextIndex: number;
  } | undefined;
  let document = window.__mockDocument ? structuredClone(window.__mockDocument) : createEmptyDocument("page_mocked", "Mock Review");
  if (!window.__mockDocument && !window.__mockStartEmpty) {
    const createdAt = new Date().toISOString();
    document.page.assets.asset_mock = {
      id: "asset_mock",
      relativePath: "assets/mock.png",
      mimeType: "image/png",
      sha256: "a".repeat(64),
      byteLength: 68,
      width: 160,
      height: 90,
      createdAt,
    };
    document.page.objects.push({
      id: "obj_source",
      type: "image",
      parentId: null,
      transform: { x: 120, y: 100, width: 160, height: 90, rotation: 0 },
      zIndex: 1,
      locked: false,
      hidden: false,
      style: {},
      data: { assetId: "asset_mock", alt: "source.png", source: { kind: "file-picker" } },
      createdAt,
      updatedAt: createdAt,
    });
    document.page.objects.push({
      id: "obj_mark",
      type: "rect",
      parentId: null,
      transform: { x: 190, y: 130, width: 90, height: 70, rotation: 0 },
      zIndex: 2,
      locked: false,
      hidden: false,
      style: { stroke: "#E64B22", strokeWidth: 2, fill: "transparent" },
      data: {},
      createdAt,
      updatedAt: createdAt,
    });
    document.page.annotations.push({
      id: "annotation_mock",
      targetObjectIds: ["obj_source"],
      markObjectIds: ["obj_mark"],
      sourceAssetSha256: "a".repeat(64),
      sourceTimeMs: null,
      status: "open",
      createdAt,
    });
  }
  window.__mockDocument = structuredClone(document);
  let view: ViewState = window.__mockView ? structuredClone(window.__mockView) : {
    schemaVersion: 1,
    pageId: document.page.id,
    camera: { x: 48, y: 32, zoom: 1.1 },
    theme: "light",
    promptDrafts: {},
  };
  window.__mockView = structuredClone(view);
  const mediaTransport = () => ({ assetGateway });
  let selection: SelectionState = window.__mockSelection ? structuredClone(window.__mockSelection) : {
    schemaVersion: 1,
    pageId: document.page.id,
    documentRevision: document.page.revision,
    selectedObjectIds: [],
    selectedAnnotationIds: [],
  };
  window.__mockSelection = structuredClone(selection);
  const bridge = new AppBridge(
    null,
    { name: "Renoise Mock Host", version: "1.0.0" },
    { serverTools: {}, message: { text: {} } },
    {
      hostContext: {
        theme: "light",
        locale: "zh-CN",
        platform: "web",
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen"],
        containerDimensions: { width: 1024, height: 700 },
      },
    },
  );
  bridge.onrequestdisplaymode = async ({ mode }) => {
    window.__mockDisplayModes?.push(mode);
    return { mode };
  };
  bridge.onmessage = async ({ role, content }) => {
    window.__mockMessages?.push({ role, content });
    return {};
  };
  bridge.onreadresource = async ({ uri }) => {
    window.__mockResourceReads?.push(uri);
    if (!window.__mockResourceReadsAvailable) throw new Error("MOCK_RESOURCE_UNAVAILABLE: historical app resource read was not forwarded");
    if (window.__mockImageReadDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, window.__mockImageReadDelayMs));
    }
    return {
      contents: [{ uri, mimeType: "image/png", blob: tinyPngBase64 }],
    };
  };
  bridge.oncalltool = async ({ name, arguments: args = {} }) => {
    calls.push({ name, arguments: args });
    let structuredContent: Record<string, unknown> = { ok: true };
    if (name === "authorize_renoise_whiteboard_workspace") {
      window.__mockSessionActive = true;
      structuredContent = {
        ok: true,
        canvasSessionId: "session_mocked",
        authorization: { state: "active", projectDir: "/tmp/renoise-mock" },
        document,
        view,
        selection,
        ...mediaTransport(),
      };
    } else if (name === "save_renoise_whiteboard_state") {
      const candidate = structuredClone((args as { document: WhiteboardDocument }).document);
      candidate.page.revision = document.page.revision + 1;
      document = candidate;
      window.__mockDocument = structuredClone(document);
      const responseDocument = structuredClone(document);
      if (window.__mockOmitRootParentIdInSaveResponse) {
        responseDocument.page.objects.forEach((object) => {
          if (object.parentId === null) delete (object as { parentId?: string | null }).parentId;
        });
      }
      structuredContent = { ok: true, document: responseDocument, revision: document.page.revision };
    } else if (name === "get_renoise_whiteboard_state") {
      if (!window.__mockSessionActive) {
        return {
          isError: true,
          content: [{ type: "text", text: "AUTHORIZATION_REQUIRED: Approve the exact project directory in the whiteboard first" }],
        };
      }
      structuredContent = {
        ok: true,
        document,
        view,
        selection: { ...selection, documentRevision: document.page.revision },
        ...mediaTransport(),
      };
    } else if (name === "save_renoise_whiteboard_view") {
      view = (args as { view: ViewState }).view;
      window.__mockView = structuredClone(view);
      structuredContent = { ok: true, view };
    } else if (name === "save_renoise_whiteboard_selection") {
      selection = structuredClone((args as { selection: SelectionState }).selection);
      window.__mockSelection = structuredClone(selection);
      structuredContent = { ok: true, selection };
    } else if (name === "submit_renoise_whiteboard_revision_intent") {
      structuredContent = {
        ok: true,
        canvasSessionId: "session_mocked",
        revisionIntent: {
          id: "intent_mocked",
          instruction: (args as { instruction: string }).instruction,
        },
      };
    } else if (name === "begin_renoise_whiteboard_image_upload") {
      const input = args as {
        expectedRevision: number;
        fileName: string;
        mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
        byteLength: number;
        width: number;
        height: number;
      };
      if (input.expectedRevision !== document.page.revision) {
        return {
          isError: true,
          content: [{ type: "text", text: "REVISION_CONFLICT: mock image upload revision is stale" }],
        };
      }
      imageUpload = {
        id: "upload_1234567890abcdef1234567890abcdef",
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteLength: input.byteLength,
        width: input.width,
        height: input.height,
        received: 0,
        nextIndex: 0,
      };
      structuredContent = {
        ok: true,
        uploadId: imageUpload.id,
        byteLength: imageUpload.byteLength,
        received: 0,
        nextIndex: 0,
        chunkBytes: 24 * 1024,
      };
    } else if (name === "append_renoise_whiteboard_image_upload") {
      const input = args as { uploadId: string; index: number; offset: number; dataBase64: string };
      if (!imageUpload || input.uploadId !== imageUpload.id || input.index !== imageUpload.nextIndex || input.offset !== imageUpload.received) {
        return {
          isError: true,
          content: [{ type: "text", text: "REVISION_CONFLICT: mock image chunk is out of sequence" }],
        };
      }
      const byteLength = atob(input.dataBase64).length;
      imageUpload.received += byteLength;
      imageUpload.nextIndex += 1;
      structuredContent = {
        ok: true,
        uploadId: imageUpload.id,
        received: imageUpload.received,
        nextIndex: imageUpload.nextIndex,
        complete: imageUpload.received === imageUpload.byteLength,
      };
    } else if (name === "finalize_renoise_whiteboard_image_upload") {
      const input = args as { uploadId: string };
      if (!imageUpload || input.uploadId !== imageUpload.id || imageUpload.received !== imageUpload.byteLength) {
        return {
          isError: true,
          content: [{ type: "text", text: "INVALID_MEDIA: mock image upload is incomplete" }],
        };
      }
      const nextAsset = (window.__mockImportedAssetCount ?? 0) + 1;
      window.__mockImportedAssetCount = nextAsset;
      const assetId = `asset_import_${nextAsset}`;
      const asset = {
        id: assetId,
        relativePath: `assets/${assetId}.png`,
        mimeType: imageUpload.mimeType,
        sha256: String(nextAsset).padStart(64, "0"),
        byteLength: imageUpload.byteLength,
        width: imageUpload.width,
        height: imageUpload.height,
        createdAt: new Date().toISOString(),
      };
      document.page.assets[assetId] = asset;
      document.page.revision += 1;
      window.__mockDocument = structuredClone(document);
      structuredContent = {
        ok: true,
        uploadId: imageUpload.id,
        fileName: imageUpload.fileName,
        asset,
        document,
        revision: document.page.revision,
      };
      imageUpload = undefined;
    } else if (name === "abort_renoise_whiteboard_image_upload") {
      imageUpload = undefined;
      structuredContent = { ok: true, aborted: true };
    } else if (name === "begin_renoise_whiteboard_image_read") {
      structuredContent = {
        ok: true,
        readLeaseId: "read_1234567890abcdef1234567890abcdef",
        assetId: (args as { assetId: string }).assetId,
        byteLength: atob(tinyPngBase64).length,
        mimeType: "image/png",
      };
    } else if (name === "read_renoise_whiteboard_image_chunk") {
      if (window.__mockFailImageChunkReads) {
        return {
          isError: true,
          content: [{ type: "text", text: "MOCK_CHUNK_FAILURE: simulated task-switch interruption" }],
        };
      }
      if (window.__mockImageReadDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, window.__mockImageReadDelayMs));
      }
      const offset = Number((args as { offset: number }).offset);
      const length = Number((args as { length: number }).length);
      const binary = atob(tinyPngBase64).slice(offset, offset + length);
      structuredContent = {
        ok: true,
        offset,
        byteLength: binary.length,
        dataBase64: btoa(binary),
        eof: offset + binary.length === atob(tinyPngBase64).length,
      };
    } else if (name === "close_renoise_whiteboard_image_read") {
      structuredContent = { ok: true, closed: true };
    }
    return { content: [], structuredContent };
  };
  bridge.oninitialized = () => {
    void bridge.sendToolInput({ arguments: { projectDir: "/tmp/renoise-mock" } });
    void bridge.sendToolResult({
      content: [],
      structuredContent: {
        ok: true,
        authorization: {
          state: "pending_authorization",
          projectDir: "/tmp/renoise-mock",
        },
      },
    });
  };
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
};
