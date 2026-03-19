---
name: youmeng-gen
description: Generate AI videos with Seedance 2.0 via YOUMENG platform. Create tasks, upload materials, poll results, download videos. Supports text-to-video, image-to-video, and video-to-video. Use this skill whenever the user asks to "生成视频", "AI视频", "Seedance", "youmeng", "视频生成", "generate video", "create video", "text to video", "image to video", "做一个视频", "拍一个视频", "复刻视频", or describes any video content they want generated with AI.
categories: [general]
allowed-tools: Bash, Read
---

# Seedance 视频生成（via YOUMENG）

通过 YOUMENG 平台调用 Seedance 2.0 模型生成 AI 视频。

## 核心理念：成片 vs 素材，两种模式

根据用户需求区分两种生成模式：

### 成片模式（Finished Cut）— 默认

用户要的是一段可直接使用的完整视频。利用 Seedance 2.0 极强的分镜控制能力，**单段 15s 内通过 prompt 时间标注控制不同时间段的内容、运镜和节奏**，直出成片：

- 音乐/音效连贯自然，有起承转合
- 人物在同一段内天然一致，不会跨段变脸
- 运镜可以做复杂的连续变化（如 close-up → orbit → wide pull back）
- 成本只需 1 次调用

**默认 15s，用分镜 prompt 控制内容。**

```
[0-3s] Close-up of hands unboxing a sleek black device on a white desk. Camera snaps dolly in to reveal the logo.

[3-10s] The woman picks it up, examines it from different angles. Medium shot, smooth orbit around the product. Spoken dialogue: "I've been waiting for this." Mouth clearly visible, lip-sync aligned.

[10-15s] She places it on a wireless charger, LED glows blue. Pull back to wide shot of the full workspace. The frame holds steady.
```

### 素材模式（Clip Stock）

用户要的是原子化的素材片段，用于后期剪辑拼接。每个 clip 聚焦**单一动作 + 单一运镜**，保持最大灵活性：

- 每段 **3-5s**，一个 clip 只做一件事
- Prompt 不需要时间标注，直接描述单一场景
- 批量生成多个 clip，用 tag 分组管理
- 后期用剪辑工具自由组合

```bash
# 素材模式示例：为一个产品视频准备素材
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create --prompt "Extreme close-up of a matte black smartwatch on white marble, slow dolly in, studio lighting." --duration 5 --tags product-x,detail
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create --prompt "A hand picks up the smartwatch from the table, medium shot, tracking follows the hand upward." --duration 5 --tags product-x,pickup
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create --prompt "Wrist-level shot of the watch on a person's arm, smooth orbit, outdoor golden hour." --duration 5 --tags product-x,lifestyle
```

### 如何判断？

| 信号 | 模式 |
|------|------|
| "生成一个视频" "拍一个短片" | 成片模式 — 15s 分镜直出 |
| "准备素材" "clip" "剪辑用" "B-roll" | 素材模式 — 3-5s 原子 clip |
| "分镜表" "Shot 表" | 素材模式 — 按 Shot 表逐条生成 |
| 未明确 | **默认成片模式**，主动确认 |

## Seedance 2.0 规格

| 参数 | 值 |
|------|-----|
| 时长范围 | 5-15s 任意整数 |
| **默认时长** | **15s**（充分利用分镜能力） |
| 比例 | `1:1`, `16:9`, `9:16` |
| 推荐模式 | **Text-to-Video**（纯文本 prompt，最稳定） |
| Prompt 语言 | **英文**，自然叙事段落 |

> **默认用 Text-to-Video**：Image/Video 参考含真人面孔时经常被 Seedance 隐私检测拦截（`PrivacyInformation` 错误），纯文本不受此限制，成功率最高。
> 详见 `${CLAUDE_SKILL_DIR}/references/seedance-capabilities.md`。

## 配置

CLI 路径：`${CLAUDE_SKILL_DIR}/youmeng-cli.mjs`（Node.js 18+）

Token 配置在 `${CLAUDE_SKILL_DIR}/.env`：
```
YOUMENG_TOKEN=<bearer token>
YOUMENG_BASE_URL=https://staging--ujgsvru36x4korjj10nq.edgespark.app
```

## CLI 命令

所有命令：`node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs <command> [options]`

### 余额查询（创建任务前先检查余额）
```bash
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs me                    # 用户信息 + 余额
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs estimate --duration 10 # 预估费用
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs credit-history         # 消费记录
```

### 创建视频任务
```bash
# Text-to-video（默认 15s，利用分镜能力）
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create \
  --prompt "[0-5s] Close-up of a cat on the moon, slow push in. [5-12s] The cat starts dancing, smooth orbit camera, stars twinkling. [12-15s] Wide pull back revealing the full lunar landscape, frame holds steady. Cinematic lighting, shallow depth of field." \
  --ratio 1:1

# Image-to-video（先 upload，再用 material ID）
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs upload /path/to/photo.jpg
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create \
  --prompt "[0-5s] Close-up of the product @photo.jpg on a white surface, gentle dolly in. [5-12s] Camera orbits around the product revealing all angles, soft studio lighting. [12-15s] Pull back to wide shot, product centered, frame holds steady." \
  --materials "ID:ref_image" --ratio 16:9

# Video-to-video
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create \
  --prompt "recreate this motion with a robot character" \
  --materials "ID:ref_video" --duration 5
```

