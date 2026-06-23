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
/video-maker:setup
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
git clone https://github.com/ArcoCodes/renoise-plugins-official.git ~/.codex/plugins/video-maker
```

2. Create or update `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "renoise-plugins",
  "plugins": [
    {
      "name": "video-maker",
      "source": {
        "source": "local",
        "path": "./video-maker"
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

> `source.path` is resolved relative to the marketplace root (`~/.agents/plugins/`). Since the plugin is at `~/.codex/plugins/video-maker`, you can also symlink it: `ln -s ~/.codex/plugins/video-maker ~/.agents/plugins/video-maker`

</details>

<details>
<summary><b>Workspace install</b> — scoped to a single repo</summary>

1. Add the plugin to your project:

```bash
git submodule add https://github.com/ArcoCodes/renoise-plugins-official.git plugins/video-maker
```

2. Create `$REPO_ROOT/.agents/plugins/marketplace.json`:

```json
{
  "name": "renoise-plugins",
  "plugins": [
    {
      "name": "video-maker",
      "source": {
        "source": "local",
        "path": "./plugins/video-maker"
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

3. Restart Codex, run `/plugins` to find and install **video-maker**.

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `RENOISE_API_KEY` | All skills | Renoise API credential. Get one at https://www.renoise.ai |
