import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("same-page async restore hydrates media before annotation without moving or locking it", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/annotation-interaction-harness.tsx")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  await page.setContent(`
    <style>
      body { margin: 0; }
      nav { height: 40px; }
      .viewport-shell { position: relative; width: 800px; height: 500px; }
      .fabric-viewport { position: absolute; inset: 0; }
    </style>
    <div id="root"></div>
    <script>
      if (!crypto.randomUUID) Object.defineProperty(crypto, "randomUUID", {
        value: () => "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)
      });
    </script>
    <script type="module">${javascript}</script>
  `);
  await expect(page.locator("body")).toHaveAttribute("data-annotation-ready", "true");
  expect(await page.evaluate(() => window.__annotationReadCount)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__annotationOverlayCount?.())).toBe(1);

  const before = await page.evaluate(() => window.__annotationSnapshot?.());
  const sourceBefore = before?.page.objects.find(({ id }) => id === "object_source");
  expect(sourceBefore?.transform).toEqual({ x: 100, y: 100, width: 200, height: 120, rotation: 0 });

  await page.locator("#rectangle-tool").click();
  await expect.poll(() => page.evaluate(() => window.__annotationFlags?.()[0])).toEqual({
    id: "object_source",
    selectable: false,
    evented: false,
  });

  const canvas = page.locator(".upper-canvas");
  await expect(canvas).toHaveCSS("width", "800px");
  await expect(canvas).toHaveCSS("height", "500px");
  await page.evaluate(() => window.__annotationDrag?.({ x: 125, y: 125 }, { x: 265, y: 195 }));

  await expect.poll(() => page.evaluate(() => window.__annotationSnapshot?.().page.objects.some(({ type }) => type === "rect") ?? false)).toBe(true);
  await expect(page.locator("main")).toHaveAttribute("data-active-tool", "select");
  const after = await page.evaluate(() => window.__annotationSnapshot?.());
  const sourceAfter = after?.page.objects.find(({ id }) => id === "object_source");
  const rectangle = after?.page.objects.find(({ type }) => type === "rect");
  expect(sourceAfter?.transform).toEqual(sourceBefore?.transform);
  expect(sourceAfter?.locked).toBe(false);
  expect(rectangle?.transform.width).toBeGreaterThan(100);
  expect(rectangle?.transform.height).toBeGreaterThan(50);
  expect(await page.evaluate(() => window.__annotationActiveId?.())).toBe(rectangle?.id);
  expect(await page.evaluate((rectangleId) => window.__annotationFlags?.().find(({ id }) => id === rectangleId), rectangle?.id)).toEqual({
    id: rectangle?.id,
    selectable: true,
    evented: true,
  });

  await page.locator("#eraser-tool").click();
  const eraserFlags = await page.evaluate(() => window.__annotationFlags?.());
  expect(eraserFlags?.find(({ id }) => id === "object_source")).toEqual({
    id: "object_source",
    selectable: false,
    evented: false,
  });
  expect(eraserFlags?.find(({ id }) => id !== "object_source")?.evented).toBe(true);

  await page.locator("#select-tool").click();
  await expect.poll(() => page.evaluate(() => window.__annotationFlags?.()[0])).toEqual({
    id: "object_source",
    selectable: true,
    evented: true,
  });
});
