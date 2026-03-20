# renoise-2.0 Video Model Capabilities

## Model Specs

| Parameter | Value |
|-----------|-------|
| Model name | `renoise-2.0` |
| Min duration | 5 seconds |
| Max duration | 15 seconds |
| Duration options | Any integer from 5-15s |
| Resolution | Up to 1080p |
| Aspect ratio | `1:1`, `16:9`, `9:16` |

## Input Types

### Text-to-Video — Recommended Default Mode
- No materials needed, generate video from prompt alone
- **Most common and most stable mode**
- Not subject to privacy detection, highest success rate
- Suitable for: all scenarios

### Image-to-Video
- Upload reference image, AI generates video from image + prompt
- Material role: `ref_image`
- **⚠️ Privacy detection limitation**: Images with realistic human faces are often blocked (`PrivacyInformation` error). Product photos, landscapes, illustrations without faces work fine
- Suitable for: product showcase (white background product photos), scene extension (no faces)

### Video-to-Video
- Upload reference video, AI generates new video referencing motion/style
- Material role: `ref_video`
- **⚠️ Same privacy detection limitation**, videos with faces are often blocked
- Using ref_video affects pricing (more expensive)
- Suitable for: motion transfer, style transfer (face-free materials)

### Best Practices

Default to **Text-to-Video** and describe character appearance entirely in text. Only use reference materials for:
- Pure product photos (white background, no faces) → `ref_image`
- Abstract/landscape references → `ref_image`
- Precise motion replication (no faces) → `ref_video`

## Duration Strategy

### Core Principle: Prefer Single 15s Segment, Avoid Multi-Segment Stitching

The model can **naturally include multiple storyboard transitions** within a single 15s generation. A single 15s generation has major advantages over stitching shorter clips:

| | Single 15s | Stitched 5×3s |
|---|---------|----------|
| Music/SFX | Natural, coherent flow | Fragmented, inconsistent rhythm |
| Character consistency | Naturally consistent within segment | Prone to drift/face changes across segments |
| Camera fluidity | Complex continuous movements possible | Each segment independent, no continuity |
| Cost | 1 API call | 5 API calls |

**Conclusion**: Default to 15s. Only use multiple segments when target duration > 15s.

### 15s Multi-Storyboard Prompt Writing

Describe multiple storyboard stages in one prompt, using time beats to guide internal transitions:

```
[Opening 0-3s] Close-up of hands unboxing a sleek black device on a white desk.
Camera snaps dolly in to reveal the logo.

[Middle 3-10s] The woman picks it up, examines it from different angles.
Medium shot, smooth orbit around the product in her hands.
Spoken dialogue (say EXACTLY, word-for-word): "I've been waiting for this."
Mouth clearly visible, lip-sync aligned.

[Closing 10-15s] She places the device on a wireless charger, LED glows blue.
Pull back to wide shot of the full minimalist workspace.
Soft ambient glow, the frame holds steady.
```

**Key techniques**:
- Use `[Opening/Middle/Closing]` + time segment annotations for storyboard beats
- 2-3 sentences per stage, high information density
- Natural camera transitions (e.g., close-up → medium → wide)
- Embed dialogue within the corresponding time segment
- End last stage with `frame holds steady` for easy continuation

### Videos Over 15s

When target duration > 15s, split into 15s segments, minimizing the number of segments:

```
30s → 2 × 15s
45s → 3 × 15s
60s → 4 × 15s
```

#### Serial Chain Generation (ref_video chaining)

The key to visual continuity: **generate segments sequentially, passing each completed video as `ref_video` to the next segment**. The model continues from where the previous segment ended.

```
S1: text-to-video (standalone)
  ↓ complete → upload S1 video as material
S2: ref_video(S1) + prompt → generates from S1's ending
  ↓ complete → upload S2 video as material
S3: ref_video(S2) + prompt → generates from S2's ending
  ↓ ...
```

**S1 prompt**: Normal standalone prompt with full style/character setup.
**S2+ prompts**: Begin with `Continuing from the previous shot:` + describe only the NEW content. Do NOT repeat the ending of the previous segment — the ref_video already provides that context.

