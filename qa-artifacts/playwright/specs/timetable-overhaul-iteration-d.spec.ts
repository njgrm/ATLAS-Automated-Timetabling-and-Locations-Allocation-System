import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAdmin, openTaskDrawer } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-overhaul-iteration-d');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function blockDestructiveTimetableWrites(page: Page) {
	const blocked: string[] = [];
	await page.route('**/api/v1/generation/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const pathname = url.pathname;
		const method = request.method();
		const isReadOnly = method === 'GET' || method === 'HEAD';
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');

		if (!isReadOnly && !isPreview) {
			blocked.push(`${method} ${pathname}`);
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'TIMETABLE_ITERATION_D_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function openTimetable(page: Page) {
	const startedAt = Date.now();
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible({ timeout: 20_000 });
	return Date.now() - startedAt;
}

async function openUnassignedRail(page: Page) {
	await openTaskDrawer(page, /Place unresolved sessions/i);
	const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
	await expect(list).toBeVisible({ timeout: 20_000 });
	await expect(list.locator('[role="listitem"]').first()).toBeVisible({ timeout: 20_000 });
	return list;
}

function targetCell(page: Page) {
	const empty = page.locator('td[data-day][data-start-time][data-end-time]').filter({
		hasNot: page.locator('[data-timetable-entry="true"]'),
	}).first();
	return empty.or(page.locator('td[data-day][data-start-time][data-end-time]').first());
}

async function expectUnifiedReview(page: Page, type: string) {
	const sheet = page.locator(`[data-testid="review-action-sheet"][data-review-action-type="${type}"]`);
	await expect(sheet).toBeVisible({ timeout: 20_000 });
	await expect(sheet).toContainText(/What changes/i);
	await expect(sheet).toContainText(/Blocks/i);
	await expect(sheet).toContainText(/Warnings/i);
	await expect(sheet).toContainText(/After save/i);
	await expect(sheet.getByText(/Assign teacher and room|Choose teacher|Choose room|Apply repair/i)).toHaveCount(0);
	return sheet;
}

test.describe.serial('Timetable overhaul Iteration D unified review and performance gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('first useful timetable action remains fast after review unification', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const navMs = await openTimetable(page);
		const metrics = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			const table = document.querySelector('table[aria-label="Timetable"]')?.getBoundingClientRect();
			const header = document.querySelector('[data-testid="timetable-simple-header"]')?.getBoundingClientRect();
			return {
				navMs: performance.now(),
				tableTop: table?.top ?? null,
				simpleHeaderHeight: header?.height ?? null,
				scrollHeight: root.scrollHeight,
				clientHeight: root.clientHeight,
				scrollWidth: root.scrollWidth,
				clientWidth: root.clientWidth,
			};
		});

		expect(navMs, `First useful timetable action should remain fast. navMs=${navMs}`).toBeLessThanOrEqual(5_000);
		expect(metrics.tableTop, `Grid should remain visually primary. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(300);
		expect(metrics.scrollHeight, `No global vertical scrollbar expected. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientHeight + 8);
		expect(metrics.scrollWidth, `No horizontal page overflow expected. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 8);

		await attachReport(testInfo, 'first-useful-action-performance', { navMs, metrics });
	});

	test('generated placement uses the unified review action sheet', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);
		const list = await openUnassignedRail(page);
		const firstCard = list.getByTestId('generated-unassigned-card').first();
		await expect(firstCard).toBeVisible({ timeout: 20_000 });
		await firstCard.click();
		await expect(list.getByRole('button', { name: /^(Place session|Review room source)$/i }).first()).toBeVisible({ timeout: 10_000 });
		await list.getByRole('button', { name: /^(Place session|Review room source)$/i }).first().click();
		await expect(page.locator('[data-cell-preview-label]').first()).toBeVisible({ timeout: 10_000 });
		await targetCell(page).click({ position: { x: 8, y: 8 } });

		const sheet = await expectUnifiedReview(page, 'generated-placement');
		await expect(sheet).toContainText(/Room source/i);
		await expect(page.getByRole('button', { name: /Save placement/i })).toBeVisible({ timeout: 10_000 });
		expect(blockedWrites, 'Generated placement review should not commit before Save placement.').toEqual([]);

		await attachReport(testInfo, 'generated-placement-unified-review', {
			dialogText: await page.getByTestId('generated-placement-review-dialog').innerText(),
			blockedWrites,
		});
	});

	test('generated occupied-slot swap uses the unified review action sheet', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);
		await openTaskDrawer(page, /Swap sessions/i);

		const entries = page.locator('[data-timetable-entry="true"]');
		await expect(entries.nth(0)).toBeVisible({ timeout: 20_000 });
		await entries.nth(0).click();
		await expect(entries.nth(1)).toBeVisible({ timeout: 20_000 });
		await entries.nth(1).click();

		const dialog = page.getByRole('dialog').filter({ hasText: /Review occupied-slot swap/i });
		await expect(dialog).toBeVisible({ timeout: 20_000 });
		const sheet = await expectUnifiedReview(page, 'generated-swap');
		await expect(sheet).toContainText(/Swap options/i);
		await expect(dialog.getByRole('button', { name: /Swap sessions/i })).toBeVisible({ timeout: 10_000 });
		expect(blockedWrites, 'Generated swap review should not commit before Swap sessions.').toEqual([]);

		await attachReport(testInfo, 'generated-swap-unified-review', {
			dialogText: await dialog.innerText(),
			blockedWrites,
		});
	});

	test('draft placement uses the unified review action sheet', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);
		await openTaskDrawer(page, /Plan before generating/i);
		await expect(page.locator('#panel-unassigned').getByText(/Pre-Generation Draft/i).first()).toBeVisible({ timeout: 15_000 });
		const draftQueueItem = page.locator('#panel-unassigned [role="button"]').first();
		await expect(draftQueueItem).toBeVisible({ timeout: 15_000 });
		await draftQueueItem.click();
		const cell = page.locator('td[role="button"][data-day][data-start-time][data-end-time]').first();
		await expect(cell).toBeVisible({ timeout: 15_000 });
		await cell.click({ position: { x: 8, y: 8 } });

		const dialog = page.getByRole('dialog').filter({ hasText: /Review draft placement/i });
		await expect(dialog).toBeVisible({ timeout: 20_000 });
		await expectUnifiedReview(page, 'draft-placement');
		await expect(dialog.getByRole('button', { name: /Save placement/i })).toBeVisible({ timeout: 10_000 });
		expect(blockedWrites, 'Draft placement review should not commit before Save placement.').toEqual([]);

		await attachReport(testInfo, 'draft-placement-unified-review', {
			dialogText: await dialog.innerText(),
			blockedWrites,
		});
	});
});
