---
name: renoise-gen
description: >
  Renoise platform CLI — generate AI videos and images, upload materials,
  register assets, browse characters, poll results. This is the tool layer.
  For creative direction (story, prompts, visual development, anchoring strategy),
  use the director skill.
  Use when user asks to "generate video", "create video", "text to video",
  "image to video", "generate image", "AI video", "AI image", "product design sheet",
  "scene background", "material pool", "ingest materials", or needs direct CLI access.
allowed-tools: Bash, Read, Write, Glob
metadata:
  author: renoise
  version: 0.3.0
  category: video-production
  tags: [general, video-generation, image-generation, material-pool]
---

# Renoise CLI — Tool Reference

CLI for the Renoise AI video/image generation platform. This skill covers **how to use the tools**. For creative decisions (what to generate, how to write prompts, anchoring strategy), see the **director** skill.

> **Platform URL**: **https://www.renoise.ai** — NEVER renoise.com.

---

## Quick Start

```bash
# Text-to-Video — 15s finished cut
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "[0-5s] Close-up of a cat on the moon, slow push in. [5-12s] The cat dances under twinkling stars, smooth orbit. [12-15s] Wide pull back revealing the full lunar landscape, frame holds steady." \
  --duration 15 --ratio 16:9

# Image-to-Video — upload a reference image, then generate
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/photo.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "The product rotates slowly on a white pedestal, soft studio lighting, cinematic." \
  --materials "42:ref_image" --duration 10 --ratio 16:9

# Generate Image
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

## CLI Commands

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs <domain> <action> [options]
```

Domains: `task`, `material`, `asset`, `character`, `credit`

### Credit

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit me                    # User info + balance
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit estimate --duration 15 # Estimate cost
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit history                # Transaction history
```

### Task — Generate & Manage

```bash
# Generate (create + wait + return result)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "..." --duration 15 --ratio 16:9 \
  [--materials "..."] [--characters "..."] [--tags "..."]

# Create only (returns immediately)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task create \
  --prompt "..." --duration 15 --ratio 16:9

# Management
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task list [--status completed] [--tag project-x]
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task get <id>
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task result <id>
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task wait <id> [--interval 10] [--timeout 600]
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task cancel <id>              # Pending only

# Chaining — download result → upload as material (one step)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task chain <id>
# → prints new material ID, ready for --materials "ID:ref_video"

