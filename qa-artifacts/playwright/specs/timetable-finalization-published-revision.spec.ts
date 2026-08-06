import { expect, test, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin, openSelectedClassTeacherDeparture, openTimetableSimple } from './timetable-layout-helpers';

type DraftPayload = {
	entries?: Array<Record<string, unknown>>;
	draftEntries?: Array<Record<string, unknown>>;
	summary?: Record<string, unknown>;
};

async function installPublishedTeacherFixture(page: Page) {
	const facultyResponse = await page.request.get('/api/v1/faculty?schoolId=1');
	const facultyPayload = await facultyResponse.json() as { faculty?: Array<{ id: number; status?: string; isActive?: boolean }> };
	const activeFacultyId = facultyPayload.faculty?.find((faculty) => faculty.isActive !== false && faculty.status !== 'INACTIVE')?.id
		?? facultyPayload.faculty?.[0]?.id
		?? 24065;

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
		if (entries.length === 0) {
			await route.fulfill({ response });
			return;
		}
		const sourceFacultyId = Number(entries.find((entry) => Number.isFinite(Number(entry.facultyId)))?.facultyId) || activeFacultyId;
		const nextEntries = entries.map((entry, index) => index < 3 ? { ...entry, facultyId: sourceFacultyId } : entry);
		const nextPayload = {
			...payload,
			summary: {
				...(payload.summary ?? {}),
				isPublished: true,
				publishedAt: new Date().toISOString(),
				publishedBy: 1,
			},
			...(Array.isArray(payload.entries) ? { entries: nextEntries } : { draftEntries: nextEntries }),
		};
		await route.fulfill({
			status: response.status(),
			headers: { ...response.headers(), 'content-type': 'application/json' },
			body: JSON.stringify(nextPayload),
		});
	});
}

async function chooseFirstReplacement(page: Page) {
	const wrapper = page.getByTestId('teacher-departure-replacement-select');
	await wrapper.getByRole('combobox').click();
	const popover = page.locator('[data-radix-popper-content-wrapper]').last();
	const option = popover.getByRole('button').first();
	await expect(option).toBeVisible({ timeout: 10_000 });
	await option.click();
}

test.describe('Timetable finalization published revision path', () => {
	test('published teacher departure opens effective-date revision review instead of direct rewrite', async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
		await installPublishedTeacherFixture(page);
		await openTimetableSimple(page);

		const entryWithTeacher = page.locator('[data-timetable-entry="true"][data-faculty-id]:not([data-faculty-id=""])').first();
		await expect(entryWithTeacher).toBeVisible({ timeout: 30_000 });
		await entryWithTeacher.click();
		const sheet = await openSelectedClassTeacherDeparture(page);
		await expect(sheet).toContainText(/Published run selected/i);
		await expect(page.getByTestId('teacher-departure-save-button')).toHaveCount(0);
		await expect(page.getByTestId('teacher-departure-next-button')).toBeEnabled();
		await page.getByTestId('teacher-departure-next-button').click();

		await chooseFirstReplacement(page);
		await page.getByRole('button', { name: /^Use for all$/i }).click();
		await page.getByTestId('teacher-departure-next-button').click();
		await expect(page.getByTestId('teacher-departure-review-revision-button')).toBeEnabled({ timeout: 10_000 });
		await page.getByTestId('teacher-departure-review-revision-button').click();

		const dialog = page.getByRole('dialog').filter({ hasText: /Schedule a published repair/i });
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await expect(dialog).toContainText(/does not overwrite the published run/i);
		await expect(page.getByTestId('published-teacher-departure-effective-date')).toBeVisible();
		await assertNoGlobalOverflow(page);
	});
});
