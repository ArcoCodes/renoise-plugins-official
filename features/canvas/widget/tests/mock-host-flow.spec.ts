import { expect, test, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function removeAtomicReference(page: Page, reference: import("@playwright/test").Locator) {
  await reference.evaluate((element) => {
    const atomic = element.closest(".lexical-reference-node") ?? element;
    const editor = atomic.closest<HTMLElement>('[contenteditable="true"]');
    editor?.focus();
    const range = document.createRange();
    range.selectNode(atomic);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.press("Backspace");
}

async function fixture(page: Page, options: { startEmpty?: boolean; omitRootParentId?: boolean; resumeSession?: boolean; pendingSessionMissing?: boolean; width?: number } = {}) {
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
  await page.evaluate(({ html, startEmpty, omitRootParentId, resumeSession, pendingSessionMissing }: { html: string; startEmpty: boolean; omitRootParentId: boolean; resumeSession: boolean; pendingSessionMissing: boolean }) => {
    window.__mockStartEmpty = startEmpty;
    window.__mockOmitRootParentIdInSaveResponse = omitRootParentId;
    window.__mockResumeSession = resumeSession;
    window.__mockPendingSessionMissing = pendingSessionMissing;
    window.__mockPendingSessionRecreated = false;
    const iframe = document.querySelector<HTMLIFrameElement>("#widget")!;
    const connecting = window.__startWhiteboardMockHost!(iframe);
    iframe.srcdoc = html;
    void connecting;
  }, { html: widgetHtml, startEmpty: options.startEmpty ?? false, omitRootParentId: options.omitRootParentId ?? false, resumeSession: options.resumeSession ?? false, pendingSessionMissing: options.pendingSessionMissing ?? false });
  return { widgetHtml, widget: page.frameLocator("#widget") };
}

test("an existing active session remounts the editor and requests fullscreen without another approval", async ({ page }) => {
  const { widget } = await fixture(page, { resumeSession: true });
  await expect(widget.getByLabel("Media annotation area")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mockDisplayModes)).toContain("fullscreen");
  expect(await page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "authorize_renoise_whiteboard_workspace").length)).toBe(0);
  await expect(widget.getByRole("button", { name: "Open visual editor" })).toHaveCount(0);
});

test("a preserved widget recreates a missing pending session from the same approval click", async ({ page }) => {
  const { widget } = await fixture(page, { pendingSessionMissing: true });
  await widget.getByRole("button", { name: "Approve and open visual editor" }).click();
  await expect(widget.locator(".focused-review-app")).toBeVisible();
  const recoveryCalls = await page.evaluate(() => window.__mockCalls?.map(({ name }) => name) ?? []);
  expect(recoveryCalls.filter((name) => name === "authorize_renoise_whiteboard_workspace")).toHaveLength(2);
  expect(recoveryCalls).toContain("render_renoise_whiteboard_widget");
});

async function drawRectangle(page: Page, widget: ReturnType<Page["frameLocator"]>, start = .25, end = .6) {
  const canvas = widget.getByLabel("Annotation layer");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing annotation stage bounds");
  await page.mouse.move(box.x + box.width * start, box.y + box.height * start);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * end, box.y + box.height * end, { steps: 6 });
  await page.mouse.up();
}

