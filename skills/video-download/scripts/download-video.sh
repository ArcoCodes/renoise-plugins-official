#!/usr/bin/env bash
# download-video.sh — Download video to resources/references/ with dedup and platform detection
#
# Usage:
#   download-video.sh <URL> [output_dir]
#
# Features:
#   - Extracts platform-prefixed video ID (yt-xxx, tk-xxx, vid-xxx)
#   - Skips download if file already exists (dedup)
#   - Auto-retries TikTok with --cookies-from-browser chrome on 403
#   - Outputs final file path on success

set -euo pipefail

URL="${1:?Usage: download-video.sh <URL> [output_dir]}"
OUTPUT_DIR="${2:-resources/references}"

# --- Video ID extraction ---

extract_video_id() {
  local url="$1"

  # YouTube: watch?v=, shorts/, embed/, youtu.be/
  if [[ "$url" =~ (youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)([\w-]{11}|[A-Za-z0-9_-]{11}) ]]; then
    local yt_id
    yt_id=$(echo "$url" | grep -oE '(watch\?v=|shorts/|embed/|youtu\.be/)([A-Za-z0-9_-]{11})' | grep -oE '[A-Za-z0-9_-]{11}$')
    echo "yt-${yt_id}"
    return
  fi

  # TikTok: numeric ID (15+ digits)
  if [[ "$url" =~ tiktok\.com ]]; then
    local tk_id
    tk_id=$(echo "$url" | grep -oE '[0-9]{15,}' | head -1)
    if [[ -n "$tk_id" ]]; then
      echo "tk-${tk_id}"
      return
    fi
  fi

  # Fallback: base64url-encoded URL, first 16 chars
  local b64
  b64=$(echo -n "$url" | base64 | tr '+/' '-_' | tr -d '=' | head -c 16)
  echo "vid-${b64}"
}

VIDEO_ID=$(extract_video_id "$URL")
OUTPUT="${OUTPUT_DIR}/${VIDEO_ID}.mp4"

# --- Dedup check ---

if [[ -f "$OUTPUT" && $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -gt 0 ]]; then
  echo "ALREADY_EXISTS: $OUTPUT"
  exit 0
fi

# Remove zero-byte leftover from interrupted download
[[ -f "$OUTPUT" ]] && rm -f "$OUTPUT"

mkdir -p "$OUTPUT_DIR"

# --- Download ---

YT_DLP_ARGS=(
  -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
  --merge-output-format mp4
  --no-playlist
  --max-filesize 200M
  -o "$OUTPUT"
)

echo "Downloading: $URL"
echo "Output: $OUTPUT"

if yt-dlp "${YT_DLP_ARGS[@]}" "$URL"; then
  echo "DOWNLOADED: $OUTPUT"
  exit 0
fi

# --- TikTok 403 retry with cookies ---

if [[ "$URL" =~ tiktok\.com ]]; then
  echo "Retrying TikTok with browser cookies..."
  if yt-dlp "${YT_DLP_ARGS[@]}" --cookies-from-browser chrome "$URL"; then
    echo "DOWNLOADED: $OUTPUT"
    exit 0
  fi
fi

echo "FAILED: Could not download $URL"
exit 1
