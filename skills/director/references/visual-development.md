# Visual Development Guide

The pipeline for transforming text descriptions into visual assets that anchor video generation. This stage bridges SCRIPT → PROMPTS by creating character design sheets, scene references, and storyboard grids — all uploaded as materials and referenced in every video prompt.

## Why Visual Dev Matters

| Approach | Character Consistency | Setup Time | Credits |
|----------|----------------------|------------|---------|
| Text-only (no visual dev) | Low — model drifts per generation | 0 min | 0 |
| Storyboard grid as ref_image | Medium-High — shared visual DNA | ~15 min | ~50-150 |
| Char sheets + scene refs + storyboard | Highest — layered anchoring | ~30 min | ~150-400 |

**Rule**: For any project with 3+ segments and recurring characters, ALWAYS do visual dev. The time investment pays for itself in fewer re-generations.

## Sub-Pipeline Overview

```
┌─────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐   ┌───────────────┐
│ 1. MATCH    │──▶│ 2. GAP       │──▶│ 3. GENERATE     │──▶│ 4. REGISTER   │──▶│ 5. MAP        │
│ existing    │   │ analysis     │   │ missing assets   │   │ face assets   │   │ shot→material │
│ materials   │   │ + characters │   │ (images)         │   │ as Ark assets │   │ + assets      │
└─────────────┘   └──────────────┘   └─────────────────┘   └───────────────┘   └───────────────┘
```

> **Critical**: Images containing human faces **must** go through asset registration before use in video generation. Three options (strongest → weakest):
> 1. **User Asset** — generate character image → upload → `asset register` → use as `asset:ID:reference_image` (bypass privacy detection, ~1 min setup)
> 2. **Character Library** — pre-existing platform characters → `--characters "ID"` (bypass privacy detection, zero setup if character exists)
> 3. **Text-only** — full Character Bible description in prompt (no images, no privacy issues, lowest consistency)

---

## Step 1: Match Existing Materials

If the user provided materials during INTAKE (uploaded via `material-ingest.mjs`), score them against project needs.

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/match-materials.mjs \
  --pool material-pool.json --shots project.json
```

This outputs a mapping with confidence scores:
```
character "protagonist" → material #5  (score: 0.91) ✅
character "sidekick"    → no match                    ❌
scene "office"          → material #23 (score: 0.78)  ✅
scene "tavern"          → no match                    ❌
shot S1               → material #42 (score: 0.85)  ✅
shot S3               → no match                    ❌
```

**If no material pool exists**: Skip to Step 2 with everything marked as ❌.

---

## Step 2: Gap Analysis

### Step 2a: Check Existing Face-Safe References

Before generating any character design sheets, check what's already available:

```bash
# Check Character Library (pre-existing platform characters)
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs character list
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs character list --search "warrior"

# Check existing User Assets (previously registered)
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset list --status active
```

If suitable characters/assets are found, note their IDs and skip generating those characters.

If none exist, the plan is: **generate character image → upload → register as User Asset → use `asset:ID:reference_image`**. This is detailed in Step 3a and Step 4 below.

### Step 2b: Compare Materials Against Needs

Compare matched materials against full project needs:

| Need | Matched? | Action |
|------|----------|--------|
| Character: [protagonist] (8 segments) | ✅ existing User Asset #27 | Use `--materials "asset:27:reference_image"` |
| Character: [protagonist] (8 segments) | ✅ in Character Library #42 | Use `--characters "42"` |
| Character: [supporting] (2+ segments) | ❌ no asset or library entry | **MUST Generate → upload → asset register** |
| Character: [cameo] (1 segment only) | ❌ no asset | Text-only acceptable |
| Scene: [location A] | ✅ material (no faces) | Use as `--materials "ID:ref_image"` |
| Scene: [location B] | ❌ | Generate scene ref (no faces, optional) |
| Storyboard grid | ❌ | Generate (environment-only panels, recommended) |

**Priority for face references**: User Asset (`asset:ID:reference_image`) = Character Library (`--characters "ID"`) > Text-only.
**Priority for non-face references**: Material `ref_image` > Storyboard grid panel > Text-only.

**Characters appearing in 2+ segments MUST have asset registration — this is not optional.** The cost is negligible (~12 credits per image) vs. the visual consistency benefit. Scene refs help but are less critical if the storyboard grid already depicts those environments.

---

## Step 3: Generate Missing Assets

All assets generated with `nano-banana-2` (image model).

### 3a. Character Design Sheets

One sheet per main character. Shows multiple angles and expressions in a single image, ensuring the model generates a consistent face/body.

**Prompt template:**
```
Character design sheet for [CHARACTER NAME].

