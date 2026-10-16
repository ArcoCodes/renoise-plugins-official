---
name: renoise-cli
description: >
  The native Renoise CLI for the user's own terminal, scripts, and CI, plus the plugin's
  local production helpers (QC previews, storyboard-grid splitting, beat analysis,
  material matching). This skill is local-only and is not a generation path in a
  conversation: there, every Renoise operation goes through the Renoise MCP tools.
  Use when the user asks to script Renoise, run a batch from their terminal, install or
  update the CLI, or use one of the local helpers.
allowed-tools: Bash, Read, Write, Glob
user-invocable: false
metadata:
  author: renoise
  version: 0.9.0
  category: video-production
  tags: cli, scripts, local-helpers
---

# Renoise CLI — terminals, scripts, and local helpers

> Platform URL: **https://www.renoise.ai** — never renoise.com.

## One interface in conversations

In a conversation, all Renoise work goes through the **Renoise MCP tools** this plugin connects: `list_models`, `estimate_cost`, `create_tasks`, `wait_tasks`, `show_result`, `upload_files`, `download_results`, `analyze_media`, `search_materials`, `cancel_tasks`, `save_result_as_material`, `get_account`. They are the same tools on every host, and their instructions carry the approval rule for paid work.

Never create a paid task from a conversation through `renoise task create`, `batch-generate.sh`, or any other CLI path: that would bypass the approval rule. If the Renoise tools are not available, read `../renoise-setup/SKILL.md` and connect them; do not fall back to the CLI.

The native `renoise` binary remains for what the user runs themselves: shell scripts, batch jobs, and CI. Point them to `renoise --help` and `renoise <command> --help` rather than documenting flags here.

## Install or update the CLI

Needed only for the annotation board, the helpers below, or the user's own scripts:

```bash
node "${CLAUDE_SKILL_DIR}/../renoise-setup/scripts/install-cli.mjs" --ensure
export PATH="${HOME}/.local/bin:${PATH}"
renoise version
renoise auth status --json
```

On Windows PowerShell, run the same `node ... install-cli.mjs --ensure`, then prepend `$env:LOCALAPPDATA\Renoise\bin` to `$env:Path`. If `--ensure` fails or authentication is missing, follow `../renoise-setup/SKILL.md`. Never ask the user to paste an API key into chat.

## Local production helpers

These run locally and never spend credits:

```bash
# Preview/QC and grid helpers used by director workflows
bash ${CLAUDE_SKILL_DIR}/scripts/qc-preview.sh --videos-dir <videos-dir>
bash ${CLAUDE_SKILL_DIR}/scripts/split-grid.sh storyboard.png output-dir/ 2 3
node ${CLAUDE_SKILL_DIR}/scripts/match-materials.mjs --pool material-pool.json --shots project.json
python3 ${CLAUDE_SKILL_DIR}/scripts/analyze-beats.py <audio-file>
node ${CLAUDE_SKILL_DIR}/scripts/generate-preview.mjs <project-dir>   # HTML storyboard preview
```

`material-ingest.mjs` (upload and analyze a folder) and `batch-generate.sh` (paid batch generation) call the CLI with the user's credential: they are terminal tools for the user to run. In a conversation, upload with `upload_files`, analyze with `analyze_media`, and generate with `create_tasks`. Inspect a helper's help/source before use; never run them in a Hosted Agent.

## Errors

Use the CLI's JSON error and exit code; do not infer API behavior from copied endpoint documentation. JSON errors expose `retryable` and, after task creation, `taskId`; retry only the wait/query operation for that ID, never the paid create operation.

Do not pre-screen prompts or materials and do not infer a moderation result yourself. Continue normally unless the CLI/API returns an explicit content-review error (`INPUT_*` / `OUTPUT_*`). On that actual error, report it and stop; never retry the paid create operation or suggest bypasses.
