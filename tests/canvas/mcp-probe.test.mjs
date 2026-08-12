import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = resolve("features/canvas/dist/server.mjs");
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const videoChunkBytes = 24 * 1024;
const fakeMp4 = Buffer.alloc(videoChunkBytes + 257);
Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]).copy(fakeMp4);
const videoChunks = [fakeMp4.subarray(0, videoChunkBytes), fakeMp4.subarray(videoChunkBytes)];

async function pollVideoFinalize(client, canvasSessionId, uploadId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await client.callTool({
      name: "get_renoise_whiteboard_video_upload_status",
      arguments: { canvasSessionId, uploadId },
    });
    if (response.isError || response.structuredContent?.status === "complete") return response;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("video finalize did not complete");
}

test("MCP server exposes the widget resource and exact model/app visibility boundary", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-mcp-probe-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client(
    { name: "whiteboard-contract-test", version: "1.0.0" },
    { capabilities: { extensions: { "io.modelcontextprotocol/ui": {} } } },
  );
  context.after(() => client.close());
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.equal(tools.length, 26);
  assert.equal(tools.some(({ name }) => name === "save_renoise_whiteboard_video"), false);
  assert.equal(tools.some(({ name }) => name === "insert_renoise_whiteboard_media"), false);
  for (const name of [
    "begin_renoise_whiteboard_image_upload",
    "append_renoise_whiteboard_image_upload",
    "finalize_renoise_whiteboard_image_upload",
    "abort_renoise_whiteboard_image_upload",
  ]) assert.ok(tools.some((tool) => tool.name === name), `${name} must be registered`);
  const visible = new Map(tools.map((tool) => [tool.name, tool._meta?.ui?.visibility]));
  for (const name of [
    "render_renoise_whiteboard_widget",
    "get_renoise_whiteboard_revision_intent",
    "prepare_renoise_whiteboard_references",
  ]) {
    assert.ok(visible.get(name)?.includes("model"), `${name} must be model-visible`);
  }
  for (const [name, visibility] of visible) {
    if (!["render_renoise_whiteboard_widget", "get_renoise_whiteboard_revision_intent", "prepare_renoise_whiteboard_references"].includes(name)) {
      assert.deepEqual(visibility, ["app"], `${name} must remain app-only`);
    }
  }
  for (const tool of tools) {
    assert.equal(typeof tool.annotations?.readOnlyHint, "boolean", `${tool.name} must declare readOnlyHint`);
    assert.equal(typeof tool.annotations?.destructiveHint, "boolean", `${tool.name} must declare destructiveHint`);
    assert.equal(typeof tool.annotations?.idempotentHint, "boolean", `${tool.name} must declare idempotentHint`);
    assert.equal(typeof tool.annotations?.openWorldHint, "boolean", `${tool.name} must declare openWorldHint`);
  }

  const resources = await client.listResources();
  const whiteboard = resources.resources.find(({ uri }) => /^ui:\/\/renoise\/whiteboard-[a-f0-9]{12}\.html$/.test(uri));
  assert.ok(whiteboard, "whiteboard resource URI should be cache-busted by its widget build ID");
  assert.equal(whiteboard.title, "Renoise Annotation Board");
  assert.equal(whiteboard.name, "Renoise Annotation Board");
  assert.equal(whiteboard.icons?.[0]?.mimeType, "image/svg+xml");
  assert.match(whiteboard.icons?.[0]?.src ?? "", /^data:image\/svg\+xml;base64,/);
  const resource = await client.readResource({ uri: whiteboard.uri });
  const html = resource.contents[0].text;
  assert.match(html, /Renoise 标注板/);
  assert.match(html, /fabric-viewport/);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)/);
  const gatewayOrigins = resource.contents[0]._meta?.ui?.csp?.resourceDomains ?? [];
  assert.equal(gatewayOrigins.length, 2);
  assert.match(gatewayOrigins[0], /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(gatewayOrigins[1], "blob:");
  assert.deepEqual(resource.contents[0]._meta?.ui?.csp?.connectDomains, [gatewayOrigins[0]]);

  const opened = await client.callTool({
    name: "render_renoise_whiteboard_widget",
    arguments: { projectDir },
  });
  const pending = opened.structuredContent;
  assert.equal(pending.authorization.state, "pending_authorization");
  assert.equal(pending.canvasSessionId, undefined);
  assert.equal(pending.authorization.nonce, undefined);

  const approved = await client.callTool({
    name: "authorize_renoise_whiteboard_workspace",
    arguments: { approvedProjectDir: projectDir },
  });
  const canvasSessionId = approved.structuredContent.canvasSessionId;
  pending.canvasSessionId = canvasSessionId;
  assert.match(canvasSessionId, /^session_[a-f0-9]{32}$/);
  assert.equal(approved.structuredContent.authorization.state, "active");
  assert.equal(approved.structuredContent.document.page.revision, 0);
  assert.equal(approved.structuredContent.renderBootstrap, undefined);
  assert.match(approved.structuredContent.assetGateway.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(approved.structuredContent.assetGateway.accessToken, /^[a-f0-9]{64}$/);
  assert.ok(Buffer.byteLength(JSON.stringify(approved.structuredContent)) < 16 * 1024);

  const replay = await client.callTool({
    name: "authorize_renoise_whiteboard_workspace",
    arguments: { approvedProjectDir: projectDir },
  });
  assert.equal(replay.isError, true);
  assert.match(replay.content[0].text, /AUTHORIZATION_REQUIRED/);

  const imageBytes = Buffer.from(tinyPng.split(",")[1], "base64");
  const imageImportUrl = (expectedRevision, requestId) => {
    const url = new URL(`${approved.structuredContent.assetGateway.origin}/v1/imports/${canvasSessionId}/image`);
    url.searchParams.set("access_token", approved.structuredContent.assetGateway.accessToken);
    url.searchParams.set("expectedRevision", String(expectedRevision));
    url.searchParams.set("fileName", "probe.png");
    url.searchParams.set("byteLength", String(imageBytes.length));
    url.searchParams.set("width", "1");
    url.searchParams.set("height", "1");
    url.searchParams.set("requestId", requestId);
    return url;
  };
  const orphanedImport = await fetch(imageImportUrl(999, `upload_${"d".repeat(32)}`), {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: imageBytes,
  });
  assert.equal(orphanedImport.status, 409);
  const { readdir } = await import("node:fs/promises");
  const assetsDir = join(projectDir, ".renoise", "whiteboard", "pages", approved.structuredContent.document.page.id, "assets");
  assert.deepEqual(await readdir(assetsDir), []);

  const staleVideo = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 999,
      fileName: "review.mp4",
      mimeType: "video/mp4",
      byteLength: fakeMp4.length,
      durationMs: 1200,
    },
  });
  assert.equal(staleVideo.isError, true);
  assert.deepEqual(await readdir(assetsDir), []);

  const conflictedBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 0,
      fileName: "review.mp4",
      mimeType: "video/mp4",
      byteLength: fakeMp4.length,
      durationMs: 1200,
    },
  });
  const conflictedUploadId = conflictedBegin.structuredContent.uploadId;
  const outOfOrder = await client.callTool({
    name: "append_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      uploadId: conflictedUploadId,
      index: 1,
      offset: 0,
      dataBase64: videoChunks[0].toString("base64"),
    },
  });
  assert.equal(outOfOrder.isError, true);
  for (const [index, chunk] of videoChunks.entries()) {
    const appended = await client.callTool({
      name: "append_renoise_whiteboard_video_upload",
      arguments: {
        canvasSessionId: pending.canvasSessionId,
        uploadId: conflictedUploadId,
        index,
        offset: index * videoChunkBytes,
        dataBase64: chunk.toString("base64"),
      },
    });
    assert.equal(appended.structuredContent.received, Math.min(fakeMp4.length, (index + 1) * videoChunkBytes));
    if (index === 0) {
      const duplicate = await client.callTool({
        name: "append_renoise_whiteboard_video_upload",
        arguments: {
          canvasSessionId: pending.canvasSessionId,
          uploadId: conflictedUploadId,
          index,
          offset: 0,
          dataBase64: chunk.toString("base64"),
        },
      });
      assert.equal(duplicate.structuredContent.received, videoChunkBytes);
      assert.equal(duplicate.structuredContent.nextIndex, 1);
      const changed = Buffer.from(chunk);
      changed[changed.length - 1] ^= 1;
      const changedReplay = await client.callTool({
        name: "append_renoise_whiteboard_video_upload",
        arguments: {
          canvasSessionId: pending.canvasSessionId,
          uploadId: conflictedUploadId,
          index,
          offset: 0,
          dataBase64: changed.toString("base64"),
        },
      });
      assert.equal(changedReplay.isError, true);
    }
  }

  const importedResponse = await fetch(imageImportUrl(0, `upload_${"e".repeat(32)}`), {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: imageBytes,
  });
  assert.equal(importedResponse.status, 201);
  const imported = { structuredContent: await importedResponse.json() };
  assert.equal(imported.structuredContent.revision, 1);
  const templates = await client.listResourceTemplates();
  assert.equal(templates.resourceTemplates.some(({ uriTemplate }) => uriTemplate.startsWith("renoise-whiteboard://asset/")), false);
  const imageReadBegin = await client.callTool({
    name: "begin_renoise_whiteboard_image_read",
    arguments: { canvasSessionId: pending.canvasSessionId, assetId: imported.structuredContent.asset.id },
  });
  const imageRead = await client.callTool({
    name: "read_renoise_whiteboard_image_chunk",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      readLeaseId: imageReadBegin.structuredContent.readLeaseId,
      offset: 0,
      length: videoChunkBytes,
    },
  });
  assert.deepEqual(
    Buffer.from(imageRead.structuredContent.dataBase64, "base64"),
    Buffer.from(tinyPng.split(",")[1], "base64"),
  );
  assert.equal(imageRead.structuredContent.eof, true);
  await client.callTool({
    name: "close_renoise_whiteboard_image_read",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      readLeaseId: imageReadBegin.structuredContent.readLeaseId,
    },
  });
  const conflictedFinalize = await client.callTool({
    name: "finalize_renoise_whiteboard_video_upload",
    arguments: { canvasSessionId: pending.canvasSessionId, uploadId: conflictedUploadId },
  });
  assert.equal(conflictedFinalize.structuredContent.status, "processing");
  const conflictedStatus = await pollVideoFinalize(client, pending.canvasSessionId, conflictedUploadId);
  assert.equal(conflictedStatus.isError, true);
  assert.equal((await readdir(assetsDir)).filter((name) => name.endsWith(".mp4") || name.endsWith(".part")).length, 0);

  const validBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 1,
      fileName: "review.mp4",
      mimeType: "video/mp4",
      byteLength: fakeMp4.length,
      durationMs: 1200,
    },
  });
  for (const [index, chunk] of videoChunks.entries()) {
    await client.callTool({
      name: "append_renoise_whiteboard_video_upload",
      arguments: {
        canvasSessionId: pending.canvasSessionId,
        uploadId: validBegin.structuredContent.uploadId,
        index,
        offset: index * videoChunkBytes,
        dataBase64: chunk.toString("base64"),
      },
    });
  }
  const videoFinalizeStarted = await client.callTool({
    name: "finalize_renoise_whiteboard_video_upload",
    arguments: { canvasSessionId: pending.canvasSessionId, uploadId: validBegin.structuredContent.uploadId },
  });
  assert.equal(videoFinalizeStarted.structuredContent.status, "processing");
  const importedVideo = await pollVideoFinalize(client, pending.canvasSessionId, validBegin.structuredContent.uploadId);
  assert.equal(importedVideo.structuredContent.asset.mimeType, "video/mp4");
  assert.equal(importedVideo.structuredContent.revision, 2);

  const readBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_read",
    arguments: { canvasSessionId: pending.canvasSessionId, assetId: importedVideo.structuredContent.asset.id },
  });
  const firstRead = await client.callTool({
    name: "read_renoise_whiteboard_video_chunk",
    arguments: { canvasSessionId: pending.canvasSessionId, readLeaseId: readBegin.structuredContent.readLeaseId, offset: 0, length: videoChunkBytes },
  });
  assert.equal(firstRead.structuredContent.byteLength, videoChunkBytes);
  assert.equal(firstRead.structuredContent.eof, false);
  const finalRead = await client.callTool({
    name: "read_renoise_whiteboard_video_chunk",
    arguments: { canvasSessionId: pending.canvasSessionId, readLeaseId: readBegin.structuredContent.readLeaseId, offset: videoChunkBytes, length: videoChunkBytes },
  });
  assert.equal(finalRead.structuredContent.byteLength, 257);
  assert.equal(finalRead.structuredContent.eof, true);
  assert.deepEqual(Buffer.concat([
    Buffer.from(firstRead.structuredContent.dataBase64, "base64"),
    Buffer.from(finalRead.structuredContent.dataBase64, "base64"),
  ]), fakeMp4);
  await client.callTool({
    name: "close_renoise_whiteboard_video_read",
    arguments: { canvasSessionId: pending.canvasSessionId, readLeaseId: readBegin.structuredContent.readLeaseId },
  });
  const closedRead = await client.callTool({
    name: "read_renoise_whiteboard_video_chunk",
    arguments: { canvasSessionId: pending.canvasSessionId, readLeaseId: readBegin.structuredContent.readLeaseId, offset: 0, length: 1 },
  });
  assert.equal(closedRead.isError, true);

  const abortBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 2,
      fileName: "abort.webm",
      mimeType: "video/webm",
      byteLength: 8,
      durationMs: 0,
    },
  });
  await client.callTool({
    name: "append_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      uploadId: abortBegin.structuredContent.uploadId,
      index: 0,
      offset: 0,
      dataBase64: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).toString("base64"),
    },
  });
  const aborted = await client.callTool({
    name: "abort_renoise_whiteboard_video_upload",
    arguments: { canvasSessionId: pending.canvasSessionId, uploadId: abortBegin.structuredContent.uploadId },
  });
  assert.equal(aborted.structuredContent.aborted, true);
  assert.equal((await readdir(assetsDir)).some((name) => name.includes(abortBegin.structuredContent.uploadId)), false);

  const invalidMagicBytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  const invalidMagicBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 2,
      fileName: "mismatch.mp4",
      mimeType: "video/mp4",
      byteLength: invalidMagicBytes.length,
      durationMs: 0,
    },
  });
  await client.callTool({
    name: "append_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      uploadId: invalidMagicBegin.structuredContent.uploadId,
      index: 0,
      offset: 0,
      dataBase64: invalidMagicBytes.toString("base64"),
    },
  });
  const invalidMagicFinalize = await client.callTool({
    name: "finalize_renoise_whiteboard_video_upload",
    arguments: { canvasSessionId: pending.canvasSessionId, uploadId: invalidMagicBegin.structuredContent.uploadId },
  });
  assert.equal(invalidMagicFinalize.structuredContent.status, "processing");
  const invalidMagicStatus = await pollVideoFinalize(client, pending.canvasSessionId, invalidMagicBegin.structuredContent.uploadId);
  assert.equal(invalidMagicStatus.isError, true);
  assert.equal((await readdir(assetsDir)).some((name) => name.includes(invalidMagicBegin.structuredContent.uploadId)), false);

  const oversizedBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 2,
      fileName: "too-large.mp4",
      mimeType: "video/mp4",
      byteLength: 250 * 1024 * 1024 + 1,
      durationMs: 0,
    },
  });
  assert.equal(oversizedBegin.isError, true);

  const oversizedChunkBegin = await client.callTool({
    name: "begin_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 2,
      fileName: "chunk.mp4",
      mimeType: "video/mp4",
      byteLength: videoChunkBytes + 1,
      durationMs: 0,
    },
  });
  const oversizedChunk = await client.callTool({
    name: "append_renoise_whiteboard_video_upload",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      uploadId: oversizedChunkBegin.structuredContent.uploadId,
      index: 0,
      offset: 0,
      dataBase64: Buffer.alloc(videoChunkBytes + 1).toString("base64"),
    },
  });
  assert.equal(oversizedChunk.isError, true);
  await client.callTool({
    name: "abort_renoise_whiteboard_video_upload",
    arguments: { canvasSessionId: pending.canvasSessionId, uploadId: oversizedChunkBegin.structuredContent.uploadId },
  });

  const targetId = "obj_target";
  const secondTargetId = "obj_target02";
  const markId = "obj_mark01";
  const annotationId = "annotation_review01";
  const now = new Date().toISOString();
  const document = structuredClone(importedVideo.structuredContent.document);
  document.page.objects.push(
    {
      id: targetId,
      type: "image",
      parentId: null,
      transform: { x: 100, y: 80, width: 200, height: 100, rotation: 0 },
      zIndex: 1,
      locked: false,
      hidden: false,
      style: {},
      data: {
        assetId: imported.structuredContent.asset.id,
        alt: "target",
        source: {
          kind: "video-frame",
          videoAssetId: importedVideo.structuredContent.asset.id,
          videoSha256: importedVideo.structuredContent.asset.sha256,
          timeMs: 417,
        },
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: markId,
      type: "rect",
      parentId: null,
      transform: { x: 130, y: 100, width: 40, height: 30, rotation: 0 },
      zIndex: 2,
      locked: false,
      hidden: false,
      style: { stroke: "#E64B22" },
      data: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: secondTargetId,
      type: "image",
      parentId: null,
      transform: { x: 340, y: 80, width: 200, height: 100, rotation: 0 },
      zIndex: 3,
      locked: false,
      hidden: false,
      style: {},
      data: {
        assetId: imported.structuredContent.asset.id,
        alt: "target @ 837ms",
        source: {
          kind: "video-frame",
          videoAssetId: importedVideo.structuredContent.asset.id,
          videoSha256: importedVideo.structuredContent.asset.sha256,
          timeMs: 837,
        },
      },
      createdAt: now,
      updatedAt: now,
    },
  );
  document.page.annotations.push({
    id: annotationId,
    targetObjectIds: [targetId],
    markObjectIds: [markId],
    sourceAssetSha256: importedVideo.structuredContent.asset.sha256,
    sourceTimeMs: 417,
    status: "open",
    createdAt: now,
  });
  const saved = await client.callTool({
    name: "save_renoise_whiteboard_state",
    arguments: { canvasSessionId: pending.canvasSessionId, expectedRevision: 2, document },
  });
  assert.equal(saved.structuredContent.revision, 3);
  await client.callTool({
    name: "save_renoise_whiteboard_selection",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      selection: {
        schemaVersion: 1,
        pageId: document.page.id,
        documentRevision: 3,
        selectedObjectIds: [targetId, secondTargetId],
        selectedAnnotationIds: [annotationId],
      },
    },
  });
  const selection = await client.callTool({
    name: "get_renoise_whiteboard_selection",
    arguments: { canvasSessionId: pending.canvasSessionId },
  });
  assert.deepEqual(selection.structuredContent.selectedObjectIds, [targetId, secondTargetId]);
  assert.deepEqual(selection.structuredContent.selectedObjects.map(({ id }) => id), [targetId, secondTargetId]);
  assert.deepEqual(selection.structuredContent.contextObjects.map(({ id }) => id), [markId]);
  const submitted = await client.callTool({
    name: "submit_renoise_whiteboard_revision_intent",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      expectedRevision: 3,
      instruction: "把框选区域调整为暖色，并保留人物身份。",
    },
  });
  const revisionIntentId = submitted.structuredContent.revisionIntent.id;
  assert.match(revisionIntentId, /^intent_/);
  assert.deepEqual(submitted.structuredContent.revisionIntent.targetObjectIds, [targetId, secondTargetId]);
  assert.deepEqual(submitted.structuredContent.revisionIntent.markObjectIds, [markId]);
  assert.equal(submitted.structuredContent.revisionIntent.sources[0].sourceTimeMs, 417);
  assert.equal(submitted.structuredContent.revisionIntent.sources[0].sourceVideoAssetId, importedVideo.structuredContent.asset.id);
  assert.equal(submitted.structuredContent.revisionIntent.sources[0].sourceVideoSha256, importedVideo.structuredContent.asset.sha256);
  assert.equal(submitted.structuredContent.revisionIntent.sources[1].sourceTimeMs, 837);
  assert.equal(submitted.structuredContent.revisionIntent.sources[1].sourceVideoAssetId, importedVideo.structuredContent.asset.id);
  assert.equal(submitted.structuredContent.document.page.objects.length, 0);
  assert.equal(submitted.structuredContent.document.page.annotations.length, 0);
  assert.deepEqual(submitted.structuredContent.selection.selectedObjectIds, []);
  assert.deepEqual(submitted.structuredContent.selection.selectedAnnotationIds, []);
  assert.deepEqual(submitted.structuredContent.view.promptDrafts, {});
  assert.equal(submitted.structuredContent.revisionIntent.contextSnapshot.page.objects.length, document.page.objects.length);
  const intent = await client.callTool({
    name: "get_renoise_whiteboard_revision_intent",
    arguments: { canvasSessionId: pending.canvasSessionId, revisionIntentId },
  });
  assert.equal(intent.structuredContent.revisionIntent.instruction, "把框选区域调整为暖色，并保留人物身份。");
  assert.match(intent.content[0].text, /localized SOURCE VIDEO EDIT/);
  assert.deepEqual(intent.structuredContent.assetIds, [imported.structuredContent.asset.id]);
  assert.deepEqual(intent.structuredContent.sourceVideoAssetIds, [importedVideo.structuredContent.asset.id]);
  assert.deepEqual(intent.structuredContent.preparableAssetIds, [
    importedVideo.structuredContent.asset.id,
    imported.structuredContent.asset.id,
  ]);
  assert.equal(intent.structuredContent.interpretation.defaultOperation, "source-video-segment-edit");
  assert.equal(intent.structuredContent.interpretation.preserveUnannotatedSourceVideo, true);
  assert.equal(intent.structuredContent.interpretation.annotatedFramesAreStandaloneEndpoints, false);
  assert.deepEqual(intent.structuredContent.interpretation.videoEditContexts[0].annotatedTimeMs, [417, 837]);
  assert.deepEqual(intent.structuredContent.interpretation.videoEditContexts[0].annotationBoundsMs, { startMs: 417, endMs: 837 });
  assert.equal(intent.structuredContent.interpretation.videoEditContexts[0].sourceDurationMs, null);
  const preparedIntent = await client.callTool({
    name: "prepare_renoise_whiteboard_references",
    arguments: {
      canvasSessionId: pending.canvasSessionId,
      assetIds: intent.structuredContent.preparableAssetIds,
    },
  });
  assert.deepEqual(preparedIntent.structuredContent.prepared.map(({ mimeType }) => mimeType).sort(), ["image/png", "video/mp4"]);

  const reopened = await client.callTool({
    name: "render_renoise_whiteboard_widget",
    arguments: { projectDir },
  });
  const reauthorized = await client.callTool({
    name: "authorize_renoise_whiteboard_workspace",
    arguments: { approvedProjectDir: projectDir },
  });
  const reopenedSessionId = reauthorized.structuredContent.canvasSessionId;
  assert.equal(reauthorized.structuredContent.document.page.id, document.page.id);
  assert.equal(reauthorized.structuredContent.document.page.objects.length, 0);
  assert.equal(reauthorized.structuredContent.document.page.annotations.length, 0);
  assert.deepEqual(reauthorized.structuredContent.selection.selectedObjectIds, []);
  assert.deepEqual(reauthorized.structuredContent.view.promptDrafts, {});
  const recoveredIntent = await client.callTool({
    name: "get_renoise_whiteboard_revision_intent",
    arguments: { canvasSessionId: reopenedSessionId },
  });
  assert.equal(recoveredIntent.structuredContent.resolvedBy, "latest");
  assert.equal(recoveredIntent.structuredContent.revisionIntent.id, revisionIntentId);
  assert.equal(recoveredIntent.structuredContent.revisionIntent.instruction, "把框选区域调整为暖色，并保留人物身份。");

  const validExport = await client.callTool({
    name: "download_renoise_whiteboard_export",
    arguments: { canvasSessionId: pending.canvasSessionId, kind: "review", dataUrl: tinyPng, annotationIds: [annotationId] },
  });
  assert.equal(validExport.isError, true);

  const invalidExport = await client.callTool({
    name: "download_renoise_whiteboard_export",
    arguments: { canvasSessionId: pending.canvasSessionId, kind: "review", dataUrl: tinyPng, annotationIds: ["annotation_missing"] },
  });
  assert.equal(invalidExport.isError, true);
});

test("a host that renders MCP Apps without declaring the optional extension can authorize", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-mcp-noapps-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client({ name: "whiteboard-noapps-test", version: "1.0.0" });
  context.after(() => client.close());
  await client.connect(transport);

  const rendered = await client.callTool({
    name: "render_renoise_whiteboard_widget",
    arguments: { projectDir },
  });
  assert.equal(rendered.isError, undefined);
  assert.equal(rendered.structuredContent.authorization.projectDir, projectDir);
  assert.equal(rendered.structuredContent.canvasSessionId, undefined);

  const authorized = await client.callTool({
    name: "authorize_renoise_whiteboard_workspace",
    arguments: { approvedProjectDir: projectDir },
  });
  assert.equal(authorized.isError, undefined);
  assert.match(authorized.structuredContent.canvasSessionId, /^session_[a-f0-9]{32}$/);
  assert.equal(authorized.structuredContent.authorization.state, "active");
});
