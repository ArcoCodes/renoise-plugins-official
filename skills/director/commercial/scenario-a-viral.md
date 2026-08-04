# Scenario A — Reference Video Remake / 剪同款

**Trigger**: The user provides a reference video and asks to recreate, remix, 复刻, or 剪同款 with their own character, product, brand, or scene.

This is a two-gate workflow. The current host owns authorized media analysis, materials, live capabilities, costs, approvals, and tasks. This reference owns slot matching, creative decisions, and resumable plan state kept in the conversation.

## Non-Negotiable Source Policy

The source video is always attached to final generation through a compatible video role advertised by the selected model.

Before planning replacements:

1. Query live video-model capabilities.
2. Select a model that advertises both a compatible source/reference-video role and every image role needed by replacement slots.
3. Check guidance, reference counts, duration, ratio, audio behavior, and role combinations.
4. If no model supports the complete source-video + replacement-image combination, stop and explain. Never omit the source video or invent a role.

The final prompt must state that the source video supplies timing, camera motion, composition, transitions, effects, pacing, and emotional beats. Replacement materials supply identity, product, wardrobe, props, and other slotted content. This text reduces accidental copying but is not a security boundary; normal moderation rules still apply.

## Phase 1 — Analyze and Build a Remake Plan

Use the host's media-analysis capability in template/video mode on the authorized source. If that capability is unavailable, stop; do not request a local command or fall back to copied model code.

The result should contain:

- factual analysis: summary, timeline, composition, style, subjects, and audio;
- a model-neutral prompt with `{{slot_id}}` placeholders;
- slots: each replaceable character/product/object/scene/style plus a reference-image prompt;
- warnings: inferred or uncertain details.

Maintain this plan in the conversation so retries resume known task/material IDs instead of recreating charges:

```json
{
  "version": "v1",
  "source": {
    "authorizedRef": "host reference",
    "materialId": null,
    "role": null
  },
  "analysis": "structured analysis result",
  "videoModel": null,
  "imageModel": null,
  "prompt": "template containing {{slot_id}} placeholders",
  "slots": [
    {
      "id": "subject_1",
      "type": "character",
      "description": "replacement lead",
      "prompt": "English reference-image prompt",
      "source": "user|library|generated|missing",
      "materialId": null,
      "materialName": null,
      "role": null,
      "taskId": null
    }
  ],
  "videoTaskId": null
}
```

Do not store API keys, signed URLs, credential contents, or arbitrary host paths.

## Phase 2 — Fill Replacement Slots

Use this priority:

1. User-provided host-authorized material that clearly matches the slot.
2. Existing owner-scoped Renoise material confirmed by the user.
3. Generate a replacement image from the slot prompt through the host's approval-controlled generation flow.

Never let filename similarity alone choose a character or product. Show the proposed mapping with source, description, and intended role.

### Gate 1 — Plan and Slot Cost

Present in the user's language:

- source-video summary and warnings;
- extracted timeline/style at useful density;
- every replacement slot and proposed source;
- selected image/video models from live capabilities;
- live estimated cost for missing slot images;
- the fact that the source video will be attached to final generation.

Wait for explicit approval before generating a missing slot.

For every approved generated slot:

1. Estimate with actual parameters.
2. Submit through the host approval flow.
3. Record the returned task ID immediately.
4. Poll/resume that ID; never repeat create after a wait interruption.
5. Register the approved result as a reusable material only once.

For user-provided references, register the authorized item once. Record the returned material ID and full server filename. Prompt mentions must use that complete filename, including extension.

Show generated slot images and let the user replace/regenerate individual slots. Do not proceed until all required slots are approved.

## Phase 3 — Prepare Final Generation

Inspect the selected video model again immediately before generation. Then:

1. Register the source video once.
2. Assign it a compatible advertised source/reference-video role.
3. Assign every approved slot a compatible advertised image role.
4. Verify combined reference counts and role combinations.
5. Replace every `{{slot_id}}` with the corresponding exact `@full-filename.ext` mention.
6. Add an explicit source lock: source video controls motion/editing/style; slot materials control identities and replaceable content.
7. Preserve source dialogue only when the user explicitly wants it and spoken language has been confirmed.

The final prompt must contain no unresolved placeholder.

Request a live estimate with actual duration, resolution, output controls, and full material set; also read the live balance.

### Gate 2 — Final Prompt, Assets, and Video Cost

Present in the user's language:

- full final prompt;
- source video → exact material ID and role;
- every slot → exact filename, material ID, and role;
- generation parameters;
- final estimated cost and account balance.

Wait for explicit approval before creating the video task.

## Phase 4 — Generate and Resume Safely

Submit through the host's approval-controlled generation capability and record the returned task ID immediately. Poll/resume that same ID after interruption or timeout; never repeat paid create blindly.

Return the result URL, task ID, source/slot mapping, and warnings. For revisions, keep approved slot materials and change only the identified prompt dimension unless the user asks to replace an asset.

## Failure Rules

| Failure | Action |
|---|---|
| Media analysis unavailable | Stop and explain; do not fall back to a command or copied model code. |
| No model supports source video + slot images | Stop; do not omit the source or invent roles. |
| Source video exceeds supported limits | Ask for/approve a shorter source; do not silently clamp it. |
| Slot generation fails | Keep successful slots and retry only the failed slot after approval. |
| Wait times out | Resume the recorded task ID. |
| Host returns `INPUT_*` / `OUTPUT_*` content-review error | Report the actual error and stop; do not retry paid create or suggest bypasses. |
| Output copies source identity despite slots | Strengthen the source lock or replace the conflicting source; never claim text guarantees isolation. |
