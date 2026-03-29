---
name: product-sheet-generate
description: >
  Generates multi-angle Product Design Sheet from product photos using Renoise
  nano-banana-2. Shows front/back/side views, color palette, materials, and
  construction details. Use when user says "product design sheet", "product
  reference image", "multi-angle product view", or needs a visual reference
  for video production. Do NOT use for scene backgrounds or video generation.
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.2.0
  category: video-production
  tags: [product, design, renoise]
---

# Product Design Sheet Generation

Generate a comprehensive Product Design Sheet image from product photos using Renoise `nano-banana-2` model.

## Arguments

- First argument — Product images directory or single image path (required)
- Second argument — Output directory (required, e.g. `output/foam-roller-20260313-1420/analysis`)

## What is a Product Design Sheet?

A single image containing:
- Multiple angle views (front, back, side, three-quarter, bottom)
- Color palette with Pantone or hex references
- Material and texture callouts
- Construction details and hardware close-ups
- Proportions and measurements
- Interior views (if applicable)

## Instructions

1. List images in the input path to confirm they exist.

2. Upload each product image as a material:

```bash
node ${CLAUDE_SKILL_DIR}/../renoise-gen/renoise-cli.mjs material upload "<image_path>"
```

Note the material ID from each upload output (e.g. `#42`).

3. Write an English prompt for the design sheet. Example:

> Based on the provided product reference photos, generate a professional Product Design Sheet on a single clean white background. Include: multiple angle views (front, back, side, three-quarter, top), color palette swatches, material and texture close-ups, construction detail callouts, and relative proportions. Layout: clean organized grid. Photorealistic rendering. No cartoons or illustrations.

Add `Do NOT include any text, labels, titles, annotations, or typography.` if user wants no-text version.

4. Generate the design sheet, referencing the uploaded materials:

```bash
node ${CLAUDE_SKILL_DIR}/../renoise-gen/renoise-cli.mjs task generate \
  --model nano-banana-2 \
  --prompt "<english_prompt>" \
  --materials "<id1>:ref_image,<id2>:image1,<id3>:image2" \
  --resolution 2k \
  --ratio 1:1
```

Assign material roles: first image as `ref_image`, additional images as `image1`, `image2`, etc.

5. The command will output an `imageUrl` when complete. Download the image:

```bash
curl -sL "<imageUrl>" -o "<output_dir>/product_design_sheet.png"
```

6. Verify the output image was created and print file size.

7. Show the generated image to the user for approval. If not satisfactory, adjust the prompt and regenerate.
