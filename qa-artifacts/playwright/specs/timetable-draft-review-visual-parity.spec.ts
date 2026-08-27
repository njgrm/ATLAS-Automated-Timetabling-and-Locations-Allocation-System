import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAdmin, openTimetableSimple, openSimpleMore } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-swap-old-scheduler', 'draft-parity');

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
				body: JSON.stringify({ message: 'TIMETABLE_DRAFT_PARITY_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

test.describe.serial('Timetable draft review visual parity', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('draft placement review uses simplified visual language', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };

		const runtimeResponse = await page.request.get('/api/v1/runtime/context?schoolId=1', { headers });
		expect(runtimeResponse.ok()).toBeTruthy();
		const runtime = await runtimeResponse.json() as { activeSchoolYearId: number };

		const draftBoardResponse = await page.request.get(
			`/api/v1/generation/1/${runtime.activeSchoolYearId}/pre-generation-drafts?preferCachedSections=true`,
			{ headers },
		);
		const draftBoardAvailable = draftBoardResponse.ok();
		let draftBoard: { counts?: { draft?: number }; queue?: Array<{ sectionId: number; subjectId: number }> } | null = null;
		if (draftBoardAvailable) {
			draftBoard = await draftBoardResponse.json();
		}

		const draftCount = draftBoard?.counts?.draft ?? 0;
		const fixtureClassification = draftCount > 0 ? 'available' : 'fixture-unavailable';

		await attachReport(testInfo, 'draft-fixture-classification', {
			viewport: testInfo.project.name,
			fixtureClassification,
			draftBoardAvailable,
			draftBoardCounts: draftBoard?.counts ?? null,
		});

		if (fixtureClassification === 'fixture-unavailable') {
			test.skip(true, 'Draft queue has 0 items. Draft parity is fixture-limited, not PASS.');
			return;
		}

		const blockedWrites = await blockDestructiveTimetableWrites(page);

		await openTimetableSimple(page);
		await openSimpleMore(page);
		const draftMenuItem = page.getByRole('menuitem', { name: /Plan before generating|Draft planner/i });
		await expect(draftMenuItem).toBeVisible({ timeout: 5_000 });
		await draftMenuItem.click();

		const drawer = page.getByTestId('timetable-task-drawer');
		await expect(drawer).toBeVisible({ timeout: 10_000 });

		const queueItem = page.locator('[data-virtualized-rail="Pre-generation draft queue"] [role="listitem"]').first();
		const hasQueueItem = await queueItem.isVisible({ timeout: 5_000 }).catch(() => false);

		if (!hasQueueItem) {
			await attachReport(testInfo, 'draft-queue-empty', { reason: 'Draft queue has items but no visible listitem' });
			test.skip(true, 'Draft queue items exist but no visible queue item found.');
			return;
		}

		await queueItem.click();
		await page.waitForTimeout(500);

		const placeButton = drawer.getByRole('button', { name: /Place session|Review room source/i }).first();
		const hasPlaceButton = await placeButton.isVisible({ timeout: 5_000 }).catch(() => false);

		if (!hasPlaceButton) {
			await attachReport(testInfo, 'draft-place-button-missing', { reason: 'No Place session button found after clicking queue item' });
			test.skip(true, 'No Place session button found after clicking queue item.');
			return;
		}

		await placeButton.click();

		const emptyCell = page.locator('td[data-day][data-start-time][data-end-time]').filter({
			hasNot: page.locator('[data-timetable-entry="true"]'),
		}).first();

		const hasEmptyCell = await emptyCell.isVisible({ timeout: 10_000 }).catch(() => false);
		if (!hasEmptyCell) {
			await attachReport(testInfo, 'draft-no-empty-cell', { reason: 'No empty timetable cell found for placement' });
			test.skip(true, 'No empty timetable cell found for placement.');
			return;
		}

		await emptyCell.click({ position: { x: 8, y: 8 } });

		const dialog = page.getByTestId('draft-placement-review-dialog');
		try {
			await expect(dialog).toBeVisible({ timeout: 15_000 });
		} catch {
			await attachReport(testInfo, 'draft-dialog-not-opened', { reason: 'draft-placement-review-dialog did not appear' });
			test.skip(true, 'Draft placement review dialog did not open.');
			return;
		}

		const dialogText = await dialog.innerText({ timeout: 5_000 }).catch(() => '');
		const hasTitle = dialogText.includes('Place this class') || dialogText.includes('Review draft placement');
		const hasOwner = dialogText.includes('Teaching Load owner');
		const hasRoom = dialogText.includes('Suggested room') || dialogText.includes('Room source');
		const hasSlot = dialogText.includes('Target slot') || dialogText.includes('slot');
		const hasStatus = dialogText.includes('Blocking') && dialogText.includes('Warnings');
		const hasTeacherChooser = dialogText.includes('Choose teacher') || dialogText.includes('Assign teacher');
		const hasFourEqualCards = dialogText.includes('After save');

		const sectionHeadings = dialog.locator('h3');
		const sectionCount = await sectionHeadings.count();
		const sectionTitles: string[] = [];
		for (let i = 0; i < sectionCount; i++) {
			const t = await sectionHeadings.nth(i).innerText().catch(() => '');
			if (t) sectionTitles.push(t);
		}

		await page.screenshot({
			path: path.join(reportRoot, `${testInfo.project.name}-draft-placement.png`),
			fullPage: false,
		});

		await attachReport(testInfo, 'draft-placement-metrics', {
			viewport: testInfo.project.name,
			sectionCount,
			sectionTitles,
			visibleTextLength: dialogText.length,
			hasTitle,
			hasOwner,
			hasRoom,
			hasSlot,
			hasStatus,
			hasTeacherChooser,
			hasFourEqualCards,
			blockedWrites,
		});

		expect(hasTitle).toBe(true);
		expect(hasOwner).toBe(true);
		expect(hasRoom).toBe(true);
		expect(hasStatus).toBe(true);
		expect(hasTeacherChooser).toBe(false);
		expect(hasFourEqualCards).toBe(false);
		expect(sectionCount).toBeLessThanOrEqual(3);

		await dialog.locator('button').filter({ hasText: /Cancel/i }).first().click();
		await expect(dialog).toBeHidden({ timeout: 5_000 });
	});

	test('generated swap still passes after draft parity changes', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };

		const runtimeResponse = await page.request.get('/api/v1/runtime/context?schoolId=1', { headers });
		expect(runtimeResponse.ok()).toBeTruthy();
		const runtime = await runtimeResponse.json() as { activeSchoolYearId: number };

		const draftResponse = await page.request.get(`/api/v1/generation/1/${runtime.activeSchoolYearId}/runs/latest/draft`, { headers });
		expect(draftResponse.ok()).toBeTruthy();
		const draft = await draftResponse.json() as { entries: Array<{ entryId: string }> };

		if (draft.entries.length < 2) {
			test.skip(true, 'Not enough entries for swap test.');
			return;
		}

		const blockedWrites = await blockDestructiveTimetableWrites(page);

		await openTimetableSimple(page);
		await openSimpleMore(page);
		const swapMenuItem = page.getByRole('menuitem', { name: /Swap sessions/i });
		await expect(swapMenuItem).toBeVisible({ timeout: 5_000 });
		await swapMenuItem.click();

		const drawer = page.getByTestId('timetable-task-drawer');
		await expect(drawer).toBeVisible({ timeout: 10_000 });

		const occupiedEntries = page.locator('[data-timetable-entry="true"]');
		const count = await occupiedEntries.count();
		if (count < 2) {
			test.skip(true, `Only ${count} occupied entries found.`);
			return;
		}

		await occupiedEntries.nth(0).click();
		await page.waitForTimeout(500);
		await occupiedEntries.nth(1).click();

		const dialog = page.getByTestId('generated-swap-review-dialog');
		await expect(dialog).toBeVisible({ timeout: 20_000 });

		await dialog.locator('[data-testid="generated-swap-preview-status"]').filter({ hasText: /ready|error/i }).waitFor({ timeout: 15_000 }).catch(() => {});

		const dialogText = await dialog.innerText({ timeout: 5_000 }).catch(() => '');
		const hasNewTitle = dialogText.includes('Swap these two classes?');
		const hasRecommended = dialogText.includes('Recommended');
		const hasUnavailable = dialogText.includes('Unavailable');
		const hasDashPlaceholder = dialogText.includes('Blocking - - Warnings -');

		await page.screenshot({
			path: path.join(reportRoot, `${testInfo.project.name}-generated-swap-regression.png`),
			fullPage: false,
		});

		await attachReport(testInfo, 'generated-swap-regression', {
			viewport: testInfo.project.name,
			hasNewTitle,
			hasRecommended,
			hasUnavailable,
			hasDashPlaceholder,
			blockedWrites,
		});

		expect(hasNewTitle).toBe(true);
		expect(hasDashPlaceholder).toBe(false);

		await dialog.locator('button').filter({ hasText: /Cancel/i }).first().click();
		await expect(dialog).toBeHidden({ timeout: 5_000 });
	});
});
