---
name: tts
description: "Azure TTS 语音合成工具。支持 628 种音色、153 种语言。用于文字转语音、语音合成、朗读文本、配音。触发词：tts、语音合成、文字转语音、text to speech、朗读、配音、生成语音。"
---

# Azure TTS 语音合成

文字转语音，支持 628 种音色、153 种语言/地区。**纯 bash 实现，仅依赖 curl，无需 Python**。

## 依赖

```bash
# macOS 已预装 curl，无需额外安装
# 音色列表功能需要 python3（macOS 自带）或 jq
brew install jq  # 可选
```

## 快速开始

```bash
# 中文语音合成（默认晓晓）
./skills/tts/scripts/tts.sh -t "你好，欢迎使用语音合成"

# 指定英文音色
./skills/tts/scripts/tts.sh -t "Hello, welcome to Azure TTS" -v en-US-JennyNeural -o hello.mp3

# HD 高清音色
./skills/tts/scripts/tts.sh -t "这是高清语音" -v "zh-CN-Xiaochen:DragonHDLatestNeural"

# 调节语速和音调
./skills/tts/scripts/tts.sh -t "慢速播放" -r "-30%" --pitch "+5%"

# 带情感风格（仅部分音色支持）
./skills/tts/scripts/tts.sh -t "太开心了！" -s cheerful

# 从文件读取长文本
./skills/tts/scripts/tts.sh -t @article.txt -v zh-CN-YunyangNeural -o narration.mp3

# 输出 WAV 格式
./skills/tts/scripts/tts.sh -t "高质量音频" -f wav -o output.wav

# 高清 MP3（48kHz 192kbps）
./skills/tts/scripts/tts.sh -t "高清音质" -f mp3-hd -o hd.mp3

# 列出可用中文音色
./skills/tts/scripts/tts.sh -l --lang zh

# 列出所有英文音色
./skills/tts/scripts/tts.sh -l --lang en

# 搜索音色
./skills/tts/scripts/tts.sh -l --search "cheerful"

# 静默模式（只输出文件路径，方便管道）
output=$(./skills/tts/scripts/tts.sh -t "test" -q)
echo "Generated: $output"
```

## 参数说明

| 参数 | 短写 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--text` | `-t` | 是* | - | 要合成的文本，`@file.txt` 从文件读取 |
| `--voice` | `-v` | 否 | `zh-CN-XiaoxiaoNeural` | 音色名称（ShortName） |
| `--output` | `-o` | 否 | `./tts_output.mp3` | 输出文件路径 |
| `--format` | `-f` | 否 | `mp3` | 输出格式：mp3 / mp3-hd / wav / wav-hd |
| `--rate` | `-r` | 否 | `+0%` | 语速：-50% ~ +200% |
| `--pitch` | | 否 | `+0%` | 音调：-50% ~ +50% |
| `--style` | `-s` | 否 | - | 说话风格（如 cheerful, sad, angry） |
| `--quiet` | `-q` | 否 | - | 静默模式，只输出文件路径 |
| `--list-voices` | `-l` | 否 | - | 列出可用音色 |
| `--lang` | | 否 | - | 按语言过滤（zh/en/ja/ko 等） |
| `--search` | | 否 | - | 按关键词搜索音色 |

*`--text` 与 `--list-voices` 二选一。

## 支持的说话风格

部分音色（如 `zh-CN-XiaoxiaoNeural`）支持情感风格：

| 风格 | 说明 |
|------|------|
| `cheerful` | 开心、愉快 |
| `sad` | 悲伤 |
| `angry` | 愤怒 |
| `fearful` | 恐惧 |
| `friendly` | 友好 |
| `serious` | 严肃 |
| `gentle` | 温柔 |
| `newscast` | 新闻播报 |
| `narration` | 旁白叙述 |
| `customerservice` | 客服 |
| `chat` | 闲聊 |
| `whispering` | 耳语 |

## 输出格式

成功时：

```json
{
  "success": true,
  "output_path": "./tts_output.mp3",
  "voice": "zh-CN-XiaoxiaoNeural",
  "format": "mp3",
  "size_bytes": 62208,
  "duration_estimate_seconds": 3.9
}
```

失败时：

```json
{
  "success": false,
  "error": "Error message"
}
```

静默模式（`-q`）下只输出文件路径，方便管道使用。

## 音色选择建议

| 场景 | 推荐音色 |
|------|----------|
| 中文通用女声 | `zh-CN-XiaoxiaoNeural` |
| 中文通用男声 | `zh-CN-YunxiNeural` |
| 中文新闻播报 | `zh-CN-YunyangNeural` |
| 中文故事旁白 | `zh-CN-YunjianNeural` |
| 中文温柔女声 | `zh-CN-XiaohanNeural` |
| 中文 HD 高清 | `zh-CN-Xiaochen:DragonHDLatestNeural` |
| 英文通用女声 | `en-US-JennyNeural` |
| 英文 HD 女声 | `en-US-Ava:DragonHDLatestNeural` |
| 英文 HD 男声 | `en-US-Andrew:DragonHDLatestNeural` |
| 多语言 | `zh-CN-XiaoxiaoMultilingualNeural` |

## 详细音色列表

完整的 628 种音色列表，参见 [references/voices.md](references/voices.md)。
