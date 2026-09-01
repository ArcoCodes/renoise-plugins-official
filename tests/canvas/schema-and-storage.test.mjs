import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  SelectionStateSchema,
  RevisionIntentSchema,
  WhiteboardDocumentSchema,
  createEmptyDocument,
  describeRevisionIntent,
  screenToWorld,
  worldToScreen,
} from "../../features/canvas/dist/shared.mjs";
import { SessionStore } from "../../features/canvas/build/.test-dist/session/session-store.js";
import { ProjectStore } from "../../features/canvas/build/.test-dist/storage/project-store.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const tinyMp4Bytes = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0, 0, 0, 0]);
const tinyMp4 = `data:video/mp4;base64,${tinyMp4Bytes.toString("base64")}`;

test("document schema is stable and rejects filesystem asset capabilities", () => {
  const document = createEmptyDocument("page_schema");
  assert.equal(WhiteboardDocumentSchema.parse(document).schemaVersion, 1);
  const invalid = structuredClone(document);
  invalid.page.assets.asset_escape = {
    id: "asset_escape",
    relativePath: "../secret.png",
    mimeType: "image/png",
    sha256: "0".repeat(64),
    byteLength: 1,
    createdAt: new Date().toISOString(),
  };
  assert.throws(() => WhiteboardDocumentSchema.parse(invalid));
});

test("camera conversion preserves screen/world invariants", () => {
  const camera = { x: 127.5, y: -42, zoom: 1.75 };
  const world = { x: -90, y: 812.25 };
  const roundTrip = screenToWorld(worldToScreen(world, camera), camera);
  assert.ok(Math.abs(roundTrip.x - world.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - world.y) < 1e-9);
});

test("video-frame intents default to source-video segment edits instead of endpoint generation", () => {
  const document = createEmptyDocument("page_video_intent");
  const createdAt = new Date().toISOString();
  document.page.assets.asset_source_video = {
    id: "asset_source_video",
    relativePath: "assets/source.mp4",
    mimeType: "video/mp4",
    sha256: "a".repeat(64),
    byteLength: 100,
    createdAt,
  };
  document.page.assets.asset_source_poster = {
    id: "asset_source_poster",
    relativePath: "assets/source-poster.png",
    mimeType: "image/png",
    sha256: "b".repeat(64),
    byteLength: 50,
    width: 1280,
    height: 720,
    createdAt,
  };
  document.page.objects.push({
    id: "object_source_video",
    type: "video-card",
    parentId: null,
    transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
    zIndex: 0,
    locked: false,
    hidden: false,
    style: {},
    data: {
      assetId: "asset_source_video",
      posterAssetId: "asset_source_poster",
      durationMs: 15_092,
      fileName: "source.mp4",
      timeMs: 4_627,
    },
    createdAt,
    updatedAt: createdAt,
  });
  const revisionIntent = RevisionIntentSchema.parse({
    schemaVersion: 1,
    id: "intent_video_segment",
    pageId: document.page.id,
    documentRevision: 7,
    instruction: "让 3 秒的小蝴蝶在 4.6 秒前变成大蝴蝶",
    selectedObjectIds: ["snapshot_first", "snapshot_second"],
    selectedAnnotationIds: ["annotation_first", "annotation_second"],
    targetObjectIds: ["snapshot_first", "snapshot_second"],
    markObjectIds: ["mark_first", "mark_second"],
    sources: [
      {
        objectId: "snapshot_first",
        objectType: "image",
        assetId: "asset_frame_first",
        assetSha256: "1".repeat(64),
        sourceTimeMs: 3_004,
        sourceVideoAssetId: "asset_source_video",
        sourceVideoSha256: "a".repeat(64),
      },
      {
        objectId: "snapshot_second",
        objectType: "image",
        assetId: "asset_frame_second",
        assetSha256: "2".repeat(64),
        sourceTimeMs: 4_627,
        sourceVideoAssetId: "asset_source_video",
        sourceVideoSha256: "a".repeat(64),
      },
    ],
    materialReferences: [{ materialId: 73, name: "Butterfly reference", type: "video", mimeType: "video/mp4" }],
    status: "submitted",
    resultObjectIds: [],
    createdAt,
  });

  const interpretation = describeRevisionIntent(revisionIntent, document);
  assert.equal(interpretation.defaultOperation, "source-video-segment-edit");
  assert.equal(interpretation.preserveUnannotatedSourceVideo, true);
  assert.equal(interpretation.annotatedFramesAreStandaloneEndpoints, false);
  assert.equal(interpretation.standaloneGenerationRequiresExplicitUserRequest, true);
  assert.deepEqual(interpretation.sourceVideoAssetIds, ["asset_source_video"]);
  assert.deepEqual(interpretation.sourceMediaMetadata, [
    { assetId: "asset_source_video", width: 1280, height: 720, durationSec: 15.092 },
  ]);
  assert.deepEqual(interpretation.preparableAssetIds, ["asset_source_video", "asset_frame_first", "asset_frame_second"]);
  assert.deepEqual(interpretation.uploadPlan, [
    { assetId: "asset_source_video", role: "reference_video", scope: "user", purpose: "authoritative_source" },
    { assetId: "asset_frame_first", role: "reference_image", scope: "mask", purpose: "annotation_guide" },
    { assetId: "asset_frame_second", role: "reference_image", scope: "mask", purpose: "annotation_guide" },
  ]);
  assert.deepEqual(interpretation.materialIds, [73]);
  assert.deepEqual(interpretation.materialTokens, ["@material:73"]);
  assert.equal(interpretation.materialReferences[0].name, "Butterfly reference");
  assert.deepEqual(interpretation.videoEditContexts[0], {
    sourceVideoAssetId: "asset_source_video",
    sourceVideoSha256: "a".repeat(64),
    sourceDurationMs: 15_092,
    sourceFileName: "source.mp4",
    sourceMediaMeta: { width: 1280, height: 720, durationSec: 15.092 },
    annotatedTimeMs: [3_004, 4_627],
    annotationBoundsMs: null,
    candidateBoundsMs: { startMs: 3_004, endMs: 4_627 },
    temporalIntent: {
      mode: "unknown",
      explicit: false,
      anchorTimesMs: [3_004, 4_627],
      startMs: null,
      endMs: null,
    },
    requiresTemporalRangeClarification: true,
  });

  const singleFrame = RevisionIntentSchema.parse({
    ...revisionIntent,
    id: "intent_single_frame",
    selectedObjectIds: ["snapshot_first"],
    selectedAnnotationIds: ["annotation_first"],
    targetObjectIds: ["snapshot_first"],
    markObjectIds: ["mark_first"],
    sources: [revisionIntent.sources[0]],
  });
  const singleInterpretation = describeRevisionIntent(singleFrame, document);
  assert.equal(singleInterpretation.defaultOperation, "source-video-segment-edit");
  assert.equal(singleInterpretation.videoEditContexts[0].annotationBoundsMs, null);
  assert.equal(singleInterpretation.videoEditContexts[0].candidateBoundsMs, null);
  assert.equal(singleInterpretation.videoEditContexts[0].temporalIntent.mode, "single-anchor");
  assert.equal(singleInterpretation.videoEditContexts[0].requiresTemporalRangeClarification, false);
});

