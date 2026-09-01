import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COPY_COMMAND,
  DecoratorNode,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
  type DOMExportOutput,
  type EditorConfig,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import { Check, Film, Plus, Search, Send, Upload, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { RenoiseMaterialReference } from "../../../shared/document-schema.js";

export type ComposerItem = {
  id: string;
  assetId: string;
  label: string;
  timeLabel?: string;
};
export type ComposerSubmission = {
  instruction: string;
  itemIds: string[];
  materialIds: number[];
};
export type OutputResolution = "480p" | "720p" | "1080p";
export type MaterialListResult = {
  materials: MaterialPickerItem[];
  hasMore: boolean;
};
type MaterialPickerItem = RenoiseMaterialReference & {
  previewCapability?: boolean;
  previewUrl?: string;
};

// Keep the material-library action visually identical to the main Renoise
// composer. This is the same 16px three-layer library glyph used by
// apps/renoise/src/components/icons/menu-icons.tsx.
function AssetLibraryIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-icon="asset-library"
    >
      <path
        d="M7.70064 15.5C7.42299 15.5 7.20824 15.3872 7.05639 15.1616C6.90889 14.9403 6.83513 14.6215 6.83513 14.205V8.35466C6.83513 8.09436 6.86116 7.87527 6.91322 7.6974C6.96529 7.51952 7.05422 7.36334 7.18004 7.22885C7.31019 7.09436 7.49023 6.95987 7.72017 6.82538L12.7896 3.89696C13.1193 3.71041 13.4078 3.61714 13.6551 3.61714C13.9327 3.61714 14.1475 3.72777 14.2993 3.94902C14.4555 4.16594 14.5336 4.48698 14.5336 4.91215V10.769C14.5336 11.0336 14.5054 11.2571 14.449 11.4393C14.397 11.6171 14.308 11.7733 14.1822 11.9078C14.0564 12.038 13.8829 12.1681 13.6616 12.2983L8.59218 15.2137C8.25379 15.4046 7.95661 15.5 7.70064 15.5ZM8.13665 13.9772C8.15401 13.9859 8.1757 13.9837 8.20173 13.9707L12.9718 11.192C13.0716 11.1312 13.141 11.064 13.18 10.9902C13.2191 10.9121 13.2386 10.8232 13.2386 10.7234L13.2646 5.19848C13.2646 5.1551 13.2495 5.13124 13.2191 5.1269C13.2061 5.11822 13.1844 5.12256 13.154 5.13991L8.40997 7.93818C8.2321 8.0423 8.14316 8.19631 8.14316 8.40022L8.0911 13.9121C8.0911 13.9512 8.10628 13.9729 8.13665 13.9772ZM4.90238 13.9056C4.66811 13.9056 4.47288 13.8015 4.3167 13.5933C4.16485 13.3894 4.08893 13.1247 4.08893 12.7993L4.09544 6.66269C4.09544 6.39371 4.11279 6.18547 4.1475 6.03796C4.1822 5.88612 4.25596 5.75813 4.36876 5.65401C4.48155 5.54989 4.65292 5.43275 4.88286 5.3026L10.2516 2.20499C10.4772 2.07918 10.692 2.01627 10.8959 2.01627C11.1215 2.01627 11.3058 2.09002 11.449 2.23753C11.5922 2.38069 11.6659 2.57809 11.6703 2.82972L5.72233 6.26573C5.61388 6.32213 5.53361 6.37636 5.48155 6.42842C5.42949 6.48048 5.39262 6.54338 5.37092 6.61714C5.35357 6.68655 5.34489 6.78416 5.34489 6.90998V13.769C5.19739 13.8601 5.04988 13.9056 4.90238 13.9056ZM2.27331 12.3829C2.0347 12.3829 1.83947 12.2809 1.68763 12.077C1.54012 11.8688 1.46637 11.602 1.46637 11.2766V5.13991C1.46637 4.87093 1.48372 4.66269 1.51843 4.51518C1.55314 4.36768 1.62472 4.24403 1.73318 4.14425C1.84598 4.04013 2.01951 3.91866 2.25379 3.77983L7.62255 0.695228C7.73535 0.630152 7.84598 0.58243 7.95444 0.552061C8.0629 0.517354 8.16919 0.5 8.27331 0.5C8.48589 0.5 8.66594 0.571584 8.81344 0.714751C8.96095 0.857918 9.0347 1.05748 9.0347 1.31345L3.08676 4.74295C2.98264 4.79935 2.90238 4.85575 2.84598 4.91215C2.79392 4.96421 2.75921 5.02712 2.74186 5.10087C2.7245 5.17028 2.71583 5.26573 2.71583 5.3872V12.2462C2.56832 12.3373 2.42082 12.3829 2.27331 12.3829Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ReferenceData =
  | {
      kind: "annotation";
      objectId: string;
      assetId: string;
      label: string;
      timeLabel?: string;
    }
  | ({ kind: "material" } & RenoiseMaterialReference);
type SerializedReferenceNode = SerializedLexicalNode & {
  type: "reference";
  version: 1;
  reference: ReferenceData;
};
type InsertAnchor =
  | { kind: "text"; nodeKey: NodeKey; offset: number }
  | { kind: "element"; nodeKey: NodeKey; offset: number }
  | { kind: "after-node"; nodeKey: NodeKey };
type Mention = { nodeKey: NodeKey; start: number; end: number; query: string };
type ReferenceArrowDirection = "left" | "right";
type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
type PopoverPlacement = {
  left: number;
  top: number;
  width: number;
  height: number;
  side: "top" | "bottom";
};

const CLIP_MARKER_PATTERN = /\[\[renoise-clip:([a-zA-Z0-9_-]{1,128})\]\]/g;
const MATERIAL_MARKER_PATTERN = /\[\[renoise-material:([1-9]\d*)\]\]/g;
const ANY_MARKER_PATTERN =
  /\[\[renoise-(?:clip:[a-zA-Z0-9_-]{1,128}|material:[1-9]\d*)\]\]/g;
const MAX_DRAFT_LENGTH = 10_000;
const MAX_INLINE_MATERIALS = 20;
const MATERIAL_PAGE_SIZE = 24;

function SafeImage({ src, alt = "", fallback }: { src?: string; alt?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} /> : <>{fallback}</>;
}

function SafeMaterialPreview({
  material,
  src,
  fallback,
}: {
  material: RenoiseMaterialReference;
  src?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <>{fallback}</>;
  return material.type === "video" ? (
    <video src={src} muted playsInline preload="metadata" onError={() => setFailed(true)} />
  ) : (
    <img src={src} alt={material.name} onError={() => setFailed(true)} />
  );
}

function clipMarker(id: string) {
  return `[[renoise-clip:${id}]]`;
}
function materialMarker(id: number) {
  return `[[renoise-material:${id}]]`;
}
function markerFor(reference: ReferenceData) {
  return reference.kind === "annotation"
    ? clipMarker(reference.objectId)
    : materialMarker(reference.materialId);
}

function serializeCopiedDomFragment(fragment: DocumentFragment) {
  const visit = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return [...node.childNodes].map(visit).join("");
    if (node.dataset.clipId) return clipMarker(node.dataset.clipId);
    if (node.dataset.materialId) return materialMarker(Number(node.dataset.materialId));
    if (node.tagName === "BR") return "\n";
    return [...node.childNodes].map(visit).join("");
  };
  return [...fragment.childNodes]
    .map((node, index, nodes) => {
      const value = visit(node);
      const block = node instanceof HTMLElement && /^(P|DIV)$/u.test(node.tagName);
      return block && index < nodes.length - 1 ? `${value}\n` : value;
    })
    .join("")
    .replaceAll("\u200b", "");
}
function referenceId(reference: ReferenceData) {
  return reference.kind === "annotation"
    ? `annotation:${reference.objectId}`
    : `material:${reference.materialId}`;
}
function clipLabel(item: ComposerItem) {
  return item.timeLabel ? `video frame ${item.timeLabel}` : "image";
}

export function computeClipPopoverPlacement(
  clip: Rect,
  boundary: Rect,
  intrinsic: { width: number; height: number },
): PopoverPlacement {
  const inset = 12,
    gap = 10,
    outerPadding = 8,
    metadataHeight = 38,
    contentGap = 6;
  const availableWidth = Math.max(96, boundary.width - inset * 2);
  const availableHeight = Math.max(128, boundary.height - inset * 2);
  const roomAbove = Math.max(0, clip.top - gap - boundary.top - inset);
  const roomBelow = Math.max(0, boundary.bottom - inset - clip.bottom - gap);
  const side: "top" | "bottom" = roomAbove >= 108 ? "top" : "bottom";
  const maxWidth = Math.min(260, availableWidth);
  const sideRoom = side === "top" ? roomAbove : Math.max(128, roomBelow);
  const maxHeight = Math.min(294, availableHeight, Math.max(128, sideRoom));
  const maxMediaWidth = Math.max(80, maxWidth - outerPadding * 2);
  const maxMediaHeight = Math.max(
    72,
    maxHeight - outerPadding * 2 - metadataHeight - contentGap,
  );
  const scale = Math.min(
    maxMediaWidth / Math.max(1, intrinsic.width),
    maxMediaHeight / Math.max(1, intrinsic.height),
  );
  const mediaWidth = Math.max(1, intrinsic.width) * scale;
  const mediaHeight = Math.max(1, intrinsic.height) * scale;
  const width = Math.min(maxWidth, Math.max(160, mediaWidth + outerPadding * 2));
  const height = Math.min(
    maxHeight,
    Math.max(128, mediaHeight + outerPadding * 2 + metadataHeight + contentGap),
  );
  const minLeft = boundary.left + inset;
  const left = Math.max(
    minLeft,
    Math.min(
      Math.max(minLeft, boundary.right - inset - width),
      clip.left + clip.width / 2 - width / 2,
    ),
  );
  const preferredTop =
    side === "top" ? clip.top - gap - height : clip.bottom + gap;
  return {
    left,
    top: Math.max(
      boundary.top + inset,
      Math.min(boundary.bottom - inset - height, preferredTop),
    ),
    width,
    height,
    side,
  };
}

type RenderContextValue = {
  activeItemId?: string;
  previewUrls: ReadonlyMap<string, string>;
  materialPreviewUrl: (id: number) => string | undefined;
  onItemChange: (id: string) => void;
  onHover: (reference: ReferenceData, element: HTMLElement) => void;
  onHoverEnd: () => void;
};
const RenderContext = createContext<RenderContextValue | null>(null);

function ReferenceChip({
  reference,
}: {
  reference: ReferenceData;
}) {
  const context = useContext(RenderContext)!;
  const annotation = reference.kind === "annotation";
  const preview = annotation
    ? context.previewUrls.get(reference.objectId)
    : reference.type === "image"
      ? context.materialPreviewUrl(reference.materialId)
      : undefined;
  const visibleLabel = annotation ? reference.timeLabel : reference.name;
  const ariaLabel = annotation
    ? `View ${reference.timeLabel ? `video frame ${reference.timeLabel}` : "image"} annotation`
    : `View material ${reference.name}`;
  return (
    <span
      className={`intent-chip intent-inline-clip${annotation && context.activeItemId === reference.objectId ? " active" : ""}`}
      data-reference-id={referenceId(reference)}
      data-clip-id={annotation ? reference.objectId : undefined}
      data-material-id={!annotation ? reference.materialId : undefined}
      role="button"
      aria-label={ariaLabel}
      aria-pressed={annotation && context.activeItemId === reference.objectId}
      title={ariaLabel}
      onClick={() => {
        if (annotation) context.onItemChange(reference.objectId);
      }}
      onPointerEnter={(event) =>
        context.onHover(reference, event.currentTarget)
      }
      onPointerLeave={context.onHoverEnd}
    >
      <span
        className={`intent-chip-main${visibleLabel ? "" : " thumbnail-only"}`}
      >
        <span className={`intent-chip-preview${preview ? "" : " unavailable"}`}>
          <SafeImage
            src={preview}
            fallback={!annotation && reference.type === "video" ? <Film /> : "▧"}
          />
        </span>
        {visibleLabel ? (
          <span className="intent-chip-label">{visibleLabel}</span>
        ) : null}
      </span>
    </span>
  );
}

export class ReferenceNode extends DecoratorNode<ReactNode> {
  __reference: ReferenceData;
  static getType() {
    return "reference";
  }
  static clone(node: ReferenceNode) {
    return new ReferenceNode(node.__reference, node.__key);
  }
  static importJSON(serialized: SerializedReferenceNode) {
    return new ReferenceNode(serialized.reference);
  }
  constructor(reference: ReferenceData, key?: NodeKey) {
    super(key);
    this.__reference = reference;
  }
  exportJSON(): SerializedReferenceNode {
    return {
      ...super.exportJSON(),
      type: "reference",
      version: 1,
      reference: this.__reference,
    };
  }
  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.textContent = markerFor(this.__reference);
    return { element };
  }
  createDOM(_config: EditorConfig) {
    const element = document.createElement("span");
    element.className = "lexical-reference-node";
    return element;
  }
  updateDOM() {
    return false;
  }
  isInline() {
    return true;
  }
  isKeyboardSelectable() {
    // Match the main Renoise mention node: references behave as inline text
    // atoms, not as persistent NodeSelections. A NodeSelection after a
    // contenteditable=false decorator produces a paragraph-height browser
    // caret and prevents IME composition from starting reliably.
    return false;
  }
  getTextContent() {
    return markerFor(this.__reference);
  }
  getReference() {
    return this.getLatest().__reference;
  }
  decorate() {
    return <ReferenceChip reference={this.__reference} />;
  }
}
const $createReferenceNode = (reference: ReferenceData) =>
  new ReferenceNode(reference);
