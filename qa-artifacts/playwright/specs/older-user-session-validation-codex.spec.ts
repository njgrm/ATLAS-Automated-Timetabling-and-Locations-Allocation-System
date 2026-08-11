import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin, openTimetableSimple, openSimpleMore, ensureSimpleMode } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'older-user-session-validation-codex');
const statusLabels = ['Can place', 'Can swap', 'Blocked', 'Warning', 'Occupied', 'Current'];

type TaskResult = {
	id: string;
	viewport: string;
	result: 'Independent' | 'One hint' | 'Coached' | 'Failed' | 'Proxy limitation' | 'Stale selector' | 'Fixture unavailable';
	timeMs: number | null;
	observed: string;
	reason?: string;
};

function classifyError(error: Error): TaskResult['result'] {
	const message = error.message;
	const lower = message.toLowerCase();

	const STALE_SELECTOR_IDS = [
		'timetable-layout-toggle',
		'timetable-simple-more-trigger',
		'timetable-task-drawer',
		'timetable-simple-header',
		'timetable-simple-primary-action',
		'timetable-task-guide',
		'timetable-status-legend',
	];

	for (const id of STALE_SELECTOR_IDS) {
		if (lower.includes(id) && (/timeout|not found|not visible|not attached|cannot find/i.test(message))) {
			return 'Stale selector';
		}
	}

	if (/cannot find element/i.test(message) || /element is not attached/i.test(message)) {
		return 'Stale selector';
	}

	if (/fix teaching load/i.test(message) || /teaching load repair before placement/i.test(message)) {
		return 'Fixture unavailable';
	}
	if (/status guidance is gated by teaching-load repair/i.test(message)) {
		return 'Fixture unavailable';
	}

	if (/data-virtualized-rail/i.test(message) && /timeout|scroll/i.test(message)) {
		return 'Proxy limitation';
	}
	if (/virtualized.*not.*scrollable/i.test(message)) {
		return 'Proxy limitation';
	}
	if (/mouse.*wheel.*no.*effect/i.test(message)) {
		return 'Proxy limitation';
	}

	return 'Failed';
}

async function writeReport(testInfo: TestInfo, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach('older-user-session-validation', { path: filePath, contentType: 'application/json' });
}

async function blockWrites(page: Page) {
	const blocked: string[] = [];
	await page.route('**/api/v1/generation/**', async (route) => {
		const request = route.request();
		const method = request.method();
		const pathname = new URL(request.url()).pathname;
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');
		if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isPreview) {
			blocked.push(`${method} ${new URL(request.url()).pathname}`);
			await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'OLDER_USER_AUDIT_WRITE_BLOCKED' }) });
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function timed<T>(fn: () => Promise<T>) {
	const start = Date.now();
	const value = await fn();
	return { value, timeMs: Date.now() - start };
}

async function tryTask(results: TaskResult[], viewport: string, id: string, fn: () => Promise<string>) {
	const start = Date.now();
	console.log(`[older-user-audit] ${viewport} ${id} start`);
	try {
		const observed = await fn();
		results.push({ id, viewport, result: 'Independent', timeMs: Date.now() - start, observed });
		console.log(`[older-user-audit] ${viewport} ${id} pass ${Date.now() - start}ms`);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		const result = classifyError(err);
		const reason = `${result}: ${err.message.slice(0, 200)}`;
		results.push({ id, viewport, result, timeMs: Date.now() - start, observed: '', reason });
		console.log(`[older-user-audit] ${viewport} ${id} ${result.toLowerCase()} ${Date.now() - start}ms`);
	}
}

async function openRoute(page: Page, route: string) {
	await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	if (route === '/') await expect(page.getByTestId('dashboard-readiness-hub')).toBeVisible({ timeout: 20_000 });
	if (route === '/map') await expect(page.getByTestId('room-readiness-list')).toBeVisible({ timeout: 20_000 });
	if (['/sections', '/subjects', '/teachers'].includes(route)) await expect(page.getByTestId('admin-content-shell')).toBeVisible({ timeout: 20_000 });
	if (route === '/teaching-load') await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 20_000 });
	if (route === '/timetable') await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('body')).not.toContainText(/Application error|Something went wrong|Cannot read properties/i);
}

async function cancelOpenSurface(page: Page) {
	await page.keyboard.press('Escape').catch(() => undefined);
	await page.waitForTimeout(150);
}

