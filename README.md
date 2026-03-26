# renoise-plugins-official

AI video production skills by Renoise — creative direction, generation, editing, and e-commerce content.

## Skills

| Skill | Description |
|-------|-------------|
| **director** | Creative director — main entry point for all video requests |
| **gemini-gen** | Base skill for calling Google Gemini API via REST fetch |
| **renoise-gen** | AI video & image generation engine (renoise-cli) |
| **tiktok-content-maker** | TikTok & e-commerce short video specialist |
| **scene-generate** | Background/environment image generation (Gemini) |
| **product-sheet-generate** | Multi-angle product design sheet (Gemini) |
| **short-film-editor** | Short film & drama editing |
| **video-download** | Video downloader (yt-dlp) |

## Installation

### Claude Code

```bash
claude plugin add ArcoCodes/renoise-plugins-official
```

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `RENOISE_API_KEY` | All skills | Renoise API credential. Get one at https://www.renoise.ai |
