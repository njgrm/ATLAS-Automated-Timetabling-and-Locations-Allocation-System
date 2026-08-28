import { expect, test, type Page } from '@playwright/test';

import { loginAdmin } from './timetable-layout-helpers';

const ROUTE = '/teachers';

async function openTeachers(page: Page) {
	await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null);
	await page.waitForTimeout(1000);
}

test.describe('Teachers load status cap consistency', () => {
	test.beforeEach(async ({ page }) => {
		await loginAdmin(page);
		await openTeachers(page);
	});

	test('no row shows Near cap alongside over indicator', async ({ page }) => {
		const rows = await page.locator('[data-admin-table-view="desktop"] table tbody tr').all();
		expect(rows.length, 'Expected at least one teacher row').toBeGreaterThan(0);

		for (let i = 0; i < Math.min(rows.length, 15); i++) {
			const text = await rows[i].innerText();
			const hasNearCap = /Near cap/i.test(text);
			const hasOver = /\d+\.?\d*\s*\/\s*\d+h?\s*over/i.test(text);
			expect(
				hasNearCap && hasOver,
				`Row ${i}: must not show "Near cap" badge alongside "over" weekly load indicator — "${text.slice(0, 80)}"`,
			).toBeFalsy();
		}
	});

	test('teachers above their personal cap show Over cap badge', async ({ page }) => {
		// Intercept API to find teachers over their personal cap
		type FacultyData = { id: number; firstName: string; lastName: string; policyCreditedHours: number; maxHoursPerWeek: number }[];
		const capturedFaculty: FacultyData = [];

		await page.route('**/faculty-assignments/summary*', async (route) => {
			const response = await route.fetch();
			const json = await response.json().catch(() => null);
			if (json?.faculty) {
				for (const f of json.faculty) {
					capturedFaculty.push({
						id: f.id,
						firstName: f.firstName,
						lastName: f.lastName,
						policyCreditedHours: f.policyCreditedHours ?? 0,
						maxHoursPerWeek: f.maxHoursPerWeek ?? 40,
					});
				}
			}
			await route.fulfill({ response });
		});

		await page.reload({ waitUntil: 'networkidle' });
		await page.waitForTimeout(1000);

		// Find teachers who are over their personal cap
		const overCapTeachers = capturedFaculty.filter(
			(f) => f.policyCreditedHours > f.maxHoursPerWeek && f.isActiveForScheduling !== false,
		);

		if (overCapTeachers.length === 0) {
			test.skip(true, 'No teachers over their personal cap on current data');
			return;
		}

		// Check that these teachers show "Over cap" badge, not "Near cap"
		for (const teacher of overCapTeachers.slice(0, 5)) {
			const row = page.locator(`[data-admin-table-view="desktop"] table tbody tr`, { hasText: `${teacher.lastName}, ${teacher.firstName}` }).first();
			const isVisible = await row.isVisible({ timeout: 3000 }).catch(() => false);
			if (!isVisible) continue;

			const text = await row.innerText();
			expect(
				text,
				`${teacher.lastName}, ${teacher.firstName} (${teacher.policyCreditedHours}h / ${teacher.maxHoursPerWeek}h max) should show "Over cap" badge`,
			).toMatch(/Over cap/);
			expect(
				text,
				`${teacher.lastName}, ${teacher.firstName} should NOT show "Near cap"`,
			).not.toMatch(/Near cap/);
		}
	});
});
