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

## Model Reality Check

**The model generates continuous video — it is NOT a video editor.** Understanding what it can and cannot do prevents wasted generations.

### What the model does well
- Smooth continuous camera movements (push in, pull back, orbit, track)
- Gradual transitions within a single shot (close-up drifting to medium)
- Consistent character appearance within one 15s generation
- Lip-sync dialogue in multiple languages when using the exact embedding format
- Atmospheric scenes with clear mood (one mood per segment)
- Simple cause-and-effect actions (hand picks up cup, person walks forward)

### What the model does poorly or cannot do
- **Hard cuts / jump cuts** — it generates continuous flow, not edited footage
- **Shot-reverse-shot** — camera cannot teleport to a new angle mid-generation
- **Dolly zoom / vertigo effect** — too complex, produces artifacts
- **Whip pan with motion blur** — unpredictable results
- **Rapid montage of 5+ setups** — becomes incoherent mush
- **Precise slow-motion timing** — approximate at best
- **Complex multi-character choreography** — characters may merge or disappear
- **Reading/displaying text or characters on screen** — unreliable
- **Maintaining exact face identity across separate generations** — always drifts

### The golden rule
**One mood, one scene, one continuous camera flow per 15s segment.** If you want a mood shift (warm→cold), a location change, or a camera angle that requires teleportation — that's a new segment.

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

`ref_image` and `reference_image` are aliases — both normalize to `reference_image` at the model level. Privacy detection depends on **source** (raw material vs registered asset), not the role name.

- Pure product photos (white background, no faces) → `--materials "ID:ref_image"` (safe)
- Abstract/landscape references → `--materials "ID:ref_image"` (safe)
- Precise motion replication (no faces) → `--materials "ID:ref_video"`
- **Images with human faces** → register as asset first, then `--materials "asset:ID:reference_image"`. Or use the Character Library (`--characters "ID"`). **Do NOT** pass face images as raw materials — privacy detection will block them regardless of role name.

## Duration Strategy

### Every segment is 15s

All video generations use `--duration 15`. This is the fixed unit. A 3-minute film = 12 × 15s segments. Do not use shorter durations for "faster" clips — the model produces better results at 15s.

### Single 15s vs Multi-Segment

| | Single 15s | Stitched segments |
|---|---------|----------|
| Music/SFX | Natural, coherent flow | Fragmented, may need post-production BGM |
| Character consistency | Naturally consistent | Drifts between segments |
| Camera fluidity | Continuous movements | Each segment independent |
| Cost | 1 API call (300 credits) | N API calls |

**Conclusion**: Use a single 15s for self-contained scenes. Use multiple segments only when the story exceeds 15s.

### Prompt Structure for 15s

Two valid approaches. Choose based on content type.

#### Approach A: Timestamp-Based (best for dialogue, drama, product)

Describe what happens in each time window. Best when pacing and dialogue timing matter.

```
[Style line — 1 line, persistent across all segments]

[Character description — full Bible entry, if character appears]

[0-5s] Stage 1 — action beats + camera movement.
[Optional dialogue]

[5-10s] Stage 2 — escalation beats + camera transition.
[Optional dialogue]

[10-15s] Stage 3 — payoff beats + camera settles.
[Optional dialogue]

Sound design: [ambient, SFX] or audio style reference (e.g. "noir jazz score").
No text, subtitles, watermarks, or logos. [additional negative constraints]
```

#### Approach B: Role-Based (best for action, complex scenes, multi-character)

Describe the scene by category — location, action choreography, cinematography, technical quality. Let the model handle timing. Best when the action is complex and continuous.

```
[Setting]
  Location and environment details. Visual textures and architectural elements.

[Characters]
  Full appearance descriptions for each participant.

[Action]
  Opening: [what happens first — who initiates, how]
  Climax: [escalation — counters, reversals, interactions]
  Finisher: [resolution — decisive moment, outcome]

[Cinematography]
  Camera: [persistent camera behavior — e.g. "orbiting tracking shots"]
  Lighting: [reactive lighting — e.g. "shifts with intensity of the action"]
  Visual style: [overall look — e.g. "cinematic photorealism, film grain"]

[Audio]
  Style reference: [genre/cultural reference — e.g. "80s synth thriller score"]

[Technical]
  Quality: [what to aim for — e.g. "natural motion, photorealistic skin"]
  Avoid: [specific AI artifacts — e.g. "no deformed limbs, no extra fingers, no blurring"]
```

