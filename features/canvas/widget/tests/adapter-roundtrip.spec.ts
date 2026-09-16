import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("real DOM Fabric hydrate → serialize → reopen preserves every object contract", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/adapter-roundtrip-harness.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  await page.setContent(`<canvas id="first"></canvas><canvas id="reopened"></canvas><script type="module">${javascript}</script>`);
  await expect(page.locator("body")).toHaveAttribute("data-roundtrip-ready", "true");

  const result = await page.evaluate(() => window.__roundTrip);
  expect(result).toBeTruthy();
  const source = result!.source.page.objects;
  const first = result!.first.page.objects;
  const reopened = result!.reopened.page.objects;
  const expectedTypes = ["image", "video-card", "ai-image", "group", "freehand", "arrow", "line", "text", "sticky", "rect", "ellipse"];
  expect(new Set(first.map(({ type }) => type))).toEqual(new Set(expectedTypes));
  expect(first).toHaveLength(source.length);
  expect(reopened).toHaveLength(source.length);

  for (const expected of source) {
    const once = first.find(({ id }) => id === expected.id)!;
    const twice = reopened.find(({ id }) => id === expected.id)!;
    expect(once.type).toBe(expected.type);
    expect(twice.type).toBe(expected.type);
    expect(once.parentId).toBe(expected.parentId);
    expect(twice.parentId).toBe(expected.parentId);
    expect(once.data).toEqual(expected.data);
    expect(twice.data).toEqual(expected.data);
    for (const key of ["x", "y", "width", "height", "rotation"] as const) {
      expect(once.transform[key], `${expected.id}.${key} after first hydrate`).toBeCloseTo(expected.transform[key], 2);
      expect(twice.transform[key], `${expected.id}.${key} after reopen`).toBeCloseTo(once.transform[key], 2);
    }
  }

  const layout = await page.evaluate(() => window.__mediaLayout);
  expect(layout).toBeTruthy();
  for (const media of [layout!.image, layout!.video]) {
    expect(media.renderedWidth).toBeLessThanOrEqual(media.frameWidth + .01);
    expect(media.renderedHeight).toBeLessThanOrEqual(media.frameHeight + .01);
    expect(Math.abs(media.renderedWidth / media.renderedHeight - 1)).toBeLessThan(.02);
  }
});
