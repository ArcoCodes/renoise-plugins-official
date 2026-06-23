#!/usr/bin/env node

/**
 * Generate a self-contained HTML storyboard preview from project.json.
 *
 * Combines: rhythm timeline, shot cards with reference images (base64-embedded),
 * material mapping, cost estimate, and collapsible prompts into a single HTML file.
 *
 * Usage:
 *   node generate-preview.mjs <project-dir>
 *   node generate-preview.mjs <project-dir> --skip-images
 *   node generate-preview.mjs <project-dir> --output custom-preview.html
 *
 * Expects:
 *   <project-dir>/project.json — with project, characters, style_guide, shots
 *   <project-dir>/storyboard/S1.png, S2.png, ... — reference images (optional)
 *   <project-dir>/material-pool.json — material pool (optional)
 */

import fs from "fs";
import path from "path";

// ── Parse args ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  let projectDir = null;
  let skipImages = false;
  let output = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skip-images") {
      skipImages = true;
    } else if (argv[i] === "--output" || argv[i] === "-o") {
      output = argv[++i];
    } else if (!argv[i].startsWith("-")) {
      projectDir = argv[i];
    }
  }
  return { projectDir, skipImages, output };
}

// ── Load base64 image ───────────────────────────────────────────────────
function loadImageBase64(imagePath) {
  try {
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      ext === ".gif" ? "image/gif" :
      "image/jpeg";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

// ── Estimate credits per shot ───────────────────────────────────────────
function estimateCredits(durationS) {
  // Rough estimate: ~0.5 credits per second
  return Math.ceil(durationS * 0.5);
}

// ── Generate HTML ───────────────────────────────────────────────────────
function generateHTML(project, shots, characters, styleGuide, images, materialMapping) {
  const title = project.title || "Untitled Project";
  const totalDuration = shots.reduce((sum, s) => sum + (s.duration_s || 0), 0);
  const totalCredits = shots.reduce((sum, s) => sum + estimateCredits(s.duration_s || 0), 0);
  const ratio = project.ratio || "16:9";
  const music = project.music;

  // Build shot cards HTML
  const shotCards = shots.map((shot, i) => {
    const imgSrc = images[shot.shot_id];
    const imgTag = imgSrc
      ? `<img src="${imgSrc}" alt="${shot.shot_id}" style="width:100%;border-radius:8px;margin-bottom:12px;">`
      : `<div style="width:100%;height:180px;background:#1a1a2e;border-radius:8px;margin-bottom:12px;display:flex;align-items:center;justify-content:center;color:#555;">No reference image</div>`;

    const chars = (shot.characters || []).join(", ") || "—";

    // Material mapping for this shot
    const mapping = materialMapping?.find((m) => m.shot_id === shot.shot_id);
    const materialsHTML = mapping && mapping.materials.length > 0
      ? mapping.materials.map((m) =>
          `<span style="background:#2d2d4e;padding:2px 8px;border-radius:4px;font-size:12px;">#${m.material_id} ${m.file} → ${m.role}</span>`
        ).join(" ")
      : '<span style="color:#666;font-size:12px;">No materials matched</span>';

    return `
      <div style="background:#16162a;border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#e0e0ff;">${shot.shot_id} — ${shot.duration_s}s</h3>
          <span style="color:#888;font-size:13px;">${shot.music_section || ""}</span>
        </div>
        ${imgTag}
        <div style="margin-bottom:8px;">
          <strong style="color:#aaa;">Scene:</strong>
          <span style="color:#ddd;">${shot.scene || "—"}</span>
        </div>
        <div style="margin-bottom:8px;">
          <strong style="color:#aaa;">Characters:</strong>
          <span style="color:#ddd;">${chars}</span>
        </div>
        <div style="margin-bottom:8px;">
          <strong style="color:#aaa;">Action:</strong>
          <span style="color:#ddd;">${shot.action || "—"}</span>
        </div>
        <div style="margin-bottom:8px;">
          <strong style="color:#aaa;">Camera:</strong>
          <span style="color:#ddd;">${shot.camera || "—"}</span>
        </div>
        ${shot.dialogue ? `<div style="margin-bottom:8px;"><strong style="color:#aaa;">Dialogue:</strong> <span style="color:#ddd;">${shot.dialogue}</span></div>` : ""}
        ${shot.continuity_in ? `<div style="margin-bottom:8px;font-size:13px;"><strong style="color:#7a7aaa;">↓ Continues from:</strong> <span style="color:#999;">${shot.continuity_in}</span></div>` : ""}
        ${shot.continuity_out ? `<div style="margin-bottom:8px;font-size:13px;"><strong style="color:#7a7aaa;">→ Leads to:</strong> <span style="color:#999;">${shot.continuity_out}</span></div>` : ""}
        <div style="margin-bottom:8px;">
          <strong style="color:#aaa;">Materials:</strong> ${materialsHTML}
        </div>
        <details style="margin-top:8px;">
          <summary style="cursor:pointer;color:#6c6cff;font-size:13px;">▶ Show prompt</summary>
          <pre style="background:#0d0d1a;padding:12px;border-radius:8px;margin-top:8px;font-size:12px;color:#ccc;white-space:pre-wrap;word-wrap:break-word;max-height:400px;overflow-y:auto;">${shot.prompt || "(prompt not yet generated)"}</pre>
        </details>
      </div>`;
  }).join("\n");

  // Rhythm timeline bar
  const timelineSegments = shots.map((shot, i) => {
    const pct = ((shot.duration_s || 0) / totalDuration * 100).toFixed(1);
    const colors = ["#6c6cff", "#ff6c6c", "#6cff6c", "#ffcc6c", "#6cffff", "#ff6cff", "#ccff6c", "#6ccfff"];
    const color = colors[i % colors.length];
    return `<div style="width:${pct}%;background:${color};padding:6px 4px;text-align:center;font-size:11px;color:#000;font-weight:bold;" title="${shot.shot_id}: ${shot.duration_s}s">${shot.shot_id}<br>${shot.duration_s}s</div>`;
  }).join("");

  // Characters summary
  const charSummary = (characters || []).map((c) =>
    `<span style="background:#2d2d4e;padding:4px 10px;border-radius:6px;margin-right:8px;">${c.name}</span>`
  ).join("") || "—";

  // Music info
  const musicInfo = music
    ? `${music.bpm || "?"} BPM, ${music.total_duration_s || "?"}s, ${(music.sections || []).length} sections`
    : "No music — using narrative rhythm";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Storyboard Preview</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a1a; color: #e0e0ff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; color: #8888cc; margin: 24px 0 12px; }
  .header { background: #16162a; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .stat { display: inline-block; margin-right: 24px; margin-bottom: 8px; }
  .stat-label { color: #888; font-size: 12px; text-transform: uppercase; }
  .stat-value { color: #e0e0ff; font-size: 18px; font-weight: bold; }
  .timeline { display: flex; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>🎬 ${title}</h1>
    <p style="color:#888;margin:8px 0 16px;">Storyboard Preview</p>
    <div>
      <div class="stat"><div class="stat-label">Duration</div><div class="stat-value">${totalDuration}s</div></div>
      <div class="stat"><div class="stat-label">Shots</div><div class="stat-value">${shots.length}</div></div>
      <div class="stat"><div class="stat-label">Ratio</div><div class="stat-value">${ratio}</div></div>
      <div class="stat"><div class="stat-label">Est. Cost</div><div class="stat-value">~${totalCredits} credits</div></div>
    </div>
    <div style="margin-top:12px;">
      <div class="stat-label">Characters</div>
      <div style="margin-top:4px;">${charSummary}</div>
    </div>
    <div style="margin-top:12px;">
      <div class="stat-label">Music</div>
      <div style="margin-top:4px;color:#ddd;">${musicInfo}</div>
    </div>
    <div style="margin-top:12px;">
      <div class="stat-label">Style</div>
      <div style="margin-top:4px;color:#ddd;">${styleGuide?.visual_style || "—"}</div>
    </div>
  </div>

  <h2>Rhythm Timeline</h2>
  <div class="timeline">${timelineSegments}</div>

  <h2>Shot Breakdown</h2>
  ${shotCards}

  <div style="text-align:center;padding:24px;color:#555;font-size:13px;">
    Generated by Video Maker · ${new Date().toISOString().slice(0, 10)}
  </div>
</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.projectDir) {
    console.log(`Generate HTML Storyboard Preview

Usage:
  node generate-preview.mjs <project-dir>

Options:
  --skip-images          Don't embed reference images
  --output, -o <file>    Output file (default: <project-dir>/storyboard.html)

Expects:
  <project-dir>/project.json
  <project-dir>/storyboard/S1.png, S2.png, ... (optional)
  <project-dir>/material-pool.json (optional)`);
    process.exit(0);
  }

  // Load project.json
  const projectPath = path.join(args.projectDir, "project.json");
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: ${projectPath} not found.`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(projectPath, "utf-8"));
  const project = data.project || {};
  const shots = data.shots || [];
  const characters = data.characters || [];
  const styleGuide = data.style_guide || {};

  if (shots.length === 0) {
    console.error("Error: No shots found in project.json.");
    process.exit(1);
  }

  // Load reference images
  const images = {};
  if (!args.skipImages) {
    const storyboardDir = path.join(args.projectDir, "storyboard");
    for (const shot of shots) {
      for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
        const imgPath = path.join(storyboardDir, `${shot.shot_id}${ext}`);
        const b64 = loadImageBase64(imgPath);
        if (b64) {
          images[shot.shot_id] = b64;
          break;
        }
      }
    }
    const loaded = Object.keys(images).length;
    if (loaded > 0) {
      console.log(`Loaded ${loaded}/${shots.length} reference images.`);
    }
  }

  // Load material mapping (optional)
  let materialMapping = null;
  const mappingPath = path.join(args.projectDir, "material-mapping.json");
  if (fs.existsSync(mappingPath)) {
    const mappingData = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
    materialMapping = mappingData.mapping || null;
    console.log("Loaded material mapping.");
  }

  // Generate HTML
  const html = generateHTML(project, shots, characters, styleGuide, images, materialMapping);

  // Write output
  const outputPath = args.output || path.join(args.projectDir, "storyboard.html");
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Storyboard preview written to ${outputPath}`);
  console.log(`   ${shots.length} shots, ${shots.reduce((s, sh) => s + (sh.duration_s || 0), 0)}s total`);
}

main();
