# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: faculty-full-matrix.spec.ts >> faculty full matrix (logged-in) >> faculty /my/room-preferences capture
- Location: qa-artifacts\playwright\specs\faculty-full-matrix.spec.ts:47:9

# Error details

```
Error: A snapshot doesn't exist at D:\ATLAS\qa-artifacts\playwright\snapshots\faculty-full-matrix.spec.ts\desktop\faculty-room-preferences-desktop.png, writing actual.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "Unexpected Application Error!" [level=2] [ref=e3]
  - heading "useSearchParams is not defined" [level=3] [ref=e4]
  - generic [ref=e5]: "ReferenceError: useSearchParams is not defined at FacultyRoomPreferences (http://127.0.0.1:5174/src/pages/FacultyRoomPreferences.tsx:176:25) at Object.react_stack_bottom_frame (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:12621:12) at renderWithHooks (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:3966:19) at updateFunctionComponent (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:5322:16) at beginWork (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:5873:628) at runWithFiberInDEV (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:604:66) at performUnitOfWork (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:8182:92) at workLoopSync (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:8078:37) at renderRootSync (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:8062:6) at performWorkOnRoot (http://127.0.0.1:5174/node_modules/.vite/deps/react-dom_client.js?v=06d4aae8:7747:27)"
  - paragraph [ref=e6]: 💿 Hey developer 👋
  - paragraph [ref=e7]:
    - text: You can provide a way better UX than this when your app throws errors by providing your own
    - code [ref=e8]: ErrorBoundary
    - text: or
    - code [ref=e9]: errorElement
    - text: prop on your route.
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
     |         ^ Error: A snapshot doesn't exist at D:\ATLAS\qa-artifacts\playwright\snapshots\faculty-full-matrix.spec.ts\desktop\faculty-room-preferences-desktop.png, writing actual.
  69 |           fullPage: true,
  70 |         });
  71 |       }
  72 |     });
  73 |   }
  74 | });
  75 | 
```