[FULL CHARACTER DESCRIPTION — verbatim from Character Bible, including:
  age, ethnicity, face details, hair, skin tone, body type,
  wardrobe (texture + cut + color for each garment),
  signature details (jewelry, accessories, props)]

Layout: 2 rows × 3 columns on clean white background.
Row 1: front view (neutral expression), 3/4 view (neutral), side profile (neutral).
Row 2: front view ([emotion A] expression), front view ([emotion B] expression), full body pose.

[STYLE LINE from project — e.g. "Cinematic period drama, warm earth tones, film grain."]
Concept art style, clean lines, consistent appearance across all panels.
No text labels. No background elements.
```

**CLI:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<character sheet prompt>" --tags "<project>,char-<name>"
```

**Upload + Register as Asset (for face-safe use):**
```bash
# Download the generated image
curl -s -o character-sheet.png "<image_url>"

# Upload as material
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload character-sheet.png
# → Returns material ID (e.g. #101)

# Register as Ark asset (one-step: create + wait ~30-60s)
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset register 101 --name "Maya - Character Reference"
# → Returns asset ID (e.g. #27) when active
# Use in video: --materials "asset:27:reference_image"
```

> **Why asset register?** Character design sheets contain human faces. Using them directly as `ref_image` via material ID triggers privacy detection. Registering as an Ark asset creates an `asset://` URI that bypasses this entirely.

### 3b. Scene Reference Images

One image per key location. No characters — environment only.

**Prompt template:**
```
[LOCATION DESCRIPTION — architecture, materials, objects, scale]
[TIME OF DAY + LIGHTING — e.g. "Late afternoon, golden hour side-lighting through tall windows"]
[STYLE LINE]
Cinematic composition, wide establishing shot. No people, environment only.
No text, watermarks, or logos.
```

**CLI:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<scene ref prompt>" --tags "<project>,scene-<name>"
```

Upload and record material ID.

### 3c. Storyboard Grid

A single image containing key frames from ALL segments, arranged in a grid. Because the AI renders all panels in one context, characters share consistent face structure, proportions, and styling across panels.

**Prompt template:**
```
Storyboard grid for "[PROJECT TITLE]", [N] panels arranged in [R] rows × [C] columns.

[STYLE LINE]

[For each character in the project, full Character Bible description — verbatim]

Panel 1 (S1 — [scene label]): [Key visual moment, 1 sentence. Include character action + environment + lighting mood]
Panel 2 (S2 — [scene label]): [Key visual moment]
Panel 3 (S3 — [scene label]): [Key visual moment]
...

Consistent character appearance across all panels. Each panel is a distinct scene with its own lighting and environment.
Cinematic composition per panel. No text labels.
```

**CLI:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<storyboard grid prompt>" --tags "<project>,storyboard"
```

**Split grid into individual panels** (if needed for per-segment ref_image):
```bash
# Using ImageMagick or ffmpeg
# For a 2×3 grid:
convert storyboard.png -crop 3x2@ +repage +adjoin panel_%d.png
```

Upload each panel:
```bash
for f in panel_*.png; do
  node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload "$f"
done
```

### Generation Order

Generate assets in parallel when possible:
- Character sheets and scene refs have no dependencies → generate simultaneously
- Storyboard grid depends on knowing the character descriptions and scenes → generate after reviewing char sheets (to ensure consistency)

Alternatively, if budget is tight, skip character sheets and scene refs — generate ONLY the storyboard grid. It provides the most consistency-per-credit.

---

## Step 4: Register Face-Containing Assets

**NEW STEP** — Any generated image containing human faces must be registered as an Ark asset before use.

```bash
# For each character design sheet generated in Step 3a:
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "<Character Name>"
# Waits ~30-60s, returns asset ID when active
```

Scene refs and storyboard panels (no faces) do NOT need registration — use them directly as `--materials "ID:ref_image"`.

---

## Step 5: Build Final Mapping

Create a complete shot → anchor mapping:

```
Shot    Anchor Type              Reference              CLI Flag
─────   ──────────────────────   ────────────────────   ───────────────────────────────────
S1      User Asset (face)        asset #27 (Maya)       --materials "asset:27:reference_image"
S2      scene ref (no face)      material #53           --materials "53:ref_image"
S3      Character Library        char #42               --characters "42"
S4      storyboard panel         material #54           --materials "54:ref_image"
S5      text-only                —                      (Character Bible in prompt)

Face Reference Registry:
  Maya (protagonist)   asset #27   (used in S1, S3, S5)
  Wei (supporting)     asset #28   (used in S3)
  Elder (cameo)        char #42    (Character Library, used in S3)
```