const $isReferenceNode = (
  node: LexicalNode | null | undefined,
): node is ReferenceNode => node instanceof ReferenceNode;

function referenceMaps(
  items: ComposerItem[],
  materials: RenoiseMaterialReference[],
) {
  return {
    annotations: new Map(items.map((item) => [item.id, item])),
    materials: new Map(materials.map((item) => [item.materialId, item])),
  };
}
type ReferenceMaps = ReturnType<typeof referenceMaps>;

function appendDraftSegment(
  parent: ReturnType<typeof $createParagraphNode>,
  value: string,
  maps: ReferenceMaps,
) {
  let cursor = 0;
  for (const match of value.matchAll(ANY_MARKER_PATTERN)) {
    const before = value.slice(cursor, match.index);
    if (before) parent.append($createTextNode(before));
    const marker = match[0];
    const clip = /^\[\[renoise-clip:([^\]]+)\]\]$/.exec(marker);
    const material = /^\[\[renoise-material:(\d+)\]\]$/.exec(marker);
    if (clip) {
      const item = maps.annotations.get(clip[1]);
      if (item)
        parent.append(
          $createReferenceNode({
            kind: "annotation",
            objectId: item.id,
            assetId: item.assetId,
            label: item.label,
            timeLabel: item.timeLabel,
          }),
        );
    } else if (material) {
      const item = maps.materials.get(Number(material[1]));
      if (item)
        parent.append($createReferenceNode({ kind: "material", ...item }));
    }
    cursor = (match.index ?? 0) + marker.length;
  }
  const tail = value.slice(cursor);
  if (tail) parent.append($createTextNode(tail));
}

function $replaceWithDraft(draft: string, maps: ReferenceMaps) {
  const root = $getRoot();
  root.clear();
  for (const line of draft.split("\n")) {
    const paragraph = $createParagraphNode();
    appendDraftSegment(paragraph, line, maps);
    root.append(paragraph);
  }
}

function serializeDraft(editorState: EditorState) {
  return editorState.read(() =>
    $getRoot()
      .getChildren()
      .map((block) =>
        $isElementNode(block)
          ? block
              .getChildren()
              .map((node) =>
                $isReferenceNode(node)
                  ? markerFor(node.getReference())
                  : node.getTextContent(),
              )
              .join("")
          : block.getTextContent(),
      )
      .join("\n"),
  );
}

