# seedance-2.0 Video Model Capabilities

Model reference only. For prompt writing guidance, see `Read ${CLAUDE_PLUGIN_ROOT}/skills/director/references/prompt-craft.md`.

## Model Specs

| Parameter | Value |
|-----------|-------|
| Model name | `seedance-2.0` |
| Min duration | 4 seconds |
| Max duration | 15 seconds |
| Duration options | Any integer from 4-15s |
| Resolution | `480p` / `720p` / `1080p` / `4k` (default `720p`) |
| Aspect ratio | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` |

## Model Reality Check

**The model generates continuous video — it is NOT a video editor.**

### What the model does well
- Smooth continuous camera movements (push in, pull back, orbit, track)
- Gradual transitions within a single shot (close-up drifting to medium)
- Consistent character appearance within one 15s generation
- Dialogue with visible mouth motion — **conditional** (see Lip-sync note below)
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

### Lip-sync — conditions and limits

The model generates spoken audio from the dialogue text in the prompt, and can drive mouth motion for it. It is **conditional, not guaranteed**:

**Applies when:**
- The dialogue line is written **verbatim in the spoken language the user confirmed** (the voice speaks whatever language the line text is in). This is a director-skill Hard Rule for any path with dialogue, and the standing rule for the commercial Scenario D (口播 / live-presenter) path.
- The line is short and the segment prompt's dominant language matches the dialogue language (a large opposite-language text block drags the speech off-language).
- The speaker's mouth is visible in frame ("mouth clearly visible when speaking").

**Limits (do not over-promise):**
- Mouth-shape and voice reliability are **not guaranteed** on pure text-to-video, especially for a dialogue line in a language different from the surrounding prompt. Do not claim frame-accurate "lip-sync aligned" output unconditionally.
- Best results come from short lines, one speaker at a time, and keeping the whole dialogue-dense segment in the spoken language.

## Input Types

### Text-to-Video — Recommended Default
- No materials needed, generate from prompt alone
- Most stable mode — no reference-image content review to worry about
- Suitable for: all scenarios

### Image-to-Video
- Material role: `ref_image`
- **Faces**: on the seedance series, a face image can be passed straight as `ref_image` — it is auto-facepassed on submit. On other video models a face may still be blocked by the provider's content review.
- Suitable for: product photos, landscapes, illustrations, and (on seedance) character faces

### Video-to-Video
- Material role: `ref_video`
- More expensive than T2V; on seedance, face content in the reference is auto-facepassed on submit
- Suitable for: motion transfer, style transfer

### Best Practices
Default to **Text-to-Video**. Only use reference materials for:
- Product photos → `ref_image`
- Abstract/landscape references → `ref_image`
- Precise motion replication → `ref_video`
- **Human faces (seedance)** → pass the face image directly as `ID:ref_image` and reuse the **same material ID** across segments for consistency (auto-facepassed on submit; face review can still reject a specific image). On non-seedance models, prefer switching to seedance or describing the character in text.

## Duration Strategy

For finished-cut workflows, prefer `--duration 15` when possible. Renoise/Seedance supports 4–15s segments; a 3-minute film at 15s per segment = 12 segments.

| | Single 15s | Stitched segments |
|---|---------|----------|
| Music/SFX | Natural, coherent flow | Fragmented, needs post-production BGM |
| Character consistency | Naturally consistent | Drifts between segments |
| Camera fluidity | Continuous movements | Each segment independent |
| Cost | 1 API call (cost via `credit estimate`) | N API calls |

Higher resolutions (`1080p`/`4k`) bill at different variant prices than `720p` — quote cost from `credit estimate` rather than assuming a flat rate.

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
renoise-cli.mjs task generate --model seedream-5-0-pro --resolution 2k --ratio 16:9 \
  --prompt "Concept art sheet for [project]. Key visual elements: [list]."
```

Upload and pass to every segment via `--materials "CONCEPT_ID:ref_image"`.

