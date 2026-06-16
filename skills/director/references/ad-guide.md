# Ad guide

Break down vague creative briefs into precise, controllable AI video prompts using a six-dimension formula, then generate videos via the Renoise API.

**Announcement**: I'm using the prompt-craft skill to help you build a professional video generation prompt.

## Core Formula

Every prompt must cover the following six dimensions, assembled in this order:

```
Subject + Selling-Point Action + Scene & Tone + Camera Language + Audio + Post-Production Constraints
```

| Dimension | Definition | Ask yourself |
|-----------|-----------|-------------|
| **Subject** (person / product) | The absolute visual center of the frame — determines audience identification and product perception | What should the viewer see first? |
| **Selling-Point Action** (action / micro-story) | Translate abstract sales copy into concrete micro-actions or pain-point scenarios | What visible action makes the viewer "see" the selling point? |
| **Scene & Tone** | Shooting environment, lighting, art direction — gives the viewer a real sense of the product's usage context | Where should the viewer feel they are? |
| **Camera Language** | Professional cinematography to control the frame — specific angles and transitions create visual hooks and impact | How should the camera move to grab attention? |
| **Audio** | Sound effects / beat sync — pre-embed visual actions that align with audio cues | Which moment in the frame must synchronize with sound? |
| **Post-Production Constraints** | Reserve visual space for editing overlays (captions, stickers) and set negative rules (prohibitions) | What flaws must absolutely never appear on screen? |

## Asset Reference Rules

Use `@` references in prompts to anchor visuals to the user's assets. Each `@` reference must state **what is being referenced** and **what it's being used for**:

```
the men's serum glass bottle from @Image 1         ← what was referenced + what info was extracted
reference the camera movement and rhythm of @Video 1  ← explicitly only partial features, not everything
```

Mapping references to Renoise roles:

| Reference type | Prompt syntax | Renoise `--materials` role | Notes |
|---------------|--------------|---------------------------|-------|
| Product / scene image (no faces) | `@Image N` | `ID:ref_image` | Up to 9 |
| Scene image that incidentally contains faces (face NOT being referenced) | `@Image N` | `ID:ref_image` | Treat as scene ref, no registration needed |
| Person image where the face IS being used as character identity | `@Image N` | `asset:ID:reference_image` | Must `asset register` first |
| Reference video | `@Video N` | `ID:ref_video` | Up to 3 |
| Audio | `@Audio N` | Prompt description only, not passed to materials | For beat-sync guidance |
| First frame | `@Image N` | `ID:first_frame` | Mutually exclusive with ref_image |

**Face Privacy Rule**: Only images where the face is intentionally used as character identity (passed as `ref_image` with face as the reference target) will be blocked by Renoise's privacy detection. Scene/environment images that incidentally contain faces are fine as `ref_image`. Two bypass paths for face-identity images:
1. `asset register <material_id>` to register as a user asset → `asset:ID:reference_image`
2. Use the platform character library → `--characters "ID"`

---

## Workflow

### Phase 1: Requirement Gathering & Asset Analysis

After receiving the user's request, confirm the following in order:

1. **Creative intent**: What type of video? Match to the appropriate scenario template (see below)
2. **Asset inventory**: Review each image / video / audio the user provides
   - Images: View with the Read tool, analyze content (product? scene? person?)
   - Videos: If the Renoise plugin is available, use Gemini analysis; otherwise ask the user to describe key frames
   - Audio: If the beat analysis script is available, analyze BPM and beat points; otherwise ask the user to describe rhythm characteristics
3. **Assign a role to each asset**: subject anchor / scene calibration / camera reference / beat-sync control
4. **Confirm generation parameters**:
   - Duration: 5–15 seconds per segment (over 15s requires multi-segment chaining)
   - Aspect ratio: based on target platform

| Platform | Recommended ratio |
|----------|------------------|
| TikTok / Douyin / Reels | `9:16` |
| YouTube | `16:9` |
| Xiaohongshu / Pinterest | `3:4` |
| Instagram Feed / WeChat Moments | `1:1` |

If the user's brief is incomplete, **only ask for missing critical information** — don't throw all questions at once. Infer what you can from the assets first.

### Phase 2: Prompt Construction

Write each dimension sequentially, tagging each with its category label in brackets. Writing rules:

