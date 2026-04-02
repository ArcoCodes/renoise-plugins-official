# Multi-Reference Material Guide

How to use multiple reference materials (images, videos, audio) simultaneously for maximum control in Seedance 2.0.

> Cross-references:
> - Visual development: `Read ${CLAUDE_SKILL_DIR}/references/visual-development.md`
> - Continuity: `Read ${CLAUDE_SKILL_DIR}/references/continuity-guide.md`
> - Video capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`

---

## Core Concept: 4 Functional Roles

Every reference material serves one of four functional roles. Assigning clear roles prevents the model from guessing — which dramatically increases success rate.

| Role | Purpose | Typical Source |
|------|---------|---------------|
| **Character Anchor** | Lock character appearance (face, build, clothing) | Character design sheet → User Asset |
| **Scene Setting** | Lock environment style, architecture, color palette | Scene reference image (no faces) |
| **Motion Reference** | Lock camera movement, action rhythm, choreography | Reference video clip |
| **Mood/Rhythm** | Control emotional pacing, audio sync | Audio track, BGM |

### Material Count Strategy

**Do NOT use the maximum number of materials.** Too many references confuse the model's priority ranking.

| Recommended Configuration | Materials |
|---------------------------|-----------|
| Standard (most scenes) | 1-2 character refs + 1 scene ref = 2-3 total |
| Full control | 1-2 character refs + 1 scene ref + 1 motion video + 1 audio = 4-5 total |
| Maximum safe | 5 materials total — going above this risks priority confusion |

---

## @ Syntax: Declaring Material Roles

When using multiple materials, you MUST explicitly declare each material's role in the prompt text. Without this, the model guesses — and guesses wrong.

### Basic Declaration (Required)

Always include a declaration block at the start of your prompt:

```
@Image1 serves as the character reference for the protagonist.
@Image2 serves as the scene/environment reference.
@Video1 provides camera movement and action rhythm reference.
@Audio1 provides background music and emotional pacing.
```

In CLI terms, this maps to:
```bash
--materials "asset:27:reference_image,53:ref_image,88:ref_video"
```

The text declaration tells the model what each material IS FOR. The CLI flag tells the API how to send the data.

### Advanced Declaration (Time-Bound)

For precise control, bind materials to specific time segments:

```
@Image1 is the protagonist's appearance reference.
0-3s: The protagonist (@Image1) stands with back to camera, camera slowly orbits around.
3-8s: The protagonist turns to face camera, using @Video1's camera pan technique.
8-15s: Camera rapidly pulls in for close-up, synced to @Audio1's drum beat at 8.5s.
```

### Multi-Character Declaration (Critical for Avoiding Confusion)

When multiple characters appear, you MUST explicitly map each material to its character:

```
BAD (ambiguous):
"@Image1 and @Image2 are character references. The woman looks at the man."
→ Model doesn't know which image is which character.

GOOD (explicit mapping):
"@Image1 is the female protagonist (the woman in red dress).
 @Image2 is the male antagonist (the man in black suit).
 In the scene, the woman from @Image1 turns to face the man from @Image2."
```

**Critical Rule**: When there are multiple characters or images, you MUST specify the correspondence. For example:
```
@Image1 is Li Wei (male lead), @Image2 is Su Ting (female lead).
@Video1 is used ONLY for learning camera movement patterns — do NOT copy the characters or scene from it.
```

---

## Character Consistency Across Multiple Shots

### Single-Segment Consistency

Within one generation, maintain consistency by:
1. Always referencing the same character asset: `--materials "asset:27:reference_image"`
2. Keeping the text description identical (full Character Bible verbatim)
3. Adding: "Based on @Image1, maintain consistent character appearance, clothing, and hairstyle."

### Cross-Segment Consistency (Videos > 15s)

Two strategies for videos longer than a single 15s generation:

#### Strategy A: Video Extension (for continuous scenes)

Use the output of the previous segment as input for the next:

```bash
# Generate segment 1
node renoise-cli.mjs task generate --prompt "<S1>" --materials "asset:27:reference_image" --duration 15

# Download S1 result, upload as material
curl -o S1.mp4 "<url>"
node renoise-cli.mjs material upload S1.mp4  # → MATERIAL_ID

