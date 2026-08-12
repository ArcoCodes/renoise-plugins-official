import { randomUUID } from "node:crypto";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AbortImageUploadInput,
  AbortVideoUploadInput,
  AppendImageUploadInput,
  AppendVideoUploadInput,
  AuthorizeInput,
  BeginImageUploadInput,
  BeginImageReadInput,
  BeginVideoReadInput,
  BeginVideoUploadInput,
  CloseImageReadInput,
  CloseVideoReadInput,
  ExportInput,
  FinalizeImageUploadInput,
  FinalizeVideoUploadInput,
  GetVideoUploadFinalizeStatusInput,
  GetStateInput,
  GetRevisionIntentInput,
  ReadImageChunkInput,
  ReadVideoChunkInput,
  RenderInput,
  SaveSelectionInput,
  SaveStateInput,
  SaveViewInput,
  SessionInput,
  SubmitRevisionIntentInput,
} from "../../shared/tool-contracts.js";
import { WhiteboardError } from "../../shared/errors.js";
import { describeRevisionIntent } from "../../shared/revision-intent-context.js";
import type { SessionStore } from "../session/session-store.js";
import type { ProjectStore } from "../storage/project-store.js";
import type { MediaGateway } from "../media/media-gateway.js";
import { WHITEBOARD_RESOURCE_URI } from "../resource-uri.js";

const appMeta = (visibility: Array<"model" | "app">) => ({
  ui: { resourceUri: WHITEBOARD_RESOURCE_URI, visibility },
});
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const READ_LEASE = { ...READ_ONLY, idempotentHint: false };
const APP_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const APP_ABORT = { ...APP_WRITE, destructiveHint: true };

function result(data: unknown, summary: string) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: data as Record<string, unknown>,
  };
}

