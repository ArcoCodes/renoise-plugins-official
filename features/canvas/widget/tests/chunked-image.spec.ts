import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test("image reads use bounded retryable chunks and rebuild the original blob", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/chunked-image-harness.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; img-src 'none'"><script type="module">${javascript}</script>`);
  await expect(page.locator("body")).toHaveAttribute("data-image-chunk-ready", "true");
  const result = await page.evaluate(() => window.__imageChunkResult as any);
  const reads = result.calls.filter(({ name }: any) => name === "read_renoise_whiteboard_image_chunk");
  expect(reads.length).toBeGreaterThan(3);
  for (const { args } of reads) {
    expect(args.length).toBeLessThanOrEqual(result.chunkBytes);
    expect(Math.ceil(args.length * 4 / 3)).toBeLessThan(180_000);
  }
  const retried = reads.filter(({ args }: any) => args.offset === result.chunkBytes);
  expect(retried).toHaveLength(2);
  expect(result.lostChunkOnce).toBe(true);
  expect(result.blobSize).toBe(result.expectedSize);
  expect(result.blobType).toBe("image/png");
  expect(result.firstByte).toBe(0);
  expect(result.lastByte).toBe(result.expectedLastByte);
  expect(result.dataUrlPrefix).toBe("data:image/png;base64,");
  expect(result.dataUrlLength).toBeGreaterThan(result.expectedSize);
  expect(result.decodedWidth).toBe(1);
  expect(result.decodedHeight).toBe(1);
  expect(result.decodedAlpha).toBe(255);
  expect(result.calls.some(({ name }: any) => name === "close_renoise_whiteboard_image_read")).toBe(true);
  const appends = result.uploadCalls.filter(({ name }: any) => name === "append_renoise_whiteboard_image_upload");
  expect(appends.length).toBeGreaterThan(3);
  for (const { args } of appends) {
    expect(args.dataBase64.length).toBeLessThanOrEqual(Math.ceil(result.chunkBytes / 3) * 4);
    expect(args.dataBase64).not.toContain("data:image/");
  }
  expect(appends.filter(({ args }: any) => args.index === 1)).toHaveLength(2);
  expect(result.uploadResponseLostOnce).toBe(true);
  expect(result.uploadReceived).toBe(result.expectedSize);
  expect(result.uploadResult.asset.id).toBe("asset_uploaded");
  expect(result.uploadCalls.some(({ name }: any) => name === "finalize_renoise_whiteboard_image_upload")).toBe(true);
  expect(result.uploadCalls.some(({ name }: any) => name === "abort_renoise_whiteboard_image_upload")).toBe(false);
});