**When to use which:**

| Content | Approach | Why |
|---------|----------|-----|
| Dialogue scene with specific timing | A (timestamp) | Dialogue needs precise placement |
| Fight / dance / complex action | B (role-based) | Action phases > timestamp micromanagement |
| Product showcase | A (timestamp) | Controlled reveal pacing |
| Multi-character interaction | B (role-based) | Easier to describe each participant's role |
| Atmospheric / montage | Either | Simple enough for both |

You can also **hybrid** — use role-based structure but add loose time hints:

```
[Action]
  Opening (first few seconds): She enters the room, sees the evidence.
  Climax (mid-segment): Confrontation — he tries to explain, she cuts him off.
  Finisher (final seconds): She walks out. Door slams. Silence.
```

### Shot Density & Pacing

**The model generates continuous video.** Camera transitions must be smooth and continuous. But within each camera stage, you can pack dense story action.

**Key distinction: camera stages vs story beats.**
- **Camera stages** (2-3 per 15s): Smooth camera transitions the model can physically execute
- **Story beats** (3-8 per 15s): Actions, reactions, dialogue, reveals packed within those camera stages

A single camera push-in can cover: a character reading a letter, reacting with shock, looking up at someone, and speaking a line — that's 4 story beats in 1 camera stage.

**Recommended density per 15s:**

| Scene Type | Camera Stages | Story Beats | Camera Strategy |
|------------|---------------|-------------|-----------------|
| Drama / dialogue | 2-3 | 4-6 | Push in → hold → pull back |
| Action | 3 | 5-8 | Track → tilt → wide reveal |
| Product / showcase | 2-3 | 3-5 | Orbit → macro → wide |
| Atmospheric / art | 1-2 | 2-3 | Single slow movement |
| Montage (travel, time) | 3-4 | 5-8 | Scene dissolves, rapid action |

**Camera transitions must be smooth and continuous:**
- Scale shift: close-up → pulls out to medium → continues to wide
- Movement chain: static hold → slow dolly in → orbit
- Subject shift: hands → tilt up to face → continues to full body

**Pack story beats densely — don't waste time lingering:**
```
BAD (too slow — 3 camera stages but only 3 story beats, nothing happens):
[0-5s] Close-up of her face in morning light. She stares out the window.
[5-10s] She picks up a cup. She takes a sip.
[10-15s] She puts the cup down. Camera holds.

GOOD (fast-paced — 3 camera stages, 8+ story beats):
[0-5s] Close-up — her eyes scan a letter, expression shifts from curiosity
to shock. She crumples it, stands abruptly — chair scrapes the floor.
Camera pulls back as she reaches for her coat.
[5-10s] Medium shot — she yanks the door open, nearly collides with a man
standing outside. Both freeze. Camera holds on the two of them.
Spoken dialogue (say EXACTLY, word-for-word): "You knew about this."
Tone: cold accusation. Mouth clearly visible when speaking, lip-sync aligned.
[10-15s] He steps back, hands raised. She pushes past him and strides down
the hallway. Camera tracks alongside her. Fist clenching the crumpled letter.
(3 camera stages, 8+ beats: reads, reacts, stands, grabs coat, opens door,
confrontation, dialogue, storms off)
```

**Do NOT write disconnected jump cuts:**
```
BAD: [0-3s] Close-up of face. [3-6s] Hard cut — wide shot from behind.
     [6-9s] Snap to overhead. [9-12s] POV shot. [12-15s] Dutch angle.
     (5 disconnected angles — model produces incoherent mush)
```

## Videos Over 15s — Parallel vs Serial

When total duration > 15s, you must split into 15s segments. The critical decision is **parallel vs serial generation**.

### Decision Framework

| Condition | Strategy | Why |
|-----------|----------|-----|
| Same character continues across segments | **Serial** (ref_video chain) | Face/body must match |
| Same location, continuous action | **Serial** | Visual environment must match |
| Different locations, different characters | **Parallel** | No visual dependency |
| Montage of independent scenes | **Parallel** | Each scene is self-contained |
| Mix of both | **Hybrid** | Group continuous sequences serial, independent scenes parallel |

### Parallel Generation

Submit all segments simultaneously. Fastest option (~8 min total regardless of segment count). Best for:
- Independent scenes at different locations
- Different characters who never appear together
- Montage sequences where each shot is a different place/time

