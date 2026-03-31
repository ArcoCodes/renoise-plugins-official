---
name: gemini-gen
description: >
  Visual understanding and multimodal analysis via Gemini 3.1 Pro.
  Analyze product photos, extract video scripts/dialogue, understand video content,
  compare visual assets, OCR/text extraction, describe scenes for prompt writing,
  extract style/color/composition from reference footage.
  Handles large files (>20MB) automatically via built-in upload.
  Do NOT use for generating images or videos — use renoise-gen instead.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.3.0
  category: ai-foundation
  tags: [vision, analysis, multimodal, gemini]
---

# Gemini Gen — Visual Understanding & Multimodal Analysis

Gemini 3.1 Pro via Renoise gateway. Zero npm dependencies, native `fetch` only.
Handles files of any size automatically — small files are sent inline, large files (>20MB) are uploaded first.

## Quick Start

```bash
# Analyze a product photo
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file photo.jpg --mode product

# Extract a video script with timestamps
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file clip.mp4 --mode video-script

# Extract visual style keywords from a reference
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file reference.jpg --mode style

# Free-form analysis
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file photo.jpg "Describe this image in detail"
```

## Analysis Modes

Preset modes auto-select optimal resolution and output format. Use `--mode` for common tasks instead of writing custom prompts.

### Product Analysis (`--mode product`)

Analyzes product photos and returns structured JSON with type, color, material, selling points, brand tone, and scene suggestions. Auto-selects `high` resolution for maximum detail.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file product.jpg --mode product
```

Output:
```json
{
  "type": "resistance loop bands",
  "color": "Pink 10lb, Blue 15lb, Mint green 20lb",
  "material": "TPE elastic, matte finish",
  "selling_points": ["3 resistance levels", "foldable and portable", "pastel color scheme"],
  "brand_tone": "Youthful athletic, trendy fitness",
  "scene_suggestions": ["living room workout", "hotel room fitness", "outdoor park"]
}
```

### Video Script Extraction (`--mode video-script`)

Watches a video and outputs timestamped dialogue, scene descriptions, and camera movements. Auto-selects `low` resolution to reduce token consumption.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file clip.mp4 --mode video-script
```

### Style Extraction (`--mode style`)

Extracts visual style keywords from a reference image or video: color palette, lighting, camera language, composition, and mood.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file reference.jpg --mode style
```

## CLI Usage

```bash
# Text only
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs "Explain quantum computing"

# Analyze an image (high resolution for product detail)
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file photo.jpg --resolution high "Describe this product"

# Analyze a video (low resolution to save tokens)
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file clip.mp4 --resolution low "Summarize this clip"

# Multiple images
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file a.jpg --file b.jpg "Compare these two"

# JSON output mode
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --json "Return a JSON object with name and age"
```

### Options

| Flag                   | Default          | Description                                          |
| ---------------------- | ---------------- | ---------------------------------------------------- |
| `--file <path>`        | —                | Attach local file (repeatable). Files >20MB auto-uploaded |
| `--file-uri <uri>`     | —                | Attach uploaded file by URI (requires `--file-mime`) |
| `--file-mime <mime>`   | —                | MIME type for `--file-uri`                           |
| `--resolution <level>` | `medium`         | `low` / `medium` / `high` / `ultra_high`             |
| `--model <name>`       | `gemini-3.1-pro` | Model name                                           |
| `--temperature <n>`    | `1.0`            | Temperature                                          |
| `--max-tokens <n>`     | `8192`           | Max output tokens                                    |
| `--json`               | off              | Request JSON response format                         |
| `--mode <name>`        | —                | Preset analysis mode: `product`, `video-script`, `style` |

### Resolution Levels

`mediaResolution` controls token allocation per image/frame:

| Level                         | Image Tokens | Video Frame Tokens | Best For |
| ----------------------------- | ------------ | ------------------ | -------- |
| `low`                         | 280          | 70                 | Bulk processing, video analysis |
| `medium`                      | 560          | 140                | General use (default) |
| `high`                        | 840          | 210                | Product photos, fine text |
| `ultra_high`                  | 1120         | 280                | Extreme detail |

## Large File Handling

Files larger than 20MB are **automatically uploaded** before analysis — no manual steps needed. The upload goes through the Renoise file gateway and returns a temporary URL (valid for 1 hour).

```bash
# This just works — the script detects file size and auto-uploads if needed
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file large-video.mp4 "Analyze this video"
```

For manual uploads (e.g. reusing the same large file across multiple calls):
```bash
# Upload once
FILE_URL=$(node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/upload.mjs large-video.mp4)

# Use the URL in multiple calls
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file-uri "$FILE_URL" --file-mime video/mp4 "Summarize"
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file-uri "$FILE_URL" --file-mime video/mp4 "Extract dialogue"
```

## When to Use vs When Not

| Use gemini-gen for | Use renoise-gen for |
|---|---|
| Analyzing product photos | Generating images |
| Understanding video content | Generating videos |
| Extracting scripts from video | Text-to-video / image-to-video |
| Comparing visual assets | Product design sheets |
| OCR / text extraction | Scene backgrounds |
| Describing scenes for prompts | — |

## API Reference (Advanced)

### Endpoint

```
POST https://renoise.ai/api/public/llm/proxy/v1beta/models/{model}:generateContent?key={RENOISE_API_KEY}
```

### Request Format

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" }, "mediaResolution": { "level": "media_resolution_high" } },
        { "text": "Describe this image" }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 1.0,
    "maxOutputTokens": 8192
  }
}
```

### Supported MIME Types

| Extension  | MIME Type       | Max Inline |
| ---------- | --------------- | ---------- |
| .jpg/.jpeg | image/jpeg      | 20MB       |
| .png       | image/png       | 20MB       |
| .webp      | image/webp      | 20MB       |
| .gif       | image/gif       | 20MB       |
| .mp4       | video/mp4       | 20MB       |
| .mov       | video/quicktime | 20MB       |
| .webm      | video/webm      | 20MB       |

### Error Handling

- 400: Bad request (check prompt format)
- 403: Invalid API key
- 429: Rate limited (wait and retry)
- 500: Server error (retry with backoff)

## Authentication

Environment variable `RENOISE_API_KEY`. Get one at: https://www.renoise.ai
