import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("native video inspector seeks, reports timecode, captures PNG, and exposes safe errors", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/media-inspector-harness.tsx")],
    bundle: true,
    write: false,
    outdir: "out",
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles.find(({ path }) => path.endsWith(".js"))!.text.replaceAll("</script", "<\\/script");
  const css = bundle.outputFiles.find(({ path }) => path.endsWith(".css"))?.text ?? "";
  await page.setContent(`<style>${css}</style><div id="root"></div><script type="module">${javascript}</script>`);

  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel("Current timecode")).toContainText("00:00:");

  const timeline = page.getByLabel("Video timeline");
  const capture = page.getByRole("button", { name: "Capture current frame" });
  await video.dispatchEvent("seeking");
  await expect(capture).toBeDisabled();
  await page.waitForTimeout(120);
  await expect(capture).toBeDisabled();
  await video.dispatchEvent("seeked");
  await expect(capture).toBeEnabled();
  await timeline.fill("240");
  await expect(page.getByLabel("Current timecode")).toContainText("00:00:06");
  await expect(capture).toBeEnabled();
  await timeline.dispatchEvent("pointerup");
  await expect.poll(async () => Number(await page.locator("body").getAttribute("data-committed-time"))).toBeGreaterThanOrEqual(200);
  await capture.click();
  await expect.poll(() => page.locator("body").getAttribute("data-captured")).toMatch(/^data:image\/png;base64,/);
  await expect.poll(async () => Number(await page.locator("body").getAttribute("data-capture-time"))).toBeGreaterThanOrEqual(200);
  const timing = await page.evaluate(() => ({
    capture: Number(document.body.dataset.captureTime),
    committed: Number(document.body.dataset.committedTime),
    actual: Math.round(document.querySelector("video")!.currentTime * 1000),
  }));
  expect(Math.abs(timing.capture - timing.actual)).toBeLessThanOrEqual(40);
  expect(Math.abs(timing.committed - timing.actual)).toBeLessThanOrEqual(40);
  await page.locator('input[type="file"]').setInputFiles({ name: "fixture.webm", mimeType: "video/webm", buffer: Buffer.from("fixture") });
  await expect(page.locator("body")).toHaveAttribute("data-imported-video", "fixture.webm");

  await page.evaluate(() => window.__mediaSetBroken?.());
  await expect(page.getByText("fixture decode failed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose again" })).toBeVisible();
  await expect.poll(async () => Number(await page.locator("body").getAttribute("data-inspector-urls-created"))).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => Number(await page.locator("body").getAttribute("data-inspector-urls-revoked"))).toBeGreaterThanOrEqual(1);
});
