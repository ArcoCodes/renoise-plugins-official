import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("focused video stage pauses and freezes the exact seeked frame before annotation", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/video-review-stage-harness.tsx")],
    bundle: true,
    write: false,
    outdir: "out",
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles.find(({ path }) => path.endsWith(".js"))!.text.replaceAll("</script", "<\\/script");
  const css = bundle.outputFiles.find(({ path }) => path.endsWith(".css"))?.text ?? "";
  await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src blob:"><style>${css}</style><div id="root"></div><script type="module">${javascript}</script>`);
  await page.waitForFunction(() => typeof (window as typeof window & { __prepareVideoFile?: unknown }).__prepareVideoFile === "function");

  const incompatiblePreparation = await page.evaluate(async () => {
    const prepare = (window as typeof window & {
      __prepareVideoFile?: (file: File) => Promise<{ browserDecodable: boolean; durationMs: number; width: number; height: number }>;
    }).__prepareVideoFile;
    if (!prepare) throw new Error("video preparation harness is unavailable");
    const bytes = new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    return prepare(new File([bytes], "unsupported.mp4", { type: "video/mp4" }));
  });
  expect(incompatiblePreparation).toMatchObject({
    browserDecodable: false,
    durationMs: 0,
    width: 0,
    height: 0,
  });

  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video).not.toHaveAttribute("crossorigin");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.currentTime = Math.min(.28, element.duration / 2);
    if (element.seeking) await new Promise<void>((resolve) => element.addEventListener("seeked", () => resolve(), { once: true }));
    await element.play();
  });
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: "Use annotation tool" }).click();

  await expect.poll(() => page.locator("body").getAttribute("data-frozen-image")).toMatch(/^data:image\/png;base64,/);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  const timing = await page.evaluate(() => ({
    frozen: Number(document.body.dataset.frozenTime),
    actual: Math.round(document.querySelector("video")!.currentTime * 1_000),
    latency: Number(document.body.dataset.freezeLatency),
  }));
  expect(Math.abs(timing.frozen - timing.actual)).toBeLessThanOrEqual(40);
  expect(timing.latency).toBeLessThan(150);
});
