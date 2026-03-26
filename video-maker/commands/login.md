---
description: Configure Renoise API key to enable credits display and video generation
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

# Renoise Login

Help the user configure their Renoise API key.

## Step 1: Check if already configured

```bash
echo "${RENOISE_API_KEY:+CONFIGURED}"
```

If `CONFIGURED`, tell the user:

> ✅ You're already logged in. Your Renoise API key is configured.
>
> - To check your balance: look at the statusLine credits display
> - To recharge: type `/video-maker:recharge`

And stop here.

## Step 2: Guide the user

If not configured, tell the user:

> 🎬 To use Renoise video generation and see your credits, you need an API key.
>
> 1. Go to https://www.renoise.ai and sign in
> 2. Get your API key (starts with `fk_`)
> 3. Paste it here

Use AskUserQuestion to ask for their API key.

## Step 3: Save the API key

Read `~/.claude/settings.json`, add/update the `RENOISE_API_KEY` in the `env` block. Preserve all existing settings.

If the `env` block doesn't exist, create it:
```json
{
  "env": {
    "RENOISE_API_KEY": "<user's key>"
  }
}
```

## Step 4: Verify

Test the key by running:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && RENOISE_API_KEY="<user's key>" node skills/renoise-gen/renoise-cli.mjs credit me
```

If successful, tell the user:

> ✅ Login successful! Your balance will appear in the status bar after restarting Claude Code.

If failed, tell the user the key might be invalid and ask them to double-check.
