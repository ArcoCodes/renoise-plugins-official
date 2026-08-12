import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./widget/tests",
  outputDir: "./test-results",
  reporter: "line",
  timeout: 15_000,
  expect: { timeout: 5_000 },
  use: {
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    viewport: { width: 1024, height: 700 },
    reducedMotion: "reduce",
  },
});
