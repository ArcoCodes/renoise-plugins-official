# Video Editing Capabilities Guide

Seedance 2.0 offers three post-generation editing capabilities beyond raw generation: **Video Extension**, **Local Editing / Content Repaint**, and **First/Last Frame Control**. This guide covers when and how to use each.

> Cross-references:
> - Multi-reference guide: `Read ${CLAUDE_SKILL_DIR}/references/multi-reference-guide.md`
> - Continuity guide: `Read ${CLAUDE_SKILL_DIR}/references/continuity-guide.md`
> - Video capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
> - Retry strategies: `Read ${CLAUDE_SKILL_DIR}/references/retry-strategies.md`

---

## 1. Video Extension & Continuous Shot Bridging

### What It Does

Takes a completed 15s video and smoothly extends it by another 5-15 seconds, maintaining character appearance, scene, and visual style from the original.

### When to Use

| Scenario | Use Extension? | Why |
|----------|---------------|-----|
| Long dialogue in one location | ✅ Yes | Continuity and immersion matter |
| Slow emotional buildup | ✅ Yes | Gradual pacing needs seamless flow |
| Character walking a continuous path | ✅ Yes | Motion must be unbroken |
| Scene change (different location) | ❌ No | Use segment stitching instead |
| Fast action / chase sequence | ❌ No | Editorial cuts better serve the rhythm |
| Different time of day | ❌ No | Lighting change needs a clean break |

### Implementation

```bash
# Step 1: Generate the initial segment
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<S1 prompt>" --duration 15 --ratio 16:9

# Step 2: Download the result
curl -s -o S1.mp4 "<video_url>"

# Step 3: Upload as reference material
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload S1.mp4
# → Returns MATERIAL_ID

# Step 4: Generate extension
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "Smoothly extend @Video1 by 10 seconds. Maintain identical character appearance, background environment, lighting style, and visual quality from the previous segment. [New action description for the extended portion...]" \
  --materials "MATERIAL_ID:ref_video" --duration 15 --ratio 16:9
```

### Extension Prompt Template

```
Smoothly extend @Video1 forward in time. Maintain the following from the previous segment:
- Character appearance, clothing, and hairstyle: identical
- Background environment and props: identical
- Lighting direction, color temperature, and style: identical
- Visual quality and film texture: identical

[Extended content description]:
[15-20s] [New action continuing from where the previous segment ended]
[20-25s] [Further development]
[25-30s] [Conclusion of the extended sequence]

High-definition, rich detail, cinematic texture.
Face stable without deformation, motion natural and fluid, no flickering.
```

### Practical Limits

- **Best range**: Extending to 30-45 seconds total (2-3 chained segments)
- **Quality degrades beyond**: 3 chained extensions — accumulated drift becomes noticeable
- **If you need 60s+**: Switch to segment stitching with shared character assets

### Extension vs Stitching Decision Tree

```
Need continuous visual flow in one location?
  ├── YES → Does total duration ≤ 45s?
  │         ├── YES → Use Extension (chain 2-3 segments)
  │         └── NO  → Use Hybrid (extension blocks + stitching between)
  └── NO  → Use Segment Stitching (parallel generation, join in post)
```

---

## 2. Local Editing & Content Repaint

### What It Does

Modifies specific elements within an already-generated video while keeping everything else unchanged. This includes:
- **Character replacement**: Swap character A for character B
- **Prop/detail changes**: Change an object's color, add/remove items
- **Defect repair**: Fix occasional face deformation, limb distortion, or lighting glitches

### The Key: Bind Time + Space

You must tell the model **when** (time range) and **where** (spatial location in frame) to apply the edit. Vague instructions produce vague results.

### Implementation

```bash
# Upload the source video to edit
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload source-video.mp4
# → MATERIAL_ID

# Submit editing request
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<editing prompt>" \
  --materials "MATERIAL_ID:ref_video" --duration 15 --ratio 16:9
```

### Editing Prompt Templates

#### Template A: Color/Outfit Change

```
Based on @Video1, perform the following edit:
Throughout the entire 0-15s timeline, replace the protagonist's BLUE jacket
with a RED jacket of identical cut and style.

Preserve unchanged:
- Character's face, hairstyle, expression, and all movements
- Background environment, props, and lighting
- All other characters and their actions

The color transition must be natural with no flickering or edge artifacts.
Face stable without deformation, motion natural and fluid.
```

#### Template B: Character Replacement

```
Based on @Video1, perform the following edit:
Replace the male character on the LEFT side of frame with @Image1's character
throughout 0-15s.

The replacement character (@Image1) must:
- Match the original character's position, posture, and movements exactly
- Wear the clothing shown in @Image1
- Maintain natural facial expressions matching the scene context

Preserve unchanged:
- All other characters (do NOT modify anyone except the left-side male)
- Background, lighting, camera movement
- Audio and timing

Face stable without deformation, body proportions normal, no flickering.
```

#### Template C: Defect Repair

```
Based on @Video1, fix the following issue:
At approximately 7-9 seconds, the protagonist's left hand appears deformed
(extra fingers visible).

Repair the hand to show normal five-finger anatomy while maintaining
the same hand position and gesture.

All other elements (face, body, background, camera movement) must remain
completely unchanged.

Body proportions normal, no artifacts, motion natural and fluid.
```

### Editing Quality Tips

| Do | Don't |
|----|-------|
| Edit one element at a time | Try to change 5 things simultaneously |
| Specify exact time ranges | Say "throughout the video" for a 2s issue |
| Describe what stays the same | Only describe what changes (model may alter unlocked elements) |
| Use "preserve unchanged" blocks | Assume the model knows what you want to keep |
| Accept 80% accuracy | Expect pixel-perfect edits (this is AI, not manual compositing) |

