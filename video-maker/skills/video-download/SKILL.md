---
name: video-download
description: >
  This skill should be used when the user asks to "download a video", "save video locally",
  "download from YouTube", "download from TikTok", "yt-dlp", or pastes a video URL
  (youtube.com, youtu.be, tiktok.com, etc.) that needs to be saved as a local MP4 file.
---

# Video Download

Download videos from YouTube, TikTok, and other platforms to local MP4 files using yt-dlp. Handles format selection, platform-prefixed dedup, and TikTok cookie fallback automatically.

## Prerequisites

Verify yt-dlp is installed:

```bash
yt-dlp --version
```

If missing: `brew install yt-dlp` (macOS) or `pip install yt-dlp`.

## Usage

### Single Video

Run the download script with the video URL:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/download-video.sh '<URL>'
```

The script handles everything automatically:
- Extracts a platform-prefixed video ID (`yt-dQw4w9WgXcQ`, `tk-7571284267028729101`, `vid-aHR0cHM6Ly93d3`)
- Saves to `resources/references/<video_id>.mp4`
- Skips download if file already exists (dedup)
- Retries TikTok downloads with `--cookies-from-browser chrome` on failure
- Removes zero-byte leftovers from interrupted downloads

### Custom Output Directory

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/download-video.sh '<URL>' 'path/to/output'
```

### Batch Download

Run the script in a loop:

```bash
for URL in '<URL1>' '<URL2>' '<URL3>'; do
  bash ${CLAUDE_SKILL_DIR}/scripts/download-video.sh "$URL"
done
```

## Script Output

The script prints one of three status lines:

| Output | Meaning |
|--------|---------|
| `ALREADY_EXISTS: <path>` | File already downloaded, skipped |
| `DOWNLOADED: <path>` | Download succeeded |
| `FAILED: <message>` | Download failed (exit code 1) |

## Troubleshooting

| Error | Solution |
|-------|----------|
| `HTTP Error 403` (TikTok) | Script auto-retries with cookies. If still failing, ensure Chrome has active TikTok session |
| `--max-filesize` skipped | Video exceeds 200M limit. Download manually with `-f 'best[height<=720]'` |
| `is not a valid URL` | Ensure URL is wrapped in single quotes |
| `Requested formats are incompatible` | yt-dlp auto-transcodes, no action needed |

## Video ID Logic

| Platform | Pattern | Example ID |
|----------|---------|------------|
| YouTube | `watch?v=`, `shorts/`, `embed/`, `youtu.be/` → 11-char ID | `yt-dQw4w9WgXcQ` |
| TikTok | 15+ digit numeric ID in URL | `tk-7571284267028729101` |
| Other | Base64url of URL, first 16 chars | `vid-aHR0cHM6Ly93d3` |