test("image annotation bindings keep the clean source separate from the hidden guide", () => {
  const document = createEmptyDocument("page_image_binding");
  const createdAt = new Date().toISOString();
  document.page.assets.asset_clean_image = {
    id: "asset_clean_image",
    relativePath: "assets/clean.png",
    mimeType: "image/png",
    sha256: "a".repeat(64),
    byteLength: 100,
    width: 1600,
    height: 900,
    createdAt,
  };
  document.page.objects.push(
    {
      id: "object_clean_image",
      type: "image",
      parentId: null,
      transform: { x: 10, y: 20, width: 400, height: 200, rotation: 0 },
      zIndex: 0,
      locked: false,
      hidden: false,
      style: {},
      data: { assetId: "asset_clean_image", alt: "source", source: { kind: "file-picker" } },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "snapshot_image_guide",
      type: "image",
      parentId: null,
      transform: { x: 10, y: 20, width: 400, height: 200, rotation: 0 },
      zIndex: 1,
      locked: true,
      hidden: false,
      style: { role: "annotation-snapshot" },
      data: {
        assetId: "asset_image_guide",
        alt: "annotated",
        source: { relation: "revision-of", objectId: "object_clean_image" },
      },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "mark_image_rect",
      type: "rect",
      parentId: null,
      transform: { x: 110, y: 70, width: 200, height: 100, rotation: 0 },
      zIndex: 2,
      locked: true,
      hidden: true,
      style: { stroke: "#ff0000" },
      data: {},
      createdAt,
      updatedAt: createdAt,
    },
  );
  document.page.annotations.push({
    id: "annotation_image_region",
    targetObjectIds: ["snapshot_image_guide"],
    markObjectIds: ["mark_image_rect"],
    sourceAssetSha256: "b".repeat(64),
    sourceTimeMs: null,
    status: "open",
    createdAt,
  });
  const revisionIntent = RevisionIntentSchema.parse({
    schemaVersion: 1,
    id: "intent_image_binding",
    pageId: document.page.id,
    documentRevision: 1,
    instruction: "Replace the boxed object",
    selectedObjectIds: ["snapshot_image_guide"],
    selectedAnnotationIds: ["annotation_image_region"],
    targetObjectIds: ["snapshot_image_guide"],
    markObjectIds: ["mark_image_rect"],
    sources: [{
      objectId: "snapshot_image_guide",
      objectType: "image",
      assetId: "asset_image_guide",
      assetSha256: "b".repeat(64),
      authoritativeSourceAssetId: "asset_clean_image",
      authoritativeSourceSha256: "a".repeat(64),
      annotationGuideAssetId: "asset_image_guide",
      annotationGuideSha256: "b".repeat(64),
      sourceTimeMs: null,
    }],
    status: "submitted",
    resultObjectIds: [],
    createdAt,
  });

  const interpretation = describeRevisionIntent(revisionIntent, document);
  assert.equal(interpretation.defaultOperation, "image-revision");
  assert.deepEqual(interpretation.authoritativeSourceAssetIds, ["asset_clean_image"]);
  assert.deepEqual(interpretation.sourceMediaMetadata, [
    { assetId: "asset_clean_image", width: 1600, height: 900 },
  ]);
  assert.deepEqual(interpretation.annotationGuideAssetIds, ["asset_image_guide"]);
  assert.deepEqual(interpretation.preparableAssetIds, ["asset_clean_image", "asset_image_guide"]);
  assert.deepEqual(interpretation.uploadPlan, [
    { assetId: "asset_clean_image", role: "reference_image", scope: "user", purpose: "authoritative_source" },
    { assetId: "asset_image_guide", role: "reference_image", scope: "mask", purpose: "annotation_guide" },
  ]);
  assert.deepEqual(interpretation.annotationBindings, [{
    annotationId: "annotation_image_region",
    targetObjectId: "snapshot_image_guide",
    sourceKind: "image",
    authoritativeSourceAssetId: "asset_clean_image",
    annotationGuideAssetId: "asset_image_guide",
    sourceVideoAssetId: null,
    sourceTimeMs: null,
    regions: [{
      markObjectId: "mark_image_rect",
      shape: "rect",
      normalizedBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    }],
  }]);
  assert.equal(interpretation.annotationGuidesAreProviderMasks, false);
});

