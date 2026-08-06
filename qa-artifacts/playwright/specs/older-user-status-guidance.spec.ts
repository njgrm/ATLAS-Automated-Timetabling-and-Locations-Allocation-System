import { expect, test } from '@playwright/test';

import {
	assertNoGlobalOverflow,
	openTimetableAdvanced,
	openTimetableSimple,
} from './timetable-layout-helpers';
import {
	installReadOnlyGenerationGuard,
	loginAdmin,
	openGeneratedPlacementReview,
	openOccupiedSwapReview,
} from './older-user-session-remediation-fixtures';

const STATUS_LABELS = ['Can place', 'Can swap', 'Blocked', 'Warning', 'Occupied', 'Current'];

test.describe.serial('Older-user six-state timetable guidance', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('Simple view exposes every status definition without switching modes', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		page.setDefaultTimeout(20_000);
		await openTimetableSimple(page);
		const trigger = page.getByTestId('timetable-status-legend');
		await expect(trigger).toBeVisible();
		const triggerBox = await trigger.boundingBox();
		expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(24);
		expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(24);
		await trigger.click();
		const panel = page.getByTestId('timetable-status-legend-panel');
		await expect(panel).toBeVisible();
		for (const label of STATUS_LABELS) await expect(panel.getByText(label, { exact: true })).toBeVisible();
		await expect(panel).toContainText(/empty slot/i);
		await expect(panel).toContainText(/possible switch/i);
		await expect(panel).toContainText(/hard conflict/i);
		await expect(panel).toContainText(/softer concern/i);
		await expect(panel).toContainText(/already has/i);
		await expect(panel).toContainText(/selected session/i);
		await page.keyboard.press('Escape');
		await expect(panel).toBeHidden();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		const overflow = await assertNoGlobalOverflow(page);
		await testInfo.attach('simple-status-guidance', { body: JSON.stringify({ viewport: page.viewportSize(), triggerBox, overflow }, null, 2), contentType: 'application/json' });
	});

	test('Placement and swap guidance remain reachable without committing timetable data', async ({ page }, testInfo) => {
		test.setTimeout(150_000);
		page.setDefaultTimeout(20_000);
		const guard = await installReadOnlyGenerationGuard(page);
		await openTimetableSimple(page);
		const trigger = page.getByTestId('timetable-status-legend');
		await trigger.click();
		await expect(page.getByTestId('timetable-status-legend-panel')).toBeVisible();
		await page.keyboard.press('Escape');

		const placement = await openGeneratedPlacementReview(page);
		expect(placement.status, 'The live fixture must expose a reviewable placement path.').toBe('opened');
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('generated-placement-review-dialog')).toBeHidden();

		const swap = await openOccupiedSwapReview(page);
		await expect(swap.dialog).toContainText(/Swap sessions/i);
		await page.keyboard.press('Escape');
		await expect(swap.dialog).toBeHidden();

		await openTimetableSimple(page);
		await expect(page.getByTestId('timetable-status-legend')).toBeVisible();
		expect(guard.blockedWrites, 'Guidance and cancelled reviews must not call a commit endpoint.').toEqual([]);
		await testInfo.attach('status-guidance-workflows', { body: JSON.stringify({ viewport: page.viewportSize(), placement: placement.status, blockedWrites: guard.blockedWrites }, null, 2), contentType: 'application/json' });
	});

	test('Advanced view keeps the same six-state key available without per-cell recomputation', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		page.setDefaultTimeout(20_000);
		await openTimetableAdvanced(page);
		await expect(page.getByTestId('timetable-task-guide')).toBeVisible();
		const trigger = page.getByTestId('timetable-status-legend');
		await expect(trigger).toBeVisible();
		await trigger.click();
		const panel = page.getByTestId('timetable-status-legend-panel');
		await expect(panel).toBeVisible();
		await expect(panel.getByRole('list')).toHaveCount(1);
		await expect(panel.getByRole('listitem')).toHaveCount(6);
		await page.keyboard.press('Escape');
		const overflow = await assertNoGlobalOverflow(page);
		await testInfo.attach('advanced-status-guidance', { body: JSON.stringify({ viewport: page.viewportSize(), overflow }, null, 2), contentType: 'application/json' });
	});
});
