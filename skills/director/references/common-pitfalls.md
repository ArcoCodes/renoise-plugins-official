# Common Pitfalls & Anti-Patterns

Field-tested failure modes in Seedance 2.0 video generation and how to avoid them. Read this before writing prompts for complex scenes.

> Cross-references:
> - Multi-reference guide: `Read ${CLAUDE_SKILL_DIR}/references/multi-reference-guide.md`
> - Retry strategies: `Read ${CLAUDE_SKILL_DIR}/references/retry-strategies.md`
> - Video capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`

---

## 1. Asset ID ≠ Material Reference (The #1 API Mistake)

### The Problem

Asset IDs (like `asset-20260324135118-mksq2`) are **identity tokens for privacy/safety**, NOT automatic reference links. The model does NOT automatically map an asset ID to a specific uploaded image.

### Wrong

```json
{
  "text": "Scene: Li Wei [asset-20260324135118-mksq2] and Su Ting [asset-20260319080559-4wb6j] sit on the sofa."
}
```
→ The model has **no idea** which uploaded image corresponds to which asset ID. It will guess randomly.

### Correct

```json
{
  "content": [
    {
      "type": "text",
      "text": "Image 1 is Li Wei (male lead). Image 2 is Su Ting (female lead). Li Wei and Su Ting sit on the sofa together..."
    },
    {
      "type": "image_url",
      "image_url": { "url": "asset-20260324135118-mksq2" },
      "role": "reference_image"
    },
    {
      "type": "image_url",
      "image_url": { "url": "asset-20260319080559-4wb6j" },
      "role": "reference_image"
    }
  ]
}
```

### In CLI Terms

```bash
# Always map image order to character names in the prompt text
node renoise-cli.mjs task generate \
  --prompt "Image 1 is Li Wei (male lead). Image 2 is Su Ting (female lead). They sit on the sofa..." \
  --materials "asset:27:reference_image,asset:28:reference_image"
```

**Rule**: The prompt text MUST explicitly state "Image 1 is [name], Image 2 is [name]" — never rely on asset IDs alone.

---

## 2. Multi-Character Scene: Wrong Person Count

Multi-character scenes are among the hardest generation tasks. The model must satisfy spatial layout, individual appearances, and interaction logic simultaneously.

### Common Failure Modes

| Symptom | Cause |
|---------|-------|
| Extra characters appear | Ambiguous numbering (see below) |
| Characters merge into one | Too many characters + too small frame |
| Wrong character in wrong position | No spatial description |
| Character count fluctuates frame-to-frame | Overcrowded scene + fast camera |

### Numbering Ambiguity (Critical!)

```
BAD:  "@Image3 is Beauty 3... Beauty 3 is positioned at the lower-left."
```
→ The model reads "Beauty 3" as potentially "three beauties" because the number 3 appears both as an ID and as a potential count.

```
GOOD: "@Image3 is Beauty C... Beauty C is positioned at the lower-left."
```
→ Letter identifiers (A, B, C, D) cannot be confused with counts.

**Rule**: Use letters (A, B, C, D) for character identifiers in multi-person scenes, NEVER numbers that could be misread as quantities.

### Spatial Description Requirements

For multi-character scenes, you MUST describe each person's position relative to others and to the frame:

```
GOOD:
"In the frame, Character A stands on the far left, wearing a red dress.
Character B sits in the center at the table, wearing a grey suit.
Character C leans against the right wall, wearing a white blouse.
All three face the center of the table."
```

### Cross-Reference Between Scene Ref and Individual Refs

When you have both a multi-person scene reference AND individual character references, explicitly bridge them:

```
BAD:
"@Image3 is the scene. @Image1 looks angrily at @Image3's @Image2."
→ Confusing nesting — which person in Image3 corresponds to Image2?

