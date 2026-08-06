import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const ROUTES = ['/', '/sections', '/subjects', '/teachers', '/teaching-load', '/map', '/schedules', '/timetable'] as const;

async function openAppRoute(page: Page, route: string) {
	await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => null);
	await page.waitForTimeout(500);
}

async function expectNoUnknownVisibleLabels(page: Page) {
	const bodyText = await page.locator('body').innerText();
	expect(bodyText, 'Primary user-visible pages must not expose raw unresolved lookup labels.').not.toMatch(/Unknown (Subject|Room|Section|Faculty)\s*(\(#?\d+\))?/i);
}

async function expectNoVisibleTextOverflow(page: Page) {
	const overflow = await page.evaluate(() => {
		const nodes = Array.from(document.querySelectorAll('h1,h2,h3,p,span,button,a,label,td,th,[role="button"]')).slice(0, 1_000);
		const hasLocalHorizontalContainer = (element: Element) => {
			if (
				element.closest(
					'table[aria-label="Timetable"], [data-admin-table-view="desktop"], [class*="overflow-x-auto"], [data-radix-scroll-area-viewport]',
				)
			) {
				return true;
			}
			let parent = element.parentElement;
			while (parent && parent !== document.body) {
				const style = window.getComputedStyle(parent);
				const canContainHorizontal =
					['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX) || ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflow);
				if (canContainHorizontal && parent.scrollWidth > parent.clientWidth + 2) {
					return true;
				}
				parent = parent.parentElement;
			}
			return false;
		};
		return nodes
			.map((element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);
				const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
				if (!visible) return null;
				const localHorizontalContainer = hasLocalHorizontalContainer(element);
				const pageOverflow = rect.left < -2 || rect.right > window.innerWidth + 2;
				const uncontainedText = element.scrollWidth > element.clientWidth + 3 && !['hidden', 'clip'].includes(style.overflowX);
				if (localHorizontalContainer) return null;
				if (!pageOverflow && !uncontainedText) return null;
				return {
					tag: element.tagName,
					testId: element.getAttribute('data-testid') ?? '',
					text: (element.textContent ?? '').trim().slice(0, 80),
					rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
					scrollWidth: element.scrollWidth,
					clientWidth: element.clientWidth,
				};
			})
			.filter(Boolean)
			.slice(0, 8);
	});

	expect(overflow, `Visible text must not overlap or spill outside the page: ${JSON.stringify(overflow)}`).toEqual([]);
}

async function topOf(page: Page, selector: string): Promise<number | null> {
	const locator = page.locator(selector).first();
	if ((await locator.count()) === 0) return null;
	const box = await locator.boundingBox();
	return box ? Math.round(box.y) : null;
}

function budgetFor(projectName: string, route: string) {
	if (route === '/teaching-load') {
		if (projectName === 'mobile-landscape') return 210;
		if (projectName === 'mobile-portrait') return 320;
		return 230;
	}
	if (route === '/') {
		if (projectName === 'mobile-landscape') return 180;
		if (projectName === 'mobile-portrait') return 260;
		return 260;
	}
	if (route === '/map') {
		if (projectName === 'mobile-landscape') return 220;
		if (projectName === 'mobile-portrait') return 260;
		return 220;
	}
	if (route === '/schedules') {
		if (projectName === 'mobile-landscape') return 230;
		if (projectName === 'mobile-portrait') return 280;
		return 260;
	}
	return projectName === 'mobile-landscape' ? 250 : 320;
}

function primarySelectorFor(route: string) {
	if (route === '/') return '[data-testid="dashboard-readiness-hub"]';
	if (route === '/teaching-load') return '[data-testid="teaching-load-content-shell"]';
	if (route === '/map') return '[data-testid="room-readiness-list"]';
	if (route === '/schedules') return '[data-testid="admin-schedule-selector"], [data-testid="schedule-browser-selector"], [aria-label*="Select"], button:has-text("Schedule")';
	if (route === '/timetable') return 'table[aria-label="Timetable"]';
	return '[data-testid="admin-content-shell"]';
}

test.describe('Cross-page UX release readiness', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
	});

	for (const route of ROUTES) {
		test(`${route} keeps setup UX compact and readable`, async ({ page }, testInfo) => {
			await openAppRoute(page, route);
			await assertNoGlobalOverflow(page);
			await expectNoUnknownVisibleLabels(page);
			await expectNoVisibleTextOverflow(page);

			if (['/sections', '/subjects', '/teachers'].includes(route)) {
				await expect(page.getByTestId('admin-command-header')).toBeVisible();
				await expect(page.locator('[data-source-state]').first()).toBeVisible();
			}
			if (route === '/teaching-load') {
				await expect(page.getByTestId('teaching-load-source-truth-summary')).toBeAttached();
				await expect(page.locator('[data-source-state]').first()).toBeVisible();
			}
			if (route === '/map' || route === '/schedules' || route === '/') {
				await expect(page.locator('[data-source-state]').first()).toBeVisible();
			}

			const selector = primarySelectorFor(route);
			const usefulTop = await topOf(page, selector);
			expect(usefulTop, `${route} must expose first useful content for ${testInfo.project.name}.`).not.toBeNull();
			expect(usefulTop!, `${route} first useful content is too low for ${testInfo.project.name}.`).toBeLessThanOrEqual(budgetFor(testInfo.project.name, route));

			if (route === '/sections' && testInfo.project.name === 'mobile-portrait') {
				await expect(page.getByTestId('section-mobile-card').first()).toBeVisible();
			}
			if (route === '/subjects' && testInfo.project.name === 'mobile-portrait') {
				await expect(page.getByTestId('subject-mobile-card').first()).toBeVisible();
			}
		});
	}
});
