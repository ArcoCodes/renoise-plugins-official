# Renoise API Reference

## API Endpoints

Base URL: `https://www.renoise.ai`
API Prefix: `/api/public/v1`

### Authentication

All endpoints require an API key, supplied in either form:

- `X-API-Key: fk_...`
- `Authorization: Bearer fk_...` (the key must carry the `fk_` prefix to be parsed as a bearer token)

**Attribution headers** (optional, for client identification):

- `X-Client-Source` — only `desktop` is recognized; any other value is recorded as `api_key`
- `X-Client-Name` — client identifier (the CLI sends `renoise-plugin`)
- `X-Client-Version` — client version

The CLI automatically sends `X-Client-Name: renoise-plugin` and `X-Client-Version`.

### Credits

| Method | Path                                                              | Description                |
| ------ | ----------------------------------------------------------------- | -------------------------- |
| GET    | `/api/public/v1/me`                                               | User info + credit balance |
| GET    | `/api/public/v1/credit/estimate?model&duration&variant&hasVideoRef&watermark&resolution` | Cost estimate              |
| GET    | `/api/public/v1/credit/history?limit=50&offset=0`                 | Credit transactions        |

### Tasks

| Method | Path                                                    | Description                          |
| ------ | ------------------------------------------------------- | ------------------------------------ |
| POST   | `/api/public/v1/tasks`                                  | Create task                          |
| GET    | `/api/public/v1/tasks?status&tag&type=video\|image\|audio&media=preview&provider&ids=1,2&limit&offset` | List tasks (`media=preview` requires `type=image`) |
| GET    | `/api/public/v1/tasks/:id?includeReferences=1`          | Task detail (`includeReferences=1` attaches `references` — the referenced materials) |
| GET    | `/api/public/v1/tasks/:id/result`                       | Task result (video/image/audio/cover URLs) |
| POST   | `/api/public/v1/tasks/:id/cancel`                       | Cancel pending task                  |
| POST   | `/api/public/v1/tasks/:id/save-as-material`             | Save a task output as a material; body `{name (1..200), imageIndex?}` → `{material, action}` |
| PATCH  | `/api/public/v1/tasks/:id/tags`                         | Update tags                          |
| GET    | `/api/public/v1/tags`                                   | List all tags                        |

### Materials

| Method | Path                                       | Description                       |
| ------ | ------------------------------------------ | --------------------------------- |
| POST   | `/api/public/v1/materials/upload`          | Upload material (multipart, md5-deduped) — for files <50 MB |
| POST   | `/api/public/v1/materials/upload-url`      | Request a presigned upload URL; body `{filename, contentType?}` → `{uploadUrl, path, expiresAt}` (1h) — for files ≥50 MB |
| POST   | `/api/public/v1/materials`                 | Register a material after PUT-ing to the presigned URL; body `{name, md5, type(image\|video\|audio), storagePath, mimeType?, size?, metadata?}` → `{material, action: created\|exists}` |
| GET    | `/api/public/v1/materials?type=X&search=Y` | List materials with download URLs |
| POST   | `/api/public/v1/materials/by-ids`          | Fetch materials by id; body `{ids: [...] (≤200), mine?}` |
| GET    | `/api/public/v1/materials/:id`             | Material detail                   |
| DELETE | `/api/public/v1/materials/:id`             | Soft-delete a material            |

## Request/Response Formats

### POST /api/public/v1/tasks

Request:

```json
{
  "prompt": "string (required; may be empty when surface is upscale/erase/outpaint)",
  "model": "seedance-2.0",
  "type": "video",
  "duration": 5,
  "ratio": "1:1",
  "resolution": "2k",
  "watermark": false,
  "audioGeneration": true,
  "surface": "upscale",
  "materials": [
    { "id": 42, "role": "ref_video", "index": 0 },
    { "id": 99, "role": "ref_image", "index": 1 }
  ],
  "tags": ["demo"]
}
```

Field notes:

- `type` — `video` | `image` | `audio`; optional (inferred from `model`).
- `duration` — integer 1–15 (server-side clamped to the model's max where applicable).
- `resolution` — one of `1k` / `2k` / `3k` / `4k` (image) / `480p` / `720p` / `1080p` (video); the model determines the valid subset.
- `watermark` — video watermark (also applies a 10% credit discount).
- `audioGeneration` — toggle generated audio when the model supports it.
- `surface` — `upscale` (and `erase`/`outpaint`); this is the entry point that allows an empty `prompt`.
- `materials[].index` — user-facing ordering; drives `@ImageN`/`@VideoN` numbering (see [Material Roles](#material-roles)).

Response (201):

```json
{
  "task": {
    "id": 1,
    "prompt": "...",
    "model": "seedance-2.0-byteplus",
    "status": "pending",
    "estimatedCredit": 5.0,
    "createdAt": "2026-03-10T..."
  }
}
```

> A `seedance-2.0`-series submission reads back with `model` set to `seedance-2.0-*-byteplus` — the internal execution name of the series. This is expected.

Error (402 — insufficient credits):

```json
{
  "error": "Insufficient credits",
  "available": 2.5,
  "required": 5.0
}
```

### GET /api/public/v1/tasks/:id/result

Response:

```json
{
  "taskId": 1,
  "status": "completed",
  "videoUrl": "https://...",
  "imageUrl": "https://...",
  "audioUrl": "https://...",
  "coverUrl": "https://...",
  "resolutions": { "720p": "https://..." },
  "itemCount": 1,
  "fetchedAt": "2026-03-10T...",
  "cached": true
}
```

Video tasks return `videoUrl`, image tasks `imageUrl`, and audio tasks `audioUrl`.

### GET /api/public/v1/credit/estimate

Query params: `model`, `duration` (1–15), `variant`, `hasVideoRef`, `watermark`, `resolution`. Variant resolution order server-side: an explicit `variant` wins; otherwise image-res models use `resolution`; video models derive the variant from `{hasVideoRef, resolution, model}`.

Response:

```json
{
  "estimatedCredit": 123,
  "balance": 5000,
  "sufficient": true,
  "discountPercent": 10
}
```

`discountPercent` is the applied discount — `max(watermark 10%, user-generation discount)` (`gpt-image-2` does not receive the generation discount). If the model/variant has no pricing row, the endpoint returns `200` with `estimatedCredit: null`.

## Errors

| Status | error | Notes |
| ------ | ----- | ----- |
| 402 | `Insufficient credits` | Response includes `available` / `required` |
| 429 | `Too many active tasks` | Concurrent-task cap (default 50, `max_tasks_per_user`); response includes `active` / `limit` |
| 500 | `Pricing not configured for this model` | Model/variant has no pricing row. The estimate endpoint instead returns `200` with `estimatedCredit: null` |

### errorCode overview

A failed task carries a structured `errorCode` (with an English `error` fallback). Prefix families:

- `INPUT_*` — inbound content review (input prompt/materials rejected)
- `OUTPUT_*` — outbound content review (generated result rejected)
- `PARAM_*` — parameter validation
- `SYSTEM_*` — system/internal
- `CREDIT_INSUFFICIENT` — insufficient credits
- `UNKNOWN` — uncategorized fallback
- `PROVIDER_*_PASSTHROUGH` — provider error passed through verbatim

For `INPUT_*` / `OUTPUT_*` failures, follow the content-moderation guidance in `../SKILL.md` ("Content-moderation error guidance") before retrying.

## Task Statuses

User-facing statuses:

| Status      | Description                |
| ----------- | -------------------------- |
| `pending`   | Waiting for assignment     |
| `assigned`  | Assigned, waiting to start |
| `running`   | Generating                 |
| `completed` | Done — result available    |
| `failed`    | Failed — check `error`/`errorCode` |
| `cancelled` | User cancelled             |

Internal states `submitted`, `queued`, `assigning`, `archiving`, and `preparing_facepass` are collapsed to `running` by the public API and never appear externally.

## Models

**Video:**
- `seedance-2.0` — Default video model; `480p`/`720p`/`1080p`/`4k` (default `720p`). Executes as `seedance-2.0-byteplus` (auto-facepass on submit; the task reads back with that name).
- `seedance-2.0-fast` — Faster tier; `480p`/`720p`. Executes as `seedance-2.0-fast-byteplus`.
- `seedance-2.0-mini` — Cheapest Seedance tier; `480p`/`720p`. Executes as `seedance-2.0-mini-byteplus`.
- `happyhorse-1.0` — Alibaba Bailian provider; `720p`/`1080p`
- `kling-3.0-omni` — Tencent VOD AIGC provider; `720p`/`1080p`
- `grok-video` — xAI Grok Imagine; T2V/I2V/R2V; `480p`/`720p`; R2V duration clamped to ≤10s
- `grok-video-1.5` — xAI Grok Imagine; **I2V only** (exactly 1 reference image); `480p`/`720p`
- `gemini-omni-flash` — Google Vertex Interactions API; fixed `720p`; **16:9/9:16 only**; ≤10s duration; ratio required (no default); drives `source_video` editing
- `upscale-video-volcano-mediakit` — Video quality enhancement (super-resolution); target `1080p`/`2k`/`4k` (default `1080p`); source via `ref_video`; no watermark; `prompt` optional (`surface=upscale`)

**Image:**
- `nano-banana-2` — Google Vertex; `1k`/`2k`/`4k`; widest aspect-ratio set incl. `1:4`, `4:1`, `1:8`, `8:1`; max 14 reference images
- `nano-banana-2-lite` — Google Vertex, cheaper tier; fixed `1k`; same ratio set as `nano-banana-2`; max 14 reference images
- `nano-banana-pro` — Google Vertex, higher quality tier; `1k`/`2k`/`4k`
- `midjourney-v7` — Midjourney (alias: `midjourney`); **no `resolution` param**; max 4 reference images
- `mj-v8.1` — Midjourney, latest version (aliases: `midjourney-v8.1`, `mj-8.1`); **no `resolution` param**; max 4 reference images
- `gpt-image-2` — Tencent Cloud AI Art provider; `1k`/`2k`/`4k`; max 16 reference images; strongest at text/typography in image
- `seedream-5-0-lite` — Seedream provider; `2k`/`3k`/`4k`; max 14 reference images
- `seedream-5-0-pro` — Seedream provider, higher-fidelity tier; `1k`/`2k`; max 10 reference images; direct-image model
- `grok-image` — xAI Grok Imagine; `1k`/`2k`; max 3 reference images
- `grok-image-quality` — xAI Grok Imagine, higher-quality/higher-cost tier; `1k`/`2k`; max 3 reference images
- `upscale-image-volcano-mediakit` — Image quality enhancement (super-resolution); target `1080p`/`2k`/`4k` (default `2k`); source via `ref_image`; `prompt` optional (`surface=upscale`)

**Audio:**
- `lyria-clip` — Text/image-to-music; ~30s mp3; optional 1 guide `ref_image`; no ratio/resolution/duration
- `seed-audio-1.0` — Multi-speaker director-style TTS; ≤120s mp3; `ref_audio` ≤3 mutually exclusive with `ref_image` ≤1; prompt ≤2048 chars

**Deprecated aliases:** `renoise-2.0*`, `sd-2.0*`, and `youmeng-2.0*` are deprecated aliases of the `seedance-2.0` series — still accepted with a deprecation warning, mapped to the series, and removed in the next major version. Use the `seedance-2.0` series names.

Per-model aspect-ratio and resolution constraints are validated server-side; see `skills/renoise-gen/SKILL.md` for the full matrix.

## Material Roles

Canonical role names (with accepted aliases):

- `reference_image` (alias `ref_image`) — Reference image (style / environment / face)
- `reference_video` (alias `ref_video`) — Reference video (affects pricing)
- `reference_audio` (alias `ref_audio`) — Reference audio
- `first_frame` — Pin the opening frame
- `last_frame` — Pin the ending frame (requires `first_frame`)
- `mask` — Mask for edit surfaces (e.g. inpaint)
- `source_video` — `gemini-omni-flash` edit source (exactly 1; output follows the source)

`materials[].index` sets the user-facing ordering of materials. That order drives the `@ImageN` / `@VideoN` numbering used in the prompt. A prompt may also reference a material by its file name as `@<filename>`; the server rewrites it to `@ImageN`/`@VideoN` according to the materials order.

## Aspect Ratios

Supported set varies by model. Common ratios: `1:1` (default), `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`. `nano-banana-2`/`nano-banana-2-lite` additionally support extreme banner ratios `1:4`, `4:1`, `1:8`, `8:1`. `gemini-omni-flash` only accepts `16:9`/`9:16` and requires the ratio to be explicitly set. See model table in `SKILL.md`.

## Image Resolutions

- `1k`
- `2k`
- `3k` (`seedream-5-0-lite` only)
- `4k`

`midjourney-v7` and `mj-v8.1` do **not** accept a resolution parameter. `nano-banana-2-lite` only accepts `1k`. `seedream-5-0-pro` accepts `1k`/`2k`. `upscale-image-volcano-mediakit` uses target labels `1080p`/`2k`/`4k` (default `2k`).

## Video Resolutions

- `480p` — all `seedance-2.0` series, `grok-video`, `grok-video-1.5`
- `720p` — all video models (`gemini-omni-flash` is fixed here)
- `1080p` — `seedance-2.0`, `happyhorse-1.0`, `kling-3.0-omni`, `upscale-video-volcano-mediakit`
- `2k` — `upscale-video-volcano-mediakit`
- `4k` — `seedance-2.0`, `upscale-video-volcano-mediakit`

`gemini-omni-flash` is fixed at `720p` — no resolution parameter needed.
