import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-overhaul-iteration-c');

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

async function measurePage(page: Page, contentSelector: string, headerSelector?: string) {
	const content = page.locator(contentSelector).first();
	await expect(content).toBeVisible({ timeout: 45_000 });
	return page.evaluate(({ contentSelector, headerSelector }) => {
		const root = document.scrollingElement ?? document.documentElement;
		const contentBox = document.querySelector(contentSelector)?.getBoundingClientRect();
		const headerBox = headerSelector ? document.querySelector(headerSelector)?.getBoundingClientRect() : null;
		return {
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			scrollHeight: root.scrollHeight,
			clientHeight: root.clientHeight,
			bodyOverflow: getComputedStyle(document.body).overflow,
			contentTop: contentBox?.top ?? null,
			contentHeight: contentBox?.height ?? null,
			headerHeight: headerBox?.height ?? null,
			headerBottom: headerBox?.bottom ?? null,
		};
	}, { contentSelector, headerSelector });
}

test.describe.serial('Timetable overhaul Iteration C compact shell gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	for (const target of [
		{ label: 'Sections', path: '/sections' },
		{ label: 'Subjects', path: '/subjects' },
		{ label: 'Teachers', path: '/faculty' },
	]) {
		test(`${target.label} uses compact setup command header`, async ({ page }, testInfo) => {
			test.setTimeout(90_000);
			await page.goto(target.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
			const metrics = await measurePage(page, '[data-testid="admin-content-shell"]', '[data-testid="admin-command-header"]');

			expect(
				metrics.headerHeight,
				`${target.label} command header must stay compact. Metrics: ${JSON.stringify(metrics)}`,
			).toBeLessThanOrEqual(metrics.viewportWidth < 768 ? 185 : 150);
			expect(
				metrics.contentTop,
				`${target.label} first useful content must start near the top. Metrics: ${JSON.stringify(metrics)}`,
			).toBeLessThanOrEqual(metrics.viewportWidth < 768 ? 245 : 220);
			expect(
				metrics.scrollHeight,
				`${target.label} must not create a global page scrollbar. Metrics: ${JSON.stringify(metrics)}`,
			).toBeLessThanOrEqual(metrics.clientHeight + 8);

			await attachReport(testInfo, `${target.label.toLowerCase()}-compact-header`, metrics);
		});
	}

	test('Teaching Load uses compact command header and exposes the workspace quickly', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await page.goto('/teaching-load', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		const metrics = await measurePage(page, '[data-testid="teaching-load-content-shell"]', '[data-testid="teaching-load-command-header"]');

		expect(
			metrics.headerHeight,
			`Teaching Load command header must stay compact. Metrics: ${JSON.stringify(metrics)}`,
		).toBeLessThanOrEqual(metrics.viewportWidth < 768 ? 210 : 170);
		expect(
			metrics.contentTop,
			`Teaching Load workspace must start near the top. Metrics: ${JSON.stringify(metrics)}`,
		).toBeLessThanOrEqual(metrics.viewportWidth < 768 ? 260 : 230);
		expect(
			metrics.scrollHeight,
			`Teaching Load must not create a global page scrollbar. Metrics: ${JSON.stringify(metrics)}`,
		).toBeLessThanOrEqual(metrics.clientHeight + 8);

		await attachReport(testInfo, 'teaching-load-compact-header', metrics);
	});

	test('Timetable keeps task guide compact while preserving primary actions', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
		await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible({ timeout: 15_000 });

		const metrics = await page.evaluate(() => {
			const root = document.scrollingElement ?? document.documentElement;
			const simpleHeader = document.querySelector('[data-testid="timetable-simple-header"]')?.getBoundingClientRect();
			const table = document.querySelector('table[aria-label="Timetable"]')?.getBoundingClientRect();
			return {
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight,
				scrollHeight: root.scrollHeight,
				clientHeight: root.clientHeight,
				simpleHeaderHeight: simpleHeader?.height ?? null,
				tableTop: table?.top ?? null,
				simpleHeaderVisible: Boolean(document.querySelector('[data-testid="timetable-simple-header"]')),
				primaryActionVisible: Boolean(document.querySelector('[data-testid="timetable-simple-primary-action"]')),
				oldTaskGuideVisible: Boolean(document.querySelector('[data-testid="timetable-task-guide"]')),
			};
		});

		expect(metrics.simpleHeaderHeight, `Timetable Simple header must not crowd the grid. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.viewportWidth < 768 ? 140 : 150);
		expect(metrics.tableTop, `Timetable grid should remain visually primary. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(300);
		expect(metrics.scrollHeight, `Timetable must not create a global page scrollbar. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientHeight + 8);
		expect(metrics.simpleHeaderVisible && metrics.primaryActionVisible && !metrics.oldTaskGuideVisible).toBeTruthy();

		await attachReport(testInfo, 'timetable-compact-simple-header', metrics);
	});
});
