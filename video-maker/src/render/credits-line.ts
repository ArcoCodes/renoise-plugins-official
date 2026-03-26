/**
 * Credits statusLine renderer.
 * Outputs ANSI-colored text for Claude Code's statusLine display.
 * Follows claude-hud's color pattern (direct ANSI escape sequences).
 */

import type { CreditsData } from '../credits-cache.js'

// ── ANSI Colors ─────────────────────────────────────────────────────────
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const GRAY = '\x1b[90m'

// ── Thresholds ──────────────────────────────────────────────────────────
const THRESHOLD_LOW = 100
const THRESHOLD_CRITICAL = 10

// ── Helpers ─────────────────────────────────────────────────────────────
function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`
}

function formatCredits(n: number): string {
  return n.toLocaleString('en-US')
}

// ── Main Renderer ───────────────────────────────────────────────────────

export interface RenderOptions {
  /** Slash command name for recharge. Default: /myplatform:recharge */
  rechargeCmd?: string
  /** Slash command name for login. Default: /myplatform:login */
  loginCmd?: string
}

/**
 * Render credits display line for statusLine output.
 * Returns a single ANSI-colored string.
 */
export function renderCreditsLine(
  data: CreditsData | null,
  opts: RenderOptions = {},
): string {
  const rechargeCmd = opts.rechargeCmd ?? '/myplatform:recharge'
  const loginCmd = opts.loginCmd ?? '/myplatform:login'

  // No cache / not logged in
  if (!data) {
    return colorize(`🎬 Not logged in — ${loginCmd}`, GRAY)
  }

  const { credits } = data
  const formatted = formatCredits(credits)

  // No credits
  if (credits <= 0) {
    return colorize(`❌ No credits — ${rechargeCmd}`, RED)
  }

  // Critical: < 10
  if (credits < THRESHOLD_CRITICAL) {
    return colorize(`🔴 Credits: ${formatted} — ${rechargeCmd}`, RED)
  }

  // Low: 10-100
  if (credits < THRESHOLD_LOW) {
    return colorize(`⚠️  Credits: ${formatted} — running low`, YELLOW)
  }

  // Normal: > 100
  return colorize(`🎬 Credits: ${formatted}`, GREEN)
}

/**
 * Render a compact credits badge (for embedding in other lines).
 * Example: "[1,250 cr]" in green
 */
export function renderCreditsBadge(data: CreditsData | null): string {
  if (!data) return colorize('[no credits]', GRAY)

  const { credits } = data
  const formatted = formatCredits(credits)

  if (credits <= 0) return colorize(`[0 cr]`, RED)
  if (credits < THRESHOLD_CRITICAL) return colorize(`[${formatted} cr]`, RED)
  if (credits < THRESHOLD_LOW) return colorize(`[${formatted} cr]`, YELLOW)
  return colorize(`[${formatted} cr]`, GREEN)
}
