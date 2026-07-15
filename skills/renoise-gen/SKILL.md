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
  version: 0.4.0
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

# Generate Image with Text/Typography (use gpt-image-2 for best prompt-following on text/logos)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Hero product poster with bold headline 'MIDNIGHT BLOOM' in serif type, centered, minimalist layout" \
  --model gpt-image-2 --resolution 2k --ratio 16:9

# Cheaper/faster video draft
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A cat dancing under twinkling stars, smooth orbit" \
  --model renoise-2.0-mini --duration 10 --ratio 9:16

# Image-to-video with a single reference image (I2V only)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "The person in the reference image turns to face the camera and smiles" \
  --model grok-video-1.5 --materials "42:ref_image" --duration 8 --ratio 16:9

# Gemini Omni Flash — video with synced audio (16:9/9:16 only, ≤10s)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A chef plates a dessert in a warm, softly lit kitchen, gentle clinking sounds" \
  --model gemini-omni-flash --duration 8 --ratio 16:9

# Seedream 5.0 Lite image
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Editorial fashion photo, studio lighting, high-contrast shadows" \
  --model seedream-5-0-lite --resolution 2k --ratio 3:4

# Grok Image (xAI) — higher-quality tier
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A neon-lit cyberpunk alley, rain reflections, cinematic lighting" \
  --model grok-image-quality --resolution 2k --ratio 16:9
```

## Supported Models

| Model | Type | Duration / Resolution | Aspect Ratios | Notes |
|-------|------|-----------------------|---------------|-------|
| `renoise-2.0` / `sd-2.0` | Video | 4–15s, `720p`/`1080p` | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` | Aliases: `seedance-2.0`, `youmeng-2.0`; refs image ≤9, video ≤3, audio ≤3; supports watermark/audio generation |
| `renoise-2.0-fast` / `sd-2.0-fast` | Video | 4–15s, `720p` only | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` | Aliases: `seedance-2.0-fast`, `youmeng-2.0-fast`; refs image ≤9, video ≤3, audio ≤3 |
| `renoise-2.0-mini` / `sd-2.0-mini` | Video | 4–15s, `720p` only | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` | Aliases: `seedance-2.0-mini`, `youmeng-2.0-mini`; refs image ≤9, video ≤3, audio ≤3; cheapest Seedance tier, no 1080p |
| `happyhorse-1.0` | Video | 3–15s, `720p`/`1080p` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` | Alias typo accepted: `happyhourse-1.0`; refs image ≤9, video 0; no `last_frame` |
| `kling-3.0-omni` | Video | 3/5/10/15s, `720p`/`1080p` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` | refs image ≤7, video ≤1, audio unsupported; prompt ≤2500 chars; ref video 3–10s, dimensions 720–2160px |
| `grok-video` | Video | 1–15s (R2V clamped to ≤10s), `480p`/`720p` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` | xAI Grok Imagine; supports T2V/I2V/R2V; refs image ≤7 (R2V mode); 1080p not yet available upstream |
| `grok-video-1.5` | Video | 1–15s, `480p`/`720p` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` | xAI Grok Imagine; **I2V only** — requires exactly 1 reference image, no text-only generation |
| `gemini-omni-flash` | Video | 3–10s, `720p` only (fixed) | `16:9`, `9:16` only | Google Vertex Interactions API; ratio is **required** (no default); refs image ≤6, `first_frame` + `ref_image` can combine; no ref video/audio |
| `nano-banana-2` | Image | `1k`, `2k`, `4k` | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`, `1:4`, `4:1`, `1:8`, `8:1` | Google Vertex; widest ratio set |
| `nano-banana-2-lite` | Image | `1k` only | Same ratio set as `nano-banana-2` | Google Vertex; cheaper/lite tier; max 14 ref images |
| `nano-banana-pro` | Image | `1k`, `2k`, `4k` | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` | Google Vertex; higher quality tier |
| `midjourney-v7` | Image | _(no `--resolution`)_ | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3` | Max 4 ref images; alias `midjourney` |
| `mj-v8.1` | Image | _(no `--resolution`)_ | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3` | Aliases: `midjourney-v8.1`, `mj-8.1`; max 4 ref images; latest Midjourney version |
| `gpt-image-2` | Image | `1k`, `2k`, `4k` | `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `16:9`, `9:16`, `21:9` | Max 16 ref images; strongest at text/typography |
| `seedream-5-0-lite` | Image | `2k`, `3k`, `4k` | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9` | Max 14 ref images |
| `seedream-5-0-pro` | Image | `1k`, `2k` | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9` | Max 10 ref images; higher quality Seedream tier |
| `grok-image` | Image | `1k`, `2k` | `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2` | xAI Grok Imagine; max 3 ref images |
| `grok-image-quality` | Image | `1k`, `2k` | `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2` | xAI Grok Imagine, higher-quality/higher-cost tier; max 3 ref images |

**Choosing a video model:**
- `renoise-2.0` — default, best quality/consistency, up to 1080p.
- `renoise-2.0-mini` / `renoise-2.0-fast` — cheaper drafts, 720p only.
- `kling-3.0-omni` / `happyhorse-1.0` — alternative providers, similar capability tier.
- `grok-video` — flexible T2V/I2V/R2V from xAI; use for R2V-style continuity with up to 7 reference images.
- `grok-video-1.5` — pure I2V, needs exactly one reference image.
- `gemini-omni-flash` — video with synchronized audio; only for 16:9/9:16 clips ≤10s.

**Choosing an image model:**
- `nano-banana-2` — default, cheapest, flexible ratios (incl. extreme 8:1 / 1:8 banners).
- `nano-banana-2-lite` — cheapest Nano Banana tier, fixed `1k`.
- `nano-banana-pro` — higher fidelity; use for hero / final frames.
- `midjourney-v7` / `mj-v8.1` — strongest stylization; pass `--ratio` only (no resolution). Prefer `mj-v8.1` for the latest Midjourney model.
- `gpt-image-2` — best prompt-following for text/logos/typography in image.
- `seedream-5-0-lite` — alternative provider, up to `4k`, wide ratio set.
- `seedream-5-0-pro` — higher quality Seedream tier; `1k`/`2k` only, max 10 ref images.
- `grok-image` / `grok-image-quality` — xAI Grok Imagine; `-quality` for higher fidelity at higher cost, both capped at `2k` and 3 ref images.

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
| `--model` | Model name | `renoise-2.0` / `sd-2.0` (video) or `nano-banana-2` (image) |
| `--type` | Optional `video` / `image`; must match model | inferred from model |
| `--duration` | Video duration, model-specific | `5` |
| `--ratio` | Aspect ratio — supported set varies per model (see [Supported Models](#supported-models)) | `1:1` |
| `--resolution` | Image `1k`/`2k`/`4k`; video `720p`/`1080p`; omit for `midjourney-v7` | model default |
| `--watermark` | Add video watermark and apply 10% credit discount | off |
| `--audio-generation 0|1`, `--no-audio-generation` | Toggle generated audio when model supports it | model default |
| `--template-id` | Create from template | — |
| `--tags` | Comma-separated tags | — |
| `--materials` | Material refs, comma-separated (see [Material Roles](#material-roles)); role required | — |
| `--characters` | Character refs: `id1,id2` or `id1:role,id2:role` | — |

**Task statuses:** user-facing statuses are `pending`, `assigned`, `running`, `completed`, `failed`, `cancelled`. Internal states such as `submitted`, `queued`, `assigning`, `archiving`, and `preparing_facepass` are collapsed to `running` by the public API.

### Material — Upload & Browse

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/file.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/clip.mp4 --type video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/audio.mp3 --type audio
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list [--type image|video|audio] [--search cat] [--ids 1,2] [--mine]
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
| Reference image | `ID:ref_image` | Style/environment/palette guidance. **No human faces.** | Up to 9 (`gpt-image-2`: 16, `midjourney-v7`: 4, `kling-3.0-omni`: 7) |
| Reference audio | `ID:ref_audio` | Voice/audio reference where supported. Must be paired with image or video. | `sd-2.0`: up to 3; unsupported on Kling |
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

1. Each Renoise/Seedance segment is 4–15s (default 15s unless beat alignment or pacing requires otherwise). Kling uses discrete options `3`, `5`, `10`, `15`.
2. Repeat full character description in every segment prompt
3. Start each segment after S1 with "Continuing from the previous shot: [ending state of prev segment]"
4. Choose the continuity method for the next segment:
   - Exact carried-over opening state → extract the previous segment tail frame with ffmpeg, upload it, use `ID:first_frame`
   - Motion/style carryover → use `task chain <id>` to turn a completed segment into `ref_video` material for the next

#### Tail-frame → next first-frame

```bash
ffmpeg -sseof -0.2 -i generated/shots/S1.mp4 -frames:v 1 -q:v 2 -y generated/keyframes/S1-end.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload generated/keyframes/S1-end.jpg
# Use returned material ID as S2 first_frame
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2 prompt>" \
  --duration 15 --ratio 16:9 --materials "ID:first_frame"
