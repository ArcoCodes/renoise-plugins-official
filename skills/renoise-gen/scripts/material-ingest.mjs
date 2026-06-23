#!/usr/bin/env node

/**
 * Material Ingest — Batch upload + AI auto-tagging for video production.
 *
 * Scans a directory (or file list), uploads each to Renoise, analyzes with
 * Gemini for type/tags/face-detection, and writes material-pool.json.
 *
 * Usage:
 *   node material-ingest.mjs ./materials/
 *   node material-ingest.mjs product.jpg scene.jpg ref.mp4
 *   node material-ingest.mjs ./materials/ --output project/material-pool.json
 *   node material-ingest.mjs ./materials/ --skip-analysis   # upload only, no Gemini
 *
 * Environment:
 *   RENOISE_API_KEY   Required for upload
 *   (Gemini uses the same key via Renoise gateway)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────
const CLI_PATH = path.join(__dir, "..", "renoise-cli.mjs");
const GEMINI_PATH = path.join(__dir, "..", "..", "gemini-gen", "scripts", "gemini.mjs");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);
const ALL_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

// ── Parse args ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const paths = [];
  let output = "material-pool.json";
  let skipAnalysis = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output" || argv[i] === "-o") {
      output = argv[++i];
    } else if (argv[i] === "--skip-analysis") {
      skipAnalysis = true;
    } else if (!argv[i].startsWith("-")) {
      paths.push(argv[i]);
    }
  }
  return { paths, output, skipAnalysis };
}

// ── Collect files ───────────────────────────────────────────────────────
function collectFiles(inputPaths) {
  const files = [];
  for (const p of inputPaths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p)) {
        const full = path.join(p, entry);
        const ext = path.extname(entry).toLowerCase();
        if (fs.statSync(full).isFile() && ALL_EXTS.has(ext)) {
          files.push(full);
        }
      }
    } else if (stat.isFile()) {
      const ext = path.extname(p).toLowerCase();
      if (ALL_EXTS.has(ext)) {
        files.push(p);
      } else {
        console.warn(`⚠️  Skipping unsupported file: ${p}`);
      }
    }
  }
  return files;
}

// ── Upload a single file ────────────────────────────────────────────────
function uploadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = VIDEO_EXTS.has(ext) ? "video" : "image";
  try {
    const output = execSync(
      `node "${CLI_PATH}" material upload "${filePath}" --type ${type}`,
      { encoding: "utf-8", timeout: 60000 }
    );
    // Parse material ID from output like "Material uploaded: #42" or "Material already exists: #42"
    const idMatch = output.match(/#(\d+)/);
    if (idMatch) {
      return { id: parseInt(idMatch[1]), type };
    }
    // Try parsing JSON output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return { id: data.material?.id, type };
    }
    console.error(`⚠️  Could not parse upload result for ${filePath}`);
    return null;
  } catch (err) {
    console.error(`❌ Upload failed for ${filePath}: ${err.message}`);
    return null;
  }
}

// ── Analyze a single file with Gemini ───────────────────────────────────
function analyzeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const isVideo = VIDEO_EXTS.has(ext);
  const resolution = isVideo ? "low" : "high";

  const prompt = `Analyze this ${isVideo ? "video" : "image"} for a video production material library.
Return ONLY valid JSON (no markdown fences) with these fields:
- type: one of "product", "scene", "character-ref", "mood-board", "reference-video", "other"
- tags: array of descriptive keyword strings (e.g. "front-view", "white-background", "gym", "outdoor", "close-up")
- description: one sentence describing the content
- has_face: boolean — true if a realistic human face is clearly visible
- colors: array of dominant color names
- suitable_roles: array from ["ref_image", "image1", "image2", "ref_video", "first_frame", "last_frame"] — which material roles this file is suitable for`;

  try {
    const output = execSync(
      `node "${GEMINI_PATH}" --file "${filePath}" --resolution ${resolution} --json '${prompt.replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", timeout: 120000 }
    );
    // Try to parse JSON from output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err) {
    console.error(`⚠️  Analysis failed for ${filePath}: ${err.message}`);
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.paths.length === 0) {
    console.log(`Material Ingest — Batch upload + AI auto-tagging

Usage:
  node material-ingest.mjs <path|directory> [<path2> ...]
  node material-ingest.mjs ./materials/ --output pool.json
  node material-ingest.mjs ./materials/ --skip-analysis
  node material-ingest.mjs ./generated/ --append --output pool.json

Options:
  --output, -o <file>   Output file path (default: material-pool.json)
  --skip-analysis       Upload only, skip Gemini analysis
  --append              Append to existing pool file instead of overwriting`);
    process.exit(0);
  }

  // Step 1: Collect files
  const files = collectFiles(args.paths);
  if (files.length === 0) {
    console.error("No supported image/video files found.");
    process.exit(1);
  }
  console.log(`📦 Found ${files.length} file(s) to ingest:\n`);
  files.forEach((f) => console.log(`  ${path.basename(f)}`));
  console.log();

  // Step 2: Upload all files
  console.log("⬆️  Uploading files...\n");
  const uploadResults = [];
  for (const file of files) {
    process.stdout.write(`  Uploading ${path.basename(file)}... `);
    const result = uploadFile(file);
    if (result) {
      console.log(`✅ #${result.id}`);
      uploadResults.push({ file, ...result });
    } else {
      console.log("❌ failed");
    }
  }
  console.log(`\n  ${uploadResults.length}/${files.length} uploaded successfully.\n`);

  // Step 3: Analyze with Gemini (unless --skip-analysis)
  const materials = [];
  if (args.skipAnalysis) {
    console.log("⏭️  Skipping Gemini analysis (--skip-analysis).\n");
    for (const r of uploadResults) {
      const ext = path.extname(r.file).toLowerCase();
      materials.push({
        id: r.id,
        file: path.basename(r.file),
        type: r.type === "video" ? "reference-video" : "other",
        tags: [],
        description: "",
        has_face: false,
        colors: [],
        suitable_roles: r.type === "video" ? ["ref_video"] : ["ref_image", "image1"],
      });
    }
  } else {
    console.log("🔍 Analyzing files with Gemini...\n");
    for (const r of uploadResults) {
      process.stdout.write(`  Analyzing ${path.basename(r.file)}... `);
      const analysis = analyzeFile(r.file);
      if (analysis) {
        console.log(`✅ ${analysis.type} | has_face: ${analysis.has_face}`);
        materials.push({
          id: r.id,
          file: path.basename(r.file),
          type: analysis.type || "other",
          tags: analysis.tags || [],
          description: analysis.description || "",
          has_face: !!analysis.has_face,
          colors: analysis.colors || [],
          suitable_roles: analysis.suitable_roles || ["ref_image"],
        });
      } else {
        console.log("⚠️  analysis failed, using defaults");
        materials.push({
          id: r.id,
          file: path.basename(r.file),
          type: r.type === "video" ? "reference-video" : "other",
          tags: [],
          description: "",
          has_face: false,
          colors: [],
          suitable_roles: r.type === "video" ? ["ref_video"] : ["ref_image", "image1"],
        });
      }
    }
  }

  // Step 4: Write material-pool.json
  let existingMaterials = [];
  if (args.append && fs.existsSync(args.output)) {
    try {
      const existing = JSON.parse(fs.readFileSync(args.output, "utf-8"));
      existingMaterials = existing.materials || [];
      console.log(`\n📂 Appending to existing pool (${existingMaterials.length} existing material(s)).`);
    } catch (e) {
      console.warn(`⚠️  Could not parse existing pool file, starting fresh.`);
    }
  }

  // Deduplicate by material ID
  const existingIds = new Set(existingMaterials.map((m) => m.id));
  const newMaterials = materials.filter((m) => !existingIds.has(m.id));
  const allMaterials = [...existingMaterials, ...newMaterials];

  const pool = {
    created_at: new Date().toISOString(),
    materials: allMaterials,
  };

  fs.writeFileSync(args.output, JSON.stringify(pool, null, 2));
  if (args.append && existingMaterials.length > 0) {
    console.log(`\n✅ Material pool updated: ${args.output}`);
    console.log(`   ${existingMaterials.length} existing + ${newMaterials.length} new = ${allMaterials.length} total.\n`);
  } else {
    console.log(`\n✅ Material pool written to ${args.output}`);
    console.log(`   ${allMaterials.length} material(s) indexed.\n`);
  }

  // Summary
  const withFace = materials.filter((m) => m.has_face);
  if (withFace.length > 0) {
    console.log(`⚠️  ${withFace.length} material(s) contain human faces and may trigger PrivacyInformation errors:`);
    withFace.forEach((m) => console.log(`   #${m.id} ${m.file}`));
    console.log(`   These will be excluded from ref_image auto-matching.\n`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
