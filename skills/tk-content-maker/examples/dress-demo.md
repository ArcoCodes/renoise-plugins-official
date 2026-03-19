# 完整示例：Keep 弹力阻力带 15 秒带货视频

## 输入

- 商品图：Keep 品牌弹力阻力带，3 条装（粉/蓝/绿），马卡龙配色
- 模特参考：运动风女性，金发马尾，运动内衣+紧身短裤（仅供分析，不上传 YOUMENG）

## 商品分析结果

```json
{
  "product": {
    "type": "弹力阻力带 / resistance loop bands",
    "color": "粉色 10lb, 蓝色 15lb, 薄荷绿 20lb",
    "material": "TPE 弹性材质，哑光质感，柔软亲肤",
    "highlights": "三条不同阻力渐进训练，可折叠便携，马卡龙高颜值配色",
    "brand_tone": "年轻运动，时尚健身"
  },
  "model": {
    "gender": "female",
    "age_range": "25-30",
    "hair": "金发高马尾",
    "outfit": "黑色运动内衣 + 黑色紧身短裤",
    "vibe": "自信、活力、专业健身感"
  },
  "scene_suggestions": [
    "明亮现代客厅晨练",
    "酒店房间旅行健身",
    "卧室睡前拉伸"
  ],
  "selling_points": [
    "三条不同阻力，渐进式训练，适合入门到进阶",
    "小巧便携，可折叠放包里随时随地练",
    "马卡龙色系高颜值，不卷边"
  ]
}
```

## 生成脚本

### 1. Seedance Prompt（英文，含台词）

> The product is a set of three Keep brand elastic resistance loop bands — flat, wide, smooth matte TPE material with a soft rubbery texture, each band approximately 5cm wide and forming a closed loop. Colors: pastel pink (lightest resistance), sky blue (medium), mint green (heaviest). Each band has a small white "Keep" logo printed on the surface. The bands must match the reference image exactly in color, width, shape, material finish, and logo placement throughout every frame of the video. A fit young woman in her mid-twenties with blonde hair in a high ponytail, light tan skin, athletic build, wearing a black sports bra and black fitted shorts, holds the three pastel-colored Keep resistance bands fanned out in her hand — camera starts extreme close-up on the bands showing their flat wide shape and matte surface then whip pans up to her face as she says "Stop scrolling — I threw out all my gym equipment for these three bands." Morning sunlight from a large window catches the smooth TPE finish. Camera does a fast snap dolly in on her hands as she stretches the blue band taut, the flat wide band maintaining its shape and thickness as it stretches, she says "Ten, fifteen, twenty pounds — I started pink, now I am on green, and they never roll up on you." She has the mint green band already looped around both ankles, camera pulls back to medium shot as she performs side leg raises, the wide flat band visible around her ankles keeping its shape, she says "I do legs in my living room, arms on work trips — they fold smaller than my phone" while transitioning into a squat pulse with the pink band above her knees. Without stopping she grabs all three bands, folds them into a tiny square and tucks them into a small gym bag pocket, camera pushes in tight, then she looks straight into the camera with a knowing grin and says "Honestly the best forty bucks I have spent this year," the pastel colors pop against her black outfit, warm golden backlight creates a soft halo, frame holds steady.

### 2. 台词脚本（英文）

```
[0-3s]   "Stop scrolling — I threw out all my gym equipment for these three bands."
[3-8s]   "Ten, fifteen, twenty pounds — I started pink, now I'm on green, and they never roll up on you."
[8-12s]  "I do legs in my living room, arms on work trips — they fold smaller than my phone."
[12-15s] "Honestly the best forty bucks I've spent this year."
```

### 3. BGM/音效建议

- **BGM**：高能量 trap-pop beat，BPM 125-135，bass drop 配合 0s hook
- **音效**：
  - [0s] 弹力带 snap 回弹声 — 配合开场冲击
  - [3s] 快速 whoosh 转场音
  - [8s] 运动节奏鼓点加重
  - [12s] bass swell + 定格 hit

## YOUMENG 提交

```bash
# 1. 上传商品图（只传商品图，不传模特图）
ALL_PROXY=http://127.0.0.1:6152 curl -s -X POST \
  'https://staging--ujgsvru36x4korjj10nq.edgespark.app/api/materials/upload' \
  -H 'Authorization: Bearer <TOKEN>' \
  -F "file=@<商品图路径>" -F "type=image"
# → 返回 material id，例如 194

# 2. 提交任务（带商品图 material）
ALL_PROXY=http://127.0.0.1:6152 curl -s -X POST \
  'https://staging--ujgsvru36x4korjj10nq.edgespark.app/api/tasks' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "<上面的 Seedance Prompt>",
    "model": "seedance-2.0",
    "duration": 15,
    "ratio": "9:16",
    "tags": ["ecom", "keep", "resistance-band"],
    "materials": [{"id": 194, "role": "image1"}]
  }'
```

## 多场景批量生成

同一商品可复用 material ID，换不同场景生成多个视频：

| 场景 | Hook 台词 | 场景关键词 |
|------|----------|-----------|
| 户外公园晨练 | "This tiny thing replaced my entire gym bag." | sunlit park lawn, golden hour, dewy grass |
| 酒店旅行健身 | "Business trip day three and I still have not skipped a workout." | hotel room, city skyline, suitcase |
| 卧室睡前拉伸 | "My nighttime routine that actually changed my body." | cozy bedroom, string lights, yoga mat |
