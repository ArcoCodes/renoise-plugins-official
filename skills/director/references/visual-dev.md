# Visual Dev — Character & Scene Asset Setup

Quick reference for creating and registering visual assets before writing prompts. Only needed for **multi-clip projects** (>15s) with recurring characters.

---

## When to Use

- Character appears in **2+ segments** → **must** generate and register a User Asset
- Character appears in **1 segment only** → text-only description in prompt is fine
- Scene/environment anchoring → optional but helps consistency

---

## Character Design Sheet

Generate a multi-angle reference for each main character.

**Prompt template:**
```
Character design sheet for [NAME].

[FULL appearance description — age, face details, hair, skin tone, body type,
wardrobe (texture + cut + color per garment), accessories, signature details]

Layout: 2 rows × 3 columns on clean white background.
Row 1: front view (neutral), 3/4 view (neutral), side profile (neutral).
Row 2: front view ([emotion A]), front view ([emotion B]), full body pose.

[STYLE LINE from project]
Concept art style, clean lines, consistent appearance across all panels.
No text labels. No background elements.
```

**Generate:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<character sheet prompt>" --tags "<project>,char-<name>"
```

---

## Register as User Asset

Any image with a human face **must** be registered before use in video generation.

```bash
# Download the generated image
curl -s -o char.png "<image_url>"

# Upload as material
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload char.png
# → Returns material ID (e.g. #101)

# Register as asset (waits ~30-60s, returns asset ID when active)
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset register 101 --name "Character Name"
# → Returns asset ID (e.g. #27)

# Use in video prompts:
# --materials "asset:27:reference_image"
```

**Check existing assets:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset list --status active
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs character list
```

---

## Ingesting User-Provided Materials

If the user provides reference images, product photos, or footage:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/material-ingest.mjs <paths-or-directory>
```

This uploads files, runs analysis (tags, descriptions, face detection), and outputs `material-pool.json`. Match pool entries against project needs before generating new assets.

---

## Scene Reference (Recommended for Multi-Clip)

Generate environment-only concept art for each segment to anchor lighting, color palette, and spatial layout. **Without scene refs, different segments will drift in environment appearance even with character assets and ref_video.**

Scene images must NOT contain human faces (use wide shots, empty rooms, landscapes). They don't need asset registration — upload directly as materials.

**Generate one scene ref per segment:**
```bash
# For each segment, generate a scene concept image
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<scene description, environment only, no people. Include: location, time of day, lighting, color palette, key props, atmosphere. Photorealistic, cinematic composition.>" \
  --tags "<project>,scene-s<N>"

# Download and upload
curl -s -o scene-s1.png "<image_url>"
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload scene-s1.png
# → Use as: --materials "ID:ref_image"
```

**Scene ref prompt tips:**
- Include the exact lighting conditions from your style guide ("warm desk lamp, twilight blue through window")
- Include key props that matter to the story ("empty pedestal center frame", "DoorDash bag on doormat")
- Match the color palette to your segment's mood (warm amber for comfort, cool blue for tension)
- If multiple segments share the same location, you can reuse the same scene ref material ID

---

## Combining Anchors

Character assets, ref_video, and scene ref_image use different API fields and **combine freely** within multimodal reference mode. Use as many or as few as each segment requires.

```bash
# All three (character + continuity + environment)
--materials "asset:27:reference_image,42:ref_video,99:ref_image"

# Character + environment only (no continuity needed)
--materials "asset:27:reference_image,99:ref_image"

# Environment only (B-roll, no characters)
--materials "99:ref_image"
```

**Example workflow for a 3-segment project:**
```
Prep:
  1. Generate character sheet → upload → register as asset #A
  2. Generate scene concepts for unique locations in parallel → upload → materials

Generate (serial chain):
  S1: task generate --materials "asset:A:reference_image,S1:ref_image"
  V1: task chain <S1_ID>                                          # downloads + uploads as material
  S2: task generate --materials "asset:A:reference_image,V1:ref_video,S2:ref_image"
  V2: task chain <S2_ID>
  S3: task generate --materials "asset:A:reference_image,V2:ref_video,S2:ref_image"  # same location as S2? reuse scene ref
```

S1 has no ref_video (nothing to continue from). Add ref_video only when continuing from a previous segment's action.

> Scene concepts are independent — generate all of them in parallel with `task create`, then `task wait` each.
> Generations with multiple anchors take 8–12 min/segment. Use `task create` + `task wait --timeout 900` if default timeout is insufficient.

---

## Storyboard Grid (Recommended for Multi-Clip)

A single image containing key frames from ALL segments. Because the AI renders all panels in one generation, characters share consistent face structure, proportions, and styling across panels.

**Why one image > many images**: Independent generations start from different random seeds, causing drift in face shape, color palette, and rendering style. A grid forces consistency.

**Prompt template:**
```
Storyboard grid for "[TITLE]", [N] panels in [R] rows × [C] columns.

[STYLE LINE]

[Full Character Bible for each character — verbatim]

Panel 1 (S1 — [label]): [Key visual moment, 1 sentence. Character action + environment + mood]
Panel 2 (S2 — [label]): [Key visual moment]
...

Consistent character appearance across all panels. Each panel is a distinct scene.
Cinematic composition per panel. No text labels.
```

**Split into individual panels** (for per-segment `ref_image`):
```bash
# For a 2×3 grid using ImageMagick:
convert storyboard.png -crop 3x2@ +repage +adjoin panel_%d.png

# Or use the included script:
bash ${CLAUDE_SKILL_DIR}/scripts/split-grid.sh storyboard.png output_dir/ 2 3
```

**Privacy warning**: Grid panels with close-up faces may trigger `PrivacyInformation`. Design grids with environment-focused wide shots and small figures. Use User Assets for face consistency, grids for style/palette anchoring.

**Generation order**: Character sheets first (review them), then reference those designs when writing the storyboard grid prompt. The grid will be more consistent because you've already locked the character look.

---

## Shot Mapping

Before writing prompts, build a mapping of **all three anchors** for each shot:

```
Shot  Character        Scene Ref    Prev Video   CLI --materials
S1    asset #27        #S1          (none)       "asset:27:reference_image,S1:ref_image"
S2    asset #27,#28    #S2          #V1          "asset:27:reference_image,asset:28:reference_image,V1:ref_video,S2:ref_image"
S3    (no characters)  #S3          #V2          "V2:ref_video,S3:ref_image"
S4    Elder (1-shot)   #S3          #V3          "V3:ref_video,S3:ref_image"  (+ text description for Elder)
```

**Rules:**
- Face images → `asset:ID:reference_image` (User Asset) or `--characters "ID"` (Character Library)
- Scene/environment images (no faces) → `ID:ref_image`
- Previous segment output → `ID:ref_video`
- Same location across segments → reuse the same scene ref material ID
- Never use raw material ID for images containing close-up faces
- S1 has no ref_video; all subsequent segments should chain from previous
