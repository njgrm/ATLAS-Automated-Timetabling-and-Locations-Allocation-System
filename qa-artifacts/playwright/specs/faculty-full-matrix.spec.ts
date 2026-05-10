/**
 * Full faculty route screenshot matrix for UX hardening / gate evidence.
 * Run: npm run test:visual:faculty (with app running on PLAYWRIGHT_BASE_URL)
 *
 * Screenshots land in qa-artifacts/screenshots/faculty-ux-refactor/
 * Naming: YYYYMMDD-faculty-{route}-{viewport}-landing.png
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const FACULTY_ROUTES: { path: string; slug: string }[] = [
  { path: "/my", slug: "my" },
  { path: "/my/preferences", slug: "preferences" },
  { path: "/my/room-preferences", slug: "room-preferences" },
];

const credentials = {
  email: process.env.PLAYWRIGHT_FACULTY_EMAIL ?? "maria.santos@deped.edu.ph",
  password: process.env.PLAYWRIGHT_FACULTY_PASSWORD ?? "DepEd2026!",
};

async function loginFaculty(page: Page) {
  const response = await page.request.post("http://localhost:5001/api/v1/auth/login", {
    data: credentials,
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { token?: string };
  if (!payload.token) {
    throw new Error("Faculty login API did not return a token.");
  }
  await page.addInitScript((token) => {
    sessionStorage.setItem("atlas_local_token", token);
  }, payload.token);
}

const shouldAssertSnapshots =
  process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";

test.describe("faculty full matrix (logged-in)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginFaculty(page);
  });

  for (const route of FACULTY_ROUTES) {
    test(`faculty ${route.path} capture`, async ({ page }, testInfo) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 60_000 });

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const viewport = testInfo.project.name;
      const outDir = path.join(
        process.cwd(),
        "qa-artifacts",
        "screenshots",
        "faculty-ux-refactor",
      );
      fs.mkdirSync(outDir, { recursive: true });

      const fileName = `${date}-faculty-${route.slug}-${viewport}-landing.png`;
      await page.screenshot({
        path: path.join(outDir, fileName),
        fullPage: true,
      });

      if (shouldAssertSnapshots) {
        const snapshotName = `faculty-${route.slug}-${viewport}.png`;
        await expect(page).toHaveScreenshot(snapshotName, {
          fullPage: true,
        });
      }
    });
  }
});
