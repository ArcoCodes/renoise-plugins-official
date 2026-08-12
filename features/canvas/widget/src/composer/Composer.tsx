import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Send } from "lucide-react";

export type ComposerItem = {
  id: string;
  assetId: string;
  label: string;
  timeLabel?: string;
};

export type ComposerSubmission = {
  instruction: string;
  itemIds: string[];
};

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type PopoverPlacement = { left: number; top: number; width: number; height: number; side: "top" | "bottom" };

const CLIP_MARKER_PATTERN = /\[\[renoise-clip:([a-zA-Z0-9_-]{1,128})\]\]/g;
const MAX_DRAFT_LENGTH = 10_000;
const CARET_BOUNDARY = "\u200b";

export function computeClipPopoverPlacement(
  clip: Rect,
  boundary: Rect,
  intrinsic: { width: number; height: number },
): PopoverPlacement {
  const inset = 12;
  const gap = 10;
  const padding = 12;
  const availableWidth = Math.max(96, boundary.width - inset * 2 - padding);
  const availableHeight = Math.max(96, boundary.height - inset * 2 - padding);
  const maxContentWidth = Math.min(480, availableWidth);
  const maxContentHeight = Math.min(420, availableHeight);
  const sourceWidth = Math.max(1, intrinsic.width);
  const sourceHeight = Math.max(1, intrinsic.height);
  const scale = Math.min(maxContentWidth / sourceWidth, maxContentHeight / sourceHeight);
  const width = Math.max(108, sourceWidth * scale + padding);
  const height = Math.max(108, sourceHeight * scale + padding);
  const minLeft = boundary.left + inset;
  const maxLeft = Math.max(minLeft, boundary.right - inset - width);
  const left = Math.max(minLeft, Math.min(maxLeft, clip.left + clip.width / 2 - width / 2));
  const topAbove = clip.top - gap - height;
  if (topAbove >= boundary.top + inset) return { left, top: topAbove, width, height, side: "top" };
  const topBelow = clip.bottom + gap;
  if (topBelow + height <= boundary.bottom - inset) return { left, top: topBelow, width, height, side: "bottom" };
  const roomAbove = clip.top - boundary.top;
  const roomBelow = boundary.bottom - clip.bottom;
  const preferredTop = roomAbove >= roomBelow ? topAbove : topBelow;
  return {
    left,
    top: Math.max(boundary.top + inset, Math.min(boundary.bottom - inset - height, preferredTop)),
    width,
    height,
    side: roomAbove >= roomBelow ? "top" : "bottom",
  };
}

function clipMarker(id: string) {
  return `[[renoise-clip:${id}]]`;
}

function clipLabel(item: ComposerItem) {
  return item.timeLabel ? `视频帧 ${item.timeLabel}` : "图片";
}

function visibleClipLabel(item: ComposerItem) {
  return item.timeLabel ?? "";
}

function markerIds(draft: string) {
  return [...draft.matchAll(CLIP_MARKER_PATTERN)].map((match) => match[1]);
}

export function materializeComposerDraft(draft: string, items: ComposerItem[]): ComposerSubmission {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const itemIds: string[] = [];
  const seen = new Set<string>();
  const instruction = draft.replace(CLIP_MARKER_PATTERN, (_marker, id: string) => {
    const item = itemById.get(id);
    if (!item) return "";
    if (!seen.has(id)) {
      seen.add(id);
      itemIds.push(id);
    }
    return `【标注${itemIds.indexOf(id) + 1}：${clipLabel(item)}】`;
  }).replaceAll("\u00a0", " ").trim();
  return { instruction, itemIds };
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replaceAll(CARET_BOUNDARY, "");
  if (!(node instanceof HTMLElement)) return "";
  const clipId = node.dataset.clipId;
  if (clipId) return clipMarker(clipId);
  if (node.tagName === "BR") return "\n";
  return [...node.childNodes].map(serializeNode).join("");
}

function serializeEditor(editor: HTMLElement) {
  return [...editor.childNodes].map(serializeNode).join("");
}

function serializedLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replaceAll(CARET_BOUNDARY, "").length;
  if (!(node instanceof HTMLElement)) return 0;
  if (node.dataset.clipId) return clipMarker(node.dataset.clipId).length;
  return [...node.childNodes].reduce((total, child) => total + serializedLength(child), 0);
}

