import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { installReadOnlyGenerationGuard, loginAdmin } from './older-user-session-remediation-fixtures';
import { assertNoGlobalOverflow, openPrimaryTaskDrawer, openTaskDrawer, openTimetableSimple } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'older-user-session-remediation', 'phase-4');

type ScrollMetrics = {
	clientHeight: number;
	scrollHeight: number;
	scrollTop: number;
	touchAction: string;
	overscrollBehaviorY: string;
	overflowY: string;
	visibleItems: number;
	cardCount: number;
};

async function attachPhase4Artifact(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
	return filePath;
}

async function queueMetrics(list: Locator): Promise<ScrollMetrics> {
	return list.evaluate((node) => {
		const style = window.getComputedStyle(node);
		return {
			clientHeight: node.clientHeight,
			scrollHeight: node.scrollHeight,
			scrollTop: node.scrollTop,
			touchAction: style.touchAction,
			overscrollBehaviorY: style.overscrollBehaviorY,
			overflowY: style.overflowY,
			visibleItems: node.querySelectorAll('[role="listitem"]').length,
			cardCount: node.querySelectorAll('[data-testid="generated-unassigned-card"]').length,
		};
	});
}

async function cdpTouchSwipe(page: Page, target: Locator, distance = 280): Promise<'touch-dispatched' | 'no-box'> {
	const box = await target.boundingBox();
	if (!box) return 'no-box';
	const viewport = page.viewportSize();
	const rawX = Math.round(box.x + Math.min(Math.max(box.width / 2, 24), Math.max(24, box.width - 24)));
	const rawY = Math.round(box.y + Math.min(Math.max(box.height * 0.72, 48), Math.max(48, box.height - 24)));
	const x = Math.min(Math.max(rawX, 8), Math.max(8, (viewport?.width ?? rawX) - 8));
	const startY = Math.min(Math.max(rawY, 8), Math.max(8, (viewport?.height ?? rawY) - 8));
	const endY = Math.max(8, startY - Math.min(distance, Math.max(100, box.height * 0.8)));
	const client = await page.context().newCDPSession(page);
	try {
		await client.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ x, y: startY, radiusX: 4, radiusY: 4, force: 1, id: 1 }],
		});
		for (let step = 1; step <= 5; step += 1) {
			const y = Math.round(startY + ((endY - startY) * step) / 5);
			await client.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }],
			});
		}
		await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		return 'touch-dispatched';
	} finally {
		await client.detach();
	}
}

async function openGeneratedQueue(page: Page) {
	await openTimetableSimple(page);
	await openPrimaryTaskDrawer(page);
	const drawer = page.getByTestId('timetable-task-drawer');
	const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
	await expect(drawer).toBeVisible({ timeout: 20_000 });
	await expect(list).toBeVisible({ timeout: 20_000 });
	await expect(list.getByTestId('generated-unassigned-card').first()).toBeVisible({ timeout: 20_000 });
	return { drawer, list };
}

async function openPlacementReviewWithoutSaving(page: Page, list: Locator) {
	const card = list.getByTestId('generated-unassigned-card').first();
	await expect(card).toBeVisible({ timeout: 20_000 });
	await card.click();
	const action = list.getByRole('button', { name: /^(Place session|Review room source|Fix teaching load)$/i }).first();
	await expect(action).toBeVisible({ timeout: 15_000 });
	const actionLabel = (await action.innerText()).trim();
	test.skip(!/^(Place session|Review room source)$/i.test(actionLabel), `Fixture first visible item is not place-capable after scrolling: ${actionLabel}`);
	await action.click();
	const placeableCell = page.locator(
		'td[data-day][data-start-time][data-end-time][aria-label^="Move selected session to"]:not(:has([data-timetable-entry="true"]))',
	).first();
	await expect(placeableCell).toBeVisible({ timeout: 15_000 });
	const placeableText = (await placeableCell.innerText().catch(() => '')).trim();
	expect(placeableText, 'Placement target must not be a special-event slot').not.toMatch(/FLAG CEREMONY|RECESS|HEALTH BREAK|LUNCH/i);
	await placeableCell.click({ position: { x: 8, y: 8 } });
	const dialog = page.getByTestId('generated-placement-review-dialog');
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	return dialog;
}

