import { useCallback, useState } from "react";
import type { AnnotationOp, AnnotationShape } from "./annotation-types.js";

type StackState = { shapes: AnnotationShape[]; undoStack: AnnotationShape[][]; redoStack: AnnotationShape[][] };
const EMPTY: StackState = { shapes: [], undoStack: [], redoStack: [] };

export function useAnnotationStack() {
  const [state, setState] = useState<StackState>(EMPTY);
  const commit = useCallback((shapes: AnnotationShape[], _op: AnnotationOp) => {
    setState((current) => ({ shapes, undoStack: [...current.undoStack, current.shapes], redoStack: [] }));
  }, []);
  const undo = useCallback(() => setState((current) => {
    const previous = current.undoStack.at(-1);
    return previous ? { shapes: previous, undoStack: current.undoStack.slice(0, -1), redoStack: [...current.redoStack, current.shapes] } : current;
  }), []);
  const redo = useCallback(() => setState((current) => {
    const next = current.redoStack.at(-1);
    return next ? { shapes: next, undoStack: [...current.undoStack, current.shapes], redoStack: current.redoStack.slice(0, -1) } : current;
  }), []);
  const clear = useCallback(() => setState(EMPTY), []);
  return { shapes: state.shapes, canUndo: state.undoStack.length > 0, canRedo: state.redoStack.length > 0, commit, undo, redo, clear };
}