# Tags
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task tags
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task tag <id> --tags a,b,c
```

**Parameters for `generate` / `create`:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--prompt` | **(required)** English narrative prompt | — |
| `--model` | Model name | `renoise-2.0` (video) or `nano-banana-2` (image) |
| `--duration` | Video duration 5–15s | `5` |
| `--ratio` | `1:1` / `16:9` / `9:16` | `1:1` |
| `--resolution` | Image resolution `1k` / `2k` (image models only) | — |
| `--tags` | Comma-separated tags | — |
| `--materials` | Material refs, comma-separated (see [Material Roles](#material-roles)) | — |
| `--characters` | Character refs: `id1,id2` or `id1:role,id2:role` | — |

**Task statuses:** `pending` → `assigning` → `assigned` → `queued` → `running` → `completed` / `failed`

### Material — Upload & Browse

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/file.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/clip.mp4 --type video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list [--type image] [--search cat]
```

### Asset — Register for Face/Character Use

Register uploaded images as Ark assets so they bypass privacy detection when used as `reference_image`.

```bash
# One-step: create + wait until active (~30-60s)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset register <material_id> --name "Character Name"

# Step by step
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset create <material_id> --name "Character Name"
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset wait <id>

# Manage
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset list
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset get <id>
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs asset delete <id>
```

**Asset statuses:** `pending` → `processing` → `active` / `failed`

### Character — Browse Platform Library

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character list [--category female] [--search Jasmine]
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs character get <id>
```

---

## Material Roles

Three mutually exclusive **modes** for visual input. Do NOT mix modes.

| Mode | `--materials` value | Description |
|------|---------------------|-------------|
| **First frame only** | `ID:first_frame` | Pin the first frame; prompt drives the rest |
| **First + last frame** | `ID1:first_frame,ID2:last_frame` | Pin start and end; model generates transition |
| **Multimodal reference** | `ID:ref_image`, `ID:ref_video`, `asset:ID:reference_image` | References for style/content guidance |

> **Mode-level exclusion**: `first_frame` cannot be mixed with `ref_image`.
>
> **Within multimodal reference mode**, `ref_image` + `ref_video` + `asset:ID:reference_image` combine freely — they use different API fields (`id` vs `user_asset_id`).

### Available roles in multimodal reference mode

| Role | Syntax | What it does | Limit |
|------|--------|-------------|-------|
| Character asset | `asset:ID:reference_image` | Locks face/body identity. Bypasses privacy detection. | Multiple OK |
| Reference video | `ID:ref_video` | Continues motion/scene from previous segment | Up to 3 |
| Reference image | `ID:ref_image` | Style/environment/palette guidance. **No human faces.** | Up to 9 |
| Character library | `--characters "ID"` | Platform character. Bypasses privacy detection. | Multiple OK |

Combine as needed per segment:
```bash
# Character + continuity + environment
--materials "asset:27:reference_image,42:ref_video,99:ref_image"

# Character only
--materials "asset:27:reference_image"

# Environment only (B-roll)
--materials "99:ref_image"
```

API representation:
```json
"materials": [
  { "user_asset_id": 27, "role": "reference_image" },
  { "id": 42, "role": "ref_video" },
  { "id": 99, "role": "ref_image" }
]
```

### Image requirements (for first/last frame and ref_image)

- Format: jpeg, png, webp, bmp, tiff, gif
- Aspect ratio (W/H): 0.4 – 2.5
- Dimensions: 300 – 6000 px per side
- Size: < 30 MB

### Privacy detection

Images with human faces passed as `ref_image` will be blocked with `PrivacyInformation` error. Two ways to bypass:
- **User Asset**: `asset register` → `asset:ID:reference_image`
- **Character Library**: `--characters "ID"`

Never pass raw face images as `ref_image`.

---

## Material Pool (Batch Ingest)

Scan a folder, upload, analyze with Gemini, output structured `material-pool.json`:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/material-ingest.mjs ./materials/
```

Auto-match materials to shots:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/match-materials.mjs --pool material-pool.json --shots project.json
```

Face detection: materials with `has_face: true` are automatically excluded from `ref_image` matching.

---

## Prompt Basics

The renoise-2.0 model responds best to:

- **English only** — non-English text or tag lists degrade quality
- **Narrative paragraphs** — complete descriptive sentences, not comma-separated keywords
- **Specific over abstract** — "a golden retriever running through shallow ocean waves at sunset" beats "a dog on a beach"
- **Positive language** — describe what you want, not what you don't want

**Structure**: Subject (appearance) + Action (what happens) + Camera (movement) + Scene (environment) + Style (visual style)

**Shot density** for time-annotated prompts:
- 5s: 1 shot, single action + camera
- 10s: 2–3 shots
- 15s: 3–4 shots
- End the last segment with "frame holds steady" for clean endings

For the full prompt writing guide, see the **director** skill's `prompt-craft.md`.

---

## Video Modes

| Mode | Duration | When to use |
|------|----------|-------------|
| **Finished Cut** | 15s with `[0-3s]...[3-10s]...[10-15s]...` time annotations | Default — complete scenes with camera changes |
| **Clip Stock** | 3–5s, single action + camera, no time annotations | Atomic clips for post-production assembly |

Finished Cut is the default. Use Clip Stock when the user needs individual shots to combine in an editor.

---

## Multi-Segment Basics

When a video exceeds 15s, split into segments:

1. Each segment 5–15s (default 15s unless beat alignment or pacing requires otherwise)
2. Repeat full character description in every segment prompt
3. Start each segment after S1 with "Continuing from the previous shot: [ending state of prev segment]"
4. Use `task chain <id>` to turn a completed segment into ref_video material for the next

### Face handling decision tree

| Scenario | Approach |
|----------|----------|
| Character in platform library | `--characters "ID"` |
| Custom character, have/can generate face image | `asset register` → `--materials "asset:ID:reference_image"` |
| Quick one-off, no face image | Text-only description in prompt |
| Product/landscape (no faces) | `--materials "ID:ref_image"` |

Never pass raw face images as `ref_image` — privacy detection will block them.

---

## Quick Templates

### Product Design Sheet

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Professional product design sheet showing a sleek wireless headphone from 6 angles: front view, side view, back view, top view, 3/4 perspective, detail close-up. Clean white background, studio lighting, consistent shadow direction." \
  --model nano-banana-2 --resolution 2k --ratio 1:1
```

### Scene / Background Image

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A modern minimalist living room at golden hour, floor-to-ceiling windows overlooking a city skyline, warm sunlight, photorealistic, 8K detail." \
  --model nano-banana-2 --resolution 2k --ratio 16:9
```

---

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `PrivacyInformation` | Face in `ref_image` | Use User Asset or Character Library instead |
| `Insufficient credits` (402) | Balance too low | `credit me`, top up at https://www.renoise.ai |
| Task `failed` | Generation failed | `task get <id>` to check error. Adjust prompt and retry |
| `Auth Error` (401) | Invalid API Key | Check `RENOISE_API_KEY` env var |
| `wait` timeout | Generation took too long | Multi-anchor tasks take 8–12 min. Use `--timeout 900` or `task create` + `task wait --timeout 900` |
| Material upload fails | File too large / wrong format | < 30 MB, supported format (jpg, png, webp, mp4, mov, etc.) |

---

## References

- [Video Model Capabilities](${CLAUDE_SKILL_DIR}/references/video-capabilities.md) — Model specs, camera movement reliability, style keywords
- [API Endpoint Reference](${CLAUDE_SKILL_DIR}/references/api-endpoints.md) — Raw API endpoints and request/response formats
