# Visual Development Guide

VISUAL DEV bridges late **PLAN** and early **EXECUTE**.

Goal: turn abstract planning decisions into concrete anchors the model can actually follow. This stage exists to prevent drift.

In practical terms, VISUAL DEV answers:
- What will anchor recurring people?
- What will anchor important environments, products, or props?
- What will each shot reference?
- Where does clip-to-clip continuity need stronger support?

---

## Stage Contract

### Required Inputs
- approved SCRIPT package
- segment purpose table
- character asset plan
- anchor needs summary
- style direction

### Required Outputs
Before leaving VISUAL DEV, produce:
- **Anchor Registry**
- **Scene / Environment Anchor Plan**
- **Shot → Anchor Mapping**
- **Continuity Strategy Table**
- any generated / registered assets and their IDs

### Blocking Conditions
Do **not** move to PROMPTS if any of these are missing for quality-critical shots:
- recurring human anchor
- important recurring environment anchor
- important recurring product / object anchor when the shot depends on it
- shot-level anchor assignment
- continuity strategy for tight handoffs

If a key anchor is missing, either create it here or explicitly downgrade the plan with user awareness. Do not silently continue.

---

## Why This Stage Matters

| Approach | Consistency | Setup Time | Cost | Best Use |
|----------|-------------|------------|------|----------|
| Text-only | Low | 0 | 0 | Simple one-off shots |
| Storyboard-only | Medium | Low-Med | Low-Med | Palette / composition anchoring |
| Human + scene + storyboard anchors | High | Med | Med | Multi-clip work with continuity needs |

**Rule of thumb:** for multi-clip work, recurring people, environments, and important props should have anchors planned on purpose, not by accident.

---

## Step 1: Match Existing Materials

If INTAKE produced a material pool, score it against project needs:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/match-materials.mjs \
  --pool material-pool.json --shots project.json
```

This helps separate:
- what is already usable
- what can be reused
- what still needs creation

If no material pool exists, mark those needs as unresolved and continue to gap analysis.

---

## Step 2: Gap Analysis

### 2a. Check Existing Face-Safe Options

Before generating new character art, inspect existing options:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs character list
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset list --status active
```

If suitable characters or assets already exist, reuse them.

### 2b. Identify Missing Anchors

Use a planning table like this:

```text
| Need | Reuse? | New Asset Needed? | Anchor Type |
|------|--------|-------------------|-------------|
| Maya (S1-S4) | no | yes | User Asset |
| Hallway (S1) | yes | no | scene ref_image |
| Living room (S2-S4) | no | yes | scene ref_image + storyboard |
| Pocket watch | maybe | maybe | object/product ref |
```

### Anchor Priority

**Faces / characters**
1. User Asset (`asset:ID:reference_image`)
2. Character Library (`--characters "ID"`)
3. Text-only fallback

**Non-face anchors**
1. scene / product `ref_image`
2. storyboard panel
3. text-only

---

## Step 3: Build the Anchor Plan First

Before generating anything, write the plan explicitly.

### 3a. Anchor Registry

```text
| Anchor | Type | Segments | Anchor Strategy | Asset ID / Source | Notes |
|--------|------|----------|-----------------|-------------------|-------|
| Maya | recurring human | S1-S4 | User Asset | pending | recurring lead |
| Courier | one-shot human | S1 | Text-only | — | cameo only |
| Hallway | environment | S1 | existing scene ref | material:53 | already provided |
| Pocket watch | object | S2-S4 | product/object ref | pending | recurring hero prop |
```

### 3b. Scene / Environment Anchor Plan

```text
| Environment | Segments | Anchor Strategy | Material ID | Notes |
|-------------|----------|-----------------|-------------|-------|
| Hallway | S1 | existing scene ref | 53 | already provided |
| Living room | S2-S4 | generate scene ref | pending | recurring key location |
| Magical living room state | S3-S4 | storyboard + prompt lighting variation | pending | derived from living room |
```

