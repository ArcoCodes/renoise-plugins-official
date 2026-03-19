#!/usr/bin/env bash
set -euo pipefail

KLING_ACCESS_KEY="${KLING_ACCESS_KEY:-A9BetHmeBGNFQhTg4NLhANCKFhBTNFD4}"
KLING_SECRET_KEY="${KLING_SECRET_KEY:-CCPANRbep3hYgRTMQMtBHf9DGaRr9gJf}"
KLING_API_BASE="${KLING_API_BASE:-https://api-beijing.klingai.com}"
KLING_OMNI_PATH="/v1/videos/omni-video"
KLING_MOTION_PATH="/v1/videos/motion-control"

# ── 绕过本地代理(Surge等)直连 API ────────────────────────────
_kling_resolve_opt() {
  local host
  host=$(echo "$KLING_API_BASE" | sed -E 's|https?://||;s|/.*||')
  # 通过 DoH 获取真实 IP，绕过可能的 DNS 劫持
  local real_ip
  real_ip=$(curl -sS --noproxy '*' --connect-timeout 5 \
    "https://dns.google/resolve?name=${host}&type=A" 2>/dev/null \
    | grep -oE '"data"\s*:\s*"[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"' \
    | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' || true)
  if [[ -n "$real_ip" ]]; then
    echo "--resolve ${host}:443:${real_ip}"
  fi
}
KLING_CURL_RESOLVE=$(_kling_resolve_opt)

# ── JWT 签名 (HS256, 仅依赖 openssl) ──────────────────────────

base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

sign_jwt() {
  local now
  now=$(date +%s)
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload
  payload=$(printf '{"iss":"%s","exp":%d,"nbf":%d}' \
    "$KLING_ACCESS_KEY" "$((now + 1800))" "$((now - 5))")

  local h b
  h=$(printf '%s' "$header"  | base64url)
  b=$(printf '%s' "$payload" | base64url)

  local sig
  sig=$(printf '%s.%s' "$h" "$b" \
    | openssl dgst -sha256 -hmac "$KLING_SECRET_KEY" -binary \
    | base64url)

  printf '%s.%s.%s' "$h" "$b" "$sig"
}

# ── 视频上传（本地文件 → URL）──────────────────────────────────

upload_video() {
  local file="$1"
  local service="${KLING_UPLOAD_SERVICE:-tmpfiles.org}"

  local resp url
  case "$service" in
    tmpfiles.org)
      resp=$(curl -sSL --retry 3 --retry-delay 2 -F "file=@${file}" https://tmpfiles.org/api/v1/upload)
      # 返回格式: {"status":"success","data":{"url":"http://tmpfiles.org/12345/file.mp4"}}
      # 需要转成直接下载链接: http://tmpfiles.org/dl/12345/file.mp4
      url=$(printf '%s' "$resp" | grep -oE '"url"\s*:\s*"[^"]*"' | grep -oE '"https?://[^"]*"' | tr -d '"')
      if [[ -n "$url" ]]; then
        url=$(printf '%s' "$url" | sed 's|tmpfiles.org/|tmpfiles.org/dl/|')
      fi
      ;;
    file.io)
      resp=$(curl -sSL --retry 3 --retry-delay 2 -F "file=@${file}" https://file.io)
      url=$(printf '%s' "$resp" | grep -oE '"link"\s*:\s*"[^"]*"' | grep -oE '"https?://[^"]*"' | tr -d '"')
      ;;
    transfer.sh)
      url=$(curl -sS --retry 3 --retry-delay 2 --upload-file "$file" "https://transfer.sh/$(basename "$file")")
      ;;
    *)
      # 自定义：KLING_UPLOAD_SERVICE=https://your-server.com/upload
      resp=$(curl -sS -F "file=@${file}" "$service")
      url=$(printf '%s' "$resp" | grep -oE '"url"\s*:\s*"[^"]*"' | grep -oE '"https?://[^"]*"' | tr -d '"')
      ;;
  esac

  if [[ -z "$url" ]]; then
    echo "上传失败: $file" >&2
    [[ -n "${resp:-}" ]] && echo "$resp" >&2
    return 1
  fi
  echo "$url"
}

