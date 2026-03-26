# Example: Mystery Package — 4-Shot Short Film

A complete walkthrough of the 6-phase workflow for a 45-second suspense short film.

## Phase 1 — Story & Character Bible

### Story Concept
Maya comes home to find a mysterious package at her door. Inside is an antique pocket watch that glows when she holds it. As she examines it, the watch hands start spinning backwards and the room fills with golden light.

### Story Structure
- **Beginning** (8s): Maya discovers the package
- **Development** (13s): She opens it, finds the watch
- **Climax** (12s): The watch activates, supernatural event
- **Resolution** (12s): Aftermath, sense of wonder

### Character Bible

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

### Style Guide

```json
{
  "visual_style": "Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares",
  "color_palette": "Warm amber tones with cool blue shadows, muted saturation shifting to warm gold in climax",
  "lighting": "Soft golden hour side-lighting through large windows, practical lamps as warm fill, cool blue ambient from hallway",
  "camera_language": "Slow deliberate movements, lingering close-ups, occasional wide establishing shots, push-ins for tension",
  "negative_prompts": "No cartoon, no anime, no oversaturated colors, no dutch angles, no text overlays, no watermarks, no horror, no jump scares"
}
```

## Phase 2 — Music & Beat Analysis

### Music Selection
AI-generated via Suno with prompt: "Cinematic suspense, slow build, mysterious piano with subtle strings, 90 BPM, 45 seconds, rising tension to warm resolution"

### Beat Analysis Output

```json
{
  "bpm": 92,
  "total_duration_s": 46.2,
  "beats": [0.65, 1.30, 1.96, 2.61, 3.26, 3.91, ...],
  "sections": [
    { "start": 0, "end": 8.5, "label": "intro" },
    { "start": 8.5, "end": 22.0, "label": "verse" },
    { "start": 22.0, "end": 34.5, "label": "chorus" },
    { "start": 34.5, "end": 46.2, "label": "outro" }
  ],
  "suggested_cuts": [
    { "time": 0, "end": 8.5, "duration": 8.5, "section": "intro" },
    { "time": 8.5, "end": 22.0, "duration": 13.5, "section": "verse" },
    { "time": 22.0, "end": 34.5, "duration": 12.5, "section": "chorus" },
    { "time": 34.5, "end": 46.2, "duration": 11.7, "section": "outro" }
  ]
}
```

### Finalized Shot Durations
- S1: 8s (intro) — rounded down from 8.5s
- S2: 13s (verse) — rounded down from 13.5s
- S3: 12s (chorus) — rounded down from 12.5s
- S4: 12s (outro) — rounded up from 11.7s

## Phase 3 — Shot Table

### S1 — Discovery (8s, intro)

| Field | Value |
|-------|-------|
| scene | Dimly lit apartment hallway, warm overhead pendant light, beige walls, mailboxes on the left, Maya's door at the end |
| characters | CHAR_MAYA |
| action | Maya walks down hallway carrying grocery bags, notices a small wrapped package on her doormat, sets bags down, picks up the package with both hands, looks at it curiously |
| camera | [0-3s] Medium tracking shot following Maya from behind. [3-5s] Over-shoulder angle as she bends to set bags down. [5-8s] Slow push-in to her hands picking up the package, then to her face. |
| dialogue | [2s] (keys jingling) [5s] "Hmm... what's this?" [7s] (paper crinkling) |
| beat_sync_notes | Beat 4 (2.6s) = Maya spots the package; Beat 8 (5.2s) = hands close around package |
| continuity_in | null |
| continuity_out | Standing at apartment doorway, both hands holding small wrapped package at chest height, curious expression with slight head tilt, warm pendant light from above casting soft shadows, grocery bags on floor beside her |

### S2 — The Watch (13s, verse)

