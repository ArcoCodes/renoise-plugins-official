# Scenario A — Reference Video Remake / 剪同款

**Trigger**: The user provides a reference video and asks to recreate, remix, 复刻, or 剪同款 with their own character, product, brand, or scene.

This is a two-gate workflow. The native CLI owns analysis, uploads, live capabilities, costs, and tasks. This skill owns slot matching, creative decisions, approvals, and resumable plan state.

---

## Non-Negotiable Source Policy

The confirmed product behavior is: **the source video is always attached to the final generation task** through a compatible video role advertised by the selected model.

Before planning replacements:

1. Run `renoise model --json` and inspect candidate video models.
2. Select a model that advertises both a compatible source/reference-video role and every image role needed by the replacement slots.
3. Check the live guidance, reference counts, duration, ratio, audio behavior, and role combinations.
4. If no model supports the complete source-video + replacement-image combination, stop and explain the incompatibility. Never silently omit the source video or invent a role.

The final prompt must state that the source video supplies timing, camera motion, composition, transitions, effects, pacing, and emotional beats. Replacement materials supply identity, product, wardrobe, props, and other slotted content. This text reduces accidental copying but is not a security boundary; normal copyright, public-figure, and content moderation rules still apply.

---

## Phase 1 — Analyze and Build a Remake Plan

Verify the installed CLI exposes `renoise analyze`, then run:

```bash
renoise analyze <source-video> \
  --mode template --target video --language <user-language> --json \
  > remake-analysis.json
```

The result uses Gemini 3.1 Pro and contains:

- factual `analysis`: summary, complete timeline, composition, style, subjects, and audio;
- model-neutral `prompt` with `{{slot_id}}` placeholders;
- `slots`: each replaceable character/product/object/scene/style plus an English reference-image generation prompt;
- `warnings`: inferred or uncertain details.

Create `remake-plan.json` beside it. Keep this file updated after every upload and paid task so another session can resume without recreating charges:

```json
{
  "version": "v1",
  "source": {
    "path": "/local/source.mp4",
    "materialId": null,
    "role": null
  },
  "analysisFile": "remake-analysis.json",
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
      "localPath": null,
      "materialId": null,
      "materialName": null,
      "role": null,
      "taskId": null
    }
  ],
  "videoTaskId": null
}
```

Do not put API keys, signed URLs, or credential-file contents in the plan.

---

## Phase 2 — Fill Replacement Slots

Use this priority for every slot:

1. **User-provided local material** that clearly matches the slot.
2. **Existing Renoise material** found with `renoise material --search <term> --json` and confirmed by the user.
3. **Generate a replacement image** from the slot's English `prompt`.

Never let filename similarity alone choose a character or product. Show the proposed mapping with source, description, and intended generation role.

### Gate 1 — Plan and Slot Cost

Present in the user's language:

- source-video summary and warnings;
- extracted timeline/style at useful density;
- every replacement slot and proposed user/library/generated source;
- selected image and video models from live capabilities;
- estimated cost for all missing slot images;
- the fact that the source video will be attached to final generation.

Wait for explicit approval before generating any missing slot image.

For each approved missing slot:

```bash
renoise task cost <selected-image-model> --json
renoise task create <selected-image-model> \
  --type image --prompt-file <slot-prompt-file> \
  [only advertised image options] --json
# Record task.id in remake-plan.json immediately.
renoise task wait <task-id> --timeout 15m --json
renoise task chain <task-id> --json
```

For user-provided files:

```bash
renoise upload <replacement-file> --type image --json
```

After a generated or uploaded material exists, query it with `renoise material --ids <id> --json` and record its exact server filename. Prompt mentions must use that complete filename, including extension.

Show generated slot images to the user and let them replace or regenerate individual slots. Do not proceed until every required slot is approved.

---

## Phase 3 — Prepare the Final Generation

Inspect the selected video model again immediately before generation:

```bash
renoise model <selected-video-model> --json
```

Then:

1. Upload the source video once with `renoise upload <source-video> --type video --json`.
2. Assign it a compatible advertised source/reference-video role.
3. Assign each approved slot material a compatible advertised image role.
4. Verify the combined reference counts and role combination remain valid.
5. Replace every `{{slot_id}}` in the template with the corresponding material's exact `@full-filename.ext` mention.
6. Add an explicit source lock: source video controls motion/editing/style; named slot materials control identities and replaceable content.
7. Preserve source dialogue only when the user explicitly wants it and the spoken language has been confirmed. Otherwise describe the desired audio rather than copying words blindly.

The approved final prompt must contain no unresolved `{{slot_id}}` placeholder.

Estimate with the actual duration, resolution, watermark, and video-reference material set:

```bash
renoise task cost <selected-video-model> \
  --duration <seconds> --resolution <value> \
  --materials "<source-id>:<video-role>,<slot-id>:<image-role>,..." --json
renoise account status --json
```

### Gate 2 — Final Prompt, Assets, and Video Cost

Present in the user's language:

- full final prompt;
- source video → exact material ID and role;
- every slot → exact filename, material ID, and role;
- generation parameters;
- final estimated video cost and account balance.

Wait for explicit approval before creating the video task.

---

## Phase 4 — Generate and Resume Safely

Save the approved prompt to a file, then create and wait separately:

```bash
renoise task create <selected-video-model> \
  --prompt-file <approved-prompt-file> \
  --materials "<source-id>:<video-role>,<slot-id>:<image-role>,..." \
  [only advertised generation options] --json
# Record task.id in remake-plan.json immediately.
renoise task wait <task-id> --timeout 15m --json
```

If waiting is interrupted or times out, read `videoTaskId` from `remake-plan.json` and rerun `wait`. Never rerun paid `create` blindly.

Return the result URL, task ID, source/slot mapping, and any warnings. If the user requests a revision, keep approved slot materials and change only the identified prompt dimension unless they explicitly ask to replace an asset.

---

## Failure Rules

| Failure | Action |
|---|---|
| `renoise analyze` missing | Run the Setup / Account recovery flow; do not fall back to plugin-side Gemini code. |
| No model supports source video + slot images | Stop and explain; do not omit the source or invent roles. |
| Source video exceeds supported limits | Ask the user to provide/approve a shorter source; do not silently clamp it. |
| Slot generation fails | Keep successful slot tasks/materials and retry only the failed slot after approval. |
| Wait times out | Resume the recorded task ID. |
| CLI/API returns `INPUT_*` / `OUTPUT_*` content-review error | Report the actual error and stop; do not retry the paid create operation or suggest bypasses. |
| Output copies source identity despite slots | Strengthen the source lock or replace the conflicting source; never claim text guarantees isolation. |