With ref_image, keep the text anchor minimal — the image already provides style context.

### Available anchors (combinable)

All `ref_*` anchors combine freely within multimodal reference mode. Pick per segment based on what needs to stay consistent. The exception is `ID:first_frame` (frame mode): it cannot be combined with any `ref_image` — which is why a carried-over opening frame defaults to riding as `ref_image:0` instead (see the routing section below).

| Anchor | Strength | What it locks |
|--------|----------|---------------|
| `FACE_MAT_ID:ref_image` (face image, seedance) | Strong | Face, body, wardrobe identity — reuse the same material ID across segments |
| Tail frame as `TAIL_ID:ref_image:0` + prompt opens "Use @Image1 as the first frame." | Strong (soft lock) | Opening composition/state — combines with the other refs here; the default when the segment carries any other `ref_image` |
| `ID:first_frame` (extracted tail frame) | Strong (hard lock) | Exact opening composition/state — **frame mode, cannot combine with any `ref_image`**; only for segments with no other image reference |
| `ID:ref_video` | Strong | Motion continuity from previous segment |
| `ID:ref_image` (concept art) | Medium | Environment, lighting, color palette |
| Text-only description | Weak | Nothing locked visually — model may drift |

More anchors = stronger consistency, but also longer generation time (8-12 min with multiple anchors vs 5-8 min with text-only). Decide based on what each segment actually needs — not every segment needs every anchor.

## Multi-Segment Continuity Routing

For sequential segments, choose the method based on the scene goal:

**Use the previous end frame as the next opening frame when:**
- The next segment must open on an exact carried-over pose/composition/state
- You need a clean visual handoff of gaze, props, or lighting
- The next segment can develop fresh motion after the opening frame

How to attach the end frame depends on what else the segment carries — frame mode (`first_frame`/`last_frame`) and reference mode (`ref_image`) are **mutually exclusive** on the seedance series (`gemini-omni-flash` is the only exception):

- **Segment carries any other `ref_image`** (character sheet, scene ref — the usual case) → attach the tail frame as `ID:ref_image:0` (the `:0` index makes it `@Image1`) and make the prompt's first sentence "Use @Image1 as the first frame." This is a **soft lock** — weaker than native `first_frame` — so pair it with an exact opening-state description, and fall back to a 0.3-0.5s cross-dissolve in post if a join still shows.
- **Segment has no other image reference** (e.g. pure landscape B-roll continuation) → native `ID:first_frame` (hard lock, no prompt declaration needed).

```bash
# Generate S1
renoise-cli.mjs task generate --prompt "<S1>" --duration 15 --ratio 16:9
# Extract a clean end frame for S2
ffmpeg -sseof -0.2 -i S1.mp4 -frames:v 1 -q:v 2 -y S1-end.jpg
# Upload S1 tail frame
renoise-cli.mjs material upload S1-end.jpg  # → MATERIAL_ID_1

# S2 default — segment also carries character/scene refs:
renoise-cli.mjs task generate \
  --prompt "Use @Image1 as the first frame. Continuing from the previous shot: <S2 new content>" \
  --duration 15 --ratio 16:9 \
  --materials "FACE_ID:ref_image,MATERIAL_ID_1:ref_image:0,SCENE_ID:ref_image"

# S2 fallback — no other image reference on this segment:
renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2 new content>" \
  --duration 15 --ratio 16:9 --materials "MATERIAL_ID_1:first_frame"
```

**Use `ref_video` when:**
- Motion/style carryover matters more than pinning the next opening frame
- The transition itself is dynamic and a single extracted still is not enough
- You want the prior segment's movement to influence the next one

When using `ref_video`, focus transition design on the last 2-3 seconds of each segment because the model physically continues from the prior clip. `ref_video` is reference mode — it combines freely with `ref_image` and is unaffected by the frame-mode exclusion.

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
