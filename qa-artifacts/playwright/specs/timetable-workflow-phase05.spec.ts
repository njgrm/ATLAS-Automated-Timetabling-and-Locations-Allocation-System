import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-workflow-phase05');

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
				body: JSON.stringify({ message: 'WORKFLOW_PHASE05_WRITE_BLOCKED' }),
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

test.describe.serial('Timetable Phase 5 older-user accessibility and foolproofing gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('primary task guide uses large targets and persistent plain-language instructions', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await openTimetable(page);

		const taskGuide = page.getByTestId('timetable-task-guide');
		const help = page.getByTestId('timetable-foolproof-help');
		await expect(taskGuide).toBeVisible({ timeout: 10_000 });
		await expect(help).toBeVisible({ timeout: 10_000 });
		await expect(help).toContainText(/No precision dragging required/i);
		await expect(help).toContainText(/Can place = empty slot\. Can swap = occupied slot\. Blocked = fix first\. Warning = review only\./i);

		const taskButtons = [
			page.getByTestId('timetable-task-review'),
			page.getByTestId('timetable-task-place'),
			page.getByTestId('timetable-task-switch'),
			page.getByTestId('timetable-task-plan'),
			page.getByTestId('timetable-task-requests'),
		];
		const targetSizes: Array<{ id: string; width: number; height: number; name: string | null }> = [];
		for (const button of taskButtons) {
			await expect(button).toBeVisible();
			const box = await button.boundingBox();
			const id = await button.getAttribute('data-testid');
			const name = await button.textContent();
			expect(box, `${id} must expose a measurable target.`).toBeTruthy();
			expect(box!.height, `${id} must be at least 44px tall for older/touch users.`).toBeGreaterThanOrEqual(44);
			expect((name ?? '').trim(), `${id} must not be icon-only or unlabeled.`).not.toEqual('');
			targetSizes.push({ id: id ?? 'unknown', width: box!.width, height: box!.height, name });
		}

		await page.getByTestId('timetable-task-place').click();
		await expect(help).toContainText(/Place:/i);
		await expect(help).toContainText(/tap or click a grid slot/i);
		await expect(page.getByTestId('timetable-status-legend')).toContainText(/Blocked = fix first/i);
		await page.getByTestId('timetable-task-switch').click();
		await expect(help).toContainText(/Switch:/i);
		await expect(help).toContainText(/Review occupied-slot swap/i);
		await page.getByRole('button', { name: /Plan before generating|Opening draft/i }).click();
		await expect(help).toContainText(/Draft mode/i);
		await expect(help).toContainText(/Review draft placement/i);

		const scrollMetrics = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			return {
				scrollHeight: root.scrollHeight,
				clientHeight: root.clientHeight,
				overflow: getComputedStyle(document.body).overflow,
			};
		});
		expect(
			scrollMetrics.scrollHeight,
			`Phase 5 help must not create a global page scrollbar. Metrics: ${JSON.stringify(scrollMetrics)}`,
		).toBeLessThanOrEqual(scrollMetrics.clientHeight + 8);

		await attachReport(testInfo, 'foolproof-help-and-targets', { targetSizes, scrollMetrics });
	});

	test('keyboard and click placement paths still open review surfaces without precision dragging', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		await page.getByTestId('timetable-task-place').click();
		const generatedList = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
		await expect(generatedList).toBeVisible({ timeout: 15_000 });
		await generatedList.locator('[role="listitem"] button').first().click();
		await generatedList.getByRole('button', { name: /^(Place session|Fix teaching load)$/i }).first().click();
		const assignmentDialog = page.getByRole('dialog').filter({ hasText: /Fix Teaching Load Owner/i });
		await expect(assignmentDialog).toBeVisible({ timeout: 15_000 });
		await expect(assignmentDialog).toContainText(/Choose a timetable slot/i);
		await expect(assignmentDialog).toContainText(/Select Teaching Load owner/i);
		await page.keyboard.press('Escape');

		await openTimetable(page);
		const entries = page.locator('[data-timetable-entry="true"]');
		await expect(entries.first()).toBeVisible({ timeout: 20_000 });
		await entries.nth(0).focus();
		await page.keyboard.press('Enter');
		await entries.nth(1).focus();
		await page.keyboard.press('Enter');
		const swapDialog = page.getByRole('dialog').filter({ hasText: /Review occupied-slot swap/i });
		await expect(swapDialog).toBeVisible({ timeout: 20_000 });
		await expect(swapDialog.getByRole('button', { name: /Direct swap|Move blocking session|Move selected session/i }).first()).toBeVisible({ timeout: 20_000 });
		await page.keyboard.press('Escape');

		await page.getByRole('button', { name: /Plan before generating|Opening draft/i }).click();
		await expect(page.getByText(/Pre-Generation Draft/i).first()).toBeVisible({ timeout: 10_000 });
		const draftQueueItem = page.locator('#panel-unassigned [role="button"]').first();
		await expect(draftQueueItem).toBeVisible({ timeout: 10_000 });
		await draftQueueItem.click();
		const targetCell = page
			.locator('td[role="button"][data-day][data-start-time][data-end-time]')
			.filter({ hasNot: page.locator('[data-timetable-entry="true"]') })
			.first();
		await expect(targetCell).toBeVisible({ timeout: 10_000 });
		await targetCell.focus();
		await page.keyboard.press('Enter');
		const draftDialog = page.getByRole('dialog').filter({ hasText: /Review draft placement/i });
		await expect(draftDialog).toBeVisible({ timeout: 15_000 });
		await expect(draftDialog).toContainText(/Blocking:/i);
		await expect(draftDialog).toContainText(/Warnings:/i);

		expect(blockedWrites, 'Phase 5 verification must not commit live timetable writes.').toEqual([]);
		await attachReport(testInfo, 'keyboard-click-placement-paths', { blockedWrites });
	});
});
