import { expect, test, type Page, type Route } from '@playwright/test';

type RequestRecord = { method: string; path: string; query: string };

const SCHOOL_ID = 7;
const SCHOOL_YEAR_ID = 22;
const RUN_ID = 315;

const activeTerm = {
	source: 'enrollpro-verified',
	reachable: true,
	verified: true,
	activeTerm: 'Term 2',
	termIndex: 2,
	schoolYearId: SCHOOL_YEAR_ID,
	matchedSchoolYear: true,
	code: null,
	message: 'Term 2 is active in EnrollPro.',
	orderedTerms: [
		{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
		{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
		{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
	],
	termFormat: 'TRIMESTER',
	termCount: 3,
};

const runtimeContext = (term: typeof activeTerm | null) => ({
	schoolId: SCHOOL_ID,
	activeSchoolYearId: SCHOOL_YEAR_ID,
	activeSchoolYearLabel: '2031-2032',
	source: term ? 'enrollpro-verified' : 'atlas-persisted',
	stale: false,
	resolvedAt: '2026-09-22T00:00:00.000Z',
	evidence: [],
	upstream: { reachable: Boolean(term), verified: Boolean(term), matched: Boolean(term), activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2031-2032' },
	activeTerm: term,
	activeYearDrift: { status: 'aligned', message: 'Aligned.', recommendedAction: 'NONE', atlasSchoolYearId: SCHOOL_YEAR_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID, enrollProSchoolYearLabel: '2031-2032', mirrorSyncedAt: '2026-09-22T00:00:00.000Z' },
});

const entries = [1, 2, 3].map((termIndex) => ({
	entryId: `term-${termIndex}`,
	facultyId: 101,
	roomId: 201,
	subjectId: 301,
	sectionId: 401,
	day: 'MONDAY',
	startTime: '08:00',
	endTime: '08:50',
	durationMinutes: 50,
	termIndex,
	entryKind: 'SECTION' as const,
	programType: 'REGULAR',
	programCode: 'REG',
	programName: 'Regular',
}));

const draft = {
	runId: RUN_ID,
	status: 'COMPLETED',
	entries,
	unassignedItems: [],
	summary: {
	classesProcessed: 3,
	assignedCount: 3,
	unassignedCount: 0,
	policyBlockedCount: 0,
	hardViolationCount: 0,
	blockingHardViolationCount: 0,
	termCounts: { term1: 1, term2: 1, term3: 1 },
	},
	inputState: { status: 'FRESH', message: 'Fresh', actionHint: '', changedDomains: [], checkedAt: '2026-09-22T00:00:00.000Z' },
	version: 1,
	finishedAt: '2026-09-22T00:00:00.000Z',
	createdAt: '2026-09-22T00:00:00.000Z',
};

const runs = {
	runs: [{
		id: RUN_ID,
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		triggeredBy: 1,
		status: 'COMPLETED',
		startedAt: '2026-09-22T00:00:00.000Z',
		finishedAt: '2026-09-22T00:00:00.000Z',
		durationMs: 100,
		summary: draft.summary,
		error: null,
		createdAt: '2026-09-22T00:00:00.000Z',
		updatedAt: '2026-09-22T00:00:00.000Z',
	}],
};

const violations = { runId: RUN_ID, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {}, scope: 'RUN_WIDE', runWide: { total: 0, hard: 0, blockingHard: 0, soft: 0, byCode: {} } } };

function json(route: Route, body: unknown, status = 200): Promise<void> {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installLocalApi(page: Page, runtimeReady: Promise<void>, releaseRuntime: () => void, records: RequestRecord[], mutations: RequestRecord[], term: typeof activeTerm | null = activeTerm): Promise<void> {
	await page.addInitScript(() => {
		window.sessionStorage.setItem('atlas_local_token', 'qa-local-token');
		window.localStorage.removeItem('atlas:active-school-year-context:v3:7');
		window.localStorage.removeItem('atlas:session-user:v1');
	});
	await page.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const method = request.method().toUpperCase();
		const record = { method, path: url.pathname, query: url.search };
		if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
			mutations.push(record);
			await route.abort();
			return;
		}
		if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/enrollpro-api/')) {
			await route.continue();
			return;
		}
		records.push(record);
		if (url.pathname === '/api/v1/auth/me') {
			await json(route, { user: { userId: 1, role: 'admin', schoolId: SCHOOL_ID, email: 'qa@example.test', authSource: 'local' } });
			return;
		}
		if (url.pathname === '/api/v1/runtime/context') {
			await runtimeReady;
			await json(route, runtimeContext(term));
			releaseRuntime();
			return;
		}
		if (url.pathname === '/api/v1/runtime/rollover-status') {
			await json(route, { schoolId: SCHOOL_ID, atlasSchoolYearId: SCHOOL_YEAR_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: '2031-2032' }, drift: { status: 'aligned', message: 'Aligned.', recommendedAction: 'NONE', atlasSchoolYearId: SCHOOL_YEAR_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID, enrollProSchoolYearLabel: '2031-2032', mirrorSyncedAt: '2026-09-22T00:00:00.000Z' }, mirror: null, counts: { facultyCount: 1, sectionCount: 1, settingsReachable: true }, conflicts: [], reconfiguredSections: [], canResetDummyYear: false, resetTargetSchoolYearId: null, conflictingRecordCounts: null, teachingLoadResetRequired: false, publishedResetBlocked: false });
			return;
		}
		if (url.pathname === '/enrollpro-api/settings/public') {
			await json(route, { schoolName: 'ATLAS QA School', logoUrl: null, colorScheme: null, selectedAccentHsl: null, activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2031-2032' });
			return;
		}
		if (url.pathname.endsWith(`/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs`)) {
			await json(route, runs);
			return;
		}
		if (url.pathname.includes(`/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/readiness/diagnostic`)) {
			await json(route, { readiness: {} });
			return;
		}
		if (url.pathname.includes(`/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/`) && url.pathname.endsWith('/draft')) {
			const scope = url.searchParams.get('termIndex');
			await json(route, { ...draft, entries: scope ? entries.filter((entry) => String(entry.termIndex) === scope) : entries });
			return;
		}
		if (url.pathname.includes('/manual-edits')) { await json(route, { edits: [] }); return; }
		if (url.pathname.includes(`/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/`) && url.pathname.endsWith('/violations')) {
			await json(route, violations);
			return;
		}
		if (url.pathname.includes('/subjects')) { await json(route, { subjects: [{ id: 301, code: 'MATH', name: 'Mathematics', displayName: 'Mathematics' }] }); return; }
		if (url.pathname.includes('/faculty')) { await json(route, { faculty: [{ id: 101, firstName: 'Ana', lastName: 'Teacher', fullName: 'Ana Teacher' }] }); return; }
		if (url.pathname.includes('/buildings')) { await json(route, { buildings: [] }); return; }
		if (url.pathname.includes('/sections/summary')) { await json(route, { sections: [{ id: 401, name: 'Sampaguita', gradeLevel: 7, programType: 'REGULAR' }] }); return; }
		if (url.pathname.includes('/room-preferences/')) { await json(route, { runId: RUN_ID, counts: { total: 0, draft: 0, submitted: 0, pending: 0, approved: 0, rejected: 0 }, requests: [], runVersion: 1 }); return; }
		if (url.pathname.includes('/pre-generation-drafts')) {
			await json(route, {
				placements: [],
				queue: [],
				periodSlots: [],
				counts: { draft: 0, lockedForRun: 0, archived: 0, unscheduled: 0 },
				filters: { grades: [], departments: [], buildings: [] },
			});
			return;
		}
		if (url.pathname.includes('/follow-up-flags/')) { await json(route, { flags: [] }); return; }
		await json(route, {});
	});
}

function protectedTimetableRead(request: RequestRecord): boolean {
	return request.path.includes('/generation/')
		|| request.path.includes('/subjects')
		|| request.path.includes('/faculty')
		|| request.path.includes('/buildings')
		|| request.path.includes('/sections')
		|| request.path.includes('/room-preferences')
		|| request.path.includes('/pre-generation-drafts')
		|| request.path.includes('/follow-up-flags')
		|| request.path.includes('/manual-edits');
}

test('real timetable lifecycle waits for verified term, defaults to Term 2, and expands All Terms without writes', async ({ page }) => {
	const records: RequestRecord[] = [];
	const mutations: RequestRecord[] = [];
	let releaseRuntime!: () => void;
	const runtimeGate = new Promise<void>((resolve) => { releaseRuntime = resolve; });
	await installLocalApi(page, runtimeGate, releaseRuntime, records, mutations);
	await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(250);
	const earlyTimetableReads = records.filter(protectedTimetableRead);
	expect(earlyTimetableReads, 'No timetable/reference reads may occur before term authority resolves').toEqual([]);
	releaseRuntime();
	await expect(page.getByTestId('timetable-simple-term-filter')).toHaveAttribute('data-term-filter', '2');
	await expect(page.getByTestId('timetable-simple-term-filter')).toContainText('Term 2');
	const initialTimetableReads = records.filter((request) => request.path.includes('/generation/'));
	expect(initialTimetableReads.length).toBeGreaterThan(0);
	expect(initialTimetableReads.some((request) => request.query.includes('termIndex=all'))).toBeFalsy();
	await expect(page.locator('[data-timetable-entry-id="term-2"]')).toHaveCount(1);
	await expect(page.locator('[data-timetable-entry-id="term-1"]')).toHaveCount(0);
	await expect(page.locator('[data-timetable-entry-id="term-3"]')).toHaveCount(0);
	await expect(page.getByText('Loading run data...', { exact: true })).toHaveCount(0);

	await page.getByTestId('timetable-simple-term-filter').click();
	const allTermsOption = page.locator('[role="option"]').filter({ hasText: /^All terms$/ });
	await allTermsOption.scrollIntoViewIfNeeded();
	const allTermsBox = await allTermsOption.boundingBox();
	expect(allTermsBox).not.toBeNull();
	await page.mouse.click(allTermsBox!.x + allTermsBox!.width / 2, allTermsBox!.y + allTermsBox!.height / 2);
	await expect(page.getByTestId('timetable-simple-term-filter')).toHaveAttribute('data-term-filter', 'all');
	await expect.poll(() => page.locator('[data-timetable-entry-id]').count()).toBe(3);
	await expect(page.locator('[data-timetable-entry-id="term-1"]')).toBeVisible();
	await expect(page.locator('[data-timetable-entry-id="term-2"]')).toBeVisible();
	await expect(page.locator('[data-timetable-entry-id="term-3"]')).toBeVisible();
	await expect(page.getByTestId('timetable-cell-overflow-trigger')).toHaveCount(0);
	expect(mutations, `Unexpected non-GET request(s): ${JSON.stringify(mutations)}`).toEqual([]);
});

test('real /timetable blocks missing EnrollPro term authority with bounded guidance and zero timetable reads', async ({ page }) => {
	const records: RequestRecord[] = [];
	const mutations: RequestRecord[] = [];
	let releaseRuntime!: () => void;
	const runtimeGate = new Promise<void>((resolve) => { releaseRuntime = resolve; });
	await installLocalApi(page, runtimeGate, releaseRuntime, records, mutations, null);
	await page.goto('/timetable', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(250);
	// The authority response is deliberately held first, then resolves without an active term.
	releaseRuntime();
	await expect(page.getByText('Term setup is required before the timetable can be loaded.', { exact: true })).toBeVisible();
	await page.waitForTimeout(500);
	const protectedReads = records.filter(protectedTimetableRead);
	expect(protectedReads, `Missing/unverified term authority must not read timetable data: ${JSON.stringify(protectedReads)}`).toEqual([]);
	expect(mutations, `Unexpected non-GET request(s): ${JSON.stringify(mutations)}`).toEqual([]);
});
