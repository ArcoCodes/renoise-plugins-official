import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assetGatewayHealthUrl,
  assetGatewayImportUrl,
  assetGatewayMediaUrl,
} from "../../features/canvas/dist/shared.mjs";
import { MediaGateway } from "../../features/canvas/build/.test-dist/media/media-gateway.js";
import { SessionStore } from "../../features/canvas/build/.test-dist/session/session-store.js";
import { ProjectStore } from "../../features/canvas/build/.test-dist/storage/project-store.js";

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const tinyMp4Bytes = Buffer.from([
  0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0, 0, 0, 0, 0, 0, 0, 0,
]);

async function activeSession(sessions, store, projectDir, name) {
  const session = sessions.create(projectDir, name);
  await sessions.authorize(session.id, projectDir, session.authorizationNonce);
  await store.initialize(session, name);
  return session;
}

test("loopback media gateway streams project assets with scoped capabilities and video ranges", async (context) => {
  const projectDir = await mkdtemp(join(tmpdir(), "renoise-media-gateway-"));
  context.after(() => rm(projectDir, { recursive: true, force: true }));
  const sessions = new SessionStore();
  const store = new ProjectStore();
  const session = await activeSession(sessions, store, projectDir, "Gateway Review");
  const gateway = await MediaGateway.start(sessions, store);
  context.after(() => gateway.close());
  const descriptor = gateway.describe(session);

  assert.match(descriptor.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  const health = await fetch(assetGatewayHealthUrl(descriptor));
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), "*");
  assert.equal((await health.json()).canvasSessionId, session.id);

  const imageUpload = await fetch(assetGatewayImportUrl(descriptor, "image", {
    expectedRevision: 0,
    fileName: "source.png",
    byteLength: tinyPngBytes.length,
    width: 1,
    height: 1,
    requestId: "upload_11111111111111111111111111111111",
  }), {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: tinyPngBytes,
  });
  assert.equal(imageUpload.status, 201);
  const importedImage = await imageUpload.json();
  assert.equal(importedImage.revision, 1);
  assert.equal(importedImage.asset.relativePath.startsWith("assets/"), true);
  assert.equal(JSON.stringify(importedImage).includes(projectDir), false);

  const imageUrl = assetGatewayMediaUrl(descriptor, importedImage.asset.id, "canvas");
  const imageResponse = await fetch(imageUrl);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type"), "image/png");
  assert.equal(imageResponse.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), tinyPngBytes);

  const imageHead = await fetch(imageUrl, { method: "HEAD" });
  assert.equal(imageHead.status, 200);
  assert.equal(Number(imageHead.headers.get("content-length")), tinyPngBytes.length);
  assert.equal((await imageHead.arrayBuffer()).byteLength, 0);

  const imageRange = await fetch(imageUrl, { headers: { range: "bytes=0-7" } });
  assert.equal(imageRange.status, 206);
  assert.equal(imageRange.headers.get("content-range"), `bytes 0-7/${tinyPngBytes.length}`);
  assert.deepEqual(Buffer.from(await imageRange.arrayBuffer()), tinyPngBytes.subarray(0, 8));

  const invalidTokenUrl = new URL(imageUrl);
  invalidTokenUrl.searchParams.set("access_token", "0".repeat(64));
  assert.equal((await fetch(invalidTokenUrl)).status, 401);

  // DNS rebinding: a request that reaches the loopback socket but carries a
  // foreign Host header must be rejected before any route or token handling.
  const healthUrl = new URL(assetGatewayHealthUrl(descriptor));
  const rebound = await new Promise((resolve, reject) => {
    const spoofed = httpRequest({
      host: healthUrl.hostname,
      port: healthUrl.port,
      path: `${healthUrl.pathname}${healthUrl.search}`,
      headers: { host: "attacker.example" },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    spoofed.on("error", reject);
    spoofed.end();
  });
  assert.equal(rebound, 421);

  const videoUpload = await fetch(assetGatewayImportUrl(descriptor, "video", {
    expectedRevision: 1,
    fileName: "source.mp4",
    byteLength: tinyMp4Bytes.length,
    durationMs: 1_200,
    requestId: "upload_22222222222222222222222222222222",
  }), {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    body: tinyMp4Bytes,
  });
  assert.equal(videoUpload.status, 201);
  const importedVideo = await videoUpload.json();
  assert.equal(importedVideo.revision, 2);
  const videoUrl = assetGatewayMediaUrl(descriptor, importedVideo.asset.id);
  const videoRange = await fetch(videoUrl, { headers: { range: "bytes=4-11" } });
  assert.equal(videoRange.status, 206);
  assert.equal(videoRange.headers.get("accept-ranges"), "bytes");
  assert.deepEqual(Buffer.from(await videoRange.arrayBuffer()), tinyMp4Bytes.subarray(4, 12));

  const second = await activeSession(sessions, store, projectDir, "Second Session");
  const secondDescriptor = gateway.describe(second);
  const crossed = new URL(imageUrl);
  crossed.searchParams.set("access_token", secondDescriptor.accessToken);
  assert.equal((await fetch(crossed)).status, 401);

  const state = await store.getState(session);
  assert.equal("renderBootstrap" in state, false);
  assert.equal(state.document.page.assets[importedImage.asset.id].sha256, importedImage.asset.sha256);
  assert.equal(state.document.page.assets[importedVideo.asset.id].sha256, importedVideo.asset.sha256);
});
