#!/usr/bin/env npx tsx
/**
 * Generate an HTML storyboard preview page from a project.json file.
 * Optionally generates reference images for each shot via Gemini.
 *
 * Usage:
 *   npx tsx generate-storyboard-html.ts --project-file <project.json> --output <storyboard.html> [--skip-images]
 */

import fs from 'fs/promises'
import path from 'path'
import { getGeminiClient, ensureDir } from '../../../lib/gemini.js'

interface Character {
  id: string
  name: string
  appearance: string
  wardrobe: string
  signature_details: string
  voice_tone?: string
}

interface StyleGuide {
  visual_style: string
  color_palette: string
  lighting: string
  camera_language: string
  negative_prompts: string
}

interface MusicSection {
  start: number
  end: number
  label: string
}

interface SuggestedCut {
  time: number
  end: number
  duration: number
  section: string
}

interface MusicAnalysis {
  bpm: number
  total_duration_s: number
  beats: number[]
  sections: MusicSection[]
  suggested_cuts: SuggestedCut[]
  file?: string
}

interface Shot {
  shot_id: string
  duration_s: number
  music_section: string
  beat_sync_notes: string
  scene: string
  characters: string[]
  action: string
  camera: string
  dialogue: string
  continuity_out: string
  continuity_in: string | null
  prompt: string
  reference_image?: string
}

interface Project {
  project: { id: string; title: string; total_duration_s: number; ratio: string }
  characters: Character[]
  style_guide: StyleGuide
  music: MusicAnalysis
  shots: Shot[]
}

function parseArgs(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = 'true'
      }
    }
  }
  return flags
}

