import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoveRight, PenLine, Plus, RectangleHorizontal, Redo2, Type, Undo2, X } from "lucide-react";
import { ANNOTATION_COLORS, type AnnotationTool } from "../frame-annotator/annotation-types.js";

const tools: Array<{ id: AnnotationTool; label: string; icon: typeof PenLine }> = [
  { id: "rect", label: "Rectangle", icon: RectangleHorizontal },
  { id: "stroke", label: "Pen", icon: PenLine },
  { id: "arrow", label: "Arrow", icon: MoveRight },
  { id: "text", label: "Text", icon: Type },
];

export function AnnotationToolbar({
  activeTool, activeColor, canUndo, canRedo, annotating, canAdd, busy,
  keyboardEnabled, onToolChange, onColorChange, onUndo, onRedo, onDeleteSelected, onCancel, onAdd,
}: {
  activeTool: AnnotationTool | null;
  activeColor: string;
  canUndo: boolean;
  canRedo: boolean;
  annotating: boolean;
  canAdd: boolean;
  busy: boolean;
  keyboardEnabled: boolean;
  onToolChange: (tool: AnnotationTool | null) => void;
  onColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTool || busy) setColorsOpen(false);
  }, [activeTool, busy]);
  useEffect(() => {
    if (!colorsOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as Node;
        if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      }
      setColorsOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", close, true);
    return () => { window.removeEventListener("pointerdown", close, true); window.removeEventListener("keydown", close, true); };
  }, [colorsOpen]);
  useLayoutEffect(() => {
    if (!colorsOpen) return;
    const update = () => { if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect()); };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [colorsOpen]);
  useEffect(() => {
    if (!keyboardEnabled) return;
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input,textarea,[contenteditable=true]")) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
        event.preventDefault(); event.stopPropagation();
        if (key === "y" || event.shiftKey) onRedo(); else onUndo();
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault(); event.stopPropagation(); onDeleteSelected();
      }
    };
    window.addEventListener("keydown", keydown, { capture: true });
    return () => window.removeEventListener("keydown", keydown, { capture: true });
  }, [keyboardEnabled, onDeleteSelected, onRedo, onUndo]);
  useEffect(() => {
    if (annotating) scrollerRef.current?.scrollTo({ left: 0 });
  }, [annotating]);

  return <div className={`annotation-toolbar${annotating ? " annotating" : ""}`} aria-label="Frame annotation tools">
    <div
      ref={scrollerRef}
      className="toolbar-scroll"
      onWheel={(event) => {
        const scroller = event.currentTarget;
        if (scroller.scrollWidth <= scroller.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
        scroller.scrollLeft += event.deltaY;
        event.preventDefault();
      }}
    >
      <span className="toolbar-label" aria-hidden={annotating}>Marker</span>
      <div className="toolbar-tools">
        <button ref={triggerRef} type="button" className="toolbar-color" aria-label="Annotation color" aria-haspopup="menu" aria-expanded={colorsOpen} disabled={!activeTool || busy} onClick={() => setColorsOpen((value) => !value)}><span style={{ backgroundColor: activeColor }} /></button>
        {tools.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeTool === id ? "active" : ""} aria-label={label} aria-pressed={activeTool === id} disabled={busy} onClick={() => onToolChange(activeTool === id ? null : id)}><Icon /></button>)}
        <span className="toolbar-divider" />
        <button type="button" aria-label="Undo" disabled={!canUndo || busy} onClick={onUndo}><Undo2 /></button>
        <button type="button" aria-label="Redo" disabled={!canRedo || busy} onClick={onRedo}><Redo2 /></button>
      </div>
      <div className="toolbar-actions" aria-hidden={!annotating}>
        <span className="toolbar-divider" />
        <button type="button" className="toolbar-cancel" aria-label="Cancel annotation" tabIndex={annotating ? 0 : -1} disabled={!annotating || busy} onClick={onCancel}><X /></button>
        <button type="button" className="toolbar-add" aria-label="Add to prompt" tabIndex={annotating ? 0 : -1} disabled={!annotating || !canAdd || busy} onClick={onAdd}><Plus /></button>
      </div>
    </div>
    {colorsOpen && triggerRect ? createPortal(<div ref={menuRef} className="annotation-color-menu" role="menu" aria-label="Annotation color" style={{ left: Math.max(document.querySelector<HTMLElement>(".focused-review-app")?.getBoundingClientRect().left ?? 12, Math.min((document.querySelector<HTMLElement>(".focused-review-app")?.getBoundingClientRect().right ?? window.innerWidth) - 236, triggerRect.left)), bottom: window.innerHeight - triggerRect.top + 8 }}>
      {ANNOTATION_COLORS.map((color) => <button key={color} type="button" role="menuitemradio" aria-checked={color === activeColor} aria-label={`Use ${color}`} onClick={() => { onColorChange(color); setColorsOpen(false); }}><span className={color === activeColor ? "selected" : ""} style={{ backgroundColor: color }} /></button>)}
    </div>, document.body) : null}
  </div>;
}