test.describe.serial('Older-user Phase 4 timetable touch queue and reflow proof', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('generated unassigned queue advances by touch on mobile and never scrolls the page root', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const { list } = await openGeneratedQueue(page);
		const rootBefore = await assertNoGlobalOverflow(page);
		const before = await queueMetrics(list);
		expect(before.scrollHeight, `Queue must be scrollable for Phase 4 proof. ${JSON.stringify(before)}`).toBeGreaterThan(before.clientHeight + 80);
		expect(before.visibleItems, `Virtualized queue should render a bounded visible slice. ${JSON.stringify(before)}`).toBeLessThanOrEqual(16);

		const viewport = page.viewportSize();
		let gesture: 'touch-dispatched' | 'desktop-wheel' | 'no-box';
		if (testInfo.project.name.startsWith('mobile')) {
			gesture = await cdpTouchSwipe(page, list);
		} else {
			const box = await list.boundingBox();
			expect(box, 'Desktop list box must be available for wheel proof.').toBeTruthy();
			await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
			await page.mouse.wheel(0, Math.max(260, Math.floor(box!.height * 0.85)));
			gesture = 'desktop-wheel';
		}
		await page.waitForTimeout(250);

		const after = await queueMetrics(list);
		const rootAfter = await assertNoGlobalOverflow(page);
		expect(after.scrollTop, `Queue must advance from the user gesture. before=${JSON.stringify(before)} after=${JSON.stringify(after)} gesture=${gesture}`).toBeGreaterThan(before.scrollTop + 24);
		expect(rootAfter.scrollHeight, `Root must not become the scrolling region. before=${JSON.stringify(rootBefore)} after=${JSON.stringify(rootAfter)}`).toBeLessThanOrEqual(rootAfter.clientHeight + 8);
		expect(guard.blockedWrites, 'Touch/scroll proof must not call commit endpoints.').toEqual([]);

		await attachPhase4Artifact(testInfo, 'queue-touch-scroll-metrics', {
			viewport,
			gesture,
			before,
			after,
			rootBefore,
			rootAfter,
			evidenceType: testInfo.project.name.startsWith('mobile') ? 'Browser proxy CDP touch gesture' : 'Desktop wheel control',
		});
	});

	test('click-to-place remains usable after queue scrolling without stale selection', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const { list } = await openGeneratedQueue(page);
		if (testInfo.project.name.startsWith('mobile')) {
			await cdpTouchSwipe(page, list, 220);
		} else {
			await list.evaluate((node) => { node.scrollTop = Math.min(360, node.scrollHeight - node.clientHeight); });
		}
		await page.waitForTimeout(200);
		const scrolled = await queueMetrics(list);
		expect(scrolled.scrollTop).toBeGreaterThan(24);

		const dialog = await openPlacementReviewWithoutSaving(page, list);
		await expect(dialog).toContainText(/Review generated placement/i);
		await expect(dialog).toContainText(/Teaching Load owner/i);
		await dialog.getByRole('button', { name: /^Cancel$/i }).click();
		await expect(dialog).toBeHidden({ timeout: 10_000 });
		expect(guard.blockedWrites, 'Scroll plus click-to-place cancel must not call commit endpoints.').toEqual([]);

		await attachPhase4Artifact(testInfo, 'post-scroll-click-placement', {
			viewport: page.viewportSize(),
			scrolled,
			dialogOpened: true,
			blockedWrites: guard.blockedWrites,
		});
	});

	test('200 percent reflow keeps drawer, status key, queue, and review sheet inside local scroll regions', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		await page.addStyleTag({
			content: `
				html { font-size: 200% !important; }
				* { scroll-behavior: auto !important; }
			`,
		});
		await openTimetableSimple(page);
		await expect(page.getByRole('button', { name: /Open timetable status key/i })).toBeVisible({ timeout: 20_000 });
		await page.getByRole('button', { name: /Open timetable status key/i }).click();
		await expect(page.getByText(/Can place/i).first()).toBeVisible({ timeout: 10_000 });
		const drawer = await openTaskDrawer(page, /Place unresolved sessions/i);
		const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
		await expect(list).toBeVisible({ timeout: 20_000 });
		const metricsBeforeReview = {
			root: await assertNoGlobalOverflow(page),
			drawer: await drawer.evaluate((node) => ({
				clientHeight: node.clientHeight,
				scrollHeight: node.scrollHeight,
				bounds: node.getBoundingClientRect().toJSON(),
			})),
			queue: await queueMetrics(list),
		};
		expect(metricsBeforeReview.queue.clientHeight, `Queue must retain a visible viewport at 200% zoom. ${JSON.stringify(metricsBeforeReview)}`).toBeGreaterThan(80);

		const dialog = await openPlacementReviewWithoutSaving(page, list);
		const sheet = page.getByTestId('review-action-sheet').first();
		await expect(sheet).toBeVisible({ timeout: 15_000 });
		const metricsWithReview = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			const dialog = document.querySelector('[data-testid="generated-placement-review-dialog"]')?.getBoundingClientRect();
			const sheet = document.querySelector('[data-testid="review-action-sheet"]') as HTMLElement | null;
			return {
				rootScrollHeight: root.scrollHeight,
				rootClientHeight: root.clientHeight,
				rootScrollWidth: root.scrollWidth,
				rootClientWidth: root.clientWidth,
				dialogTop: dialog?.top ?? null,
				dialogBottom: dialog?.bottom ?? null,
				sheetClientHeight: sheet?.clientHeight ?? null,
				sheetScrollHeight: sheet?.scrollHeight ?? null,
				sheetOverflowY: sheet ? getComputedStyle(sheet).overflowY : null,
			};
		});
		expect(metricsWithReview.rootScrollHeight).toBeLessThanOrEqual(metricsWithReview.rootClientHeight + 8);
		expect(metricsWithReview.rootScrollWidth).toBeLessThanOrEqual(metricsWithReview.rootClientWidth + 8);
		expect(metricsWithReview.sheetClientHeight ?? 0).toBeGreaterThan(80);
		expect(metricsWithReview.sheetScrollHeight ?? 0).toBeGreaterThanOrEqual(metricsWithReview.sheetClientHeight ?? 0);
		await dialog.getByRole('button', { name: /^Cancel$/i }).click();
		await expect(dialog).toBeHidden({ timeout: 10_000 });
		expect(guard.blockedWrites, 'Reflow review/cancel proof must not call commit endpoints.').toEqual([]);

		await attachPhase4Artifact(testInfo, 'two-hundred-percent-reflow', {
			viewport: page.viewportSize(),
			metricsBeforeReview,
			metricsWithReview,
			blockedWrites: guard.blockedWrites,
		});
	});
});
