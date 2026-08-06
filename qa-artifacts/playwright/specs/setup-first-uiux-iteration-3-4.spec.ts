import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'setup-first-uiux-iteration-3-4');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function visibleButtonTexts(page: Page) {
	return page.evaluate(() => Array.from(document.querySelectorAll('button'))
		.filter((button) => {
			const rect = button.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight;
		})
		.map((button) => (button.innerText || button.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
		.filter(Boolean));
}

async function gotoTeachingLoad(page: Page) {
	await page.goto('/teaching-load', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('teaching-load-task-guide')).toBeVisible({ timeout: 45_000 });
}

test.describe.serial('Setup-first UI/UX Iterations 3-4', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('Teaching Load opens with a next-task guide inside the working area', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await gotoTeachingLoad(page);

		const metrics = await page.evaluate(() => {
			const header = document.querySelector('[data-testid="teaching-load-command-header"]')?.getBoundingClientRect();
			const content = document.querySelector('[data-testid="teaching-load-content-shell"]')?.getBoundingClientRect();
			const guide = document.querySelector('[data-testid="teaching-load-task-guide"]')?.getBoundingClientRect();
			const nextAction = document.querySelector('[data-testid="teaching-load-next-action"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
			return {
				headerHeight: Math.round(header?.height ?? 0),
				contentTop: Math.round(content?.top ?? 0),
				guideTop: Math.round(guide?.top ?? 0),
				guideHeight: Math.round(guide?.height ?? 0),
				nextAction,
			};
		});

		expect(metrics.nextAction).toMatch(/Save your draft changes|Fill missing teaching loads|Review overloaded teachers|Teaching Load looks ready/i);
		expect(metrics.guideTop).toBeGreaterThanOrEqual(metrics.contentTop);
		expect(metrics.guideHeight).toBeLessThanOrEqual(72);
		expect(metrics.contentTop).toBeLessThanOrEqual(page.viewportSize()!.width < 768 ? 260 : 230);
		await assertNoGlobalOverflow(page);
		await attachReport(testInfo, 'teaching-load-task-guide', metrics);
	});

	test('Teaching Load hides advanced filters until the operator asks for them', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await gotoTeachingLoad(page);

		await expect(page.getByRole('button', { name: /More filters/i }).first()).toBeVisible({ timeout: 20_000 });
		let buttons = await visibleButtonTexts(page);
		expect(buttons.join(' | ')).not.toMatch(/Cross-Dept|Unmapped Specialization/i);

		await page.getByRole('button', { name: /More filters/i }).first().click();
		await expect(page.locator('text=Cross-Dept').first()).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('text=Unmapped Specialization').first()).toBeVisible({ timeout: 20_000 });

		buttons = await visibleButtonTexts(page);
		await assertNoGlobalOverflow(page);
		await attachReport(testInfo, 'teaching-load-disclosed-filters', { buttons: buttons.slice(0, 24) });
	});

	for (const target of [
		{ label: 'Sections', path: '/sections' },
		{ label: 'Subjects', path: '/subjects' },
		{ label: 'Teachers', path: '/faculty' },
	]) {
		test(`${target.label} keeps search first and advanced filters disclosed`, async ({ page }, testInfo) => {
			test.setTimeout(90_000);
			await page.goto(target.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
			await expect(page.getByTestId('admin-content-shell')).toBeVisible({ timeout: 45_000 });
			await expect(page.getByTestId('admin-search-filter-toolbar')).toBeVisible({ timeout: 45_000 });
			await expect(page.getByRole('button', { name: /More filters/i }).first()).toBeVisible({ timeout: 20_000 });

			const metrics = await page.evaluate(() => {
				const toolbar = document.querySelector('[data-testid="admin-search-filter-toolbar"]')?.getBoundingClientRect();
				const table = document.querySelector('[data-testid="admin-content-shell"]')?.getBoundingClientRect();
				return {
					path: location.pathname,
					toolbarHeight: Math.round(toolbar?.height ?? 0),
					contentTop: Math.round(table?.top ?? 0),
					sourceText: (document.querySelector('[data-source-state]')?.textContent || '').replace(/\s+/g, ' ').trim(),
					bodyText: document.body.innerText.slice(0, 5000),
				};
			});

			expect(metrics.toolbarHeight).toBeLessThanOrEqual(72);
			expect(metrics.sourceText).toMatch(/Verified live|Checking source|Using saved data|No saved data|Read-only|Offline/i);
			await assertNoGlobalOverflow(page);
			await attachReport(testInfo, `${target.label.toLowerCase()}-table-disclosure`, metrics);
		});
	}
});
