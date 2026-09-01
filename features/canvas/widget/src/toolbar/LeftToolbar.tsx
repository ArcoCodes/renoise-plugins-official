import {
  Circle,
  Eraser,
  Hand,
  ImagePlus,
  MousePointer2,
  MoveRight,
  PenLine,
  RectangleHorizontal,
  Type,
  Video,
} from "lucide-react";
import type { WhiteboardTool } from "../canvas/interaction-controller.js";

const tools: Array<{ id: WhiteboardTool; label: string; icon: typeof MousePointer2; divider?: boolean }> = [
  { id: "select", label: "Select (V)", icon: MousePointer2 },
  { id: "hand", label: "Pan canvas (H / Space)", icon: Hand },
  { id: "pen", label: "Pen (P)", icon: PenLine, divider: true },
  { id: "arrow", label: "Arrow (A)", icon: MoveRight },
  { id: "rectangle", label: "Rectangle (R)", icon: RectangleHorizontal },
  { id: "ellipse", label: "Ellipse (O)", icon: Circle },
  { id: "text", label: "Text (T)", icon: Type },
  { id: "eraser", label: "Eraser (E)", icon: Eraser, divider: true },
];

export function LeftToolbar({ active, onChange, onImport, onImportVideo }: {
  active: WhiteboardTool;
  onChange: (tool: WhiteboardTool) => void;
  onImport: () => void;
  onImportVideo: () => void;
}) {
  return (
    <aside className="left-toolbar" aria-label="Annotation-board tools">
      <button className="tool-button accent-tool" onClick={onImport} title="Import image" aria-label="Import image"><ImagePlus /></button>
      <button className="tool-button accent-tool" onClick={onImportVideo} title="Import video" aria-label="Import video"><Video /></button>
      <span className="tool-divider" />
      {tools.map(({ id, label, icon: Icon, divider }) => (
        <span key={id} className="tool-entry">
          {divider && <span className="tool-divider" />}
          <button className={`tool-button ${active === id ? "active" : ""}`} aria-pressed={active === id} onClick={() => onChange(id)} title={label} aria-label={label}><Icon /></button>
        </span>
      ))}
    </aside>
  );
}