**Trade-off**: No visual continuity between segments. Each segment starts from scratch. Concatenation will have visible "jumps" between clips.

**Mitigation**: Use the same style line and concept art ref_image across all segments to maintain palette/texture consistency. Accept that faces and details will drift.

### Serial Chain Generation (ref_video)

Generate sequentially, passing each completed video as `ref_video` to the next. Slowest option (~8 min × N segments). Best for:
- Continuous narrative with the same character
- Scenes where the ending of one shot must visually match the start of the next
- Any sequence where the viewer would notice a visual "jump"

```
S1: text-to-video → complete → download → upload as material
S2: ref_video(S1) + prompt → complete → download → upload as material
S3: ref_video(S2) + prompt → ...
```

**S1 prompt**: Full standalone prompt with style + character + scene.
**S2+ prompts**: `Continuing from the previous shot:` + describe only the NEW content. The ref_video provides the visual context.

**CLI pattern:**
```bash
# S1
renoise-cli.mjs task generate --prompt "<S1>" --duration 15 --ratio 16:9
# Download S1 result, upload as material
renoise-cli.mjs material upload S1.mp4  # → MATERIAL_ID_1
# S2
renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2 new content>" \
  --duration 15 --ratio 16:9 --materials "MATERIAL_ID_1:ref_video"
```

### Hybrid Strategy (Recommended for most short films)

Group your shots into **continuity blocks**. Within each block, use serial. Between blocks, use parallel.

```
Block A (S1→S2→S3): Same character at home — SERIAL
Block B (S4→S5): Travel montage, different locations — PARALLEL (independent)
Block C (S6→S7→S8): Same character at new destination — SERIAL

Timeline: [Block A serial] + [Block B parallel] + [Block C serial]
Total time: ~24min (A) + ~8min (B, parallel) + ~24min (C) = ~56min
vs full serial: ~64min
vs full parallel: ~8min but no continuity
```

## Visual Consistency

### Visual Anchor — Style vs Mood

The visual anchor locks persistent style DNA across all segments. **It must NOT contain scene-specific mood or contradictory instructions.**

**What goes in the anchor (same for every segment):**
- Film texture: `cinematic, shallow depth of field, film grain`
- Art style: `historical period drama` or `3D CG animation`
- Persistent environmental texture: `ancient Chinese architecture, wooden beams`

**What does NOT go in the anchor:**
- Color mood that changes between scenes (warm/cold)
- Emotional tone (tense, joyful, tragic)
- Weather or time of day
- Scene-specific details

```
GOOD anchor: Cinematic period drama, shallow depth of field, film grain.

BAD anchor:  Warm amber tones shifting to cold blue-grey, cinematic, tense atmosphere.
             (Contradictory — model doesn't know which color to use)
```

**Scene-specific mood goes in the time segments:**
```
Cinematic period drama, shallow depth of field, film grain.

[0-5s] Golden afternoon light fills the room. She smiles, looking at the letter...
[10-15s] The light fades to cold grey. Her expression hardens...
```

### Concept Art as ref_image

Generate a concept art sheet before any video segments:
```bash
renoise-cli.mjs task generate --model nano-banana-2 --resolution 2k --ratio 16:9 \
  --prompt "Concept art sheet for [project]. Key visual elements: [list]."
```

Upload and pass to every segment via `--materials "CONCEPT_ID:ref_image"`.

**When using ref_image, keep the text anchor minimal** — the image already provides style context. A verbose text anchor on top of ref_image creates redundancy and potential contradictions.

```
With ref_image:    "Cinematic period drama, film grain."  (short — image does the rest)
Without ref_image: "Cinematic period drama, warm golden palette,
                    vintage architecture, earth-toned clothing, shallow DOF, film grain."
                    (longer — text must carry all style information)
```

### Priority order for consistency
1. `--characters "ID"` (strongest — exact face/body from Character Library; no privacy detection issues)
2. `--materials "asset:ID:reference_image"` (strong — user-uploaded or AI-generated face photo, registered as asset to bypass privacy detection)
3. `--materials "ID:ref_video"` (strong — continues from previous segment visually)
4. `--materials "ID:ref_image"` with concept art (medium — locks style/palette; raw materials with faces will be blocked)
5. Text-only anchor (weakest — model may drift, but safest for any content)

> **Key insight**: Privacy detection is based on **source**, not role. Raw materials with faces are blocked. Registered assets and Character Library entries bypass detection. When you have face images, always `asset register` first.

