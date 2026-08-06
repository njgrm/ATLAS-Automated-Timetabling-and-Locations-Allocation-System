import { expect, test } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin, openSelectedClassTeacherDeparture, openTimetableSimple } from './timetable-layout-helpers';

async function openTeacherDepartureFromMore(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: /^More$/i }).click();
	await page.getByTestId('teacher-departure-trigger').click();
	const sheet = page.getByTestId('teacher-departure-recovery-sheet');
	await expect(sheet).toBeVisible({ timeout: 20_000 });
	return sheet;
}

test.describe.serial('Timetable teacher departure recovery', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
		await openTimetableSimple(page);
	});

	test('simple view exposes teacher departure recovery within two interactions', async ({ page }) => {
		const sheet = await openTeacherDepartureFromMore(page);
		await expect(sheet).toContainText(/Which teacher is leaving\?/i);
		await expect(sheet.getByTestId('teacher-departure-stepper')).toBeVisible();
		await expect(sheet).not.toContainText(/Replacement teacher/i);
		await expect(page.getByTestId('teacher-departure-next-button')).toBeDisabled();
		await expect(page.getByTestId('teacher-departure-save-reason')).toContainText(/Choose the teacher who is leaving|No generated run is loaded/i);
		await assertNoGlobalOverflow(page);
	});

	test('selected generated class exposes reassignment and highlights affected blocks', async ({ page }) => {
		const entryWithTeacher = page.locator('[data-timetable-entry="true"][data-faculty-id]:not([data-faculty-id=""])').first();
		await expect(entryWithTeacher).toBeVisible({ timeout: 30_000 });
		const facultyId = await entryWithTeacher.getAttribute('data-faculty-id');
		expect(facultyId, 'Fixture must expose a selected teacher id.').toBeTruthy();

		await entryWithTeacher.click();
		const sheet = await openSelectedClassTeacherDeparture(page);
		await expect(sheet).toContainText(/Affected sessions/i);
		await expect(page.getByTestId('teacher-departure-show-affected-only')).toBeVisible();
		await expect(page.getByTestId('teacher-departure-jump-first-affected')).toBeVisible();
		await expect(page.getByTestId('teacher-departure-show-group-on-grid').first()).toBeVisible({ timeout: 10_000 });
		await page.getByTestId('teacher-departure-show-affected-only').click();
		await page.getByTestId('teacher-departure-jump-first-affected').click();
		await expect(page.getByTestId('teacher-departure-grid-badge').first()).toBeVisible({ timeout: 10_000 });
		await assertNoGlobalOverflow(page);
	});
});
