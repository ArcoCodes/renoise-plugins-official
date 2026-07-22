---
description: Run universal Renoise setup, then enable Claude Code Credits statusLine
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

# Renoise Setup for Claude Code

This command is a Claude Code wrapper, not the universal setup implementation.

## Step 1: Run Universal Setup

Read `${CLAUDE_PLUGIN_ROOT}/skills/renoise-setup/SKILL.md` completely and follow it through authentication verification and the readiness report.

Do not ask the user to open a terminal or paste an API key into chat. The Agent runs `renoise auth login --web --json`, waits while the user authorizes in the browser, then continues automatically; the native CLI owns credential discovery and shares it with Gemini/upload through `renoise auth exec`. If the CLI is unavailable and the user declines installation, generation is not ready; do not recreate its behavior in the plugin.

After universal setup, select the Claude statusLine runtime with `command -v bun 2>/dev/null || command -v node 2>/dev/null` and save its absolute path as `{RUNTIME_PATH}`. Do not continue to the Claude-specific steps until Node.js exists and authentication verifies.

## Step 2: Find the Installed Claude Plugin

```bash
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
ls -d "$CLAUDE_DIR"/plugins/cache/renoise-plugins-official/renoise/*/ 2>/dev/null | awk -F/ '{ print $(NF-1) "\t" $(0) }' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-
```

Save as `{PLUGIN_DIR}`. If empty, ask the user to verify the marketplace installation.

## Step 3: Build and Test the Credits Command

For Bun:

```text
bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/renoise-plugins-official/renoise/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec "{RUNTIME_PATH}" --env-file /dev/null "${plugin_dir}src/index.ts"'
```

For Node.js:

```text
bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/renoise-plugins-official/renoise/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec npx tsx "${plugin_dir}src/index.ts"'
```

Test the generated command:

```bash
echo '{}' | {GENERATED_COMMAND} 2>&1
```

It must output at least one line.

## Step 4: Merge Claude Code StatusLine

Read `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`.

If an existing `statusLine.command` does not contain `renoise`, save it to `~/.renoise/previous-statusline.json`:

```json
{ "command": "<existing statusLine command>" }
```

Then merge this without overwriting unrelated settings:

```json
{
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

Tell the user the existing statusLine is preserved and merged.

## Step 5: Finish

Return the universal readiness summary, then add:

> ✅ Claude Code statusLine configured. Restart Claude Code to activate it.
>
> Use `/renoise:add-credits` anytime to top up.
