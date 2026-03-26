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

If already set, skip to Step 5.

If not set, guide the user through login:

1. Open the Renoise developer page:
   ```bash
   open "https://renoise.ai/developer"
   ```

2. Tell the user:
   > 🎬 Renoise developer page opened. Please create an API key there (starts with `fk_`), then paste it here.

3. Use AskUserQuestion to ask for the API key.

4. Save to `~/.claude/settings.json` under the `env` block. Merge with existing values — do not overwrite other keys:
   ```json
   {
     "env": {
       "RENOISE_API_KEY": "<user's key>"
     }
   }
   ```

5. Verify the key works:
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && RENOISE_API_KEY="<user's key>" node skills/renoise-gen/renoise-cli.mjs credit me
   ```
   If verification fails, tell the user the key may be invalid and ask to try again.

## Step 5: Apply StatusLine Config

Read `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`.

**If a `statusLine` already exists** and its command does NOT contain "video-maker":
1. Save the existing statusLine command to `~/.renoise/previous-statusline.json`:
   ```json
   { "command": "<existing statusLine command>" }
   ```
   Create the `~/.renoise/` directory if needed.
2. Tell the user: "Your existing statusLine (e.g. claude-hud) will be preserved and merged with the credits display."

**Then** merge in our statusLine config, preserving all other existing settings:

```json
{
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

After writing, tell the user:

> ✅ Login successful! Your Renoise account is now connected.
>
> **Restart Claude Code** to activate. After restart you'll see:
> - Your real-time credit balance in the status bar
> - Low balance warnings when credits are running out
> - Type `/video-maker:add-credits` anytime to top up