# ── 图片转 base64 ─────────────────────────────────────────────

image_to_payload() {
  local src="$1"
  if [[ "$src" == http://* || "$src" == https://* ]]; then
    printf '%s' "$src"
  else
    if [[ ! -f "$src" ]]; then
      echo "错误: 文件不存在 $src" >&2; return 1
    fi
    openssl base64 -A -in "$src"
  fi
}

# ── Prompt 转换: @图片N → <<<image_N>>> ──────────────────────

convert_prompt_refs() {
  local p="$1"
  # macOS sed 兼容写法
  printf '%s' "$p" | sed 's/@图片\([0-9][0-9]*\)/<<<image_\1>>>/g'
}

# ── 创建任务 ───────────────────────────────────────────────────

create_task() {
  local prompt="" duration="5" ratio="16:9" mode="std" model="kling-video-o1"
  local gen_type="default"
  local first_frame="" end_frame=""
  local video_url=""
  local -a images=()
  # camera control (all empty = no camera_control in body)
  local cam_horizontal="" cam_vertical="" cam_pan="" cam_tilt="" cam_roll="" cam_zoom=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prompt)      prompt="$2";      shift 2 ;;
      --duration)    duration="$2";    shift 2 ;;
      --ratio)       ratio="$2";      shift 2 ;;
      --mode)        mode="$2";       shift 2 ;;
      --model)       model="$2";      shift 2 ;;
      --type)        gen_type="$2";   shift 2 ;;
      --first-frame) first_frame="$2"; shift 2 ;;
      --end-frame)   end_frame="$2";   shift 2 ;;
      --video)       video_url="$2";   shift 2 ;;
      --image)       images+=("$2");   shift 2 ;;
      --horizontal)  cam_horizontal="$2"; shift 2 ;;
      --vertical)    cam_vertical="$2";   shift 2 ;;
      --pan)         cam_pan="$2";        shift 2 ;;
      --tilt)        cam_tilt="$2";       shift 2 ;;
      --roll)        cam_roll="$2";       shift 2 ;;
      --zoom)        cam_zoom="$2";       shift 2 ;;
      *) echo "未知参数: $1" >&2; return 1 ;;
    esac
  done

  if [[ -z "$prompt" ]]; then
    echo "错误: --prompt 为必填参数" >&2; return 1
  fi

  prompt=$(convert_prompt_refs "$prompt")

  local body
  body=$(printf '{"model_name":"%s","prompt":"%s","duration":"%s","aspect_ratio":"%s","mode":"%s"}' \
    "$model" "$prompt" "$duration" "$ratio" "$mode")

  local image_items="" video_items=""

  case "$gen_type" in
    frames)
      if [[ -n "$first_frame" ]]; then
        local ff_data
        ff_data=$(image_to_payload "$first_frame")
        image_items=$(printf '{"image_url":"%s","type":"first_frame"}' "$ff_data")
      fi
      if [[ -n "$end_frame" ]]; then
        local ef_data
        ef_data=$(image_to_payload "$end_frame")
        local ef_item
        ef_item=$(printf '{"image_url":"%s","type":"end_frame"}' "$ef_data")
        if [[ -n "$image_items" ]]; then
          image_items="$image_items,$ef_item"
        else
          image_items="$ef_item"
        fi
      fi
      ;;
    video_reference)
      if [[ -n "$video_url" ]]; then
        video_items=$(printf '{"video_url":"%s","refer_type":"feature"}' "$video_url")
      fi
      for img in "${images[@]+"${images[@]}"}"; do
        local img_data
        img_data=$(image_to_payload "$img")
        local item
        item=$(printf '{"image_url":"%s"}' "$img_data")
        if [[ -n "$image_items" ]]; then
          image_items="$image_items,$item"
        else
          image_items="$item"
        fi
      done
      ;;
    video_transform)
      if [[ -n "$video_url" ]]; then
        video_items=$(printf '{"video_url":"%s","refer_type":"base"}' "$video_url")
      fi
      for img in "${images[@]+"${images[@]}"}"; do
        local img_data
        img_data=$(image_to_payload "$img")
        local item
        item=$(printf '{"image_url":"%s"}' "$img_data")
        if [[ -n "$image_items" ]]; then
          image_items="$image_items,$item"
        else
          image_items="$item"
        fi
      done
      ;;
    default|*)
      for img in "${images[@]+"${images[@]}"}"; do
        local img_data
        img_data=$(image_to_payload "$img")
        local item
        item=$(printf '{"image_url":"%s"}' "$img_data")
        if [[ -n "$image_items" ]]; then
          image_items="$image_items,$item"
        else
          image_items="$item"
        fi
      done
      ;;
  esac

  if [[ -n "$image_items" ]]; then
    body="${body%\}},\"image_list\":[$image_items]}"
  fi
  if [[ -n "$video_items" ]]; then
    body="${body%\}},\"video_list\":[$video_items]}"
  fi

  # camera_control: 只要任意一个参数非空就注入
  if [[ -n "$cam_horizontal" || -n "$cam_vertical" || -n "$cam_pan" || -n "$cam_tilt" || -n "$cam_roll" || -n "$cam_zoom" ]]; then
    local cc_h="${cam_horizontal:-0}" cc_v="${cam_vertical:-0}"
    local cc_pan="${cam_pan:-0}" cc_tilt="${cam_tilt:-0}"
    local cc_roll="${cam_roll:-0}" cc_zoom="${cam_zoom:-0}"
    local cam_json
    cam_json=$(printf '"camera_control":{"type":"simple","config":{"horizontal":%s,"vertical":%s,"pan":%s,"tilt":%s,"roll":%s,"zoom":%s}}' \
      "$cc_h" "$cc_v" "$cc_pan" "$cc_tilt" "$cc_roll" "$cc_zoom")
    body="${body%\}},$cam_json}"
  fi

  local token
  token=$(sign_jwt)

  local url="${KLING_API_BASE}${KLING_OMNI_PATH}"
  local tmpfile
  tmpfile=$(mktemp)
  printf '%s' "$body" > "$tmpfile"
  local resp
  resp=$(curl -sS --http1.1 --retry 3 --retry-delay 2 $KLING_CURL_RESOLVE -X POST "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d @"$tmpfile")
  rm -f "$tmpfile"

  local task_id
  task_id=$(printf '%s' "$resp" | grep -oE '"task_id"\s*:\s*"[^"]*"' | head -1 | grep -oE '"[^"]*"$' | tr -d '"')

  if [[ -z "$task_id" ]]; then
    echo "创建任务失败，API 返回:" >&2
    echo "$resp" >&2
    return 1
  fi

  echo "$task_id"
}