# Extend: use S1 as ref_video for S2
node renoise-cli.mjs task generate \
  --prompt "Extend @Video1 smoothly by 10 seconds. Maintain identical character appearance, background lighting, and style from the previous segment." \
  --materials "MATERIAL_ID:ref_video" --duration 15
```

**Best for**: Dialogue scenes, slow emotional buildup, continuous single-location action (character walking across a room).

#### Strategy B: Segment Stitching (for scene changes or fast action)

Generate each segment independently with the same character assets, then join in post:

```bash
# Each segment uses the same asset references
for each segment:
  node renoise-cli.mjs task generate \
    --prompt "<segment prompt>" \
    --materials "asset:27:reference_image" --duration 15
```

**Best for**: Chase sequences, montages, scene changes, action-heavy content requiring editorial rhythm.

#### When to Use Which

| Scenario | Strategy | Why |
|----------|----------|-----|
| Slow dialogue, emotional buildup | **Extension** | Immersion and visual continuity matter most |
| Same location, continuous movement | **Extension** | The model needs to see where the previous shot ended |
| Scene change / location switch | **Stitching** | No visual continuity needed between locations |
| Fast action, chase, fight | **Stitching** | Editorial rhythm and quick cuts matter more |
| 30-45s total | **Extension** (up to 3 segments chained) | Still manageable continuity |
| 60s+ total | **Hybrid** — extension within blocks, stitching between blocks | Balance quality and speed |

---

## Material Roles & Their CLI Mapping

| Functional Role | CLI Materials Flag | Prompt Declaration |
|----------------|-------------------|-------------------|
| Character face anchor | `asset:ID:reference_image` | "@ImageN is [character name], maintaining their appearance" |
| Character (from library) | `--characters "ID"` | (automatic, no text needed) |
| Scene environment | `ID:ref_image` | "@ImageN serves as scene/environment reference" |
| First frame pin | `ID:first_frame` | "@ImageN is the opening frame" |
| Last frame pin | `ID:last_frame` | "@ImageN is the closing frame" |
| Motion reference | `ID:ref_video` | "@VideoN provides camera and action reference only" |
| Style anchor | `ID:ref_image` | "@ImageN defines the overall visual style" |

### Input Mode Constraints (CRITICAL)

Three mutually exclusive input modes — **cannot mix**:

1. **First frame only**: one `first_frame` material
2. **First + last frame**: one `first_frame` + one `last_frame`
3. **Multimodal reference**: any combination of `ref_image` (1-9), `ref_video` (0-3), `reference_image`, audio (0-3)

You **cannot** use `first_frame` and `ref_image` in the same generation.

---

## First/Last Frame Control

Precise control over video start and end frames elevates "cinematic feel" dramatically.

### First Frame Constraint

Pin the opening frame to match a reference image exactly:

```bash
node renoise-cli.mjs material upload opening-composition.png  # → ID 55
node renoise-cli.mjs task generate \
  --prompt "Starting from this exact composition, the character slowly turns..." \
  --materials "55:first_frame" --duration 15
```

**Use cases**:
- Series consistency: every episode opens with the same establishing shot
- Style anchoring: force the first frame to match a specific art direction
- Character pose: start from a precise character position

### Last Frame Constraint

Pin the ending frame for a designed closing shot:

```bash
node renoise-cli.mjs material upload cliffhanger-frame.png  # → ID 56
node renoise-cli.mjs task generate \
  --prompt "...action builds to a dramatic pause." \
  --materials "56:last_frame" --duration 15
```

**Use cases**:
- Cliffhanger endings: design the final image for maximum suspense
- Smooth transitions: make the last frame match the next segment's first frame
- Loop-ready content: last frame matches first frame for seamless looping

### Combined First + Last Frame

Control both endpoints — the model generates the transition between them:

```bash
node renoise-cli.mjs task generate \
  --prompt "Smooth cinematic transition from dawn to sunset over the city skyline." \
  --materials "55:first_frame,56:last_frame" --duration 15
