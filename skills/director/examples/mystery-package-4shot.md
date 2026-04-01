# Example: Mystery Package — 4 × 15s Short Film

A compact example of the new **Plan → Execute** workflow for a suspense short.

---

## PLAN

### 1. Project Summary

**Concept**
Maya comes home to find a mysterious package at her door. Inside is an antique pocket watch. When she opens it, the watch awakens and floods the room with golden light.

**Mode**
C — Original multi-clip short film

**Format**
4 clips × 15s = 60s total

**Style Direction**
Cinematic suspense drama, shallow depth of field, subtle film grain, warm amber tones with cool blue shadows, golden magical climax.

---

### 2. Character Bible

```json
[
  {
    "id": "CHAR_MAYA",
    "name": "Maya",
    "appearance": "East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build",
    "wardrobe": "Oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots",
    "signature_details": "Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings",
    "voice_tone": "Warm, curious, slightly husky"
  }
]
```

---

### 3. Segment Purpose Table

| Segment | Story Function | Emotion | Key Location | Continuity Importance |
|---------|----------------|---------|--------------|-----------------------|
| S1 | setup | curiosity | apartment hallway | medium |
| S2 | discovery | wonder | living room / desk | high |
| S3 | escalation | awe / shock | same living room | very high |
| S4 | resolution | wonder / calm | same living room | high |

---

### 4. Treatment

**S1** — Maya walks down her apartment hallway with grocery bags and notices a brown-paper-wrapped package on her doormat. She kneels, picks it up, and studies it with cautious curiosity.

**S2** — Inside her living room, she unwraps the package at a desk lit by a warm lamp and discovers an ornate gold pocket watch in a velvet box. She lifts it toward the light, captivated.

**S3** — The watch hands spin backward. Golden light leaks from the face, then bursts outward, filling the room with warm particles as Maya rises in amazement.

**S4** — The magical glow settles into a gentle pulse. Maya places the watch on the desk, steps back, and realizes she has just encountered something impossible.

---

### 5. Character Asset Plan

| Character | Segments | Asset Strategy | Justification |
|-----------|----------|----------------|---------------|
| Maya | S1-S4 | ✅ Generate Asset | Appears in all 4 segments |

---

### 6. Anchor Needs Summary

- **Character anchor needed**: Maya
- **Environment anchors needed**: hallway, living room
- **Object anchor recommended**: pocket watch close-up reference if available
- **Strong continuity needed**: S2→S3, S3→S4
- **Parallel-safe**: S1→S2 only

---

### 7. Plan Freeze Summary

```md
Mode: C
Segments: 4 × 15s
Style line: Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation shifting to warm gold in the climax. Soft golden hour side-lighting through large windows, practical lamps as warm fill.

Blocking needs before execute:
- Maya face anchor
- hallway scene anchor
- living room scene anchor
- continuity strategy for S2→S3 and S3→S4
```

---

## EXECUTE PREP

### 8. Visual Dev Outputs

#### Anchor Registry

| Character | Segments | Anchor Strategy | Asset ID | Notes |
|-----------|----------|-----------------|----------|-------|
| Maya | S1-S4 | User Asset | asset:27 | generated from character sheet |

#### Scene / Environment Anchor Plan

| Environment | Segments | Anchor Strategy | Material ID | Notes |
|-------------|----------|-----------------|-------------|-------|
| Hallway | S1 | scene ref | material:53 | warm apartment corridor |
| Living room | S2-S4 | scene ref | material:61 | desk, lamp, window |
| Storyboard grid | S1-S4 | shared visual DNA | material:72 | optional panel split |

#### Continuity Strategy Table

| Transition | Continuity Need | Strategy | Why |
|------------|------------------|----------|-----|
| S1→S2 | medium | parallel + continuity text | location change |
| S2→S3 | high | serial / ref_video | same room, direct continuation |
| S3→S4 | high | serial / ref_video | same room, magical aftermath |

#### Shot → Anchor Mapping

| Shot | Character Anchor | Scene Anchor | Extra Anchor | Strategy |
|------|------------------|--------------|--------------|----------|
| S1 | asset:27 | material:53 | material:72 | parallel |
| S2 | asset:27 | material:61 | material:72 | parallel |
| S3 | asset:27 | material:61 | ref_video from S2 | serial |
| S4 | asset:27 | material:61 | ref_video from S3 | serial |

---

### 9. Shot Table with Handoff States

| Shot | Opening State | Closing State |
|------|---------------|---------------|
| S1 | Maya enters hallway carrying grocery bags | Maya at apartment door holding wrapped package at chest height |
| S2 | Maya enters living room still holding package | Maya seated at desk, holding opened pocket watch up to lamp |
| S3 | Maya seated with watch raised near her face | Maya standing, both hands cupping glowing watch in a room full of golden particles |
| S4 | Maya standing in golden-lit room holding glowing watch | Maya steps back from desk as watch pulses softly on tabletop |

---

## FINAL PROMPT PACKAGE

### Global Style Line

```text
Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation shifting to warm gold in the climax. Soft golden hour side-lighting through large windows, practical lamps as warm fill.
```

### Example Prompt — S2

```text
Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation shifting to warm gold in the climax. Soft golden hour side-lighting through large windows, practical lamps as warm fill.

Continuing from the previous shot: Maya has just entered her living room carrying a small brown-paper-wrapped package in both hands, curious and cautious, warm hallway light behind her and a wooden desk with a table lamp ahead.

Character: East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build. Wearing oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots. Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings.

Follow the character appearance from the reference image. Match the living room environment from the reference image.

[0-5s] Medium shot as Maya crosses to a wooden desk in a cozy living room, sets the package down, and sits. Warm table lamp on the desk, large window behind her with twilight blue light.

[5-10s] Close-up of her hands unwrapping the brown paper to reveal a worn velvet box. She opens it and discovers an ornate gold pocket watch with engraved details.

[10-15s] Medium close-up as she lifts the watch toward the lamp. The metal catches warm amber light and her face softens into quiet wonder.

Spoken dialogue (say EXACTLY, word-for-word): "It's beautiful..."
Tone: hushed wonder. Mouth clearly visible when speaking, lip-sync aligned.

Sound design: soft paper crinkle, gentle room tone, faint metallic ticking.
Avoid: no cartoon, no anime, no oversaturated colors, no dutch angles, no text overlays, no watermarks, no horror, no jump scares.
```

### Prompt-to-Anchor Mapping

```text
S1 → --materials "asset:27:reference_image" --materials "53:ref_image"
S2 → --materials "asset:27:reference_image" --materials "61:ref_image"
S3 → --materials "asset:27:reference_image" --materials "88:ref_video"
S4 → --materials "asset:27:reference_image" --materials "94:ref_video"
```

---

## GENERATION STRATEGY

### Cost Estimate

- 4 video clips × ~300 credits = ~1200 credits
- 1 character sheet + 2 scene refs + storyboard grid = ~200 credits range
- total planning budget target: ~1400 credits

### Execution Plan

1. Generate Maya character sheet → register as `asset:27`
2. Generate hallway and living room scene refs
3. Generate S1 and S2
4. Use S2 output as `ref_video` for S3
5. Use S3 output as `ref_video` for S4
6. Review each clip before assembly
7. Concatenate and add unified BGM in post

---

## WHY THIS EXAMPLE MATTERS

This example follows the new workflow:
- plan is frozen before generation
- anchors are decided before prompt writing
- continuity-critical transitions are marked as serial instead of guessed
- all clips remain 15 seconds, matching the platform rule
