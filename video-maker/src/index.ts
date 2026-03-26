/**
 * StatusLine entry point for video-maker plugin.
 * If user had a previous statusLine command (e.g. claude-hud), runs it and
 * merges its output with the credits display.
 *
 * Previous statusLine is saved to ~/.renoise/previous-statusline.json during setup.
 *
 * Manual test:
 *   echo '{}' | npx tsx src/index.ts
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { getCredits, refreshFromApi } from './credits-cache.js'
import { renderCreditsLine } from './render/credits-line.js'

const PREVIOUS_STATUSLINE_FILE = path.join(os.homedir(), '.renoise/previous-statusline.json')

// ── Stdin reading ───────────────────────────────────────────────────────
async function readStdinRaw(): Promise<string> {
  if (process.stdin.isTTY) return ''

  const chunks: string[] = []
  try {
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) {
      chunks.push(chunk as string)
    }
  } catch {
    // ignore
  }
  return chunks.join('')
}

// ── Previous statusLine integration ─────────────────────────────────────
function runPreviousStatusLine(stdinData: string): string {
  try {
    const raw = fs.readFileSync(PREVIOUS_STATUSLINE_FILE, 'utf-8')
    const config = JSON.parse(raw) as { command?: string }
    if (!config.command) return ''

    return execSync(config.command, {
      input: stdinData,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env },
      shell: '/bin/bash',
    }).trimEnd()
  } catch {
    return ''
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const stdinData = await readStdinRaw()

  // Run previous statusLine command if configured (e.g. claude-hud)
  const previousOutput = runPreviousStatusLine(stdinData)

  // Get credits from local cache (fast, no network)
  const { data, fresh } = getCredits()

  // If cache is stale or empty, fire async refresh (non-blocking)
  if (!fresh) {
    refreshFromApi().catch(() => {})
  }

  const creditsLine = renderCreditsLine(data)

  // Merge: previous statusLine output first, then credits line
  if (previousOutput) {
    console.log(previousOutput)
  }
  console.log(creditsLine)
}

main().catch(() => {
  // statusLine must never crash — silent fail
})
