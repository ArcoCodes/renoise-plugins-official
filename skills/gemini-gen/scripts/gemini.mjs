#!/usr/bin/env node

/**
 * Gemini API client via Renoise gateway.
 * Zero npm dependencies — uses native fetch.
 * Auto-uploads files >20MB via Renoise file gateway.
 *
 * Usage:
 *   # Text only
 *   node gemini.mjs "Explain quantum computing"
 *
 *   # With image(s)
 *   node gemini.mjs --file photo.jpg "Describe this product"
 *   node gemini.mjs --file a.jpg --file b.jpg "Compare these two"
 *
 *   # With video
 *   node gemini.mjs --file clip.mp4 --resolution low "Summarize this clip"
 *
 *   # Preset analysis modes
 *   node gemini.mjs --file photo.jpg --mode product
 *   node gemini.mjs --file clip.mp4 --mode video-script
 *   node gemini.mjs --file reference.jpg --mode style
 *
 *   # With uploaded file URI (for reusing across calls)
 *   node gemini.mjs --file-uri "https://..." --file-mime video/mp4 "Analyze this video"
 *
 *   # JSON output mode
 *   node gemini.mjs --json "Return a JSON object with name and age"
 *
 * Options:
 *   --file <path>         Attach a local file (image/video). Repeatable.
 *                         Files >20MB are auto-uploaded via Renoise gateway.
 *   --file-uri <uri>      Attach an uploaded file by URI. Requires --file-mime.
 *   --file-mime <mime>     MIME type for --file-uri.
 *   --resolution <level>  Media resolution: low|medium|high|ultra_high (default: medium)
 *   --mode <name>         Preset analysis mode: product, video-script, style
 *   --model <name>        Model name (default: gemini-3.1-pro)
 *   --temperature <n>     Temperature (default: 1.0)
 *   --max-tokens <n>      Max output tokens (default: 8192)
 *   --json                Request JSON response format
 *
 * Authentication:
 *   Run through `renoise auth exec -- node gemini.mjs ...`, or set RENOISE_API_KEY.
 */

import fs from "fs/promises";
import path from "path";

// --- Auth ---
const RENOISE_API_KEY = process.env.RENOISE_API_KEY?.trim();
if (!RENOISE_API_KEY) {
  console.error("Not authenticated. Run this command through `renoise auth exec -- ...`.");
  process.exit(1);
}

// --- Constants ---
const MAX_INLINE_SIZE = 20 * 1024 * 1024; // 20MB
const UPLOAD_ENDPOINT = "https://renoise.ai/api/public/v1/llm/files/upload";

// --- MIME detection ---
const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function getMimeType(filePath) {
  return (
    MIME_MAP[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
  );
}

// --- Resolution mapping ---
const RESOLUTION_MAP = {
  low: "media_resolution_low",
  medium: "media_resolution_medium",
  high: "media_resolution_high",
  ultra_high: "media_resolution_ultra_high",
};

// --- Preset mode definitions ---
const MODE_PRESETS = {
  product: {
    resolution: "high",
    json: true,
    prompt: `Analyze this product photo for e-commerce video production.
Return ONLY valid JSON with these fields:
- type: product type/category (string)
- color: color description (string)
- material: material/texture description (string)
- selling_points: array of 3-5 key selling points (strings)
- brand_tone: brand personality/tone (string)
- scene_suggestions: array of 3 usage scenario suggestions (strings)
- usage_description: one paragraph describing how the product is used`,
  },
  "video-script": {
    resolution: "low",
    json: false,
    prompt: `Watch this video carefully and extract a detailed production script.
Output the following:
1. SCENE DESCRIPTIONS — timestamped, describe what is shown in each scene
2. DIALOGUE/NARRATION — timestamped, transcribe all spoken words exactly
3. CAMERA MOVEMENTS — timestamped, describe camera angles and movements (close-up, wide shot, tracking, pan, etc.)
4. MUSIC/SOUND — describe background music style, tempo, and key sound effects
5. PACING — describe the editing rhythm (fast cuts, slow takes, etc.)
6. STYLE KEYWORDS — list visual style keywords (lighting, color palette, mood)

Use format: [MM:SS] description`,
  },
  style: {
    resolution: "high",
    json: true,
    prompt: `Analyze this visual reference and extract its style characteristics for video production.
Return ONLY valid JSON with these fields:
- color_palette: array of dominant color descriptions
- lighting: lighting style description (string)
- camera_language: typical camera movements and angles (string)
- composition: composition style notes (string)
- mood: overall mood/atmosphere (string)
- texture: visual texture notes — film grain, clean digital, etc. (string)
- style_keywords: array of 5-10 style keywords suitable for video prompts
- reference_prompt: a 2-3 sentence style prefix that could be prepended to video prompts to recreate this look`,
  },
};

// --- Parse args ---
function parseArgs(argv) {
  const files = [];
  let fileUri = null;
  let fileMime = null;
  let resolution = null; // null = auto-detect from mode or default to medium
  let mode = null;
  let model = "gemini-3.1-pro";
  let temperature = 1.0;
  let maxTokens = 8192;
  let json = false;
  const textParts = [];

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--file":
        files.push(argv[++i]);
        break;
      case "--file-uri":
        fileUri = argv[++i];
        break;
      case "--file-mime":
        fileMime = argv[++i];
        break;
      case "--resolution":
        resolution = argv[++i];
        break;
      case "--mode":
        mode = argv[++i];
        break;
      case "--model":
        model = argv[++i];
        break;
      case "--temperature":
        temperature = parseFloat(argv[++i]);
        break;
      case "--max-tokens":
        maxTokens = parseInt(argv[++i], 10);
        break;
      case "--json":
        json = true;
        break;
      default:
        textParts.push(argv[i]);
    }
  }

  return {
    files,
    fileUri,
    fileMime,
    resolution,
    mode,
    model,
    temperature,
    maxTokens,
    json,
    prompt: textParts.join(" "),
  };
}

