import { expect, test, type Page } from '@playwright/test';

import {
	assertNoGlobalOverflow,
	loginAdmin,
	openTimetableSimple,
} from './timetable-layout-helpers';

/**
 * Try to find a section whose grade/program window hides earlier rows.
 * On desktop, uses the inline entity selector. On mobile, uses the sheet-based selector.
 *
 * Returns true if a section with hidden rows was found.
 */
async function findSectionWithHiddenRows(page: Page): Promise<boolean> {
	const chip = page.getByTestId('timetable-hidden-rows-chip');

	// Check if the currently selected section already has hidden rows
	if (await chip.isVisible({ timeout: 2_000 }).catch(() => false)) {
		return true;
	}

	const viewport = page.viewportSize();
	const isDesktop = (viewport?.width ?? 1366) >= 1024;

	if (isDesktop) {
		// Desktop: use the inline entity selector
		const entitySelect = page.getByTestId('timetable-simple-entity-select');
		const isVisible = await entitySelect.isVisible({ timeout: 5_000 }).catch(() => false);
		if (!isVisible) return false;

		const combobox = entitySelect.getByRole('combobox');
		await combobox.click({ force: true });

		const popover = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
		await expect(popover.first()).toBeVisible({ timeout: 5_000 });

		const options = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
		const optionCount = await options.count();

		for (let i = 0; i < Math.min(optionCount, 20); i++) {
			const option = options.nth(i);
			const hasCheck = await option.locator('svg').count().catch(() => 0);
			if (hasCheck === 0) continue;

			await option.click();
			await page.waitForTimeout(300);

			if (await chip.isVisible({ timeout: 2_000 }).catch(() => false)) {
				return true;
			}

			await combobox.click({ force: true });
			await expect(popover.first()).toBeVisible({ timeout: 3_000 });
		}

		await page.keyboard.press('Escape');
		return false;
	}

	// Mobile: use the sheet-based schedule switcher
	const showingButton = page.getByRole('button', { name: /Showing .* schedule/i });
	const isVisible = await showingButton.isVisible({ timeout: 5_000 }).catch(() => false);
	if (!isVisible) return false;

	await showingButton.click();
	const sheet = page.getByTestId('timetable-simple-schedule-sheet');
	await expect(sheet).toBeVisible({ timeout: 5_000 });

	// Use the entity-select's combobox specifically (not the view-mode select)
	const entitySelectInSheet = sheet.getByTestId('timetable-simple-entity-select');
	await expect(entitySelectInSheet).toBeVisible({ timeout: 5_000 });
	const combobox = entitySelectInSheet.getByRole('combobox');
	await combobox.click();

	const popover = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
	await expect(popover.first()).toBeVisible({ timeout: 5_000 });

	const options = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
	const optionCount = await options.count();

	for (let i = 0; i < Math.min(optionCount, 20); i++) {
		const option = options.nth(i);
		const hasCheck = await option.locator('svg').count().catch(() => 0);
		if (hasCheck === 0) continue;

		await option.click();
		await page.waitForTimeout(300);

		if (await chip.isVisible({ timeout: 2_000 }).catch(() => false)) {
			// Close the sheet
			await page.keyboard.press('Escape');
			return true;
		}

		await combobox.click();
		await expect(popover.first()).toBeVisible({ timeout: 3_000 });
	}

	await page.keyboard.press('Escape');
	return false;
}