for (const width of [728, 1310]) {
  test(`focused review shell stays inside a ${width}px host viewport`, async ({ page }) => {
    const { widget } = await fixture(page, { width });
    await widget.getByRole("button", { name: "Approve and open visual editor" }).click();
    await expect(widget.getByLabel("Media annotation area")).toBeVisible();
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
  await widget.getByRole("button", { name: "Approve and open visual editor" }).click();
  await expect(widget.getByLabel("Media annotation area")).toBeVisible();
  const approvalCall = await page.evaluate(() => window.__mockCalls?.find(({ name }) => name === "authorize_renoise_whiteboard_workspace"));
  expect(approvalCall?.arguments).toEqual({ approvedProjectDir: "/tmp/renoise-mock", canvasSessionId: "session_pending_a" });
  const actionDock = widget.getByLabel("Annotations and revision instructions");
  await expect(actionDock.locator(":scope > .annotation-toolbar")).toHaveCount(1);
  await expect(actionDock.locator(":scope > .intent-composer")).toHaveCount(1);
  await expect(actionDock).toHaveCSS("max-width", "100%");
  await expect(widget.locator(".review-workspace")).toHaveCSS("max-width", "100%");
  await expect(widget.locator(".reshoot-media-fit > img")).toHaveAttribute("draggable", "false");
  const fittedEdges = await widget.locator(".review-stage, .reshoot-media-fit").evaluateAll(([stage, frame]) => {
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
  await widget.getByLabel("Media annotation area").click({ position: { x: 180, y: 130 } });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "save_renoise_whiteboard_selection").length ?? 0)).toBe(selectionCallsBeforeCanvasClick);

  await expect(widget.getByRole("button", { name: "Cancel annotation" })).toHaveCount(0);
  await expect(widget.locator(".intent-chip")).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await expect(widget.getByRole("textbox", { name: "Revision instructions" })).toHaveAttribute("data-placeholder", "Annotate the image with the tools above, then describe the change you want");
  const toolbarBounds = await actionDock.locator(":scope > .annotation-toolbar").evaluate((toolbar) => {
    const { width, height } = toolbar.getBoundingClientRect();
    return { width, height };
  });
  const resolution = widget.getByLabel("Output resolution");
  await expect(resolution).toHaveValue("720p");
  await resolution.selectOption("1080p");
  await expect(resolution).toHaveValue("1080p");
  await expect.poll(() => page.evaluate(() => window.__mockView?.outputResolution)).toBe("1080p");
  await widget.getByRole("button", { name: "Rectangle" }).click();
  await expect.poll(() => actionDock.locator(":scope > .annotation-toolbar").evaluate((toolbar) => {
    const { width, height } = toolbar.getBoundingClientRect();
    return { width, height };
  })).toEqual(toolbarBounds);
  await widget.getByRole("button", { name: "Annotation color" }).click();
  await widget.getByRole("menuitemradio", { name: "Use #34C759" }).click();
  await expect(widget.getByRole("button", { name: "Annotation color" }).locator("span")).toHaveCSS("background-color", "rgb(52, 199, 89)");
  await expect(widget.getByRole("button", { name: "Cancel annotation" })).toBeVisible();
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toBeVisible();
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toBeDisabled();
  await expect(widget.getByRole("button", { name: "Undo" })).toBeDisabled();
  const toolbarScroller = actionDock.locator(":scope > .annotation-toolbar").locator(".toolbar-scroll");
  const annotatingToolbarLayout = await toolbarScroller.evaluate((scroller) => {
    const bounds = scroller.getBoundingClientRect();
    const buttons = [...scroller.querySelectorAll<HTMLElement>("button")]
      .filter((button) => getComputedStyle(button).display !== "none" && button.getBoundingClientRect().width > 0);
    return {
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      scrollLeft: scroller.scrollLeft,
      firstButtonLeft: buttons[0]?.getBoundingClientRect().left,
      left: bounds.left,
    };
  });
  expect(annotatingToolbarLayout.scrollLeft).toBe(0);
  expect(annotatingToolbarLayout.firstButtonLeft! - annotatingToolbarLayout.left).toBeLessThanOrEqual(12);
  if (annotatingToolbarLayout.scrollWidth > annotatingToolbarLayout.clientWidth + 1) {
    await toolbarScroller.evaluate((scroller) => { scroller.scrollLeft = scroller.scrollWidth; });
    await expect.poll(() => toolbarScroller.evaluate((scroller) => {
      const bounds = scroller.getBoundingClientRect();
      const visibleButtons = [...scroller.querySelectorAll<HTMLElement>("button")]
        .filter((button) => getComputedStyle(button).display !== "none" && button.getBoundingClientRect().width > 0);
      const lastButton = visibleButtons.at(-1)?.getBoundingClientRect();
      return scroller.scrollLeft > 0 && !!lastButton && lastButton.right <= bounds.right + 1;
    })).toBe(true);
    await toolbarScroller.evaluate((scroller) => { scroller.scrollLeft = 0; });
  }
  await widget.getByRole("button", { name: "Cancel annotation" }).click();
  await expect(widget.getByRole("button", { name: "Cancel annotation" })).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Rectangle" }).click();
  await expect(widget.getByRole("button", { name: "Undo" })).toBeDisabled();
  await drawRectangle(page, widget, .2, .4);
  await drawRectangle(page, widget, .55, .75);
  await expect(widget.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  await expect(widget.getByRole("button", { name: "Undo" })).toBeEnabled();
  await widget.getByRole("button", { name: "Undo" }).click();
  await expect(widget.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  await widget.getByRole("button", { name: "Redo" }).click();
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toBeEnabled();
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
    return {
      chipHeight: chipBox.height,
      previewWidth: previewBox.width,
    };
  });
  expect(inlineClipMetrics.chipHeight).toBeLessThanOrEqual(42);
  expect(inlineClipMetrics.previewWidth).toBeLessThanOrEqual(24);
  await expect.poll(() => firstClip.evaluate((chip) => {
    const chipBox = chip.getBoundingClientRect();
    const promptBox = document.querySelector<HTMLElement>(".composer-inline-editor")!.getBoundingClientRect();
    return chipBox.top >= promptBox.top - 2 && chipBox.bottom <= promptBox.bottom + 2;
  })).toBe(true);
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
  expect(hoverMetrics.width).toBeLessThanOrEqual(260);
  expect(hoverMetrics.pointerEvents).toBe("none");
  expect(hoverMetrics.side).toBe("top");
  expect(hoverMetrics.aboveClip).toBe(true);
  expect(hoverMetrics.withinHorizontalBoundary).toBe(true);
  expect(hoverMetrics.withinVerticalBoundary).toBe(true);
  await expect(hoverPreview.getByText("source.png")).toBeVisible();
  await expect(hoverPreview.getByText("Image", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedObjectIds.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedAnnotationIds.length)).toBe(1);
  await expect(widget.getByLabel("Annotation layer")).toHaveCount(0);
  const inlineEditor = widget.getByRole("textbox", { name: "Revision instructions" });
  await inlineEditor.click();
  await inlineEditor.press("End");
  await inlineEditor.pressSequentially(" 增加王冠，在 ");

  const imageOnlyPicker = widget.locator('input[type="file"][accept="image/png,image/jpeg,image/webp,image/gif"]');
  await imageOnlyPicker.setInputFiles({ name: "local-reference.png", mimeType: "image/png", buffer: tinyPng });
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Rectangle" }).click();
  await drawRectangle(page, widget);
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
  await removeAtomicReference(page, firstClip);
  await expect(inlineEditor.locator("[data-clip-id]")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedObjectIds.length)).toBe(2);
  await inlineEditor.evaluate((element) => {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  const composerBoundsBeforeMention = await actionDock.locator(":scope > .intent-composer").evaluate((element) => {
    const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  });
  await page.keyboard.type("@");
  const clipLibrary = widget.getByRole("listbox", { name: "References" });
  await expect(clipLibrary).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const keyboardCandidate = clipLibrary.getByRole("option", { name: /source\.png/ });
  await expect(keyboardCandidate).toHaveAttribute("aria-selected", "true");
  await expect(keyboardCandidate).toHaveCSS("box-shadow", /rgb\(240, 75, 44\)/);
  const mentionPlacement = await clipLibrary.evaluate((menu) => {
    const menuElement = menu as HTMLElement;
    const app = menuElement.closest<HTMLElement>(".focused-review-app")!;
    const composer = document.querySelector<HTMLElement>(".intent-composer")!;
    const input = document.querySelector<HTMLElement>(".composer-input-shell")!;
    const menuBox = menuElement.getBoundingClientRect();
    const appBox = app.getBoundingClientRect();
    const composerBox = composer.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    return {
      offsetParentIsInput: menuElement.offsetParent === input,
      left: menuBox.left,
      right: menuBox.right,
      top: menuBox.top,
      bottom: menuBox.bottom,
      appLeft: appBox.left,
      appRight: appBox.right,
      appTop: appBox.top,
      appBottom: appBox.bottom,
      inputLeft: inputBox.left,
      inputRight: inputBox.right,
      inputBottom: inputBox.bottom,
      composerHeight: composerBox.height,
    };
  });
  expect(mentionPlacement.offsetParentIsInput).toBe(false);
  expect(mentionPlacement.left).toBeGreaterThanOrEqual(mentionPlacement.appLeft);
  expect(mentionPlacement.right).toBeLessThanOrEqual(mentionPlacement.appRight);
  expect(mentionPlacement.top).toBeGreaterThanOrEqual(mentionPlacement.appTop);
  expect(mentionPlacement.bottom).toBeLessThanOrEqual(mentionPlacement.appBottom);
  expect(mentionPlacement.composerHeight).toBeCloseTo(composerBoundsBeforeMention.height, 1);
  await clipLibrary.getByRole("option", { name: /source\.png/ }).click();
  await expect(inlineEditor.locator("[data-clip-id]")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => {
    const pageId = window.__mockDocument?.page.id;
    const draft = pageId ? window.__mockView?.promptDrafts[pageId] ?? "" : "";
    return { markerCount: [...draft.matchAll(/\[\[renoise-clip:/g)].length, hasLatestText: draft.includes("调整环境光线") };
  })).toEqual({ markerCount: 2, hasLatestText: true });
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
  await expect(actionDock).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(widget.getByRole("heading", { name: "Renoise Visual Edit" })).toBeVisible();
  await expect(widget.getByLabel("Annotation workflow")).toBeVisible();

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
  await restored.getByRole("button", { name: "Open visual editor" }).click();
  await expect(restored.locator(".intent-chip")).toHaveCount(2);
  await expect(restored.getByRole("button", { name: "View image annotation" })).toHaveCount(2);
  await expect.poll(() => restored.locator(".intent-chip-preview > img").evaluateAll((images: HTMLImageElement[]) =>
    images.length === 2 && images.every(({ naturalWidth }) => naturalWidth > 0))).toBe(true);

  await expect(restored.getByRole("textbox", { name: "Revision instructions" })).toContainText("增加王冠，在");
  await expect(restored.getByLabel("Output resolution")).toHaveValue("1080p");
  await restored.getByRole("button", { name: "Submit annotation request" }).click();
  await expect.poll(() => page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "submit_renoise_whiteboard_revision_intent").length)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const call = window.__mockCalls?.find(({ name }) => name === "submit_renoise_whiteboard_revision_intent");
    return (call?.arguments as { instruction?: string } | undefined)?.instruction;
  })).toMatch(/Annotation 2: image/);
  const submittedInstruction = await page.evaluate(() => {
    const call = window.__mockCalls?.find(({ name }) => name === "submit_renoise_whiteboard_revision_intent");
    return (call?.arguments as { instruction?: string } | undefined)?.instruction;
  });
  expect(submittedInstruction).toContain("增加王冠，在");
  expect(submittedInstruction).toContain("调整环境光线");
  expect(submittedInstruction?.match(/\[Annotation \d+: image\]/g)).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => {
    const call = window.__mockCalls?.find(({ name }) => name === "submit_renoise_whiteboard_revision_intent");
    return (call?.arguments as { outputResolution?: string } | undefined)?.outputResolution;
  })).toBe("1080p");
  await expect.poll(() => page.evaluate(() => window.__mockMessages?.length)).toBe(1);
  const sentMessage = await page.evaluate(() => JSON.stringify(window.__mockMessages?.[0]));
  expect(sentMessage).toContain("reply directly in this conversation");
  expect(sentMessage).not.toContain("返修");
  expect(sentMessage).not.toContain("回填");
});

