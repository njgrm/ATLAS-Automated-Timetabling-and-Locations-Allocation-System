import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * TL-RR01 isolated carry-forward UI QA.
 *
 * Every API request is mocked in-process, so this spec is fully isolated from
 * the live runtime and can never perform a live Teaching Load apply. It covers
 * source selection, preview/reason review, cancel, error, empty,
 * partial-target, and the no-live-apply guarantee at 1280x720 and 390x844.
 */

type PreviewBehavior = { status: number; body: unknown };

let previewBehavior: PreviewBehavior = { status: 200, body: {} };

const ROLLOVER_STATUS = {
	schoolId: 1,
	atlasSchoolYearId: 9,
	enrollProActiveYear: { id: 9, yearLabel: '2029-2030' },
	drift: {
		status: 'aligned',
		message: 'Aligned with EnrollPro.',
		recommendedAction: 'NONE',
		atlasSchoolYearId: 9,
		enrollProSchoolYearId: 9,
		enrollProSchoolYearLabel: '2029-2030',
		mirrorSyncedAt: '2026-06-01T00:00:00.000Z',
	},
	mirror: null,
	counts: { facultyCount: 10, sectionCount: 20, settingsReachable: true },
	conflicts: [],
	reconfiguredSections: [],
	automation: null,
	canResetDummyYear: false,
	resetTargetSchoolYearId: null,
	conflictingRecordCounts: null,
	teachingLoadResetRequired: false,
	publishedResetBlocked: false,
	archivedYears: [
		{
			enrollProSchoolYearId: 8,
			yearLabel: '2028-2029',
			archivedAt: '2026-06-01T00:00:00.000Z',
			archivedBy: 1,
			archiveReason: 'Rollover',
			preservedCounts: { teachingLoadOwnerships: 12 },
		},
	],
};