GOOD:
"@Image3 shows the full scene layout. In this scene:
- @Image1 stands on the far right, wearing a grey shirt
- @Image2 is the woman sitting in the center of @Image3
@Image2 looks angrily at @Image1 and says: 'What are you doing?'"
```

### Reducing Generation Variance

- **Keep total characters ≤ 3** per generation for reliable results
- **Provide clear spatial anchors** (left/center/right, foreground/background)
- **For 4+ characters**: Consider generating in layers or using wider shots where individual details matter less
- **Accept re-rolls**: Multi-character scenes inherently require more attempts — budget for 2-3 generations per scene

---

## 3. Grid/Composite Reference Images

### The Problem

Uploading a 3×3 grid image (9 panels in one image) as a single reference often leads to:
- Model focuses on some panels but ignores others
- Model treats the grid layout as part of the visual content
- Inconsistent attention across panels

### Wrong

```
"@Image1 shows a 3×3 storyboard. Generate the full sequence."
→ Model may focus on 2-3 panels and ignore the rest.
```

### Correct: Split and Reference Individually

```bash
# Split the grid into individual panels
convert storyboard.png -crop 3x3@ +repage +adjoin panel_%d.png

# Upload each panel separately
for f in panel_*.png; do
  node renoise-cli.mjs material upload "$f"
done

# Reference specific panels in the prompt
node renoise-cli.mjs task generate \
  --prompt "@Image1 shows the fire ball falling from sky. @Image2 shows the figure hovering. @Image3 shows the hand gesture close-up..." \
  --materials "101:ref_image,102:ref_image,103:ref_image"
```

### When Grids Work

Grids ARE useful for:
- **Style anchoring**: A single grid gives the model a unified visual palette
- **Concept art**: Overall mood/atmosphere reference where individual panel precision doesn't matter
- **Storyboard overview**: When you want the model to understand the overall flow, not replicate specific panels

Grids DON'T work for:
- **Per-panel replication**: When each panel needs to be faithfully reproduced
- **Character consistency**: Grid faces are too small for reliable face matching
- **Detailed action sequences**: Individual panels provide better control

---

## 4. Too Many Actions in One Time Window

### The Problem

Cramming 5+ distinct actions into a single 5-second window overwhelms the model, producing incoherent results where actions blend, skip, or happen simultaneously.

### Wrong

```
[0-5s] She walks in, puts down her bag, picks up the letter, reads it,
       gasps in shock, drops the letter, grabs her phone, and dials.
```
→ 8 actions in 5 seconds = model can't sequence them properly.

### Correct

```
[0-5s] She walks in and sets her bag on the counter. Camera tracks alongside.

[5-10s] She notices a letter on the table, picks it up, and reads it.
        Her expression shifts from curiosity to shock. Camera slowly pushes in.

[10-15s] She drops the letter on the table and reaches for her phone.
         Camera holds in close-up as she dials. Her hand trembles slightly.
```

### Action Budget per Time Window

| Duration | Max Actions | Max Camera Changes |
|----------|------------|-------------------|
| 3s | 1-2 | 1 |
| 5s | 2-3 | 1 |
| 10s | 3-5 | 1-2 |
| 15s | 5-8 total | 2-3 total |

**Rule**: When in doubt, remove actions until it feels too simple — that's about right.

---

## 5. Contradictory Camera Instructions

### The Problem

Requesting multiple simultaneous camera movements destabilizes the output:

```
BAD: "Camera pushes in while panning right and tilting up simultaneously."
→ Three competing movements = jittery, unstable output.

GOOD: "Camera slowly pushes in toward her face."
→ One clear, unambiguous movement.
```

### One Movement Per Time Stage

```
[0-5s] Camera tracking alongside as she walks (ONE movement: tracking)
[5-10s] Camera pushes in to close-up (ONE movement: push in)
[10-15s] Camera slowly pulls back to wide shot (ONE movement: pull back)
```

### Sequential, Not Simultaneous

If you need a complex camera path, describe it as a **sequence**:

```
GOOD: "Camera starts with a slow push-in, then transitions to a gentle orbit around the subject."
→ Sequential: push-in THEN orbit.

BAD: "Camera pushes in while orbiting the subject."
→ Simultaneous: unstable.
```

---

## 6. Abstract Emotion Words Instead of Visual Cues

### The Problem

```
BAD: "The woman looks very sad and heartbroken."
→ The model doesn't know what "very sad and heartbroken" looks like in motion.

