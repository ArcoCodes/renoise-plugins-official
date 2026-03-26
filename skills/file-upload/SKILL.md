---
name: file-upload
description: >
  Upload files (images, videos) to Renoise and get a file URI for use with gemini-gen.
  Use when a file exceeds 20MB inline base64 limit, or when you need to reuse
  the same file across multiple gemini-gen calls without re-encoding.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.1.0
  category: utility
  tags: [upload, file, gemini]
---

# File Upload

Upload files via the Renoise gateway and get back a file URI for use with `gemini-gen`.

## When to Use

- File exceeds 20MB (inline base64 limit for `gemini-gen`)
- Same file needs to be referenced in multiple `gemini-gen` calls (upload once, reuse URI)

## Prerequisites

- `RENOISE_API_KEY` environment variable set

## API

```
POST https://renoise.ai/api/public/v1/llm/files/upload
Header: X-API-Key: <RENOISE_API_KEY>
Body: multipart/form-data with field "file"
```

## CLI Script

```bash
# Upload a file, get back a file URI
node ${CLAUDE_SKILL_DIR}/scripts/upload.mjs <file-path>

# Capture URI for use with gemini-gen
FILE_URI=$(node ${CLAUDE_SKILL_DIR}/scripts/upload.mjs large-video.mp4)
```

Progress messages go to stderr, the file URL goes to stdout.

## Response Format

```json
{
  "previewUrl": "https://...r2.cloudflarestorage.com/.../filename?X-Amz-...",
  "mimeType": "image/jpeg",
  "size": 111198,
  "expiresAt": "2026-03-26T11:49:07.328Z"
}
```

- `previewUrl` — Signed URL, valid for **1 hour**
- Upload once, use the URL immediately in downstream skills

## Usage with gemini-gen

```bash
# Step 1: Upload
FILE_URL=$(node ${CLAUDE_PLUGIN_ROOT}/skills/file-upload/scripts/upload.mjs large-video.mp4)

# Step 2: Use with gemini-gen
node ${CLAUDE_PLUGIN_ROOT}/skills/gemini-gen/scripts/gemini.mjs \
  --file-uri "$FILE_URL" --file-mime video/mp4 \
  "Analyze this video"
```

## Supported File Types

Images: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
Videos: `.mp4`, `.mov`, `.webm`
Audio: `.mp3`, `.wav`
Documents: `.pdf`
