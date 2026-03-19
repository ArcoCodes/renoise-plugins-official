#!/usr/bin/env npx tsx
/**
 * Analyze product + model images using Gemini for ecommerce video scripting.
 * Usage: npx tsx analyze-images.ts <product_image> <model_image>
 */

import fs from 'fs/promises'
import path from 'path'
import { getGeminiClient, fileToInlinePart } from '../../../lib/gemini.js'

const PROMPT = `You are an expert ecommerce video director and product analyst. Analyze these two images:

Image 1: Product photo
Image 2: Model/person photo

Return a JSON object with exactly this structure (no markdown, no code fences, pure JSON only):

{
  "product": {
    "type": "product category (e.g. dress, sneaker, lipstick)",
    "color": "main colors",
    "material": "fabric/material description",
    "highlights": "key visual features and design details",
    "brand_tone": "brand positioning vibe (e.g. luxury, streetwear, minimalist)"
  },
  "model": {
    "gender": "male/female",
    "age_range": "estimated age range",
    "hair": "hair style and color description",
    "outfit": "what the model is wearing",
    "vibe": "overall style/aesthetic (e.g. elegant, sporty, casual chic)"
  },
  "scene_suggestions": [
    "scene 1 description with specific location and lighting",
    "scene 2 description with specific location and lighting",
    "scene 3 description with specific location and lighting"
  ],
  "selling_points": [
    "selling point 1 — specific and compelling",
    "selling point 2 — specific and compelling",
    "selling point 3 — specific and compelling"
  ]
}`

async function main() {
  const [productImage, modelImage] = process.argv.slice(2)
  if (!productImage || !modelImage) {
    console.error('Usage: analyze-images.ts <product_image> <model_image>')
    process.exit(1)
  }

  // Validate files exist
  await fs.access(productImage).catch(() => {
    console.error(`ERROR: Product image not found: ${productImage}`)
    process.exit(1)
  })
  await fs.access(modelImage).catch(() => {
    console.error(`ERROR: Model image not found: ${modelImage}`)
    process.exit(1)
  })

  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  })

  const productPart = await fileToInlinePart(productImage)
  const modelPart = await fileToInlinePart(modelImage)

  const result = await model.generateContent([
    { text: PROMPT },
    productPart,
    modelPart,
  ])

  const text = result.response.text()

  // Try to parse and pretty-print as JSON
  const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    console.log(JSON.stringify(parsed, null, 2))
  } catch {
    // If not valid JSON, output raw text
    console.log(text)
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
