import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin, openPrimaryTaskDrawer, openTimetableAdvanced, openTimetableSimple } from './timetable-layout-helpers';

type ViewportName = 'desktop' | 'mobile-portrait' | 'mobile-landscape';

const budgets: Record<ViewportName, {
	advancedGridTop: number;
	advancedCenterHeight?: number;
	simpleHeaderHeight: number;
	minVisibleTrayRows: number;
}> = {
	desktop: {
		advancedGridTop: 260,
		simpleHeaderHeight: 96,
		minVisibleTrayRows: 4,
	},
	'mobile-portrait': {
		advancedGridTop: 300,
		simpleHeaderHeight: 104,
		minVisibleTrayRows: 1,
	},
	'mobile-landscape': {
		advancedGridTop: 180,
		advancedCenterHeight: 180,
		simpleHeaderHeight: 84,
		minVisibleTrayRows: 1,
	},
};

async function getLayoutMetrics(page: Page) {
	return page.evaluate(() => {
		const rect = (selector: string) => {
			const el = document.querySelector(selector);
			if (!el) return null;
			const box = el.getBoundingClientRect();
			return {
				top: Math.round(box.top),
				bottom: Math.round(box.bottom),
				height: Math.round(box.height),
				width: Math.round(box.width),
			};
		};
		const visibleRows = Array.from(document.querySelectorAll('[data-testid="simple-plotting-session-row"]')).filter((row) => {
			const drawer = document.querySelector('[data-testid="timetable-task-drawer"]');
			const rowBox = row.getBoundingClientRect();
			const drawerBox = drawer?.getBoundingClientRect();
			if (!drawerBox) return false;
			return rowBox.top >= drawerBox.top && rowBox.bottom <= drawerBox.bottom && rowBox.width > 1 && rowBox.height > 1;
		});
		return {
			simpleHeader: rect('[data-testid="timetable-simple-header"]'),
			taskDrawer: rect('[data-testid="timetable-task-drawer"]'),
			advancedTaskGuide: rect('[data-testid="timetable-task-guide"]'),
			centerPanel: rect('[data-testid="timetable-center-panel"]'),
			grid: rect('table[aria-label="Timetable"]'),
			visibleTrayRows: visibleRows.length,
			tourOverlayText: document.body.textContent?.includes('Run Selector') ?? false,
		};
	});
}

async function loginWithoutCompletingTour(page: Page) {
	const response = await page.request.post('/api/v1/auth/login', {
		data: {
			identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
			password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
		},
	});
	expect(response.ok()).toBeTruthy();
	const payload = await response.json() as { token?: string };
	expect(payload.token).toBeTruthy();
	await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${payload.token}` });
	await page.addInitScript((token) => {
		window.sessionStorage.setItem('atlas_local_token', token);
		window.localStorage.removeItem('atlas_timetable_tour');
		window.localStorage.setItem('atlas_timetable_layout_mode', 'simple');
	}, payload.token!);
}

test.describe.serial('Timetable fool-proof simplification budgets', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
	});

	test('simple view keeps header compact and shows actionable plotting rows first', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await loginAdmin(page);
		await openTimetableSimple(page);
		await openPrimaryTaskDrawer(page);
		const metrics = await getLayoutMetrics(page);
		const budget = budgets[testInfo.project.name as ViewportName];
		expect(metrics.simpleHeader, 'Simple header must be measurable.').toBeTruthy();
		expect(metrics.simpleHeader!.height, `Simple header must stay within ${budget.simpleHeaderHeight}px. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(budget.simpleHeaderHeight);
		expect(metrics.visibleTrayRows, `Plotting tray must show actionable sessions before scrolling. Metrics: ${JSON.stringify(metrics)}`).toBeGreaterThanOrEqual(budget.minVisibleTrayRows);
		await expect(page.getByTestId('simple-plotting-tray')).toContainText(/Plotting queue/i);
		await expect(page.getByTestId('simple-plotting-session-row').first()).toContainText(/Place session|Review room source|Choose room first|Fix teaching load|Blocked/i);
		await assertNoGlobalOverflow(page);
	});

	test('advanced view keeps the timetable grid in the first useful viewport', async ({ page }, testInfo) => {
		test.setTimeout(90_000);
		await loginAdmin(page);
		await openTimetableAdvanced(page);
		const metrics = await getLayoutMetrics(page);
		const budget = budgets[testInfo.project.name as ViewportName];
		expect(metrics.grid, 'Advanced timetable grid must be measurable.').toBeTruthy();
		expect(metrics.grid!.top, `Advanced grid top must stay within ${budget.advancedGridTop}px. Metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(budget.advancedGridTop);
		if (budget.advancedCenterHeight) {
			expect(metrics.centerPanel?.height ?? 0, `Advanced center workspace must remain usable. Metrics: ${JSON.stringify(metrics)}`).toBeGreaterThanOrEqual(budget.advancedCenterHeight);
		}
		await expect(page.getByTestId('timetable-source-truth')).toBeVisible();
		await expect(page.getByTestId('timetable-task-guide')).toBeVisible();
		await assertNoGlobalOverflow(page);
	});

	test('guided tour does not auto-obstruct the timetable', async ({ page }) => {
		test.setTimeout(90_000);
		await loginWithoutCompletingTour(page);
		await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
		await page.waitForTimeout(1_200);
		const metrics = await getLayoutMetrics(page);
		expect(metrics.tourOverlayText, 'Tour content must not auto-open over timetable.').toBeFalsy();
		await page.getByRole('button', { name: /^More$/i }).click();
		await page.getByRole('button', { name: /^Tour$/i }).click();
		await expect(page.getByText(/Run Selector/i)).toBeVisible({ timeout: 10_000 });
	});
});
