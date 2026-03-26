/**
 * StatusLine entry point for video-maker plugin.
 * Merges claude-hud output with credits display.
 *
 * Flow: read stdin → fork stdin to claude-hud subprocess → collect its output
 *       → append credits line → print everything to stdout.
 *
 * Manual test:
 *   echo '{}' | npx tsx src/index.ts
 */

import { execSync } from 'child_process'
import { getCredits, refreshFromApi } from './credits-cache.js'
import { renderCreditsLine } from './render/credits-line.js'

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

// ── claude-hud integration ──────────────────────────────────────────────
function findClaudeHudEntry(): string | null {
  const configDir = process.env.CLAUDE_CONFIG_DIR || `${process.env.HOME}/.claude`
  try {
    // Find latest installed claude-hud version directory
    const dirs = execSync(
      `ls -d "${configDir}/plugins/cache/claude-hud/claude-hud/"*/ 2>/dev/null`,
      { encoding: 'utf8', timeout: 2000 },
    ).trim()
    if (!dirs) return null
    // Take the last (latest) version
    const lines = dirs.split('\n').filter(Boolean)
    return `${lines[lines.length - 1]}src/index.ts`
  } catch {
    return null
  }
}

function runClaudeHud(stdinData: string): string {
  const entry = findClaudeHudEntry()
  if (!entry) return ''

  // Detect runtime: prefer bun if available, fallback to node via npx tsx
  const runtime = (() => {
    try {
      return execSync('which bun', { encoding: 'utf8', timeout: 1000 }).trim()
    } catch {
      return null
    }
  })()

  try {
    const cmd = runtime
      ? `"${runtime}" --env-file /dev/null "${entry}"`
      : `npx tsx "${entry}"`

    return execSync(cmd, {
      input: stdinData,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env },
    }).trimEnd()
  } catch {
    return ''
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const stdinData = await readStdinRaw()

  // Run claude-hud with the same stdin data
  const hudOutput = runClaudeHud(stdinData)

  // Get credits from local cache (fast, no network)
  const { data, fresh } = getCredits()

  // If cache is stale or empty, fire async refresh (non-blocking)
  if (!fresh) {
    refreshFromApi().catch(() => {})
  }

  const creditsLine = renderCreditsLine(data)

  // Merge: claude-hud output first, then credits line
  if (hudOutput) {
    console.log(hudOutput)
  }
  console.log(creditsLine)
}

main().catch(() => {
  // statusLine must never crash — silent fail
})
