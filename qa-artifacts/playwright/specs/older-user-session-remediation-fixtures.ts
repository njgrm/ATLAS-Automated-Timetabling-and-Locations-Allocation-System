import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin, openTaskDrawer, openTimetableAdvanced, openTimetableSimple } from './timetable-layout-helpers';

export const SCHOOL_ID = 1;
export const PHASE_0_ARTIFACT_ROOT = path.join(process.cwd(), 'qa-artifacts', 'older-user-session-remediation', 'phase-0');

export const OLDER_USER_TASKS = Object.freeze([
	{ id: 'T01', prompt: 'Is this school setup ready to continue? What would you fix first?', capability: 'Find readiness blockers' },
	{ id: 'T02', prompt: 'Find the class sections for this school year.', capability: 'Navigate to Sections' },
	{ id: 'T03', prompt: 'Find a subject that still needs attention.', capability: 'Find subject attention state' },
	{ id: 'T04', prompt: 'Find which teachers still need teaching-load work.', capability: 'Find teacher workload repair' },
	{ id: 'T05', prompt: 'Check whether rooms are ready for scheduling.', capability: 'Find room readiness' },
	{ id: 'T06', prompt: 'Look at the timetable and tell me what should happen next.', capability: 'Find next timetable action' },
	{ id: 'T07', prompt: 'Find a session that is not placed yet.', capability: 'Inspect unresolved sessions' },
	{ id: 'T08', prompt: 'Start placing one session, but do not save it.', capability: 'Preview placement and cancel' },
	{ id: 'T09', prompt: 'What do Can place, Can swap, Blocked, Warning, Occupied, and Current mean?', capability: 'Read grid-wide conflict guidance' },
	{ id: 'T10', prompt: 'Switch two occupied sessions, but stop before saving.', capability: 'Preview swap and cancel' },
	{ id: 'T11', prompt: 'Find the advanced tools, then return to the simple view.', capability: 'Reach advanced controls' },
	{ id: 'T12', prompt: 'You changed your mind. Leave safely without saving.', capability: 'Cancel risky actions safely' },
] as const);

export const COCKPIT_CAPABILITY_PARITY = Object.freeze([
	{ capability: 'Find readiness blockers', preservedBy: 'Dashboard readiness hub and repair links' },
	{ capability: 'Inspect unresolved sessions', preservedBy: 'Simple task drawer and generated queue' },
	{ capability: 'Preview placement and swap outcomes', preservedBy: 'Placement and swap review sheets' },
	{ capability: 'Read grid-wide conflict guidance', preservedBy: 'Grid cell status labels and Advanced guidance' },
	{ capability: 'Cancel risky actions', preservedBy: 'Escape/Cancel review surfaces' },
	{ capability: 'Reach advanced controls', preservedBy: 'Reversible Simple/Advanced toggle' },
	{ capability: 'Preserve Teaching Load ownership', preservedBy: 'Review surfaces without timetable teacher assignment' },
] as const);

export type FixtureSnapshot = {
		schoolId: number;
		schoolYearId: number | null;
		schoolYearLabel: string | null;
		source: string | null;
		stale: boolean | null;
		upstreamReachable: boolean | null;
		activeRunId: number | null;
		activeRunStatus: string | null;
		queueCount: number | null;
	};

export type WriteGuard = { blockedWrites: string[] };

export async function installReadOnlyGenerationGuard(page: Page): Promise<WriteGuard> {
	const blockedWrites: string[] = [];
	await page.route('**/api/v1/generation/**', async (route) => {
		const request = route.request();
		const method = request.method();
		const pathname = new URL(request.url()).pathname;
		const isPreview = pathname.endsWith('/preview') || pathname.endsWith('/swap/preview') || pathname.endsWith('/fix-suggestions');
		if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isPreview) {
			blockedWrites.push(`${method} ${pathname}`);
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'OLDER_USER_REMEDIATION_WRITE_BLOCKED' }),
			});
			return;
		}
		await route.continue();
	});
	return { blockedWrites };
}

