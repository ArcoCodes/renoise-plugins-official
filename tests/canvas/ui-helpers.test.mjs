import assert from "node:assert/strict";
import test from "node:test";
import {
  MutationScheduler,
  WhiteboardDocumentSchema,
  annotationIdsForObjects,
  cameraToViewportTransform,
  constrainDrag,
  createEmptyDocument,
  fitMediaSize,
  focusedDocumentForTarget,
  linkedMarkIds,
  mergeFocusedScene,
  defaultReviewTargetId,
  resolveEffectiveTargetId,
  reviewTargetIds,
  selectedMediaKind,
  unlinkAnnotations,
  reviewBounds,
  reviewObjectIds,
  recoverCameraForTarget,
  viewportTransformToCamera,
} from "../../features/canvas/dist/shared.mjs";

test("media sizing preserves source aspect ratio without upscaling", () => {
  assert.deepEqual(fitMediaSize(1600, 900, 720, 520), { width: 720, height: 405 });
  assert.deepEqual(fitMediaSize(900, 1600, 720, 520), { width: 293, height: 520 });
  assert.deepEqual(fitMediaSize(320, 180, 720, 520), { width: 320, height: 180 });
  assert.throws(() => fitMediaSize(0, 180, 720, 520), /finite positive/);
});

test("unified local picker routes supported image and video files without trusting arbitrary extensions", () => {
  assert.equal(selectedMediaKind({ name: "still.png", type: "image/png" }), "image");
  assert.equal(selectedMediaKind({ name: "clip.bin", type: "video/mp4" }), "video");
  assert.equal(selectedMediaKind({ name: "clip.webm", type: "application/octet-stream" }), "video");
  assert.equal(selectedMediaKind({ name: "still.jpeg", type: "" }), "image");
  assert.equal(selectedMediaKind({ name: "fake.mp4", type: "text/plain" }), undefined);
  assert.equal(selectedMediaKind({ name: "clip.mov", type: "video/quicktime" }), undefined);
});

test("camera transform helpers preserve saved camera", () => {
  const camera = { x: 91, y: -43, zoom: 1.8 };
  const transform = cameraToViewportTransform(camera);
  assert.deepEqual(transform, [1.8, 0, 0, 1.8, 91, -43]);
  assert.deepEqual(viewportTransformToCamera(transform, 1.8), camera);
});

test("camera recovery preserves a visible target and refits a lost or microscopic target", () => {
  const viewport = { width: 1024, height: 700 };
  const bounds = { left: 120, top: 100, width: 390, height: 520 };
  const visible = { x: 48, y: 32, zoom: 1.1 };
  assert.equal(recoverCameraForTarget(visible, viewport, bounds), visible);

  const corrupted = { x: 349.85874802692217, y: 423.0443830949948, zoom: 0.06218346063853176 };
  const recovered = recoverCameraForTarget(corrupted, viewport, bounds);
  assert.ok(recovered.zoom > .9);
  assert.ok(recovered.zoom < 1.1);
  assert.ok(recovered.x < 200);
  assert.ok(recovered.y < 100);
});

test("review export expands related marks and crops to their padded union", () => {
  const annotations = [{
    id: "annotation_1",
    targetObjectIds: ["object_target"],
    markObjectIds: ["object_mark"],
    sourceTimeMs: null,
    status: "open",
    createdAt: "2026-07-30T00:00:00.000Z",
  }];
  assert.deepEqual([...reviewObjectIds(["object_target"], annotations)].sort(), ["object_mark", "object_target"]);
  assert.deepEqual(reviewBounds([
    { left: 100, top: 80, width: 200, height: 100 },
    { left: 130, top: 100, width: 40, height: 30 },
  ]), { left: 76, top: 56, width: 248, height: 148 });
});

test("shift constraints shapes and line angles", () => {
  assert.deepEqual(constrainDrag({ x: 0, y: 0 }, { x: 30, y: 10 }, "shape", true), { x: 30, y: 30 });
  const point = constrainDrag({ x: 0, y: 0 }, { x: 24, y: 8 }, "line", true);
  assert.ok(Math.abs(point.y) < 1e-10);
  assert.equal(constrainDrag({ x: 1, y: 2 }, { x: 8, y: 5 }, "line", false).x, 8);
});

test("annotation helpers expand marks and unlink matching relationships", () => {
  const annotations = [{
    id: "annotation_1",
    targetObjectIds: ["object_target"],
    markObjectIds: ["object_mark"],
    sourceTimeMs: null,
    status: "open",
    createdAt: new Date().toISOString(),
  }];
  assert.deepEqual(linkedMarkIds(annotations, ["object_target"]), ["object_mark"]);
  assert.deepEqual(annotationIdsForObjects(annotations, ["object_mark"]), ["annotation_1"]);
  const document = createEmptyDocument("page_helpers");
  document.page.annotations = annotations;
  const unlinked = unlinkAnnotations(document, ["object_target"]);
  assert.equal(unlinked.page.annotations.length, 0);
  assert.equal(document.page.annotations.length, 1);
});

