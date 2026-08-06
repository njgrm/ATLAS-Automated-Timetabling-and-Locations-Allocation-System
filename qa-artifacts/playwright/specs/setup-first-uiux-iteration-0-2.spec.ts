import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'setup-first-uiux-iteration-0-2');

type SetupTarget = {
	label: string;
	path: string;
	contentSelector: string;
	headerSelector: string;
	sourceSelector: string;
	desktopHeaderMax: number;
	mobileHeaderMax: number;
	desktopContentTopMax: number;
	mobileContentTopMax: number;
};

const setupTargets: SetupTarget[] = [
	{
		label: 'Sections',
		path: '/sections',
		contentSelector: '[data-testid="admin-content-shell"]',
		headerSelector: '[data-testid="admin-command-header"]',
		sourceSelector: '[data-source-state]',
		desktopHeaderMax: 150,
		mobileHeaderMax: 185,
		desktopContentTopMax: 220,
		mobileContentTopMax: 245,
	},
	{
		label: 'Subjects',
		path: '/subjects',
		contentSelector: '[data-testid="admin-content-shell"]',
		headerSelector: '[data-testid="admin-command-header"]',
		sourceSelector: '[data-source-state]',
		desktopHeaderMax: 150,
		mobileHeaderMax: 185,
		desktopContentTopMax: 220,
		mobileContentTopMax: 245,
	},
	{
		label: 'Teachers',
		path: '/faculty',
		contentSelector: '[data-testid="admin-content-shell"]',
		headerSelector: '[data-testid="admin-command-header"]',
		sourceSelector: '[data-source-state]',
		desktopHeaderMax: 150,
		mobileHeaderMax: 185,
		desktopContentTopMax: 220,
		mobileContentTopMax: 245,
	},
	{
		label: 'Teaching Load',
		path: '/teaching-load',
		contentSelector: '[data-testid="teaching-load-content-shell"]',
		headerSelector: '[data-testid="teaching-load-command-header"]',
		sourceSelector: '[data-source-state]',
		desktopHeaderMax: 170,
		mobileHeaderMax: 210,
		desktopContentTopMax: 230,
		mobileContentTopMax: 260,
	},
];

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function measureTarget(page: Page, target: SetupTarget) {
	await page.goto(target.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator(target.contentSelector).first()).toBeVisible({ timeout: 45_000 });
	await expect(page.locator(target.headerSelector).first()).toBeVisible({ timeout: 45_000 });
	await expect(page.locator(target.sourceSelector).first()).toBeVisible({ timeout: 45_000 });

	return page.evaluate(({ target }) => {
		const root = document.scrollingElement ?? document.documentElement;
		const header = document.querySelector(target.headerSelector)?.getBoundingClientRect();
		const content = document.querySelector(target.contentSelector)?.getBoundingClientRect();
		const source = document.querySelector(target.sourceSelector);
		const sourceSummary = document.querySelector('[data-testid="admin-source-truth-summary"], [data-testid="teaching-load-source-truth-summary"]');
		const visibleButtons = Array.from(document.querySelectorAll('button'))
			.filter((button) => {
				const rect = button.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight;
			})
			.map((button) => (button.innerText || button.getAttribute('aria-label') || '').trim())
			.filter(Boolean);

		return {
			path: location.pathname,
			viewport: { width: window.innerWidth, height: window.innerHeight },
			headerHeight: Math.round(header?.height ?? 0),
			headerBottom: Math.round(header?.bottom ?? 0),
			contentTop: Math.round(content?.top ?? 0),
			contentHeight: Math.round(content?.height ?? 0),
			scrollHeight: root.scrollHeight,
			clientHeight: root.clientHeight,
			scrollWidth: root.scrollWidth,
			clientWidth: root.clientWidth,
			sourceState: source?.getAttribute('data-source-state') ?? null,
			sourceText: (source?.textContent || source?.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
			sourceSummaryText: (sourceSummary?.textContent || '').replace(/\s+/g, ' ').trim(),
			visibleButtonCount: visibleButtons.length,
			visibleButtons: visibleButtons.slice(0, 16),
		};
	}, { target });
}

test.describe.serial('Setup-first UI/UX Iterations 0-2', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	for (const target of setupTargets) {
		test(`${target.label} keeps compact shell and visible source truth`, async ({ page }, testInfo) => {
			test.setTimeout(90_000);
			const metrics = await measureTarget(page, target);
			const isMobile = metrics.viewport.width < 768;

			expect(
				metrics.headerHeight,
				`${target.label} header must stay compact. Metrics: ${JSON.stringify(metrics)}`,
			).toBeLessThanOrEqual(isMobile ? target.mobileHeaderMax : target.desktopHeaderMax);
			expect(
				metrics.contentTop,
				`${target.label} content must start early. Metrics: ${JSON.stringify(metrics)}`,
			).toBeLessThanOrEqual(isMobile ? target.mobileContentTopMax : target.desktopContentTopMax);
			expect(
				metrics.sourceState,
				`${target.label} must expose a source state. Metrics: ${JSON.stringify(metrics)}`,
			).toMatch(/verified-live|checking-source|saved-data|no-saved-data|live|cached|refreshing|none/i);
			expect(
				metrics.sourceText,
				`${target.label} must show source status without hover. Metrics: ${JSON.stringify(metrics)}`,
			).toMatch(/Verified live|Checking source|Using saved data|No saved data|Read-only|Offline/i);
			if (!isMobile) {
				expect(
					metrics.sourceSummaryText,
					`${target.label} desktop header should include visible source truth summary. Metrics: ${JSON.stringify(metrics)}`,
				).toMatch(/Source truth:/i);
			}

			await assertNoGlobalOverflow(page);
			await attachReport(testInfo, `${target.label.toLowerCase().replace(/\s+/g, '-')}-iteration-0-2`, metrics);
		});
	}

	test('Timetable remains technically closed while setup stream proceeds', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible({ timeout: 30_000 });
		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
		await assertNoGlobalOverflow(page);

		const metrics = await page.evaluate(() => {
			const header = document.querySelector('[data-testid="timetable-simple-header"]')?.getBoundingClientRect();
			const table = document.querySelector('table[aria-label="Timetable"]')?.getBoundingClientRect();
			return {
				headerHeight: Math.round(header?.height ?? 0),
				tableTop: Math.round(table?.top ?? 0),
				sourceText: document.body.innerText.match(/Using saved ATLAS data|Using cached school year|Verified with EnrollPro|Checking source/i)?.[0] ?? null,
			};
		});

		expect(metrics.headerHeight).toBeLessThanOrEqual(page.viewportSize()!.width < 768 ? 150 : 155);
		expect(metrics.tableTop).toBeLessThanOrEqual(310);
		expect(metrics.sourceText).toBeTruthy();
		await attachReport(testInfo, 'timetable-regression', metrics);
	});
});
