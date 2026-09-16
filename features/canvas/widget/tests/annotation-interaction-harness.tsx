import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Canvas as FabricCanvas } from "fabric";
import { createEmptyDocument, WhiteboardDocumentSchema } from "../../shared/document-schema.js";
import { FabricViewport } from "../src/canvas/FabricViewport.js";
import { documentFromCanvas, getMeta } from "../src/canvas/fabric-adapter.js";
import type { WhiteboardTool } from "../src/canvas/interaction-controller.js";

declare global {
  interface Window {
    __annotationSnapshot?: () => ReturnType<typeof documentFromCanvas>;
    __annotationFlags?: () => Array<{ id?: string; selectable: boolean; evented: boolean }>;
    __annotationActiveId?: () => string | undefined;
    __annotationOverlayCount?: () => number;
    __annotationChanged?: ReturnType<typeof documentFromCanvas>;
    __annotationDrag?: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
    __annotationReadCount?: number;
  }
}

const now = "2026-07-31T00:00:00.000Z";
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==";
const source = WhiteboardDocumentSchema.parse({
  schemaVersion: 1,
  page: {
    id: "page_annotation",
    name: "Annotation Interaction",
    revision: 0,
    assets: {
      asset_source: {
        id: "asset_source",
        relativePath: "assets/source.png",
        mimeType: "image/png",
        sha256: "1".repeat(64),
        byteLength: 68,
        width: 200,
        height: 120,
        createdAt: now,
      },
    },
    objects: [{
      id: "object_source",
      type: "image",
      parentId: null,
      transform: { x: 100, y: 100, width: 200, height: 120, rotation: 0 },
      zIndex: 1,
      locked: false,
      hidden: false,
      style: {},
      data: { assetId: "asset_source", alt: "source.png", source: { kind: "file-picker" } },
      createdAt: now,
      updatedAt: now,
    }],
    annotations: [],
  },
});

function Harness() {
  const [tool, setTool] = useState<WhiteboardTool>("select");
  const [documentState, setDocumentState] = useState(() => createEmptyDocument(source.page.id, source.page.name));
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const documentTimer = window.setTimeout(() => setDocumentState(source), 50);
    const visibilityTimer = window.setTimeout(() => setVisible(true), 120);
    return () => {
      window.clearTimeout(documentTimer);
      window.clearTimeout(visibilityTimer);
    };
  }, []);
  return (
    <main data-active-tool={tool}>
      <nav>
        <button id="select-tool" onClick={() => setTool("select")}>Select</button>
        <button id="rectangle-tool" onClick={() => setTool("rectangle")}>Rectangle</button>
        <button id="eraser-tool" onClick={() => setTool("eraser")}>Eraser</button>
      </nav>
      <div className="viewport-shell" style={{ display: visible ? "block" : "none" }}>
        <FabricViewport
          document={documentState}
          annotations={[]}
          camera={{ x: 0, y: 0, zoom: 1 }}
          theme="light"
          tool={tool}
          temporaryHand={false}
          activeTargetId="object_source"
          onToolComplete={setTool}
          onReady={(canvas: FabricCanvas) => {
            window.__annotationSnapshot = () => documentFromCanvas(canvas, source);
            window.__annotationFlags = () => canvas.getObjects().flatMap((object) => {
              const meta = getMeta(object);
              return meta ? [{ id: meta.id, selectable: object.selectable, evented: object.evented }] : [];
            });
            window.__annotationOverlayCount = () => canvas.getObjects().filter((object) => !getMeta(object)).length;
            window.__annotationActiveId = () => {
              const active = canvas.getActiveObject();
              return active ? getMeta(active)?.id : undefined;
            };
            window.__annotationDrag = (start, end) => {
              const bounds = canvas.upperCanvasEl.getBoundingClientRect();
              const pointer = (point: { x: number; y: number }, buttons: number) => new PointerEvent("pointermove", {
                clientX: bounds.left + point.x,
                clientY: bounds.top + point.y,
                button: 0,
                buttons,
                pointerId: 1,
                pointerType: "mouse",
                isPrimary: true,
              });
              canvas.fire("mouse:down", { e: pointer(start, 1) } as never);
              canvas.fire("mouse:move", { e: pointer(end, 1) } as never);
              canvas.fire("mouse:up", { e: pointer(end, 0) } as never);
            };
            const timer = window.setInterval(() => {
              if (!canvas.getObjects().some((object) => getMeta(object)?.id === "object_source")) return;
              window.clearInterval(timer);
              document.body.dataset.annotationReady = "true";
            }, 10);
          }}
          onChanged={(canvas) => { window.__annotationChanged = documentFromCanvas(canvas, source); }}
          onSelection={() => undefined}
          onViewChanged={() => undefined}
          readAsset={async () => {
            window.__annotationReadCount = (window.__annotationReadCount ?? 0) + 1;
            return tinyPng;
          }}
        />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
