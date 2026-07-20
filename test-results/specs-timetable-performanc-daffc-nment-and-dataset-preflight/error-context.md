# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs\timetable-performance.spec.ts >> Timetable Performance Scenarios >> 1. Environment and dataset preflight
- Location: specs\timetable-performance.spec.ts:95:7

# Error details

```
TypeError: apiRequestContext.post: Invalid URL
```

# Test source

```ts
  1   | import { expect, test, type Page, type TestInfo } from '@playwright/test';
  2   | import fs from 'node:fs';
  3   | import path from 'node:path';
  4   | 
  5   | if (!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD) {
  6   |   throw new Error('Missing required PLAYWRIGHT_ADMIN_EMAIL or PLAYWRIGHT_ADMIN_PASSWORD environment variables');
  7   | }
  8   | 
  9   | const credentials = {
  10  |   email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
  11  |   password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
  12  | };
  13  | 
  14  | async function loginAdmin(page: Page) {
> 15  |   const response = await page.request.post('/api/v1/auth/login', { data: credentials });
      |                                       ^ TypeError: apiRequestContext.post: Invalid URL
  16  |   expect(response.ok()).toBeTruthy();
  17  |   const payload = await response.json() as { token?: string };
  18  |   if (!payload.token) throw new Error('Admin login API did not return a token.');
  19  |   await page.addInitScript((token) => { sessionStorage.setItem('atlas_local_token', token); }, payload.token);
  20  | }
  21  | 
  22  | async function getPerformanceMetrics(page: Page) {
  23  |   return await page.evaluate(() => {
  24  |     const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  25  |     const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  26  |     const jsResources = resources.filter(r => r.name.match(/\.(js|ts|jsx|tsx)(\?.*)?$/) || r.name.includes('/assets/'));
  27  |     const totalJSTransferBytes = jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  28  |     const decodedBodySize = jsResources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
  29  |     return {
  30  |       navigation: navEntry ? { duration: navEntry.duration, domInteractive: navEntry.domInteractive, responseEnd: navEntry.responseEnd } : null,
  31  |       jsTransferBytes: totalJSTransferBytes,
  32  |       jsDecodedBytes: decodedBodySize,
  33  |       jsFileCount: jsResources.length,
  34  |       profilerLogs: (window as any).__reactProfilerLogs || [],
  35  |     };
  36  |   });
  37  | }
  38  | 
  39  | async function startFrameCounter(page: Page) {
  40  |   await page.evaluate(() => {
  41  |     (window as any).__fpsTicks = [];
  42  |     let active = true;
  43  |     (window as any).__stopFpsCounter = () => { active = false; };
  44  |     function tick() {
  45  |       if (!active) return;
  46  |       (window as any).__fpsTicks.push(performance.now());
  47  |       requestAnimationFrame(tick);
  48  |     }
  49  |     requestAnimationFrame(tick);
  50  |   });
  51  | }
  52  | 
  53  | async function stopFrameCounter(page: Page) {
  54  |   return await page.evaluate(() => {
  55  |     if (typeof (window as any).__stopFpsCounter === 'function') (window as any).__stopFpsCounter();
  56  |     const ticks: number[] = (window as any).__fpsTicks || [];
  57  |     if (ticks.length < 2) return { fps: 60, jitterMs: 0, frameCount: ticks.length };
  58  |     const intervals: number[] = [];
  59  |     for (let i = 1; i < ticks.length; i++) intervals.push(ticks[i] - ticks[i - 1]);
  60  |     const totalDuration = ticks[ticks.length - 1] - ticks[0];
  61  |     const fps = (ticks.length / totalDuration) * 1000;
  62  |     const avgInterval = totalDuration / intervals.length;
  63  |     const sqDiffs = intervals.map(val => Math.pow(val - avgInterval, 2));
  64  |     const avgSqDiff = sqDiffs.reduce((sum, val) => sum + val, 0) / sqDiffs.length;
  65  |     return { fps, jitterMs: Math.sqrt(avgSqDiff), frameCount: ticks.length, durationMs: totalDuration };
  66  |   });
  67  | }
  68  | 
  69  | const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  70  | const reportDir = path.join(process.cwd(), 'qa-artifacts', 'perf-runs', `run-${dateStr}`);
  71  | 
  72  | async function saveScenarioReport(testInfo: TestInfo, name: string, data: any) {
  73  |   const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  74  |   const filePath = path.join(reportDir, `${safeName}.json`);
  75  |   fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  76  |   await testInfo.attach(safeName, { path: filePath, contentType: 'application/json' });
  77  | }
  78  | 
  79  | test.describe.serial('Timetable Performance Scenarios', () => {
  80  |   let hasValidRun = false;
  81  | 
  82  |   test.beforeAll(async () => {
  83  |     if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  84  |   });
  85  | 
  86  |   test.beforeEach(async ({ page }) => {
  87  |     page.on('pageerror', (err) => console.error(`[BROWSER EXCEPTION]: ${err.message}`));
  88  |     page.on('console', msg => { if(msg.type() === 'error') console.log('[BROWSER CONSOLE]:', msg.text()); });
  89  |     await page.context().clearCookies();
  90  |     await loginAdmin(page);
  91  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  92  |     await page.evaluate(() => { localStorage.setItem('atlas_timetable_tour', 'true'); });
  93  |   });
  94  | 
  95  |   test('1. Environment and dataset preflight', async ({ page }, testInfo) => {
  96  |     test.setTimeout(60000);
  97  |     const healthResponse = await page.request.get('/api/v1/health');
  98  |     expect(healthResponse.ok()).toBeTruthy();
  99  | 
  100 |     await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
  101 |     const emptyStateLocator = page.getByText('Start with Pre-Generation Draft').or(page.getByText('Pre-generation draft is empty'));
  102 |     const gridLocator = page.locator('table');
  103 |     
  104 |     try { await expect(gridLocator.or(emptyStateLocator)).toBeVisible({ timeout: 15000 }); } catch (e) { console.error('FAILED AT URL:', page.url()); console.error('HTML:', await page.content()); throw e; }
  105 |     
  106 |     if (await emptyStateLocator.isVisible()) {
  107 |       await saveScenarioReport(testInfo, 'preflight', { status: 'BLOCKED', reason: 'No active run exists. Manual generation required before tests.' });
  108 |       test.skip(true, 'No active run exists.');
  109 |       return;
  110 |     }
  111 | 
  112 |     const datasetSize = await page.evaluate(() => {
  113 |       return {
  114 |         rows: document.querySelectorAll('table tbody tr').length,
  115 |         cells: document.querySelectorAll('table tbody td').length,
```