#!/usr/bin/env node

/**
 * Generate an interactive DAG Canvas HTML from project.json.
 *
 * Renders nodes (materials, images, videos, assets, composites) as draggable cards
 * on an SVG canvas with directed edges showing dependencies (ref_image, ref_video,
 * first_frame/last_frame, asset reference, clip_input, etc.).
 *
 * Supports auto-refresh via file watcher polling (no server needed).
 *
 * Usage:
 *   node generate-canvas.mjs <project-dir>
 *   node generate-canvas.mjs <project-dir> --output custom.html
 *   node generate-canvas.mjs <project-dir> --watch          # embed auto-refresh
 *
 * Expects:
 *   <project-dir>/project.json
 */

import fs from "fs";
import path from "path";

function parseArgs(argv) {
  let projectDir = null;
  let output = null;
  let watch = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output" || argv[i] === "-o") output = argv[++i];
    else if (argv[i] === "--watch" || argv[i] === "-w") watch = true;
    else if (!argv[i].startsWith("-")) projectDir = argv[i];
  }
  return { projectDir, output, watch };
}

// ── Auto-layout if positions missing ────────────────────────────────────
function autoLayout(nodes, edges) {
  // Build adjacency for topological layers
  const inDeg = {};
  const adj = {};
  for (const n of nodes) { inDeg[n.id] = 0; adj[n.id] = []; }
  for (const e of edges) {
    if (adj[e.source]) adj[e.source].push(e.target);
    if (inDeg[e.target] !== undefined) inDeg[e.target]++;
  }

  // BFS topological layers
  const layers = [];
  const queue = Object.keys(inDeg).filter(k => inDeg[k] === 0);
  const visited = new Set();
  while (queue.length > 0) {
    const layer = [...queue];
    layers.push(layer);
    queue.length = 0;
    for (const n of layer) {
      visited.add(n);
      for (const t of (adj[n] || [])) {
        inDeg[t]--;
        if (inDeg[t] === 0 && !visited.has(t)) queue.push(t);
      }
    }
  }
  // Any unvisited (cycles or orphans)
  const orphans = nodes.filter(n => !visited.has(n.id)).map(n => n.id);
  if (orphans.length) layers.push(orphans);

  const COL_W = 300;
  const ROW_H = 170;
  const PAD_X = 60;
  const PAD_Y = 60;

  const maxLayerSize = Math.max(...layers.map(l => l.length));
  const totalHeight = PAD_Y * 2 + maxLayerSize * ROW_H;

  for (let col = 0; col < layers.length; col++) {
    const layer = layers[col];
    // Center this layer vertically within the total height
    const layerHeight = layer.length * ROW_H;
    const yOffset = (totalHeight - layerHeight) / 2;

    for (let row = 0; row < layer.length; row++) {
      const node = nodes.find(n => n.id === layer[row]);
      if (node && (!node.position || (node.position.x === 0 && node.position.y === 0))) {
        node.position = {
          x: PAD_X + col * COL_W,
          y: yOffset + row * ROW_H
        };
      }
    }
  }

  return { width: PAD_X * 2 + layers.length * COL_W, height: totalHeight };
}

// ── Node visual config ──────────────────────────────────────────────────
const NODE_STYLES = {
  material:  { icon: "📁", color: "#3b82f6", bg: "#1e293b", border: "#3b82f6" },
  image:     { icon: "🖼️", color: "#a855f7", bg: "#1e1b2e", border: "#a855f7" },
  video:     { icon: "🎬", color: "#f59e0b", bg: "#1c1917", border: "#f59e0b" },
  asset:     { icon: "🛡️", color: "#10b981", bg: "#0f1f1a", border: "#10b981" },
  character: { icon: "👤", color: "#ec4899", bg: "#1f0a1a", border: "#ec4899" },
  composite: { icon: "🎞️", color: "#6366f1", bg: "#0f0f2e", border: "#6366f1" },
};