**DO:**
- Give each dimension its own paragraph, logically clear
- Place `@` references immediately next to their descriptions, stating "what was referenced" and "what it's used for"
- When referencing a video, explicitly annotate "reference only XX, NOT YY"
- Use concrete micro-actions for selling-point action — never abstract adjectives
- Include at least 2 negative rules (prohibitions) in post-production constraints

**DON'T:**
- Don't write vague terms like "premium feel" or "cinematic" → replace with specific lighting / color / material descriptions
- Don't omit any dimension → all six must be covered
- Don't stuff content from one dimension into another → each dimension has a single responsibility
- Don't assume the AI can automatically understand brand tone → anchor every visual standard with `@` assets

### Phase 3: User Confirmation

Present the prompt to the user in the following format:

```
--- Prompt Preview ---

[Full prompt, each dimension as its own paragraph, tagged with [Dimension Name]]

--- Asset Mapping ---
@Image 1 → [filename / description] → Renoise role: ref_image
@Video 1 → [filename / description] → Renoise role: ref_video
@Audio 1 → [filename / description] → Prompt description only

--- Generation Parameters ---
Model: renoise-2.0
Duration: N seconds
Aspect ratio: W:H
Estimated cost: [show if queryable]
---
```

**Wait for explicit user confirmation before entering Phase 4.** The user may request:
- Modify a specific dimension → change only that dimension, re-present
- Adjust an asset role → update the mapping, re-present
- Switch scenario template → return to Phase 2 and reconstruct

### Phase 4: Asset Upload & Video Generation

After user confirmation, execute the following steps. Report the result after each step.

**Step 1 — Upload assets**

```bash
node skills/renoise-gen/renoise-cli.mjs material upload <file_path>
```

Record the `material_id` returned for each asset. Build a `@reference → material_id` mapping table.

**Step 2 — Register face assets (only when assets contain human faces)**

```bash
node skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "character name"
# Wait ~30–60 seconds for activation
```

Record the returned `asset_id`.

**Step 3 — Translate the prompt to English**

Translate the prompt constructed in Phase 2 into English, preserving the six-dimension structure and `@` reference positions. When translating:
- Use professional cinematography terminology (macro close-up, dolly in, rack focus, whip pan...)
- Keep selling-point action descriptions precise — don't generalize
- Translate post-production constraints into clear negative constraints

**Step 4 — Generate the video**

```bash
node skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "translated English prompt" \
  --model renoise-2.0 \
  --duration <seconds> \
  --ratio <ratio> \
  --materials "<id1>:<role1>,<id2>:<role2>"
```

**Step 5 — Multi-segment chaining (only when video exceeds 15 seconds)**

```bash
# After first segment completes
node skills/renoise-gen/renoise-cli.mjs task chain <segment1_task_id>
# Use returned material_id as ref_video for the next segment
node skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "segment 2 prompt" \
  --materials "<chained_id>:ref_video,<other_materials>"
```

**Step 6 — Return results**

Present the generation result: video URL, cover image, generation time. If the result isn't satisfactory, ask the user whether they'd like to adjust a specific dimension and regenerate.

---

## Scenario Templates

Match the user's intent to the appropriate scenario. Each scenario shifts the emphasis across the six dimensions.

### A. Viral Video Replication

**Trigger**: The user provides a viral/trending video and wants to replicate its style with their own product/brand.

| Dimension | Emphasis |
|-----------|----------|
| Subject | Anchor with `@product image`, replacing the original video's product |
| Selling-Point Action | Replicate the original video's core selling-point action, adapted to the user's product |
| Scene & Tone | Can follow the original video's scene, or adjust to match brand tone |
| Camera Language | `@reference video` extracts camera movement and rhythm only — **explicitly annotate: do NOT reference the original person/product** |
| Audio | Maintain the original video's rhythm structure and beat-sync points |
| Post-Production | Emphasize facial stability, readable product packaging text |

### B. Product Brand Film

**Trigger**: The user needs a short film showcasing product quality and brand tone.

| Dimension | Emphasis |
|-----------|----------|
| Subject | Product is the absolute center — strictly lock appearance and proportions with `@product image` |
| Selling-Point Action | Micro-actions revealing texture/efficacy (water droplets sliding, light reflections flowing...) |
| Scene & Tone | Calibrate with `@scene image` — emphasize lighting and color consistency |
| Camera Language | Steady, slow, refined — macro close-up + slow orbit |
| Audio | Brand music beat sync, reserve timing for logo reveal at the end |
| Post-Production | Product logo must not distort, material texture must be realistic, proportions strictly consistent |

