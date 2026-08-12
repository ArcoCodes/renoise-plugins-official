# Video-frame review

Treat an extracted frame as a time-localized instruction on its source video, with provenance:

- source video asset ID;
- source SHA-256;
- exact `timeMs`.

The default operation is to revise the source video around the annotated time, not to animate the screenshot as a new clip. The source video remains authoritative for duration, audio, timing, camera, composition, and all unannotated content. The screenshot and structured marks explain the requested local change.

Confirm that the intent preserves the video asset ID, SHA-256, and `sourceTimeMs`. Use `interpretation.preparableAssetIds` to prepare both the source video and annotated frame assets. Never upload only the screenshots and then select a first/last-frame generation model.

For two or more same-video frames:

- If the instruction links them as one action or transformation, their earliest/latest timestamps bound the source-video edit interval.
- If they describe independent changes, keep them as separate local anchors; do not rewrite the unmentioned time between them.

For one frame, use a textual range when supplied. If the temporal extent is missing and affects routing or cost, ask for that boundary while keeping the operation classified as source-video editing.

Do not generalize a frame annotation to the entire clip. Conversely, do not reinterpret timecoded frames as standalone endpoint images unless the user explicitly asks for a new clip or interpolation. The player is only a seeking aid; the structured provenance defines the edit target.
