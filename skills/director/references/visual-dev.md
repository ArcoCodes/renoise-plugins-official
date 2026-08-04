# Visual Dev — Character & Scene Anchors

Use this for projects with recurring characters, products, props, wardrobe, or locations. Model selection and material capabilities always come from the current host's live capability source.

## Live Capability Check

Before planning anchors:

1. Preserve a user-selected model.
2. Otherwise choose the advertised default for the requested media kind.
3. Inspect the selected image and video models.
4. Use only advertised resolutions, ratios, material roles, reference limits, and guidance.

Do not maintain a model matrix in this Skill.

## Character Design Sheet

A character appearing in more than one segment needs one approved visual anchor. Generate it once through the host's approval-controlled generation flow, show it to the user, register it as a reusable material, and reuse the same material ID through an image-reference role supported by the selected video model.

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

Before generating:

- inspect the selected image model;
- present prompt, parameters, and estimate;
- wait for approval;
- record the returned task ID;
- show the result for approval;
- register the approved result once;
- inspect the selected video model before assigning its role.

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

For recurring locations, create an environment-only concept image that fixes layout, lighting, palette, and key props. Approve and register it once, then reuse the same material ID wherever that location returns.

## Continuity Routing

Never assume roles combine across models. Inspect live material roles and guidance first.

- Identity/product/location continuity: reuse the same approved material through a supported image role.
- Motion continuity: reuse a completed result only when the next model advertises a compatible video-reference capability.
- Exact opening-state continuity: use a dedicated media capability to extract the previous tail frame and attach it through an advertised frame role.
- If tail-frame extraction is unavailable, use an existing approved image reference and explicitly describe the opening composition; do not guess a local command.

Record the actual role and material ID chosen for every shot:

```text
Shot  Character anchor  Scene anchor  Previous result  Material roles
S1    #27               #91           —                <supported roles>
S2    #27               #92           #V1              <supported roles>
```

## Material Inventory

Inventory only references authorized by the current host. For every item capture:

```text
material ID
full server filename
kind
visual description
intended shots
advertised role
```

Do not require a directory scan, local upload script, or generated workspace file. Local CLI hosts may use the separate `renoise-cli` Skill for those operations.

## Storyboard Grid

For multi-segment visual review, create one grid after character sheets are approved. A shared canvas helps palette and styling stay coherent; split it into per-segment references only when the host exposes media editing and the selected video model supports the needed image role.

```text
Storyboard grid for "[TITLE]", [N] panels.
[PROJECT STYLE LINE]
[APPROVED CHARACTER BIBLE]
Panel 1: [key visual moment]
Panel 2: [key visual moment]
Consistent designs and palette. No labels.
```
