import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("a stalled loopback image decode times out visibly and falls back to project chunk reads", async ({ page }) => {
  let gatewayAssetRequests = 0;
  await page.route("http://127.0.0.1:48765/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Cross-Origin-Resource-Policy": "cross-origin",
    };
    if (url.pathname.startsWith("/v1/health/")) {
      await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.pathname.startsWith("/v1/assets/")) {
      gatewayAssetRequests += 1;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 4_000));
      await route.abort("timedout").catch(() => undefined);
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", headers, body: JSON.stringify({ ok: false }) });
  });

  const hostBundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/mock-host-harness.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  const hostJavascript = hostBundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
  const widgetHtml = (await readFile(resolve("features/canvas/dist/widget.html"), "utf8")).replace(
    "<head>",
    "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: http://127.0.0.1:48765; connect-src http://127.0.0.1:48765; font-src data:\">",
  );
  await page.setContent(`<iframe id="widget" style="width:1024px;height:700px;border:0"></iframe><script type="module">${hostJavascript}</script>`);
  await page.evaluate((html) => {
    const iframe = document.querySelector<HTMLIFrameElement>("#widget")!;
    const connecting = window.__startWhiteboardMockHost!(iframe);
    iframe.srcdoc = html;
    void connecting;
  }, widgetHtml);

  const widget = page.frameLocator("#widget");
  await widget.getByRole("button", { name: "批准并打开标注板" }).click();
  await expect(widget.getByLabel("固定媒体标注区")).toBeVisible({ timeout: 8_000 });
  await expect(widget.getByRole("button", { name: "打开恢复诊断控制台" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    window.__mockCalls?.filter(({ name }) => name === "begin_renoise_whiteboard_image_read").length ?? 0
  ))).toBeGreaterThan(0);
  await expect.poll(() => widget.locator(".fixed-media-frame > img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  expect(gatewayAssetRequests).toBeGreaterThan(0);
});