function carryForwardPreview(overrides: Record<string, unknown> = {}) {
	const base = {
		schemaVersion: 'TL-RR01.1',
		schoolId: 1,
		actorSchoolId: 1,
		fingerprint: 'FINGERPRINT',
		sourceRevision: 'SOURCE',
		targetRevision: 'TARGET',
		derivedDemandRevision: 'DEMAND',
		generatedAt: '2026-09-11T00:00:00.000Z',
		sourceYear: { mirrorId: 8, enrollProSchoolYearId: 8, yearLabel: '2028-2029', isActive: false, isArchived: true, cycle: { state: 'POPULATED', version: 3, ownershipCount: 4 } },
		targetYear: { mirrorId: 9, enrollProSchoolYearId: 9, yearLabel: '2029-2030', isActive: true, isArchived: false, cycle: { state: 'EMPTY', version: 0, ownershipCount: 0 } },
		workloadPolicy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, status: 'CONFIGURED' },
		totals: { EXACT_CARRY: 2, ALREADY_OCCUPIED: 1, MISSING_FACULTY: 1, MISSING_SECTION: 0, NO_CURRENT_DEMAND: 0, UNQUALIFIED: 0, CAP_BLOCKED: 0, AMBIGUOUS: 0, OTHER: 0 },
		totalsSummary: { sourceRows: 4, carried: 2, skipped: 2 },
		before: { ownershipCount: 1, demandCount: 10, distribution: { zeroLoad: 3, adviserOnly: 1, belowStandard: 2, atStandard: 0, excess: 0, overCap: 0 } },
		after: {
			distribution: { zeroLoad: 1, adviserOnly: 0, belowStandard: 4, atStandard: 0, excess: 0, overCap: 0 },
			overloadChanges: [{ facultyId: 11, name: 'Cruz, Ana', beforeMinutes: 0, afterMinutes: 240, beforeStatus: 'zero-load', afterStatus: 'below-standard', changed: true }],
		},
		perDepartment: [{ department: 'MATH', carry: 2, skipped: 1 }, { department: 'Unassigned', carry: 0, skipped: 1 }],
		adviserCoverage: { satisfied: 1, unsatisfied: 0, outcomes: [] },
		rows: [
			{ sourceOwnershipId: 1, sourceFacultyExternalId: 7001, sourceSubjectCode: 'MATH', sourceSectionExternalId: 1101, reason: 'EXACT_CARRY', action: 'CARRY', targetSubjectCode: 'MATH', targetSectionExternalId: 2101, targetSectionKey: '7:REGULAR:SAMPAGUITA', targetFacultyId: 11, targetFacultyName: 'Cruz, Ana', targetDepartment: 'MATH', weeklyMinutes: 240, detail: null },
			{ sourceOwnershipId: 2, sourceFacultyExternalId: 7002, sourceSubjectCode: 'ENG', sourceSectionExternalId: 1102, reason: 'EXACT_CARRY', action: 'CARRY', targetSubjectCode: 'ENG', targetSectionExternalId: 2102, targetSectionKey: '7:REGULAR:NARRA', targetFacultyId: 12, targetFacultyName: 'Reyes, Bo', targetDepartment: 'ENG', weeklyMinutes: 240, detail: null },
			{ sourceOwnershipId: 3, sourceFacultyExternalId: 7003, sourceSubjectCode: 'MATH', sourceSectionExternalId: 1103, reason: 'ALREADY_OCCUPIED', action: 'SKIP', targetSubjectCode: 'MATH', targetSectionExternalId: 2103, targetSectionKey: '7:REGULAR:RIZAL', targetFacultyId: 13, targetFacultyName: 'Santos, Cy', targetDepartment: 'MATH', weeklyMinutes: 240, detail: 'Occupied.' },
			{ sourceOwnershipId: 4, sourceFacultyExternalId: 7004, sourceSubjectCode: 'MATH', sourceSectionExternalId: 1104, reason: 'MISSING_FACULTY', action: 'SKIP', targetSubjectCode: 'MATH', targetSectionExternalId: 2104, targetSectionKey: '7:REGULAR:MABINI', targetFacultyId: null, targetFacultyName: null, targetDepartment: null, weeklyMinutes: 240, detail: 'Inactive.' },
		],
		confirmationText: 'APPLY TEACHING LOAD CARRY-FORWARD',
		zeroWriteProof: { preview: true, writes: 0 },
		authorizesMutation: false,
	};
	return { ...base, ...overrides };
}

async function installMocks(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.sessionStorage.setItem('atlas_local_token', 'test-token');
		window.localStorage.setItem(
			'atlas:session-user:v1',
			JSON.stringify({ cachedAt: new Date().toISOString(), user: { userId: 1, role: 'officer', schoolId: 1, email: 'admin@atlas.local', authSource: 'local' } }),
		);
	});
	await page.route(/\/api\/settings\/public/, async (route: Route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schoolName: 'ATLAS QA School', colorScheme: null, selectedAccentHsl: null }) });
	});
	await page.route(/\/api\/v1\//, async (route: Route) => {
		const request = route.request();
		const url = request.url();
		if (request.method().toUpperCase() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
			return;
		}
		if (url.includes('/auth/me')) {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { userId: 1, role: 'officer', schoolId: 1, email: 'admin@atlas.local', authSource: 'local' } }) });
			return;
		}
		if (url.includes('/runtime/rollover-status')) {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROLLOVER_STATUS) });
			return;
		}
		if (url.includes('/teaching-load/carry-forward/preview')) {
			await route.fulfill({ status: previewBehavior.status, contentType: 'application/json', body: JSON.stringify(previewBehavior.body) });
			return;
		}
		if (url.includes('/teaching-load/carry-forward/apply')) {
			// The client must never call apply. Fail loudly if it does.
			await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'UNEXPECTED_APPLY', message: 'The carry-forward client attempted a live apply.' }) });
			return;
		}
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
	});
}