function $materialIdsInDocument() {
  const ids = new Set<number>();
  for (const block of $getRoot().getChildren()) {
    if (!$isElementNode(block)) continue;
    for (const node of block.getChildren()) {
      if (!$isReferenceNode(node)) continue;
      const reference = node.getReference();
      if (reference.kind === "material") ids.add(reference.materialId);
    }
  }
  return ids;
}

function materialIdsInEditorState(editorState: EditorState) {
  return editorState.read($materialIdsInDocument);
}

export function materializeComposerDraft(
  draft: string,
  items: ComposerItem[],
  materials: RenoiseMaterialReference[] = [],
): ComposerSubmission {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const materialById = new Map(
    materials.map((item) => [item.materialId, item]),
  );
  const itemIds: string[] = [],
    materialIds: number[] = [];
  const seenItems = new Set<string>(),
    seenMaterials = new Set<number>();
  const instruction = draft
    .replace(CLIP_MARKER_PATTERN, (_marker, id: string) => {
      const item = itemById.get(id);
      if (!item) return "";
      if (!seenItems.has(id)) {
        seenItems.add(id);
        itemIds.push(id);
      }
      return `[Annotation ${itemIds.indexOf(id) + 1}: ${clipLabel(item)}]`;
    })
    .replace(MATERIAL_MARKER_PATTERN, (_marker, value: string) => {
      const id = Number(value);
      if (!materialById.has(id)) return "";
      if (!seenMaterials.has(id)) {
        seenMaterials.add(id);
        materialIds.push(id);
      }
      return `@material:${id}`;
    })
    .replaceAll("\u00a0", " ")
    .trim();
  return { instruction, itemIds, materialIds };
}

function $anchorFromSelection(): InsertAnchor | undefined {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed())
    return undefined;
  const point = selection.anchor,
    node = point.getNode();
  if ($isTextNode(node))
    return { kind: "text", nodeKey: node.getKey(), offset: point.offset };
  if ($isElementNode(node))
    return { kind: "element", nodeKey: node.getKey(), offset: point.offset };
  return undefined;
}
function $selectAnchor(anchor: InsertAnchor | undefined) {
  if (anchor?.kind === "text") {
    const node = $getNodeByKey(anchor.nodeKey);
    if ($isTextNode(node)) {
      const offset = Math.min(anchor.offset, node.getTextContentSize());
      node.select(offset, offset);
      return;
    }
  } else if (anchor?.kind === "element") {
    const node = $getNodeByKey(anchor.nodeKey);
    if ($isElementNode(node) && anchor.offset >= 0 && anchor.offset <= node.getChildrenSize()) {
      node.select(anchor.offset, anchor.offset);
      return;
    }
  } else if (anchor?.kind === "after-node") {
    const node = $getNodeByKey(anchor.nodeKey);
    if (node?.getParent()) {
      node.selectNext(0, 0);
      return;
    }
  }
  $getRoot().selectEnd();
}
function $insertReference(reference: ReferenceData, anchor?: InsertAnchor) {
  $selectAnchor(anchor);
  const selection = $getSelection();
  let needsLeadingSpace = false;
  let needsTrailingSpace = false;
  if ($isRangeSelection(selection) && selection.isCollapsed()) {
    const point = selection.anchor;
    const container = point.getNode();
    if ($isTextNode(container)) {
      const text = container.getTextContent();
      needsLeadingSpace = point.offset > 0 && !/\s/u.test(text[point.offset - 1]);
      needsTrailingSpace = point.offset < text.length && !/\s/u.test(text[point.offset]);
    } else if ($isElementNode(container)) {
      const previous = container.getChildAtIndex(point.offset - 1);
      const next = container.getChildAtIndex(point.offset);
      const previousText = previous?.getTextContent() ?? "";
      const nextText = next?.getTextContent() ?? "";
      needsLeadingSpace = Boolean(previous) && ($isReferenceNode(previous) || Boolean(previousText) && !/\s$/u.test(previousText));
      needsTrailingSpace = Boolean(next) && ($isReferenceNode(next) || Boolean(nextText) && !/^\s/u.test(nextText));
    }
  }
  const node = $createReferenceNode(reference);
  const insertedTrailingSpace = needsTrailingSpace
    ? $createTextNode(" ")
    : undefined;
  $insertNodes([
    ...(needsLeadingSpace ? [$createTextNode(" ")] : []),
    node,
    ...(insertedTrailingSpace ? [insertedTrailingSpace] : []),
  ]);
  const next = node.getNextSibling();
  if ($isTextNode(next)) {
    // A real text caret is required after an inline DecoratorNode. Selecting
    // the element boundary looks like a tall caret in Chromium and cannot
    // reliably host a CJK composition session. Main-site reshoot uses the
    // same trailing-space carrier after inserting a frame mention.
    const offset = next === insertedTrailingSpace ? next.getTextContentSize() : 0;
    next.select(offset, offset);
  } else {
    const caretCarrier = $createTextNode(" ");
    node.insertAfter(caretCarrier);
    caretCarrier.selectEnd();
  }
  return { kind: "after-node", nodeKey: node.getKey() } as InsertAnchor;
}

function $selectImmediatelyAfterReference(node: ReferenceNode) {
  const next = node.getNextSibling();
  if ($isTextNode(next)) {
    next.select(0, 0);
    return;
  }
  const caretCarrier = $createTextNode(" ");
  node.insertAfter(caretCarrier);
  caretCarrier.select(0, 0);
}

function $selectImmediatelyBeforeReference(node: ReferenceNode) {
  const previous = node.getPreviousSibling();
  if ($isTextNode(previous)) {
    previous.selectEnd();
    return;
  }
  node.getParent()?.selectStart();
}

/**
 * Chromium skips the element offset between adjacent contenteditable=false
 * decorators. Main-site Renoise intercepts only that exceptional case. The
 * widget goes one step further and creates a real text carrier at the skipped
 * offset so macOS IMEs never have to compose into an element RangeSelection.
 */
function $moveCaretBetweenAdjacentReferences(direction: "left" | "right") {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const { anchor } = selection;
  const anchorNode = anchor.getNode();
  let passing: LexicalNode | null = null;
  if ($isTextNode(anchorNode)) {
    if (
      direction === "right" &&
      anchor.offset === anchorNode.getTextContentSize()
    ) {
      passing = anchorNode.getNextSibling();
    } else if (direction === "left" && anchor.offset === 0) {
      passing = anchorNode.getPreviousSibling();
    }
  } else if ($isElementNode(anchorNode)) {
    passing = anchorNode.getChildAtIndex(
      direction === "right" ? anchor.offset : anchor.offset - 1,
    );
  }
  if (!$isReferenceNode(passing)) return false;
  const beyond = direction === "right"
    ? passing.getNextSibling()
    : passing.getPreviousSibling();
  if (!$isReferenceNode(beyond)) return false;

  const caretCarrier = $createTextNode(" ");
  if (direction === "right") passing.insertAfter(caretCarrier);
  else passing.insertBefore(caretCarrier);
  caretCarrier.selectEnd();
  return true;
}

function $recoverSuppressedReferenceArrow(direction: ReferenceArrowDirection) {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const nodes = selection.getNodes();
    if (nodes.length === 1 && $isReferenceNode(nodes[0])) {
      if (direction === "right") $selectImmediatelyAfterReference(nodes[0]);
      else $selectImmediatelyBeforeReference(nodes[0]);
      return true;
    }
    return false;
  }
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const { anchor } = selection;
  const node = anchor.getNode();
  let adjacent: LexicalNode | null = null;
  if ($isTextNode(node)) {
    if (direction === "right" && anchor.offset === node.getTextContentSize())
      adjacent = node.getNextSibling();
    else if (direction === "left" && anchor.offset === 0)
      adjacent = node.getPreviousSibling();
  } else if ($isElementNode(node)) {
    adjacent = node.getChildAtIndex(
      direction === "right" ? anchor.offset : anchor.offset - 1,
    );
  }
  if (!$isReferenceNode(adjacent)) return false;
  if (direction === "right") $selectImmediatelyAfterReference(adjacent);
  else $selectImmediatelyBeforeReference(adjacent);
  return true;
}

