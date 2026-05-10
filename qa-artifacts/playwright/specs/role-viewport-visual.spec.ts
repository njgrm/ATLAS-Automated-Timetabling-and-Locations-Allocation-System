import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type RoleTarget = {
  role: "guest" | "faculty" | "admin";
  route: string;
  requiresLogin: boolean;
};

const roleTargets: RoleTarget[] = [
  { role: "guest", route: "/login", requiresLogin: false },
  { role: "faculty", route: "/my", requiresLogin: true },
  { role: "admin", route: "/dashboard", requiresLogin: true },
];

const enabledRoles = new Set(
  (process.env.PLAYWRIGHT_TARGET_ROLES ?? "guest,faculty,admin")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean),
);
const shouldAssertSnapshots = process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";

const credentials = {
  faculty: {
    email: process.env.PLAYWRIGHT_FACULTY_EMAIL ?? "maria.santos@deped.edu.ph",
    password: process.env.PLAYWRIGHT_FACULTY_PASSWORD ?? "DepEd2026!",
  },
  admin: {
    email: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@deped.edu.ph",
    password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Incorrect_404",
  },
};

async function login(page: Page, role: "faculty" | "admin") {
  const creds = credentials[role];
  const response = await page.request.post("http://localhost:5001/api/v1/auth/login", {
    data: creds,
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { token?: string };
  if (!payload.token) {
    throw new Error(`Login API did not return a token for ${role}.`);
  }
  await page.addInitScript((token) => {
    sessionStorage.setItem("atlas_local_token", token);
  }, payload.token);
}

test.describe("role-viewport visual matrix", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  for (const target of roleTargets) {
    if (!enabledRoles.has(target.role)) {
      continue;
    }

    test(`${target.role} ${target.route} screenshot`, async ({ page }, testInfo) => {
      if (target.requiresLogin && target.role !== "guest") {
        await login(page, target.role);
      }

      await page.goto(target.route, { waitUntil: "networkidle" });

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const viewport = testInfo.project.name;
      const routeName = target.route.replace(/\//g, "-").replace(/^-+/, "") || "root";
      const screenshotsDir = path.join(process.cwd(), "qa-artifacts", "screenshots", "visual-regression");

      fs.mkdirSync(screenshotsDir, { recursive: true });

      const fileName = `${date}-${target.role}-${routeName}-${viewport}-baseline.png`;
      await page.screenshot({
        path: path.join(screenshotsDir, fileName),
        fullPage: true,
      });

      if (shouldAssertSnapshots) {
        const snapshotName = `${target.role}-${routeName}-${viewport}.png`;
        await expect(page).toHaveScreenshot(snapshotName, {
          fullPage: true,
        });
      }
    });
  }
});