**CLI pattern:**
```bash
# S1
renoise-cli.mjs task generate --prompt "<S1>" --duration 15 --ratio 16:9

# Upload S1 result
renoise-cli.mjs material upload <S1-video-url>  # → returns MATERIAL_ID

# S2
renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2>" \
  --duration 15 --ratio 16:9 \
  --materials "MATERIAL_ID:ref_video"
```

**Time cost**: Each segment takes ~5-8 minutes. A 60s video (4 segments) takes ~20-30 minutes total (sequential, not parallel).

#### Visual Consistency (still required even with ref_video)

1. **Repeat character description** — Begin each segment's prompt with full character appearance
2. **Unified scene/lighting keywords** — Use the same lighting, color palette across all segments
3. **Unified style keywords** — e.g., `cinematic, shallow depth of field, warm tone`

These are still needed because ref_video provides visual continuity for the *transition moment*, but the model still needs style guidance for the rest of the segment.

#### Narrative Continuity (across segments)

4. **Energy annotation** — Each segment prompt must start with a comment declaring its narrative role and energy level:
   ```
   <!-- Segment 2/4 — DEVELOPMENT | Energy: 5→7→8 -->
   ```
5. **Energy variation** — Never write 3+ segments at the same energy level. Alternate between high-energy and breathing segments.
6. **Drop before climax** — The segment before the climax must be lower energy (at least -2 points).

#### Audio Continuity

7. **With ref_video chaining**, the model may naturally extend the audio style from the previous segment, but this is not guaranteed.
8. **For dialogue-driven videos**: audio continuity is less critical — each segment has distinct lines.
9. **For music-driven videos**: consider stripping all audio in post and overlaying a unified BGM track:
   ```bash
   ffmpeg -i final.mp4 -an -c:v copy silent.mp4
   ffmpeg -i silent.mp4 -i bgm.mp3 -c:v copy -c:a aac -shortest final-with-bgm.mp4
   ```

#### Example: 30s Product Video (2 segments with narrative arc)

**Segment 1 (0-15s) — HOOK + SETUP**
```
<!-- Segment 1/2 — HOOK | Energy: 7→5→6 | Transition: Gaze Lead → S2 -->
2.35:1 widescreen, warm golden palette, shallow depth of field.
[0-3s] A pair of hands slowly unwrap a matte black box on a sunlit wooden table. Close-up, gentle dolly in, morning light catches the edge of the box. The anticipation builds.
[3-10s] The lid lifts to reveal a sleek brass desk lamp. The hands carefully lift it out, examining the curves. Medium shot, soft natural light from a nearby window. The pace is unhurried, deliberate.
[10-15s] The woman sets the lamp on her desk and reaches for the switch. Her eyes trace the design with quiet admiration. She looks up toward the window — the golden light outside mirrors the lamp's warm glow. Her gaze holds on the light.
No text, subtitles, watermarks, or logos.
```

**Segment 2 (15-30s) — CLIMAX + RESOLUTION**
```
<!-- Segment 2/2 — CLIMAX | Energy: 8→10→4 | Transition: n/a (final) -->
2.35:1 widescreen, warm golden palette, shallow depth of field.
A woman with shoulder-length dark hair in a cream linen shirt sits at a minimalist wooden desk.
[0-5s] Revealing what she was looking at: she clicks the lamp on. A pool of warm golden light floods the desk surface. Fast snap dolly in on the illuminated workspace. The light transforms the entire mood of the room.
[5-10s] Time-lapse of the room transitioning from daylight to evening. The lamp becomes the anchor of warmth in the darkening space. Quick cuts between angles: the light on a book, on her hands writing, on a coffee cup casting a long shadow. Energy peaks.
[10-15s] Night. The room is dark except for the lamp's glow. Wide shot, she's reading peacefully. Camera slowly pulls back through the window. The frame holds steady on the warm window in the dark facade. Silence except for distant crickets.
No text, subtitles, watermarks, or logos.
```

**Why this works**: S1 builds curiosity without showing the product immediately (energy 7→5→6). The gaze lead at S1's end creates a natural bridge. S2 opens with the reveal (energy 8), peaks with the time-lapse montage (10), then resolves into calm (4). The energy curve `7→5→6 | 8→10→4` has clear variation, a drop before climax, and a distinct ending.

#### Example: 60s Short Drama (4 segments with three-act structure)

