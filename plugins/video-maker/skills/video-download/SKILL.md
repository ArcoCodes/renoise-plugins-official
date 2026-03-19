---
name: video-download
description: >
  使用 yt-dlp 下载 YouTube、TikTok 等平台视频到本地 MP4 文件。
  当用户提到"下载视频"、"保存视频"、"yt-dlp"、"YouTube 下载"、"TikTok 下载"、
  "视频链接"、或直接粘贴视频 URL 时触发此技能。
---

# 使用 yt-dlp 下载视频

从 YouTube、TikTok 等平台下载视频到本地 MP4 文件，处理格式选择、去重和平台特殊情况。

## 环境准备

```bash
yt-dlp --version
```

如未安装：`brew install yt-dlp`（macOS）或 `pip install yt-dlp`。

## 输出路径

下载的视频统一保存到 `resources/references/` 目录：

```
resources/references/<video_id>.mp4
```

## 核心命令

```bash
yt-dlp \
  -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' \
  --merge-output-format mp4 \
  --no-playlist \
  --max-filesize 200M \
  -o 'resources/references/<video_id>.mp4' \
  '<URL>'
```

### 参数说明

| 参数 | 作用 |
|------|------|
| `-f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'` | 优先选择原生 MP4 流，避免重编码，逐级回退 |
| `--merge-output-format mp4` | 合并音视频流时保证输出 MP4 |
| `--no-playlist` | 防止误下载整个播放列表 |
| `--max-filesize 200M` | 安全限制，防止下游处理（Whisper、Gemini）文件过大 |
| `-o <path>` | 指定输出路径，确保文件位置可预测 |

## 视频 ID 提取

使用平台前缀生成唯一、可去重的文件名：

| 平台 | 正则 | 示例 ID |
|------|------|---------|
| YouTube | `/(?:youtube\.com\/(?:watch\?v=\|shorts\/\|embed\/)\|youtu\.be\/)([\w-]{11})/` | `yt-dQw4w9WgXcQ` |
| TikTok | `/tiktok\.com\/.*?(\d{15,})/` | `tk-7571284267028729101` |
| 其他 | URL 的 Base64url 编码，取前 16 字符 | `vid-aHR0cHM6Ly93d3` |

## 去重检查

下载前必须检查文件是否已存在：

```bash
OUTPUT="resources/references/yt-dQw4w9WgXcQ.mp4"
if [ -f "$OUTPUT" ]; then
  echo "Already downloaded: $OUTPUT"
else
  yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' \
    --merge-output-format mp4 --no-playlist --max-filesize 200M \
    -o "$OUTPUT" 'https://youtube.com/watch?v=dQw4w9WgXcQ'
fi
```

## 常见错误

| 错误 | 解决 |
|------|------|
| `HTTP Error 403` | TikTok 地域限制，加 `--cookies-from-browser chrome` 重试 |
| `Requested formats are incompatible for merge` | yt-dlp 会自动重编码，输出仍为 MP4，无需处理 |
| `is not a valid URL` | URL 需要引号包裹，使用单引号 |
| 文件存在但 0 字节 | 下载中断，删除文件后重试 |
| `--max-filesize` 跳过 | 视频超过 200M，降低画质：`-f 'best[height<=720]'` |

## TikTok 特别说明

TikTok 视频大概率需要 cookies 才能下载成功。如果遇到 403 错误，使用：

```bash
yt-dlp \
  -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' \
  --merge-output-format mp4 \
  --no-playlist \
  --max-filesize 200M \
  --cookies-from-browser chrome \
  -o 'resources/references/<video_id>.mp4' \
  '<URL>'
```

## 批量下载

```bash
for URL in 'https://youtube.com/watch?v=abc' 'https://tiktok.com/@user/video/123'; do
  yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' \
    --merge-output-format mp4 --no-playlist --max-filesize 200M \
    -o 'resources/references/%(id)s.mp4' "$URL"
done
```

注意：`%(id)s` 是 yt-dlp 内置的平台视频 ID 模板，批量下载时可以用这个简化，但不带 `yt-`/`tk-` 前缀。
