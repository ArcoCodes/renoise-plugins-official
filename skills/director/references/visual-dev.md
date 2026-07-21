# Visual Dev — Character & Scene Anchors

Use this for projects with recurring characters, products, props, wardrobe, or locations. Model selection and material capabilities always come from the native CLI.

## Live Capability Check

```bash
renoise model --json
renoise model <selected-image-model> --json
renoise model <selected-video-model> --json
```

Choose the server-advertised default unless the user names a model or another model's live `guidance` better matches the job. Only use advertised resolutions, ratios, material roles, and reference limits. Do not maintain a model matrix here.

## Character Design Sheet

A character appearing in more than one segment needs one approved visual anchor. Generate it once, show it to the user, upload it, and reuse the same material ID through an image-reference role supported by the selected video model.

Prompt template:

```text
Character design sheet for [NAME].

[FULL appearance description — age, face, hair, skin tone, body type,
wardrobe with texture/cut/color, accessories, signature details]

Layout: 2 rows × 3 columns on a clean background.
Row 1: front, three-quarter, side profile.
Row 2: two expressions, one full-body pose.

[PROJECT STYLE LINE]
Consistent appearance across every panel. No labels or background elements.
```

```bash
renoise generate run <selected-image-model> \
  --prompt "<character sheet prompt>" \
  <ratio/resolution flags advertised by the model> --json
renoise upload character-sheet.png --json
```

Before attaching it to video, inspect the selected video model and use one of its advertised material roles:

```bash
renoise model <selected-video-model> --json
```

## Props and Wardrobe

Register a fixed description for every recurring prop and wardrobe state:

```text
Item                 Fixed description                         Type
Engagement token     translucent green jade, one broken shard  Constant
Hero robe, Act I     coarse grey hemp, loose, frayed hem       Constant until S4
Hero robe, Act II    black silk, gold embroidery, high collar  Plot-driven from S4
```

- Copy fixed descriptions verbatim wherever the item appears.
- Constant traits never change silently.
- A plot-driven change gets an explicit transformation shot and Transition Table row.

## Scene References

For recurring locations, generate an environment-only concept image that fixes layout, lighting, palette, and key props. Upload once and reuse its material ID wherever that location returns.

```bash
renoise generate run <selected-image-model> \
  --prompt "<environment only: location, time, lighting, palette, props, atmosphere>" --json
renoise upload scene-reference.png --json
```

## Continuity Routing

Never assume roles combine across models. Inspect `materialRoles` and `guidance` first.

- Identity/product/location continuity: reuse the same uploaded material ID through a supported image role.
- Motion continuity: use `renoise generate chain <task-id> --json` only when the next model advertises a compatible video-reference role.
- Exact opening-state continuity: extract the previous tail frame and use an advertised frame role; if only image references are available, place the tail frame first and state the opening composition explicitly.

```bash
ffmpeg -sseof -0.2 -i previous.mp4 -frames:v 1 -q:v 2 -y previous-end.jpg
renoise upload previous-end.jpg --json
```

Record the actual role and material ID chosen for every shot:

```text
Shot  Character anchor  Scene anchor  Previous result  CLI materials
S1    #27               #91           —                <supported roles>
S2    #27               #92           #V1              <supported roles>
```

## Material Ingest

```bash
renoise auth exec -- node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/scripts/material-ingest.mjs <paths-or-directory>
```

This uploads files, runs Gemini analysis, and writes `material-pool.json`.

## Storyboard Grid

For multi-segment visual review, generate one grid after character sheets are approved. A shared canvas helps palette and styling stay coherent; split it into per-segment references only if the selected video model supports the needed image role.

```text
Storyboard grid for "[TITLE]", [N] panels.
[PROJECT STYLE LINE]
[APPROVED CHARACTER BIBLE]
Panel 1: [key visual moment]
Panel 2: [key visual moment]
Consistent designs and palette. No labels.
```

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/split-grid.sh storyboard.png output_dir/ 2 3
```
