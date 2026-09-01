import { expect, test, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function removeAtomicReference(page: Page, reference: Locator) {
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
  const css = readFileSync(resolve("features/canvas/widget/src/styles/theme.css"), "utf8");
  await page.setContent(`<style>${css}</style><div id="root" class="focused-review-app"></div><script type="module">${javascript}</script>`);

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
  expect(positions).toEqual({ count: 2, text: "在  增加王冠，在 00:04.000 调整光线", first: "object_target_a", second: "object_target_b" });
  await firstClip.hover();
  await expect(page.getByRole("tooltip").getByRole("img", { name: /角色图 A/ })).toBeVisible();
  await expect(editor.getByRole("tooltip")).toHaveCount(0);
  const copiedClip = await editor.evaluate((element) => {
    const clip = element.querySelector<HTMLElement>("[data-clip-id]")!;
    const range = document.createRange();
    range.selectNode(clip);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const clipboardData = new DataTransfer();
    element.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData }));
    return clipboardData.getData("text/plain");
  });
  expect(copiedClip).toBe("[[renoise-clip:object_target_a]]");
  await editor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "王" }));
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", isComposing: true }));
  });
  expect(await page.evaluate(() => window.__submittedIntent)).toBeUndefined();
  await editor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "王" }));
  });
  await editor.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await editor.press("Shift+Enter");
  expect(await page.evaluate(() => window.__submittedIntent)).toBeUndefined();
  await expect.poll(() => editor.evaluate((element) => element.innerHTML)).toContain("<br");
  await page.keyboard.insertText("补充第二行");
  await page.getByRole("button", { name: "Submit annotation request" }).click();
  await expect.poll(() => page.evaluate(() => window.__submittedIntent)).toEqual({
    ids: ["object_target_a", "object_target_b"],
    prompt: "在 [Annotation 1: image] 增加王冠，在 [Annotation 2: video frame 00:04.000] 调整光线\n补充第二行",
  });

  await removeAtomicReference(page, secondClip);
  await expect(page.getByText("00:04.000")).toHaveCount(0);
  await expect(secondClip).toHaveCount(0);
  await editor.evaluate((element) => {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.type("@");
  const clipPicker = page.getByRole("listbox", { name: "References" });
  await expect(clipPicker).toBeVisible();
  await clipPicker.getByRole("option", { name: /镜头 B\.mp4/ }).click();
  await expect(page.getByRole("button", { name: "View video frame 00:04.000 annotation" })).toBeVisible();
  await expect(editor).not.toContainText("@");
});

