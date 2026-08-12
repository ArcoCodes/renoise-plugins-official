import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("composer interleaves clips with copy and submits sources in inline order", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  await page.setContent(`<div id="root"></div><script type="module">${javascript}</script>`);

  await expect(page.getByRole("button", { name: "View image annotation" })).toBeVisible();
  await expect(page.getByText("00:04.000")).toBeVisible();
  const editor = page.getByLabel("Revision instructions");
  await expect(editor).toContainText("在");
  const firstClip = page.getByRole("button", { name: "View image annotation" });
  const secondClip = page.getByRole("button", { name: "View video frame 00:04.000 annotation" });
  await expect.poll(() => firstClip.locator(".intent-chip-preview > img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  const positions = await page.locator(".composer-inline-editor").evaluate((root) => {
    const clips = root.querySelectorAll<HTMLElement>("[data-clip-id]");
    const text = (root.textContent ?? "").replaceAll("\u200b", "");
    return { count: clips.length, text, first: clips[0]?.dataset.clipId, second: clips[1]?.dataset.clipId };
  });
  expect(positions).toEqual({ count: 2, text: "在 × 增加王冠，在 00:04.000× 调整光线", first: "object_target_a", second: "object_target_b" });
  await firstClip.hover();
  await expect(page.getByRole("tooltip").getByRole("img", { name: /角色图 A/ })).toBeVisible();
  await expect(editor.getByRole("tooltip")).toHaveCount(0);
  await editor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "王" }));
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", isComposing: true }));
  });
  expect(await page.evaluate(() => window.__submittedIntent)).toBeUndefined();
  await editor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "王" }));
  });
  await page.getByRole("button", { name: "Submit annotation request" }).click();
  await expect.poll(() => page.evaluate(() => window.__submittedIntent)).toEqual({
    ids: ["object_target_a", "object_target_b"],
    prompt: "在 [Annotation 1: image] 增加王冠，在 [Annotation 2: video frame 00:04.000] 调整光线",
  });

  await page.getByRole("button", { name: "Remove video frame 00:04.000 annotation" }).click();
  await expect(page.getByText("00:04.000")).toHaveCount(0);
  await expect(secondClip).toHaveCount(0);
});
