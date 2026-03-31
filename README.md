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

### OpenClaw

```bash
openclaw plugins install @renoise/plugin
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
