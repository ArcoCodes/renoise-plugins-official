---
description: Configure Renoise API key to enable credits display and video generation
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

# Renoise Login

## Step 1: Check if already configured

```bash
echo "${RENOISE_API_KEY:+CONFIGURED}"
```

If `CONFIGURED`, tell the user:

> ✅ You're already logged in. Your Renoise API key is configured.
>
> - To check your balance: look at the status bar
> - To recharge: type `/video-maker:recharge`
> - To change your API key: paste a new one below

Then use AskUserQuestion to ask if they want to update their key. If no, stop here.

## Step 2: Open developer page and get key

```bash
open "https://renoise.ai/developer"
```

Tell the user:

> 🎬 Renoise developer page opened. Please create an API key there (starts with `fk_`), then paste it here.

Use AskUserQuestion to ask for their API key.

## Step 3: Save the API key

Read `~/.claude/settings.json`, add/update `RENOISE_API_KEY` in the `env` block. Preserve all existing settings.

## Step 4: Verify

```bash
cd ${CLAUDE_PLUGIN_ROOT} && RENOISE_API_KEY="<user's key>" node skills/renoise-gen/renoise-cli.mjs credit me
```

If successful, show the user their balance and tell them:

> ✅ Login successful! Restart Claude Code to see your credits in the status bar.

If failed, tell the user the key may be invalid and ask to try again.
