#!/usr/bin/env node

/**
 * Batch upload local media, analyze it through native `renoise analyze`, and
 * write a reusable material-pool.json.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm"]);
const ALL_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

function parseArgs(argv) {
  const paths = [];
  let output = "material-pool.json";
  let skipAnalysis = false;
  let append = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output" || argv[i] === "-o") output = argv[++i];
    else if (argv[i] === "--skip-analysis") skipAnalysis = true;
    else if (argv[i] === "--append") append = true;
    else if (!argv[i].startsWith("-")) paths.push(argv[i]);
  }
  return { paths, output, skipAnalysis, append };
}

function collectFiles(inputPaths) {
  const files = [];
  for (const input of inputPaths) {
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(input)) {
        const full = path.join(input, entry);
        if (fs.statSync(full).isFile() && ALL_EXTS.has(path.extname(entry).toLowerCase())) files.push(full);
      }
    } else if (stat.isFile() && ALL_EXTS.has(path.extname(input).toLowerCase())) {
      files.push(input);
    } else {
      console.warn(`⚠️  Skipping unsupported file: ${input}`);
    }
  }
  return files;
}

function runRenoise(args, timeout = 10 * 60_000) {
  return execFileSync("renoise", args, { encoding: "utf-8", timeout, maxBuffer: 10 * 1024 * 1024 });
}

function uploadFile(filePath) {
  const type = VIDEO_EXTS.has(path.extname(filePath).toLowerCase()) ? "video" : "image";
  try {
    const data = JSON.parse(runRenoise(["upload", filePath, "--type", type, "--json"]));
    const material = data.material || data;
    return material?.id ? { id: material.id, type } : null;
  } catch (error) {
    console.error(`❌ Upload failed for ${filePath}: ${error.message}`);
    return null;
  }
}

function materialType(result, isVideo) {
  if (isVideo) return "reference-video";
  const types = new Set((result.analysis?.subjects || []).map(subject => subject.type));
  if (types.has("product")) return "product";
  if (types.has("character")) return "character-ref";
  if (types.has("scene")) return "scene";
  return "other";
}

function analyzeFile(filePath) {
  const isVideo = VIDEO_EXTS.has(path.extname(filePath).toLowerCase());
  try {
    const result = JSON.parse(runRenoise([
      "analyze", filePath,
      "--target", isVideo ? "video" : "image",
      "--language", "en",
      "--json",
    ]));
    const subjects = result.analysis?.subjects || [];
    const colors = result.analysis?.style?.palette || [];
    const facePresence = result.analysis?.facePresence || "uncertain";
    return {
      type: materialType(result, isVideo),
      tags: [...new Set([...subjects.map(subject => subject.type), ...colors])],
      description: result.analysis?.summary || "",
      has_face: facePresence === "present" ? true : facePresence === "absent" ? false : null,
      face_presence: facePresence,
      colors,
      suitable_roles: [],
      analysis_status: "completed",
    };
  } catch (error) {
    console.error(`⚠️  Analysis failed for ${filePath}: ${error.message}`);
    return null;
  }
}

function fallbackMaterial(result, skipped = false) {
  return {
    id: result.id,
    file: path.basename(result.file),
    type: result.type === "video" ? "reference-video" : "other",
    tags: [],
    description: "",
    has_face: null,
    face_presence: "uncertain",
    colors: [],
    suitable_roles: [],
    analysis_status: skipped ? "skipped" : "failed",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.paths.length === 0) {
    console.log(`Material Ingest — native CLI upload + analysis

Usage:
  node material-ingest.mjs <path|directory> [<path2> ...]
  node material-ingest.mjs ./materials/ --output pool.json
  node material-ingest.mjs ./materials/ --skip-analysis
  node material-ingest.mjs ./generated/ --append --output pool.json

Options:
  --output, -o <file>   Output file path (default: material-pool.json)
  --skip-analysis       Upload only; privacy state remains uncertain
  --append              Preserve existing pool entries`);
    return;
  }

  const files = collectFiles(args.paths);
  if (!files.length) throw new Error("No supported image/video files found.");
  console.log(`📦 Found ${files.length} file(s).`);

  const uploaded = [];
  for (const file of files) {
    process.stdout.write(`  Uploading ${path.basename(file)}... `);
    const result = uploadFile(file);
    console.log(result ? `✅ #${result.id}` : "❌ failed");
    if (result) uploaded.push({ file, ...result });
  }

  const materials = [];
  for (const result of uploaded) {
    if (args.skipAnalysis) {
      materials.push(fallbackMaterial(result, true));
      continue;
    }
    process.stdout.write(`  Analyzing ${path.basename(result.file)}... `);
    const analysis = analyzeFile(result.file);
    if (!analysis) {
      console.log("⚠️ failed; excluded from privacy-sensitive auto-matching");
      materials.push(fallbackMaterial(result));
      continue;
    }
    console.log(`✅ ${analysis.type} | face: ${analysis.face_presence}`);
    materials.push({ id: result.id, file: path.basename(result.file), ...analysis });
  }

  let existingMaterials = [];
  if (args.append && fs.existsSync(args.output)) {
    try {
      existingMaterials = JSON.parse(fs.readFileSync(args.output, "utf-8")).materials || [];
    } catch {
      throw new Error(`Cannot append: invalid existing pool ${args.output}`);
    }
  }
  const existingIds = new Set(existingMaterials.map(material => material.id));
  const newMaterials = materials.filter(material => !existingIds.has(material.id));
  const allMaterials = [...existingMaterials, ...newMaterials];
  fs.writeFileSync(args.output, JSON.stringify({ created_at: new Date().toISOString(), materials: allMaterials }, null, 2));
  console.log(`✅ ${args.output}: ${allMaterials.length} material(s)${args.append ? ` (${newMaterials.length} new)` : ""}.`);

  const unverified = materials.filter(material => material.has_face !== false && material.type !== "reference-video");
  if (unverified.length) {
    console.log(`⚠️  ${unverified.length} image material(s) have present/uncertain faces and must not be privacy-sensitive auto-matches.`);
  }
}

main().catch(error => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
