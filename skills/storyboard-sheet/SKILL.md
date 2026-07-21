---
name: storyboard-sheet
description: >
  Convert novels, scripts, outlines, or episode beats into short-drama-friendly
  storyboard outputs. Use for 分镜, 短剧改编分镜, storyboard sheets, shot lists,
  image prompts, and video-generation planning. Supports two modes: episode-level
  storyboard sheet for review, or shot-by-shot images/prompts for video generation.
allowed-tools: Bash, Read, Write
metadata:
  author: renoise
  version: 0.2.0
  category: video-production
  tags: [storyboard, short-drama, script-adaptation, novel-adaptation, image-generation, video-generation, renoise]
---

# Storyboard Sheet / Short Drama Board

Purpose: turn source text into **usable visual planning for short drama and AI video generation**.

Do not paste raw novel/script text into image prompts. First adapt it into visual beats.

Core pipeline:

```text
source → adaptation bible → episode beats → shot list / sheet plan → references → prompts → generation → QA → targeted rerun
```

---

## 1. First Ask: What Output?

If unclear, ask once:

```text
你要哪种输出？
A. 每集一张 storyboard sheet，用于预览/审稿
B. 每个 shot 单独一张图，用于后续视频生成
C. 两者都要：先 sheet 审稿，再拆 shot 图和视频 prompt
```

Default for short-drama/video work: **B or C**, not only sheet.

### Modes

#### A. Storyboard Sheet / 审稿预览

```text
one episode = one image containing multiple panels
```

Good for: pitch, visual overview, client review, director preview.
Not ideal as direct video-model input.

Default:

```text
panels: 6
layout: 2×3
ratio: 16:9 unless user wants vertical short drama
text: only tiny P1-P6 labels
```

#### B. Shot-by-shot / 视频生成

```text
one shot = one image + one video prompt
```

Good for: AI video generation, first-frame workflow, precise continuity.

Default for short drama:

```text
ratio: 9:16
shots per 60-90s episode: 8-12
style: vertical mobile drama, close-up heavy, emotion readable
```

---

## 2. Short Drama Adaptation Rules

Before prompts, convert prose into playable screen action.

### Extract adaptation bible

Save or maintain:

```text
- title / genre
- main characters and relationships
- protagonist desire
- core conflict engine
- must-keep plot points
- secrets / reveals / reversals
- recurring locations
- visual motifs
- continuity constraints: age, wardrobe, injuries, props, money, rules
```

### Rewrite for short-drama rhythm

Each episode should usually have:

```text
opening hook → setup → conflict → escalation → reversal/reveal → cliffhanger
```

Rules:

- Internal thought → visible action, prop, expression, or dialogue.
- Long exposition → conflict scene or reaction beat.
- One beat should be visually clear in one shot/panel.
- Keep the first 3 seconds strong.
- End each episode with a hook, reversal, danger, or emotional question.
- Prefer faces, reactions, hands, phones, doors, documents, money, wounds, and reveals over abstract narration.

---

## 3. Character and Scene References

Before any paid generation, verify `renoise` with `command -v renoise` on macOS/Linux or `Get-Command renoise` on Windows PowerShell, then run `renoise help generate run`, `renoise auth status --json`, and `renoise model --json`. If a check fails, stop and direct the user to **Setup / Account**; never install software or edit `PATH` without explicit approval.

If a character appears more than once, create/register a reference first. Do not rely on text descriptions alone.

Character ref prompt:

```text
角色设定图，干净背景，现实主义竖屏短剧风格。
[角色名]，[年龄]，[身份]，[体型]，[发型]，[五官/气质]。
固定服装：[服装]。
包含正面全身、半身近景、侧面小头像，必须像同一个人。
不要水印，不要多余文字，不要夸张动漫风。
```

For recurring locations, create scene refs only when needed. Too many references can confuse layout/identity.

Select an image model from `renoise model --json`, inspect it, then use only advertised parameters:

```bash
renoise generate run <selected-image-model> \
  --prompt "$PROMPT" \
  --tags "<project>,character-ref,<character>" --json
```

Upload useful references to the Renoise material pool, keep the returned material ID, and pass it directly:

```bash
renoise upload /path/to/reference.png --json
```

Assign the returned ID through a material role advertised by the selected generation model. The deprecated `asset:` prefix must not be used.

---

## 4. Output Templates

### A. Episode Sheet Plan

Use this when user wants one image per episode:

```json
{
  "episode": 1,
  "title": "...",
  "hook": "...",
  "panels": [
    {"panel": "P1", "beat": "opening hook", "visual": "..."},
    {"panel": "P2", "beat": "setup", "visual": "..."},
    {"panel": "P3", "beat": "conflict", "visual": "..."},
    {"panel": "P4", "beat": "escalation", "visual": "..."},
    {"panel": "P5", "beat": "reveal/reversal", "visual": "..."},
    {"panel": "P6", "beat": "cliffhanger", "visual": "..."}
  ]
}
```

Sheet prompt:

```text
一张完整的电影分镜 storyboard sheet，严格 2行3列，共6个清晰 panel，黑色细边框。
现实主义短剧风格，角色与参考图一致，服装/年龄/发型不变。
不要水印，不要长文字，只允许很小的 P1-P6 编号。

第[N]集《[标题]》：
P1 ...
P2 ...
P3 ...
P4 ...
P5 ...
P6 ...
```

### B. Shot List for Video Generation

Use this for real video workflow:

```json
{
  "episode": 1,
  "title": "...",
  "shots": [
    {
      "shot": "EP01_SH01",
      "duration": "4s",
      "framing": "tight close-up / medium / over-shoulder / insert",
      "visual": "what we see",
      "action": "one clear action only",
      "emotion": "specific readable emotion",
      "camera": "simple camera move or static",
      "image_prompt": "first-frame image prompt",
      "video_prompt": "motion prompt for video model"
    }
  ]
}
```

Video-friendly prompt rules:

- One shot = one action.
- Avoid time jumps inside one shot.
- Avoid complex crowd/blocking unless necessary.
- Use simple camera language: static, slow push-in, handheld slight shake, over-shoulder.
- Keep text/UI minimal; exact numbers often fail.
- Generate first frames individually, not from a multi-panel sheet.

---

## 5. Recommended Directory Layout

Keep it simple:

```text
<project>_storyboard/
  adaptation_bible.md
  episode_beats.jsonl
  shot_list.jsonl
  prompts/
    character_refs.jsonl
    sheets.jsonl
    shots.jsonl
    reruns.jsonl
  assets/
  sheets/
  shots/
  logs/
```

Do not overwrite reruns. Use `_v2`, `_v3`.

---

## 6. QA Checklist

After generation, compare against source/adaptation bible.

### Story QA

```text
[ ] hook is strong enough
[ ] episode order is correct
[ ] no false plot events
[ ] reveal/cliffhanger matches adaptation
[ ] internal monologue became visible action
```

### Visual QA

```text
[ ] correct characters, age, wardrobe
[ ] consistent face/hair/body
[ ] correct location/time/props
[ ] layout correct if sheet
[ ] shot is usable as first frame if video workflow
[ ] no harmful/confusing generated text
```

Give direct result:

```text
Keep: EP01, EP02
Rerun: EP03_SH04 - character age drifted; EP04 sheet - layout became poster
```

---

## 7. Rerun Strategy

Rerun only failed sheets/shots unless the whole visual system is wrong.

Patch the prompt with:

```text
- what failed last time
- stricter age/identity/wardrobe constraint
- stricter layout or shot constraint
- same reference assets
```

Examples:

```text
角色必须是22岁普通学生，不是中年老板，不是黑帮，不是成熟总裁。
```

```text
严格生成单个竖屏 9:16 首帧，不要分格，不要海报，不要文字。
```

```text
严格生成 storyboard sheet：2行3列，6个 panel，黑色边框，不要单张海报。
```

---

## 8. User-Facing Summary

When explaining, keep it short:

```text
我会先把原文改成短剧节奏：开场钩子、冲突升级、反转和集尾悬念。
如果是审稿，我做每集一张 storyboard sheet；如果要生成视频，我会拆成逐 shot 的首帧图 prompt 和视频 prompt，并用角色 reference 保持一致。
```
