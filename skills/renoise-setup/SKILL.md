---
name: renoise-setup
description: >
  Set up or diagnose Renoise on any agent host. Use when the user asks to install,
  configure, connect, log in, check dependencies, enable the Renoise CLI, or fix
  missing RENOISE_API_KEY, ffmpeg, jq, yt-dlp, ImageMagick, or agent-browser.
metadata:
  author: renoise
  version: 1.0.0
  category: setup
  tags: [setup, install, authentication, dependencies, renoise]
---

# Renoise Setup — Cross-Harness

This is the host-neutral setup flow. Do not assume Claude Code, Codex, OpenClaw, or a specific config directory. Resolve `<PLUGIN_ROOT>` as two directories above this skill's directory.

Never ask the user to paste an API key into chat. Never install software, move binaries, edit `PATH`, or change host configuration without explicit confirmation.

## 1. Detect Core Runtime and CLI

```bash
command -v node 2>/dev/null
command -v bun 2>/dev/null || true
command -v renoise 2>/dev/null
renoise version 2>/dev/null || true
```

Node.js is required because existing plugin workflows invoke `node`; Bun is optional and may power host-specific integrations. The native CLI is recommended and gives the interactive generator/settings UI plus secure shared login.

If `renoise` is missing, offer one of these; run nothing without confirmation:

- [GitHub Releases](https://github.com/renoise-ai/renoise-cli/releases/latest): download the matching OS/CPU archive, extract `renoise` (`renoise.exe` on Windows), and place it on `PATH`.
- With Go installed: `go install github.com/renoise-ai/renoise-cli/cmd/renoise@latest`.

Release archives are `.tar.gz` on macOS/Linux and `.zip` on Windows. Verify with `renoise version`. A non-PATH binary can be selected with `RENOISE_CLI_PATH=/path/to/renoise`.

## 2. Authenticate Once

Preferred on every host:

```bash
renoise auth status --json
renoise auth login
```

Have the user run `renoise auth login` in an interactive terminal. It masks, validates, and saves the key in the OS user config directory with restricted permissions. Plugin generation, Gemini, upload, fallback, and Credits code all reuse that saved credential without printing it.

`RENOISE_API_KEY` remains the override for CI, containers, or hosts where installing the native CLI is not possible. Tell the user to store it in that host's secret/environment facility, not in project files or chat. Do not guess or edit host-specific config paths.

Verify through the stable adapter:

```bash
cd "<PLUGIN_ROOT>"
node skills/renoise-gen/renoise-cli.mjs credit me
```

If authentication fails, direct the user to https://www.renoise.ai/developer to create or rotate a key, then repeat `renoise auth login`.

## 3. Check Workflow Readiness

Detection only:

```bash
for tool in jq ffmpeg ffprobe yt-dlp magick agent-browser; do
  if command -v "$tool" >/dev/null 2>&1; then printf 'OK      %s\n' "$tool"; else printf 'MISSING %s\n' "$tool"; fi
done
```

| Tool | Enables |
|------|---------|
| `jq` | Director batch generation |
| `ffmpeg` + `ffprobe` | Assembly, tail frames, QC, audio mix, video inspection |
| `yt-dlp` | Video downloads |
| ImageMagick `magick` | Storyboard-grid splitting; optional QC fallback |
| `agent-browser` | Optional Douyin/TikTok download fallback |

Offer only relevant missing tools, and install only after confirmation:

- macOS/Homebrew: `brew install jq ffmpeg yt-dlp imagemagick`
- Debian/Ubuntu: `sudo apt install jq ffmpeg imagemagick`; current yt-dlp: `pipx install yt-dlp`
- Windows/winget: `winget install jqlang.jq Gyan.FFmpeg yt-dlp.yt-dlp ImageMagick.ImageMagick`
- Optional browser fallback: `npm install -g agent-browser && agent-browser install`

Missing optional tools do not block generation or Gemini.

## 4. Report

Return a short readiness summary:

```text
Renoise CLI: ready / missing
Authentication: ready / action needed
Generation + Gemini: ready / action needed
Director/QC: ready / limited by ...
Downloads: ready / limited by ...
Optional browser fallback: ready / not installed
```

Apply host-specific extras only when that host exposes them. For example, the Claude Code `/renoise:setup` wrapper may additionally configure its statusLine; that is not part of this universal flow.