const EDGE_STYLES = {
  ref_image:        { color: "#3b82f6", dash: "",       label: "ref_image" },
  style_anchor:     { color: "#a855f7", dash: "8,4",    label: "style" },
  ref_video:        { color: "#f59e0b", dash: "",       label: "ref_video" },
  first_frame:      { color: "#14b8a6", dash: "4,4",    label: "first_frame" },
  last_frame:       { color: "#f43f5e", dash: "4,4",    label: "last_frame" },
  image1:           { color: "#64748b", dash: "4,2",    label: "image1" },
  image2:           { color: "#64748b", dash: "4,2",    label: "image2" },
  reference_image:  { color: "#10b981", dash: "",       label: "asset_ref" },
  character_ref:    { color: "#ec4899", dash: "",       label: "char_ref" },
  source_material:  { color: "#6b7280", dash: "2,2",    label: "register" },
  clip_input:       { color: "#6366f1", dash: "6,3",    label: "clip" },
};

const NODE_W = 230;
const NODE_H = 130;

// ── Generate HTML ───────────────────────────────────────────────────────
function generateHTML(data, watch) {
  const project = data.project || {};
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const characters = data.characters || [];
  const styleGuide = data.style_guide || {};
  const budget = data.budget || {};
  const execution = data.execution || {};

  const dims = autoLayout(nodes, edges);
  const canvasW = Math.max(dims.width + 200, 1400);
  const canvasH = Math.max(dims.height + 200, 800);

  const title = project.title || "Untitled Project";
  const totalDuration = nodes.filter(n => n.type === "video").reduce((s, n) => s + (n.duration_s || 0), 0);
  const videoCount = nodes.filter(n => n.type === "video").length;
  const statusCounts = {};
  for (const n of nodes) statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;

  // ── Build node HTML ──
  const nodeEls = nodes.map(n => {
    const isKeyframe = n.type === "image" && n.purpose === "keyframe";
    const style = isKeyframe
      ? { icon: "🎯", color: "#f97316", bg: "#1c1308", border: "#f97316" }
      : (NODE_STYLES[n.type] || NODE_STYLES.material);
    const x = n.position?.x || 0;
    const y = n.position?.y || 0;

    // Status badge
    const statusColors = { pending: "#64748b", generating: "#f59e0b", completed: "#10b981", failed: "#ef4444", skipped: "#6b7280" };
    const statusColor = statusColors[n.status] || "#64748b";

    // Build detail lines based on type
    let details = "";
    if (n.type === "video") {
      details = `
        <div class="node-detail">${n.duration_s || 15}s · ${n.emotion || ""} · E${n.energy || "?"}</div>
        <div class="node-detail">${n.story_function || ""}</div>
        ${n.prompt_status ? `<div class="node-detail">prompt: ${n.prompt_status}</div>` : ""}
      `;
    } else if (n.type === "image") {
      details = `<div class="node-detail">${n.purpose || ""} · ${n.model || ""}</div>`;
    } else if (n.type === "material") {
      const a = n.analysis || {};
      details = `<div class="node-detail">${a.content_type || ""} · ${a.relevance || ""}</div>`;
      if (a.has_face) details += `<div class="node-detail" style="color:#f43f5e;">⚠ has face</div>`;
    } else if (n.type === "asset") {
      details = `<div class="node-detail">${n.name || ""}</div>`;
      if (n.asset_id) details += `<div class="node-detail">asset:${n.asset_id}</div>`;
    } else if (n.type === "composite") {
      details = `<div class="node-detail">${n.operation || ""}</div>`;
    }

    // Incoming/outgoing edge count
    const inCount = edges.filter(e => e.target === n.id).length;
    const outCount = edges.filter(e => e.source === n.id).length;

    return `
      <div class="node" id="node-${n.id}" data-id="${n.id}"
           style="left:${x}px; top:${y}px; border-color:${style.border}; background:${style.bg};"
           title="${n.id}">
        <div class="node-header">
          <span class="node-icon">${style.icon}</span>
          <span class="node-label">${n.label || n.id}</span>
          <span class="node-status" style="background:${statusColor};">${n.status}</span>
        </div>
        ${details}
        <div class="node-ports">
          <span class="port port-in" title="${inCount} inputs">${inCount > 0 ? `← ${inCount}` : ""}</span>
          <span class="port port-out" title="${outCount} outputs">${outCount > 0 ? `${outCount} →` : ""}</span>
        </div>
      </div>
    `;
  }).join("\n");

  // ── Build edges data for JS rendering ──
  const edgesJSON = JSON.stringify(edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    role: e.role,
    style: EDGE_STYLES[e.role] || { color: "#6b7280", dash: "", label: e.role }
  })));

  // ── Validation warnings ──
  const warnings = [];
  // Style anchor consistency
  const videoNodes = nodes.filter(n => n.type === "video");
  const styleEdges = edges.filter(e => e.role === "style_anchor");
  if (styleEdges.length > 0 && styleEdges.length < videoNodes.length) {
    const missing = videoNodes.filter(v => !styleEdges.some(e => e.target === v.id));
    warnings.push(`⚠ Style anchor missing on: ${missing.map(n => n.label || n.id).join(", ")}`);
  }
  // Mutual exclusivity
  for (const vn of videoNodes) {
    const inEdges = edges.filter(e => e.target === vn.id);
    const hasFrame = inEdges.some(e => e.role === "first_frame" || e.role === "last_frame");
    const hasRef = inEdges.some(e => ["ref_image", "ref_video", "reference_image", "character_ref", "style_anchor"].includes(e.role));
    if (hasFrame && hasRef) {
      warnings.push(`⚠ ${vn.label}: cannot mix first/last_frame with ref_image/ref_video`);
    }
  }
  // Face safety
  for (const e of edges) {
    if (e.role === "ref_image") {
      const src = nodes.find(n => n.id === e.source);
      if (src?.type === "material" && src.analysis?.has_face) {
        warnings.push(`⚠ ${src.label} has face but used as ref_image → will be blocked`);
      }
    }
  }
  // Budget
  if (budget.estimated_total && budget.available_credits && budget.estimated_total > budget.available_credits) {
    warnings.push(`⚠ Budget: estimated ${budget.estimated_total} > available ${budget.available_credits}`);
  }

  const warningsHTML = warnings.length > 0
    ? `<div class="warnings">${warnings.map(w => `<div class="warning">${w}</div>`).join("")}</div>`
    : "";

  // ── Characters panel ──
  const charsHTML = characters.map(c => {
    const charNodes = nodes.filter(n => n.type === "asset" && n.character_id === c.id);
    const hasAnchor = charNodes.length > 0;
    return `<div class="char-card">
      <div class="char-name">${c.name} ${hasAnchor ? "🛡️" : "📝"}</div>
      <div class="char-detail">${c.appearance?.slice(0, 80)}...</div>
      <div class="char-segments">Appears in: ${(nodes.filter(n => n.type === "video" && n.characters?.includes(c.id)).map(n => n.shot_id || n.id)).join(", ")}</div>
    </div>`;
  }).join("");

  // ── Execution phases ──
  const phasesHTML = (execution.execution_order || []).map((p, i) => {
    const phaseNodes = p.nodes.map(nid => {
      const node = nodes.find(n => n.id === nid);
      return node ? `<span class="phase-node" style="border-color:${(NODE_STYLES[node.type] || {}).border || "#666"};">${node.label || nid}</span>` : nid;
    }).join("");
    return `<div class="phase"><span class="phase-label">Phase ${i + 1}${p.parallel ? " ∥" : " →"}</span>${phaseNodes}</div>`;
  }).join("");

  // ── Watch script ──
  const watchScript = watch ? `
    <script>
      // Auto-refresh: poll project.json mtime every 2s
      let lastMtime = null;
      async function checkRefresh() {
        try {
          // Use a cache-busting query param on the HTML itself
          const resp = await fetch(window.location.href, { method: 'HEAD', cache: 'no-cache' });
          const mtime = resp.headers.get('last-modified');
          if (lastMtime && mtime !== lastMtime) {
            window.location.reload();
          }
          lastMtime = mtime;
        } catch(e) {}
        setTimeout(checkRefresh, 2000);
      }
      checkRefresh();
    </script>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — DAG Canvas</title>
<style>
  :root {
    --bg: #0a0a14;
    --bg-panel: #10101e;
    --bg-card: #16162a;
    --border: #1e1e3a;
    --text: #e0e0f0;
    --text-dim: #8888aa;
    --text-muted: #555566;
    --accent: #6c6cff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; overflow: hidden; height: 100vh; }

  /* ── Layout ── */
  .app { display: grid; grid-template-columns: 1fr 300px; grid-template-rows: 56px 1fr; height: 100vh; }
  .header { grid-column: 1 / -1; background: var(--bg-panel); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; gap: 24px; z-index: 100; }
  .canvas-wrap { position: relative; overflow: hidden; background: var(--bg); cursor: grab; }
  .canvas-wrap.grabbing { cursor: grabbing; }
  .sidebar { background: var(--bg-panel); border-left: 1px solid var(--border); overflow-y: auto; padding: 16px; }

  /* ── Header ── */
  .header h1 { font-size: 16px; font-weight: 600; white-space: nowrap; }
  .stat { text-align: center; }
  .stat-val { font-size: 16px; font-weight: 700; }
  .stat-label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }
  .header .status-chip { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }

  /* ── Canvas ── */
  .canvas { position: absolute; top: 0; left: 0; width: ${canvasW}px; height: ${canvasH}px; transform-origin: 0 0; }
  .canvas svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }

  /* ── Grid dots ── */
  .grid-pattern { position: absolute; width: 100%; height: 100%; background-image: radial-gradient(circle, #1a1a2e 1px, transparent 1px); background-size: 30px 30px; z-index: 0; }

  /* ── Nodes ── */
  .node { position: absolute; width: ${NODE_W}px; min-height: 80px; border: 1.5px solid; border-radius: 10px; padding: 10px 12px; z-index: 10; cursor: pointer; transition: box-shadow 0.15s; font-size: 12px; }
  .node:hover { box-shadow: 0 0 20px rgba(108, 108, 255, 0.2); z-index: 20; }
  .node.selected { box-shadow: 0 0 0 2px var(--accent), 0 0 24px rgba(108, 108, 255, 0.3); z-index: 30; }
  .node-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .node-icon { font-size: 14px; }
  .node-label { font-weight: 600; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node-status { font-size: 9px; padding: 1px 6px; border-radius: 6px; color: #fff; font-weight: 600; text-transform: uppercase; }
  .node-detail { color: var(--text-dim); font-size: 11px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node-ports { display: flex; justify-content: space-between; margin-top: 6px; }
  .port { font-size: 10px; color: var(--text-muted); }

  /* ── Edge labels ── */
  .edge-label { font-size: 9px; fill: var(--text-muted); pointer-events: none; }

  /* ── Sidebar ── */
  .sidebar h2 { font-size: 13px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 8px; }
  .sidebar h2:first-child { margin-top: 0; }

  /* Warnings */
  .warnings { margin-bottom: 12px; }
  .warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 6px 10px; font-size: 11px; color: #fbbf24; margin-bottom: 4px; }

  /* Characters */
  .char-card { background: var(--bg-card); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
  .char-name { font-weight: 600; font-size: 12px; margin-bottom: 2px; }
  .char-detail { font-size: 10px; color: var(--text-dim); line-height: 1.3; }
  .char-segments { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

  /* Phases */
  .phase { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .phase-label { font-size: 10px; color: var(--text-muted); font-weight: 600; min-width: 70px; }
  .phase-node { font-size: 10px; padding: 2px 8px; border: 1px solid; border-radius: 4px; background: var(--bg-card); white-space: nowrap; }

  /* Detail panel */
  .detail-panel { background: var(--bg-card); border-radius: 8px; padding: 12px; margin-bottom: 12px; display: none; }
  .detail-panel.visible { display: block; }
  .detail-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 11px; }
  .detail-key { color: var(--text-muted); min-width: 80px; }
  .detail-val { color: var(--text); flex: 1; word-break: break-all; }

  /* Edge legend */
  .legend { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-dim); }
  .legend-line { width: 20px; height: 2px; }

  /* Zoom controls */
  .zoom-controls { position: absolute; bottom: 16px; right: 16px; display: flex; gap: 4px; z-index: 50; }
  .zoom-btn { width: 32px; height: 32px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-panel); color: var(--text); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .zoom-btn:hover { background: var(--bg-card); }
  .zoom-label { font-size: 11px; color: var(--text-dim); padding: 0 8px; display: flex; align-items: center; }

  /* Mini-map */
  .minimap { position: absolute; bottom: 56px; right: 16px; width: 180px; height: 120px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px; z-index: 50; overflow: hidden; }
  .minimap-viewport { position: absolute; border: 1.5px solid var(--accent); border-radius: 2px; pointer-events: none; }
  .minimap canvas { width: 100%; height: 100%; }
</style>
</head>
<body>
<div class="app">
  <!-- Header -->
  <div class="header">
    <h1>🎬 ${title}</h1>
    <div class="stat"><div class="stat-val">${videoCount}</div><div class="stat-label">Clips</div></div>
    <div class="stat"><div class="stat-val">${totalDuration}s</div><div class="stat-label">Duration</div></div>
    <div class="stat"><div class="stat-val">${project.ratio || "16:9"}</div><div class="stat-label">Ratio</div></div>
    <div class="stat"><div class="stat-val">${nodes.length}</div><div class="stat-label">Nodes</div></div>
    <div class="stat"><div class="stat-val">${edges.length}</div><div class="stat-label">Edges</div></div>
    <div class="stat"><div class="stat-val">~${execution.estimated_credits || "?"}</div><div class="stat-label">Credits</div></div>
    <span class="status-chip" style="background:${project.status === "ready" ? "#10b981" : project.status === "executing" ? "#f59e0b" : project.status === "completed" ? "#6366f1" : "#64748b"};">${project.status || "planning"}</span>
  </div>

  <!-- Canvas -->
  <div class="canvas-wrap" id="canvasWrap">
    <div class="canvas" id="canvas">
      <div class="grid-pattern"></div>
      <svg id="edgeSvg"></svg>
      ${nodeEls}
    </div>
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoomOut">−</button>
      <span class="zoom-label" id="zoomLabel">100%</span>
      <button class="zoom-btn" id="zoomIn">+</button>
      <button class="zoom-btn" id="zoomFit" title="Fit to view">⊞</button>
    </div>
  </div>

  <!-- Sidebar -->
  <div class="sidebar">
    ${warningsHTML}

    <h2>Selected Node</h2>
    <div class="detail-panel" id="detailPanel">
      <div id="detailContent"></div>
    </div>

    <h2>Edge Legend</h2>
    <div class="legend">
      ${Object.entries(EDGE_STYLES).map(([role, s]) => `
        <div class="legend-item">
          <div class="legend-line" style="background:${s.color};${s.dash ? `background:repeating-linear-gradient(90deg,${s.color} 0,${s.color} 4px,transparent 4px,transparent 8px)` : ""}"></div>
          ${s.label}
        </div>
      `).join("")}
    </div>

    <h2>Characters</h2>
    ${charsHTML || '<div style="color:var(--text-muted);font-size:11px;">No characters defined</div>'}

    <h2>Style</h2>
    <div style="font-size:11px;color:var(--text-dim);line-height:1.5;">
      ${styleGuide.visual_style || "—"}<br>
      <span style="color:var(--text-muted);">Palette:</span> ${(styleGuide.color_palette || []).join(", ") || "—"}
    </div>

    <h2>Execution Order</h2>
    ${phasesHTML || '<div style="color:var(--text-muted);font-size:11px;">Not computed</div>'}

    <h2>Budget</h2>
    <div style="font-size:11px; color:var(--text-dim);">
      Available: ${budget.available_credits ?? "?"} · Estimated: ${budget.estimated_total ?? "?"} · Spent: ${budget.spent ?? 0}
    </div>
  </div>
</div>

<script>
// ── Edge data ──
const EDGES = ${edgesJSON};
const NODE_W = ${NODE_W};
const NODE_H = ${NODE_H};

// ── State ──
let scale = 1;
let panX = 0, panY = 0;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let selectedNode = null;

const canvas = document.getElementById("canvas");
const wrap = document.getElementById("canvasWrap");
const svg = document.getElementById("edgeSvg");

// ── Pan & Zoom ──
function applyTransform() {
  canvas.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${scale})\`;
  document.getElementById("zoomLabel").textContent = Math.round(scale * 100) + "%";
}

wrap.addEventListener("mousedown", e => {
  if (e.target === wrap || e.target.classList.contains("grid-pattern")) {
    isPanning = true;
    panStart = { x: e.clientX - panX, y: e.clientY - panY };
    wrap.classList.add("grabbing");
  }
});
window.addEventListener("mousemove", e => {
  if (!isPanning) return;
  panX = e.clientX - panStart.x;
  panY = e.clientY - panStart.y;
  applyTransform();
});
window.addEventListener("mouseup", () => { isPanning = false; wrap.classList.remove("grabbing"); });

wrap.addEventListener("wheel", e => {
  e.preventDefault();
  const rect = wrap.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const worldX = (mx - panX) / scale;
  const worldY = (my - panY) / scale;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  scale = Math.min(3, Math.max(0.15, scale * factor));
  panX = mx - worldX * scale;
  panY = my - worldY * scale;
  applyTransform();
}, { passive: false });

document.getElementById("zoomIn").onclick = () => { scale = Math.min(3, scale * 1.2); applyTransform(); };
document.getElementById("zoomOut").onclick = () => { scale = Math.max(0.15, scale / 1.2); applyTransform(); };
document.getElementById("zoomFit").onclick = fitView;

function fitView() {
  const nodes = document.querySelectorAll(".node");
  if (!nodes.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    const x = parseFloat(n.style.left);
    const y = parseFloat(n.style.top);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
  });
  const pad = 60;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;
  const rect = wrap.getBoundingClientRect();
  scale = Math.min(rect.width / bw, rect.height / bh, 1.5);
  panX = (rect.width - bw * scale) / 2 - (minX - pad) * scale;
  panY = (rect.height - bh * scale) / 2 - (minY - pad) * scale;
  applyTransform();
}

// ── Draw Edges ──
function drawEdges() {
  svg.innerHTML = "";
  // defs for arrowheads
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const colors = new Set(EDGES.map(e => e.style.color));
  colors.forEach(c => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrow-" + c.replace("#", ""));
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "path");
    poly.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    poly.setAttribute("fill", c);
    marker.appendChild(poly);
    defs.appendChild(marker);
  });
  svg.appendChild(defs);

  for (const edge of EDGES) {
    const srcEl = document.getElementById("node-" + edge.source);
    const tgtEl = document.getElementById("node-" + edge.target);
    if (!srcEl || !tgtEl) continue;

    const sx = parseFloat(srcEl.style.left) + NODE_W;
    const sy = parseFloat(srcEl.style.top) + NODE_H / 2;
    const tx = parseFloat(tgtEl.style.left);
    const ty = parseFloat(tgtEl.style.top) + NODE_H / 2;

    // Bezier curve
    const dx = Math.abs(tx - sx);
    const cp = Math.max(50, dx * 0.4);

    const pathD = \`M \${sx} \${sy} C \${sx + cp} \${sy}, \${tx - cp} \${ty}, \${tx} \${ty}\`;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    path.setAttribute("stroke", edge.style.color);
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("fill", "none");
    path.setAttribute("marker-end", "url(#arrow-" + edge.style.color.replace("#", "") + ")");
    if (edge.style.dash) path.setAttribute("stroke-dasharray", edge.style.dash);
    svg.appendChild(path);

    // Label at midpoint
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2 - 8;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", mx);
    text.setAttribute("y", my);
    text.setAttribute("class", "edge-label");
    text.setAttribute("text-anchor", "middle");
    text.textContent = edge.style.label;
    svg.appendChild(text);
  }
}

// ── Node Selection ──
document.querySelectorAll(".node").forEach(el => {
  el.addEventListener("click", e => {
    e.stopPropagation();
    document.querySelectorAll(".node.selected").forEach(n => n.classList.remove("selected"));
    el.classList.add("selected");
    selectedNode = el.dataset.id;
    showDetail(el.dataset.id);
  });
});
wrap.addEventListener("click", e => {
  if (e.target === wrap || e.target.classList.contains("grid-pattern")) {
    document.querySelectorAll(".node.selected").forEach(n => n.classList.remove("selected"));
    selectedNode = null;
    document.getElementById("detailPanel").classList.remove("visible");
  }
});

function showDetail(nodeId) {
  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  const allNodes = ${JSON.stringify(nodes)};
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return;

  const inEdges = EDGES.filter(e => e.target === nodeId);
  const outEdges = EDGES.filter(e => e.source === nodeId);

  let html = '<div class="detail-row"><div class="detail-key">ID</div><div class="detail-val">' + node.id + '</div></div>';
  html += '<div class="detail-row"><div class="detail-key">Type</div><div class="detail-val">' + node.type + '</div></div>';
  html += '<div class="detail-row"><div class="detail-key">Status</div><div class="detail-val">' + node.status + '</div></div>';

  if (node.type === "video") {
    html += '<div class="detail-row"><div class="detail-key">Scene</div><div class="detail-val">' + (node.scene || "—") + '</div></div>';
    html += '<div class="detail-row"><div class="detail-key">Action</div><div class="detail-val">' + (node.action || "—") + '</div></div>';
    html += '<div class="detail-row"><div class="detail-key">Camera</div><div class="detail-val">' + (node.camera || "—") + '</div></div>';
    if (node.continuity_in) html += '<div class="detail-row"><div class="detail-key">Cont. In</div><div class="detail-val">' + node.continuity_in + '</div></div>';
    if (node.continuity_out) html += '<div class="detail-row"><div class="detail-key">Cont. Out</div><div class="detail-val">' + node.continuity_out + '</div></div>';
    if (node.prompt) html += '<div class="detail-row"><div class="detail-key">Prompt</div><div class="detail-val" style="white-space:pre-wrap;max-height:200px;overflow-y:auto;">' + node.prompt + '</div></div>';
  } else if (node.type === "image") {
    html += '<div class="detail-row"><div class="detail-key">Purpose</div><div class="detail-val">' + (node.purpose || "—") + '</div></div>';
    if (node.prompt) html += '<div class="detail-row"><div class="detail-key">Prompt</div><div class="detail-val" style="white-space:pre-wrap;">' + node.prompt + '</div></div>';
  } else if (node.type === "material") {
    const a = node.analysis || {};
    html += '<div class="detail-row"><div class="detail-key">Content</div><div class="detail-val">' + (a.content_type || "—") + '</div></div>';
    html += '<div class="detail-row"><div class="detail-key">Relevance</div><div class="detail-val">' + (a.relevance || "—") + ': ' + (a.relevance_reason || "") + '</div></div>';
    html += '<div class="detail-row"><div class="detail-key">Tags</div><div class="detail-val">' + (a.tags || []).join(", ") + '</div></div>';
  }

  if (inEdges.length) {
    html += '<div class="detail-row"><div class="detail-key">Inputs</div><div class="detail-val">' + inEdges.map(e => e.style.label + ' ← ' + e.source).join('<br>') + '</div></div>';
  }
  if (outEdges.length) {
    html += '<div class="detail-row"><div class="detail-key">Outputs</div><div class="detail-val">' + outEdges.map(e => e.style.label + ' → ' + e.target).join('<br>') + '</div></div>';
  }

  content.innerHTML = html;
  panel.classList.add("visible");
}

// ── Init ──
drawEdges();
fitView();
</script>
${watchScript}
</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.projectDir) {
    console.log(`Generate DAG Canvas from project.json

