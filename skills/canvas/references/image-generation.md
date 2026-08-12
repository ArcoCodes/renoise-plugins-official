# Image generation and revision

Use `RevisionIntent.sources`, its target objects, and related marks as the complete reference set. Preserve each asset's SHA-256 in reasoning and do not silently swap the source.

For revision work:

1. Prepare returned asset IDs with `prepare_renoise_whiteboard_references`.
2. Combine the authoritative intent instruction with its arrows, shapes, pen marks, and local text notes.
3. Run the normal Renoise generation workflow with the prepared references.
4. Insert the result with the exact `revisionOfObjectId` and `revisionIntentId`; the reviewer derives the visible version relationship automatically.

If the task-result bridge is unavailable, leave the generation result intact and explain that insertion—not generation—failed. Do not import an unvalidated filesystem path.