test("session authorization, atomic CAS, opaque assets, and revision-bound selection form a closed loop", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const store = new ProjectStore();
  const session = sessions.create(projectDir);

  assert.throws(() => sessions.get(session.id), /Approve the exact project directory/);
  await assert.rejects(() => sessions.authorize(session.id, `${projectDir}-other`, session.authorizationNonce), /exactly match/);
  const authorizationNonce = session.authorizationNonce;
  await sessions.authorize(session.id, projectDir, authorizationNonce);
  assert.equal((await sessions.authorize(session.id, projectDir, authorizationNonce)).state, "active");
  await store.initialize(session, "Contract Board");

  const initial = await store.getState(session);
  assert.equal(initial.document.page.revision, 0);
  const imported = await store.saveDataUrlAsset(session, tinyPng, {
    width: 1,
    height: 1,
    preview: { dataUrl: tinyPng, width: 1, height: 1 },
  });
  assert.equal(imported.preview?.sourceSha256, imported.asset.sha256);
  initial.document.page.assets[imported.asset.id] = imported.asset;
  const importedAt = new Date().toISOString();
  initial.document.page.objects.push({
    id: "object_preview",
    type: "image",
    parentId: null,
    transform: { x: 10, y: 20, width: 1, height: 1, rotation: 0 },
    zIndex: 1,
    locked: false,
    hidden: false,
    style: {},
    data: { assetId: imported.asset.id, alt: "preview.png", source: { kind: "file-picker" } },
    createdAt: importedAt,
    updatedAt: importedAt,
  });
  const withAsset = await store.saveDocument(session, initial.document, 0, [imported.asset.id]);
  assert.equal(withAsset.page.revision, 1);
  const restoredWithPreview = await store.getState(session);
  assert.equal(restoredWithPreview.document.page.revision, 1);
  assert.equal("renderBootstrap" in restoredWithPreview, false);
  assert.ok(Buffer.byteLength(JSON.stringify(restoredWithPreview)) < 16 * 1024);
  const previewMetadataPath = join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, "previews", `${imported.asset.id}.json`);
  assert.equal(JSON.parse(await readFile(previewMetadataPath, "utf8")).sourceSha256, imported.asset.sha256);
  assert.deepEqual(await store.readAssetBytes(session, imported.asset), Buffer.from(tinyPng.split(",")[1], "base64"));
  const imageRead = await store.beginImageRead(session, imported.asset);
  const imageChunk = await store.readImageChunk(session, {
    readLeaseId: imageRead.readLeaseId,
    offset: 0,
    length: 1024,
  });
  assert.deepEqual(Buffer.from(imageChunk.dataBase64, "base64"), Buffer.from(tinyPng.split(",")[1], "base64"));
  assert.equal(imageChunk.eof, true);
  await store.closeImageRead(session, imageRead.readLeaseId);
  await assert.rejects(
    () => store.readImageChunk(session, { readLeaseId: imageRead.readLeaseId, offset: 0, length: 1 }),
    /does not belong/,
  );

  const tampered = structuredClone(withAsset);
  tampered.page.assets[imported.asset.id].relativePath = "board.json";
  await assert.rejects(() => store.saveDocument(session, tampered, 1), /cannot create or mutate asset records/);
  await assert.rejects(() => store.saveDocument(session, withAsset, 0), /Expected revision 0/);

  const selection = SelectionStateSchema.parse({
    schemaVersion: 1,
    pageId: session.pageId,
    documentRevision: 1,
    selectedObjectIds: [],
    selectedAnnotationIds: [],
  });
  assert.deepEqual(await store.saveSelection(session, selection), selection);
  await assert.rejects(() => store.saveSelection(session, { ...selection, documentRevision: 0 }), /current page revision/);

  const board = JSON.parse(await readFile(join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, "board.json"), "utf8"));
  assert.equal(board.page.revision, 1);
  assert.equal(board.page.assets[imported.asset.id].sha256, imported.asset.sha256);

  const brokenReference = structuredClone(withAsset);
  delete brokenReference.page.assets[imported.asset.id];
  await assert.rejects(() => store.saveDocument(session, brokenReference, 1), /references missing asset/);

  const withoutAsset = structuredClone(withAsset);
  withoutAsset.page.objects = withoutAsset.page.objects.filter(({ id }) => id !== "object_preview");
  delete withoutAsset.page.assets[imported.asset.id];
  const afterCleanup = await store.saveDocument(session, withoutAsset, 1);
  assert.equal(afterCleanup.page.revision, 2);
  await assert.rejects(() => store.readAssetBytes(session, imported.asset), /ENOENT/);
});

test("app approval resolves the latest pending session without exposing bearer credentials", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-approval-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const first = sessions.create(projectDir);
  const latest = sessions.create(projectDir);

  const authorized = await sessions.authorizePending(projectDir, latest.id);
  assert.equal(authorized.id, latest.id);
  assert.equal(authorized.state, "active");
  assert.throws(() => sessions.get(first.id, false), /missing or expired/);
  await assert.rejects(() => sessions.authorizePending(projectDir, first.id), /missing or expired|exact pending session/i);
});