Usage:
  node generate-canvas.mjs <project-dir>
  node generate-canvas.mjs <project-dir> --watch
  node generate-canvas.mjs <project-dir> --output custom.html

Expects: <project-dir>/project.json`);
    process.exit(0);
  }

  const projectPath = path.join(args.projectDir, "project.json");
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: ${projectPath} not found.`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(projectPath, "utf-8"));

  if (!data.nodes || data.nodes.length === 0) {
    console.error("Error: No nodes found in project.json.");
    process.exit(1);
  }

  const html = generateHTML(data, args.watch);
  const outputPath = args.output || path.join(args.projectDir, "canvas.html");
  fs.writeFileSync(outputPath, html);
  console.log(`✅ DAG Canvas written to ${outputPath}`);
  console.log(`   ${data.nodes.length} nodes, ${(data.edges || []).length} edges`);

  if (args.watch) {
    console.log(`   Watching for changes... (canvas will auto-refresh in browser)`);
    let debounce = null;
    fs.watch(projectPath, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          const newData = JSON.parse(fs.readFileSync(projectPath, "utf-8"));
          const newHtml = generateHTML(newData, true);
          fs.writeFileSync(outputPath, newHtml);
          console.log(`   ♻️  Canvas regenerated (${new Date().toLocaleTimeString()})`);
        } catch (e) {
          console.error(`   ⚠️  Regeneration failed: ${e.message}`);
        }
      }, 300);
    });
  }
}

main();
