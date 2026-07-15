# Visual Dev — Character & Scene Asset Setup

Quick reference for creating visual assets before writing prompts. Only needed for **multi-clip projects** (>15s) with recurring characters.

---

## When to Use

- Character appears in **2+ segments** → **you MUST lock the look with a character sheet**: generate one (below), get the user's OK, upload it once, and reuse the **same material ID** as `ref_image` in every segment. This holds **even for a fully invented character with no source photo** — the generated sheet *is* the reference. Do not settle for a text-only description of a recurring character (that is what causes face/wardrobe drift).
- Character appears in **1 segment only** → text-only description in prompt is fine
- Scene/environment anchoring → optional but helps consistency

---

## Picking an Image Model

| Use case | Model | Why |
|----------|-------|-----|
| Character design sheet, scene ref, drafts | `nano-banana-2` | Cheapest, widest ratios (incl. 8:1 / 1:8), fast iteration |
| Hero / final keyframe where fidelity matters | `nano-banana-pro` | Higher detail + lighting quality |
| Poster / title card / anything with readable text or logos | `gpt-image-2` | Best prompt-following for typography |
| Stylized / painterly illustration | `midjourney-v7` | Strongest stylization (no `--resolution`) |

Default to `nano-banana-2` for anchoring work (character sheets, scene refs). Switch per-shot only when the job demands it.

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
  --prompt "<character sheet prompt>"
```

---

## Upload the Character Sheet

On the seedance series a face image is used directly as `ref_image` — it is auto-facepassed on submit, so there is no registration step.

```bash
# Download the generated image
curl -s -o char.png "<image_url>"

# Upload as material
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload char.png
# → Returns material ID (e.g. #101)

# Use in video prompts — reuse the SAME material ID in every segment:
# --materials "101:ref_image"
```

**List your uploaded materials:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material list --mine
```

---

## Props & Wardrobe Continuity Table

Character sheets lock faces; this table locks the **props and wardrobe** that also drift or mutate across segments (a jade token turning from a white porcelain shard into a raw green stone; a hairstyle going from a bun to loose hair, or grey clothes to a black-and-gold robe, with no transition). It is a line item of the director skill's **Gate 2 Consistency Manifest**.

For each key prop and each character's wardrobe, register a **fixed description** (`material + color + form`) and split traits into **constant vs plot-driven**:

```
Item                         Fixed description (material+color+form)                    Type
Engagement token             translucent green jade, palm-sized, one clean broken shard  Constant (all segments)
Hero robe (Act I)            coarse grey hemp, loose-fit, frayed hem                     Constant until S4
Hero robe (Act II)           black silk with gold immortal embroidery, high collar       Plot-driven (from S4)
Hair                         waist-length black, tied in a single high bun               Constant until S4
Hair (Act II)                waist-length black, worn loose                              Plot-driven (from S4)
```

Rules:
- **Copy the fixed description verbatim** into every segment prompt where the item appears — do not paraphrase it segment to segment (paraphrase is how "green jade shard" becomes "white porcelain fragment").
- **Constant traits never change.** If it is not a deliberate plot beat, it stays identical every segment.
- **A plot-driven change must be staged as its own explicit transformation shot** — a dedicated segment that shows the change happening (a transformation close-up: robe reforming, hair coming loose). Never let wardrobe/props jump between two adjacent segments with no on-screen transition. The transition itself becomes a segment in the shot list and a row in the Transition Table.

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
  --prompt "<scene description, environment only, no people. Include: location, time of day, lighting, color palette, key props, atmosphere. Photorealistic, cinematic composition.>"

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

Character `ref_image`, `ref_video`, and scene `ref_image` **combine freely**. Use as many or as few as each segment requires.

```bash
# All three (character + continuity + environment)
--materials "27:ref_image,42:ref_video,99:ref_image"

# Character + environment only (no continuity needed)
--materials "27:ref_image,99:ref_image"

# Environment only (B-roll, no characters)
--materials "99:ref_image"
```

**Example workflow for a 3-segment project:**
```
Prep:
  1. Generate character sheet → upload → note its material ID #A (reuse it every segment)
  2. Generate scene concepts for unique locations in parallel → upload → materials

Generate (serial chain):
  S1: task generate --materials "A:ref_image,S1:ref_image"
  V1: task chain <S1_ID>                                          # downloads + uploads as material
  S2: task generate --materials "A:ref_image,V1:ref_video,S2:ref_image"
  V2: task chain <S2_ID>
  S3: task generate --materials "A:ref_image,V2:ref_video,S2:ref_image"  # same location as S2? reuse scene ref
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

**Consistency note**: Use grids for style/palette anchoring. For face consistency across segments, reuse the same character-sheet material ID as `ref_image` in every segment. On non-seedance models, grid panels with close-up faces may be rejected by provider review — favor environment-focused wide shots there.

**Generation order**: Character sheets first (review them), then reference those designs when writing the storyboard grid prompt. The grid will be more consistent because you've already locked the character look.

---

## Shot Mapping

Before writing prompts, build a mapping of **all three anchors** for each shot:

```
Shot  Character        Scene Ref    Prev Video   CLI --materials
S1    #27              #S1          (none)       "27:ref_image,S1:ref_image"
S2    #27,#28          #S2          #V1          "27:ref_image,28:ref_image,V1:ref_video,S2:ref_image"
S3    (no characters)  #S3          #V2          "V2:ref_video,S3:ref_image"
S4    Elder (1-shot)   #S3          #V3          "V3:ref_video,S3:ref_image"  (+ text description for Elder)
```

**Rules:**
- Face images → `ID:ref_image` (seedance auto-facepasses on submit); reuse the same material ID for a recurring character
- Scene/environment images → `ID:ref_image`
- Previous segment output → `ID:ref_video`
- Same location across segments → reuse the same scene ref material ID
- S1 has no ref_video; all subsequent segments should chain from previous
