# Stage 4: STORYBOARD — Per-Shot Keyframe Development

STORYBOARD comes after DESIGN and before GENERATE.

Goal: generate visual keyframes for every shot based on the confirmed script + confirmed design assets. Each shot gets 2-3 keyframe variants. The user selects the best composition for each shot. Selected keyframes become the **visual contract** for video generation — they define exactly what each shot should look like.

> Cross-references:
> - Confirmed designs: from DESIGN stage output
> - Approved script: from SCRIPT stage output
> - Model capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
> - DAG schema (variant_groups, keyframe chain): `Read ${CLAUDE_SKILL_DIR}/references/production-plan-schema.md`

---

## Stage Contract

### Required Inputs
- Confirmed character designs with registered assets (from DESIGN)
- Confirmed scene/environment designs (from DESIGN)
- Confirmed style concept art (from DESIGN)
- Approved script with segment table, shot descriptions, camera notes (from SCRIPT)
- Continuity strategy table (from SCRIPT)

### Required Outputs
- **One confirmed keyframe per shot** (selected from 2-3 variants)
- Keyframe chain edges established (selected keyframes feed the next shot's generation)
- Complete shot → anchor mapping (keyframe + character asset + scene ref + style anchor per shot)
- Variant group records for all keyframe groups in project.json

### Blocking Conditions
- SCRIPT gate must be passed
- DESIGN gate must be passed
- All character assets must be registered
- Style concept art must be confirmed

---

## Why Storyboard Variants Matter

A keyframe is not just a "nice to have reference image." It is the **visual contract** between what the user expects and what the video model will produce:

| Without storyboard | With storyboard |
|--------------------|-----------------| 
| User imagines a composition | User **sees** the composition before video gen |
| Prompt text is the only guide | Prompt + keyframe ref_image guide together |
| Discover composition issues at ~200 credits/shot | Discover at ~8 credits/shot |
| No visual approval before expensive generation | Explicit approval checkpoint |

**Cost math**: 2 keyframe variants per shot × 4 shots × ~8 credits = ~64 credits. One bad video redo = ~200 credits. The storyboard pays for itself if it prevents even one redo.

---

## Step 1: Plan Keyframe Prompts

For each shot in the script, assemble a keyframe prompt from confirmed assets:

| Component | Source |
|-----------|--------|
| Character description | SCRIPT character bible (verbatim) |
| Wardrobe | SCRIPT character bible |
| Scene/environment | SCRIPT scene description + confirmed DESIGN scene ref |
| Action/pose | SCRIPT shot action description |
| Camera framing | SCRIPT camera notes |
| Style keywords | Confirmed style concept art description |
| Lighting | SCRIPT + DESIGN style direction |

### Prompt Assembly Pattern

```text
[CHARACTER DESCRIPTION — full, from character bible]
[WARDROBE — full]
[ACTION/POSE from shot description]
[ENVIRONMENT from scene description]
[CAMERA FRAMING]
[STYLE KEYWORDS from concept art]
[LIGHTING]
Cinematic keyframe composition. No text, watermarks, or logos.
```

### Variant Differentiation for Keyframes

Keep the **story content** identical across variants. Vary the **composition**:

| Shared (same in all variants) | Varied (different per variant) |
|-------------------------------|-------------------------------|
| Character identity + wardrobe | Camera angle (medium vs close-up) |
| Core action/pose | Character position in frame |
| Environment | Moment within the action (start vs peak vs end) |
| Lighting mood | Depth of field emphasis |

---

## Step 2: Generate Keyframe Variants — Chained

Keyframes are generated in a **chain with variants** pattern. The chain maintains visual consistency across shots; the variants give the user composition choices.

### Chain Logic

```
Shot 1: Generate 2-3 variants (parallel, no ref_image input — first in chain)
         ↓ user picks one
Shot 2: Generate 2-3 variants (parallel, ALL using selected S1 keyframe as ref_image)
         ↓ user picks one
Shot 3: Generate 2-3 variants (parallel, ALL using selected S2 keyframe as ref_image)
         ↓ ...
```

```
[kf_S1_v1]
[kf_S1_v2] → user picks v2 → [kf_S2_v1 (ref: S1_v2)]
[kf_S1_v3]                    [kf_S2_v2 (ref: S1_v2)] → user picks v1 → ...
                               [kf_S2_v3 (ref: S1_v2)]
```

**Why chain?** The ref_image input makes nano-banana-2 preserve subject identity (face, clothing, colors, textures) from the previous keyframe. Without chaining, each shot's keyframes would drift independently.

### Parallel-Safe Exception

Shots that are in **different locations with different characters** can have their keyframe chains run in parallel, since visual continuity between them doesn't matter.

Example:
- S1 (hallway, Maya) and S5 (office, Boss) → parallel chains
- S2, S3, S4 (all living room, Maya) → must be sequential chain

### CLI for Keyframe Generation

**First shot in chain** (no ref_image):
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio <project-ratio> \
  --prompt "<keyframe prompt>" --tags "<project>,kf-s1,v1"
```

**Subsequent shots in chain** (ref_image from selected previous keyframe):
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio <project-ratio> \
  --prompt "Same character from the reference image. <new scene/action/camera>" \
  --materials "MATERIAL_ID_OF_SELECTED_PREV_KF:ref_image" \
  --tags "<project>,kf-s2,v1"
```

---

## Step 3: User Selection Per Shot

After each shot's keyframe variants are generated:

1. Download all variant images
2. Present side by side to user:

> "Here are 2 keyframe variants for Shot 1 — Hallway Discovery:"
>
> - **v1**: Medium tracking shot, Maya walking toward door
> - **v2**: Medium close-up, Maya kneeling and picking up package
>
> "Which composition do you prefer for this shot?"

3. User selects → mark selected/rejected → proceed to next shot's variants

### If No Variant Satisfies

The user can:
- **Request regeneration** with adjusted prompt (add to the existing variant group, bump `variant_count`)
- **Provide direction** ("make it more close-up" / "I want her standing, not kneeling")
- The new variants are added to the same variant group as additional candidates

---

## Step 4: Wire Keyframes into DAG

After each keyframe selection:

1. Set `variant_group.selected` to the chosen node ID
2. Mark winner `status: "selected"`, others `status: "rejected"`
3. Download selected keyframe image → upload as material → get `material_id`
4. Wire: selected keyframe → corresponding video node as `ref_image`
5. Wire: selected keyframe → next shot's variant generation as `ref_image` (chain input)

After ALL keyframe selections:

1. Verify complete shot → anchor mapping:

```text
| Shot | Style Anchor | Human Anchor | Environment Anchor | Keyframe | Continuity |
|------|-------------|-------------|-------------------|----------|------------|
| S1 | concept_v1 | asset:maya | mat:hallway | kf_S1_v2 | establish |
| S2 | concept_v1 | asset:maya | scene:room_v1 | kf_S2_v1 | parallel |
| S3 | concept_v1 | asset:maya | scene:room_v1 | kf_S3_v2 | serial (ref_video from S2) |
| S4 | concept_v1 | asset:maya | scene:room_v1 | kf_S4_v1 | serial (ref_video from S3) |
```

2. Update `project.json`
3. Regenerate canvas

---

## Mode-Specific Behavior

| Mode | STORYBOARD Behavior |
|------|-------------------|
| **A** (Quick) | **Skip entirely** — single shot, no storyboard needed |
| **B** (E-com) | **Optional** — useful for multi-scene e-com; skip for single product showcase |
| **C** (Original) | **Full storyboard** with keyframe chain + variants |
| **D** (Adaptation) | **Full storyboard** — especially valuable since source material sets visual expectations |
| **E** (Montage) | **Full storyboard** — composition is everything in montage work |

---

## Gate: User Confirmation

Present the complete storyboard — all selected keyframes in sequence:

```md
## Storyboard Summary

S1 — Hallway Discovery: [keyframe v2 selected]
  ↓ (parallel transition to S2)
S2 — Unwrapping: [keyframe v1 selected]
  ↓ (serial ref_video → S3)
S3 — Awakening: [keyframe v2 selected]
  ↓ (serial ref_video → S4)
S4 — Wonder: [keyframe v1 selected]

Shot → Anchor Mapping: all shots fully anchored
Total storyboard cost: 48 credits (8 keyframe variants × ~6 credits)

Ready to proceed to GENERATE?
```

Set `project.stage_gates.storyboard = true` → proceed to GENERATE.

---

## Checklist Before Proceeding

### Blocking
- [ ] Every shot has one confirmed keyframe
- [ ] Keyframe chain is intact (each shot's keyframe was generated with the previous shot's selected keyframe as ref_image, where applicable)
- [ ] All keyframe variant groups have `selected` set
- [ ] Shot → anchor mapping is complete (style + human + environment + keyframe per shot)
- [ ] All keyframe → video node edges are wired
- [ ] Budget for STORYBOARD phase is within estimates

### Warning (flag but don't block)
- [ ] Any shot with zero keyframe variants generated
- [ ] Chain broken (shot N+1 variants not generated with shot N selected keyframe as ref_image)
- [ ] Estimated total (DESIGN + STORYBOARD + GENERATE) exceeds 80% of available credits
