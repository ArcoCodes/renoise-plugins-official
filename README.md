# renoise-plugins-official

AI video production skills by Renoise — creative direction, generation, analysis, e-commerce content, and download.

## Skills

| Skill | Description |
|-------|-------------|
| **Create with Renoise** (`director`) | Portable creative direction for product ads, short films, e-commerce, drama, and comedy |
| `model-routing` | Internal task-to-model router and model-specific prompting guide |
| **Build Storyboard** (`storyboard-sheet`) | Portable script/novel adaptation into review sheets, shot lists, first frames, and video prompts |
| `renoise-cli` | Local-only CLI execution for capabilities, media analysis, generation, uploads, tasks, and production helpers |
| **Setup / Account** (`renoise-setup`) | Local-only CLI installation/update, secure login, and readiness checks |
| **Renoise Annotation Board** (`canvas`) | Local image/frame annotation board for snapshots and structured revision handoff |
| `video-download` | Local-only downloader utility (yt-dlp + Douyin/TikTok fallback) |

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

### Claude Desktop

In **Cowork**, open **Customize → Plugins → + → Add marketplace → Add from a repository**, enter `https://github.com/ArcoCodes/renoise-plugins-official`, then install **renoise**. Cowork handles local CLI installation and browser sign-in; no separate Terminal is required.

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

The native Go CLI is required only on local CLI hosts. It is their source of truth for authentication, media analysis, model capabilities, generation, uploads, tasks, and machine-readable output. Hosted Renoise Agent uses portable Skills plus its own typed capabilities and does not install or execute this CLI.

When a local Renoise workflow finds a missing, outdated, or signed-out CLI, it automatically runs the **Setup / Account** flow and resumes the original request when ready. You can also select **Setup / Account** directly in Claude Desktop Cowork or Codex/ChatGPT Desktop, or run `/renoise:setup` in Claude Code. The Agent handles detection, installation, browser sign-in, and verification; the user only approves installation and authorizes Renoise in the browser. Setup detects macOS/Windows/Linux and x64/ARM64, compares the installed CLI contract/version with the latest release, and previews the archive and user-local target. After confirmation, the same path installs or updates the matching `.tar.gz`/`.zip`, verifies `checksums.txt` and required commands before replacement, and rolls back a failed replacement. The default targets are `~/.local/bin/renoise` on macOS/Linux and `%LOCALAPPDATA%\Renoise\bin\renoise.exe` on Windows. It never updates in the background; any binary replacement or PATH change requires approval, and PATH changes require a Desktop restart.

Manual downloads are listed in `https://download.renoise.ai/cli/latest.json`; verify the matching version directory's `checksums.txt` before extracting the binary.

Plugin updates remain owned by each host's plugin manager. CLI recovery happens on use but never replaces a binary without approval, so the two release tracks do not silently modify each other. There is no per-session setup notification. `renoise auth login --web` opens account authorization in the browser and stores the shared credential securely without terminal key entry; `RENOISE_API_KEY` remains the override for CI and containers. The local-only `renoise-cli` Skill queries live capabilities. Creative Skills keep researched routing and prompting profiles, but never duplicate availability, defaults, roles, limits, or other hard capability data; unknown models safely fall back to their live guidance and default status.

`skills/manifest.json` classifies Skills by runtime. Hosted Renoise Agent loads only portable `director`, `model-routing`, and `storyboard-sheet` source files whose required capabilities are available; it never loads `renoise-cli`, `renoise-setup`, `canvas`, `video-download`, executable helpers, or local examples. Hosted execution uses its typed capabilities directly and does not run the native CLI or local MCP App.

Interactive account and CLI defaults are available through:

```bash
renoise settings
```

## Renoise annotation board

Codex Desktop can open a focused Renoise annotation board for images and exact video frames. Media stays fixed while the user adds pen, arrow, shape, text, or numbered-pin marks, captures annotated snapshots into the intent input, and submits a structured revision request with source provenance and video timecodes.

The first render creates a pending session. The widget displays the exact project directory and does not read or write it until the user clicks **Approve**. State then stays under `<project>/.renoise/whiteboard/`; board JSON stores only opaque asset IDs and page-relative paths, while the original media bytes live under `pages/<pageId>/assets/`. Every tool call is bound to the opaque session, document writes use revision CAS, and model-facing media insertion accepts only same-session assets or validated Renoise task-result contracts.