// --- Upload large file via Renoise gateway ---
async function uploadFile(filePath, mimeType) {
  const fileData = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const sizeMB = (fileData.byteLength / 1024 / 1024).toFixed(1);

  console.error(`Auto-uploading ${fileName} (${sizeMB}MB > 20MB limit)...`);

  const blob = new Blob([fileData], { type: mimeType });
  const form = new FormData();
  form.append("file", blob, fileName);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { "X-API-Key": RENOISE_API_KEY },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const fileUrl = data?.previewUrl;
  if (!fileUrl) {
    throw new Error("No previewUrl in upload response");
  }

  console.error(`Uploaded successfully. URL valid until ${data.expiresAt || "unknown"}.`);
  return fileUrl;
}

// --- Build parts ---
async function buildParts(opts) {
  const parts = [];
  const resLevel = RESOLUTION_MAP[opts.resolution] ?? RESOLUTION_MAP.medium;

  // Local files — auto-upload if >20MB, otherwise inline base64
  for (const filePath of opts.files) {
    const stat = await fs.stat(filePath);
    const mimeType = getMimeType(filePath);

    if (stat.size > MAX_INLINE_SIZE) {
      // Large file: upload first, then reference by URI
      const fileUrl = await uploadFile(filePath, mimeType);
      parts.push({
        fileData: {
          mimeType: mimeType,
          fileUri: fileUrl,
        },
      });
    } else {
      // Small file: inline base64
      const data = await fs.readFile(filePath);
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: data.toString("base64"),
        },
        mediaResolution: { level: resLevel },
      });
    }
  }

  // Uploaded file URI (manual)
  if (opts.fileUri) {
    parts.push({
      fileData: {
        mimeType: opts.fileMime ?? "application/octet-stream",
        fileUri: opts.fileUri,
      },
    });
  }

  // Text prompt (always last)
  if (opts.prompt) {
    parts.push({ text: opts.prompt });
  }

  return parts;
}

// --- Apply mode preset ---
function applyMode(opts) {
  if (!opts.mode) return opts;

  const preset = MODE_PRESETS[opts.mode];
  if (!preset) {
    console.error(
      `Unknown mode: ${opts.mode}. Available: ${Object.keys(MODE_PRESETS).join(", ")}`
    );
    process.exit(1);
  }

  // Mode sets resolution if user didn't override
  if (opts.resolution === null) {
    opts.resolution = preset.resolution;
  }

  // Mode sets JSON output if applicable
  if (preset.json) {
    opts.json = true;
  }

  // Mode sets prompt if user didn't provide one
  if (!opts.prompt) {
    opts.prompt = preset.prompt;
  } else {
    // User prompt appended after mode prompt
    opts.prompt = preset.prompt + "\n\nAdditional instructions: " + opts.prompt;
  }

  return opts;
}

// --- Main ---
async function main() {
  let opts = parseArgs(process.argv.slice(2));

  if (!opts.prompt && opts.files.length === 0 && !opts.fileUri && !opts.mode) {
    console.error(
      `Usage: node gemini.mjs [options] <prompt>

Options:
  --file <path>           Attach local file (repeatable, auto-uploads if >20MB)
  --file-uri <uri>        Attach uploaded file by URI (requires --file-mime)
  --file-mime <mime>       MIME type for --file-uri
  --resolution <level>    low / medium / high / ultra_high (default: medium)
  --mode <name>           Preset mode: product, video-script, style
  --model <name>          Model (default: gemini-3.1-pro)
  --temperature <n>       Temperature (default: 1.0)
  --max-tokens <n>        Max output tokens (default: 8192)
  --json                  Request JSON response format

Examples:
  node gemini.mjs --file photo.jpg --mode product
  node gemini.mjs --file clip.mp4 --mode video-script
  node gemini.mjs --file ref.jpg --mode style
  node gemini.mjs --file a.jpg --file b.jpg "Compare these two"
  node gemini.mjs --file large.mp4 "Summarize"   # auto-uploads if >20MB`
    );
    process.exit(1);
  }

  // Apply mode preset (resolution, json, prompt)
  opts = applyMode(opts);

  // Default resolution to medium if still null
  if (opts.resolution === null) {
    opts.resolution = "medium";
  }

  const endpoint = `https://renoise.ai/api/public/llm/proxy/v1beta/models/${opts.model}:generateContent?key=${RENOISE_API_KEY}`;

  const parts = await buildParts(opts);

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
    },
  };

  if (opts.json) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("No text in response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(text);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