export async function captureRuntimeFixture(page: Page): Promise<FixtureSnapshot> {
	const contextResponse = await page.request.get(`/api/v1/runtime/context?schoolId=${SCHOOL_ID}`);
	expect(contextResponse.ok(), `Runtime context must be readable: HTTP ${contextResponse.status()}`).toBeTruthy();
	const context = await contextResponse.json() as {
		activeSchoolYearId?: number;
		schoolYearLabel?: string | null;
		source?: string;
		stale?: boolean;
		upstream?: { reachable?: boolean };
	};
	const schoolYearId = Number.isFinite(context.activeSchoolYearId) ? Number(context.activeSchoolYearId) : null;
	let activeRunId: number | null = null;
	let activeRunStatus: string | null = null;
	let queueCount: number | null = null;
	if (schoolYearId !== null) {
		const runsResponse = await page.request.get(`/api/v1/generation/${SCHOOL_ID}/${schoolYearId}/runs?limit=20`);
		if (runsResponse.ok()) {
			const runsPayload = await runsResponse.json() as { runs?: Array<{ id?: number; status?: string }> };
			// Match the timetable resolver's reviewable-run behavior: a newer failed
			// attempt must not replace the latest completed schedule for this fixture.
			const firstRun = runsPayload.runs?.find((run) => run.status === 'COMPLETED') ?? runsPayload.runs?.[0];
			activeRunId = Number.isFinite(firstRun?.id) ? Number(firstRun?.id) : null;
			activeRunStatus = firstRun?.status ?? null;
			if (activeRunId !== null) {
				const detailResponse = await page.request.get(`/api/v1/generation/${SCHOOL_ID}/${schoolYearId}/runs/${activeRunId}`);
				if (detailResponse.ok()) {
					const detailPayload = await detailResponse.json() as { run?: { summary?: { unassignedCount?: number } } };
					const count = detailPayload.run?.summary?.unassignedCount;
					queueCount = Number.isFinite(count) ? Number(count) : null;
				}
			}
		}
	}
	return {
		schoolId: SCHOOL_ID,
		schoolYearId,
		schoolYearLabel: context.schoolYearLabel ?? null,
		source: context.source ?? null,
		stale: context.stale ?? null,
		upstreamReachable: context.upstream?.reachable ?? null,
		activeRunId,
		activeRunStatus,
		queueCount,
	};
}

export async function openSimpleTask(page: Page, taskName: RegExp | string) {
	await openTimetableSimple(page);
	return openTaskDrawer(page, taskName);
}

export async function openAdvancedTask(page: Page, taskName: RegExp | string) {
	await openTimetableAdvanced(page);
	await page.getByRole('button', { name: taskName }).first().click();
	return page.getByTestId('timetable-task-drawer');
}

export type PlacementProbe = {
		status: 'opened' | 'fixture-unavailable';
		reason?: string;
		dialog?: Locator;
		invokingIdentity?: string;
};

export async function openGeneratedPlacementReview(page: Page): Promise<PlacementProbe> {
	const drawer = await openSimpleTask(page, /Place unresolved sessions/i);
	const currentTray = drawer.getByTestId('simple-current-session-card');
	const legacyRail = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
	const firstCard = await currentTray.isVisible({ timeout: 2_000 }).catch(() => false)
		? currentTray
		: legacyRail.getByTestId('generated-unassigned-card').first();
	await expect(firstCard).toBeVisible({ timeout: 20_000 });
	const action = firstCard.getByRole('button', { name: /^(Place|Choose room|Place session|Review room source|Fix owner|Fix teaching load|Review blocker)$/i }).first();
	await expect(action).toBeVisible({ timeout: 15_000 });
	const label = (await action.innerText()).trim();
	if (!/^(Place|Choose room|Place session|Review room source)$/i.test(label)) return { status: 'fixture-unavailable', reason: `First item is not place-capable: ${label}` };
	const invokingIdentity = `phase-0-placement-${Date.now()}`;
	await action.evaluate((element, value) => element.setAttribute('data-phase-0-focus-id', value), invokingIdentity);
	await action.click();
	await expect(page.locator('[data-cell-preview-label]').first()).toBeVisible({ timeout: 15_000 });
	const target = page.locator('td[data-day][data-start-time][data-end-time]').first();
	await expect(target).toBeVisible({ timeout: 15_000 });
	await target.click({ position: { x: 8, y: 8 } });
	const dialog = page.getByTestId('generated-placement-review-dialog');
	await expect(dialog).toBeVisible({ timeout: 15_000 });
	return { status: 'opened', dialog, invokingIdentity };
}

