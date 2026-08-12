import { expect, test, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function fixture(page: Page, options: { startEmpty?: boolean; omitRootParentId?: boolean; width?: number } = {}) {
  await page.route("http://127.0.0.1:48765/**", (route: Route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
    body: JSON.stringify({ ok: false }),
  }));
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
    `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: http://127.0.0.1:48765; media-src data: blob: http://127.0.0.1:48765; connect-src http://127.0.0.1:48765; font-src data:">`,
  );
  const frameWidth = options.width ?? 1024;
  if (options.width) await page.setViewportSize({ width: frameWidth + 32, height: 820 });
  await page.setContent(`<iframe id="widget" style="width:${frameWidth}px;height:760px;border:0"></iframe><script type="module">${hostJavascript}</script>`);
  await page.evaluate(({ html, startEmpty, omitRootParentId }: { html: string; startEmpty: boolean; omitRootParentId: boolean }) => {
    window.__mockStartEmpty = startEmpty;
    window.__mockOmitRootParentIdInSaveResponse = omitRootParentId;
    const iframe = document.querySelector<HTMLIFrameElement>("#widget")!;
    const connecting = window.__startWhiteboardMockHost!(iframe);
    iframe.srcdoc = html;
    void connecting;
  }, { html: widgetHtml, startEmpty: options.startEmpty ?? false, omitRootParentId: options.omitRootParentId ?? false });
  return { widgetHtml, widget: page.frameLocator("#widget") };
}

for (const width of [728, 1310]) {
  test(`focused review shell stays inside a ${width}px host viewport`, async ({ page }) => {
    const { widget } = await fixture(page, { width });
    await widget.getByRole("button", { name: "Approve and open annotation board" }).click();
    await expect(widget.getByLabel("Fixed media annotation area")).toBeVisible();
    const layout = await widget.locator("html").evaluate(() => {
      const selectors = ["html", "body", "#root", ".focused-review-app", ".review-workspace", ".review-stage-shell", ".review-action-dock", ".composer-input-shell"];
      return {
        viewportWidth: window.innerWidth,
        documentScrollLeft: document.scrollingElement?.scrollLeft ?? -1,
        parts: selectors.map((selector) => {
          const element = document.querySelector<HTMLElement>(selector)!;
          const bounds = element.getBoundingClientRect();
          return { selector, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, left: bounds.left, right: bounds.right };
        }),
      };
    });
    expect(layout.documentScrollLeft).toBe(0);
    for (const part of layout.parts) {
      expect(part.scrollWidth, `${part.selector} must not overflow`).toBeLessThanOrEqual(part.clientWidth + 1);
      expect(part.left, `${part.selector} left edge`).toBeGreaterThanOrEqual(-1);
      expect(part.right, `${part.selector} right edge`).toBeLessThanOrEqual(layout.viewportWidth + 1);
    }
  });
}

