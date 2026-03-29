---
name: tiktok-content-maker
description: >
  TikTok e-commerce short video script generator. Analyzes product photos,
  generates 15s video scripts with video prompts and English dialogue.
  Use when user says "TikTok product video", "ecommerce video", "product video",
  "sales video", "merchandise video", "shoot product". Do NOT use for non-ecommerce videos or
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
   - `Product image path` (required): Main product photo. **Best: clean white-background product-only image, no text/labels/decorations**. Marketing text overlays will interfere with the model.
   - `Model image path` (optional, for analysis reference only): Shows how the product is worn/used. **Note: Model images are only used to understand product usage — they are NOT uploaded to Renoise** (privacy detection will block images containing real human faces).

2. **Analyze product info**:
   - If Gemini API is available, call Gemini for analysis:
     ```bash
     cd ${CLAUDE_PLUGIN_ROOT} && npm install --silent && npx tsx ${CLAUDE_SKILL_DIR}/scripts/analyze-images.ts "<product-image-path>" "<model-image-path>"
     ```
   - Alternatively, use the Read tool to view images and analyze product info manually
   - Extract: product type, color, material, selling points, brand tone, usage scenarios
   - **(Critical) Understand correct product usage from the usage/model images**:
     - What posture is the user in? (standing/sitting/lying/walking)
     - Where on the body is the product placed? (held in hand/on floor/on desk/under body)
     - How does the product interact with the body? (press with hands vs body weight vs wear vs apply)
     - Where is the usage scenario? (gym/office/home/outdoors)
   - If user provides a product link, use WebFetch to scrape the product detail page for additional context

3. **Present analysis results** for user confirmation or additions. Results must include a clear **usage description**, e.g.:
   > Usage: Place the peanut ball on the floor/yoga mat, user lies on top of the ball, applying body weight to massage the muscles along both sides of the spine. The peanut-shaped groove avoids the spine while the two ball ends work the erector spinae muscles.

### Phase 2: 15-Second Script + Prompt Generation

Based on analysis results + reference guide, generate a complete 15-second video script.

**Must reference the following guide** (Read before generating):
- `${CLAUDE_SKILL_DIR}/references/ecom-prompt-guide.md` — E-commerce video prompt guide

**Prompt Structure (3 required components):**

#### Part A: Product Anchor (prompt opening, one sentence)

Product appearance is conveyed through the reference image — the prompt only needs **one sentence** stating what the product is + its purpose:

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame. Do not invent any packaging, box, or container unless the reference image shows one.
```

**Key**: Do not repeat color, material, shape, or logo descriptions in the prompt — this info is already in the reference image. Save prompt space for the hook and visual narrative.

#### Part B: Dialogue Embedding (throughout the video)

Dialogue must be in English, embedded in narrative paragraphs using forced lip-sync format:
```
Spoken dialogue (say EXACTLY, word-for-word): "..."
Mouth clearly visible when speaking, lip-sync aligned.
```

**Dialogue style requirements**:
- **Casual friend vibe**: Like recommending to a friend, not reading ad copy
- **High info density**: Every sentence carries specific info (numbers, comparisons, usage scenarios), no filler
- **No hard sell**: Don't end with "link below" or pushy CTAs — use natural personal recommendations (e.g., "Best money I have spent this year", "Trust me just start")

**Dialogue rhythm** (4 lines, matching 4 time segments):
```
[0-3s]   Hook — One line to stop the scroll (pain point/suspense/result-first)
[3-8s]   Feature — Specific specs + usage experience
[8-12s]  Scenario — Where to use + portability/versatility
[12-15s] Close — Genuine personal recommendation, no hard sell
```

#### Part C: Visual Narrative (one continuous narrative)

**Video structure (one continuous 15-second video):**
```
[0-3s]   HOOK — High-impact opening. Must: fast camera move (whip pan / snap dolly in) + dynamic action + start speaking immediately. Never slow-start.
[3-8s]   SHOWCASE — Product display + model interaction. Camera changes to show material details.
[8-12s]  SCENE — Real-life usage scenario. Pull back to medium/wide shot.
[12-15s] CLOSE — Model facing camera + product in frame + natural closing. Frame holds steady.
```

**Output 3 items:**

#### 1. Video Prompt (English, with dialogue)
Director-narrated paragraph (6-10 sentences, each doing one thing), including:
- Product anchor (one sentence, Part A) at the very beginning
- Dialogue embedded with `Spoken dialogue (say EXACTLY, word-for-word):` format (Part B)
- After each dialogue line: `Mouth clearly visible when speaking, lip-sync aligned.`
- Ad-6D Protocol elements interspersed
- Model appearance consistency description (gender, hairstyle, skin tone, body type, clothing)
- At least 3 camera changes
- Lighting/atmosphere description

#### 2. Dialogue Script (English, with timestamps)
List all 4 dialogue lines with corresponding time segments separately for easy review.

#### 3. BGM/Sound Design Suggestions
- Recommend music style appropriate for the product's tone
- Key-moment sound effect cues

**Reference example**: Read `${CLAUDE_SKILL_DIR}/examples/dress-demo.md` for the latest standard output format.

### Phase 3: User Confirmation

After presenting the full script, ask the user:
- Whether to adjust dialogue
- Whether to change the scenario
- Whether to modify prompt details
- Proceed to submission after confirmation

### Phase 4: Upload Materials + Submit Video Generation Task

After user confirms the script, upload the product image and submit the video generation task.

**Important rules**:
- Only upload product images — **never upload model/real-person images** (privacy detection will block images containing real human faces, error: `InputImageSensitiveContentDetected.PrivacyInformation`)
- Model appearance is controlled entirely through prompt text descriptions
- Product images should ideally be clean white-background product-only photos, avoiding images with marketing text overlays
- For batch generation: product image only needs to be uploaded once — reuse the material ID to submit multiple tasks with different scenarios

## Important Notes

- Supported image formats: jpg/jpeg/png/webp
- Video prompts must be entirely in English
- Dialogue must be in English, embedded in the prompt (`Spoken dialogue (say EXACTLY, word-for-word): "..."`)
- **Do not output separate subtitle text** — dialogue is already in the prompt, no additional subtitle layer is needed
