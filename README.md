# renoise-plugins-official

AI video production skills by Renoise — creative direction, generation, analysis, e-commerce content, and download.

## Skills

| Skill | Description |
|-------|-------------|
| **director** | Creative director — single entry point for all video creation (product ads, short films, TikTok e-commerce, drama, comedy) |
| **gemini-gen** | Visual understanding & multimodal analysis via Gemini 3.1 Pro (product analysis, video script extraction, style extraction) |
| **renoise-gen** | AI video & image generation engine — renoise-cli, material pool, product design sheets, scene backgrounds |
| **video-download** | Video downloader (yt-dlp + Douyin/TikTok fallback) |

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

### Codex (≥ 0.117.0)

<details>
<summary><b>Personal install</b> — available across all your projects</summary>

1. Clone the plugin:

```bash
git clone https://github.com/ArcoCodes/renoise-plugins-official.git ~/.codex/plugins/renoise
```

2. Create or update `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "renoise-plugins",
  "plugins": [
    {
      "name": "renoise",
      "source": {
        "source": "local",
        "path": "./renoise"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

> `source.path` is resolved relative to the marketplace root (`~/.agents/plugins/`). Since the plugin is at `~/.codex/plugins/renoise`, you can also symlink it: `ln -s ~/.codex/plugins/renoise ~/.agents/plugins/renoise`

</details>

<details>
<summary><b>Workspace install</b> — scoped to a single repo</summary>

1. Add the plugin to your project:

```bash
git submodule add https://github.com/ArcoCodes/renoise-plugins-official.git plugins/renoise
```

2. Create `$REPO_ROOT/.agents/plugins/marketplace.json`:

```json
{
  "name": "renoise-plugins",
  "plugins": [
    {
      "name": "renoise",
      "source": {
        "source": "local",
        "path": "./plugins/renoise"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

</details>

3. Restart Codex, run `/plugins` to find and install **renoise**.

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `RENOISE_API_KEY` | All skills | Renoise API credential. Get one at https://www.renoise.ai |

## Version & upgrading

### 1.0.0

> **⚠️ Breaking change — the plugin is now named `renoise` on all hosts.**
> Earlier builds installed under the name **`video-maker`** on Codex/OpenClaw (and the pre-rename Claude Code build). Because plugin managers key installs by name, an old `video-maker` install **will not upgrade automatically** — it stays frozen on the old version until you migrate manually:
>
> - **Claude Code** — remove any old install, then install the current one, and restart:
>   ```bash
>   claude plugin uninstall video-maker@renoise-plugins-official   # only if you have this leftover
>   claude plugin uninstall renoise@renoise-plugins-official 2>/dev/null; claude plugin install renoise@renoise-plugins-official
>   ```
> - **Codex** — delete the old `video-maker` entry from `~/.agents/plugins/marketplace.json` and its clone directory, then re-install as `renoise` (see [Codex install](#codex--01170) above) and restart Codex.
> - **OpenClaw** — reinstall with `openclaw plugins install @renoise/plugin`.
>
> After migrating, slash commands move from `/video-maker:*` to `/renoise:*`.

**Highlights of 1.0.0**

- Unified plugin name **`renoise`** across Claude Code / Codex / OpenClaw.
- Default models: video → `seedance-2.0`, image → `seedream-5-0-pro` (override with `--model` anytime).
- Multi-shot narrative workflow: story gate → consistency manifest (characters / props / scenes / style bible / transitions / spoken language), post-generation QC.
- New capabilities: audio (`lyria-clip`, `seed-audio-1.0`), quality enhancement / upscale, `seedream-5-0-pro`, `gemini-omni-flash` source-video editing.
- Faces on the `seedance-2.0` series pass straight through as `ref_image` (auto-facepass); the legacy API-key pre-tool hook and the deprecated `asset`/`character` commands were removed.
