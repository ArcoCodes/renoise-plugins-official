#!/usr/bin/env bash

# SessionStart hook: check API key and guide user through setup if missing.

set -euo pipefail

# If API key is already configured, nothing to do
if [ -n "${RENOISE_API_KEY:-}" ]; then
  exit 0
fi

# API key is missing — tell Claude the minimal facts, let it handle the UX
jq -n '{
  systemMessage: "RENOISE_API_KEY is not set. Guide the user to configure it in .claude/settings.local.json under the env block. Get the key at https://www.renoise.ai . Do NOT ask the user to paste the key in the conversation. Do NOT proceed with video tasks until configured."
}'

exit 0
