import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const canvasRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(canvasRoot, "dist/build-manifest.json");
const before = JSON.parse(await readFile(manifestPath, "utf8"));
await execFileAsync(process.execPath, [resolve(canvasRoot, "build/build.mjs")], {
  timeout: 30_000,
  maxBuffer: 1024 * 1024,
});
const after = JSON.parse(await readFile(manifestPath, "utf8"));
if (before.sourceTreeSha256 !== after.sourceTreeSha256) {
  throw new Error(`Canvas source hash is not reproducible: ${before.sourceTreeSha256} != ${after.sourceTreeSha256}`);
}
process.stdout.write(`canvas source hash stable: ${after.sourceTreeSha256}\n`);
