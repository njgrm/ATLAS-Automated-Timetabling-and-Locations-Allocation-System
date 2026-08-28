import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-workflow-phase01');

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
				body: JSON.stringify({ message: 'WORKFLOW_PHASE01_WRITE_BLOCKED' }),
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

async function openGeneratedUnassignedRail(page: Page) {
	const railTab = page.getByRole('tab', { name: /Unassigned/i });
	if (await railTab.isVisible().catch(() => false)) {
		await railTab.click();
		return 'tab';
	}
	const advancedTask = page.getByTestId('timetable-task-place');
	if (await advancedTask.isVisible().catch(() => false)) {
		await advancedTask.click();
		return 'advanced-task';
	}
	await page.getByRole('button', { name: /^More$/i }).click();
	await page.getByRole('button', { name: /Place unresolved sessions/i }).click();
	return 'simple-task';
}

test.describe.serial('Timetable Phase 0/1 workflow recovery gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('generated-run unassigned list has usable scroll area and opens placement flow', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		const openedVia = await openGeneratedUnassignedRail(page);
		const tray = page.getByTestId('simple-plotting-tray');
		await expect(tray).toBeVisible({ timeout: 15_000 });
		await expect(tray.getByTestId('simple-plotting-session-row').first()).toBeVisible({ timeout: 10_000 });

		const findButton = page.getByTestId('simple-plotting-find-session');
		await expect(findButton).toBeVisible({ timeout: 10_000 });
		await findButton.click();

		const list = page.getByTestId('simple-plotting-scroll');
		await expect(list).toBeVisible({ timeout: 15_000 });

		const viewport = page.viewportSize();
		const minimumUsableHeight = viewport && viewport.height < 500 ? 96 : 220;
		const beforeScroll = await list.evaluate((node) => ({
			clientHeight: node.clientHeight,
			scrollHeight: node.scrollHeight,
			scrollTop: node.scrollTop,
		}));
		expect(beforeScroll.clientHeight, `Generated unassigned list viewport must be usable, not a one-line ${beforeScroll.clientHeight}px rail.`).toBeGreaterThanOrEqual(minimumUsableHeight);
		expect(beforeScroll.scrollHeight, 'Generated unassigned list should contain scrollable content for this live run.').toBeGreaterThan(beforeScroll.clientHeight);

		await list.focus();
		await page.keyboard.press('PageDown');
		await expect.poll(async () => list.evaluate((node) => node.scrollTop), {
			message: 'Generated unassigned Find-session list should scroll with keyboard focus.',
			timeout: 5_000,
		}).toBeGreaterThan(0);
		await list.evaluate((node) => {
			node.scrollTop = 0;
		});

		const visibleUnassignedRow = list.locator('[role="listitem"] button').first();
		await expect(visibleUnassignedRow).toBeVisible({ timeout: 10_000 });
		await visibleUnassignedRow.click();
		const placementAction = list.getByRole('button', { name: /^(Place session|Review room source|Fix teaching load)$/i }).first();
		await expect(placementAction).toBeVisible({ timeout: 10_000 });
		await placementAction.click();

		const placeableCell = page.locator(
			'td[data-day][data-start-time][data-end-time][aria-label^="Move selected session to"]:not(:has([data-timetable-entry="true"]))',
		).first();
		await expect(placeableCell).toBeVisible({ timeout: 15_000 });
		const placeableText = (await placeableCell.innerText().catch(() => '')).trim();
		expect(placeableText, 'Placement target must not be a special-event slot').not.toMatch(/FLAG CEREMONY|RECESS|HEALTH BREAK|LUNCH/i);
		await placeableCell.click({ position: { x: 8, y: 8 } });

		const placementSheet = page.getByTestId('generated-placement-review-dialog');
		await expect(placementSheet).toBeVisible({ timeout: 15_000 });
		await expect(placementSheet).toContainText(/Review generated placement/i);
		await expect(placementSheet).toContainText(/Teaching Load owner/i);
		await expect(placementSheet).toContainText(/Room source/i);

		await attachReport(testInfo, 'generated-unassigned-placement', {
			beforeScroll,
			minimumUsableHeight,
			openedVia,
			blockedWrites,
		});
	});

	test('generated occupied sessions can open swap review from the common click path', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		const blockedWrites = await blockDestructiveTimetableWrites(page);
		await openTimetable(page);

		const entries = page.locator('[data-timetable-entry="true"]');
		await expect(entries.first()).toBeVisible({ timeout: 20_000 });
		const entryCount = await entries.count();
		expect(entryCount, 'Live run must expose at least two generated entries for swap workflow verification.').toBeGreaterThanOrEqual(2);

		await entries.nth(0).click();
		await entries.nth(1).click();

		const swapDialog = page.getByRole('dialog').filter({ hasText: /Swap these two classes\?/i });
		await expect(swapDialog).toBeVisible({ timeout: 20_000 });
		await expect(swapDialog).toContainText(/exchange times/i);
		await expect(swapDialog.getByRole('button', { name: /Direct swap|Move blocking session|Move selected session/i }).first()).toBeVisible({ timeout: 20_000 });

		await attachReport(testInfo, 'generated-swap-click-path', {
			entryCount,
			blockedWrites,
		});
	});
});
