import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

test.setTimeout(30_000);

test("video transfer uses bounded resumable chunks and never sends a full data URL", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/chunked-video-harness.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  await page.setContent(`<script type="module">${javascript}</script>`);
  await expect(page.locator("body")).toHaveAttribute("data-chunk-ready", "true");
  const result = await page.evaluate(() => window.__chunkResult as any);
  const append = result.calls.filter(({ name }: any) => name === "append_renoise_whiteboard_video_upload");
  const finalize = result.calls.filter(({ name }: any) => name === "finalize_renoise_whiteboard_video_upload");
  const reads = result.calls.filter(({ name }: any) => name === "read_renoise_whiteboard_video_chunk");
  expect(append.length).toBeGreaterThan(3);
  expect(reads.length).toBeGreaterThan(2);
  for (const { args } of append) {
    expect(args.dataBase64.length).toBeLessThan(1_000_000);
    expect(JSON.stringify(args).length).toBeLessThan(1_048_576);
    expect(args.dataBase64).not.toContain("data:video/");
  }
  for (const { args } of reads) expect(args.length).toBeLessThanOrEqual(700 * 1024);
  const retried = append.filter(({ args }: any) => args.index === 1);
  expect(retried).toHaveLength(2);
  expect(retried[0].args.offset).toBe(retried[1].args.offset);
  expect(retried[0].args.dataBase64).toBe(retried[1].args.dataBase64);
  expect(result.lostAckOnce).toBe(true);
  expect(result.processingPolls).toBe(3);
  expect(result.finalizeAttempts).toBe(4);
  expect(finalize).toHaveLength(4);
  for (const { args } of finalize) expect(Object.hasOwn(args, "posterDataUrl")).toBe(false);
  expect(result.uploadDurationMs).toBeGreaterThan(2_500);
  expect(result.acceptedCounts["1"]).toBe(1);
  expect(result.upload.asset.id).toBe("asset_fixture");
  expect(result.blobSize).toBe(result.fileSize);
  expect(result.blobType).toBe("video/webm");
  expect(result.firstByte).toBe(0);
  expect(result.lastByte).toBe(result.expectedLastByte);
  expect(result.calls.some(({ name }: any) => name === "close_renoise_whiteboard_video_read")).toBe(true);
  expect(result.calls.some(({ args }: any) => Object.values(args).some((value) => typeof value === "string" && value.startsWith("data:video/")))).toBe(false);
  expect(result.cancelled).toBe(true);
  expect(result.cancelCalls).toContain("abort_renoise_whiteboard_video_upload");
  expect(result.sanitizedArguments).toEqual({
    canvasSessionId: "session_fixture",
    nested: { keep: true },
    list: ["first", null, "last"],
  });
});
