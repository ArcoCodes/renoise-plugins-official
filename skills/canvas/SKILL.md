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
- Within one task, reuse the existing `canvasSessionId`; do not render a second widget.

## Open a board

1. Resolve the project directory already in scope. Do not guess a broader directory.
2. Call `render_renoise_whiteboard_widget` once with that absolute `projectDir`.
3. The message stream shows a compact launcher. The full annotation board opens only after the user clicks it and approves the exact path.
4. Keep the returned `canvasSessionId`; every later operation requires that active authorization. Board data and submitted annotation requests persist in the approved project and may be read through a later authorized session for the same page.

## Handle an annotation submission

The widget sends a user message containing `canvasSessionId` and `revisionIntentId` only after it has atomically saved the source selection, related annotations, timecodes, and instruction.

1. Call `get_renoise_whiteboard_revision_intent` with both identifiers.
2. Use only the returned `revisionIntent`, `interpretation`, objects, and `AnnotationRecord` relationships. Never infer that nearby objects are references.
3. If `interpretation.defaultOperation` is `source-video-segment-edit`, apply the video-edit default below before model routing or duration selection.
4. Call `prepare_renoise_whiteboard_references` with `preparableAssetIds` when generation needs the annotated snapshots and authoritative source video. Do not prepare only the PNG snapshots and discard their source-video provenance.
5. Generate or revise media through the Renoise generation workflow.
6. Return the final generated result directly in the current conversation. The annotation board is only an input surface and must not be used for result backfill, revision approval, or generated-result comparison.

### Video-edit default (hard rule)

- A submitted source with `sourceVideoAssetId`, `sourceVideoSha256`, and `sourceTimeMs` is a time-localized edit of that source video by default. The source video is the authoritative generation material; annotated frame PNGs explain what to change.
- Preserve the original duration, audio, timing, camera, and all unannotated portions unless the user's instruction explicitly changes them.
- Never route same-video timestamp frames as standalone image-to-video, first/last-frame interpolation, or a newly generated short clip merely because two screenshots exist. That requires an explicit user request such as “生成新片段”, “首尾帧插值”, or an equivalent instruction.
- When the instruction describes one continuous action from an earlier annotated frame to a later one, use the earliest and latest timestamps as the bounded edit interval. When annotations describe unrelated changes, treat them as separate localized edit anchors rather than rewriting the entire span between them.
- A single annotated timestamp still means source-video editing. Use an explicit textual range when present; otherwise ask only for the missing temporal boundary if it materially affects routing, cost, or output. Do not fall back to standalone frame animation.
- Choose a live model and material role that accepts the authoritative source video. If no compatible source-video editing path exists, stop and explain; never silently replace it with endpoint-frame generation.

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