async function generateReferenceImage(
  shot: Shot,
  characters: Character[],
  styleGuide: StyleGuide,
  outputPath: string,
): Promise<string | null> {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image-preview',
    })

    const charDescriptions = shot.characters
      .map((charId) => {
        const char = characters.find((c) => c.id === charId)
        if (!char) return ''
        return `${char.name}: ${char.appearance}. Wearing ${char.wardrobe}. ${char.signature_details}.`
      })
      .filter(Boolean)
      .join('\n')

    const prompt = `Generate a cinematic storyboard reference image.

Style: ${styleGuide.visual_style}. ${styleGuide.color_palette}. ${styleGuide.lighting}.

Scene: ${shot.scene}

Characters:
${charDescriptions || 'No characters in this shot.'}

Action: ${shot.action}

Requirements:
- Photorealistic, like a film still
- ${shot.duration_s <= 8 ? '16:9 landscape' : '16:9 landscape'} aspect ratio
- Show the key moment of the action
- Match the lighting and color palette exactly
- No text, no watermarks, no UI elements

Avoid: ${styleGuide.negative_prompts}`

    console.log(`[INFO] Generating reference image for ${shot.shot_id}...`)
    const result = await model.generateContent(prompt)
    const response = result.response
    const parts = response.candidates?.[0]?.content?.parts ?? []

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const imgBytes = Buffer.from(part.inlineData.data, 'base64')
        await ensureDir(outputPath)
        await fs.writeFile(outputPath, imgBytes)
        console.log(`[SUCCESS] Reference image saved: ${outputPath}`)
        return part.inlineData.data
      }
    }

    console.warn(`[WARN] No image generated for ${shot.shot_id}`)
    return null
  } catch (err) {
    console.warn(`[WARN] Failed to generate image for ${shot.shot_id}: ${(err as Error).message}`)
    return null
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTimelineHtml(music: MusicAnalysis, shots: Shot[]): string {
  const totalDuration = music.total_duration_s
  const sectionColors: Record<string, string> = {
    intro: '#6366f1',
    buildup: '#6366f1',
    verse: '#3b82f6',
    verse2: '#3b82f6',
    chase: '#3b82f6',
    build: '#f59e0b',
    confrontation: '#f59e0b',
    chorus: '#ef4444',
    chorus2: '#ef4444',
    clash: '#ef4444',
    bridge: '#8b5cf6',
    outro: '#6b7280',
    aftermath: '#6b7280',
  }

  const sectionBars = music.sections
    .map((sec) => {
      const left = (sec.start / totalDuration) * 100
      const width = ((sec.end - sec.start) / totalDuration) * 100
      const color = sectionColors[sec.label] ?? '#94a3b8'
      return `<div class="tl-section" style="left:${left}%;width:${width}%;background:${color}" title="${sec.label} (${sec.start.toFixed(1)}s - ${sec.end.toFixed(1)}s)">
        <span class="tl-label">${sec.label}</span>
      </div>`
    })
    .join('\n')

  const cutMarkers = shots
    .map((shot, i) => {
      if (i === 0) return ''
      const startTime = shots.slice(0, i).reduce((sum, s) => sum + s.duration_s, 0)
      const left = (startTime / totalDuration) * 100
      return `<div class="tl-cut" style="left:${left}%" title="${shot.shot_id} @ ${startTime.toFixed(1)}s">
        <span class="tl-cut-label">${shot.shot_id}</span>
      </div>`
    })
    .join('\n')

  return `
    <div class="timeline">
      <div class="tl-bar">
        ${sectionBars}
        ${cutMarkers}
      </div>
      <div class="tl-times">
        <span>0:00</span>
        <span>${formatTime(totalDuration / 4)}</span>
        <span>${formatTime(totalDuration / 2)}</span>
        <span>${formatTime((totalDuration * 3) / 4)}</span>
        <span>${formatTime(totalDuration)}</span>
      </div>
    </div>`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function buildShotCard(shot: Shot, imageBase64: string | null, index: number, totalShots: number): string {
  const imgHtml = imageBase64
    ? `<img src="data:image/png;base64,${imageBase64}" alt="${shot.shot_id}" class="card-img" />`
    : `<div class="card-img-empty"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Pending</span></div>`

  const continuityIn = shot.continuity_in
    ? `<div class="cont-in"><span class="cont-arrow">&larr;</span> <span class="cont-tag">From</span> ${escapeHtml(shot.continuity_in)}</div>`
    : `<div class="cont-in muted"><span class="cont-tag">Opening Shot</span></div>`

  const continuityOut = shot.continuity_out
    ? `<div class="cont-out"><span class="cont-tag">Into</span> <span class="cont-arrow">&rarr;</span> ${escapeHtml(shot.continuity_out)}</div>`
    : ''

  return `
    <div class="shot-card" id="shot-${shot.shot_id}">
      <div class="card-header">
        <div class="card-badge">${escapeHtml(shot.shot_id)}</div>
        <div class="card-meta">
          <span class="card-dur">${shot.duration_s}s</span>
          <span class="card-sep">/</span>
          <span class="card-section">${escapeHtml(shot.music_section)}</span>
        </div>
        <div class="card-pos">${index + 1} / ${totalShots}</div>
      </div>

      <div class="card-body">
        <div class="card-visual">${imgHtml}</div>
        <div class="card-info">
          <div class="info-block">
            <div class="info-label">Scene</div>
            <div class="info-text">${escapeHtml(shot.scene)}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Action</div>
            <div class="info-text">${escapeHtml(shot.action)}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Camera</div>
            <div class="info-text mono">${escapeHtml(shot.camera)}</div>
          </div>
        </div>
        <div class="card-side">
          <div class="info-block">
            <div class="info-label">SFX / Dialogue</div>
            <div class="info-text dialogue">${escapeHtml(shot.dialogue || '—')}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Beat Sync</div>
            <div class="info-text mono">${escapeHtml(shot.beat_sync_notes || '—')}</div>
          </div>
        </div>
      </div>

      <div class="card-continuity">
        ${continuityIn}
        ${continuityOut}
      </div>

      <details class="card-prompt">
        <summary>View Seedance Prompt</summary>
        <pre class="prompt-code">${escapeHtml(shot.prompt || 'Not yet generated')}</pre>
      </details>
    </div>`
}

function buildHtml(project: Project, imageMap: Map<string, string | null>): string {
  const { project: meta, characters, style_guide, music, shots } = project

  const charCards = characters
    .map((c) => `
      <div class="char-card">
        <div class="char-name">${escapeHtml(c.name)}</div>
        <div class="char-id">${escapeHtml(c.id)}</div>
        <div class="char-desc">${escapeHtml(c.appearance)}</div>
        <div class="char-ward">${escapeHtml(c.wardrobe)}</div>
        <div class="char-sig">${escapeHtml(c.signature_details)}</div>
      </div>`)
    .join('\n')

  const timelineHtml = buildTimelineHtml(music, shots)

  const shotCards = shots
    .map((shot, i) => buildShotCard(shot, imageMap.get(shot.shot_id) ?? null, i, shots.length))
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(meta.title)} — Storyboard Preview</title>
<style>
  :root {
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-2: #f7f7f8;
    --surface-3: #f0f0f2;
    --border: #e4e4e7;
    --border-light: #f0f0f2;
    --text-1: #09090b;
    --text-2: #3f3f46;
    --text-3: #a1a1aa;
    --accent: #18181b;
    --accent-inv: #ffffff;
    --blue: #2563eb;
    --blue-light: #eff6ff;
    --green: #15803d;
    --green-bg: #f0fdf4;
    --orange: #c2410c;
    --orange-bg: #fff7ed;
    --purple: #7c3aed;
    --radius: 12px;
    --radius-sm: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-lg: 0 10px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
    background: var(--bg); color: var(--text-1);
    line-height: 1.6; -webkit-font-smoothing: antialiased;
  }

  .page { max-width: 1080px; margin: 0 auto; padding: 48px 24px 80px; }

  /* ---- Header ---- */
  .page-header {
    margin-bottom: 40px;
    padding-bottom: 32px;
    border-bottom: 2px solid var(--accent);
  }
  .page-title {
    font-size: 36px; font-weight: 800; letter-spacing: -0.03em;
    color: var(--text-1); line-height: 1.1;
  }
  .page-subtitle {
    font-size: 15px; color: var(--text-3); margin-top: 6px;
    font-weight: 500; letter-spacing: 0.02em;
  }

  .stats {
    display: flex; gap: 6px; margin-top: 24px; flex-wrap: wrap;
  }
  .stat {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--accent); color: var(--accent-inv);
    border-radius: 100px; padding: 7px 16px;
    font-size: 13px; font-weight: 500;
  }
  .stat-val { font-weight: 700; font-size: 14px; }

  /* ---- Expandable panels ---- */
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 12px;
  }
  .panel > summary {
    padding: 16px 20px; font-size: 14px; font-weight: 700;
    color: var(--text-1); cursor: pointer; list-style: none;
    display: flex; align-items: center; gap: 10px;
    user-select: none; letter-spacing: -0.01em;
  }
  .panel > summary::-webkit-details-marker { display: none; }
  .panel > summary::after {
    content: "+"; margin-left: auto;
    font-size: 18px; font-weight: 400; color: var(--text-3);
    transition: transform 0.15s;
  }
  .panel[open] > summary::after { content: "\\2212"; }
  .panel-body { padding: 0 20px 20px; }

  /* Characters */
  .char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  .char-card {
    background: var(--surface-2); border-radius: var(--radius-sm); padding: 16px;
    font-size: 13px; line-height: 1.6; border: 1px solid var(--border-light);
  }
  .char-name { font-weight: 800; font-size: 16px; color: var(--text-1); letter-spacing: -0.01em; }
  .char-id { font-size: 11px; color: var(--text-3); font-family: "SF Mono", monospace; margin-bottom: 10px; }
  .char-desc { color: var(--text-2); margin-bottom: 6px; }
  .char-ward { color: var(--text-2); margin-bottom: 6px; padding-left: 10px; border-left: 2px solid var(--border); }
  .char-sig { color: var(--purple); font-size: 12px; font-weight: 600; }

  /* Style guide */
  .style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .style-item { background: var(--surface-2); border-radius: var(--radius-sm); padding: 14px; border: 1px solid var(--border-light); }
  .style-key { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-3); letter-spacing: 0.08em; margin-bottom: 6px; }
  .style-val { font-size: 13px; color: var(--text-2); line-height: 1.55; }

  /* ---- Timeline ---- */
  .tl-wrap {
    background: var(--surface-2);
    border-radius: var(--radius); padding: 20px 20px 16px;
    margin-bottom: 32px;
  }
  .tl-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-3); letter-spacing: 0.08em; margin-bottom: 14px; }
  .timeline { position: relative; }
  .tl-bar {
    position: relative; height: 44px; background: var(--surface);
    border-radius: var(--radius-sm); overflow: visible;
    border: 1px solid var(--border);
  }
  .tl-section {
    position: absolute; top: 0; height: 100%; display: flex;
    align-items: center; justify-content: center;
    opacity: 0.9; transition: opacity 0.15s;
  }
  .tl-section:first-child { border-top-left-radius: 7px; border-bottom-left-radius: 7px; }
  .tl-section:last-of-type { border-top-right-radius: 7px; border-bottom-right-radius: 7px; }
  .tl-section:hover { opacity: 1; }
  .tl-label { font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.4); letter-spacing: 0.02em; }
  .tl-cut {
    position: absolute; top: -8px; width: 0; height: calc(100% + 16px);
    border-left: 2px solid var(--text-1); z-index: 2;
  }
  .tl-cut-label {
    position: absolute; top: -22px; left: -12px;
    font-size: 10px; font-weight: 700; color: var(--text-1);
    background: var(--surface-2); padding: 1px 5px; border-radius: 4px;
  }
  .tl-times {
    display: flex; justify-content: space-between;
    font-size: 11px; color: var(--text-3); padding: 8px 2px 0;
    font-variant-numeric: tabular-nums; font-weight: 500;
  }

  /* ---- Shot Cards ---- */
  .shots-header {
    display: flex; align-items: baseline; gap: 12px;
    margin-bottom: 20px;
  }
  .shots-title {
    font-size: 22px; font-weight: 800; color: var(--text-1);
    letter-spacing: -0.02em;
  }
  .shots-count { font-size: 14px; color: var(--text-3); font-weight: 500; }

  .shot-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 20px;
    box-shadow: var(--shadow);
    overflow: hidden;
    transition: box-shadow 0.2s;
  }
  .shot-card:hover { box-shadow: var(--shadow-lg); }

  .card-header {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 20px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .card-badge {
    background: var(--accent); color: var(--accent-inv);
    font-size: 14px; font-weight: 800; padding: 3px 14px;
    border-radius: 6px; letter-spacing: 0.02em;
  }
  .card-meta { font-size: 14px; color: var(--text-2); display: flex; align-items: center; gap: 8px; }
  .card-dur { font-weight: 800; color: var(--text-1); font-size: 15px; }
  .card-sep { color: var(--border); }
  .card-section { color: var(--text-3); font-weight: 500; }
  .card-pos { margin-left: auto; font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; font-weight: 600; }

  .card-body {
    display: grid; grid-template-columns: 220px 1fr 280px;
    gap: 0;
  }

  .card-visual {
    padding: 20px;
    display: flex; align-items: flex-start; justify-content: center;
    border-right: 1px solid var(--border-light);
    background: var(--surface-2);
  }
  .card-img {
    width: 100%; height: auto; border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
  }
  .card-img-empty {
    width: 180px; height: 102px; background: var(--surface);
    border: 2px dashed var(--border); border-radius: var(--radius-sm);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; color: var(--text-3); font-size: 12px; font-weight: 500;
  }
  .card-img-empty svg { opacity: 0.3; }

  .card-info {
    padding: 20px; border-right: 1px solid var(--border-light);
    display: flex; flex-direction: column; gap: 14px;
  }

  .card-side {
    padding: 20px;
    display: flex; flex-direction: column; gap: 14px;
  }

  .info-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 4px;
  }
  .info-text { font-size: 13px; color: var(--text-2); line-height: 1.6; }
  .info-text.mono {
    font-family: "SF Mono", "Fira Code", monospace; font-size: 12px;
    background: var(--surface-2); padding: 8px 10px; border-radius: 6px;
    line-height: 1.7; border: 1px solid var(--border-light);
  }
  .info-text.dialogue { color: var(--purple); font-weight: 500; }

  /* Continuity bar */
  .card-continuity {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    border-top: 1px solid var(--border);
    font-size: 12px; line-height: 1.55;
  }
  .cont-in, .cont-out { padding: 12px 20px; color: var(--text-2); }
  .cont-out { border-left: 1px solid var(--border); }
  .cont-tag {
    display: inline-block; font-size: 10px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 8px; border-radius: 4px; margin-bottom: 4px;
  }
  .cont-in .cont-tag { background: var(--green-bg); color: var(--green); }
  .cont-out .cont-tag { background: var(--orange-bg); color: var(--orange); }
  .cont-arrow { font-weight: 700; }
  .cont-in.muted { color: var(--text-3); }
  .cont-in.muted .cont-tag { background: var(--surface-2); color: var(--text-3); }

  /* Prompt expandable */
  .card-prompt { border-top: 1px solid var(--border); }
  .card-prompt > summary {
    padding: 12px 20px; font-size: 13px; font-weight: 700;
    color: var(--blue); cursor: pointer; list-style: none;
    display: flex; align-items: center; gap: 8px; user-select: none;
    transition: background 0.1s;
  }
  .card-prompt > summary::-webkit-details-marker { display: none; }
  .card-prompt > summary::before { content: "\\25B6"; font-size: 9px; transition: transform 0.15s; }
  .card-prompt[open] > summary::before { transform: rotate(90deg); }
  .card-prompt > summary:hover { background: var(--blue-light); }
  .prompt-code {
    margin: 0 20px 16px; padding: 16px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius-sm); font-size: 12px; line-height: 1.7;
    font-family: "SF Mono", "Fira Code", monospace;
    white-space: pre-wrap; word-break: break-word;
    max-height: 360px; overflow-y: auto; color: var(--text-2);
  }

  /* ---- Footer ---- */
  .page-footer {
    text-align: center; padding: 40px 0 0;
    font-size: 12px; color: var(--text-3); font-weight: 500;
  }

  /* ---- Responsive ---- */
  @media (max-width: 900px) {
    .card-body { grid-template-columns: 1fr; }
    .card-visual { border-right: none; border-bottom: 1px solid var(--border-light); }
    .card-info { border-right: none; border-bottom: 1px solid var(--border-light); }
    .card-img-empty, .card-img { width: 200px; }
    .card-continuity { grid-template-columns: 1fr; }
    .cont-out { border-left: none; border-top: 1px solid var(--border); }
  }
  @media (max-width: 480px) {
    .page { padding: 20px 14px 40px; }
    .page-title { font-size: 26px; }
    .stats { gap: 4px; }
    .stat { padding: 5px 12px; font-size: 12px; }
  }