## Narrative Continuity

### Energy Planning

Plan energy levels in the **project JSON**, NOT in the prompt. HTML comments like `<!-- Energy: 5→7→8 -->` are ignored by the model and waste tokens.

Express energy through actual scene content:
- **High energy**: fast action verbs, rapid camera movement, bright/harsh lighting
- **Low energy**: slow movements, held shots, soft lighting, silence

### Rules
- Never write 3+ segments at the same energy level
- Drop energy at least 2 points before the climax segment
- After any high-energy segment, the next should open calmer

### Segment Endings

- **Last segment of the film**: End with `frame holds steady` for a clean ending
- **Mid-film segments**: End with motion or a gaze direction that leads naturally to the next segment. Do NOT end every segment with `frame holds steady` — this creates jarring freeze-then-new-scene cuts when concatenated

## Prompt Writing Principles

### Basic Rules
1. **Scene descriptions must be in English** — the model understands English scene/camera/action prompts best. Dialogue lines can be in any language (see Sound & Dialogue section)
2. **Natural narrative** — coherent descriptive paragraphs, not comma-separated tag lists
3. **Specific > Abstract** — `a golden retriever running through shallow ocean waves at sunset` beats `a dog on a beach`
4. **One mood per segment** — do not ask for contradictory tones in the same prompt
5. **Every token must earn its place** — no meta-commentary, no HTML comments, no instructions the model ignores

### Prompt Structure

```
Style (1 line) + Character (full Bible, if present) + Time Segments (2-3) + Sound Design + Negative
```

- **Style**: Persistent visual DNA only (see Visual Anchor section)
- **Character**: Full appearance + wardrobe verbatim from Bible. Never abbreviate.
- **Time Segments**: 2-3 stages with smooth camera flow
- **Sound Design**: One line at the end for ambient/SFX
- **Negative**: `No text, subtitles, watermarks, or logos.`

### Action Writing — CRITICAL

The model generates **video**, not photos. Every shot needs visible motion.

**Level 1 (bad)**: State verbs — `stands`, `sits`, `holds`, `looks`
**Level 2 (ok)**: Basic action — `walks forward`, `picks up cup`
**Level 3 (good)**: Action + body detail — `reaches up to touch the branch, fingers brushing the bark, sleeve falling back to reveal his wrist`
**Level 4 (great)**: Action + micro-movement — `reaches up to touch the branch. Wind catches his robe — it billows. His fingers brush the bark gently. A petal detaches and drifts past his face.`

Rules:
- Every shot must have at least one verb of motion
- Add micro-movements: hair blowing, fingers tightening, fabric rippling, chest rising with breath
- Describe the arc of motion: `raises the sword from hip to overhead` not `holds sword up`
- Physical reactions: when things collide, describe aftermath (dust, recoil, fabric displacement)

### Camera Writing — CRITICAL

Camera movement is what makes the viewer *feel* the scene.

**Level 1 (bad)**: Label only — `tracking shot`, `push-in`
**Level 2 (ok)**: Direction — `camera tracks right`, `slow dolly in`
**Level 3 (good)**: Direction + speed + purpose — `camera slowly pushes in toward his face, narrowing the frame as his expression darkens`
**Level 4 (great)**: Direction + speed + reveal — `camera pulls back from his face, revealing the vast empty corridor behind him — he is completely alone`

Rules:
- Camera and subject move together
- Describe what the movement reveals
- Speed changes matter: `starts slow, accelerates as the horse gallops`
- Stick to movements the model can execute (see Model Reality Check)

### Camera Movement Reliability Guide

| Movement | Reliability | Notes |
|----------|-------------|-------|
| Slow push in / dolly in | ★★★ | Most reliable. Use as default for emotional scenes |
| Pull back / reveal | ★★★ | Great for establishing shots and reveals |
| Smooth orbit | ★★★ | Excellent for product showcase and character intro |
| Tracking alongside subject | ★★★ | Works well when subject has clear linear motion |
| Tilt up / tilt down | ★★★ | Simple and effective for reveals |
| Static / locked-off | ★★★ | Reliable for held emotional moments |
| Crane up (rising) | ★★☆ | Usually works, sometimes jerky |
| Handheld feel | ★★☆ | Adds texture but can be excessive |
| Slow motion | ★★☆ | Approximate, not frame-accurate |
| Low angle / worm's eye | ★★☆ | Works for static setups, less reliable with motion |
| Overhead / bird's eye | ★★☆ | Works for static scenes, less reliable with action |
| Whip pan | ★☆☆ | Unpredictable, often doesn't look right |
| Dolly zoom / vertigo | ★☆☆ | Rarely executes correctly, avoid |
| Rack focus | ★☆☆ | Model doesn't reliably control focus plane |
| Dutch angle | ★☆☆ | Sometimes works, often ignored |

