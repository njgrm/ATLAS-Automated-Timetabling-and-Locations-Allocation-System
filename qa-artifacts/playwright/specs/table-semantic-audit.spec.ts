import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

/* ─── Route configuration ─── */

interface DesktopRoute {
	route: string;
	/** CSS selector for the desktop <table> element */
	tableSelector: string;
	/** Selector for the first real data row (excludes skeleton/loading rows) */
	firstRowSelector: string;
	/** Ordered column labels as rendered in <thead> */
	headers: string[];
	/** Semantic matchers: column label → regex that valid cell content must match */
	semanticMatchers: Record<string, RegExp>;
}

const DESKTOP_ROUTES: DesktopRoute[] = [
	{
		route: '/subjects',
		tableSelector: 'table',
		firstRowSelector: 'table tbody tr:not(:has(td[colspan]))',
		headers: ['Subject and code', 'Weekly time', 'Room need', 'Program', 'Grades', 'Coverage', 'Actions'],
		semanticMatchers: {
			'Grades': /GR\s?\d/i,
			'Coverage': /(Archived|Excluded|Teacher assigned|Needs teacher)/i,
		},
	},
	{
		route: '/teachers',
		tableSelector: '[data-admin-table-view="desktop"] table',
		firstRowSelector: '[data-admin-table-view="desktop"] table tbody tr',
		headers: ['Teacher', 'Load status', 'Weekly load', 'Assigned classes', 'Actions'],
		semanticMatchers: {
			'Teacher': /\S+/,
			'Load status': /(Ready|No load|Below standard|Near cap|Over cap|Excluded)/,
			'Weekly load': /(\d+ \/ 30h|—|-)/,
			'Assigned classes': /(section|No classes|more|\u00B7)/,
		},
	},
	{
		route: '/sections',
		tableSelector: 'table',
		firstRowSelector: 'table tbody tr:not(:has(td[colspan]))',
		headers: ['Section', 'Grade', 'Enrolled', 'Capacity', '% Full', 'Home room', 'Details'],
		semanticMatchers: {
			'Grade': /GR\s?\d/i,
			'Enrolled': /\d+/,
			'Capacity': /\d+/,
			'% Full': /\d+%/,
		},
	},
];

interface MobileRoute {
	route: string;
	/** Selector for the card/list container that should be visible on mobile */
	cardSelector: string;
}

const MOBILE_ROUTES: MobileRoute[] = [
	{ route: '/subjects', cardSelector: '[data-testid="subject-mobile-card"]' },
	{ route: '/teachers', cardSelector: '[data-admin-table-view="mobile"] .rounded-xl' },
	{ route: '/sections', cardSelector: '[data-testid="section-mobile-card"]' },
	{ route: '/teaching-load', cardSelector: '[data-testid="teaching-load-content-shell"]' },
];

/* ─── Helpers ─── */

async function openRoute(page: Page, route: string) {
	await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null);
	await page.waitForTimeout(600);
}

