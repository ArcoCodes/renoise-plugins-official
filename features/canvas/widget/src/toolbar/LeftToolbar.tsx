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
  { id: "select", label: "选择 (V)", icon: MousePointer2 },
  { id: "hand", label: "移动画布 (H / Space)", icon: Hand },
  { id: "pen", label: "画笔 (P)", icon: PenLine, divider: true },
  { id: "arrow", label: "箭头 (A)", icon: MoveRight },
  { id: "rectangle", label: "矩形框选 (R)", icon: RectangleHorizontal },
  { id: "ellipse", label: "椭圆圈选 (O)", icon: Circle },
  { id: "text", label: "文字说明 (T)", icon: Type },
  { id: "eraser", label: "橡皮擦 (E)", icon: Eraser, divider: true },
];

export function LeftToolbar({ active, onChange, onImport, onImportVideo }: {
  active: WhiteboardTool;
  onChange: (tool: WhiteboardTool) => void;
  onImport: () => void;
  onImportVideo: () => void;
}) {
  return (
    <aside className="left-toolbar" aria-label="白板工具">
      <button className="tool-button accent-tool" onClick={onImport} title="导入图片" aria-label="导入图片"><ImagePlus /></button>
      <button className="tool-button accent-tool" onClick={onImportVideo} title="导入视频" aria-label="导入视频"><Video /></button>
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
