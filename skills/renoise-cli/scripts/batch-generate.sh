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

# ---- Check native CLI and balance ----
if ! command -v renoise >/dev/null 2>&1; then
  echo "Error: native renoise CLI is required. Run the renoise-setup skill."
  exit 1
fi

echo "=== Checking balance ==="
renoise account status
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

  # Create task (segment task IDs are recorded locally in the project manifest below —
  # no server-side tags: the Renoise app does not filter by tag).
  CREATE_OUTPUT=$(printf '%s' "$PROMPT" | renoise task create \
    --prompt-file - \
    --duration "$DURATION" \
    --ratio "$RATIO" --json) || {
    echo "[FAILED] $SHOT_ID — create error:"
    echo "$CREATE_OUTPUT"
    FAILED=$((FAILED + 1))
    RESULTS+=("$SHOT_ID|FAILED|—|create error")
    echo ""
    echo "Stopping batch — fix the issue and re-run."
    break
  }

  TASK_ID=$(jq -r '.task.id // empty' <<< "$CREATE_OUTPUT")

  if [[ -z "$TASK_ID" ]]; then
    echo "[FAILED] $SHOT_ID — could not parse task ID from output:"
    echo "$CREATE_OUTPUT"
    FAILED=$((FAILED + 1))
    RESULTS+=("$SHOT_ID|FAILED|—|no task ID")
    break
  fi

  echo "Task created: #$TASK_ID"

  # Wait for completion
  WAIT_OUTPUT=$(renoise task wait "$TASK_ID" --timeout "${TIMEOUT}s" --json) || {
    echo "[FAILED] $SHOT_ID (task #$TASK_ID) — wait error:"
    echo "$WAIT_OUTPUT"
    FAILED=$((FAILED + 1))
    RESULTS+=("$SHOT_ID|FAILED|#$TASK_ID|wait timeout/error")
    echo ""
    echo "Stopping batch — the task may still be running. Check with: renoise task get $TASK_ID"
    break
  }

  VIDEO_URL=$(jq -r '.result.videoUrl // .videoUrl // "unknown"' <<< "$WAIT_OUTPUT")

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

# ---- Local manifest ----
# Record the project's shot → task-id → url mapping locally (replaces server-side
# tags, which the Renoise app does not use). Written next to the prompts file.
MANIFEST="$(dirname "$PROMPTS_FILE")/${PROJECT:-batch}-tasks.tsv"
{
  printf "shot\tstatus\ttask\turl\n"
  for entry in "${RESULTS[@]}"; do
    IFS='|' read -r shot status task url <<< "$entry"
    printf "%s\t%s\t%s\t%s\n" "$shot" "$status" "$task" "$url"
  done
} > "$MANIFEST"
echo ""
echo "Manifest written: $MANIFEST"

echo ""
echo "Total: ${#RESULTS[@]}/$SHOT_COUNT completed, $FAILED failed"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
