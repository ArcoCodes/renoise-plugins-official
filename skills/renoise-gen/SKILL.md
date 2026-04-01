---
name: renoise-gen
description: Generate AI videos and images via Renoise platform. Create tasks, upload materials, browse characters, poll results, download outputs. Supports text-to-video, image-to-video, video-to-video, and text-to-image. Generate product design sheets (multi-angle product views) and scene/background images. Manage a material pool with batch ingest, Gemini analysis, and auto-matching to shots. Use this skill whenever the user asks to "generate video", "create video", "text to video", "image to video", "generate image", "AI video", "AI image", "product design sheet", "product sheet", "scene background", "material pool", "ingest materials", or describes any video/image content they want generated with AI.
allowed-tools: Bash, Read, Write, Glob
metadata:
  author: renoise
  version: 0.2.0
  category: video-production
  tags: [general, video-generation, image-generation, product-sheet, scene-background, material-pool]
---

# AI Video & Image Generation (via Renoise)

Generate AI videos, images, product design sheets, and scene backgrounds through the Renoise platform. Includes a material pool pipeline for batch ingest, analysis, and auto-matching to shots.

> **IMPORTANT**: The Renoise website is **https://www.renoise.ai** — NEVER renoise.com. Always use `renoise.ai` when referencing the platform URL.

> **CANVAS TRACKING (MANDATORY)**: Every `task create` or `task generate` call MUST be tracked in `generated/.tasks.json` so the workspace canvas shows real-time status. Follow this sequence:
> 1. `mkdir -p generated` and run `task create` → get the Renoise task ID from response
> 2. Read `generated/.tasks.json` (or `[]` if missing), append `{"id":"<task-id>","prompt":"<english-prompt>","status":"generating","createdAt":"<iso>","duration":<sec>,"ratio":"<ratio>"}`, write back
> 3. Run `task wait <task-id>`, then download the result
> 4. Update the same entry: on success → `"status":"success","filePath":"generated/<file>"` / on failure → `"status":"failed","error":"<msg>"`
> 
> The `id` MUST be the Renoise task ID (not a random UUID). Never remove old entries. For multiple tasks, register ALL in tasks.json before waiting.

## Choose Your Workflow First

Before generating anything, identify your project type. Different projects require different preparation steps. **Skipping preparation for multi-scene projects will result in inconsistent characters across scenes.**

