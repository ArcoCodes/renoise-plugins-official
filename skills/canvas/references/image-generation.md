# Image generation and revision

Use `interpretation.annotationBindings`, its target objects, and related marks as the complete reference set. Preserve each asset's SHA-256 in reasoning and do not silently swap the source. The authoritative source and annotation guide have different responsibilities even though both may be uploaded as `reference_image`.

For revision work:

1. Prepare returned `preparableAssetIds` with `prepare_renoise_whiteboard_references`.
2. Use each binding's `authoritativeSourceAssetId` as the clean image being revised. Use `annotationGuideAssetId` only as a location/instruction guide, never as the authoritative pixels or a true mask.
3. Combine the authoritative intent instruction with its normalized regions, arrows, shapes, pen marks, and local text notes.
4. Run the normal Renoise generation workflow with the prepared references. Pass the guide only when the routed image model supports the extra reference image, and say that visible marks must not appear in the output.
5. Insert the result with the exact `revisionOfObjectId` and `revisionIntentId`; the reviewer derives the visible version relationship automatically.

If the task-result bridge is unavailable, leave the generation result intact and explain that insertion—not generation—failed. Do not import an unvalidated filesystem path.
