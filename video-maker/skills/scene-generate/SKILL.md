---
name: scene-generate
description: Generate realistic scene/background images using Gemini for Seedance video production. Use when you need environment backgrounds for video generation, such as American homes, workshops, outdoor scenes, etc.
---

# Scene / Background Image Generation

Generate realistic background/scene images using Gemini image generation for use as Seedance environment references.

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
