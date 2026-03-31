#!/usr/bin/env bash
# download-fallback.sh — Browser-based video download via GreenVideo
# For Douyin/TikTok URLs when yt-dlp fails.
# Requires: agent-browser (npm install -g agent-browser)
#
# Usage:
#   bash download-fallback.sh '<douyin-or-tiktok-url>' [output-dir]

set -euo pipefail

URL="${1:?Usage: download-fallback.sh '<url>' [output-dir]}"
OUTPUT_DIR="${2:-resources/references}"

mkdir -p "$OUTPUT_DIR"

# Generate filename from URL
FILENAME="fallback-$(echo "$URL" | md5 -q 2>/dev/null || echo "$URL" | md5sum | cut -d' ' -f1 | head -c 12).mp4"
OUTPUT_PATH="$OUTPUT_DIR/$FILENAME"

if [ -f "$OUTPUT_PATH" ] && [ -s "$OUTPUT_PATH" ]; then
  echo "ALREADY_EXISTS: $OUTPUT_PATH"
  exit 0
fi

echo "Opening GreenVideo..."
agent-browser open "https://greenvideo.cc/en/" 2>/dev/null

sleep 3

echo "Pasting URL and parsing..."
# Get snapshot to find input field
SNAPSHOT=$(agent-browser snapshot 2>/dev/null)
INPUT_REF=$(echo "$SNAPSHOT" | grep -oP '@\w+' | head -1)

if [ -z "$INPUT_REF" ]; then
  echo "FAILED: Could not find input field on GreenVideo"
  agent-browser close 2>/dev/null || true
  exit 1
fi

agent-browser fill "$INPUT_REF" "$URL" 2>/dev/null
sleep 1

# Find and click the start/parse button
SNAPSHOT2=$(agent-browser snapshot 2>/dev/null)
BUTTON_REF=$(echo "$SNAPSHOT2" | grep -i -oP '@\w+(?=.*(?:start|parse|download))' | head -1)

if [ -z "$BUTTON_REF" ]; then
  # Fallback: try clicking the first button-like element
  BUTTON_REF=$(echo "$SNAPSHOT2" | grep -oP '@\w+' | sed -n '2p')
fi

agent-browser click "$BUTTON_REF" 2>/dev/null
echo "Waiting for parsing..."
sleep 6

# Extract video URL from Nuxt state
echo "Extracting video URL..."
VIDEO_URL=$(agent-browser eval "
(function() {
  var nuxtData = window.__NUXT__;
  if (!nuxtData) return 'ERROR: No Nuxt data found';
  var str = JSON.stringify(nuxtData);
  var mp4Match = str.match(/https?:[^\\\\\"]*(?:mp4|video|play|aweme|douyinvod|bilivideo)[^\\\\\"]{0,500}/g);
  if (mp4Match && mp4Match.length > 0) return mp4Match[0];
  return 'ERROR: No video URL found in Nuxt state';
})()
" 2>/dev/null)

# Close browser
agent-browser close 2>/dev/null || true

if [[ "$VIDEO_URL" == ERROR* ]]; then
  echo "FAILED: $VIDEO_URL"
  exit 1
fi

echo "Downloading video..."
curl -L -s -o "$OUTPUT_PATH" -H "Referer: https://greenvideo.cc/" "$VIDEO_URL"

if [ -f "$OUTPUT_PATH" ] && [ -s "$OUTPUT_PATH" ]; then
  echo "DOWNLOADED: $OUTPUT_PATH"
else
  rm -f "$OUTPUT_PATH"
  echo "FAILED: Download produced empty file"
  exit 1
fi
