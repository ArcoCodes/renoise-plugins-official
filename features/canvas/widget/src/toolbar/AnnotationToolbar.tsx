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
  { id: "pen", label: "画笔", icon: PenLine },
  { id: "arrow", label: "箭头", icon: MoveRight },
  { id: "rectangle", label: "矩形", icon: RectangleHorizontal },
  { id: "text", label: "文字", icon: Type },
  { id: "eraser", label: "橡皮", icon: Eraser },
  { id: "pin", label: "编号标注", icon: MapPin },
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
    <div className="annotation-toolbar" aria-label="帧标注工具">
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
      <button type="button" aria-label="撤销" disabled={!canUndo || busy} onClick={onUndo}><Undo2 /></button>
      <button type="button" aria-label="重做" disabled={!canRedo || busy} onClick={onRedo}><Redo2 /></button>
      {showCancel || showAdd ? <span className="toolbar-divider" /> : null}
      {showCancel ? <button type="button" className="toolbar-cancel" disabled={busy} onClick={onCancel}><X />取消</button> : null}
      {showAdd ? <button type="button" className="toolbar-add" disabled={!canAdd || busy} onClick={onAdd}><Check />{busy ? "处理中…" : "添加至对话"}</button> : null}
    </div>
  );
}
