# video-maker

AI video production plugin for Claude Code. Install this plugin and get a creative director that turns your ideas into videos.

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

### OpenClaw

```bash
openclaw plugins install @renoise/video-maker
```

3. Launch Claude Code and run the setup command to connect your Renoise account:

```
/video-maker:setup
```

This will guide you through connecting your API key and enabling the real-time credit balance display in the status bar.

## How It Works

Just describe what you want — "make me a product video", "I want a short drama", "create a brand film" — and the **Director** skill takes over:

1. **Analyzes** your materials and creative brief
2. **Suggests** 2-3 style directions tailored to your project
3. **Generates** a complete video prompt, dialogue, and BGM plan
4. **Submits** to Renoise for AI video generation
5. **Learns** your preferences over time for better suggestions

## Skills

| Skill | Purpose |
|-------|---------|
| **director** | Creative director — the main entry point for all video requests |
| renoise-gen | AI video & image generation engine (CLI) |
| content-maker | TikTok e-commerce short video specialist |
| scene-generate | Background/environment image generation (Gemini) |
| product-sheet-generate | Multi-angle product design sheet (Gemini) |
| video-download | Video downloader (yt-dlp) |

## Adding New Verticals

Create a new skill directory with a `SKILL.md` that includes a `categories` field in its frontmatter. The Director automatically discovers and routes to it — no other changes needed.

```yaml
---
name: my-vertical
description: What this vertical handles
categories: [drama, storytelling]
---
```
