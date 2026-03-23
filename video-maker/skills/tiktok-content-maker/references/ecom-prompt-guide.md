# 电商短视频 Prompt 指南

## 15 秒电商视频 Prompt 模板

### 核心结构：一个连续 15 秒叙事段落

不同于 Apple Don't Blink 快速切镜风格，电商带货视频是**一个连续镜头**，通过运镜变化展示产品和模特。

**写作顺序**: 时间线叙事 + Ad-6D 元素穿插

```
[开场 0-3s] ⚡ HOOK — 产品必须在第 1 秒出现 + 快速运镜 + 立即开口说话。绝对不能铺垫。
[展示 3-8s] 产品特写 + 材质细节 + 模特互动
[场景 8-12s] 生活场景 + 使用效果 + 氛围
[收尾 12-15s] 模特面对镜头 + 产品定格 + 自然收尾
```

### 产品锚定（Prompt 开头，一句话）

产品外观靠参考图传达，prompt 里只需**一句话**说明产品是什么 + 用途：

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame. Do not invent any packaging, box, or container unless the reference image shows one.
```

**示例**：
- `The product is a K brand lightweight gym tote bag for fitness and daily commute, shown in the reference image.`
- `The product is a Keep peanut-shaped massage ball for back and muscle recovery, shown in the reference image.`

**关键**：不要在 prompt 里重复描述产品的颜色、材质、形状、logo — 这些信息已经在参考图里了。把 prompt 空间留给 hook 和画面叙事。

### 模特一致性描述

紧接产品锚定段之后，锚定模特外观：

```
A [age_range]-year-old [gender] with [hair description], [skin tone], [body type], wearing [outfit description]...
```

**注意**：模特完全靠文字描述，不上传真人参考图（隐私检测会拦截含真人面孔的图片）。

## 品类专用关键词

### 服装（Clothing）
- **面料**: flowing silk, crisp cotton, soft cashmere, stretchy knit, lightweight chiffon, structured tweed
- **动态**: fabric sways gently, hem flutters in breeze, pleats catch light, drape follows body movement
- **展示**: twirls to show full skirt volume, adjusts collar detail, runs fingers along seam
- **场景**: sunlit café terrace, cherry blossom garden path, minimalist white studio, golden hour rooftop

### 3C 数码（Electronics）
- **材质**: anodized aluminum, gorilla glass surface, matte finish, chamfered edges catch light
- **动态**: screen illuminates face, finger glides across display, device rotates to reveal thin profile
- **展示**: holds up to camera showing screen, taps interface with precision, places on wireless charger
- **场景**: modern desk setup, coffee shop workspace, commuter holding device, bedside nightstand

### 美妆（Beauty）
- **质感**: dewy finish, velvety matte, glossy sheen, shimmering particles, creamy texture
- **动态**: applies with brush stroke, blends with fingertip, lips press together, eyelids flutter
- **展示**: close-up of application, before-after glow, product swatch on skin, mirror reflection
- **场景**: vanity mirror with ring light, bathroom morning routine, getting ready for night out

### 食品（Food）
- **质感**: steam rises, sauce glistens, crispy golden crust, juice drips, cheese stretches
- **动态**: pours into bowl, breaks apart to reveal filling, scoops with spoon, bites with satisfaction
- **展示**: overhead flat lay, cross-section reveal, slow-motion pour, garnish placement
- **场景**: rustic kitchen counter, outdoor picnic, cozy dining table, street food stall

### 家居（Home）
- **材质**: warm wood grain, soft linen texture, smooth ceramic, brushed brass hardware
- **动态**: hand caresses surface, opens drawer smoothly, arranges on shelf, light shifts across surface
- **展示**: styled vignette, before-after room transformation, detail close-up, scale with hand
- **场景**: morning light through curtains, minimalist living room, cozy bedroom corner, modern kitchen

## 模特与产品互动动作词汇表

### 通用动作
- **展示**: holds up to camera, presents with both hands, turns to show different angle
- **触摸**: runs fingers along, gently touches, traces the outline of
- **穿戴**: puts on, adjusts, styles with
- **使用**: opens, activates, applies
- **情感**: smiles confidently, looks surprised, nods approvingly, expresses delight

### 服装专用
- twirls gracefully, walks toward camera, poses with hand on hip, flips hair to show neckline, adjusts sleeve cuff, smooths fabric over hip, turns to reveal back detail

### 3C 专用
- unboxes with anticipation, swipes through interface, holds up comparing to face size, places in pocket to show portability, tilts to catch light on screen

### 美妆专用
- applies with practiced motion, checks reflection, touches cheek feeling texture, pouts showing lip color, blinks showing eye makeup

## 台词写作规范

**核心原则**：台词必须是英文，嵌入视频 prompt 中。不单独输出字幕。

**嵌入格式**（强制口型同步）：
```
Spoken dialogue (say EXACTLY, word-for-word): "..."
Mouth clearly visible when speaking, lip-sync aligned.
```
使用 `Spoken dialogue (say EXACTLY, word-for-word):` 而不是简单的 `says "..."`，可以显著提升口型同步精度。每句台词后跟 `Mouth clearly visible when speaking, lip-sync aligned.` 确保嘴部可见。

**风格**：闺蜜聊天感 — 像在跟朋友推荐，不像在念广告词。每句话都带具体信息（数字、对比、使用场景），没有废话。

### Hook 台词（0-3s）— 第一句话喊停用户

**颠覆型**（最有效）:
- "Stop scrolling — I threw out all my gym equipment for these three bands."
- "This tiny thing replaced my entire gym bag."
- "Business trip day three and I still have not skipped a workout."

**个人经历型**:
- "My nighttime routine that actually changed my body."
- "The one thing I have been recommending to literally everyone."

**关键**：开口必须快，配合快速运镜（whip pan / snap dolly in），不能慢热。

### 卖点台词（3-8s）— 具体参数 + 使用体验

- "Ten, fifteen, twenty pounds — I started pink, now I am on green, and they never roll up on you."
- "Three resistance levels, folds flat, weighs literally nothing — this is my entire travel gym."
- 必须包含：具体数字 + 个人使用感受 + 差异化优势

### 场景台词（8-12s）— 在哪用 + 便携/多功能

- "I do legs in my living room, arms on work trips — they fold smaller than my phone."
- "Park, backyard, hotel balcony — I have zero excuses now."
- 必须包含：至少 2 个使用场景 + 便携性/多功能性

### 收尾台词（12-15s）— 自然个人推荐，不硬推销

**好的收尾**（推荐）:
- "Honestly the best forty bucks I have spent this year."
- "Trust me just start — future you will be so grateful."
- "Best thing I ever packed."
- "You are welcome."

**避免的收尾**（太生硬）:
- ~~"Link below — grab yours before they sell out."~~
- ~~"Click the link for a special discount."~~
- ~~"库存不多了，想要的赶紧！"~~

## Hook 策略（前 3 秒生死线）

**数据**：63% 高 CTR 的 TikTok 视频在前 3 秒就抓住用户。用户做出"看 or 划走"决策只需 **1.7 秒**。3 秒留存率 65%+ 的视频获得 **4-7 倍**曝光。

### 视觉 Hook 技巧（选一个用于 prompt 开头）

| 技巧 | Prompt 写法 | 效果 |
|------|-------------|------|
| **极速 zoom-in** | `Camera snaps in extreme close-up on the [product]` | 产品第 1 帧出现，冲击力最强 |
| **产品滑入画面** | `The [product] slides into frame from the right` | 突然出现，制造微悬念 |
| **手持举起** | `A hand thrusts the [product] toward the camera` | 直接、UGC 感强 |
| **特写→全景反转** | `Extreme macro on [texture detail], camera rapidly pulls back to reveal...` | 先抓细节好奇，再揭示全貌 |
| **Whip pan 甩入** | `Camera whip-pans with motion blur and lands on the [product]` | 节奏感强，视觉冲击 |

### Hook 核心规则

1. **产品必须在第 1 秒出现** — 不能先拍人走路、开门、铺环境
2. **第 1 秒必须有运动** — 静止开场 = 被划走
3. **模特必须在前 2 秒开口说话** — 声音比画面更能留人
4. **Hook 台词要像在喊停朋友** — 不是念广告词

### Hook 台词公式（按效果排序）

1. **结果前置**: "This $30 bag replaced my gym bag AND my purse." — 直接展示结果
2. **颠覆型**: "Stop carrying two bags to the gym — you only need this one." — 挑战现有习惯
3. **社交证明**: "200K people bought this last month and I finally get why." — FOMO
4. **痛点提问**: "Why is your gym bag always so heavy?" — 直击痛点
5. **个人故事**: "I was that person with three bags until I found this." — 共鸣

## 运镜节奏建议（15 秒连续镜头）

```
[0-3s]  HOOK — 产品第 1 帧出现！极速运镜 + 立即开口
        推荐：extreme close-up snap in / whip pan / product slides into frame
        禁止：camera slowly pushes in, 人物走路铺垫, 空镜头开场
        节奏：1-2 秒内完成第一个运镜变化

