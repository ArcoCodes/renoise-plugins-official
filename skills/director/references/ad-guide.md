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
| Reference video (for chaining own generated segments) | `@Video N` | `ID:ref_video` | Up to 3; **not for external style reference** — for Scenario A, analyze with Gemini instead |
| First frame | `@Image N` | `ID:first_frame` | Mutually exclusive with ref_image |

**Face Privacy Rule**: Renoise's privacy detection blocks ANY image containing a recognizable human face when passed as `ref_image` — regardless of whether the face is the intended reference target. In practice, even scene/environment images with a prominent person will be rejected. Therefore: **any image you judge to contain a human face must be registered as a User Asset before use.** Do this automatically in Phase 4 Step 1 without asking the user. Two paths:
1. `asset register <material_id>` to register as a user asset → `asset:ID:reference_image` (default — always use this)
2. Use the platform character library → `--characters "ID"`

---

## Workflow

### Phase 1: Requirement Gathering & Asset Analysis

After receiving the user's request, confirm the following in order:

1. **Creative intent**: What type of video? Match to the appropriate scenario template (see below but you don't need to tell the users which scenario)
2. **Asset inventory**: Review each image / video the user provides
   - Images: View with the Read tool, analyze content (product? scene? person?)
   - Videos: If the Renoise plugin is available, use Gemini analysis; otherwise ask the user to describe key frames
3. **Assign a role to each asset**: subject anchor / scene calibration / camera reference / beat-sync control
   - **Face auto-detection**: When viewing each image, judge whether it contains a recognizable human face (even partially — side profile, background person with clear features, etc.). Tag any such image as `has_face: true`. These MUST be registered as User Assets in Phase 4 — do not attempt to pass them as `ref_image`, as Renoise's privacy detection will block the generation. This applies regardless of whether the face is the intended reference target.
4. **Confirm generation parameters**:
   - Duration: 4–15 seconds per segment (over 15s requires multi-segment chaining)
   - Aspect ratio: based on user's request
   - Which model to use:

| Model | Duration | Resolution |  Notes |
|-------|----------|------------|-------|
| `renoise-2.0` | 4–15s | 720p / 1080p  | Default; supports ref image ≤9, ref video ≤3, audio generation |
| `renoise-2.0-fast` | 4–15s | 720p only  | Faster & cheaper; same ref limits as above |
| `happyhorse-1.0` | 3–15s | 720p / 1080p | No `last_frame` support; no ref video |
| `kling-3.0-omni` | 3/5/10/15s (fixed) | 720p / 1080p  | ref image ≤7, ref video ≤1; no audio; prompt ≤2500 chars |

If the user's brief is incomplete, **only ask for missing critical information** — don't throw all questions at once. Infer what you can from the assets first.

### Phase 1.5: Asset Upload (Scenario D)

Upload all assets before writing the prompt. This step is quick and ensures material IDs are ready for prompt construction.

**Steps:**

1. **Upload person image and register as User Asset** (face detection requires it).

   **If the user did NOT provide a presenter face image**: ask the user what kind of presenter they want (e.g. gender, age range, style, vibe — "甜美少女风", "职场精英感", "邻家小姐姐" etc.). Then generate a character portrait with nano-banana-2, download it, upload as material, and register as User Asset. Present the generated character to the user for approval before proceeding — iterate until satisfied.

   ```bash
   # Generate presenter character portrait (no person image provided)
   node skills/renoise-gen/renoise-cli.mjs task generate \
     --model nano-banana-2 --resolution 2k --ratio 1:1 \
     --prompt "<portrait prompt based on user's description>"

   # Download the generated portrait
   curl -s -o presenter.png "<generated_image_url>"

   # Upload and register as User Asset
   node skills/renoise-gen/renoise-cli.mjs material upload presenter.png
   node skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "<presenter name>"
   ```

   **If the user provided a presenter face image**: upload and register directly.

   ```bash
   node skills/renoise-gen/renoise-cli.mjs material upload <person_image_path>
   node skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "<name>"
   ```

2. **Upload product images**.

   ```bash
   node skills/renoise-gen/renoise-cli.mjs material upload <product_image_path>
   ```

3. Record all material IDs and asset IDs, then proceed directly to Phase 2 (Prompt Construction).

### Phase 2: Prompt Construction

Build the prompt according to the structure defined in the matched scenario. Each scenario specifies its own prompt format — follow it exactly. The six-dimension formula still applies, but how the dimensions are organized (paragraph-per-dimension vs. shot-by-shot timeline vs. second-by-second script) is determined by the scenario.

**Language rule**: Draft the prompt in the user's language. Translation to English happens in Phase 4 Step 3 only — never before user confirmation. The user reviews and edits in their own language; the API receives English.

Writing rules that apply to all scenarios:

**DO:**
- Place `@` references immediately next to their descriptions, stating "what was referenced" and "what it's used for"
- When referencing a video, explicitly annotate "reference only XX, NOT YY"
- Use concrete micro-actions — never abstract adjectives like "premium" or "cinematic"
- Include at least 2 negative rules (prohibitions) covering the most failure-prone elements for that scenario

**DON'T:**
- Don't write vague terms → replace with specific lighting / color / material / motion descriptions
- Don't omit any of the six dimensions — they must all be covered, even if embedded within a shot or timeline entry
- Don't assume the AI can automatically understand brand tone → anchor every visual standard with `@` assets

### Phase 3: User Confirmation

**For Scenario C (TVC / multi-shot)**, present all shots together so the user sees the complete video in one view:

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
Model: renoise-2.0 | Ratio: W:H | Total estimated cost: ~N×M credits
Note: Each shot is generated as a separate segment, then assembled by ffmpeg.
---
```

**For all other scenarios**, present in the standard format:

```
--- Prompt Preview ---

[Full prompt, each dimension as its own paragraph, tagged with [Dimension Name]]

--- Asset Mapping ---
@Image 1 → [filename / description] → Renoise role: ref_image
@Video 1 → [filename / description] → Gemini analysis only (style extracted as text, NOT uploaded to Renoise)

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

**Step 1 — Upload assets & auto-register faces**

> **Scenario D note**: If Phase 1.5 was executed, person assets and product materials are already uploaded and registered — skip re-uploading them. Only upload any NEW materials not handled in Phase 1.5 (e.g., additional scene references).

For each asset file (skip if already uploaded in Phase 1.5):

```bash
# 1. Upload
node skills/renoise-gen/renoise-cli.mjs material upload <file_path>
```

Record the `material_id`. Then, **if the image was tagged `has_face: true` in Phase 1**, immediately register it as a User Asset — do NOT wait or ask the user:

```bash
# 2. Auto-register (only for has_face images)
node skills/renoise-gen/renoise-cli.mjs asset register <material_id> --name "<descriptive name>"
# Takes ~30–60 seconds. Wait for completion before proceeding.
```

Record the returned `asset_id`. Update the materials mapping: change the role from `ref_image` to `asset:ID:reference_image`.

Build the final `@reference → material_id / asset_id` mapping table after all uploads and registrations are done.

**Step 3 — Prompt language decision**

Check whether the prompt contains dialogue or voiceover lines (Scenario D: live-presenter / 带货口播):

- **With dialogue (Scenario D)**: Keep the entire prompt in the user's language. Do NOT translate. The model generates lip-synced speech directly from the dialogue text — translating would change the spoken language.
- **Without dialogue (Scenarios A/B/C)**: Translate the prompt to English, preserving the six-dimension structure and `@` reference positions. Use professional cinematography terminology (macro close-up, dolly in, rack focus, whip pan...). Keep selling-point action descriptions precise — don't generalize. Translate post-production constraints into clear negative constraints.

**Step 4 — Generate the video**

```bash
node skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "translated English prompt" \
  --model renoise-2.0 \
  --duration <seconds> \
  --ratio <ratio> \
  --materials "<id1>:<role1>,<id2>:<role2>"
```

**Step 5 — Scenario C (Mode A): single-clip generation (total ≤ 15s)**

Use Step 4 directly — the prompt already contains all shots + unified audio direction in one prompt. One API call → one continuous video with coherent audio. No assembly needed. Skip to Step 6.

**Step 5 — Scenario C (Mode B): multi-clip generation + assembly (total > 15s)**

Each segment's prompt follows the same structure as Mode A (shots + audio + constraints in one prompt), but covers only that segment's portion of the video.

1. Generate segments in parallel where independent, or sequentially if chaining is needed
2. Show each video URL to the user as it completes (no approval required, continue immediately)
3. After all segments are done, ffmpeg concatenate + strip AI audio + apply unified BGM:

```bash
# Concatenate
printf "file '%s'\n" S1.mp4 S2.mp4 S3.mp4 > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy final.mp4

# Strip AI audio and apply unified BGM
ffmpeg -y -i final.mp4 -an -c:v copy final-silent.mp4
ffmpeg -y -i final-silent.mp4 -i bgm.mp3 -c:v copy -c:a aac -shortest final-with-bgm.mp4
```

Before assembly, ask the user: **"Do you have a BGM file? If not, I can deliver the silent version for you to add music in post."**

4. Present the final assembled video to the user

**If the user wants to redo a specific segment**: regenerate that segment only, replace the file, re-run assembly. No need to redo the entire video.

**Step 5 — Standard: Multi-segment chaining (only when single video exceeds 15 seconds)**

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

**How the reference video is used**: Run Gemini analysis on the reference video to extract all style elements as text — do NOT upload the reference video to Renoise as `ref_video`. The `ref_video` role is for chaining your own generated segments, not external style reference. Passing the original video to Renoise would risk copying the original person/product into the output.

| Dimension | Emphasis |
|-----------|----------|
| Subject | Anchor with `@product image`, replacing the original video's product |
| Selling-Point Action | Replicate the original video's core selling-point action, adapted to the user's product |
| Scene & Tone | Use Gemini analysis output to replicate the vibe across all dimensions: scene and background environment; lighting style and color grading / color tone; pacing and editing rhythm; shot structure (how the product enters frame, lingers, and exits; angles used); visual effects, transitions, overlays; overall mood, energy, and brand aesthetic |
| Camera Language | Use Gemini analysis output to extract and describe camera movement (push-in, pull-out, orbit, handheld, static, drone, etc.) and rhythm — encode into prompt text only, not passed as a material |
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

### C. TVC / Brand Concept Film

**Trigger**: The user needs a cinematic, emotionally-driven brand film — lifestyle, outdoor, fashion, sports, or aspirational campaigns. The goal is to evoke feeling and brand identity, not to list product features. No dialogue, no pain-point contrast, no live presenter selling.


| Dimension | Emphasis |
|-----------|----------|
| Subject | Person + product exist together as storytelling elements — neither dominates; anchor both with `@` references |
| Selling-Point Action | Replace feature callouts with cinematic micro-moments: product interacting with environment (boot crushing wet grass, jacket catching wind), body language conveying effort or freedom |
| Scene & Tone | Rich, specific environments — anchor with `@scene image`; describe light quality (golden morning haze, blue-hour ridge glow), atmosphere, and how the environment feels physically |
| Camera Language | **Follow the user's shot ideas if specified.** If the user has not described their own shots, propose a shot plan first and wait for confirmation before writing prompts. Default arc when unspecified: ultra-wide establishing → follow-cam tracking → product detail close-up → wide silhouette finale — treat as a starting suggestion, not a requirement. |
| Audio | No dialogue — music-driven. Write a **unified audio direction** that spans the entire video, describing the overall ambient soundscape and per-shot audio accents in a single paragraph. This ensures the model generates coherent audio across all visual stages. See prompt structure below for format. |
| Post-Production | Maintain person consistency across all shots; end frame reserved for slogan/logo reveal (fade to black + centered text); no jump cuts — each transition must feel intentional |

**Prompt structure for TVC — two modes based on total duration:**

#### Mode A: Single-clip (total ≤ 15s) — PREFERRED

When the total video is 15 seconds or less, generate as **ONE single API call**. Write all visual stages (shots) into a single prompt, plus a **unified audio direction** at the end. The model renders the shots as a continuous flowing video with coherent audio throughout. No assembly, no audio patching needed.

The prompt has three parts:
1. **Shot descriptions** — each shot as its own paragraph, labeled `[Shot N | Xs | label]`. Describe camera, subject, action, and environment per shot. The model will flow between shots as smooth transitions, not hard cuts.
2. **Unified audio direction** — one paragraph describing the overall soundscape that spans the entire video, plus per-shot audio accents tied to specific visual moments.
3. **Post-production constraints** — consistency rules, negative constraints.

**How to determine the shot plan:**
- **User has their own clear shots** → use them directly and polish
- **User brief is vague** → propose a shot plan and wait for confirmation before writing the prompt

**Default arc when unspecified** (adjust freely based on brief):
```
[Shot 1 | 5s | Establishing] Ultra-wide panoramic of [environment], [light quality], camera slowly pushing forward.
[Shot 2 | 5s | Character Intro] [Person] wearing [product], [action], follow-cam tracking, [environmental detail].
[Shot 3 | 5s | Product Detail] Macro close-up of [product interacting with environment], camera orbiting. Fade to black.
```

**Example prompt** (hiking boot TVC, single 15s clip):

> Ultra-wide panoramic of mountain ranges and open ridge, referencing the environment from @Image 1. Golden morning mist drifts across the slopes, camera slowly and steadily pushes forward through the landscape. **[Shot 1 | 5s | Establishing]**
>
> A man wearing the hiking boots from @Image 2 strides along a mountain trail with purpose, follow-cam tracking alongside him at ground level. Wind moves his clothing and the surrounding tall grass, natural and unposed. **[Shot 2 | 5s | Character in Motion]**
>
> Macro slow-motion close-up of the hiking boots stepping into wet grass — grass blades bending under the sole, morning dew splashing in soft arcs. Camera orbits slowly to reveal the boot from multiple angles. Frame holds, then fades to black. **[Shot 3 | 5s | Product Detail]**
>
> **[Audio]** Background soundscape of crisp birdsong and wind rustling through pine trees throughout. When the hiker appears in Shot 2, a gentle acoustic guitar strum fades in. During the boot close-up in Shot 3, the music swells softly with a warm bass note as the dewdrops splash. No dialogue, no sudden loud sounds.
>
> **[Post-Production]** Person's appearance and boot design must remain consistent throughout. No visible product logos until the final fade. No frame flickering, no distorted faces. **[Single 15s clip]**

#### Mode B: Multi-clip (total > 15s) — only when duration exceeds model limit

When the total video exceeds 15 seconds, split into multiple segments (each ≤ 15s). Each segment is a separate API call with its own shot descriptions and unified audio direction (following the same format as Mode A — shots + audio + constraints in one prompt per segment).

After all segments are generated, ffmpeg concatenates them. Since each segment has its own coherent audio, the audio transition between segments may still be noticeable. For seamless results, **strip all AI audio and replace with a unified BGM** (see Phase 4 Step 5):

```bash
# Strip all AI-generated audio
ffmpeg -y -i final.mp4 -an -c:v copy final-silent.mp4
# Apply unified BGM
ffmpeg -y -i final-silent.mp4 -i bgm.mp3 -c:v copy -c:a aac -shortest final-with-bgm.mp4
```

Before assembly, ask the user: **"Do you have a BGM file? If not, I can deliver the silent version for you to add music in post."**

### D. Live-Presenter Product Showcase (UGC / Review / Talking-Head)

**Trigger**: The user needs a video with a real person presenting products on camera — review, testing, talking-head endorsement. The goal is authentic UGC (User-Generated Content) feel, not a polished commercial.

**Difference from Scenario C**: Scenario C is cinematic and emotion-driven (no dialogue). Scenario D is driven by a live presenter speaking on camera with dialogue and choreographed demo actions — and crucially, it must feel like a genuine user sharing their experience, not an actor reading a script.

**Asset upload**: Scenario D requires uploading person and product assets before writing the prompt. Person images must be registered as User Assets (face detection). See **Phase 1.5** in the Workflow section for details. After assets are ready, proceed directly to prompt writing and user confirmation.

---

**Core Mindset — UGC vs. Commercial**

The single biggest failure mode for Scenario D is writing prompts that sound like TV commercials. The table below shows the shift:

| Commercial (avoid) | UGC (target) |
|--------------------|--------------|
| "这款粉底持妆一整天，效果非常棒！" | "比我想象的稀一点…但上脸居然不错诶" |
| Perfect skin, flawless lighting | Natural skin texture, pores and blemishes visible |
| Professional fixed-camera setup | Handheld phone selfie, slight sway, ring light or window light |
| Smooth scripted delivery | Fast, casual, with hesitations and real reactions |
| Only highlights benefits | Mentions 1–2 honest flaws — this actually increases trust |
| Vague: "展示产品" | Specific demo action: pump product onto cheek, half-face apply, press finger to skin |

---

**Hook Strategy — Choose One for the Opening 3 Seconds**

| Hook Type | Best for | How to describe in prompt |
|-----------|----------|---------------------------|
| **Pain-point visual** | Products that solve a visible problem | Person opens with the problem state — bare face with skin issues (makeup), ill-fitting clothes held up, a cheap dupe next to the real thing (accessories) — then holds the product and states the test ("我要用它做一个12小时带妆测试" / "我一直找不到合适的版型，这次来试试") |
| **Social-proof reply** | Trending / much-requested products | An on-screen comment sticker appears with a viewer question ("你试过XX吗？" / "求测评！") + person responds directly to camera ("你们让我测，我来了") — signals: real people asked for this |
| **Skeptic-to-believer** | Products with bold or hard-to-believe claims | Person raises product, voice skeptical, immediately starts using it ("它说能撑一整天？" / "这个版型真的显腿长？" / "面料真的不皱？我们来看看") — the doubt IS the hook |

---

**Demo Action Framework** (replace vague "shows product" with 2–3 concrete actions)

The rule: every selling-point claim must map to one **physical, visible action** the presenter performs on camera. Never describe a claim abstractly — show the proof.

Organize by claim type, then pick the action that fits your product:

| Claim Type | Universal Demo Action | Product Examples |
|------------|----------------------|-----------------|
| **质地 / 材质** | Touch, stretch, scrunch, or pour the product; show its physical behavior | Foundation: pump onto cheek, let it flow. Fabric: scrunch in fist then release, show it recovers. Skincare: spread on back of hand, show absorption speed |
| **显色 / 遮瑕 / 色彩** | Apply to one side only; leave the other side bare as in-frame contrast | Foundation: half-face. Blush: single cheek swatch vs. bare cheek. Lipstick: half-lip. Clothing: hold garment against skin in natural light vs. artificial light |
| **持妆 / 耐久 / 不变形** | Timestamp reveal + show product/outfit condition after elapsed time | Foundation: wrist watch close-up after 12h. Clothing: same-day outfit after a full day out. Bag: show interior/exterior after heavy use |
| **版型 / 贴合 / 尺码** | Wear it and move — sit down, spin, stretch, raise arms, walk away from camera | Clothing: full 360° spin + squat. Shoes: walk in frame, flex foot. Pants: raise arms to test waistband rise |
| **细节 / 工艺 / 做工** | Extreme close-up while fingers explore the surface, seam, hardware, or finish | Clothing: fingers running along stitching. Bag: open/close zipper, press hardware. Jewelry: rotate under light to show facets |
| **效果对比 / 改变** | Before ↔ after in the same continuous shot, no cut | Styling: outfit flat-lay vs. worn on body. Skincare: arm without vs. with product. Hair tool: one section before, one section after |
| **使用感受 / 真实反应** | Capture the first-use reaction — surprise, hesitation, discovery | First bite of food product. First smell of fragrance. Feeling fabric for the first time and reacting. Putting on shoes and walking for the first time |

> **⚠️ Physical Continuity Rule (applies to all products)**
>
> The model cannot generate implicit state transitions — it will teleport between states (cap on → product applied; sealed bag → open bag; folded clothing → worn). Any product that moves from a **packaged/stored state** to an **in-use state** must follow one of two strategies:
>
> - **Skip the transition**: begin the timeline with the product already in its in-use state (product already open, already applied, already worn). Never mention the packaged state in the same or adjacent time segment.
> - **Make the transition explicit**: dedicate a full separate time segment to the preparation action ("presenter unscrews the cap and sets it aside"), then start the demo in the next segment.
>
> This applies universally: bottle caps, sealed pouches, cardboard boxes, clothing tags, zip-lock bags, foil wrappers, shoe boxes — any packaging.

---

> **⚠️ Action Granularity Rule (applies to all application demos)**
>
> Never compress a multi-step physical process into one sentence. The model renders a single sentence as a single instantaneous event — a blob of product will teleport from "just pumped" to "fully blended" in one frame.
>
> **Minimum 3 sub-steps per demo action**, each on its own sentence, each describing the **mid-action / incomplete state** — not the end state:
>
> | ❌ Compressed (avoid) | ✅ Granular (target) |
> |---|---|
> | "pumps foundation onto cheek and blends it in" | ① A small pump of product lands on the cheekbone. ② One fingertip gently taps the center — product not yet spread. ③ Slow outward circles; edges still unblended at frame edge. |
> | "scrubs the serum onto her arm and it absorbs" | ① Drops serum onto the back of the hand, lets it pool. ② Fingertip spreads it across half the skin — other half still bare. ③ Presses palm flat; skin slowly drinks it in. |
> | "tries on the jacket and zips it up" | ① Slides one arm in, sleeve hanging loose. ② Pulls the other side across the chest, fabric slightly bunched. ③ Zipper drawn up slowly, jacket settling into shape. |
>
> Add pace qualifiers to each sub-step: *slowly*, *gently*, *just barely*, *one corner at a time*. The goal is to give the model a continuous journey, not a jump cut.

---

**UGC Authenticity Principles** (apply all that fit; product-agnostic)

1. **Lead with a relatable imperfection**: open on a real problem the target audience has — not a perfect setup. Acne for makeup, poor fit history for clothing, cheap-looking alternatives for accessories. The viewer must think "that's me."
2. **Embed one honest flaw**: have the presenter name a real drawback ("会有点氧化" / "版型稍微宽一点点" / "比我预期的稀") — this single admission dramatically raises trust in everything else they say
3. **Keep unscripted reactions**: write micro-reactions like "比我想象的…" / "没想到居然…" / "等等，这个…" instead of smooth promotional copy — the hesitation IS the credibility
4. **Use third-party proof**: a watch timestamp, scale reading, measurement tape, or side-by-side size comparison is more convincing than any verbal claim
5. **Mix other brands / context items**: show 1–2 non-promoted items (a different brand's primer, a basic wardrobe piece, an everyday bag) to signal "this is my real life, not a paid set"
6. **Casual presenter appearance**: the presenter doesn't need to be perfectly styled — relatable hair, home clothes, or a simple backdrop reinforces "real person sharing a find"
7. **English UGC dialogue: discovery over declaration** — English-language UGC dialogue must sound like the presenter is figuring it out in real time, not announcing a conclusion. Scripted commercial phrasing ("This foundation lasts all day") reads as fake. Use incomplete sentences, mid-action surprise, and understated reactions:

   | ❌ Commercial (avoid) | ✅ UGC (target) |
   |---|---|
   | "They say this won't look chalky and lasts all day" | "Okay I keep hearing this one doesn't go white on you... let's actually check." |
   | "It just melts into my skin" | "Oh wait — it's actually blending? Like, properly?" |
   | "I'm actually convinced" | "Huh. Okay. That's... not bad at all." |
   | "This fabric has amazing stretch and recovery" | "I'm gonna squat in this. Right now. — okay yeah that worked." |
   | "The wear time on this is incredible" | "It's been like six hours. I keep checking and there's nothing. Nothing." |

   The rule: **if the sentence could appear in a brand ad, rewrite it**. Real people don't narrate selling points — they notice things, react, and move on.

---

**How the Six Dimensions Adapt for UGC**

| Dimension | UGC Emphasis | Requirements |
|-----------|--------------|--------------|
| Subject | Person appears natural, no heavy-beauty-filter feel; product held casually | Anchor person via `@person image` asset; anchor product via `@product image`; describe person's appearance as natural/no-filter |
| Selling-Point Action | **Second-by-second demo timeline** using the vocabulary table above | Min. 2 concrete demo actions; at least one honest-flaw or unscripted-reaction moment embedded |
| Scene & Tone | Bedroom, bathroom, well-lit home corner — lived-in and believable | No studio backdrop; natural light or ring light; may include deliberate harsh-light stress-test segment |
| Camera Language | Handheld phone selfie perspective, slight natural sway; extreme close-up on demo moments | Write as "handheld phone selfie angle, slight natural camera movement" — not "professional fixed camera" |
| Audio | Fast, conversational, genuinely reactive — NOT scripted commercial delivery | Every line as "人物对着镜头说：'...'" using UGC speech style; allow hesitations and reactions; one line max per time segment |
| Post-Production | Face stability + product accuracy + lip-sync | Natural skin texture must remain visible (no smoothed-out skin described); product packaging text readable; lip-sync tight |

---

**Prompt Structure Template (UGC live-presenter)**

Unlike other scenarios, live-presenter prompts are organized along a **second-by-second timeline**, with the six dimensions interwoven into the chronology:

```
[Person & product anchoring — natural appearance, no beauty-filter feel. All @ references declared upfront.] [Subject]

[0~Ns: Hook — pain-point visual / social-proof reply / skeptic opener + shot type] [Hook]
[N~Ms: demo action #1 (from Demo Action Framework, matched to claim type) + casual on-camera reaction + shot type] [Action + Audio + Camera]
[M~Ls: demo action #2 + honest flaw or unscripted reaction embedded naturally + shot type] [Action + Audio + Camera]
[L~end: proof moment (timestamp / transfer test / wear condition reveal / measurement) + closing line] [Proof + CTA]

[Scene — home/bedroom/bathroom, specific lived-in detail] [Scene & Tone]

手持手机自拍视角，轻微自然晃动；以怼脸近景为主，关键demo动作切换至极近特写。[Camera Language]

全程由人物本人口播发声，不使用旁白或背景配音。语气口语化、快节奏，保留真实反应语气词。人物嘴唇动作必须与台词完全同步。[Audio Constraints]

全程人物面部特征稳定不变形；保留自然肤质（不过度磨皮）；产品外观严格与 @Image 参考一致，瓶身文字清晰可读；嘴型与台词完全同步；画面无闪烁。[Post-Production Constraints]
```

**Critical rules**:
- Every dialogue line MUST be written as "人物对着镜头说：'...'" — never "台词：" or "Dialogue:" (the latter renders as background voiceover, not lip-synced speech)
- Audio constraints MUST include "全程由人物本人口播发声，不使用旁白或背景配音"
- The prompt must stay in the user's language (matching the intended spoken dialogue) — do NOT translate to English for Scenario D
- One dialogue line max per time segment — don't write full paragraphs of script

---

## Rewrite Examples

### Example 1: Men's Serum Brand Film (Scenario B)

**Original brief** (vague, low precision):
> We need a 10-second brand film for a men's serum. Premium feel, highlight the moisturizing effect. Background should be a minimalist modern space with cinematic lighting. End with the brand logo.

**Provided assets**:
- `@Image 1` (product hi-res photo): asset anchor
- `@Image 2` (high-contrast space photo): scene calibration

**Rewritten prompt**:

> Display the men's serum glass bottle from @Image 1 at the center of the frame, with translucent texture and proportions strictly matching the original. **[Subject]**
>
> Reference @Image 2's minimalist modern space with high-contrast cool blue tones; sidelight creates a sharp, sculpted rim light. **[Scene & Tone]**
>
> Crystalline water droplets condense on the serum surface, slowly sliding down the bottle body, showcasing an intense sense of hydrating moisture. **[Selling-Point Action]**
>
> Camera begins with a macro close-up, slowly and steadily orbiting the bottle while pushing in. **[Camera Language]**
>
> In the final 2 seconds, a soft chime marks the beat as a silver brand logo fades in at the center of the frame. **[Audio]**
>
> No frame flickering, product logo must not distort, water droplet dynamics must be realistic. **[Post-Production Constraints]**

**Why it's good**: Each dimension is independent and concrete; `@` references clearly state "what was referenced" and "what it's used for"; "premium feel" is replaced with "high-contrast cool blue tones + sculpted sidelight rim light"; "moisturizing effect" is translated into the micro-action of "water droplets condensing and sliding down."

---

### Example 2: Ultra-Thin Diaper E-Commerce Ad (Scenario C)

**Original brief**:
> Push an ultra-thin diaper for a volume-driving video. First 3 seconds must hook moms on the pain point (baby with diaper rash crying), then immediately cut to the product, demonstrate how breathable it is, keep the pace fast, get straight to the point!

**Provided assets**:
- `@Image 1` (product flat-lay photo): lock the product
- Viral reference video (analyzed with Gemini — not uploaded to Renoise)

**Gemini analysis output** (extracted from the reference video before writing the prompt):
- Camera: fast whip-pan cut at 3s, handheld close-up in opening
- Expression: mother's anxious close-up, furrowed brows, distressed body language
- Pacing: rapid cuts every 1–2s, tension builds in first half
- Scene: warm-toned home nursery, soft natural light

**Rewritten prompt**:

> Close-up of a young mother with furrowed brows, holding a crying baby, expressing extreme anxiety — handheld camera, slightly shaky, tight on face. **[Visual Hook (Opening)]**
>
> At the 3-second mark, camera whip-pans horizontally to the baby diaper product from @Image 1. **[Subject]**
>
> Product lies flat on a table surface as a burst of steam instantly penetrates from the bottom through the top layer, viscerally demonstrating breathability. **[Selling-Point Action]**
>
> Warm, bright home nursery environment, high-saturation warm color palette, soft natural light. Fast cuts every 1–2 seconds, tension building through the first half. **[Scene & Tone + Camera Language]**
>
> Actions must not drag, steam effect must be natural without exaggeration, packaging text must be clearly readable, facial features must remain stable and undistorted. **[Post-Production Constraints]**

**Why it's good**: The reference video was analyzed by Gemini first — camera style, pacing, and expression details are encoded as text directly in the prompt. The video itself is never uploaded to Renoise, avoiding any risk of copying the original person. "Breathable" is translated into the visualizable action of "steam penetrating."

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
> 0\~1s: Person holds multiple products with both hands and places them on a metal table surface, looking directly at the camera. Person speaks to camera: "Let's unbox these new items I just received." **[Selling-Point Action + Audio]**
>
> 1\~8s: Person stands at the table, left hand resting on the table edge, right hand gesturing along with the narration, body leaning slightly forward. Person speaks to camera: "The design and features of these products are really impressive…" **[Selling-Point Action + Audio]**
>
> 8\~9s: Person stands by the window, right hand raised toward the camera. Person speaks to camera: "Now let's take a look at this T-shirt." **[Selling-Point Action + Audio]**
>
> 9\~12s: Person gently touches the T-shirt on their chest with both hands while describing its features, then an extreme close-up of fingers pinching the fabric to showcase texture. Person speaks to camera: "This T-shirt is made of lightweight fabric with great elasticity…" **[Selling-Point Action + Audio]**
>
> 12\~14s: Person's hands drop naturally to their sides, expression relaxed. No speech, no background audio. **[Selling-Point Action + Audio]**
>
> All dialogue is spoken on camera by the person — no voiceover or background narration. Lip-sync must remain consistent with dialogue throughout. Voice timbre and speaking pace are warm, moderate, and uniform across the entire video. **[Audio Constraints]**
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

### Example 4: UGC Foundation Long-Wear Review (Scenario D — UGC Style)

**Original brief**:
> 帮我生成一个博主测评粉底液持妆12小时的带货短视频，10秒，UGC风格，素颜开场，要有真实感

**Provided assets**:
- `@Image 1` (person photo — natural selfie, visible skin texture): lock presenter identity
- `@Image 2` (foundation bottle product photo): lock product appearance

**Rewritten prompt** (stays in Chinese — Scenario D with dialogue):

> @Image 1 的女生主播，深棕色卷发、自然肤质（可见雀斑和轻微痘印），无美颜滤镜感，佩戴随意日常首饰，着简单居家上衣。产品为 @Image 2 的粉底液，金色细长瓶身，瓶身文字清晰可见，全程产品外观保持真实不失真。【主体】
>
> 0\~3s：人物素颜出镜，手持粉底液瓶举到脸旁，直视镜头，表情带着一点怀疑。人物对着镜头说："它说能持妆一整天？我来试试。"手持手机自拍近景，轻微晃动，环形灯打亮面部。【Hook + 镜头】
>
> 3\~6s：人物将粉底液直接泵一泵在脸颊上，让其自然流下，随即用手指轻轻推开，半张脸已上妆、半张脸素颜形成自然对比。人物对着镜头说："哇，比我想的稀一点点…不过上脸感觉还挺贴的。"镜头从中景缓缓推近至脸部极近特写，展示半脸遮瑕对比。【Demo动作 + 真实反应】
>
> 6\~10s：人物将腕部手表转向镜头，显示时间，随后再次面对镜头展示全脸妆效（在窗边自然光下）。人物对着镜头说："过了12小时了，妆还在——就是有一点点氧化，但整体真的还不错诶。"镜头在手表特写和脸部自然光特写之间切换。【持妆验证 + 坦承缺点】
>
> 场景为现代家居，浅色墙面，桌面整洁但随意，窗边自然光为主光源。6\~10s主动切至窗边利用自然光展示真实妆效。【场景】
>
> 手持手机自拍视角，轻微自然晃动；以怼脸近景为主，3\~6s推近至极近特写展示半脸对比，6\~10s切换手表特写与窗边脸部特写。【镜头语言】
>
> 全程由人物本人口播发声，不使用旁白或背景配音。语气口语化、快节奏，保留真实反应语气词（"哇""比我想的""诶"）。人物嘴唇动作必须与台词完全同步。【音频约束】
>
> 全程人物面部特征稳定不变形；保留自然肤质（不过度磨皮，保留雀斑和皮肤纹理）；产品外观严格与 @Image 2 一致，瓶身文字清晰可读；嘴型与台词完全同步；画面无闪烁无抖动。【后期约束】

**Why it's good**:

- **UGC Hook**: Opens with a skeptical "let me test this" framing rather than a commercial claim — immediately builds credibility
- **Drip texture test**: Pumping product directly onto the cheek and letting it flow is a concrete demo action, not vague "holding the product"
- **Half-face contrast**: Described naturally within the application action — no need for artificial "before/after" title cards
- **Honest flaw embedded**: "有一点点氧化" is written into the dialogue — this single phrase makes the whole video feel genuine
- **Third-party timestamp**: Watch face close-up is more convincing than any verbal claim about wear time
- **Natural skin preserved**: Post-production constraints explicitly say "保留雀斑和皮肤纹理" — the opposite of a commercial beauty filter instruction
- **Dialogue style**: Short, reactive lines with fillers ("哇", "诶") rather than polished promotional copy

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

1. **Language**: Construct the prompt in the user's language for confirmation. For prompts **without dialogue** (Scenarios A/B/C), translate to English before passing to the Renoise API. For prompts **with dialogue/voiceover** (Scenario D), keep the prompt in the user's language — the model needs the original language to generate correct lip-synced speech
2. **Asset limits**: renoise-2.0 supports up to 9 ref_images + 3 ref_videos
3. **Duration**: 5–15 seconds per segment; use `task chain` for longer videos
4. **Face privacy**: Assets containing human faces must go through the Asset registration path, otherwise a PrivacyInformation error is thrown
5. **Aspect ratio**: Once the ratio is confirmed, all reference images should ideally have a similar aspect ratio
6. **Cost**: Use `credit estimate` before generating; notify the user proactively if balance is insufficient