test("focused editor uses an explicit persisted intent basket and one unified media picker", async ({ page }) => {
  const { widgetHtml, widget } = await fixture(page);
  await widget.getByRole("button", { name: "Approve and open annotation board" }).click();
  await expect(widget.getByLabel("Fixed media annotation area")).toBeVisible();
  const approvalCall = await page.evaluate(() => window.__mockCalls?.find(({ name }) => name === "authorize_renoise_whiteboard_workspace"));
  expect(approvalCall?.arguments).toEqual({ approvedProjectDir: "/tmp/renoise-mock" });
  const actionDock = widget.getByLabel("Annotations and revision instructions");
  await expect(actionDock.locator(":scope > .annotation-toolbar")).toHaveCount(1);
  await expect(actionDock.locator(":scope > .intent-composer")).toHaveCount(1);
  await expect(actionDock).toHaveCSS("max-width", "1280px");
  await expect(widget.locator(".review-workspace")).toHaveCSS("max-width", "1280px");
  await expect(widget.locator(".fixed-media-frame > img")).toHaveAttribute("draggable", "false");
  const fittedEdges = await widget.locator(".review-stage, .fixed-media-frame").evaluateAll(([stage, frame]) => {
    const stageBox = stage.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    return {
      fillsWidth: Math.abs(stageBox.width - frameBox.width) <= 4,
      fillsHeight: Math.abs(stageBox.height - frameBox.height) <= 4,
    };
  });
  expect(fittedEdges.fillsWidth || fittedEdges.fillsHeight).toBe(true);
  await expect(widget.locator(".review-editor-header")).toHaveCount(0);
  await expect(widget.locator(".review-stage-heading").getByRole("button", { name: "添加媒体" })).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "选择" })).toHaveCount(0);
  const mainPicker = widget.locator('input[type="file"][accept*="video/mp4"]');
  await expect(mainPicker).toHaveAttribute("accept", "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm");
  await expect(widget.locator(".intent-chip")).toHaveCount(0);

  const selectionCallsBeforeCanvasClick = await page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "save_renoise_whiteboard_selection").length ?? 0);
  await widget.getByLabel("Annotation layer").click({ position: { x: 180, y: 130 } });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "save_renoise_whiteboard_selection").length ?? 0)).toBe(selectionCallsBeforeCanvasClick);

  await expect(widget.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expect(widget.locator(".intent-chip")).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await expect(widget.getByRole("textbox", { name: "Revision instructions" })).toHaveAttribute("data-placeholder", "Annotate the image with the tools above, then describe the change you want");
  await widget.getByRole("button", { name: "Rectangle" }).click();
  await expect(widget.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toBeVisible();
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toBeDisabled();
  await expect(widget.getByRole("button", { name: "Undo" })).toBeDisabled();
  await widget.getByRole("button", { name: "Cancel" }).click();
  await expect(widget.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Numbered marker" }).click();
  await expect(widget.getByRole("button", { name: "Undo" })).toBeDisabled();
  await widget.getByLabel("Annotation layer").click({ position: { x: 180, y: 130 } });
  await widget.getByLabel("Annotation layer").click({ position: { x: 260, y: 190 } });
  await expect(widget.getByLabel("Annotation layer").locator('[data-mark-id]')).toHaveCount(2);
  await expect(widget.getByLabel("Annotation layer").getByText("1")).toBeVisible();
  await expect(widget.getByLabel("Annotation layer").getByText("2")).toBeVisible();
  await expect(widget.getByRole("button", { name: "Numbered marker" })).toHaveAttribute("aria-pressed", "true");
  await expect(widget.getByRole("button", { name: "Undo" })).toBeEnabled();
  await widget.getByRole("button", { name: "Undo" }).click();
  await expect(widget.getByLabel("Annotation layer").locator('[data-mark-id]')).toHaveCount(1);
  await expect(widget.getByRole("button", { name: "Numbered marker" })).toHaveAttribute("aria-pressed", "true");
  await widget.getByRole("button", { name: "Redo" }).click();
  await expect(widget.getByLabel("Annotation layer").locator('[data-mark-id]')).toHaveCount(2);
  await widget.getByRole("button", { name: "Add to prompt" }).click();
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  const firstClip = widget.getByRole("button", { name: "View image annotation" }).first();
  await expect(firstClip).toBeVisible();
  await expect(firstClip).toHaveAttribute("aria-pressed", "true");
  await expect(firstClip.locator(".intent-chip-label")).toHaveCount(0);
  await expect.poll(() => firstClip.locator(".intent-chip-preview > img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const inlineClipMetrics = await firstClip.evaluate((chip) => {
    const chipBox = chip.getBoundingClientRect();
    const previewBox = chip.querySelector<HTMLElement>(":scope .intent-chip-preview > img")!.getBoundingClientRect();
    const promptBox = chip.closest(".composer-inline-editor")!.getBoundingClientRect();
    return {
      chipHeight: chipBox.height,
      previewWidth: previewBox.width,
      centerDelta: Math.abs((chipBox.top + chipBox.height / 2) - (promptBox.top + promptBox.height / 2)),
    };
  });
  expect(inlineClipMetrics.chipHeight).toBeLessThanOrEqual(42);
  expect(inlineClipMetrics.previewWidth).toBeLessThanOrEqual(24);
  expect(inlineClipMetrics.centerDelta).toBeLessThanOrEqual(5);
  await firstClip.hover();
  const hoverPreview = widget.getByRole("tooltip");
  await expect(hoverPreview.getByRole("img", { name: /source\.png/ })).toBeVisible();
  const hoverMetrics = await hoverPreview.evaluate((popover) => {
    const tooltip = popover.getBoundingClientRect();
    const clip = document.querySelector<HTMLElement>("[data-clip-id]")!.getBoundingClientRect();
    const boundary = document.querySelector<HTMLElement>(".focused-review-app")!.getBoundingClientRect();
    return {
      width: tooltip.width,
      pointerEvents: getComputedStyle(popover).pointerEvents,
      side: popover.getAttribute("data-side"),
      aboveClip: tooltip.bottom <= clip.top,
      withinHorizontalBoundary: tooltip.left >= boundary.left && tooltip.right <= boundary.right,
      withinVerticalBoundary: tooltip.top >= boundary.top && tooltip.bottom <= boundary.bottom,
    };
  });
  expect(hoverMetrics.width).toBeGreaterThan(100);
  expect(hoverMetrics.width).toBeLessThanOrEqual(492);
  expect(hoverMetrics.pointerEvents).toBe("none");
  expect(hoverMetrics.side).toBe("top");
  expect(hoverMetrics.aboveClip).toBe(true);
  expect(hoverMetrics.withinHorizontalBoundary).toBe(true);
  expect(hoverMetrics.withinVerticalBoundary).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedObjectIds.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedAnnotationIds.length)).toBe(1);
  await expect(widget.getByLabel("Annotation layer").locator('[data-mark-id]')).toHaveCount(0);
  const inlineEditor = widget.getByRole("textbox", { name: "Revision instructions" });
  await inlineEditor.click();
  await inlineEditor.press("End");
  await inlineEditor.pressSequentially(" 增加王冠，在 ");

  const imageOnlyPicker = widget.locator('input[type="file"][accept="image/png,image/jpeg,image/webp,image/gif"]');
  await imageOnlyPicker.setInputFiles({ name: "local-reference.png", mimeType: "image/png", buffer: tinyPng });
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Numbered marker" }).click();
  await widget.getByLabel("Annotation layer").click({ position: { x: 200, y: 150 } });
  await widget.getByRole("button", { name: "Add to prompt" }).click();
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedObjectIds.length)).toBe(2);
  const secondClip = widget.getByRole("button", { name: "View image annotation" }).nth(1);
  await expect(secondClip).toBeVisible();
  await expect(secondClip).toHaveAttribute("aria-pressed", "true");
  await firstClip.click();
  await expect(firstClip).toHaveAttribute("aria-pressed", "true");
  await expect(secondClip).toHaveAttribute("aria-pressed", "false");
  await inlineEditor.click();
  await inlineEditor.press("End");
  await inlineEditor.pressSequentially(" 调整环境光线");
  await expect(inlineEditor.locator("[data-clip-id]")).toHaveCount(2);
  await expect(inlineEditor).toContainText("增加王冠，在");
  await expect(inlineEditor).toContainText("调整环境光线");
  const layout = await widget.locator("html").evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const bounds = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
      };
    };
    return {
      viewportWidth: window.innerWidth,
      documentScrollLeft: document.scrollingElement?.scrollLeft ?? -1,
      html: read("html"),
      body: read("body"),
      root: read("#root"),
      app: read(".focused-review-app"),
      workspace: read(".review-workspace"),
      stage: read(".review-stage-shell"),
      dock: read(".review-action-dock"),
      input: read(".composer-input-shell"),
    };
  });
  expect(layout.documentScrollLeft).toBe(0);
  for (const part of [layout.html, layout.body, layout.root, layout.app, layout.workspace, layout.stage, layout.dock, layout.input]) {
    expect(part.scrollWidth).toBeLessThanOrEqual(part.clientWidth + 1);
    expect(part.left).toBeGreaterThanOrEqual(-1);
    expect(part.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  }
  await inlineEditor.evaluate((element) => { element.scrollLeft = 0; });
  await widget.getByRole("button", { name: "Submit annotation request" }).hover();
  await expect(widget.getByRole("tooltip")).toHaveCount(0);
  await expect(actionDock).toHaveScreenshot("inline-annotation-clip.png");

  await page.evaluate((html) => {
    document.querySelector("#widget")?.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "restored-widget";
    iframe.style.cssText = "width:1024px;height:760px;border:0";
    document.body.prepend(iframe);
    const connecting = window.__startWhiteboardMockHost!(iframe);
    iframe.srcdoc = html;
    void connecting;
  }, widgetHtml);
  const restored = page.frameLocator("#restored-widget");
  await restored.getByRole("button", { name: "Open annotation board" }).click();
  await expect(restored.locator(".intent-chip")).toHaveCount(2);
  await expect(restored.getByRole("button", { name: "View image annotation" })).toHaveCount(2);
  await expect.poll(() => restored.locator(".intent-chip-preview > img").evaluateAll((images: HTMLImageElement[]) =>
    images.length === 2 && images.every(({ naturalWidth }) => naturalWidth > 0))).toBe(true);

  await expect(restored.getByRole("textbox", { name: "Revision instructions" })).toContainText("增加王冠，在");
  await restored.getByRole("button", { name: "Submit annotation request" }).click();
  await expect.poll(() => page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "submit_renoise_whiteboard_revision_intent").length)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const call = window.__mockCalls?.find(({ name }) => name === "submit_renoise_whiteboard_revision_intent");
    return (call?.arguments as { instruction?: string } | undefined)?.instruction;
  })).toBe("[Annotation 1: image] 增加王冠，在 [Annotation 2: image] 调整环境光线");
  await expect.poll(() => page.evaluate(() => window.__mockMessages?.length)).toBe(1);
  const sentMessage = await page.evaluate(() => JSON.stringify(window.__mockMessages?.[0]));
  expect(sentMessage).toContain("reply directly in this conversation");
  expect(sentMessage).not.toContain("返修");
  expect(sentMessage).not.toContain("回填");
});

