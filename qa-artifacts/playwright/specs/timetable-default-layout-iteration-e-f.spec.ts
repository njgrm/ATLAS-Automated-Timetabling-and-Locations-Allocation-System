import { expect, test, type Page } from '@playwright/test';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

async function loginAdmin(page: Page) {
	const response = await page.request.post('/api/v1/auth/login', { data: credentials });
	expect(response.ok(), `Admin login failed with HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token, 'Admin login API must return a bearer token.').toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		window.localStorage.removeItem('atlas_timetable_layout_mode');
		window.localStorage.setItem('atlas_timetable_tour', 'true');
		window.sessionStorage.setItem('atlas_local_token', token);
	}, payload.token!);
}

async function openTimetable(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 30_000 });
}

test.describe.serial('Timetable default-layout redesign Iterations E-F', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('simple mode is the default and keeps the grid visually primary', async ({ page }) => {
		await openTimetable(page);

		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await expect(page.getByTestId('timetable-simple-task-prompt')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		await expect(page.getByTestId('timetable-layout-toggle')).toContainText(/Advanced/i);

		const metrics = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			const table = document.querySelector('table[aria-label="Timetable"]')?.getBoundingClientRect();
			const header = document.querySelector('[data-testid="timetable-simple-header"]')?.getBoundingClientRect();
			return {
				tableTop: table?.top ?? null,
				headerHeight: header?.height ?? null,
				scrollHeight: root.scrollHeight,
				clientHeight: root.clientHeight,
				scrollWidth: root.scrollWidth,
				clientWidth: root.clientWidth,
			};
		});

		expect(metrics.tableTop, `Grid should start early in simple mode. ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(220);
		expect(metrics.scrollHeight, `No global vertical scrollbar expected. ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientHeight + 8);
		expect(metrics.scrollWidth, `No page horizontal overflow expected. ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 8);
	});

	test('advanced toggle restores the expert cockpit and can return to simple', async ({ page }) => {
		await openTimetable(page);

		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('timetable-layout-toggle')).toContainText(/Simple/i);

		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 10_000 });
	});

	test('simple task actions open focused drawers instead of persistent rails', async ({ page }) => {
		await openTimetable(page);

		await page.getByTestId('timetable-simple-primary-action').click();
		await expect(page.getByTestId('timetable-task-drawer')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('timetable-task-drawer')).toContainText(/Choose|Review|Publish/i);

		await page.getByRole('button', { name: /Close task drawer/i }).click();
		await expect(page.getByTestId('timetable-task-drawer')).toHaveCount(0);

		await page.getByRole('button', { name: /^More$/i }).click();
		await page.getByRole('button', { name: /Swap sessions/i }).click();
		await expect(page.getByTestId('timetable-task-drawer')).toContainText(/Choose first class/i);
		await expect(page.getByTestId('timetable-task-drawer')).toContainText(/Review the visual swap sheet/i);
	});
});
