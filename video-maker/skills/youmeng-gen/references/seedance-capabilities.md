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

| 类别 | 效果 | 英文关键词 | 适用场景 |
|------|------|-----------|---------|
| **景别** | 大远景 | extreme wide shot | 环境建立 |
| | 全景 | wide shot | 空间关系 |
| | 中景 | medium shot | 人物互动 |
| | 特写 | close-up | 情绪/细节 |
| | 大特写 | extreme close-up / macro | 材质/纹理 |
| **运镜** | 急推 | fast snap dolly in | 细节冲击 |
| | 急拉 | quick pull back to reveal | 揭示全貌 |
| | 甩镜 | whip pan with motion blur | 节奏转场 |
| | 滑轨 | subtle slider drift | 优雅展示 |
| | 环绕 | smooth orbit | 360° 展示 |
| | 跟拍 | tracking shot follows subject | 动态跟随 |
| | 微距 | extreme macro push | 材质细节 |
| | 固定 | locked-off static | 定格/收尾 |
| **角度** | 仰拍 | low angle | 权威/震撼 |
| | 俯拍 | overhead / bird's eye | 全局/空间感 |
| | 鱼眼 | fisheye lens | 趣味/夸张 |
| | 主观 | first-person POV | 沉浸体验 |
| **节奏** | 慢放 | slow motion | 强调动作 |
| | 快切 | rapid cuts / hard cut | 紧张节奏 |
| | 延时 | time-lapse | 时间流逝 |
| **焦点** | 浅景深 | shallow depth of field | 主体突出 |
| | 焦点转移 | rack focus | 视线引导 |
| **特殊** | 希区柯克变焦 | dolly zoom / vertigo effect | 心理冲击 |
| | 遮挡转场 | wipe transition through obstruction | 无缝场景切换 |

### 示例：15s 多分镜 prompt

**好的 prompt**:
> A young woman with shoulder-length dark hair and a cream knit sweater sits at a sunlit café table. [0-4s] Close-up of her hands wrapping around a steaming ceramic mug, camera gently pushes in, morning light catches the steam rising. [4-10s] She takes a sip, looks up and smiles, medium shot as camera slowly drifts to a side angle revealing the quiet café interior — wooden shelves, hanging plants, soft jazz playing. Spoken dialogue (say EXACTLY, word-for-word): "This is my favorite place in the city." Mouth clearly visible, lip-sync aligned. [10-15s] She sets the mug down and opens a worn leather journal, begins writing. Camera pulls back to a wide shot through the café window, the frame holds steady. Cinematic, warm golden tones, shallow depth of field, film grain.

**差的 prompt**:
> woman, café, coffee, sunshine, beautiful, cinematic, 4k

## 高级 Prompt 技巧

### 技术参数前置

在 prompt 开头声明全局技术规格（画幅、帧率、色调、景深），模型会贯穿应用到整段视频：

```
2.35:1 widescreen, 24fps, warm golden palette, shallow depth of field.
[0-5s] Close-up of hands on piano keys...
```

### 禁止项声明 (Negative Prompting)

在 prompt 结尾排除不想要的元素，避免模型自动添加文字、水印等：

```
... frame holds steady. No text, subtitles, watermarks, or logos. No sudden camera shake.
```

常用禁止项：`No text / No subtitles / No watermarks / No logos / No camera shake / No jump cuts`

### 风格关键词速查

| 类别 | 关键词示例 |
|------|-----------|
| 质感 | cinematic, film grain, HDR, RAW, 8K |
| 色调 | warm tone, cold blue, high contrast, desaturated, neon, Morandy palette |
| 光影 | golden hour, rim light, Tyndall effect, volumetric light, natural light, side backlight |
| 风格 | documentary, vlog, commercial, music video, Hollywood blockbuster, indie film |
| 动画 | 3D CG animation, cel-shaded anime, ink wash painting, pixel art |

## 场景类型 Prompt 侧重点

| 场景 | Prompt 重点 |
|------|------------|
| **电商/广告** | 产品第 1 秒出现 + 材质特写 + 360° 展示 + 品牌收尾 |
| **剧情/短剧** | 画面与台词分层写 + 标注角色情绪 + 音效单独一行 |
| **动作/仙侠** | 特效粒子细节 + 快切节奏 + 慢放强调关键动作 |
| **生活/Vlog** | 自然光 + 手持跟拍感 + 环境音 |
| **MV/卡点** | 指定画幅+帧率 + 声音设计优先 + 节拍同步 |
| **科普/教学** | 4K CGI 风格 + 半透明可视化 + 配教育旁白 |

## 创作能力 Prompt 模板

### 剧情补全 (Story Completion)

给出关键帧或分镜描述，让模型自动补全动作和过渡：

```
A 4-panel comic strip is shown in the reference image. Animate each panel left-to-right,
top-to-bottom, maintaining character dialogue. Add dramatic sound effects at key moments.
Style: humorous and exaggerated.
```

### 视频延长 (Video Extension)

对已生成的视频追加内容。用 `--materials "ID:ref_video"` 传入上一段视频，prompt 描述**新增部分**：

```
Continuing from the previous shot: [0-5s] The character turns and walks toward the door,
camera tracking follows. [5-10s] She opens the door to reveal a sunlit garden, camera
glides through the doorframe, frame holds steady.
```

> **注意**：`--duration` 设为新增部分的时长，不是总时长。

### 一镜到底 (Seamless Long Take)

关键词 `single continuous take, no cuts` + 用场景过渡词串联多个空间：

```
Single continuous take, no cuts. [0-5s] Camera follows a woman in a red coat through
a crowded market, tracking shot. [5-10s] She turns a corner into a quiet alley, camera
keeps following without cutting. [10-15s] She pushes open a wooden door and enters a
sunlit courtyard, camera glides in behind her, frame holds steady.
```

### 声音与对白 (Sound & Dialogue)

对白用 `Spoken dialogue (say EXACTLY, word-for-word): "..."` 格式嵌入对应时间段，标注情绪和口型：

```
[3-8s] Medium shot, she picks up the phone. Spoken dialogue (say EXACTLY, word-for-word):
"I told you, it's over." Tone: cold and resolute. Mouth clearly visible, lip-sync aligned.
```

音效/BGM 单独一行写在 prompt 末尾：

```
Sound design: gentle rain on window, distant thunder, melancholic piano.
```

### 视频编辑 (Video Editing)

基于参考视频做定向修改（角色替换/元素增减）。用 `--materials` 传入原视频 + 替换素材：

```
Replace the main character in the reference video with the person in the reference image.
Keep all original camera movements and timing. Add a white cat sitting on the desk
in the background.
```

### 音乐卡点 (Beat Sync)

指定画幅+帧率，用时间戳精确对齐节拍，强调声画同步：

```
2.35:1 widescreen, 24fps. [0-2s] Beat drop — extreme close-up of hands clapping, sharp
snap zoom. [2-5s] Wide shot, dancer spins, camera orbits in sync with bass hits.
[5-8s] Freeze frame on peak pose, 0.5s hold, then rapid montage cuts on every snare.
Sound design priority: footsteps, fabric rustle, and breath must align with beat.
```
