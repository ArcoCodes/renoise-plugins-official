#!/usr/bin/env bash

# SessionStart hook: guide users based on their setup state.
# - No API key → prompt to login
# - Has API key but no statusLine → prompt to enable credits display

set -euo pipefail

# Consume stdin (SessionStart sends context JSON, we don't need it)
cat > /dev/null

HAS_KEY=false
HAS_STATUSLINE=false

# Check if API key is configured
if [ -n "${RENOISE_API_KEY:-}" ] || [ -n "${RENOISE_AUTH_TOKEN:-}" ]; then
  HAS_KEY=true
fi

# Check if statusLine is pointing to our script
SETTINGS_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
if [ -f "$SETTINGS_FILE" ] && grep -q "video-maker" "$SETTINGS_FILE" 2>/dev/null && grep -q "statusLine" "$SETTINGS_FILE" 2>/dev/null; then
  HAS_STATUSLINE=true
fi

# Case 1: New user — no API key
if [ "$HAS_KEY" = false ]; then
  # stdout goes to Claude as context — Claude will relay the message to the user
  cat << 'MSG'
[Renoise Video Maker Plugin] This user just installed the Renoise Video Maker plugin but hasn't completed the initial setup yet. Briefly tell them:
- Thanks for installing Renoise Video Maker!
- To get started, they need to connect their Renoise account by typing /video-maker:setup
- This will set up their API key and enable the real-time credit balance display in the status bar
Keep it friendly and concise — 2-3 sentences max.
MSG
  exit 0
fi

# Case 2: Existing user updated plugin — has key but no statusLine
if [ "$HAS_STATUSLINE" = false ]; then
  cat << 'MSG'
[Renoise Video Maker Plugin Update] This user already has a Renoise API key configured, but just updated to a new version that supports real-time credit balance display in the status bar. Briefly tell them:
- The Renoise Video Maker plugin now shows your credit balance in real time at the bottom of the screen
- Color-coded warnings when credits are running low
- To activate this new feature, type /video-maker:setup
Keep it brief — 2-3 sentences max.
MSG
  exit 0
fi

# Case 3: Everything configured — silent
exit 0
