---
name: file-upload
description: >
  Upload large files (images, videos) and get a file URI for use with gemini-gen.
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

## CLI Script

```bash
# Upload a file
node ${CLAUDE_SKILL_DIR}/scripts/upload.mjs <file-path>

# Output: the file URI to use with gemini-gen --file-uri
```

## Usage with gemini-gen

```bash
# Step 1: Upload
FILE_URI=$(node ${CLAUDE_PLUGIN_ROOT}/skills/file-upload/scripts/upload.mjs large-video.mp4)

# Step 2: Use with gemini-gen
node ${CLAUDE_PLUGIN_ROOT}/skills/gemini-gen/scripts/gemini.mjs \
  --file-uri "$FILE_URI" --file-mime video/mp4 \
  "Analyze this video"
```

<!-- TODO: Fill in upload endpoint, response format, file expiration policy -->
