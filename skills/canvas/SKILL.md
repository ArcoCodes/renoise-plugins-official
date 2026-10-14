---
name: canvas
description: Open and use the Renoise annotation board for explicit image or video-frame annotation and structured visual requests. Use only when the user explicitly asks to open the annotation board, accepts an offer to annotate, or submits an existing Renoise revisionIntentId.
---

# Renoise annotation board

Use the annotation board as an optional visual-intent surface, not as a node graph, timeline, creation workspace, or automatic step in generation.

## Decide whether to open

- Do not call `render_renoise_whiteboard_widget` merely because visual annotation could help.
- If the request is clear without region/frame annotation, proceed directly through Renoise.
- If visual ambiguity is material, offer the annotation board in normal text and wait for the user to accept.
- An explicit request such as "打开标注板" or "我想圈出要改的位置" is acceptance.
- Within one task, reuse the existing `canvasSessionId`. If the user explicitly asks to bring the board back into view, call `render_renoise_whiteboard_widget` with that `canvasSessionId`; this remounts the UI for the same session and requests fullscreen. Never tell the user to click an earlier tool result, and never use a read/prepare tool as a UI launcher.

## Open a board

1. Resolve the project directory already in scope. Do not guess a broader directory.
2. Call `render_renoise_whiteboard_widget` with that absolute `projectDir` to create a new session. For an existing active session, pass only `canvasSessionId` to reopen it.
3. A new session shows a compact launcher and opens only after the user clicks it and approves the exact path. Reopening an already authorized session requests fullscreen immediately and requires no second approval.
4. Keep the returned `canvasSessionId`; every later operation requires that active authorization. Board data and submitted annotation requests persist in the approved project and may be read through a later authorized session for the same page.

## Handle an annotation submission

Uploads, estimates, and generation go through the Renoise MCP tools (`upload_files`, `estimate_cost`, `create_tasks`, `wait_tasks`), the same as everywhere else; the board's own tools only read the annotation and prepare local files.

The widget sends a user message containing `canvasSessionId` and `revisionIntentId` only after it has atomically saved the source selection, related annotations, timecodes, and instruction.

1. Call `get_renoise_whiteboard_revision_intent` with both identifiers.
2. Use only the returned `revisionIntent`, `interpretation`, objects, and `AnnotationRecord` relationships. Prefer `interpretation.annotationBindings`: each binding explicitly maps an annotation to its authoritative source, rendered annotation guide, normalized regions, and (for video frames) exact `sourceTimeMs`. Never infer that nearby objects are references.
3. If `interpretation.defaultOperation` is `source-video-segment-edit`, apply the video-edit default below before model routing or duration selection.
4. Call `prepare_renoise_whiteboard_references` with `preparableAssetIds` when generation needs the annotation guides and authoritative sources. Match each prepared path back to `interpretation.uploadPlan` by `assetId` and `purpose`: upload them in one `upload_files` call, giving `annotation_guide` entries `scope: "mask"` and `authoritative_source` entries the default `scope` (`user`). `scope=mask` hides a tool intermediate from the user library; it does **not** turn the visible marks into a provider mask. Never expose an annotation guide as a reusable user-library material.
5. Treat only `materialReferences` / `materialIds` / `materialTokens` returned by this exact revision intent as already-existing Renoise materials. Do not locally prepare or upload them, and never include other entries from the page's material pool. Add the referenced IDs to the estimate and to the `create_tasks` `references`: use `reference_image` for image references and `reference_video` for video references, adjusted only when the user's explicit semantics require another compatible reference role. These remote references supplement the local source and annotation snapshots; the local source video remains authoritative and the snapshots remain the location/edit guides.
6. Finish model routing and every deterministic prompt transformation first, including material tokens, Seedance-only time suffixes, preservation constraints, and any required edit trigger. This produces the exact text that will be sent as the `create_tasks` prompt; do not add or rewrite prompt text after approval.
7. Run the matching `estimate_cost`, then follow the Renoise tools' approval rule for paid work: show the complete final prompt in a fenced block with the model, type, resolution, duration/ratio, ordered material IDs and roles, estimated credits, and current balance, end the turn, and wait for the user's explicit approval.
8. Pressing **Send annotation** approves only the structured annotation intent, never a final prompt or price the user had not yet seen; neither does an earlier “直接生成”, “生成最终结果”, or “按标注生成”.
9. After approval, create exactly one task with `create_tasks` using the approved prompt and arguments. Any prompt, model, parameter, material, or price change invalidates the approval and requires a new proposal and confirmation. Reuse the returned task ID with `wait_tasks`; never create again merely because a wait ended before the task finished.
10. Return the final generated result directly in the current conversation. The annotation board is only an input surface and must not be used for result backfill, revision approval, or generated-result comparison.

### What the proposal must show