**Rhythm Blueprint:**
```
S1 (0-15s) — ACT I: ORDINARY WORLD | Energy: 5→4→6 | → Action Bridge
S2 (15-30s) — ACT II-A: COMPLICATION | Energy: 7→8→9 | → Emotional Shift
S3 (30-45s) — ACT II-B: CLIMAX | Energy: 4→8→10 | → Time Jump
S4 (45-60s) — ACT III: RESOLUTION | Energy: 5→3→4 | → (end)
```

Note: S3 opens at energy 4 (the "drop before climax") despite S2 ending at 9. This emotional shift creates maximum impact when S3 builds to its peak at 10.

## Prompt Writing Principles

### Basic Rules
1. **Must be English** — The model understands English prompts best
2. **Natural narrative** — Use coherent descriptive paragraphs, not comma-separated tag lists
3. **Specific > Abstract** — `a golden retriever running through shallow ocean waves at sunset` beats `a dog on a beach`
4. **High information density** — 15s prompts should include details for multiple storyboard stages, don't waste space on repetition

### Prompt Structure

```
Subject (detailed appearance) + Action (multi-stage actions) + Camera (movement changes) + Scene/Environment + Visual Style
```

- **Subject**: What the subject is, with detailed appearance (hairstyle, skin tone, clothing, build)
- **Action**: What the subject is doing, described in temporal order
- **Camera**: Camera movement changes (at least 2-3 transitions: e.g., close-up → medium → wide)
- **Scene**: Environment, lighting, time of day
- **Style**: Visual style (cinematic, documentary, animation...)

### Camera Movement Cheat Sheet

| Category | Effect | Keywords | Use Case |
|----------|--------|----------|----------|
| **Shot Size** | Extreme wide | extreme wide shot | Establish environment |
| | Full shot | wide shot | Spatial relationships |
| | Medium | medium shot | Character interaction |
| | Close-up | close-up | Emotion/detail |
| | Extreme close-up | extreme close-up / macro | Texture/material |
| **Movement** | Push in | fast snap dolly in | Detail impact |
| | Pull back | quick pull back to reveal | Reveal full scene |
| | Whip pan | whip pan with motion blur | Rhythmic transition |
| | Slider | subtle slider drift | Elegant showcase |
| | Orbit | smooth orbit | 360° showcase |
| | Tracking | tracking shot follows subject | Dynamic following |
| | Macro push | extreme macro push | Material detail |
| | Static | locked-off static | Freeze/ending |
| **Angle** | Low angle | low angle | Authority/impact |
| | Overhead | overhead / bird's eye | Overview/spatial |
| | Fisheye | fisheye lens | Fun/exaggerated |
| | POV | first-person POV | Immersive experience |
| **Pacing** | Slow motion | slow motion | Emphasize action |
| | Quick cuts | rapid cuts / hard cut | Tension/rhythm |
| | Time-lapse | time-lapse | Passage of time |
| **Focus** | Shallow DOF | shallow depth of field | Subject isolation |
| | Focus pull | rack focus | Guide viewer's eye |
| **Special** | Vertigo | dolly zoom / vertigo effect | Psychological impact |
| | Wipe transition | wipe transition through obstruction | Seamless scene change |

### Example: 15s Multi-Storyboard Prompt

**Good prompt**:
> A young woman with shoulder-length dark hair and a cream knit sweater sits at a sunlit café table. [0-4s] Close-up of her hands wrapping around a steaming ceramic mug, camera gently pushes in, morning light catches the steam rising. [4-10s] She takes a sip, looks up and smiles, medium shot as camera slowly drifts to a side angle revealing the quiet café interior — wooden shelves, hanging plants, soft jazz playing. Spoken dialogue (say EXACTLY, word-for-word): "This is my favorite place in the city." Mouth clearly visible, lip-sync aligned. [10-15s] She sets the mug down and opens a worn leather journal, begins writing. Camera pulls back to a wide shot through the café window, the frame holds steady. Cinematic, warm golden tones, shallow depth of field, film grain.

**Bad prompt**:
> woman, café, coffee, sunshine, beautiful, cinematic, 4k

## Advanced Prompt Techniques

### Technical Parameters Prefix

Declare global technical specs (aspect ratio, framerate, color palette, DOF) at the prompt's start — the model applies them consistently throughout:

```
2.35:1 widescreen, 24fps, warm golden palette, shallow depth of field.
[0-5s] Close-up of hands on piano keys...
```

### Negative Prompting

Exclude unwanted elements at the end of the prompt to prevent auto-generated text, watermarks, etc.:

```
... frame holds steady. No text, subtitles, watermarks, or logos. No sudden camera shake.
```

Common negatives: `No text / No subtitles / No watermarks / No logos / No camera shake / No jump cuts`

### Style Keywords Cheat Sheet

| Category | Example Keywords |
|----------|-----------------|
| Texture | cinematic, film grain, HDR, RAW, 8K |
| Color | warm tone, cold blue, high contrast, desaturated, neon, Morandy palette |
| Lighting | golden hour, rim light, Tyndall effect, volumetric light, natural light, side backlight |
| Style | documentary, vlog, commercial, music video, Hollywood blockbuster, indie film |
| Animation | 3D CG animation, cel-shaded anime, ink wash painting, pixel art |

## Scene Type Prompt Focus

| Scene Type | Prompt Focus |
|------------|-------------|
| **E-commerce/Ads** | Product visible in frame 1 + material close-up + 360° showcase + brand ending |
| **Story/Drama** | Separate visuals and dialogue + annotate character emotion + SFX on separate line |
| **Action/Fantasy** | VFX particle details + quick-cut pacing + slow-mo for key actions |
| **Lifestyle/Vlog** | Natural light + handheld tracking feel + ambient sound |
| **MV/Beat Sync** | Specify aspect ratio + framerate + sound design priority + beat alignment |
| **Educational** | 4K CGI style + semi-transparent visualization + educational voiceover |

## Creative Prompt Templates

### Story Completion

Provide keyframes or storyboard description, let the model auto-fill actions and transitions:

```
A 4-panel comic strip is shown in the reference image. Animate each panel left-to-right,
top-to-bottom, maintaining character dialogue. Add dramatic sound effects at key moments.
Style: humorous and exaggerated.
```

### Video Extension

Append content to a previously generated video. Pass the previous video via `--materials "ID:ref_video"`, prompt describes **the new portion only**:

```
Continuing from the previous shot: [0-5s] The character turns and walks toward the door,
camera tracking follows. [5-10s] She opens the door to reveal a sunlit garden, camera
glides through the doorframe, frame holds steady.
```

> **Note**: `--duration` should be set to the duration of the new portion, not the total.

### Seamless Long Take

Use `single continuous take, no cuts` + scene transition words to link multiple spaces:

```
Single continuous take, no cuts. [0-5s] Camera follows a woman in a red coat through
a crowded market, tracking shot. [5-10s] She turns a corner into a quiet alley, camera
keeps following without cutting. [10-15s] She pushes open a wooden door and enters a
sunlit courtyard, camera glides in behind her, frame holds steady.
```

### Sound & Dialogue

Embed dialogue using `Spoken dialogue (say EXACTLY, word-for-word): "..."` format in the corresponding time segment, with emotion and lip-sync annotations:

```
[3-8s] Medium shot, she picks up the phone. Spoken dialogue (say EXACTLY, word-for-word):
"I told you, it's over." Tone: cold and resolute. Mouth clearly visible, lip-sync aligned.
```

SFX/BGM on a separate line at the end of the prompt:

```
Sound design: gentle rain on window, distant thunder, melancholic piano.
```

### Video Editing

Make targeted modifications to a reference video (character replacement, element addition/removal). Pass original video + replacement materials via `--materials`:

```
Replace the main character in the reference video with the person in the reference image.
Keep all original camera movements and timing. Add a white cat sitting on the desk
in the background.
```

### Beat Sync

Specify aspect ratio + framerate, use timestamps to precisely align with beats, emphasize audio-visual synchronization:

```
2.35:1 widescreen, 24fps. [0-2s] Beat drop — extreme close-up of hands clapping, sharp
snap zoom. [2-5s] Wide shot, dancer spins, camera orbits in sync with bass hits.
[5-8s] Freeze frame on peak pose, 0.5s hold, then rapid montage cuts on every snare.
Sound design priority: footsteps, fabric rustle, and breath must align with beat.
```