function EditorPlugins({
  prompt,
  maps,
  items,
  materials,
  disabled,
  onPromptChange,
  onSubmit,
  onMention,
  mention,
  anchorRef,
  previousItemIds,
  submitRef,
  compositionEndRef,
  compositionActive,
}: {
  prompt: string;
  maps: ReferenceMaps;
  items: ComposerItem[];
  materials: RenoiseMaterialReference[];
  disabled: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: (value: ComposerSubmission) => Promise<void>;
  onMention: (value?: Mention) => void;
  mention?: Mention;
  anchorRef: MutableRefObject<InsertAnchor | undefined>;
  previousItemIds: MutableRefObject<Set<string>>;
  submitRef: MutableRefObject<(() => Promise<void>) | undefined>;
  compositionEndRef: MutableRefObject<
    ((direction?: ReferenceArrowDirection) => void) | undefined
  >;
  compositionActive: MutableRefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();
  const latestPrompt = useRef(prompt),
    lastEmitted = useRef(prompt);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastValidState = useRef(editor.getEditorState());
  const mapsRef = useRef(maps);
  mapsRef.current = maps;

  useEffect(() => {
    editor.update(() => $replaceWithDraft(prompt, mapsRef.current), {
      onUpdate: () => {
        const state = editor.getEditorState();
        lastValidState.current = state;
        const serialized = serializeDraft(state);
        latestPrompt.current = serialized;
        lastEmitted.current = serialized;
      },
    });
  }, [editor]);
  useEffect(() => {
    // Parent echoes produced by this editor are already reflected in Lexical.
    // Replacing the editor state for every echo would destroy the browser's
    // native selection/IME session. Only apply genuine external changes such
    // as clearing after submit or restoring another saved draft.
    if (
      compositionActive.current ||
      editor.isComposing() ||
      prompt === latestPrompt.current
    )
      return;
    clearTimeout(emitTimer.current);
    editor.update(() => $replaceWithDraft(prompt, mapsRef.current), {
      onUpdate: () => {
        const state = editor.getEditorState();
        lastValidState.current = state;
        const serialized = serializeDraft(state);
        latestPrompt.current = serialized;
        lastEmitted.current = serialized;
      },
    });
  }, [compositionActive, editor, prompt]);
  useEffect(
    () =>
      editor.registerUpdateListener(
        ({ editorState, dirtyElements, dirtyLeaves }) => {
          editorState.read(() => {
            const anchor = $anchorFromSelection();
            if (anchor) anchorRef.current = anchor;
            const selection = $getSelection();
            let nextMention: Mention | undefined;
            if ($isRangeSelection(selection) && selection.isCollapsed()) {
              const node = selection.anchor.getNode();
              if ($isTextNode(node)) {
                const end = selection.anchor.offset,
                  match = node
                    .getTextContent()
                    .slice(0, end)
                    .match(/@$/u);
                if (match?.index !== undefined)
                  nextMention = {
                    nodeKey: node.getKey(),
                    start: match.index,
                    end,
                    query: "",
                  };
              }
            }
            onMention(
              compositionActive.current || editor.isComposing()
                ? undefined
                : nextMention,
            );
          });
          if (!dirtyElements.size && !dirtyLeaves.size) return;
          const serialized = serializeDraft(editorState);
          if (
            serialized.length > MAX_DRAFT_LENGTH ||
            materialIdsInEditorState(editorState).size > MAX_INLINE_MATERIALS
          ) {
            clearTimeout(emitTimer.current);
            const validState = lastValidState.current;
            queueMicrotask(() => editor.setEditorState(validState, { tag: "length-rollback" }));
            return;
          }
          lastValidState.current = editorState;
          latestPrompt.current = serialized;
          clearTimeout(emitTimer.current);
          if (compositionActive.current || editor.isComposing()) return;
          emitTimer.current = setTimeout(() => {
            lastEmitted.current = serialized;
            onPromptChange(serialized);
          }, 100);
        },
      ),
    [anchorRef, compositionActive, editor, onMention, onPromptChange],
  );
  useEffect(() => () => clearTimeout(emitTimer.current), []);
  const persistCurrentDraft = useCallback(() => {
    clearTimeout(emitTimer.current);
    const editorState = editor.getEditorState();
    const serialized = serializeDraft(editorState);
    if (
      serialized.length > MAX_DRAFT_LENGTH ||
      materialIdsInEditorState(editorState).size > MAX_INLINE_MATERIALS
    ) {
      editor.setEditorState(lastValidState.current, { tag: "length-rollback" });
      return;
    }
    lastValidState.current = editorState;
    latestPrompt.current = serialized;
    if (serialized === lastEmitted.current) return;
    emitTimer.current = setTimeout(() => {
      lastEmitted.current = serialized;
      onPromptChange(serialized);
    }, 100);
  }, [editor, onPromptChange]);
  const flushComposition = useCallback(
    (direction?: ReferenceArrowDirection) => {
      clearTimeout(emitTimer.current);
      if (compositionActive.current || editor.isComposing()) return;
      if (!direction) {
        persistCurrentDraft();
        return;
      }
      // A navigation packet can precede compositionend on macOS. Chromium
      // sometimes suppresses that native caret move. Recover it only if the
      // caret is still directly beside the reference; if native navigation
      // already succeeded this is intentionally a no-op.
      editor.update(() => $recoverSuppressedReferenceArrow(direction), {
        tag: "composition-reference-nav",
        onUpdate: persistCurrentDraft,
      });
    },
    [compositionActive, editor, persistCurrentDraft],
  );
  useEffect(() => {
    compositionEndRef.current = flushComposition;
    return () => {
      if (compositionEndRef.current === flushComposition)
        compositionEndRef.current = undefined;
    };
  }, [compositionEndRef, flushComposition]);
  useEffect(() => {
    const previous = previousItemIds.current,
      added = items.filter((item) => !previous.has(item.id));
    previousItemIds.current = new Set(items.map(({ id }) => id));
    if (!added.length) return;
    editor.update(() => {
      let anchor = anchorRef.current;
      for (const item of added)
        anchor = $insertReference(
          {
            kind: "annotation",
            objectId: item.id,
            assetId: item.assetId,
            label: item.label,
            timeLabel: item.timeLabel,
          },
          anchor,
        );
      anchorRef.current = anchor;
    });
  }, [anchorRef, editor, items, previousItemIds]);
  useEffect(() => editor.setEditable(!disabled), [disabled, editor]);
  const submitLive = useCallback(async () => {
    clearTimeout(emitTimer.current);
    const draft = serializeDraft(editor.getEditorState());
    if (
      draft.length > MAX_DRAFT_LENGTH ||
      materialIdsInEditorState(editor.getEditorState()).size > MAX_INLINE_MATERIALS
    ) {
      editor.setEditorState(lastValidState.current, { tag: "length-rollback" });
      return;
    }
    const submission = materializeComposerDraft(draft, items, materials);
    if (disabled || !submission.itemIds.length || !draft.replace(ANY_MARKER_PATTERN, "").trim()) return;
    try {
      await onSubmit(submission);
    } catch (error) {
      lastEmitted.current = draft;
      latestPrompt.current = draft;
      onPromptChange(draft);
      throw error;
    }
  }, [disabled, editor, items, materials, onPromptChange, onSubmit]);
  useEffect(() => {
    submitRef.current = submitLive;
    return () => { if (submitRef.current === submitLive) submitRef.current = undefined; };
  }, [submitLive, submitRef]);
  useEffect(() => {
    let pendingDirection: "left" | "right" | null = null;
    const hasSelectionModifier = (event: KeyboardEvent | null) =>
      Boolean(
        event &&
          (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey),
      );
    const trackArrow = (direction: "left" | "right") =>
      (event: KeyboardEvent | null) => {
        if (
          !hasSelectionModifier(event) &&
          $moveCaretBetweenAdjacentReferences(direction)
        ) {
          event?.preventDefault();
          pendingDirection = null;
          return true;
        }
        pendingDirection = direction;
        return false;
      };
    const unregisterLeft = editor.registerCommand(
      KEY_ARROW_LEFT_COMMAND,
      trackArrow("left"),
      COMMAND_PRIORITY_LOW,
    );
    const unregisterRight = editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      trackArrow("right"),
      COMMAND_PRIORITY_LOW,
    );
    const unregisterUpdate = editor.registerUpdateListener(() => {
      if (!pendingDirection) return;
      const direction = pendingDirection;
      pendingDirection = null;
      editor.update(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          if (nodes.length === 1 && $isReferenceNode(nodes[0])) {
            if (direction === "right")
              $selectImmediatelyAfterReference(nodes[0]);
            else $selectImmediatelyBeforeReference(nodes[0]);
          }
          return;
        }
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
        const { anchor } = selection;
        const anchorNode = anchor.getNode();
        if (
          direction === "left" &&
          anchor.type === "text" &&
          anchor.offset === 0
        ) {
          const previous = anchorNode.getPreviousSibling();
          if ($isReferenceNode(previous))
            $selectImmediatelyBeforeReference(previous);
          return;
        }
        if (
          direction === "right" &&
          anchor.type === "text" &&
          anchor.offset === anchorNode.getTextContentSize()
        ) {
          const next = anchorNode.getNextSibling();
          // macOS can deliver ArrowRight while an IME session is still
          // committing. Chromium then keeps the caret before the decorator
          // instead of performing its native move. Resolve that asymmetric
          // no-op after Lexical observes the update, into a real text carrier.
          if ($isReferenceNode(next)) $selectImmediatelyAfterReference(next);
          return;
        }
        if (anchor.type !== "element" || !$isElementNode(anchorNode)) return;
        const adjacent = anchorNode.getChildAtIndex(
          direction === "right" ? anchor.offset : anchor.offset - 1,
        );
        if (!$isReferenceNode(adjacent)) return;
        if (direction === "right") $selectImmediatelyAfterReference(adjacent);
        else $selectImmediatelyBeforeReference(adjacent);
      }, { tag: "reference-nav" });
    });
    return () => {
      unregisterLeft();
      unregisterRight();
      unregisterUpdate();
    };
  }, [editor]);
  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event) return false;
          if (event.isComposing || event.keyCode === 229) return true;
          if (event.shiftKey) {
            event.preventDefault();
            $insertNodes([$createLineBreakNode()]);
            return true;
          }
          if (mention) {
            event.preventDefault();
            return true;
          }
          event.preventDefault();
          void submitLive().catch(() => undefined);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, mention, submitLive],
  );
  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false;
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (!text.match(ANY_MARKER_PATTERN)) return false;
          event.preventDefault();
          const paragraph = $createParagraphNode();
          appendDraftSegment(
            paragraph,
            text.replaceAll("\r\n", "\n"),
            mapsRef.current,
          );
          $insertNodes(paragraph.getChildren());
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  );
  useEffect(
    () =>
      editor.registerCommand(
        COPY_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false;
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) return false;
          const markers = selection
            .getNodes()
            .filter($isReferenceNode)
            .map((node) => markerFor(node.getReference()))
            .join(" ");
          if (!markers) return false;
          event.clipboardData?.setData("text/plain", markers);
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  );
  return null;
}

