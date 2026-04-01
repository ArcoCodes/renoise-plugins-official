# Stage 1: INTAKE — PLAN START

Shared across all modes. INTAKE is always a **PLAN** stage.

Goal: collect inputs, detect mode, assess materials and budget, and produce a clear project summary that is concrete enough to enter SCRIPT.

---

## Stage Contract

### Required Inputs
- User brief, idea, or source material
- Any provided images, videos, product shots, scripts, or references
- User goals: platform, tone, ratio, language, runtime expectations if known

### Required Outputs
Before leaving INTAKE, produce:
- **Mode**: A / B / C / D / E
- **Project summary**: what the user is trying to make
- **Material status**: what exists vs. what must be created
- **Budget snapshot**: current balance and rough cost implication
- **Open blockers**: anything still unclear enough to affect quality downstream

### Blocking Conditions
Do **not** move on if any of these are still unclear:
- what the deliverable actually is
- which mode fits the request
- whether materials already exist
- whether budget supports the current scope

If any blocker remains, ask or summarize the gap explicitly. Do not improvise past it.

---

## 1. Collect Inputs

### Mode A / C / E
Collect:
- user's creative brief
- desired format / ratio if mentioned
- any reference images, videos, art, or mood samples

### Mode B
Collect:
- product images
- selling points
- target audience
- desired tone / creator persona if relevant

### Mode D
Collect:
- source material (novel text, screenplay, manga pages, etc.)
- adaptation intent: faithful, condensed, reimagined, comedic, etc.

---

## 2. Material Check

Ask whether the user has existing visual materials.

**If yes**, ingest and analyze:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/material-ingest.mjs <paths-or-directory>
```
This uploads files, runs Gemini analysis, and outputs `material-pool.json`.

**If no**, record that the material pool is empty and note that later stages must create anchors from scratch.

### Product Images (Mode B)
Analyze inline:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/gemini-gen/scripts/gemini.mjs --file <image> --mode product
```

### Reference Video URLs
Download first:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/video-download/scripts/download-video.sh '<URL>'
```
Then ingest the downloaded file:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/material-ingest.mjs <downloaded-path>
```

---

## 3. Budget Check

Check available credits:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs credit me
```

Use rough planning math:
- ~300 credits per 15s video clip
- ~50 credits per `nano-banana-2` image

You do not need perfect budget precision here. You do need enough clarity to know whether the current plan is realistic.

---

## 4. Detect Mode

| User Signal | Mode |
|-------------|------|
| Quick clip, simple concept, single scene, ≤15s | **A** |
| Product / TikTok / sales video with product images | **B** |
| Original short film / drama / multi-segment story | **C** |
| Adapting source material | **D** |
| Montage / MV / mood piece | **E** |

Present the result plainly:

> Here's what I understand: [summary]. I'll use **Mode [X]** — [one-line reason].

---

## 5. Trust Levels

Trust level changes brevity, **not requirements**.

| Condition | Level | Behavior |
|-----------|-------|----------|
| First-time user | 1 | Show full planning structure |
| Returning user | 2 | Be more concise |
| Very complete brief | 3 | Fast-track, but still produce required outputs |

Optional preference lookup:
```bash
cat ~/.claude/renoise/preferences.json 2>/dev/null
```

---

## 6. Project Initialization (Modes C / D / E)

For multi-clip projects:
```bash
mkdir -p "${PROJECT_DIR}/storyboard" "${PROJECT_DIR}/videos"
```

Checkpoint state can live in `${PROJECT_DIR}/project.json`:
```json
{
  "mode": "D",
  "title": "...",
  "segments": 6,
  "style_line": "...",
  "characters": [],
  "shots": []
}
```

---

## Exit Format

End INTAKE with a concise planning summary, for example:

```md
## Intake Summary
Mode: C
Goal: 4-shot suspense short about a mysterious package
Materials: 2 hallway refs provided, no character refs yet
Budget: 1800 credits available, enough for 4 clips + anchor images
Known gaps: protagonist face anchor, living-room environment anchor
Next: SCRIPT to lock story beats, segment roles, and anchor needs
```

Do not leave INTAKE without something equivalent to the above.
