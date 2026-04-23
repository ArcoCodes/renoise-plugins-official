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

- `renoise-2.0` — Default video model (Renoise 2.0)
- `nano-banana-2` — Image generation model

## Material Roles

- `ref_video` — Reference video (affects pricing)
- `ref_image` — Reference image
- `image1`, `image2` — Additional reference images
- `reference_image` — Character reference image

## Aspect Ratios

- `1:1` (default)
- `16:9`
- `9:16`

## Image Resolutions

- `1k`
- `2k`
