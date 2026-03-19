---
name: scene-generate
description: >
  Generates realistic scene and background images using Gemini for video
  production. Use when user says "generate background", "create scene image",
  "I need a background for my video", or when a video workflow needs custom
  environment images. Do NOT use for product photos or design sheets.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.1.0
  category: video-production
  tags: [scene, background, gemini]
---

# Scene / Background Image Generation

Generate realistic background/scene images using Gemini image generation for use as video environment references.

## Arguments

- First argument — Scene description in natural language (required)
- Second argument — Output image path (required)

## Prerequisites

```bash
pip install google-genai python-dotenv
```

在项目根目录 `.env` 中设置 `GEMINI_API_KEY`（从 https://aistudio.google.com/apikey 获取）。脚本会自动从根目录 `.env` 加载。

## Instructions

1. Run the generation script:

```bash
python skills/scene-generate/scripts/generate_scene.py \
  "<scene_description>" \
  "<output_path>"
```

2. Verify the output image was created and print file size.

3. Show the generated image to the user for approval. If not satisfactory, adjust the description and regenerate.
