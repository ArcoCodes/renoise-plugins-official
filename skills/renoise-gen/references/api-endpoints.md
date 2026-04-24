# Renoise API Reference

## API Endpoints

Base URL: `https://renoise.ai`
API Prefix: `/api/public/v1`

All endpoints require `X-API-Key: <api_key>` header.

### Credits

| Method | Path                                                              | Description                |
| ------ | ----------------------------------------------------------------- | -------------------------- |
| GET    | `/api/public/v1/me`                                               | User info + credit balance |
| GET    | `/api/public/v1/credit/estimate?model=X&duration=Y&hasVideoRef=0` | Cost estimate              |
| GET    | `/api/public/v1/credit/history?limit=50&offset=0`                 | Credit transactions        |

### Tasks

| Method | Path                                                    | Description                          |
| ------ | ------------------------------------------------------- | ------------------------------------ |
| POST   | `/api/public/v1/tasks`                                  | Create task                          |
| GET    | `/api/public/v1/tasks?status=X&tag=Y&limit=50&offset=0` | List tasks                           |
| GET    | `/api/public/v1/tasks/:id`                              | Task detail                          |
| GET    | `/api/public/v1/tasks/:id/result`                       | Task result (video/image/cover URLs) |
| POST   | `/api/public/v1/tasks/:id/cancel`                       | Cancel pending task                  |
| PATCH  | `/api/public/v1/tasks/:id/tags`                         | Update tags                          |
| GET    | `/api/public/v1/tags`                                   | List all tags                        |

### Materials

| Method | Path                                       | Description                       |
| ------ | ------------------------------------------ | --------------------------------- |
| POST   | `/api/public/v1/materials/upload`          | Upload material (multipart)       |
| GET    | `/api/public/v1/materials?type=X&search=Y` | List materials with download URLs |

### Characters

| Method | Path                                                                              | Description      |
| ------ | --------------------------------------------------------------------------------- | ---------------- |
| GET    | `/api/public/v1/characters?category=X&usage_group=Y&search=Z&page=1&page_size=20` | List characters  |
| GET    | `/api/public/v1/characters/:id`                                                   | Character detail |

## Request/Response Formats

### POST /api/public/v1/tasks

Request:

```json
{
  "prompt": "string (required)",
  "model": "renoise-2.0",
  "duration": 5,
  "ratio": "1:1",
  "resolution": "2k",
  "materials": [
    { "id": 42, "role": "ref_video" },
    { "character_id": 3, "role": "reference_image" }
  ],
  "tags": ["demo"]
}
```

Response (201):

```json
{
  "task": {
    "id": 1,
    "prompt": "...",
    "model": "renoise-2.0",
    "status": "pending",
    "estimatedCredit": 5.0,
    "createdAt": "2026-03-10T..."
  }
}
```

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
  "coverUrl": "https://...",
  "resolutions": { "720p": "https://..." },
  "itemCount": 1,
  "fetchedAt": "2026-03-10T...",
  "cached": true
}
```

## Task Statuses

| Status      | Description                |
| ----------- | -------------------------- |
| `pending`   | Waiting for assignment     |
| `assigning` | Being assigned to account  |
| `assigned`  | Assigned, waiting to start |
| `queued`    | Queued on provider         |
| `running`   | Generating                 |
| `completed` | Done — result available    |
| `failed`    | Failed — check error field |
| `cancelled` | User cancelled             |

## Models

**Video:**
- `renoise-2.0` — Default video model (aliases: `seedance-2.0`, `youmeng-2.0`, `sd-2.0`)
- `renoise-2.0-fast` — Faster/cheaper tier, 720p only

**Image:**
- `nano-banana-2` — Google Vertex; `1k`/`2k`/`4k`; widest aspect-ratio set incl. `1:4`, `4:1`, `1:8`, `8:1`
- `nano-banana-pro` — Google Vertex, higher quality tier; `1k`/`2k`/`4k`
- `midjourney-v7` — Midjourney (alias: `midjourney`); **no `resolution` param**; max 4 reference images
- `gpt-image-2` — Colorist provider; `1k`/`2k`/`4k`; max 4 reference images; strongest at text/typography in image

Per-model aspect-ratio and resolution constraints are validated server-side; see `skills/renoise-gen/SKILL.md` for the full matrix.

## Material Roles

- `ref_video` — Reference video (affects pricing)
- `ref_image` — Reference image
- `image1`, `image2` — Additional reference images
- `reference_image` — Character reference image

## Aspect Ratios

Supported set varies by model. Common ratios: `1:1` (default), `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`. `nano-banana-2` additionally supports extreme banner ratios `1:4`, `4:1`, `1:8`, `8:1`. See model table in `SKILL.md`.

## Image Resolutions

- `1k`
- `2k`
- `4k`

`midjourney-v7` does **not** accept a resolution parameter.
