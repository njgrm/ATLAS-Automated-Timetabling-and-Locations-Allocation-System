import { expect, test, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'setup-first-uiux-iteration-5-6');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

test.describe.serial('Setup-first UI/UX Iterations 5-6', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('Campus and rooms leads with a plain readiness list before disclosing the map', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.getByTestId('room-readiness-list')).toBeVisible({ timeout: 45_000 });
		const openMapAction = page.getByRole('button', { name: /show campus explorer|open map/i }).first();
		await expect(openMapAction).toBeVisible();
		const metrics = await page.evaluate(() => {
			const readiness = document.querySelector('[data-testid="room-readiness-list"]')?.getBoundingClientRect();
			const explorer = Array.from(document.querySelectorAll('h2')).find((node) => node.textContent?.includes('Campus Explorer'))?.getBoundingClientRect();
			return {
				readinessTop: Math.round(readiness?.top ?? 0),
				explorerTop: explorer ? Math.round(explorer.top) : null,
				statuses: Array.from(document.querySelectorAll('[data-room-status]')).map((node) => node.getAttribute('data-room-status')).filter(Boolean),
				bodyText: document.body.innerText.slice(0, 4000),
			};
		});
		expect(metrics.readinessTop).toBeGreaterThanOrEqual(0);
		if (metrics.explorerTop !== null) {
			expect(metrics.readinessTop).toBeLessThan(metrics.explorerTop);
		}
		expect(metrics.bodyText).toMatch(/Room readiness|Ready|Needs capacity|Needs room type|Needs section|Unavailable/);
		await assertNoGlobalOverflow(page);
		await attachReport(testInfo, 'room-readiness', metrics);
	});

	test('Dashboard exposes one seven-step readiness hub with direct repair links', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		const hub = page.getByTestId('dashboard-readiness-hub');
		await expect(hub).toBeVisible({ timeout: 45_000 });
		await expect(hub).toContainText('Setup readiness');
		await expect(hub).toContainText('Timetable generated and reviewed');
		await expect(hub).toContainText('Ready to publish');
		const metrics = await hub.evaluate((node) => ({
			links: Array.from(node.querySelectorAll('a')).map((link) => ({ href: link.getAttribute('href'), text: link.textContent?.replace(/\s+/g, ' ').trim() })),
			source: node.querySelector('[data-source-state]')?.textContent?.trim() ?? '',
		}));
		expect(metrics.links.map((link) => link.href)).toEqual(expect.arrayContaining(['/sections', '/subjects', '/teachers', '/teaching-load', '/map', '/timetable', '/schedules']));
		expect(metrics.source).toMatch(/Verified live|Checking source|Using saved data|No saved data|Partial data/);
		await assertNoGlobalOverflow(page);
		await attachReport(testInfo, 'dashboard-readiness-hub', metrics);
	});
});
