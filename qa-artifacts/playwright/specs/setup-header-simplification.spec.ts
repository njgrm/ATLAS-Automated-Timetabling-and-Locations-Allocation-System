import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

const SETUP_ROUTES = ['/sections', '/subjects', '/teachers'] as const;

async function openRoute(page: Page, route: string) {
	await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => null);
	await page.waitForTimeout(500);
}

async function expectNoVisibleSourceTruthSentence(page: Page) {
	const visibleSourceTruth = await page.locator('text=/Source truth:/i').evaluateAll((nodes) =>
		nodes
			.filter((node) => {
				const element = node instanceof HTMLElement ? node : node.parentElement;
				if (!element) return false;
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);
				return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
			})
			.map((node) => node.textContent?.trim() ?? ''),
	);
	expect(visibleSourceTruth, 'Long source-truth sentences must not be visible in compact command headers.').toEqual([]);
}

async function headerHeight(page: Page, testId: string) {
	const box = await page.getByTestId(testId).first().boundingBox();
	expect(box, `${testId} should be measurable`).not.toBeNull();
	return Math.round(box!.height);
}

function setupHeaderBudget(projectName: string) {
	if (projectName === 'mobile-landscape') return 76;
	if (projectName === 'mobile-portrait') return 104;
	return 88;
}

function teachingLoadHeaderBudget(projectName: string) {
	if (projectName === 'mobile-landscape') return 84;
	if (projectName === 'mobile-portrait') return 112;
	return 96;
}

async function visibleHeaderControlCount(page: Page, headerTestId: string) {
	return page.getByTestId(headerTestId).locator('button,a,[role="button"]').evaluateAll((nodes) =>
		nodes.filter((node) => {
			const element = node as HTMLElement;
			const rect = element.getBoundingClientRect();
			const style = window.getComputedStyle(element);
			return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
		}).length,
	);
}

async function readinessStripChipCount(page: Page, testId: string) {
	const strip = page.getByTestId(testId);
	return strip.locator(':scope > div, :scope > button').evaluateAll((nodes) =>
		nodes.filter((node) => {
			const element = node as HTMLElement;
			const rect = element.getBoundingClientRect();
			const style = window.getComputedStyle(element);
			return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
		}).length,
	);
}

const READINESS_BUDGET: Record<string, number> = {
	'/sections': 2,
	'/subjects': 3,
	'/teachers': 3,
};

const REMOVED_HELPER_SENTENCES = [
	/Extra setup actions stay here so the header remains calm/i,
	/Use the source chip for details/i,
	/Use filters and row menus only when the default list is too broad/i,
];

