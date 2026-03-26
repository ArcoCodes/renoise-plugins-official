---
name: renoise-gen
description: Generate AI videos and images via Renoise platform. Create tasks, upload materials, browse characters, poll results, download outputs. Supports text-to-video, image-to-video, video-to-video, and text-to-image. Use this skill whenever the user asks to "generate video", "create video", "text to video", "image to video", "generate image", "AI video", "AI image", or describes any video/image content they want generated with AI.
allowed-tools: Bash, Read, Write, Glob
metadata:
  author: renoise
  version: 0.1.0
  category: video-production
  tags: [general, video-generation]
---

# AI Video & Image Generation (via Renoise)

Generate AI videos and images through the Renoise platform.

> **IMPORTANT**: The Renoise website is **https://www.renoise.ai** — NOT renoise.com. Always use `renoise.ai` when referencing the platform URL.

## Supported Models

| Model | Type | Description |
|-------|------|-------------|
| `renoise-2.0` | Video | Default video model with storyboard control |
| `nano-banana-2` | Image | AI image generation model |

## Core Concept: Two Video Modes — Finished Cut vs Clip Stock

Choose between two generation modes based on user needs:

### Finished Cut Mode — Default

For producing a complete, ready-to-use video. Leverages powerful storyboard control to **direct content, camera movement, and pacing across different time segments within a single 15s clip**:

- Music/SFX flow naturally with coherent progression
- Character consistency maintained within the same segment
- Complex continuous camera movements (e.g., close-up → orbit → wide pull back)
- Only 1 API call needed

**Default 15s, use time-annotated prompt to control content.**

```
[0-3s] Close-up of hands unboxing a sleek black device on a white desk. Camera snaps dolly in to reveal the logo.

[3-10s] The woman picks it up, examines it from different angles. Medium shot, smooth orbit around the product. Spoken dialogue: "I've been waiting for this." Mouth clearly visible, lip-sync aligned.

[10-15s] She places it on a wireless charger, LED glows blue. Pull back to wide shot of the full workspace. The frame holds steady.
```

### Clip Stock Mode

For producing atomic clips for post-production editing. Each clip focuses on **a single action + single camera move** for maximum flexibility:

- Each clip **3-5s**, one clip does one thing
- No time annotations needed, just describe a single scene
- Batch generate multiple clips, organize with tags
- Combine freely in post-production

```bash
# Clip stock example: prepare clips for a product video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "Extreme close-up of a matte black smartwatch on white marble, slow dolly in, studio lighting." --duration 5 --tags product-x,detail
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "A hand picks up the smartwatch from the table, medium shot, tracking follows the hand upward." --duration 5 --tags product-x,pickup
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "Wrist-level shot of the watch on a person's arm, smooth orbit, outdoor golden hour." --duration 5 --tags product-x,lifestyle
```

### How to Decide?

| Signal | Mode |
|--------|------|
| "generate a video", "make a short film" | Finished Cut — 15s storyboard |
| "prepare clips", "clip", "for editing", "B-roll" | Clip Stock — 3-5s atomic clips |
| "shot list", "storyboard" | Clip Stock — generate per shot |
| Unclear | **Default to Finished Cut**, confirm with user |

## Model Specs

### renoise-2.0 (Video)

| Parameter | Value |
|-----------|-------|
| Duration range | 5-15s, any integer |
| **Default duration** | **15s** (maximize storyboard capability) |
| Aspect ratio | `1:1`, `16:9`, `9:16` |
| Recommended mode | **Image-to-Video with storyboard grid** (best visual consistency) |
| Prompt language | **English**, natural narrative paragraphs |

> **Default to Image-to-Video with storyboard grid**: Generate reference images as a 9-grid or 16-grid composite, upload as `ref_image`. Grid images bypass privacy detection more reliably than individual face photos because faces are small within the grid cells. **Fallback to Text-to-Video** only when the grid is still blocked by privacy detection (`PrivacyInformation` error) — text-only prompts are never subject to this limitation.

### nano-banana-2 (Image)

| Parameter | Value |
|-----------|-------|
| Resolution | `1k`, `2k` |
| Aspect ratio | `1:1`, `16:9`, `9:16` |
| Prompt language | **English** |

See `${CLAUDE_SKILL_DIR}/references/video-capabilities.md` for details.

## Configuration

CLI path: `${CLAUDE_SKILL_DIR}/renoise-cli.mjs` (Node.js 18+)

