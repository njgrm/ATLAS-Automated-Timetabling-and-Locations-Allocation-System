const { chromium, devices } = require('playwright');

async function run() {
  const browser = await chromium.launch();
  const url = process.env.PLAYWRIGHT_BASE_URL ?? "https://njgrm.buru-degree.ts.net";

  const viewports = [
    { name: "desktop", viewport: { width: 1440, height: 900 }, userAgent: devices['Desktop Chrome'].userAgent },
    { name: "mobile-portrait", viewport: { width: 390, height: 844 }, userAgent: devices['Pixel 7'].userAgent },
    { name: "mobile-landscape", viewport: { width: 844, height: 390 }, userAgent: devices['Pixel 7 landscape'].userAgent }
  ];

  for (const vp of viewports) {
    console.log(`\n--- Testing ${vp.name} ---`);
    const context = await browser.newContext({ viewport: vp.viewport, userAgent: vp.userAgent });
    const page = await context.newPage();

    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`[Console] ${msg.text()}`); });
    page.on('pageerror', err => errors.push(`[PageError] ${err.message}`));
    page.on('requestfailed', request => errors.push(`[Network] ${request.url()} - ${request.failure()?.errorText}`));

    // Login via API to save time
    const res = await context.request.post(`${url}/api/v1/auth/login`, { data: { identifier: '1000001', password: 'AdminSY2026!' } });
    if (!res.ok()) {
      console.error('Login failed:', await res.text());
      continue;
    }
    const token = (await res.json()).token;
    await context.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });

    await page.addInitScript((token) => {
      sessionStorage.setItem('atlas_local_token', token);
      localStorage.setItem('atlas_timetable_tour', 'true');
    }, token);

    const start = performance.now();
    await page.goto(`${url}/timetable`, { waitUntil: 'domcontentloaded' });

    try {
      await page.waitForSelector('table[aria-label="Timetable"]', { timeout: 15000 });
      const tableTime = performance.now() - start;
      console.log(`Time to table visible: ${Math.round(tableTime)}ms`);

      try {
        await page.waitForSelector('[data-testid="timetable-task-place"]', { timeout: 15000 });
        await page.waitForSelector('[data-testid="timetable-filters-trigger"]', { timeout: 15000 });
        const actionTime = performance.now() - start;
        console.log(`Time to first action: ${Math.round(actionTime)}ms`);
      } catch(e) {
        console.log(`Time to first action: N/A (not found)`);
      }
      
      // Allow it to render fully
      await page.waitForTimeout(2000);
      
      const metrics = await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        const center = document.querySelector('#center-panel')?.getBoundingClientRect() || {width: 0};
        const left = document.querySelector('#left-panel')?.getBoundingClientRect() || {width: 0};
        const right = document.querySelector('#right-panel')?.getBoundingClientRect() || {width: 0};
        const guide = document.querySelector('[data-testid="timetable-task-guide"]')?.getBoundingClientRect() || {height: 0};
        const topGuidance = document.querySelector('[data-testid="timetable-task-guide"]')?.textContent || '';
        return {
          scrollWidth: root.scrollWidth,
          scrollHeight: root.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          centerWidth: center.width,
          leftWidth: left.width,
          rightWidth: right.width,
          taskGuideHeight: guide.height,
          topGuidanceText: topGuidance
        };
      });
      console.log("Layout Metrics:", JSON.stringify(metrics, null, 2));
      const hasGlobalScrollbar = metrics.scrollHeight > metrics.viewportHeight + 8 || metrics.scrollWidth > metrics.viewportWidth + 8;
      console.log(`Global Scrollbar: ${hasGlobalScrollbar}`);

      await page.screenshot({ path: `qa-artifacts/manual-audit-${vp.name}.png` });

      // check filters
      try {
        await page.click('[data-testid="timetable-filters-trigger"]', { timeout: 5000 });
        console.log("Filters popover opened successfully");
        await page.waitForTimeout(500);
        await page.screenshot({ path: `qa-artifacts/manual-audit-${vp.name}-filters.png` });
        // close it
        await page.keyboard.press('Escape');
      } catch (e) {
        console.log("Could not open filters popover", e.message);
      }
      
    } catch (e) {
      console.error('Wait failed:', e.message);
    }
    
    console.log("Errors:", errors);
    await context.close();
  }
  await browser.close();
}

run().catch(console.error);
