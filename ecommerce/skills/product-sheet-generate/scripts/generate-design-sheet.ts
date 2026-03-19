#!/usr/bin/env npx tsx
/**
 * Generate a Product Design Sheet image using Gemini.
 * Usage: npx tsx generate-design-sheet.ts <image_path_or_dir> <output_path> [--no-text]
 */

import fs from 'fs/promises'
import path from 'path'
import { getGeminiClient, fileToInlinePart, ensureDir } from '../../../lib/gemini.js'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tiff'])

const DESIGN_SHEET_PROMPT = `Based on the provided product photo(s), generate a professional Product Design Sheet image.

CRITICAL STYLE REQUIREMENT: The output MUST be PHOTOREALISTIC. Preserve the exact real-world appearance, lighting, material textures, and colors from the original product photos. Do NOT create illustrations, cartoons, vector art, flat graphics, or stylized drawings.

The design sheet should include on a single clean white background:
1. Multiple Angle Views: Front, back, side, three-quarter left/right, and top views
2. Color Palette: Swatches of all available color variants with Pantone-style labels
3. Material Callouts: Photorealistic close-up details of textures and surface finish
4. Construction Details: Close-up views showing construction quality, seams, hardware
5. Proportions & Measurements: Relative size indicators
6. Product Title: Clear product name and subtitle at the top

Layout: Clean organized grid. Typography: Clean sans-serif labels. Background: White/light gray.
Generate as a single comprehensive image. Every rendering must be photorealistic.`

const DESIGN_SHEET_PROMPT_NO_TEXT = `Based on the provided product photo(s), generate a professional Product Design Sheet image.

CRITICAL: PHOTOREALISTIC only. No illustrations, cartoons, or vector art.
IMPORTANT: Do NOT include any text, labels, titles, annotations, or typography.

Show on a single clean white background:
1. Multiple Angle Views in a clean grid (front, back, side, top, three-quarter views)
2. Color Palette: Small color swatches (no text labels)
3. Material & Texture Close-ups: Zoomed-in details of surface finish
4. Scale Reference: Different sizes side by side

Layout: Clean grid. NO text, NO labels, NO arrows. Background: White/light gray.
Generate as a single comprehensive image with only visual content.`

async function collectImages(inputPath: string): Promise<string[]> {
  const stat = await fs.stat(inputPath)
  if (stat.isFile()) return [inputPath]
  if (stat.isDirectory()) {
    const entries = await fs.readdir(inputPath)
    return entries
      .filter((e) => IMAGE_EXTS.has(path.extname(e).toLowerCase()))
      .sort()
      .map((e) => path.join(inputPath, e))
  }
  return []
}

async function main() {
  const args = process.argv.slice(2)
  const noText = args.includes('--no-text')
  const positional = args.filter((a) => !a.startsWith('--'))

  const [inputPath, outputPath] = positional
  if (!inputPath || !outputPath) {
    console.error('Usage: generate-design-sheet.ts <image_path_or_dir> <output_path> [--no-text]')
    process.exit(1)
  }

  const images = await collectImages(inputPath)
  if (images.length === 0) {
    console.error(`[ERROR] No images found at ${inputPath}`)
    process.exit(1)
  }

  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.0-flash-exp',
  })

  console.log(`[INFO] Uploading ${images.length} reference image(s)...`)
  const imageParts = await Promise.all(images.map(fileToInlinePart))

  const promptText = noText ? DESIGN_SHEET_PROMPT_NO_TEXT : DESIGN_SHEET_PROMPT
  console.log('[INFO] Generating Product Design Sheet...')

  const result = await model.generateContent([...imageParts, { text: promptText }])
  const parts = result.response.candidates?.[0]?.content?.parts ?? []

  let imgBytes: Buffer | null = null
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      imgBytes = Buffer.from(part.inlineData.data, 'base64')
      break
    }
  }

  if (!imgBytes) {
    console.error('[ERROR] No image was generated. Response text:')
    for (const part of parts) {
      if (part.text) console.error(part.text)
    }
    process.exit(1)
  }

  await ensureDir(outputPath)
  await fs.writeFile(outputPath, imgBytes)
  const sizeKb = (await fs.stat(outputPath)).size / 1024
  console.log(`[SUCCESS] Product Design Sheet saved to ${outputPath} (${sizeKb.toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('[ERROR]', err.message)
  process.exit(1)
})
