import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("self-contained widget boots into a compact, inert review launcher without external assets", async ({ page }) => {
  const errors: Error[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) externalRequests.push(request.url());
  });
  const html = await readFile(resolve("features/canvas/dist/widget.html"), "utf8");
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Renoise 标注板" })).toBeVisible();
  await expect(page.getByRole("button", { name: "批准并打开标注板" })).toBeDisabled();
  await expect(page.locator(".review-project code")).toContainText("等待项目目录");
  await expect(page.locator(".review-launcher-card")).toHaveScreenshot("review-launcher-card.png");
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});
