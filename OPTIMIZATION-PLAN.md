# Video Maker Plugin 优化计划

## 目标

从当前 9 个碎片化 skill、多次手动确认、素材手动管理的状态，优化为 4 个职责清晰的 skill、最少确认步骤、素材自动关联的流畅体验。

## 现状总览

```
9 skills / 5366 行代码+文档
├── director (269行)         — 入口+路由，4 Phase，多次确认等待
├── tiktok-content-maker (140行) — 电商短视频，依赖 gemini-gen 分析
├── short-film-editor (478行)    — 短片制作，6 Phase，最重的工作流
├── renoise-gen (364行)          — 核心生成引擎 + CLI (723行)
├── gemini-gen (236行)           — 视觉分析 + 脚本 (220行)
├── product-sheet-generate (75行) — renoise-gen 的薄包装
├── scene-generate (52行)        — renoise-gen 的薄包装
├── file-upload (79行)           — gemini-gen 的前置步骤
└── video-download (161行)       — 独立下载工具
```

**核心痛点**: 素材手动上传+手动关联、确认门过多、skill 间路由繁琐、重复内容多

---

## Phase 1: 基础设施 — Material Pool

> 所有后续工作流优化都依赖这个基础能力，必须先做。

### 1.1 `material ingest` 命令

给 `renoise-cli.mjs` 新增 `material ingest` 子命令。

**输入**: 文件路径或目录
```bash
node renoise-cli.mjs material ingest ./materials/
node renoise-cli.mjs material ingest product.jpg scene.jpg ref.mp4
```

**处理流程**:
1. 扫描输入路径，收集所有图片/视频文件
2. 批量上传到 Renoise，收集 material IDs
3. 对每个文件调 Gemini 分析（并行），提取：
   - `type`: product / scene / character-ref / mood-board / reference-video / other
   - `tags`: 关键词标签（front-view, white-background, gym, outdoor...）
   - `description`: 一句话描述内容
   - `has_face`: bool — 是否包含真人面部（预防 PrivacyInformation）
   - `colors`: 主色调
   - `suitable_roles`: 适合的 material role（ref_image / image1 / ref_video / first_frame）
4. 输出 `material-pool.json` 到当前项目目录

**输出格式** `material-pool.json`:
```json
{
  "created_at": "2026-03-30T10:00:00Z",
  "materials": [
    {
      "id": 41,
      "file": "product-front.jpg",
      "type": "product",
      "tags": ["product", "front-view", "white-background"],
      "description": "Resistance bands front view, white background, 3 colors visible",
      "has_face": false,
      "colors": ["pink", "blue", "green"],
      "suitable_roles": ["ref_image", "image1"]
    }
  ]
}
```

**Gemini 分析 prompt** (每个文件一次调用):
```
Analyze this image/video for a video production material library.
Return JSON with: type (product|scene|character-ref|mood-board|reference-video|other),
tags (array of keywords), description (one sentence), has_face (boolean - true if
realistic human face is visible), colors (dominant colors), suitable_roles
(array from: ref_image, image1, image2, ref_video, first_frame, last_frame).
```

**文件改动**:
- `skills/renoise-gen/renoise-cli.mjs` — 新增 `material ingest` 命令
- `skills/renoise-gen/SKILL.md` — CLI Commands 章节新增 ingest 文档

### 1.2 Shot-Material 匹配引擎

新建 `skills/renoise-gen/scripts/match-materials.mjs`

**输入**: material-pool.json + shots 数组（来自 project.json 或内联传入）
**匹配逻辑**:
1. 解析每个 shot 的 scene + action + characters 字段，提取关键词
2. 对 material pool 中每个素材计算匹配分：
   - tags 交集 × 3 分
   - description 语义相似 × 2 分
   - type 匹配（shot 提到产品 → product 类型素材加分）× 2 分
   - has_face=true 且 role 不是 ref_video → 扣 10 分（隐私风险）