test("the first direct image upload on an empty focused stage remains stable and is not added before confirmation", async ({ page }) => {
  const { widget } = await fixture(page, { startEmpty: true, omitRootParentId: true });
  await widget.getByRole("button", { name: "Approve and open annotation board" }).click();
  await expect(widget.getByRole("button", { name: /Add an image or video/ })).toBeVisible();
  await widget.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({ name: "first.png", mimeType: "image/png", buffer: tinyPng });
  await expect(widget.getByLabel("Fixed media annotation area")).toBeVisible();
  await expect(widget.locator(".intent-chip")).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Numbered marker" }).click();
  await widget.getByLabel("Annotation layer").click({ position: { x: 200, y: 180 } });
  await widget.getByRole("button", { name: "Add to prompt" }).click();
  await expect(widget.getByRole("button", { name: "View image annotation" })).toBeVisible();
  await page.waitForTimeout(2_200);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.objects.length)).toBe(3);
  await expect(widget.getByRole("button", { name: "Open recovery diagnostics console" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "save_renoise_whiteboard_state").length)).toBeGreaterThanOrEqual(2);
});

test("adding immediately after drawing flushes the final mark into the persisted intent", async ({ page }) => {
  const { widget } = await fixture(page, { startEmpty: true });
  await widget.getByRole("button", { name: "Approve and open annotation board" }).click();
  await widget.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({
    name: "annotate-now.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  const canvas = widget.getByLabel("Annotation layer");
  await expect(canvas).toBeVisible();
  await widget.getByRole("button", { name: "Rectangle" }).click();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("missing annotation stage bounds");
  await page.mouse.move(canvasBox.x + canvasBox.width * .25, canvasBox.y + canvasBox.height * .25);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * .65, canvasBox.y + canvasBox.height * .65, { steps: 6 });
  await page.mouse.up();
  await expect(canvas.locator('[data-mark-id]')).toHaveCount(1);
  await expect(widget.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  await widget.getByRole("button", { name: "Add to prompt" }).click();

  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedAnnotationIds.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.annotations.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.objects.length)).toBe(3);
  await expect(widget.getByLabel("Annotation layer").locator('[data-mark-id]')).toHaveCount(0);
});
