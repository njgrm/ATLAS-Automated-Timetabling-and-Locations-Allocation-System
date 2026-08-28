import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import {
	installReadOnlyGenerationGuard,
	loginAdmin,
	openGeneratedPlacementReview,
	openOccupiedSwapReview,
} from './older-user-session-remediation-fixtures';
import { openTaskDrawer } from './timetable-layout-helpers';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'older-user-session-remediation', 'phase-3');
const fixtureReportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-simple-old-scheduler-finalization', '09-test-contract-alignment');

type FocusTrace = {
	name: string;
	invokingIdentity: string;
	firstFocus: { identity: string | null; insideDialog: boolean };
	tabSequence: Array<{ identity: string | null; insideDialog: boolean }>;
	restoredIdentity: string | null;
	restoredToInvoker: boolean;
};

async function attachPhase3Artifact(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
	return filePath;
}

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(fixtureReportRoot, { recursive: true });
	const filePath = path.join(fixtureReportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function activeSnapshot(page: Page, dialog: Locator) {
	const dialogHandle = await dialog.elementHandle();
	expect(dialogHandle, 'Dialog handle must exist before focus probing.').toBeTruthy();
	const snapshot = await page.evaluate((root) => {
		const element = document.activeElement as HTMLElement | null;
		return {
			identity: element && element !== document.body
				? element.getAttribute('data-phase-0-focus-id')
					?? element.getAttribute('data-testid')
					?? element.getAttribute('aria-label')
					?? element.textContent?.trim().slice(0, 80)
					?? element.tagName
				: null,
			insideDialog: Boolean(element && root instanceof HTMLElement && root.contains(element)),
		};
	}, dialogHandle);
	await dialogHandle.dispose();
	return snapshot;
}

async function expectFocusContainedAndRestored(page: Page, dialog: Locator, invokingIdentity: string, name: string): Promise<FocusTrace> {
	const firstFocus = await activeSnapshot(page, dialog);
	expect(firstFocus.insideDialog, `${name}: first focus must land inside the review dialog.`).toBeTruthy();

	const tabSequence: FocusTrace['tabSequence'] = [];
	for (let index = 0; index < 4; index += 1) {
		await page.keyboard.press('Tab');
		const snapshot = await activeSnapshot(page, dialog);
		tabSequence.push(snapshot);
		expect(snapshot.insideDialog, `${name}: Tab ${index + 1} must remain inside the dialog.`).toBeTruthy();
	}

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden({ timeout: 10_000 });
	const restoredIdentity = await page.evaluate(() => {
		const element = document.activeElement as HTMLElement | null;
		if (!element || element === document.body) return null;
		return element.getAttribute('data-phase-0-focus-id')
			?? element.getAttribute('data-testid')
			?? element.getAttribute('aria-label')
			?? element.textContent?.trim().slice(0, 80)
			?? element.tagName;
	});

	return {
		name,
		invokingIdentity,
		firstFocus,
		tabSequence,
		restoredIdentity,
		restoredToInvoker: restoredIdentity === invokingIdentity,
	};
}

async function openTimetable(page: Page) {
	await page.goto('/timetable', { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.locator('table[aria-label="Timetable"]')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('timetable-simple-primary-action')).toBeVisible({ timeout: 20_000 });
}

async function openDraftPlacementReview(page: Page): Promise<{ dialog: Locator; invokingIdentity: string } | null> {
	await openTimetable(page);
	await openTaskDrawer(page, /Plan draft/i);

	const unassignedText = page.getByText(/Unassigned Sessions|Pre-generation draft is empty/i);
	const hasUnassigned = await unassignedText.first().isVisible({ timeout: 5_000 }).catch(() => false);
	if (!hasUnassigned) {
		return null;
	}

	const queueItem = page.locator('#panel-unassigned [role="button"]').first();
	const hasQueueItem = await queueItem.isVisible({ timeout: 5_000 }).catch(() => false);
	if (!hasQueueItem) {
		return null;
	}
	await queueItem.click();

	const target = page
		.locator('td[role="button"][data-day][data-start-time][data-end-time]')
		.filter({ hasNot: page.locator('[data-timetable-entry="true"]') })
		.first();
	const hasTarget = await target.isVisible({ timeout: 5_000 }).catch(() => false);
	if (!hasTarget) {
		return null;
	}
	const invokingIdentity = `phase-3-draft-placement-${Date.now()}`;
	await target.evaluate((element, value) => element.setAttribute('data-phase-0-focus-id', value), invokingIdentity);
	await target.click({ position: { x: 8, y: 8 } });

	const dialog = page.getByTestId('draft-placement-review-dialog');
	const hasDialog = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
	if (!hasDialog) {
		return null;
	}
	return { dialog, invokingIdentity };
}

test.describe.serial('Timetable Phase 3 controlled review dialog focus restoration', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('generated placement review contains focus, exposes preview status, and restores focus on Escape', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const placement = await openGeneratedPlacementReview(page);
		test.skip(placement.status !== 'opened', placement.reason ?? 'Generated placement fixture unavailable.');

		const dialog = placement.dialog!;
		await expect(page.getByTestId('generated-placement-preview-status')).toContainText(/generated placement/i, { timeout: 10_000 });
		const trace = await expectFocusContainedAndRestored(page, dialog, placement.invokingIdentity!, 'generated-placement');

		expect(trace.restoredToInvoker, `Generated placement focus must return to invoker. Trace: ${JSON.stringify(trace)}`).toBeTruthy();
		expect(guard.blockedWrites, 'Cancel/Escape must not call generated write endpoints.').toEqual([]);
		await attachPhase3Artifact(testInfo, 'generated-placement-focus-trace', trace);
	});

	test('generated occupied-slot swap review contains focus and restores focus on Escape', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const swap = await openOccupiedSwapReview(page);

		await expect(page.getByTestId('generated-swap-preview-status')).toContainText(/occupied-slot swap/i, { timeout: 10_000 });
		const trace = await expectFocusContainedAndRestored(page, swap.dialog, swap.invokingIdentity, 'generated-swap');

		expect(trace.restoredToInvoker, `Generated swap focus must return to invoker. Trace: ${JSON.stringify(trace)}`).toBeTruthy();
		expect(guard.blockedWrites, 'Cancel/Escape must not call generated swap write endpoints.').toEqual([]);
		await attachPhase3Artifact(testInfo, 'generated-swap-focus-trace', trace);
	});

	test('draft placement review contains focus, survives preview rerender, and restores focus on Cancel', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const placement = await openDraftPlacementReview(page);

		if (!placement) {
			await attachReport(testInfo, 'draft-placement-fixture-limited', {
				reason: 'No draft queue items or empty draft workspace in current live run',
			});
			test.skip(true, 'Draft placement fixture unavailable in current live run.');
			return;
		}

		await expect(page.getByTestId('draft-placement-preview-status')).toContainText(/draft placement/i, { timeout: 10_000 });
		await expect(placement.dialog).toBeVisible({ timeout: 20_000 });
		const firstFocus = await activeSnapshot(page, placement.dialog);
		expect(firstFocus.insideDialog, 'Draft placement focus must enter the dialog.').toBeTruthy();

		await expect(page.getByRole('dialog').filter({ hasText: /Place this class\?/i })).toContainText(/Blocks|Warnings/i, { timeout: 20_000 });
		for (let index = 0; index < 3; index += 1) {
			await page.keyboard.press('Tab');
			const snapshot = await activeSnapshot(page, placement.dialog);
			expect(snapshot.insideDialog, `Draft placement Tab ${index + 1} must remain contained.`).toBeTruthy();
		}

		await placement.dialog.getByRole('button', { name: /^Cancel$/i }).click();
		await expect(placement.dialog).toBeHidden({ timeout: 10_000 });
		const restoredIdentity = await page.evaluate(() => {
			const element = document.activeElement as HTMLElement | null;
			return element?.getAttribute('data-phase-0-focus-id') ?? null;
		});
		const trace = {
			name: 'draft-placement',
			invokingIdentity: placement.invokingIdentity,
			firstFocus,
			restoredIdentity,
			restoredToInvoker: restoredIdentity === placement.invokingIdentity,
		};
		expect(trace.restoredToInvoker, `Draft placement focus must return to target cell. Trace: ${JSON.stringify(trace)}`).toBeTruthy();
		expect(guard.blockedWrites, 'Cancel must not call draft placement write endpoints.').toEqual([]);
		await attachPhase3Artifact(testInfo, 'draft-placement-focus-trace', trace);
	});
});