3. 每个 shot 取 top 1-3 素材，自动分配 role（最佳 → ref_image，次选 → image1）
4. 未使用的素材标注原因（has_face / 不匹配任何 shot）

**输出**: 映射表 JSON + 人类可读的确认文本

```bash
node scripts/match-materials.mjs --pool material-pool.json --shots project.json
```

**文件改动**:
- 新建 `skills/renoise-gen/scripts/match-materials.mjs`

### 1.3 `material ingest` 集成到 Gemini 分析

当前 gemini-gen 和 file-upload 是分开的。在 Phase 2 合并 skill 时，`material ingest` 内部直接调用 gemini.mjs，不走 skill 路由。

**依赖**: gemini.mjs 脚本（已存在）

---

## Phase 2: Skill 合并 — 9 → 4

> 结构性重组。合并后每个 skill 职责清晰，减少路由和重复。

### 2.1 renoise-gen 吸收 product-sheet-generate + scene-generate + file-upload

**合并方式**:
- product-sheet-generate 的 52 行 → renoise-gen SKILL.md 新增 "Quick Templates" 章节
- scene-generate 的 75 行 → 同上，作为 "Scene Template" 小节
- file-upload 的逻辑 → gemini-gen 内部自动处理（见 2.2）
- file-upload/scripts/upload.mjs → 移到 renoise-gen/scripts/（作为通用上传工具）

**renoise-gen SKILL.md 新结构**:
```
# AI Video & Image Generation (via Renoise)
## Quick Start               ← 新增：3 行命令就能生成
## Supported Models
## Material Pool              ← 新增：ingest + auto-match
## CLI Commands
  ### material ingest          ← 新增
  ### task generate/create
  ### material upload/list
  ### character list/get
  ### credit me/estimate/history
## Quick Templates            ← 新增：吸收原 product-sheet + scene-generate
  ### Product Design Sheet
  ### Scene / Background
## Video Modes (Finished Cut vs Clip Stock)
## Prompt Writing             ← 精简，详细版留在 references/
## Error Handling
```

**参考文档保留**:
- `references/video-capabilities.md` — 保留（prompt 写作详细指南）
- `references/api-endpoints.md` — 保留

**删除**:
- `skills/product-sheet-generate/` 整个目录
- `skills/scene-generate/` 整个目录
- `skills/file-upload/` 整个目录（upload.mjs 迁移后删除）

**文件改动**:
- `skills/renoise-gen/SKILL.md` — 重写，吸收 3 个 skill
- `skills/renoise-gen/scripts/upload.mjs` — 从 file-upload 迁移
- 删除 3 个 skill 目录
- `openclaw.plugin.json` — skills 数组移除 3 项

### 2.2 gemini-gen 吸收 file-upload 的自动上传逻辑

**改动**:
- `gemini.mjs` 脚本增加自动检测：文件 > 20MB 时自动走 upload → fileUri 路径
- SKILL.md 去掉 "When NOT to Use" 里对 file-upload 的引用
- 新增 `--mode` 参数支持预设分析模式：
  - `--mode product` → 自动 high resolution + 结构化 JSON 输出
  - `--mode video-script` → 自动 low resolution + 时间戳脚本输出
  - `--mode style` → 提取风格/色彩/构图关键词

**gemini-gen SKILL.md 新结构**:
```
# Gemini Gen — Visual Understanding
## Quick Start
## Analysis Modes             ← 新增：预设模式
  ### Product Analysis
  ### Video Script Extraction
  ### Style Extraction
## CLI Usage
## API Reference (advanced)
## Large File Handling        ← 吸收 file-upload，对用户透明
```

**文件改动**:
- `skills/gemini-gen/SKILL.md` — 重写
- `skills/gemini-gen/scripts/gemini.mjs` — 增加 --mode + 自动大文件上传

### 2.3 director 吸收 tiktok-content-maker + short-film-editor