test("the first direct image upload on an empty focused stage remains stable and is not added before confirmation", async ({ page }) => {
  const { widget } = await fixture(page, { startEmpty: true, omitRootParentId: true });
  await widget.getByRole("button", { name: "Approve and open visual editor" }).click();
  await expect(widget.getByRole("button", { name: /Add an image or video/ })).toBeVisible();
  await widget.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({ name: "first.png", mimeType: "image/png", buffer: tinyPng });
  await expect(widget.getByLabel("Media annotation area")).toBeVisible();
  await expect(widget.locator(".intent-chip")).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Add to prompt" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Rectangle" }).click();
  await drawRectangle(page, widget);
  await widget.getByRole("button", { name: "Add to prompt" }).click();
  await expect(widget.getByRole("button", { name: "View image annotation" })).toBeVisible();
  await page.waitForTimeout(2_200);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.objects.length)).toBe(3);
  await expect(widget.getByRole("button", { name: "Open recovery diagnostics console" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__mockCalls?.filter(({ name }) => name === "save_renoise_whiteboard_state").length)).toBeGreaterThanOrEqual(2);
});

test("replacing the target media clears annotations, clips, and the persisted prompt", async ({ page }) => {
  const { widget } = await fixture(page);
  await widget.getByRole("button", { name: "Approve and open visual editor" }).click();
  await expect(widget.getByRole("button", { name: "Replace media" })).toBeVisible();

  await widget.getByRole("button", { name: "Rectangle" }).click();
  await drawRectangle(page, widget);
  await widget.getByRole("button", { name: "Add to prompt" }).click();
  const editor = widget.getByRole("textbox", { name: "Revision instructions" });
  await editor.click();
  await editor.press("End");
  await editor.pressSequentially(" Replace the crown");
  await expect(widget.locator(".intent-chip")).toHaveCount(1);
  await expect(editor).toContainText("Replace the crown");

  const chooserPromise = page.waitForEvent("filechooser");
  await widget.getByRole("button", { name: "Replace media" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "replacement.png", mimeType: "image/png", buffer: tinyPng });

  await expect(widget.getByRole("button", { name: "Replace media" })).toBeVisible();
  await expect(widget.locator(".reshoot-media-fit > img")).toHaveCount(1);
  await expect(widget.locator(".intent-chip")).toHaveCount(0);
  await expect(editor).toHaveText("");
  await expect(widget.getByLabel("Annotation layer")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.objects.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.annotations.length)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedObjectIds.length)).toBe(0);
  await expect.poll(() => page.evaluate(() => {
    const pageId = window.__mockDocument?.page.id;
    return pageId ? window.__mockView?.promptDrafts[pageId] ?? "" : "missing";
  })).toBe("");
});

test("adding immediately after drawing flushes the final mark into the persisted intent", async ({ page }) => {
  const { widget } = await fixture(page, { startEmpty: true });
  await widget.getByRole("button", { name: "Approve and open visual editor" }).click();
  await widget.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({
    name: "annotate-now.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await widget.getByRole("button", { name: "Rectangle" }).click();
  await drawRectangle(page, widget, .25, .65);
  await expect(widget.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  await widget.getByRole("button", { name: "Add to prompt" }).click();

  await expect.poll(() => page.evaluate(() => window.__mockSelection?.selectedAnnotationIds.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.annotations.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mockDocument?.page.objects.length)).toBe(3);
  await expect(widget.getByLabel("Annotation layer")).toHaveCount(0);
});