### Editing Limitations

- **Works best for**: Isolated, clearly-bounded changes (one garment, one prop, one person)
- **Struggles with**: Overlapping changes, changes to fast-moving elements, changes that affect physics (removing a chair someone is sitting on)
- **Cannot do**: Add completely new camera movements, change the fundamental scene layout, add new characters that weren't in the original composition

---

## 3. VLM Reverse-Engineering Prompts

### What It Does

Uses a Vision-Language Model (VLM) to analyze an existing video or image and generate a structured prompt that could recreate it in Seedance 2.0.

### When to Use

- **Video-to-video workflow**: You have a reference video and want to recreate it with different characters
- **Style matching**: You want to capture the exact visual language of a reference
- **Learning**: Understand what makes a video work and translate that into prompt engineering

### Implementation

Use Gemini (or any VLM) to analyze the source material:

```bash
# Analyze a video and reverse-engineer a prompt
node ${CLAUDE_PLUGIN_ROOT}/skills/gemini-gen/scripts/gemini.mjs \
  --file reference-video.mp4 \
  --prompt "If I wanted to generate a video like this using an AI video model, help me reverse-engineer the prompt. Structure the output as:

1. GLOBAL SETTINGS
   - Scene attributes (location, set design, props)
   - Character descriptions (appearance, clothing, accessories)
   - Visual style (color grading, lighting, film texture)
   - Core theme/narrative

2. TIMELINE BREAKDOWN
   - 0-5s: [who + where + what action + camera movement]
   - 5-10s: [who + where + what action + camera movement]
   - 10-15s: [who + where + what action + camera movement]

3. CONSTRAINT CLAUSES
   - Camera constraints (fixed/moving, focus behavior)
   - Style consistency requirements
   - Motion/action logic requirements
   - Detail consistency (costumes, props, continuity)"
```

### VLM Prompt Template for Reverse-Engineering

```
Analyze this video/image. If I wanted to generate something very similar using Seedance 2.0, help me write the prompt.

Structure your response as:

## Global Settings
1. **Scene**: [precise description of location, architecture, set dressing, props]
2. **Characters**: [for each person: exact position, appearance, clothing with texture+cut+color, accessories, posture]
3. **Visual Style**: [color palette, saturation level, film texture, lighting direction and quality]
4. **Core Narrative**: [what story is being told in one sentence]

## Timeline Breakdown
- **0.0-5.0s**: [shot type + who + what action + camera movement + focus behavior]
- **5.0-10.0s**: [shot type + who + what action + camera movement + focus behavior]
- **10.0-15.0s**: [shot type + who + what action + camera movement + focus behavior]

## Constraint Clauses
1. **Camera**: [fixed/moving, focus transitions, lens behavior]
2. **Style Unity**: [what must stay consistent throughout]
3. **Motion Logic**: [what movements must look natural/realistic]
4. **Detail Consistency**: [what physical details must not change between frames]
```

### Preparing Reference Materials for Recreation

After VLM analysis, prepare materials for generation:

1. **Static frame references**: Use an image generation model (like Seedream 5.0 or nano-banana-2) to create character reference sheets based on the VLM description
2. **Pose/motion references**: Use pose extraction tools (sdpose, OpenPose) on the original video to create skeleton-only motion reference
3. **Scene references**: Extract key frames from the original and use as scene references (only if they don't contain faces)

### Full Recreation Workflow

```
Source Video
     │
     ├──→ VLM Analysis → Structured Prompt (Global + Timeline + Constraints)
     │
     ├──→ Pose Extraction → Skeleton reference video (motion only)
     │
     ├──→ Key Frame Extraction → Scene references (no faces)
     │
     └──→ Character Description → nano-banana-2 → New character sheets → asset register
                                                            │
                                                            ▼
                                               Seedance 2.0 Generation
                                        (structured prompt + all references)
```

---

## 4. Combined Editing Workflows

### Workflow A: Generate → Review → Fix

The most common editing workflow:

```
Generate initial video
     │
     ├── Quality OK → Keep
     │
     └── Issue found → Diagnose
              │
              ├── Face deformation at 7s → Local Edit (defect repair)
              ├── Wrong outfit color → Local Edit (color change)
              ├── Scene too short → Video Extension
              ├── Whole thing wrong → Regenerate with simplified prompt
              └── 80% good, 20% drift → Accept + post-production color grade
```

### Workflow B: Iterative Refinement

For high-stakes content (commercial, brand film):

```
Round 1: Generate base video with full references
Round 2: Fix character issues with local editing
Round 3: Extend if needed for pacing
Round 4: Final quality pass — color grade + audio in post
```

### Cost-Benefit of Editing vs Regeneration

| Approach | Cost | Time | Quality |
|----------|------|------|---------|
| Local edit (fix one issue) | ~300 credits | ~8 min | High if issue is isolated |
| Full regeneration (simplified prompt) | ~300 credits | ~8 min | Varies — might be better or worse |
| Video extension | ~300 credits | ~8 min | Good for continuity |
| Post-production fix (color grade, crop) | 0 credits | ~5 min | Good for minor issues |

**Rule of thumb**: If the issue is in one small area (a hand, a garment color), try local editing first. If the fundamental composition or action is wrong, regenerate.

---

## Checklist: Editing Decision Guide

- [ ] Is the issue localized (one element, one time range)? → **Local Edit**
- [ ] Is the video 80%+ good and just needs more length? → **Video Extension**
- [ ] Is the overall composition/action fundamentally wrong? → **Regenerate** (simplify prompt)
- [ ] Are the colors/lighting just slightly off? → **Post-production** (DaVinci/Premiere)
- [ ] Do you need to recreate a reference video with different characters? → **VLM Reverse-Engineer → New Generation**