test("a new authorized session reopens the manifest page with document, view, and selection intact", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-reopen-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const store = new ProjectStore();
  const first = sessions.create(projectDir, "First Review");
  await sessions.authorize(first.id, projectDir, first.authorizationNonce);
  await store.initialize(first, first.requestedPageName);
  const state = await store.getState(first);
  state.document.page.name = "Persisted Review";
  const saved = await store.saveDocument(first, state.document, 0);
  await store.saveView(first, {
    schemaVersion: 1,
    pageId: first.pageId,
    camera: { x: 314, y: -92, zoom: 1.75 },
    theme: "dark",
    activeTargetId: "object_target",
    promptDrafts: { object_target: "保留目标节点上的草稿" },
    materialReferencePools: {
      [first.pageId]: [{ materialId: 17, name: "Reference still", type: "image", mimeType: "image/png" }],
    },
  });
  await store.saveSelection(first, { schemaVersion: 1, pageId: first.pageId, documentRevision: saved.page.revision, selectedObjectIds: [], selectedAnnotationIds: [] });

  const second = sessions.create(projectDir, "Must Not Replace Existing");
  await sessions.authorize(second.id, projectDir, second.authorizationNonce);
  await store.initialize(second, second.requestedPageName);
  const reopened = await store.getState(second);
  assert.equal(second.pageId, first.pageId);
  assert.equal(reopened.document.page.name, "Persisted Review");
  assert.equal(reopened.document.page.revision, 1);
  assert.deepEqual(reopened.view.camera, { x: 314, y: -92, zoom: 1.75 });
  assert.equal(reopened.view.theme, "dark");
  assert.equal(reopened.view.activeTargetId, "object_target");
  assert.deepEqual(reopened.view.promptDrafts, { object_target: "保留目标节点上的草稿" });
  assert.deepEqual(reopened.view.materialReferencePools[first.pageId].map(({ materialId }) => materialId), [17]);
  assert.equal(reopened.selection.documentRevision, 1);
});

test("legacy submitted residue is archived once, while a real unsent prompt is preserved", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-legacy-submit-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const store = new ProjectStore();
  const first = sessions.create(projectDir, "Legacy Submit");
  await sessions.authorize(first.id, projectDir, first.authorizationNonce);
  await store.initialize(first, first.requestedPageName);
  const state = await store.getState(first);
  const imported = await store.saveDataUrlAsset(first, tinyPng);
  state.document.page.assets[imported.asset.id] = imported.asset;
  const now = new Date().toISOString();
  state.document.page.objects.push({
    id: "object_legacy_snapshot",
    parentId: null,
    transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
    zIndex: 1,
    locked: true,
    hidden: false,
    style: {},
    type: "image",
    data: { assetId: imported.asset.id, alt: "legacy", source: {} },
    createdAt: now,
    updatedAt: now,
  });
  const saved = await store.saveDocument(first, state.document, 0, [imported.asset.id]);
  await store.saveSelection(first, {
    schemaVersion: 1,
    pageId: first.pageId,
    documentRevision: saved.page.revision,
    selectedObjectIds: ["object_legacy_snapshot"],
    selectedAnnotationIds: [],
  });
  await store.saveView(first, {
    ...state.view,
    promptDrafts: { [first.pageId]: "[[renoise-clip:object_legacy_snapshot]]" },
    materialReferencePools: { [first.pageId]: [{ materialId: 9, name: "Legacy pool", type: "image", mimeType: "image/png" }] },
  });
  const legacyIntent = RevisionIntentSchema.parse({
    schemaVersion: 1,
    id: "intent_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    pageId: first.pageId,
    documentRevision: saved.page.revision,
    instruction: "已经发送的文字",
    selectedObjectIds: ["object_legacy_snapshot"],
    selectedAnnotationIds: [],
    targetObjectIds: ["object_legacy_snapshot"],
    markObjectIds: [],
    sources: [{
      objectId: "object_legacy_snapshot",
      objectType: "image",
      assetId: imported.asset.id,
      assetSha256: imported.asset.sha256,
      sourceTimeMs: null,
    }],
    status: "submitted",
    resultObjectIds: [],
    createdAt: now,
  });
  const intentDir = join(projectDir, ".renoise", "whiteboard", "revision-intents");
  await writeFile(join(intentDir, `${legacyIntent.id}.json`), `${JSON.stringify(legacyIntent)}\n`);

  const second = sessions.create(projectDir, "Reopen");
  await sessions.authorize(second.id, projectDir, second.authorizationNonce);
  await store.initialize(second, second.requestedPageName);
  const reconciled = await store.getState(second);
  assert.equal(reconciled.document.page.objects.length, 0);
  assert.deepEqual(reconciled.selection.selectedObjectIds, []);
  assert.deepEqual(reconciled.view.promptDrafts, {});
  assert.deepEqual(reconciled.view.materialReferencePools, {});
  assert.equal((await store.getLatestRevisionIntent(second)).contextSnapshot?.page.objects.length, 1);

  const thirdState = await store.getState(second);
  thirdState.view.promptDrafts = { [second.pageId]: "尚未发送的新要求" };
  await store.saveView(second, thirdState.view);
  const third = sessions.create(projectDir, "Reopen Again");
  await sessions.authorize(third.id, projectDir, third.authorizationNonce);
  await store.initialize(third, third.requestedPageName);
  assert.equal((await store.getState(third)).view.promptDrafts[third.pageId], "尚未发送的新要求");
});