这是最大的合并。三者变成 director 的三个**模式**。

**director SKILL.md 新结构**:
```
# Video Director
## Critical Rules
## Mode Selection (auto)       ← 新增：自动判断走哪个模式
## Common Phase: Intake        ← 合并原 Phase 1
## Common Phase: Style         ← 合并原 Phase 2，支持跳过
## Mode A: Quick Video (≤15s)  ← 原 director 直接生成路径
## Mode B: E-commerce (TikTok) ← 吸收 tiktok-content-maker
## Mode C: Short Film (>15s)   ← 吸收 short-film-editor
## Common Phase: Submit        ← 合并原 Phase 4
## Preferences
```

**模式自动判断规则**:
| 用户信号 | 自动选择 |
|---------|---------|
| 提到 "TikTok"/"电商"/"产品视频"/"带货" + 有产品图 | Mode B |
| 提到 "短片"/"剧情"/"多段"/"1 分钟视频" 或 时长 > 15s | Mode C |
| 其他所有情况 | Mode A |

**关键简化**:

**Mode B (E-commerce) 简化**:
- 产品分析直接内联调 gemini.mjs，不路由到 gemini-gen skill
- Prompt 改为模板填槽：用户只需确认 5 个字段（产品类型、卖点、场景、模特、语气）
- 自动生成 3 个场景变体，用户选"全部生成"可并行出 3 个视频
- 素材自动上传（检测到产品图路径 → 自动 `material upload`）

**Mode C (Short Film) 简化 — 6 Phase → 3 Phase**:
- Phase 1 (Intake + Character + Style) — 引导式问答构建 Character Bible，不要用户写 JSON
- Phase 2 (Rhythm + Shots + Storyboard) — 音乐分析可选（默认走 Manual Rhythm），shot table + HTML preview 合并展示，一次确认
- Phase 3 (Generate + Assemble) — 全自动：material ingest → auto-match → 费用估算 → 并行提交 → 逐个预览 → ffmpeg 拼接 → 输出 final.mp4

**参考文档迁移**:
- `director/references/style-library.md` → 保留在 director
- `director/references/narrative-pacing.md` → 保留在 director
- `tiktok-content-maker/references/ecom-prompt-guide.md` → 移到 director/references/
- `tiktok-content-maker/examples/dress-demo.md` → 移到 director/examples/
- `short-film-editor/references/continuity-guide.md` → 移到 director/references/
- `short-film-editor/examples/mystery-package-4shot.md` → 移到 director/examples/

**脚本迁移**:
- `short-film-editor/scripts/analyze-beats.py` → `director/scripts/`
- `short-film-editor/scripts/batch-generate.sh` → `director/scripts/`
- `short-film-editor/scripts/split-grid.sh` → `director/scripts/`

**删除**:
- `skills/tiktok-content-maker/` 整个目录（内容迁移后）
- `skills/short-film-editor/` 整个目录（内容迁移后）

**文件改动**:
- `skills/director/SKILL.md` — 重写（最大改动）
- 迁移 references + examples + scripts
- 删除 2 个 skill 目录
- `openclaw.plugin.json` — skills 数组移除 2 项

### 2.4 video-download 保持独立

唯一的改动：
- GreenVideo fallback 封装成 `scripts/download-fallback.sh`，6 步合成 1 步
- 下载完成后提示："要分析这个视频吗？" → 直接调 gemini.mjs

**文件改动**:
- `skills/video-download/scripts/download-fallback.sh` — 新建
- `skills/video-download/SKILL.md` — 小幅更新

### 2.5 更新插件配置

合并后的 `openclaw.plugin.json`:
```json
{
  "skills": [
    "skills/director",
    "skills/gemini-gen",
    "skills/renoise-gen",
    "skills/video-download"
  ]
}
```

同步更新 `README.md`。

---

## Phase 3: 工作流体验优化

