#!/usr/bin/env bash

# PreToolUse hook: block Bash commands that run plugin scripts when RENOISE_API_KEY is not set.
# Input: hook event JSON on stdin

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if the command references any script in this plugin
if echo "$COMMAND" | grep -qE '(generate-scene|generate-design-sheet|analyze-images|youmeng-cli|gemini)\.(ts|mjs|js)'; then
  if [ -z "$RENOISE_API_KEY" ]; then
    jq -n '{
      decision: "block",
      reason: "RENOISE_API_KEY is not configured. Visit https://ujgsvru36x4korjj10nq.edgespark.app/api/public/app/tasks to get your API key, then add it to ~/.claude/settings.json:\n\n{\n  \"env\": {\n    \"RENOISE_API_KEY\": \"your-api-key-here\"\n  }\n}\n\nRestart Claude Code after configuring."
    }'
    exit 0
  fi
fi

# Allow everything else
exit 0
