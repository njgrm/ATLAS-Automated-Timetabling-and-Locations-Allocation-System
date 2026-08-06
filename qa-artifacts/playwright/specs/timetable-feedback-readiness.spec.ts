import { expect, test, type Page } from '@playwright/test';

import {
	assertNoGlobalOverflow,
	loginAdmin,
	openPrimaryTaskDrawer,
	openSelectedClassTeacherDeparture,
	openSimpleMore,
	openTimetableSimple,
} from './timetable-layout-helpers';
import {
	installReadOnlyGenerationGuard,
	openGeneratedPlacementReview,
	openOccupiedSwapReview,
} from './older-user-session-remediation-fixtures';

async function assertNoObsoleteAssignmentModal(page: Page) {
	await expect(page.getByText(/Assign teacher and room|Choose teacher/i)).toHaveCount(0);
}

async function openDraftPlacementReview(page: Page) {
	await openTimetableSimple(page);
	await openSimpleMore(page);
	await page.getByRole('menuitem', { name: /^Plan draft$/i }).click();
	const tray = page.getByTestId('pregen-plotting-tray');
	await expect(tray).toBeVisible({ timeout: 30_000 });
	const current = tray.getByTestId('pregen-current-plotting-item');
	await expect(current).toBeVisible({ timeout: 20_000 });
	const action = current.getByRole('button', { name: /^(Place|Choose room|Fix owner|Review blocker)$/i }).first();
	await expect(action).toBeVisible({ timeout: 15_000 });
	const label = (await action.innerText()).trim();
	if (!/^(Place|Choose room)$/i.test(label)) {
		test.skip(true, `Current draft item is not place-capable: ${label}`);
	}
	await action.click();
	await expect(page.locator('[data-cell-preview-label]').first()).toBeVisible({ timeout: 15_000 });
	await page.locator('td[data-day][data-start-time][data-end-time]').first().click({ position: { x: 8, y: 8 } });
	const dialog = page.getByTestId('draft-placement-review-dialog');
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	return dialog;
}

async function openTeacherDepartureFromSelection(page: Page) {
	await openTimetableSimple(page);
	const entries = page.locator('[data-timetable-entry="true"]');
	await expect(entries.first()).toBeVisible({ timeout: 30_000 });
	await entries.first().click();
	return openSelectedClassTeacherDeparture(page);
}