# ── 查询任务 ───────────────────────────────────────────────────

query_task() {
  local task_id="$1"
  local token
  token=$(sign_jwt)

  local url="${KLING_API_BASE}${KLING_OMNI_PATH}/${task_id}"
  local resp
  resp=$(curl -sS --http1.1 --retry 3 --retry-delay 2 $KLING_CURL_RESOLVE -X GET "$url" \
    -H "Authorization: Bearer $token")

  echo "$resp"
}

extract_status() {
  local resp="$1"
  printf '%s' "$resp" | grep -oE '"task_status"\s*:\s*"[^"]*"' | head -1 | grep -oE '"[^"]*"$' | tr -d '"'
}

extract_video_url() {
  local resp="$1"
  printf '%s' "$resp" | grep -oE '"url"\s*:\s*"https?://[^"]*"' | head -1 | grep -oE '"https?://[^"]*"' | tr -d '"'
}

# ── run: 创建 + 轮询 ──────────────────────────────────────────

run_task() {
  echo "▶ 创建任务..." >&2
  local task_id
  task_id=$(create_task "$@")
  echo "  task_id: $task_id" >&2

  local poll_interval=5
  while true; do
    sleep "$poll_interval"
    local resp
    resp=$(query_task "$task_id")
    local status
    status=$(extract_status "$resp")

    case "$status" in
      succeed|completed|complete)
        local video_url
        video_url=$(extract_video_url "$resp")
        echo "✔ 视频生成完成" >&2
        echo "  task_id:   $task_id" >&2
        echo "  video_url: $video_url" >&2
        echo "$video_url"
        return 0
        ;;
      failed|error)
        echo "✘ 视频生成失败" >&2
        echo "$resp" >&2
        return 1
        ;;
      *)
        echo "  状态: $status ..." >&2
        ;;
    esac
  done
}