[3-8s]  SHOWCASE — 特写 → 中景切换，展示产品细节
        推荐：fast snap dolly in on details,
              camera orbits or slides to reveal texture

[8-12s] SCENE — 拉远到中景/全景，展示使用场景
        推荐：camera pulls back to reveal full scene,
              natural movement as model interacts with environment

[12-15s] CLOSE — 回到中景，面对镜头，定格
         推荐：camera pushes in tight, then settles,
               model faces camera, product in frame,
               frame holds steady（最后这个定格很重要）
```

## BGM 音乐指令（Prompt 内指定）

视频模型可以在视频中生成背景音乐。**必须在 prompt 末尾加上 BGM 指令**：

```
Background music: [genre/mood description], [tempo], [energy level].
```

**BGM 选择指南**：

| 商品类型 | 推荐 BGM | Prompt 写法 |
|----------|----------|-------------|
| 运动/健身 | 节奏感强的电子/lo-fi | `Background music: upbeat electronic lo-fi beat, medium-fast tempo, energetic and motivating.` |
| 美妆/护肤 | 温暖 R&B / chill pop | `Background music: warm chill R&B, slow-medium tempo, soft and intimate.` |
| 3C 数码 | 干净 minimal / tech | `Background music: clean minimal electronic, medium tempo, modern and sleek.` |
| 时尚服装 | Indie pop / trendy | `Background music: trendy indie pop, medium tempo, stylish and confident.` |
| 家居 | Acoustic / ambient | `Background music: warm acoustic guitar, slow tempo, cozy and relaxing.` |
| 食品 | Jazz / feel-good | `Background music: feel-good jazz, medium tempo, cheerful and appetizing.` |

**关键**：BGM 要配合视频节奏 — Hook 段需要能量感，收尾段可以稍缓。音乐风格要匹配产品调性。

## Prompt 写作风格：导演口述式（Director Dictation）

Prompt 应写成导演在片场口述指令的风格 — 6-10 句英文，每句只做一件事。避免把多个动作堆在一句长句里。

**好的写法**（每句一个动作/镜头指令）：
```
Camera snaps in on a close-up of the pink peanut massage ball sitting on a yoga mat.
A 25-year-old woman with a high ponytail and black leggings walks into frame.
She picks up the ball and holds it up to the camera.
Spoken dialogue (say EXACTLY, word-for-word): "This little thing saved my back after deadlifts."
Mouth clearly visible when speaking, lip-sync aligned.
She places the ball on the mat and lies down on it, rolling her spine.
Camera pulls back to a medium shot showing the full living room scene.
...
```

**不好的写法**（一句话塞太多动作）：
```
A woman enters carrying a pink ball while the camera pans and she says "..." as she lies down and rolls.
```

## Prompt 质量检查清单

- [ ] 纯英文导演口述式段落（6-10 句，每句一件事）
- [ ] **开头有产品锚定**（一句话：产品是什么 + 用途 + 匹配参考图 + 无包装锁）
- [ ] 紧接有模特外观锚定描述
- [ ] **台词用 `Spoken dialogue (say EXACTLY, word-for-word):` 格式**（英文，4 句，闺蜜聊天感）
- [ ] 每句台词后跟 `Mouth clearly visible when speaking, lip-sync aligned.`
- [ ] Hook 台词在第一句，配合快速运镜
- [ ] 收尾台词自然不硬推销
- [ ] 包含具体的产品材质描述词
- [ ] 运镜变化至少 3 次
- [ ] 包含光线/氛围描述
- [ ] 模特与产品有明确互动
- [ ] 结尾 frame holds steady
- [ ] 整体节奏：快开 → 细展 → 场景 → 定格
- [ ] **末尾有 BGM 指令**（`Background music: [genre], [tempo], [energy]`）
- [ ] Hook 段产品在第 1 帧出现，不铺垫

## Renoise 提交注意事项

- **必须上传商品图**作为 material（image1），产品还原度显著提升
- **不上传真人模特图**，隐私检测会拦截（报错 PrivacyInformation）
- 模特外观完全靠 prompt 文字描述控制
- 商品图最好用干净白底纯产品图，避免有营销文字覆盖的图
- 批量生成时复用同一 material ID，换场景/台词即可