</style>
</head>
<body>

<div class="page">
  <header class="page-header">
    <h1 class="page-title">${escapeHtml(meta.title)}</h1>
    <p class="page-subtitle">Storyboard Preview</p>
    <div class="stats">
      <div class="stat">Duration <span class="stat-val">${formatTime(meta.total_duration_s)}</span></div>
      <div class="stat">Clips <span class="stat-val">${shots.length}</span></div>
      ${music.bpm ? `<div class="stat">BPM <span class="stat-val">${music.bpm}</span></div>` : ''}
      <div class="stat">Ratio <span class="stat-val">${escapeHtml(meta.ratio)}</span></div>
    </div>
  </header>

  <details class="panel" open>
    <summary>Characters</summary>
    <div class="panel-body">
      <div class="char-grid">${charCards || '<p style="color:var(--text-3)">No characters defined</p>'}</div>
    </div>
  </details>

  <details class="panel">
    <summary>Style Guide</summary>
    <div class="panel-body">
      <div class="style-grid">
        <div class="style-item"><div class="style-key">Visual Style</div><div class="style-val">${escapeHtml(style_guide.visual_style)}</div></div>
        <div class="style-item"><div class="style-key">Color Palette</div><div class="style-val">${escapeHtml(style_guide.color_palette)}</div></div>
        <div class="style-item"><div class="style-key">Lighting</div><div class="style-val">${escapeHtml(style_guide.lighting)}</div></div>
        <div class="style-item"><div class="style-key">Camera Language</div><div class="style-val">${escapeHtml(style_guide.camera_language)}</div></div>
        <div class="style-item"><div class="style-key">Negative Prompts</div><div class="style-val">${escapeHtml(style_guide.negative_prompts)}</div></div>
      </div>
    </div>
  </details>

  <div class="tl-wrap">
    <div class="tl-title">Timeline</div>
    ${timelineHtml}
  </div>

  <div class="shots-header">
    <div class="shots-title">Shot Details</div>
    <div class="shots-count">${shots.length} clips / ${meta.total_duration_s}s</div>
  </div>
  ${shotCards}

  <footer class="page-footer">
    short-film-editor
  </footer>
