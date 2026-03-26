#!/usr/bin/env node

/**
 * Gemini API client via Renoise gateway.
 * Zero npm dependencies — uses native fetch.
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
 *   # With uploaded file URI (from file upload skill)
 *   node gemini.mjs --file-uri "https://...fileUri" --file-mime video/mp4 "Analyze this video"
 *
 *   # JSON output mode
 *   node gemini.mjs --json "Return a JSON object with name and age"
 *
 * Options:
 *   --file <path>         Attach a local file (image/video). Repeatable.
 *   --file-uri <uri>      Attach an uploaded file by URI. Requires --file-mime.
 *   --file-mime <mime>     MIME type for --file-uri.
 *   --resolution <level>  Media resolution: low|medium|high|ultra_high (default: medium)
 *   --model <name>        Model name (default: gemini-3.1-pro)
 *   --temperature <n>     Temperature (default: 1.0)
 *   --max-tokens <n>      Max output tokens (default: 8192)
 *   --json                Request JSON response format
 *
 * Environment:
 *   RENOISE_API_KEY       Required. Get one at https://www.renoise.ai
 */

import fs from "fs/promises";
import path from "path";

// --- Auth ---
const RENOISE_API_KEY = process.env.RENOISE_API_KEY;
if (!RENOISE_API_KEY) {
  console.error(
    "RENOISE_API_KEY not set. Get one at: https://www.renoise.ai"
  );
  process.exit(1);
}

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

// --- Parse args ---
function parseArgs(argv) {
  const files = [];
  let fileUri = null;
  let fileMime = null;
  let resolution = "medium";
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
    model,
    temperature,
    maxTokens,
    json,
    prompt: textParts.join(" "),
  };
}

// --- Build parts ---
async function buildParts(opts) {
  const parts = [];
  const resLevel = RESOLUTION_MAP[opts.resolution] ?? RESOLUTION_MAP.medium;

  // Local files → inline base64
  for (const filePath of opts.files) {
    const data = await fs.readFile(filePath);
    parts.push({
      inlineData: {
        mimeType: getMimeType(filePath),
        data: data.toString("base64"),
      },
      mediaResolution: { level: resLevel },
    });
  }

  // Uploaded file URI
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

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.prompt && opts.files.length === 0 && !opts.fileUri) {
    console.error(
      "Usage: node gemini.mjs [--file <path>] [--resolution low|medium|high|ultra_high] <prompt>"
    );
    process.exit(1);
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
