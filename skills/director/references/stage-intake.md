# Stage 1: INTAKE — Material Collection & Mode Detection

Shared across all modes. Goal: collect inputs, analyze materials, check budget, detect mode.

## 1.1 Collect Inputs

- **Mode A/C/E**: User's creative brief, any reference images/videos
- **Mode B**: Product images + selling points + target audience
- **Mode D**: Source material (novel text, screenplay, manga pages) + user's vision

## 1.2 Material Check

Ask: "Do you have existing visual materials (reference images, character art, product photos, footage)?"

**If yes** — ingest and analyze:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/material-ingest.mjs <paths-or-directory>
```
This uploads files, runs Gemini analysis (tags, descriptions, face detection), and outputs `material-pool.json`.

**If no** — note empty pool; VISUAL DEV will generate everything from scratch.

**For product images (Mode B)** — analyze inline:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/gemini-gen/scripts/gemini.mjs --file <image> --mode product
```

**If user provides reference video URLs** — download first:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/video-download/scripts/download-video.sh '<URL>'
# Then ingest the downloaded file:
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/material-ingest.mjs <downloaded-path>
```

## 1.3 Budget Check

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs credit me
```

Estimate cost: ~300 credits per 15s video clip, ~50 credits per nano-banana-2 image. Inform user of budget vs. plan.

## 1.4 Auto-detect Mode + Present Summary

"Here's what I understand: [concept]. I'll use **Mode [X]** — [one-line description]."

## Mode Detection Table

| User Signal | Mode |
|-------------|------|
| Quick clip, simple concept, single scene, ≤15s | **A** (Quick) |
| "TikTok", "e-commerce", "product video", "sales video" + product images | **B** (E-commerce) |
| "short film", "drama", "multi-segment", original story idea, >15s | **C** (Original) |
| Provides source material (novel, screenplay, manga, storyboard) to adapt | **D** (Adaptation) |
| "montage", "MV", "music video", "mood piece", non-narrative multi-clip | **E** (Montage) |

## Trust Levels

| Condition | Level | Behavior |
|-----------|-------|----------|
| First-time user | 1 | Full pipeline with all confirmation points |
| Returning user (has preferences) | 2 | Skip style selection, fewer confirmations |
| Complete brief provided | 3 | Minimal confirmations, fast-track to generation |

```bash
cat ~/.claude/renoise/preferences.json 2>/dev/null
```

## Project Initialization (Multi-Clip Modes C/D/E)

```bash
mkdir -p "${PROJECT_DIR}/storyboard" "${PROJECT_DIR}/videos"
```

Store project state in `${PROJECT_DIR}/project.json` for checkpoint recovery:
```json
{
  "mode": "D",
  "title": "...",
  "segments": 6,
  "style_line": "...",
  "characters": [...],
  "shots": [
    {"id": "S1", "status": "completed", "material_id": 42, "asset_id": 27, "task_id": 1234, "video_url": "..."},
    {"id": "S2", "status": "pending", "material_id": 53}
  ]
}
```