GOOD: "The woman's lips quiver, her eyes well up with tears, she lowers her gaze to the ground, shoulders dropping."
→ Four observable, filmable visual cues.
```

### Translation Guide

| Abstract | Visual Equivalent |
|----------|-------------------|
| "Nervous" | Fidgets with ring, shallow breathing, avoids eye contact |
| "Angry" | Jaw clenches, nostrils flare, fists tighten, stands abruptly |
| "Surprised" | Eyes widen, mouth falls open, takes a half-step back |
| "Sad" | Lips tremble, eyes redden, shoulders slump, gaze drops |
| "Happy" | Eyes crinkle, dimples appear, chest rises with a deep satisfied breath |
| "Confused" | Head tilts, brow furrows, squints at the object |
| "Determined" | Jaw sets, eyes narrow with focus, stands taller, fists clench |

---

## 7. Inconsistent Style Lines Across Segments

### The Problem

Rephrasing the style line between segments causes visual inconsistency:

```
S1: "Cinematic warm amber tones, shallow depth of field, film grain."
S2: "Warm natural lighting with soft golden hues, professional cinematography."
→ These sound similar but the model interprets them differently.
```

### Fix

**Copy-paste the EXACT same style line** for every segment. Character for character. Word for word.

```
S1: "Cinematic suspense drama, shallow depth of field, subtle film grain."
S2: "Cinematic suspense drama, shallow depth of field, subtle film grain."
S3: "Cinematic suspense drama, shallow depth of field, subtle film grain."
```

---

## 8. Missing Stability Constraints on Character Content

### The Problem

Omitting stability constraints leads to the three most common artifacts:
- **Face morphing**: Character's face shifts shape mid-video
- **Body distortion**: Limbs stretch, extra fingers appear
- **Motion jitter**: Unnatural stuttering or freezing

### Fix

ALWAYS add this block at the end of any prompt featuring characters:

```
Face stable without deformation, facial features clear, body proportions normal,
motion natural and fluid, no stiffness, no frame stuttering, no flickering.
```

This single addition reduces these artifacts by an estimated 30-50%.

---

## 9. Starting Video with Slow Buildup (E-commerce)

### The Problem (Specific to E-com / TikTok)

```
BAD: [0-3s] Camera slowly pans across a room. A woman enters from the left.
→ Viewer has already swiped away.
```

### Fix

Product must be in Frame 1. Camera must have energy. Dialogue must start immediately.

```
GOOD: [0-3s] Camera snaps in close-up on the product. The model picks it up
      and holds it to camera. "This little thing saved my back after deadlifts."
```

---

## 10. Dialogue Too Long or Wrong Format

### The Problem

```
BAD: She says "I've been thinking about this for a while and I want you to know
     that I truly appreciate everything you've done for me and my family."
→ 30+ words = lip-sync breaks down, words get garbled.

BAD: She says "Thank you."
→ Missing the forced lip-sync format.
```

### Fix

```
GOOD:
Spoken dialogue (say EXACTLY, word-for-word): "I appreciate everything you've done."
Tone: warm, sincere. Mouth clearly visible when speaking, lip-sync aligned.
```

**Rules**:
- Max 15 words per line
- One line per 5-second time window
- Always use `Spoken dialogue (say EXACTLY, word-for-word):` prefix
- Always follow with `Tone:` and `Mouth clearly visible when speaking, lip-sync aligned.`

---

## Quick Reference: Pre-Submission Checklist

Before submitting any generation task, verify:

- [ ] Asset-to-character mapping is explicit in prompt text ("Image 1 is [name]")
- [ ] Character identifiers use letters, not numbers, in multi-person scenes
- [ ] ≤ 3 characters per generation (4+ needs special handling)
- [ ] Grid images are split into individual panels if precision matters
- [ ] ≤ 3 actions per 5-second window
- [ ] One camera movement per time stage (sequential, not simultaneous)
- [ ] Emotions externalized as body signals, not abstract words
- [ ] Style line is copy-pasted identically across all segments
- [ ] Stability constraints included at end of prompt
- [ ] Dialogue uses forced lip-sync format, ≤ 15 words per line
- [ ] E-com: product in Frame 1, no slow buildup
- [ ] Total materials ≤ 5
