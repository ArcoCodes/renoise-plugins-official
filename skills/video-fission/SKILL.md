---
name: video-fission
description: >
  Create controlled variants from one owner-authorized source video. Use when
  the user explicitly asks for video fission, multiple video variants,
  controlled variations, or several hypotheses from the same clip. Analyze the
  source first, then confirm what should vary before proposing any generation.
metadata:
  author: renoise
  version: 0.1.0
  category: video-production
  tags: [video, fission, variants, experimentation, portable]
---

# Video Fission

Create a controlled batch of variants from one source video. This is an experiment, not a multi-shot production workflow: vary one axis, or at most two, and lock everything else.

## Runtime Boundary

Use only capabilities exposed by the current host. The source must be one conversation attachment, material, task result, or other video that the host identifies as owner-authorized. Never invent a source, request a host filesystem path, or use more than one source video.

Live model capabilities are authoritative for availability, roles, role combinations, limits, duration, ratio, resolution, and audio controls. Inspect them for every fission run; model names below are routing preferences, not permission to assume a capability.

## Hard Gates

1. **Analyze before asking for a direction.** Once the source is available, use the host's video-analysis capability before asking what to vary. If analysis is unavailable or fails, stop. Analysis creates no generation task.
2. **Confirm the fission direction.** After showing the analysis, ask which one experimental axis to vary; allow a second axis only when the user explicitly needs it. Even if the initial request names a direction, restate it after analysis and get confirmation. Create no task before this confirmation.
3. **Confirm the count.** Default to **4 outputs** when no count is supplied. Four is not a hard cap: accept another reasonable count of at least two, constrained only by live service limits, the total estimate, and the user's budget.
4. **Use one batch operation.** Submit the approved experiment exactly once through `create_video_fission`. Do not fan it out into multiple `create_task` calls.

## 1. Analyze the Source

Report the analysis in the user's language, including:

- subject, setting, actions, camera, composition, lighting, style, pacing/edit structure, duration, aspect ratio, and audio/dialogue;
- the strongest anchor-frame timestamp and why it represents the clip;
- dimensions that appear fixed and plausible dimensions to vary;
- uncertain or inferred details as warnings.

Do not ask the user to choose a direction until this report exists.

Then ask one focused question:

> Which direction should the variants explore? I recommend one axis from this clip's analysis; we can use at most two. The default is 4 outputs, or name another reasonable count.

Offer only source-relevant directions, such as action/motion, camera treatment, pacing, atmosphere/lighting, performance, or transformation. Do not preselect a direction for the user.

## 2. Select the Shared Anchor Frame

This workflow has one generation path:

1. Select MiniMax H3 Max (`hailuo-h3-max`) only if the live capability advertises `first_frame`.
2. Choose the analyzed source timestamp whose visual state best anchors the requested experiment.
3. Use that one extracted image as every variant's `first_frame`; prompt only what happens after it.

The timestamp may point anywhere in the source video. "Anchor frame" means the representative visual frame chosen from the analysis, not a codec keyframe. The agent chooses the timestamp; FFmpeg only extracts that exact frame after approval.

**H3 Max input rule:** H3 Max does not accept generic `reference_image` or `reference_video` inputs. Its supported visual conditioning inputs are `first_frame` and `last_frame`; this workflow uses `first_frame`. Never relabel the source video or anchor as a generic reference for H3 Max.

The agent does not extract the anchor in advance. On approval, `create_video_fission` prepares the browser-extracted frame and attaches it to the run. If H3 Max first-frame generation is not live, stop and explain that this workflow is currently unavailable; do not invent another mode or silently route to another model.

## 3. Design the Experiment

Before submission, show a compact variant matrix in the user's language:

| Variant | Axis value(s) | Distinct hypothesis | Locked dimensions |
|---|---|---|---|
| V1 | ... | If ..., then ... because ... | ... |

Rules:

- Use one axis by default and never more than two.
- Give every variant a genuinely distinct, testable hypothesis; do not use cosmetic synonyms.
- Lock all unselected dimensions across every variant, including model, source/anchor, subject identity, composition, duration, ratio, resolution, audio mode, dialogue, and output controls unless one is the confirmed axis.
- Keep the same prompt skeleton and change only the clauses that implement the confirmed axis values.
- If two axes are used, choose intentional combinations; do not create an unrequested Cartesian product.
- Derive every parameter and material role from the selected model's live capability.

## Dialogue and Language

Use the user's language for analysis, questions, matrices, confirmation text, and results. Prompts are English by default only when they contain no speech.

If any variant contains dialogue, voiceover, or narration, confirm the spoken language before writing final prompts. Keep every spoken line verbatim in that confirmed language; never translate it. For dialogue-dense variants, keep the whole prompt in the spoken language. Unless dialogue is the confirmed axis, lock its text, speaker, delivery, and spoken language across all variants.

## 4. Submit Once

After the direction, count, anchor timestamp, hypotheses, prompts, and any spoken language are confirmed, call `create_video_fission` once with the complete variant plan. If the authorized source came from a Canvas node, preserve that exact node ID in the operation so every output can project with a source edge.

The host operation must:

- emit one **Run all** confirmation card, not one card per variant;
- show a live estimate for every variant and the total;
- prepare the browser-extracted anchor frame only after approval;
- create no tasks if the user declines;
- return and track the resulting task IDs without repeating paid creation.

Never replace this operation with a loop of `create_task` calls. For revisions, ask which confirmed axis value or failed variant to change, preserve approved outputs, and invoke a new fission run only after the user confirms the revised experiment.