**create 参数**：
- `--prompt` (必需) — 英文自然叙事 prompt，用 `[时间段]` 标注分镜
- `--duration` — 5-15 秒任意整数（**默认 15**，充分利用分镜能力）
- `--ratio` — `1:1` / `16:9` / `9:16`（默认 1:1）
- `--model` — 模型名（默认 seedance-2.0）
- `--tags` — 逗号分隔标签，用于管理和分组
- `--materials` — 素材引用 `id:role`，多个用逗号分隔

### 任务管理
```bash
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs list                          # 列出任务
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs list --status completed       # 按状态过滤
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs list --tag project-x          # 按标签过滤
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs get <id>                      # 任务详情
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs result <id>                   # 获取视频 URL
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs wait <id>                     # 轮询等待完成
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs wait <id> --interval 15 --timeout 300
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs cancel <id>                   # 取消（仅 pending）
```

### 素材上传与管理
```bash
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs upload /path/to/file.jpg      # 上传（自动识别类型）
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs upload /path/to/clip.mp4 --type video
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs materials                     # 列出素材
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs materials --type image --search cat
```

### 标签管理
```bash
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs tags                         # 列出所有标签
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs tag <id> --tags a,b,c        # 更新任务标签
```

## 任务状态

`pending` → `assigning` → `assigned` → `queued` → `running` → `completed` / `failed`

仅 `pending` 可取消（自动退款）。

## 工作流

### 成片模式（默认）
```
me → estimate → create（15s + 分镜 prompt）→ wait → result
```

单段直出，绝大多数 ≤15s 的视频需求用这个。

### 素材模式
```
me → estimate → create（3-5s × N，同 tag 分组）→ 逐个 wait → 收集 result
```

批量生成原子 clip，后期剪辑组合。

### 带素材参考
```
upload → create (--materials "ID:role") → wait → result
```

### 成片模式 > 15s

目标总时长超过 15s 时，按 15s 为单位拆分，每段仍用分镜 prompt：

```bash
# 30s = 2 × 15s
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create --prompt "[0-5s] ... [5-12s] ... [12-15s] ..." --tags vid-001,s1
node ${CLAUDE_SKILL_DIR}/youmeng-cli.mjs create --prompt "[0-5s] ... [5-12s] ... [12-15s] ..." --tags vid-001,s2
```

**一致性保持**：每段 prompt 开头重复完整角色外观描述，统一 lighting/style 关键词，用 `Continuing from the previous shot:` 衔接。

## Prompt 写作

**通用规则**：
- **必须英文** — Seedance 对英文叙事段落理解最好，中文或标签列表会导致生成质量下降、动作不连贯
- **自然叙事段落** — 用完整的描述句子，不要逗号分隔的关键词列表（如 `woman, café, coffee, 4k`），因为模型需要理解动作的因果和时序
- **具体 > 抽象** — `a golden retriever running through shallow ocean waves at sunset` 远优于 `a dog on a beach`，细节越多模型越能准确还原
- **结构**：Subject（外观详描）+ Action（动作序列）+ Camera（运镜）+ Scene（环境光线）+ Style（视觉风格）

**成片模式 prompt**：
- 用 `[时间段]` 标注分镜节拍 — 这是 Seedance 区别于其他模型的核心优势，模型会按时间段切换内容和运镜
- 每个时间段 = Subject + Action + Camera
- 运镜至少 2-3 次变化（如 close-up → orbit → wide pull back），让视频有剪辑节奏感
- 最后一段写 `frame holds steady`，方便后续衔接或作为自然收尾

**素材模式 prompt**：
- 不需要时间标注，直接描述单一场景
- 一个 clip 只做一件事：一个动作 + 一个运镜，方便后期灵活剪辑
- 保持简洁，3-5 句即可

详细的 prompt 写作指南和运镜速查表见 `${CLAUDE_SKILL_DIR}/references/seedance-capabilities.md`。

## 错误处理

| 错误 | 原因 | 处理方式 |
|------|------|---------|
| `PrivacyInformation` | 参考图/视频含真人面孔被隐私检测拦截 | 切换为 Text-to-Video，用文字描述人物外观 |
| `Insufficient credits` (402) | 余额不足 | 告知用户当前余额和所需费用，建议充值 |
| 任务 `failed` | 生成失败 | 用 `get <id>` 查看 error 字段，常见原因：prompt 违规、服务端超时。可调整 prompt 后重试 |
| `Auth Error` (401) | Token 过期或无效 | 需要更新 `${CLAUDE_SKILL_DIR}/.env` 中的 `YOUMENG_TOKEN` |
| `wait` 超时 | 生成时间超过 timeout | 15s 视频通常需要 5-10 分钟，适当加大 `--timeout`（如 900） |

## 参考

- [Seedance 2.0 能力规格](references/seedance-capabilities.md) — 模型规格、prompt 写作详细指南、运镜速查表。写 prompt 时查阅
- [API 端点参考](references/api-endpoints.md) — YOUMENG API 端点和请求/响应格式。需要直接调用 API 或排查 HTTP 错误时查阅