test("new clips and async material picks use the last collapsed Lexical anchor", async ({ page }) => {
  const bundle = await build({
    entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2022",
  });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const editor = page.getByLabel("Revision instructions");
  await expect(editor.locator("[data-clip-id]")).toHaveCount(2);

  await editor.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes("调整光线")) {
        const offset = node.textContent.indexOf("调整光线") + 2;
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        (root as HTMLElement).dispatchEvent(new InputEvent("input", { bubbles: true }));
        break;
      }
    }
  });
  await page.getByRole("button", { name: "Toolbar control" }).click();
  await page.evaluate(() => window.__addThirdClip?.());
  await expect(editor.locator("[data-clip-id]")) .toHaveCount(3);
  const clipOrder = await editor.locator("[data-clip-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.clipId));
  expect(clipOrder).toEqual(["object_target_a", "object_target_b", "object_target_c"]);
  const serializedAfterThird = await editor.evaluate((root) => {
    const serialize = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
      if (!(node instanceof HTMLElement)) return "";
      if (node.dataset.clipId) return `[[renoise-clip:${node.dataset.clipId}]]`;
      return [...node.childNodes].map(serialize).join("");
    };
    return [...root.querySelectorAll(":scope > p")].map(serialize).join("\n");
  });
  expect(serializedAfterThird).toBe("在 [[renoise-clip:object_target_a]] 增加王冠，在 [[renoise-clip:object_target_b]] 调整 [[renoise-clip:object_target_c]] 光线");
  await expect(page.getByRole("button", { name: "View image annotation" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "View video frame 00:04.000 annotation" })).toHaveCount(1);

  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Browse materials" }).click();
  const browser = page.getByRole("dialog", { name: "Select materials" });
  await expect(browser).toBeVisible();
  await browser.getByRole("button", { name: /Hero reference/ }).click();
  await expect(browser.getByRole("button", { name: /Motion reference/ })).toHaveCount(0);
  await browser.getByRole("button", { name: "Confirm (1)" }).click();
  await expect(editor.locator("[data-material-id]")) .toHaveCount(1);
  expect(await page.evaluate(() => window.__materialPool?.map(({ materialId }) => materialId))).toEqual([101]);

  await removeAtomicReference(page, editor.locator('[data-material-id="101"]'));
  await expect(editor.locator('[data-material-id="101"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__materialPool?.map(({ materialId }) => materialId))).toEqual([101]);
  await editor.evaluate((root) => {
    (root as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.type("@");
  const picker = page.getByRole("listbox", { name: "References" });
  await picker.getByRole("option", { name: "Hero reference" }).click();
  await expect(editor.locator('[data-material-id="101"]')).toHaveCount(1);
});

test("immediate submit cancels stale draft emission and a keyed draft switch remounts", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const editor = page.getByLabel("Revision instructions");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.evaluate(() => { window.__clearOnSubmit = true; });
  await page.keyboard.insertText("立刻提交");
  await editor.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__submittedIntent?.prompt)).toContain("立刻提交");
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__promptDraft)).toBe("");
  await expect(editor).toHaveText("");

  await page.evaluate(() => window.__setHarnessDraft?.("B 页草稿", "session_b:page_b"));
  await expect(editor).toHaveText("B 页草稿");
  await editor.click();
  await page.keyboard.type("@old");
  await expect(page.getByRole("listbox", { name: "References" })).toHaveCount(0);
  await page.evaluate(() => window.__setHarnessDraft?.("A 页恢复 [[renoise-clip:object_target_a]]", "session_a:page_a"));
  await expect(editor).toContainText("A 页恢复");
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(1);
  await expect(page.getByRole("listbox", { name: "References" })).toHaveCount(0);

  await page.evaluate(() => { window.__rejectSubmit = true; window.__clearOnSubmit = false; });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("失败后保留");
  await editor.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__promptDraft)).toContain("失败后保留");
});

test("static reference picker keyboard controls and material search ignore stale results", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const editor = page.getByLabel("Revision instructions");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("@");
  await expect(page.getByRole("option", { name: "Browse materials" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Upload from device" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(editor.locator("[data-clip-id]")).toHaveCount(3);
  await page.keyboard.type("@");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "References" })).toHaveCount(0);

  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Browse materials" }).click();
  const browser = page.getByRole("dialog", { name: "Select materials" });
  await expect(browser.getByRole("group", { name: "Material type" })).toHaveCount(0);
  await expect(browser.getByRole("button", { name: /Motion reference/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__materialTypes)).toContain("image");
  const search = browser.getByLabel("Search materials");
  await search.fill("slow");
  await page.waitForTimeout(320);
  await search.fill("fast");
  await expect(browser.getByText("fast result")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(browser.getByText("fast result")).toBeVisible();
  await expect(browser.getByText("slow result")).toHaveCount(0);
  await search.fill("pages");
  await expect(browser.getByText("Infinite page one")).toBeVisible();
  await expect(browser.getByText("Infinite page two")).toBeVisible();
  await expect(browser.getByRole("button", { name: /Load more/ })).toHaveCount(0);
  await browser.getByRole("button", { name: "Close materials" }).click();
  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Browse materials" }).click();
  await expect(browser.getByLabel("Search materials")).toHaveValue("");
});

test("typing after @ closes the static picker without searching the remote library", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const editor = page.getByLabel("Revision instructions");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("@fast");
  await expect(page.getByRole("listbox", { name: "References" })).toHaveCount(0);
  await expect(editor).toContainText("@fast");
  expect(await page.evaluate(() => window.__materialRequests)).not.toContain("fast");
});

