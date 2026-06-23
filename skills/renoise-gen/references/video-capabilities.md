# renoise-2.0 Video Model Capabilities

Model reference only. For prompt writing guidance, see `Read ${CLAUDE_SKILL_DIR}/references/prompt-writing.md`.

## Model Specs

| Parameter | Value |
|-----------|-------|
| Model name | `renoise-2.0` |
| Min duration | 4 seconds |
| Max duration | 15 seconds |
| Duration options | Any integer from 4-15s |
| Resolution | Up to 1080p |
| Aspect ratio | `1:1`, `16:9`, `9:16` |

## Model Reality Check

**The model generates continuous video — it is NOT a video editor.**

### What the model does well
- Smooth continuous camera movements (push in, pull back, orbit, track)
- Gradual transitions within a single shot (close-up drifting to medium)
- Consistent character appearance within one 15s generation
- Lip-sync dialogue in multiple languages when using the exact embedding format
- Atmospheric scenes with clear mood (one mood per segment)
- Simple cause-and-effect actions (hand picks up cup, person walks forward)
- **Multi-stage visual flow in a single prompt** — the model can handle a prompt that describes multiple sequential visual stages (e.g., wide landscape → character walking → product close-up) as long as they are written as a continuous narrative. The model renders these as smooth flowing transitions, not hard cuts. This is the preferred approach for ≤15s TVC/brand films, as it produces coherent audio throughout.

### What the model does poorly or cannot do
- **Hard cuts / jump cuts** — generates continuous flow, not edited footage. However, describing multiple visual stages as a flowing narrative IS supported (see above).
- **Shot-reverse-shot** — camera cannot teleport to a new angle mid-generation
- **Dolly zoom / vertigo effect** — too complex, produces artifacts
- **Whip pan with motion blur** — unpredictable results
- **Rapid montage of 5+ setups** — becomes incoherent mush
- **Precise slow-motion timing** — approximate at best
- **Complex multi-character choreography** — characters may merge or disappear
- **Reading/displaying text on screen** — unreliable
- **Maintaining exact face identity across separate generations** — always drifts

### The golden rule
**One unified mood and coherent audio per segment.** Within a single generation (up to 15s), the model can flow through multiple visual stages and camera compositions — what it cannot do is hard-cut between disconnected scenes. Describe visual transitions as a continuous journey, and provide a unified audio direction that spans the entire segment with optional per-stage audio accents.

## Input Types

### Text-to-Video — Recommended Default
- No materials needed, generate from prompt alone
- Most stable mode, not subject to privacy detection
- Suitable for: all scenarios

### Image-to-Video
- Material role: `ref_image`
- **⚠️ Privacy detection**: Images with realistic human faces are often blocked (`PrivacyInformation` error)
- Suitable for: product photos (no faces), landscapes, illustrations

### Video-to-Video
- Material role: `ref_video`
- **⚠️ Same privacy limitation**, more expensive
- Suitable for: motion transfer, style transfer (face-free materials)

### Best Practices
Default to **Text-to-Video**. Only use reference materials for:
- Pure product photos (no faces) → `ref_image`
- Abstract/landscape references → `ref_image`
- Precise motion replication (no faces) → `ref_video`
- **Human faces → Character Library** (`--characters "ID"`) or **User Assets** (`asset register`). **Do NOT** pass face images as `ref_image`.

## Duration Strategy

For finished-cut workflows, prefer `--duration 15` when possible. Renoise/Seedance supports 4–15s segments; a 3-minute film at 15s per segment = 12 segments.

| | Single 15s | Stitched segments |
|---|---------|----------|
| Music/SFX | Natural, coherent flow | Fragmented, needs post-production BGM |
| Character consistency | Naturally consistent | Drifts between segments |
| Camera fluidity | Continuous movements | Each segment independent |
| Cost | 1 API call (300 credits) | N API calls |

## Camera Movement Reliability

| Movement | Reliability | Notes |
|----------|-------------|-------|
| Slow push in / dolly in | ★★★ | Most reliable. Default for emotional scenes |
| Pull back / reveal | ★★★ | Great for establishing shots |
| Smooth orbit | ★★★ | Excellent for product showcase |
| Tracking alongside subject | ★★★ | Works well with clear linear motion |
| Tilt up / tilt down | ★★★ | Simple, effective reveals |
| Static / locked-off | ★★★ | Reliable for held moments |
| Crane up (rising) | ★★☆ | Usually works, sometimes jerky |
| Handheld feel | ★★☆ | Adds texture, can be excessive |
| Slow motion | ★★☆ | Approximate, not frame-accurate |
| Low angle / worm's eye | ★★☆ | Works for static setups |
| Overhead / bird's eye | ★★☆ | Works for static scenes |
| Whip pan | ★☆☆ | Unpredictable |
| Dolly zoom / vertigo | ★☆☆ | Rarely executes correctly |
| Rack focus | ★☆☆ | Model doesn't reliably control focus |
| Dutch angle | ★☆☆ | Often ignored |

