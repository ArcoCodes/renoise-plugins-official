# renoise-2.0 Video Model Capabilities

Model reference only. For prompt writing guidance, see `Read ${CLAUDE_SKILL_DIR}/references/prompt-writing.md`.

## Model Specs

| Parameter | Value |
|-----------|-------|
| Model name | `renoise-2.0` |
| Min duration | 5 seconds |
| Max duration | 15 seconds |
| Duration options | Any integer from 5-15s |
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

### What the model does poorly or cannot do
- **Hard cuts / jump cuts** — generates continuous flow, not edited footage
- **Shot-reverse-shot** — camera cannot teleport to a new angle mid-generation
- **Dolly zoom / vertigo effect** — too complex, produces artifacts
- **Whip pan with motion blur** — unpredictable results
- **Rapid montage of 5+ setups** — becomes incoherent mush
- **Precise slow-motion timing** — approximate at best
- **Complex multi-character choreography** — characters may merge or disappear
- **Reading/displaying text on screen** — unreliable
- **Maintaining exact face identity across separate generations** — always drifts

### The golden rule
**One mood, one scene, one continuous camera flow per 15s segment.**

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

All video generations use `--duration 15`. This is the fixed unit. A 3-minute film = 12 × 15s segments.

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
| `ID:ref_video` | Strong | Motion continuity from previous segment |
| `ID:ref_image` (concept art, no faces) | Medium | Environment, lighting, color palette |
| `--characters "ID"` | Strong | Face/body (platform characters) |
| Text-only description | Weak | Nothing locked visually — model may drift |

More anchors = stronger consistency, but also longer generation time (8-12 min with multiple anchors vs 5-8 min with text-only). Decide based on what each segment actually needs — not every segment needs every anchor.

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