> 在合并后的新结构上，逐个优化每个模式的使用体验。

### 3.1 确认门优化 — 信任级别机制

在 director 中引入信任级别，减少不必要的确认等待。

**规则**:
| 条件 | 级别 | 行为 |
|------|------|------|
| 首次用户（无 preferences.json） | Level 1 | 完整流程：风格选择 → 脚本确认 → 素材映射确认 → 生成 |
| 回访用户（有偏好） | Level 2 | 跳过风格选择（用偏好），脚本+映射合并确认 → 生成 |
| 用户给了完整 brief（内容+风格+时长+素材） | Level 3 | 直接生成，只在提交前展示最终方案确认 |

**偏好系统简化** — 3 层文件 → 1 个文件:
```json
// ~/.claude/video-maker/preferences.json
{
  "preferred_styles": ["Calm & Aesthetic", "Lifestyle Vlog"],
  "avoid": ["hard-sell tone", "dutch angles"],
  "default_ratio": "9:16",
  "dialogue_tone": "casual",
  "trust_level": 2,
  "session_count": 12,
  "history": [
    {"date": "2026-03-28", "project": "sneaker-ad", "style": "Dynamic Sports", "duration": 15}
  ]
}
```

**文件改动**:
- `skills/director/SKILL.md` — 信任级别逻辑写入 Common Phase: Intake

### 3.2 Mode B (E-commerce) — 模板化 + 一键多场景

**Prompt 模板引擎**:

用户只需确认/修改 5 个字段，模板自动拼装完整 prompt：

```json
{
  "product_type": "resistance loop bands",
  "selling_points": ["3 resistance levels", "folds flat", "never rolls up"],
  "scene": "bright modern living room, morning light",
  "model_appearance": "fit woman, mid-20s, blonde ponytail, black sportswear",
  "dialogue_tone": "casual, best-friend"
}
```

↓ 模板自动拼装 ↓

完整 prompt（含产品锚定 + 4 段对话 + 视觉叙事 + BGM 指令 + negative prompts）

**一键多场景**:
- 产品分析后自动建议 3 个场景（从 ecom-prompt-guide.md 的 category keywords 匹配）
- 用户可选 "生成全部" → 同一 material ID 并行提交 3 个任务
- 约 8 分钟后同时返回 3 个视频供选择

**文件改动**:
- `skills/director/SKILL.md` — Mode B 章节
- 新建 `skills/director/templates/ecom-prompt.template` — prompt 模板

### 3.3 Mode C (Short Film) — Phase 合并 + 全自动后半段

**Phase 1 (Intake) — 引导式角色构建**:

不再让用户确认 JSON，改为对话式引导：

```
🎬 让我们创建角色 Maya:
  性别/年龄: 女，20 多岁
  发型+发色: 肩长黑发，带一点棕色挑染
  肤色: 暖白
  穿着: 米色针织开衫 + 深灰高领 + 深蓝直筒牛仔裤
  标志性细节: 小金圈耳环，左手金链手镯

  ✅ 角色 Maya 已创建。继续添加角色还是开始分镜？
```

系统后台自动生成完整 Character Bible JSON。

**Phase 2 (Plan) — 一次展示，一次确认**:

把 rhythm blueprint + shot table + HTML storyboard + 素材映射表 合并成一个 HTML preview：

```
┌─────────────────────────────────────────────────┐
│  🎬 Mystery Package — 45s Short Film Preview     │
├─────────────────────────────────────────────────┤
│  📊 Rhythm: S1(8s) → S2(13s) → S3(12s) → S4(12s) │
│  🎵 Music: 92 BPM, cinematic suspense            │
│  💰 Estimated cost: ~22 credits                    │
├─────────────────────────────────────────────────┤
│  [S1 参考图] Discovery — 8s                       │
│  Scene: Dimly lit hallway...                      │
│  📎 素材: #41 product-front.jpg → ref_image       │
│  ▶ 展开 prompt                                    │
├─────────────────────────────────────────────────┤
│  [S2 参考图] The Watch — 13s                      │
│  ...                                              │
└─────────────────────────────────────────────────┘
  [确认全部生成] [调整 S2] [重新匹配素材]
```