export async function openOccupiedSwapReview(page: Page): Promise<{ dialog: Locator; invokingIdentity: string }> {
	await openTimetableSimple(page);
	const entries = page.locator('[data-timetable-entry="true"]');
	await expect(entries.nth(0)).toBeVisible({ timeout: 20_000 });
	await entries.nth(0).click();
	const invokingIdentity = `phase-0-swap-${Date.now()}`;
	await entries.nth(1).evaluate((element, value) => element.setAttribute('data-phase-0-focus-id', value), invokingIdentity);
	await entries.nth(1).click();
	const dialog = page.getByRole('dialog').filter({ hasText: /Review occupied-slot swap/i });
	await expect(dialog).toBeVisible({ timeout: 20_000 });
	return { dialog, invokingIdentity };
}

export type FocusProbe = {
		invokingIdentity: string | null;
		firstDialogFocus: string | null;
		tabSequence: string[];
		restoredIdentity: string | null;
		restoredToInvoker: boolean;
};

async function activeIdentity(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		const element = document.activeElement as HTMLElement | null;
		if (!element || element === document.body) return null;
		return element.getAttribute('data-phase-0-focus-id')
			?? element.getAttribute('data-testid')
			?? element.getAttribute('aria-label')
			?? element.textContent?.trim().slice(0, 80)
			?? element.tagName;
	});
}

export async function probeDialogFocus(page: Page, dialog: Locator, invokingIdentity: string, _task: string): Promise<FocusProbe> {
	const firstDialogFocus = await activeIdentity(page);
	const tabSequence: string[] = [];
	for (let index = 0; index < 3; index += 1) {
		await page.keyboard.press('Tab');
		tabSequence.push((await activeIdentity(page)) ?? '(none)');
	}
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden({ timeout: 10_000 });
	const restoredIdentity = await activeIdentity(page);
	return {
		invokingIdentity,
		firstDialogFocus,
		tabSequence,
		restoredIdentity,
		restoredToInvoker: restoredIdentity === invokingIdentity,
	};
}

export type ScrollProbe = {
		viewport: { clientHeight: number; scrollHeight: number; scrollTop: number };
		programmaticScrollTop: number;
		mouseWheelScrollTop: number | null;
		touchGestureStatus: 'supported-and-passed' | 'unsupported-by-runner' | 'not-required';
		note: string;
};

export async function probeQueueScroll(page: Page): Promise<ScrollProbe> {
	const taskDrawer = page.getByTestId('timetable-task-drawer');
	const legacyRail = page.locator('[data-virtualized-rail="Unassigned generated sessions"]');
	const list = await taskDrawer.isVisible({ timeout: 2_000 }).catch(() => false) ? taskDrawer : legacyRail;
	await expect(list).toBeVisible({ timeout: 15_000 });
	const simpleRow = list.locator('[data-simple-plotting-row="true"]').first();
	const legacyRow = list.locator('[role="listitem"]').first();
	const firstRow = await simpleRow.isVisible({ timeout: 2_000 }).catch(() => false) ? simpleRow : legacyRow;
	await expect(firstRow).toBeVisible({ timeout: 15_000 });
	const viewport = await list.evaluate((node) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }));
	let mouseWheelScrollTop: number | null = null;
	if (page.viewportSize()?.width && page.viewportSize()!.width > 1024) {
		const box = await list.boundingBox();
		if (box) {
			await page.keyboard.press('Escape');
			await list.hover();
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.wheel(0, Math.max(240, Math.floor(box.height * 0.75)));
			await page.waitForTimeout(250);
		}
		mouseWheelScrollTop = await list.evaluate((node) => node.scrollTop);
	}
	const programmaticScrollTop = await list.evaluate((node) => {
		node.scrollTop = Math.min(600, Math.max(0, node.scrollHeight - node.clientHeight));
		return node.scrollTop;
	});
	const touchSupported = await page.evaluate(() => navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
	return {
		viewport,
		programmaticScrollTop,
		mouseWheelScrollTop,
		touchGestureStatus: page.viewportSize()?.width && page.viewportSize()!.width <= 1024
			? 'unsupported-by-runner'
			: 'not-required',
		note: page.viewportSize()?.width && page.viewportSize()!.width <= 1024
			? (touchSupported ? 'Touch capability is advertised, but Playwright touchscreen has no swipe API; programmatic scroll is diagnostic only.' : 'Touch capability is not advertised in this browser project; programmatic scroll is diagnostic only.')
			: 'Desktop wheel gesture is available and measured; mobile touch remains a Phase 4 device/proxy gate.',
	};
}

export async function attachPhase0Artifact(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(PHASE_0_ARTIFACT_ROOT, { recursive: true });
	const filePath = path.join(PHASE_0_ARTIFACT_ROOT, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
	return filePath;
}

export { assertNoGlobalOverflow, loginAdmin };
