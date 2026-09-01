import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  RenoiseMaterialLibrary,
  trustedRenoiseMaterialPreviewUrl,
} from "../../features/canvas/build/.test-dist/renoise/material-library.js";

test("material preview URLs are exposed only from the approved Renoise HTTPS origin", () => {
  const material = { materialId: 1, name: "Still", type: "image", mimeType: "image/png" };
  assert.equal(
    trustedRenoiseMaterialPreviewUrl({ ...material, url: "https://asset.renoise.ai/assets/materials/1.png?verify=signed" }),
    "https://asset.renoise.ai/assets/materials/1.png?verify=signed",
  );
  assert.equal(trustedRenoiseMaterialPreviewUrl({ ...material, url: "http://asset.renoise.ai/1.png" }), undefined);
  assert.equal(trustedRenoiseMaterialPreviewUrl({ ...material, url: "https://asset.renoise.ai.evil.example/1.png" }), undefined);
});

test("material adapter uses bounded execFile argv and strictly parses CLI JSON", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "renoise-material-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const cli = join(directory, "fake-renoise");
  const capture = join(directory, "argv.json");
  await writeFile(cli, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.RENOISE_CAPTURE, JSON.stringify(process.argv.slice(2)));
if (process.argv.includes("invalid-json")) { process.stdout.write("not json"); process.exit(0); }
if (process.argv.includes("nonzero")) process.exit(9);
const idArg = process.argv[process.argv.indexOf("--ids") + 1];
const ids = process.argv.includes("--ids") ? idArg.split(",").map(Number) : [41, 42];
process.stdout.write(JSON.stringify({ materials: ids.map((id) => ({ id, name: "Material " + id, type: id % 2 ? "image" : "video", mimeType: id % 2 ? "image/png" : "video/mp4", url: "https://asset.renoise.ai/signed/" + id, ignored: true })) }));
`);
  await chmod(cli, 0o755);
  const previous = process.env.RENOISE_CAPTURE;
  process.env.RENOISE_CAPTURE = capture;
  context.after(() => { if (previous === undefined) delete process.env.RENOISE_CAPTURE; else process.env.RENOISE_CAPTURE = previous; });

  const library = new RenoiseMaterialLibrary(cli);
  const listed = await library.list({ search: "hero still", type: "image", limit: 2, offset: 4 });
  assert.deepEqual(JSON.parse(await readFile(capture, "utf8")), ["material", "--json", "--limit", "2", "--offset", "4", "--search", "hero still", "--type", "image"]);
  assert.equal(listed.hasMore, true);
  assert.deepEqual(listed.materials[0], { materialId: 41, name: "Material 41", type: "image", mimeType: "image/png", url: "https://asset.renoise.ai/signed/41" });

  const resolved = await library.resolve([42, 41, 42]);
  assert.deepEqual(JSON.parse(await readFile(capture, "utf8")), ["material", "--json", "--ids", "42,41"]);
  assert.deepEqual(resolved.map(({ materialId }) => materialId), [42, 41]);
  await assert.rejects(() => library.list({ search: "invalid-json", limit: 2, offset: 0 }), /invalid JSON/);
  await assert.rejects(() => library.list({ search: "nonzero", limit: 2, offset: 0 }), /command failed/);
});

test("material adapter falls back to an absolute CLI path when the app PATH cannot resolve renoise", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "renoise-material-cli-fallback-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const cli = join(directory, "renoise");
  await writeFile(cli, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ materials: [{ id: 73, name: "Fallback", type: "image", mimeType: "image/png", url: "https://asset.renoise.ai/signed/73" }] }));
`);
  await chmod(cli, 0o755);

  const library = new RenoiseMaterialLibrary([join(directory, "missing-renoise"), cli]);
  const listed = await library.list({ limit: 1, offset: 0 });
  assert.deepEqual(listed.materials.map(({ materialId }) => materialId), [73]);
});

test("material adapter ignores audio rows without rejecting a mixed visual-material page", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "renoise-material-cli-mixed-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const cli = join(directory, "renoise");
  await writeFile(cli, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ materials: [
  { id: 81, name: "Still", type: "image", mimeType: "image/png", url: "https://asset.renoise.ai/signed/81" },
  { id: 82, name: "Score", type: "audio", mimeType: "audio/mpeg", url: "https://asset.renoise.ai/signed/82" },
  { id: 83, name: "Clip", type: "video", mimeType: "video/mp4", url: "https://asset.renoise.ai/signed/83" }
] }));
`);
  await chmod(cli, 0o755);

  const listed = await new RenoiseMaterialLibrary(cli).list({ limit: 3, offset: 0 });
  assert.deepEqual(listed.materials.map(({ materialId }) => materialId), [81, 83]);
  assert.equal(listed.hasMore, true, "pagination follows the raw CLI page size, not the post-filter size");
});

test("material preview cache is populated by list, bounded, expires, and never caches misses", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "renoise-material-preview-cache-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const cli = join(directory, "fake-renoise");
  const countFile = join(directory, "count.txt");
  await writeFile(countFile, "0");
  await writeFile(cli, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const countFile = process.env.RENOISE_COUNT_FILE;
writeFileSync(countFile, String(Number(readFileSync(countFile, "utf8")) + 1));
const idIndex = process.argv.indexOf("--ids");
const ids = idIndex >= 0 ? process.argv[idIndex + 1].split(",").map(Number) : Array.from({ length: 24 }, (_, index) => index + 1);
const materials = ids.filter((id) => id !== 999).map((id) => ({ id, name: "Material " + id, type: "image", mimeType: "image/png", url: "https://asset.renoise.ai/signed/" + id }));
process.stdout.write(JSON.stringify({ materials }));
`);
  await chmod(cli, 0o755);
  const previous = process.env.RENOISE_COUNT_FILE;
  process.env.RENOISE_COUNT_FILE = countFile;
  context.after(() => { if (previous === undefined) delete process.env.RENOISE_COUNT_FILE; else process.env.RENOISE_COUNT_FILE = previous; });
  let now = 1_000;
  const library = new RenoiseMaterialLibrary(cli, { previewTtlMs: 100, previewCacheMax: 24, now: () => now });
  await library.list({ limit: 24, offset: 0 });
  await Promise.all(Array.from({ length: 24 }, (_, index) => library.preview(index + 1)));
  assert.equal(Number(await readFile(countFile, "utf8")), 1, "listed thumbnails must not start 24 additional CLI processes");

  now += 101;
  assert.equal((await library.preview(1)).materialId, 1);
  assert.equal(Number(await readFile(countFile, "utf8")), 2, "an expired preview must be freshly resolved");
  assert.equal((await library.preview(25)).materialId, 25);
  assert.equal(Number(await readFile(countFile, "utf8")), 3, "a cache miss resolves exactly once");
  await assert.rejects(() => library.preview(999), /does not exist/);
  await assert.rejects(() => library.preview(999), /does not exist/);
  assert.equal(Number(await readFile(countFile, "utf8")), 5, "failed preview lookups must not be cached");
});
