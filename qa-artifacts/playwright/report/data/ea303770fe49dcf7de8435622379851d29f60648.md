# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: role-viewport-visual.spec.ts >> role-viewport visual matrix >> admin /dashboard screenshot
- Location: qa-artifacts\playwright\specs\role-viewport-visual.spec.ts:61:9

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | import fs from "node:fs";
  3  | import path from "node:path";
  4  | 
  5  | type RoleTarget = {
  6  |   role: "guest" | "faculty" | "admin";
  7  |   route: string;
  8  |   requiresLogin: boolean;
  9  | };
  10 | 
  11 | const roleTargets: RoleTarget[] = [
  12 |   { role: "guest", route: "/login", requiresLogin: false },
  13 |   { role: "faculty", route: "/my", requiresLogin: true },
  14 |   { role: "admin", route: "/dashboard", requiresLogin: true },
  15 | ];
  16 | 
  17 | const enabledRoles = new Set(
  18 |   (process.env.PLAYWRIGHT_TARGET_ROLES ?? "guest,faculty,admin")
  19 |     .split(",")
  20 |     .map((role) => role.trim())
  21 |     .filter(Boolean),
  22 | );
  23 | const shouldAssertSnapshots = process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";
  24 | 
  25 | const credentials = {
  26 |   faculty: {
  27 |     email: process.env.PLAYWRIGHT_FACULTY_EMAIL ?? "maria.santos@deped.edu.ph",
  28 |     password: process.env.PLAYWRIGHT_FACULTY_PASSWORD ?? "DepEd2026!",
  29 |   },
  30 |   admin: {
  31 |     email: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@deped.edu.ph",
  32 |     password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Incorrect_404",
  33 |   },
  34 | };
  35 | 
  36 | async function login(page: Page, role: "faculty" | "admin") {
  37 |   const creds = credentials[role];
  38 |   const response = await page.request.post("http://localhost:5001/api/v1/auth/login", {
  39 |     data: creds,
  40 |   });
> 41 |   expect(response.ok()).toBeTruthy();
     |                         ^ Error: expect(received).toBeTruthy()
  42 |   const payload = await response.json() as { token?: string };
  43 |   if (!payload.token) {
  44 |     throw new Error(`Login API did not return a token for ${role}.`);
  45 |   }
  46 |   await page.addInitScript((token) => {
  47 |     sessionStorage.setItem("atlas_local_token", token);
  48 |   }, payload.token);
  49 | }
  50 | 
  51 | test.describe("role-viewport visual matrix", () => {
  52 |   test.beforeEach(async ({ page }) => {
  53 |     await page.context().clearCookies();
  54 |   });
  55 | 
  56 |   for (const target of roleTargets) {
  57 |     if (!enabledRoles.has(target.role)) {
  58 |       continue;
  59 |     }
  60 | 
  61 |     test(`${target.role} ${target.route} screenshot`, async ({ page }, testInfo) => {
  62 |       if (target.requiresLogin && target.role !== "guest") {
  63 |         await login(page, target.role);
  64 |       }
  65 | 
  66 |       await page.goto(target.route, { waitUntil: "networkidle" });
  67 | 
  68 |       const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  69 |       const viewport = testInfo.project.name;
  70 |       const routeName = target.route.replace(/\//g, "-").replace(/^-+/, "") || "root";
  71 |       const screenshotsDir = path.join(process.cwd(), "qa-artifacts", "screenshots", "visual-regression");
  72 | 
  73 |       fs.mkdirSync(screenshotsDir, { recursive: true });
  74 | 
  75 |       const fileName = `${date}-${target.role}-${routeName}-${viewport}-baseline.png`;
  76 |       await page.screenshot({
  77 |         path: path.join(screenshotsDir, fileName),
  78 |         fullPage: true,
  79 |       });
  80 | 
  81 |       if (shouldAssertSnapshots) {
  82 |         const snapshotName = `${target.role}-${routeName}-${viewport}.png`;
  83 |         await expect(page).toHaveScreenshot(snapshotName, {
  84 |           fullPage: true,
  85 |         });
  86 |       }
  87 |     });
  88 |   }
  89 | });
  90 | 
```