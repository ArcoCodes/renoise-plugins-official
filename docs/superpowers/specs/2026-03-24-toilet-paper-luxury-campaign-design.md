# Toilet Paper Luxury Campaign — "The Unveiling"

**Date:** 2026-03-24
**Type:** AI Video Production — Hermès-style luxury campaign
**Product:** Roll of toilet paper (product image provided)
**Tagline:** Softness. Redefined.

## Creative Concept

A 30-second cinematic fashion film that treats a roll of toilet paper with the absolute sincerity and reverence of a Hermès leather goods campaign. Studio minimalism — no context, no apology. The mundane product on a marble pedestal, lit and shot like a $10,000 handbag. The contrast between object and treatment IS the concept.

## Visual Identity

- **Setting:** Infinite cream/white studio backdrop, single Carrara marble plinth
- **Lighting:** Single warm directional source (above-left), deep shadows, shallow depth of field
- **Color palette:** White, cream, warm gold light, deep shadow
- **Typography:** White serif text on black for tagline (Hermès editorial style)
- **Music:** Sparse piano + gentle strings, classical luxury. Resolves on final chord at tagline.

## Structure

Two 15-second segments chained via ref_video for visual continuity.

### Segment 1 — "Reverence" (15s)

| Time | Shot | Camera | Description |
|------|------|--------|-------------|
| [0-3s] | Wide → Medium | Slow dolly push-in | Pure black frame. A single warm shaft of light fades in, revealing a white toilet paper roll resting on a raw Carrara marble plinth against an infinite cream backdrop. Piano: single sustained note. |
| [3-8s] | Extreme close-up | Slow tracking left | Macro on the embossed diamond texture of the paper surface. Shallow depth of field. The texture reads like fine leather grain. Light catches each ridge. Strings enter softly. |
| [8-15s] | Medium close-up | Static with subtle breathing | A hand in a white cotton glove enters frame from the right, gently rotates the roll a quarter turn on the marble. The gesture is deliberate, curatorial — like positioning a sculpture. Piano motif begins. |

**Energy:** Hushed, reverent, slow. Every frame earns its time.

### Segment 2 — "The Float" (15s)

| Time | Shot | Camera | Description |
|------|------|--------|-------------|
| [0-5s] | Close-up → Medium | Slow tracking descent | A single sheet of paper separates and floats downward through the air in slow motion, catching the light like silk chiffon. It twists gently. Strings swell. |
| [5-10s] | Wide hero shot | Slow push-in | The roll sits centered on the marble plinth. Perfect symmetry. Warm directional light from above left. Deep shadows. Negative space dominates the frame. The composition is a still life painting. |
| [10-15s] | Static frame | Hold | Fade to black. White serif text fades in, centered: **Softness. Redefined.** Piano resolves on a final chord. Silence. |

**Energy:** Building to quiet climax, then absolute stillness on the tagline.

## Technical Spec

| Parameter | Value |
|-----------|-------|
| Model | renoise-2.0 |
| Aspect ratio | 16:9 |
| Duration | 2 × 15s (chained via ref_video) |
| Mode | Finished Cut |
| Input mode | Image-to-Video (toilet paper image as ref_image) |
| Resolution | 1080p |
| Shot density | 3 setups per segment |
| Source image | /Users/noah/Documents/codes/ai-mcn/demo/toilet-paper.png |

## Generation Strategy

1. **Segment 1:** Generate using Image-to-Video mode with the toilet paper photo as `ref_image`. Time-annotated prompt with 3 distinct camera setups.
2. **Segment 2:** Chain from Segment 1 using `ref_video` to maintain visual continuity. The roll, marble, lighting must match.
3. **Tagline:** Rendered as part of the Segment 2 prompt (fade to black with text overlay). If text rendering is insufficient, can be composited in post.

## Success Criteria

- The video could pass as an actual luxury brand campaign at first glance
- The toilet paper is never treated as a joke — the comedy comes from the sincerity
- Texture close-ups make the paper look genuinely premium
- The tagline lands with weight and finality
- Visual continuity between segments is seamless
