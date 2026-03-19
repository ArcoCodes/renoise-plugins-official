---
name: product-sheet-generate
description: Generate a Product Design Sheet image from product photos using Gemini. Creates a multi-angle visual reference with color palette, materials, proportions, and detail callouts. Use when you have product photos and need a comprehensive visual reference for video production.
---

# Product Design Sheet Generation

Generate a comprehensive Product Design Sheet image from product photos using Gemini image generation.

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

## Prerequisites

```bash
pip install google-genai python-dotenv
```

在项目根目录 `.env` 中设置 `GEMINI_API_KEY`。

## Instructions

1. List images in the input path to confirm they exist.

2. Run the generation script:

```bash
python skills/product-sheet-generate/scripts/generate_design_sheet.py \
  "<input_path>" \
  "<output_dir>/product_design_sheet.png"
```

Options:
- `--no-text` — Generate without any text labels or annotations
- `--prompt-file <path>` — Use a custom prompt file instead of the default

3. Verify the output image was created and print file size.

4. Show the generated image to the user for approval. If not satisfactory, adjust and regenerate.