**Stick to ★★★ and ★★☆ movements.** Only use ★☆☆ if you're willing to re-generate on failure.

### Lighting — Persistent vs Reactive

Two ways to describe lighting in prompts:

**Persistent lighting** — fixed throughout the segment:
```
Warm golden hour side-lighting through tall windows.
```

**Reactive lighting** — changes in response to the action (more dynamic, works well for action/drama):
```
Lighting shifts with the intensity of the confrontation — warm when calm, harsh when voices rise.
Dynamic lighting synced with combat intensity — dim during stalking, bright flashes on each strike.
```

Reactive lighting gives the model creative freedom to match mood to action. Use it for action, horror, thriller, and emotional drama. Use persistent lighting for product, lifestyle, and atmospheric scenes.

### Camera as Persistent Style vs Per-Stage Instructions

Two valid approaches for camera direction:

**Per-stage** (Approach A prompts): Specify camera movement in each time segment.
```
[0-5s] Camera slowly pushes in... [5-10s] Camera orbits... [10-15s] Camera pulls back...
```

**Persistent style** (Approach B prompts): Describe the overall camera behavior once, let the model execute.
```
Camera: 360-degree orbital tracking shots, capturing every angle of the interaction.
Camera: Handheld documentary-style, following the subject through the crowd.
Camera: Locked-off wide shot, observing from a distance like a surveillance camera.
```

Persistent style works especially well for:
- Action/fight scenes (complex choreography, camera needs to react)
- Continuous movement scenes (walking, dancing, chasing)
- Any scene where prescribing exact per-second camera feels forced

### Sound & Dialogue — CRITICAL

The model CAN generate spoken dialogue with lip-sync, but ONLY with the exact embedding format.

#### Dialogue Embedding Format (Mandatory)

```
Spoken dialogue (say EXACTLY, word-for-word): "[line in user's language]"
Tone: [emotion]. Mouth clearly visible when speaking, lip-sync aligned.
```

All three parts required: prefix, quoted line, suffix.

#### Rules
1. **Dialogue language matches the user's language** — if the user speaks Chinese, dialogue should be Chinese. If English, use English. The model supports multilingual lip-sync.
2. **One line per time segment** — don't cram multiple lines
3. **Place AFTER visual/action description** in each segment
4. **Keep lines short** — 5-15 words. Long sentences degrade lip-sync
5. **Always include `Tone:`** — emotional direction improves delivery
6. **No dialogue?** — add `No spoken dialogue.` at end, use `Sound design:` instead

#### Example — Drama with Dialogue
```
Cinematic drama, shallow depth of field, film grain.

A woman, late 30s, dark curly hair pulled back, sharp eyes, grey blazer over white shirt.

[0-5s] Medium shot — the woman sits at a cluttered office desk, flipping through
a thick folder. She pauses on one page, taps it with her finger. Camera slowly pushes in.
Spoken dialogue (say EXACTLY, word-for-word): "These numbers don't add up."
Tone: calm but firm. Mouth clearly visible when speaking, lip-sync aligned.

[5-10s] A nervous young man in a wrinkled shirt stands across the desk, shifting
his weight from foot to foot. Camera holds in medium two-shot.
Spoken dialogue (say EXACTLY, word-for-word): "There might be a typo in the report."
Tone: nervous, apologetic. Mouth clearly visible when speaking, lip-sync aligned.

[10-15s] The woman closes the folder and leans back in her chair. A faint smile
crosses her face. Camera slowly pushes in to close-up. Frame holds.
Spoken dialogue (say EXACTLY, word-for-word): "I'll handle it from here."
Tone: quiet confidence. Mouth clearly visible when speaking, lip-sync aligned.

Sound design: paper rustling, office hum, distant phone ringing.
No text, subtitles, watermarks, or logos.
```

### Sound Design & Audio Style

Audio instructions go at the END of the prompt. Two approaches:

**Specific SFX** — list individual sounds when particular sounds matter:
```
Sound design: door slam, rain on glass, footsteps on gravel, distant siren.
```