API Key and base URL are configured via environment variables (`RENOISE_API_KEY`, `RENOISE_BASE_URL`). Get your API key at https://www.renoise.ai (NOT renoise.com).

## CLI Commands

All commands: `node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs <domain> <action> [options]`

Four domains: `task`, `material`, `character`, `credit`

### Check Balance (always check before creating tasks)
```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit me                              # User info + balance
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit estimate --duration 10           # Estimate cost
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit history                          # Transaction history
```

### Video Input Modes (Mutually Exclusive)

Three ways to provide visual input. **These are mutually exclusive — do NOT mix them in the same task.**

| Mode | `--materials` | Description |
|------|---------------|-------------|
| **First frame only** | `ID:first_frame` (1 image) | Pin the first frame; prompt is optional |
| **First + last frame** | `ID1:first_frame,ID2:last_frame` (2 images, both roles required) | Pin start and end frames; model generates the transition |
| **Multimodal reference** | `ID:ref_image`, `ID:ref_video`, etc. | Reference images (1-9), videos (0-3), audio (0-3) for style/content guidance |

> **Cannot combine**: e.g. you cannot use `first_frame` together with `ref_image` in the same task. If you need "first/last frame + reference style", use multimodal reference mode and describe in the prompt which image should be the first/last frame — but for strict frame accuracy, prefer the dedicated first+last frame mode.

**Image requirements** (for first/last frame and ref_image):
- Format: jpeg, png, webp, bmp, tiff, gif
- Aspect ratio (W/H): 0.4 ~ 2.5
- Dimensions: 300 ~ 6000 px per side
- Size: < 30 MB per image

