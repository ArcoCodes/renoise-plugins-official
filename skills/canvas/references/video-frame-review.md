# Video-frame review

Treat an extracted frame as a time-localized instruction on its source video, with provenance:

- source video asset ID;
- source SHA-256;
- exact `timeMs`.

The default operation is to revise the source video around the annotated time, not to animate the screenshot as a new clip. The source video remains authoritative for duration, audio, timing, camera, composition, and all unannotated content. The screenshot and structured marks explain the requested local change.

Confirm that the intent preserves the video asset ID, SHA-256, and `sourceTimeMs`. Use `interpretation.preparableAssetIds` to prepare both the source video and annotated frame assets. Never upload only the screenshots and then select a first/last-frame generation model.

For two or more same-video frames:

- Treat `candidateBoundsMs` as a candidate only. Multiple timestamps do not become an explicit range merely because there are two of them.
- If the instruction and source-video analysis link them as one action or transformation, their earliest/latest timestamps may bound the source-video edit interval.
- If they describe independent changes, keep them as separate local anchors; do not rewrite the unmentioned time between them.
- If they track one subject across time, bind them as tracking anchors. Ask the user whether to edit a bounded interval or all relevant appearances when that distinction materially changes the result.

For one frame, use a textual range when supplied. If the temporal extent is missing and affects routing or cost, ask for that boundary while keeping the operation classified as source-video editing.

Do not generalize a frame annotation to the entire clip. Conversely, do not reinterpret timecoded frames as standalone endpoint images unless the user explicitly asks for a new clip or interpolation. The player is only a seeking aid; the structured provenance defines the edit target.

After model routing, use Seedance 2.5's integer-second prompt convention (`[4s]`, confirmed ranges such as `[0s-4s]`) while retaining exact `sourceTimeMs` internally. Other models keep their existing time expression.
