---
name: tiktok-content-maker
description: >
  TikTok e-commerce short video script generator. Analyzes product photos,
  generates 15s video scripts with video prompts and English dialogue.
  Use when user says "TikTok product video", "ecommerce video",
  "product video", "sales video", "shoot product". Do NOT use for non-ecommerce videos or
  general creative direction (use director instead).
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.1.0
  category: video-production
  tags: [product, ecommerce, tiktok]
---

# Content Maker — E-commerce Short Video Script + Generation

## Overview

End-to-end e-commerce short video tool: user provides product images (+ optional model images) → analyze product info → generate 15-second TikTok script (video prompt with embedded English dialogue) → submit video generation task.

## Workflow

### Phase 1: Material Collection & Product Analysis

1. **Collect material paths**: Ask user for images
   - `Product image path` (required): Product hero image. **Best: clean white-background product photo with no text/labels/decorations**. Images with marketing text overlays will interfere with the model.
   - `Model image path` (optional, for analysis reference only): Shows how the product is worn/used. **Note: Model images are only used to understand product usage — they are NOT uploaded to Renoise** (privacy detection will block images containing realistic human faces).

2. **Analyze product info**:
   - Use the `gemini-gen` skill to analyze product images — send the image(s) with a prompt requesting product analysis (type, color, material, selling points, brand tone, scene suggestions)
   - Alternatively, view images directly via the Read tool and analyze manually
   - Extract: product type, color, material, selling points, brand tone, applicable scenarios
   - **(Critical) Understand correct product usage from lifestyle images**:
     - What is the user's posture? (standing/sitting/lying/walking)
     - Where is the product positioned on the body? (handheld/floor/table/under body)
     - How does the product interact with the body? (hand pressure vs body weight vs wearing vs applying)
     - Where is the usage scenario? (gym/office/home/outdoors)
   - If the user provides a product link, use WebFetch to scrape product detail page for additional context

3. **Present analysis results** for user to confirm or supplement. Results must include a clear "**Usage description**", e.g.:
   > Usage: Place the peanut ball on the floor/yoga mat, user lies on top of the ball, using body weight to massage the muscles along both sides of the spine. The peanut-shaped groove avoids the spine while the two ball ends work the erector spinae muscles.

### Phase 2: 15-Second Script + Prompt Generation

Based on analysis results + reference guide, generate a complete 15-second video script.

**Must reference the following guide** (Read before generating):
- `${CLAUDE_SKILL_DIR}/references/ecom-prompt-guide.md` — E-commerce video prompt guide

**Prompt structure (3 required components):**

#### Part A: Product Anchoring (first line of prompt)

Product appearance is conveyed by the reference image. The prompt only needs **one sentence** stating what the product is + its use case:

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame. Do not invent any packaging, box, or container unless the reference image shows one.
```

**Key**: Do not repeat color, material, shape, or logo descriptions in the prompt — that information is already in the reference image. Save prompt space for the hook and visual narrative.

#### Part B: Dialogue Embedding (throughout)

Dialogue must be in English, embedded in the narrative using forced lip-sync format:
```
Spoken dialogue (say EXACTLY, word-for-word): "..."
Mouth clearly visible when speaking, lip-sync aligned.
```

**Dialogue style requirements**:
- **Best-friend casual tone**: Like recommending to a friend, not reading ad copy
- **High information density**: Every sentence includes specific details (numbers, comparisons, usage scenarios) — no filler
- **No hard sell**: Don't end with "link below" or generic CTAs. Use natural personal recommendations (e.g., "Best money I have spent this year", "Trust me just start")

**Dialogue pacing** (4 lines, matching 4 time segments):
```
[0-3s]   Hook — One sentence to stop the scroll (pain point / suspense / result-first)
[3-8s]   Selling point — Specific specs + personal experience
[8-12s]  Scene — Where to use + portability / versatility
[12-15s] Close — Genuine personal recommendation, no hard sell
```

#### Part C: Visual Narrative (one continuous narrative)

**Video structure (one continuous 15-second video):**
```
[0-3s]   HOOK — High-impact opening. Must: fast camera movement (whip pan / snap dolly in) + dynamic action + start speaking immediately. Never start slow.
[3-8s]   SHOWCASE — Product display + model interaction. Camera transitions to reveal material details.
[8-12s]  SCENE — Real-life usage scenario. Pull back to medium/wide shot.
[12-15s] CLOSE — Model faces camera + product in frame + natural ending. Frame holds steady.
```

**Output 3 items:**

#### 1. Video Prompt (English, with dialogue)
Director-dictation style paragraph (6-10 sentences, one thing per sentence), containing:
- Product anchoring (one sentence, Part A) at the very beginning
- Dialogue embedded with `Spoken dialogue (say EXACTLY, word-for-word):` format (Part B)
- `Mouth clearly visible when speaking, lip-sync aligned.` after each dialogue line
- Ad-6D Protocol elements interspersed
- Model appearance consistency description (gender, hair, skin tone, body type, outfit)
- At least 3 camera movement changes
- Lighting/atmosphere description

#### 2. Dialogue Script (English, with timestamps)
List the 4 dialogue lines separately with their time segments for easy review.

#### 3. BGM / Sound Design Suggestions
- Recommend music style matching the product tone
- Key moment sound effect cues

**Reference example**: Read `${CLAUDE_SKILL_DIR}/examples/dress-demo.md` for the latest standard output format.

### Phase 3: User Confirmation

After presenting the full script, ask the user:
- Whether to adjust dialogue
- Whether to change the scene
- Whether to modify prompt details
- Proceed to submission after confirmation

### Phase 4: Upload Materials + Submit Video Generation Task

After user confirms the script, upload the product image and submit the video generation task.

**Important rules**:
- Only upload product images — **never upload model/real person photos** (privacy detection will block images containing realistic human faces, error: `InputImageSensitiveContentDetected.PrivacyInformation`)
- Model appearance is controlled entirely by prompt text description
- Product images should ideally be clean white-background product photos, avoid images with marketing text overlays
- For batch generation: upload the product image once, reuse the material ID to submit multiple tasks with different scenes

## Important Notes

- Images support jpg/jpeg/png/webp formats
- Video prompts must be entirely in English
- Dialogue must be in English, embedded in the prompt (`Spoken dialogue (say EXACTLY, word-for-word): "..."`)
- **Do not output separate subtitle text** — dialogue is already in the prompt, no additional subtitle layer needed
