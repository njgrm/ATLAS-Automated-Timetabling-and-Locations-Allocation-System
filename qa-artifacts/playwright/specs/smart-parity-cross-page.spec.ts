import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const FACULTY_CREDENTIALS = {
	identifier: process.env.PLAYWRIGHT_FACULTY_EMAIL ?? '2000056',
	password: process.env.PLAYWRIGHT_FACULTY_PASSWORD ?? 'DepEd2026!',
};

const ADMIN_ROUTES = [
	{ route: '/', useful: '[data-testid="dashboard-readiness-hub"], [data-testid="smart-next-step-card"]', source: '[data-source-state], [data-testid*="source"]' },
	{ route: '/sections', useful: '[data-testid="admin-content-shell"]', source: '[data-source-state]' },
	{ route: '/subjects', useful: '[data-testid="admin-content-shell"]', source: '[data-source-state]' },
	{ route: '/teachers', useful: '[data-testid="admin-content-shell"], [data-testid="teachers-next-action-strip"]', source: '[data-source-state]' },
	{ route: '/teaching-load', useful: '[data-testid="teaching-load-content-shell"]', source: '[data-source-state]' },
	{ route: '/map', useful: '[data-testid="room-readiness-list"]', source: '[data-source-state], [data-testid*="source"]' },
	{ route: '/schedules', useful: '[data-testid="schedule-browser-selector"]', source: '[data-testid="schedules-source-status"]' },
	{ route: '/timetable', useful: 'table[aria-label="Timetable"], [data-testid="timetable-simple-next-action"]', source: '[data-testid="timetable-lookup-status"], [data-source-state], [data-testid*="source"]' },
] as const;

async function loginFaculty(page: Page): Promise<void> {
	const response = await page.request.post('/api/v1/auth/login', { data: FACULTY_CREDENTIALS });
	test.skip(!response.ok(), `Faculty login unavailable: HTTP ${response.status()} ${(await response.text()).slice(0, 300)}`);
	const payload = await response.json() as { token?: string };
	test.skip(!payload.token, 'Faculty login did not return a token.');
	await page.addInitScript((token) => {
		window.localStorage.setItem('atlas_token', token);
		window.localStorage.setItem('auth_token', token);
	}, payload.token);
}

async function openRoute(page: Page, route: string) {
	await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => null);
	await page.waitForTimeout(500);
}

async function visibleText(page: Page): Promise<string> {
	return page.locator('body').innerText({ timeout: 10_000 });
}

