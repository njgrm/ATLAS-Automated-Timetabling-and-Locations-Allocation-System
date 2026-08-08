import { expect, test, type Page } from '@playwright/test';
import { assertNoGlobalOverflow, loginAdmin, openTimetableSimple } from './timetable-layout-helpers';

async function openSimpleScheduleSwitcher(page: Page) {
	const viewport = page.viewportSize();
	if ((viewport?.width ?? 1366) < 1024) {
		const sheet = page.getByTestId('timetable-simple-schedule-sheet');
		if (await sheet.isVisible().catch(() => false)) {
			const switcher = sheet.getByTestId('timetable-simple-schedule-switcher');
			await expect(switcher).toBeVisible();
			return switcher;
		}
		await page.getByRole('button', { name: /Showing .* schedule/i }).click();
		await expect(sheet).toBeVisible();
		const switcher = sheet.getByTestId('timetable-simple-schedule-switcher');
		await expect(switcher).toBeVisible();
		return switcher;
	}
	const switcher = page.getByTestId('timetable-simple-schedule-switcher');
	await expect(switcher).toBeVisible();
	return switcher;
}

async function openSimpleMore(page: Page) {
	await page.getByTestId('timetable-simple-more-trigger').click();
	await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toBeVisible();
	await expect(page.getByTestId('timetable-simple-more-schedule-data')).toBeVisible();
	await expect(page.getByTestId('timetable-simple-more-expert-tools')).toBeVisible();
}

test.describe('Timetable Simple View Completion', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
		await openTimetableSimple(page);
	});

	test('simple view exposes section teacher room schedule switching without advanced view', async ({ page }) => {
		const switcher = await openSimpleScheduleSwitcher(page);
		await expect(switcher.getByTestId('timetable-simple-view-mode-select')).toBeVisible();
		await expect(switcher.getByTestId('timetable-simple-entity-select')).toBeVisible();

		await switcher.getByTestId('timetable-simple-view-mode-select').click();
		await page.getByRole('option', { name: /^Teacher$/i }).click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		await expect(switcher).toHaveAttribute('data-view-mode', 'faculty');

		const teacherSwitcher = await openSimpleScheduleSwitcher(page);
		await teacherSwitcher.getByTestId('timetable-simple-view-mode-select').click();
		await page.getByRole('option', { name: /^Room$/i }).click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		await expect(teacherSwitcher).toHaveAttribute('data-view-mode', 'room');

		const roomSwitcher = await openSimpleScheduleSwitcher(page);
		await roomSwitcher.getByTestId('timetable-simple-view-mode-select').click();
		await page.getByRole('option', { name: /^Section$/i }).click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		await expect(roomSwitcher).toHaveAttribute('data-view-mode', 'section');

		await assertNoGlobalOverflow(page);
	});

	test('simple filters open a popover and do not switch to advanced view', async ({ page }) => {
		await openSimpleMore(page);
		await page.getByTestId('timetable-filters-trigger').click();
		const filters = page.getByTestId('timetable-simple-filters-popover');
		await expect(filters).toBeVisible();
		await expect(filters).toContainText(/Program/i);
		await expect(filters).toContainText(/Entry type/i);
		await expect(filters).toContainText(/Attention/i);
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		await page.getByRole('button', { name: /^Done$/i }).click();
		await assertNoGlobalOverflow(page);
	});

	test('simple tutorial opens only by explicit trigger and teaches the simple controls', async ({ page }) => {
		await expect(page.getByTestId('timetable-simple-tutorial')).toHaveCount(0);
		await page.getByTestId('timetable-simple-tutorial-trigger').click();
		const tutorial = page.getByTestId('timetable-simple-tutorial');
		await expect(tutorial).toBeVisible();
		await expect(tutorial).toContainText(/Simple timetable tutorial/i);
		await expect(tutorial).toContainText(/Step 1 of 7/i);
		await expect(tutorial).toContainText(/Section, Teacher, and Room/i);
		await expect(page.getByTestId('simple-visual-help-step')).toBeVisible();
		await expect(tutorial.getByRole('button', { name: /show me/i })).toBeVisible();

		await page.getByTestId('timetable-simple-tutorial-next').click();
		await expect(tutorial).toContainText(/Step 2 of 7/i);
		await expect(tutorial).toContainText(/specific section, teacher, or room/i);
		await page.getByTestId('timetable-simple-tutorial-back').click();
		await expect(tutorial).toContainText(/Step 1 of 7/i);
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('timetable-simple-tutorial')).toHaveCount(0);
		await assertNoGlobalOverflow(page);
	});

	test('selected class details stay readable inside simple view', async ({ page }) => {
		const firstEntry = page.locator('[data-timetable-entry="true"]').first();
		const hasEntry = await firstEntry.isVisible({ timeout: 5_000 }).catch(() => false);
		test.skip(!hasEntry, 'No current-year timetable entries are available in this Tailnet fixture; selected-class details require a populated schedule.');
		await expect(firstEntry).toBeVisible({ timeout: 30_000 });
		await firstEntry.click();
		await expect(page.getByTestId('timetable-selection-strip')).toBeVisible();
		await expect(page.getByTestId('simple-selected-primary-action')).toBeVisible();
		await page.getByTestId('simple-selected-more-actions').click();
		await page.getByTestId('timetable-simple-selected-details-action').click();
		const details = page.getByTestId('timetable-simple-details-sheet');
		await expect(details).toBeVisible();
		await expect(details).toContainText(/Simple class summary/i);
		await expect(details).toContainText(/Class/i);
		await expect(details).toContainText(/Teacher/i);
		await expect(details).toContainText(/Room/i);
		await expect(details.getByTestId('simple-details-summary-card')).toHaveCount(5);
		await expect(details).toContainText(/Reassign teacher/i);
		await expect(details).toContainText(/Swap/i);
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		await assertNoGlobalOverflow(page);
	});
});
