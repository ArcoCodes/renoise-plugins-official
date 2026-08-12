import { ArrowRight, GitBranch, Image as ImageIcon } from "lucide-react";
import type { WhiteboardDocument, WhiteboardObject } from "../../../shared/document-schema.js";

function labelFor(object: WhiteboardObject | undefined) {
  if (!object) return "已移除素材";
  if (object.type === "image") return object.data.alt || "图片";
  if (object.type === "video-card") return object.data.fileName;
  return "审阅对象";
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
    <aside className="revision-lineage" aria-label="版本关系">
      <header>
        <span><GitBranch />版本关系</span>
        <button onClick={onClose} aria-label="关闭版本关系">×</button>
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
                <small>{intentId ? `返修 ${intentId.slice(-6)}` : "派生"}</small>
              </div>
              <div className="revision-node result">
                <ImageIcon />
                <span>{labelFor(result)}</span>
              </div>
              {taskId && <code>任务 {taskId}</code>}
            </article>
          ))}
        </div>
      ) : (
        <div className="revision-empty">
          <GitBranch />
          <p>生成结果回填后，会自动显示“原素材 → 返修结果”的版本关系。</p>
        </div>
      )}
    </aside>
  );
}
