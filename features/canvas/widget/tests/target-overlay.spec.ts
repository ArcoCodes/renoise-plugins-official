import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("effective-target overlay stays centered on the target instead of treating its corner as the center", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/target-overlay-harness.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  await page.setContent(`<script type="module">${javascript}</script>`);
  await expect(page.locator("body")).toHaveAttribute("data-target-overlay-ready", "true");
  const result = await page.evaluate(() => window.__targetOverlayResult as any);
  expect(result.originX).toBe("left");
  expect(result.originY).toBe("top");
  expect(result.overlayBounds.left).toBeCloseTo(result.targetBounds.left - 6, 5);
  expect(result.overlayBounds.top).toBeCloseTo(result.targetBounds.top - 6, 5);
  expect(result.overlayBounds.width).toBeCloseTo(result.targetBounds.width + 12, 5);
  expect(result.overlayBounds.height).toBeCloseTo(result.targetBounds.height + 12, 5);
});
