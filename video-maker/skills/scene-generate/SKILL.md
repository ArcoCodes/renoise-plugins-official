---
name: scene-generate
description: >
  Generates realistic scene and background images using Renoise nano-banana-2
  for video production. Use when user says "generate background", "create scene
  image", "I need a background for my video", or when a video workflow needs
  custom environment images. Do NOT use for product photos or design sheets.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.2.0
  category: video-production
  tags: [scene, background, renoise]
---

# Scene / Background Image Generation

Generate realistic background/scene images via Renoise `nano-banana-2` model for use as video environment references.

## Arguments

- First argument — Scene description in natural language (required)
- Second argument — Output directory (required)

## Instructions

1. Write an English prompt describing the scene. The prompt should specify:
   - Environment and setting details
   - Lighting conditions
   - Perspective (e.g. "shot from a natural handheld perspective")
   - "No people, no hands, no products — just the empty environment"
   - "Photorealistic, like a real photograph. Sharp focus on the main surface area."

2. Generate the image using the renoise-gen CLI:

```bash
node ${CLAUDE_SKILL_DIR}/../renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 \
  --prompt "<english_prompt>" \
  --resolution 2k \
  --ratio 9:16
```

3. The command will output an `imageUrl` when complete. Download the image to the output directory:

```bash
curl -sL "<imageUrl>" -o "<output_dir>/scene.png"
```

4. Verify the file was created and print file size.

5. Show the generated image to the user for approval. If not satisfactory, adjust the prompt and regenerate.
