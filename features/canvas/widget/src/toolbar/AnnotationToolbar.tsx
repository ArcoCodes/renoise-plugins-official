import {
  Check,
  Eraser,
  MapPin,
  MoveRight,
  PenLine,
  RectangleHorizontal,
  Redo2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import type { WhiteboardTool } from "../canvas/interaction-controller.js";

const tools: Array<{ id: WhiteboardTool; label: string; icon: typeof PenLine }> = [
  { id: "pen", label: "Pen", icon: PenLine },
  { id: "arrow", label: "Arrow", icon: MoveRight },
  { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { id: "text", label: "Text", icon: Type },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "pin", label: "Numbered marker", icon: MapPin },
];

export function AnnotationToolbar({
  active,
  canUndo,
  canRedo,
  canAdd,
  showCancel,
  showAdd,
  busy,
  onChange,
  onUndo,
  onRedo,
  onCancel,
  onAdd,
}: {
  active: WhiteboardTool;
  canUndo: boolean;
  canRedo: boolean;
  canAdd: boolean;
  showCancel: boolean;
  showAdd: boolean;
  busy: boolean;
  onChange: (tool: WhiteboardTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="annotation-toolbar" aria-label="Frame annotation tools">
      {tools.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={active === id ? "active" : ""}
          aria-label={label}
          aria-pressed={active === id}
          onClick={() => onChange(id)}
        ><Icon /></button>
      ))}
      <span className="toolbar-divider" />
      <button type="button" aria-label="Undo" disabled={!canUndo || busy} onClick={onUndo}><Undo2 /></button>
      <button type="button" aria-label="Redo" disabled={!canRedo || busy} onClick={onRedo}><Redo2 /></button>
      {showCancel || showAdd ? <span className="toolbar-divider" /> : null}
      {showCancel ? <button type="button" className="toolbar-cancel" disabled={busy} onClick={onCancel}><X />Cancel</button> : null}
      {showAdd ? <button type="button" className="toolbar-add" disabled={!canAdd || busy} onClick={onAdd}><Check />{busy ? "Processing…" : "Add to prompt"}</button> : null}
    </div>
  );
}
