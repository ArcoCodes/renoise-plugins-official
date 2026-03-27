# renoise-plugins-official

AI video production skills by Renoise — creative direction, generation, editing, and e-commerce content.

## Skills

| Skill | Description |
|-------|-------------|
| **director** | Creative director — main entry point for all video requests |
| **gemini-gen** | Visual understanding & multimodal analysis via Gemini 3.1 Pro |
| **renoise-gen** | AI video & image generation engine (renoise-cli) |
| **tiktok-content-maker** | TikTok & e-commerce short video specialist |
| **scene-generate** | Background/environment image generation |
| **product-sheet-generate** | Multi-angle product design sheet |
| **short-film-editor** | Short film & drama editing |
| **video-download** | Video downloader (yt-dlp) |
| **file-upload** | Upload files to Renoise for use with gemini-gen |

## Installation

### Claude Code

1. Add the marketplace:

```bash
claude plugin marketplace add ArcoCodes/renoise-plugins-official
```

2. Install the plugin:

```bash
claude plugin install video-maker@renoise-plugins-official
```

3. Run the setup command to connect your Renoise account:

```
/video-maker:setup
```

### OpenClaw

```bash
openclaw plugins install @renoise/video-maker
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