### C. Pain-Point E-Commerce Ad

**Trigger**: The user needs a fast-paced e-commerce video that directly hits consumer pain points (no live presenter — driven by visual effects).

| Dimension | Emphasis |
|-----------|----------|
| Subject | First half: person + pain point; second half: cut to product |
| Selling-Point Action | Exaggerated but realistic contrast effects (steam penetrating, stains vanishing...) |
| Scene & Tone | Close to real-life usage scenario, high-saturation warm tones |
| Camera Language | Fast-paced cuts — use a visual hook in the first 3 seconds to grab attention |
| Audio | Tight rhythm, tense sound effects paired with pain-point visuals |
| Post-Production | Actions must not drag, effects must be natural not over-the-top, facial features must remain stable |

### D. Live-Presenter Product Showcase (Unboxing / Review / Talking-Head)

**Trigger**: The user needs a video with a real person presenting products on camera — unboxing, review, talking-head product endorsement. Has explicit requirements for a person, dialogue/voiceover, and multi-product display.

**Difference from Scenario C**: Scenario C is driven by visual effects (no dialogue). Scenario D is driven by a live presenter speaking on camera (with dialogue and choreographed actions).

**How the six dimensions adapt for this scenario**:

| Dimension | Emphasis | Special requirements |
|-----------|----------|---------------------|
| Subject | Person `@person image` + multiple products `@product images` coexist | Person's outfit must remain unchanged throughout; each product anchored with its own `@` reference, visual details must stay sharp and undistorted |
| Selling-Point Action | **Second-by-second action script**: choreograph person's actions, gestures, and product interactions along a timeline | Must specify start/end seconds, body posture, hand gestures, and which product is being interacted with |
| Scene & Tone | May contain multiple sub-scenes, each described individually | Annotate which time segment each sub-scene appears in; ensure scene transitions align with the action script |
| Camera Language | Primarily fixed camera position, with medium shot / close-up / extreme close-up switching | Annotate each shot-type transition's timestamp, synchronized with the action script |
| Audio | **Dialogue script**: write out the presenter's lines segment by segment | Lip-sync must be consistent with dialogue throughout; voice timbre and speaking pace must be uniform; explicitly annotate silent segments |
| Post-Production | Person consistency + product consistency + lip-sync | Facial features stable and undistorted throughout; product appearance / packaging text clearly readable; outfit unchanged |

**Prompt structure template (live-presenter specific)**:

Unlike other scenarios, live-presenter prompts are organized along a **second-by-second timeline**, with the six dimensions interwoven into the chronology:

```
[Person & product anchoring: all @ references declared upfront, with consistency constraints] [Subject]

[0~Ns: action + dialogue + shot type] [Selling-Point Action + Audio + Camera Language]
[N~Ms: action + dialogue + shot type] [Selling-Point Action + Audio + Camera Language]
...(choreographed segment by segment)

[Scene environment description, with sub-scene breakdown] [Scene & Tone]

[Shot-type switching rules] [Camera Language]

[Consistency constraints + prohibitions] [Post-Production Constraints]
```

### E. Creative Campaign (Reserved for Expansion)

**Trigger**: The user needs a brand short film with narrative structure and creative concepts.

*Core formula unchanged. Emphasis shifts to: narrative structure, emotional arc, visualization of creative concepts. Detailed template to be added later.*

### F. Brand Visual Extension (Reserved for Expansion)

**Trigger**: The user already has an established brand visual system and needs a series of style-consistent videos.

*Core formula unchanged. Emphasis shifts to: brand color palette / typography / visual element consistency anchoring, maintaining series coherence. Detailed template to be added later.*

---

## Rewrite Examples

### Example 1: Men's Serum Brand Film (Scenario B)

**Original brief** (vague, low precision):
> We need a 10-second brand film for a men's serum. Premium feel, highlight the moisturizing effect. Background should be a minimalist modern space with cinematic lighting. End with the brand logo.

**Provided assets**:
- `@Image 1` (product hi-res photo): asset anchor
- `@Image 2` (high-contrast space photo): scene calibration
- `@Audio 1` (brand instrumental music): beat-sync control

