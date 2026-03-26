/**
 * Credits cache module.
 * Reads/writes ~/.renoise/credits-cache.json with TTL-based expiry.
 * statusLine calls this every ~300ms — must be fast (local file only).
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

const CACHE_DIR = path.join(os.homedir(), '.renoise')
const CACHE_FILE = path.join(CACHE_DIR, 'credits-cache.json')
const DEFAULT_TTL_MS = 30_000 // 30 seconds

export interface CreditsData {
  credits: number
  plan: string
  updated_at: number // Unix timestamp in ms
}

/**
 * Read credits from local cache file.
 * Returns null if file doesn't exist or is malformed.
 */
export function readCache(): CreditsData | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8')
    const data = JSON.parse(raw) as CreditsData
    if (typeof data.credits !== 'number' || typeof data.updated_at !== 'number') {
      return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * Check if cached data is still fresh (within TTL).
 */
export function isCacheFresh(data: CreditsData, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - data.updated_at < ttlMs
}

/**
 * Write credits data to cache file.
 * Called by skills after API responses, or by async refresh.
 */
export function writeCache(credits: number, plan: string): void {
  const data: CreditsData = {
    credits,
    plan,
    updated_at: Date.now(),
  }
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // Silent fail — statusLine must never crash
  }
}

/**
 * Get credits for display. Returns cached data (possibly stale) or null.
 * Never blocks on network — that's the caller's job if refresh is needed.
 */
export function getCredits(): { data: CreditsData | null; fresh: boolean } {
  const data = readCache()
  if (!data) return { data: null, fresh: false }
  return { data, fresh: isCacheFresh(data) }
}

/**
 * Fetch real balance from Renoise API and update cache.
 * Uses RENOISE_API_KEY env var. Non-blocking — fire and forget.
 */
export async function refreshFromApi(): Promise<void> {
  const apiKey = process.env.RENOISE_API_KEY
  if (!apiKey) return

  const baseUrl = process.env.RENOISE_BASE_URL || 'https://www.renoise.ai/api/public/v1'
  const headers: Record<string, string> = { 'X-API-Key': apiKey }

  const res = await fetch(`${baseUrl}/me`, { headers, signal: AbortSignal.timeout(5000) })
  if (!res.ok) return

  const json = await res.json() as { credit?: { balance?: number } }
  const balance = json?.credit?.balance
  if (typeof balance === 'number') {
    writeCache(balance, 'renoise')
  }
}
