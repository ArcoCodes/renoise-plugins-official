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
  echo '[Renoise Video Maker] User has not configured their Renoise API key yet. Please greet them and suggest they type /video-maker:setup to login and get started. Keep it brief — one short sentence.'
  exit 0
fi

# Case 2: Existing user updated plugin — has key but no statusLine
if [ "$HAS_STATUSLINE" = false ]; then
  echo '[Renoise Video Maker] User has a Renoise API key but has not enabled the Credits status bar display yet. Briefly let them know they can type /video-maker:setup to enable real-time credit balance in the status bar.'
  exit 0
fi

# Case 3: Everything configured — silent
exit 0
