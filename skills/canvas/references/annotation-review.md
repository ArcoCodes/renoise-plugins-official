# Annotation review

`AnnotationRecord.targetObjectIds` identifies the media under review. `markObjectIds` identifies the marks that explain requested changes.

Interpret common marks as follows:

- Arrow: directs attention toward its endpoint.
- Rectangle or ellipse: scopes a region.
- Freehand: emphasizes or crosses out a region; use accompanying text when present.
- Text: carries a local note; `RevisionIntent.instruction` is the authoritative overall request.

Prioritize the submitted `RevisionIntent` and explicit annotation relationships over spatial proximity. Marks created while a source is active are linked automatically; if an imported legacy board contains unlinked marks, do not infer a relationship.

A review snapshot intentionally excludes toolbar chrome, handles, and unrelated objects. Use it as supporting context; retain structured object and annotation data as the authoritative intent.
