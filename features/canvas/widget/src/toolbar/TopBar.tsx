import { useState } from "react";
import { Download, GitBranch, Link2, Minimize2, Moon, MoreHorizontal, Redo2, RefreshCw, Sun, Undo2, Unlink2 } from "lucide-react";

export function TopBar(props: {
  name: string;
  status: string;
  theme: "light" | "dark";
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  hasLinkedSelection: boolean;
  lineageCount: number;
  lineageOpen: boolean;
  onName: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRefresh: () => void;
  onAnnotate: () => void;
  onUnlink: () => void;
  onExport: () => void;
  onLineage: () => void;
  onDone: () => void;
  onTheme: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const fromMore = (action: () => void) => () => {
    setMoreOpen(false);
    action();
  };

  return (
    <header className="top-bar">
      <div className="top-left">
        <span className="renoise-mark" aria-hidden>R</span>
        <input className="board-name" aria-label="白板名称" value={props.name} onChange={(event) => props.onName(event.target.value)} />
        <span className={`save-status ${props.status}`}>{props.status === "saving" ? "Saving…" : props.status === "saved" ? "Saved" : props.status === "conflict" ? "Revision conflict" : "Save failed"}</span>
      </div>
      <div className="top-actions">
        <button onClick={props.onUndo} disabled={!props.canUndo} aria-label="撤销" title="撤销"><Undo2 /></button>
        <button onClick={props.onRedo} disabled={!props.canRedo} aria-label="重做" title="重做"><Redo2 /></button>
        <button className="wide-action" onClick={props.onRefresh} aria-label="刷新服务端状态" title="刷新"><RefreshCw /></button>
        <button className="pill-action wide-action" onClick={props.onExport}><Download />导出 Review</button>
        <button className={`pill-action wide-action ${props.lineageOpen ? "active-action" : ""}`} onClick={props.onLineage} aria-label="查看版本关系" title="版本关系"><GitBranch />版本 {props.lineageCount}</button>
        <button className="pill-action wide-action" onClick={props.onDone} aria-label="完成审阅并返回对话" title="返回对话"><Minimize2 />完成</button>
        <button className="wide-action" onClick={props.onTheme} aria-label="切换主题" title="切换主题">{props.theme === "dark" ? <Sun /> : <Moon />}</button>
        <button
          className="more-menu-trigger"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
          aria-label="更多操作"
          title="更多操作"
        >
          <MoreHorizontal />
        </button>
        {moreOpen && (
          <div className="more-menu">
            <button onClick={fromMore(props.onRefresh)}><RefreshCw />刷新</button>
            <button onClick={fromMore(props.onAnnotate)} disabled={props.selectedCount < 2}><Link2 />关联所选批注</button>
            <button onClick={fromMore(props.onUnlink)} disabled={!props.hasLinkedSelection}><Unlink2 />移除批注关系</button>
            <button onClick={fromMore(props.onExport)}><Download />导出 Review</button>
            <button onClick={fromMore(props.onLineage)}><GitBranch />版本关系 ({props.lineageCount})</button>
            <button onClick={fromMore(props.onDone)}><Minimize2 />完成并返回对话</button>
            <button onClick={fromMore(props.onTheme)}>{props.theme === "dark" ? <Sun /> : <Moon />}{props.theme === "dark" ? "浅色主题" : "深色主题"}</button>
          </div>
        )}
      </div>
    </header>
  );
}
