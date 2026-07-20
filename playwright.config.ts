import { defineConfig, devices } from "@playwright/test";

const dateStr = new Date().toISOString().split('T')[0];

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
    ["html", { outputFolder: `qa-artifacts/perf-runs/${dateStr}/report`, open: "never" }],
  ],
  outputDir: `qa-artifacts/perf-runs/${dateStr}/results`,
  snapshotPathTemplate: `qa-artifacts/perf-runs/${dateStr}/snapshots/{testFilePath}/{projectName}/{arg}{ext}`,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://njgrm.buru-degree.ts.net",
    trace: "retain-on-failure",
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
