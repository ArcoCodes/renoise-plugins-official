---
description: Configure Renoise Credits statusLine display
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

# Video Maker StatusLine Setup

Set up the Renoise Credits display in Claude Code's status bar. Merges with claude-hud if installed.

## Step 1: Detect Runtime

Find a JavaScript runtime (prefer bun for performance):

```bash
command -v bun 2>/dev/null || command -v node 2>/dev/null
```

If empty, tell the user to install bun (https://bun.sh) or Node.js (https://nodejs.org), then re-run `/video-maker:setup`.

Save the runtime absolute path as `{RUNTIME_PATH}`.

## Step 2: Find Plugin Directory

```bash
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
ls -d "$CLAUDE_DIR"/plugins/cache/renoise-plugins-official/video-maker/*/ 2>/dev/null | awk -F/ '{ print $(NF-1) "\t" $(0) }' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-
```

Save as `{PLUGIN_DIR}`. If empty, the plugin may not be installed via marketplace. Ask user to verify installation.

## Step 3: Generate and Test Command

Generate the statusLine command:

**If runtime is bun:**
```
bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/renoise-plugins-official/video-maker/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec "{RUNTIME_PATH}" --env-file /dev/null "${plugin_dir}src/index.ts"'
```

**If runtime is node:**
```
bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/renoise-plugins-official/video-maker/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec npx tsx "${plugin_dir}src/index.ts"'
```

Test the command:
```bash
echo '{}' | {GENERATED_COMMAND} 2>&1
```

Should output at least one line (credits display). If it errors, debug before proceeding.

## Step 4: Configure RENOISE_API_KEY

Check if `RENOISE_API_KEY` is already set:
```bash
echo "${RENOISE_API_KEY:+SET}"
```

If not set, ask the user for their Renoise API key (get one at https://www.renoise.ai). Then add it to `~/.claude/settings.json` under the `env` key:

```json
{
  "env": {
    "RENOISE_API_KEY": "<user's key>"
  }
}
```

Merge with existing env values — do not overwrite other keys.

## Step 5: Apply StatusLine Config

Read `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` and merge in the statusLine config, preserving all existing settings:

```json
{
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

If a `statusLine` already exists, warn the user it will be replaced (they may have claude-hud configured directly). Our script already integrates claude-hud internally, so this is safe.

After writing, tell the user:

> ✅ Setup complete! **Restart Claude Code** to see the Renoise Credits display in your status bar.
>
> Features:
> - 🎬 Real-time credit balance with color indicators (green/yellow/red)
> - Automatic balance refresh every 30 seconds
> - Merges with claude-hud if installed (HUD lines + credits)
> - Run `/video-maker:setup` again after plugin updates
