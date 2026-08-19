import { expect, test, type Page } from '@playwright/test';
import { assertNoGlobalOverflow, loginAdmin, openTimetableSimple } from './timetable-layout-helpers';

async function startSimplePlacing(page: Page) {
	const primary = page.getByTestId('timetable-simple-primary-action');
	await expect(primary).toBeVisible();
	const label = (await primary.innerText()).toLowerCase();
	if (label.includes('placing') || label.includes('place')) {
		await primary.click();
		return;
	}
	await page.getByTestId('timetable-simple-more-trigger').click();
	await page.getByTestId('timetable-simple-more-daily-tasks').getByText(/Place unresolved sessions/i).click();
}

async function visibleWordCount(locator: ReturnType<Page['locator']>) {
	const text = await locator.evaluate((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
	return text ? text.split(' ').filter(Boolean).length : 0;
}

test.describe('Timetable Simple Ease of Use', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
		await openTimetableSimple(page);
	});

	test('simple header keeps only the essential visible controls', async ({ page }) => {
		const header = page.getByTestId('timetable-simple-header');
		await expect(header).toBeVisible();
		const visibleButtons = await header.locator('button:visible').count();
		const width = page.viewportSize()?.width ?? 1366;
		expect(visibleButtons).toBeLessThanOrEqual(width < 768 ? 8 : 10);
		await page.getByTestId('timetable-simple-more-trigger').click();
		await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toContainText(/Place unresolved/i);
		await expect(page.getByTestId('timetable-simple-more-schedule-data')).toContainText(/Filters/i);
		await expect(page.getByTestId('timetable-simple-more-expert-tools')).toContainText(/Advanced view/i);
		await assertNoGlobalOverflow(page);
	});

	test('plotting tray shows one current session and only the next few by default', async ({ page }) => {
		await startSimplePlacing(page);
		const tray = page.getByTestId('simple-plotting-tray');
		await expect(tray).toBeVisible();
		await expect(tray.getByTestId('simple-current-session-card')).toHaveCount(1);
		expect(await tray.getByTestId('simple-next-session-card').count()).toBeLessThanOrEqual(3);
		await expect(tray.getByTestId('simple-plotting-find-session')).toBeVisible();
		const maxWords = (page.viewportSize()?.width ?? 1366) < 768 ? 90 : 120;
		expect(await visibleWordCount(tray)).toBeLessThanOrEqual(maxWords);
		await tray.getByTestId('simple-plotting-find-session').click();
		await expect(tray.getByTestId('simple-plotting-search')).toBeVisible();
		await assertNoGlobalOverflow(page);
	});

	test('selected class strip uses one primary action and a compact more menu', async ({ page }) => {
		const firstEntry = page.locator('[data-timetable-entry="true"]').first();
		await expect(firstEntry).toBeVisible({ timeout: 30_000 });
		await firstEntry.click();
		const strip = page.getByTestId('timetable-selection-strip');
		await expect(strip).toBeVisible();
		await expect(strip.getByTestId('simple-selected-primary-action')).toBeVisible();
		await expect(strip.getByTestId('simple-selected-more-actions')).toBeVisible();
		const box = await strip.boundingBox();
		const viewport = page.viewportSize();
		if ((viewport?.width ?? 1366) < 768) {
			expect(box?.height ?? 999).toBeLessThanOrEqual(112);
		}
		if ((viewport?.height ?? 768) <= 500) {
			expect(box?.height ?? 999).toBeLessThanOrEqual(72);
		}
		await strip.getByTestId('simple-selected-more-actions').click();
		await expect(page.getByTestId('timetable-simple-selected-details-action')).toBeVisible();
		await assertNoGlobalOverflow(page);
	});

	test('tutorial and simple details are visual decision aids, not paragraph walls', async ({ page }) => {
		await page.getByTestId('timetable-simple-tutorial-trigger').click();
		const tutorial = page.getByTestId('timetable-simple-tutorial');
		await expect(tutorial).toBeVisible();
		await expect(tutorial.getByTestId('simple-visual-help-step')).toBeVisible();
		await expect(tutorial.getByRole('button', { name: /Show me/i })).toBeVisible();
		await page.keyboard.press('Escape');

		const firstEntry = page.locator('[data-timetable-entry="true"]').first();
		await expect(firstEntry).toBeVisible({ timeout: 30_000 });
		await firstEntry.click();
		await page.getByTestId('simple-selected-more-actions').click();
		await page.getByTestId('timetable-simple-selected-details-action').click();
		const details = page.getByTestId('timetable-simple-details-sheet');
		await expect(details).toBeVisible();
		await expect(details.getByTestId('simple-details-summary-card')).toHaveCount(5);
		await expect(details).not.toContainText(/Unknown .*#\d+/i);
		await assertNoGlobalOverflow(page);
	});
});