| Field | Value |
|-------|-------|
| scene | Maya's apartment living room, warm table lamp on wooden desk, large window with twilight blue light, cozy cluttered space with books and plants |
| characters | CHAR_MAYA |
| action | Maya sits at desk, carefully unwraps the brown paper to reveal a worn velvet box, opens it to find an ornate gold pocket watch with intricate engravings, lifts it out, holds it up to the lamp light, the watch face catches the light beautifully |
| camera | [0-4s] Medium shot of Maya sitting down at desk, setting package on it. [4-8s] Close-up of her hands unwrapping. [8-11s] Macro shot of watch being lifted from velvet box. [11-13s] Medium close-up of Maya holding watch up to lamp, wonder in her eyes. |
| dialogue | [3s] "Let me see..." [6s] (paper tearing slowly) [9s] (soft gasp) "Oh..." [12s] "It's beautiful..." |
| beat_sync_notes | Beat 2 (1.3s) = paper tearing begins; Beat 8 (5.2s) = box lid opens; Beat 12 (7.8s) = watch lifted from box |
| continuity_in | Standing at apartment doorway, both hands holding small wrapped package at chest height, curious expression with slight head tilt, warm pendant light from above casting soft shadows, grocery bags on floor beside her |
| continuity_out | Seated at wooden desk, right hand holding gold pocket watch up at eye level, left hand resting on desk, warm amber lamp light reflecting off watch face, twilight blue from window behind her, expression of quiet wonder |

### S3 — Activation (12s, chorus)

| Field | Value |
|-------|-------|
| scene | Same apartment living room, but lighting shifts — the gold pocket watch begins emitting a warm golden glow, gradually filling the room with golden light particles |
| characters | CHAR_MAYA |
| action | Maya turns the watch over in her hands, the watch hands begin spinning backwards rapidly, a warm golden light emanates from the watch face, light particles float upward from the watch, Maya's eyes widen in shock then fascination, the golden glow intensifies filling the room |
| camera | [0-3s] Extreme close-up of watch face, hands starting to spin. [3-6s] Pull back to medium shot as golden light begins emanating. [6-9s] Low angle looking up at Maya with golden particles floating around her. [9-12s] Wide shot of the entire room bathed in golden light, Maya at center. |
| dialogue | [2s] "Wait... the hands are..." [5s] (mechanical ticking accelerating) [8s] (awed whisper) "Oh my god..." |
| beat_sync_notes | Beat 1 (0.65s) = watch hands start spinning; Beat 6 (3.9s) = golden light burst; Beat 10 (6.5s) = room fully illuminated |
| continuity_in | Seated at wooden desk, right hand holding gold pocket watch up at eye level, left hand resting on desk, warm amber lamp light reflecting off watch face, twilight blue from window behind her, expression of quiet wonder |
| continuity_out | Standing up from desk (chair pushed back), both hands cupping the glowing watch at chest level, entire room bathed in warm golden light with floating particles, Maya's face illuminated gold, expression of awe and wonder, eyes reflecting golden light |

### S4 — Wonder (12s, outro)

| Field | Value |
|-------|-------|
| scene | Apartment living room, golden light slowly fading back to warm amber, particles settling like golden dust, the watch glow softens to a gentle pulse |
| characters | CHAR_MAYA |
| action | Maya slowly lowers the watch, the golden light fades to a gentle pulsing glow from the watch face, she looks around the room in wonder at the settling golden dust, gently places the watch on the desk, steps back, the watch pulses once more with a soft glow, she smiles with a mix of wonder and excitement |
| camera | [0-3s] Close-up of Maya's illuminated face, golden light fading. [3-6s] Medium shot as she lowers the watch, golden particles settling around her. [6-9s] Over-shoulder shot as she places watch on desk. [9-12s] Final wide shot of room, Maya standing, watch pulsing gently on desk, warm amber atmosphere. |
| dialogue | [3s] (gentle exhale) [6s] "What are you..." [10s] (soft, wondering smile — no words) |
| beat_sync_notes | Beat 3 (1.95s) = golden light begins fading; Beat 8 (5.2s) = watch placed on desk; Final beat (11s) = last pulse of light |
| continuity_in | Standing up from desk (chair pushed back), both hands cupping the glowing watch at chest level, entire room bathed in warm golden light with floating particles, Maya's face illuminated gold, expression of awe and wonder, eyes reflecting golden light |
| continuity_out | Standing 2 steps back from desk, hands at sides, warm amber room lighting restored, gold pocket watch on desk pulsing with gentle glow, expression of wonder and quiet excitement, evening twilight through window |