| Project Type | Examples | Workflow |
|---|---|---|
| **Single shot** | One-off clip, social post, test | → [Quick Start](#quick-start) (direct generate) |
| **Multi-scene drama / short film** | Short drama, music video, story with recurring characters | → [Multi-Scene Production Workflow](#multi-scene-production-workflow) |
| **Product video** | Product showcase, ad, demo | → Upload product images as materials → Generate |
| **Clip stock / B-roll** | Atomic clips for post-production | → [Clip Stock Mode](#clip-stock-mode) |

---

## Multi-Scene Production Workflow

**Use this workflow whenever your project has recurring characters across 2+ scenes.** This is the most common workflow for drama, short films, and narrative content.

### Step 1: Check Balance

Estimate total cost before starting. Each 15s video ≈ 300 credits. A 10-scene project ≈ 3000 credits for videos + ~200 for character reference images.

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit me
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit estimate --duration 15
```

### Step 2: Generate Character Reference Sheets

For each recurring character, generate a reference sheet with `nano-banana-2`. This anchors their appearance across all scenes.

```bash
# Example: generate a character reference for a Tang Dynasty official
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 1:1 \
  --prompt "Character reference sheet for Li Shande, a 52-year-old Tang Dynasty minor official. Thin build, greying temples, two streaks of white in his thin mustache. Wearing a dark blue-green official robe with black gauze hat. Kind weary eyes, scholarly demeanor. Multiple angles: front view, 3/4 view, profile. Clean white background, soft studio lighting."
```

**Do this for every character that appears in 2+ scenes.** Minor one-scene characters can be described in text only.

### Step 3: Download, Upload, and Register as Assets

This makes them privacy-safe and reusable across all video generations.

```bash
# Download the generated image
curl -s -o li-shande.png "<image_url_from_step_2>"

# Upload as material
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload li-shande.png
# Returns material #ID (e.g. 42)

# Register as Ark asset (~30-60s)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset register 42 --name "Li Shande"
# Returns asset #ID (e.g. 7) when active
```

### Step 4: Generate Videos Scene by Scene

Use `asset:<asset_id>:reference_image` to anchor character appearance in every scene.

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] ... [5-10s] ... [10-15s] ..." \
  --materials "asset:7:reference_image" --duration 15 --ratio 16:9
```

For scenes with multiple characters, combine assets:
```bash
  --materials "asset:7:reference_image,asset:8:reference_image"
```

### Step 5: Review and Iterate

Check each video result. If a scene needs adjustment, regenerate with the same asset references to maintain consistency.

---

## Quick Start

```bash
# 1. Text-to-Video — 15s finished cut with storyboard control
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] Close-up of a cat on the moon, slow push in. [5-12s] The cat dances under twinkling stars, smooth orbit. [12-15s] Wide pull back revealing the full lunar landscape, frame holds steady." \
  --duration 15 --ratio 16:9

# 2. Image-to-Video — upload a reference image, then generate
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/photo.jpg
# Use the returned material ID (e.g. 42)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "The product rotates slowly on a white pedestal, soft studio lighting, cinematic." \
  --materials "42:ref_image" --duration 10 --ratio 16:9

# 3. Generate Image — product design sheet, scene background, or any image
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A cute cat sitting on a crescent moon, watercolor style, dreamy atmosphere" \
  --model nano-banana-2 --resolution 2k --ratio 1:1
```

## Supported Models

| Model | Type | Duration / Resolution | Aspect Ratios |
|-------|------|-----------------------|---------------|
| `renoise-2.0` | Video | 5–15s (any integer) | `1:1`, `16:9`, `9:16` |
| `nano-banana-2` | Image | `1k`, `2k` | `1:1`, `16:9`, `9:16` |

---

## Material Pool

### Batch Ingest

Scan a folder of images/videos, upload each file to Renoise, analyze with Gemini for tags and descriptions, and output a structured `material-pool.json`:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/material-ingest.mjs ./materials/
```

**What it does:**
1. Recursively scans the directory for supported media files (jpg, png, webp, mp4, mov, etc.)
2. Uploads each file via the Renoise material API
3. Analyzes each file with Gemini to extract: subject, scene description, tags, and face detection (`has_face: true/false`)
4. Outputs `material-pool.json` with all metadata

### Auto-Match Materials to Shots

Score materials from a pool against shot descriptions in a project file and output an optimal mapping:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/match-materials.mjs --pool material-pool.json --shots project.json
```

**What it does:**
1. Reads the material pool and shot list
2. Scores each material against each shot based on semantic similarity (tags, descriptions, visual style)
3. Outputs a mapping table recommending the best material for each shot

### Privacy Pre-Check

The `material-ingest` script auto-detects faces via Gemini analysis and marks `has_face: true` on any material containing human faces. Materials with `has_face: true` are **automatically excluded** from `ref_image` auto-matching to avoid `PrivacyInformation` errors during generation.

---

## CLI Commands

All commands follow the pattern:

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs <domain> <action> [options]
```

Four domains: `task`, `material`, `character`, `credit`

### Check Balance

Always check balance before creating tasks.

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit me                              # User info + balance
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit estimate --duration 10           # Estimate cost
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit history                          # Transaction history
```

### Generate Video (one step: create + wait + result)

```bash
# Text-to-video finished cut (15s storyboard)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] Close-up of hands unboxing a device. [5-12s] Medium shot, woman examines it, smooth orbit. [12-15s] Wide pull back to full workspace, frame holds steady." \
  --duration 15 --ratio 16:9

# First frame only — pin the opening shot
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/start.jpg   # e.g. returns ID #42
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "The woman walks toward the camera, gentle breeze, cinematic lighting." \
  --materials "42:first_frame" --duration 10 --ratio 16:9

# First + last frame — pin start and end
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/start.jpg   # e.g. #42
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/end.jpg     # e.g. #43
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Smooth transition from dawn to sunset over the city skyline." \
  --materials "42:first_frame,43:last_frame" --duration 10 --ratio 16:9

# Multimodal reference — image-to-video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] Close-up of the product, gentle dolly in. [5-12s] Camera orbits, soft studio lighting. [12-15s] Pull back to wide shot, frame holds steady." \
  --materials "ID:ref_image" --duration 15 --ratio 16:9

# Multimodal reference — video-to-video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Recreate this motion with a robot character" \
  --materials "ID:ref_video" --duration 5
```

### Generate Image

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A cute cat sitting on a crescent moon, watercolor style, dreamy atmosphere" \
  --model nano-banana-2 --resolution 2k --ratio 1:1
```

### Create Task Only (no waiting)

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create \
  --prompt "[0-5s] ... [5-12s] ... [12-15s] ..." \
  --duration 15 --ratio 16:9 --tags cinematic
```

**Parameters for `generate` / `create`:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--prompt` | **(required)** English narrative prompt; use `[time]` annotations for video storyboards | — |
| `--model` | Model name | `renoise-2.0` (use `nano-banana-2` for images) |
| `--duration` | Video duration 5–15s | 5 (**always set 15 for Finished Cut**) |
| `--ratio` | `1:1` / `16:9` / `9:16` | `1:1` |
| `--resolution` | Image resolution `1k` / `2k` (image models only) | — |
| `--tags` | Comma-separated tags for organization | — |
| `--materials` | Material references `id:role`, comma-separated | — |
| `--characters` | Character references `id1,id2` or `id1:role,id2:role` | — |

### Task Management

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task list                          # List tasks
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task list --status completed       # Filter by status
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task list --tag project-x          # Filter by tag
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task get <id>                      # Task detail
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task result <id>                   # Get result URL
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task wait <id>                     # Poll until complete
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task wait <id> --interval 15 --timeout 300
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task cancel <id>                   # Cancel (pending only)
```

**Task statuses:** `pending` → `assigning` → `assigned` → `queued` → `running` → `completed` / `failed`. Only `pending` tasks can be cancelled (auto-refund).

### Material Upload & Management

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/file.jpg          # Upload (auto-detect type)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/clip.mp4 --type video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list                               # List materials
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list --type image --search cat
```

The upload script is also available standalone at `${CLAUDE_SKILL_DIR}/scripts/upload.mjs`.

### Material Ingest (Batch)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/material-ingest.mjs ./materials/           # Scan, upload, analyze, output pool
node ${CLAUDE_SKILL_DIR}/scripts/match-materials.mjs --pool pool.json --shots project.json  # Auto-match to shots
```

See [Material Pool](#material-pool) section above for full details.

### Character Browsing

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character list                              # List available characters
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character list --category female --search Jasmine
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character get <id>                          # Character detail
```

### Tag Management

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task tags                          # List all tags
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task tag <id> --tags a,b,c         # Update task tags
```

### Asset Registration (User Assets)

Register uploaded images as **Ark assets** so they bypass face/privacy detection when used as `reference_image`. This is the recommended way to use AI-generated character images for consistent character appearance across video segments.

```bash
# One-step: create + wait until active
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset register <material_id> --name "Character Name"

# Or step by step:
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset create <material_id> --name "Character Name"
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset wait <id>

# List and inspect
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset list
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset get <id>
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset delete <id>
```

**Asset statuses:** `pending` → `processing` → `active` / `failed`. Takes ~30-60 seconds.

Once active, use in video generation:
```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "..." --materials "asset:<asset_id>:reference_image" --duration 15
```

---

## Video Input Modes

Three mutually exclusive ways to provide visual input. **Do NOT mix them in the same task.**

| Mode | `--materials` value | Description |
|------|---------------------|-------------|
| **First frame only** | `ID:first_frame` (1 image) | Pin the first frame; prompt drives the rest |
| **First + last frame** | `ID1:first_frame,ID2:last_frame` (2 images) | Pin start and end; model generates the transition |
| **Multimodal reference** | `ID:ref_image`, `ID:ref_video`, etc. | Reference images (1–9), videos (0–3), audio (0–3) for style/content guidance |

> **Cannot combine**: e.g. you cannot use `first_frame` together with `ref_image` in the same task. If you need "first/last frame + reference style", use multimodal reference mode and describe in the prompt which image should be the first/last frame.

**Image requirements** (for first/last frame and ref_image):
- Format: jpeg, png, webp, bmp, tiff, gif
- Aspect ratio (W/H): 0.4 – 2.5
- Dimensions: 300 – 6000 px per side
- Size: < 30 MB per image

---

## Quick Templates

### Product Design Sheet

Generate a multi-angle product design sheet from product photos using the image model.

**Steps:**
1. Upload product reference images:
   ```bash
   node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/product-photo.jpg
   ```
2. Write a detailed English prompt describing the desired multi-angle layout:
   ```
   Professional product design sheet showing a sleek wireless headphone from 6 angles: front view, side view, back view, top view, 3/4 perspective, and detail close-up of ear cushion. Clean white background, studio lighting, consistent shadow direction, industrial design presentation style.
   ```
3. Generate with `nano-banana-2` at high resolution:
   ```bash
   node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
     --prompt "Professional product design sheet showing a sleek wireless headphone from 6 angles: front view, side view, back view, top view, 3/4 perspective, and detail close-up of ear cushion. Clean white background, studio lighting, consistent shadow direction, industrial design presentation style." \
     --model nano-banana-2 --resolution 2k --ratio 1:1
   ```

**Tips:** Use `--ratio 1:1` for balanced multi-angle grids. Use `--ratio 16:9` for horizontal strip layouts.

### Scene / Background Image

Generate realistic scene backgrounds for video production or compositing.

**Steps:**
1. Write a scene description prompt:
   ```
   A modern minimalist living room at golden hour, floor-to-ceiling windows overlooking a city skyline, warm sunlight casting long shadows across polished concrete floors, potted monstera plant in the corner, photorealistic, 8K detail.
   ```
2. Generate with `nano-banana-2`:
   ```bash
   node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
     --prompt "A modern minimalist living room at golden hour, floor-to-ceiling windows overlooking a city skyline, warm sunlight casting long shadows across polished concrete floors, potted monstera plant in the corner, photorealistic, 8K detail." \
     --model nano-banana-2 --resolution 2k --ratio 9:16
   ```

**Tips:** Use `--ratio 9:16` for vertical/portrait scenes (mobile, stories). Use `--ratio 16:9` for widescreen cinematic backgrounds.

---

## Video Modes

### Finished Cut Mode (Default)

For producing a complete, ready-to-use video. Leverages storyboard control to **direct content, camera movement, and pacing across time segments within a single 15s clip**:

- Music/SFX flow naturally with coherent progression
- Character consistency maintained within the same segment
- Complex continuous camera movements (e.g., close-up → orbit → wide pull back)
- Only 1 API call needed

**Default 15s. Use time-annotated prompt to control content:**

```
[0-3s] Close-up of hands unboxing a sleek black device on a white desk. Camera snaps dolly in to reveal the logo.

[3-10s] The woman picks it up, examines it from different angles. Medium shot, smooth orbit around the product. Spoken dialogue: "I've been waiting for this." Mouth clearly visible, lip-sync aligned.

[10-15s] She places it on a wireless charger, LED glows blue. Pull back to wide shot of the full workspace. The frame holds steady.
```

### Clip Stock Mode

For producing atomic clips for post-production editing. Each clip focuses on **a single action + single camera move** for maximum flexibility:

- Each clip **3–5s**, one clip does one thing
- No time annotations needed, just describe a single scene
- Batch generate multiple clips, organize with tags
- Combine freely in post-production

```bash
# Clip stock example: prepare clips for a product video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "Extreme close-up of a matte black smartwatch on white marble, slow dolly in, studio lighting." --duration 5 --tags product-x,detail
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "A hand picks up the smartwatch from the table, medium shot, tracking follows the hand upward." --duration 5 --tags product-x,pickup
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "Wrist-level shot of the watch on a person's arm, smooth orbit, outdoor golden hour." --duration 5 --tags product-x,lifestyle
```

### How to Decide

| Signal | Mode |
|--------|------|
| "generate a video", "make a short film" | Finished Cut — 15s storyboard |
| "prepare clips", "clip", "for editing", "B-roll" | Clip Stock — 3–5s atomic clips |
| "shot list", "storyboard" | Clip Stock — generate per shot |
| Unclear | **Default to Finished Cut**, confirm with user |

---

## Duration Strategy

### Single 15s (Preferred)

Use `--duration 15` with time-annotated prompts. This is the sweet spot: long enough for a meaningful narrative arc, short enough for a single generation call.

### Videos Over 15s: Segment Splitting

When the target duration exceeds 15s, split into multiple 15s segments:

```bash
# 30s = 2 × 15s segments
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "[0-5s] Opening scene... [5-12s] Development... [12-15s] Bridge, frame holds steady." --duration 15 --tags vid-001,s1
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "[0-5s] Continuing from previous... [5-12s] Climax... [12-15s] Resolution, frame holds steady." --duration 15 --tags vid-001,s2
```

**Maintain consistency:** Repeat full character appearance description at the start of each segment's prompt, use consistent lighting/style keywords, bridge with "Continuing from the previous shot:".

### Serial Chain Generation (ref_video Chaining)

For stronger visual continuity across segments, use the output of the previous segment as a `ref_video` input:

1. Generate segment 1 and wait for completion
2. Download or reference the result video
3. Upload the result as material, use as `--materials "ID:ref_video"` for segment 2

### Visual Anchor Method

For highest consistency across multiple clips or segments:
- Generate reference images as a storyboard grid (see below)
- Use the same grid as `ref_image` for all related generations
- The shared visual reference anchors style, characters, and palette

---

## Storyboard Grid Workflow

The storyboard grid method produces the best visual consistency by anchoring each generation to a reference image from a unified grid.

### Why Storyboard Grid?

| Approach | Visual Consistency | Privacy Risk | Setup Effort |
|----------|-------------------|--------------|--------------|
| **Storyboard Grid (preferred)** | Highest — all panels share style context | Low — faces are small in grid cells | Medium |
| Text-to-Video (fallback) | Lower — style varies per call | None | Low |
| Individual ref_image | Medium | High — close-up faces trigger blocking | Medium |

### Step-by-Step

1. **Generate reference images as a grid**: Use Midjourney, Gemini, or any image tool to create a single composite image with all shots as panels in a 3×3 (9-grid) or 4×4 (16-grid) layout. Each panel shows one key moment with consistent character appearance and style.

2. **Upload the grid as material**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload storyboard_grid.png
   # Returns material ID
   ```

3. **Generate video with ref_image + time-annotated prompt**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
     --prompt "Follow the attached storyboard panels. [0-5s] ... [5-10s] ... [10-15s] ..." \
     --materials "MATERIAL_ID:ref_image" \
     --duration 15 --ratio 16:9
   ```

4. **For videos > 15s**: Split into multiple grids (e.g., 3×3 for shots 1–9, another for shots 10–18), generate each 15s segment with its corresponding grid.

5. **Fallback**: If a grid triggers `PrivacyInformation`, retry without `--materials` (pure text-to-video), copying full character descriptions into the prompt.

### When to Use Each Approach

| Signal | Approach |
|--------|----------|
| Any project with recurring characters | **Storyboard grid** (preferred) |
| Product shots, landscapes, no people | Image-to-Video with individual ref_image |
| Grid ref_image blocked by privacy detection | **Text-to-Video** (fallback) |
| Quick one-off generation, no consistency needs | Text-to-Video |

---

## Prompt Writing

**Essential rules** (see `${CLAUDE_SKILL_DIR}/references/video-capabilities.md` for the full guide and camera movement cheat sheet):

- **Must be English** — The model understands English narrative paragraphs best. Non-English text or tag lists degrade quality.
- **Natural narrative paragraphs** — Use complete descriptive sentences, not comma-separated keywords. The model needs causal and temporal relationships.
- **Specific over abstract** — "a golden retriever running through shallow ocean waves at sunset" beats "a dog on a beach". More detail = more accurate output.
- **Structure**: Subject (detailed appearance) + Action (what happens) + Camera (camera movement) + Scene (environment/lighting) + Style (visual style)

**Shot density rules for storyboard videos:**
- **5s**: 1 shot, single action + camera
- **10s**: 2–3 shots with time annotations
- **15s**: 3–4 shots with time annotations
- End the last segment with "frame holds steady" for clean endings or easy continuation

**Negative prompting:** Describe what you want, not what you don't want. The model responds best to positive, descriptive language.

---

## User Assets — AI-Generated Character References (Recommended for New Characters)

> **For multi-scene projects, see [Multi-Scene Production Workflow](#multi-scene-production-workflow) first** — it covers the full end-to-end process including character setup.

When the user doesn't have pre-existing character references, **generate character images with nano-banana-2 and register them as Ark assets**. This creates face-safe references that bypass privacy detection.

### Full Workflow

```bash
# 1. Generate a character design sheet
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 1:1 \
  --prompt "Character reference sheet for [name]. [appearance]. Multiple angles: front, 3/4, profile. Clean white background."

# 2. Download the generated image
curl -s -o character.png "<image_url>"

# 3. Upload as material
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload character.png
# Returns material #ID

# 4. Register as asset (one-step: create + wait)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset register <material_id> --name "Character Name"
# Waits ~30-60s, returns asset #ID when active

# 5. Use in video generation
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] ... [5-10s] ... [10-15s] ..." \
  --materials "asset:<asset_id>:reference_image" --duration 15 --ratio 16:9
```

### Why User Assets?

| Approach | Privacy Safe | Character Consistency | Setup |
|----------|-------------|----------------------|-------|
| **User Asset (recommended)** | ✅ `asset://` bypasses detection | High — same face reference | ~1 min registration |
| Character Library | ✅ pre-registered | High — platform characters | Must exist in library |
| ref_image (material) | ❌ blocked if face detected | High | Immediate |
| Text-only description | ✅ no image | Low — varies per generation | None |

### Decision Tree

| Scenario | Approach |
|----------|----------|
| Character exists in library | `--characters "ID"` |
| No library character, have/can generate face image | **User Asset** → `asset register` → `--materials "asset:ID:reference_image"` |
| No library character, no face image, quick generation | Text-only with Character Bible |
| Product/landscape images (no faces) | `--materials "ID:ref_image"` (safe) |

---

## Character Library — The Correct Way to Handle Human Faces

The Renoise platform has a **Character Library** for managing human face/body references. This is the **primary and recommended** way to maintain character consistency across video segments and avoid `PrivacyInformation` errors.

### Why Character Library?

**Do NOT pass images containing human faces as `ref_image`** — the privacy detection system will block them. The correct workflow is:

1. **Create characters** on the Renoise platform (https://www.renoise.ai) by uploading face/body reference photos
2. **Browse characters** via the CLI to find their IDs
3. **Reference characters** in video generation tasks via `--characters "ID"`

Once a face is registered in the Character Library, the platform handles it safely without triggering privacy detection.

### Workflow

```bash
# 1. Browse available characters
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character list
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character list --category female --search "warrior"

# 2. Get character details
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character get <id>

# 3. Use character in video generation
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A woman walks through a garden..." \
  --characters "42" --duration 15 --ratio 16:9

# 4. Multiple characters (with optional role hints)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Two people meet at a cafe..." \
  --characters "42:reference_image,53:reference_image" --duration 15 --ratio 16:9
```

### How It Works in the API

When using `--characters`, the CLI sends `{ "character_id": ID, "role": "reference_image" }` in the materials array. This is different from `{ "id": ID, "role": "ref_image" }` (material reference). The platform treats character references specially — no privacy detection is triggered.

### Decision Tree for Human Faces

| Scenario | Approach |
|----------|----------|
| Characters exist in the library | `--characters "ID"` (strongest consistency, no privacy issues) |
| No characters in library, custom project | Create characters on https://www.renoise.ai first, then use `--characters` |
| Quick generation, no library setup | **Text-to-Video** with detailed Character Bible (no materials at all) |
| Product/landscape images (no faces) | `--materials "ID:ref_image"` (safe, no privacy issues) |
| Storyboard grids with small figures | May or may not trigger — test first; fall back to text-only |

### What NOT to Do

- ❌ Upload face photos as materials and use `--materials "ID:ref_image"` — will be blocked
- ❌ Put storyboard grids with close-up faces as `ref_image` — will be blocked

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `PrivacyInformation` | Reference image/video with human faces blocked by privacy detection | **Primary fix**: use Character Library (`--characters "ID"`) or User Assets (`asset register`) — both bypass detection. **Fallback**: switch to Text-to-Video and describe appearance in text. |
| `Insufficient credits` (402) | Balance too low | Inform user of current balance and required cost, suggest top-up at https://www.renoise.ai |
| Task `failed` | Generation failed | Use `task get <id>` to check error. Common causes: prompt violation, server timeout. Adjust and retry |
| `Auth Error` (401) | Invalid API Key | Check that `RENOISE_API_KEY` environment variable is set correctly |
| `wait` timeout | Generation exceeds timeout | 15s videos typically need 5–10 minutes. Increase `--timeout` (e.g., 900) |
| Material upload fails | File too large or unsupported format | Check: < 30 MB, supported format (jpg, png, webp, mp4, mov, etc.) |

---

## References

- [Video Model Capabilities](${CLAUDE_SKILL_DIR}/references/video-capabilities.md) — Model specs, detailed prompt writing guide, camera movement cheat sheet
- [API Endpoint Reference](${CLAUDE_SKILL_DIR}/references/api-endpoints.md) — Renoise API endpoints and request/response formats
