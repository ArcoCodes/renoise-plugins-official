#!/usr/bin/env bash
#
# Split a storyboard grid image into individual panel images.
# Uses ImageMagick to crop each cell from an NxM grid.
#
# Usage:
#   bash split-grid.sh <grid_image> <output_dir> <rows> <cols>
#
# Example:
#   bash split-grid.sh grid.png storyboard/ 2 4
#   → storyboard/S1.png, S2.png, S3.png, ..., S8.png
#
# Dependencies: ImageMagick (brew install imagemagick)

set -euo pipefail

GRID_IMAGE="${1:-}"
OUTPUT_DIR="${2:-}"
ROWS="${3:-2}"
COLS="${4:-4}"

if [[ -z "$GRID_IMAGE" || -z "$OUTPUT_DIR" ]]; then
  echo "Usage: split-grid.sh <grid_image> <output_dir> [rows] [cols]"
  echo "Example: split-grid.sh grid.png storyboard/ 2 4"
  exit 1
fi

if ! command -v magick &>/dev/null && ! command -v convert &>/dev/null; then
  echo "Error: ImageMagick not found. Install with: brew install imagemagick"
  exit 1
fi

# Determine ImageMagick command (v7: magick, v6: convert/identify)
if command -v magick &>/dev/null; then
  IDENTIFY="magick identify"
  CONVERT="magick"
else
  IDENTIFY="identify"
  CONVERT="convert"
fi

mkdir -p "$OUTPUT_DIR"

# Get image dimensions
DIMS=$($IDENTIFY -format "%wx%h" "$GRID_IMAGE")
IMG_W=$(echo "$DIMS" | cut -dx -f1)
IMG_H=$(echo "$DIMS" | cut -dx -f2)

CELL_W=$((IMG_W / COLS))
CELL_H=$((IMG_H / ROWS))

echo "Grid: ${IMG_W}x${IMG_H}, Layout: ${ROWS}x${COLS}, Cell: ${CELL_W}x${CELL_H}"

INDEX=1
for row in $(seq 0 $((ROWS - 1))); do
  for col in $(seq 0 $((COLS - 1))); do
    X=$((col * CELL_W))
    Y=$((row * CELL_H))
    OUT_FILE="${OUTPUT_DIR}/S${INDEX}.png"

    $CONVERT "$GRID_IMAGE" -crop "${CELL_W}x${CELL_H}+${X}+${Y}" +repage "$OUT_FILE"

    SIZE=$(ls -lh "$OUT_FILE" | awk '{print $5}')
    echo "  S${INDEX}: ${CELL_W}x${CELL_H} @ +${X}+${Y} → ${OUT_FILE} (${SIZE})"

    INDEX=$((INDEX + 1))
  done
done

echo "Done: $((INDEX - 1)) panels extracted"