## Phase 4 — Seedance Prompts

### S1 Prompt

```
Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation. Soft golden hour side-lighting through large windows, practical lamps as warm fill, cool blue ambient from hallway.

Character: East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build. Wearing oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots. Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings.

[0-3s] Medium tracking shot following Maya from behind as she walks down a dimly lit apartment hallway carrying grocery bags. Warm pendant light overhead, beige walls, mailboxes on the left. At 2.6s (on the beat): she spots a small wrapped package on her doormat and slows.

[3-5s] Over-shoulder angle as she bends to set grocery bags on the floor beside the door. Natural, unhurried movement.

[5-8s] Slow push-in as her hands pick up the small brown-paper-wrapped package. At 5.2s (on the beat): her fingers close around it. She lifts it to chest height and tilts her head with curiosity. At 5s she says "Hmm... what's this?" softly.

Avoid: No cartoon, no anime, no oversaturated colors, no dutch angles, no text overlays, no watermarks, no horror, no jump scares.
```

### S2 Prompt

```
Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation. Soft golden hour side-lighting through large windows, practical lamps as warm fill, cool blue ambient from hallway.

Continuing from the previous shot: Standing at apartment doorway, both hands holding small wrapped package at chest height, curious expression with slight head tilt, warm pendant light from above casting soft shadows, grocery bags on floor beside her.

Character: East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build. Wearing oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots. Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings.

[0-4s] Medium shot of Maya walking into her apartment living room and sitting down at a wooden desk with a warm table lamp. She places the package on the desk. Large window behind her shows twilight blue light. At 1.3s (on the beat): she begins pulling at the brown paper wrapping.

[4-8s] Close-up of her hands carefully unwrapping the brown paper to reveal a worn navy velvet box. At 5.2s (on the beat): the box lid opens to reveal an ornate gold pocket watch with intricate engravings. At 6s she whispers "Let me see..."

[8-11s] Macro shot of the gold pocket watch being lifted from the velvet box. Intricate engravings catch the warm lamp light. At 7.8s (on the beat): Maya lifts it free. She gasps softly "Oh..." at 9s.

[11-13s] Medium close-up of Maya holding the pocket watch up to the lamp at eye level. Warm amber light reflects off the watch face. Her expression is quiet wonder. She says "It's beautiful..." at 12s.

Avoid: No cartoon, no anime, no oversaturated colors, no dutch angles, no text overlays, no watermarks, no horror, no jump scares.
```

### S3 Prompt

```
Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation shifting to warm gold in climax. Soft golden hour side-lighting through large windows, practical lamps as warm fill.

Continuing from the previous shot: Seated at wooden desk, right hand holding gold pocket watch up at eye level, left hand resting on desk, warm amber lamp light reflecting off watch face, twilight blue from window behind her, expression of quiet wonder.

Character: East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build. Wearing oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots. Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings.

[0-3s] Extreme close-up of the gold pocket watch face. At 0.65s (on the beat): the watch hands begin spinning backwards rapidly. Mechanical ticking sound accelerates. The ornate engravings shimmer. Maya whispers at 2s "Wait... the hands are..."

[3-6s] Pull back to medium shot. At 3.9s (on the beat): a warm golden light bursts from the watch face. Golden light particles begin floating upward from the watch. The amber room lighting intensifies to golden.

[6-9s] Low angle looking up at Maya. Golden particles float all around her like luminous dust motes. At 6.5s (on the beat): the entire room is bathed in golden light. She stands up slowly from the desk, cupping the watch in both hands. At 8s she whispers in awe "Oh my god..."

[9-12s] Wide shot of the entire living room transformed by golden light. Maya at center, standing, both hands cupping the glowing watch at chest level. Golden particles fill the air like a supernatural snowfall. Her face is illuminated in pure gold.

Avoid: No cartoon, no anime, no oversaturated colors, no dutch angles, no text overlays, no watermarks, no horror, no jump scares.
```

