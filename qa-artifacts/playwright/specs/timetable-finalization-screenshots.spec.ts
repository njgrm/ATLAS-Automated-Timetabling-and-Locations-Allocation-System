import { expect, test, type Page } from '@playwright/test';

import { loginAdmin, openTimetableAdvanced, openTimetableSimple } from './timetable-layout-helpers';

const SCREENSHOT_DIR = 'qa-artifacts/timetable-finalization-2026-08-02';

type DraftPayload = {
	entries?: Array<Record<string, unknown>>;
	draftEntries?: Array<Record<string, unknown>>;
	status?: string;
	publishedAt?: string;
	summary?: Record<string, unknown>;
};

async function activeFacultyId(page: Page) {
	const response = await page.request.get('/api/v1/faculty?schoolId=1');
	const payload = await response.json() as { faculty?: Array<{ id: number; status?: string; isActive?: boolean }> };
	return payload.faculty?.find((faculty) => faculty.isActive !== false && faculty.status !== 'INACTIVE')?.id
		?? payload.faculty?.[0]?.id
		?? 24065;
}

async function installCrowdedCellFixture(page: Page, options: { published?: boolean } = {}) {
	const fallbackFacultyId = await activeFacultyId(page);
	await page.route('**/api/v1/generation/**/runs/**/draft', async (route) => {
		if (route.request().method() !== 'GET') {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		const payload = await response.json() as DraftPayload;
		const entries = Array.isArray(payload.entries)
			? payload.entries
			: Array.isArray(payload.draftEntries)
				? payload.draftEntries
				: [];
		if (entries.length < 4) {
			await route.fulfill({ response });
			return;
		}
		const firstSectionId = entries
			.map((entry) => Number(entry.sectionId))
			.filter((id) => Number.isFinite(id))
			.sort((a, b) => a - b)[0];
		const template = entries.find((entry) => Number(entry.sectionId) === firstSectionId) ?? entries[0];
		const crowdedIds = new Set(entries.slice(0, 3).map((entry) => String(entry.entryId)));
		const crowded = entries.map((entry) => crowdedIds.has(String(entry.entryId))
			? {
				...entry,
				sectionId: firstSectionId,
				facultyId: Number(entry.facultyId) || fallbackFacultyId,
				day: String(template.day ?? 'MONDAY'),
				startTime: String(template.startTime ?? '07:30'),
				endTime: String(template.endTime ?? '08:30'),
			}
			: entry);
		const nextPayload = {
			...payload,
			status: options.published ? 'PUBLISHED' : payload.status,
			publishedAt: options.published ? new Date('2026-07-01T00:00:00.000Z').toISOString() : payload.publishedAt,
			summary: options.published
				? {
					...(payload.summary ?? {}),
					isPublished: true,
					publishedAt: new Date('2026-07-01T00:00:00.000Z').toISOString(),
					publishedBy: 1,
				}
				: payload.summary,
			...(Array.isArray(payload.entries) ? { entries: crowded } : { draftEntries: crowded }),
		};
		await route.fulfill({
			status: response.status(),
			headers: { ...response.headers(), 'content-type': 'application/json' },
			body: JSON.stringify(nextPayload),
		});
	});
}

test.describe.serial('Timetable finalization screenshot evidence', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('captures final simple, advanced, overflow, teacher departure, and published revision states', async ({ page }) => {
		test.setTimeout(120_000);
		await installCrowdedCellFixture(page);
		await openTimetableSimple(page);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/01-simple-default.png`, fullPage: false });

		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-task-guide')).toBeVisible({ timeout: 20_000 });
		await page.screenshot({ path: `${SCREENSHOT_DIR}/02-advanced-view.png`, fullPage: false });

		await page.getByTestId('timetable-layout-toggle').click();
		await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 20_000 });
		await page.getByTestId('timetable-cell-overflow-trigger').first().click();
		await expect(page.getByTestId('timetable-cell-overflow-sheet')).toBeVisible({ timeout: 10_000 });
		await page.screenshot({ path: `${SCREENSHOT_DIR}/03-crowded-cell-overflow.png`, fullPage: false });

		await page.locator('button[data-testid="timetable-cell-overflow-reassign-action"]:not([disabled])').first().click();
		await expect(page.getByTestId('teacher-departure-recovery-sheet')).toBeVisible({ timeout: 20_000 });
		await page.screenshot({ path: `${SCREENSHOT_DIR}/04-teacher-departure-sheet.png`, fullPage: false });

		await page.unroute('**/api/v1/generation/**/runs/**/draft');
		await installCrowdedCellFixture(page, { published: true });
		await openTimetableSimple(page);
		await page.getByTestId('timetable-cell-overflow-trigger').first().click();
		await page.locator('button[data-testid="timetable-cell-overflow-reassign-action"]:not([disabled])').first().click();
		await expect(page.getByTestId('teacher-departure-recovery-sheet')).toBeVisible({ timeout: 20_000 });
		await page.getByTestId('teacher-departure-next-button').click();
		await page.getByTestId('teacher-departure-replacement-select').locator('button').click();
		await page.locator('[data-radix-popper-content-wrapper] button').first().click();
		await page.getByRole('button', { name: /Use for all/i }).click();
		await page.getByTestId('teacher-departure-next-button').click();
		await page.getByTestId('teacher-departure-review-revision-button').click();
		await expect(page.getByRole('dialog').filter({ hasText: /Schedule a published repair/i })).toBeVisible({ timeout: 20_000 });
		await page.screenshot({ path: `${SCREENSHOT_DIR}/05-published-revision-dialog.png`, fullPage: false });
	});
});
