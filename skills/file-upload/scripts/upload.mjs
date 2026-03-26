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

const UPLOAD_ENDPOINT =
  "https://renoise.ai/api/public/v1/llm/files/upload";

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

  console.error(
    `Uploading ${fileName} (${(stat.size / 1024 / 1024).toFixed(1)}MB, ${mimeType})...`
  );

  // Build multipart form-data with native FormData + Blob
  const blob = new Blob([fileData], { type: mimeType });
  const form = new FormData();
  form.append("file", blob, fileName);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-Key": RENOISE_API_KEY,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Upload error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const data = await res.json();

  // Response format: { previewUrl, mimeType, size, expiresAt }
  const fileUrl = data?.previewUrl;

  if (!fileUrl) {
    console.error("No previewUrl in response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const expires = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "unknown";
  console.error(`Uploaded: ${(data.size / 1024).toFixed(0)}KB, expires ${expires}`);
  // Print URL to stdout (stderr used for progress messages)
  console.log(fileUrl);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
