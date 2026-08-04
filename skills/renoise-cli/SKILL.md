---
name: renoise-cli
description: >
  Local Renoise CLI execution — install and verify the CLI, inspect live capabilities,
  analyze media, generate AI videos/images/audio, upload materials, poll results,
  and run approved local production helpers. This skill is local-only.
  For creative direction (story, prompts, visual development, anchoring strategy),
  use the director skill.
  Use when user asks to "generate video", "create video", "text to video",
  "image to video", "generate image", "generate audio", "AI video", "AI image",
  "product design sheet", "scene background", "material pool", "ingest materials",
  or Chinese phrasings like "生成视频", "文生视频", "图生视频", "生成图片",
  "AI 视频", "AI 图片", "生成音乐", "配乐", "画质增强", "超分", "上传素材",
  or needs direct CLI access.
allowed-tools: Bash, Read, Write, Glob
user-invocable: false
metadata:
  author: renoise
  version: 0.7.2
  category: video-production
  tags: [general, video-generation, image-generation, material-pool]
---

# Renoise CLI — Agent Workflow

The native `renoise` binary is the only source of truth for authentication, commands, models, capabilities, defaults, validation, API behavior, uploads, task state, and output formats. Do not maintain model tables or reproduce API logic in this plugin.

> Platform URL: **https://www.renoise.ai** — never renoise.com.

## Preflight

Run this at the start of every generation session:

```bash
# If this plugin copy is behind the latest GitHub Release, tell the user how to
# update the plugin on their host (exit 2). Continue only after they update, or
# if the check fails open (network) and the CLI path below still works.
node "${CLAUDE_SKILL_DIR}/../renoise-setup/scripts/check-plugin.mjs"
# Keep the managed CLI on the latest public release (no user prompt).
node "${CLAUDE_SKILL_DIR}/../renoise-setup/scripts/install-cli.mjs" --ensure
# Prefer the managed install for this shell (Unix).
export PATH="${HOME}/.local/bin:${PATH}"
command -v renoise >/dev/null 2>&1 || exit 127
renoise version
renoise help task create | grep -q -- '--prompt-file'
renoise help task wait | grep -q 'renoise task wait'
renoise help analyze | grep -q -- '--mode'
renoise help auth exec | grep -q 'renoise auth exec'
renoise auth status --json
renoise model --json
```

On Windows PowerShell, run the same `node ... check-plugin.mjs` and `node ... install-cli.mjs --ensure`, then prepend `$env:LOCALAPPDATA\Renoise\bin` to `$env:Path`. Use `Get-Command renoise` instead of `command -v`, and confirm task help contains `renoise task create` plus `--prompt-file` and `renoise task wait`, analyze help contains `--mode`, and auth help contains `renoise auth exec`, instead of using `grep`. If `check-plugin.mjs` exits 2, surface its upgrade commands to the user before continuing with generation features that need the new plugin. If `--ensure` fails, the binary is still missing, required commands are absent, or authentication is missing, immediately read `${CLAUDE_SKILL_DIR}/../renoise-setup/SKILL.md` completely and follow it through readiness, asking only for approvals required before host PATH edits or browser authorization. Then rerun preflight and continue the original request; do not merely direct the user to **Setup / Account**. Never ask the user to paste an API key into chat.

## Select a Model Dynamically

Treat `renoise model --json` as authoritative and current:

1. If the user names a model, preserve that choice.
2. Otherwise choose the server-advertised `isDefault` model for the requested media `kind`.
3. Use each model's `guidance` to choose among non-default models.
4. Before submitting, inspect the selected model:

```bash
renoise model <model> --json
```

Only pass ratios, resolutions, durations, material roles, reference counts, and audio options advertised there. Never copy those values into project documentation; new models and capability changes must work without a plugin release.

## Analyze Media

Use the native analysis command for local images and videos:

```bash
# Standalone image/video understanding
renoise analyze <local-media-path> --target image|video --language <user-language> --json

# Replacement template for reference-video remake workflows
renoise analyze <local-media-path> --mode template --target video --language <user-language> --json
```

Use the structured `analysis`, `prompt`, `slots`, and `warnings` fields. Preserve source dialogue verbatim and label inferred motion or cross-media details as warnings. If analysis is unavailable, malformed, blocked, or truncated, treat it as failed; do not fabricate a result or fall back to copied model code.

Analysis never proves that generation will pass moderation, never creates a paid generation task, and must not silently upload the source to the material library.

## Generate

Agents must create the task first, record `task.id` from stdout, then wait separately. This makes terminal timeouts resumable and prevents a blind retry from creating and charging for another task:

```bash
renoise task create [model] \
  --prompt-file /path/to/prompt.txt \
  [--type video|image|audio] \
  [--duration N] [--ratio X:Y] [--resolution VALUE] \
  [--materials "ID:role[:index],..."] \
  [--watermark] [--audio-generation=false] --json
renoise task wait <task-id> --timeout 15m --json
```

