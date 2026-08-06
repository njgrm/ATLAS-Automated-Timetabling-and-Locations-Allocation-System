import { expect, test } from '@playwright/test';

import {
	attachPhase0Artifact,
	assertNoGlobalOverflow,
	captureRuntimeFixture,
	COCKPIT_CAPABILITY_PARITY,
	installReadOnlyGenerationGuard,
	loginAdmin,
	OLDER_USER_TASKS,
	openGeneratedPlacementReview,
	openOccupiedSwapReview,
	openSimpleTask,
	probeDialogFocus,
	probeQueueScroll,
} from './older-user-session-remediation-fixtures';

test.describe.serial('Older-user remediation Phase 0 evidence contracts', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('records a read-only, stable runtime fixture across Simple and Advanced', async ({ page }, testInfo) => {
		test.setTimeout(180_000);
		page.setDefaultTimeout(20_000);
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];
		const apiFailures: string[] = [];
		page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
		page.on('pageerror', (error) => pageErrors.push(error.message));
		page.on('response', (response) => {
			if (response.url().includes('/api/v1/') && response.status() >= 500) apiFailures.push(`${response.status()} ${response.url()}`);
		});
		const guard = await installReadOnlyGenerationGuard(page);
		const before = await captureRuntimeFixture(page);
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
		const simpleOverflow = await assertNoGlobalOverflow(page);
		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 20_000 });
		const advancedOverflow = await assertNoGlobalOverflow(page);
		const after = await captureRuntimeFixture(page);

		const stableKeys: Array<keyof typeof before> = [
			'schoolId', 'schoolYearId', 'source', 'stale', 'upstreamReachable', 'activeRunId', 'activeRunStatus', 'queueCount',
		];
		for (const key of stableKeys) expect(after[key], `Fixture field ${key} must remain unchanged without writes.`).toEqual(before[key]);
		expect(guard.blockedWrites, 'Phase 0 fixture navigation must not attempt timetable writes.').toEqual([]);
		expect(consoleErrors, 'No browser console errors expected in the fixture contract.').toEqual([]);
		expect(pageErrors, 'No uncaught page errors expected in the fixture contract.').toEqual([]);
		expect(apiFailures, 'No ATLAS API 5xx responses expected in the fixture contract.').toEqual([]);
		expect(OLDER_USER_TASKS).toHaveLength(12);
		expect(COCKPIT_CAPABILITY_PARITY).toHaveLength(7);
		await attachPhase0Artifact(testInfo, 'runtime-fixture-contract', {
			evidenceType: 'Browser proxy',
			before,
			after,
			stable: true,
			blockedWrites: guard.blockedWrites,
			consoleErrors,
			pageErrors,
			apiFailures,
			viewport: page.viewportSize(),
			layout: { simpleOverflow, advancedOverflow },
			tasks: OLDER_USER_TASKS,
			capabilityParity: COCKPIT_CAPABILITY_PARITY,
		});
	});

	test('probes placement and swap review focus without committing', async ({ page }, testInfo) => {
		test.setTimeout(240_000);
		page.setDefaultTimeout(20_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const before = await captureRuntimeFixture(page);
		const placement = await openGeneratedPlacementReview(page);
		let placementFocus = null;
		if (placement.status === 'opened' && placement.dialog && placement.invokingIdentity) {
			placementFocus = await probeDialogFocus(page, placement.dialog, placement.invokingIdentity, 'placement');
		}
		const swap = await openOccupiedSwapReview(page);
		const swapFocus = await probeDialogFocus(page, swap.dialog, swap.invokingIdentity, 'swap');
		const after = await captureRuntimeFixture(page);
		for (const key of ['schoolYearId', 'source', 'stale', 'upstreamReachable', 'activeRunId', 'activeRunStatus', 'queueCount'] as const) {
			expect(after[key], `Fixture field ${key} must remain unchanged after cancelled reviews.`).toEqual(before[key]);
		}
		expect(guard.blockedWrites, 'Cancelled placement/swap reviews must not call commit endpoints.').toEqual([]);
		await attachPhase0Artifact(testInfo, 'review-focus-and-cancel', {
			evidenceType: 'Browser proxy',
			viewport: page.viewportSize(),
			before,
			after,
			placement,
			placementFocus,
			swapFocus,
			blockedWrites: guard.blockedWrites,
			focusRestorationCurrentlyPassing: Boolean(placementFocus?.restoredToInvoker && swapFocus.restoredToInvoker),
		});
	});

	test('distinguishes supported desktop wheel scrolling from mobile touch-runner limits', async ({ page }, testInfo) => {
		test.setTimeout(180_000);
		page.setDefaultTimeout(20_000);
		const guard = await installReadOnlyGenerationGuard(page);
		await openSimpleTask(page, /Place unresolved sessions/i);
		const scroll = await probeQueueScroll(page);
		if (page.viewportSize()?.width && page.viewportSize()!.width > 1024) {
			expect(scroll.viewport.scrollHeight, 'Desktop queue fixture must contain a scrollable region.').toBeGreaterThan(scroll.viewport.clientHeight);
			expect(scroll.mouseWheelScrollTop ?? 0, 'Desktop wheel gesture must advance the queue.').toBeGreaterThan(0);
			expect(scroll.touchGestureStatus).toBe('not-required');
		} else {
			expect(scroll.programmaticScrollTop, 'Mobile queue must be programmatically scrollable for diagnostics.').toBeGreaterThan(0);
			expect(scroll.touchGestureStatus).toBe('unsupported-by-runner');
		}
		expect(guard.blockedWrites, 'Scroll probing must not call timetable writes.').toEqual([]);
		await attachPhase0Artifact(testInfo, 'queue-scroll-contract', {
			evidenceType: 'Browser proxy',
			viewport: page.viewportSize(),
			scroll,
			blockedWrites: guard.blockedWrites,
		});
	});
});