**Stick to ★★★ and ★★☆.** Only use ★☆☆ if willing to re-generate.

## Visual Consistency

### Visual Anchor — Style vs Mood

**What goes in the anchor (same for every segment):**
- Film texture: `cinematic, shallow depth of field, film grain`
- Art style: `historical period drama` or `3D CG animation`

**What does NOT go in the anchor:**
- Color mood that changes between scenes (warm/cold)
- Emotional tone, weather, time of day
- Scene-specific details

```
GOOD: Cinematic period drama, shallow depth of field, film grain.
BAD:  Warm amber tones shifting to cold blue-grey, cinematic, tense atmosphere.
```

Scene-specific mood goes in the time segments, not the anchor.

### Concept Art as ref_image

```bash
renoise-cli.mjs task generate --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "Concept art sheet for [project]. Key visual elements: [list]."
```

Upload and pass to every segment via `--materials "CONCEPT_ID:ref_image"`.

With ref_image, keep the text anchor minimal — the image already provides style context.

### Available anchors (combinable)

These combine freely within multimodal reference mode. Pick per segment based on what needs to stay consistent.

| Anchor | Strength | What it locks |
|--------|----------|---------------|
| `asset:ID:reference_image` | Strong | Face, body, wardrobe identity |
| `ID:first_frame` (extracted tail frame) | Strong | Exact opening composition/state of the next segment |
| `ID:ref_video` | Strong | Motion continuity from previous segment |
| `ID:ref_image` (concept art, no faces) | Medium | Environment, lighting, color palette |
| `--characters "ID"` | Strong | Face/body (platform characters) |
| Text-only description | Weak | Nothing locked visually — model may drift |

More anchors = stronger consistency, but also longer generation time (8-12 min with multiple anchors vs 5-8 min with text-only). Decide based on what each segment actually needs — not every segment needs every anchor.

## Multi-Segment Continuity Routing

For sequential segments, choose the method based on the scene goal:

**Use previous end frame → next `first_frame` when:**
- The next segment must open on an exact carried-over pose/composition/state
- You need a clean visual handoff of gaze, props, or lighting
- The next segment can develop fresh motion after the opening frame

```bash
# Generate S1
renoise-cli.mjs task generate --prompt "<S1>" --duration 15 --ratio 16:9
# Extract a clean end frame for S2
ffmpeg -sseof -0.2 -i S1.mp4 -frames:v 1 -q:v 2 -y S1-end.jpg
# Upload S1 tail frame
renoise-cli.mjs material upload S1-end.jpg  # → MATERIAL_ID_1
# S2
renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2 new content>" \
  --duration 15 --ratio 16:9 --materials "MATERIAL_ID_1:first_frame"
```

**Use `ref_video` when:**
- Motion/style carryover matters more than pinning the next opening frame
- The transition itself is dynamic and a single extracted still is not enough
- You want the prior segment's movement to influence the next one

When using `ref_video`, focus transition design on the last 2-3 seconds of each segment because the model physically continues from the prior clip.

## Style Keywords Cheat Sheet

| Category | Example Keywords |
|----------|-----------------|
| Film stock | Kodak Vision3 500T, Fuji Eterna, ARRI LogC, 16mm grain, 35mm anamorphic |
| Black levels | lifted blacks, crushed blacks, milky shadows, deep true blacks |
| Color tone | warm golden palette, desaturated blue-grey, cool undertone in shadows, warm highlights |
| Saturation | desaturated midtones, muted earth tones, oversaturated pop, selective color |
| Lighting | golden hour, rim light, volumetric light, natural diffused, motivated practicals |
| Style | documentary, vlog, commercial, Hollywood blockbuster, indie film |
| Animation | 3D CG animation, cel-shaded anime, ink wash painting, pixel art |

**Locking a visual look** — be specific about all four layers:
```
Kodak Vision3 film texture, lifted blacks, cool blue undertone in shadows,
desaturated midtones, warm amber highlights.
```

## Technical Parameters — API vs Prompt

**DO NOT put in prompt** (use API params): aspect ratio, frame rate, resolution, duration
**DO put in prompt** (visual style): color palette, DOF, film texture, lighting mood