# ── Motion Control 3.0: 动作迁移 ─────────────────────────────

motion_create() {
  local image_url="" motion_video="" prompt="" mode="std" model="kling-v2-6"
  local direction="video" keep_audio="yes"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --image)      image_url="$2";     shift 2 ;;
      --motion)     motion_video="$2";  shift 2 ;;
      --prompt)     prompt="$2";        shift 2 ;;
      --mode)       mode="$2";          shift 2 ;;
      --model)      model="$2";         shift 2 ;;
      --direction)  direction="$2";     shift 2 ;;
      --keep-audio) keep_audio="yes";   shift ;;
      --no-audio)   keep_audio="no";    shift ;;
      *) echo "未知参数: $1" >&2; return 1 ;;
    esac
  done

  # Map legacy direction values
  case "$direction" in
    motion_direction) direction="video" ;;
    image_direction)  direction="image" ;;
  esac

  if [[ -z "$image_url" ]]; then
    echo "错误: --image 为必填参数（目标角色图片）" >&2; return 1
  fi
  if [[ -z "$motion_video" ]]; then
    echo "错误: --motion 为必填参数（动作参考视频 URL）" >&2; return 1
  fi
  if [[ "$motion_video" != http://* && "$motion_video" != https://* ]]; then
    echo "错误: --motion 必须是 URL（不支持本地文件），请先上传视频获取 URL" >&2; return 1
  fi

  local img_data
  img_data=$(image_to_payload "$image_url")

  local body
  body=$(printf '{"model_name":"%s","mode":"%s","image_url":"%s","video_url":"%s","character_orientation":"%s","keep_original_sound":"%s"}' \
    "$model" "$mode" "$img_data" "$motion_video" "$direction" "$keep_audio")

  if [[ -n "$prompt" ]]; then
    prompt=$(convert_prompt_refs "$prompt")
    body="${body%\}},\"prompt\":\"$prompt\"}"
  fi

  local token
  token=$(sign_jwt)

  local url="${KLING_API_BASE}${KLING_MOTION_PATH}"
  local tmpfile
  tmpfile=$(mktemp)
  printf '%s' "$body" > "$tmpfile"
  local resp
  resp=$(curl -sS --http1.1 --retry 3 --retry-delay 2 $KLING_CURL_RESOLVE -X POST "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d @"$tmpfile")
  rm -f "$tmpfile"

  local task_id
  task_id=$(printf '%s' "$resp" | grep -oE '"task_id"\s*:\s*"[^"]*"' | head -1 | grep -oE '"[^"]*"$' | tr -d '"')

  if [[ -z "$task_id" ]]; then
    echo "创建动作迁移任务失败，API 返回:" >&2
    echo "$resp" >&2
    return 1
  fi

  echo "$task_id"
}

motion_query() {
  local task_id="$1"
  local token
  token=$(sign_jwt)

  local url="${KLING_API_BASE}${KLING_MOTION_PATH}/${task_id}"
  local resp
  resp=$(curl -sS --http1.1 --retry 3 --retry-delay 2 $KLING_CURL_RESOLVE -X GET "$url" \
    -H "Authorization: Bearer $token")

  echo "$resp"
}

motion_run() {
  echo "▶ 创建动作迁移任务..." >&2
  local task_id
  task_id=$(motion_create "$@")
  echo "  task_id: $task_id" >&2

  local poll_interval=5
  while true; do
    sleep "$poll_interval"
    local resp
    resp=$(motion_query "$task_id")
    local status
    status=$(extract_status "$resp")

    case "$status" in
      succeed|completed|complete)
        local video_url
        video_url=$(extract_video_url "$resp")
        echo "✔ 动作迁移完成" >&2
        echo "  task_id:   $task_id" >&2
        echo "  video_url: $video_url" >&2
        echo "$video_url"
        return 0
        ;;
      failed|error)
        echo "✘ 动作迁移失败" >&2
        echo "$resp" >&2
        return 1
        ;;
      *)
        echo "  状态: $status ..." >&2
        ;;
    esac
  done
}

