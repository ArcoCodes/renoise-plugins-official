import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const canvasRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(canvasRoot, "../..");
const dist = join(canvasRoot, "dist");
const temporary = join(canvasRoot, "build", ".tmp");
const testDist = join(canvasRoot, "build", ".test-dist");

async function sourceFiles(directory) {
  const values = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["dist", ".tmp", ".test-dist", "test-results", "playwright-report"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await sourceFiles(path));
    else values.push(path);
  }
  return values;
}

const inputs = (await sourceFiles(canvasRoot)).sort();
const sourceHash = createHash("sha256");
for (const path of inputs) {
  sourceHash.update(relative(repositoryRoot, path));
  sourceHash.update(await readFile(path));
}
const sourceTreeSha256 = sourceHash.digest("hex");
const widgetBuildId = sourceTreeSha256.slice(0, 12);
const buildDefines = {
  __RENOISE_WIDGET_BUILD_ID__: JSON.stringify(widgetBuildId),
};

await rm(dist, { recursive: true, force: true });
await rm(temporary, { recursive: true, force: true });
await rm(testDist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(temporary, { recursive: true });
await mkdir(testDist, { recursive: true });

const widget = await build({
  entryPoints: [join(canvasRoot, "widget/src/main.tsx")],
  outdir: temporary,
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: false,
  metafile: true,
  entryNames: "widget",
  assetNames: "assets/[name]-[hash]",
  loader: { ".woff2": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
  define: buildDefines,
});

const server = await build({
  entryPoints: [join(canvasRoot, "server/main.ts")],
  outfile: join(dist, "server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: true,
  sourcemap: false,
  metafile: true,
  banner: { js: "#!/usr/bin/env node" },
  define: { ...buildDefines, __RENOISE_TEST_ADAPTERS__: "false" },
});

await build({
  entryPoints: [join(canvasRoot, "shared/index.ts")],
  outfile: join(dist, "shared.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false,
});

await build({
  entryPoints: [
    join(canvasRoot, "server/session/session-store.ts"),
    join(canvasRoot, "server/storage/project-store.ts"),
    join(canvasRoot, "server/media/media-gateway.ts"),
    join(canvasRoot, "server/renoise/material-library.ts"),
  ],
  outdir: testDist,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false,
  define: { ...buildDefines, __RENOISE_TEST_ADAPTERS__: "true" },
});

const htmlTemplate = await readFile(join(canvasRoot, "widget/index.html"), "utf8");
const javascript = (await readFile(join(temporary, "widget.js"), "utf8")).replaceAll("</script", "<\\\\/script");
const cssPath = join(temporary, "widget.css");
let css = "";
try { css = await readFile(cssPath, "utf8"); } catch { /* no extracted CSS */ }
const widgetHtml = htmlTemplate.replace(
  "<!-- RENOISE_WIDGET_ASSETS -->",
  () => `<style>${css}</style><script type="module">${javascript}</script>`,
);
await writeFile(join(dist, "widget.html"), widgetHtml);

// Keep checked-in distribution files diff-clean across esbuild versions.
for (const fileName of ["server.mjs", "shared.mjs", "widget.html"]) {
  const outputPath = join(dist, fileName);
  const text = await readFile(outputPath, "utf8");
  await writeFile(outputPath, text.replace(/[ \t]+$/gm, ""));
}

const manifest = {
  schemaVersion: 1,
  sourceTreeSha256,
  widgetBuildId,
  entrypoints: ["server.mjs", "widget.html"],
  widgetBytes: (await readFile(join(dist, "widget.html"))).byteLength,
  serverInputs: Object.keys(server.metafile.inputs).sort(),
  widgetInputs: Object.keys(widget.metafile.inputs).sort(),
};
await writeFile(join(dist, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(dist, "metafile.json"), `${JSON.stringify({ server: server.metafile, widget: widget.metafile }, null, 2)}\n`);
await rm(temporary, { recursive: true, force: true });
