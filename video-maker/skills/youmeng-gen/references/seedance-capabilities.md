# Seedance 2.0 能力规格

## 模型规格

| 参数 | 值 |
|------|-----|
| 模型名 | `seedance-2.0` |
| 最短时长 | 5 秒 |
| 最长时长 | 15 秒 |
| 可选时长 | 5-15 秒任意整数 |
| 分辨率 | 最高 1080p |
| 比例 | `1:1`, `16:9`, `9:16` |

## 输入类型

### Text-to-Video（纯文本生成）— 推荐默认模式
- 无需素材，仅靠 prompt 描述生成视频
- **这是最常用、最稳定的模式**
- 不受隐私检测限制，成功率最高
- 适合：所有场景

### Image-to-Video（图生视频）
- 上传参考图片，AI 基于图片 + prompt 生成视频
- Material role: `ref_image`
- **⚠️ 隐私检测限制**：含真人面孔的图片经常被 Seedance 拦截（`PrivacyInformation` 错误）。纯产品图、风景图、插画等无人脸的图片可以正常使用
- 适合：产品展示（白底产品图）、场景延伸（无人脸）

### Video-to-Video（视频参考）
- 上传参考视频，AI 参考运动/风格生成新视频
- Material role: `ref_video`
- **⚠️ 同样受隐私检测限制**，含人脸视频容易被拦截
- 使用 ref_video 会影响定价（更贵）
- 适合：动作迁移、风格转绘（无人脸素材）

### 实践建议

大多数情况下优先使用 **Text-to-Video**，把角色外观完全用文字描述。只在以下场景使用参考素材：
- 纯产品图（白底、无人脸）→ `ref_image`
- 抽象/风景参考 → `ref_image`
- 需要精确复刻运动轨迹（无人脸）→ `ref_video`

## 时长策略

### 核心原则：优先单段 15s，避免多段拼接

Seedance 2.0 在单次 15s 生成中可以**自然包含多个分镜切换**。一次生成 15s 的优势远大于拼接多个短片段：

| | 单段 15s | 拼接 5×3s |
|---|---------|----------|
| 音乐/音效 | 连贯自然，有起承转合 | 断裂，节奏不连贯 |
| 人物一致性 | 同一段内天然一致 | 跨段容易漂移变脸 |
| 运镜流畅度 | 可做复杂连续运镜 | 每段独立，缺乏呼应 |
| 成本 | 1 次调用 | 5 次调用 |

**结论**：默认用 15s。只有目标总时长 > 15s 时才需要多段。

### 15s 多分镜 Prompt 写法

在一个 prompt 中描述多个分镜阶段，用时间节拍引导模型内部切换：

```
[Opening 0-3s] Close-up of hands unboxing a sleek black device on a white desk.
Camera snaps dolly in to reveal the logo.

[Middle 3-10s] The woman picks it up, examines it from different angles.
Medium shot, smooth orbit around the product in her hands.
Spoken dialogue (say EXACTLY, word-for-word): "I've been waiting for this."
Mouth clearly visible, lip-sync aligned.

[Closing 10-15s] She places the device on a wireless charger, LED glows blue.
Pull back to wide shot of the full minimalist workspace.
Soft ambient glow, the frame holds steady.
```

**关键技巧**：
- 用 `[Opening/Middle/Closing]` + 时间段标注分镜节拍
- 每个阶段 2-3 句，信息密度要高
- 运镜变化自然过渡（如 close-up → medium → wide）
- 口播嵌入在对应的时间段内
- 最后一个阶段写 `frame holds steady` 方便后期衔接

### 超过 15s 的视频

当目标视频 > 15s 时，按 15s 为单位拆分，尽量减少段数：

```
30s → 2 × 15s
45s → 3 × 15s
60s → 4 × 15s
```

跨段一致性保持：
1. **角色描述复制** — 每段 prompt 开头重复完整的角色外观描述
2. **场景/光线关键词统一** — 所有段使用相同的 lighting, color palette 描述
3. **风格关键词统一** — 如 `cinematic, shallow depth of field, warm tone`
4. **上一段结尾 = 下一段开头** — 用 `Continuing from the previous shot:` 衔接

## Prompt 写作原则

### 基本规则
1. **必须英文** — Seedance 对英文 prompt 理解最好
2. **自然叙事** — 用连贯的描述段落，不要用逗号分隔的标签列表
3. **具体 > 抽象** — `a golden retriever running through shallow ocean waves at sunset` 优于 `a dog on a beach`
4. **信息密度要高** — 15s prompt 要包含多个分镜阶段的细节，不要浪费篇幅在重复描述上

### Prompt 结构

```
Subject（外观详细描述）+ Action（多阶段动作）+ Camera（运镜变化）+ Scene/Environment + Visual Style
```

- **Subject**: 主体是什么，详细描述外观特征（发型、肤色、服装、体型）
- **Action**: 主体在做什么，按时间顺序描述多个动作
- **Camera**: 运镜变化（至少 2-3 次变化：如 close-up → medium → wide）
- **Scene**: 环境、光线、时间
- **Style**: 视觉风格（cinematic, documentary, animation...）

### 运镜速查

| 效果 | 英文关键词 | 适用场景 |
|------|-----------|---------|
| 急推 | fast snap dolly in | 细节冲击 |
| 急拉 | quick pull back to reveal | 揭示全貌 |
| 甩镜 | whip pan with motion blur | 节奏转场 |
| 滑轨 | subtle slider drift | 优雅展示 |
| 环绕 | smooth orbit | 360° 展示 |
| 微距 | extreme macro push | 材质细节 |
| 固定 | locked-off static | 定格/文字屏 |
| 跟拍 | tracking shot follows subject | 动态跟随 |

### 示例：15s 多分镜 prompt

**好的 prompt**:
> A young woman with shoulder-length dark hair and a cream knit sweater sits at a sunlit café table. [0-4s] Close-up of her hands wrapping around a steaming ceramic mug, camera gently pushes in, morning light catches the steam rising. [4-10s] She takes a sip, looks up and smiles, medium shot as camera slowly drifts to a side angle revealing the quiet café interior — wooden shelves, hanging plants, soft jazz playing. Spoken dialogue (say EXACTLY, word-for-word): "This is my favorite place in the city." Mouth clearly visible, lip-sync aligned. [10-15s] She sets the mug down and opens a worn leather journal, begins writing. Camera pulls back to a wide shot through the café window, the frame holds steady. Cinematic, warm golden tones, shallow depth of field, film grain.

**差的 prompt**:
> woman, café, coffee, sunshine, beautiful, cinematic, 4k
