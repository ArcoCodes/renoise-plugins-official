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
else
  # Native `renoise auth login` stores a 0600 credentials file in the OS user config dir.
  for credentials in \
    "${XDG_CONFIG_HOME:-$HOME/.config}/renoise/credentials.json" \
    "$HOME/Library/Application Support/renoise/credentials.json" \
    "${APPDATA:-$HOME/AppData/Roaming}/renoise/credentials.json"; do
    if [ -s "$credentials" ] && grep -q '"api_key"' "$credentials" 2>/dev/null; then
      HAS_KEY=true
      break
    fi
  done
fi

# Check if statusLine is pointing to our script
SETTINGS_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
if [ -f "$SETTINGS_FILE" ] && grep -q "statusLine" "$SETTINGS_FILE" 2>/dev/null && grep -q "renoise-plugins-official/renoise" "$SETTINGS_FILE" 2>/dev/null; then
  HAS_STATUSLINE=true
fi

# Case 1: New user — no API key
if [ "$HAS_KEY" = false ]; then
  # stdout goes to Claude as context — Claude will relay the message to the user
  echo '[Renoise] Plugin installed successfully, but Renoise account is not connected yet. Tell the user: type /renoise:setup to connect your account. One sentence only.'
  exit 0
fi

# Case 2: Existing user updated plugin — has key but no statusLine
if [ "$HAS_STATUSLINE" = false ]; then
  echo '[Renoise] Plugin updated — new feature: real-time credit balance in status bar. Tell the user: type /renoise:setup to activate. One sentence only.'
  exit 0
fi

# Case 3: Everything configured — silent
exit 0
