#!/usr/bin/env bash
#
# Post-generation QC loop for multi-shot narrative videos.
# Builds a stitched preview, per-shot contact sheets, and adjacent
# tail/head transition comparisons so the director can eyeball
# cross-shot consistency (same face? same style? same color grade?
# props continuous? transitions cut cleanly?).
#
# Usage:
#   bash qc-preview.sh --videos-dir <dir> [--out <dir>] [--frames-per-shot 5] [--pattern '*.mp4']
#
# Options:
#   --videos-dir       Directory holding the per-shot videos (required).
#                      Files are sorted by name (S1.mp4, S2.mp4, ...).
#   --pattern          Glob for selecting videos (default: *.mp4).
#   --out              QC output directory (default: <videos-dir>/qc).
#   --frames-per-shot  Frames sampled per shot for the contact sheet (default: 5).
#
# Pure-local, ffmpeg-only. Does NOT call the renoise CLI, hit the network,
# or spend credits. QC is best-effort: individual steps warn and continue
# on failure rather than aborting the whole run.
#
# Dependencies: ffmpeg (brew install ffmpeg). ImageMagick is optional and
# only used as a fallback for tiling if a pure-ffmpeg step fails.

set -euo pipefail

# ---- Parse args ----
VIDEOS_DIR=""
OUT_DIR=""
FRAMES_PER_SHOT=5
PATTERN="*.mp4"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --videos-dir)      VIDEOS_DIR="$2";      shift 2 ;;
    --out)             OUT_DIR="$2";         shift 2 ;;
    --frames-per-shot) FRAMES_PER_SHOT="$2"; shift 2 ;;
    --pattern)         PATTERN="$2";         shift 2 ;;
    -h|--help)
      echo "Usage: bash qc-preview.sh --videos-dir <dir> [--out <dir>] [--frames-per-shot 5] [--pattern '*.mp4']"
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ---- Validate ffmpeg ----
if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg not found. Install with: brew install ffmpeg"
  exit 1
fi

# ---- Validate inputs ----
if [[ -z "$VIDEOS_DIR" ]]; then
  echo "Error: --videos-dir is required."
  echo "Usage: bash qc-preview.sh --videos-dir <dir> [--out <dir>] [--frames-per-shot 5]"
  exit 1
fi

if [[ ! -d "$VIDEOS_DIR" ]]; then
  echo "Error: --videos-dir not found: $VIDEOS_DIR"
  exit 1
fi

if ! [[ "$FRAMES_PER_SHOT" =~ ^[0-9]+$ ]] || [[ "$FRAMES_PER_SHOT" -lt 1 ]]; then
  echo "Error: --frames-per-shot must be a positive integer (got: $FRAMES_PER_SHOT)"
  exit 1
fi

# Normalize to an absolute directory path.
VIDEOS_DIR="$(cd "$VIDEOS_DIR" && pwd)"
OUT_DIR="${OUT_DIR:-$VIDEOS_DIR/qc}"

# ---- Collect videos (name-sorted) ----
VIDEOS=()
while IFS= read -r f; do
  VIDEOS+=("$f")
done < <(find "$VIDEOS_DIR" -maxdepth 1 -type f -name "$PATTERN" | sort)

