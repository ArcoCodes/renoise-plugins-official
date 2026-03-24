#!/usr/bin/env bash

# PreToolUse hook: block when neither RENOISE_API_KEY nor RENOISE_AUTH_TOKEN is set
# and the tool invocation looks like a renoise-cli call.

set -euo pipefail

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command being executed
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check if the command involves renoise-cli
if [[ "$COMMAND" != *renoise-cli* ]]; then
  exit 0
fi

# If either credential is configured, allow
if [ -n "${RENOISE_API_KEY:-}" ] || [ -n "${RENOISE_AUTH_TOKEN:-}" ]; then
  exit 0
fi

# Block and guide user
jq -n '{
  decision: "block",
  reason: "RENOISE_API_KEY or RENOISE_AUTH_TOKEN is not set. Add one to the env block in .claude/settings.local.json. Get your key at https://www.renoise.ai"
}'