**Cultural/genre reference** — one phrase that sets tempo, instruments, and mood (often more effective than listing sounds):
```
Audio style: French New Wave film score.
Audio style: 80s John Carpenter synth thriller.
Audio style: Studio Ghibli pastoral soundtrack.
Audio style: Ennio Morricone spaghetti western.
```

**When to use which:**
- Genre reference when vibe matters more than specific sounds (action, mood pieces)
- Specific SFX when particular sounds are plot-critical (a gunshot, a phone ring, a crash)
- Combine both: `Audio style: noir jazz. Sound design: rain on window, typewriter clicks.`

### Negative & Technical Quality Constraints

Every prompt should end with two blocks:

**Negative constraints** (what to exclude):
```
No text, subtitles, watermarks, or logos.
```
Add scene-specific negatives as needed: `No modern elements.` `No anime style.`

**Technical quality constraints** (optional, for photorealistic content):
```
Quality: natural fluid motion, photorealistic skin textures, consistent lighting.
Avoid: deformed limbs, extra or missing fingers, body clipping, motion blur artifacts, color banding.
```

These are especially important for:
- Character close-ups (hands, faces)
- Action scenes (limb deformation is common)
- Photorealistic style (AI smoothing artifacts)

For stylized/animated content, technical constraints are less needed — the model handles those styles more naturally.

### Technical Parameters — API vs Prompt

**DO NOT put in prompt** (use API params): aspect ratio, frame rate, resolution, duration
**DO put in prompt** (visual style): color palette, DOF, film texture, lighting mood

### Style Keywords Cheat Sheet

| Category | Example Keywords |
|----------|-----------------|
| Texture | cinematic, film grain, HDR, RAW |
| Color | warm golden palette, desaturated blue-grey, high contrast, neon |
| Lighting | golden hour, rim light, volumetric light, natural light |
| Style | documentary, vlog, commercial, Hollywood blockbuster, indie film |
| Animation | 3D CG animation, cel-shaded anime, ink wash painting, pixel art |

## Complete Example: 30s Drama (2 segments, serial chain)

### Segment 1 (0-15s) — SETUP
```
Cinematic period drama, shallow depth of field, film grain.

A woman, late 20s, shoulder-length black hair with auburn highlights, cream knit cardigan
over charcoal turtleneck, small gold hoop earrings.

[0-5s] Wide shot of a sunlit cafe interior — wooden shelves, hanging plants, morning light
streaming through tall windows. The woman sits alone at a corner table. Camera slowly
pushes in toward her.

[5-10s] Medium shot — she wraps both hands around a steaming ceramic mug. She lifts it,
takes a sip, and her eyes drift to the window. A quiet moment of contentment. Camera
gently orbits to a side angle.
Spoken dialogue (say EXACTLY, word-for-word): "This is my favorite place in the city."
Tone: warm, peaceful. Mouth clearly visible when speaking, lip-sync aligned.

[10-15s] She sets the mug down and reaches into her bag, pulling out a worn leather
journal. She opens it and begins to write. Camera continues pushing in toward the journal.
Her pen moves across the page.

Sound design: quiet cafe ambience, distant espresso machine, soft jazz.
No text, subtitles, watermarks, or logos.
```

### Segment 2 (15-30s) — PAYOFF (uses S1 as ref_video)
```
Cinematic period drama, shallow depth of field, film grain.

A woman, late 20s, shoulder-length black hair with auburn highlights, cream knit cardigan
over charcoal turtleneck, small gold hoop earrings.

Continuing from the previous shot:

[0-5s] Close-up of her hand writing in the journal. The pen pauses. She looks up toward
the cafe door. Camera follows her gaze with a gentle pan.

[5-10s] Medium shot — a man enters the cafe, brushing rain from his coat. She stands up,
face breaking into a wide smile. Camera pulls back to capture both of them as he walks
toward her table.
Spoken dialogue (say EXACTLY, word-for-word): "You actually came."
Tone: surprised, delighted. Mouth clearly visible when speaking, lip-sync aligned.

[10-15s] They embrace briefly. She gestures to the seat across from her. They sit together.
Camera slowly pulls back to a wide shot through the rain-streaked cafe window. Two warm
figures framed by the cozy interior. Frame holds steady.

Sound design: rain on glass, cafe ambience, warmth.
No text, subtitles, watermarks, or logos.
```
