import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAdmin, openTaskDrawer, openTimetableSimple } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-overhaul-iteration-b');

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
				body: JSON.stringify({ message: 'TIMETABLE_ITERATION_B_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function openUnassignedRail(page: Page) {
	await openTaskDrawer(page, /Place unresolved sessions/i);
	const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
	await expect(list).toBeVisible({ timeout: 20_000 });
	await expect(list.locator('[role="listitem"]').first()).toBeVisible({ timeout: 20_000 });
	return list;
}

async function selectFirstGeneratedUnassignedForPlacement(page: Page) {
	const list = await openUnassignedRail(page);
	const firstCard = list.getByTestId('generated-unassigned-card').first();
	await expect(firstCard).toBeVisible({ timeout: 20_000 });
	await firstCard.click();
	await expect(list.getByText(/Needs room|Ready to place|Check slot/i).first()).toBeVisible({ timeout: 10_000 });
	const action = list.getByRole('button', { name: /^(Place session|Review room source)$/i }).first();
	await expect(action).toBeVisible({ timeout: 10_000 });
	await action.click();
	return list;
}

function targetCell(page: Page) {
	const empty = page.locator('td[data-day][data-start-time][data-end-time]').filter({
		hasNot: page.locator('[data-timetable-entry="true"]'),
	}).first();
	return empty.or(page.locator('td[data-day][data-start-time][data-end-time]').first());
}

async function expectGeneratedPlacementDialog(page: Page) {
	const dialog = page.getByTestId('generated-placement-review-dialog');
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	await expect(dialog).toContainText(/Review generated placement/i);
	await expect(dialog).toContainText(/Teaching Load owner/i);
	await expect(dialog).toContainText(/Room source/i);
	await expect(dialog).toContainText(/does not change the Teaching Load owner/i);
	await expect(dialog.getByText(/Assign teacher and room|Choose teacher|Choose room/i)).toHaveCount(0);
	return dialog;
}

test.describe.serial('Timetable overhaul Iteration B placement and swap contract', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('click-to-place missing-room generated unassigned opens generated placement review', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };
		const runtimeResponse = await page.request.get('/api/v1/runtime/context?schoolId=1', { headers });
		expect(runtimeResponse.ok()).toBeTruthy();
		const runtime = await runtimeResponse.json() as { activeSchoolYearId: number };
		const draftResponse = await page.request.get(`/api/v1/generation/1/${runtime.activeSchoolYearId}/runs/latest/draft`, { headers });
		expect(draftResponse.ok()).toBeTruthy();
		const latestDraft = await draftResponse.json() as {
			unassignedItems: Array<{ facultyId?: number | null; homeRoomId?: number | null }>;
		};
		const missingRoomCount = latestDraft.unassignedItems.filter((item) => item.facultyId != null && item.homeRoomId == null).length;
		test.skip(missingRoomCount === 0, 'Current live fixture has no missing-room generated unassigned item.');

		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetableSimple(page);
		await selectFirstGeneratedUnassignedForPlacement(page);
		await expect(page.locator('[data-cell-preview-label]').first()).toBeVisible({ timeout: 10_000 });
		await targetCell(page).click({ position: { x: 8, y: 8 } });
		const dialog = await expectGeneratedPlacementDialog(page);

		await attachReport(testInfo, 'click-generated-placement-review', {
			activeSchoolYearId: runtime.activeSchoolYearId,
			missingRoomCount,
			dialogText: await dialog.innerText(),
			blockedWrites,
		});
	});

	test('dragging generated unassigned to the grid opens the same review without committing', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await loginAdmin(page);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetableSimple(page);
		await openUnassignedRail(page);

		const source = page.locator('[aria-label^="Unassigned session"]').first();
		await expect(source).toBeVisible({ timeout: 20_000 });
		const target = targetCell(page);
		await expect(target).toBeVisible({ timeout: 20_000 });

		await source.dragTo(target, {
			sourcePosition: { x: 18, y: 18 },
			targetPosition: { x: 14, y: 14 },
			force: true,
		});

		const dialog = await expectGeneratedPlacementDialog(page);
		expect(blockedWrites, 'Drag review should not commit until Save placement is pressed.').toEqual([]);
		await attachReport(testInfo, 'drag-generated-placement-review', {
			dialogText: await dialog.innerText(),
			blockedWrites,
		});
	});

	test('generated occupied-slot swap still opens modern visual swap review', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await loginAdmin(page);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetableSimple(page);
		await openTaskDrawer(page, /Swap sessions/i);

		const entries = page.locator('[data-timetable-entry="true"]');
		await expect(entries.nth(0)).toBeVisible({ timeout: 20_000 });
		await entries.nth(0).click();
		await expect(entries.nth(1)).toBeVisible({ timeout: 20_000 });
		await entries.nth(1).click();

		const dialog = page.getByRole('dialog').filter({ hasText: /Review occupied-slot swap/i });
		await expect(dialog).toBeVisible({ timeout: 20_000 });
		await expect(dialog.getByRole('button', { name: /Swap sessions/i })).toBeVisible({ timeout: 10_000 });
		await expect(dialog.getByText(/Assign teacher and room|Choose teacher|Choose room|Apply repair/i)).toHaveCount(0);

		await attachReport(testInfo, 'swap-review-contract', {
			dialogText: await dialog.innerText(),
			blockedWrites,
		});
	});
});