test("empty prompt caret shares the placeholder first line and the picker uses the main-site action surface", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  const css = readFileSync(resolve("features/canvas/widget/src/styles/theme.css"), "utf8");
  await page.setContent(`<style>${css}</style><div id="root" class="focused-review-app"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  await page.evaluate(() => window.__setHarnessDraft?.("", "placeholder:baseline"));
  const editor = page.getByLabel("Revision instructions");
  await expect(editor).toHaveText("");
  const geometry = await editor.evaluate((root) => {
    const paragraph = root.querySelector(":scope > p")!;
    const placeholder = root.parentElement!.querySelector(".composer-placeholder")!;
    return {
      paragraphTop: paragraph.getBoundingClientRect().top,
      placeholderTop: placeholder.getBoundingClientRect().top,
      paragraphMarginTop: getComputedStyle(paragraph).marginTop,
    };
  });
  expect(geometry.paragraphMarginTop).toBe("0px");
  expect(Math.abs(geometry.paragraphTop - geometry.placeholderTop)).toBeLessThanOrEqual(1);

  await editor.click();
  await page.keyboard.type("@");
  const menu = page.getByRole("listbox", { name: "References" });
  await expect(menu.getByRole("option", { name: "Browse materials" })).toBeVisible();
  await expect(menu.getByRole("option", { name: "Upload from device" })).toBeVisible();
  await expect(menu.getByRole("option").nth(0)).toHaveAccessibleName("Browse materials");
  await expect(menu.getByRole("option").nth(1)).toHaveAccessibleName("Upload from device");
  await expect(menu.locator('[data-icon="asset-library"]')).toHaveCount(1);
  expect(await menu.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(247, 247, 247)");
});

test("draft length rollback never persists a partial reference marker", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const clip = "[[renoise-clip:object_target_a]]";
  const material = "[[renoise-material:101]]";
  await page.evaluate(({ clip, material }) => {
    window.__setMaterialPool?.([{ materialId: 101, name: "Hero", type: "image", mimeType: "image/png" }]);
    window.__setHarnessDraft?.("x".repeat(10_000 - clip.length) + clip, "boundary:clip");
  }, { clip, material });
  const editor = page.getByLabel("Revision instructions");
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(1);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await editor.evaluate((element, marker) => {
    const data = new DataTransfer();
    data.setData("text/plain", marker);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
  }, material);
  await page.waitForTimeout(150);
  expect((await page.evaluate(() => window.__promptDraft))?.length).toBeLessThanOrEqual(10_000);
  await expect(editor.locator("[data-material-id]")).toHaveCount(0);
  expect(await editor.textContent()).not.toContain("[[renoise-material:");

  await page.evaluate(({ material }) => window.__setHarnessDraft?.("y".repeat(10_000 - material.length) + material, "boundary:material"), { material });
  await expect(editor.locator('[data-material-id="101"]')).toHaveCount(1);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await editor.evaluate((element, marker) => {
    const data = new DataTransfer();
    data.setData("text/plain", marker);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
  }, clip);
  await page.waitForTimeout(150);
  expect((await page.evaluate(() => window.__promptDraft))?.length).toBeLessThanOrEqual(10_000);
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(0);
  expect(await editor.textContent()).not.toContain("[[renoise-clip:");
});

test("element anchors preserve paragraph start, an empty middle paragraph, and positions between atomic clips", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const editor = page.getByLabel("Revision instructions");
  const setElementCaret = async (paragraphIndex: number, childOffset: number) => editor.evaluate((root, { paragraphIndex, childOffset }) => {
    const paragraph = root.querySelectorAll(":scope > p")[paragraphIndex]!;
    (root as HTMLElement).focus();
    const range = document.createRange();
    range.setStart(paragraph, childOffset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  }, { paragraphIndex, childOffset });

  await page.evaluate(() => { window.__resetItems?.(); window.__setHarnessDraft?.("开头 [[renoise-clip:object_target_a]]", "anchor:start"); });
  await expect(editor.locator("[data-clip-id]")).toHaveCount(1);
  await setElementCaret(0, 0);
  await page.getByRole("button", { name: "Toolbar control" }).click();
  await page.evaluate(() => window.__addThirdClip?.());
  await expect(editor.locator("[data-clip-id]")).toHaveCount(2);
  expect(await editor.locator("[data-clip-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.clipId))).toEqual(["object_target_c", "object_target_a"]);

  await page.evaluate(() => { window.__resetItems?.(); window.__setHarnessDraft?.("第一段\n\n最后段", "anchor:empty"); });
  await expect(editor.locator(":scope > p")).toHaveCount(3);
  await setElementCaret(1, 0);
  await page.getByRole("button", { name: "Toolbar control" }).click();
  await page.evaluate(() => window.__addThirdClip?.());
  await expect(editor.locator(":scope > p").nth(1).locator('[data-clip-id="object_target_c"]')).toHaveCount(1);

  await page.evaluate(() => { window.__resetItems?.(); window.__setHarnessDraft?.("[[renoise-clip:object_target_a]][[renoise-clip:object_target_b]]", "anchor:between"); });
  await expect(editor.locator("[data-clip-id]")).toHaveCount(2);
  await setElementCaret(0, 1);
  await page.getByRole("button", { name: "Toolbar control" }).click();
  await page.evaluate(() => window.__addThirdClip?.());
  await expect(editor.locator("[data-clip-id]")).toHaveCount(3);
  expect(await editor.locator("[data-clip-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.clipId))).toEqual(["object_target_a", "object_target_c", "object_target_b"]);

  await page.evaluate(() => { window.__resetItems?.(); window.__setHarnessDraft?.("[[renoise-clip:object_target_a]][[renoise-clip:object_target_b]]", "anchor:material-between"); });
  await expect(editor.locator("[data-clip-id]")).toHaveCount(2);
  await setElementCaret(0, 1);
  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Browse materials" }).click();
  const browser = page.getByRole("dialog", { name: "Select materials" });
  await browser.getByRole("button", { name: /Hero reference/ }).click();
  await browser.getByRole("button", { name: "Confirm (1)" }).click();
  await expect(editor.locator('[data-material-id="101"]')).toHaveCount(1);
  expect(await editor.locator("[data-reference-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.referenceId))).toEqual([
    "annotation:object_target_a", "material:101", "annotation:object_target_b",
  ]);
});

test("mixed range copy preserves text and reference markers in document order", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  await page.evaluate(() => {
    window.__setMaterialPool?.([{ materialId: 101, name: "Hero", type: "image", mimeType: "image/png" }]);
    window.__setHarnessDraft?.("前文 [[renoise-clip:object_target_a]] 中段 [[renoise-material:101]] 后文", "copy:mixed");
  });
  const editor = page.getByLabel("Revision instructions");
  await expect(editor.locator("[data-reference-id]")).toHaveCount(2);
  const copied = await editor.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const clipboardData = new DataTransfer();
    element.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData }));
    return clipboardData.getData("text/plain");
  });
  expect(copied).toBe("前文 [[renoise-clip:object_target_a]] 中段 [[renoise-material:101]] 后文");
});

test("IME composition after an atomic clip stays local until composition commits", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const draft = "修改 [[renoise-clip:object_target_a]]";
  await page.evaluate((value) => window.__setHarnessDraft?.(value, "ime:after-clip"), draft);
  const editor = page.getByLabel("Revision instructions");
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(1);
  await editor.evaluate((root) => {
    (root as HTMLElement).focus();
    const paragraph = root.querySelector(":scope > p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "p" }));
  });
  await page.keyboard.insertText("拼");
  await expect(editor).toContainText("拼");
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__promptDraft)).toBe(draft);
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "拼" })));
  await expect.poll(() => page.evaluate(() => window.__promptDraft)).toBe(`${draft}拼`);
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(1);
});

test("a parent render keeps the clip portal mounted during CJK composition", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const marker = "[[renoise-clip:object_target_a]]";
  await page.evaluate((value) => window.__setHarnessDraft?.(value, "ime:stable-decorator-portal"), marker);
  const editor = page.getByLabel("Revision instructions");
  const clip = editor.locator('[data-clip-id="object_target_a"]');
  await expect(clip).toHaveCount(1);
  await expect(clip.locator("[data-remove-reference]")).toHaveCount(0);
  await clip.evaluate((element) => {
    (window as typeof window & { __clipPortalIdentity?: Element }).__clipPortalIdentity = element;
  });
  await editor.evaluate((root) => {
    (root as HTMLElement).focus();
    const paragraph = root.querySelector(":scope > p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "qing" }));
  });
  await page.keyboard.insertText("q");
  await page.evaluate(() =>
    window.__setMaterialPool?.([
      {
        materialId: 999,
        name: "Force parent render",
        type: "image",
        mimeType: "image/png",
      },
    ]),
  );
  await page.waitForTimeout(50);
  expect(
    await clip.evaluate(
      (element) =>
        (window as typeof window & { __clipPortalIdentity?: Element })
          .__clipPortalIdentity === element,
    ),
  ).toBe(true);
  await expect(editor).toContainText("q");
  await editor.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "请" }),
    ),
  );
});

test("right arrow crosses an atomic clip into an IME-ready caret that can open references", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const marker = "[[renoise-clip:object_target_a]]";
  await page.evaluate((value) => window.__setHarnessDraft?.(value, "ime:arrow-across-clip"), marker);
  const editor = page.getByLabel("Revision instructions");
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(1);
  await editor.evaluate((root) => {
    (root as HTMLElement).focus();
    const paragraph = root.querySelector(":scope > p")!;
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });
  await page.keyboard.insertText("前");
  await expect.poll(() => page.evaluate(() => window.__promptDraft)).toBe(`前${marker}`);

  await editor.press("ArrowRight");
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "hou" })));
  await page.keyboard.insertText("后");
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "后" })));
  await expect.poll(() => page.evaluate(() => window.__promptDraft?.trimEnd())).toBe(`前${marker}后`);
  await expect(editor.locator('[data-clip-id="object_target_a"]')).toHaveCount(1);

  await page.keyboard.type("@");
  await expect(page.getByRole("listbox", { name: "References" })).toBeVisible();
});

test("an arrow pressed before compositionend still resolves to an IME-ready caret after a clip", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const marker = "[[renoise-clip:object_target_a]]";
  await page.evaluate((value) => window.__setHarnessDraft?.(value, "ime:arrow-before-compositionend"), marker);
  const editor = page.getByLabel("Revision instructions");
  const clip = editor.locator('[data-clip-id="object_target_a"]');
  await expect(clip).toHaveCount(1);
  await expect(clip.locator("button, [tabindex]")).toHaveCount(0);
  await editor.evaluate((root) => {
    (root as HTMLElement).focus();
    const paragraph = root.querySelector(":scope > p")!;
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "qian" }));
  });
  await page.keyboard.insertText("前");
  // Match the real macOS ordering: the navigation packet can arrive before
  // React observes compositionend. Navigation must not be gated on the
  // widget's composition ref or race the browser's native selection update.
  await editor.press("ArrowRight");
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "前" })));
  await expect.poll(() => page.evaluate(() => window.__promptDraft?.trimEnd())).toBe(`前${marker}`);

  const caret = await editor.evaluate(() => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    return {
      collapsed: selection?.isCollapsed,
      nodeType: selection?.anchorNode?.nodeType,
      text: selection?.anchorNode?.textContent,
      height: range?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(caret.collapsed).toBe(true);
  expect(caret.nodeType).toBe(3);
  expect(caret.text).toBe(" ");
  expect(caret.height).toBeLessThan(40);

  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "hou" })));
  await page.keyboard.insertText("后");
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "后" })));
  await expect.poll(() => page.evaluate(() => window.__promptDraft?.trimEnd())).toBe(`前${marker}后`);
  await page.keyboard.type("@");
  await expect(page.getByRole("listbox", { name: "References" })).toBeVisible();
});

test("arrow navigation creates an IME text carrier between adjacent clips", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  const first = "[[renoise-clip:object_target_a]]";
  const second = "[[renoise-clip:object_target_b]]";
  await page.evaluate((value) => window.__setHarnessDraft?.(value, "ime:adjacent-clips"), `${first}${second}`);
  const editor = page.getByLabel("Revision instructions");
  await expect(editor.locator("[data-clip-id]")).toHaveCount(2);
  await editor.evaluate((root) => {
    (root as HTMLElement).focus();
    const paragraph = root.querySelector(":scope > p")!;
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });
  await editor.press("ArrowRight");
  const caret = await editor.evaluate(() => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    return {
      nodeType: selection?.anchorNode?.nodeType,
      text: selection?.anchorNode?.textContent,
      height: range?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(caret.nodeType).toBe(3);
  expect(caret.text).toBe(" ");
  expect(caret.height).toBeLessThan(40);
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "zhong" })));
  await page.keyboard.insertText("中");
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "中" })));
  await expect.poll(() => page.evaluate(() => window.__promptDraft)).toBe(`${first} 中${second}`);
});

test("material insertion leaves a line-height text caret that accepts IME immediately", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  await page.evaluate(() => window.__setHarnessDraft?.("", "ime:material-insert"));
  const editor = page.getByLabel("Revision instructions");
  await editor.click();
  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Browse materials" }).click();
  const browser = page.getByRole("dialog", { name: "Select materials" });
  await browser.getByRole("button", { name: /Hero reference/ }).click();
  await browser.getByRole("button", { name: "Confirm (1)" }).click();

  const caret = await editor.evaluate(() => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    return {
      collapsed: selection?.isCollapsed,
      nodeType: selection?.anchorNode?.nodeType,
      text: selection?.anchorNode?.textContent,
      height: range?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(caret.collapsed).toBe(true);
  expect(caret.nodeType).toBe(3);
  expect(caret.text).toBe(" ");
  expect(caret.height).toBeLessThan(40);

  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "ren" })));
  await page.keyboard.insertText("人");
  await editor.evaluate((root) => root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "人" })));
  await expect.poll(() => page.evaluate(() => window.__promptDraft)).toContain("人");
  await page.keyboard.type("@");
  await expect(page.getByRole("listbox", { name: "References" })).toBeVisible();
});

test("a library material keeps its direct preview in both the inline chip and hover card", async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve("features/canvas/widget/tests/composer-target-harness.tsx")], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022" });
  await page.setContent(`<div id="root"></div><script type="module">${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
  await page.evaluate(() => {
    window.__gatewayMaterialPreviewBroken = true;
    window.__setHarnessDraft?.("", "preview:direct-library-url");
  });
  const editor = page.getByLabel("Revision instructions");
  await editor.click();
  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Browse materials" }).click();
  const browser = page.getByRole("dialog", { name: "Select materials" });
  await browser.getByRole("button", { name: /Hero reference/ }).click();
  await browser.getByRole("button", { name: "Confirm (1)" }).click();

  const chip = editor.locator('[data-material-id="101"]');
  await expect.poll(() => chip.locator(".intent-chip-preview img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await chip.hover();
  const tooltip = page.getByRole("tooltip");
  await expect.poll(() => tooltip.getByRole("img", { name: "Hero reference" }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
});
