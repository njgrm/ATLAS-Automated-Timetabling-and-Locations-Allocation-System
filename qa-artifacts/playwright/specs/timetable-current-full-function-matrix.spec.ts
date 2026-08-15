import { expect, test, type Page } from '@playwright/test';

import {
	assertNoGlobalOverflow,
	loginAdmin,
	openSelectedClassTeacherDeparture,
	openPrimaryTaskDrawer,
	openSimpleMore,
	openTimetableSimple,
} from './timetable-layout-helpers';
import {
	installReadOnlyGenerationGuard,
	openGeneratedPlacementReview,
	openOccupiedSwapReview,
} from './older-user-session-remediation-fixtures';

async function assertNoObsoleteAssignmentModal(page: Page) {
	await expect(page.getByText(/Assign teacher and room|Choose teacher/i)).toHaveCount(0);
}

async function openSimpleScheduleSwitcher(page: Page) {
	const viewport = page.viewportSize();
	if ((viewport?.width ?? 1366) < 1024) {
		await page.getByRole('button', { name: /Showing .* schedule/i }).click();
		const sheet = page.getByTestId('timetable-simple-schedule-sheet');
		await expect(sheet).toBeVisible({ timeout: 10_000 });
		const switcher = sheet.getByTestId('timetable-simple-schedule-switcher');
		await expect(switcher).toBeVisible();
		return { switcher, close: async () => { await page.keyboard.press('Escape'); } };
	}
	const switcher = page.getByTestId('timetable-simple-schedule-switcher');
	await expect(switcher).toBeVisible({ timeout: 20_000 });
	return { switcher, close: async () => undefined };
}

async function openSimpleStatusKey(page: Page) {
	await openSimpleMore(page);
	await page.getByRole('menuitem', { name: /^Status key$/i }).click();
	const dialog = page.getByRole('dialog').filter({ hasText: /Status key/i });
	await expect(dialog).toBeVisible({ timeout: 10_000 });
	return dialog;
}

async function switchCurrentPageToAdvanced(page: Page) {
	await openSimpleMore(page);
	await page.getByTestId('timetable-layout-toggle').click();
	await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 20_000 });
}

async function openAdvancedPolicyPane(page: Page) {
	const directPolicyButton = page.getByRole('button', { name: /^Policy$/i });
	if (await directPolicyButton.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
		await directPolicyButton.first().click();
	} else {
		await page.getByRole('button', { name: /More tools/i }).click();
		await page.getByRole('button', { name: /^Policy$/i }).click();
	}
	await expect(page.getByTestId('policy-status-chip')).toBeVisible({ timeout: 20_000 });
}

async function openDraftPlanningFromMore(page: Page) {
	await openTimetableSimple(page);
	await openSimpleMore(page);
	await page.getByRole('menuitem', { name: /^Plan draft$/i }).click();
	await expect(page.getByTestId('pregen-plotting-tray')).toBeVisible({ timeout: 30_000 });
	return page.getByTestId('pregen-plotting-tray');
}

async function openDraftPlacementReview(page: Page) {
	const tray = await openDraftPlanningFromMore(page);
	const current = tray.getByTestId('pregen-current-plotting-item');
	await expect(current).toBeVisible({ timeout: 20_000 });
	const action = current.getByRole('button', { name: /^(Place|Choose room|Fix owner)$/i }).first();
	const label = (await action.innerText()).trim();
	if (!/^(Place|Choose room)$/i.test(label)) {
		test.skip(true, `Current draft fixture is not place-capable: ${label}`);
	}
	await action.click();
	await expect(page.locator('[data-cell-preview-label]').first()).toBeVisible({ timeout: 15_000 });
	await page.locator('td[data-day][data-start-time][data-end-time]').first().click({ position: { x: 8, y: 8 } });
	const dialog = page.getByTestId('draft-placement-review-dialog');
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	return dialog;
}

async function openTeacherDepartureFromSelectedClass(page: Page) {
	await openTimetableSimple(page);
	const entries = page.locator('[data-timetable-entry="true"]');
	await expect(entries.first()).toBeVisible({ timeout: 30_000 });
	await entries.first().click();
	return openSelectedClassTeacherDeparture(page);
}