test.describe('Timetable hidden-row chip regression', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('hidden-row chip click is informational only and does not switch full-day mode', async ({ page }) => {
		await openTimetableSimple(page);

		const hasHiddenRows = await findSectionWithHiddenRows(page);
		if (!hasHiddenRows) {
			test.skip(true, 'fixture-unavailable: No section in the live dataset has hidden rows (all grade/program windows match the grid)');
		}

		const chip = page.getByTestId('timetable-hidden-rows-chip');
		await expect(chip).toBeVisible({ timeout: 5_000 });

		// The Show full day toggle MUST also be visible when rows are hidden
		const fullDayToggle = page.getByTestId('timetable-show-full-day-toggle');
		await expect(fullDayToggle).toBeVisible({ timeout: 5_000 });

		// Capture the first visible time row before clicking the chip
		const firstTimeRow = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRow).toBeVisible({ timeout: 10_000 });
		const firstStartTimeBefore = await firstTimeRow.getAttribute('data-start-time');
		const firstEndTimeBefore = await firstTimeRow.getAttribute('data-end-time');

		// Click the hidden-row chip
		await chip.click();
		await page.waitForTimeout(500);

		// The first visible time row must be unchanged
		const firstTimeRowAfter = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRowAfter).toBeVisible({ timeout: 5_000 });
		const firstStartTimeAfter = await firstTimeRowAfter.getAttribute('data-start-time');
		const firstEndTimeAfter = await firstTimeRowAfter.getAttribute('data-end-time');
		expect(firstStartTimeAfter, 'First visible time row start time must not change after chip click').toBe(firstStartTimeBefore);
		expect(firstEndTimeAfter, 'First visible time row end time must not change after chip click').toBe(firstEndTimeBefore);

		// The hidden-row chip must still exist
		await expect(chip).toBeVisible();

		// The Show full day toggle must still be visible (it is a separate control)
		await expect(fullDayToggle).toBeVisible();

		await assertNoGlobalOverflow(page);
	});

	test('Show full day toggle reveals full-day rows including early time slots', async ({ page }) => {
		await openTimetableSimple(page);

		const hasHiddenRows = await findSectionWithHiddenRows(page);
		if (!hasHiddenRows) {
			test.skip(true, 'fixture-unavailable: No section in the live dataset has hidden rows (all grade/program windows match the grid)');
		}

		const chip = page.getByTestId('timetable-hidden-rows-chip');
		await expect(chip).toBeVisible({ timeout: 5_000 });

		const fullDayToggle = page.getByTestId('timetable-show-full-day-toggle');
		await expect(fullDayToggle).toBeVisible({ timeout: 5_000 });

		// Capture the first visible time row before toggling
		const firstTimeRow = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRow).toBeVisible({ timeout: 10_000 });
		const firstStartTimeBefore = await firstTimeRow.getAttribute('data-start-time');

		// Click the Show full day toggle
		await fullDayToggle.click();
		await page.waitForTimeout(500);

		// Now the first visible time row should show an earlier time (e.g., 6:00 AM)
		const firstTimeRowAfter = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRowAfter).toBeVisible({ timeout: 5_000 });
		const firstStartTimeAfter = await firstTimeRowAfter.getAttribute('data-start-time');

		expect(firstStartTimeAfter, 'Full-day mode should reveal earlier time slots').not.toBe(firstStartTimeBefore);

		// The hidden-row chip should no longer be visible (all rows are shown, hiddenRowCount === 0)
		await expect(chip).toHaveCount(0);

		// The toggle may or may not still be visible depending on hiddenRowCount state
		// After toggling full-day, hiddenRowCount becomes 0 so the toggle is not rendered.
		// Verify the toggle text says "Full day" if it's still visible.
		const toggleStillVisible = await fullDayToggle.isVisible({ timeout: 1_000 }).catch(() => false);
		if (toggleStillVisible) {
			await expect(fullDayToggle).toContainText(/Full day/i);
		}

		await assertNoGlobalOverflow(page);
	});

	test('hidden-row chip has clean text, accessible label, and tooltip explanation', async ({ page }) => {
		await openTimetableSimple(page);

		const hasHiddenRows = await findSectionWithHiddenRows(page);
		if (!hasHiddenRows) {
			test.skip(true, 'fixture-unavailable: No section in the live dataset has hidden rows (all grade/program windows match the grid)');
		}

		const chip = page.getByTestId('timetable-hidden-rows-chip');
		await expect(chip).toBeVisible({ timeout: 5_000 });

		// Verify the chip textContent is not duplicated
		const textContent = await chip.innerText();
		const duplicatePattern = /(\d+ .+ hidden)\1/;
		expect(textContent, 'Chip text must not contain duplicated content').not.toMatch(duplicatePattern);
		expect(textContent, 'Chip text should mention hidden rows').toMatch(/\d+ .* hidden/);

		// Verify the chip has an accessible aria-label
		const ariaLabel = await chip.getAttribute('aria-label');
		expect(ariaLabel, 'Chip must have an aria-label').toBeTruthy();
		expect(ariaLabel, 'Aria-label should mention hidden rows').toMatch(/\d+ .* hidden/);

		// Verify the chip has role="status"
		const role = await chip.getAttribute('role');
		expect(role, 'Chip must have role="status"').toBe('status');

		// Hover over the chip to trigger the tooltip
		await chip.hover();
		const tooltip = page.getByTestId('timetable-hidden-rows-explanation');
		await expect(tooltip).toBeVisible({ timeout: 5_000 });

		// Verify the tooltip contains the policy alignment warning text
		const tooltipText = await tooltip.innerText();
		expect(tooltipText, 'Tooltip should contain explanation text').toBeTruthy();
		expect(tooltipText.length, 'Tooltip should have meaningful content').toBeGreaterThan(10);
	});

	test('desktop schedule selector has usable width', async ({ page }) => {
		const viewport = page.viewportSize();
		if ((viewport?.width ?? 1366) < 1024) {
			test.skip(true, 'Desktop-only test');
		}

		await openTimetableSimple(page);

		// Assert the schedule switcher is visible
		const switcher = page.getByTestId('timetable-simple-schedule-switcher');
		await expect(switcher).toBeVisible({ timeout: 10_000 });

		// Assert the entity selector is visible
		const entitySelect = page.getByTestId('timetable-simple-entity-select');
		await expect(entitySelect).toBeVisible({ timeout: 10_000 });

		// Assert entity selector has usable width (> 120px)
		const entityBox = await entitySelect.boundingBox();
		expect(entityBox, 'Entity select must have a bounding box').not.toBeNull();
		expect(entityBox!.width, 'Entity selector width must be > 120px').toBeGreaterThan(120);

		// Assert schedule switcher has usable width (> 280px)
		const switcherBox = await switcher.boundingBox();
		expect(switcherBox, 'Schedule switcher must have a bounding box').not.toBeNull();
		expect(switcherBox!.width, 'Schedule switcher width must be > 280px').toBeGreaterThan(280);

		// Assert no horizontal page overflow
		await assertNoGlobalOverflow(page);
	});

	test('hidden-row controls do not steal schedule selector width', async ({ page }) => {
		const viewport = page.viewportSize();
		if ((viewport?.width ?? 1366) < 1024) {
			test.skip(true, 'Desktop-only test');
		}

		await openTimetableSimple(page);

		const hasHiddenRows = await findSectionWithHiddenRows(page);
		if (!hasHiddenRows) {
			test.skip(true, 'fixture-unavailable: No section in the live dataset has hidden rows');
		}

		// Assert hidden-row chip is visible
		const chip = page.getByTestId('timetable-hidden-rows-chip');
		await expect(chip).toBeVisible({ timeout: 5_000 });

		// Assert Show full day toggle is visible
		const fullDayToggle = page.getByTestId('timetable-show-full-day-toggle');
		await expect(fullDayToggle).toBeVisible({ timeout: 5_000 });

		// Assert entity selector remains visible and has usable width
		const entitySelect = page.getByTestId('timetable-simple-entity-select');
		await expect(entitySelect).toBeVisible({ timeout: 5_000 });
		const entityBox = await entitySelect.boundingBox();
		expect(entityBox, 'Entity select must have a bounding box').not.toBeNull();
		expect(entityBox!.width, 'Entity selector width must be > 120px when hidden-row controls are present').toBeGreaterThan(120);

		// Click hidden-row chip and verify entity selector remains visible
		await chip.click();
		await page.waitForTimeout(300);
		await expect(entitySelect).toBeVisible();
		const entityBoxAfter = await entitySelect.boundingBox();
		expect(entityBoxAfter!.width, 'Entity selector width must remain > 120px after chip click').toBeGreaterThan(120);

		// Capture first visible time row before chip click
		const firstTimeRow = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRow).toBeVisible({ timeout: 10_000 });
		const firstStartTimeBefore = await firstTimeRow.getAttribute('data-start-time');

		// Click chip and verify first row unchanged
		await chip.click();
		await page.waitForTimeout(300);
		const firstTimeRowAfter = page.locator('td[data-day][data-start-time][data-end-time]').first();
		const firstStartTimeAfter = await firstTimeRowAfter.getAttribute('data-start-time');
		expect(firstStartTimeAfter, 'First visible time row must not change after chip click').toBe(firstStartTimeBefore);

		await assertNoGlobalOverflow(page);
	});

	test('full-day toggle works and schedule switcher remains usable', async ({ page }) => {
		const viewport = page.viewportSize();
		if ((viewport?.width ?? 1366) < 1024) {
			test.skip(true, 'Desktop-only test');
		}

		await openTimetableSimple(page);

		const hasHiddenRows = await findSectionWithHiddenRows(page);
		if (!hasHiddenRows) {
			test.skip(true, 'fixture-unavailable: No section in the live dataset has hidden rows');
		}

		const chip = page.getByTestId('timetable-hidden-rows-chip');
		await expect(chip).toBeVisible({ timeout: 5_000 });

		const fullDayToggle = page.getByTestId('timetable-show-full-day-toggle');
		await expect(fullDayToggle).toBeVisible({ timeout: 5_000 });

		// Capture first visible time row before toggling
		const firstTimeRow = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRow).toBeVisible({ timeout: 10_000 });
		const firstStartTimeBefore = await firstTimeRow.getAttribute('data-start-time');

		// Click Show full day
		await fullDayToggle.click();
		await page.waitForTimeout(500);

		// Verify earlier rows appear
		const firstTimeRowAfter = page.locator('td[data-day][data-start-time][data-end-time]').first();
		await expect(firstTimeRowAfter).toBeVisible({ timeout: 5_000 });
		const firstStartTimeAfter = await firstTimeRowAfter.getAttribute('data-start-time');
		expect(firstStartTimeAfter, 'Full-day mode should reveal earlier time slots').not.toBe(firstStartTimeBefore);

		// Verify the schedule switcher still remains usable
		const switcher = page.getByTestId('timetable-simple-schedule-switcher');
		await expect(switcher).toBeVisible();
		const switcherBox = await switcher.boundingBox();
		expect(switcherBox, 'Schedule switcher must still have a bounding box').not.toBeNull();
		expect(switcherBox!.width, 'Schedule switcher width must remain > 280px after full-day toggle').toBeGreaterThan(280);

		const entitySelect = page.getByTestId('timetable-simple-entity-select');
		await expect(entitySelect).toBeVisible();
		const entityBox = await entitySelect.boundingBox();
		expect(entityBox!.width, 'Entity selector width must remain > 120px after full-day toggle').toBeGreaterThan(120);

		await assertNoGlobalOverflow(page);
	});
});
