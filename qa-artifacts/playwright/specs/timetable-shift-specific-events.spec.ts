import { expect, test, type Page } from '@playwright/test';

import {
	assertNoGlobalOverflow,
	loginAdmin,
	openTimetableSimple,
} from './timetable-layout-helpers';

/**
 * Shift-specific special event labels that may appear in the timetable grid.
 */
const DAY_SHIFT_EVENTS = ['Day Shift Health Break', 'Day Shift Lunch Break'];
const AFTERNOON_SHIFT_EVENTS = ['Afternoon Shift Health Break', 'Afternoon Shift Lunch Break'];

/**
 * Old warning banner text that must NOT appear.
 */
const OLD_BANNER_TEXT = 'The grid starts at 06:00, but grade windows start at';

async function assertNoOldWarningBanner(page: Page) {
	const banner = page.getByText(OLD_BANNER_TEXT);
	await expect(banner).toHaveCount(0);
}

/**
 * Get all visible special-event cell text from the timetable grid.
 */
async function getVisibleSpecialEventTexts(page: Page): Promise<string[]> {
	const eventCells = page.locator('td[data-day]').filter({
		hasText: /Health Break|Lunch Break|FLAG CEREMONY|RECESS|LUNCH|Custom Event/i,
	});
	const count = await eventCells.count();
	const texts: string[] = [];
	for (let i = 0; i < count; i++) {
		const text = (await eventCells.nth(i).innerText()).trim();
		if (text) texts.push(text);
	}
	return texts;
}

/**
 * Try to find and select a section matching the given grade pattern.
 */