test("legacy image assets restore as metadata without generating an inline base64 bootstrap", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-preview-migration-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const store = new ProjectStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  await store.initialize(session, "Legacy Preview");
  const state = await store.getState(session);
  const imported = await store.saveDataUrlAsset(session, tinyPng);
  state.document.page.assets[imported.asset.id] = imported.asset;
  const createdAt = new Date().toISOString();
  state.document.page.objects.push({
    id: "object_legacy_preview",
    type: "image",
    parentId: null,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
    zIndex: 1,
    locked: false,
    hidden: false,
    style: {},
    data: { assetId: imported.asset.id, alt: "legacy.png", source: {} },
    createdAt,
    updatedAt: createdAt,
  });
  await store.saveDocument(session, state.document, 0, [imported.asset.id]);

  const restored = await store.getState(session);
  assert.equal(restored.document.page.assets[imported.asset.id].sha256, imported.asset.sha256);
  assert.equal("renderBootstrap" in restored, false);
  const metadataPath = join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, "previews", `${imported.asset.id}.json`);
  await assert.rejects(() => readFile(metadataPath, "utf8"), /ENOENT/);
});

test("authorization rejects filesystem root and user home", async () => {
  const sessions = new SessionStore();
  for (const projectDir of [resolve("/"), resolve(homedir())]) {
    const session = sessions.create(projectDir);
    await assert.rejects(() => sessions.authorize(session.id, projectDir, session.authorizationNonce), /root or user home/);
  }
});

test("whiteboard refuses symlinked root, intermediate, and assets directories before writing", async (context) => {
  const testRoot = await mkdtemp(join(tmpdir(), "renoise-whiteboard-symlink-"));
  context.after(() => rm(testRoot, { recursive: true, force: true }));
  for (const scenario of [".renoise", "whiteboard", "pages"]) {
    const projectDir = join(testRoot, `project-${scenario.replace(".", "dot")}`);
    const outside = join(testRoot, `outside-${scenario.replace(".", "dot")}`);
    await mkdir(projectDir);
    await mkdir(outside);
    if (scenario === ".renoise") {
      await symlink(outside, join(projectDir, ".renoise"));
    } else {
      await mkdir(join(projectDir, ".renoise"));
      if (scenario === "whiteboard") {
        await symlink(outside, join(projectDir, ".renoise", "whiteboard"));
      } else {
        await mkdir(join(projectDir, ".renoise", "whiteboard"));
        await symlink(outside, join(projectDir, ".renoise", "whiteboard", "pages"));
      }
    }
    const sessions = new SessionStore();
    const session = sessions.create(projectDir);
    await sessions.authorize(session.id, projectDir, session.authorizationNonce);
    await assert.rejects(() => new ProjectStore().initialize(session), /symlink|real directory/);
    assert.deepEqual(await import("node:fs/promises").then(({ readdir }) => readdir(outside)), []);
  }

  const projectDir = join(testRoot, "project-assets");
  await mkdir(projectDir);
  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore();
  await store.initialize(session);
  const assets = join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, "assets");
  await rm(assets, { recursive: true });
  const outside = join(testRoot, "outside-assets");
  await mkdir(outside);
  await symlink(outside, assets);
  await assert.rejects(() => store.saveDataUrlAsset(session, tinyPng), /symlink|real directory/);
  assert.deepEqual(await import("node:fs/promises").then(({ readdir }) => readdir(outside)), []);
});

test("write lock never reclaims an old live owner and reclaims only a token-stable dead owner", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-lock-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore();
  await store.initialize(session);
  const state = await store.getState(session);
  const lock = join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, ".write-lock");
  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, token: "a".repeat(32), createdAt: "2000-01-01T00:00:00.000Z" }));
  await assert.rejects(() => store.saveDocument(session, state.document, 0), /live writer/);
  await rm(lock, { recursive: true });
  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: 2147483647, token: "b".repeat(32), createdAt: "2000-01-01T00:00:00.000Z" }));
  assert.equal((await store.saveDocument(session, state.document, 0)).page.revision, 1);
});

test("prepared references use unique private leases and read-only files", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-lease-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore();
  await store.initialize(session);
  const state = await store.getState(session);
  const imported = await store.saveDataUrlAsset(session, tinyPng);
  state.document.page.assets[imported.asset.id] = imported.asset;
  await store.saveDocument(session, state.document, 0, [imported.asset.id]);
  const first = await store.materializeReferences(session, [imported.asset.id]);
  const second = await store.materializeReferences(session, [imported.asset.id]);
  context.after(() => Promise.all([
    rm(dirname(first.prepared[0].materialPath), { recursive: true, force: true }),
    rm(dirname(second.prepared[0].materialPath), { recursive: true, force: true }),
  ]));
  assert.notEqual(first.leaseId, second.leaseId);
  assert.notEqual(first.prepared[0].materialPath, second.prepared[0].materialPath);
  assert.equal((await stat(dirname(first.prepared[0].materialPath))).mode & 0o777, 0o700);
  assert.equal((await stat(first.prepared[0].materialPath)).mode & 0o777, 0o400);
});

