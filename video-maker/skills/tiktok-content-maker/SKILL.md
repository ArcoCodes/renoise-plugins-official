---
name: tiktok-content-maker
description: >
  TikTok e-commerce short video script generator. Analyzes product photos,
  generates 15s video scripts with video prompts and English dialogue.
  Use when user says "TikTok product video", "ecommerce video", "电商视频",
  "带货视频", "商品视频", "拍商品". Do NOT use for non-ecommerce videos or
  general creative direction (use director instead).
allowed-tools: Bash, Read
metadata:
  author: renoise
  version: 0.1.0
  category: video-production
  tags: [product, ecommerce, tiktok]
---

# Content Maker — 电商短视频脚本 + 视频生成

## Overview

电商短视频全流程工具：用户提供商品图（+ 可选模特图）→ 分析商品信息 → 生成 15 秒 TikTok 脚本（视频 prompt，含英文台词嵌入）→ 提交视频生成任务。

## Workflow

### Phase 1: 素材收集 & 商品分析

1. **收集素材路径**：向用户索要图片
   - `商品图路径`（必需）：产品主图。**最佳：干净白底纯产品图，无文字/标注/装饰**。有营销文字覆盖的图会干扰模型。
   - `模特图路径`（可选，仅供分析参考）：展示穿搭/使用效果的图。**注意：模特图仅用于理解产品使用方式，不上传到 Renoise**（隐私检测会拦截含真人面孔的图片）。

2. **分析商品信息**：
   - 如果有 Gemini API 可用，调用 Gemini 分析：
     ```bash
     bash ${CLAUDE_SKILL_DIR}/scripts/analyze-images.sh "<商品图路径>" "<模特图路径>"
     ```
   - 也可以直接通过 Read 工具查看图片，人工分析商品信息
   - 需要提取：商品类型、颜色、材质、卖点、品牌调性、适用场景
   - **（关键）从使用场景图中理解产品的正确使用方式**：
     - 用户的姿势是什么？（站/坐/躺/走）
     - 产品放在身体哪个位置？（手持/地面/桌面/身体下方）
     - 产品与身体的交互方式？（用手按压 vs 用体重压 vs 穿戴 vs 涂抹）
     - 使用场景在哪？（健身房/办公室/家里/户外）
   - 如果用户提供了商品链接，用 WebFetch 抓取产品详情页补充理解

3. **展示分析结果**，让用户确认或补充信息。分析结果中必须包含一条明确的「**使用方式描述**」，例如：
   > 使用方式：将花生球放在地面/瑜伽垫上，用户躺在球上方，通过自身体重施压按摩脊柱两侧肌肉。花生形凹槽避开脊柱，两侧球体作用于竖脊肌。

### Phase 2: 15 秒脚本 + Prompt 生成

基于分析结果 + 参考指南，生成完整的 15 秒视频脚本。

**必须参考以下指南**（先 Read 再生成）：
- `${CLAUDE_SKILL_DIR}/references/ecom-prompt-guide.md` — 电商视频 prompt 指南

**Prompt 结构（3 个必需组成部分）：**

#### Part A: 产品锚定（Prompt 开头，一句话）

产品外观靠参考图传达，prompt 里只需**一句话**说明产品是什么 + 用途：

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame. Do not invent any packaging, box, or container unless the reference image shows one.
```

**关键**：不要在 prompt 里重复描述颜色、材质、形状、logo — 这些信息已在参考图里。把 prompt 空间留给 hook 和画面叙事。

#### Part B: 台词嵌入（贯穿全段）

台词必须是英文，以强制口型同步格式嵌入叙事段落中：
```
Spoken dialogue (say EXACTLY, word-for-word): "..."
Mouth clearly visible when speaking, lip-sync aligned.
```

**台词风格要求**：
- **闺蜜聊天感**：像在跟朋友推荐，不像在念广告词
- **高信息密度**：每句话都带具体信息（数字、对比、使用场景），没有废话
- **不硬推销**：结尾不用 "link below" / "点击链接" 这种生硬 CTA，用自然的个人推荐收尾（如 "Best money I have spent this year"、"Trust me just start"）

**台词节奏**（4 句，对应 4 个时间段）：
```
[0-3s]   Hook — 一句话喊停用户（痛点/悬念/结果前置）
[3-8s]   卖点 — 具体参数 + 使用体验
[8-12s]  场景 — 在哪用 + 便携性/多功能
[12-15s] 收尾 — 个人真实推荐感，不硬推销
```

#### Part C: 画面叙事（一段连续叙事）

**视频结构（一个连续 15 秒视频）：**
```
[0-3s]   HOOK — 高冲击力开场。必须：快速运镜（whip pan / snap dolly in）+ 动态动作 + 立即开口说台词。绝对不能慢热。
[3-8s]   SHOWCASE — 产品展示 + 模特互动。运镜变化展示材质细节。
[8-12s]  SCENE — 生活场景使用。拉远到中景/全景。
[12-15s] CLOSE — 模特面对镜头 + 产品在画面中 + 自然收尾。frame holds steady。
```

**输出 3 项内容：**

#### 1. Video Prompt（英文，含台词）
导演口述式段落（6-10 句，每句只做一件事），包含：
- 产品锚定（一句话，Part A）在最开头
- 台词以 `Spoken dialogue (say EXACTLY, word-for-word):` 格式嵌入（Part B）
- 每句台词后跟 `Mouth clearly visible when speaking, lip-sync aligned.`
- Ad-6D Protocol 元素穿插
- 模特外观一致性描述（性别、发型、肤色、体型、服装）
- 运镜变化至少 3 次
- 光线/氛围描述

#### 2. 台词脚本（英文，标注时间段）
单独列出 4 句台词及对应时间段，方便审阅。

#### 3. BGM/音效建议
- 推荐适合产品调性的音乐风格
- 关键节点的音效提示

**参考示例**：Read `${CLAUDE_SKILL_DIR}/examples/dress-demo.md` 了解最新标准输出格式。

### Phase 3: 用户确认

展示完整脚本后，询问用户：
- 是否调整台词
- 是否更换场景
- 是否修改 prompt 细节
- 确认后进入提交

### Phase 4: 上传素材 + 提交视频生成任务

用户确认脚本后，上传商品图并提交视频生成任务。

**重要规则**：
- 只上传商品图，**不上传模特/真人图**（隐私检测会拦截含真人面孔的图片，报错 `InputImageSensitiveContentDetected.PrivacyInformation`）
- 模特外观完全靠 prompt 文字描述控制
- 商品图最好用干净白底纯产品图，避免有营销文字覆盖的图
- 批量生成时：商品图只需上传一次，复用 material ID 提交多个不同场景的任务

## Important Notes

- 图片支持 jpg/jpeg/png/webp 格式
- 视频 prompt 必须全英文
- 台词必须英文，嵌入 prompt（`Spoken dialogue (say EXACTLY, word-for-word): "..."`）
- **不输出单独的字幕文案** — 台词已在 prompt 中，不需要额外字幕层
