---
name: gemini-gen
description: >
  Structured image and video understanding via the native Renoise CLI and Gemini 3.1 Pro.
  Extract standalone generation prompts, reusable replacement templates, timelines,
  dialogue, camera language, style, subjects, audio, and uncertainty warnings.
  Use for understanding local images/videos, reverse-prompting, script/style extraction,
  and preparing media for Director workflows. Do NOT generate media here — use renoise-gen.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.4.0
  category: ai-foundation
  tags: [vision, analysis, multimodal, gemini]
---

# Analyze Media — Native Renoise CLI

`renoise analyze` is the only runtime for media understanding. It uses Gemini 3.1 Pro, validates structured output, streams large files through a temporary analysis upload, and never saves the source as a generation material or creates a paid media-generation task.

## Preflight

Verify the native command and authentication:

```bash
command -v renoise
renoise help analyze
renoise auth status --json
```

On Windows PowerShell use `Get-Command renoise`. If any check fails, immediately read `${CLAUDE_SKILL_DIR}/../renoise-setup/SKILL.md` completely and follow it through readiness, asking only for approvals required before host changes or browser authorization. Then rerun preflight and continue the original request; do not merely direct the user to **Setup / Account**.

## Core Commands

```bash
# Image → self-contained image-generation prompt and observations
renoise analyze photo.jpg --target image --language <user-language> --json

# Image → self-contained video prompt with explicitly warned inferred motion
renoise analyze photo.jpg --target video --language <user-language> --json

# Video → timeline, dialogue, camera, style, audio, and standalone video prompt
renoise analyze clip.mp4 --target video --language <user-language> --json

# Image/video → reusable prompt with replacement slots
renoise analyze reference.mp4 --mode template --target video --language <user-language> --json

# Shell composition when only the English generation prompt is needed
renoise analyze clip.mp4 --prompt-only
```

The default mode is `standalone`; its prompt contains no placeholders or reference requirements. `template` preserves composition/timing/style while replacing source-specific identities with model-neutral `{{slot_id}}` placeholders. Each slot includes a self-contained English reference-image prompt.

## Result Contract

Use the structured fields rather than reparsing the generated prompt:

```json
{
  "version": "v1",
  "model": "gemini-3.1-pro",
  "mode": "standalone",
  "target": "video",
  "source": {
    "name": "clip.mp4",
    "type": "video",
    "mimeType": "video/mp4",
    "size": 123456
  },
  "analysis": {
    "summary": "...",
    "durationSeconds": 8,
    "aspectRatio": "9:16",
    "composition": "...",
    "facePresence": "present|absent|uncertain",
    "timeline": [
      {
        "start": 0,
        "end": 2,
        "visual": "...",
        "action": "...",
        "camera": "...",
        "dialogue": "...",
        "sound": "..."
      }
    ],
    "style": {
      "lighting": "...",
      "palette": ["..."],
      "cameraLanguage": "...",
      "pacing": "...",
      "mood": "..."
    },
    "subjects": [{"id": "subject_1", "type": "character", "description": "..."}],
    "audio": {"dialogue": "...", "music": "...", "effects": "..."}
  },
  "prompt": "complete English generation prompt",
  "slots": [],
  "warnings": []
}
```

Schema keys and the final generation prompt are English. Analysis descriptions follow `--language`; dialogue remains verbatim in the detected source language.

## Common Tasks

### Script and Shot Extraction

Use `analysis.timeline` for timestamped scenes, actions, camera movements, dialogue, and sound. Use `analysis.audio` for aggregate dialogue/music/effects. Timestamps are model observations, not frame-accurate edit decision lists; preserve warnings and verify critical dialogue with the user.

### Style Extraction

Use `analysis.style` plus `analysis.composition`. Do not infer style by scraping adjectives from `prompt` when structured fields are available.

### Product or Character Understanding

Use `analysis.subjects`, `analysis.summary`, `analysis.composition`, and `analysis.facePresence`. `uncertain` is not equivalent to `absent`; any privacy-sensitive automation must fail closed.

### Compare Two Assets

Analyze each local asset separately with the same target and language, then compare their structured `analysis` objects. Do not upload either as a generation material unless the downstream workflow explicitly requires it and the user approves.

### Reference-Video Remake / 剪同款

Route to the `director` skill and read `commercial/scenario-a-viral.md`. That workflow uses `--mode template`, persists `remake-analysis.json` and `remake-plan.json`, fills replacement slots, checks live model role combinations, and requires approval before slot generation and final video generation.

## Input and Failure Rules

- Supported local files: jpg/jpeg, png, webp, gif, mp4, mov, webm.
- MIME/content mismatches are rejected.
- Large media uses a temporary analysis URL; it is not added to the Renoise material library.
- Cross-media output (`image → video`, `video → image`) records inferred details in `warnings`.
- If output is truncated, malformed, blocked, or missing required fields, treat the command as failed; never fabricate a replacement result.
- `analyze` may consume LLM analysis quota, but it never creates a media generation task.
- For generation, pass the approved `prompt` into `renoise task create` through the `renoise-gen` or `director` workflow.
