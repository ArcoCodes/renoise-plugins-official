/**
 * Shared Gemini API client utilities.
 * All scripts use this module to avoid duplicating API setup.
 */

import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import fs from 'fs/promises'
import path from 'path'

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set. Get one at: https://aistudio.google.com/apikey')
  }
  return new GoogleGenerativeAI(apiKey)
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
  }
  return mimeMap[ext] ?? 'application/octet-stream'
}

export async function fileToInlinePart(filePath: string): Promise<Part> {
  const data = await fs.readFile(filePath)
  return {
    inlineData: {
      mimeType: getMimeType(filePath),
      data: data.toString('base64'),
    },
  }
}

export async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}
