# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: faculty-full-matrix.spec.ts >> faculty full matrix (logged-in) >> faculty /my capture
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
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e10]:
        - generic [ref=e12]:
          - heading "HNH" [level=1] [ref=e13]
          - paragraph [ref=e14]: ATLAS Scheduling System
        - generic [ref=e15]:
          - heading "HNHS" [level=2] [ref=e16]
          - paragraph [ref=e17]: Junior High School (Grades 7-10)
          - paragraph [ref=e19]: DepEd Public School Timetabling and Schedule Publishing Portal
        - generic [ref=e20]:
          - generic [ref=e21]:
            - img [ref=e23]
            - generic [ref=e25]:
              - heading "Preference Collection" [level=3] [ref=e26]
              - paragraph [ref=e27]: Collect faculty time and room preferences before generation.
          - generic [ref=e28]:
            - img [ref=e30]
            - generic [ref=e32]:
              - heading "Automated Generation" [level=3] [ref=e33]
              - paragraph [ref=e34]: Build draft timetables with policy and workload-aware scheduling.
          - generic [ref=e35]:
            - img [ref=e37]
            - generic [ref=e39]:
              - heading "Review and Publish Workflow" [level=3] [ref=e40]
              - paragraph [ref=e41]: Validate violations, resolve conflicts, and publish approved schedules.
      - generic [ref=e42]:
        - img [ref=e44]
        - generic [ref=e46]: ATLAS Scheduling System
    - generic [ref=e49]:
      - generic [ref=e50]:
        - img "HNHS" [ref=e52]
        - generic [ref=e53]: Welcome Back
        - generic [ref=e54]: Sign in to continue to ATLAS Scheduling System
      - generic [ref=e55]:
        - generic [ref=e56]:
          - generic [ref=e57]:
            - text: Email
            - generic [ref=e58]:
              - generic:
                - generic:
                  - img
              - textbox "Email" [active] [ref=e59]:
                - /placeholder: Enter your email
                - text: maria.santos@deped.edu.ph
          - generic [ref=e60]:
            - text: Password
            - generic [ref=e61]:
              - generic:
                - generic:
                  - img
              - textbox "Password" [ref=e62]:
                - /placeholder: Enter your password
              - button "Show password" [ref=e63]:
                - img
          - generic [ref=e64]:
            - generic [ref=e65] [cursor=pointer]:
              - checkbox "Remember me" [ref=e66]
              - generic [ref=e67]: Remember me
            - link "Forgot password?" [ref=e68] [cursor=pointer]:
              - /url: "#"
          - button "Sign In" [ref=e69]:
            - generic [ref=e70]:
              - img
              - text: Sign In
          - generic [ref=e71]:
            - generic [ref=e75]: Or continue with
            - generic "Continue with Google" [ref=e76]: Google sign-in button unavailable
            - status [ref=e77]: Google sign-in is not configured for this environment.
        - paragraph [ref=e78]:
          - text: By signing in, you agree to our
          - link "Terms" [ref=e79] [cursor=pointer]:
            - /url: "#"
          - text: and
          - link "Privacy Policy" [ref=e80] [cursor=pointer]:
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