#!/usr/bin/env node

/**
 * Shot-Material Matching Engine
 *
 * Reads a material pool and a shot table, auto-assigns the best materials
 * to each shot based on tag/description matching and privacy constraints.
 *
 * Usage:
 *   node match-materials.mjs --pool material-pool.json --shots project.json
 *   node match-materials.mjs --pool material-pool.json --shots project.json --output mapping.json
 *
 * Input formats:
 *   material-pool.json: output from material-ingest.mjs
 *   project.json: must contain a "shots" array with shot_id, scene, action, characters fields
 *
 * Output:
 *   JSON mapping + human-readable summary to stdout
 */

import fs from "fs";

// ── Parse args ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pool") flags.pool = argv[++i];
    else if (argv[i] === "--shots") flags.shots = argv[++i];
    else if (argv[i] === "--output" || argv[i] === "-o") flags.output = argv[++i];
  }
  return flags;
}

// ── Tokenize text into lowercase keywords ───────────────────────────────
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// ── Compute match score between a shot and a material ───────────────────
function computeScore(shot, material) {
  let score = 0;

  // Combine all shot text fields
  const shotText = [
    shot.scene || "",
    shot.action || "",
    shot.camera || "",
    (shot.characters || []).join(" "),
  ].join(" ");
  const shotTokens = new Set(tokenize(shotText));

  // 1. Tag intersection (×3 per match)
  for (const tag of material.tags || []) {
    const tagTokens = tokenize(tag);
    for (const t of tagTokens) {
      if (shotTokens.has(t)) {
        score += 3;
      }
    }
  }

  // 2. Description keyword overlap (×2 per match)
  const descTokens = tokenize(material.description);
  for (const t of descTokens) {
    if (shotTokens.has(t)) {
      score += 2;
    }
  }

  // 3. Type-based bonus
  const typeBonus = {
    product: ["product", "showcase", "detail", "close-up", "unbox", "reveal"],
    scene: ["scene", "environment", "background", "location", "room", "hallway", "outdoor", "gym", "park"],
    "character-ref": ["character", "person", "model", "actor"],
    "mood-board": ["style", "mood", "aesthetic", "tone"],
    "reference-video": ["reference", "motion", "style"],
  };

  const bonusKeywords = typeBonus[material.type] || [];
  for (const kw of bonusKeywords) {
    if (shotTokens.has(kw)) {
      score += 2;
      break; // Only count type bonus once
    }
  }

  // 4. Privacy penalty — face-containing images should not be used as ref_image
  if (material.has_face && material.type !== "reference-video") {
    score -= 10;
  }

  return score;
}

// ── Assign roles based on rank ──────────────────────────────────────────
function assignRole(material, rank) {
  // For videos, always ref_video
  if (material.type === "reference-video" || (material.suitable_roles || []).includes("ref_video")) {
    return "ref_video";
  }
  // For images
  if (rank === 0) return "ref_image";
  return `image${rank}`;
}

// ── Main matching logic ─────────────────────────────────────────────────
function matchMaterials(pool, shots) {
  const mapping = [];
  const usedMaterialIds = new Set();

  for (const shot of shots) {
    // Score all materials against this shot
    const scored = pool.materials
      .map((m) => ({ material: m, score: computeScore(shot, m) }))
      .filter((s) => s.score > 0 && (s.material.type === "reference-video" || s.material.has_face === false))
      .sort((a, b) => b.score - a.score);

    // Take top 1-3 materials
    const assigned = [];
    for (let i = 0; i < Math.min(3, scored.length); i++) {
      const m = scored[i].material;
      const role = assignRole(m, assigned.length);
      assigned.push({
        material_id: m.id,
        file: m.file,
        role,
        score: scored[i].score,
        reason: `Matched: ${(m.tags || []).slice(0, 3).join(", ")}`,
      });
      usedMaterialIds.add(m.id);
    }

    mapping.push({
      shot_id: shot.shot_id,
      materials: assigned,
    });
  }

  // Find unused materials
  const unused = pool.materials
    .filter((m) => !usedMaterialIds.has(m.id))
    .map((m) => ({
      id: m.id,
      file: m.file,
      reason: m.type !== "reference-video" && m.has_face !== false
        ? "Face presence is present or uncertain — excluded from automatic image matching"
        : "No matching shot found",
    }));

  return { mapping, unused };
}

// ── Format human-readable output ────────────────────────────────────────
function formatSummary(result, shots) {
  const lines = ["\n📎 Material Auto-Matching Results:\n"];

  for (const entry of result.mapping) {
    const shot = shots.find((s) => s.shot_id === entry.shot_id);
    const shotLabel = shot
      ? `${entry.shot_id} (${shot.scene?.slice(0, 40) || "..."})`
      : entry.shot_id;

    lines.push(`  ${shotLabel}`);
    if (entry.materials.length === 0) {
      lines.push("    └─ (no matching materials)");
    } else {
      entry.materials.forEach((m, i) => {
        const prefix = i === entry.materials.length - 1 ? "└─" : "├─";
        lines.push(`    ${prefix} ${m.role}: #${m.material_id} ${m.file} (score: ${m.score})`);
      });
    }
    lines.push("");
  }

  if (result.unused.length > 0) {
    lines.push("  ⚠️  Unused materials:");
    result.unused.forEach((m) => {
      lines.push(`    #${m.id} ${m.file} — ${m.reason}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

// ── Build --materials CLI flag from mapping ──────────────────────────────
function buildMaterialsFlag(shotMapping) {
  if (!shotMapping.materials || shotMapping.materials.length === 0) return "";
  return shotMapping.materials
    .map((m) => `${m.material_id}:${m.role}`)
    .join(",");
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (!flags.pool || !flags.shots) {
    console.log(`Shot-Material Matching Engine

Usage:
  node match-materials.mjs --pool material-pool.json --shots project.json

Options:
  --pool <file>        Material pool JSON (from material-ingest.mjs)
  --shots <file>       Project JSON with shots array
  --output, -o <file>  Output mapping JSON file`);
    process.exit(0);
  }

  // Load inputs
  const pool = JSON.parse(fs.readFileSync(flags.pool, "utf-8"));
  const projectData = JSON.parse(fs.readFileSync(flags.shots, "utf-8"));
  const shots = projectData.shots || projectData;

  if (!Array.isArray(shots) || shots.length === 0) {
    console.error("Error: No shots found in the project file.");
    process.exit(1);
  }

  if (!pool.materials || pool.materials.length === 0) {
    console.error("Error: No materials found in the pool file.");
    process.exit(1);
  }

  // Run matching
  const result = matchMaterials(pool, shots);

  // Output summary
  console.log(formatSummary(result, shots));

  // Output CLI flags for each shot
  console.log("  📋 CLI --materials flags per shot:\n");
  for (const entry of result.mapping) {
    const flag = buildMaterialsFlag(entry);
    if (flag) {
      console.log(`    ${entry.shot_id}: --materials "${flag}"`);
    } else {
      console.log(`    ${entry.shot_id}: (no materials)`);
    }
  }
  console.log();

  // Write output file if requested
  if (flags.output) {
    fs.writeFileSync(flags.output, JSON.stringify(result, null, 2));
    console.log(`  ✅ Mapping written to ${flags.output}\n`);
  }

  // Also output raw JSON to stdout for piping
  if (flags.output) return;
  console.log(JSON.stringify(result, null, 2));
}

main();
