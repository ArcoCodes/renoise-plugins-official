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
claude plugin install renoise@renoise-plugins-official
```

### OpenClaw

```bash
openclaw plugins install @renoise/renoise
```

3. Launch Claude Code and run the setup command to connect your Renoise account:

```
/renoise:setup
```

This will guide you through connecting your API key and enabling the real-time credit balance display in the status bar.

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `RENOISE_API_KEY` | All skills | Renoise API credential. Get one at https://www.renoise.ai |