**Rewritten prompt**:

> Display the men's serum glass bottle from @Image 1 at the center of the frame, with translucent texture and proportions strictly matching the original. **[Subject]**
>
> Reference @Image 2's minimalist modern space with high-contrast cool blue tones; sidelight creates a sharp, sculpted rim light. **[Scene & Tone]**
>
> Crystalline water droplets condense on the serum surface, slowly sliding down the bottle body, showcasing an intense sense of hydrating moisture. **[Selling-Point Action]**
>
> Camera begins with a macro close-up, slowly and steadily orbiting the bottle while pushing in. **[Camera Language]**
>
> Following the drum beats of @Audio 1, a silver brand logo emerges at the center of the frame in the final 2 seconds. **[Audio]**
>
> No frame flickering, product logo must not distort, water droplet dynamics must be realistic. **[Post-Production Constraints]**

**Why it's good**: Each dimension is independent and concrete; `@` references clearly state "what was referenced" and "what it's used for"; "premium feel" is replaced with "high-contrast cool blue tones + sculpted sidelight rim light"; "moisturizing effect" is translated into the micro-action of "water droplets condensing and sliding down."

---

### Example 2: Ultra-Thin Diaper E-Commerce Ad (Scenario C)

**Original brief**:
> Push an ultra-thin diaper for a volume-driving video. First 3 seconds must hook moms on the pain point (baby with diaper rash crying), then immediately cut to the product, demonstrate how breathable it is, keep the pace fast, get straight to the point!

**Provided assets**:
- `@Image 1` (product flat-lay photo): lock the product
- `@Video 1` (a trending viral video): reference camera movement and expressions only

**Rewritten prompt**:

> Reference the fast-paced camera movement and anxious expression from @Video 1 (note: reference camera movement and expressions only, NOT the original person).
>
> Close-up of a young mother with furrowed brows, holding a crying baby, expressing extreme anxiety. **[Visual Hook (Opening)]**
>
> At the 3-second mark, camera whip-pans horizontally to the baby diaper product from @Image 1. **[Subject]**
>
> Product lies flat on a table surface as a burst of steam instantly penetrates from the bottom through the top layer, viscerally demonstrating breathability. **[Selling-Point Action]**
>
> Warm, bright home nursery environment, high-saturation warm color palette. **[Scene & Tone]**
>
> Actions must not drag, steam effect must be natural without exaggeration, packaging text must be clearly readable, facial features must remain stable and undistorted. **[Post-Production Constraints]**

**Why it's good**: First 3 seconds use a pain-point visual as the hook; `@Video 1` explicitly annotates "reference camera movement and expressions only" to avoid copying original video content; "breathable" is translated into the visualizable action of "steam penetrating"; post-production constraints simultaneously govern effect realism and character stability.

---

### Example 3: Multi-Product Unboxing Talking-Head Video (Scenario D — Live-Presenter)

**Original brief**:
> Need a 14-second live-presenter unboxing video. One person showcases three newly arrived products (black packaging bag, silver box, T-shirt) with spoken dialogue, filmed in a modern indoor setting. End with a close-up of the T-shirt fabric texture.

**Provided assets**:
- `@Image 1` (person photo): lock person's appearance and outfit
- `@Image 2` (product group photo — black packaging bag + silver box): lock product appearance
- `@Image 3` (T-shirt product photo): lock T-shirt appearance

**Rewritten prompt**:

