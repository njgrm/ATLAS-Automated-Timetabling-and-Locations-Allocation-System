import { expect, test } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin, openTimetableSimple } from './timetable-layout-helpers';

type DraftPayload = {
	entries?: Array<Record<string, unknown>>;
	draftEntries?: Array<Record<string, unknown>>;
};

function headerBudgetFor(width: number, height: number) {
	if (width >= 900) return 88;
	if (height < 500) return 76;
	return 96;
}

async function expectNoRawUnknownLabels(page: import('@playwright/test').Page) {
	const rawUnknown = page.getByText(/Unknown (Subject|Room|Section|Faculty) \(#/i);
	await expect(rawUnknown).toHaveCount(0);
}

async function installCrowdedCellFixture(page: import('@playwright/test').Page) {
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
		const slotEnd = String(template.endTime ?? '08:15');
		const crowdedIds = new Set(fixtureEntries.slice(0, 4).map((entry) => String(entry.entryId)));
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
		await route.fulfill({
			status: response.status(),
			headers: { ...response.headers(), 'content-type': 'application/json' },
			body: JSON.stringify(Array.isArray(payload.entries) ? { ...payload, entries: crowded } : { ...payload, draftEntries: crowded }),
		});
	});
}

test.describe('Timetable visual readiness for older schedulers', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
		await installCrowdedCellFixture(page);
		await openTimetableSimple(page);
	});

	test('simple view keeps names trustworthy and the header compact', async ({ page }) => {
		if ((page.viewportSize()?.width ?? 0) >= 768) {
			await expect(page.getByTestId('timetable-lookup-status')).toBeVisible({ timeout: 20_000 });
		}
		await expect(page.getByTestId('timetable-simple-next-action')).toBeVisible();
		await expectNoRawUnknownLabels(page);

		const viewport = page.viewportSize() ?? { width: 1366, height: 768 };
		const headerBox = await page.getByTestId('timetable-simple-header').boundingBox();
		expect(headerBox?.height ?? 999, `Simple header should stay calm and compact for ${viewport.width}x${viewport.height}.`).toBeLessThanOrEqual(headerBudgetFor(viewport.width, viewport.height));
		await assertNoGlobalOverflow(page);
	});

	test('overflow and teacher-departure sheets are visually isolated from the grid', async ({ page }) => {
		const overflowTrigger = page.getByTestId('timetable-cell-overflow-trigger').first();
		await expect(overflowTrigger).toBeVisible({ timeout: 30_000 });
		await overflowTrigger.click();

		const overflowSheet = page.getByTestId('timetable-cell-overflow-sheet');
		await expect(overflowSheet).toBeVisible({ timeout: 10_000 });
		await expect(overflowSheet.getByTestId('timetable-overflow-secondary-menu').first()).toBeVisible();
		await expectNoRawUnknownLabels(page);

		const overflowBackground = await overflowSheet.evaluate((node) => getComputedStyle(node).backgroundColor);
		expect(overflowBackground, 'Overflow sheet must have an explicit opaque background.').not.toMatch(/rgba\([^)]*,\s*0\)/i);

		const firstOverflowRow = overflowSheet.getByTestId('timetable-cell-overflow-entry').first();
		const reassignAction = firstOverflowRow.getByRole('button', { name: /Reassign/i }).first();
		if (await reassignAction.isVisible().catch(() => false)) {
			await reassignAction.click();
		} else {
			await firstOverflowRow.getByRole('button', { name: /More/i }).click();
			await page.getByRole('menuitem', { name: /Reassign/i }).click();
		}

		const teacherSheet = page.getByTestId('teacher-departure-recovery-sheet');
		await expect(teacherSheet).toBeVisible({ timeout: 20_000 });
		await expect(teacherSheet.getByTestId('teacher-departure-stepper')).toBeVisible();
		const teacherBackground = await teacherSheet.evaluate((node) => getComputedStyle(node).backgroundColor);
		expect(teacherBackground, 'Teacher departure sheet must have an explicit opaque background.').not.toMatch(/rgba\([^)]*,\s*0\)/i);
		await assertNoGlobalOverflow(page);
	});
});
