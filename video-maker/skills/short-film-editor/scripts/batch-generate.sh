#!/usr/bin/env bash
#
# Batch video generation for short film projects.
# Reads a prompts JSON file and sequentially creates/waits/retrieves each shot.
#
# Usage:
#   bash batch-generate.sh --project <project-id> --ratio <ratio> --prompts-file <prompts.json>
#
# Prompts JSON format:
#   [
#     { "shot_id": "S1", "prompt": "...", "duration": 8 },
#     { "shot_id": "S2", "prompt": "...", "duration": 13 },
#     ...
#   ]

set -euo pipefail

# ---- Parse args ----
PROJECT=""
RATIO="16:9"
PROMPTS_FILE=""
TIMEOUT=600

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)  PROJECT="$2";      shift 2 ;;
    --ratio)    RATIO="$2";        shift 2 ;;
    --prompts-file) PROMPTS_FILE="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2";      shift 2 ;;
    *)          echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$PROMPTS_FILE" ]]; then
  echo "Error: --prompts-file is required."
  echo "Usage: bash batch-generate.sh --project <id> --ratio <ratio> --prompts-file <prompts.json>"
  exit 1
fi

if [[ ! -f "$PROMPTS_FILE" ]]; then
  echo "Error: File not found: $PROMPTS_FILE"
  exit 1
fi

# ---- Locate renoise-cli ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../../renoise-gen/renoise-cli.mjs"

if [[ ! -f "$CLI" ]]; then
  echo "Error: renoise-cli.mjs not found at $CLI"
  exit 1
fi

# ---- Check balance ----
echo "=== Checking balance ==="
node "$CLI" me
echo ""

# ---- Read prompts ----
SHOT_COUNT=$(jq 'length' "$PROMPTS_FILE")
echo "=== Batch generation: $SHOT_COUNT shots ==="
echo "Project: ${PROJECT:-'(none)'}"
echo "Ratio: $RATIO"
echo "Timeout per shot: ${TIMEOUT}s"
echo ""

# ---- Results tracking ----
RESULTS=()
FAILED=0

for i in $(seq 0 $((SHOT_COUNT - 1))); do
  SHOT_ID=$(jq -r ".[$i].shot_id" "$PROMPTS_FILE")
  PROMPT=$(jq -r ".[$i].prompt" "$PROMPTS_FILE")
  DURATION=$(jq -r ".[$i].duration" "$PROMPTS_FILE")

  echo "--- [$((i + 1))/$SHOT_COUNT] $SHOT_ID (${DURATION}s) ---"

  # Build tags
  TAGS="$SHOT_ID"
  if [[ -n "$PROJECT" ]]; then
    TAGS="$PROJECT,$SHOT_ID"
  fi

  # Create task
  CREATE_OUTPUT=$(node "$CLI" create \
    --prompt "$PROMPT" \
    --duration "$DURATION" \
    --ratio "$RATIO" \
    --tags "$TAGS" 2>&1) || {
    echo "[FAILED] $SHOT_ID — create error:"
    echo "$CREATE_OUTPUT"
    FAILED=$((FAILED + 1))
    RESULTS+=("$SHOT_ID|FAILED|—|create error")
    echo ""
    echo "Stopping batch — fix the issue and re-run."
    break
  }

  # Extract task ID from create output
  TASK_ID=$(echo "$CREATE_OUTPUT" | grep -oE 'id=[0-9]+' | head -1 | cut -d= -f2)

  if [[ -z "$TASK_ID" ]]; then
    echo "[FAILED] $SHOT_ID — could not parse task ID from output:"
    echo "$CREATE_OUTPUT"
    FAILED=$((FAILED + 1))
    RESULTS+=("$SHOT_ID|FAILED|—|no task ID")
    break
  fi

  echo "Task created: #$TASK_ID"

  # Wait for completion
  WAIT_OUTPUT=$(node "$CLI" wait "$TASK_ID" --timeout "$TIMEOUT" 2>&1) || {
    echo "[FAILED] $SHOT_ID (task #$TASK_ID) — wait error:"
    echo "$WAIT_OUTPUT"
    FAILED=$((FAILED + 1))
    RESULTS+=("$SHOT_ID|FAILED|#$TASK_ID|wait timeout/error")
    echo ""
    echo "Stopping batch — the task may still be running. Check with: node renoise-cli.mjs get $TASK_ID"
    break
  }

  # Get result
  RESULT_OUTPUT=$(node "$CLI" result "$TASK_ID" 2>&1)
  VIDEO_URL=$(echo "$RESULT_OUTPUT" | jq -r '.result.videoUrl // .videoUrl // "unknown"' 2>/dev/null || echo "unknown")

  echo "[SUCCESS] $SHOT_ID → $VIDEO_URL"
  RESULTS+=("$SHOT_ID|SUCCESS|#$TASK_ID|$VIDEO_URL")
  echo ""
done

# ---- Summary ----
echo ""
echo "========================================="
echo "  BATCH GENERATION SUMMARY"
echo "========================================="
printf "%-8s %-10s %-10s %s\n" "Shot" "Status" "Task" "URL"
printf "%-8s %-10s %-10s %s\n" "----" "------" "----" "---"

for entry in "${RESULTS[@]}"; do
  IFS='|' read -r shot status task url <<< "$entry"
  printf "%-8s %-10s %-10s %s\n" "$shot" "$status" "$task" "$url"
done

echo ""
echo "Total: ${#RESULTS[@]}/$SHOT_COUNT completed, $FAILED failed"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