test("effective target stays separate from the editable annotation selection", () => {
  const now = new Date().toISOString();
  const document = createEmptyDocument("page_targets");
  const base = {
    parentId: null,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
    zIndex: 0,
    locked: false,
    hidden: false,
    style: {},
    createdAt: now,
    updatedAt: now,
  };
  document.page.objects = [
    { ...base, id: "object_image_a", type: "image", data: { assetId: "asset_image_a", alt: "A", source: {} } },
    { ...base, id: "object_image_b", type: "image", zIndex: 1, data: { assetId: "asset_image_b", alt: "B", source: {} } },
    { ...base, id: "object_mark_a", type: "rect", zIndex: 2, data: {} },
  ];
  document.page.annotations = [{
    id: "annotation_a",
    targetObjectIds: ["object_image_a"],
    markObjectIds: ["object_mark_a"],
    sourceTimeMs: null,
    status: "open",
    createdAt: now,
  }];

  assert.deepEqual(reviewTargetIds(document), ["object_image_a", "object_image_b"]);
  assert.equal(resolveEffectiveTargetId(document, ["object_mark_a"], "object_image_b"), "object_image_a");
  assert.equal(resolveEffectiveTargetId(document, ["object_image_b"], "object_image_a"), "object_image_b");
  assert.equal(resolveEffectiveTargetId(document, [], "object_image_a"), "object_image_a");
  assert.equal(defaultReviewTargetId(document), "object_image_b");
});

test("focused scene merge edits target A without deleting target B or unrelated annotations", () => {
  const now = "2026-08-10T00:00:00.000Z";
  const document = createEmptyDocument("page_focused");
  const base = {
    parentId: null,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
    zIndex: 0,
    locked: false,
    hidden: false,
    style: {},
    createdAt: now,
    updatedAt: now,
  };
  document.page.objects = [
    { ...base, id: "object_target_a", type: "image", data: { assetId: "asset_a", alt: "A", source: {} } },
    { ...base, id: "object_mark_a", type: "rect", zIndex: 1, data: {} },
    { ...base, id: "object_target_b", type: "image", zIndex: 2, data: { assetId: "asset_b", alt: "B", source: {} } },
    { ...base, id: "object_mark_b", type: "text", zIndex: 3, data: { text: "keep", fontSize: 16, align: "left" } },
  ];
  document.page.annotations = [
    { id: "annotation_a", targetObjectIds: ["object_target_a"], markObjectIds: ["object_mark_a"], sourceTimeMs: null, status: "open", createdAt: now },
    { id: "annotation_b", targetObjectIds: ["object_target_b"], markObjectIds: ["object_mark_b"], sourceTimeMs: null, status: "open", createdAt: now },
  ];
  document.page.assets = {
    asset_a: { id: "asset_a", relativePath: "assets/a.png", mimeType: "image/png", sha256: "a".repeat(64), byteLength: 1, createdAt: now },
    asset_b: { id: "asset_b", relativePath: "assets/b.png", mimeType: "image/png", sha256: "b".repeat(64), byteLength: 1, createdAt: now },
  };

  const focused = focusedDocumentForTarget(document, "object_target_a");
  assert.deepEqual(focused.page.objects.map(({ id }) => id), ["object_target_a", "object_mark_a"]);
  focused.page.objects.find(({ id }) => id === "object_target_a").zIndex = 99;
  focused.page.objects.find(({ id }) => id === "object_mark_a").transform.x = 42;
  focused.page.objects.find(({ id }) => id === "object_mark_a").zIndex = 98;
  focused.page.objects.push({ ...base, id: "object_new_mark", type: "arrow", zIndex: 4, data: { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] } });
  focused.page.annotations[0].markObjectIds.push("object_new_mark");

  const merged = mergeFocusedScene(document, "object_target_a", focused);
  assert.equal(merged.page.objects.find(({ id }) => id === "object_mark_a").transform.x, 42);
  assert.equal(merged.page.objects.find(({ id }) => id === "object_target_a").zIndex, 0);
  assert.equal(merged.page.objects.find(({ id }) => id === "object_mark_a").zIndex, 1);
  assert.equal(merged.page.objects.find(({ id }) => id === "object_new_mark").zIndex, 4);
  assert.ok(merged.page.objects.some(({ id }) => id === "object_new_mark"));
  assert.deepEqual(merged.page.objects.find(({ id }) => id === "object_target_b"), document.page.objects.find(({ id }) => id === "object_target_b"));
  assert.deepEqual(merged.page.objects.find(({ id }) => id === "object_mark_b"), document.page.objects.find(({ id }) => id === "object_mark_b"));
  assert.deepEqual(merged.page.annotations.find(({ id }) => id === "annotation_b"), document.page.annotations.find(({ id }) => id === "annotation_b"));
  assert.deepEqual(merged.page.assets, document.page.assets);
});

test("mutation scheduler emits one save for a transaction and debounces text", async () => {
  let saves = 0;
  const scheduler = new MutationScheduler(() => { saves += 1; }, 4, 8);
  scheduler.transaction(() => {
    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
  });
  scheduler.schedule("text");
  scheduler.schedule("text");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(saves, 1);
  scheduler.cancel();
});

test("group contract stores stable ids and flat parent records", () => {
  const now = new Date().toISOString();
  const base = {
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
    zIndex: 0,
    locked: false,
    hidden: false,
    style: {},
    createdAt: now,
    updatedAt: now,
  };
  const document = WhiteboardDocumentSchema.parse({
    schemaVersion: 1,
    page: {
      id: "page_group",
      name: "Group",
      revision: 0,
      assets: {},
      annotations: [],
      objects: [
        { ...base, id: "object_group", type: "group", parentId: null, data: { childIds: ["object_child"] } },
        { ...base, id: "object_child", type: "rect", parentId: "object_group", data: {} },
      ],
    },
  });
  assert.deepEqual(document.page.objects[0].data, { childIds: ["object_child"] });
  assert.equal(document.page.objects[1].parentId, "object_group");
});