用户看一个页面，确认一次，就进入全自动生成。

**Phase 3 (Generate) — 一键到底**:

确认后，系统自动执行：
1. `material ingest` 上传所有素材（如果尚未上传）
2. `match-materials` 确认素材映射（已在 preview 中确认）
3. 并行提交所有 shot（带 visual anchor + 自动 --materials）
4. 每完成一个 shot 立即展示预览（渐进式，不等全部完成）
5. 全部完成后自动 `ffmpeg concat` 生成 final.mp4
6. 输出 assembly guide（转场建议 + BGM 叠加说明）

**断点续传**: project.json 记录每个 shot 的状态：
```json
{
  "shots": [
    {"shot_id": "S1", "status": "completed", "task_id": 123, "video_path": "videos/S1.mp4"},
    {"shot_id": "S2", "status": "completed", "task_id": 124, "video_path": "videos/S2.mp4"},
    {"shot_id": "S3", "status": "failed", "task_id": 125, "error": "timeout"},
    {"shot_id": "S4", "status": "pending"}
  ]
}
```
中途失败 → 下次执行自动跳过已完成的 shot，从 S3 恢复。

**文件改动**:
- `skills/director/SKILL.md` — Mode C 章节
- `skills/director/scripts/batch-generate.sh` — 增加断点续传逻辑
- `skills/director/scripts/generate-preview.mjs` — 新建，生成合并 HTML preview

### 3.4 Renoise Gen — Quick Start + 隐私预检

**Quick Start 模式**:

在 SKILL.md 开头新增 3 行就能用的快速指南：
```bash
# 最简文生视频
node renoise-cli.mjs task generate --prompt "a cat dancing on the moon" --duration 15

# 最简图生视频
node renoise-cli.mjs task generate --prompt "product showcase" --materials "ID:ref_image" --duration 15

# 最简生成图片
node renoise-cli.mjs task generate --prompt "product design sheet" --model nano-banana-2 --resolution 2k
```

**隐私预检** — `material upload` 自动检测:

上传素材时自动调 Gemini 快速检测是否包含人脸：
- 有人脸 → 警告 "⚠️ This image contains a human face and may be blocked by privacy detection. Use as ref_video or describe the person in text instead."
- 不阻止上传（可能用于 ref_video），但标记 `has_face: true`

**文件改动**:
- `skills/renoise-gen/SKILL.md` — 增加 Quick Start
- `skills/renoise-gen/renoise-cli.mjs` — material upload 增加隐私预检（可选 `--no-check` 跳过）

### 3.5 Video Download — Fallback 自动化

**封装 GreenVideo fallback**:

把 6 步 agent-browser 操作封装为 `download-fallback.sh`:
```bash
bash scripts/download-fallback.sh '<douyin-url>' 'output-dir'
```

内部自动：open → fill → click → extract URL → curl → close

**下载后自动关联**:

下载完成后提示：
```
✅ Downloaded: resources/references/tk-7571284267028729101.mp4

可选操作:
  1. 分析这个视频（提取脚本/风格/节奏）
  2. 作为参考素材加入 Material Pool
  3. 完成
```

选 1 → 自动调 `gemini.mjs --mode video-script --file <path>`
选 2 → 自动调 `material ingest <path>`

**文件改动**:
- 新建 `skills/video-download/scripts/download-fallback.sh`
- `skills/video-download/SKILL.md` — 更新 fallback 章节 + 新增下载后操作

---

## Phase 4: 参考文档整理

> 消除重复，统一路径引用。

### 4.1 参考文档归属

合并后的参考文档目录：

