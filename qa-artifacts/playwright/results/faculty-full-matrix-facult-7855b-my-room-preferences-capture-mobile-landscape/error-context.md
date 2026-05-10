# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: faculty-full-matrix.spec.ts >> faculty full matrix (logged-in) >> faculty /my/room-preferences capture
- Location: qa-artifacts\playwright\specs\faculty-full-matrix.spec.ts:41:9

# Error details

```
Error: locator.fill: Error: strict mode violation: getByLabel(/password/i) resolved to 2 elements:
    1) <input value="" required="" id="password" type="password" autocomplete="current-password" placeholder="Enter your password" data-testid="login-password-input" class="flex w-full border px-3 py-1 text-sm shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-12 pr-11 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ri…/> aka getByTestId('login-password-input')
    2) <button type="button" aria-label="Show password" class="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-de…>…</button> aka getByRole('button', { name: 'Show password' })

Call log:
  - waiting for getByLabel(/password/i)

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "HNHS" [ref=e8]
      - generic [ref=e9]:
        - text: HNH
        - paragraph [ref=e10]: HNHS
    - generic [ref=e11]:
      - generic [ref=e12]:
        - img "HNHS" [ref=e14]
        - generic [ref=e15]: Welcome Back
        - generic [ref=e16]: Sign in to continue to ATLAS Scheduling System
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]:
            - text: Email
            - generic [ref=e20]:
              - generic:
                - generic:
                  - img
              - textbox "Email" [active] [ref=e21]:
                - /placeholder: Enter your email
                - text: maria.santos@deped.edu.ph
          - generic [ref=e22]:
            - text: Password
            - generic [ref=e23]:
              - generic:
                - generic:
                  - img
              - textbox "Password" [ref=e24]:
                - /placeholder: Enter your password
              - button "Show password" [ref=e25]:
                - img
          - generic [ref=e26]:
            - generic [ref=e27] [cursor=pointer]:
              - checkbox "Remember me" [ref=e28]
              - generic [ref=e29]: Remember me
            - link "Forgot password?" [ref=e30] [cursor=pointer]:
              - /url: "#"
          - button "Sign In" [ref=e31]:
            - generic [ref=e32]:
              - img
              - text: Sign In
          - generic [ref=e33]:
            - generic [ref=e37]: Or continue with
            - generic "Continue with Google" [ref=e38]: Google sign-in button unavailable
            - status [ref=e39]: Google sign-in is not configured for this environment.
        - paragraph [ref=e40]:
          - text: By signing in, you agree to our
          - link "Terms" [ref=e41] [cursor=pointer]:
            - /url: "#"
          - text: and
          - link "Privacy Policy" [ref=e42] [cursor=pointer]:
            - /url: "#"
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
  24 |   await page.goto("/login", { waitUntil: "networkidle" });
  25 |   await page.getByLabel(/email/i).fill(credentials.email);
> 26 |   await page.getByLabel(/password/i).fill(credentials.password);
     |                                      ^ Error: locator.fill: Error: strict mode violation: getByLabel(/password/i) resolved to 2 elements:
  27 |   await page.getByRole("button", { name: /sign in|log in|login/i }).first().click();
  28 |   await page.waitForURL(/\/(my|dashboard|faculty|schedule|subjects)/i, { timeout: 25_000 });
  29 | }
  30 | 
  31 | const shouldAssertSnapshots =
  32 |   process.env.PLAYWRIGHT_ASSERT_SNAPSHOTS === "1";
  33 | 
  34 | test.describe("faculty full matrix (logged-in)", () => {
  35 |   test.beforeEach(async ({ page }) => {
  36 |     await page.context().clearCookies();
  37 |     await loginFaculty(page);
  38 |   });
  39 | 
  40 |   for (const route of FACULTY_ROUTES) {
  41 |     test(`faculty ${route.path} capture`, async ({ page }, testInfo) => {
  42 |       await page.goto(route.path, { waitUntil: "networkidle", timeout: 60_000 });
  43 | 
  44 |       const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  45 |       const viewport = testInfo.project.name;
  46 |       const outDir = path.join(
  47 |         process.cwd(),
  48 |         "qa-artifacts",
  49 |         "screenshots",
  50 |         "faculty-ux-refactor",
  51 |       );
  52 |       fs.mkdirSync(outDir, { recursive: true });
  53 | 
  54 |       const fileName = `${date}-faculty-${route.slug}-${viewport}-landing.png`;
  55 |       await page.screenshot({
  56 |         path: path.join(outDir, fileName),
  57 |         fullPage: true,
  58 |       });
  59 | 
  60 |       if (shouldAssertSnapshots) {
  61 |         const snapshotName = `faculty-${route.slug}-${viewport}.png`;
  62 |         await expect(page).toHaveScreenshot(snapshotName, {
  63 |           fullPage: true,
  64 |         });
  65 |       }
  66 |     });
  67 |   }
  68 | });
  69 | 
```