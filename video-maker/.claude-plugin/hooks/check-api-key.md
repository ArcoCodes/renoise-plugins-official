---
name: check-api-key
description: Block tool calls when RENOISE_API_KEY is not configured
event: PreToolUse
tools:
  - Bash
---

Check if the environment variable `RENOISE_API_KEY` is set.

Look at the Bash command being executed. If it runs any script from this plugin (e.g. `generate-scene.ts`, `generate-design-sheet.ts`, `analyze-images.ts`, `youmeng-cli.mjs`, or any script under the `video-maker/` directory), then `RENOISE_API_KEY` must be present.

If `RENOISE_API_KEY` is NOT set in the environment:
- Return `decision: block`
- Tell the user: "RENOISE_API_KEY is not configured. Visit https://ujgsvru36x4korjj10nq.edgespark.app/api/public/app/tasks to get your API key, then add it to ~/.claude/settings.json:"
- Show this example config:
```json
{
  "env": {
    "RENOISE_API_KEY": "your-api-key-here"
  }
}
```
- Tell the user to restart Claude Code after configuring.

If `RENOISE_API_KEY` IS set, or if the command is not related to this plugin's scripts:
- Return `decision: allow`