# ── 批量动作迁移 ──────────────────────────────────────────────

batch_motion() {
  local dir="" prompt="" mode="std" direction="video" output_dir=""
  local keep_audio="no" model="kling-v2-6" shared_image=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir)       dir="$2";        shift 2 ;;
      --image)     shared_image="$2"; shift 2 ;;
      --prompt)    prompt="$2";     shift 2 ;;
      --mode)      mode="$2";       shift 2 ;;
      --model)     model="$2";      shift 2 ;;
      --direction) direction="$2";  shift 2 ;;
      --keep-audio) keep_audio="yes"; shift ;;
      --no-audio)  keep_audio="no";  shift ;;
      --output)    output_dir="$2"; shift 2 ;;
      *) echo "未知参数: $1" >&2; return 1 ;;
    esac
  done

  if [[ -z "$dir" ]]; then
    echo "错误: --dir 为必填参数（包含视频+图片的文件夹路径）" >&2; return 1
  fi
  if [[ ! -d "$dir" ]]; then
    echo "错误: 目录不存在 $dir" >&2; return 1
  fi

  # 如果指定了 --image，验证文件存在
  if [[ -n "$shared_image" && "$shared_image" != http://* && "$shared_image" != https://* ]]; then
    if [[ ! -f "$shared_image" ]]; then
      echo "错误: 图片文件不存在 $shared_image" >&2; return 1
    fi
  fi

  # Step 1: 扫描视频文件 + 匹配图片
  echo "📂 扫描文件夹: $dir" >&2
  local -a pairs=()       # "video_path|image_path" 对
  local -a unmatched=()
  local video_exts="mp4 mov webm"
  local image_exts="jpg jpeg png webp"

  for vext in $video_exts; do
    for vfile in "$dir"/*."$vext"; do
      [[ -f "$vfile" ]] || continue
      local base
      base=$(basename "$vfile")
      base="${base%.*}"

      if [[ -n "$shared_image" ]]; then
        # 共用图片模式：所有视频使用同一张图片
        pairs+=("${vfile}|${shared_image}")
        echo "  ✓ ${base}.${vext} → 共用图片" >&2
      else
        # 同名匹配模式
        local found_img=""
        for iext in $image_exts; do
          if [[ -f "$dir/${base}.${iext}" ]]; then
            found_img="$dir/${base}.${iext}"
            break
          fi
        done
        if [[ -n "$found_img" ]]; then
          pairs+=("${vfile}|${found_img}")
          echo "  ✓ 匹配: ${base}.${vext} ↔ $(basename "$found_img")" >&2
        else
          unmatched+=("$vfile")
          echo "  ⚠ 未匹配图片: ${base}.${vext}" >&2
        fi
      fi
    done
  done

  if [[ ${#pairs[@]} -eq 0 ]]; then
    echo "错误: 未找到视频文件" >&2; return 1
  fi

  echo "" >&2
  echo "📊 找到 ${#pairs[@]} 个视频" >&2
  [[ -n "$shared_image" ]] && echo "🖼️ 共用图片: $shared_image" >&2
  [[ ${#unmatched[@]} -gt 0 ]] && echo "⚠ ${#unmatched[@]} 个视频未匹配到图片" >&2
  echo "" >&2

  # 缓存文件路径（断点续传）
  local cache_dir="${output_dir:-$dir}"
  mkdir -p "$cache_dir"
  local upload_cache="$cache_dir/.upload-cache.txt"
  local task_cache="$cache_dir/.task-cache.txt"
  touch "$upload_cache" "$task_cache"

  # Step 2: 上传所有视频（支持缓存跳过）
  echo "📤 上传视频..." >&2
  local -a video_urls=()
  local upload_failed=0

  for pair in "${pairs[@]}"; do
    local vfile="${pair%%|*}"
    local vbase
    vbase=$(basename "$vfile")

    # 检查上传缓存
    local cached_url
    cached_url=$(grep "^${vbase}	" "$upload_cache" 2>/dev/null | cut -f2 || true)
    if [[ -n "$cached_url" ]]; then
      video_urls+=("$cached_url")
      echo "  ⚡ $vbase → 缓存命中: $cached_url" >&2
      continue
    fi

    echo "  上传: $vbase ..." >&2
    local vurl
    if vurl=$(upload_video "$vfile"); then
      video_urls+=("$vurl")
      printf '%s\t%s\n' "$vbase" "$vurl" >> "$upload_cache"
      echo "  ✓ $vbase → $vurl" >&2
    else
      video_urls+=("FAILED")
      upload_failed=$((upload_failed + 1))
      echo "  ✘ $vbase 上传失败" >&2
    fi
  done

  if [[ $upload_failed -eq ${#pairs[@]} ]]; then
    echo "错误: 所有视频上传失败" >&2; return 1
  fi
  echo "" >&2

  # Step 3: 顺序提交所有 motion 任务（支持缓存跳过）
  echo "🚀 提交动作迁移任务..." >&2
  local -a task_ids=()
  local -a task_names=()
  local submitted=0

  for i in "${!pairs[@]}"; do
    local pair="${pairs[$i]}"
    local vurl="${video_urls[$i]}"
    local ifile="${pair##*|}"
    local vfile="${pair%%|*}"
    local vbase
    vbase=$(basename "$vfile")
    vbase="${vbase%.*}"

    task_names+=("$vbase")

    if [[ "$vurl" == "FAILED" ]]; then
      task_ids+=("UPLOAD_FAILED")
      continue
    fi

    # 检查任务缓存
    local cached_tid
    cached_tid=$(grep "^${vbase}	" "$task_cache" 2>/dev/null | cut -f2 || true)
    if [[ -n "$cached_tid" ]]; then
      task_ids+=("$cached_tid")
      echo "  ⚡ ${vbase}: 缓存命中 task_id=$cached_tid" >&2
      submitted=$((submitted + 1))
      continue
    fi

    # 顺序提交（避免 API 限流），每次间隔 1 秒
    local args=(--image "$ifile" --motion "$vurl" --mode "$mode" --model "$model" --direction "$direction")
    [[ "$keep_audio" == "yes" ]] && args+=(--keep-audio)
    [[ -n "$prompt" ]] && args+=(--prompt "$prompt")

    local tid create_err retry_count=0
    create_err=$(mktemp)
    while true; do
      if tid=$(motion_create "${args[@]}" 2>"$create_err"); then
        task_ids+=("$tid")
        printf '%s\t%s\n' "$vbase" "$tid" >> "$task_cache"
        echo "  ✓ ${vbase}: task_id=$tid" >&2
        submitted=$((submitted + 1))
        break
      fi
      # 检测并行任务数超限 (code 1303)
      if grep -q '"code":1303' "$create_err" 2>/dev/null && [[ $retry_count -lt 60 ]]; then
        retry_count=$((retry_count + 1))
        echo "  ⏸ ${vbase}: 并行任务已满，等待 30s 后重试 ($retry_count)..." >&2
        sleep 30
        continue
      fi
      task_ids+=("CREATE_FAILED")
      echo "  ✘ ${vbase}: 提交失败" >&2
      cat "$create_err" >&2
      break
    done
    rm -f "$create_err"
    sleep 1
  done

  if [[ $submitted -eq 0 ]]; then
    echo "错误: 所有任务提交失败" >&2; return 1
  fi
  echo "" >&2
  echo "⏳ 等待 $submitted 个任务完成..." >&2

  # Step 4: 统一轮询所有任务
  local -a results=()
  local -a result_urls=()
  local pending=$submitted

  for i in "${!task_ids[@]}"; do
    local tid="${task_ids[$i]}"
    if [[ "$tid" == "UPLOAD_FAILED" || "$tid" == "CREATE_FAILED" ]]; then
      results+=("failed")
      result_urls+=("$tid")
    else
      results+=("pending")
      result_urls+=("")
    fi
  done

  while [[ $pending -gt 0 ]]; do
    sleep 5
    for i in "${!task_ids[@]}"; do
      [[ "${results[$i]}" != "pending" ]] && continue

      local tid="${task_ids[$i]}"
      local resp
      resp=$(motion_query "$tid" 2>/dev/null) || continue
      local status
      status=$(extract_status "$resp")

      case "$status" in
        succeed|completed|complete)
          local vurl
          vurl=$(extract_video_url "$resp")
          results[$i]="succeed"
          result_urls[$i]="$vurl"
          pending=$((pending - 1))
          echo "  ✔ ${task_names[$i]} 完成 ($pending 个剩余)" >&2
          ;;
        failed|error)
          results[$i]="failed"
          result_urls[$i]="API_ERROR"
          pending=$((pending - 1))
          echo "  ✘ ${task_names[$i]} 失败 ($pending 个剩余)" >&2
          ;;
        *)
          # still processing
          ;;
      esac
    done
  done

  # Step 5: 输出结果汇总
  echo "" >&2
  local success_count=0 fail_count=0
  for r in "${results[@]}"; do
    [[ "$r" == "succeed" ]] && success_count=$((success_count + 1)) || fail_count=$((fail_count + 1))
  done

  echo "📊 批量动作迁移完成：" >&2
  echo "  总计: ${#pairs[@]} | 成功: $success_count | 失败: $fail_count" >&2
  echo "" >&2

  local summary=""
  for i in "${!task_names[@]}"; do
    local name="${task_names[$i]}"
    local result="${results[$i]}"
    local url="${result_urls[$i]}"
    if [[ "$result" == "succeed" ]]; then
      echo "  ✔ ${name}  → $url" >&2
      summary="${summary}${name}\t${url}\n"
    else
      echo "  ✘ ${name}  → 失败: $url" >&2
      summary="${summary}${name}\tFAILED: ${url}\n"
    fi
  done

  # 写入结果文件
  if [[ -n "$output_dir" ]]; then
    mkdir -p "$output_dir"
    printf '%b' "$summary" > "$output_dir/results.txt"
    echo "" >&2
    echo "📁 结果已写入: $output_dir/results.txt" >&2
  fi

  # Step 6: 下载所有成功生成的视频
  if [[ -n "$output_dir" && $success_count -gt 0 ]]; then
    echo "" >&2
    echo "📥 下载生成的视频..." >&2
    local downloaded=0
    for i in "${!task_names[@]}"; do
      local name="${task_names[$i]}"
      local result="${results[$i]}"
      local url="${result_urls[$i]}"
      if [[ "$result" == "succeed" && -n "$url" ]]; then
        local outfile="$output_dir/${name}.mp4"
        if curl -sSL -o "$outfile" "$url" 2>/dev/null && [[ -s "$outfile" ]]; then
          downloaded=$((downloaded + 1))
          echo "  ✓ 已下载: ${name}.mp4" >&2
        else
          rm -f "$outfile"
          echo "  ✘ 下载失败: ${name}.mp4" >&2
        fi
      fi
    done
    echo "" >&2
    echo "📁 已下载 $downloaded/$success_count 个视频到: $output_dir/" >&2
  fi

  # stdout 输出 JSON-like 汇总
  printf '{"total":%d,"success":%d,"failed":%d}\n' "${#pairs[@]}" "$success_count" "$fail_count"
}

# ── 入口 ───────────────────────────────────────────────────────

usage() {
  cat <<'EOF'
用法:
  kling.sh create  --prompt "描述" [选项...]
  kling.sh query   <task_id>
  kling.sh run     --prompt "描述" [选项...]   (创建 + 自动轮询)

  kling.sh motion        --image FILE|URL --motion VIDEO_URL [选项...]
  kling.sh motion-query  <task_id>
  kling.sh motion-run    --image FILE|URL --motion VIDEO_URL [选项...]
  kling.sh batch-motion  --dir <文件夹> [--prompt TEXT] [--output <结果目录>]

Omni Video 选项:
  --prompt TEXT          视频描述 (必填，支持 @图片N 引用)
  --duration 5|10       视频时长，默认 5
  --ratio 16:9|9:16|1:1 画面比例，默认 16:9
  --mode std|pro        生成模式，默认 std
  --model NAME          模型名称，默认 kling-video-o1
  --type TYPE           生成类型:
                          default          纯文本 + 可选图片 (默认)
                          frames           首帧/尾帧驱动
                          video_reference  视频参考 (保留风格特征)
                          video_transform  视频转绘 (基于原视频变换)
  --image FILE|URL      输入图片，可多次指定 (default/video_reference/video_transform)
  --first-frame FILE|URL 首帧图片 (仅 frames 模式)
  --end-frame FILE|URL   尾帧图片 (仅 frames 模式)
  --video URL           参考/源视频 URL (video_reference/video_transform)

  镜头运动 (camera_control):
  --horizontal N        水平移动 (整数，如 -10 到 10)
  --vertical N          垂直移动
  --pan N               水平旋转
  --tilt N              垂直旋转
  --roll N              滚动旋转
  --zoom N              缩放 (正=推进, 负=拉远)

Motion Control 3.0 选项 (动作迁移):
  --image FILE|URL      目标角色图片 (必填，需包含人物)
  --motion VIDEO_URL    动作参考视频 URL (必填，3-30 秒)
  --prompt TEXT         场景/风格描述 (可选)
  --mode std|pro        生成模式，默认 std
  --model NAME          模型名称，默认 kling-v3-0
  --direction TYPE      motion_direction (默认) | image_direction
  --keep-audio          保留参考视频音频

批量动作迁移选项 (batch-motion):
  --dir PATH            包含视频+图片的文件夹 (必填)
  --prompt TEXT         场景/风格描述 (所有任务共用)
  --mode std|pro        生成模式，默认 std
  --image FILE|URL      共用图片模式 (所有视频使用同一张角色图片)
  --direction TYPE      video (默认) | image (batch 默认 video)
  --keep-audio          保留参考视频音频
  --output PATH         结果输出目录 (写入 results.txt + 下载 mp4)

  匹配规则: 同名匹配 (dance.mp4 ↔ dance.jpg/png) 或 --image 共用
  断点续传: 重跑自动跳过已上传/已提交任务 (缓存在 output 目录)
  视频后缀: .mp4 .mov .webm
  图片后缀: .jpg .jpeg .png .webp

环境变量:
  KLING_ACCESS_KEY      API 访问密钥
  KLING_SECRET_KEY      API 签名密钥
  KLING_API_BASE        API 基础地址 (默认 https://api-beijing.klingai.com)
  KLING_UPLOAD_SERVICE  视频上传服务 (默认 tmpfiles.org，可选 file.io, transfer.sh 或自定义 URL)
EOF
}

case "${1:-}" in
  create)       shift; create_task "$@" ;;
  query)        shift; query_task "$1" ;;
  run)          shift; run_task "$@" ;;
  motion)       shift; motion_create "$@" ;;
  motion-query) shift; motion_query "$1" ;;
  motion-run)   shift; motion_run "$@" ;;
  batch-motion) shift; batch_motion "$@" ;;
  *)            usage ;;
esac
