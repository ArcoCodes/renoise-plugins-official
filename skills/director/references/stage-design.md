# Stage 3: DESIGN — Visual Development with Variants

DESIGN is a **visual development** stage. It comes after SCRIPT and before STORYBOARD.

Goal: turn the script's character descriptions, scene descriptions, and style direction into **concrete visual anchors** — generating multiple variants for each, letting the user choose, then locking the visual foundation before any keyframes or video are generated.

> Cross-references:
> - Visual development principles: `Read ${CLAUDE_SKILL_DIR}/references/visual-development.md`
> - Model capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
> - DAG schema (variant_groups): `Read ${CLAUDE_SKILL_DIR}/references/production-plan-schema.md`

---

## Stage Contract

### Required Inputs (from SCRIPT)
- Approved story structure (logline, treatment, segment purpose table)
- Character definitions (appearance, wardrobe, signature details)
- Scene/environment descriptions
- Style direction
- Anchor needs summary (which characters, scenes, props need visual anchors)

### Required Outputs (before moving to STORYBOARD)
- **Confirmed character design** for each recurring character (selected from variants → registered as asset)
- **Confirmed scene/environment design** for each key location (selected from variants)
- **Confirmed style concept art** (selected from variants → becomes style_anchor for all video nodes)
- Variant group records in `project.json`
- All deferred edges resolved (source set to selected node IDs)

### Blocking Conditions
- Do not proceed to STORYBOARD if any recurring character design is unconfirmed
- Do not proceed if style concept art is unconfirmed
- Do not proceed if any key recurring environment is unconfirmed

---

## Why Variants Matter

| Action | Cost | Risk |
|--------|------|------|
| Generate 3 character design variants | ~24 credits | Low — all cheap images |
| Discover character looks wrong at video stage | ~200+ credits per redo | High — video is 10× more expensive |
| Generate 2 scene ref variants | ~16 credits | Low |
| Discover scene mood doesn't match at video stage | ~200+ credits per redo | High |

**The math is simple**: spending 2-3× more on images in DESIGN saves 10×+ on video redos in GENERATE. This is standard shift-left economics.

---

## Step 1: Review Anchor Needs from SCRIPT

The SCRIPT stage produces an anchor needs summary. Review it:

```text
| Need | Type | Recurring? | Variant Strategy |
|------|------|-----------|-----------------|
| Maya | character | S1-S4 | 3 variants |
| Hallway | environment | S1 | existing material (skip) |
| Living room | environment | S2-S4 | 2 variants |
| Style concept | concept_art | all | 2 variants |
| Pocket watch | prop | S2-S4 | text-only (skip) |
```

**When to generate variants vs skip:**
- Recurring character appearing in 2+ shots → **always generate variants** (2-3)
- Recurring environment appearing in 2+ shots → **generate variants** (2)
- One-off environment with existing material → **skip** (use material directly)
- Props/objects → usually **text-only** unless it's a hero prop central to the story
- Style concept art for multi-clip work → **always generate variants** (2)

---

## Step 2: Character Design Variants

For each recurring character, generate 2-3 variants with deliberate visual differences.

### Variant Differentiation Strategy

Keep the **core identity** identical across variants. Vary the **interpretation**:

| Shared (same in all variants) | Varied (different per variant) |
|-------------------------------|-------------------------------|
| Ethnicity, age range, build | Facial feature emphasis (soft/angular/round) |
| Hair color and approximate length | Hair styling details |
| Core wardrobe items | Expression / mood |
| Body type | Pose in reference sheet |

### Prompt Template

```text
Character reference sheet for [CHARACTER NAME].

[FULL CHARACTER DESCRIPTION from Character Bible in SCRIPT]

[VARIANT-SPECIFIC TWEAK: e.g. "Softer features, warm gentle expression" or "More angular features, determined confident expression"]

Layout: 2 rows × 3 columns on clean white background.
Row 1: front, 3/4, side profile.
Row 2: two expressions + full body pose.

[STYLE LINE from SCRIPT]
Concept art style, consistent appearance across all panels.
No text labels. No background elements.
```

### CLI

Generate all character variants in parallel:
```bash
# Variant 1
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 1:1 \
  --prompt "<variant 1 prompt>" --tags "<project>,char-<name>,v1"

# Variant 2
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 1:1 \
  --prompt "<variant 2 prompt>" --tags "<project>,char-<name>,v2"

# Variant 3 (optional)
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 1:1 \
  --prompt "<variant 3 prompt>" --tags "<project>,char-<name>,v3"
```

### Present to User

Show all variants side by side. Ask the user to pick one:

> "Here are 3 character design variants for Maya. Which one best matches your vision?"
>
> - **v1**: Softer features, gentle expression
> - **v2**: More angular features, confident expression
> - **v3**: Rounder face, curious expression

### On Selection

1. Mark selected node `status: "selected"`, others `status: "rejected"`
2. Set `variant_group.selected` to the winning node ID
3. Download the selected image
4. Upload as material → get `material_id`
5. Register as asset: `asset register <material_id> --name "<name>"`
6. Set `asset_node.source_node` to the selected image node
7. Resolve deferred edges (set `source` on edges that were waiting for this selection)

---

## Step 3: Scene/Environment Design Variants

For each recurring environment, generate 2 variants with different mood/atmosphere.

### Variant Differentiation Strategy

| Shared | Varied |
|--------|--------|
| Core room/space layout | Color temperature (warm/cool) |
| Key furniture/props mentioned in script | Time of day / lighting mood |
| Architectural style | Atmosphere density (airy/moody) |

### Prompt Template

```text
[LOCATION DESCRIPTION from script]
[VARIANT-SPECIFIC TWEAK: e.g. "Warm amber tones, golden hour light" or "Cool twilight tones, moody blue-hour light"]
[STYLE LINE]
Cinematic wide establishing shot. Environment only.
No people, text, logos, or watermarks.
```

### CLI

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio <project-ratio> \
  --prompt "<scene variant prompt>" --tags "<project>,scene-<name>,v<N>"
```

### On Selection

1. Mark selected/rejected
2. Download selected image → upload as material → get `material_id`
3. Resolve deferred edges (scene ref_image → video nodes using this location)

---

## Step 4: Style Concept Art Variants

Generate 2 concept art variants that capture the overall visual DNA of the project.

### Variant Differentiation Strategy

| Shared | Varied |
|--------|--------|
| Subject matter / motifs | Color palette emphasis |
| Film-like quality | Texture (clean/grainy/painterly) |
| Genre feel | Lighting approach (naturalistic/stylized) |

### Prompt Template

```text
Concept art mood board for "[PROJECT TITLE]".
[VISUAL STYLE from SCRIPT style direction]
[VARIANT-SPECIFIC TWEAK: e.g. "Warm amber dominant palette, subtle film grain" or "Teal and gold palette, anamorphic lens flares"]
Key visual motifs: [motifs from story].
Cinematic, professional look. No text or labels.
```

### On Selection

1. Mark selected/rejected
2. Download selected → upload as material → get `material_id`
3. Wire as `style_anchor` to ALL video nodes (resolve deferred edges)

> **⚠️ Critical**: The selected concept art becomes the style_anchor for EVERY video node. If this selection is wrong, it affects the entire project. Take the time to get this right.

---

## Step 5: Update DAG

After all selections are made:

1. All variant groups have `selected` set
2. All deferred edges (those with `source: null`) now have their source resolved
3. Asset nodes have their `source_node` and `asset_id` set
4. Update `project.json` with all changes

```bash
Write ${PROJECT_DIR}/project.json
```

Regenerate the canvas to show the resolved state:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/generate-canvas.mjs "${PROJECT_DIR}"
```

---

## Mode-Specific Behavior

| Mode | DESIGN Behavior |
|------|----------------|
| **A** (Quick) | **Skip entirely** — no design stage for single quick clips |
| **B** (E-com) | **Minimal** — product images already exist; scene variants only if multi-scene |
| **C** (Original) | **Full variant workflow** for characters, scenes, concept art |
| **D** (Adaptation) | **Full variant workflow** — especially important since source material sets expectations |
| **E** (Montage) | **Concept art variants + scene variants** — characters less critical for montage |

---

## Gate: User Confirmation

Present a summary of all selections:

```md
## Design Summary
✅ Maya: variant 2 selected (angular features, confident)
✅ Living Room: variant 1 selected (warm amber tones)
✅ Style Concept: variant 1 selected (amber suspense palette)
✅ Hallway: existing material (no variants needed)

Assets registered:
- Maya face anchor: asset:27

All visual anchors confirmed. Ready to proceed to STORYBOARD.
```

Set `project.stage_gates.design = true` → proceed to STORYBOARD.

---

## Checklist Before Proceeding

### Blocking
- [ ] Every recurring character has a confirmed design variant
- [ ] All character face anchors are registered as assets
- [ ] Every recurring environment has a confirmed design variant (or existing material)
- [ ] Style concept art is confirmed and wired as style_anchor to all video nodes
- [ ] All deferred edges in project.json are resolved (no remaining `source: null`)
- [ ] Budget spent on DESIGN is within estimates

### Warning (flag but don't block)
- [ ] Any character with only text-only description appearing in 2+ shots
- [ ] No concept art variant generated for multi-clip project