function failed(error: unknown) {
  const known = error instanceof WhiteboardError
    ? error
    : new WhiteboardError("INTERNAL", error instanceof Error ? error.message : String(error));
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${known.code}: ${known.message}` }],
    structuredContent: { ok: false, error: { code: known.code, message: known.message, details: known.details } },
  };
}

function guarded<T extends unknown[]>(callback: (...args: T) => Promise<any>): (...args: T) => Promise<any> {
  return async (...args: T): Promise<any> => {
    try { return await callback(...args); } catch (error) { return failed(error); }
  };
}

export function registerWhiteboardTools(
  server: McpServer,
  sessions: SessionStore,
  store: ProjectStore,
  mediaGateway: MediaGateway,
) {
  // Some MCP Apps-capable desktop hosts render the app and proxy app-only tool
  // calls without advertising the optional MCP initialize extension. The
  // authorization boundary therefore cannot rely on that declaration. Keep
  // credentials server-side, require an exact pending directory, and expose
  // mutating tools as app-only metadata; the host remains the UI trust anchor.
  const appGuarded = <T extends unknown[]>(callback: (...args: T) => Promise<any>) =>
    guarded(callback);

  registerAppTool(server, "render_renoise_whiteboard_widget", {
    title: "Open Renoise annotation board",
    description: "Open the compact launcher for the Renoise annotation board. Call only after the user explicitly asks to open it or accepts an offer to annotate media; never invoke it automatically during normal generation. The user must approve the exact project directory before any files are accessed.",
    inputSchema: RenderInput,
    _meta: appMeta(["model", "app"]),
    annotations: { ...READ_ONLY, idempotentHint: false },
  }, appGuarded(async ({ projectDir, pageName }) => {
    const session = sessions.create(projectDir, pageName);
    return result({
      ok: true,
      authorization: { state: session.state, projectDir: session.requestedProjectDir },
    }, `Created a pending Renoise annotation-board session for ${session.requestedProjectDir}. The compact launcher lets the user approve and open it.`);
  }));

  registerAppTool(server, "authorize_renoise_whiteboard_workspace", {
    title: "Approve whiteboard project",
    description: "Approve the exact project shown in the whiteboard. Callable only from the app after a user click.",
    inputSchema: AuthorizeInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ approvedProjectDir }) => {
    const session = await sessions.authorizePending(approvedProjectDir);
    await store.initialize(session, session.requestedPageName);
    const state = await store.getState(session);
    return result({
      ok: true,
      canvasSessionId: session.id,
      authorization: { state: "active", projectDir: session.projectDir },
      assetGateway: mediaGateway.describe(session),
      ...state,
    }, "Whiteboard project approved.");
  }));

  registerAppTool(server, "get_renoise_whiteboard_state", {
    title: "Load whiteboard",
    description: "Load the authorized whiteboard state. App-only.",
    inputSchema: GetStateInput,
    _meta: appMeta(["app"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId }) => {
    const session = sessions.get(canvasSessionId);
    return result({
      ok: true,
      canvasSessionId,
      assetGateway: mediaGateway.describe(session),
      ...(await store.getState(session)),
    }, "Whiteboard state loaded.");
  }));

  registerAppTool(server, "save_renoise_whiteboard_state", {
    title: "Save whiteboard",
    description: "CAS-save a complete versioned whiteboard document. App-only.",
    inputSchema: SaveStateInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, expectedRevision, document }) => {
    const session = sessions.get(canvasSessionId);
    const saved = await store.saveDocument(session, document, expectedRevision);
    return result({ ok: true, document: saved, revision: saved.page.revision }, `Whiteboard saved at revision ${saved.page.revision}.`);
  }));

  registerAppTool(server, "save_renoise_whiteboard_selection", {
    title: "Save whiteboard selection",
    description: "Save explicit selection bound to the current document revision. App-only.",
    inputSchema: SaveSelectionInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, selection }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, selection: await store.saveSelection(session, selection) }, "Selection saved.");
  }));

  registerAppTool(server, "submit_renoise_whiteboard_revision_intent", {
    title: "Submit structured annotation request",
    description: "Create a structured annotation request from the app's current explicit source, annotations, and instruction. App-only.",
    inputSchema: SubmitRevisionIntentInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, expectedRevision, instruction }) => {
    const session = sessions.get(canvasSessionId);
    const submitted = await store.submitRevisionIntent(session, { expectedRevision, instruction });
    return result({
      ok: true,
      canvasSessionId,
      ...submitted,
    }, `Submitted structured annotation request ${submitted.revisionIntent.id} and cleared the active draft.`);
  }));

  registerAppTool(server, "save_renoise_whiteboard_view", {
    title: "Save whiteboard camera",
    description: "Save camera and theme independently from the document. App-only.",
    inputSchema: SaveViewInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, view }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, view: await store.saveView(session, view) }, "Whiteboard view saved.");
  }));

  registerAppTool(server, "begin_renoise_whiteboard_image_upload", {
    title: "Begin chunked whiteboard image upload",
    description: "Create a short-lived, session-bound image upload when the optional loopback media gateway is unavailable. The source is persisted inside the approved project; only bounded chunks cross the app bridge.",
    inputSchema: BeginImageUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, expectedRevision, fileName, mimeType, byteLength, width, height }) => {
    const session = sessions.get(canvasSessionId);
    return result({
      ok: true,
      ...(await store.beginImageUpload(session, { expectedRevision, fileName, mimeType, byteLength, width, height })),
    }, `Started bounded image upload for ${fileName}.`);
  }));

  registerAppTool(server, "append_renoise_whiteboard_image_upload", {
    title: "Append whiteboard image chunk",
    description: "Append one canonical base64 chunk of at most 24 KiB at the exact next index and byte offset. App-only compatibility transport.",
    inputSchema: AppendImageUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, uploadId, index, offset, dataBase64 }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.appendImageUpload(session, { uploadId, index, offset, dataBase64 })) }, `Accepted image chunk ${index}.`);
  }));

  registerAppTool(server, "finalize_renoise_whiteboard_image_upload", {
    title: "Finalize whiteboard image upload",
    description: "Verify the completed image, atomically promote it to an opaque project-local asset, and commit it with revision CAS. App-only.",
    inputSchema: FinalizeImageUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, uploadId }) => {
    const session = sessions.get(canvasSessionId);
    const finalized = await store.finalizeImageUpload(session, uploadId);
    return result({ ok: true, ...finalized }, `Imported image asset ${finalized.asset.id}.`);
  }));

  registerAppTool(server, "abort_renoise_whiteboard_image_upload", {
    title: "Abort whiteboard image upload",
    description: "Close and remove a session-bound incomplete image upload. App-only.",
    inputSchema: AbortImageUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_ABORT,
  }, appGuarded(async ({ canvasSessionId, uploadId }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.abortImageUpload(session, uploadId)) }, "Image upload aborted.");
  }));

  registerAppTool(server, "begin_renoise_whiteboard_video_upload", {
    title: "Begin chunked whiteboard video upload",
    description: "Create a short-lived, session-bound upload for an MP4/WebM selected in the app. No paths or full-video data URLs are accepted.",
    inputSchema: BeginVideoUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, expectedRevision, fileName, mimeType, byteLength, durationMs, createPlaybackProxy }) => {
    const session = sessions.get(canvasSessionId);
    return result({
      ok: true,
      ...(await store.beginVideoUpload(session, {
        expectedRevision,
        fileName,
        mimeType,
        byteLength,
        durationMs,
        createPlaybackProxy,
      })),
    }, `Started bounded video upload for ${fileName}.`);
  }));

  registerAppTool(server, "append_renoise_whiteboard_video_upload", {
    title: "Append whiteboard video chunk",
    description: "Append one canonical base64 chunk at the exact next index and byte offset. App-only.",
    inputSchema: AppendVideoUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_WRITE,
  }, appGuarded(async ({ canvasSessionId, uploadId, index, offset, dataBase64 }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.appendVideoUpload(session, { uploadId, index, offset, dataBase64 })) }, `Accepted video chunk ${index}.`);
  }));

  registerAppTool(server, "finalize_renoise_whiteboard_video_upload", {
    title: "Finalize whiteboard video upload",
    description: "Verify the completed video, atomically promote it to an opaque asset, and commit it with revision CAS. App-only.",
    inputSchema: FinalizeVideoUploadInput,
    _meta: appMeta(["app"]),
    annotations: { ...APP_WRITE, idempotentHint: true },
  }, appGuarded(async ({ canvasSessionId, uploadId }) => {
    const session = sessions.get(canvasSessionId);
    const started = await store.startVideoUploadFinalize(session, uploadId);
    return result({ ok: true, ...started }, "Video verification and compatibility processing started.");
  }));

  registerAppTool(server, "get_renoise_whiteboard_video_upload_status", {
    title: "Get whiteboard video processing status",
    description: "Poll a previously finalized video upload without holding an MCP request open while compatibility media is generated. App-only.",
    inputSchema: GetVideoUploadFinalizeStatusInput,
    _meta: appMeta(["app"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId, uploadId }) => {
    const session = sessions.get(canvasSessionId);
    const status = store.getVideoUploadFinalizeStatus(session, uploadId);
    return result({ ok: true, ...status }, status.status === "complete" ? "Video import completed." : "Video import is still processing.");
  }));

  registerAppTool(server, "abort_renoise_whiteboard_video_upload", {
    title: "Abort whiteboard video upload",
    description: "Close and remove a session-bound incomplete video upload. App-only.",
    inputSchema: AbortVideoUploadInput,
    _meta: appMeta(["app"]),
    annotations: APP_ABORT,
  }, appGuarded(async ({ canvasSessionId, uploadId }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.abortVideoUpload(session, uploadId)) }, "Video upload aborted.");
  }));

  registerAppTool(server, "begin_renoise_whiteboard_video_read", {
    title: "Begin verified whiteboard video read",
    description: "Verify an opaque video asset and create a short-lived bounded read lease. App-only.",
    inputSchema: BeginVideoReadInput,
    _meta: appMeta(["app"]),
    annotations: READ_LEASE,
  }, appGuarded(async ({ canvasSessionId, assetId }) => {
    const session = sessions.get(canvasSessionId);
    const { document } = await store.getState(session);
    const asset = document.page.assets[assetId];
    if (!asset) throw new WhiteboardError("ASSET_NOT_FOUND", "Asset does not belong to this session");
    return result({ ok: true, ...(await store.beginVideoRead(session, asset)) }, "Opened verified video read lease.");
  }));

  registerAppTool(server, "read_renoise_whiteboard_video_chunk", {
    title: "Read whiteboard video chunk",
    description: "Read at most 24 KiB from a verified session-bound video lease at an explicit offset. Compatibility fallback only; primary playback uses the loopback gateway.",
    inputSchema: ReadVideoChunkInput,
    _meta: appMeta(["app"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId, readLeaseId, offset, length }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.readVideoChunk(session, { readLeaseId, offset, length })) }, `Read video bytes at offset ${offset}.`);
  }));

  registerAppTool(server, "close_renoise_whiteboard_video_read", {
    title: "Close whiteboard video read",
    description: "Close a session-bound video read lease and its file handle. App-only.",
    inputSchema: CloseVideoReadInput,
    _meta: appMeta(["app"]),
    annotations: READ_LEASE,
  }, appGuarded(async ({ canvasSessionId, readLeaseId }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.closeVideoRead(session, readLeaseId)) }, "Video read lease closed.");
  }));

  registerAppTool(server, "begin_renoise_whiteboard_image_read", {
    title: "Begin verified whiteboard image read",
    description: "Verify an opaque image asset and create a short-lived bounded read lease. App-only.",
    inputSchema: BeginImageReadInput,
    _meta: appMeta(["app"]),
    annotations: READ_LEASE,
  }, appGuarded(async ({ canvasSessionId, assetId }) => {
    const session = sessions.get(canvasSessionId);
    const { document } = await store.getState(session);
    const asset = document.page.assets[assetId];
    if (!asset) throw new WhiteboardError("ASSET_NOT_FOUND", "Asset does not belong to this session");
    return result({ ok: true, ...(await store.beginImageRead(session, asset)) }, "Opened verified image read lease.");
  }));

  registerAppTool(server, "read_renoise_whiteboard_image_chunk", {
    title: "Read whiteboard image chunk",
    description: "Read at most 24 KiB from a verified session-bound image lease at an explicit offset. Compatibility fallback only; primary rendering uses the loopback gateway.",
    inputSchema: ReadImageChunkInput,
    _meta: appMeta(["app"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId, readLeaseId, offset, length }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.readImageChunk(session, { readLeaseId, offset, length })) }, `Read image bytes at offset ${offset}.`);
  }));

  registerAppTool(server, "close_renoise_whiteboard_image_read", {
    title: "Close whiteboard image read",
    description: "Close a session-bound image read lease and its file handle. App-only.",
    inputSchema: CloseImageReadInput,
    _meta: appMeta(["app"]),
    annotations: READ_LEASE,
  }, appGuarded(async ({ canvasSessionId, readLeaseId }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.closeImageRead(session, readLeaseId)) }, "Image read lease closed.");
  }));

  registerAppTool(server, "download_renoise_whiteboard_export", {
    title: "Save whiteboard export",
    description: "Save a PNG board or review snapshot generated by the app. App-only.",
    inputSchema: ExportInput,
    _meta: appMeta(["app"]),
    annotations: { ...READ_ONLY, idempotentHint: false },
  }, appGuarded(async ({ canvasSessionId, kind, dataUrl, annotationIds }) => {
    const session = sessions.get(canvasSessionId);
    const { document } = await store.getState(session);
    const byId = new Map(document.page.annotations.map((annotation) => [annotation.id, annotation]));
    const known = new Set(byId.keys());
    if (annotationIds.some((id) => !known.has(id))) throw new WhiteboardError("STALE_SELECTION", "Export contains an unknown annotation id");
    const provenance = annotationIds.map((id) => {
      const annotation = byId.get(id)!;
      return {
        annotationId: id,
        sourceAssetSha256: annotation.sourceAssetSha256,
        sourceTimeMs: annotation.sourceTimeMs,
      };
    });
    return result({ ok: true, exportId: `export_${randomUUID().replaceAll("-", "")}`, kind, ...store.validateExport(dataUrl), annotationIds, provenance }, `${kind} snapshot validated for browser download.`);
  }));

  registerAppTool(server, "get_renoise_whiteboard_selection", {
    title: "Read explicit whiteboard selection",
    description: "Read only objects and annotation groups the user explicitly selected in the active Renoise whiteboard.",
    inputSchema: SessionInput,
    _meta: appMeta(["app"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId }) => {
    const session = sessions.get(canvasSessionId);
    const { document, selection } = await store.getState(session);
    if (selection.documentRevision !== document.page.revision) throw new WhiteboardError("STALE_SELECTION", "Saved selection is stale");
    const selected = new Set(selection.selectedObjectIds);
    const selectedObjects = document.page.objects.filter(({ id }) => selected.has(id));
    const selectedAnnotationIds = new Set(selection.selectedAnnotationIds);
    const annotations = document.page.annotations.filter(({ id }) => selectedAnnotationIds.has(id));
    const contextIds = new Set(annotations.flatMap(({ targetObjectIds, markObjectIds }) => [...targetObjectIds, ...markObjectIds]));
    selection.selectedObjectIds.forEach((id) => contextIds.delete(id));
    const contextObjects = document.page.objects.filter(({ id }) => contextIds.has(id));
    const allObjects = [...selectedObjects, ...contextObjects];
    return result({
      ok: true,
      canvasSessionId,
      pageId: document.page.id,
      revision: document.page.revision,
      selectedObjectIds: selection.selectedObjectIds,
      selectedAnnotationIds: selection.selectedAnnotationIds,
      selectedObjects,
      contextObjects,
      objects: allObjects,
      annotations,
      assetIds: [...new Set(allObjects.flatMap((object) => "assetId" in object.data && object.data.assetId ? [object.data.assetId] : []))],
    }, `Read ${selectedObjects.length} explicitly selected object(s), ${contextObjects.length} annotation context object(s), and ${annotations.length} annotation group(s).`);
  }));

  registerAppTool(server, "get_renoise_whiteboard_revision_intent", {
    title: "Read structured annotation request",
    description: "Read a persisted structured annotation request from the currently authorized project page. Pass an exact revisionIntentId, or omit it to recover the latest saved annotation after a session restart.",
    inputSchema: GetRevisionIntentInput,
    _meta: appMeta(["model"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId, revisionIntentId }) => {
    const session = sessions.get(canvasSessionId);
    const revisionIntent = revisionIntentId
      ? await store.getRevisionIntent(session, revisionIntentId)
      : await store.getLatestRevisionIntent(session);
    const { document: activeDocument } = await store.getState(session);
    const document = revisionIntent.contextSnapshot ?? activeDocument;
    const wanted = new Set([...revisionIntent.targetObjectIds, ...revisionIntent.markObjectIds]);
    const objects = document.page.objects.filter(({ id }) => wanted.has(id));
    const annotations = document.page.annotations.filter(({ id }) => revisionIntent.selectedAnnotationIds.includes(id));
    const interpretation = describeRevisionIntent(revisionIntent, document);
    const sourceVideoIds = new Set(interpretation.sourceVideoAssetIds);
    const sourceVideoObjects = document.page.objects.filter((object) =>
      object.type === "video-card" && sourceVideoIds.has(object.data.assetId));
    const videoSummary = interpretation.defaultOperation === "source-video-segment-edit"
      ? " Default operation is a localized SOURCE VIDEO EDIT: preserve unannotated source footage and do not reinterpret timestamp screenshots as standalone first/last-frame generation unless the user explicitly requests a new clip."
      : "";
    return result({
      ok: true,
      canvasSessionId,
      resolvedBy: revisionIntentId ? "id" : "latest",
      revisionIntent,
      objects,
      sourceVideoObjects,
      annotations,
      interpretation,
      assetIds: interpretation.referenceAssetIds,
      sourceVideoAssetIds: interpretation.sourceVideoAssetIds,
      preparableAssetIds: interpretation.preparableAssetIds,
    }, `Read structured annotation request ${revisionIntent.id} with ${revisionIntent.sources.length} source(s) and ${revisionIntent.markObjectIds.length} mark(s).${videoSummary}`);
  }));

  registerAppTool(server, "prepare_renoise_whiteboard_references", {
    title: "Prepare selected whiteboard references",
    description: "Materialize opaque annotated images and source-video assets from this authorized session into a short-lived read-only directory for Renoise generation.",
    inputSchema: { ...SessionInput, assetIds: z.array(z.string()).min(1).max(20) },
    _meta: appMeta(["model"]),
    annotations: READ_ONLY,
  }, appGuarded(async ({ canvasSessionId, assetIds }) => {
    const session = sessions.get(canvasSessionId);
    return result({ ok: true, ...(await store.materializeReferences(session, assetIds)) }, `Prepared ${assetIds.length} trusted annotation/source asset(s) for 15 minutes.`);
  }));

}
