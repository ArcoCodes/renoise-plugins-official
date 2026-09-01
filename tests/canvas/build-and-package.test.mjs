import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("final whiteboard dist is self-contained and free of unapproved canvas runtimes", () => {
  const server = readFileSync("features/canvas/dist/server.mjs", "utf8");
  const widget = readFileSync("features/canvas/dist/widget.html", "utf8");
  const manifest = JSON.parse(readFileSync("features/canvas/dist/build-manifest.json", "utf8"));
  for (const payload of [server, widget]) {
    assert.doesNotMatch(payload, /(?:tldraw|@tldraw\/|@excalidraw|reactflow|@xyflow)/i);
  }
  assert.match(widget, /<script type="module">/);
  assert.match(widget, /<style>/);
  assert.deepEqual(manifest.entrypoints, ["server.mjs", "widget.html"]);
  assert.match(manifest.sourceTreeSha256, /^[a-f0-9]{64}$/);
  assert.ok(manifest.widgetBytes > 100_000);
  assert.match(widget, /react-konva|Konva/i);
});

test("npm package contains runtime dist, MCP config, skill, and notices without source-only canvas files", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8" });
  const pack = JSON.parse(output)[0];
  const paths = new Set(pack.files.map(({ path }) => path));
  for (const required of [
    ".mcp.json",
    "features/canvas/dist/server.mjs",
    "features/canvas/dist/widget.html",
    "features/canvas/dist/build-manifest.json",
    "skills/canvas/SKILL.md",
    "THIRD_PARTY_NOTICES.md",
  ]) assert.ok(paths.has(required), `package must contain ${required}`);
  assert.equal(paths.has("features/canvas/server/main.ts"), false);
  assert.equal([...paths].some((path) => path.includes("node_modules/")), false);
});

test("Codex can start the packaged whiteboard MCP from the plugin root", async () => {
  const config = JSON.parse(readFileSync(".mcp.json", "utf8"));
  const whiteboard = config.mcpServers["renoise-whiteboard"];
  assert.deepEqual(whiteboard, {
    command: "node",
    args: ["features/canvas/dist/server.mjs"],
    cwd: ".",
  });
  assert.doesNotMatch(JSON.stringify(whiteboard), /\$\{pluginDir\}/);

  const transport = new StdioClientTransport({
    command: whiteboard.command,
    args: whiteboard.args,
    cwd: process.cwd(),
    stderr: "pipe",
  });
  const client = new Client({ name: "renoise-package-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.length >= 19);
    assert.ok(tools.some(({ name }) => name === "render_renoise_whiteboard_widget"));
  } finally {
    await client.close();
  }
});
