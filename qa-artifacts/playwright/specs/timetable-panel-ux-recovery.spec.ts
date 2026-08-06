import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import {
	assertNoGlobalOverflow,
	loginAdmin,
	openTimetableAdvanced,
	openTimetableSimple,
} from './timetable-layout-helpers';
import {
	captureRuntimeFixture,
	installReadOnlyGenerationGuard,
	openGeneratedPlacementReview,
	openOccupiedSwapReview,
	SCHOOL_ID,
} from './older-user-session-remediation-fixtures';

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'timetable-panel-ux-recovery');

async function attachArtifact(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
	return filePath;
}

async function screenshot(testInfo: TestInfo, page: Page, name: string) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}.png`);
	await page.screenshot({ path: filePath, fullPage: false });
	await testInfo.attach(name, { path: filePath, contentType: 'image/png' });
	return filePath;
}

async function assertLocalOverflowSafe(page: Page, locator: Locator, label: string) {
	await expect(locator).toBeVisible({ timeout: 20_000 });
	const metrics = await locator.evaluate((node) => {
		const elements = Array.from(node.querySelectorAll<HTMLElement>('button, [role="button"], input, [data-unassigned-status], p, span, div'))
			.filter((element) => {
				const style = getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 24 && rect.height > 8;
			})
			.slice(0, 180)
			.map((element) => ({
				tag: element.tagName,
				text: element.textContent?.trim().slice(0, 80) ?? '',
				clientWidth: element.clientWidth,
				scrollWidth: element.scrollWidth,
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
				overflowX: getComputedStyle(element).overflowX,
				overflowY: getComputedStyle(element).overflowY,
			}));
		return {
			panel: {
				clientWidth: node.clientWidth,
				scrollWidth: node.scrollWidth,
				clientHeight: node.clientHeight,
				scrollHeight: node.scrollHeight,
			},
			offenders: elements.filter((element) => (
				element.scrollWidth > element.clientWidth + 12
				&& element.overflowX !== 'hidden'
				&& element.overflowX !== 'clip'
			)),
		};
	});
	expect(metrics.panel.scrollWidth, `${label} must not horizontally overflow its local panel. ${JSON.stringify(metrics.panel)}`).toBeLessThanOrEqual(metrics.panel.clientWidth + 12);
	expect(metrics.offenders, `${label} has visible text/control overflow: ${JSON.stringify(metrics.offenders.slice(0, 8), null, 2)}`).toEqual([]);
	return metrics;
}

async function assertLocalOverflowSafeWhenOpen(page: Page, locator: Locator, label: string) {
	const width = await locator.evaluate((node) => node.clientWidth);
	if (width < 48) {
		await assertNoGlobalOverflow(page);
		return {
			panel: { clientWidth: width, scrollWidth: 0, clientHeight: 0, scrollHeight: 0 },
			offenders: [],
			collapsed: true,
		};
	}
	return assertLocalOverflowSafe(page, locator, label);
}

async function dragFirstResizeHandleLeft(page: Page) {
	const handle = page.locator('[data-panel-resize-handle-id]').first();
	if (await handle.count() === 0) return 'no-handle';
	const box = await handle.boundingBox();
	if (!box) return 'no-box';
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(Math.max(8, box.x - 260), box.y + box.height / 2, { steps: 8 });
	await page.mouse.up();
	return 'dragged';
}

async function dragLastResizeHandleRight(page: Page) {
	const handle = page.locator('[data-panel-resize-handle-id]').last();
	if (await handle.count() === 0) return 'no-handle';
	const box = await handle.boundingBox();
	if (!box) return 'no-box';
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(Math.min((page.viewportSize()?.width ?? 1366) - 8, box.x + 260), box.y + box.height / 2, { steps: 8 });
	await page.mouse.up();
	return 'dragged';
}

async function openPolicyPane(page: Page) {
	const policyButton = page.getByRole('button', { name: /^Policy$/i });
	if (await policyButton.count() > 0 && await policyButton.first().isVisible()) {
		await policyButton.first().click();
		return;
	}
	await page.getByRole('button', { name: /More tools/i }).click();
	await page.getByRole('button', { name: /^Policy$/i }).click();
}

test.describe.serial('Timetable panel UX recovery', () => {
	test.beforeEach(async ({ page }) => {
		await page.context().clearCookies();
		await loginAdmin(page);
	});

	test('simple and advanced panels stay readable without global overflow', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		await openTimetableSimple(page);
		const simpleShot = await screenshot(testInfo, page, 'simple-initial');
		await assertNoGlobalOverflow(page);

		await openTimetableAdvanced(page);
		const advancedShot = await screenshot(testInfo, page, 'advanced-initial');
		await assertNoGlobalOverflow(page);
		const leftRail = page.getByTestId('timetable-left-panel');
		const center = page.getByTestId('timetable-center-panel');
		const leftInitial = await assertLocalOverflowSafe(page, leftRail, 'advanced left rail');
		const centerInitial = await assertLocalOverflowSafe(page, center, 'advanced center panel');

		const resizeResult = await dragFirstResizeHandleLeft(page);
		await assertNoGlobalOverflow(page);
		const leftAfterResize = await assertLocalOverflowSafeWhenOpen(page, leftRail, 'advanced left rail after resize');
		const resizedShot = await screenshot(testInfo, page, 'advanced-left-minimum');
		const entry = page.locator('[data-timetable-entry="true"]').first();
		await expect(entry).toBeVisible({ timeout: 20_000 });
		await entry.click();
		const rightPanel = page.getByTestId('timetable-right-panel');
		await expect(rightPanel).toBeVisible({ timeout: 20_000 });
		const rightInitial = await assertLocalOverflowSafeWhenOpen(page, rightPanel, 'advanced right panel');
		const rightResizeResult = await dragLastResizeHandleRight(page);
		await assertNoGlobalOverflow(page);
		const rightAfterResize = await assertLocalOverflowSafeWhenOpen(page, rightPanel, 'advanced right panel after resize');
		const rightMinShot = await screenshot(testInfo, page, 'advanced-right-minimum');

		await attachArtifact(testInfo, 'panel-readability', {
			simpleShot,
			advancedShot,
			resizedShot,
			rightMinShot,
			resizeResult,
			rightResizeResult,
			leftInitial,
			centerInitial,
			leftAfterResize,
			rightInitial,
			rightAfterResize,
			viewport: page.viewportSize(),
		});
	});

	test('unresolved sessions are search-first, filterable, scrollable, and action-safe', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		const guard = await installReadOnlyGenerationGuard(page);
		await openTimetableAdvanced(page);
		await page.getByRole('button', { name: /Unassigned/i }).first().click();
		const searchPanel = page.getByTestId('generated-unassigned-search-panel');
		const searchInput = page.getByTestId('generated-unassigned-search');
		const resultCount = page.getByTestId('generated-unassigned-result-count');
		const list = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
		await expect(searchPanel).toBeVisible({ timeout: 20_000 });
		await expect(searchInput).toBeVisible();
		await expect(resultCount).toContainText(/Showing/i);
		await expect(list).toBeVisible({ timeout: 20_000 });

		const before = await list.evaluate((node) => ({ top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight }));
		await searchInput.fill('session');
		await expect(resultCount).toContainText(/Showing/i);
		await page.getByRole('button', { name: /Needs room/i }).click();
		await expect(resultCount).toContainText(/Showing/i);
		await list.evaluate((node) => { node.scrollTop = Math.min(180, node.scrollHeight - node.clientHeight); });
		const after = await list.evaluate((node) => ({ top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight }));
		expect(after.height, `Unresolved list needs real visible space. ${JSON.stringify(after)}`).toBeGreaterThan(180);
		if (after.scrollHeight > after.height + 40) {
			expect(after.top, `Unresolved list must scroll locally. before=${JSON.stringify(before)} after=${JSON.stringify(after)}`).toBeGreaterThanOrEqual(before.top);
		}

		const actionLabels = await page.getByTestId('generated-unassigned-card').locator('button').evaluateAll((buttons) =>
			buttons.map((button) => button.textContent?.trim() ?? '').filter(Boolean),
		);
		expect(
			actionLabels.some((label) => /Place session|Review room source|Fix teaching load|Still blocked/i.test(label)),
			`Rows must expose safe next-action labels. ${JSON.stringify(actionLabels)}`,
		).toBeTruthy();
		expect(actionLabels.join(' '), 'Missing-room rows must not rely only on generic Place session copy.').not.toMatch(/Choose teacher|Choose room|Assign teacher and room/i);
		const filteredShot = await screenshot(testInfo, page, 'unresolved-list-filtered');
		const details = page.getByTestId('generated-unassigned-card').getByRole('button', { name: /Details/i }).first();
		if (await details.count() > 0) {
			await details.click();
			await expect(page.getByText(/Why This Happened|Why this happened/i).first()).toBeVisible({ timeout: 15_000 });
		}
		const detailShot = await screenshot(testInfo, page, 'unresolved-detail-state');
		expect(guard.blockedWrites).toEqual([]);
		await attachArtifact(testInfo, 'unresolved-panel', { before, after, actionLabels, filteredShot, detailShot, viewport: page.viewportSize() });
	});

	test('policy pane exposes status and immediate-vs-next-generation impact copy', async ({ page }, testInfo) => {
		test.setTimeout(120_000);
		await openTimetableAdvanced(page);
		await openPolicyPane(page);
		const status = page.getByTestId('policy-status-chip');
		const impact = page.getByTestId('policy-impact-summary');
		await expect(status).toBeVisible({ timeout: 20_000 });
		await expect(status).toContainText(/Policy loaded|Policy saved|Policy unavailable/i);
		await expect(impact).toContainText(/Affects next generation/i);
		await expect(impact).toContainText(/Preview, placement, and swap checks/i);
		await assertNoGlobalOverflow(page);
		const panelMetrics = await assertLocalOverflowSafe(page, impact.locator('..'), 'policy content panel');
		const shot = await screenshot(testInfo, page, 'policy-pane');
		await attachArtifact(testInfo, 'policy-pane', { panelMetrics, shot, viewport: page.viewportSize() });
	});

	test('policy save/revert is reversible and workflows still open review surfaces', async ({ page }, testInfo) => {
		test.setTimeout(180_000);
		const guard = await installReadOnlyGenerationGuard(page);
		const fixture = await captureRuntimeFixture(page);
		test.skip(!fixture.schoolYearId, 'No active school year available for policy proof.');

		const policyUrl = `/api/v1/policies/scheduling/${SCHOOL_ID}/${fixture.schoolYearId}`;
		const originalResponse = await page.request.get(policyUrl);
		expect(originalResponse.ok(), `Policy must be readable: HTTP ${originalResponse.status()}`).toBeTruthy();
		const originalPayload = await originalResponse.json() as { policy: Record<string, unknown> };
		const originalPolicy = originalPayload.policy;
		const toggled = { ...originalPolicy, teacherMoveEnabled: !(originalPolicy.teacherMoveEnabled === true) };
		let reverted = false;
		try {
			const saveResponse = await page.request.put(policyUrl, { data: toggled, timeout: 20_000 });
			expect(saveResponse.ok(), `Temporary policy save must succeed: HTTP ${saveResponse.status()}`).toBeTruthy();
			const saved = await saveResponse.json() as { policy: { teacherMoveEnabled?: boolean } };
			expect(saved.policy.teacherMoveEnabled).toBe(toggled.teacherMoveEnabled);

			const revertResponse = await page.request.put(policyUrl, { data: originalPolicy, timeout: 20_000 });
			reverted = revertResponse.ok();
			expect(reverted, `Temporary policy revert must succeed: HTTP ${revertResponse.status()}`).toBeTruthy();
			const revertedPolicyResponse = await page.request.get(policyUrl, { timeout: 20_000 });
			expect(revertedPolicyResponse.ok(), `Reverted policy must be readable: HTTP ${revertedPolicyResponse.status()}`).toBeTruthy();
			const revertedPolicy = await revertedPolicyResponse.json() as { policy: { teacherMoveEnabled?: boolean } };
			expect(revertedPolicy.policy.teacherMoveEnabled).toBe(originalPolicy.teacherMoveEnabled);

			const placement = await openGeneratedPlacementReview(page);
			if (placement.status === 'opened') {
				await expect(placement.dialog!).toContainText(/Review generated placement/i);
				await page.keyboard.press('Escape');
			}
			const swap = await openOccupiedSwapReview(page);
			await expect(swap.dialog).toContainText(/Review occupied-slot swap/i);
			await page.keyboard.press('Escape');

			await openTimetableAdvanced(page);
			await page.getByRole('button', { name: /Plan before generating|Opening draft/i }).click();
			await expect(page.getByText(/Pre-Generation Draft|Start with Pre-Generation Draft|Pre-generation draft is empty/i).first()).toBeVisible({ timeout: 20_000 });
		} finally {
			if (!reverted) {
				const revertResponse = await page.request.put(policyUrl, { data: originalPolicy, timeout: 20_000 });
				reverted = revertResponse.ok();
			}
		}
		expect(reverted, 'Temporary policy change must be reverted.').toBeTruthy();
		expect(guard.blockedWrites, 'Workflow checks must not commit generation writes.').toEqual([]);
		await attachArtifact(testInfo, 'policy-reversible-proof', { fixture, reverted, blockedWrites: guard.blockedWrites });
	});
});