### Generate Video (one step: create + wait for completion)
```bash
# Text-to-video finished cut (default renoise-2.0, 15s storyboard)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] Close-up of a cat on the moon, slow push in. [5-12s] The cat starts dancing, smooth orbit camera, stars twinkling. [12-15s] Wide pull back revealing the full lunar landscape, frame holds steady. Cinematic lighting, shallow depth of field." \
  --duration 15 --ratio 1:1

# First frame only — pin the opening shot
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/start.jpg
# (note the material ID from output, e.g. #42)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "The woman walks toward the camera, gentle breeze, cinematic lighting." \
  --materials "42:first_frame" --duration 10 --ratio 16:9

# First + last frame — pin both start and end
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/start.jpg   # e.g. #42
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/end.jpg     # e.g. #43
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Smooth transition from dawn to sunset over the city skyline." \
  --materials "42:first_frame,43:last_frame" --duration 10 --ratio 16:9

# Multimodal reference — image-to-video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/photo.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] Close-up of the product on a white surface, gentle dolly in. [5-12s] Camera orbits around the product revealing all angles, soft studio lighting. [12-15s] Pull back to wide shot, product centered, frame holds steady." \
  --materials "ID:ref_image" --duration 15 --ratio 16:9

# Multimodal reference — video-to-video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "recreate this motion with a robot character" \
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

**generate/create parameters**:
- `--prompt` (required) — English natural narrative prompt; use `[time segment]` annotations for video storyboards
- `--model` — Model name (default: renoise-2.0; use nano-banana-2 for images)
- `--duration` — Video duration 5-15s (CLI default: 5). **Always set `--duration 15` for Finished Cut mode**
- `--ratio` — `1:1` / `16:9` / `9:16` (default: 1:1)
- `--resolution` — Image resolution `1k` / `2k` (image models only)
- `--tags` — Comma-separated tags for organization
- `--materials` — Material references `id:role`, comma-separated for multiple
- `--characters` — Character references `id1,id2` or `id1:role,id2:role`

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

### Material Upload & Management
```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/file.jpg          # Upload (auto-detect type)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/clip.mp4 --type video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list                               # List materials
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list --type image --search cat
```

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

## Task Statuses

`pending` → `assigning` → `assigned` → `queued` → `running` → `completed` / `failed`

Only `pending` tasks can be cancelled (auto-refund).

## Workflows

### Finished Cut Mode (Default)
```
credit me → credit estimate → task generate (15s + storyboard prompt)
```

`task generate` = create + wait + output result, all in one step.

### Clip Stock Mode
```
credit me → credit estimate → task create (3-5s × N, grouped by tag) → task wait each → collect task result
```

Batch generate atomic clips, combine in post-production.

### Image Generation
```
credit me → task generate --model nano-banana-2 --prompt "..." --resolution 2k
```

### With First/Last Frame
```
material upload (start.jpg) → material upload (end.jpg) → task generate (--materials "ID1:first_frame,ID2:last_frame")
```

First frame only: omit the second upload, use `--materials "ID:first_frame"`.

### With Multimodal Reference
```
material upload → task generate (--materials "ID:ref_image" or "ID:ref_video")
```
**Preferred**: Use storyboard grid images as ref_image — see "Storyboard Grid Workflow" section below.

### With Character Reference
```
character list → task generate (--characters "ID")
```

### Finished Cut > 15s

When target duration exceeds 15s, split into 15s segments, each with its own storyboard prompt:

```bash
# 30s = 2 × 15s
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "[0-5s] ... [5-12s] ... [12-15s] ..." --duration 15 --tags vid-001,s1
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create --prompt "[0-5s] ... [5-12s] ... [12-15s] ..." --duration 15 --tags vid-001,s2
```

**Maintain consistency**: Repeat full character appearance description at the start of each segment's prompt, use consistent lighting/style keywords, bridge with `Continuing from the previous shot:`.

## Storyboard Grid Workflow (Preferred Approach)

The storyboard grid method produces the best visual consistency across clips by anchoring each generation to a reference image from a unified grid.

### Why Storyboard Grid?

| Approach | Visual Consistency | Privacy Detection Risk | Setup Effort |
|----------|-------------------|----------------------|--------------|
| **Storyboard Grid (preferred)** | Highest — all panels share style context | Low — faces are small in grid cells | Medium |
| Text-to-Video (fallback) | Lower — model interprets style differently each call | None | Low |
| Individual ref_image | Medium | High — close-up faces trigger blocking | Medium |

### Step-by-Step

1. **Generate reference images as a grid**: Use Midjourney (v7) or Gemini to create a single composite image containing all shots as panels in a 3x3 (9-grid) or 4x4 (16-grid) layout. Each panel shows one key moment from a shot with consistent character appearance and style.

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

4. **For videos > 15s**: Split into multiple grids (e.g., 3x3 for shots 1-9, another for shots 10-18), generate each 15s segment with its corresponding grid.

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

**General rules**:
- **Must be English** — The model understands English narrative paragraphs best. Chinese or tag lists degrade quality and coherence.
- **Natural narrative paragraphs** — Use complete descriptive sentences, not comma-separated keyword lists (e.g., `woman, café, coffee, 4k`). The model needs to understand causal and temporal relationships.
- **Specific > Abstract** — `a golden retriever running through shallow ocean waves at sunset` is far better than `a dog on a beach`. More detail = more accurate output.
- **Structure**: Subject (detailed appearance) + Action (action sequence) + Camera (camera movement) + Scene (environment/lighting) + Style (visual style)

**Finished cut prompt**:
- Use `[time segment]` annotations for storyboard beats — core advantage, the model switches content and camera per segment
- Each segment = Subject + Action + Camera
- At least 2-3 camera changes (e.g., close-up → orbit → wide pull back) for editing rhythm
- End last segment with `frame holds steady` for easy continuation or natural ending

**Clip stock prompt**:
- No time annotations needed, describe a single scene directly
- One clip does one thing: one action + one camera move, for flexible post-editing
- Keep concise, 3-5 sentences

**Image prompt**:
- Describe content, style, and atmosphere
- No time annotations or camera movements needed

See `${CLAUDE_SKILL_DIR}/references/video-capabilities.md` for detailed prompt writing guide and camera movement cheat sheet.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `PrivacyInformation` | Reference image/video with human faces blocked by privacy detection | Switch to Text-to-Video, describe person's appearance in text |
| `Insufficient credits` (402) | Balance too low | Inform user of current balance and required cost, suggest top-up |
| Task `failed` | Generation failed | Use `task get <id>` to check error field. Common causes: prompt violation, server timeout. Adjust prompt and retry |
| `Auth Error` (401) | Invalid API Key | Check that the `RENOISE_API_KEY` environment variable is set correctly |
| `wait` timeout | Generation time exceeds timeout | 15s videos typically need 5-10 minutes, increase `--timeout` (e.g., 900) |

## References

- [Video Model Capabilities](references/video-capabilities.md) — Model specs, detailed prompt writing guide, camera movement cheat sheet. Consult when writing prompts.
- [API Endpoint Reference](reference.md) — Renoise API endpoints and request/response formats. Consult when calling API directly or debugging HTTP errors.
