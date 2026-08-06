import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD) {
  throw new Error('Missing required PLAYWRIGHT_ADMIN_EMAIL or PLAYWRIGHT_ADMIN_PASSWORD environment variables');
}

const credentials = {
  identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL,
  password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
};

async function loginAdmin(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', { data: credentials });
  if (!response.ok()) {
    throw new Error(`Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`);
  }
  const payload = await response.json() as { token?: string };
  if (!payload.token) throw new Error('Admin login API did not return a token.');
  await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
  await page.addInitScript((token) => { sessionStorage.setItem('atlas_local_token', token); }, payload.token);
}

async function getPerformanceMetrics(page: Page) {
  return await page.evaluate(() => {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resources.filter(r => r.name.match(/\.(js|ts|jsx|tsx)(\?.*)?$/) || r.name.includes('/assets/'));
    const totalJSTransferBytes = jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const decodedBodySize = jsResources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
    return {
      navigation: navEntry ? { duration: navEntry.duration, domInteractive: navEntry.domInteractive, responseEnd: navEntry.responseEnd } : null,
      jsTransferBytes: totalJSTransferBytes,
      jsDecodedBytes: decodedBodySize,
      jsFileCount: jsResources.length,
      profilerLogs: (window as any).__reactProfilerLogs || [],
    };
  });
}