test.describe('Setup header simplification', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
	});

	for (const route of SETUP_ROUTES) {
		test(`${route} uses a compact one-decision setup header`, async ({ page }, testInfo) => {
			await openRoute(page, route);
			await assertNoGlobalOverflow(page);
			await expectNoVisibleSourceTruthSentence(page);

			await expect(page.getByTestId('admin-command-header')).toBeVisible();
			await expect(page.getByTestId('setup-compact-command-header')).toBeVisible();
			await expect(page.getByTestId('setup-readiness-strip')).toBeVisible();
			await expect(page.getByTestId('admin-search-filter-toolbar')).toBeVisible();

			const height = await headerHeight(page, 'admin-command-header');
			expect(height, `${route} header should stay under the ${testInfo.project.name} budget`).toBeLessThanOrEqual(setupHeaderBudget(testInfo.project.name));

			const count = await visibleHeaderControlCount(page, 'setup-compact-command-header');
			const maxControls = testInfo.project.name === 'desktop' ? 5 : 4;
			expect(count, `${route} must keep visible header controls limited`).toBeLessThanOrEqual(maxControls);

			await page.getByTestId('smart-help-trigger').first().click();
			await expect(page.getByTestId('smart-help-steps')).toBeVisible();
			await page.getByTestId('smart-help-finish').click();

			const more = page.getByRole('button', { name: /more/i }).first();
			if (await more.count()) {
				await more.click();
				await expect(page.getByTestId('setup-more-daily')).toBeAttached();
				for (const sentence of REMOVED_HELPER_SENTENCES) {
					await expect(page.getByText(sentence).and(page.locator(':visible'))).toHaveCount(0);
				}
			}

			// New gate: readiness strip chip count ≤ per-page budget.
			const stripChips = await readinessStripChipCount(page, 'setup-readiness-strip');
			expect(stripChips, `${route} readiness strip should respect per-page budget`).toBeLessThanOrEqual(READINESS_BUDGET[route] ?? 3);
		});
	}

	test('/subjects keeps Add subject inline and drops the Time display control', async ({ page }) => {
		await openRoute(page, '/subjects');
		await expectNoVisibleSourceTruthSentence(page);

		// Add subject promoted inline next to Refresh offerings.
		await expect(page.getByTestId('setup-compact-command-header').getByRole('button', { name: /Add subject/i })).toBeVisible();

		// Time display control removed from the Subjects filter row entirely.
		const filterToolbar = page.getByTestId('admin-search-filter-toolbar');
		await expect(filterToolbar.getByText(/Time display/i)).toHaveCount(0);
	});

	test('/teachers readiness strip drops Last sync and inverse Without-load chip', async ({ page }) => {
		await openRoute(page, '/teachers');
		await expectNoVisibleSourceTruthSentence(page);

		const strip = page.getByTestId('setup-readiness-strip');
		const stripText = (await strip.innerText()).toLowerCase();
		expect(stripText, 'Teachers strip must not surface housekeeping Last sync').not.toContain('last sync');
		// Strip must not show both With load and Without load as separate chips.
		const withLoadMatches = (await strip.locator(':scope > div, :scope > button').allInnerTexts()).filter((t) => /with load/i.test(t));
		const withoutLoadMatches = (await strip.locator(':scope > div, :scope > button').allInnerTexts()).filter((t) => /without load/i.test(t));
		expect(withoutLoadMatches.length, 'Teachers strip must not surface inverse Without load chip').toBe(0);
		expect(withLoadMatches.length, 'Teachers strip keeps With load chip').toBeGreaterThan(0);

		// Last verified relocated to the source chip popover only.
		await expect(page.getByTestId('admin-command-header').getByText(/Last verified/i)).toHaveCount(0);
		await page.getByTestId('admin-command-header').getByRole('button', { name: /open source details/i }).first().click();
		await expect(page.getByTestId('setup-source-details-popover').getByText(/Last verified/i)).toBeVisible();
	});

	test('/teaching-load uses a compact one-decision command header', async ({ page }, testInfo) => {
		await openRoute(page, '/teaching-load');
		await assertNoGlobalOverflow(page);
		await expectNoVisibleSourceTruthSentence(page);

		await expect(page.getByTestId('teaching-load-command-header')).toBeVisible();
		await expect(page.getByTestId('teaching-load-compact-command-header')).toBeVisible();

		const height = await headerHeight(page, 'teaching-load-command-header');
		expect(height, `/teaching-load header should stay under the ${testInfo.project.name} budget`).toBeLessThanOrEqual(teachingLoadHeaderBudget(testInfo.project.name));

		const count = await visibleHeaderControlCount(page, 'teaching-load-compact-command-header');
		const maxControls = testInfo.project.name === 'desktop' ? 5 : 4;
		expect(count, '/teaching-load must keep visible header controls limited').toBeLessThanOrEqual(maxControls);

		// Readiness strip is visible below the command row without opening More.
		await expect(page.getByTestId('teaching-load-readiness-strip')).toBeVisible();
		await expect(page.getByTestId('teaching-load-readiness-strip')).toContainText(/% staffed/i);
		await expect(page.getByTestId('teaching-load-readiness-strip')).toContainText(/Unassigned pairs/i);

		// Coverage snapshot grid was removed from the More dropdown (moved to readiness strip).
		await page.getByRole('button', { name: /more teaching load tools/i }).click();
		await expect(page.getByText(/^Coverage snapshot$/i)).toHaveCount(0);
		await expect(page.getByText(/View mode/i)).toBeVisible();
	});
});
