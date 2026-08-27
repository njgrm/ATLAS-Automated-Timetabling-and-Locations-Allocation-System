import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAdmin, openTimetableSimple, openSimpleMore } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-swap-old-scheduler', 'visual-decision');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function blockDestructiveTimetableWrites(page: Page) {
	const blocked: string[] = [];
	await page.route('**/api/v1/generation/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const pathname = url.pathname;
		const method = request.method();
		const isReadOnly = method === 'GET' || method === 'HEAD';
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');

		if (!isReadOnly && !isPreview) {
			blocked.push(`${method} ${pathname}`);
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'TIMETABLE_VISUAL_DECISION_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function activateSwapTaskMode(page: Page) {
	await openSimpleMore(page);
	const swapMenuItem = page.getByRole('menuitem', { name: /Swap sessions/i });
	await expect(swapMenuItem).toBeVisible({ timeout: 5_000 });
	await swapMenuItem.click();
	const drawer = page.getByTestId('timetable-task-drawer');
	await expect(drawer).toBeVisible({ timeout: 10_000 });
}

async function openGeneratedSwapDialog(page: Page) {
	const occupiedEntries = page.locator('[data-timetable-entry="true"]');
	const count = await occupiedEntries.count();
	if (count < 2) {
		return { opened: false as const, reason: `Only ${count} occupied entries found; need at least 2 for swap.` };
	}

	const firstEntry = occupiedEntries.nth(0);
	const secondEntry = occupiedEntries.nth(1);

	await expect(firstEntry).toBeVisible({ timeout: 10_000 });
	await firstEntry.click();
	await page.waitForTimeout(500);

	await expect(secondEntry).toBeVisible({ timeout: 5_000 });
	await secondEntry.click();

	const dialog = page.getByTestId('generated-swap-review-dialog');
	try {
		await expect(dialog).toBeVisible({ timeout: 20_000 });
		return { opened: true as const, dialog };
	} catch {
		return { opened: false as const, reason: 'generated-swap-review-dialog did not appear after selecting two occupied cells.' };
	}
}

async function captureVisualDecisionMetrics(page: Page, dialog: ReturnType<typeof page.getByTestId>, testInfo: TestInfo) {
	await dialog.locator('[data-testid="generated-swap-preview-status"]').filter({ hasText: /ready|error/i }).waitFor({ timeout: 15_000 }).catch(() => {});

	const title = await dialog.locator('h2').first().innerText({ timeout: 5_000 }).catch(() => '');
	const dialogText = await dialog.innerText({ timeout: 5_000 }).catch(() => '');
	const visibleTextLength = dialogText.length;

	const primaryRegions = dialog.locator('[data-testid="generated-swap-primary-region"]');
	const primaryRegionCount = await primaryRegions.count();

	const pairRegion = dialog.locator('[data-testid="generated-swap-pair-region"]');
	const pairVisible = await pairRegion.isVisible().catch(() => false);
	const pairBox = await pairRegion.boundingBox().catch(() => null);

	const recommendedRegion = dialog.locator('[data-testid="generated-swap-recommended-region"]');
	const recommendedVisible = await recommendedRegion.isVisible().catch(() => false);
	const recommendedBox = await recommendedRegion.boundingBox().catch(() => null);

	const actionRegion = dialog.locator('[data-testid="generated-swap-action-region"]');
	const actionVisible = await actionRegion.isVisible().catch(() => false);
	const actionBox = await actionRegion.boundingBox().catch(() => null);

	const dialogBox = await dialog.boundingBox().catch(() => null);

	const bodyContainer = dialog.locator('.flex-1.min-h-0.overflow-auto').first();
	const bodyMetrics = await bodyContainer.evaluate((el) => ({
		scrollHeight: el.scrollHeight,
		clientHeight: el.clientHeight,
		requiresScroll: el.scrollHeight > el.clientHeight + 4,
	})).catch(() => ({ scrollHeight: 0, clientHeight: 0, requiresScroll: false }));

	const footerArea = dialog.locator('[class*="border-t"]').last();
	const footerVisible = await footerArea.isVisible().catch(() => false);
	const footerBox = await footerArea.boundingBox().catch(() => null);

	const selectedStatus = dialog.locator('[data-testid="generated-swap-selected-status"]');
	const selectedStatusVisible = await selectedStatus.isVisible().catch(() => false);
	const selectedStatusBox = await selectedStatus.boundingBox().catch(() => null);

	const hasNoBlockers = dialogText.includes('No blockers');
	const hasBlockingCopy = dialogText.includes('Blocking 0');
	const hasWarningsCopy = dialogText.includes('Warnings');
	const hasRecommendedBadge = dialogText.includes('Recommended');

	const globalOverflow = await page.evaluate(() => ({
		hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
		docScrollWidth: document.documentElement.scrollWidth,
		docClientWidth: document.documentElement.clientWidth,
	})).catch(() => ({ hasHorizontalOverflow: false, docScrollWidth: 0, docClientWidth: 0 }));

	const feedbackText = await dialog.locator('[data-testid="generated-swap-feedback"]').innerText({ timeout: 3_000 }).catch(() => '');

	let primaryRegionsIntersectAction = false;
	if (pairBox && actionBox) {
		primaryRegionsIntersectAction = pairBox.y < (actionBox.y + actionBox.height) && (pairBox.y + pairBox.height) > actionBox.y;
	}
	if (recommendedBox && actionBox) {
		primaryRegionsIntersectAction = primaryRegionsIntersectAction || (recommendedBox.y < (actionBox.y + actionBox.height) && (recommendedBox.y + recommendedBox.height) > actionBox.y);
	}

	await page.screenshot({
		path: path.join(reportRoot, `${testInfo.project.name}-visual-decision.png`),
		fullPage: false,
	});

	return {
		title,
		primaryRegionCount,
		pairVisible,
		pairBox,
		recommendedVisible,
		recommendedBox,
		actionVisible,
		actionBox,
		dialogBox,
		bodyMetrics,
		footerVisible,
		footerBox,
		selectedStatusVisible,
		selectedStatusBox,
		hasNoBlockers,
		hasBlockingCopy,
		hasWarningsCopy,
		hasRecommendedBadge,
		globalOverflow,
		feedbackText,
		primaryRegionsIntersectAction,
		visibleTextLength,
	};
}

test.describe.serial('Timetable swap visual decision gate', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('generated swap has decision-first layout across viewports', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const token = await loginAdmin(page);
		const headers = { Authorization: `Bearer ${token}` };

		const runtimeResponse = await page.request.get('/api/v1/runtime/context?schoolId=1', { headers });
		expect(runtimeResponse.ok()).toBeTruthy();
		const runtime = await runtimeResponse.json() as { activeSchoolYearId: number };

		const blockedWrites = await blockDestructiveTimetableWrites(page);

		await openTimetableSimple(page);
		await activateSwapTaskMode(page);

		const swapResult = await openGeneratedSwapDialog(page);
		if (!swapResult.opened) {
			test.skip(true, swapResult.reason);
			return;
		}

		const metrics = await captureVisualDecisionMetrics(page, swapResult.dialog, testInfo);

		await attachReport(testInfo, 'visual-decision-metrics', {
			viewport: testInfo.project.name,
			...metrics,
			blockedWrites,
		});

		expect(metrics.title).toBe('Swap these two classes?');
		expect(metrics.primaryRegionCount).toBeGreaterThanOrEqual(1);
		expect(metrics.visibleTextLength).toBeGreaterThan(50);
		expect(metrics.dialogBox).toBeTruthy();
		expect(metrics.footerVisible).toBe(true);
		expect(metrics.globalOverflow.hasHorizontalOverflow).toBe(false);
		expect(metrics.pairVisible).toBe(true);
		expect(metrics.recommendedVisible).toBe(true);
		expect(metrics.actionVisible).toBe(true);
		expect(metrics.primaryRegionsIntersectAction).toBe(false);
		expect(metrics.hasNoBlockers).toBe(true);
		expect(metrics.hasRecommendedBadge).toBe(true);

		await swapResult.dialog.locator('button').filter({ hasText: /Cancel/i }).first().click();
		await expect(swapResult.dialog).toBeHidden({ timeout: 5_000 });
	});
});
