---
name: renoise-gen
description: >
  Renoise platform CLI — generate AI videos, images, and audio, upload materials,
  poll results. This is the tool layer.
  For creative direction (story, prompts, visual development, anchoring strategy),
  use the director skill.
  Use when user asks to "generate video", "create video", "text to video",
  "image to video", "generate image", "generate audio", "AI video", "AI image",
  "product design sheet", "scene background", "material pool", "ingest materials",
  or Chinese phrasings like "生成视频", "文生视频", "图生视频", "生成图片",
  "AI 视频", "AI 图片", "生成音乐", "配乐", "画质增强", "超分", "上传素材",
  or needs direct CLI access.
allowed-tools: Bash, Read, Write, Glob
metadata:
  author: renoise
  version: 0.5.0
  category: video-production
  tags: [general, video-generation, image-generation, material-pool]
---

# Renoise CLI — Tool Reference

CLI for the Renoise AI video/image generation platform. This skill covers **how to use the tools**. For creative decisions (what to generate, how to write prompts, anchoring strategy), see the **director** skill.

> **Platform URL**: **https://www.renoise.ai** — NEVER renoise.com.

> **Defaults**: video → `seedance-2.0`, image → `seedream-5-0-pro`. These are the *preferred* models unless the user names a different one — not hard locks. When the user asks for a specific model, use it. Reach for a different image model only when the job exceeds `seedream-5-0-pro`'s limits — `4k`, an extreme banner ratio, or strong text/logo typography (see [Choosing an image model](#choosing-an-image-model)).

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

# Generate Image (default image model: seedream-5-0-pro)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A cute cat sitting on a crescent moon, watercolor style, dreamy atmosphere" \
  --model seedream-5-0-pro --resolution 2k --ratio 1:1

# Generate Image with Text/Typography (use gpt-image-2 for best prompt-following on text/logos)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Hero product poster with bold headline 'MIDNIGHT BLOOM' in serif type, centered, minimalist layout" \
  --model gpt-image-2 --resolution 2k --ratio 16:9

