import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const credentials = {
  identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "1000001",
  password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "AdminSY2026!",
};

const shouldAssertSnapshots = process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";
const screenshotRoot = path.join(process.cwd(), "qa-artifacts", "screenshots", "timetable-preview-smoke");

async function loginAdmin(page: Page) {
  const response = await page.request.post("/api/v1/auth/login", {
    data: credentials,
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { token?: string };
  if (!payload.token) {
    throw new Error("Admin login API did not return a token.");
  }
  await page.addInitScript((token) => {
    sessionStorage.setItem("atlas_local_token", token);
  }, payload.token);
}

async function captureMatrixSurface(page: Page, viewport: string) {
  await page.goto("/timetable", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const skipButton = page.getByRole("button", { name: /^Skip$/i });
  await skipButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click({ force: true });
  }

  const continueDraftButton = page.getByRole("button", { name: /^Continue Draft$/i });
  if (await continueDraftButton.isVisible().catch(() => false)) {
    await continueDraftButton.click({ force: true });
  } else {
    const newDraftButton = page.getByRole("button", { name: /^New Pre-Generation Draft$/i });
    if (await newDraftButton.isVisible().catch(() => false)) {
      await newDraftButton.click({ force: true });
    }
  }
  await page.getByText(/Pre-Generation Draft/i).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const backToGeneratedRunButton = page.getByRole("button", { name: /^Back to Generated Run$/i });
  await backToGeneratedRunButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (await backToGeneratedRunButton.isVisible().catch(() => false)) {
    await backToGeneratedRunButton.click({ force: true });
  }
  await page.getByRole("button", { name: /^Workflow$/i }).waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

  await page.getByRole("button", { name: "Class Program Matrix" }).click();
  await page.getByText(/(Pre-Generation|Generated) Matrix/i).first().waitFor({ state: "visible", timeout: 15_000 });

  const outDir = path.join(screenshotRoot, "matrix");
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fileName = `${date}-timetable-matrix-${viewport}.png`;
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });

  if (shouldAssertSnapshots) {
    await expect(page).toHaveScreenshot(`timetable-matrix-${viewport}.png`, { fullPage: true });
  }
}

async function findRoomWithOccupancyPreview(page: Page): Promise<string> {
  const buildingsResponse = await page.request.get("/api/v1/map/schools/1/buildings");
  expect(buildingsResponse.ok()).toBeTruthy();

  const payload = await buildingsResponse.json() as { buildings?: Array<{ rooms?: Array<{ id: number; isTeachingSpace?: boolean }> }> };
  const roomIds = (payload.buildings ?? [])
    .flatMap((building) => building.rooms ?? [])
    .filter((room) => room.isTeachingSpace !== false)
    .map((room) => String(room.id));

  if (roomIds.length === 0) {
    throw new Error("No teaching rooms were returned from the buildings endpoint.");
  }

  for (const roomId of roomIds) {
    await page.goto(`/room-schedules?roomId=${roomId}&source=latest`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const skipButton = page.getByRole("button", { name: /^Skip$/i });
    await skipButton.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ force: true });
    }
    await page.getByRole("button", { name: "Occupancy Preview" }).click();
    const preview = page.getByText(/occupancy template/i).first();
    try {
      await preview.waitFor({ state: "visible", timeout: 8_000 });
      return roomId;
    } catch {
      continue;
    }
  }

  throw new Error("Unable to find a room with a loaded occupancy preview.");
}

async function captureOccupancySurface(page: Page, viewport: string) {
  const roomId = await findRoomWithOccupancyPreview(page);
  const outDir = path.join(screenshotRoot, "occupancy");
  fs.mkdirSync(outDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fileName = `${date}-room-occupancy-${viewport}-room-${roomId}.png`;
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });

  if (shouldAssertSnapshots) {
    await expect(page).toHaveScreenshot(`room-occupancy-${viewport}-room-${roomId}.png`, { fullPage: true });
  }
}

test.describe("timetable preview smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAdmin(page);
  });

  test("captures matrix surface", async ({ page }, testInfo) => {
    await captureMatrixSurface(page, testInfo.project.name);
  });

  test("captures occupancy surface", async ({ page }, testInfo) => {
    await captureOccupancySurface(page, testInfo.project.name);
  });
});
