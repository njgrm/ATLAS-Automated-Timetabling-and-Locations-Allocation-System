import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-workflow-phase02');

async function loginAdmin(page: Page) {
	const response = await page.request.post('/api/v1/auth/login', { data: credentials });
	expect(response.ok(), `Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Admin login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		sessionStorage.setItem('atlas_local_token', token);
		localStorage.setItem('atlas_timetable_tour', 'true');
	}, payload.token!);
}

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
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');
		const isReadOnly = method === 'GET' || method === 'HEAD';

		if (!isReadOnly && !isPreview) {
			blocked.push(`${method} ${pathname}`);
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'WORKFLOW_PHASE02_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function openTimetable(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
}

async function openPlanDraft(page: Page) {
	const secondaryAction = page.getByTestId('timetable-simple-secondary-action');
	if (await secondaryAction.isVisible().catch(() => false)) {
		await secondaryAction.click();
		return;
	}
	await page.getByRole('button', { name: /^More$/i }).click();
	await page.getByRole('button', { name: /Plan before generating/i }).click();
}

test.describe.serial('Timetable Phase 2 draft placement recovery gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('primary draft action opens the draft grid and exposes the unassigned queue quickly', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		const start = Date.now();
		await openPlanDraft(page);
		await expect(page.getByText(/Pre-Generation Draft/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('pregen-plotting-tray')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 10_000 });
		const openedInMs = Date.now() - start;
		expect(openedInMs, `Draft workspace should become actionable in under 3 seconds after the primary action, observed ${openedInMs}ms.`).toBeLessThan(3_000);

		const queueItems = page.getByTestId('pregen-plotting-visible-list').getByRole('button');
		await expect(queueItems.first()).toBeVisible({ timeout: 10_000 });
		expect(await queueItems.count(), 'Draft queue must expose selectable sessions.').toBeGreaterThan(0);

		await attachReport(testInfo, 'draft-primary-entry', {
			openedInMs,
			queueCount: await queueItems.count(),
			blockedWrites,
		});
	});

	test('draft queue item opens visible placement confirmation instead of auto-committing', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		await openPlanDraft(page);
		await expect(page.getByTestId('pregen-plotting-tray')).toBeVisible({ timeout: 10_000 });

		const queueItem = page.getByTestId('pregen-plotting-visible-list').getByRole('button', { name: /Place in draft|Choose room first|Fix Teaching Load owner/i }).first();
		await expect(queueItem).toBeVisible({ timeout: 10_000 });
		await queueItem.click();

		const emptyTargetCell = page
			.locator('td[role="button"][data-day][data-start-time][data-end-time]')
			.filter({ hasNot: page.locator('[data-timetable-entry="true"]') })
			.first();
		await expect(emptyTargetCell).toBeVisible({ timeout: 10_000 });
		await emptyTargetCell.click();

		const placementDialog = page.getByRole('dialog').filter({ hasText: /Review draft placement/i });
		await expect(placementDialog).toBeVisible({ timeout: 15_000 });
		await expect(placementDialog).toContainText(/1\. Owner/i);
		await expect(placementDialog).toContainText(/2\. Room source/i);
		await expect(placementDialog).toContainText(/3\. Slot/i);
		await expect(placementDialog).toContainText(/4\. Conflicts/i);
		await expect(placementDialog).toContainText(/5\. Save/i);
		await expect(placementDialog.getByText(/Teaching Load owner/i).first()).toBeVisible();
		await expect(placementDialog.getByText(/Suggested room/i).first()).toBeVisible();
		await expect(placementDialog.getByText(/Choose teacher|Choose room|Assign teacher and room/i)).toHaveCount(0);
		const saveButton = placementDialog.getByRole('button', { name: /Save placement/i });
		await expect(saveButton).toBeVisible();
		const saveReason = placementDialog.getByTestId('draft-placement-save-reason');
		await expect(saveReason).toBeVisible();
		if (await saveButton.isDisabled()) {
			await expect(saveReason).toContainText(/Waiting|Fix|Choose|repair|another slot|unavailable|outside .* scheduling window/i);
		}
		expect(blockedWrites, 'Opening and previewing the placement flow must not attempt a live commit.').toEqual([]);

		await attachReport(testInfo, 'draft-placement-confirmation', {
			blockedWrites,
		});
	});
});
