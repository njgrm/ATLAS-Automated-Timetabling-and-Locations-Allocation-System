import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin, openTimetableSimple } from './timetable-layout-helpers';

type DraftPayload = {
	entries?: Array<Record<string, unknown>>;
	draftEntries?: Array<Record<string, unknown>>;
};

async function installCrowdedCellFixture(page: Page) {
	const facultyResponse = await page.request.get('/api/v1/faculty?schoolId=1');
	const facultyPayload = await facultyResponse.json() as { faculty?: Array<{ id: number; status?: string; isActive?: boolean }> };
	const activeFacultyId = facultyPayload.faculty?.find((faculty) => faculty.isActive !== false && faculty.status !== 'INACTIVE')?.id
		?? facultyPayload.faculty?.[0]?.id
		?? 24065;
	await page.route('**/api/v1/generation/**/runs/**/draft', async (route) => {
		if (route.request().method() !== 'GET') {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		const payload = await response.json() as DraftPayload;
		const entries = Array.isArray(payload.entries)
			? payload.entries
			: Array.isArray(payload.draftEntries)
				? payload.draftEntries
				: [];
		if (entries.length < 4) {
			await route.fulfill({ response });
			return;
		}
		const reassignableEntries = entries.filter((entry) => Number.isFinite(Number(entry.facultyId)));
		const fixtureEntries = reassignableEntries.length >= 4 ? reassignableEntries : entries;
		const firstSectionId = fixtureEntries
			.map((entry) => Number(entry.sectionId))
			.filter((id) => Number.isFinite(id))
			.sort((a, b) => a - b)[0];
		const template = fixtureEntries.find((entry) => Number(entry.sectionId) === firstSectionId) ?? fixtureEntries[0];
		const slotDay = String(template.day ?? 'MONDAY');
		const slotStart = String(template.startTime ?? '07:30');
		const slotEnd = String(template.endTime ?? '08:30');
		const crowdedIds = new Set(fixtureEntries.slice(0, 3).map((entry) => String(entry.entryId)));
		const crowded = entries.map((entry) => crowdedIds.has(String(entry.entryId))
			? {
				...entry,
				sectionId: firstSectionId,
				facultyId: Number(entry.facultyId) || activeFacultyId,
				day: slotDay,
				startTime: slotStart,
				endTime: slotEnd,
			}
			: entry);
		const nextPayload = Array.isArray(payload.entries)
			? { ...payload, entries: crowded }
			: { ...payload, draftEntries: crowded };
		await route.fulfill({
			status: response.status(),
			headers: { ...response.headers(), 'content-type': 'application/json' },
			body: JSON.stringify(nextPayload),
		});
	});
}

async function clickOverflowAction(page: Page, row: ReturnType<Page['locator']>, actionName: RegExp) {
	const visibleDirect = row.getByRole('button', { name: actionName }).first();
	if (await visibleDirect.isVisible().catch(() => false)) {
		await visibleDirect.click();
		return;
	}
	await row.getByRole('button', { name: /More/i }).click();
	await page.getByRole('menuitem', { name: actionName }).click();
}

test.describe.serial('Timetable finalization grid overflow', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
		await installCrowdedCellFixture(page);
		await openTimetableSimple(page);
	});

	test('crowded cells expose all hidden sessions with readable actions', async ({ page }) => {
		const overflowTrigger = page.getByTestId('timetable-cell-overflow-trigger').first();
		await expect(overflowTrigger).toBeVisible({ timeout: 30_000 });
		await overflowTrigger.click();

		const sheet = page.getByTestId('timetable-cell-overflow-sheet');
		await expect(sheet).toBeVisible({ timeout: 10_000 });
		const rows = sheet.getByTestId('timetable-cell-overflow-entry');
		await expect(rows).toHaveCount(await rows.count());
		expect(await rows.count(), 'Overflow drawer should show every session in the crowded cell.').toBeGreaterThan(2);
		await expect(sheet.getByTestId('timetable-cell-overflow-select-action').first()).toBeVisible();
		if ((page.viewportSize()?.width ?? 1366) < 640) {
			await expect(rows.first().getByRole('button', { name: /More/i })).toBeVisible();
		} else {
			await expect(sheet.getByTestId('timetable-cell-overflow-swap-action').first()).toBeVisible();
			await expect(sheet.getByTestId('timetable-cell-overflow-reassign-action').locator(':scope').first()).toBeVisible();
		}
		await assertNoGlobalOverflow(page);
	});

	test('hidden overflow session can participate in selected-session swap review', async ({ page }) => {
		const overflowTrigger = page.getByTestId('timetable-cell-overflow-trigger').first();
		await expect(overflowTrigger).toBeVisible({ timeout: 30_000 });

		const overflowEntryIds = (await overflowTrigger.getAttribute('data-overflow-entry-ids') ?? '').split(/\s+/).filter(Boolean);
		expect(overflowEntryIds.length, 'Overflow trigger must expose hidden entry ids.').toBeGreaterThan(0);
		const hiddenEntryId = overflowEntryIds[0];
		const sourceEntry = page.locator(`[data-timetable-entry="true"]:not([data-timetable-entry-id="${hiddenEntryId}"])`).first();
		await expect(sourceEntry).toBeVisible({ timeout: 20_000 });
		await sourceEntry.click();

		await overflowTrigger.click();
		const sheet = page.getByTestId('timetable-cell-overflow-sheet');
		await expect(sheet).toBeVisible({ timeout: 10_000 });
		const hiddenRow = sheet.locator(`[data-testid="timetable-cell-overflow-entry"][data-timetable-entry-id="${hiddenEntryId}"]`).first();
		await clickOverflowAction(page, hiddenRow, /Swap/i);

		const swapDialog = page.getByRole('dialog').filter({ hasText: /Review occupied-slot swap/i });
		await expect(swapDialog).toBeVisible({ timeout: 15_000 });
		await expect(swapDialog).toContainText(/exchange times/i);
		await assertNoGlobalOverflow(page);
	});

	test('hidden overflow session can launch teacher reassignment recovery', async ({ page }) => {
		const overflowTrigger = page.getByTestId('timetable-cell-overflow-trigger').first();
		await expect(overflowTrigger).toBeVisible({ timeout: 30_000 });
		await overflowTrigger.click();

		const firstRow = page.getByTestId('timetable-cell-overflow-entry').filter({ has: page.locator('[data-faculty-id], [data-testid="timetable-cell-overflow-reassign-action"]') }).first();
		await expect(firstRow).toBeVisible({ timeout: 10_000 });
		await clickOverflowAction(page, firstRow, /Reassign/i);

		const sheet = page.getByTestId('teacher-departure-recovery-sheet');
		await expect(sheet).toBeVisible({ timeout: 20_000 });
		await expect(sheet).toContainText(/Teacher leaving/i);
		await expect(sheet.getByTestId('teacher-departure-affected-row').first()).toBeVisible({ timeout: 20_000 });
		await assertNoGlobalOverflow(page);
	});
});
