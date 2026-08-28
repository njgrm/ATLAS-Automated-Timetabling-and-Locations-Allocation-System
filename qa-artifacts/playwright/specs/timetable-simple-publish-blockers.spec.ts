import { expect, test, type Page } from '@playwright/test';

import { loginAdmin, openTimetableSimple, assertNoGlobalOverflow } from './timetable-layout-helpers';

const SCHOOL_ID = 1;

type ApiFixture = {
	runId: number;
	schoolYearId: number;
	unresolvedCount: number;
	hardBlockerCount: number;
};

async function fetchApiFixture(page: Page): Promise<ApiFixture | null> {
	try {
		const ctxResp = await page.request.get(`/api/v1/runtime/context?schoolId=${SCHOOL_ID}`);
		if (!ctxResp.ok()) return null;
		const ctx = await ctxResp.json() as { activeSchoolYearId?: number };
		const syId = Number.isFinite(ctx.activeSchoolYearId) ? Number(ctx.activeSchoolYearId) : null;
		if (syId === null) return null;

		const runsResp = await page.request.get(`/api/v1/generation/${SCHOOL_ID}/${syId}/runs?limit=5`);
		if (!runsResp.ok()) return null;
		const runs = await runsResp.json() as { runs?: Array<{ id?: number; status?: string }> };
		const completed = runs.runs?.find((r) => r.status === 'COMPLETED');
		if (!completed?.id) return null;

		const detailResp = await page.request.get(`/api/v1/generation/${SCHOOL_ID}/${syId}/runs/${completed.id}`);
		if (!detailResp.ok()) return null;
		const detail = await detailResp.json() as { run?: { summary?: Record<string, unknown> } };
		const s = detail.run?.summary;
		if (!s) return null;

		return {
			runId: completed.id,
			schoolYearId: syId,
			unresolvedCount: typeof s.unassignedCount === 'number' ? s.unassignedCount : 0,
			hardBlockerCount: typeof s.hardViolationCount === 'number' ? s.hardViolationCount : 0,
		};
	} catch {
		return null;
	}
}

async function openReadinessSheet(page: Page): Promise<boolean> {
	const chip = page.getByTestId('timetable-simple-readiness-chip');
	if (await chip.isVisible({ timeout: 3_000 }).catch(() => false)) {
		await chip.click();
		const sheet = page.getByTestId('timetable-simple-publish-readiness-sheet');
		if (await sheet.isVisible({ timeout: 5_000 }).catch(() => false)) return true;
	}
	const bar = page.getByTestId('timetable-publish-readiness-summary');
	if (await bar.isVisible({ timeout: 2_000 }).catch(() => false)) {
		await bar.click();
		const sheet = page.getByTestId('timetable-simple-publish-readiness-sheet');
		if (await sheet.isVisible({ timeout: 5_000 }).catch(() => false)) return true;
	}
	return false;
}

const viewports = [
	{ name: 'desktop', width: 1366, height: 768 },
	{ name: 'mobile-portrait', width: 390, height: 844 },
	{ name: 'mobile-landscape', width: 844, height: 390 },
] as const;

