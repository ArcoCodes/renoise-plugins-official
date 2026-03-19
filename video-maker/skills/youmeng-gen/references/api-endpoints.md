# YOUMENG API Reference

## API Endpoints

Base URL: `https://staging--ujgsvru36x4korjj10nq.edgespark.app`

All endpoints require `Authorization: Bearer <token>` header.

### User & Credits

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | User info + credit balance |
| GET | `/api/credit/estimate?model=X&duration=Y&hasVideoRef=0` | Cost estimate |
| GET | `/api/credit/history?limit=50&offset=0` | Credit transactions |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks?status=X&tag=Y&limit=50&offset=0` | List tasks |
| GET | `/api/tasks/:id` | Task detail |
| GET | `/api/tasks/:id/result` | Task result (video/cover URLs) |
| POST | `/api/tasks/:id/cancel` | Cancel pending task |
| PATCH | `/api/tasks/:id/tags` | Update tags |
| GET | `/api/tags` | List all tags |

### Materials

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/materials?type=X&search=Y` | List materials with download URLs |

## Request/Response Formats

### POST /api/tasks

Request:
```json
{
  "prompt": "string (required)",
  "model": "seedance-2.0",
  "duration": 5,
  "ratio": "1:1",
  "materials": [{ "id": 42, "role": "ref_video" }],
  "tags": ["demo"]
}
```

Response (201):
```json
{
  "task": {
    "id": 1,
    "prompt": "...",
    "model": "seedance-2.0",
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

### GET /api/tasks/:id/result

Response:
```json
{
  "taskId": 1,
  "status": "completed",
  "videoUrl": "https://...",
  "coverUrl": "https://...",
  "resolutions": { "720p": "https://..." },
  "itemCount": 1,
  "fetchedAt": "2026-03-10T...",
  "cached": true
}
```

## Task Statuses

| Status | Description |
|--------|-------------|
| `pending` | Waiting for assignment |
| `assigning` | Being assigned to account |
| `assigned` | Assigned, waiting to start |
| `queued` | Queued on provider |
| `running` | Generating |
| `completed` | Done — result available |
| `failed` | Failed — check error field |
| `cancelled` | User cancelled |

## Models

- `seedance-2.0` — Default model

## Material Roles

- `ref_video` — Reference video (affects pricing)
- `image1`, `image2` — Reference images

## Aspect Ratios

- `1:1` (default)
- `16:9`
- `9:16`
