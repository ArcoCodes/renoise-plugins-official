import type { SelectionState, ViewState, WhiteboardDocument } from "../../../shared/document-schema.js";

export type WhiteboardState = {
  document: WhiteboardDocument;
  selection: SelectionState;
  view: ViewState;
  saveState: "saved" | "saving" | "failed" | "conflict";
};

export function updateSelection(state: WhiteboardState, selectedObjectIds: string[]): WhiteboardState {
  return {
    ...state,
    selection: {
      ...state.selection,
      documentRevision: state.document.page.revision,
      selectedObjectIds,
    },
  };
}
