#!/usr/bin/env node

/**
 * Smart Material Ingest — Brief-Aware Analysis
 *
 * Scans a directory, uploads to Renoise, analyzes with Gemini AGAINST the
 * project brief to determine relevance and suggested usage. Populates the
 * material_pool section of project.json with DAG-ready material nodes.
 *
 * Usage:
 *   node smart-ingest.mjs <materials-dir> --brief "Maya finds a mysterious pocket watch"
 *   node smart-ingest.mjs <materials-dir> --project <project-dir>/project.json
 *   node smart-ingest.mjs <materials-dir> --project <project.json> --skip-upload
 *
 * Environment:
 *   RENOISE_API_KEY   Required for upload and Gemini
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);

const CLI_PATH = path.resolve(__dir, "..", "..", "renoise-gen", "renoise-cli.mjs");
const GEMINI_PATH = path.resolve(__dir, "..", "..", "gemini-gen", "scripts", "gemini.mjs");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);
const ALL_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

// ── Parse args ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const paths = [];
  let brief = null;
  let projectPath = null;
  let skipUpload = false;
  let output = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--brief" || argv[i] === "-b") brief = argv[++i];
    else if (argv[i] === "--project" || argv[i] === "-p") projectPath = argv[++i];
    else if (argv[i] === "--skip-upload") skipUpload = true;
    else if (argv[i] === "--output" || argv[i] === "-o") output = argv[++i];
    else if (!argv[i].startsWith("-")) paths.push(argv[i]);
  }
  return { paths, brief, projectPath, skipUpload, output };
}

// ── Collect files ───────────────────────────────────────────────────────
function collectFiles(inputPaths) {
  const files = [];
  for (const p of inputPaths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(p, { recursive: true });
      for (const entry of entries) {
        const full = path.join(p, entry);
        try {
          if (fs.statSync(full).isFile() && ALL_EXTS.has(path.extname(entry).toLowerCase())) {
            files.push(full);
          }
        } catch {}
      }
    } else if (stat.isFile() && ALL_EXTS.has(path.extname(p).toLowerCase())) {
      files.push(p);
    }
  }
  return files;
}

// ── Upload ──────────────────────────────────────────────────────────────
function uploadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = VIDEO_EXTS.has(ext) ? "video" : "image";
  try {
    const output = execSync(
      `node "${CLI_PATH}" material upload "${filePath}" --type ${type}`,
      { encoding: "utf-8", timeout: 120000 }
    );
    const idMatch = output.match(/#(\d+)/);
    if (idMatch) return { id: parseInt(idMatch[1]), type };
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return { id: data.material?.id, type };
    }
    return null;
  } catch (err) {
    console.error(`  ❌ Upload failed: ${err.message.split("\n")[0]}`);
    return null;
  }
}

// ── Brief-Aware Gemini Analysis ─────────────────────────────────────────
function analyzeFile(filePath, brief, shots) {
  const ext = path.extname(filePath).toLowerCase();
  const isVideo = VIDEO_EXTS.has(ext);
  const resolution = isVideo ? "low" : "high";

  const shotsContext = shots && shots.length > 0
    ? `\n\nThe project has these planned shots:\n${shots.map(s =>
        `- ${s.shot_id || s.id}: ${s.scene || ""} — ${s.action || ""}`
      ).join("\n")}`
    : "";

  const prompt = `You are a video production material analyst. Analyze this ${isVideo ? "video" : "image"} file for a video production project.

PROJECT BRIEF: "${brief || "General video production"}"${shotsContext}

Return ONLY valid JSON (no markdown fences, no explanation) with these fields:
{
  "content_type": "product | scene | character-ref | mood-board | reference-video | texture | prop | other",
  "media_type": "${isVideo ? "video" : "image"}",
  "tags": ["keyword1", "keyword2", ...],
  "description": "One sentence describing what this file shows",
  "has_face": true/false,
  "colors": ["dominant-color-1", "dominant-color-2"],
  "suitable_roles": ["ref_image", "first_frame", ...],
  "relevance": "high | medium | low | none",
  "relevance_reason": "Why this material is or isn't useful for the project brief",
  "suggested_shots": ["S1", "S2"] or [],
  "suggested_role": "ref_image | ref_video | first_frame | last_frame | image1 | reference_image | null"
}

Important:
- "relevance" judges how well this material matches the PROJECT BRIEF, not general quality
- "suggested_shots" should reference shot IDs from the project if provided
- If the file contains human faces, suitable_roles should NOT include "ref_image" (privacy detection will block it)
- For face images, suggest "reference_image" (requires asset registration) or "character-ref" content_type
- Be specific about WHY the material is relevant or not`;

  try {
    const output = execSync(
      `node "${GEMINI_PATH}" --file "${filePath}" --resolution ${resolution} --json '${prompt.replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", timeout: 120000 }
    );
    const jsonMatch = output.match(/\{[\s\S]*?\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error(`  ⚠️ Analysis failed: ${err.message.split("\n")[0]}`);
    return null;
  }
}

// ── Build DAG material node ─────────────────────────────────────────────
function buildMaterialNode(file, uploadResult, analysis, index) {
  const basename = path.basename(file);
  const nodeId = `mat_${basename.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${index}`;

  return {
    id: nodeId,
    type: "material",
    label: basename,
    status: uploadResult ? "completed" : "pending",
    position: { x: 0, y: 0 },
    material_id: uploadResult?.id || null,
    local_path: file,
    result_url: null,
    analysis: analysis || {
      media_type: VIDEO_EXTS.has(path.extname(file).toLowerCase()) ? "video" : "image",
      content_type: "other",
      tags: [],
      description: "",
      has_face: false,
      colors: [],
      suitable_roles: ["ref_image"],
      relevance: "unknown",
      relevance_reason: "Analysis not available",
      suggested_shots: [],
      suggested_role: null
    }
  };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.paths.length === 0) {
    console.log(`Smart Material Ingest — Brief-Aware Analysis

Usage:
  node smart-ingest.mjs <dir-or-files> --brief "project description"
  node smart-ingest.mjs <dir-or-files> --project project.json
  node smart-ingest.mjs <dir-or-files> --project project.json --skip-upload

Options:
  --brief, -b <text>       Project brief for relevance analysis
  --project, -p <file>     Read brief + shots from project.json
  --skip-upload             Analyze only, don't upload to Renoise
  --output, -o <file>       Output file (default: updates project.json or prints JSON)

The script:
1. Scans directories for image/video files
2. Uploads each to Renoise (unless --skip-upload)
3. Analyzes each with Gemini against the project brief
4. Outputs DAG-ready material nodes with relevance scores`);
    process.exit(0);
  }

  // Load project context
  let brief = args.brief;
  let shots = [];
  let projectData = null;

  if (args.projectPath) {
    if (!fs.existsSync(args.projectPath)) {
      console.error(`Error: ${args.projectPath} not found.`);
      process.exit(1);
    }
    projectData = JSON.parse(fs.readFileSync(args.projectPath, "utf-8"));
    if (!brief) brief = projectData.project?.brief;
    // Extract shots from video nodes
    shots = (projectData.nodes || [])
      .filter(n => n.type === "video")
      .map(n => ({ shot_id: n.shot_id || n.id, scene: n.scene, action: n.action }));
  }

  if (!brief) {
    console.error("Error: No brief provided. Use --brief or --project with a project.json that has a brief.");
    process.exit(1);
  }

  console.log(`\n🎬 Smart Material Ingest`);
  console.log(`   Brief: "${brief}"`);
  if (shots.length) console.log(`   Shots: ${shots.length} planned`);
  console.log();

  // Step 1: Collect files
  const files = collectFiles(args.paths);
  if (files.length === 0) {
    console.error("No supported image/video files found.");
    process.exit(1);
  }
  console.log(`📦 Found ${files.length} file(s):\n`);
  files.forEach(f => console.log(`   ${path.relative(process.cwd(), f)}`));
  console.log();

  // Step 2: Upload + Analyze
  const materialNodes = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const basename = path.basename(file);
    console.log(`[${i + 1}/${files.length}] ${basename}`);

    // Upload
    let uploadResult = null;
    if (!args.skipUpload) {
      process.stdout.write(`   ⬆️  Uploading... `);
      uploadResult = uploadFile(file);
      if (uploadResult) {
        console.log(`✅ #${uploadResult.id}`);
      } else {
        console.log(`❌ failed`);
      }
    }

    // Analyze
    process.stdout.write(`   🔍 Analyzing against brief... `);
    const analysis = analyzeFile(file, brief, shots);
    if (analysis) {
      const relevanceEmoji = { high: "🟢", medium: "🟡", low: "🟠", none: "🔴" };
      console.log(`${relevanceEmoji[analysis.relevance] || "⚪"} ${analysis.relevance} — ${analysis.relevance_reason || ""}`);
      if (analysis.has_face) console.log(`   ⚠️  Contains human face`);
      if (analysis.suggested_shots?.length) {
        console.log(`   📍 Suggested for: ${analysis.suggested_shots.join(", ")} as ${analysis.suggested_role || "ref_image"}`);
      }
    } else {
      console.log(`⚠️ failed, using defaults`);
    }

    materialNodes.push(buildMaterialNode(file, uploadResult, analysis, i));
    console.log();
  }

  // Step 3: Output results
  const summary = {
    high: materialNodes.filter(n => n.analysis.relevance === "high").length,
    medium: materialNodes.filter(n => n.analysis.relevance === "medium").length,
    low: materialNodes.filter(n => n.analysis.relevance === "low").length,
    none: materialNodes.filter(n => n.analysis.relevance === "none").length,
    faces: materialNodes.filter(n => n.analysis.has_face).length,
  };

  console.log(`\n📊 Summary:`);
  console.log(`   🟢 High relevance: ${summary.high}`);
  console.log(`   🟡 Medium: ${summary.medium}`);
  console.log(`   🟠 Low: ${summary.low}`);
  console.log(`   🔴 None: ${summary.none}`);
  if (summary.faces > 0) {
    console.log(`   ⚠️  ${summary.faces} file(s) with faces — need asset registration for ref_image usage`);
  }

  // Identify gaps
  const coveredShots = new Set(materialNodes.flatMap(n => n.analysis.suggested_shots || []));
  const uncoveredShots = shots.filter(s => !coveredShots.has(s.shot_id));
  if (uncoveredShots.length > 0) {
    console.log(`\n   🔲 Shots without material coverage:`);
    uncoveredShots.forEach(s => console.log(`      ${s.shot_id}: ${s.scene || s.action || "?"}`));
    console.log(`   → These shots need generated assets (character sheets, scene refs, concept art)`);
  }

  // Write output
  if (args.projectPath && projectData) {
    // Merge material nodes into project.json
    const existingNodes = projectData.nodes || [];
    const existingMaterialIds = new Set(existingNodes.filter(n => n.type === "material").map(n => n.id));

    for (const mn of materialNodes) {
      if (!existingMaterialIds.has(mn.id)) {
        existingNodes.push(mn);
      }
    }
    projectData.nodes = existingNodes;

    // Auto-generate edges for high-relevance materials with suggested shots
    const existingEdges = projectData.edges || [];
    const existingEdgeKeys = new Set(existingEdges.map(e => `${e.source}-${e.target}-${e.role}`));

    for (const mn of materialNodes) {
      if (mn.analysis.relevance === "high" && mn.analysis.suggested_shots?.length) {
        for (const shotId of mn.analysis.suggested_shots) {
          const targetNode = existingNodes.find(n => n.shot_id === shotId || n.id === shotId);
          if (!targetNode) continue;

          const role = mn.analysis.has_face ? "reference_image" : (mn.analysis.suggested_role || "ref_image");
          // Skip face materials as direct ref_image — they need asset path
          if (mn.analysis.has_face && role === "ref_image") continue;

          const edgeKey = `${mn.id}-${targetNode.id}-${role}`;
          if (!existingEdgeKeys.has(edgeKey)) {
            existingEdges.push({
              id: `e_auto_${mn.id}_${targetNode.id}`,
              source: mn.id,
              target: targetNode.id,
              role: role
            });
            existingEdgeKeys.add(edgeKey);
          }
        }
      }
    }
    projectData.edges = existingEdges;

    const outPath = args.output || args.projectPath;
    fs.writeFileSync(outPath, JSON.stringify(projectData, null, 2));
    console.log(`\n✅ Updated ${outPath}`);
    console.log(`   ${materialNodes.length} material node(s) added/updated`);
  } else {
    // Output standalone JSON
    const outPath = args.output || "material-nodes.json";
    const output = { material_nodes: materialNodes, summary, uncovered_shots: uncoveredShots };
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ Written to ${outPath}`);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