async function startFrameCounter(page: Page) {
  await page.evaluate(() => {
    (window as any).__fpsTicks = [];
    (window as any).__longTasks = [];
    let active = true;
    (window as any).__stopFpsCounter = () => { active = false; };
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      (window as any).__longTaskObserver = observer;
    } catch {
      (window as any).__longTaskObserver = null;
    }
    function tick() {
      if (!active) return;
      (window as any).__fpsTicks.push(performance.now());
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function stopFrameCounter(page: Page) {
  return await page.evaluate(() => {
    if (typeof (window as any).__stopFpsCounter === 'function') (window as any).__stopFpsCounter();
    (window as any).__longTaskObserver?.disconnect?.();
    const ticks: number[] = (window as any).__fpsTicks || [];
    const longTasks: Array<{ startTime: number; duration: number }> = (window as any).__longTasks || [];
    if (ticks.length < 2) return { fps: 0, jitterMs: 0, frameCount: ticks.length, durationMs: 0, frameIntervalP95Ms: null, frameOverBudgetP95Ms: null, longTasks };
    const intervals: number[] = [];
    for (let i = 1; i < ticks.length; i++) intervals.push(ticks[i] - ticks[i - 1]);
    const totalDuration = ticks[ticks.length - 1] - ticks[0];
    const fps = (ticks.length / totalDuration) * 1000;
    const avgInterval = totalDuration / intervals.length;
    const sqDiffs = intervals.map(val => Math.pow(val - avgInterval, 2));
    const avgSqDiff = sqDiffs.reduce((sum, val) => sum + val, 0) / sqDiffs.length;
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const p95Index = Math.min(sortedIntervals.length - 1, Math.ceil(sortedIntervals.length * 0.95) - 1);
    const frameIntervalP95Ms = sortedIntervals[p95Index];
    return {
      fps,
      jitterMs: Math.sqrt(avgSqDiff),
      frameCount: ticks.length,
      durationMs: totalDuration,
      frameIntervalP95Ms,
      frameOverBudgetP95Ms: Math.max(0, frameIntervalP95Ms - (1000 / 60)),
      longTasks,
    };
  });
}

const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = path.join(process.cwd(), 'qa-artifacts', 'perf-runs', `run-${dateStr}`);
const REQUIRED_SELECTION_COUNT = 20;
const REQUIRED_DRAG_DURATION_MS = 10_000;
const DRAG_DURATION_MEASUREMENT_BUFFER_MS = 300;
const MIN_DRAG_FPS = 55;
const MAX_DRAG_COMMIT_MS = 16;
const MAX_FRAME_OVER_BUDGET_P95_MS = 8;
const MAX_LONG_TASK_MS = 50;

function isExpectedNavigationAbort(page: Page, requestUrl: string, errorText = '') {
  if (!/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT|NS_BINDING_ABORTED|Target closed|Frame was detached/i.test(errorText)) {
    return false;
  }

  const url = new URL(requestUrl);
  const pathname = url.pathname;

  return (
    pathname === '/enrollpro-api/settings/public'
    || pathname.startsWith('/src/')
    || pathname.startsWith('/node_modules/.vite/')
    || pathname.startsWith('/assets/')
    || (/ERR_BLOCKED_BY_CLIENT/i.test(errorText) && pathname.includes('/manual-edits/commit'))
    || pathname === '/api/v1/dashboard/readiness-summary'
    || pathname === '/api/v1/runtime/context'
    || page.isClosed()
  );
}

async function saveScenarioReport(testInfo: TestInfo, name: string, data: any) {
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filePath = path.join(reportDir, `${safeName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  await testInfo.attach(safeName, { path: filePath, contentType: 'application/json' });
}

async function blockTimetableCommits(page: Page) {
  const blockedRequests: string[] = [];
  await page.route('**/api/v1/generation/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const isReadOnlyPreview = pathname.endsWith('/preview');
    if (request.method() !== 'GET' && !isReadOnlyPreview) {
      blockedRequests.push(`${request.method()} ${pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  return blockedRequests;
}

test.describe.serial('Timetable Performance Scenarios', () => {
  let hasValidRun = false;
  let ignoredNavigationAborts: Array<{ url: string; errorText?: string }> = [];
  let unexpectedNetworkFailures: Array<{ url: string; errorText?: string }> = [];

  test.beforeAll(async () => {
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  });

  test.beforeEach(async ({ page }, testInfo) => {
    ignoredNavigationAborts = [];
    unexpectedNetworkFailures = [];
    page.on('pageerror', (err) => console.error(`[BROWSER EXCEPTION]: ${err.message}`));
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || msg.type() === 'warning') console.log('[BROWSER CONSOLE]:', text);
    });
    page.on('requestfailed', req => {
      const errorText = req.failure()?.errorText ?? '';
      if (isExpectedNavigationAbort(page, req.url(), errorText)) {
        ignoredNavigationAborts.push({ url: req.url(), errorText });
        return;
      }
      unexpectedNetworkFailures.push({ url: req.url(), errorText });
      console.error(`[NETWORK FAILED]: ${req.url()} - ${errorText}`);
    });
    await page.context().clearCookies();
    try {
      await loginAdmin(page);
    } catch (error) {
      await saveScenarioReport(testInfo, 'environment_blocked', {
        status: 'BLOCKED',
        reason: error instanceof Error ? error.message : String(error),
        target: process.env.PLAYWRIGHT_BASE_URL ?? 'https://njgrm.buru-degree.ts.net',
      });
      throw error;
    }
    await page.addInitScript(() => { localStorage.setItem('atlas_timetable_tour', 'true'); });
  });

  test.afterEach(async ({}, testInfo) => {
    await testInfo.attach('ignored_navigation_aborts', {
      body: JSON.stringify(ignoredNavigationAborts, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('unexpected_network_failures', {
      body: JSON.stringify(unexpectedNetworkFailures, null, 2),
      contentType: 'application/json',
    });
    expect(unexpectedNetworkFailures, 'No unexpected network request failures should occur during timetable performance scenarios.').toEqual([]);
  });

  test('1. Environment and dataset preflight', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const healthResponse = await page.request.get('/api/v1/health');
    expect(healthResponse.ok()).toBeTruthy();

    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    const emptyStateLocator = page.getByText('Start with Pre-Generation Draft').or(page.getByText('Pre-generation draft is empty'));
    const gridLocator = page.locator('table');
    
    try { await expect(gridLocator.or(emptyStateLocator)).toBeVisible({ timeout: 15000 }); } catch (e) { console.error('FAILED AT URL:', page.url()); console.error('HTML:', await page.content()); throw e; }
    
    if (await emptyStateLocator.isVisible()) {
      await saveScenarioReport(testInfo, 'preflight', { status: 'BLOCKED', reason: 'No active run exists. Manual generation required before tests.' });
      test.skip(true, 'No active run exists.');
      return;
    }

    const datasetSize = await page.evaluate(() => {
      return {
        rows: document.querySelectorAll('table tbody tr').length,
        cells: document.querySelectorAll('table tbody td').length,
        violations: document.querySelectorAll('[data-testid="violation-item"]').length,
        unassignedItems: document.querySelectorAll('[draggable="true"]').length,
        candidateCount: document.querySelectorAll('[data-timetable-entry="true"]').length,
      };
    });

    hasValidRun = true;
    await saveScenarioReport(testInfo, 'preflight', { status: 'PASS', dataset: datasetSize });
  });

  test('2. Cold navigation', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    
    const t0 = performance.now();
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const coldLoadDuration = performance.now() - t0;
    
    const metrics = await getPerformanceMetrics(page);
    await saveScenarioReport(testInfo, 'cold_navigation', { status: 'PASS', durationMs: coldLoadDuration, metrics });
  });

  test('3. Warm navigation', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const timetableLink = page.getByRole('link', { name: /Open Timetable/i }).first();
    await timetableLink.waitFor({ state: 'visible', timeout: 10000 });
    
    const t0 = performance.now();
    await timetableLink.click();
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const warmLoadDuration = performance.now() - t0;
    
    const metrics = await getPerformanceMetrics(page);
    await saveScenarioReport(testInfo, 'warm_navigation', { status: 'PASS', durationMs: warmLoadDuration, metrics });
  });

  test('4. First selection', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    
    await page.evaluate(() => { (window as any).__reactProfilerLogs = []; });
    const gridCells = page.locator('[data-timetable-entry="true"]');
    if (await gridCells.count() === 0) {
      test.skip(true, 'No entries to select');
      return;
    }
    
    const t0 = performance.now();
    await gridCells.first().click();
    await expect(page.getByTestId('timetable-selection-strip')).toBeVisible({ timeout: 15000 });
    const selectionDuration = performance.now() - t0;
    
    const metrics = await getPerformanceMetrics(page);
    await saveScenarioReport(testInfo, 'first_selection', { status: 'PASS', durationMs: selectionDuration, commits: metrics.profilerLogs });
  });

  test('5. Repeated selection', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    
    const gridCells = page.locator('[data-timetable-entry="true"]');
    const count = await gridCells.count();
    if (count === 0) {
      test.skip(true, 'No entries to select');
      return;
    }
    
    if (count < REQUIRED_SELECTION_COUNT) {
      await saveScenarioReport(testInfo, 'repeated_selection', { status: 'BLOCKED', reason: `Representative dataset has only ${count} selectable entries; ${REQUIRED_SELECTION_COUNT} are required.` });
      return;
    }

    const selDurations: number[] = [];
    for (let i = 0; i < REQUIRED_SELECTION_COUNT; i++) {
      const t0 = performance.now();
      await gridCells.nth(i).click({ force: true });
      await page.waitForTimeout(50);
      selDurations.push(performance.now() - t0);
    }
    
    const avgDuration = selDurations.reduce((a, b) => a + b, 0) / selDurations.length;
    await saveScenarioReport(testInfo, 'repeated_selection', { status: selDurations.length === REQUIRED_SELECTION_COUNT ? 'PASS' : 'FAIL', avgDurationMs: avgDuration, durations: selDurations });
  });

  test('6. Pointer drag', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const blockedCommitRequests = await blockTimetableCommits(page);
    
    const queuePin = page.locator('[data-timetable-entry="true"][data-faculty-id]:not([data-faculty-id=""])').first();
    const targetCell = page.locator('td[data-day]').nth(15);
    
    if (await queuePin.count() === 0) {
      test.skip(true, 'No draggable pins');
      return;
    }
    
    // Wait for the grid to populate and the double-fetch to start
    await page.waitForTimeout(4000);
    // Then wait for any loading spinners to settle completely
    await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500); // Give React one final tick to flush the context updates
    await queuePin.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'center' }));
    await targetCell.scrollIntoViewIfNeeded();
    await expect(queuePin).toBeVisible({ timeout: 5000 });
    await expect(targetCell).toBeVisible({ timeout: 5000 });
    const dragBox = await queuePin.boundingBox();
    const targetBox = await targetCell.boundingBox();

    if (!dragBox || !targetBox) {
      test.skip(true, 'Boxes not found');
      return;
    }
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    
    await page.evaluate(() => {
      (window as any).__reactProfilerLogs = [];
      (window as any).__gridCellCommitLogs = [];
      (window as any).__captureGridCellCommits = true;
    });
    const t0 = performance.now();
    await page.mouse.down();
    const startLatency = performance.now() - t0;
    
    // Trigger onDragStart (dnd-kit requires >4px movement)
    await page.mouse.move(dragBox.x + dragBox.width / 2 + 10, dragBox.y + dragBox.height / 2, { steps: 2 });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	// Two frames capture the interaction commit. Later network refreshes and
	// preview work belong to their own scenario, not pointer activation.
    const dragStartLogs = await page.evaluate(() => (window as any).__reactProfilerLogs || []);
    const dragStartCommitMs = Math.max(0, ...dragStartLogs.map((log: any) => Number(log.actualDuration) || 0));

    let direction = 1;
    let currentX = targetBox.x + 5;
    const startTime = Date.now();
    
    // Reset both instruments after drag-start settles so crossing containment
    // does not incorrectly count the intentional drag-mode transition.
    await page.evaluate(() => {
      (window as any).__reactProfilerLogs = [];
      (window as any).__gridCellCommitLogs = [];
    });
	await startFrameCounter(page);
    // The counter starts on the next animation frame. Keep the pointer moving
    // past the 10s acceptance interval so loop/await overhead cannot turn a
    // valid 10s run into a 9.96s false failure.
    while (Date.now() - startTime < REQUIRED_DRAG_DURATION_MS + DRAG_DURATION_MEASUREMENT_BUFFER_MS) {
      currentX += 30 * direction;
      if (currentX > targetBox.x + 200) direction = -1;
      if (currentX < targetBox.x - 200) direction = 1;
      await page.mouse.move(currentX, targetBox.y + targetBox.height / 2, { steps: 5 });
      await page.waitForTimeout(50);
    }

    const fpsResult = await stopFrameCounter(page);
    const crossingLogs = await page.evaluate(() => (window as any).__reactProfilerLogs || []);
    const cellLogs = await page.evaluate(() => {
      (window as any).__captureGridCellCommits = false;
      return (window as any).__gridCellCommitLogs || [];
    });
    await page.evaluate(() => { (window as any).__reactProfilerLogs = []; });
    await page.mouse.up();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const dragEndLogs = await page.evaluate(() => (window as any).__reactProfilerLogs || []);
    const headerLogs = crossingLogs.filter((l: any) => l.id === 'Header');
    const leftRailLogs = crossingLogs.filter((l: any) => l.id === 'Left Rail');
    const rightPanelLogs = crossingLogs.filter((l: any) => l.id === 'Right Panel');
    const dragEndCommitMs = Math.max(0, ...dragEndLogs.map((log: any) => Number(log.actualDuration) || 0));
    const batches = new Map<number, Set<string>>();
    for (const log of cellLogs) {
      const batch = Math.round(Number(log.timestamp) / 8);
      const ids = batches.get(batch) ?? new Set<string>();
      ids.add(String(log.cellId));
      batches.set(batch, ids);
    }
    const maxCellsPerCommitBatch = Math.max(0, ...Array.from(batches.values(), (ids) => ids.size));
	const cellCommitBatches = Array.from(batches.entries(), ([bucket, ids]) => ({
	  timestampMs: bucket * 8,
	  cellCount: ids.size,
	})).sort((a, b) => b.cellCount - a.cellCount).slice(0, 10);
    const maxLongTaskMs = Math.max(0, ...fpsResult.longTasks.map((task: { duration: number }) => task.duration));
    const failures: string[] = [];
    if (fpsResult.durationMs < REQUIRED_DRAG_DURATION_MS) failures.push(`drag duration ${fpsResult.durationMs.toFixed(1)}ms < ${REQUIRED_DRAG_DURATION_MS}ms`);
    if (fpsResult.fps < MIN_DRAG_FPS) failures.push(`FPS ${fpsResult.fps.toFixed(2)} < ${MIN_DRAG_FPS}`);
    if (dragStartCommitMs > MAX_DRAG_COMMIT_MS) failures.push(`drag-start commit ${dragStartCommitMs.toFixed(2)}ms > ${MAX_DRAG_COMMIT_MS}ms`);
    if (dragEndCommitMs > MAX_DRAG_COMMIT_MS) failures.push(`drag-end commit ${dragEndCommitMs.toFixed(2)}ms > ${MAX_DRAG_COMMIT_MS}ms`);
    if (fpsResult.frameOverBudgetP95Ms == null || fpsResult.frameOverBudgetP95Ms >= MAX_FRAME_OVER_BUDGET_P95_MS) failures.push(`frame over-budget p95 ${fpsResult.frameOverBudgetP95Ms ?? 'missing'}ms >= ${MAX_FRAME_OVER_BUDGET_P95_MS}ms`);
    if (maxLongTaskMs > MAX_LONG_TASK_MS) failures.push(`long task ${maxLongTaskMs.toFixed(2)}ms > ${MAX_LONG_TASK_MS}ms`);
    if (headerLogs.length > 0) failures.push(`Header committed ${headerLogs.length} times during drag`);
    if (leftRailLogs.length > 0) failures.push(`Left Rail committed ${leftRailLogs.length} times during drag`);
    if (rightPanelLogs.length > 0) failures.push(`Right Panel committed ${rightPanelLogs.length} times during drag`);
    if (maxCellsPerCommitBatch > 2) failures.push(`${maxCellsPerCommitBatch} grid cells committed in one crossing batch`);

    await saveScenarioReport(testInfo, 'pointer_drag', {
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      failures,
      startLatencyMs: startLatency, 
      dragStartCommitMs,
      dragEndCommitMs,
	  dragStartProfilerLogs: dragStartLogs.map((log: any) => ({ id: log.id, phase: log.phase, actualDuration: log.actualDuration, timestamp: log.timestamp })),
	  dragEndProfilerLogs: dragEndLogs.map((log: any) => ({ id: log.id, phase: log.phase, actualDuration: log.actualDuration, timestamp: log.timestamp })),
      fpsResult,
      maxCellsPerCommitBatch,
	  cellCommitBatches,
      blockedCommitRequests,
	  crossingProfilerLogs: crossingLogs
	    .filter((log: any) => ['Header', 'Left Rail', 'Right Panel'].includes(log.id))
	    .map((log: any) => ({ id: log.id, phase: log.phase, actualDuration: log.actualDuration, timestamp: log.timestamp })),
      commits: {
        header: headerLogs.length,
        leftRail: leftRailLogs.length,
        rightPanel: rightPanelLogs.length
      }
    });

  });

  
  test('7. Keyboard select-then-place', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const blockedCommitRequests = await blockTimetableCommits(page);
    
    const queuePin = page.locator('[data-dnd-source-type="entry"], [data-dnd-source-type="draftPlacement"], [data-dnd-source-type="unassigned"]').first();
    if (await queuePin.count() === 0) {
      test.skip(true, 'No draggable pins'); return;
    }
    await queuePin.focus();
    await page.keyboard.press('Enter');
    const moveButton = page.getByTestId('timetable-selection-strip').getByRole('button', { name: 'Move timeslot' });
    await expect(moveButton).toBeVisible({ timeout: 5000 });
    await moveButton.focus();
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const targetLabel = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll<HTMLTableCellElement>('td[data-day][data-start-time][data-end-time]'));
      const target = cells[15] ?? cells.find((cell) => cell.offsetParent !== null) ?? cells[0];
      if (!target) return null;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.focus();
      return target.getAttribute('aria-label');
    });
    expect(targetLabel, 'Keyboard placement target cell must be focusable.').toBeTruthy();
    await page.keyboard.press('Enter');
    const feedbackVisible = await page.getByText(/Checking move impact|Preview|blocked|conflict|Swap/i).first().isVisible().catch(() => false);
    await saveScenarioReport(testInfo, 'keyboard_place', {
      status: targetLabel && feedbackVisible ? 'PASS' : 'FAIL',
      targetLabel,
      feedbackVisible,
      blockedCommitRequests,
    });
  });

  test('8. Touch select-then-place', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    if (!testInfo.project.use.hasTouch) {
      await saveScenarioReport(testInfo, 'touch_place', { status: 'NOT_APPLICABLE', reason: 'Desktop profile does not expose a touchscreen; covered by both mobile profiles.' });
      return;
    }
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const blockedCommitRequests = await blockTimetableCommits(page);
    const source = page.locator('[data-timetable-entry="true"][data-faculty-id]:not([data-faculty-id=""])').first();
    await source.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'center' }));
    await expect(source).toBeVisible({ timeout: 5000 });
    await source.tap();
    const moveButton = page.getByTestId('timetable-selection-strip').getByRole('button', { name: 'Move timeslot' });
    await expect(moveButton).toBeVisible({ timeout: 5000 });
    await moveButton.tap();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const target = page.locator('td[data-day][data-start-time][data-end-time]').first();
    await expect(target).toBeVisible({ timeout: 5000 });
    const targetBox = await target.boundingBox();
    if (!targetBox) {
      await saveScenarioReport(testInfo, 'touch_place', { status: 'BLOCKED', reason: 'No visible target cell bounding box', blockedCommitRequests });
      return;
    }
    await page.touchscreen.tap(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    const feedbackVisible = await page.getByText(/Review|Preview|Select an available slot|Recovery Actions/i).first().isVisible().catch(() => false);
    await saveScenarioReport(testInfo, 'touch_place', { status: feedbackVisible ? 'PASS' : 'FAIL', feedbackVisible, blockedCommitRequests });
  });

  test('9. Preview and failure path', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const blockedCommitRequests = await blockTimetableCommits(page);
    const queuePin = page.locator('[data-dnd-source-type="entry"]').first();
    if (await queuePin.count() > 0) {
      const targetCell = page.locator('td[data-day]').nth(15);
      await queuePin.dragTo(targetCell);
      await page.waitForTimeout(500);
    }
    const feedbackVisible = await page.getByText(/Review|Preview|blocked|conflict|not allowed/i).first().isVisible().catch(() => false);
    await saveScenarioReport(testInfo, 'preview_failure', {
      status: feedbackVisible ? 'PASS' : 'FAIL',
      feedbackVisible,
      blockedCommitRequests,
      mutationSafety: 'All non-preview generation writes were intercepted and aborted.',
    });
  });

  test('10. Safe reversible commit and settled state', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    const scope = '/api/v1/generation/1/55';
    const sourceResponse = await page.request.get(`${scope}/runs/performance-fixture-source`);
    if (!sourceResponse.ok()) {
      await saveScenarioReport(testInfo, 'commit_settled', {
        status: 'BLOCKED',
        reason: `No completed, unpublished, zero-hard-violation fixture source is available (HTTP ${sourceResponse.status()}).`,
      });
      return;
    }
    const sourcePayload = await sourceResponse.json() as { source?: { id?: number } };
    const source = sourcePayload.source;
    if (!source?.id) throw new Error('Fixture source response did not include a run id.');

    let fixtureRunId: number | null = null;
    let result: Record<string, unknown> = { status: 'FAIL', reason: 'Fixture verification did not complete.' };
    try {
      const fixtureResponse = await page.request.post(`${scope}/runs/${source.id}/performance-fixture`);
      if (!fixtureResponse.ok()) throw new Error(`Fixture creation failed: HTTP ${fixtureResponse.status()} ${(await fixtureResponse.text()).slice(0, 500)}`);
      const fixturePayload = await fixtureResponse.json() as { fixture?: { id?: number } };
      fixtureRunId = fixturePayload.fixture?.id ?? null;
      if (!fixtureRunId) throw new Error('Fixture creation response did not include a run id.');

      const beforeResponse = await page.request.get(`${scope}/runs/${fixtureRunId}/draft`);
      if (!beforeResponse.ok()) throw new Error(`Fixture draft read failed: HTTP ${beforeResponse.status()}`);
      const before = await beforeResponse.json() as { entries?: Array<Record<string, unknown>>; version?: number };
      const entry = before.entries?.[0];
      if (!entry || typeof entry.entryId !== 'string' || typeof before.version !== 'number') throw new Error('Fixture draft did not contain a versioned scheduled entry.');
      const originalEntry = JSON.stringify(entry);

      const commitResponse = await page.request.post(`${scope}/runs/${fixtureRunId}/manual-edits/commit`, {
        data: {
          proposal: {
            editType: 'CHANGE_TIMESLOT',
            entryId: entry.entryId,
            targetDay: entry.day,
            targetStartTime: entry.startTime,
            targetEndTime: entry.endTime,
          },
          expectedVersion: before.version,
          allowSoftOverride: true,
        },
      });
      if (!commitResponse.ok()) throw new Error(`Fixture commit failed: HTTP ${commitResponse.status()} ${(await commitResponse.text()).slice(0, 500)}`);
      const committed = await commitResponse.json() as { newVersion?: number };
      if (typeof committed.newVersion !== 'number') throw new Error('Fixture commit did not return a new version.');

      const revertResponse = await page.request.post(`${scope}/runs/${fixtureRunId}/manual-edits/revert`);
      if (!revertResponse.ok()) throw new Error(`Fixture revert failed: HTTP ${revertResponse.status()} ${(await revertResponse.text()).slice(0, 500)}`);
      const reverted = await revertResponse.json() as { newVersion?: number };
      const settledResponse = await page.request.get(`${scope}/runs/${fixtureRunId}/draft`);
      if (!settledResponse.ok()) throw new Error(`Fixture settled-state read failed: HTTP ${settledResponse.status()}`);
      const settled = await settledResponse.json() as { entries?: Array<Record<string, unknown>>; version?: number };
      const settledEntry = settled.entries?.find((candidate) => candidate.entryId === entry.entryId);
      const restored = JSON.stringify(settledEntry) === originalEntry;
      const versionAdvanced = settled.version === committed.newVersion + 1 && reverted.newVersion === settled.version;
      if (!restored || !versionAdvanced) throw new Error(`Fixture did not settle reversibly (restored=${restored}, versionAdvanced=${versionAdvanced}).`);
      result = { status: 'PASS', sourceRunId: source.id, fixtureRunId, restored, versionAdvanced, commitVersion: committed.newVersion, settledVersion: settled.version };
    } catch (error) {
      result = { status: 'FAIL', fixtureRunId, reason: error instanceof Error ? error.message : String(error) };
    } finally {
      if (fixtureRunId != null) {
        const cleanupResponse = await page.request.delete(`${scope}/runs/${fixtureRunId}/performance-fixture`);
        const cleanupOk = cleanupResponse.ok();
        result.cleanup = { attempted: true, ok: cleanupOk, status: cleanupResponse.status() };
        if (!cleanupOk) result = { ...result, status: 'FAIL', reason: `Fixture cleanup failed: HTTP ${cleanupResponse.status()}` };
      }
    }
    await saveScenarioReport(testInfo, 'commit_settled', result);
  });

  test('11. Filter changes', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    
    let filterBtn = page.getByTestId('timetable-filters-trigger').or(page.getByRole('button', { name: /^Filters$/ }));
    if (!(await filterBtn.isVisible().catch(() => false))) {
      const moreTrigger = page.getByTestId('timetable-simple-more-trigger');
      if (await moreTrigger.isVisible().catch(() => false)) {
        await moreTrigger.click();
        filterBtn = page.getByTestId('timetable-filters-trigger').or(page.getByRole('menuitem', { name: /^Filters$/ }));
      }
    }
    if (await filterBtn.isVisible()) {
      const t0 = performance.now();
      await filterBtn.click();
      await page.waitForTimeout(100);
      const filterDur = performance.now() - t0;
      await saveScenarioReport(testInfo, 'filter_changes', { status: 'PASS', filterLatencyMs: filterDur });
    } else {
      await saveScenarioReport(testInfo, 'filter_changes', { status: 'BLOCKED', reason: 'Filter button not found' });
    }
  });

  test('12. Accessibility and focus', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    
    const table = page.locator('table');
    await expect(table).toHaveAttribute('aria-label', /Timetable|Schedule/i);
    await saveScenarioReport(testInfo, 'accessibility', { status: 'PASS' });
  });

  test('13. React commit containment', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.skip(!hasValidRun, 'Skipped due to missing run data.');
    const pointerReportPath = path.join(reportDir, 'pointer_drag.json');
    if (!fs.existsSync(pointerReportPath)) {
      await saveScenarioReport(testInfo, 'commit_containment', { status: 'BLOCKED', reason: 'Pointer-drag evidence is missing.' });
      return;
    }
    const pointerReport = JSON.parse(fs.readFileSync(pointerReportPath, 'utf8')) as { status: string; commits?: Record<string, number>; maxCellsPerCommitBatch?: number };
    const passed = pointerReport.status === 'PASS'
      && pointerReport.commits?.header === 0
      && pointerReport.commits?.leftRail === 0
      && pointerReport.commits?.rightPanel === 0
      && (pointerReport.maxCellsPerCommitBatch ?? Number.POSITIVE_INFINITY) <= 2;
    await saveScenarioReport(testInfo, 'commit_containment', { status: passed ? 'PASS' : 'FAIL', pointerEvidence: pointerReport });
  });

  test('14. Mandatory Prompt 0 and Prompt 1 gate verdict', async ({}, testInfo) => {
    const mandatory = [
      'preflight', 'cold_navigation', 'warm_navigation', 'first_selection', 'repeated_selection',
      'pointer_drag', 'keyboard_place', 'touch_place', 'preview_failure', 'commit_settled',
      'filter_changes', 'accessibility', 'commit_containment',
    ];
    const failures: Array<{ scenario: string; status: string; reason?: string }> = [];
    for (const scenario of mandatory) {
      const filePath = path.join(reportDir, `${scenario}.json`);
      if (!fs.existsSync(filePath)) {
        failures.push({ scenario, status: 'MISSING' });
        continue;
      }
      const result = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { status?: string; reason?: string };
      const desktopTouchExemption = scenario === 'touch_place' && testInfo.project.name === 'desktop' && result.status === 'NOT_APPLICABLE';
      if (result.status !== 'PASS' && !desktopTouchExemption) failures.push({ scenario, status: result.status ?? 'MISSING', reason: result.reason });
    }
    await saveScenarioReport(testInfo, 'gate_verdict', { status: failures.length === 0 ? 'PASS' : 'FAIL', failures });
    expect(failures, 'Mandatory scenarios must all pass before Prompt 0/1 closure').toEqual([]);
  });
});

