#!/usr/bin/env node

/**
 * Upload a file via Renoise gateway for use with gemini-gen.
 * Outputs the file URI to stdout.
 *
 * Usage: node upload.mjs <file-path>
 *
 * Environment:
 *   RENOISE_API_KEY  Required. Get one at https://www.renoise.ai
 */

import fs from "fs/promises";
import path from "path";

const RENOISE_API_KEY = process.env.RENOISE_API_KEY;
if (!RENOISE_API_KEY) {
  console.error("RENOISE_API_KEY not set. Get one at: https://www.renoise.ai");
  process.exit(1);
}

// TODO: Replace with actual Renoise gateway upload endpoint
const UPLOAD_ENDPOINT = "https://staging--ujgsvru36x4korjj10nq.edgespark.app/api/public/llm/proxy/upload/v1beta/files";

const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};

function getMimeType(filePath) {
  return (
    MIME_MAP[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
  );
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node upload.mjs <file-path>");
    process.exit(1);
  }

  const stat = await fs.stat(filePath).catch(() => {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  });

  const mimeType = getMimeType(filePath);
  const fileData = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  console.error(`Uploading ${fileName} (${(stat.size / 1024 / 1024).toFixed(1)}MB, ${mimeType})...`);

  // TODO: Implement actual upload request once endpoint is confirmed
  // The response should contain a file URI like:
  //   { "file": { "uri": "https://...", "name": "files/xxx", "mimeType": "...", ... } }
  const res = await fetch(`${UPLOAD_ENDPOINT}?key=${RENOISE_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "start, upload, finalize",
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": mimeType,
    },
    body: fileData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Upload error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const data = await res.json();
  const fileUri = data?.file?.uri;

  if (!fileUri) {
    console.error("No file URI in response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  // Print URI to stdout (stderr used for progress messages)
  console.log(fileUri);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
