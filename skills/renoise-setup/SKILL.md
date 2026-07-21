---
name: renoise-setup
description: >
  Set up, update, or diagnose Renoise on any agent host. Use when the user asks to install,
  upgrade, configure, connect, log in, check dependencies, enable the Renoise CLI, or fix
  missing RENOISE_API_KEY, ffmpeg, jq, yt-dlp, ImageMagick, or agent-browser.
disable-model-invocation: true
metadata:
  author: renoise
  version: 1.0.0
  category: setup
  tags: [setup, install, authentication, dependencies, renoise]
---

# Renoise Setup — Cross-Harness

This is the host-neutral setup flow. Do not assume Claude Code, Codex, OpenClaw, or a specific config directory. Resolve `<PLUGIN_ROOT>` as two directories above this skill's directory.

Never ask the user to paste an API key into chat. Never install software, move binaries, edit `PATH`, or change host configuration without explicit confirmation.

## 1. Detect, Install, or Update the Core Runtime

Detect without changing the host:

| Host | Detection |
|---|---|
| macOS / Linux shell | `command -v node; command -v renoise; uname -s; uname -m` |
| Windows PowerShell | `Get-Command node, renoise -ErrorAction SilentlyContinue; [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture` |

Node.js is required by the plugin's Gemini, material, and cross-platform installer scripts; Bun is optional. The native CLI is required and is the single source of truth for authentication, model capabilities, generation, uploads, and task management.

If `renoise` exists, verify the plugin contract rather than trusting a static version number:

```text
renoise version
renoise help generate run
renoise help auth exec
```

The two help outputs must contain the exact usage paths `renoise generate run` and `renoise auth exec`; older Cobra builds may show parent help and still exit successfully.

If the binary is missing, either exact usage path is absent, or the user explicitly asks for an update, resolve `<PLUGIN_ROOT>` and preview the installer. This reads `https://download.renoise.ai/cli/latest.json` and prints the installed path/version/compatibility plus the latest release, archive, and target; it does not download or change files:

```text
node "<PLUGIN_ROOT>/skills/renoise-setup/scripts/install-cli.mjs" --check
```

The installer supports macOS, Windows, and Linux on x64 or ARM64. It selects `.tar.gz` on macOS/Linux or `.zip` on Windows, verifies the archive against the release's `checksums.txt`, and installs to:

| Host | Default target |
|---|---|
| macOS / Linux | `~/.local/bin/renoise` |
| Windows | `%LOCALAPPDATA%\Renoise\bin\renoise.exe` |

Show the installed and latest versions, detected release archive, whether the target will replace an existing file, and target path. If the current version is already compatible, do not force an update during unrelated work. **Ask for explicit confirmation.** Only after approval run:

```text
node "<PLUGIN_ROOT>/skills/renoise-setup/scripts/install-cli.mjs" --install
```

The same path handles first install and replacement updates. It does not auto-update in the background, and it never edits `PATH`. If the target directory is absent from `PATH` or another `renoise` binary wins PATH resolution, explain the platform-specific change and ask separately before editing shell profiles or the Windows user environment. Restart Codex/ChatGPT Desktop or Claude Desktop after a PATH change. Linux has no official Codex Desktop app, but the same CLI and skills work in Codex CLI and Claude Code.

For manual installation, read the public release manifest at `https://download.renoise.ai/cli/latest.json`, download the matching archive and `checksums.txt` from its version directory, verify SHA-256, then extract the binary. Downloading, moving, or replacing files still requires confirmation.

Before replacing an existing binary, the installer checks both exact usage paths. After installation, rerun all three contract checks above. If `generate run` or `auth exec` is unavailable, the release is incompatible; stop and ask the user to upgrade rather than recreating the command in the plugin.

## 2. Authenticate Once

Preferred on every host:

```bash
renoise auth status --json
renoise auth login
```

Have the user run `renoise auth login` in an interactive terminal. It masks, validates, and saves the key in the OS user config directory with restricted permissions. Plugin generation and Credits call the CLI directly; Gemini and upload scripts run through `renoise auth exec` so they reuse the credential without printing it.

`RENOISE_API_KEY` remains the credential override for CI and containers, but the native CLI binary is still required. Tell the user to store the key in the host's secret/environment facility, not in project files or chat.

Verify through the native CLI:

```bash
renoise account status --json
renoise model --json
```

If authentication fails, direct the user to https://www.renoise.ai/developer to create or rotate a key, then repeat `renoise auth login`.

## 3. Check Workflow Readiness

Detection only on macOS/Linux:

```bash
for tool in jq ffmpeg ffprobe yt-dlp magick agent-browser; do
  if command -v "$tool" >/dev/null 2>&1; then printf 'OK      %s\n' "$tool"; else printf 'MISSING %s\n' "$tool"; fi
done
```

Windows PowerShell equivalent:

```powershell
'jq','ffmpeg','ffprobe','yt-dlp','magick','agent-browser' | ForEach-Object {
  if (Get-Command $_ -ErrorAction SilentlyContinue) { "OK      $_" } else { "MISSING $_" }
}
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
