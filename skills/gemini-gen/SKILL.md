---
name: gemini-gen
description: >
  Visual understanding and multimodal analysis via Gemini 3.1 Pro.
  Use when you need to understand, analyze, or extract information from images or videos:
  analyze product photos, extract video scripts/dialogue, understand video content for replication,
  compare visual assets, OCR/text extraction from images, describe scenes for prompt writing,
  extract style/color/composition from reference footage.
  Do NOT use for generating images or videos — use renoise-gen instead.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.2.0
  category: ai-foundation
  tags: [vision, analysis, multimodal, gemini]
---

# Gemini Gen — Visual Understanding & Multimodal Analysis

Gemini 3.1 Pro via Renoise gateway. Zero npm dependencies, native `fetch` only.

## When to Use

| Scenario                        | Example                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Analyze product photos**      | Extract type, color, material, selling points, brand tone from product images                      |
| **Understand video content**    | "What happens in this video?", summarize scenes, identify actions and objects                      |
| **Extract scripts from video**  | Watch a reference video → output timestamped dialogue, scene descriptions, camera movements        |
| **Replicate a video style**     | Analyze a reference clip → extract visual style, pacing, transitions, color grading for recreation |
| **Compare visual assets**       | Side-by-side analysis of two product photos, before/after comparison                               |
| **OCR / text extraction**       | Read text from screenshots, packaging, signage in images                                           |
| **Describe scenes for prompts** | Look at a reference image → write a detailed prompt for `renoise-gen` to recreate the style        |
| **Content review**              | Check if generated output matches the creative brief                                               |

## When NOT to Use

- **Generating images** → use `renoise-gen` with `nano-banana-2`
- **Generating videos** → use `renoise-gen` with `renoise-2.0`
- **Uploading large files** → use `file-upload` first, then pass the URL here

## Authentication

Use environment variable `RENOISE_API_KEY`. Get one at: https://www.renoise.ai

## API Endpoint

```
POST https://renoise.ai/api/public/llm/proxy/v1beta/models/{model}:generateContent?key={RENOISE_API_KEY}
```

Default model: `gemini-3.1-pro`

## Request Format

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "your prompt here" }]
    }
  ],
  "generationConfig": {
    "temperature": 1.0,
    "maxOutputTokens": 8192
  }
}
```

## Multimodal Input (images & videos)

Gemini supports images and videos as inline base64 parts alongside text. Multiple files can be sent in the same request.

### Image Input

```json
{
  "contents": [
    {
      "parts": [
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "<base64-encoded-data>"
          },
          "mediaResolution": { "level": "media_resolution_high" }
        },
        { "text": "Describe this image" }
      ]
    }
  ]
}
```

`mediaResolution` controls token allocation per image/frame:

| Level                         | Image Tokens | Video Frame Tokens |
| ----------------------------- | ------------ | ------------------ |
| `media_resolution_low`        | 280          | 70                 |
| `media_resolution_medium`     | 560          | 140                |
| `media_resolution_high`       | 840          | 210                |
| `media_resolution_ultra_high` | 1120         | 280                |

Default: `media_resolution_medium`. Use `high` or `ultra_high` for detail-critical analysis (product photos, fine text). Use `low` for bulk/batch processing.

### Video Input

Same format — just use a video MIME type. Inline base64 has a **20MB limit**. For larger videos, use the dedicated file upload skill.

```json
{
  "contents": [
    {
      "parts": [
        {
          "inlineData": {
            "mimeType": "video/mp4",
            "data": "<base64-encoded-data>"
          },
          "mediaResolution": { "level": "media_resolution_low" }
        },
        { "text": "Summarize what happens in this video" }
      ]
    }
  ]
}
```

> **Tip**: Use `media_resolution_low` for videos to reduce token consumption — video has many frames.

### Multiple Files

Send multiple images/videos in one request by adding more `inlineData` parts:

```json
{
  "contents": [
    {
      "parts": [
        {
          "inlineData": { "mimeType": "image/jpeg", "data": "<base64-image-1>" }
        },
        {
          "inlineData": { "mimeType": "image/png", "data": "<base64-image-2>" }
        },
        { "text": "Compare these two product photos" }
      ]
    }
  ]
}
```

### Large Files (> 20MB)

Inline base64 has a **20MB limit**. For larger files, use the dedicated file upload skill to get a file URI, then reference it:

```json
{
  "contents": [
    {
      "parts": [
        {
          "fileData": {
            "mimeType": "video/mp4",
            "fileUri": "<uploaded-file-uri>"
          }
        },
        { "text": "Analyze this video" }
      ]
    }
  ]
}
```

## Supported MIME Types

| Extension  | MIME Type       | Max Inline |
| ---------- | --------------- | ---------- |
| .jpg/.jpeg | image/jpeg      | 20MB       |
| .png       | image/png       | 20MB       |
| .webp      | image/webp      | 20MB       |
| .gif       | image/gif       | 20MB       |
| .mp4       | video/mp4       | 20MB       |
| .mov       | video/quicktime | 20MB       |
| .webm      | video/webm      | 20MB       |

## Response Parsing

```javascript
const data = await response.json();
const text = data.candidates[0].content.parts[0].text;
```

## Error Handling

- 400: Bad request (check prompt format)
- 403: Invalid API key
- 429: Rate limited (wait and retry)
- 500: Server error (retry with backoff)

## CLI Script

`${CLAUDE_SKILL_DIR}/scripts/gemini.mjs` — zero-dependency Node.js script, other skills can directly call it.

```bash
# Text only
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs "Explain quantum computing"

# Analyze an image (high resolution for product detail)
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file photo.jpg --resolution high "Describe this product"

# Analyze a video (low resolution to save tokens)
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file clip.mp4 --resolution low "Summarize this clip"

# Multiple images
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file a.jpg --file b.jpg "Compare these two"

# Uploaded file URI (from file upload skill, for files > 20MB)
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --file-uri "<uri>" --file-mime video/mp4 "Analyze this video"

# JSON output mode
node ${CLAUDE_SKILL_DIR}/scripts/gemini.mjs --json "Return a JSON object with name and age"
```

### Options

| Flag                   | Default          | Description                                          |
| ---------------------- | ---------------- | ---------------------------------------------------- |
| `--file <path>`        | —                | Attach local file (repeatable)                       |
| `--file-uri <uri>`     | —                | Attach uploaded file by URI (requires `--file-mime`) |
| `--file-mime <mime>`   | —                | MIME type for `--file-uri`                           |
| `--resolution <level>` | `medium`         | `low` / `medium` / `high` / `ultra_high`             |
| `--model <name>`       | `gemini-3.1-pro` | Model name                                           |
| `--temperature <n>`    | `1.0`            | Temperature                                          |
| `--max-tokens <n>`     | `8192`           | Max output tokens                                    |
| `--json`               | off              | Request JSON response format                         |
