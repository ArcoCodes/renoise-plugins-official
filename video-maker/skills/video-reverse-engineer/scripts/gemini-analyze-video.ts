#!/usr/bin/env npx tsx
/**
 * Gemini video analysis script.
 * Analyzes a video file using Gemini's reverse storyboard prompt.
 *
 * Usage: npx tsx gemini-analyze-video.ts <video_path> [--output <path>] [--model <model>]
 */

import fs from 'fs/promises'
import path from 'path'
import { getGeminiClient, getMimeType, ensureDir } from '../../../lib/gemini.js'

const STEP1_SYSTEM_PROMPT = `你是"短视频分镜逆向工程师（Reverse Storyboard Engineer）"。
请对我上传的{目标语言自动识别}带货视频做：逐句转写+逐句翻译+按分镜头（Shot）拆解+画面内容描述（非生成提示词）+声音描述+约束与合规标注。
严格输出为Markdown表格，不得省略任何字段，不得把某一列拆成单独列表，不得改写原台词。`

const STEP1_USER_PROMPT = `========================
一、核心目标（必须同时完成）

1）输出"逐句脚本证据表"（每行一句台词，带时间轴与逐句中文翻译）
2）输出"分镜头逆向主表"（每行一个Shot，覆盖整条视频，不漏秒不重复）
3）分镜头主表必须包含：画幅/视频类型/人物/商品/约束条件/反向约束/氛围光线/情绪/动作/表达风格/语言/台词映射/字幕与贴纸/剪辑等维度
4）不使用"≤8秒分段"约束：以真实剪辑切点/画面变化/机位变化/任务切换为准
5）本步骤不输出"可直接用于生成视频的提示词"，只输出"画面内容描述"。

========================
时长锁定 Time Lock
从视频读取全片真实总时长 T（秒），后续所有时间戳必须满足：0 <= start < end <= T。
Shot表必须覆盖 [0, T]，最后Shot的 end_sec 必须等于 T。

========================
二、输出0：全片统一设定卡
primary_language, aspect_ratio, video_type, platform_hint, total_duration_sec,
overall_tone, energy_level, speaking_style, emotion_curve,
color_tone, lighting_style, atmosphere_keywords, bgm_style, sfx_density,
forbidden_claims_risk, must_disclose

========================
三、输出1：逐句脚本证据表
| id | start_sec | end_sec | duration_sec | original_text | zh_translation | on_screen_text_seen | key_info_notes | clarity_notes |

========================
四、输出2：分镜头逆向主表（39列）
| shot_id | start_sec | end_sec | duration_sec | scene_group_id | scene_title_cn | shot_title_cn | shot_goal | aspect_ratio | video_type_tag | visual_content_description | location_setting | character_desc | emotion_state | action_blocking | product_desc | must_show | on_screen_text_graphics | camera_shot_size | camera_angle | camera_movement | composition_notes | lighting_atmosphere | color_grading | dialogue_vo_original | dialogue_vo_zh | language_style | emphasis_notes | audio_bgm | audio_sfx | ambient_sound | editing_transition | pacing_notes | constraints_real_shoot | constraints_compliance | reverse_constraints | assets_needed | sentence_mapping | mapping_notes |

========================
五、输出3：自检清单
覆盖检查、忠实度检查、翻译一致性、映射一致性、关键信息与约束检查。`

function parseArgs() {
  const args = process.argv.slice(2)
  let videoPath = ''
  let output = ''
  let model = 'gemini-2.5-pro'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      output = args[++i]
    } else if (args[i] === '--model' || args[i] === '-m') {
      model = args[++i]
    } else if (!args[i].startsWith('-')) {
      videoPath = args[i]
    }
  }

  return { videoPath, output, model }
}

async function main() {
  const { videoPath, output, model } = parseArgs()
  if (!videoPath) {
    console.error('Usage: gemini-analyze-video.ts <video_path> [--output <path>] [--model <model>]')
    process.exit(1)
  }

  const resolvedPath = path.resolve(videoPath)
  const stat = await fs.stat(resolvedPath)
  const fileSizeMb = stat.size / (1024 * 1024)

  console.log(`[INFO] Video: ${path.basename(resolvedPath)} (${fileSizeMb.toFixed(1)} MB)`)
  console.log(`[INFO] Model: ${model}`)

  const genAI = getGeminiClient()
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: STEP1_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 65536,
    },
  })

  // Read video as inline data (works for files up to ~20MB with the API)
  const videoBytes = await fs.readFile(resolvedPath)
  const mimeType = getMimeType(resolvedPath)

  console.log('[INFO] Sending video to Gemini for analysis...')

  const result = await genModel.generateContent([
    {
      inlineData: {
        mimeType,
        data: videoBytes.toString('base64'),
      },
    },
    { text: STEP1_USER_PROMPT },
  ])

  const text = result.response.text()

  const outputPath = output || path.join(path.dirname(resolvedPath), `${path.parse(resolvedPath).name}_analysis.md`)
  await ensureDir(outputPath)
  await fs.writeFile(outputPath, text, 'utf-8')

  console.log(`\n[SUCCESS] Analysis saved: ${outputPath}`)
  console.log(`[INFO] File size: ${((await fs.stat(outputPath)).size / 1024).toFixed(1)} KB`)

  // Write metadata
  const meta = {
    video_file: resolvedPath,
    model,
    output_file: outputPath,
    file_size_mb: Math.round(fileSizeMb * 10) / 10,
    analysis_length_chars: text.length,
  }
  const metaPath = outputPath.replace(/\.md$/, '.meta.json')
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

main().catch((err) => {
  console.error('[ERROR]', err.message)
  process.exit(1)
})