if [[ ${#VIDEOS[@]} -eq 0 ]]; then
  echo "Error: no videos matching '$PATTERN' in $VIDEOS_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "========================================="
echo "  QC PREVIEW"
echo "========================================="
echo "Videos dir : $VIDEOS_DIR"
echo "Pattern    : $PATTERN"
echo "Output dir : $OUT_DIR"
echo "Shots      : ${#VIDEOS[@]}"
echo "Frames/shot: $FRAMES_PER_SHOT"
echo ""
for v in "${VIDEOS[@]}"; do
  echo "  - $(basename "$v")"
done
echo ""

# Helper: bare shot label from a filename (S1.mp4 -> S1).
shot_label() { basename "$1" | sed 's/\.[^.]*$//'; }

# ============================================================
# 1) Stitched preview (concat demuxer + -c copy, re-encode fallback)
# ============================================================
echo "=== [1/3] Stitched preview ==="
CONCAT_LIST="$OUT_DIR/.concat-list.txt"
: > "$CONCAT_LIST"
for v in "${VIDEOS[@]}"; do
  # concat demuxer wants single-quoted paths with internal ' escaped.
  esc=$(printf "%s" "$v" | sed "s/'/'\\\\''/g")
  printf "file '%s'\n" "$esc" >> "$CONCAT_LIST"
done

PREVIEW="$OUT_DIR/preview.mp4"
if ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$PREVIEW" \
     -loglevel error 2>/dev/null; then
  echo "  Preview (stream copy): $PREVIEW"
else
  echo "  warn: -c copy failed (codec/resolution mismatch across shots); re-encoding..."
  if ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" \
       -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1" \
       -r 30 -c:v libx264 -pix_fmt yuv420p -c:a aac "$PREVIEW" \
       -loglevel error; then
    echo "  Preview (re-encoded to 1280x720@30): $PREVIEW"
  else
    echo "  warn: preview generation failed; skipping."
  fi
fi
rm -f "$CONCAT_LIST"
echo ""

# ============================================================
# 2) Per-shot contact sheets (fps sampling + tile, pure ffmpeg)
# ============================================================
echo "=== [2/3] Contact sheets (${FRAMES_PER_SHOT} frames/shot) ==="

# Duration probe via ffmpeg (avoids requiring ffprobe).
video_duration() {
  ffmpeg -i "$1" -f null - 2>&1 \
    | grep -oE 'time=[0-9:.]+' | tail -1 | cut -d= -f2 \
    | awk -F: '{ if (NF==3) print $1*3600+$2*60+$3; else if (NF==2) print $1*60+$2; else print $1 }'
}

for v in "${VIDEOS[@]}"; do
  label=$(shot_label "$v")
  sheet="$OUT_DIR/contact-${label}.jpg"

  dur=$(video_duration "$v" 2>/dev/null || echo "")
  if [[ -z "$dur" || "$dur" == "0" ]]; then
    echo "  warn: could not read duration for $label; sampling with default fps."
    fps_expr="1"
  else
    # Sample N frames evenly across the clip: fps = N / duration.
    fps_expr=$(awk -v n="$FRAMES_PER_SHOT" -v d="$dur" 'BEGIN{ if(d<=0)d=1; printf "%.6f", n/d }')
  fi

  # fps -> pick N evenly spaced frames; scale each to a uniform height;
  # tile them into a single horizontal strip (1 row x N cols).
  if ffmpeg -y -i "$v" \
       -vf "fps=${fps_expr},scale=-1:360,tile=${FRAMES_PER_SHOT}x1" \
       -frames:v 1 -q:v 3 "$sheet" -loglevel error 2>/dev/null; then
    echo "  Contact sheet: $sheet"
  else
    echo "  warn: contact sheet failed for $label; skipping."
  fi
done
echo ""

# ============================================================
# 3) Adjacent tail/head transition comparisons
# ============================================================
echo "=== [3/3] Transition comparisons (tail of Sn | head of Sn+1) ==="

extract_tail() {  # extract_tail <video> <out.png>
  ffmpeg -y -sseof -0.1 -i "$1" -frames:v 1 -q:v 2 "$2" -loglevel error 2>/dev/null
}
extract_head() {  # extract_head <video> <out.png>
  ffmpeg -y -i "$1" -frames:v 1 -q:v 2 "$2" -loglevel error 2>/dev/null
}

TMP_TRANS="$OUT_DIR/.trans-tmp"
mkdir -p "$TMP_TRANS"

for (( i = 0; i < ${#VIDEOS[@]} - 1; i++ )); do
  a="${VIDEOS[$i]}"
  b="${VIDEOS[$((i + 1))]}"
  la=$(shot_label "$a")
  lb=$(shot_label "$b")

  tail_img="$TMP_TRANS/tail-${la}.png"
  head_img="$TMP_TRANS/head-${lb}.png"
  out_img="$OUT_DIR/transition-${la}-${lb}.jpg"

  ok=1
  extract_tail "$a" "$tail_img" || { echo "  warn: tail frame of $la failed."; ok=0; }
  extract_head "$b" "$head_img" || { echo "  warn: head frame of $lb failed."; ok=0; }

  if [[ "$ok" -eq 1 ]]; then
    # Side-by-side: normalize both to the same height, hstack.
    if ffmpeg -y -i "$tail_img" -i "$head_img" \
         -filter_complex "[0:v]scale=-1:360[l];[1:v]scale=-1:360[r];[l][r]hstack=inputs=2" \
         -frames:v 1 -q:v 3 "$out_img" -loglevel error 2>/dev/null; then
      echo "  Transition $la->$lb: $out_img"
    elif command -v montage &>/dev/null; then
      echo "  warn: ffmpeg hstack failed; falling back to ImageMagick montage."
      montage "$tail_img" "$head_img" -tile 2x1 -geometry +4+0 "$out_img" \
        && echo "  Transition $la->$lb (montage): $out_img" \
        || echo "  warn: montage fallback failed for $la->$lb."
    else
      echo "  warn: hstack failed and ImageMagick 'montage' not installed; skipping $la->$lb."
    fi
  fi
done
rm -rf "$TMP_TRANS"
echo ""

# ============================================================
# Manual QC checklist
# ============================================================
echo "========================================="
echo "  MANUAL QC CHECKLIST"
echo "========================================="
echo ""
echo "Artifacts:"
[[ -f "$PREVIEW" ]] && echo "  Preview      : $PREVIEW"
for v in "${VIDEOS[@]}"; do
  label=$(shot_label "$v")
  sheet="$OUT_DIR/contact-${label}.jpg"
  [[ -f "$sheet" ]] && echo "  Contact ${label} : $sheet"
done
for (( i = 0; i < ${#VIDEOS[@]} - 1; i++ )); do
  la=$(shot_label "${VIDEOS[$i]}")
  lb=$(shot_label "${VIDEOS[$((i + 1))]}")
  tr="$OUT_DIR/transition-${la}-${lb}.jpg"
  [[ -f "$tr" ]] && echo "  Transition   : $tr"
done
echo ""
echo "Review each item against these checks:"
echo "  [ ] 同一角色人脸一致？ (same character face across shots)"
echo "  [ ] 同画风？ (consistent art style / rendering)"
echo "  [ ] 同色调基调？ (consistent color grade / tone)"
echo "  [ ] 关键道具连贯？ (key props continuous)"
echo "  [ ] 段间转场可接（无突兀硬切）？ (transitions cut cleanly, no jarring jumps)"
echo "  [ ] 含台词段口播语言正确？ (dialogue shots use the correct spoken language)"
echo ""
echo "QC preview complete."
