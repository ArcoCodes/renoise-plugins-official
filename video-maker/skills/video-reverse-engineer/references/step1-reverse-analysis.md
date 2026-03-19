# 步骤1：逆向拆解 — 详细规则

## 目录
1. [时长锁定规则](#时长锁定规则)
2. [语言识别规则](#语言识别规则)
3. [输出0：全片统一设定卡](#输出0全片统一设定卡)
4. [输出1：逐句脚本证据表](#输出1逐句脚本证据表)
5. [输出2：分镜头逆向主表](#输出2分镜头逆向主表)
6. [输出3：自检清单](#输出3自检清单)

---

## 时长锁定规则

在输出任何表格之前，必须先完成时长锁定：

1. 从视频播放器/文件信息读取全片真实总时长，记为 **T**（秒）
2. 如果显示为 mm:ss 或 mm:ss.xx，换算成秒（保留1位小数）
3. 若只能读到整数秒，就用整数秒
4. 后续所有时间戳必须满足：`0 <= start_sec < end_sec <= T`
5. 输出2的Shot表必须覆盖完整区间 `[0.0, T]`
6. 最后一个Shot的 `end_sec` 必须严格等于 T
7. 即使最后几秒是黑屏/纯环境声/纯字幕，也必须单独成Shot覆盖到 T

---

## 语言识别规则

- 自动识别原视频主要口播语言 `primary_language`
- 多语言混用时，以口播占比最高的语言为准
- 必须在输出0中写明 `primary_language`

---

## 输出0：全片统一设定卡

非表格，用文字输出以下全部字段：

### A. 基础信息
- `primary_language`：原视频主要口播语言
- `aspect_ratio`：画幅（如 9:16 / 16:9 / 1:1）
- `video_type`：视频类型质感（Vlog/商业片/口播测评/情景剧/混合，并说明占比）
- `platform_hint`：更像哪个平台的节奏（抖音/小红书/快手/视频号/TikTok/Reels），给出依据
- `total_duration_sec`：全片时长（秒）

### B. 表达与节奏
- `overall_tone`：整体情绪调性（中文短语）
- `energy_level`：低/中/高
- `speaking_style`：像朋友聊天/像导购/像专家/夸张搞笑等
- `speech_rate`：慢/中/快
- `persuasion_mode`：种草/讲痛点/对比证明/强催单/反复强调利益点等
- `emotion_curve`：开头→中段→结尾，情绪推进方式

### C. 视觉统一
- `color_tone`：暖/冷/中性；偏什么颜色
- `lighting_style`：自然光/柔光/硬光/棚拍/霓虹等
- `atmosphere_keywords`：氛围关键词（干净/生活感/高级/紧张/治愈等）
- `visual_density`：信息密度（清爽/中等/很满）
- `composition_bias`：构图偏好（居中/三分法/留白/强调产品细节等）

### D. 音频统一
- `bgm_style`：BGM类型（流行/电子/轻快/无BGM等）
- `vocal_processing`：人声处理（原声/降噪明显/电台感/混响等）
- `sfx_density`：音效密度（少/中/多）

### E. 合规统一约束
- `forbidden_claims_risk`：潜在风险点（绝对化/夸大功效/医疗暗示/承诺式表达等）
- `must_disclose`：必须说明的信息（价格规则/优惠条件/适用范围等）

---

## 输出1：逐句脚本证据表

Markdown 表格，每行 = 一句原始台词。字段顺序固定：

| 字段 | 说明 |
|------|------|
| `id` | 句子编号 |
| `start_sec` | 开始秒数 |
| `end_sec` | 结束秒数 |
| `duration_sec` | 时长（= end - start） |
| `original_text` | 原始台词，不得改写 |
| `zh_translation` | 中文翻译，与原句一一对应 |
| `on_screen_text_seen` | 该句时段屏幕出现的文字/价格/优惠，原样抄录；看不清写【看不清】 |
| `key_info_notes` | 关键信息提取：品牌/产品名/规格/价格/优惠/购买路径/承诺点 |
| `clarity_notes` | 清晰度备注：听不清用【听不清】并写原因 |

### 规则
- 逐句翻译一一对应，不允许合并翻译
- 听不清用【听不清】标注 `original_text`，`clarity_notes` 写原因
- `duration_sec = end_sec - start_sec`，必须准确
- 不得改写 `original_text`，不得润色
- 所有句子的 `end_sec` 必须 <= T

---

## 输出2：分镜头逆向主表

Markdown 表格，每行 = 一个 Shot。字段顺序固定（不得增删列）：

| # | 字段名 | 说明 |
|---|--------|------|
| 1 | `shot_id` | Shot编号 |
| 2 | `start_sec` | 开始秒数 |
| 3 | `end_sec` | 结束秒数 |
| 4 | `duration_sec` | 时长 |
| 5 | `scene_group_id` | 场景组ID |
| 6 | `scene_title_cn` | 场景中文标题 |
| 7 | `shot_title_cn` | 镜头中文标题 |
| 8 | `shot_goal` | 镜头目的：Hook/卖点/演示/对比证明/打消顾虑/报价优惠/催单CTA等 |
| 9 | `aspect_ratio` | 画幅 |
| 10 | `video_type_tag` | 本Shot质感 |
| 11 | `visual_content_description` | 画面内容描述：用"看见什么+怎么变化"写清楚 |
| 12 | `location_setting` | 场景设置 |
| 13 | `character_desc` | 人物描述 |
| 14 | `emotion_state` | 人物情绪 |
| 15 | `action_blocking` | 动作与调度 |
| 16 | `product_desc` | 商品描述 |
| 17 | `must_show` | 必须露出的细节 |
| 18 | `on_screen_text_graphics` | 屏幕字/贴纸/价格标签 |
| 19 | `camera_shot_size` | 景别 |
| 20 | `camera_angle` | 机位角度 |
| 21 | `camera_movement` | 镜头运动 |
| 22 | `composition_notes` | 构图要点 |
| 23 | `lighting_atmosphere` | 光线+氛围 |
| 24 | `color_grading` | 调色倾向 |
| 25 | `dialogue_vo_original` | 该Shot口播原文合集（按句子id用" / "分隔） |
| 26 | `dialogue_vo_zh` | 该Shot中文翻译合集（按句子id用" / "分隔） |
| 27 | `language_style` | 台词语言与表达风格 |
| 28 | `emphasis_notes` | 强调词与停顿 |
| 29 | `audio_bgm` | BGM |
| 30 | `audio_sfx` | SFX音效 |
| 31 | `ambient_sound` | 环境声 |
| 32 | `editing_transition` | 剪辑与转场 |
| 33 | `pacing_notes` | 节奏备注 |
| 34 | `constraints_real_shoot` | 实拍约束 |
| 35 | `constraints_compliance` | 合规风险点 |
| 36 | `reverse_constraints` | 反向约束："不希望出现什么" |
| 37 | `assets_needed` | 素材需求 |
| 38 | `sentence_mapping` | 对应输出1的句子id |
| 39 | `mapping_notes` | 映射备注 |

### Shot 切分规则
- 以"剪辑切点/画面明显变化/机位变化/主体任务切换"为边界
- 必须覆盖 [0, T] 全区间，不遗漏
- Shot 按时间顺序递增，不交叉
- 允许无缝衔接（前Shot的 end = 后Shot的 start）
- 同一句台词跨多个Shot时，在 `mapping_notes` 说明"跨镜头"

### 内容规则
- `visual_content_description`：写清主体/动作/环境/变化，不抽象堆砌形容词
- `dialogue_vo_original` 与 `dialogue_vo_zh`：只能拼接原句，不得概述/重写/润色
- 无口播Shot：dialogue列写"（无口播）"，`sentence_mapping` 写"无"

---

## 输出3：自检清单

逐条回答并给证据：

### A. 覆盖与时间
- Shot是否覆盖完整视频且无遗漏？（给出首尾Shot的起止点）
- Shot是否严格时间递增且不交叉？（抽查至少10条）
- 每行 `duration_sec` 是否正确？（抽查至少10条计算示例）
- `total_duration_sec` 是否严格等于 T？
- 最后一个Shot的 `end_sec` 是否严格等于 T？
- Shot覆盖是否无缝（每个Shot_i.end == Shot_{i+1}.start）？抽查至少10处

### B. 忠实度
- `original_text` 是否有改写/润色/压缩/增补？（必须"否"）
- `dialogue_vo_original/zh` 是否严格按句子拼接且用" / "分隔？

### C. 翻译一致性
- 输出1是否一句原文对应一句中文翻译？

### D. 映射一致性
- 每个Shot是否都给了 `sentence_mapping` 或明确"无口播"？
- 跨Shot句子是否在 `mapping_notes` 标注？

### E. 关键信息与约束
- 价格/优惠/规格等是否在对应字段体现？
- `reverse_constraints` 是否每个Shot都可执行？