### 3c. Continuity Strategy Table

```text
| Transition | Continuity Need | Strategy | Why |
|------------|------------------|----------|-----|
| S1→S2 | medium | parallel + continuity text | location change |
| S2→S3 | high | serial / ref_video preferred | same room, continuous action |
| S3→S4 | high | serial preferred | same room, aftermath |
```

**This table is mandatory for multi-clip work.** It keeps the team from pretending all transitions are equal.

---

## Step 4: Generate Missing Assets

All image assets use `nano-banana-2`.

### 4a. Character Design Sheets

Use when a character needs a reusable face anchor.

Prompt template:
```text
Character design sheet for [CHARACTER NAME].

[FULL CHARACTER DESCRIPTION from Character Bible]

Layout: 2 rows × 3 columns on clean white background.
Row 1: front, 3/4, side profile.
Row 2: two expressions + full body pose.

[STYLE LINE]
Concept art style, consistent appearance across all panels.
No text labels. No background elements.
```

CLI:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<character sheet prompt>" --tags "<project>,char-<name>"
```

### 4b. Scene Reference Images

Use for recurring or important environments.

Prompt template:
```text
[LOCATION DESCRIPTION]
[TIME OF DAY + LIGHTING]
[STYLE LINE]
Cinematic wide establishing shot. Environment only.
No people, text, logos, or watermarks.
```

CLI:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<scene ref prompt>" --tags "<project>,scene-<name>"
```

### 4c. Storyboard Grid

Use when you want shared visual DNA across many shots.

Prompt template:
```text
Storyboard grid for "[PROJECT TITLE]", [N] panels.

[STYLE LINE]
[FULL CHARACTER DESCRIPTIONS as needed]

Panel 1 (S1): ...
Panel 2 (S2): ...
...

Consistent appearance across panels. No text labels.
```

CLI:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "<storyboard grid prompt>" --tags "<project>,storyboard"
```

Optional split:
```bash
convert storyboard.png -crop 3x2@ +repage +adjoin panel_%d.png
```

---

## Step 5: Register Face Assets

Any face-containing image intended for video reference must be registered:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload character-sheet.png
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "<Character Name>"
```

Use the resulting asset ID in video generation:
```text
--materials "asset:27:reference_image"
```

Never rely on raw `ref_image` for close-up faces.

---

## Step 6: Build Final Shot Mapping

This is the real output of VISUAL DEV.

```text
| Shot | Human Anchor | Environment Anchor | Extra Anchor | Continuity Strategy |
|------|--------------|--------------------|--------------|---------------------|
| S1 | asset:27 | material:53 | object:watch | establish |
| S2 | asset:27 | material:61 | storyboard:72 | parallel |
| S3 | asset:27 | material:61 | ref_video from S2 | serial |
| S4 | asset:27 | material:61 | ref_video from S3 | serial |
```

This mapping is what PROMPTS must follow.

---

## Checklist Before Proceeding

### Blocking
- [ ] Every recurring human has a real anchor strategy
- [ ] All face anchors are registered or mapped to Character Library
- [ ] Important recurring environments have anchors or an explicit fallback decision
- [ ] Important recurring products / props have anchors or an explicit fallback decision when the shot depends on them
- [ ] Multi-clip transitions have a continuity strategy
- [ ] Shot → Anchor Mapping is complete

### Required Output Tables
- [ ] Anchor Registry
- [ ] Scene / Environment Anchor Plan
- [ ] Continuity Strategy Table
- [ ] Shot → Anchor Mapping

If these four artifacts do not exist, VISUAL DEV is not done.

---

## Efficiency Notes

- Human identity anchors are usually the highest-value investment
- Scene anchors become critical when the same location appears multiple times
- Product / prop anchors matter when the object itself must stay recognizably consistent
- Storyboard grids are strong for overall visual DNA, but weaker than face-safe assets for identity
- If a transition must match tightly at the seam, choose serial / `ref_video` early instead of hoping prompt wording will solve it later