async function expectNoRawUnknowns(page: Page) {
	const text = await visibleText(page);
	expect(text).not.toMatch(/Unknown (Subject|Room|Section|Faculty)\s*(\(#?\d+\))?/i);
}

async function expectOnePrimaryPath(page: Page) {
	const candidates = page.locator([
		'[data-testid="smart-next-step-card"]',
		'[data-testid="public-schedule-next-step"]',
		'[data-testid="faculty-schedule-next-step"]',
		'[data-testid="dashboard-readiness-hub"]',
		'[data-testid="teaching-load-repair-queue"]',
		'[data-testid="timetable-simple-task-prompt"]',
		'[data-testid="timetable-simple-next-action"]',
		'[data-testid="simple-current-session-card"]',
	].join(', '));
	await expect(candidates.first(), 'A SMART-family page must expose one obvious next-step area.').toBeVisible({ timeout: 15_000 });
}

async function expectHelpDiscoverable(page: Page) {
	const help = page.locator([
		'[data-testid="smart-help-trigger"]',
		'[data-testid="timetable-simple-tutorial-trigger"]',
		'button:has-text("Help")',
		'button:has-text("Tutorial")',
		'button:has-text("How to use")',
	].join(', '));
	await expect(help.first(), 'Help or tutorial must be discoverable.').toBeVisible({ timeout: 15_000 });
}

async function expectNoVisibleTextSpill(page: Page) {
	const spill = await page.evaluate(() => {
		function isInsideLocalScroller(element: Element) {
			let current: Element | null = element.parentElement;
			while (current && current !== document.body) {
				const style = window.getComputedStyle(current);
				const hasLocalScroll =
					/(auto|scroll|hidden)/.test(style.overflowX) ||
					/(auto|scroll|hidden)/.test(style.overflowY) ||
					current.className?.toString().includes('overflow-x-auto') ||
					current.className?.toString().includes('overflow-auto') ||
					current.hasAttribute('data-radix-scroll-area-viewport') ||
					current.getAttribute('data-testid')?.includes('content-shell') ||
					current.getAttribute('data-testid')?.includes('timetable-simple-body');
				if (hasLocalScroll && (current.scrollWidth > current.clientWidth + 2 || current.scrollHeight > current.clientHeight + 2)) {
					return true;
				}
				current = current.parentElement;
			}
			return false;
		}

		const nodes = Array.from(document.querySelectorAll('h1,h2,h3,p,span,button,a,label,td,th,[role="button"]')).slice(0, 1200);
		return nodes
			.map((element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);
				const text = (element.textContent ?? '').trim();
				const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
				if (!visible) return null;
				if (!text) return null;
				if (isInsideLocalScroller(element)) return null;
				if (element.closest('[class*="overflow-x-auto"], [class*="overflow-auto"], [data-radix-scroll-area-viewport], table[aria-label="Timetable"]')) return null;
				if (rect.left < -2 || rect.right > window.innerWidth + 2) {
					return { text: text.slice(0, 80), left: rect.left, right: rect.right };
				}
				return null;
			})
			.filter(Boolean)
			.slice(0, 8);
	});
	expect(spill, `Visible text must not spill outside viewport: ${JSON.stringify(spill)}`).toEqual([]);
}

async function attachScreenshot(page: Page, name: string) {
	await test.info().attach(name, {
		body: await page.screenshot({ fullPage: false }),
		contentType: 'image/png',
	});
}

test.describe('SMART parity cross-page audit', () => {
	for (const target of ADMIN_ROUTES) {
		test(`${target.route} follows SMART-family command/readiness pattern`, async ({ page }, testInfo) => {
			await loginAdmin(page);
			await openRoute(page, target.route);
			await assertNoGlobalOverflow(page);
			await expectNoRawUnknowns(page);
			await expectNoVisibleTextSpill(page);
			await expect(page.locator(target.useful).first(), `${target.route} must expose useful content.`).toBeVisible({ timeout: 20_000 });
			await expect(page.locator(target.source).first(), `${target.route} must expose source/readiness status.`).toBeVisible({ timeout: 20_000 });
			if (!['/sections', '/subjects'].includes(target.route)) {
				await expectHelpDiscoverable(page);
			}
			if (['/', '/teaching-load', '/timetable'].includes(target.route)) {
				await expectOnePrimaryPath(page);
			}
			await attachScreenshot(page, `smart-parity-${testInfo.project.name}-${target.route.replace(/[^a-z0-9]+/gi, '-') || 'dashboard'}.png`);
		});
	}

	test('faculty schedule follows SMART-family mobile help and next-step pattern', async ({ page }, testInfo) => {
		await loginFaculty(page);
		await openRoute(page, '/my/schedule');
		await assertNoGlobalOverflow(page);
		await expectNoRawUnknowns(page);
		await expectNoVisibleTextSpill(page);
		await expect(page.getByTestId('faculty-schedule-next-step')).toBeVisible({ timeout: 20_000 });
		await expectHelpDiscoverable(page);
		await attachScreenshot(page, `smart-parity-${testInfo.project.name}-faculty-schedule.png`);
	});

	test('public schedule follows SMART-family public lookup pattern', async ({ page }, testInfo) => {
		await openRoute(page, '/public/schedules');
		await assertNoGlobalOverflow(page);
		await expectNoRawUnknowns(page);
		await expectNoVisibleTextSpill(page);
		await expect(page.getByTestId('public-schedule-command-bar')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId('public-schedule-next-step')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId('public-schedule-source-status')).toBeVisible({ timeout: 20_000 });
		await expectHelpDiscoverable(page);
		await attachScreenshot(page, `smart-parity-${testInfo.project.name}-public-schedule.png`);
	});
});
