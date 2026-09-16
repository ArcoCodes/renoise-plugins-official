import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("Reshoot shapes retain structured geometry and styling in RevisionIntent marks", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/annotation-shape-mapper-harness.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const source = bundle.outputFiles[0]!.text.replaceAll("</script", "<\\/script");
  await page.setContent(`<script type="module">${source}</script>`);
  const objects = await page.evaluate(() => (window as typeof window & { __mappedAnnotationObjects: Array<Record<string, unknown>> }).__mappedAnnotationObjects);
  expect(objects).toHaveLength(5);
  expect(objects.map(({ type }) => type)).toEqual(["rect", "freehand", "arrow", "text", "ellipse"]);
  expect(objects.every(({ id }) => /^mark_[a-z0-9_-]{5,127}$/i.test(String(id)))).toBe(true);
  expect(objects.every(({ hidden }) => hidden === true)).toBe(true);
  expect(objects[0]).toMatchObject({ transform: { x: 60, y: 45, width: 100, height: 50 }, style: { stroke: "#FF3B30" } });
  expect(objects[1]).toMatchObject({ transform: { x: 14.5, y: 25.5 }, data: { points: [{ x: .5, y: 1 }, { x: 15, y: 20 }], width: 3 }, style: { stroke: "#34C759", strokeWidth: 3, sourceOffsetX: 9, sourceOffsetY: 11 } });
  expect(objects[2]).toMatchObject({ data: { points: [{ x: 5, y: 10 }, { x: 155, y: 90 }] }, style: { stroke: "#0A84FF", strokeWidth: 3.5 } });
  expect(objects[3]).toMatchObject({ data: { text: "Change this", fontSize: 14 }, style: { fill: "#FFFFFF" } });
  expect(objects[4]).toMatchObject({ style: { variant: "numbered-pin", number: 1, radius: 9, fill: "#FFCC00" } });
});
