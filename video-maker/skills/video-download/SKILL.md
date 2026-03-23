---
name: video-download
description: >
  Downloads videos from YouTube, TikTok, Douyin, Bilibili, Instagram, XiaoHongShu and 1000+ platforms.
  Primary: yt-dlp. Fallback: agent-browser + GreenVideo for Douyin/TikTok when yt-dlp fails.
  Use when user says "download video", "save video", "grab video", "watermark-free download",
  or pastes a video URL. Do NOT use for AI video generation or video editing.
allowed-tools: Bash
metadata:
  author: renoise
  version: 0.2.0
  category: utility
  tags: [download, youtube, tiktok, douyin, yt-dlp, greenvideo]
---

# Video Download

Download videos from YouTube, TikTok, and other platforms to local MP4 files using yt-dlp. Handles format selection, platform-prefixed dedup, and TikTok cookie fallback automatically.

## Prerequisites

Verify yt-dlp is installed:

```bash
yt-dlp --version
```

If missing: `brew install yt-dlp` (macOS) or `pip install yt-dlp`.

### Optional (for Douyin/TikTok fallback)

- `agent-browser` installed globally (`npm install -g agent-browser`)
- Chrome for Testing installed (`agent-browser install`)

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
| `HTTP Error 403` (TikTok/Douyin) | Script auto-retries with cookies. If still failing, use **GreenVideo Fallback** below |
| `--max-filesize` skipped | Video exceeds 200M limit. Download manually with `-f 'best[height<=720]'` |
| `is not a valid URL` | Ensure URL is wrapped in single quotes |
| `Requested formats are incompatible` | yt-dlp auto-transcodes, no action needed |

## Video ID Logic

| Platform | Pattern | Example ID |
|----------|---------|------------|
| YouTube | `watch?v=`, `shorts/`, `embed/`, `youtu.be/` → 11-char ID | `yt-dQw4w9WgXcQ` |
| TikTok | 15+ digit numeric ID in URL | `tk-7571284267028729101` |
| Other | Base64url of URL, first 16 chars | `vid-aHR0cHM6Ly93d3` |

---

## GreenVideo Fallback (for Douyin/TikTok)

When yt-dlp fails for Douyin or TikTok URLs (common with 403 errors or region-restricted content), use GreenVideo as a browser-based fallback. Requires `agent-browser` (see Prerequisites).

### Decision Logic

```
User gives URL → Try yt-dlp first
                   ↓ fails (403 / no result)
               Is it Douyin/TikTok?
                   ↓ yes
               Use agent-browser + GreenVideo
                   ↓ no
               Report error, suggest manual download
```

### Step 1: Open GreenVideo

```bash
agent-browser open "https://greenvideo.cc/en/"
```

### Step 2: Paste URL and Parse

```bash
agent-browser snapshot
# Find the input textbox ref (e.g., @e63)
agent-browser fill <input-ref> "<video-url>"
agent-browser click <start-button-ref>
```

Wait 5 seconds for parsing to complete, then snapshot to verify results.

### Step 3: Extract Video Direct URL

The video URL is stored in Nuxt state. Extract it with:

```bash
agent-browser eval "
(function() {
  const nuxtData = window.__NUXT__;
  if (!nuxtData) return 'ERROR: No Nuxt data found';
  const str = JSON.stringify(nuxtData);
  const mp4Match = str.match(/https?:[^\\\"]*(?:mp4|video|play|aweme|douyinvod|bilivideo)[^\\\"]{0,500}/g);
  if (mp4Match && mp4Match.length > 0) return mp4Match[0];
  return 'ERROR: No video URL found in Nuxt state';
})()
"
```

### Step 4: Download and Cleanup

```bash
curl -L -o ~/Downloads/<filename>.mp4 "<extracted-video-url>"
agent-browser close
```

### GreenVideo Troubleshooting

| Issue | Solution |
|-------|----------|
| Parse fails or no result | Check URL is valid and publicly accessible. Some `/user/self` URLs need the direct video URL |
| No video URL in Nuxt state | Try clicking download button and check for `<video>` elements: `agent-browser eval "document.querySelectorAll('video').length"` |
| Download fails (403) | Video URLs expire quickly — extract and download immediately. Try adding `-H "Referer: https://greenvideo.cc/"` to curl |
| agent-browser not responding | Run `agent-browser close` then `agent-browser open "https://greenvideo.cc/en/"` |