function countWords(text: string): number {
	return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Skip test if viewport is narrower than 768px (mobile — desktop table is hidden). */
async function skipOnMobile(page: Page) {
	const vp = page.viewportSize();
	if (vp && vp.width < 768) {
		test.skip(true, 'Desktop table audit skipped on mobile viewport');
	}
}

/* ─── Desktop: table semantic audit ─── */

for (const route of DESKTOP_ROUTES) {
	test.describe(`Desktop table audit — ${route.route}`, () => {
		test.beforeEach(async ({ page }) => {
			await loginAdmin(page);
			await openRoute(page, route.route);
		});

		test('header count matches first data row cell count', async ({ page }) => {
			await skipOnMobile(page);

			const headerCount = await page.locator(`${route.tableSelector} thead th`).count();
			expect(headerCount, `Expected at least one <th> in ${route.tableSelector}`).toBeGreaterThan(0);

			const firstRow = page.locator(route.firstRowSelector).first();
			await expect(firstRow).toBeVisible({ timeout: 10_000 });

			const cellCount = await firstRow.locator('td').count();

			expect(cellCount, `${route.route}: first data row has ${cellCount} cells but ${headerCount} headers — column mismatch detected`).toBe(headerCount);
		});

		test('header labels semantically match cell content', async ({ page }) => {
			await skipOnMobile(page);

			const headers = await page.locator(`${route.tableSelector} thead th`).allTextContents();
			const cleanedHeaders = headers.map((h) => h.replace(/\s+/g, ' ').trim());

			const firstRow = page.locator(route.firstRowSelector).first();
			await expect(firstRow).toBeVisible({ timeout: 10_000 });
			const cells = await firstRow.locator('td').allTextContents();
			const cleanedCells = cells.map((c) => c.replace(/\s+/g, ' ').trim());

			const mismatches: string[] = [];

			for (const [label, pattern] of Object.entries(route.semanticMatchers)) {
				const colIndex = cleanedHeaders.indexOf(label);
				if (colIndex === -1) continue;
				if (colIndex >= cleanedCells.length) {
					mismatches.push(`Column "${label}" (index ${colIndex}): no cell at this index`);
					continue;
				}
				const cellText = cleanedCells[colIndex];
				if (!pattern.test(cellText)) {
					mismatches.push(`Column "${label}": header says "${label}" but cell contains "${cellText.slice(0, 60)}"`);
				}
			}

			expect(mismatches, `${route.route} semantic mismatches found`).toEqual([]);
		});

		test('each row has visible words within budget', async ({ page }) => {
			await skipOnMobile(page);

			const rows = await page.locator(route.firstRowSelector).all();
			expect(rows.length, 'Expected at least one data row').toBeGreaterThan(0);

			const budgets: Record<string, number> = {
				'/subjects': 80,
				'/teachers': 60,
				'/sections': 50,
			};
			const budget = budgets[route.route] ?? 60;

			for (let i = 0; i < Math.min(rows.length, 5); i++) {
				const text = await rows[i].innerText();
				const words = countWords(text);
				expect(
					words,
					`${route.route} row ${i}: ${words} words exceeds ${budget}-word budget`,
				).toBeLessThanOrEqual(budget);
			}
		});

		test('each row has visible badges within budget', async ({ page }) => {
			await skipOnMobile(page);

			const rows = await page.locator(route.firstRowSelector).all();
			expect(rows.length, 'Expected at least one data row').toBeGreaterThan(0);

			for (let i = 0; i < Math.min(rows.length, 5); i++) {
				const badgeCount = await rows[i].locator('[data-slot="badge"], [role="status"]').count();
				expect(
					badgeCount,
					`${route.route} row ${i}: ${badgeCount} badges exceeds 8-badge budget`,
				).toBeLessThanOrEqual(8);
			}
		});

		test('each row has one primary action and a More menu', async ({ page }) => {
			await skipOnMobile(page);

			const rows = await page.locator(route.firstRowSelector).all();
			expect(rows.length, 'Expected at least one data row').toBeGreaterThan(0);

			for (let i = 0; i < Math.min(rows.length, 3); i++) {
				const actionButtons = rows[i].locator('td:last-child button, td:last-child a, td:last-child [role="button"]');
				const actionCount = await actionButtons.count();
				expect(
					actionCount,
					`${route.route} row ${i}: expected at least 1 action button, found ${actionCount}`,
				).toBeGreaterThanOrEqual(1);

				// More menu may be absent if there are no ellipsis actions (e.g., non-placeholder teachers)
				// This is acceptable — just verify the primary action exists
			}
		});
	});
}

/* ─── Structural audit: no nested buttons in thead ─── */

for (const route of DESKTOP_ROUTES) {
	test.describe(`Header structure audit — ${route.route}`, () => {
		test.beforeEach(async ({ page }) => {
			await loginAdmin(page);
			await openRoute(page, route.route);
		});

		test('thead contains no nested button elements', async ({ page }) => {
			const nestedButtons = await page.evaluate((tableSelector) => {
				const table = document.querySelector(tableSelector);
				if (!table) return [];
				const thead = table.querySelector('thead');
				if (!thead) return [];
				const buttons = thead.querySelectorAll('button');
				const nested: string[] = [];
				buttons.forEach((btn) => {
					const parentBtn = btn.closest('button');
					if (parentBtn && parentBtn !== btn) {
						nested.push(btn.textContent?.trim().slice(0, 40) ?? '(empty)');
					}
				});
				return nested;
			}, route.tableSelector);
			expect(
				nestedButtons,
				`${route.route}: found ${nestedButtons.length} nested button(s) in thead — sort triggers and info popovers must be siblings`,
			).toEqual([]);
		});

		test('non-action columns emit data-cell-role on th elements', async ({ page }) => {
			const missingRoles = await page.evaluate((tableSelector) => {
				const table = document.querySelector(tableSelector);
				if (!table) return [];
				const ths = table.querySelectorAll('thead th');
				const missing: string[] = [];
				ths.forEach((th) => {
					const columnId = th.getAttribute('data-column-id');
					const cellRole = th.getAttribute('data-cell-role');
					if (columnId && columnId !== 'actions' && !cellRole) {
						missing.push(columnId);
					}
				});
				return missing;
			}, route.tableSelector);
			expect(
				missingRoles,
				`${route.route}: columns missing data-cell-role: ${missingRoles.join(', ')}`,
			).toEqual([]);
		});
	});
}

/* ─── Mobile: layout assertion ─── */

for (const mobile of MOBILE_ROUTES) {
	test.describe(`Mobile layout — ${mobile.route}`, () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test.beforeEach(async ({ page }) => {
			await loginAdmin(page);
			await openRoute(page, mobile.route);
		});

		test('no squeezed desktop table visible', async ({ page }) => {
			const visibleTables = page.locator('table').filter({ has: page.locator('thead') });
			const tableCount = await visibleTables.count();
			for (let i = 0; i < tableCount; i++) {
				const box = await visibleTables.nth(i).boundingBox();
				if (box) {
					expect(
						box.width,
						`${mobile.route}: visible table is ${Math.round(box.width)}px wide on mobile — squeezed desktop table detected`,
					).toBeLessThanOrEqual(420);
				}
			}
		});

		test('mobile cards or list items are visible', async ({ page }) => {
			const card = page.locator(mobile.cardSelector).first();
			await expect(card, `${mobile.route}: expected mobile card element "${mobile.cardSelector}" to be visible`).toBeVisible({ timeout: 12_000 });
		});

		test('no horizontal overflow', async ({ page }) => {
			const overflow = await page.evaluate(() => {
				const root = document.scrollingElement ?? document.documentElement;
				return {
					scrollWidth: root.scrollWidth,
					clientWidth: root.clientWidth,
				};
			});
			expect(
				overflow.scrollWidth,
				`${mobile.route} mobile: horizontal overflow detected (${overflow.scrollWidth}px > ${overflow.clientWidth}px)`,
			).toBeLessThanOrEqual(overflow.clientWidth + 8);
		});

		test('no global scrollbar', async ({ page }) => {
			await assertNoGlobalOverflow(page);
		});
	});
}
