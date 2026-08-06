import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credentials = {
	identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
	password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-workflow-phase03');

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

test.describe.serial('Timetable Phase 3 information architecture gates', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('simple task prompt and advanced guide expose primary timetable jobs without crowding', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await openTimetable(page);

		await expect(page.getByTestId('timetable-task-guide')).toHaveCount(0);
		const simplePrompt = page.getByTestId('timetable-simple-task-prompt');
		await expect(simplePrompt).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible();
		const secondaryAction = page.getByTestId('timetable-simple-secondary-action');
		if (await secondaryAction.isVisible().catch(() => false)) {
			await expect(secondaryAction).toContainText(/Plan draft/i);
		}

		await page.getByTestId('timetable-layout-toggle').click();
		const taskGuide = page.getByTestId('timetable-task-guide');
		await expect(taskGuide).toBeVisible({ timeout: 10_000 });
		await expect(taskGuide).toContainText(/Next task/i);

		const taskNames = [
			'Review schedule',
			'Place unassigned',
			'Switch sessions',
			'Draft planner',
			'Review room requests',
		];
		for (const name of taskNames) {
			await expect(taskGuide.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
		}
		await expect(page.getByRole('button', { name: /More tools/i })).toBeVisible();

		await page.getByTestId('timetable-task-place').click();
		const unassignedPanel = page.locator('#panel-unassigned');
		await expect(unassignedPanel).toBeVisible({ timeout: 10_000 });
		await expect(unassignedPanel).toContainText(/unresolved|Needs room|Ready|Blocked/i);

		const unassignedBox = await unassignedPanel.boundingBox();
		expect(unassignedBox?.height ?? 0, 'Unassigned panel must keep enough local height to avoid starving the list.').toBeGreaterThan(170);

		await page.getByTestId('timetable-task-requests').click();
		await expect(page.locator('#panel-requests')).toBeVisible({ timeout: 10_000 });

		await page.getByTestId('timetable-task-review').click();
		await expect(page.locator('#panel-violations')).toBeVisible({ timeout: 10_000 });

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
			`Timetable should not create a global page scrollbar. Metrics: ${JSON.stringify(scrollMetrics)}`,
		).toBeLessThanOrEqual(scrollMetrics.clientHeight + 8);

		await attachReport(testInfo, 'task-guide-modes', {
			taskNames,
			simplePromptVisible: true,
			unassignedPanelHeight: unassignedBox?.height ?? null,
			scrollMetrics,
		});
	});
});
