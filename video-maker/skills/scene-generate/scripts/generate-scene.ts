#!/usr/bin/env npx tsx
/**
 * Generate a photorealistic scene/background image using Gemini.
 * Usage: npx tsx generate-scene.ts "<scene_description>" "<output_path>"
 */

import fs from 'fs/promises'
import path from 'path'
import { getGeminiClient, ensureDir } from '../../../lib/gemini.js'

const BG_PROMPT_TEMPLATE = `Generate a photorealistic background/environment image for video production.

CRITICAL: The image must be PHOTOREALISTIC — like a real photograph taken with an iPhone.
No illustrations, no cartoons, no AI-looking renders. Real lighting, real textures, real depth of field.

Scene: {scene}

Requirements:
- Vertical 9:16 aspect ratio (portrait mode, like a phone screen)
- Shot from a natural handheld perspective (slight angle, not perfectly straight)
- Realistic ambient lighting matching the environment
- No people, no hands, no products in the scene — just the empty environment
- Sharp focus on the main surface/area where a product would be placed
- Natural depth of field (background slightly softer than foreground)`

async function main() {
  const [scene, outputPath] = process.argv.slice(2)
  if (!scene || !outputPath) {
    console.error('Usage: generate-scene.ts "<scene_description>" "<output_path>"')
    process.exit(1)
  }

  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-pro',
  })

  const prompt = BG_PROMPT_TEMPLATE.replace('{scene}', scene)
  console.log(`[INFO] Generating scene: ${scene}`)

  const result = await model.generateContent(prompt)
  const response = result.response
  const parts = response.candidates?.[0]?.content?.parts ?? []

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
  console.log(`[SUCCESS] Scene saved to ${outputPath} (${sizeKb.toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('[ERROR]', err.message)
  process.exit(1)
})