function EditorCapture({
  editorRef,
}: {
  editorRef: MutableRefObject<LexicalEditor | undefined>;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = undefined;
    };
  }, [editor, editorRef]);
  return null;
}

export function Composer({
  items,
  activeItemId,
  prompt,
  draftKey = "default",
  materialPool = [],
  outputResolution,
  disabled,
  readAsset,
  readAssetFallback,
  materialPreviewUrl = () => undefined,
  listMaterials,
  onMaterialPoolChange = () => undefined,
  onItemChange,
  onImportImage,
  onPromptChange,
  onOutputResolutionChange,
  onSubmit,
}: {
  items: ComposerItem[];
  activeItemId?: string;
  prompt: string;
  draftKey?: string;
  materialPool?: RenoiseMaterialReference[];
  outputResolution: OutputResolution;
  disabled: boolean;
  readAsset: (assetId: string) => Promise<string>;
  readAssetFallback: (assetId: string) => Promise<string>;
  materialPreviewUrl?: (materialId: number) => string | undefined;
  listMaterials?: (input: {
    search?: string;
    type?: "image" | "video";
    limit: number;
    offset: number;
  }) => Promise<MaterialListResult>;
  onMaterialPoolChange?: (materials: RenoiseMaterialReference[]) => void;
  onItemChange: (targetId: string) => void;
  onImportImage: (file: File) => void;
  onPromptChange: (prompt: string) => void;
  onOutputResolutionChange: (resolution: OutputResolution) => void;
  onSubmit: (submission: ComposerSubmission) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null),
    anchorRef = useRef<InsertAnchor | undefined>(undefined),
    previousItemIds = useRef(new Set(items.map(({ id }) => id))),
    editorRef = useRef<LexicalEditor | undefined>(undefined),
    submitRef = useRef<(() => Promise<void>) | undefined>(undefined),
    compositionEndRef = useRef<
      ((direction?: ReferenceArrowDirection) => void) | undefined
    >(undefined),
    compositionArrowRef = useRef<ReferenceArrowDirection | undefined>(
      undefined,
    );
  const [previewUrls, setPreviewUrls] = useState(new Map<string, string>());
  const [hoverPreview, setHoverPreview] = useState<
    PopoverPlacement & { reference: ReferenceData; url: string }
  >();
  const [mention, setMention] = useState<Mention>(),
    [browserOpen, setBrowserOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<
    { left: number; top: number; placement: "above" | "below" } | undefined
  >();
  const [materialQuery, setMaterialQuery] = useState(""),
    [debouncedMaterialQuery, setDebouncedMaterialQuery] = useState("");
  const [browserMaterials, setBrowserMaterials] = useState<MaterialPickerItem[]>([]);
  const [materialPreviewUrls, setMaterialPreviewUrls] = useState(new Map<number, string>());
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]),
    [hasMore, setHasMore] = useState(false),
    [nextMaterialOffset, setNextMaterialOffset] = useState(0),
    [loading, setLoading] = useState(false),
    [browserError, setBrowserError] = useState(""),
    [materialLimitMessage, setMaterialLimitMessage] = useState("");
  const [materialSentinelElement, setMaterialSentinelElement] = useState<HTMLDivElement | null>(null);
  const materialRequestSequence = useRef(0),
    materialPageInFlight = useRef(false),
    mentionMenuRef = useRef<HTMLDivElement>(null),
    materialGridRef = useRef<HTMLDivElement>(null),
    materialSearchInputRef = useRef<HTMLInputElement>(null),
    materialBrowserWasOpen = useRef(false),
    compositionActive = useRef(false);
  const maps = useMemo(
    () => referenceMaps(items, materialPool),
    [items, materialPool],
  );
  const assetSignature = useMemo(
    () => items.map(({ id, assetId }) => `${id}:${assetId}`).join("|"),
    [items],
  );
  const initialConfig = useMemo(
    () => ({
      namespace: `RenoiseComposer:${draftKey}`,
      nodes: [ReferenceNode],
      onError: (error: Error) => {
        throw error;
      },
    }),
    [draftKey],
  );
  useEffect(() => {
    let cancelled = false;
    const verify = (url: string) =>
      new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(url);
        image.onerror = reject;
        image.src = url;
      });
    void Promise.all(
      items.map(async (item) => {
        try {
          return [
            item.id,
            await verify(await readAsset(item.assetId)),
          ] as const;
        } catch {
          try {
            return [
              item.id,
              await verify(await readAssetFallback(item.assetId)),
            ] as const;
          } catch {
            return [item.id, ""] as const;
          }
        }
      }),
    ).then((entries) => {
      if (!cancelled) setPreviewUrls(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [assetSignature, items, readAsset, readAssetFallback]);
  const resolveMaterialPreviewUrl = useCallback(
    (materialId: number) =>
      materialPreviewUrls.get(materialId) ?? materialPreviewUrl(materialId),
    [materialPreviewUrl, materialPreviewUrls],
  );
  const renderContext = useMemo<RenderContextValue>(
    () => ({
      activeItemId,
      previewUrls,
      materialPreviewUrl: resolveMaterialPreviewUrl,
      onItemChange,
      onHover: (reference, element) => {
        const url =
          reference.kind === "annotation"
            ? previewUrls.get(reference.objectId)
            : resolveMaterialPreviewUrl(reference.materialId);
        if (!url) return;
        const clip = element.getBoundingClientRect();
        const boundary = element
          .closest<HTMLElement>(".focused-review-app")
          ?.getBoundingClientRect() ?? {
          left: 0,
          top: 0,
          right: innerWidth,
          bottom: innerHeight,
          width: innerWidth,
          height: innerHeight,
        };
        const image = element.querySelector<HTMLImageElement>("img");
        setHoverPreview({
          ...computeClipPopoverPlacement(clip, boundary, {
            width: image?.naturalWidth || 640,
            height: image?.naturalHeight || 360,
          }),
          reference,
          url,
        });
      },
      onHoverEnd: () => setHoverPreview(undefined),
    }),
    [activeItemId, onItemChange, previewUrls, resolveMaterialPreviewUrl],
  );
  const chooseReference = useCallback(
    (reference: ReferenceData) => {
      const editor = editorRef.current;
      if (!editor) return;
      let inserted = false;
      editor.update(() => {
        if (
          reference.kind === "material" &&
          !$materialIdsInDocument().has(reference.materialId) &&
          $materialIdsInDocument().size >= MAX_INLINE_MATERIALS
        ) {
          setMaterialLimitMessage(`A prompt can reference at most ${MAX_INLINE_MATERIALS} materials.`);
          return;
        }
        if (mention) {
          const node = $getNodeByKey(mention.nodeKey);
          if ($isTextNode(node)) {
            node.spliceText(
              mention.start,
              mention.end - mention.start,
              "",
              true,
            );
            anchorRef.current = {
              kind: "text",
              nodeKey: node.getKey(),
              offset: mention.start,
            };
          }
        }
        anchorRef.current = $insertReference(reference, anchorRef.current);
        inserted = true;
      });
      if (!inserted) return;
      if (
        reference.kind === "material" &&
        !materialPool.some(({ materialId }) => materialId === reference.materialId)
      ) {
        onMaterialPoolChange([...materialPool, reference].slice(0, 100));
      }
      if (reference.kind === "annotation") onItemChange(reference.objectId);
      setMention(undefined);
    },
    [materialPool, mention, onItemChange, onMaterialPoolChange],
  );
  const preserveMentionAnchor = useCallback(() => {
    editorRef.current?.update(() => {
      if (!mention) return;
      const node = $getNodeByKey(mention.nodeKey);
      if (!$isTextNode(node)) return;
      node.spliceText(mention.start, mention.end - mention.start, "", true);
      node.select(mention.start, mention.start);
      anchorRef.current = {
        kind: "text",
        nodeKey: node.getKey(),
        offset: mention.start,
      };
    });
    setMention(undefined);
  }, [mention]);
  const browseMaterials = useCallback(() => {
    preserveMentionAnchor();
    setSelectedMaterialIds([]);
    setBrowserError("");
    setMaterialLimitMessage("");
    setMaterialQuery("");
    setDebouncedMaterialQuery("");
    setBrowserOpen(true);
  }, [preserveMentionAnchor]);
  const uploadFromMention = useCallback(() => {
    preserveMentionAnchor();
    input.current?.click();
  }, [preserveMentionAnchor]);
  const closeMaterials = useCallback(() => {
    materialRequestSequence.current += 1;
    materialPageInFlight.current = false;
    setBrowserOpen(false);
    setMaterialQuery("");
    setDebouncedMaterialQuery("");
    setBrowserMaterials([]);
    setHasMore(false);
    setNextMaterialOffset(0);
    setLoading(false);
    setSelectedMaterialIds([]);
    setBrowserError("");
    setMaterialLimitMessage("");
  }, []);
  const loadMaterials = useCallback(
    async (offset = 0, search = debouncedMaterialQuery) => {
      if (!listMaterials) return;
      if (offset > 0 && materialPageInFlight.current) return;
      const sequence = ++materialRequestSequence.current;
      materialPageInFlight.current = true;
      setLoading(true);
      setBrowserError("");
      try {
        const result = await listMaterials({
          search: search.trim() || undefined,
          type: "image",
          limit: MATERIAL_PAGE_SIZE,
          offset,
        });
        if (sequence !== materialRequestSequence.current) return;
        setBrowserMaterials((current) =>
          offset ? [...current, ...result.materials] : result.materials,
        );
        setMaterialPreviewUrls((current) => {
          const next = new Map(current);
          for (const material of result.materials) {
            if (material.previewUrl) next.set(material.materialId, material.previewUrl);
          }
          while (next.size > 100) next.delete(next.keys().next().value!);
          return next;
        });
        setHasMore(result.hasMore);
        // The CLI's unfiltered page can include audio rows that the visual
        // editor intentionally omits. Advancing by the rendered item count
        // would then re-read the last raw row and progressively drift.
        setNextMaterialOffset(offset + MATERIAL_PAGE_SIZE);
      } catch (error) {
        if (sequence !== materialRequestSequence.current) return;
        setBrowserError(error instanceof Error ? error.message : String(error));
      } finally {
        if (sequence === materialRequestSequence.current) {
          materialPageInFlight.current = false;
          setLoading(false);
        }
      }
    },
    [debouncedMaterialQuery, listMaterials],
  );
  useEffect(() => {
    if (!browserOpen) return;
    const timer = setTimeout(() => setDebouncedMaterialQuery(materialQuery), 275);
    return () => clearTimeout(timer);
  }, [browserOpen, materialQuery]);
  useEffect(() => {
    if (browserOpen) void loadMaterials(0, debouncedMaterialQuery);
  }, [browserOpen, debouncedMaterialQuery, loadMaterials]);
  useEffect(() => {
    if (!browserOpen || !hasMore || loading || browserError || !materialSentinelElement) return;
    const root = materialGridRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !materialPageInFlight.current) {
        void loadMaterials(nextMaterialOffset);
      }
    }, { root, rootMargin: "0px 0px 200px 0px" });
    observer.observe(materialSentinelElement);
    return () => observer.disconnect();
  }, [browserError, browserOpen, hasMore, loadMaterials, loading, materialSentinelElement, nextMaterialOffset]);
  useEffect(() => {
    if (!browserOpen) {
      if (!materialBrowserWasOpen.current) return;
      materialBrowserWasOpen.current = false;
      const frame = requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.update(() => $selectAnchor(anchorRef.current));
      });
      return () => cancelAnimationFrame(frame);
    }
    materialBrowserWasOpen.current = true;
    const frame = requestAnimationFrame(() => materialSearchInputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMaterials();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [browserOpen, closeMaterials]);
  const insertSelectedMaterials = () => {
    const selected = selectedMaterialIds
      .map((id) => browserMaterials.find((item) => item.materialId === id))
      .filter(Boolean) as MaterialPickerItem[];
    if (!selected.length || !editorRef.current) return;
    const currentIds = materialIdsInEditorState(editorRef.current.getEditorState());
    let remaining = MAX_INLINE_MATERIALS - currentIds.size;
    const allowed = selected.filter((material) => {
      if (currentIds.has(material.materialId)) return true;
      if (remaining <= 0) return false;
      remaining -= 1;
      return true;
    });
    if (allowed.length !== selected.length) {
      setMaterialLimitMessage(`A prompt can reference at most ${MAX_INLINE_MATERIALS} materials.`);
      return;
    }
    const pool = new Map(materialPool.map((item) => [item.materialId, item]));
    allowed.forEach(({ previewCapability: _previewCapability, previewUrl: _previewUrl, ...item }) => {
      pool.set(item.materialId, item);
    });
    onMaterialPoolChange([...pool.values()].slice(0, 100));
    editorRef.current.update(() => {
      let anchor = anchorRef.current;
      for (const material of allowed)
        anchor = $insertReference({ kind: "material", ...material }, anchor);
      anchorRef.current = anchor;
    });
    setSelectedMaterialIds([]);
    closeMaterials();
  };
  const localCandidates = items;
  const imageMaterialCandidates = useMemo(
    () => materialPool.filter(({ type }) => type !== "video"),
    [materialPool],
  );
  const videoMaterialCandidates = useMemo(
    () => materialPool.filter(({ type }) => type === "video"),
    [materialPool],
  );
  const mentionCandidates = useMemo<ReferenceData[]>(() => [
    ...localCandidates.map((item) => ({ kind: "annotation" as const, objectId: item.id, assetId: item.assetId, label: item.label, timeLabel: item.timeLabel })),
    ...imageMaterialCandidates.map((material) => ({ kind: "material" as const, ...material })),
    ...videoMaterialCandidates.map((material) => ({ kind: "material" as const, ...material })),
  ], [localCandidates, imageMaterialCandidates, videoMaterialCandidates]);
  useEffect(() => setMentionIndex(0), [mention?.nodeKey, mention?.start]);
  useEffect(() => {
    setMentionIndex((current) => Math.min(current, mentionCandidates.length + 1));
  }, [mentionCandidates.length]);

  // The main Renoise composer anchors the static picker to the `@` caret and
  // portals it out of the editor's overflow container. Mirror that contract
  // here instead of stretching a custom panel across the whole composer.
  useLayoutEffect(() => {
    if (!mention) {
      setMentionPosition(undefined);
      return;
    }
    const updatePosition = () => {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
      if (!range) return;
      const caret = range.getBoundingClientRect();
      const menu = mentionMenuRef.current;
      const menuWidth = menu?.offsetWidth || 260;
      const menuHeight = menu?.offsetHeight || 220;
      const gap = 8;
      const inset = 12;
      const boundary = document
        .querySelector<HTMLElement>(".focused-review-app")
        ?.getBoundingClientRect() ?? {
          left: 0,
          right: window.innerWidth,
          top: 0,
          bottom: window.innerHeight,
        };
      const left = Math.min(
        Math.max(boundary.left + inset, caret.left),
        Math.max(boundary.left + inset, boundary.right - inset - menuWidth),
      );
      const roomAbove = caret.top - boundary.top;
      const roomBelow = boundary.bottom - caret.bottom;
      const placement = roomAbove >= menuHeight + gap || roomAbove > roomBelow
        ? "above"
        : "below";
      const top = placement === "above"
        ? Math.max(boundary.top + inset, caret.top - menuHeight - gap)
        : Math.min(boundary.bottom - inset - menuHeight, caret.bottom + gap);
      setMentionPosition({ left, top: Math.max(boundary.top + inset, top), placement });
    };
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mention]);
  useEffect(() => {
    if (!mention) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (mentionMenuRef.current?.contains(target)) return;
      const editorRoot = editorRef.current?.getRootElement();
      if (editorRoot?.contains(target)) return;
      setMention(undefined);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [mention]);
  const submission = materializeComposerDraft(prompt, items, materialPool),
    hasInstruction = prompt.replace(ANY_MARKER_PATTERN, "").trim().length > 0;
  return (
    <RenderContext.Provider value={renderContext}>
      <form
        className="composer intent-composer"
        onPointerOver={(event) => {
          if (!(event.target as Element).closest("[data-reference-id]")) setHoverPreview(undefined);
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          await submitRef.current?.();
        }}
      >
        <input
          ref={input}
          hidden
          disabled={disabled}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportImage(file);
            event.target.value = "";
          }}
        />
        <div className="composer-input-shell">
          <button
            type="button"
            disabled={disabled}
            className="intent-add-image"
            onClick={() => input.current?.click()}
            aria-label="Add an image from this device"
          >
            <Plus />
            <span>Image</span>
          </button>
          <div className="composer-editor-wrap">
            <LexicalComposer initialConfig={initialConfig}>
              <EditorCapture editorRef={editorRef} />
              <PlainTextPlugin
                contentEditable={
                  <ContentEditable
                    className="composer-inline-editor"
                    aria-label="Revision instructions"
                    aria-multiline="true"
                    onCompositionStart={() => {
                      compositionActive.current = true;
                    }}
                    onCompositionEnd={() => {
                      compositionActive.current = false;
                      const direction = compositionArrowRef.current;
                      compositionArrowRef.current = undefined;
                      // Do not render React state from composition events. The
                      // native IME must finish reconciling its DOM selection
                      // before the draft is read and persisted.
                      queueMicrotask(() => compositionEndRef.current?.(direction));
                    }}
                    onKeyDown={(event) => {
                      if (
                        compositionActive.current ||
                        editorRef.current?.isComposing() ||
                        event.nativeEvent.isComposing ||
                        event.keyCode === 229
                      ) {
                        if (
                          !event.shiftKey &&
                          !event.altKey &&
                          !event.metaKey &&
                          !event.ctrlKey &&
                          (event.key === "ArrowLeft" || event.key === "ArrowRight")
                        )
                          compositionArrowRef.current =
                            event.key === "ArrowLeft" ? "left" : "right";
                        return;
                      }
                      if (!mention) return;
                      const count = mentionCandidates.length + 2;
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setMention(undefined);
                      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        setMentionIndex((current) => (current + (event.key === "ArrowDown" ? 1 : count - 1)) % count);
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        if (mentionIndex === 0) browseMaterials();
                        else if (mentionIndex === 1) uploadFromMention();
                        else {
                          const candidate = mentionCandidates[mentionIndex - 2];
                          if (candidate) chooseReference(candidate);
                        }
                      }
                    }}
                    data-placeholder={items.length
                      ? "Describe each requested change before or after its annotation clip…"
                      : "Annotate the image with the tools above, then describe the change you want"}
                    onCopy={(event) => {
                      const selection = window.getSelection();
                      if (!selection?.rangeCount || selection.isCollapsed)
                        return;
                      const fragment = selection.getRangeAt(0).cloneContents();
                      if (fragment.querySelector("[data-reference-id]")) {
                        event.preventDefault();
                        event.clipboardData.setData("text/plain", serializeCopiedDomFragment(fragment));
                      }
                    }}
                  />
                }
                placeholder={
                  <div className="composer-placeholder">
                    {items.length
                      ? "Describe each requested change before or after its annotation clip…"
                      : "Annotate the image with the tools above, then describe the change you want"}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <EditorPlugins
                prompt={prompt}
                maps={maps}
                items={items}
                materials={materialPool}
                disabled={disabled}
                onPromptChange={onPromptChange}
                onSubmit={onSubmit}
                mention={mention}
                onMention={setMention}
                anchorRef={anchorRef}
                previousItemIds={previousItemIds}
                submitRef={submitRef}
                compositionEndRef={compositionEndRef}
                compositionActive={compositionActive}
              />
            </LexicalComposer>
          </div>
          <label className="composer-resolution" title="Output resolution">
            <span className="sr-only">Output resolution</span>
            <select
              aria-label="Output resolution"
              disabled={disabled}
              value={outputResolution}
              onChange={(event) =>
                onOutputResolutionChange(event.target.value as OutputResolution)
              }
            >
              <option value="480p">480P</option>
              <option value="720p">720P</option>
              <option value="1080p">1080P</option>
            </select>
          </label>
        </div>
        <button
          className="composer-submit"
          disabled={disabled || !hasInstruction || !submission.itemIds.length || submission.materialIds.length > MAX_INLINE_MATERIALS}
          aria-label="Submit annotation request"
        >
          <Send />
          <span>Send annotation</span>
        </button>
      </form>
      {mention
        ? createPortal(
            <div
              ref={mentionMenuRef}
              className="composer-mention-menu"
              role="listbox"
              aria-label="References"
              data-placement={mentionPosition?.placement}
              style={{
                left: mentionPosition?.left ?? 0,
                top: mentionPosition?.top ?? 0,
                visibility: mentionPosition ? "visible" : "hidden",
              }}
            >
              <button
                type="button"
                role="option"
                className="composer-mention-action"
                aria-selected={mentionIndex === 0}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setMentionIndex(0)}
                onClick={browseMaterials}
              >
                <AssetLibraryIcon />
                <span>Browse materials</span>
              </button>
              <button
                type="button"
                role="option"
                className="composer-mention-action"
                aria-selected={mentionIndex === 1}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setMentionIndex(1)}
                onClick={uploadFromMention}
              >
                <Upload />
                <span>Upload from device</span>
              </button>
              {mentionCandidates.length ? (
                <>
                  <div className="composer-mention-divider" aria-hidden="true" />
                  <div className="composer-mention-scroll">
                    {localCandidates.length || imageMaterialCandidates.length ? (
                      <section className="composer-mention-section" aria-label="Images">
                        <div className="composer-mention-section-heading">Images</div>
                        <div className="composer-mention-grid">
                          {localCandidates.map((item, index) => {
                            const pickerIndex = index + 2;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                role="option"
                                aria-selected={mentionIndex === pickerIndex}
                                aria-label={item.timeLabel ? `${item.label} ${item.timeLabel}` : item.label}
                                onPointerDown={(event) => event.preventDefault()}
                                onPointerEnter={() => setMentionIndex(pickerIndex)}
                                onClick={() => chooseReference({
                                  kind: "annotation",
                                  objectId: item.id,
                                  assetId: item.assetId,
                                  label: item.label,
                                  timeLabel: item.timeLabel,
                                })}
                              >
                                <SafeImage src={previewUrls.get(item.id)} fallback="▧" />
                                {item.timeLabel ? <span>{item.timeLabel}</span> : null}
                              </button>
                            );
                          })}
                          {imageMaterialCandidates.map((material, index) => {
                            const pickerIndex = localCandidates.length + index + 2;
                            return (
                              <button
                                key={`material-${material.materialId}`}
                                type="button"
                                role="option"
                                aria-selected={mentionIndex === pickerIndex}
                                aria-label={material.name}
                                onPointerDown={(event) => event.preventDefault()}
                                onPointerEnter={() => setMentionIndex(pickerIndex)}
                                onClick={() => chooseReference({ kind: "material", ...material })}
                              >
                                <SafeImage
                                  src={resolveMaterialPreviewUrl(material.materialId)}
                                  fallback={<Film />}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                    {videoMaterialCandidates.length ? (
                      <section className="composer-mention-section" aria-label="Videos">
                        <div className="composer-mention-section-heading">Videos</div>
                        <div className="composer-mention-grid">
                          {videoMaterialCandidates.map((material, index) => {
                            const pickerIndex = localCandidates.length + imageMaterialCandidates.length + index + 2;
                            return (
                              <button
                                key={`material-${material.materialId}`}
                                type="button"
                                role="option"
                                aria-selected={mentionIndex === pickerIndex}
                                aria-label={material.name}
                                onPointerDown={(event) => event.preventDefault()}
                                onPointerEnter={() => setMentionIndex(pickerIndex)}
                                onClick={() => chooseReference({ kind: "material", ...material })}
                              >
                                <SafeMaterialPreview
                                  material={material}
                                  src={resolveMaterialPreviewUrl(material.materialId)}
                                  fallback={<Film />}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>,
            document.querySelector(".focused-review-app") ?? document.body,
          )
        : null}
      {browserOpen
        ? createPortal(
            <div
              className="material-browser-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeMaterials();
              }}
            >
              <section
                className="material-browser"
                role="dialog"
                aria-modal="true"
                aria-label="Select materials"
              >
                <header>
                  <h2>Select materials</h2>
                  <label className="material-browser-search">
                    <Search />
                    <input
                      ref={materialSearchInputRef}
                      aria-label="Search materials"
                      value={materialQuery}
                      onChange={(event) => setMaterialQuery(event.target.value)}
                      placeholder="Search materials"
                    />
                  </label>
                  <button
                    type="button"
                    className="material-browser-close"
                    aria-label="Close materials"
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      closeMaterials();
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) closeMaterials();
                    }}
                  >
                    <X />
                  </button>
                </header>
                {browserError ? (
                  <div className="material-browser-error" role="alert">
                    <span>{browserError}</span>
                    <button type="button" onClick={() => void loadMaterials(0)}>Retry</button>
                  </div>
                ) : null}
                {materialLimitMessage ? <p className="material-browser-limit" role="alert">{materialLimitMessage}</p> : null}
                <div ref={materialGridRef} className="material-browser-grid">
                  {browserMaterials.map((material) => (
                    <button
                      type="button"
                      key={material.materialId}
                      aria-pressed={selectedMaterialIds.includes(
                        material.materialId,
                      )}
                      onClick={() =>
                        setSelectedMaterialIds((current) => {
                          if (current.includes(material.materialId)) return current.filter((id) => id !== material.materialId);
                          const used = new Set(materializeComposerDraft(prompt, items, materialPool).materialIds);
                          const selectedNew = current.filter((id) => !used.has(id)).length;
                          if (!used.has(material.materialId) && used.size + selectedNew >= MAX_INLINE_MATERIALS) {
                            setMaterialLimitMessage(`A prompt can reference at most ${MAX_INLINE_MATERIALS} materials.`);
                            return current;
                          }
                          setMaterialLimitMessage("");
                          return [...current, material.materialId];
                        })
                      }
                    >
                      <span className="material-browser-preview">
                        <SafeMaterialPreview
                          material={material}
                          src={material.previewUrl ?? resolveMaterialPreviewUrl(material.materialId)}
                          fallback={<Film />}
                        />
                        {selectedMaterialIds.includes(material.materialId) ? (
                          <span className="material-browser-check" aria-hidden="true"><Check /></span>
                        ) : null}
                      </span>
                      <strong>{material.name}</strong>
                    </button>
                  ))}
                  {loading && !browserMaterials.length ? (
                    <p role="status">Loading materials…</p>
                  ) : null}
                  {!loading && !browserMaterials.length && !browserError ? (
                    <p>No materials</p>
                  ) : null}
                  {hasMore ? (
                    <div ref={setMaterialSentinelElement} className="material-browser-sentinel" role="status">
                      {loading && browserMaterials.length ? "Loading more…" : null}
                    </div>
                  ) : browserMaterials.length ? (
                    <div className="material-browser-end">No more materials</div>
                  ) : null}
                </div>
                <footer>
                  <div className="material-browser-actions">
                    <button
                      type="button"
                      className="secondary"
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        closeMaterials();
                      }}
                      onClick={(event) => {
                        if (event.detail === 0) closeMaterials();
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" disabled={!selectedMaterialIds.length} onClick={insertSelectedMaterials}>
                      Confirm ({selectedMaterialIds.length})
                    </button>
                  </div>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
      {hoverPreview
        ? createPortal(
            <div
              className={`intent-clip-popover ${hoverPreview.side}`}
              data-side={hoverPreview.side}
              role="tooltip"
              style={{
                left: hoverPreview.left,
                top: hoverPreview.top,
                width: hoverPreview.width,
                height: hoverPreview.height,
              }}
            >
              <div className="intent-clip-popover-media">
                <SafeImage
                  src={hoverPreview.url}
                  alt={
                    hoverPreview.reference.kind === "annotation"
                      ? hoverPreview.reference.label
                      : hoverPreview.reference.name
                  }
                  fallback="▧"
                />
              </div>
              <div className="intent-clip-popover-meta">
                <span>
                  {hoverPreview.reference.kind === "annotation"
                    ? hoverPreview.reference.label
                    : hoverPreview.reference.name}
                </span>
                <small>
                  {hoverPreview.reference.kind === "annotation"
                    ? hoverPreview.reference.timeLabel ? "Video frame" : "Image"
                    : hoverPreview.reference.type === "video" ? "Video" : "Image"}
                </small>
              </div>
            </div>,
            document.body,
          )
        : null}
    </RenderContext.Provider>
  );
}
