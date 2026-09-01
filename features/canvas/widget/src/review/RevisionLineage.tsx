import { ArrowRight, GitBranch, Image as ImageIcon } from "lucide-react";
import type { WhiteboardDocument, WhiteboardObject } from "../../../shared/document-schema.js";

function labelFor(object: WhiteboardObject | undefined) {
  if (!object) return "Removed asset";
  if (object.type === "image") return object.data.alt || "Image";
  if (object.type === "video-card") return object.data.fileName;
  return "Review object";
}

export function revisionEdges(document: WhiteboardDocument) {
  const byId = new Map(document.page.objects.map((object) => [object.id, object]));
  return document.page.objects.flatMap((object) => {
    if (object.type !== "image" || !("relation" in object.data.source) || object.data.source.relation !== "revision-of") return [];
    return [{
      source: byId.get(object.data.source.objectId),
      result: object,
      intentId: object.data.source.revisionIntentId,
      taskId: object.data.source.taskId,
    }];
  });
}

export function RevisionLineage({ document, selectedId, onClose }: {
  document: WhiteboardDocument;
  selectedId?: string;
  onClose: () => void;
}) {
  const edges = revisionEdges(document);
  const focused = selectedId
    ? edges.filter(({ source, result }) => source?.id === selectedId || result.id === selectedId)
    : [];
  const visible = focused.length ? focused : edges.slice(-8).reverse();

  return (
    <aside className="revision-lineage" aria-label="Revision lineage">
      <header>
        <span><GitBranch />Revision lineage</span>
        <button onClick={onClose} aria-label="Close revision lineage">×</button>
      </header>
      {visible.length ? (
        <div className="revision-list">
          {visible.map(({ source, result, intentId, taskId }) => (
            <article className="revision-edge" key={result.id}>
              <div className="revision-node">
                <ImageIcon />
                <span>{labelFor(source)}</span>
              </div>
              <div className="revision-arrow">
                <ArrowRight />
                <small>{intentId ? `Revision ${intentId.slice(-6)}` : "Derived"}</small>
              </div>
              <div className="revision-node result">
                <ImageIcon />
                <span>{labelFor(result)}</span>
              </div>
              {taskId && <code>Task {taskId}</code>}
            </article>
          ))}
        </div>
      ) : (
        <div className="revision-empty">
          <GitBranch />
          <p>After a generated result is returned, the source-to-revision relationship appears here automatically.</p>
        </div>
      )}
    </aside>
  );
}