**Anchor selection decision tree:**

1. **Has face + generated character image** → `--materials "asset:ID:reference_image"` (User Asset, strongest for new characters)
2. **Has face + exists in Character Library** → `--characters "ID"` (strongest for pre-existing characters)
3. **No face (scene, product, environment)** → `--materials "ID:ref_image"` (safe, no registration needed)
4. **No suitable materials** → text-only with full Character Bible (always works)

> **Rule**: Never use raw `ref_image` (material ID) for images containing human faces. Either register as User Asset or use Character Library. `ref_image` is only for face-free content.

**⚠️ Privacy & Face Detection**:
- **Character design sheets** generated by `nano-banana-2` contain AI-generated faces that WILL trigger privacy detection if used as raw `ref_image`. **Always register them as User Assets first** (`asset register`).
- **Storyboard grid panels** with small figures usually pass as `ref_image`, but close-up face panels may be blocked.
- **If any `ref_image` is blocked**:
  1. **Best**: Register the image as a User Asset → `asset register <material_id>` → use `asset:ID:reference_image`
  2. **Alternative**: Use Character Library → `--characters "ID"` (if the character exists there)
  3. **Fallback**: Drop the image entirely, use text-only with full Character Bible
- **Real photographs of human faces** — must go through User Asset registration or Character Library. Never use as raw `ref_image`.

---

## Visual Dev by Mode

| Mode | Character Sheets | Scene Refs | Storyboard Grid |
|------|-----------------|------------|-----------------|
| A (Quick) | Skip | Skip | Skip |
| B (E-commerce) | Skip (text description) | Skip (product photo is the ref) | Skip |
| C (Original) | ✅ All main characters | ✅ Key locations | ✅ Always |
| D (Adaptation) | ✅ All main characters | ✅ Key locations | ✅ Always |
| E (Montage) | Optional (if recurring character) | ✅ Key environments | ✅ Always (mood anchoring) |

---

## Efficiency Tips

1. **Character sheets are NOT optional for 2+ segment characters.** Every character appearing in 2+ segments MUST have a registered User Asset. At ~12 credits per image + ~1 min registration, this is negligible compared to the 300 credits per video segment. Skipping character assets to "save budget" is a false economy — inconsistent characters require expensive re-generations.

2. **Scene refs and storyboard grids CAN be skipped** if budget is tight. These provide environmental consistency but are less critical than character assets. Priority order: character assets (mandatory) > storyboard grid (recommended) > scene refs (nice-to-have).

3. **Quality-maximizing path**: Generate character sheets first, review them, then reference those designs when writing the storyboard grid prompt. The grid will be more consistent because you've already locked the character look.

4. **Parallel generation**: Character sheets and scene refs are independent — generate them all simultaneously (~8 min total regardless of count). Then generate the storyboard grid.

5. **Re-use across episodes**: Save material IDs. For episodic content (same characters, new story), reuse character sheets and regenerate only new scene refs + storyboard grid.

---

## Checklist Before Proceeding to PROMPTS

**Character Assets (BLOCKING — cannot proceed if any fail):**
- [ ] Character Library and existing User Assets checked
- [ ] Every character appearing in **2+ segments** has a registered User Asset (asset ID) or Character Library entry — **text-only is NOT acceptable for 2+ segment characters** unless image generation failed after retry
- [ ] All face-containing character images are registered as User Assets (`asset register`) and status is `active`
- [ ] Characters in exactly 1 segment may use text-only (document which ones and why)

**Character-to-Asset Registry (MANDATORY — output this table before proceeding):**
```
| Character | Segments | Asset ID | Strategy |
|-----------|----------|----------|----------|
| [name]    | S1-S8    | asset:28 | User Asset ✅ |
| [name]    | S3,S5    | asset:29 | User Asset ✅ |
| [name]    | S7,S8    | asset:30 | User Asset ✅ |
| [name]    | S4       | —        | Text-only (1 segment) |
```

**Scene & Environment (recommended, not blocking):**
- [ ] Every key location has either a matched material or a generated scene ref (face-free)
- [ ] Storyboard grid generated (if applicable) with environment-focused panels
- [ ] All non-face assets are uploaded and have material IDs

**Shot Mapping:**
- [ ] Shot → anchor mapping is complete, using the correct CLI flag format:
  - Face images: `--materials "asset:ID:reference_image"` or `--characters "ID"`
  - Non-face images: `--materials "ID:ref_image"`
  - No anchor: text-only with full Character Bible (1-segment characters only)
- [ ] No raw `ref_image` contains close-up human faces
- [ ] User has reviewed and approved the visual assets (Confirm ②)
