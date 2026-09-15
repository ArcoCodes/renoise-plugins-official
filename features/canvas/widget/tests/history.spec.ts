import { expect, test } from "@playwright/test";
import { History } from "../src/canvas/history.js";

type Snapshot = { revision: number; objects: string[] };

const sameContent = (left: Snapshot, right: Snapshot) =>
  JSON.stringify(left.objects) === JSON.stringify(right.objects);

test("history ignores server-only revisions and preserves redo across a successful undo", () => {
  const history = new History<Snapshot>({ revision: 0, objects: [] }, 100, sameContent);

  expect(history.push({ revision: 1, objects: [] })).toBe(false);
  expect(history.canUndo).toBe(false);

  expect(history.push({ revision: 2, objects: ["rect"] })).toBe(true);
  expect(history.canUndo).toBe(true);
  expect(history.undo()).toEqual({ revision: 1, objects: [] });

  history.replaceCurrent({ revision: 3, objects: [] });
  expect(history.canRedo).toBe(true);
  expect(history.redo()).toEqual({ revision: 2, objects: ["rect"] });
});

test("failed undo can roll its cursor back without losing the original action", () => {
  const history = new History<Snapshot>({ revision: 0, objects: [] }, 100, sameContent);
  history.push({ revision: 1, objects: ["rect"] });

  expect(history.undo()?.objects).toEqual([]);
  expect(history.rollback("undo")).toBe(true);
  expect(history.canRedo).toBe(false);
  expect(history.canUndo).toBe(true);
  expect(history.undo()?.objects).toEqual([]);
});