test.describe('Timetable feedback readiness', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('runtime preflight classifies live-stack availability before UI checks', async ({ page }) => {
		const health = await page.request.get('/api/v1/health');
		expect(health.ok(), `Dev stack unavailable: /api/v1/health returned HTTP ${health.status()}.`).toBeTruthy();
		const login = await page.request.post('/api/v1/auth/login', {
			data: {
				identifier: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? '1000001',
				password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminSY2026!',
			},
		});
		expect(login.ok(), `Admin login unavailable: HTTP ${login.status()} ${(await login.text()).slice(0, 300)}`).toBeTruthy();
	});

	test('generated placement review explains disabled or ready save state beside the action', async ({ page }) => {
		await installReadOnlyGenerationGuard(page);
		await openTimetableSimple(page);
		const placement = await openGeneratedPlacementReview(page);
		if (placement.status === 'fixture-unavailable') test.skip(true, placement.reason);
		const feedback = placement.dialog!.getByTestId('generated-placement-feedback');
		await expect(feedback).toBeVisible();
		await expect(feedback).toContainText(/Ready|Choose|Waiting|blocked|refresh|saving/i);
		await expect(placement.dialog!.getByRole('button', { name: /^Save placement$/i })).toBeVisible();
		await assertNoObsoleteAssignmentModal(page);
		await placement.dialog!.getByRole('button', { name: /^Cancel$/i }).click();
		await assertNoGlobalOverflow(page);
	});

	test('draft placement review keeps a visible plain-language save reason', async ({ page }) => {
		await installReadOnlyGenerationGuard(page);
		const dialog = await openDraftPlacementReview(page);
		await expect(dialog.getByTestId('draft-placement-save-reason')).toBeVisible();
		await expect(dialog.getByTestId('draft-placement-feedback')).toContainText(/Ready|Fix|Choose|Waiting|blocked|Preview|outside|window|conflict|slot/i);
		await expect(dialog.getByRole('button', { name: /^Save placement$/i })).toBeVisible();
		await assertNoObsoleteAssignmentModal(page);
		await dialog.getByRole('button', { name: /^Cancel$/i }).click();
		await assertNoGlobalOverflow(page);
	});

	test('generated and draft swap reviews expose live feedback status', async ({ page }) => {
		await installReadOnlyGenerationGuard(page);
		const generatedSwap = await openOccupiedSwapReview(page);
		await expect(generatedSwap.dialog.getByTestId('generated-swap-feedback')).toBeVisible();
		await expect(generatedSwap.dialog.getByTestId('generated-swap-feedback')).toContainText(/Ready|Choose|Checking|error|Saving|swap/i);
		await assertNoObsoleteAssignmentModal(page);
		await generatedSwap.dialog.getByRole('button', { name: /^Cancel$/i }).click();

		const draftDialog = await openDraftPlacementReview(page);
		const reviewSwitch = draftDialog.getByRole('button', { name: /Review switch/i });
		if (await reviewSwitch.isVisible().catch(() => false)) {
			await reviewSwitch.click();
			const swapDialog = page.getByTestId('draft-swap-review-dialog');
			await expect(swapDialog).toBeVisible({ timeout: 20_000 });
			await expect(swapDialog.getByTestId('swap-review-feedback')).toBeVisible();
			await expect(swapDialog.getByTestId('swap-review-feedback')).toContainText(/Ready|Checking|error|Saving|switch/i);
			await swapDialog.getByRole('button', { name: /^Cancel$/i }).click();
		} else {
			test.info().annotations.push({
				type: 'fixture-unavailable',
				description: 'Current draft placement target did not create an occupied-slot draft swap review.',
			});
			await draftDialog.getByRole('button', { name: /^Cancel$/i }).click();
		}
		await assertNoGlobalOverflow(page);
	});

	test('teacher departure and optional published revision paths expose scheduler-facing feedback', async ({ page }) => {
		const sheet = await openTeacherDepartureFromSelection(page);
		await expect(sheet.getByTestId('teacher-departure-feedback')).toBeVisible();
		await expect(sheet.getByTestId('teacher-departure-save-reason')).toBeVisible();

		const revisionButton = sheet.getByTestId('teacher-departure-review-revision-button');
		if (await revisionButton.isVisible().catch(() => false)) {
			if (await revisionButton.isDisabled()) {
				await expect(sheet.getByTestId('teacher-departure-save-reason')).toContainText(/Choose|replacement|revision|published/i);
			} else {
				await revisionButton.click();
				const dialog = page.getByTestId('published-revision-dialog');
				await expect(dialog).toBeVisible({ timeout: 20_000 });
				await expect(dialog.getByTestId('published-revision-feedback')).toBeVisible();
				await expect(dialog.getByTestId('published-revision-feedback')).toContainText(/Effective date|reason|Ready|Revision|preserved/i);
				await dialog.getByRole('button', { name: /^Close$/i }).click();
			}
		} else {
			test.info().annotations.push({
				type: 'fixture-unavailable',
				description: 'Selected live run is not published, so published revision review was not expected.',
			});
		}
		await assertNoGlobalOverflow(page);
	});

	test('primary task drawer uses one tray-level status instead of repeated row-only loading feedback', async ({ page }) => {
		await openTimetableSimple(page);
		const drawer = await openPrimaryTaskDrawer(page);
		await expect(drawer.getByTestId('simple-current-session-card')).toBeVisible({ timeout: 20_000 });
		await expect(drawer).toContainText(/Current session|Next sessions|Find session|No session is ready|Loading names/i);
		await assertNoGlobalOverflow(page);
	});
});
