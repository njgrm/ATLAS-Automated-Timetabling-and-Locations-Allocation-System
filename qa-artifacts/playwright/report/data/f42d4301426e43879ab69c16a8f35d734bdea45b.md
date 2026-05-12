# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: faculty-full-matrix.spec.ts >> faculty full matrix (logged-in) >> faculty /my capture
- Location: qa-artifacts\playwright\specs\faculty-full-matrix.spec.ts:47:9

# Error details

```
Error: A snapshot doesn't exist at D:\ATLAS\qa-artifacts\playwright\snapshots\faculty-full-matrix.spec.ts\desktop\faculty-my-desktop.png, writing actual.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e7]:
      - list [ref=e9]:
        - listitem [ref=e10]:
          - button "No Active Year" [ref=e11]:
            - img [ref=e13]
            - generic [ref=e20]:
              - img [ref=e21]
              - generic [ref=e23]: No Active Year
      - list [ref=e28]:
        - generic [ref=e29]: Navigation
        - generic [ref=e30]: My Portal
        - listitem [ref=e31]:
          - link "My Dashboard" [ref=e32] [cursor=pointer]:
            - /url: /my
            - img [ref=e33]
            - generic [ref=e38]: My Dashboard
        - listitem [ref=e39]:
          - link "My Preferences" [ref=e40] [cursor=pointer]:
            - /url: /my/preferences
            - img [ref=e41]
            - generic [ref=e44]: My Preferences
        - listitem [ref=e45]:
          - link "My Room Requests" [ref=e46] [cursor=pointer]:
            - /url: /my/room-preferences
            - img [ref=e47]
            - generic [ref=e49]: My Room Requests
        - generic [ref=e50]: Platform
        - listitem [ref=e51]:
          - link "Back to EnrollPro" [ref=e52] [cursor=pointer]:
            - /url: http://dev-jegs.buru-degree.ts.net:5173/dashboard
            - img [ref=e53]
            - generic [ref=e57]: Back to EnrollPro
      - list [ref=e59]:
        - listitem [ref=e60]:
          - button "F faculty Faculty" [ref=e61]:
            - img [ref=e63]
            - generic [ref=e66]:
              - generic [ref=e68]: F
              - generic [ref=e69]:
                - generic [ref=e70]: faculty
                - generic [ref=e71]: Faculty
              - img [ref=e72]
    - main [ref=e75]:
      - generic [ref=e76]:
        - button "Toggle Sidebar" [ref=e77]:
          - img
          - generic [ref=e78]: Toggle Sidebar
        - navigation "breadcrumb" [ref=e79]:
          - list [ref=e80]:
            - listitem [ref=e81]:
              - link "ATLAS" [ref=e82] [cursor=pointer]:
                - /url: /
            - listitem [ref=e83]:
              - img [ref=e84]
            - listitem [ref=e86]:
              - generic [ref=e87]: My Portal
            - listitem [ref=e88]:
              - img [ref=e89]
            - listitem [ref=e91]:
              - link "My Dashboard" [disabled] [ref=e92]
        - button "Accessibility options" [ref=e95]:
          - img
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | /**
  2  |  * Full faculty route screenshot matrix for UX hardening / gate evidence.
  3  |  * Run: npm run test:visual:faculty (with app running on PLAYWRIGHT_BASE_URL)
  4  |  *
  5  |  * Screenshots land in qa-artifacts/screenshots/faculty-ux-refactor/
  6  |  * Naming: YYYYMMDD-faculty-{route}-{viewport}-landing.png
  7  |  */
  8  | import { expect, test, type Page } from "@playwright/test";
  9  | import fs from "node:fs";
  10 | import path from "node:path";
  11 | 
  12 | const FACULTY_ROUTES: { path: string; slug: string }[] = [
  13 |   { path: "/my", slug: "my" },
  14 |   { path: "/my/preferences", slug: "preferences" },
  15 |   { path: "/my/room-preferences", slug: "room-preferences" },
  16 | ];
  17 | 
  18 | const credentials = {
  19 |   email: process.env.PLAYWRIGHT_FACULTY_EMAIL ?? "maria.santos@deped.edu.ph",
  20 |   password: process.env.PLAYWRIGHT_FACULTY_PASSWORD ?? "DepEd2026!",
  21 | };
  22 | 
  23 | async function loginFaculty(page: Page) {
  24 |   const response = await page.request.post("http://localhost:5001/api/v1/auth/login", {
  25 |     data: credentials,
  26 |   });
  27 |   expect(response.ok()).toBeTruthy();
  28 |   const payload = await response.json() as { token?: string };
  29 |   if (!payload.token) {
  30 |     throw new Error("Faculty login API did not return a token.");
  31 |   }
  32 |   await page.addInitScript((token) => {
  33 |     sessionStorage.setItem("atlas_local_token", token);
  34 |   }, payload.token);
  35 | }
  36 | 
  37 | const shouldAssertSnapshots =
  38 |   process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";
  39 | 
  40 | test.describe("faculty full matrix (logged-in)", () => {
  41 |   test.beforeEach(async ({ page }) => {
  42 |     await page.context().clearCookies();
  43 |     await loginFaculty(page);
  44 |   });
  45 | 
  46 |   for (const route of FACULTY_ROUTES) {
  47 |     test(`faculty ${route.path} capture`, async ({ page }, testInfo) => {
  48 |       await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  49 | 
  50 |       const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  51 |       const viewport = testInfo.project.name;
  52 |       const outDir = path.join(
  53 |         process.cwd(),
  54 |         "qa-artifacts",
  55 |         "screenshots",
  56 |         "faculty-ux-refactor",
  57 |       );
  58 |       fs.mkdirSync(outDir, { recursive: true });
  59 | 
  60 |       const fileName = `${date}-faculty-${route.slug}-${viewport}-landing.png`;
  61 |       await page.screenshot({
  62 |         path: path.join(outDir, fileName),
  63 |         fullPage: true,
  64 |       });
  65 | 
  66 |       if (shouldAssertSnapshots) {
  67 |         const snapshotName = `faculty-${route.slug}-${viewport}.png`;
> 68 |         await expect(page).toHaveScreenshot(snapshotName, {
     |         ^ Error: A snapshot doesn't exist at D:\ATLAS\qa-artifacts\playwright\snapshots\faculty-full-matrix.spec.ts\desktop\faculty-my-desktop.png, writing actual.
  69 |           fullPage: true,
  70 |         });
  71 |       }
  72 |     });
  73 |   }
  74 | });
  75 | 
```