```

### Combining with Multi-Reference

First/last frame mode is mutually exclusive with `ref_image`. If you need both style reference AND frame control:

1. Describe the style entirely in text (no `ref_image`)
2. Use `first_frame` / `last_frame` for the frame constraints
3. Use `--materials "asset:ID:reference_image"` for character face anchoring (this IS compatible with first/last frame mode in multimodal reference mode — check API docs)

**OR**: Use multimodal reference mode with the reference images, and describe the desired first/last frame composition in text:
```
[0-2s] Open on the exact composition from @Image2 — wide establishing shot...
[13-15s] End on a frame matching @Image3 — close-up of the watch, frame holds steady.
```

---

## Motion/Video Reference Best Practices

When using a video as motion reference:

### Explicitly Separate Content from Technique

```
@Video1 is for camera movement and action rhythm ONLY.
Do NOT copy the characters, costumes, or environment from @Video1.
The characters should follow @Image1 (protagonist) and @Image2 (antagonist).
The environment should follow @Image3 (scene reference).
```

### What the Model Extracts from ref_video

| Extracted (reliable) | Not Extracted (unreliable) |
|---------------------|--------------------------|
| Camera movement pattern | Exact character faces |
| Movement speed/rhythm | Specific environment details |
| Action choreography | Color grading |
| Spatial composition | Text/UI overlays |

### Pose Reference Videos

For precise pose/action replication, prepare a pose-skeleton video (using tools like sdpose or OpenPose) from the original footage, and use that as `ref_video` instead of the raw footage. This isolates the motion data from visual content.

---

## Audio Reference

Audio materials control the overall emotional pacing and rhythm:

```bash
node renoise-cli.mjs material upload bgm-track.mp3  # → ID 77
node renoise-cli.mjs task generate \
  --prompt "@Audio1 provides the background music. Sync key visual moments to the beat drops." \
  --materials "77:ref_audio" --duration 15
```

### What Audio Controls

- Overall emotional mood
- Pacing rhythm (fast cuts on beat drops, slow moments on quiet sections)
- Intensity curve over the segment duration

### Audio + Visual Sync Tips

```
0-5s: Character walks slowly, matching @Audio1's gentle piano intro.
5-10s: @Audio1's drum pattern kicks in — camera movement accelerates, character breaks into a run.
10-15s: @Audio1 reaches its peak — wide shot reveal of the landscape, maximum visual intensity.
```

---

## Complete Multi-Reference Prompt Example

### Urban Drama Scene with Full Reference Stack

**Materials prepared**:
- Image 1 (asset:27): Female lead character design sheet
- Image 2 (material:53): City street scene reference (no faces)
- Video 1 (material:88): Walking/tracking camera reference
- Audio 1 (material:77): Ambient city sounds + lo-fi beat

**Prompt**:
```
@Image1 (asset:27) is the protagonist's appearance reference.
@Image2 (material:53) sets the urban street environment and color palette.
@Video1 (material:88) provides the walking pace and tracking camera movement — do NOT copy its characters or setting.
@Audio1 (material:77) provides atmospheric rhythm.

0-5s: Evening, the protagonist (@Image1) walks slowly along the rain-wet street (@Image2 environment), camera tracking alongside at medium distance. Her cream-colored coat catches the neon reflections. She glances at her phone, expression shifting from neutral to concerned.

5-10s: She stops walking, lowers the phone. Camera slowly pushes in from medium to close-up. Her lips tighten, eyes narrow — processing bad news. Rain droplets catch the streetlight on her shoulders.

10-15s: She pockets the phone, turns sharply, and walks in the opposite direction with purpose. Camera holds for a beat, then follows with a smooth tracking pan. Her coat sweeps behind her. Frame settles on her determined silhouette against the neon-lit street.

High-definition, rich detail, cinematic texture, natural color, soft lighting.
Face stable without deformation, facial features clear, body proportions normal,
motion natural and fluid, no stiffness, no frame stuttering, no flickering.
No text, subtitles, watermarks, or logos.
```

**CLI**:
```bash
node renoise-cli.mjs task generate \
  --prompt "<above prompt>" \
  --materials "asset:27:reference_image,53:ref_image,88:ref_video" \
  --duration 15 --ratio 16:9
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Not declaring material roles in prompt text | Always start with explicit "@ImageN is for [purpose]" declarations |
| Using too many materials (6+) | Keep to 4-5 max; model can't prioritize beyond that |
| Mixing first_frame with ref_image mode | Choose one input mode; use text to describe what you'd do with the other |
| Not specifying character-to-image mapping | For multi-character: "@Image1 is [name], @Image2 is [name]" explicitly |
| Using ref_video and expecting exact faces | ref_video transfers motion, not identity — use asset:ID for faces |
| Passing face photos as ref_image | Register as User Asset first → `asset register` → use `asset:ID:reference_image` |