test.beforeEach(async ({ page }) => {
	previewBehavior = { status: 200, body: carryForwardPreview() };
	await installMocks(page);
});

test('source selection, preview/reason review, partial target, and no-live-apply at 1280x720', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/admin/year-setup');

	const panel = page.getByTestId('carry-forward-panel');
	await expect(panel).toBeVisible();
	await expect(page.getByTestId('carry-forward-source-select')).toContainText('2028-2029');

	await page.getByTestId('carry-forward-preview-button').click();
	await expect(page.getByTestId('carry-forward-summary')).toBeVisible();
	await expect(page.getByTestId('carry-forward-reason-EXACT_CARRY')).toContainText('Carry forward');
	await expect(page.getByTestId('carry-forward-reason-ALREADY_OCCUPIED')).toContainText('Already occupied');
	await expect(page.getByTestId('carry-forward-reason-MISSING_FACULTY')).toContainText('Owner unavailable');
	await expect(page.getByTestId('carry-forward-partial-target')).toContainText('already occupied and preserved');
	await expect(page.getByTestId('carry-forward-carried-rows')).toContainText('Cruz, Ana');
	await expect(page.getByTestId('carry-forward-no-live-apply')).toContainText('Apply is not available here');
	await expect(panel.getByRole('button', { name: /^apply/i })).toHaveCount(0);
});

test('cancel clears the preview at 1280x720', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/admin/year-setup');
	await page.getByTestId('carry-forward-preview-button').click();
	await expect(page.getByTestId('carry-forward-summary')).toBeVisible();
	await page.getByTestId('carry-forward-cancel').click();
	await expect(page.getByTestId('carry-forward-summary')).toHaveCount(0);
	await expect(page.getByTestId('carry-forward-no-live-apply')).toHaveCount(0);
});

test('error state surfaces the typed server message at 1280x720', async ({ page }) => {
	previewBehavior = { status: 409, body: { code: 'DERIVED_DEMAND_BLOCKED', message: 'Current demand authority is unavailable.' } };
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/admin/year-setup');
	await page.getByTestId('carry-forward-preview-button').click();
	await expect(page.getByTestId('carry-forward-error')).toContainText('Current demand authority is unavailable.');
	await expect(page.getByTestId('carry-forward-summary')).toHaveCount(0);
});

test('empty preview state is explicit at 390x844', async ({ page }) => {
	previewBehavior = { status: 200, body: carryForwardPreview({ totals: { EXACT_CARRY: 0, ALREADY_OCCUPIED: 0, MISSING_FACULTY: 0, MISSING_SECTION: 0, NO_CURRENT_DEMAND: 0, UNQUALIFIED: 0, CAP_BLOCKED: 0, AMBIGUOUS: 0, OTHER: 0 }, totalsSummary: { sourceRows: 0, carried: 0, skipped: 0 }, rows: [], perDepartment: [], before: { ownershipCount: 0, demandCount: 0, distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 } }, after: { distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 }, overloadChanges: [] } }) };
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/admin/year-setup');
	await page.getByTestId('carry-forward-preview-button').click();
	await expect(page.getByTestId('carry-forward-summary')).toContainText('No archived Teaching Load rows');
	await expect(page.getByTestId('carry-forward-no-rows')).toBeVisible();
	await expect(page.getByTestId('carry-forward-no-live-apply')).toBeVisible();
});

test('preview/reason review and no-live-apply at 390x844', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/admin/year-setup');
	await page.getByTestId('carry-forward-preview-button').click();
	await expect(page.getByTestId('carry-forward-summary')).toBeVisible();
	await expect(page.getByTestId('carry-forward-reason-EXACT_CARRY')).toBeVisible();
	await expect(page.getByTestId('carry-forward-no-live-apply')).toBeVisible();
	const panel = page.getByTestId('carry-forward-panel');
	await expect(panel.getByRole('button', { name: /^apply/i })).toHaveCount(0);
});