### S4 Prompt

```
Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares. Warm amber tones with cool blue shadows, muted saturation. Soft golden hour side-lighting through large windows, practical lamps as warm fill.

Continuing from the previous shot: Standing up from desk (chair pushed back), both hands cupping the glowing watch at chest level, entire room bathed in warm golden light with floating particles, Maya's face illuminated gold, expression of awe and wonder, eyes reflecting golden light.

Character: East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build. Wearing oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots. Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings.

[0-3s] Close-up of Maya's face bathed in golden light. At 1.95s (on the beat): the golden light begins slowly fading. The golden particles start drifting downward like settling dust. A gentle exhale at 3s.

[3-6s] Medium shot as Maya slowly lowers the watch from chest height. Golden particles settle around her like luminous dust. The room's warm amber lighting gradually returns to normal. She looks around the room in wonder. At 6s she whispers "What are you..."

[6-9s] Over-shoulder shot as she gently places the gold pocket watch on the wooden desk. At 5.2s (on the beat): the watch touches the desk surface. The glow from the watch face softens to a gentle pulse. Table lamp and twilight window light return to dominance.

[9-12s] Final wide shot of the apartment living room. Maya stands two steps back from the desk, hands at her sides. The gold pocket watch on the desk pulses once more with soft golden light. At 11s (final beat): the last gentle pulse. Maya smiles with quiet wonder and excitement. Warm amber evening atmosphere, twilight through the window.

Avoid: No cartoon, no anime, no oversaturated colors, no dutch angles, no text overlays, no watermarks, no horror, no jump scares.
```

## Phase 5 — Generation

### Cost Estimate

```
S1 (8s):  ~4 credits
S2 (13s): ~6 credits
S3 (12s): ~6 credits
S4 (12s): ~6 credits
Total:    ~22 credits
```

### Batch Command

```bash
bash batch-generate.sh \
  --project mystery-package \
  --ratio 16:9 \
  --prompts-file prompts.json
```

## Phase 6 — Assembly Guide

### Clip Summary

| Shot | Duration | Section | Key Moment |
|------|----------|---------|------------|
| S1   | 8s       | intro   | Maya discovers package |
| S2   | 13s      | verse   | Opens watch |
| S3   | 12s      | chorus  | Watch activates, golden light |
| S4   | 12s      | outro   | Light fades, wonder remains |

### Transitions

- S1 → S2: **Cross dissolve** (0.5s) — location change from hallway to living room
- S2 → S3: **Hard cut** — same location, continuous action
- S3 → S4: **Hard cut** — same location, continuous action

### BGM Instructions

1. Import all 4 clips sequentially in CapCut/Premiere/DaVinci
2. Mute all AI-generated audio tracks
3. Place `bgm.aac` on the audio timeline starting at 0:00
4. S1 starts at 0:00, S2 at 8s, S3 at 21s, S4 at 33s
5. Keep any natural SFX you like (paper crinkling, ticking) by un-muting selectively
6. Export 16:9, 30fps, H.264

### Color Grading Notes

Apply a unified LUT or color grade across all clips to ensure:
- Consistent skin tones for Maya across all 4 clips
- Smooth color temperature transitions (cool hallway → warm room → golden climax → warm resolution)
- Match the amber/blue shadow palette from the Style Guide