- Show the provider-facing semantic text, including automatically added time-control tokens and edit triggers. Deterministic server-side material alias rewriting may be explained, but it must not hide or change the approved instruction.
- Do not call `create_tasks` in the same turn that first presents the proposal. Analysis, reference preparation, hidden-guide upload, model inspection, and `estimate_cost` may happen before approval because they do not start a paid task.

### Video-edit default (hard rule)

- A submitted source with `sourceVideoAssetId`, `sourceVideoSha256`, and `sourceTimeMs` is a time-localized edit of that source video by default. The source video is the authoritative generation material; annotated frame PNGs explain what to change.
- Preserve the original duration, audio, timing, camera, and all unannotated portions unless the user's instruction explicitly changes them.
- Never route same-video timestamp frames as standalone image-to-video, first/last-frame interpolation, or a newly generated short clip merely because two screenshots exist. That requires an explicit user request such as “生成新片段”, “首尾帧插值”, or an equivalent instruction.
- `videoEditContexts[].annotatedTimeMs` and `candidateBoundsMs` are anchors, not a confirmed interval. `annotationBoundsMs` intentionally remains null until intent analysis resolves the semantics. When the instruction clearly describes one continuous action from an earlier frame to a later one, the agent may promote `candidateBoundsMs` to the bounded edit interval. When annotations describe tracking samples or unrelated changes, keep them as tracking/localized anchors instead.
- A single annotated timestamp still means source-video editing. Use an explicit textual range when present; otherwise ask only for the missing temporal boundary if it materially affects routing, cost, or output. Do not fall back to standalone frame animation.
- Before routing multi-anchor subject replacement, continuity, transformation, or “replace all appearances” requests, analyze the authoritative source video and bind the structured regions to the visible subject over time. If anchors could reasonably mean either a bounded interval or tracking samples, and that choice changes the output, model, or price, ask one focused clarification question before estimating.
- Choose a live model and material role that accepts the authoritative source video. If no compatible source-video editing path exists, stop and explain; never silently replace it with endpoint-frame generation.
- Upload and pass the authoritative source video as `reference_video` with `scope=user`; upload each rendered annotation guide as `reference_image` with `scope=mask`. Pass guides to a generation model only when its live capability accepts additional reference images, and explicitly state that visible rectangles/arrows/text are location instructions that must not appear in the output. Preserve reference order with material indexes when supported. The source video—not a frame PNG—remains authoritative.
- Estimate with `estimate_cost` using `edit: true`, `hasVideoReference: true`, the resolution, and the source video's positive length in seconds as `duration`. Create with `create_tasks` using `duration: -1`, `ratio: "adaptive"`, the resolution, and `references` `[{ source: reference_video }, { annotated frame: reference_image }]`. Never estimate an automatic-duration edit with `-1`.
- For Seedance, end the final prompt with the line `[Edit the video as instructed above]` unless it is already present. This is the explicit source-video edit trigger paired with `duration: -1`; do not append it to forward/backward extension or ordinary reference generation prompts.
- **Seedance 2.5-only time adapter:** after routing specifically to `seedance-2.5-byteplus` / `sd-2.5`, render each annotated guide reference with an integer-second suffix such as `@material:42 [4s]`, using `floor(sourceTimeMs / 1000)`. Render a confirmed continuous interval as `[0s-4s]`. Keep exact milliseconds in structured reasoning, but do not send `00:04.195` as the provider time-control syntax. Do not apply this normalization to any other image or video model. Make the transformation idempotent when a prompt already contains the matching token.

### Image-revision default

- Image and video annotations share `annotationBindings` and normalized spatial regions. Image bindings have no temporal semantics.
- For an image revision, upload/pass the binding's `authoritativeSourceAssetId` as the clean `reference_image`. The `annotationGuideAssetId` is a second, hidden `reference_image` used to explain location when the routed model supports multiple image references.
- Explicitly map the two responsibilities in the prompt: the authoritative image supplies all original pixels/composition, while the guide supplies only the intended region and marks. Do not treat visible annotation colors as desired output pixels or as a true binary mask.

If Codex or the plugin restarted and the old `canvasSessionId` expired, open and authorize the exact same project again. Then call `get_renoise_whiteboard_revision_intent` with the new `canvasSessionId` and the known `revisionIntentId`. If the intent ID is no longer present in task context, omit `revisionIntentId` to recover the latest persisted annotation for that authorized page. Do not ask the user to redraw or resubmit solely because a session expired.

Read only the reference needed for the current task:

- Image generation or revision: [image-generation.md](references/image-generation.md)
- Annotation interpretation and review export: [annotation-review.md](references/annotation-review.md)
- Video-frame review: [video-frame-review.md](references/video-frame-review.md)

## Safety rules

- Never pass an arbitrary local path to an insert tool.
- Never substitute the project root or home directory for the user-approved directory.
- Treat prepared material paths as short-lived, read-only inputs.
- Preserve source media and return generated results directly in the conversation.
- Do not introduce HTML, Slides, tldraw, Excalidraw, React Flow, or a second canvas runtime.
