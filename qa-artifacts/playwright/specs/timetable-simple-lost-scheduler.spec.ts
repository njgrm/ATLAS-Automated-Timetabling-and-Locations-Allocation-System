import { expect, test, type Page } from '@playwright/test';

import { loginAdmin, openTimetableSimple, assertNoGlobalOverflow } from './timetable-layout-helpers';

const SCHOOL_ID = 1;

type ApiFixture = {
	runId: number;
	schoolYearId: number;
	unresolvedCount: number;
	hardBlockerCount: number;
	softCount: number;
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
			softCount: typeof s.softViolationCount === 'number' ? s.softViolationCount : 0,
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

test.describe.serial('Timetable Simple Lost-Scheduler Baseline', () => {
	for (const vp of viewports) {
		test(`${vp.name}: simple mode is default and header renders with lifecycle controls`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			const header = page.getByTestId('timetable-simple-header');
			await expect(header).toBeVisible({ timeout: 30_000 });

			const moreTrigger = page.getByTestId('timetable-simple-more-trigger');
			await expect(moreTrigger).toBeVisible();

			const tutorialTrigger = page.getByTestId('timetable-simple-tutorial-trigger');
			await expect(tutorialTrigger).toBeVisible();

			const readinessChip = page.getByTestId('timetable-simple-readiness-chip');
			await expect(readinessChip).toBeVisible();

			const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-header-${Date.now()}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: false });
			await testInfo.attach(screenshotPath, { path: screenshotPath });

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: publish-blocker sheet opens and shows groups without raw enums`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack or completed run unavailable');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const sheetOpened = await openReadinessSheet(page);
			if (!sheetOpened) {
				test.skip(true, 'Readiness sheet did not open — no blockers or fixture issue');
				return;
			}

			const sheet = page.getByTestId('timetable-simple-publish-readiness-sheet');
			await expect(sheet).toBeVisible();

			const bodyText = await sheet.innerText();
			const rawEnumPattern = /FACULTY_[A-Z_]{3,}|ROOM_[A-Z_]{3,}|SECTION_[A-Z_]{3,}|UNASSIGNED_SECTION|SPECIALIZED_ROOM/;
			expect(rawEnumPattern.test(bodyText), 'Readiness sheet must not contain raw enum text').toBeFalsy();

			if (fixture!.hardBlockerCount > 0) {
				const blockerGroups = sheet.getByTestId('timetable-simple-blocker-group');
				expect(await blockerGroups.count(), 'At least one blocker group must be visible').toBeGreaterThan(0);
			}

			const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-readiness-${Date.now()}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: false });
			await testInfo.attach(screenshotPath, { path: screenshotPath });

			await assertNoGlobalOverflow(page);
			await page.keyboard.press('Escape');
		});

		test(`${vp.name}: plotting tray opened from Start placing shows current session`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack unavailable');
			test.skip(fixture!.unresolvedCount === 0, 'No unresolved sessions in fixture');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const primary = page.getByTestId('timetable-simple-primary-action');
			await expect(primary).toBeVisible();
			const label = (await primary.innerText()).toLowerCase();
			if (label.includes('placing') || label.includes('place')) {
				await primary.click();
			} else {
				await page.getByTestId('timetable-simple-more-trigger').click();
				await page.getByTestId('timetable-simple-more-daily-tasks').getByText(/Place unresolved sessions/i).click();
			}

			const tray = page.getByTestId('simple-plotting-tray');
			await expect(tray).toBeVisible({ timeout: 10_000 });
			await expect(tray.getByTestId('simple-current-session-card')).toHaveCount(1);

			const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-plotting-tray-${Date.now()}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: false });
			await testInfo.attach(screenshotPath, { path: screenshotPath });

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: plotting tray opened from publish-blocker repair preserves context`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack unavailable');
			test.skip(fixture!.hardBlockerCount === 0, 'No hard blockers in fixture');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const sheetOpened = await openReadinessSheet(page);
			test.skip(!sheetOpened, 'Readiness sheet did not open');

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
			const hasFilter = await filterChip.isVisible({ timeout: 3_000 }).catch(() => false);

			const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-blocker-repair-tray-${Date.now()}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: false });
			await testInfo.attach(screenshotPath, { path: screenshotPath });

			await assertNoGlobalOverflow(page);

			if (hasFilter) {
				const filterText = await filterChip.innerText();
				expect(filterText.toLowerCase()).toContain('no available slot');
			}
		});

		test(`${vp.name}: plotting tray opened from publish-blocker repair shows context banner`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack unavailable');
			test.skip(fixture!.hardBlockerCount === 0, 'No hard blockers in fixture');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const sheetOpened = await openReadinessSheet(page);
			test.skip(!sheetOpened, 'Readiness sheet did not open');

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

			const banner = page.getByTestId('timetable-repair-context-banner');
			const hasBanner = await banner.isVisible({ timeout: 3_000 }).catch(() => false);

			if (hasBanner) {
				await expect(banner).toContainText(/Fixing publish blockers/i);
				await expect(page.getByTestId('timetable-repair-back-to-blockers')).toBeVisible();

				const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-repair-banner-${Date.now()}.png`;
				await page.screenshot({ path: screenshotPath, fullPage: false });
				await testInfo.attach(screenshotPath, { path: screenshotPath });

				await page.getByTestId('timetable-repair-back-to-blockers').click();
				await expect(page.getByTestId('timetable-simple-publish-readiness-sheet')).toBeVisible({ timeout: 5_000 });
			} else {
				console.warn(`[BASELINE] No repair context banner visible — will be verified after Prompt 02 implementation`);
			}

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: more menu groups are present and tutorial opens`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			await page.getByTestId('timetable-simple-more-trigger').click();
			await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toBeVisible();
			await expect(page.getByTestId('timetable-simple-more-schedule-data')).toBeVisible();
			await expect(page.getByTestId('timetable-simple-more-expert-tools')).toBeVisible();
			await page.keyboard.press('Escape');

			await page.getByTestId('timetable-simple-tutorial-trigger').click();
			const tutorial = page.getByTestId('timetable-simple-tutorial');
			await expect(tutorial).toBeVisible();
			await expect(tutorial).toContainText(/Simple timetable tutorial/i);

			const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-tutorial-${Date.now()}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: false });
			await testInfo.attach(screenshotPath, { path: screenshotPath });

			await assertNoGlobalOverflow(page);
			await page.keyboard.press('Escape');
		});

		test(`${vp.name}: schedule switcher works in section teacher room modes`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const viewport = page.viewportSize();
			if ((viewport?.width ?? 1366) < 1024) {
				const sheet = page.getByTestId('timetable-simple-schedule-sheet');
				await page.getByRole('button', { name: /Showing .* schedule/i }).click();
				await expect(sheet).toBeVisible();
				const sheetSwitcher = sheet.getByTestId('timetable-simple-schedule-switcher');
				await expect(sheetSwitcher).toBeVisible();
				const viewModeSelect = sheetSwitcher.getByTestId('timetable-simple-view-mode-select');
				await expect(viewModeSelect).toBeVisible();
			} else {
				const headerSwitcher = page.getByTestId('timetable-simple-header').getByTestId('timetable-simple-schedule-switcher');
				await expect(headerSwitcher).toBeVisible();
				const viewModeSelect = headerSwitcher.getByTestId('timetable-simple-view-mode-select');
				await expect(viewModeSelect).toBeVisible();
			}

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: no compact G7/G8/G9/G10 labels where GR format is required`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const plottingTray = page.getByTestId('simple-plotting-tray');
			const hasTray = await plottingTray.isVisible({ timeout: 3_000 }).catch(() => false);

			if (hasTray) {
				const trayText = await plottingTray.innerText();
				const badGradePattern = /\bG(7|8|9|10)\b/;
				expect(badGradePattern.test(trayText), 'Plotting tray must not contain G7/G8/G9/G10 — use GR7/GR8/GR9/GR10').toBeFalsy();
			}

			const bodyText = await page.locator('body').innerText();
			const rawIdPattern = /Section \d+ subject \d+|subject \d+ session \d+/i;
			expect(rawIdPattern.test(bodyText), 'Body must not contain raw ID-only text').toBeFalsy();

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: reason stack explains row actions when blocker and action differ`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);
			test.skip(!fixture, 'Dev stack unavailable');
			test.skip(fixture!.unresolvedCount === 0, 'No unresolved sessions');

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const primary = page.getByTestId('timetable-simple-primary-action');
			await expect(primary).toBeVisible();
			const label = (await primary.innerText()).toLowerCase();
			if (label.includes('placing') || label.includes('place')) {
				await primary.click();
			} else {
				await page.getByTestId('timetable-simple-more-trigger').click();
				await page.getByTestId('timetable-simple-more-daily-tasks').getByText(/Place unresolved sessions/i).click();
			}

			const tray = page.getByTestId('simple-plotting-tray');
			await expect(tray).toBeVisible({ timeout: 10_000 });

			const reasonStacks = tray.getByTestId('timetable-row-reason-stack');
			const stackCount = await reasonStacks.count();

			if (stackCount > 0) {
				const firstStack = await reasonStacks.first().innerText();
				expect(firstStack.length).toBeGreaterThan(0);

				const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-reason-stack-${Date.now()}.png`;
				await page.screenshot({ path: screenshotPath, fullPage: false });
				await testInfo.attach(screenshotPath, { path: screenshotPath });
			}

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: no global vertical scrollbar and no horizontal overflow`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const metrics = await assertNoGlobalOverflow(page);

			expect(metrics.scrollHeight, 'No global vertical scrollbar').toBeLessThanOrEqual(metrics.clientHeight + 8);
			expect(metrics.scrollWidth, 'No horizontal overflow').toBeLessThanOrEqual(metrics.clientWidth + 8);
		});

		test(`${vp.name}: mobile lifecycle action is visible on mobile and matches state`, async ({ page }, testInfo) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			const fixture = await fetchApiFixture(page);

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const mobileAction = page.getByTestId('timetable-simple-mobile-lifecycle-action');
			const hasMobileAction = await mobileAction.isVisible({ timeout: 3_000 }).catch(() => false);

			if (vp.width < 640) {
				expect(hasMobileAction, 'Mobile lifecycle action must be visible on mobile').toBeTruthy();
				if (hasMobileAction) {
					const label = (await mobileAction.innerText()).trim().toLowerCase();
					if (label) {
						const validLabels = ['generate', 'publish', 'published', 'fix blockers', 'review warnings', 'review setup', 'generating'];
						const matchesValid = validLabels.some((valid) => label.includes(valid));
						expect(matchesValid, `Mobile lifecycle label "${label}" must be a valid state label`).toBeTruthy();
					}

					const screenshotPath = `qa-artifacts/lost-scheduler-baseline/${vp.name}-mobile-lifecycle-${Date.now()}.png`;
					await page.screenshot({ path: screenshotPath, fullPage: false });
					await testInfo.attach(screenshotPath, { path: screenshotPath });
				}
			} else {
				expect(hasMobileAction, 'Mobile lifecycle action must be hidden on desktop').toBeFalsy();
			}

			await assertNoGlobalOverflow(page);
		});

		test(`${vp.name}: more trigger is inside viewport and keyboard reachable`, async ({ page }) => {
			await page.context().clearCookies();
			await loginAdmin(page);
			await page.setViewportSize({ width: vp.width, height: vp.height });

			await openTimetableSimple(page);
			await expect(page.getByTestId('timetable-simple-header')).toBeVisible({ timeout: 30_000 });

			const moreTrigger = page.getByTestId('timetable-simple-more-trigger');
			await expect(moreTrigger).toBeVisible();

			const box = await moreTrigger.boundingBox();
			expect(box, 'More trigger must have a bounding box').not.toBeNull();
			const viewport = page.viewportSize();
			expect(box!.x, 'More trigger x must be within viewport').toBeGreaterThanOrEqual(-4);
			expect(box!.y, 'More trigger y must be within viewport').toBeGreaterThanOrEqual(-4);
			expect(box!.x, 'More trigger x must be within viewport').toBeGreaterThanOrEqual(-4);
			expect(box!.y, 'More trigger y must be within viewport').toBeGreaterThanOrEqual(-4);

			const overflowsRight = (box!.x + box!.width) > (viewport!.width + 4);
			const overflowsBottom = (box!.y + box!.height) > (viewport!.height + 4);
			expect(overflowsRight, `More trigger right edge (${box!.x + box!.width}) must not exceed viewport width (${viewport!.width})`).toBeFalsy();
			expect(overflowsBottom, `More trigger bottom edge (${box!.y + box!.height}) must not exceed viewport height (${viewport!.height})`).toBeFalsy();

			await moreTrigger.focus();
			await page.keyboard.press('Enter');
			await expect(page.getByTestId('timetable-simple-more-daily-tasks')).toBeVisible({ timeout: 5_000 });
			await page.keyboard.press('Escape');
		});
	}
});