test.describe.serial('Timetable simple publish blockers', () => {
	for (const vp of viewports) {
		test(`${vp.name}: readiness sheet opens with correct labels, groups, and no raw enums`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack or completed run unavailable');
			test.skip(fixture!.hardBlockerCount === 0, 'No hard blockers in current fixture');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const sheetOpened = await openReadinessSheet(page);
			expect(sheetOpened, 'Readiness sheet must open from Simple mode').toBeTruthy();

			const sheet = page.getByTestId('timetable-simple-publish-readiness-sheet');
			await expect(sheet).toBeVisible();

			const summaryArea = sheet.getByTestId('timetable-simple-publish-blocker-summary');
			const summaryText = await summaryArea.innerText();

			expect(summaryText).toContain(`${fixture!.unresolvedCount} session`);
			expect(summaryText).not.toContain('Section name missing');

			const rawEnumPattern = /FACULTY_[A-Z_]{3,}|ROOM_[A-Z_]{3,}|SECTION_[A-Z_]{3,}|UNASSIGNED_SECTION|SPECIALIZED_ROOM/;
			expect(rawEnumPattern.test(summaryText), `Sheet must not contain raw warning enum`).toBeFalsy();

			const blockerGroups = sheet.getByTestId('timetable-simple-blocker-group');
			const groupCount = await blockerGroups.count();
			expect(groupCount, 'At least one blocker group must be visible').toBeGreaterThan(0);

			if (fixture!.hardBlockerCount > 0) {
				expect(summaryText).toContain('Cannot publish yet');
			}

			const screenshotPath = `qa-artifacts/publish-blocker-baseline/${vp.name}-readiness-${Date.now()}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: false });
			await testInfo.attach(screenshotPath, { path: screenshotPath });

			await assertNoGlobalOverflow(page);

			await page.keyboard.press('Escape');
			await expect(sheet).not.toBeVisible({ timeout: 10_000 });
		});

		test(`${vp.name}: no raw ID-only text and no global overflow`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const bodyText = await page.locator('body').innerText();
			expect(bodyText).not.toMatch(/Section \d+ subject \d+|subject \d+ session \d+/i);

			await assertNoGlobalOverflow(page);
		});
	}

	for (const vp of viewports) {
		test(`${vp.name}: Open Teaching Load navigates to /teaching-load`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack unavailable');
			test.skip(fixture!.hardBlockerCount === 0, 'No hard blockers');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const sheetOpened = await openReadinessSheet(page);
			test.skip(!sheetOpened, 'Sheet did not open');

			const sheet = page.getByTestId('timetable-simple-publish-readiness-sheet');
			const groups = sheet.getByTestId('timetable-simple-blocker-group');
			const groupCount = await groups.count();

			let foundTeachingLoadGroup = false;
			for (let i = 0; i < groupCount; i++) {
				const group = groups.nth(i);
				const text = await group.innerText();
				if (/overloaded|qualified teacher/i.test(text)) {
					const action = group.getByTestId('timetable-simple-blocker-next-action');
					await action.click();
					foundTeachingLoadGroup = true;
					break;
				}
			}

			test.skip(!foundTeachingLoadGroup, 'No teaching-load blocker group in fixture');

			await page.waitForURL(/\/teaching-load/, { timeout: 10_000 });
			expect(page.url()).toContain('/teaching-load');

			const header = page.locator('h1, h2, [data-testid]').filter({ hasText: /teaching load/i }).first();
			await expect(header).toBeVisible({ timeout: 10_000 });
		});

		test(`${vp.name}: Place manually opens filtered placement tray for NO_AVAILABLE_SLOT`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack unavailable');
			test.skip(fixture!.hardBlockerCount === 0, 'No hard blockers');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const sheetOpened = await openReadinessSheet(page);
			test.skip(!sheetOpened, 'Sheet did not open');

			const sheet = page.getByTestId('timetable-simple-publish-readiness-sheet');
			const groups = sheet.getByTestId('timetable-simple-blocker-group');
			const groupCount = await groups.count();

			let foundSlotGroup = false;
			for (let i = 0; i < groupCount; i++) {
				const group = groups.nth(i);
				const text = await group.innerText();
				if (/no.*slot|no.*time.*slot/i.test(text)) {
					const action = group.getByTestId('timetable-simple-blocker-next-action');
					await action.click();
					foundSlotGroup = true;
					break;
				}
			}

			test.skip(!foundSlotGroup, 'No NO_AVAILABLE_SLOT blocker group in fixture');

			await expect(sheet).not.toBeVisible({ timeout: 5_000 });

			const drawer = page.getByTestId('timetable-task-drawer');
			await expect(drawer).toBeVisible({ timeout: 10_000 });

			const filterChip = page.getByTestId('simple-plotting-reason-filter');
			await expect(filterChip).toBeVisible({ timeout: 5_000 });
			const filterText = await filterChip.innerText();
			expect(filterText.toLowerCase()).toContain('no available slot');
		});
	}
});
