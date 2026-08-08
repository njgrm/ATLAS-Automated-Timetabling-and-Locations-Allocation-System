import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin, openTimetableAdvanced, openTimetableSimple } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'setup-first-uiux-iteration-7-8');
const routes = ['/', '/sections', '/subjects', '/teachers', '/teaching-load', '/map', '/timetable'];

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function routeSmoke(page: Page, route: string) {
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const apiFailures: string[] = [];
	const onConsole = (message: { type: () => string; text: () => string }) => {
		const text = message.text();
		if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/i.test(text)) {
			consoleErrors.push(text);
		}
	};
	const onPageError = (error: Error) => pageErrors.push(error.message);
	const onResponse = (response: { url: () => string; status: () => number }) => {
		if (response.url().includes('/api/v1/') && response.status() >= 500) apiFailures.push(`${response.status()} ${response.url()}`);
	};
	page.on('console', onConsole);
	page.on('pageerror', onPageError);
	page.on('response', onResponse);
	try {
		await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
		if (route === '/') await expect(page.getByTestId('dashboard-readiness-hub')).toBeVisible({ timeout: 45_000 });
		if (route === '/map') await expect(page.getByTestId('room-readiness-list')).toBeVisible({ timeout: 45_000 });
		if (['/sections', '/subjects', '/teachers'].includes(route)) await expect(page.getByTestId('admin-content-shell')).toBeVisible({ timeout: 45_000 });
		if (route === '/teaching-load') await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
		if (route === '/timetable') {
			await expect(page.locator('table[aria-label="Timetable"], [data-testid="timetable-simple-header"], [data-testid="timetable-simple-task-prompt"]').first()).toBeVisible({ timeout: 45_000 });
		}
		await expect(page.locator('body')).not.toContainText(/Application error|Something went wrong|Cannot read properties/i, { timeout: 20_000 });
		let overflow;
		try {
			overflow = await assertNoGlobalOverflow(page);
		} catch (error) {
			throw new Error(`${route} overflow: ${error instanceof Error ? error.message : String(error)}`);
		}
		return { route, overflow, consoleErrors, pageErrors, apiFailures };
	} finally {
		page.off('console', onConsole);
		page.off('pageerror', onPageError);
		page.off('response', onResponse);
	}
}

test.describe.serial('Setup-first UI/UX Iterations 7-8 final closure', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('all operator routes navigate without app errors or global overflow', async ({ page }, testInfo) => {
		test.setTimeout(180_000);
		const results = [];
		for (const route of routes) results.push(await routeSmoke(page, route));
		expect(results.flatMap((result) => result.consoleErrors), 'No browser console errors expected').toEqual([]);
		expect(results.flatMap((result) => result.apiFailures), 'No 5xx ATLAS API responses expected').toEqual([]);
		expect(results.flatMap((result) => result.pageErrors), 'No uncaught page errors expected').toEqual([]);
		await attachReport(testInfo, 'route-smoke', results);
	});

	test('timetable remains simple by default and advanced tools are reversible', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await openTimetableSimple(page);
		const simpleText = await page.getByTestId('timetable-simple-header').innerText();
		await openTimetableAdvanced(page);
		const advancedText = await page.getByTestId('timetable-task-guide').innerText();
		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible();
		await assertNoGlobalOverflow(page);
		await attachReport(testInfo, 'timetable-mode-reversibility', { simpleText, advancedText });
	});
});
