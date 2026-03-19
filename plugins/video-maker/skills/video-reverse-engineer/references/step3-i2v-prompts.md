# 步骤3：I2V 提示词生成 — 详细规则

## 目录
1. [输入说明](#输入说明)
2. [GLOBAL_LOCK_CARD](#global_lock_card)
3. [逐Shot输出格式](#逐shot输出格式)
4. [英文提示词写作规范](#英文提示词写作规范)
5. [商品一致性硬锁](#商品一致性硬锁)
6. [口播融合规则](#口播融合规则)
7. [参考帧提醒规则](#参考帧提醒规则)
8. [自检清单](#自检清单)

---

## 输入说明

本步骤接收四份输入：

- **输入A**：原始对标视频（学习镜头节奏、运镜风格、动作表演、口播节奏、情绪曲线）
- **输入B**：人物参考图（人物外观以此为准；可选，无则跳过人物锁定细节）
- **输入C**：商品参考图（商品外观以此为唯一真相；可选，无则跳过商品硬锁）
- **输入D**：最终Shot表（步骤2的完整输出，含改写台词和参考帧信息）

如果用户未提供输入B或C，在对应的锁定描述中写"待提供参考图后补充"，其余部分正常输出。

---

## GLOBAL_LOCK_CARD

在逐Shot输出之前，先输出一段全片统一锁定声明（自然语言，非表格）：

### 人物锁
全片只有人物参考图中的同一个主角，脸/发型/肤色/年龄感一致。穿搭与妆发风格贯穿全片（除非Shot表明确写换装）。不新增第二主角。

### 商品锁
所有出现的产品必须是商品参考图中的同一个商品。所有商品细节只以商品参考图为准。

### 禁包装锁
严禁出现商品参考图未出现的任何商品相关元素：包装盒/包装袋/说明书/防伪卡/吊牌/赠品/配件盒/新标签/额外文字。若参考图看不到包装，则全片表现为"产品已完全脱离包装状态（already out of any packaging）"。

### 画面统一锁
画幅、色调、光线、质感尽量一致。镜头运动整体克制，避免快速旋转/夸张抖动导致人物或产品漂移变形。不脑补新增品牌物料与道具。

### 音画同步锁
每个有口播的Shot必须逐字说出 `rewrite_vo_target_language`。嘴部尽量可见，口型与台词同步。强调词/停顿/语速参考 `emphasis_notes`。

---

## 逐Shot输出格式

每个Shot严格按以下结构输出：

```
[SHOT {shot_id}]

(1) REFERENCE_FRAME_INFO
Reference frame timestamp: {ref_frame_timestamp_sec}s
Reference frame guidance: {ref_frame_basis 一句话}
[如需要，加参考帧提醒]

(2) I2V_PROMPT_FOR_MODEL_EN
[英文导演分镜口述稿，6-10句]

(3) I2V_PROMPT_ZH_CHECK
[中文逐句核对版，句数/顺序/含义完全对应英文]

(4) SELF_CHECK_HINT
[一行中文：有口播/无口播、有商品/无商品、是否触发参考帧提醒]
```

---

## 英文提示词写作规范

### 整体结构
采用"导演口述分镜稿"风格，6-10句，每句只干一件事。

### 必须包含的元素

**Timecode**（必须）：
```
Shot {N} ({start}-{end}).
```
时间格式用 `(M:SS–M:SS)` 或 `(X.X–Y.Y)`。

**Visual**（必须）：
自然融合以下信息：
- 景别 `camera_shot_size`（close-up/medium/wide）
- 角度 `camera_angle`（eye-level/top-down/side）
- 运动 `camera_movement`（static/gentle push-in/slight handheld/slow pan，强度克制）
- 动作 `action_blocking`
- 氛围 `lighting_atmosphere` + `color_grading`
- 必须写：**Keep lighting and overall look consistent with the reference frame.**
- 屏幕字 `on_screen_text_graphics`（位置不遮挡产品）
- 节奏 `pacing_notes` / `editing_transition`（一句话概括）

**结尾**：必须说明"镜头最后停在哪个画面点"，方便拼接。

---

## 商品一致性硬锁

只要该Shot出现产品，必须包含以下两条英文硬句（原样输出不得改写）：

**硬句1**：
```
The product must be EXACTLY the same as the product in the reference product images—same shape, size proportions, color, material, logo, packaging (if and only if visible in the reference), and readable text. Do not redesign, replace, relabel, or alter it in any way.
```

**硬句2**：
```
No additional product-related items are allowed beyond what is visible in the reference product images (no extra box, packaging, pouch, manual, tag, accessories, or new labels). Do not invent packaging.
```

**中文保险句**（紧跟硬句之后）：
```
所有产品细节完全以商品参考图为准，参考图没出现的包装/配件/标签一律禁止出现。
```

---

## 口播融合规则

### 有口播的Shot
必须包含以下两行（结构不得省略）：

```
Spoken dialogue (say EXACTLY, word-for-word): "{rewrite_vo_target_language 原样粘贴}"
Mouth clearly visible when speaking, lip-sync aligned with the spoken dialogue.
```

如果 `emphasis_notes` 有强调词/停顿/语速，用1句描述"强调时镜头或动作怎么配合"。

### 无口播的Shot
必须写：
```
No spoken dialogue. Keep motion subtle and editable.
```

---

## 参考帧提醒规则

如果该Shot需要产品露出，且提供的参考帧里仍是"对标商品"（非用户自己的商品）且清晰可见，必须加以下中文提醒：

```
⚠️ 建议换参考帧：选产品不清晰/不入镜的帧，或先把参考帧里的产品替换成商品参考图的产品，再用于I2V，否则模型容易沿用旧产品。
```

---

## 中文核对版规则

`I2V_PROMPT_ZH_CHECK` 是英文提示词的逐句中文翻译：
- 句子数量与顺序必须完全一致
- 不得新增信息
- 不得合并句子
- 不得改写含义

---

## 禁止事项

- 不得改动Shot表任何原列的原内容
- 不得新增/删除/合并Shot
- 不得虚构原视频未出现的信息（不新增承诺、效果数据、对比结论）
- 不得改变硬信息含义（价格/优惠/时间/数量/规格/购买动作）
- 不得为无口播Shot强行写口播

---

## 自检清单

逐条给出"通过/不通过+证据"：

1. Shot数量是否与Shot表一致且按shot_id顺序？
2. 每个Shot是否包含(1)(2)(3)(4)四块？
3. 有口播Shot是否逐字包含 `Spoken dialogue (say EXACTLY...)` 且台词原样粘贴？
4. 有口播Shot是否包含 `lip-sync aligned` 描述？
5. 有商品Shot是否包含两条英文商品硬锁句？（列出shot_id）
6. 是否禁止出现商品参考图没有的包装/配件/标签？（列shot_id证据）
7. 中文核对版是否逐句对应英文（句数一致、顺序一致、无新增）？
8. 是否无编造硬信息（价格/功效/数据等）？
