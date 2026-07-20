import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

type ReleaseIssue = {
	route: string;
	kind: 'console' | 'pageerror' | 'response' | 'requestfailed' | 'error-boundary';
	detail: string;
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-workflow-phase06');

async function loginAdmin(page: Page) {
	const response = await page.request.post('/api/v1/auth/login', { data: credentials });
	expect(response.ok(), `Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Admin login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		sessionStorage.setItem('atlas_local_token', token);
		localStorage.setItem('atlas_timetable_tour', 'true');
	}, payload.token!);
}

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

function collectReleaseIssues(page: Page, routeLabel: () => string) {
	const issues: ReleaseIssue[] = [];
	page.on('pageerror', (error) => {
		issues.push({ route: routeLabel(), kind: 'pageerror', detail: error.message });
	});
	page.on('console', (message) => {
		if (message.type() === 'error') {
			issues.push({ route: routeLabel(), kind: 'console', detail: message.text() });
		}
	});
	page.on('response', (response) => {
		const url = response.url();
		if (response.status() >= 500 && url.includes('/api/v1/')) {
			issues.push({ route: routeLabel(), kind: 'response', detail: `${response.status()} ${url}` });
		}
	});
	page.on('requestfailed', (request) => {
		const detail = request.failure()?.errorText ?? 'unknown request failure';
		if (!detail.includes('ERR_ABORTED')) {
			issues.push({ route: routeLabel(), kind: 'requestfailed', detail: `${detail} ${request.url()}` });
		}
	});
	return issues;
}

function criticalIssues(issues: ReleaseIssue[]) {
	return issues.filter((issue) => {
		if (issue.kind === 'pageerror' || issue.kind === 'error-boundary') return true;
		if (issue.kind === 'response' && issue.detail.includes('/api/v1/')) return true;
		if (issue.kind === 'console' && /ErrorBoundary|Minified React error|Cannot read properties|Uncaught/i.test(issue.detail)) return true;
		return false;
	});
}

async function openTimetable(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 10_000 });
}

async function blockDestructiveTimetableWrites(page: Page) {
	const blocked: string[] = [];
	await page.route('**/api/v1/generation/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const pathname = url.pathname;
		const method = request.method();
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');
		const isReadOnly = method === 'GET' || method === 'HEAD';

		if (!isReadOnly && !isPreview) {
			blocked.push(`${method} ${pathname}`);
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'WORKFLOW_PHASE06_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function scrollMetrics(page: Page) {
	return page.evaluate(() => {
		const root = document.scrollingElement ?? document.documentElement;
		return {
			scrollHeight: root.scrollHeight,
			clientHeight: root.clientHeight,
			scrollWidth: root.scrollWidth,
			clientWidth: root.clientWidth,
		};
	});
}

test.describe.serial('Timetable Phase 6 release gate', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('live timetable navigation has no app-critical errors and keeps release layout bounds', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		let activeRoute = '/timetable';
		const issues = collectReleaseIssues(page, () => activeRoute);

		await openTimetable(page);
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(1_000);

		const bodyText = await page.locator('body').innerText({ timeout: 10_000 });
		if (/Something went wrong|Application error|Error Boundary|Cannot read properties/i.test(bodyText)) {
			issues.push({ route: activeRoute, kind: 'error-boundary', detail: bodyText.slice(0, 500) });
		}

		const metrics = await scrollMetrics(page);
		const firstActionVisible = await page.getByTestId('timetable-task-place').isVisible();
		const tableVisible = await page.locator('table[aria-label="Timetable"]').isVisible();

		expect(tableVisible, 'Release gate requires the timetable table to render.').toBeTruthy();
		expect(firstActionVisible, 'Release gate requires the primary timetable action to render.').toBeTruthy();
		expect(metrics.scrollHeight, `No global vertical scrollbar expected: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientHeight + 8);
		expect(metrics.scrollWidth, `No horizontal page overflow expected: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 8);
		expect(criticalIssues(issues), `No app-critical navigation issues expected: ${JSON.stringify(issues, null, 2)}`).toEqual([]);

		await attachReport(testInfo, 'navigation-release-smoke', {
			issues,
			criticalIssues: criticalIssues(issues),
			metrics,
			tableVisible,
			firstActionVisible,
		});
	});

	test('click-placement and drag hover still expose grid conflict/swap feedback without committing writes', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		await page.getByRole('button', { name: /Plan before generating|Opening draft/i }).click();
		await expect(page.getByText(/Pre-Generation Draft/i).first()).toBeVisible({ timeout: 10_000 });
		const draftQueueItem = page.locator('#panel-unassigned [role="button"]').first();
		await expect(draftQueueItem).toBeVisible({ timeout: 10_000 });
		await draftQueueItem.click();
		const targetCell = page.locator('td[role="button"][data-day][data-start-time][data-end-time]').first();
		await expect(targetCell).toBeVisible({ timeout: 10_000 });
		await targetCell.hover();
		await expect(
			targetCell.getByText(/Can place|Can swap|Blocked|Warning|Occupied|Current/i).first(),
			'Click-to-place mode must show visible grid feedback before commit.',
		).toBeVisible({ timeout: 10_000 });
		const clickFeedbackText = await targetCell.innerText();

		await page.keyboard.press('Escape');
		await openTimetable(page);

		const dragEntries = page.locator('[data-timetable-entry="true"]');
		await expect(dragEntries.nth(0)).toBeVisible({ timeout: 20_000 });
		await dragEntries.nth(0).scrollIntoViewIfNeeded();
		const sourceCell = dragEntries.nth(0).locator('xpath=ancestor::td[1]');
		const followingCell = sourceCell.locator('xpath=following-sibling::td[@data-day][1]');
		const precedingCell = sourceCell.locator('xpath=preceding-sibling::td[@data-day][1]');
		const dragTargetCell = await followingCell.count() > 0 ? followingCell : precedingCell;
		await expect(dragTargetCell).toBeVisible({ timeout: 10_000 });
		const dragSourceBox = await dragEntries.nth(0).boundingBox();
		const dragTargetBox = await dragTargetCell.boundingBox();
		expect(dragSourceBox, 'Drag source must have a measurable box.').toBeTruthy();
		expect(dragTargetBox, 'Drag target cell must have a measurable box.').toBeTruthy();

		await page.mouse.move(dragSourceBox!.x + dragSourceBox!.width / 2, dragSourceBox!.y + dragSourceBox!.height / 2);
		await page.mouse.down();
		await page.mouse.move(dragSourceBox!.x + dragSourceBox!.width / 2 + 12, dragSourceBox!.y + dragSourceBox!.height / 2, { steps: 3 });
		await page.mouse.move(dragTargetBox!.x + dragTargetBox!.width / 2, dragTargetBox!.y + dragTargetBox!.height / 2, { steps: 8 });
		await expect(
			page.getByText(/Release on a highlighted cell to review move or swap/i).first(),
			'Drag hover must show plain-language feedback before commit.',
		).toBeVisible({ timeout: 10_000 });
		const dragFeedbackText = await page.getByText(/Release on a highlighted cell to review move or swap/i).first().innerText();
		await page.keyboard.press('Escape');
		await page.mouse.up();

		expect(blockedWrites, 'Phase 6 release gate must not commit live timetable writes.').toEqual([]);
		await attachReport(testInfo, 'conflict-feedback-release-smoke', {
			clickFeedbackText,
			dragFeedbackText,
			blockedWrites,
		});
	});
});