The annotation board is an intent-capture surface rather than a replacement for the Renoise app's node graph, player, or timeline. AI HTML and Slides are intentionally not included.

The model-visible launch result contains only the exact project directory awaiting approval; the app-only approval call resolves the server-held pending session atomically, so session IDs and authorization nonces never round-trip through host-rendered tool output. Authorization does not require the optional MCP Apps initialize extension because some compatible desktop hosts render MCP Apps without declaring it; app-only tool visibility plus the server-held pending directory form the boundary. The `.mcp.json` entry intentionally uses plugin-root-relative paths (`features/canvas/dist/server.mjs`, `cwd: "."`); the host is expected to launch the server from the installed plugin root, which `tests/canvas/build-and-package.test.mjs` locks in as a contract.

After approval, the MCP server issues the widget a short-lived, session-scoped capability for an ephemeral loopback media gateway. The gateway additionally rejects any request whose `Host` header is not the gateway's own loopback host:port, as a DNS-rebinding defense. Image/video imports go directly from the widget to the approved project's asset directory as raw bytes; reloads stream verified files by opaque asset ID, and video playback supports HTTP byte ranges. Whiteboard state responses therefore remain metadata-only and do not embed previews or complete media as base64. The gateway never exposes an absolute filesystem path, validates page membership, size, signature, and SHA-256, and expires with the canvas session. When the Codex app sandbox cannot reach loopback, import and reload automatically use replay-safe 24 KiB MCP chunks instead. Those chunks are transport-only: the server assembles them directly into the same project-local asset file, while board JSON continues to store only opaque relative references.

Videos are imported only through the explicit video-import action and remain opaque page-local MP4/WebM assets. Fabric renders a poster card rather than decoding video in the canvas. Selecting media changes only the effective revision target; it never opens the media inspector. Captured frames record the source video asset ID, source SHA-256, and the native player's exact millisecond timecode, then return the user to annotation and revision-intent entry. The default video limit is 250 MB.

Plugin maintainers can run `npm run validate:plugin` to execute the official plugin-creator validator. The helper uses the installed Codex validator and an isolated temporary Python environment, leaving the repository and user Python installation unchanged.

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `RENOISE_API_KEY` | Optional override for all Renoise tools | CI/container or host-secret override. Interactive setup prefers the credential securely saved by `renoise auth login`. |
| `RENOISE_TASK_RESULTS_DIR` | Whiteboard tests only | Explicit local test adapter for `<taskId>.json` fixtures. The production server bundle compiles this adapter away; it is honored only by the unminified test build. Production insertion calls `renoise task result <id> --json`. |
| `RENOISE_WHITEBOARD_MAX_VIDEO_BYTES` | Optional whiteboard limit | Maximum imported MP4/WebM byte size. Defaults to 262144000 (250 MB); accepted range is 1 MB–2 GB. |

## Version & upgrading

### 1.5.0

- Added Seedance 2.5 and MiniMax H3 routing, reference workflows, and model-specific prompting guidance.
- Standardized material references on `@material:<ID>` across generation workflows.
- Refreshed routing and prompting practices for every live image, video, and audio model.

### 1.4.0

- Added task-aware model routing across image, video, and audio generation.
- Added researched prompting profiles and replacement guidance for superseded model variants.
- Kept live capabilities authoritative for availability, defaults, roles, limits, and parameters.

### 1.3.0

- Split portable `director` / `storyboard-sheet` methodology from the local-only `renoise-cli` execution Skill.
- Removed `gemini-gen`; media-analysis guidance now lives in `director`, while local analysis commands live in `renoise-cli`.
- Added `skills/manifest.json` for Hosted capability filtering and portability checks.

### 1.1.0

- Native Go `renoise` CLI integration as the single runtime for media analysis and generation, and the model-capability source.
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

When it involves a generation, include the **Task ID** (`renoise task get <id>`) and an output link/screenshot — that helps us most. Account / credits / API-key matters go to https://www.renoise.ai/developer, not the issue tracker.

有体验反馈或遇到 bug？到 **Issues → New issue** 选「💬 体验反馈」或「🐞 Bug 报告」按表单填写；涉及生成请附 **Task ID** 和产物链接/截图。账户 / 余额 / API Key 问题请到 https://www.renoise.ai/developer。
