import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./qa-artifacts/playwright/specs",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "qa-artifacts/playwright/report", open: "never" }],
  ],
  outputDir: "qa-artifacts/playwright/results",
  snapshotPathTemplate: "qa-artifacts/playwright/snapshots/{testFilePath}/{projectName}/{arg}{ext}",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "mobile-portrait",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-landscape",
      use: {
        ...devices["Pixel 7 landscape"],
        viewport: { width: 844, height: 390 },
      },
    },
  ],
});