test("task result bridge invokes renoise without a shell and validates JSON payload", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-cli-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const fakeCli = join(projectDir, "fake-renoise.mjs");
  const log = join(projectDir, "args.json");
  await writeFile(fakeCli, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.FAKE_RENOISE_LOG, JSON.stringify(process.argv.slice(2)));
process.stdout.write(JSON.stringify({outputs:[{dataUrl:${JSON.stringify(tinyPng)}}]}));
`);
  await chmod(fakeCli, 0o700);
  const previousCli = process.env.RENOISE_CLI_PATH;
  const previousLog = process.env.FAKE_RENOISE_LOG;
  const previousAdapter = process.env.RENOISE_TASK_RESULTS_DIR;
  process.env.RENOISE_CLI_PATH = fakeCli;
  process.env.FAKE_RENOISE_LOG = log;
  delete process.env.RENOISE_TASK_RESULTS_DIR;
  context.after(() => {
    if (previousCli === undefined) delete process.env.RENOISE_CLI_PATH; else process.env.RENOISE_CLI_PATH = previousCli;
    if (previousLog === undefined) delete process.env.FAKE_RENOISE_LOG; else process.env.FAKE_RENOISE_LOG = previousLog;
    if (previousAdapter === undefined) delete process.env.RENOISE_TASK_RESULTS_DIR; else process.env.RENOISE_TASK_RESULTS_DIR = previousAdapter;
  });
  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore();
  await store.initialize(session);
  const output = await store.assetFromTaskResult(session, "task_abc", 0);
  assert.equal(output.asset.mimeType, "image/png");
  assert.deepEqual(JSON.parse(await readFile(log, "utf8")), ["task", "result", "task_abc", "--json"]);
});

test("image uploads use bounded, replay-safe chunks and persist only opaque project-local references", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-image-upload-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore({ transferTtlMs: 100 });
  await store.initialize(session, "Chunked image upload");
  const imageBytes = Buffer.from(tinyPng.split(",")[1], "base64");
  const started = await store.beginImageUpload(session, {
    expectedRevision: 0,
    fileName: "desktop-image.png",
    mimeType: "image/png",
    byteLength: imageBytes.length,
    width: 1,
    height: 1,
  });
  const otherSession = sessions.create(projectDir);
  await sessions.authorize(otherSession.id, projectDir, otherSession.authorizationNonce);
  await assert.rejects(() => store.appendImageUpload(otherSession, {
    uploadId: started.uploadId,
    index: 0,
    offset: 0,
    dataBase64: imageBytes.subarray(0, 16).toString("base64"),
  }), /does not belong/);

  const chunks = [imageBytes.subarray(0, 16), imageBytes.subarray(16)];
  let offset = 0;
  for (const [index, chunk] of chunks.entries()) {
    const appended = await store.appendImageUpload(session, {
      uploadId: started.uploadId,
      index,
      offset,
      dataBase64: chunk.toString("base64"),
    });
    offset += chunk.length;
    assert.equal(appended.received, offset);
    if (index === 0) {
      const replay = await store.appendImageUpload(session, {
        uploadId: started.uploadId,
        index,
        offset: 0,
        dataBase64: chunk.toString("base64"),
      });
      assert.equal(replay.received, offset);
      assert.equal(replay.nextIndex, 1);
    }
  }
  const finalized = await store.finalizeImageUpload(session, started.uploadId);
  assert.equal(finalized.revision, 1);
  assert.equal(finalized.asset.mimeType, "image/png");
  assert.equal(finalized.asset.width, 1);
  assert.equal(finalized.asset.height, 1);
  assert.deepEqual(await store.readAssetBytes(session, finalized.asset), imageBytes);
  const persisted = await store.getState(session);
  assert.deepEqual(persisted.document.page.assets[finalized.asset.id], finalized.asset);
  assert.equal("dataUrl" in persisted.document.page.assets[finalized.asset.id], false);
  assert.equal((await readdir(join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, "assets"))).some((name) => name.endsWith(".part")), false);
});

test("video uploads and reads are chunked, session-bound, expiring, and hash verified", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-video-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore({ transferTtlMs: 100 });
  await store.initialize(session);
  await assert.rejects(() => store.saveDataUrlAsset(session, tinyMp4), /chunked upload/);

  const started = await store.beginVideoUpload(session, {
    expectedRevision: 0,
    fileName: "tiny.mp4",
    mimeType: "video/mp4",
    byteLength: tinyMp4Bytes.length,
    durationMs: 100,
    width: 640,
    height: 360,
  });
  const otherSession = sessions.create(projectDir);
  await sessions.authorize(otherSession.id, projectDir, otherSession.authorizationNonce);
  await assert.rejects(() => store.appendVideoUpload(otherSession, {
    uploadId: started.uploadId,
    index: 0,
    offset: 0,
    dataBase64: tinyMp4Bytes.subarray(0, 8).toString("base64"),
  }), /does not belong/);
  await store.appendVideoUpload(session, {
    uploadId: started.uploadId,
    index: 0,
    offset: 0,
    dataBase64: tinyMp4Bytes.subarray(0, 8).toString("base64"),
  });
  await store.appendVideoUpload(session, {
    uploadId: started.uploadId,
    index: 1,
    offset: 8,
    dataBase64: tinyMp4Bytes.subarray(8).toString("base64"),
  });
  const replay = await store.appendVideoUpload(session, {
    uploadId: started.uploadId,
    index: 1,
    offset: 8,
    dataBase64: tinyMp4Bytes.subarray(8).toString("base64"),
  });
  assert.equal(replay.received, tinyMp4Bytes.length);
  const changedReplay = Buffer.from(tinyMp4Bytes.subarray(8));
  changedReplay[changedReplay.length - 1] ^= 1;
  await assert.rejects(() => store.appendVideoUpload(session, {
    uploadId: started.uploadId,
    index: 1,
    offset: 8,
    dataBase64: changedReplay.toString("base64"),
  }), /differs/);

  const uploadState = store.videoUploads.get(started.uploadId);
  const originalSync = uploadState.handle.sync.bind(uploadState.handle);
  let releaseFinalize;
  let signalFinalize;
  const finalizeEntered = new Promise((resolve) => { signalFinalize = resolve; });
  const finalizeGate = new Promise((resolve) => { releaseFinalize = resolve; });
  uploadState.handle.sync = async () => {
    signalFinalize();
    await finalizeGate;
    return originalSync();
  };
  const finalizePromise = store.finalizeVideoUpload(session, started.uploadId);
  await finalizeEntered;
  await assert.rejects(() => store.abortVideoUpload(session, started.uploadId), /busy/);
  releaseFinalize();
  const imported = await finalizePromise;
  assert.equal(imported.asset.mimeType, "video/mp4");
  assert.equal(imported.asset.width, 640);
  assert.equal(imported.asset.height, 360);
  assert.match(imported.asset.relativePath, /^assets\/asset_[a-f0-9]+\.mp4$/);
  assert.match(imported.asset.sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => store.readAssetBytes(session, imported.asset), /chunk/);

  const concurrent = await store.beginVideoUpload(session, {
    expectedRevision: 1,
    fileName: "concurrent.mp4",
    mimeType: "video/mp4",
    byteLength: tinyMp4Bytes.length,
    durationMs: 0,
  });
  await assert.rejects(() => store.beginVideoUpload(session, {
    expectedRevision: 1,
    fileName: "invalid-dimensions.mp4",
    mimeType: "video/mp4",
    byteLength: tinyMp4Bytes.length,
    durationMs: 100,
    width: 640,
  }), /width and height must be provided together/);
  const concurrentState = store.videoUploads.get(concurrent.uploadId);
  const originalWrite = concurrentState.handle.write.bind(concurrentState.handle);
  let releaseWrite;
  let signalWrite;
  const writeEntered = new Promise((resolve) => { signalWrite = resolve; });
  const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
  concurrentState.handle.write = async (...args) => {
    signalWrite();
    await writeGate;
    return originalWrite(...args);
  };
  const firstAppend = store.appendVideoUpload(session, {
    uploadId: concurrent.uploadId,
    index: 0,
    offset: 0,
    dataBase64: tinyMp4Bytes.toString("base64"),
  });
  await writeEntered;
  await assert.rejects(() => store.appendVideoUpload(session, {
    uploadId: concurrent.uploadId,
    index: 0,
    offset: 0,
    dataBase64: tinyMp4Bytes.toString("base64"),
  }), /busy/);
  await assert.rejects(() => store.finalizeVideoUpload(session, concurrent.uploadId), /busy/);
  await assert.rejects(() => store.abortVideoUpload(session, concurrent.uploadId), /busy/);
  await store.cleanupExpiredVideoTransfers(Date.now() + 1000);
  releaseWrite();
  const appendAck = await firstAppend;
  assert.equal(appendAck.received, tinyMp4Bytes.length);
  const replayAck = await store.appendVideoUpload(session, {
    uploadId: concurrent.uploadId,
    index: 0,
    offset: 0,
    dataBase64: tinyMp4Bytes.toString("base64"),
  });
  assert.equal(replayAck.received, tinyMp4Bytes.length);
  await store.abortVideoUpload(session, concurrent.uploadId);
  assert.equal(store.videoUploads.has(concurrent.uploadId), false);
  const pageAssetsDir = join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, "assets");
  assert.equal((await readdir(pageAssetsDir)).some((name) => name.includes(concurrent.uploadId)), false);

  const read = await store.beginVideoRead(session, imported.asset);
  await assert.rejects(() => store.readVideoChunk(otherSession, { readLeaseId: read.readLeaseId, offset: 0, length: 1 }), /does not belong/);
  const readState = store.videoReads.get(read.readLeaseId);
  const originalRead = readState.handle.read.bind(readState.handle);
  let releaseRead;
  let signalRead;
  const readEntered = new Promise((resolve) => { signalRead = resolve; });
  const readGate = new Promise((resolve) => { releaseRead = resolve; });
  readState.handle.read = async (...args) => {
    signalRead();
    await readGate;
    return originalRead(...args);
  };
  const firstRead = store.readVideoChunk(session, { readLeaseId: read.readLeaseId, offset: 0, length: 7 });
  await readEntered;
  await assert.rejects(() => store.closeVideoRead(session, read.readLeaseId), /busy/);
  await store.cleanupExpiredVideoTransfers(Date.now() + 1000);
  releaseRead();
  const first = await firstRead;
  const second = await store.readVideoChunk(session, { readLeaseId: read.readLeaseId, offset: 7, length: 1024 });
  assert.deepEqual(Buffer.concat([
    Buffer.from(first.dataBase64, "base64"),
    Buffer.from(second.dataBase64, "base64"),
  ]), tinyMp4Bytes);
  assert.equal(second.eof, true);
  await store.closeVideoRead(session, read.readLeaseId);
  await assert.rejects(() => store.readVideoChunk(session, { readLeaseId: read.readLeaseId, offset: 0, length: 1 }), /does not belong/);

  const expiringUpload = await store.beginVideoUpload(session, {
    expectedRevision: 1,
    fileName: "expires.webm",
    mimeType: "video/webm",
    byteLength: 8,
    durationMs: 0,
  });
  await store.appendVideoUpload(session, {
    uploadId: expiringUpload.uploadId,
    index: 0,
    offset: 0,
    dataBase64: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).toString("base64"),
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal((await store.cleanupExpiredVideoTransfers()).uploads, 0);
  await assert.rejects(() => store.appendVideoUpload(session, {
    uploadId: expiringUpload.uploadId,
    index: 1,
    offset: 4,
    dataBase64: Buffer.alloc(4).toString("base64"),
  }), /does not belong|expired/);

  const expiringRead = await store.beginVideoRead(session, imported.asset);
  await new Promise((resolve) => setTimeout(resolve, 120));
  await assert.rejects(() => store.readVideoChunk(session, { readLeaseId: expiringRead.readLeaseId, offset: 0, length: 1 }), /does not belong|expired/);

  const assetPath = join(projectDir, ".renoise", "whiteboard", "pages", session.pageId, imported.asset.relativePath);
  await writeFile(assetPath, Buffer.from(tinyMp4Bytes.map((value, index) => index === 19 ? value ^ 1 : value)));
  await assert.rejects(
    () => store.beginVideoRead(session, imported.asset),
    /hash does not match/,
  );
});

test("an undecodable upload preserves the original and persists a browser playback proxy with its poster", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-whiteboard-video-proxy-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const fakeFfmpeg = join(projectDir, "fake-ffmpeg.mjs");
  const fakeFfprobe = join(projectDir, "fake-ffprobe.mjs");
  await writeFile(fakeFfmpeg, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
await new Promise((resolve) => setTimeout(resolve, 250));
const output = process.argv.at(-1);
if (output.endsWith(".webm")) writeFileSync(output, Buffer.from([0x1a,0x45,0xdf,0xa3,0x42,0x86,0x81,0x01]));
else writeFileSync(output, Buffer.from(${JSON.stringify(tinyPng.split(",")[1])}, "base64"));
`);
  await writeFile(fakeFfprobe, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({streams:[{width:1280,height:720}],format:{duration:"15.091",bit_rate:"1050238"}}));