function selectionOffset(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) return null;
  const container = selection.anchorNode;
  const boundaryOffset = selection.anchorOffset;
  const visit = (node: Node): { found: boolean; length: number } => {
    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) {
        return { found: true, length: Math.min(boundaryOffset, node.textContent?.length ?? 0) };
      }
      return {
        found: true,
        length: [...node.childNodes].slice(0, boundaryOffset).reduce((total, child) => total + serializedLength(child), 0),
      };
    }
    if (node instanceof HTMLElement && node.dataset.clipId) return { found: false, length: serializedLength(node) };
    let length = 0;
    for (const child of [...node.childNodes]) {
      const result = visit(child);
      length += result.length;
      if (result.found) return { found: true, length };
    }
    return { found: false, length };
  };
  const result = visit(editor);
  return result.found ? result.length : null;
}

function placeCaret(editor: HTMLElement, offset: number) {
  const range = document.createRange();
  let consumed = 0;
  for (const child of [...editor.childNodes]) {
    const length = serializedLength(child);
    if (child.nodeType === Node.TEXT_NODE && offset <= consumed + length) {
      range.setStart(child, Math.max(0, offset - consumed));
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    if (child instanceof HTMLElement && child.dataset.clipId && offset <= consumed + length) {
      range.setStartAfter(child);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    consumed += length;
  }
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function appendClip(editor: HTMLElement, item: ComposerItem, url: string, active: boolean) {
  const clip = document.createElement("span");
  clip.className = `intent-chip intent-inline-clip${active ? " active" : ""}`;
  clip.contentEditable = "false";
  clip.dataset.clipId = item.id;
  clip.setAttribute("role", "button");
  clip.setAttribute("tabindex", "0");
  clip.setAttribute("aria-label", `查看${clipLabel(item)}标注`);
  clip.setAttribute("aria-pressed", String(active));

  const main = document.createElement("span");
  const visibleLabel = visibleClipLabel(item);
  main.className = `intent-chip-main${visibleLabel ? "" : " thumbnail-only"}`;
  const preview = document.createElement("span");
  preview.className = `intent-chip-preview${url ? "" : " unavailable"}`;
  if (url) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    preview.append(image);
  } else {
    preview.textContent = "▧";
  }
  main.append(preview);
  if (visibleLabel) {
    const label = document.createElement("span");
    label.className = "intent-chip-label";
    label.textContent = visibleLabel;
    main.append(label);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "intent-chip-remove";
  remove.dataset.action = "remove";
  remove.setAttribute("aria-label", `移除${clipLabel(item)}标注`);
  remove.textContent = "×";
  clip.append(main, remove);
  editor.append(clip);
}

function renderEditor(editor: HTMLElement, draft: string, items: ComposerItem[], previewUrls: Record<string, string>, activeItemId?: string) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  editor.replaceChildren();
  let cursor = 0;
  for (const match of draft.matchAll(CLIP_MARKER_PATTERN)) {
    const before = draft.slice(cursor, match.index);
    if (before) editor.append(document.createTextNode(before));
    const item = itemById.get(match[1]);
    if (item) {
      editor.append(document.createTextNode(CARET_BOUNDARY));
      appendClip(editor, item, previewUrls[item.id] ?? "", item.id === activeItemId);
      editor.append(document.createTextNode(CARET_BOUNDARY));
    }
    cursor = (match.index ?? 0) + match[0].length;
  }
  const trailing = draft.slice(cursor);
  if (trailing) editor.append(document.createTextNode(trailing));
}

function insertMissingMarkers(draft: string, items: ComposerItem[], suppressed: Set<string>, offset: number) {
  const validIds = new Set(items.map(({ id }) => id));
  const cleaned = draft.replace(CLIP_MARKER_PATTERN, (marker, id: string) => validIds.has(id) ? marker : "");
  const present = new Set(markerIds(cleaned));
  const missing = items.filter(({ id }) => !present.has(id) && !suppressed.has(id));
  if (!missing.length) return cleaned;
  const insertionPoint = Math.min(Math.max(0, offset), cleaned.length);
  const left = cleaned.slice(0, insertionPoint);
  const right = cleaned.slice(insertionPoint);
  const markers = missing.map(({ id }) => clipMarker(id)).join(" ");
  const insertion = `${left && !/\s$/.test(left) ? " " : ""}${markers}${right && !/^\s/.test(right) ? " " : ""}`;
  return `${left}${insertion}${right}`;
}

export function Composer({
  items,
  activeItemId,
  prompt,
  disabled,
  readAsset,
  readAssetFallback,
  onItemChange,
  onItemRemove,
  onImportImage,
  onPromptChange,
  onSubmit,
}: {
  items: ComposerItem[];
  activeItemId?: string;
  prompt: string;
  disabled: boolean;
  readAsset: (assetId: string) => Promise<string>;
  readAssetFallback: (assetId: string) => Promise<string>;
  onItemChange: (targetId: string) => void;
  onItemRemove: (targetId: string) => void;
  onImportImage: (file: File) => void;
  onPromptChange: (prompt: string) => void;
  onSubmit: (submission: ComposerSubmission) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const cursorOffset = useRef<number | null>(null);
  const pendingCaretOffset = useRef<number | null>(null);
  const suppressedItems = useRef(new Set<string>());
  const previewRetries = useRef(new Set<string>());
  const composing = useRef(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [hoverPreview, setHoverPreview] = useState<PopoverPlacement & { id: string; label: string }>();
  const assetSignature = useMemo(() => items.map(({ id, assetId }) => `${id}:${assetId}`).join("|"), [items]);
  const submission = useMemo(() => materializeComposerDraft(prompt, items), [items, prompt]);
  const hasInstructionText = prompt.replace(CLIP_MARKER_PATTERN, "").trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    void Promise.all(items.map(async (item) => {
      try { return [item.id, await readAsset(item.assetId)] as const; }
      catch { return [item.id, ""] as const; }
    })).then((entries) => { if (!cancelled) setPreviewUrls(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [assetSignature, readAsset]);

  useEffect(() => {
    const validIds = new Set(items.map(({ id }) => id));
    for (const id of suppressedItems.current) if (!validIds.has(id)) suppressedItems.current.delete(id);
    const next = insertMissingMarkers(prompt, items, suppressedItems.current, cursorOffset.current ?? prompt.length);
    if (next === prompt) return;
    const insertedLength = next.length - prompt.length;
    pendingCaretOffset.current = Math.max(0, (cursorOffset.current ?? prompt.length) + insertedLength);
    onPromptChange(next.slice(0, MAX_DRAFT_LENGTH));
  }, [items, onPromptChange, prompt]);

  useEffect(() => {
    const root = editor.current;
    if (!root) return;
    const renderedPreviewSignature = [...root.querySelectorAll<HTMLElement>("[data-clip-id]")]
      .map((node) => `${node.dataset.clipId}:${node.querySelector(".intent-chip-preview > img")?.getAttribute("src") ?? ""}`).join("|");
    const expectedPreviewSignature = markerIds(prompt).map((id) => `${id}:${previewUrls[id] ?? ""}`).join("|");
    if (serializeEditor(root) !== prompt || renderedPreviewSignature !== expectedPreviewSignature) {
      const wasFocused = document.activeElement === root;
      const restoreOffset = pendingCaretOffset.current ?? cursorOffset.current;
      renderEditor(root, prompt, items, previewUrls, activeItemId);
      if (wasFocused || pendingCaretOffset.current !== null) {
        root.focus();
        placeCaret(root, restoreOffset ?? prompt.length);
      }
      pendingCaretOffset.current = null;
      return;
    }
    for (const node of root.querySelectorAll<HTMLElement>("[data-clip-id]")) {
      const active = node.dataset.clipId === activeItemId;
      node.classList.toggle("active", active);
      node.setAttribute("aria-pressed", String(active));
    }
  }, [activeItemId, items, previewUrls, prompt]);

  useEffect(() => {
    const update = () => {
      const root = editor.current;
      if (!root) return;
      const offset = selectionOffset(root);
      if (offset !== null) cursorOffset.current = offset;
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const removeItem = (id: string) => {
    suppressedItems.current.add(id);
    const next = prompt.replaceAll(clipMarker(id), "").replace(/ {2,}/g, " ");
    onPromptChange(next);
    onItemRemove(id);
  };

  const commitEditorValue = () => {
    const root = editor.current;
    if (!root) return;
    const next = serializeEditor(root);
    if (next.length > MAX_DRAFT_LENGTH) {
      renderEditor(root, prompt, items, previewUrls, activeItemId);
      placeCaret(root, Math.min(cursorOffset.current ?? prompt.length, prompt.length));
      return;
    }
    const nextIds = new Set(markerIds(next));
    for (const id of markerIds(prompt)) {
      if (!nextIds.has(id)) {
        suppressedItems.current.add(id);
        onItemRemove(id);
      }
    }
    cursorOffset.current = selectionOffset(root) ?? next.length;
    onPromptChange(next);
  };

  return (
    <form className="composer intent-composer" onSubmit={async (event) => {
      event.preventDefault();
      if (!hasInstructionText || disabled || !submission.itemIds.length) return;
      await onSubmit(submission);
    }}>
      <input ref={input} hidden disabled={disabled} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onImportImage(file);
        event.target.value = "";
      }} />
      <div className="composer-input-shell">
        <button type="button" disabled={disabled} className="intent-add-image" onClick={() => input.current?.click()} aria-label="从本地添加图片"><ImagePlus /><span>图片</span></button>
        <div
          ref={editor}
          className="composer-inline-editor"
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-label="生成说明"
          aria-multiline="false"
          data-placeholder={items.length ? "在标注 clip 前后说明对应的变更内容…" : "先使用上方工具标注画面，再说明你想要变更的内容"}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const clip = target.closest<HTMLElement>("[data-clip-id]");
            if (!clip?.dataset.clipId) return;
            if (target.closest("[data-action=remove]")) removeItem(clip.dataset.clipId);
            else onItemChange(clip.dataset.clipId);
          }}
          onPointerOver={(event) => {
            const clip = (event.target as HTMLElement).closest<HTMLElement>("[data-clip-id]");
            const id = clip?.dataset.clipId;
            const item = items.find((candidate) => candidate.id === id);
            if (!clip || !id || !item || !previewUrls[id]) return;
            const bounds = clip.getBoundingClientRect();
            const containerBounds = clip.closest<HTMLElement>(".focused-review-app")?.getBoundingClientRect();
            const left = Math.max(0, containerBounds?.left ?? 0);
            const top = Math.max(0, containerBounds?.top ?? 0);
            const right = Math.min(window.innerWidth, containerBounds?.right ?? window.innerWidth);
            const bottom = Math.min(window.innerHeight, containerBounds?.bottom ?? window.innerHeight);
            const image = clip.querySelector<HTMLImageElement>(".intent-chip-preview > img");
            const placement = computeClipPopoverPlacement(
              bounds,
              { left, top, right, bottom, width: right - left, height: bottom - top },
              { width: image?.naturalWidth || 4, height: image?.naturalHeight || 3 },
            );
            setHoverPreview({
              id,
              label: item.label,
              ...placement,
            });
          }}
          onPointerLeave={() => setHoverPreview(undefined)}
          onErrorCapture={(event) => {
            const image = event.target;
            if (!(image instanceof HTMLImageElement)) return;
            const clip = image.closest<HTMLElement>("[data-clip-id]");
            const id = clip?.dataset.clipId;
            const item = items.find((candidate) => candidate.id === id);
            if (!id || !item || previewRetries.current.has(id)) return;
            previewRetries.current.add(id);
            image.style.visibility = "hidden";
            void readAssetFallback(item.assetId)
              .then((url) => setPreviewUrls((current) => ({ ...current, [id]: url })))
              .catch(() => setPreviewUrls((current) => ({ ...current, [id]: "" })))
              .finally(() => previewRetries.current.delete(id));
          }}
          onInput={() => {
            if (!composing.current) commitEditorValue();
          }}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => {
            composing.current = false;
            commitEditorValue();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return;
              event.preventDefault();
              event.currentTarget.closest("form")?.requestSubmit();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text.replace(/[\r\n]+/g, " "));
          }}
        />
        <button disabled={disabled || !hasInstructionText || !submission.itemIds.length} aria-label="提交标注请求"><Send /></button>
      </div>
      {hoverPreview && previewUrls[hoverPreview.id] ? createPortal(
        <div
          className="intent-clip-popover"
          data-side={hoverPreview.side}
          role="tooltip"
          style={{ left: hoverPreview.left, top: hoverPreview.top, width: hoverPreview.width, height: hoverPreview.height }}
        >
          <img src={previewUrls[hoverPreview.id]} alt={`${hoverPreview.label} 标注预览`} />
        </div>,
        document.body,
      ) : null}
    </form>
  );
}