# Cheaper/faster video draft
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A cat dancing under twinkling stars, smooth orbit" \
  --model seedance-2.0-mini --duration 10 --ratio 9:16

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
| `seedance-2.0` **(default video model)** | Video | 4–15s, `480p`/`720p`/`1080p`/`4k` (default `720p`) | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` | Default video model; refs image ≤9, video ≤3, audio ≤3; supports watermark/audio generation. Submits/executes as `seedance-2.0-byteplus` — a face image can be passed straight as `ref_image` (auto-facepass on submit). |
| `seedance-2.0-fast` | Video | 4–15s, `480p`/`720p` (default `720p`) | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` | Faster tier; refs image ≤9, video ≤3, audio ≤3; no 1080p/4k. Executes as `seedance-2.0-fast-byteplus`. |
| `seedance-2.0-mini` | Video | 4–15s, `480p`/`720p` (default `720p`) | `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9` | Cheapest Seedance tier; refs image ≤9, video ≤3, audio ≤3; no 1080p/4k. Executes as `seedance-2.0-mini-byteplus`. |
| `happyhorse-1.0` | Video | `720p`/`1080p` (default `1080p`) | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` | Alibaba Bailian; alias typo accepted `happyhourse-1.0`; refs image ≤9, video 0; no `last_frame` |
| `kling-3.0-omni` | Video | `720p`/`1080p` (default `720p`) | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` | Default 5s; with a reference video ≤10s; otherwise 3–15s (validated server-side). refs image ≤7, video ≤1, audio unsupported; prompt ≤2500 chars |
| `grok-video` | Video | 1–15s (R2V clamped ≤10s), `480p`/`720p` (default `720p`) | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` | xAI Grok Imagine; T2V/I2V/R2V; refs image ≤7 (R2V mode) |
| `grok-video-1.5` | Video | 1–15s, `480p`/`720p` (default `720p`) | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` | xAI Grok Imagine; **I2V only** — requires exactly 1 reference image, no text-only generation |
| `gemini-omni-flash` | Video | ≤10s, `720p` only (fixed) | `16:9`, `9:16` only | Google Vertex Interactions API; ratio is **required** (no default); refs image ≤6, video ≤1 (`source_video` edit); `first_frame` + `ref_image` can combine; no ref audio |
| `upscale-video-volcano-mediakit` | Video | `1080p`/`2k`/`4k` (default `1080p`) | _(follows source)_ | Video quality enhancement (super-resolution). Source clip via `ID:ref_video`; `--prompt` optional; no watermark. See [Quality Enhancement](#quality-enhancement-upscale--super-resolution). |
| `nano-banana-2` | Image | `1k`, `2k`, `4k` | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`, `1:4`, `4:1`, `1:8`, `8:1` | Google Vertex; widest ratio set |
| `nano-banana-2-lite` | Image | `1k` only | Same ratio set as `nano-banana-2` | Google Vertex; cheaper/lite tier; max 14 ref images |
| `nano-banana-pro` | Image | `1k`, `2k`, `4k` | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` | Google Vertex; higher quality tier |
| `midjourney-v7` | Image | _(no `--resolution`)_ | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3` | Max 4 ref images; alias `midjourney` |
| `mj-v8.1` | Image | _(no `--resolution`)_ | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3` | Aliases: `midjourney-v8.1`, `mj-8.1`; max 4 ref images; latest Midjourney version |
| `gpt-image-2` | Image | `1k`, `2k`, `4k` | `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `16:9`, `9:16`, `21:9` | Max 16 ref images; strongest at text/typography |
| `seedream-5-0-lite` | Image | `2k`, `3k`, `4k` | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9` | Max 14 ref images |
| `seedream-5-0-pro` **(default image model)** | Image | `1k`, `2k` (default `1k`) | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9` | Default image model; higher-fidelity Seedream tier; max 10 ref images; direct-image model (only `ref_image`, prompt required). **No `4k`, no extreme `1:4`/`4:1`/`1:8`/`8:1` banners** — switch models for those. |
| `grok-image` | Image | `1k`, `2k` | `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2` | xAI Grok Imagine; max 3 ref images |
| `grok-image-quality` | Image | `1k`, `2k` | `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2` | xAI Grok Imagine, higher-quality/higher-cost tier; max 3 ref images |
| `upscale-image-volcano-mediakit` | Image | `1080p`/`2k`/`4k` (default `2k`) | _(follows source)_ | Image quality enhancement (super-resolution). Source image via `ID:ref_image`; `--prompt` optional. See [Quality Enhancement](#quality-enhancement-upscale--super-resolution). |
| `lyria-clip` | Audio | ~30s mp3 | — | Text/image-to-music; optional 1 guide image `ID:ref_image`; no duration/ratio/resolution. See [Audio Generation](#audio-generation). |
| `seed-audio-1.0` | Audio | ≤120s mp3 | — | Multi-speaker director-style TTS; `ID:ref_audio` ≤3 (mutually exclusive with `ID:ref_image` ≤1); prompt ≤2048 chars. See [Audio Generation](#audio-generation). |

> **Deprecated model aliases**: `renoise-2.0*`, `sd-2.0*`, and `youmeng-2.0*` are deprecated aliases of the `seedance-2.0` series. The CLI still accepts them but prints a deprecation warning and maps them to the `seedance-2.0` series; they will be removed in the next major version. Use the `seedance-2.0` series names instead.

**Choosing a video model:** default to `seedance-2.0` unless the user names a different model.
- `seedance-2.0` — **default video model**, best quality/consistency, up to `4k`. Keep it unless the user asks for another model.
- `seedance-2.0-mini` / `seedance-2.0-fast` — cheaper drafts, up to `720p`.
- `kling-3.0-omni` / `happyhorse-1.0` — alternative providers, similar capability tier.
- `grok-video` — flexible T2V/I2V/R2V from xAI; use for R2V-style continuity with up to 7 reference images.
- `grok-video-1.5` — pure I2V, needs exactly one reference image.
- `gemini-omni-flash` — video with synchronized audio; only for 16:9/9:16 clips ≤10s; also drives `source_video` editing.

**Choosing an image model:** default to `seedream-5-0-pro` unless the user names a different model, or the job exceeds its limits. `seedream-5-0-pro` covers `1k`/`2k` (no `4k`) and the ratios `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9` (no extreme `1:4`/`4:1`/`1:8`/`8:1` banners); it is a direct-image model (only `ref_image`, prompt required). Switch models only when the job demands something it cannot do:
- `seedream-5-0-pro` — **default image model**; higher-fidelity Seedream tier at `1k`/`2k`.
- `nano-banana-2` — when you need `4k`, an extreme banner ratio (`8:1` / `1:8`, etc.), or the cheapest quick draft.
- `nano-banana-2-lite` — cheapest Nano Banana tier, fixed `1k`.
- `nano-banana-pro` — when you need `4k` high fidelity (hero / final frames).
- `gpt-image-2` — when the image carries text / logos / typography (strongest prompt-following on text).
- `midjourney-v7` / `mj-v8.1` — strong stylized illustration; pass `--ratio` only (no resolution). Prefer `mj-v8.1` for the latest Midjourney model.
- `seedream-5-0-lite` — when you want the Seedream look but need `3k`/`4k`.
- `grok-image` / `grok-image-quality` — xAI Grok Imagine stylization alternative; `-quality` for higher fidelity at higher cost, both capped at `2k` and 3 ref images.

---

## Audio Generation

Two audio models produce `.mp3` output. A completed audio task returns an `audioUrl` from `task result`. Both bill flat (per-run); quote cost from `credit estimate`.

**`lyria-clip`** — text/image-to-music. Generates a fixed ~30s stereo music clip. Optionally guide it with a single reference image (`ID:ref_image`). Does **not** take `--duration`, `--ratio`, or `--resolution` (they are stripped automatically if passed). Prompt with mood / genre / instrumentation; specify "no vocals" for background music.

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --model lyria-clip --prompt "warm acoustic folk, fingerpicked guitar, gentle, no vocals"
```

**`seed-audio-1.0`** — multi-speaker director-style TTS, single run ≤120s. Reference audio (`ID:ref_audio`, up to 3) is **mutually exclusive** with a reference image (`ID:ref_image`, up to 1). Prompt ≤2048 characters; reference audio is cited in the prompt in order as `@音频N` (i.e. `@Audio1`, `@Audio2`, …). Speaker voice IDs are not exposed.

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload voice-sample.mp3 --type audio
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --model seed-audio-1.0 --type audio \
  --prompt "Narrator: welcome back. Use the voice in @音频1 for the host lines." \
  --materials "77:ref_audio"
```

## Quality Enhancement (Upscale / Super-Resolution)

These tools **increase the resolution and visual quality** of an existing image or video (super-resolution via Volcano MediaKit). They do **not** change the picture content — this is not outpainting/extend. Content-changing edits (outpaint / inpaint / local repaint) go through `gpt-image-2` edit + surface and are not supported here.

- `upscale-video-volcano-mediakit` — target `1080p`/`2k`/`4k` (default `1080p`). Source clip via `ID:ref_video`. Watermark not supported.
- `upscale-image-volcano-mediakit` — target `1080p`/`2k`/`4k` (default `2k`). Source image via `ID:ref_image`.

`--prompt` is optional for both (the CLI sends `surface=upscale` automatically). Exactly one source material per task. Billed flat (per-run); different target resolutions have different prices — quote cost from `credit estimate`.

```bash
# Enhance a finished video to 2k
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload final-cut.mp4
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --model upscale-video-volcano-mediakit --resolution 2k --materials "88:ref_video"

# Enhance an image to 4k
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --model upscale-image-volcano-mediakit --resolution 4k --materials "42:ref_image"
```

---

## CLI Commands

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs <domain> <action> [options]
```

Domains: `task`, `material`, `credit`

### Credit

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit me                    # User info + balance
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit estimate --duration 15 # Estimate cost
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs credit history                # Transaction history
```

`credit estimate` accepts `--model`, `--duration`, `--resolution` (image `1k`/`2k`/`3k`/`4k`; video `480p`/`720p`/`1080p`/`2k`/`4k`), `--hasVideoRef`, and `--watermark`. The response includes `estimatedCredit`, `balance`, `sufficient`, and `discountPercent` (the applied discount — `max(watermark 10%, user-generation discount)`; `gpt-image-2` does not receive the generation discount). **Always quote cost from a live `credit estimate` — this documentation intentionally gives no fixed credit numbers, since pricing depends on model, resolution, duration, and discounts.**

### Task — Generate & Manage

```bash
# Generate (create + wait + return result)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "..." --duration 15 --ratio 16:9 \
  [--materials "..."]

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

# Tags (optional — the Renoise app does NOT filter by tag; tags only exist for your
# own `task list --tag` re-querying. To group a project's segments, prefer a local
# record in the project directory rather than tagging tasks on the server.)
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task tags
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task tag <id> --tags a,b,c
```

**Parameters for `generate` / `create`:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--prompt` | **(required, except `upscale-*`)** English narrative prompt | — |
| `--model` | Model name | `seedance-2.0` (video) or `seedream-5-0-pro` (image) |
| `--type` | Optional `video` / `image` / `audio`; must match model | inferred from model |
| `--duration` | Video duration, model-specific | `5` |
| `--ratio` | Aspect ratio — supported set varies per model (see [Supported Models](#supported-models)) | `1:1` |
| `--resolution` | Image `1k`/`2k`/`3k`/`4k`; video `480p`/`720p`/`1080p`/`2k`/`4k`; omit for `midjourney-v7`/`mj-v8.1` and audio models | model default |
| `--watermark` | Add video watermark and apply 10% credit discount | off |
| `--audio-generation 0|1`, `--no-audio-generation` | Toggle generated audio when model supports it | model default |
| `--template-id` | Create from template | — |
| `--tags` | Comma-separated tags (optional; not filtered by the Renoise app — for your own `task list --tag` only) | — |
| `--materials` | Material refs, comma-separated (see [Material Roles](#material-roles)); role required, optional `:index` | — |

**Task statuses:** user-facing statuses are `pending`, `assigned`, `running`, `completed`, `failed`, `cancelled`. Internal states such as `submitted`, `queued`, `assigning`, `archiving`, and `preparing_facepass` are collapsed to `running` by the public API. Note: a `seedance-2.0`-series task reads back with `model` set to `seedance-2.0-*-byteplus` — this is the internal execution name of the `seedance-2.0` series and is expected.

### Material — Upload & Browse

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/file.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/clip.mp4 --type video
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload /path/to/audio.mp3 --type audio
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material list [--type image|video|audio] [--search cat] [--ids 1,2] [--mine]
```

Files under 50 MB upload directly; files ≥50 MB are uploaded automatically via the presigned-URL flow (request upload URL → PUT → register). No extra flags needed.

---

## Material Roles

Syntax: `--materials "ID:role"` or `--materials "ID:role:INDEX"`, comma-separated. The role is required.

**Roles** (canonical names in bold; `ref_*` are accepted aliases):

| Role | Syntax | What it does | Limit |
|------|--------|-------------|-------|
| **reference_image** (`ref_image`) | `ID:ref_image` | Style / environment / palette / face reference | Per-model, up to 9 (`gpt-image-2`: 16, `midjourney`: 4, `kling-3.0-omni`: 7, `seedream-5-0-pro`: 10) |
| **reference_video** (`ref_video`) | `ID:ref_video` | Continues motion/scene from a previous clip | Up to 3 |
| **reference_audio** (`ref_audio`) | `ID:ref_audio` | Voice/audio reference. Cannot be the only reference (except audio models). | `seedance-2.0`: up to 3; `seed-audio-1.0`: up to 3; unsupported on Kling |
| **first_frame** | `ID:first_frame` | Pin the opening frame; prompt drives the rest | 1 |
| **last_frame** | `ID:last_frame` | Pin the ending frame (requires `first_frame`) | 1 |
| **source_video** | `ID:source_video` | `gemini-omni-flash` edit source — the model consumes the source's first ~10s; output frame size and duration **follow the source**, so `--ratio`/`--duration` are ignored. Different semantics from `ref_video`. | Exactly 1 per task |

> **Mode exclusion**: `first_frame`/`last_frame` cannot be mixed with `ref_image` (except `gemini-omni-flash`, which allows `first_frame` + `ref_image`). `last_frame` requires a `first_frame`. `reference_image` and `reference_audio` are mutually exclusive on `seed-audio-1.0`.
>
> **Tip — pin an opening frame on a segment that also needs `ref_image`s**: attach the frame in reference mode instead of frame mode — `FRAME_ID:ref_image:0` (the `:0` index makes it `@Image1`) — and make the prompt's first sentence "Use @Image1 as the first frame." (中文口播段：「以@图片1为首帧」). This coexists with the other `ref_image`s. It is a **soft lock** (weaker than native `first_frame`), so pair it with an exact description of the opening state.

`ref_image` + `ref_video` combine freely for a normal reference generation:
```bash
# Continuity + environment
--materials "42:ref_video,99:ref_image"

# Environment only (B-roll)
--materials "99:ref_image"
```

### Ordering and `@` references

`materials[].index` sets the user-facing ordering of materials. That order determines how the prompt's `@ImageN` / `@VideoN` slots are numbered. In the prompt you may also refer to a material by its **file name** — `@<filename>` — and the server rewrites it to `@ImageN`/`@VideoN` by materials order. Pass an explicit order with the `:INDEX` suffix:

```bash
# B renders first (index 0), A second (index 1)
--materials "A_ID:ref_image:1,B_ID:ref_image:0"
```

`INDEX` must be a plain number. When you omit it, the array order is used (server default).

> **`asset:` prefix is deprecated.** `--materials "asset:ID:role"` no longer works — the CLI errors on it. Use the bare material ID (`ID:ref_image`); for `seedance-2.0`-series a face image is auto-facepassed on submit, so no separate asset registration is needed.

### Image requirements (for first/last frame and ref_image)

- Format: jpeg, png, webp, bmp, tiff, gif
- Aspect ratio (W/H): 0.4 – 2.5
- Dimensions: 300 – 6000 px per side
- Size: < 30 MB — this is the **reference-image file-size limit** (provider constraint), not the upload-channel limit. The `material upload` channel allows single files up to 50 MB directly (≥50 MB uses the presigned-URL flow automatically).

### Face handling

- **Seedance series** (`seedance-2.0` / `-fast` / `-mini`): pass the face image straight as `ID:ref_image` — it is auto-facepassed on submit. For cross-segment consistency, **reuse the same material ID** (references dedupe by material ID, so a second use is free).
- **Other video models**: a face may be blocked by the provider's content review. Prefer the seedance series, or describe the character in text only.

(Face-review can still fail at generation time — e.g. the reference image is rejected — surfacing as a failed task with an `INPUT_IMAGE_*` error code rather than a submit-time block. See [content-moderation guidance](#content-moderation-error-guidance).)

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

Face detection: the `material-ingest`/`match-materials` scripts exclude `has_face: true` materials from automatic `ref_image` matching by default (a conservative default). On the `seedance-2.0` series a face material is actually safe to use as `ref_image` (auto-facepassed on submit) — add it manually when you want it.

---

## Prompt Basics

The seedance-2.0 model responds best to:

- **English only** — non-English text or tag lists degrade quality
- **Narrative paragraphs** — complete descriptive sentences, not comma-separated keywords
- **Specific over abstract** — "a golden retriever running through shallow ocean waves at sunset" beats "a dog on a beach"
- **Positive language** — describe what you want, not what you don't want

**Structure**: Subject (appearance) + Action (what happens) + Camera (movement) + Scene (environment) + Style (visual style)

**Shot density** for time-annotated prompts:
- 5s: 1 shot, single action + camera
- 10s: 2–3 shots
- 15s: 3–4 shots
- "frame holds steady" is a **final-ending** device only. Use it to close a single clip, or to close the **last** segment of a multi-segment piece — never on every segment (intermediate segments must end on a hook the next one catches). See director `prompt-craft.md` "Ending strategy".

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

> **Route narrative / recurring-character multi-segment work through the director skill first.** A story, or any multi-segment video with a character that reappears across segments, is a **creative decision** and must go through the director skill's two gates — **Gate 1 (story confirmation)** and **Gate 2 (consistency manifest: characters, props, scenes, style bible, transition table, spoken language)**. renoise-gen is the tool layer; do **not** bypass those gates by firing off independent per-segment text-to-video (T2V) here. Pure T2V per segment is exactly what makes the character and art style collapse across segments.

The methodology — which anchors each segment needs, tail-frame chain vs `ref_video`, when pure T2V is acceptable, style bible, ending strategy — lives in the **director** skill (Hard Rules + `prompt-craft.md`). Follow it even when driving the CLI directly. What follows here is only the **tool mechanics**.

Mechanics for any multi-segment split:

1. Each Renoise/Seedance segment is 4–15s (default 15s unless beat alignment or pacing requires otherwise). Kling uses discrete options `3`, `5`, `10`, `15`.
2. **Tasks are stateless** — nothing carries over between generations. Any shared consistency text (character block, style bible — see director `prompt-craft.md`) must be repeated **verbatim** in every segment prompt, and any shared visual anchor must be re-attached via `--materials` (reuse the same material ID).
3. Start each segment after S1 with "Continuing from the previous shot: [ending state of prev segment]"
4. Two continuity mechanisms are available (which to pick is a director-skill decision):
   - Pin the next opening state → extract the previous segment tail frame with ffmpeg, upload it, then route by what else the segment carries (frame mode and reference mode are mutually exclusive — see [Material Roles](#material-roles)): segment has any other `ref_image` (character/scene — the usual case) → attach the tail frame as `ID:ref_image:0` and declare `@Image1` as the first frame in the prompt; segment has **no** other image reference → native `ID:first_frame`
   - Carry motion/style → use `task chain <id>` to turn a completed segment into `ref_video` material for the next

#### Tail-frame → next opening frame

```bash
ffmpeg -sseof -0.2 -i generated/shots/S1.mp4 -frames:v 1 -q:v 2 -y generated/keyframes/S1-end.jpg
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs material upload generated/keyframes/S1-end.jpg
# → returns material ID, e.g. TAIL_ID

# Default — the segment also carries other ref_images (character/scene):
# tail frame rides as ref_image pinned to index 0 → it is @Image1; declare it in the prompt
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Use @Image1 as the first frame. Continuing from the previous shot: <S2 prompt>" \
  --duration 15 --ratio 16:9 \
  --materials "FACE_ID:ref_image,TAIL_ID:ref_image:0,SCENE_ID:ref_image"

# Only when the segment has NO other image reference: native first_frame
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2 prompt>" \
  --duration 15 --ratio 16:9 --materials "TAIL_ID:first_frame"
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
| Face on a seedance model | Pass the face image directly as `ID:ref_image` (auto-facepassed on submit). For 2+ segments, reuse the **same material ID** in every segment. |
| Face on any non-seedance model | Face may be blocked by provider review — switch to a seedance model, or describe the character in text only. |

---

## Quick Templates

> Default to `seedream-5-0-pro` (image) unless the user names another model or the job exceeds its `1k`/`2k` + 8-ratio limits. Then pick by job: `nano-banana-2` for `4k` / extreme banner ratios / cheapest drafts, `nano-banana-2-lite` for cheapest fixed-`1k` drafts, `nano-banana-pro` for `4k` hero / final frames, `gpt-image-2` for anything with text/logos/typography, `midjourney-v7`/`mj-v8.1` for stylized illustration (no `--resolution`), `seedream-5-0-lite` when you need the Seedream look at `3k`/`4k`, `grok-image`/`grok-image-quality` as a stylization alternative.

### Product Design Sheet

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "Professional product design sheet showing a sleek wireless headphone from 6 angles: front view, side view, back view, top view, 3/4 perspective, detail close-up. Clean white background, studio lighting, consistent shadow direction." \
  --model seedream-5-0-pro --resolution 2k --ratio 1:1
```

### Scene / Background Image

```bash
node ${CLAUDE_SKILL_DIR}/renoise-cli.mjs task generate \
  --prompt "A modern minimalist living room at golden hour, floor-to-ceiling windows overlooking a city skyline, warm sunlight, photorealistic, 8K detail." \
  --model seedream-5-0-pro --resolution 2k --ratio 16:9
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
| `PrivacyInformation` | Only appears on non-seedance models or on output review — seedance input faces are auto-facepassed on submit | Switch to a seedance model, or describe the person in text only |
| `Insufficient credits` (402) | Balance too low | `credit me`, top up at https://www.renoise.ai |
| `Too many active tasks` (429) | Concurrent-task cap reached (default 50) | Wait for active tasks to finish; response includes `active`/`limit` |
| `Pricing not configured for this model` (500) | Model/variant has no pricing row | Check the model name; report to platform ops if it persists |
| Task `failed` | Generation failed | `task get <id>` to check the `error`/`errorCode`. Adjust prompt and retry |
| `Auth Error` (401) | Invalid API Key | Check `RENOISE_API_KEY` env var |
| `wait` timeout | Generation took too long | Multi-anchor tasks take 8–12 min. Use `--timeout 900` or `task create` + `task wait --timeout 900` |
| Material upload fails | Wrong format, or transient upload error | Files <50 MB upload directly; ≥50 MB use the presigned flow automatically. Supported format (jpg, png, webp, mp4, mov, mp3, etc.) |

The structured `errorCode` field on a task (with an English `error` fallback) classifies failures; see the error-code overview in `references/api-endpoints.md`.

### Content-moderation error guidance

When a task fails with an input/output review error code (`INPUT_*` / `OUTPUT_*`), work through this before retrying:

- **Baseline is permissive.** The byteplus (seedance series) and seedream pipelines have a relatively loose content scale — ordinary adult-oriented content usually passes.
- **Four categories are hard blocks** (rewording will not get them through — do **not** send the user into repeated retries):
  1. Political content;
  2. Religiously sensitive content;
  3. Sexual content involving minors;
  4. Copyrighted content (well-known IP / recognizable public figures).
- **Decision flow** on an `INPUT_*` / `OUTPUT_*` failure:
  1. First check whether the prompt or materials touch any of the four categories above.
  2. If they do → tell the user the platform does not support generating this kind of content (do **not** suggest workarounds to bypass it).
  3. If they do not → then it's worth adjusting wording / swapping materials and retrying.

---

## References

- [Video Model Capabilities](${CLAUDE_SKILL_DIR}/references/video-capabilities.md) — Model specs, camera movement reliability, style keywords
- [API Endpoint Reference](${CLAUDE_SKILL_DIR}/references/api-endpoints.md) — Raw API endpoints and request/response formats