> The person from @Image 1 wears a fixed outfit that remains unchanged throughout. Products include a black packaging bag, a silver box @Image 2, and a T-shirt @Image 3 — visual details must stay sharp and undistorted throughout. **[Subject]**
>
> 0\~1s: Person holds multiple products with both hands and places them on a metal table surface, looking directly at the camera. Dialogue: "Let's unbox these new items I just received." **[Selling-Point Action + Audio]**
>
> 1\~8s: Person stands at the table, left hand resting on the table edge, right hand gesturing along with the narration, body leaning slightly forward. Dialogue: "The design and features of these products are really impressive…" **[Selling-Point Action + Audio]**
>
> 8\~9s: Person stands by the window, right hand raised toward the camera. Dialogue: "Now let's take a look at this T-shirt." **[Selling-Point Action + Audio]**
>
> 9\~12s: Person gently touches the T-shirt on their chest with both hands while describing its features, then an extreme close-up of fingers pinching the fabric to showcase texture. Dialogue: "This T-shirt is made of lightweight fabric with great elasticity…" **[Selling-Point Action + Audio]**
>
> 12\~14s: Person's hands drop naturally to their sides, expression relaxed, narration concludes. No background audio. **[Selling-Point Action + Audio]**
>
> Lip-sync must remain consistent with dialogue throughout. Voice timbre and speaking pace are warm, moderate, and uniform across the entire video. **[Audio Constraints]**
>
> Modern indoor setting with two sub-scenes: a minimalist area (wooden wall panels, white bench, wooden floor); a beige marble-walled room (small wooden table, decorative objects). Primary light source is natural light, environment is clean and comfortable. **[Scene & Tone]**
>
> Fixed camera position with medium shot, close-up, and extreme close-up switching. 8\~9s transitions to a window-side close-up with city buildings in the background. 9\~12s camera pulls in from medium shot to extreme close-up. **[Camera Language]**
>
> Person's facial features must remain stable and undistorted throughout; outfit must not change. Product appearance must strictly match @Image 2 and @Image 3; packaging text must be clearly readable. Lip movements must synchronize with dialogue. **[Post-Production Constraints]**

**Why it's good**:

- **Second-by-second timeline**: Each action segment is pinned to exact seconds, giving the AI clear temporal anchors and preventing rhythm drift
- **Dual anchoring (person + products)**: The person is locked via `@Image 1` for appearance/outfit; each product gets its own independent `@` reference, ensuring multi-product consistency
- **Dialogue embedded in actions**: Each line of dialogue is placed directly next to the corresponding body posture and hand gestures — not described separately — ensuring lip-sync / action / content stay in three-way alignment
- **Sub-scene + shot-type synchronization**: Scene transitions (minimalist area → window side → marble room) and shot-type transitions (medium → close-up → extreme close-up) are aligned on the same timeline
- **Explicit silent segment**: 12\~14s annotates "no background audio," preventing the AI from filling in unwanted sound

---

## Renoise Integration Reference

### CLI Path

After installing the Renoise plugin, the CLI is located at:
```
skills/renoise-gen/renoise-cli.mjs
```

### Common Command Cheat Sheet

```bash
# Upload asset
node skills/renoise-gen/renoise-cli.mjs material upload <path>

# Register face asset
node skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "name"

# Generate video (blocking, waits for result)
node skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "prompt" --model renoise-2.0 \
  --duration 10 --ratio 9:16 \
  --materials "id1:ref_image,asset:id2:reference_image"

# Multi-segment chaining
node skills/renoise-gen/renoise-cli.mjs task chain <task_id>

# Check credit balance
node skills/renoise-gen/renoise-cli.mjs credit me

# Estimate cost
node skills/renoise-gen/renoise-cli.mjs credit estimate --model renoise-2.0 --duration 10
```

### Model Selection

| Model | Type | Characteristics | Best for |
|-------|------|----------------|----------|
| `renoise-2.0` | Video | Highest quality, 5–15s | Brand films, production-ready |
| `renoise-2.0-fast` | Video | Fast & low cost, 720p | Testing / iteration / volume |
| `nano-banana-2` | Image | Cheapest | Proof of concept |
| `midjourney-v7` | Image | Strongest stylization | Scene reference image generation |

### Materials Role Rules

Three modes are mutually exclusive — do not mix:

| Mode | Role combination | Use case |
|------|-----------------|----------|
| First frame | `first_frame` | Lock the opening frame |
| First + last frame | `first_frame` + `last_frame` | Lock opening and ending, AI generates the transition |
| Multimodal reference | `ref_image` / `ref_video` / `reference_image` | Most common — freely combine reference assets |

---

## Important Notes

1. **Language**: Construct the prompt in the user's language for confirmation, then translate to English before passing to the Renoise API
2. **Asset limits**: renoise-2.0 supports up to 9 ref_images + 3 ref_videos
3. **Duration**: 5–15 seconds per segment; use `task chain` for longer videos
4. **Face privacy**: Assets containing human faces must go through the Asset registration path, otherwise a PrivacyInformation error is thrown
5. **Aspect ratio**: Once the ratio is confirmed, all reference images should ideally have a similar aspect ratio
6. **Cost**: Use `credit estimate` before generating; notify the user proactively if balance is insufficient