</div>

</body>
</html>`
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  const projectFile = flags['project-file']
  const outputPath = flags['output']
  const skipImages = flags['skip-images'] === 'true'

  if (!projectFile || !outputPath) {
    console.error('Usage: generate-storyboard-html.ts --project-file <project.json> --output <storyboard.html> [--skip-images]')
    process.exit(1)
  }

  const raw = await fs.readFile(projectFile, 'utf-8')
  const project: Project = JSON.parse(raw)

  // Generate reference images for each shot
  const imageMap = new Map<string, string | null>()
  const storyboardDir = path.join(path.dirname(projectFile), 'storyboard')

  for (const shot of project.shots) {
    if (skipImages) {
      // Check if image already exists on disk
      const imgPath = path.join(storyboardDir, `${shot.shot_id}.png`)
      try {
        const imgData = await fs.readFile(imgPath)
        imageMap.set(shot.shot_id, imgData.toString('base64'))
        console.log(`[INFO] Using existing image for ${shot.shot_id}`)
      } catch {
        imageMap.set(shot.shot_id, null)
      }
    } else if (shot.reference_image) {
      // Use pre-existing base64
      imageMap.set(shot.shot_id, shot.reference_image)
    } else {
      // Generate via Gemini
      const imgPath = path.join(storyboardDir, `${shot.shot_id}.png`)
      const base64 = await generateReferenceImage(
        shot,
        project.characters,
        project.style_guide,
        imgPath,
      )
      imageMap.set(shot.shot_id, base64)
    }
  }

  // Build and write HTML
  const html = buildHtml(project, imageMap)
  await ensureDir(outputPath)
  await fs.writeFile(outputPath, html, 'utf-8')

  const sizeKb = (await fs.stat(outputPath)).size / 1024
  console.log(`[SUCCESS] Storyboard saved to ${outputPath} (${sizeKb.toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('[ERROR]', err.message)
  process.exit(1)
})
