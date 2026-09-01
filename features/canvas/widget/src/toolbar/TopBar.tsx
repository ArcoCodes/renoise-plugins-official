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
        <input className="board-name" aria-label="Annotation-board name" value={props.name} onChange={(event) => props.onName(event.target.value)} />
        <span className={`save-status ${props.status}`}>{props.status === "saving" ? "Saving…" : props.status === "saved" ? "Saved" : props.status === "conflict" ? "Revision conflict" : "Save failed"}</span>
      </div>
      <div className="top-actions">
        <button onClick={props.onUndo} disabled={!props.canUndo} aria-label="Undo" title="Undo"><Undo2 /></button>
        <button onClick={props.onRedo} disabled={!props.canRedo} aria-label="Redo" title="Redo"><Redo2 /></button>
        <button className="wide-action" onClick={props.onRefresh} aria-label="Refresh server state" title="Refresh"><RefreshCw /></button>
        <button className="pill-action wide-action" onClick={props.onExport}><Download />Export review</button>
        <button className={`pill-action wide-action ${props.lineageOpen ? "active-action" : ""}`} onClick={props.onLineage} aria-label="View revision lineage" title="Revision lineage"><GitBranch />Versions {props.lineageCount}</button>
        <button className="pill-action wide-action" onClick={props.onDone} aria-label="Finish review and return to conversation" title="Return to conversation"><Minimize2 />Done</button>
        <button className="wide-action" onClick={props.onTheme} aria-label="Toggle theme" title="Toggle theme">{props.theme === "dark" ? <Sun /> : <Moon />}</button>
        <button
          className="more-menu-trigger"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
          aria-label="More actions"
          title="More actions"
        >
          <MoreHorizontal />
        </button>
        {moreOpen && (
          <div className="more-menu">
            <button onClick={fromMore(props.onRefresh)}><RefreshCw />Refresh</button>
            <button onClick={fromMore(props.onAnnotate)} disabled={props.selectedCount < 2}><Link2 />Link selected annotation</button>
            <button onClick={fromMore(props.onUnlink)} disabled={!props.hasLinkedSelection}><Unlink2 />Remove annotation link</button>
            <button onClick={fromMore(props.onExport)}><Download />Export review</button>
            <button onClick={fromMore(props.onLineage)}><GitBranch />Revision lineage ({props.lineageCount})</button>
            <button onClick={fromMore(props.onDone)}><Minimize2 />Done and return to conversation</button>
            <button onClick={fromMore(props.onTheme)}>{props.theme === "dark" ? <Sun /> : <Moon />}{props.theme === "dark" ? "Light theme" : "Dark theme"}</button>
          </div>
        )}
      </div>
    </header>
  );
}