Use `--prompt-file -` to read a prompt from stdin, or `--prompt` only for short shell-safe text. The two flags are mutually exclusive. Omit the model to use the server default, or pass the selected model explicitly.

If `wait` times out or the terminal call is interrupted, rerun `wait` with the same task ID; do not rerun `create`.

```bash
renoise task get <task-id> --json
renoise task result <task-id> --json
renoise task cancel <task-id> --json
renoise task list --json
```

Other operations:

```bash
renoise account status --json
renoise account history --json
renoise task cost <model> [generation options] --json
renoise task chain <task-id> --json
renoise task tags --json
renoise task tag <task-id> --tags project,shot --json
renoise material --json
renoise upload /path/to/file [--type image|video|audio] --json
```

Use `renoise <command> --help` rather than documenting every flag here.

## Cost Gate

Before spending credits:

1. Run `renoise task cost <model> ... --json` with the actual generation parameters.
2. Multiply `estimatedCredit` by the planned number of generations.
3. Add character-sheet, upscale, audio, and retry costs when applicable.
4. Compare with `renoise account status --json`.
5. Tell the user the estimate and wait for approval when the director workflow requires it.

Never quote static prices.

## Materials

Upload once and reuse the returned material ID:

```bash
renoise upload /path/to/reference.png --json
renoise material --search reference --json
```

Material syntax is `ID:role[:index]`. The role is required; use only roles listed by `renoise model <model> --json`. `index` controls the ordering used by prompt references such as `@Image1` and `@Video1`.

In prompt text, `@` mentions must use the material's **full file name including extension** (`lie.png` → `@lie.png`, not `@lie`). Stem-only mentions do not bind.

Do not assume role combinations are portable across models. Inspect the selected model's capabilities and guidance, then let CLI/server validation reject unsupported combinations. Never run a plugin-side facepass/original-Seedance preparation flow; default selection and reference handling belong to the live model response.

For a completed result that should become a reusable reference:

```bash
renoise task chain <task-id> --json
```

## Prompt Basics

- Follow the selected model's live `guidance` first.
- Describe subject, action, camera, scene, lighting/style, and sound as concrete sentences.
- Put technical controls such as ratio, resolution, duration, and material roles in CLI flags, not prose.
- Keep spoken lines verbatim in the user-confirmed language.
- For narrative, recurring-character, or multi-segment work, route through the `director` skill before generating.

## Multi-Segment Mechanics

Tasks are stateless. Repeat the approved style/character text and reattach shared material IDs on every segment that needs them.

Choose continuity from the selected model's advertised material roles:

- Reuse a stable image material when identity, product, scene, or palette must stay fixed.
- Use `task chain` when a completed result can be reused through a supported video-reference role.
- If an opening-frame role is supported, extract and upload the previous tail frame before the next segment.
- If only image references are supported, the director may use the tail frame as the first ordered image and describe the intended opening state explicitly.

Example tail-frame extraction:

```bash
ffmpeg -sseof -0.2 -i generated/shots/S1.mp4 -frames:v 1 -q:v 2 -y generated/keyframes/S1-end.jpg
renoise upload generated/keyframes/S1-end.jpg --json
```

Do not hard-code reference limits or model-specific role exclusions here.

## Local Production Helpers

All executable helpers live under this local-only skill. Run only the helper needed for the current task:

```bash
# Batch upload/analyze materials, then match them to shots
node ${CLAUDE_SKILL_DIR}/scripts/material-ingest.mjs ./materials/
node ${CLAUDE_SKILL_DIR}/scripts/match-materials.mjs --pool material-pool.json --shots project.json

# Preview/QC and grid helpers used by director workflows
bash ${CLAUDE_SKILL_DIR}/scripts/qc-preview.sh --videos-dir <videos-dir>
bash ${CLAUDE_SKILL_DIR}/scripts/split-grid.sh storyboard.png output-dir/ 2 3
```

Other bundled helpers (`batch-generate.sh`, `generate-preview.mjs`, `analyze-beats.py`) are local implementation tools. Inspect their help/source before use; never run them in a Hosted Agent. Local end-to-end command examples live under `examples/` in this Skill.

## Errors

Use the CLI's JSON error and exit code; do not infer API behavior from copied endpoint documentation. JSON errors expose `retryable` and, after task creation, `taskId`; retry only the wait/query operation for that ID, never the paid create operation.

```bash
renoise task get <task-id> --json
renoise auth status --json
renoise model <model> --json
```

Do not pre-screen prompts or materials and do not infer a moderation result yourself. Continue the normal approval and submission flow unless the CLI/API returns an explicit content-review error (`INPUT_*` / `OUTPUT_*`). On that actual error, report it and stop; never retry the paid create operation or suggest bypasses.

## References

- [Prompt Craft](../director/references/prompt-craft.md) — creative prompt and continuity methodology
- Native CLI help: `renoise --help`, `renoise <command> --help`
- Live capabilities: `renoise model --json`
