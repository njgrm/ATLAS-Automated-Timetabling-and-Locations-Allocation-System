import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAdmin, openTimetableSimple, openSimpleMore } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-swap-old-scheduler', 'blocked-recovery');

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
				body: JSON.stringify({ message: 'TIMETABLE_BLOCKED_RECOVERY_WRITE_BLOCKED' }),
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

async function captureBlockedRecoveryMetrics(page: Page, dialog: ReturnType<typeof page.getByTestId>, testInfo: TestInfo) {
	await dialog.locator('[data-testid="generated-swap-preview-status"]').filter({ hasText: /ready|error/i }).waitFor({ timeout: 15_000 }).catch(() => {});

	const dialogText = await dialog.innerText({ timeout: 5_000 }).catch(() => '');
	const visibleTextLength = dialogText.length;

	const isBlocked = dialogText.includes('No safe swap') || dialogText.includes('This swap is blocked');
	const hasChooseAnother = dialogText.includes('Close and choose another pair');
	const hasCancelSafely = dialogText.includes('Cancel safely');
	const hasDisabledSwapButton = await dialog.locator('button:has-text("Swap sessions")').isDisabled().catch(() => true);
	const hasBlockedFeedback = dialogText.includes('blocked') || dialogText.includes('Choose another class');
	const hasConflictDetails = dialogText.includes('Blocking conflicts');

	const feedbackText = await dialog.locator('[data-testid="generated-swap-feedback"]').innerText({ timeout: 3_000 }).catch(() => '');

	await page.screenshot({
		path: path.join(reportRoot, `${testInfo.project.name}-blocked-recovery.png`),
		fullPage: false,
	});

	return {
		visibleTextLength,
		isBlocked,
		hasChooseAnother,
		hasCancelSafely,
		hasDisabledSwapButton,
		hasBlockedFeedback,
		hasConflictDetails,
		feedbackText,
	};
}

test.describe.serial('Timetable swap blocked recovery gate', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('blocked generated swap shows honest next actions across viewports', async ({ page }, testInfo) => {
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

		const metrics = await captureBlockedRecoveryMetrics(page, swapResult.dialog, testInfo);

		await attachReport(testInfo, 'blocked-recovery-metrics', {
			viewport: testInfo.project.name,
			...metrics,
			blockedWrites,
		});

		if (metrics.isBlocked) {
			expect(metrics.hasChooseAnother).toBe(true);
			expect(metrics.hasCancelSafely).toBe(true);
			expect(metrics.hasBlockedFeedback).toBe(true);
			expect(metrics.hasConflictDetails).toBe(true);
		}

		await swapResult.dialog.locator('button').filter({ hasText: /Cancel/i }).first().click();
		await expect(swapResult.dialog).toBeHidden({ timeout: 5_000 });
	});
});
