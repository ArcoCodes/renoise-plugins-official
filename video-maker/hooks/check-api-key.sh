#!/usr/bin/env bash

# PreToolUse hook: block Bash commands that run plugin scripts when RENOISE_API_KEY is not set.
# Input: hook event JSON on stdin

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if the command references any script in this plugin
if echo "$COMMAND" | grep -qE '(renoise-cli|generate-scene|generate-design-sheet|generate-storyboard-html|analyze-images|analyze-beats|gemini)\.(ts|mjs|js|py)'; then
  if [ -z "$RENOISE_API_KEY" ]; then
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "RENOISE_API_KEY is not configured. Visit https://ujgsvru36x4korjj10nq.edgespark.app/api/public/app/tasks to get your API key, then configure it:\n\nGlobal (all projects) — ~/.claude/settings.json:\n{\n  \"env\": {\n    \"RENOISE_API_KEY\": \"fk_your-api-key\"\n  }\n}\n\nProject-only — .claude/settings.local.json:\n{\n  \"env\": {\n    \"RENOISE_API_KEY\": \"fk_your-api-key\"\n  }\n}\n\nProject-level overrides global. Restart Claude Code after configuring."
      }
    }'
    exit 2
  fi
fi

# Allow everything else
exit 0