`);
  await chmod(fakeFfmpeg, 0o700);
  await chmod(fakeFfprobe, 0o700);
  const previousFfmpeg = process.env.RENOISE_FFMPEG_PATH;
  const previousFfprobe = process.env.RENOISE_FFPROBE_PATH;
  process.env.RENOISE_FFMPEG_PATH = fakeFfmpeg;
  process.env.RENOISE_FFPROBE_PATH = fakeFfprobe;
  context.after(() => {
    if (previousFfmpeg === undefined) delete process.env.RENOISE_FFMPEG_PATH; else process.env.RENOISE_FFMPEG_PATH = previousFfmpeg;
    if (previousFfprobe === undefined) delete process.env.RENOISE_FFPROBE_PATH; else process.env.RENOISE_FFPROBE_PATH = previousFfprobe;
  });

  const sessions = new SessionStore();
  const session = sessions.create(projectDir);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  const store = new ProjectStore();
  await store.initialize(session);
  const started = await store.beginVideoUpload(session, {
    expectedRevision: 0,
    fileName: "source.mp4",
    mimeType: "video/mp4",
    byteLength: tinyMp4Bytes.length,
    durationMs: 0,
    createPlaybackProxy: true,
  });
  await store.appendVideoUpload(session, {
    uploadId: started.uploadId,
    index: 0,
    offset: 0,
    dataBase64: tinyMp4Bytes.toString("base64"),
  });
  const finalizeStartedAt = Date.now();
  const finalizeStarted = await store.startVideoUploadFinalize(session, started.uploadId);
  assert.equal(finalizeStarted.status, "processing");
  assert.ok(Date.now() - finalizeStartedAt < 100, "MCP-facing finalize start must not wait for FFmpeg");
  assert.equal(store.getVideoUploadFinalizeStatus(session, started.uploadId).status, "processing");
  let finalized;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = store.getVideoUploadFinalizeStatus(session, started.uploadId);
    if (status.status === "complete") {
      finalized = status;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(finalized, "background video finalize must become observable through polling");
  assert.equal(finalized.asset.mimeType, "video/mp4");
  assert.equal(finalized.playbackAsset.mimeType, "video/webm");
  assert.equal(finalized.posterAsset.mimeType, "image/png");
  assert.equal(finalized.durationMs, 15_091);
  assert.equal(finalized.width, 1280);
  assert.equal(finalized.height, 720);

  const document = structuredClone(finalized.document);
  const now = new Date().toISOString();
  document.page.objects.push({
    id: "object_video_proxy",
    type: "video-card",
    parentId: null,
    transform: { x: 0, y: 0, width: 640, height: 412, rotation: 0 },
    zIndex: 1,
    locked: false,
    hidden: false,
    style: {},
    data: {
      assetId: finalized.asset.id,
      playbackAssetId: finalized.playbackAsset.id,
      posterAssetId: finalized.posterAsset.id,
      durationMs: finalized.durationMs,
      fileName: "source.mp4",
      timeMs: 0,
    },
    createdAt: now,
    updatedAt: now,
  });
  const saved = await store.saveDocument(session, document, finalized.revision);
  assert.ok(saved.page.assets[finalized.asset.id]);
  assert.ok(saved.page.assets[finalized.playbackAsset.id]);
  assert.ok(saved.page.assets[finalized.posterAsset.id]);
  const playbackRead = await store.beginVideoRead(session, finalized.playbackAsset);
  const playbackBytes = await store.readVideoChunk(session, {
    readLeaseId: playbackRead.readLeaseId,
    offset: 0,
    length: 16,
  });
  assert.deepEqual(Buffer.from(playbackBytes.dataBase64, "base64").subarray(0, 4), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  await store.closeVideoRead(session, playbackRead.readLeaseId);
});
