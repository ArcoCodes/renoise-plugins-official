#!/usr/bin/env npx tsx
/**
 * Azure TTS speech synthesis script.
 * Usage: npx tsx tts.ts -t "text" [-v voice] [-o output.mp3] [-f format] [-r rate] [--pitch pitch] [-s style]
 *        npx tsx tts.ts -l [--lang zh] [--search keyword]
 */

const AZURE_ENDPOINT = process.env.AZURE_TTS_ENDPOINT ?? 'https://youware-ai-6-resource.cognitiveservices.azure.com'
const AZURE_KEY = process.env.AZURE_TTS_KEY ?? ''

if (!AZURE_KEY) {
  console.error('ERROR: AZURE_TTS_KEY not set in environment')
  process.exit(1)
}

import fs from 'fs/promises'
import path from 'path'

interface Args {
  text: string
  voice: string
  output: string
  format: string
  rate: string
  pitch: string
  style: string
  listVoices: boolean
  lang: string
  search: string
  quiet: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const result: Args = {
    text: '', voice: 'zh-CN-XiaoxiaoNeural', output: './tts_output.mp3',
    format: 'mp3', rate: '+0%', pitch: '+0%', style: '',
    listVoices: false, lang: '', search: '', quiet: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-t': case '--text': result.text = args[++i]; break
      case '-v': case '--voice': result.voice = args[++i]; break
      case '-o': case '--output': result.output = args[++i]; break
      case '-f': case '--format': result.format = args[++i]; break
      case '-r': case '--rate': result.rate = args[++i]; break
      case '--pitch': result.pitch = args[++i]; break
      case '-s': case '--style': result.style = args[++i]; break
      case '-l': case '--list-voices': result.listVoices = true; break
      case '--lang': result.lang = args[++i]; break
      case '--search': result.search = args[++i]; break
      case '-q': case '--quiet': result.quiet = true; break
    }
  }
  return result
}

function getOutputFormat(fmt: string): string {
  const map: Record<string, string> = {
    'mp3': 'audio-16khz-128kbitrate-mono-mp3',
    'mp3-hd': 'audio-48khz-192kbitrate-mono-mp3',
    'wav': 'riff-24khz-16bit-mono-pcm',
    'wav-hd': 'riff-48khz-16bit-mono-pcm',
  }
  return map[fmt] ?? ''
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildSsml(text: string, voice: string, rate: string, pitch: string, style: string): string {
  const lang = voice.split('-').slice(0, 2).join('-')
  const escaped = xmlEscape(text)
  const inner = style
    ? `<mstts:express-as style="${style}">${escaped}</mstts:express-as>`
    : escaped

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}" pitch="${pitch}">${inner}</prosody></voice></speak>`
}

async function synthesize(args: Args) {
  const azureFormat = getOutputFormat(args.format)
  if (!azureFormat) {
    console.error(`Unsupported format: ${args.format}. Use: mp3|mp3-hd|wav|wav-hd`)
    process.exit(1)
  }

  let text = args.text
  if (text.startsWith('@')) {
    text = await fs.readFile(text.slice(1), 'utf-8')
  }

  const ssml = buildSsml(text, args.voice, args.rate, args.pitch, args.style)

  if (!args.quiet) console.error(`Voice: ${args.voice}\nFormat: ${args.format}\nSynthesizing...`)

  await fs.mkdir(path.dirname(args.output), { recursive: true })

  const response = await fetch(`${AZURE_ENDPOINT}/tts/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': azureFormat,
      'User-Agent': 'visiono-tts',
    },
    body: ssml,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.log(JSON.stringify({ success: false, error: `Azure TTS HTTP ${response.status}: ${errorBody}` }))
    process.exit(1)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(args.output, buffer)

  const size = buffer.length
  let duration = 0
  if (args.format === 'mp3') duration = (size * 8) / 128000
  else if (args.format === 'mp3-hd') duration = (size * 8) / 192000
  else if (args.format === 'wav') duration = size / (24000 * 2)
  else if (args.format === 'wav-hd') duration = size / (48000 * 2)

  if (args.quiet) {
    console.log(args.output)
  } else {
    console.log(JSON.stringify({
      success: true,
      output_path: args.output,
      voice: args.voice,
      format: args.format,
      size_bytes: size,
      duration_estimate_seconds: Math.round(duration * 10) / 10,
    }, null, 2))
  }
}

async function listVoices(lang: string, search: string) {
  const response = await fetch(`${AZURE_ENDPOINT}/tts/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
  })

  if (!response.ok) {
    console.error('Failed to fetch voice list')
    process.exit(1)
  }

  let voices = (await response.json()) as Array<Record<string, unknown>>

  if (lang) {
    voices = voices.filter((v) => (v.Locale as string).toLowerCase().startsWith(lang.toLowerCase()))
  }
  if (search) {
    const s = search.toLowerCase()
    voices = voices.filter((v) => {
      const searchable = [v.ShortName, v.DisplayName, v.LocaleName].join(' ').toLowerCase()
      return searchable.includes(s)
    })
  }

  voices.sort((a, b) => (a.Locale as string).localeCompare(b.Locale as string))

  console.log(`${'ShortName'.padEnd(50)} ${'Gender'.padEnd(8)} Locale`)
  console.log('-'.repeat(100))
  for (const v of voices) {
    console.log(`${(v.ShortName as string).padEnd(50)} ${(v.Gender as string).padEnd(8)} ${v.LocaleName}`)
  }
  console.log(`\nTotal: ${voices.length} voices`)
}

async function main() {
  const args = parseArgs()

  if (args.listVoices || (!args.text && (args.lang || args.search))) {
    await listVoices(args.lang, args.search)
  } else if (!args.text) {
    console.error('Error: --text is required. Use -t "text" or -l to list voices.')
    process.exit(1)
  } else {
    await synthesize(args)
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