test.describe('Timetable current full-function matrix', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('simple default exposes current controls, help, status key, and advanced return path', async ({ page }) => {
		await openTimetableSimple(page);
		const schedule = await openSimpleScheduleSwitcher(page);
		await expect(schedule.switcher.getByTestId('timetable-simple-view-mode-select')).toBeVisible();
		await expect(schedule.switcher.getByTestId('timetable-simple-entity-select')).toBeVisible();
		await schedule.close();
		await expect(page.getByTestId('timetable-simple-tutorial-trigger')).toBeVisible();
		await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible();

		await page.getByTestId('timetable-simple-tutorial-trigger').click();
		await expect(page.getByTestId('timetable-simple-tutorial')).toContainText(/Simple timetable tutorial/i);
		await page.keyboard.press('Escape');

		const statusKey = await openSimpleStatusKey(page);
		await expect(statusKey).toContainText(/Can place|Can swap|Blocked|Warning|Occupied/i);
		await page.getByRole('button', { name: /^Done$/i }).click();

		await switchCurrentPageToAdvanced(page);
		await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 20_000 });
		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
		await assertNoGlobalOverflow(page);
	});

	test('generated placement and generated swap open current review surfaces without committing', async ({ page }) => {
		const guard = await installReadOnlyGenerationGuard(page);
		await openTimetableSimple(page);

		const placement = await openGeneratedPlacementReview(page);
		if (placement.status === 'fixture-unavailable') test.skip(true, placement.reason);
		await expect(placement.dialog!).toContainText(/Review generated placement/i);
		await expect(placement.dialog!.getByTestId('generated-placement-feedback')).toBeVisible();
		await assertNoObsoleteAssignmentModal(page);
		await placement.dialog!.getByRole('button', { name: /^Cancel$/i }).click();

		const swap = await openOccupiedSwapReview(page);
		await expect(swap.dialog).toContainText(/Swap sessions|Review occupied-slot swap/i);
		await expect(swap.dialog.getByTestId('generated-swap-feedback')).toBeVisible();
		await assertNoObsoleteAssignmentModal(page);
		await swap.dialog.getByRole('button', { name: /^Cancel$/i }).click();

		expect(guard.blockedWrites, 'Preview-only paths must not attempt commit endpoints.').toEqual([]);
		await assertNoGlobalOverflow(page);
	});

	test('draft planning from More exposes tray and draft placement feedback', async ({ page }) => {
		await installReadOnlyGenerationGuard(page);
		const dialog = await openDraftPlacementReview(page);
		await expect(dialog).toContainText(/Review draft placement/i);
		await expect(dialog.getByTestId('draft-placement-feedback')).toBeVisible();
		await expect(dialog.getByTestId('draft-placement-save-reason')).toContainText(/Ready|Fix|Choose|Waiting|blocked|outside|inside|time window/i);
		await assertNoObsoleteAssignmentModal(page);
		await dialog.getByRole('button', { name: /^Cancel$/i }).click();
		await assertNoGlobalOverflow(page);
	});

	test('teacher departure is reachable from Simple More and selected-class More actions', async ({ page }) => {
		await openTimetableSimple(page);
		await openSimpleMore(page);
		await page.getByTestId('teacher-departure-trigger').click();
		const genericSheet = page.getByTestId('teacher-departure-recovery-sheet');
		await expect(genericSheet).toBeVisible({ timeout: 20_000 });
		await expect(genericSheet.getByTestId('teacher-departure-feedback')).toContainText(/Choose leaving teacher|Review affected classes/i);
		await page.keyboard.press('Escape');

		const selectedSheet = await openTeacherDepartureFromSelectedClass(page);
		await expect(selectedSheet.getByTestId('teacher-departure-stepper')).toBeVisible();
		await expect(selectedSheet.getByTestId('teacher-departure-save-reason')).toBeVisible();
		await assertNoGlobalOverflow(page);
	});

	test('policy tools remain reachable without losing the current workflow', async ({ page }) => {
		await openTimetableSimple(page);
		await openPrimaryTaskDrawer(page);
		await expect(page.getByTestId('simple-current-session-card')).toBeVisible({ timeout: 20_000 });
		await switchCurrentPageToAdvanced(page);
		await openAdvancedPolicyPane(page);
		await expect(page.getByText(/Policy loaded|Policy saved|Policy unavailable|Affects next generation/i).first()).toBeVisible({ timeout: 20_000 });
		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
		await assertNoGlobalOverflow(page);
	});
});