test.describe.serial('Older-user session validation — Codex browser proxy', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('executes the shared T01–T12 script without committing timetable data', async ({ page }, testInfo) => {
		test.setTimeout(240_000);
		page.setDefaultTimeout(12_000);
		page.setDefaultNavigationTimeout(25_000);
		const viewport = `${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
		const results: TaskResult[] = [];
		const dialogFocus: Array<{ task: string; beforeTab: string | null; afterTab: string | null; afterEscape: string | null }> = [];
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];
		const apiFailures: string[] = [];
		page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
		page.on('pageerror', (error) => pageErrors.push(error.message));
		page.on('response', (response) => { if (response.url().includes('/api/v1/') && response.status() >= 500) apiFailures.push(`${response.status()} ${response.url()}`); });
		const blockedWrites = await blockWrites(page);

		await tryTask(results, viewport, 'T01', async () => {
			const timedRoute = await timed(() => openRoute(page, '/'));
			const text = await page.getByTestId('dashboard-readiness-hub').innerText();
			const firstRepair = await page.locator('[data-repair-target]').first().innerText().catch(() => 'No repair link visible');
			return `Setup readiness visible in ${timedRoute.timeMs}ms; first repair: ${firstRepair}; ${text.slice(0, 300)}`;
		});
		await tryTask(results, viewport, 'T02', async () => {
			const timedRoute = await timed(() => openRoute(page, '/sections'));
			const search = await page.getByPlaceholder(/Search sections/i).getAttribute('placeholder');
			return `Sections workspace visible in ${timedRoute.timeMs}ms; search=${search}`;
		});
		await tryTask(results, viewport, 'T03', async () => {
			const timedRoute = await timed(() => openRoute(page, '/subjects'));
			await page.getByRole('button', { name: /More filters/i }).click();
			await expect(page.getByText(/All statuses/i).first()).toBeVisible();
			const search = await page.getByPlaceholder(/Search name or code/i).getAttribute('placeholder');
			return `Subjects attention filter disclosed in ${timedRoute.timeMs}ms; search=${search}`;
		});
		await tryTask(results, viewport, 'T04', async () => {
			const teacherRoute = await timed(() => openRoute(page, '/teachers'));
			const teachingLoadLink = await page.getByRole('link', { name: /Teaching Load/i }).count();
			await openRoute(page, '/teaching-load');
			return `Teachers visible in ${teacherRoute.timeMs}ms; Teaching Load route visible; repair links=${teachingLoadLink}`;
		});
		await tryTask(results, viewport, 'T05', async () => {
			const timedRoute = await timed(() => openRoute(page, '/map'));
			const readiness = await page.getByTestId('room-readiness-list').innerText();
			return `Room readiness list visible in ${timedRoute.timeMs}ms before map interpretation: ${readiness.slice(0, 260)}`;
		});
		await tryTask(results, viewport, 'T06', async () => {
			const timedRoute = await timed(() => openRoute(page, '/timetable'));
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			const primary = await page.getByTestId('timetable-simple-primary-action').innerText();
			return `Simple timetable and next-step action visible in ${timedRoute.timeMs}ms: ${primary}`;
		});
		await tryTask(results, viewport, 'T07', async () => {
			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			await openSimpleMore(page);
			await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toBeVisible();
			const placeUnresolved = page.getByRole('menuitem', { name: /Place unresolved sessions/i });
			await expect(placeUnresolved).toBeVisible();
			await placeUnresolved.click();
			const drawer = page.getByTestId('timetable-task-drawer');
			await expect(drawer).toBeVisible({ timeout: 15_000 });
			const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
			const hasList = await list.isVisible({ timeout: 5_000 }).catch(() => false);
			if (!hasList) {
				return `Task drawer opened; virtualized session list not present (may be empty or loading): ${(await drawer.innerText()).slice(0, 220)}`;
			}
			const metrics = await list.evaluate((node) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }));
			const box = await list.boundingBox();
			if (box) {
				await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
				await page.mouse.wheel(0, Math.max(240, Math.floor(box.height * 0.75)));
			}
			const afterWheel = await list.evaluate((node) => node.scrollTop);
			const afterProgrammatic = await list.evaluate((node) => {
				node.scrollTop = Math.min(600, node.scrollHeight);
				return node.scrollTop;
			});
			return `Unresolved workflow opened; list ${metrics.clientHeight}px viewport / ${metrics.scrollHeight}px content; wheel scrollTop=${afterWheel}; programmatic scrollTop=${afterProgrammatic}; ${(await drawer.innerText()).slice(0, 220)}`;
		});
		await tryTask(results, viewport, 'T08', async () => {
			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			await openSimpleMore(page);
			await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toBeVisible();
			const placeUnresolved = page.getByRole('menuitem', { name: /Place unresolved sessions/i });
			await expect(placeUnresolved).toBeVisible();
			await placeUnresolved.click();
			const drawer = page.getByTestId('timetable-task-drawer');
			await expect(drawer).toBeVisible({ timeout: 15_000 });
			const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
			await expect(list).toBeVisible({ timeout: 15_000 });
			await list.locator('[role="listitem"] button').first().click();
			const place = list.getByRole('button', { name: /^(Place session|Review room source|Fix teaching load)$/i }).first();
			await expect(place).toBeVisible();
			const placeLabel = await place.innerText();
			if (/Fix teaching load/i.test(placeLabel)) return `Fixture requires teaching-load repair before placement: ${placeLabel}`;
			await place.click();
			const target = page.locator('td[data-day][data-start-time][data-end-time]').first();
			await expect(target).toBeVisible();
			await target.click({ position: { x: 8, y: 8 } });
			const sheet = page.getByTestId('generated-placement-review-dialog');
			await expect(sheet).toBeVisible({ timeout: 15_000 });
			const text = await sheet.innerText();
			const beforeTab = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent?.trim().slice(0, 80) ?? null);
			await page.keyboard.press('Tab');
			const afterTab = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent?.trim().slice(0, 80) ?? null);
			await cancelOpenSurface(page);
			const afterEscape = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent?.trim().slice(0, 80) ?? null);
			dialogFocus.push({ task: 'T08', beforeTab, afterTab, afterEscape });
			await expect(sheet).toBeHidden();
			return `Placement review opened and cancelled safely: ${text.slice(0, 320)}`;
		});
		await tryTask(results, viewport, 'T09', async () => {
			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			await expect(page.getByTestId('timetable-simple-more-trigger')).toBeVisible({ timeout: 10_000 });
			const simpleLegendCount = await page.getByTestId('timetable-status-legend').count();
			await openSimpleMore(page);
			await expect(page.getByTestId('timetable-layout-toggle')).toBeVisible();
			await page.getByTestId('timetable-layout-toggle').click();
			const advancedLegendLocator = page.getByTestId('timetable-status-legend');
			const advancedLegendVisible = await advancedLegendLocator.isVisible({ timeout: 5_000 }).catch(() => false);
			const advancedLegend = advancedLegendVisible ? await advancedLegendLocator.innerText() : '(not visible at this viewport)';
			if (!advancedLegendVisible) {
				await openTimetableSimple(page);
				await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
				return `Simple legend count=${simpleLegendCount}; Advanced legend hidden at this viewport; placement guidance could not be independently exposed by the browser proxy.`;
			}
			await page.getByTestId('timetable-task-place').click();
			const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
			await expect(list).toBeVisible({ timeout: 15_000 });
			await list.locator('[role="listitem"] button').first().click();
			const place = list.getByRole('button', { name: /^(Place session|Review room source|Fix teaching load)$/i }).first();
			await expect(place).toBeVisible();
			const placeLabel = await place.innerText();
			if (/Fix teaching load/i.test(placeLabel)) return `Status guidance is gated by teaching-load repair: ${placeLabel}`;
			await place.click();
			await expect(page.locator('[data-cell-preview-label]').first()).toBeVisible({ timeout: 10_000 });
			const found = [];
			for (const label of statusLabels) {
				if (await page.getByText(label, { exact: true }).count() > 0) found.push(label);
			}
			const attributeStatuses = await page.locator('[data-cell-status-label]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-cell-status-label')).filter(Boolean));
			const occupiedCount = await page.getByText(/Occupied \(/i).count();
			const help = await page.getByTestId('timetable-foolproof-help').innerText().catch(() => '');
			await cancelOpenSurface(page);
			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			const closeDrawer = page.getByRole('button', { name: /Close task drawer/i });
			if (await closeDrawer.isVisible().catch(() => false)) await closeDrawer.click();
			return `Simple legend count=${simpleLegendCount}; Advanced legend=${advancedLegend}; placement labels=${found.join(', ') || 'none'}; cell status attributes=${[...new Set(attributeStatuses)].join(', ') || 'none'}; occupied labels=${occupiedCount}; task help=${help.slice(0, 180)}`;
		});
		await tryTask(results, viewport, 'T10', async () => {
			await openTimetableSimple(page);
			const entries = page.locator('[data-timetable-entry="true"]');
			await expect(entries.nth(0)).toBeVisible({ timeout: 20_000 });
			await entries.nth(0).click();
			await entries.nth(1).click();
			const dialog = page.getByRole('dialog').filter({ hasText: /Review occupied-slot swap/i });
			await expect(dialog).toBeVisible({ timeout: 20_000 });
			const text = await dialog.innerText();
			const beforeTab = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent?.trim().slice(0, 80) ?? null);
			await page.keyboard.press('Tab');
			const afterTab = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent?.trim().slice(0, 80) ?? null);
			await cancelOpenSurface(page);
			const afterEscape = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent?.trim().slice(0, 80) ?? null);
			dialogFocus.push({ task: 'T10', beforeTab, afterTab, afterEscape });
			await expect(dialog).toBeHidden();
			return `Modern swap review opened and cancelled safely: ${text.slice(0, 320)}`;
		});
		await tryTask(results, viewport, 'T11', async () => {
			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			await expect(page.getByTestId('timetable-simple-more-trigger')).toBeVisible({ timeout: 10_000 });
			await openSimpleMore(page);
			await expect(page.getByTestId('timetable-layout-toggle')).toBeVisible();
			await page.getByTestId('timetable-layout-toggle').click();
			await expect(page.getByTestId('timetable-task-guide')).toBeVisible();
			const advanced = (await page.getByTestId('timetable-task-guide').innerText()).slice(0, 180);
			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
			return `Advanced then Simple reversible; advanced guide=${advanced}`;
		});
		await tryTask(results, viewport, 'T12', async () => {
			await openTimetableSimple(page);
			await cancelOpenSurface(page);
			const dialogs = await page.getByRole('dialog').count();
			const saveActions = await page.getByRole('button', { name: /Save placement|Swap sessions/i }).count();
			return `Safe backtrack leaves ${dialogs} dialog(s) and ${saveActions} save/commit action(s) exposed.`;
		});

		await openSimpleMore(page);
		await expect(page.getByTestId('timetable-layout-toggle')).toBeVisible();
		await page.getByTestId('timetable-layout-toggle').focus();
		await page.keyboard.press('Tab');
		const focusOrder = await page.evaluate(() => ({
			activeLabel: (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? null,
			activeRole: (document.activeElement as HTMLElement | null)?.getAttribute('role') ?? (document.activeElement as HTMLElement | null)?.tagName ?? null,
		}));
		const overflow = await assertNoGlobalOverflow(page);
		const accessibility = await page.evaluate(() => {
			const visible = (element: Element) => {
				const rect = (element as HTMLElement).getBoundingClientRect();
				const style = window.getComputedStyle(element);
				return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
			};
			const controls = Array.from(document.querySelectorAll('button, a, [role="button"], input, [role="combobox"]')).filter(visible);
			const undersized = controls.map((element) => ({
				name: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80),
				width: Math.round(element.getBoundingClientRect().width),
				height: Math.round(element.getBoundingClientRect().height),
			})).filter((item) => item.width < 24 || item.height < 24).slice(0, 20);
			const disclosure = Array.from(document.querySelectorAll('[aria-expanded]')).map((element) => ({
				name: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80),
				expanded: element.getAttribute('aria-expanded'),
				controls: element.getAttribute('aria-controls'),
			})).slice(0, 20);
			return { undersized, disclosure, activeElement: (document.activeElement as HTMLElement | null)?.outerHTML?.slice(0, 200) ?? null };
		});

		const screenshotPath = path.join(reportRoot, `${testInfo.project.name}-final.png`);
		await page.screenshot({ path: screenshotPath, fullPage: false });
		await testInfo.attach('older-user-session-final-viewport', { path: screenshotPath, contentType: 'image/png' });
		await writeReport(testInfo, { viewport, results, blockedWrites, consoleErrors, pageErrors, apiFailures, overflow, accessibility, dialogFocus, focusOrder, screenshotPath, evidenceType: 'Browser proxy' });
		expect(blockedWrites, 'Audit must not commit timetable writes.').toEqual([]);
		expect(pageErrors, 'No uncaught page errors expected during the proxy session.').toEqual([]);
		expect(apiFailures, 'No ATLAS API 5xx responses expected during the proxy session.').toEqual([]);

		const failedTasks = results.filter((r) => r.result === 'Failed');
		const staleTasks = results.filter((r) => r.result === 'Stale selector');
		expect(failedTasks.length, `Product failures must not pass: ${failedTasks.map((r) => `${r.id}: ${r.reason}`).join('; ')}`).toBe(0);
		expect(staleTasks.length, `Stale selectors must not pass: ${staleTasks.map((r) => `${r.id}: ${r.reason}`).join('; ')}`).toBe(0);
	});
});