async function selectSectionByGrade(page: Page, gradePattern: RegExp): Promise<boolean> {
	const viewport = page.viewportSize();
	const isDesktop = (viewport?.width ?? 1366) >= 1024;

	if (isDesktop) {
		const entitySelect = page.getByTestId('timetable-simple-entity-select');
		if (!(await entitySelect.isVisible({ timeout: 5_000 }).catch(() => false))) {
			return false;
		}
		const combobox = entitySelect.getByRole('combobox');
		await combobox.click({ force: true });
		const popover = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
		await expect(popover.first()).toBeVisible({ timeout: 5_000 });
		const options = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
		const optionCount = await options.count();
		for (let i = 0; i < Math.min(optionCount, 30); i++) {
			const option = options.nth(i);
			const text = await option.innerText();
			if (gradePattern.test(text)) {
				await option.click();
				await page.waitForTimeout(500);
				return true;
			}
		}
		await page.keyboard.press('Escape');
		return false;
	}

	const showingButton = page.getByRole('button', { name: /Showing .* schedule/i });
	if (!(await showingButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
		return false;
	}
	await showingButton.click();
	const sheet = page.getByTestId('timetable-simple-schedule-sheet');
	await expect(sheet).toBeVisible({ timeout: 5_000 });
	const entitySelectInSheet = sheet.getByTestId('timetable-simple-entity-select');
	await expect(entitySelectInSheet).toBeVisible({ timeout: 5_000 });
	const combobox = entitySelectInSheet.getByRole('combobox');
	await combobox.click();
	const popover = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
	await expect(popover.first()).toBeVisible({ timeout: 5_000 });
	const options = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
	const optionCount = await options.count();
	for (let i = 0; i < Math.min(optionCount, 30); i++) {
		const option = options.nth(i);
		const text = await option.innerText();
		if (gradePattern.test(text)) {
			await option.click();
			await page.waitForTimeout(500);
			await page.keyboard.press('Escape');
			return true;
		}
	}
	await page.keyboard.press('Escape');
	return false;
}

// ═══════════════════════════════════════════════════════════════
// Live-data smoke tests
// ═══════════════════════════════════════════════════════════════

test.describe('Timetable shift-specific events (live smoke)', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('old large warning banner does not return', async ({ page }) => {
		await openTimetableSimple(page);
		await assertNoOldWarningBanner(page);
		await assertNoGlobalOverflow(page);
	});

	test('GR7/GR8 section shows day-shift events only', async ({ page }) => {
		await openTimetableSimple(page);
		const found = await selectSectionByGrade(page, /GR\s*[78]\b|Grade\s*[78]\b/i);
		if (!found) {
			test.skip(true, 'fixture-unavailable: No GR7 or GR8 section found in the live dataset');
		}
		await page.waitForTimeout(1000);
		const eventTexts = await getVisibleSpecialEventTexts(page);
		if (eventTexts.length === 0) {
			test.skip(true, 'fixture-unavailable: GR7/GR8 section found but no special-event rows rendered');
		}
		const hasDayEvents = eventTexts.some((t) => DAY_SHIFT_EVENTS.some((e) => t.includes(e)));
		const hasAfternoonEvents = eventTexts.some((t) => AFTERNOON_SHIFT_EVENTS.some((e) => t.includes(e)));
		expect(hasDayEvents, 'GR7/GR8 must show day-shift events').toBeTruthy();
		expect(hasAfternoonEvents, 'GR7/GR8 must NOT show afternoon-shift events').toBeFalsy();
		await assertNoOldWarningBanner(page);
		await assertNoGlobalOverflow(page);
	});

	test('GR9/GR10 section shows afternoon-shift events only', async ({ page }) => {
		await openTimetableSimple(page);
		const found = await selectSectionByGrade(page, /GR\s*(?:9|10)\b|Grade\s*(?:9|10)\b/i);
		if (!found) {
			test.skip(true, 'fixture-unavailable: No GR9 or GR10 section found in the live dataset');
		}
		await page.waitForTimeout(1000);
		const eventTexts = await getVisibleSpecialEventTexts(page);
		if (eventTexts.length === 0) {
			test.skip(true, 'fixture-unavailable: GR9/GR10 section found but no special-event rows rendered');
		}
		const hasDayEvents = eventTexts.some((t) => DAY_SHIFT_EVENTS.some((e) => t.includes(e)));
		const hasAfternoonEvents = eventTexts.some((t) => AFTERNOON_SHIFT_EVENTS.some((e) => t.includes(e)));
		expect(hasAfternoonEvents, 'GR9/GR10 must show afternoon-shift events').toBeTruthy();
		expect(hasDayEvents, 'GR9/GR10 must NOT show day-shift events').toBeFalsy();
		await assertNoOldWarningBanner(page);
		await assertNoGlobalOverflow(page);
	});

	test('hidden-row chip is informational only and separate Show full day toggle controls full-day mode', async ({ page }) => {
		await openTimetableSimple(page);
		const chip = page.getByTestId('timetable-hidden-rows-chip');
		const hasChip = await chip.isVisible({ timeout: 3_000 }).catch(() => false);
		if (!hasChip) {
			test.skip(true, 'fixture-unavailable: No hidden-row chip visible for current section');
		}
		const fullDayToggle = page.getByTestId('timetable-show-full-day-toggle');
		const firstTimeRow = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRow).toBeVisible({ timeout: 10_000 });
		const firstStartTimeBefore = await firstTimeRow.getAttribute('data-start-time');
		await chip.click();
		await page.waitForTimeout(500);
		const firstTimeRowAfter = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRowAfter).toBeVisible({ timeout: 5_000 });
		const firstStartTimeAfter = await firstTimeRowAfter.getAttribute('data-start-time');
		expect(firstStartTimeAfter, 'Chip click must not change visible rows').toBe(firstStartTimeBefore);
		if (await fullDayToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
			await fullDayToggle.click();
			await page.waitForTimeout(500);
			const firstTimeRowFullDay = page.locator('td[data-day][data-start-time][data-end-time]').first();
			await expect(firstTimeRowFullDay).toBeVisible({ timeout: 5_000 });
			const firstStartTimeFullDay = await firstTimeRowFullDay.getAttribute('data-start-time');
			expect(firstStartTimeFullDay, 'Full-day toggle should reveal earlier rows').not.toBe(firstStartTimeBefore);
		}
		await assertNoGlobalOverflow(page);
	});
});