```
skills/
├── director/
│   ├── SKILL.md
│   ├── references/
│   │   ├── style-library.md          (保留)
│   │   ├── narrative-pacing.md       (保留)
│   │   ├── ecom-prompt-guide.md      (从 tiktok-content-maker 迁移)
│   │   └── continuity-guide.md       (从 short-film-editor 迁移)
│   ├── examples/
│   │   ├── dress-demo.md             (从 tiktok-content-maker 迁移)
│   │   └── mystery-package-4shot.md  (从 short-film-editor 迁移)
│   ├── templates/
│   │   └── ecom-prompt.template      (新建)
│   └── scripts/
│       ├── analyze-beats.py          (从 short-film-editor 迁移)
│       ├── batch-generate.sh         (从 short-film-editor 迁移)
│       ├── split-grid.sh             (从 short-film-editor 迁移)
│       └── generate-preview.mjs      (新建)
├── renoise-gen/
│   ├── SKILL.md
│   ├── renoise-cli.mjs
│   ├── references/
│   │   ├── video-capabilities.md     (保留)
│   │   └── api-endpoints.md          (保留)
│   └── scripts/
│       ├── match-materials.mjs       (新建)
│       └── upload.mjs                (从 file-upload 迁移)
├── gemini-gen/
│   ├── SKILL.md
│   └── scripts/
│       └── gemini.mjs
└── video-download/
    ├── SKILL.md
    └── scripts/
        ├── download-video.sh         (保留)
        └── download-fallback.sh      (新建)
```

### 4.2 消除重复引用

当前 video-capabilities.md 被 director / tiktok-content-maker / renoise-gen 都引用。

合并后：
- `video-capabilities.md` 只在 renoise-gen/references/ 保留一份
- director 的 SKILL.md 中引用路径统一为 `${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
- director 自己的参考文档（style-library, narrative-pacing, ecom-prompt-guide, continuity-guide）只在 director/references/ 保留

---

## 实施顺序与依赖关系

```
Phase 1: Material Pool (基础设施)
  1.1 material ingest 命令        ← 无依赖，先做
  1.2 match-materials 匹配引擎    ← 依赖 1.1

Phase 2: Skill 合并 (结构重组)
  2.1 renoise-gen 吸收 3 个薄 skill   ← 依赖 1.1 (ingest 文档)
  2.2 gemini-gen 吸收 file-upload     ← 无依赖
  2.3 director 吸收 2 个工作流 skill   ← 最大改动，依赖 1.2
  2.4 video-download 小幅优化         ← 无依赖
  2.5 更新插件配置                     ← 依赖 2.1-2.4 全部完成

Phase 3: 体验优化 (在新结构上)
  3.1 信任级别机制                    ← 依赖 2.3
  3.2 Mode B 模板化+多场景            ← 依赖 2.3
  3.3 Mode C Phase 合并+全自动        ← 依赖 1.2 + 2.3
  3.4 renoise-gen Quick Start+隐私预检 ← 依赖 2.1
  3.5 video-download fallback 自动化   ← 依赖 2.4

Phase 4: 文档整理
  4.1 参考文档归属                    ← 依赖 2.3
  4.2 消除重复引用                    ← 依赖 4.1
```

## 预期效果

| 指标 | 现在 | 优化后 |
|------|------|-------|
| Skill 数量 | 9 | 4 |
| 电商视频：用户操作步数 | ~12 步 | ~4 步 |
| 短片制作：确认次数 | 5-6 次 | 2 次 |
| 素材上传+关联 | 全手动 | 自动（1 次确认映射表） |
| 隐私报错（PrivacyInformation） | 事后发现 | 上传时预警 |
| 多段视频 4×15s 等待时间 | ~32 分钟（串行） | ~8 分钟（并行） |
| 生成失败恢复 | 全部重来 | 断点续传 |
| 新用户上手 | 读 9 个 SKILL.md | 读 1 个 director，按需读其他 |
