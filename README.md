# renoise-plugins-official

AI video production skills by Renoise — creative direction, generation, analysis, e-commerce content, and download.

## Skills

| Skill | Description |
|-------|-------------|
| **Create with Renoise** (`director`) | Creative direction and production for product ads, short films, e-commerce, drama, and comedy |
| **Analyze Media** (`gemini-gen`) | Visual understanding, product analysis, script extraction, and style analysis |
| **Build Storyboard** (`storyboard-sheet`) | Script and novel adaptation into review sheets, shot lists, first frames, and video prompts |
| **Setup / Account** (`renoise-setup`) | Cross-platform CLI installation/update, secure login, and readiness checks |
| `renoise-gen` | Internal native-CLI tool layer used by creation workflows |
| `video-download` | Video downloader utility (yt-dlp + Douyin/TikTok fallback) |

## Installation

> **⚠️ Upgrading from an older build?** As of **1.0.0** the plugin is unified under the name **`renoise`** on every host. Older installs registered as **`video-maker`** (Codex/OpenClaw, and very early Claude Code builds) **do not auto-update** — see [Version & upgrading](#version--upgrading) for the one-time migration steps.

### Claude Code

1. Add the marketplace:

```bash
claude plugin marketplace add ArcoCodes/renoise-plugins-official
```

2. Install the plugin:

```bash
claude plugin install renoise@renoise-plugins-official
```

3. Run the setup command to connect your Renoise account:

```
/renoise:setup
```

### OpenClaw

```bash
openclaw plugins install @renoise/plugin
```

### Codex / ChatGPT Desktop

Add the repository marketplace with the native Codex plugin command:

```bash
codex plugin marketplace add ArcoCodes/renoise-plugins-official
```

Restart the ChatGPT desktop app, open **Plugins**, select the **Renoise** marketplace, and install **renoise**. Codex Desktop is available on macOS and Windows; on Linux, use the same plugin through Codex CLI.

## Native Renoise CLI

The native Go CLI is required and is the single source of truth for authentication, model capabilities, generation, uploads, tasks, and machine-readable output.

Explicitly select **Setup / Account** in Codex/ChatGPT Desktop, or run `/renoise:setup` in Claude Code; account and install actions are intentionally not invoked implicitly. Setup detects macOS/Windows/Linux and x64/ARM64, compares the installed CLI contract/version with the latest release, and previews the archive and user-local target. After confirmation, the same path installs or updates the matching `.tar.gz`/`.zip`, verifies `checksums.txt` and required commands before replacement, and rolls back a failed replacement. The default targets are `~/.local/bin/renoise` on macOS/Linux and `%LOCALAPPDATA%\Renoise\bin\renoise.exe` on Windows. It never updates in the background; any binary replacement or PATH change requires approval, and PATH changes require a Desktop restart.

Manual downloads are listed in `https://download.renoise.ai/cli/latest.json`; verify the matching version directory's `checksums.txt` before extracting the binary.

Plugin updates remain owned by each host's plugin manager; CLI updates remain explicit through **Setup / Account**, so the two release tracks do not silently modify each other. There is no per-session setup notification. `renoise auth login` stores the shared credential securely; `RENOISE_API_KEY` remains the override for CI and containers. Plugin skills query `renoise model --json` at runtime, so new models and capability changes do not require duplicated plugin updates.

Interactive account and CLI defaults are available through:

```bash
renoise settings
```

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `RENOISE_API_KEY` | Optional override for all Renoise tools | CI/container or host-secret override. Interactive setup prefers the credential securely saved by `renoise auth login`. |

## Version & upgrading

### 1.1.0

- Native Go `renoise` CLI integration as the single runtime and model-capability source.
- Plugin commands and director scripts call the native CLI directly; model capabilities are discovered at runtime.
- Unified setup checks the shared credential plus generation, Gemini, download, storyboard, QC, and post-production tool readiness.
- Native CLI adds interactive generation/settings TUIs, secure saved credentials, model capabilities, owner-scoped tasks, shell completion, and human/JSON output.

### 1.0.0

> **⚠️ Breaking change — the plugin is now named `renoise` on all hosts.**
> Earlier builds installed under the name **`video-maker`** on Codex/OpenClaw (and the pre-rename Claude Code build). Because plugin managers key installs by name, an old `video-maker` install **will not upgrade automatically** — it stays frozen on the old version until you migrate manually:
>
> - **Claude Code** — remove any old install, then install the current one, and restart:
>   ```bash
>   claude plugin uninstall video-maker@renoise-plugins-official   # only if you have this leftover
>   claude plugin uninstall renoise@renoise-plugins-official 2>/dev/null; claude plugin install renoise@renoise-plugins-official
>   ```
> - **Codex** — remove the old `video-maker` marketplace/install, add `ArcoCodes/renoise-plugins-official` as shown above, install `renoise`, and restart the ChatGPT desktop app or Codex CLI.
> - **OpenClaw** — reinstall with `openclaw plugins install @renoise/plugin`.
>
> After migrating, slash commands move from `/video-maker:*` to `/renoise:*`.

**Highlights of 1.0.0**

- Unified plugin name **`renoise`** across Claude Code / Codex / OpenClaw.
- Default models and capabilities are discovered from `renoise model --json` at runtime.
- Multi-shot narrative workflow: story gate → consistency manifest (characters / props / scenes / style bible / transitions / spoken language), post-generation QC.
- New generation kinds and workflows are exposed through live CLI model capabilities.
- Model-specific reference handling follows live CLI guidance; the plugin-side facepass/original-Seedance flow and deprecated `asset`/`character` commands are retired.

## Feedback / 反馈

Hit a bug or have feedback on the experience, generation quality, or cross-shot consistency? Open an issue — the repo ships guided forms:

- 💬 **[Experience feedback](https://github.com/ArcoCodes/renoise-plugins-official/issues/new?template=feedback.yml)** — usage experience, generation quality, consistency, workflow suggestions.
- 🐞 **[Bug report](https://github.com/ArcoCodes/renoise-plugins-official/issues/new?template=bug_report.yml)** — reproducible defects.

When it involves a generation, include the **Task ID** (`renoise generate get <id>`) and an output link/screenshot — that helps us most. Account / credits / API-key matters go to https://www.renoise.ai/developer, not the issue tracker.

有体验反馈或遇到 bug？到 **Issues → New issue** 选「💬 体验反馈」或「🐞 Bug 报告」按表单填写；涉及生成请附 **Task ID** 和产物链接/截图。账户 / 余额 / API Key 问题请到 https://www.renoise.ai/developer。
