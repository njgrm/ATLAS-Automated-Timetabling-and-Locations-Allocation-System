# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timetable-preview-smoke.spec.ts >> timetable preview smoke >> captures matrix surface
- Location: qa-artifacts\playwright\specs\timetable-preview-smoke.spec.ts:120:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import fs from "node:fs";
  3   | import path from "node:path";
  4   | 
  5   | const credentials = {
  6   |   email: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@deped.edu.ph",
  7   |   password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Incorrect_404",
  8   | };
  9   | 
  10  | const shouldAssertSnapshots = process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";
  11  | const screenshotRoot = path.join(process.cwd(), "qa-artifacts", "screenshots", "timetable-preview-smoke");
  12  | 
  13  | async function loginAdmin(page: Page) {
  14  |   const response = await page.request.post("http://localhost:5001/api/v1/auth/login", {
  15  |     data: credentials,
  16  |   });
> 17  |   expect(response.ok()).toBeTruthy();
      |                         ^ Error: expect(received).toBeTruthy()
  18  |   const payload = await response.json() as { token?: string };
  19  |   if (!payload.token) {
  20  |     throw new Error("Admin login API did not return a token.");
  21  |   }
  22  |   await page.addInitScript((token) => {
  23  |     sessionStorage.setItem("atlas_local_token", token);
  24  |   }, payload.token);
  25  | }
  26  | 
  27  | async function captureMatrixSurface(page: Page, viewport: string) {
  28  |   await page.goto("/timetable", { waitUntil: "domcontentloaded", timeout: 60_000 });
  29  |   const skipButton = page.getByRole("button", { name: /^Skip$/i });
  30  |   await skipButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  31  |   if (await skipButton.isVisible().catch(() => false)) {
  32  |     await skipButton.click({ force: true });
  33  |   }
  34  | 
  35  |   const continueDraftButton = page.getByRole("button", { name: /^Continue Draft$/i });
  36  |   if (await continueDraftButton.isVisible().catch(() => false)) {
  37  |     await continueDraftButton.click({ force: true });
  38  |   } else {
  39  |     const newDraftButton = page.getByRole("button", { name: /^New Pre-Generation Draft$/i });
  40  |     if (await newDraftButton.isVisible().catch(() => false)) {
  41  |       await newDraftButton.click({ force: true });
  42  |     }
  43  |   }
  44  |   await page.getByText(/Pre-Generation Draft/i).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  45  |   const backToGeneratedRunButton = page.getByRole("button", { name: /^Back to Generated Run$/i });
  46  |   await backToGeneratedRunButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  47  |   if (await backToGeneratedRunButton.isVisible().catch(() => false)) {
  48  |     await backToGeneratedRunButton.click({ force: true });
  49  |   }
  50  |   await page.getByRole("button", { name: /^Workflow$/i }).waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  51  | 
  52  |   await page.getByRole("button", { name: "Class Program Matrix" }).click();
  53  |   await page.getByText(/(Pre-Generation|Generated) Matrix/i).first().waitFor({ state: "visible", timeout: 15_000 });
  54  | 
  55  |   const outDir = path.join(screenshotRoot, "matrix");
  56  |   fs.mkdirSync(outDir, { recursive: true });
  57  |   const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  58  |   const fileName = `${date}-timetable-matrix-${viewport}.png`;
  59  |   await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  60  | 
  61  |   if (shouldAssertSnapshots) {
  62  |     await expect(page).toHaveScreenshot(`timetable-matrix-${viewport}.png`, { fullPage: true });
  63  |   }
  64  | }
  65  | 
  66  | async function findRoomWithOccupancyPreview(page: Page): Promise<string> {
  67  |   const buildingsResponse = await page.request.get("/api/v1/map/schools/1/buildings");
  68  |   expect(buildingsResponse.ok()).toBeTruthy();
  69  | 
  70  |   const payload = await buildingsResponse.json() as { buildings?: Array<{ rooms?: Array<{ id: number; isTeachingSpace?: boolean }> }> };
  71  |   const roomIds = (payload.buildings ?? [])
  72  |     .flatMap((building) => building.rooms ?? [])
  73  |     .filter((room) => room.isTeachingSpace !== false)
  74  |     .map((room) => String(room.id));
  75  | 
  76  |   if (roomIds.length === 0) {
  77  |     throw new Error("No teaching rooms were returned from the buildings endpoint.");
  78  |   }
  79  | 
  80  |   for (const roomId of roomIds) {
  81  |     await page.goto(`/room-schedules?roomId=${roomId}&source=latest`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  82  |     const skipButton = page.getByRole("button", { name: /^Skip$/i });
  83  |     await skipButton.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
  84  |     if (await skipButton.isVisible().catch(() => false)) {
  85  |       await skipButton.click({ force: true });
  86  |     }
  87  |     await page.getByRole("button", { name: "Occupancy Preview" }).click();
  88  |     const preview = page.getByText(/occupancy template/i).first();
  89  |     try {
  90  |       await preview.waitFor({ state: "visible", timeout: 8_000 });
  91  |       return roomId;
  92  |     } catch {
  93  |       continue;
  94  |     }
  95  |   }
  96  | 
  97  |   throw new Error("Unable to find a room with a loaded occupancy preview.");
  98  | }
  99  | 
  100 | async function captureOccupancySurface(page: Page, viewport: string) {
  101 |   const roomId = await findRoomWithOccupancyPreview(page);
  102 |   const outDir = path.join(screenshotRoot, "occupancy");
  103 |   fs.mkdirSync(outDir, { recursive: true });
  104 | 
  105 |   const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  106 |   const fileName = `${date}-room-occupancy-${viewport}-room-${roomId}.png`;
  107 |   await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  108 | 
  109 |   if (shouldAssertSnapshots) {
  110 |     await expect(page).toHaveScreenshot(`room-occupancy-${viewport}-room-${roomId}.png`, { fullPage: true });
  111 |   }
  112 | }
  113 | 
  114 | test.describe("timetable preview smoke", () => {
  115 |   test.beforeEach(async ({ page }) => {
  116 |     await page.context().clearCookies();
  117 |     await loginAdmin(page);
```