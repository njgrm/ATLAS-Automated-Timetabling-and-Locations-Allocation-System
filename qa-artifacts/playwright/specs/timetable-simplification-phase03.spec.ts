import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-simplification-phase03');

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

async function openTimetable(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
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
				body: JSON.stringify({ message: 'TIMETABLE_PHASE03_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return blocked;
}

async function openDraftWorkspace(page: Page) {
	await openTimetable(page);
	await page.getByRole('button', { name: /Plan draft|Opening draft/i }).click();
	await expect(page.getByText(/Pre-Generation Draft/i).first()).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 10_000 });
}

test.describe.serial('Timetable simplification Phase 3 gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('draft placement review is readonly owner and room-source review', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openDraftWorkspace(page);

		const queueItem = page.locator('#panel-unassigned [role="button"]').first();
		await expect(queueItem).toBeVisible({ timeout: 10_000 });
		await queueItem.click();

		const emptyTargetCell = page
			.locator('td[role="button"][data-day][data-start-time][data-end-time]')
			.filter({ hasNot: page.locator('[data-timetable-entry="true"]') })
			.first();
		await expect(emptyTargetCell).toBeVisible({ timeout: 10_000 });
		await emptyTargetCell.click();

		const dialog = page.getByRole('dialog').filter({ hasText: /Place this class\?/i });
		await expect(dialog).toBeVisible({ timeout: 15_000 });
		await expect(dialog).toContainText(/Teaching Load owner/i);
		await expect(dialog).toContainText(/Suggested room/i);
		await expect(dialog).toContainText(/Target slot/i);
		await expect(dialog).toContainText(/Blocking/i);
		await expect(dialog).toContainText(/Warnings/i);
		await expect(dialog.getByText(/Choose teacher|Choose room|Assign teacher and room/i)).toHaveCount(0);
		await expect(dialog.locator('[role="combobox"]')).toHaveCount(0);
		expect(blockedWrites, 'Opening draft placement review must not commit live writes.').toEqual([]);

		await attachReport(testInfo, 'readonly-draft-placement', {
			dialogText: (await dialog.innerText()).slice(0, 1200),
			blockedWrites,
		});
	});

	test('generated occupied-slot swap uses visual figures without owner reassignment controls', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		const entries = page.locator('[data-timetable-entry="true"]');
		await expect(entries.nth(0)).toBeVisible({ timeout: 20_000 });
		await expect(entries.nth(1)).toBeVisible({ timeout: 20_000 });
		await entries.nth(0).click();
		await entries.nth(1).click();

		const switchDialog = page.getByRole('dialog').filter({ hasText: /Swap these two classes\?/i });
		await expect(switchDialog).toBeVisible({ timeout: 20_000 });
		await expect(switchDialog).toContainText(/Direct swap|Move blocking session|Move selected session/i);
		await expect(switchDialog).toContainText(/Blocking/i);
		await expect(switchDialog).toContainText(/Warnings/i);
		await expect(switchDialog.getByText(/Choose teacher|Choose room|Assign teacher and room/i)).toHaveCount(0);
		await expect(switchDialog.locator('[role="combobox"]')).toHaveCount(0);
		expect(blockedWrites, 'Opening occupied-slot swap review must not commit live writes.').toEqual([]);

		await attachReport(testInfo, 'generated-visual-swap-review', {
			dialogText: (await switchDialog.innerText()).slice(0, 1200),
			blockedWrites,
		});
	});
});