```

#### ref_video chaining

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task chain <id>
# Use returned material ID as the next segment's ref_video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2 prompt>" \
  --duration 15 --ratio 16:9 --materials "ID:ref_video"
```

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

> Pick the model by job: `nano-banana-2` for drafts / banners / wide aspect ratios, `nano-banana-2-lite` for cheapest drafts, `nano-banana-pro` for hero / final frames, `gpt-image-2` for anything with text/logos/typography, `midjourney-v7`/`mj-v8.1` for stylized illustration (no `--resolution`), `seedream-5-0-lite` as an alternative provider, `grok-image`/`grok-image-quality` as another stylization alternative.

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

### Hero / Key Frame (higher fidelity)

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Cinematic hero shot: a lone astronaut standing on a red Martian plain, Earth visible in the dusty sky, volumetric sunlight, photorealistic, highly detailed, shallow depth of field." \
  --model nano-banana-pro --resolution 2k --ratio 16:9
```

### Poster / Graphic with Text

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Minimalist product poster with bold serif headline 'MIDNIGHT BLOOM' centered, subtitle 'Eau de Parfum' in small caps, dark navy background, gold foil accents." \
  --model gpt-image-2 --resolution 2k --ratio 16:9
```

### Stylized Illustration

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Stylized fantasy portrait of an elven archer, moody forest lighting, painterly, intricate details." \
  --model midjourney-v7 --ratio 3:4
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
