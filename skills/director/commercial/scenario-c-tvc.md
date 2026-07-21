# Scenario C — TVC / Brand Concept Film

**Trigger**: Brand film >5s, or any video that needs multiple shots — lifestyle, outdoor, fashion, sports, aspirational campaigns, or product films with narrative structure. Scenario C naturally contains Scenario B-style product close-ups as segments within a larger piece.

**Not Scenario C if**: the user wants a presenter speaking to camera → use Scenario D. The user has a reference video to replicate → use Scenario A.

---

## Six-Dimension Emphasis

| Dimension | Emphasis |
|-----------|----------|
| **Subject** | Person + product exist together as storytelling elements — neither dominates; anchor both with `@` references |
| **Selling-Point Action** | Replace feature callouts with cinematic micro-moments: product interacting with environment (boot crushing wet grass, jacket catching wind), body language conveying effort or freedom |
| **Scene & Tone** | Rich, specific environments — anchor with `@scene image`; describe light quality (golden morning haze, blue-hour ridge glow), atmosphere, and how the environment feels physically |
| **Camera Language** | Follow the user's shot ideas if specified. If unspecified, propose a shot plan and wait for confirmation before writing prompts. |
| **Audio** | No dialogue — music-driven. Write a **unified audio direction** spanning the entire video, with per-shot accents. |
| **Post-Production** | Person consistency across all shots; end frame reserved for slogan/logo (fade to black + centered text); no jump cuts |

---

## Two Modes Based on Total Duration

### Mode A: Single clip within the selected model's live maximum — PREFERRED

Generate as **one single API call**. Write all visual stages into one prompt + a unified audio direction at the end. The model renders them as a continuous flowing video with coherent audio. No assembly needed.

**The prompt has three parts:**
1. **Shot descriptions** — each shot as its own paragraph, labeled `[Shot N | Xs | label]`. Camera, subject, action, environment per shot. The model flows between shots as smooth transitions, not hard cuts.
2. **Unified audio direction** — one paragraph describing the overall soundscape across the entire video, plus per-shot audio accents tied to specific visual moments.
3. **Post-production constraints** — consistency rules, negative constraints.

**How to determine the shot plan:**
- User has clear shots → use them directly and polish
- Brief is vague → propose a shot plan and wait for user confirmation before writing the prompt

**Default arc when unspecified** (adjust freely):
```
[Shot 1 | 5s | Establishing] Ultra-wide panoramic of [environment], [light quality], camera slowly pushing forward.
[Shot 2 | 5s | Character Intro] [Person] wearing [product], [action], follow-cam tracking, [environmental detail].
[Shot 3 | 5s | Product Detail] Macro close-up of [product interacting with environment], camera orbiting. Fade to black.
```

**Example prompt** (hiking boot TVC; timing shown for one example duration):

> Ultra-wide panoramic of mountain ranges and open ridge, referencing the environment from @Image 1. Golden morning mist drifts across the slopes, camera slowly and steadily pushes forward through the landscape. **[Shot 1 | 5s | Establishing]**
>
> A man wearing the hiking boots from @Image 2 strides along a mountain trail with purpose, follow-cam tracking alongside him at ground level. Wind moves his clothing and the surrounding tall grass, natural and unposed. **[Shot 2 | 5s | Character in Motion]**
>
> Macro slow-motion close-up of the hiking boots stepping into wet grass — grass blades bending under the sole, morning dew splashing in soft arcs. Camera orbits slowly to reveal the boot from multiple angles. Frame holds, then fades to black. **[Shot 3 | 5s | Product Detail]**
>
> **[Audio]** Background soundscape of crisp birdsong and wind rustling through pine trees throughout. When the hiker appears in Shot 2, a gentle acoustic guitar strum fades in. During the boot close-up in Shot 3, the music swells softly with a warm bass note as the dewdrops splash. No dialogue, no sudden loud sounds.
>
> **[Post-Production]** Person's appearance and boot design must remain consistent throughout. No visible product logos until the final fade. No frame flickering, no distorted faces.

---

### Mode B: Multi-clip — when duration exceeds the selected model's live maximum

Split into segments whose durations are advertised by `renoise model <selected-model> --json`; each segment follows the same Mode A format.

After all segments are generated, concatenate and replace audio:

```bash
# Concatenate
printf "file '%s'\n" S1.mp4 S2.mp4 S3.mp4 > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy final.mp4

# Strip AI audio, apply unified BGM
ffmpeg -y -i final.mp4 -an -c:v copy final-silent.mp4
ffmpeg -y -i final-silent.mp4 -i bgm.mp3 -c:v copy -c:a aac -shortest final-with-bgm.mp4
```

Before assembly, ask: **"Do you have a BGM file? If not, I can deliver the silent version for you to add music in post."**

If the user wants to redo a specific segment: regenerate that segment only, replace the file, re-run assembly.

---

## Phase 3: Storyboard Preview Format (Scenario C)

Present all shots together so the user sees the complete video in one view:

```
--- 分镜预览 (N shots / total Xs) ---

[Shot 1 | Xs | label]
[Full prompt for shot 1]

[Shot 2 | Xs | label]
[Full prompt for shot 2]

[Shot N | Xs | label]
[Full prompt for shot N]

--- Asset Mapping ---
@Image 1 → [filename] → ref_image (all shots)

--- Generation Parameters ---
Model: [live-capability selection] | Ratio: [advertised value] | Total estimated cost: run `renoise task cost <model> --json` per segment and sum
Note: Each shot is a separate segment, assembled by ffmpeg.
---
```

---

## Example

**Brief**: Push an ultra-thin diaper. First 3 seconds must hook moms on the pain point (baby with diaper rash crying), then cut to the product and demonstrate breathability. Fast pace.

**Assets**:
- `@Image 1` (product flat-lay photo) → subject anchor
- Viral reference video (Gemini analysis only — not uploaded to Renoise)

**Gemini analysis**:
- Camera: fast whip-pan at 3s, handheld close-up in opening
- Expression: mother's anxious close-up, furrowed brows
- Pacing: rapid cuts every 1–2s, tension builds in first half
- Scene: warm-toned home nursery, soft natural light

**Prompt**:

> Close-up of a young mother with furrowed brows, holding a crying baby, expressing extreme anxiety — handheld camera, slightly shaky, tight on face. **[Visual Hook (Opening)]**
>
> At the 3-second mark, camera whip-pans horizontally to the baby diaper product from @Image 1. **[Subject]**
>
> Product lies flat on a table surface as a burst of steam instantly penetrates from the bottom through the top layer, viscerally demonstrating breathability. **[Selling-Point Action]**
>
> Warm, bright home nursery environment, high-saturation warm color palette, soft natural light. Fast cuts every 1–2 seconds, tension building through the first half. **[Scene & Tone + Camera Language]**
>
> Actions must not drag, steam effect must be natural without exaggeration, packaging text must be clearly readable, facial features must remain stable and undistorted. **[Post-Production Constraints]**

**Why it works**: The reference video was analyzed by Gemini first — camera, pacing, and expression are encoded as text. The video itself is never uploaded to Renoise. "Breathable" is translated into the visible action of steam penetrating.
