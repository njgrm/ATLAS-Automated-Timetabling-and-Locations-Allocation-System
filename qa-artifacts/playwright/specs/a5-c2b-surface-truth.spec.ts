import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * A5-C2B / SLICE B — ISOLATED rendered-UI evidence for
 * `docs/reviews/codex-demo-walk-20260928` items 4, 5, 6 and 7.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISOLATED — NOT ATLAS ACCEPTANCE (AGENTS.md §12).
 * These rows run against a **loopback preview of this candidate's own built
 * client** at `http://127.0.0.1:5205` (see
 * `playwright.a5-c2b-surface-truth.config.ts`), with **every `/api/v1/**`
 * request mocked in-process**. Nothing here reaches the live runtime, the shared
 * 5001/5174 listeners, or a database. The ATLAS origin is
 * `https://njgrm.buru-degree.ts.net`; a loopback origin is a different origin
 * and asserting it proves nothing about ATLAS acceptance. The session is seeded
 * with a FAKE token through `addInitScript` — no credential is typed, echoed,
 * or logged.
 *
 * WHY THIS SPEC IS THE DECISIVE EVIDENCE, NOT A SUPPLEMENT. The A5-C2A lesson
 * is that a source-text row passed while the rendered page still showed the
 * defect it claimed to have fixed. Every assertion below is therefore a
 * MEASURED, RENDERED value: real bounding boxes, real computed styles, real
 * `innerText` of the element the operator looked at, and real console output.
 * No row asserts a class list or a source string.
 *
 * THE VIEWPORT IS THE OPERATOR'S: 1366x768, the size the demo walk used and the
 * size the report's clipping defects were observed at.
 *
 * NO WRITES: any `POST`/`PUT`/`PATCH`/`DELETE` to `/api/v1/**` is fulfilled with
 * `500 UNEXPECTED_MUTATION` and recorded, and the final row asserts the recorded
 * list is empty. The browser never attempts a write.
 */

// ───────────────────────────────── fixtures ─────────────────────────────────

const AUTH_USER = { user: { userId: 1, role: 'officer', schoolId: 1, email: 'a5c2b@atlas.local', authSource: 'local' } };

const RUNTIME_CONTEXT = {
	schoolId: 1,
	activeSchoolYearId: 9,
	activeSchoolYearLabel: '2026-2027',
	source: 'enrollpro-verified',
	stale: false,
	resolvedAt: '2026-09-28T00:00:00.000Z',
	evidence: [],
	upstream: { reachable: true, verified: true, matched: true, activeSchoolYearId: 9, activeSchoolYearLabel: '2026-2027' },
};

const ENROLLPRO_SETTINGS = {
	schoolName: 'ATLAS A5C2B School',
	logoUrl: null,
	colorScheme: null,
	selectedAccentHsl: null,
	activeSchoolYearId: 9,
	activeSchoolYearLabel: '2026-2027',
};

const TERM_AUTHORITY = {
	state: 'VERIFIED_LIVE',
	source: 'enrollpro',
	degraded: false,
	code: null,
	message: null,
	contract: {
		format: 'TRIMESTER',
		schoolYear: { yearLabel: '2026-2027' },
		terms: [
			{ identity: 'T1', displayLabel: 'Term 1' },
			{ identity: 'T2', displayLabel: 'Term 2' },
			{ identity: 'T3', displayLabel: 'Term 3' },
		],
		activeTerm: { identity: 'T1' },
	},
};

/**
 * THE FIXTURE IS THE REPORT'S OWN OBSERVATION, LITERALLY.
 *
 * The walk recorded raw operations/IDs in "recent notices": `MOVE_ENT...` and
 * `entry-321::t2`. Those are STORED values — `toNotificationRow` writes
 * `title: event.message.slice(0, 200)`, so every row persisted before the
 * A2-TIMETABLE-CUSTODY message builder landed still carries them, and no server
 * change rewrites a record. §11 is explicit that a control's fixture must come
 * from the real surface: an invented `Something happened` row would pass while
 * the operator's actual row still leaked.
 *
 * The first row is the legacy shape the operator saw (`data: null`, title IS the
 * internal token). The second is a well-formed row carrying the REAL
 * `data` metadata column, which is what the readable summary is built from. The
 * third is a long notice, which is what the popover used to hard-clip.
 *
 * THE METADATA HERE IS COPIED FROM THE PRODUCERS, NOT INVENTED. An earlier
 * revision of this fixture carried `subjectCode`/`sectionName`/`facultyName`/
 * `requestedRoomName`/`day`/`startTime`/`endTime` and this spec passed — while
 * no producer writes a single one of them and every real row collapsed to the
 * unnamed fallback. The real shapes are `room-preference.service.ts:737-745`
 * (an id, an action, a day, a time window, an entry id, a status) and
 * `manual-edit.service.ts:1433-1438` (an edit id, an edit type, an entry id, a
 * term index). The second row below is the first of those, verbatim.
 */
const INBOX_ITEMS = [
	{
		id: 900,
		type: 'TIMETABLE_EDIT_COMMITTED',
		title: 'MOVE_ENTRY entry-321::t2',
		body: null,
		domain: 'timetable',
		severity: 'info',
		resourceType: 'timetable',
		resourceId: 'run-7',
		read: false,
		createdAt: '2026-09-28T01:02:03.000Z',
		data: null,
	},
	{
		id: 901,
		type: 'ROOM_REQUEST_SUBMITTED',
		title: 'Teacher submitted a room request for review.',
		body: null,
		domain: 'room-preference',
		severity: 'info',
		resourceType: 'timetable',
		resourceId: 'run-7',
		read: true,
		createdAt: '2026-09-28T02:10:00.000Z',
		// `room-preference.service.ts:737-745` verbatim, plus the three keys
		// `notification-events.service.ts:250-255` injects in transit.
		data: {
			requestedRoomId: 12,
			actionType: 'ROOM_CHANGE',
			targetDay: 'MONDAY',
			targetStartTime: '07:30',
			targetEndTime: '08:30',
			targetEntryId: 'entry-321',
			status: 'SUBMITTED',
			runId: 7,
			requestId: 41,
			entryId: 'entry-321',
		},
	},
	{
		id: 902,
		type: 'TIMETABLE_SWAP_COMMITTED',
		title:
			'Manual swap committed: Earth Science and Filipino exchanged their times between MONDAY 07:30-08:30 and TUESDAY 09:00-10:00 for the senior high block, and one of them was also relocated to a different time.',
		body: 'Recorded by the timetable concurrent-commit path during a batched save from the Advanced workspace.',
		domain: 'timetable',
		severity: 'info',
		resourceType: 'timetable',
		resourceId: 'run-7',
		read: true,
		createdAt: '2026-09-28T03:00:00.000Z',
		// `data: null` ON PURPOSE. This row exists to measure the CLIP, and the
		// length that used to be clipped is the STORED MESSAGE, not the summary
		// built from metadata (a metadata-bearing row summarises to one short
		// line — see row 901). Giving it invented metadata would have made it
		// stop measuring what the report measured.
		data: null,
	},
];

function subjectFixture(overrides: Record<string, unknown>) {
	return {
		id: 41,
		schoolId: 1,
		code: 'SCI10',
		displayCode: 'SCI10',
		name: 'Earth Science',
		ownerDepartment: 'MAPEH',
		allowedOwnerDepartments: [],
		gradeLevels: [9, 10],
		programType: 'REGULAR',
		minMinutesPerWeek: 225,
		preferredRoomType: 'LABORATORY',
		isActive: true,
		programScopes: ['REGULAR'],
		allowedSpecializations: [],
		// THE REPORT'S OWN LEAK: `OWNER_DEPT:MAPEH` — a code the DepEd glossary
		// cannot expand, so on base the row rendered the stored marker itself.
		// `LAB_BENCH` is a real room feature, present so the two are separated.
		requiredFeatures: ['OWNER_DEPT:MAPEH', 'LAB_BENCH'],
		createdAt: '2026-09-01T00:00:00.000Z',
		updatedAt: '2026-09-28T00:00:00.000Z',
		...overrides,
	};
}

const SUBJECTS = [
	subjectFixture({}),
	subjectFixture({ id: 42, code: 'FIL10', name: 'Filipino', gradeLevels: [7, 8], preferredRoomType: 'CLASSROOM', requiredFeatures: ['OWNER_DEPT:AP'] }),
	// The remaining rows exist for ONE reason, stated plainly: WIDTH. With two
	// short rows the six-column table fits inside 1366px and the operator's
	// clipping is not reproduced at all — a geometry row that passes on the base
	// build proves nothing. The demo walk's live catalog has long subject names
	// and long department phrases, and those are what push the Action column past
	// the right edge. These rows reproduce that width, so the row below actually
	// discriminates instead of passing vacuously.
	subjectFixture({ id: 43, code: 'EDP10', name: 'Edukasyon sa Pagpapakatao (EsP) - Grade 10', gradeLevels: [9, 10], preferredRoomType: 'COMPUTER_LAB', requiredFeatures: ['OWNER_DEPT:ESP', 'COMPUTER_SET'] }),
	subjectFixture({ id: 44, code: 'LTE10', name: 'Technology and Livelihood Education - Entrepreneurship', gradeLevels: [8, 9, 10], preferredRoomType: 'COMPUTER_LAB', requiredFeatures: ['OWNER_DEPT:TLE', 'WORKSHOP_BENCH', 'TOOL_CAGE'] }),
	subjectFixture({ id: 45, code: 'MATH10', name: 'Mathematics - General Mathematics', gradeLevels: [10], preferredRoomType: 'CLASSROOM', requiredFeatures: ['OWNER_DEPT:MATH', 'PROJECTOR'] }),
];

const AUDIT_FACULTY = [
	{
		id: 7,
		externalId: 7007,
		lastName: 'FERNANDEZ',
		firstName: 'JANELLA MARIE',
		department: 'SCI',
		specialization: null,
		isActiveForScheduling: true,
		isPlaceholder: false,
		isClassAdviser: false,
		maxHoursPerWeek: 40,
		departmentCode: 'SCI',
		departmentLabel: 'Science',
		version: 1,
		subjectCount: 2,
		sectionCount: 3,
		assignedGradeLevels: [9, 10],
		// 22.6h of 40h = 56.5% — the report's 56.6% ballpark, so the rendered
		// verdict is exercised in the band the operator actually saw.
		policyCreditedHours: 22.6,
		policyLoadPercentage: 57,
		loadPercentage: 57,
		actualTeachingHours: 22.6,
		assignments: [],
	},
	{
		id: 8,
		externalId: 7008,
		lastName: 'SANTOS',
		firstName: 'MIGUEL',
		department: 'SCI',
		specialization: null,
		isActiveForScheduling: true,
		isPlaceholder: false,
		isClassAdviser: false,
		maxHoursPerWeek: 40,
		departmentCode: 'SCI',
		departmentLabel: 'Science',
		version: 1,
		subjectCount: 1,
		sectionCount: 1,
		assignedGradeLevels: [7],
		policyCreditedHours: 22.6,
		policyLoadPercentage: 56,
		loadPercentage: 56,
		actualTeachingHours: 22.6,
		assignments: [],
	},
];

/** Every write the page attempted, in order. Must stay empty. */
const attemptedMutations: string[] = [];

/**
 * Every `/api/v1/**` or `/enrollpro-api/**` request that reached the catch-all
 * with no explicit fixture, i.e. was answered with a bare `{}`. Answering `{}`
 * lets a component shrug and the row still pass, which is how a row can go green
 * because a fetch FAILED rather than because the fix worked. Recorded, and
 * asserted empty at the end, so the isolation claim is measured.
 */
const unmockedRequests: string[] = [];

const consoleErrors: string[] = [];

async function installMocks(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.sessionStorage.setItem('atlas_local_token', 'a5c2b-isolated-fake-token');
		window.localStorage.setItem(
			'atlas:session-user:v1',
			JSON.stringify({
				cachedAt: new Date().toISOString(),
				user: { userId: 1, role: 'officer', schoolId: 1, email: 'a5c2b@atlas.local', authSource: 'local' },
			}),
		);
	});

	// The row gate: an unhandled error, a failed fetch, or a React error
	// boundary reaching the console fails the run rather than being logged.
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(`[${page.url()}] ${message.text()}`);
	});
	page.on('pageerror', (error) => {
		consoleErrors.push(`[${page.url()}] pageerror: ${error.message}`);
	});

	await page.route(/\/api\/settings\/public/, async (route: Route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schoolName: 'ATLAS A5C2B School' }) });
	});

	await page.route(/\/enrollpro-api\//, async (route: Route) => {
		const path = route.request().url().replace(/^https?:\/\/[^/]+/, '');
		if (path.startsWith('/enrollpro-api/settings/public')) {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ENROLLPRO_SETTINGS) });
			return;
		}
		if (path.startsWith('/enrollpro-api/school-years')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ years: [{ id: 9, yearLabel: '2026-2027', status: 'ACTIVE', isActive: true }] }),
			});
			return;
		}
		unmockedRequests.push(`GET ${path}`);
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
	});

	await page.route(/\/api\/v1\//, async (route: Route) => {
		const request = route.request();
		const url = request.url();
		const method = request.method().toUpperCase();
		if (method === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
			return;
		}
		/**
		 * ONE exception to "no writes", declared rather than smuggled.
		 *
		 * `createRoomPreferenceCollaborationSocket` fetches a short-lived
		 * connection TICKET with a POST (`roomPreferenceCollaboration.ts:55`).
		 * It is a read — it mints a credential and changes no ATLAS record — but
		 * it is the one place on these routes where a read arrives by POST, so
		 * it is answered HERE, above the mutation gate, with that reason stated.
		 * Every other non-GET/HEAD still fails loudly and is recorded, and the
		 * ISO row still asserts the recorded list is empty.
		 */
		if (url.includes('/room-preferences/collaboration/ticket')) {
			if (method !== 'POST') {
				unmockedRequests.push(`${method} ${url} :: the collaboration ticket must be fetched with POST`);
				return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
			}
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ticket: 'a5c2b-isolated-ws-ticket', expiresAt: '2099-01-01T00:00:00.000Z' }),
			});
		}
		if (method !== 'GET' && method !== 'HEAD') {
			attemptedMutations.push(`${method} ${url}`);
			await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'UNEXPECTED_MUTATION' }) });
			return;
		}

		const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

		if (url.includes('/auth/me')) return json(AUTH_USER);
		if (url.includes('/runtime/context')) return json(RUNTIME_CONTEXT);
		if (url.includes('/runtime/rollover-status')) {
			return json({
				schoolId: 1,
				atlasSchoolYearId: 9,
				enrollProActiveYear: { id: 9, yearLabel: '2026-2027' },
				drift: { status: 'aligned', message: 'Aligned with EnrollPro.', recommendedAction: 'NONE', mirrorSyncedAt: '2026-09-01T00:00:00.000Z' },
				mirror: null,
				counts: { facultyCount: 2, sectionCount: 3, settingsReachable: true },
				conflicts: [],
				reconfiguredSections: [],
				automation: null,
				canResetDummyYear: false,
				resetTargetSchoolYearId: null,
				conflictingRecordCounts: null,
				teachingLoadResetRequired: false,
				publishedResetBlocked: false,
				archivedYears: [],
			});
		}
		if (url.includes('/notification-inbox/unread-count')) return json({ count: 1 });
		if (/\/notification-inbox\/\d+\/read/.test(url)) return json({ ok: true });
		if (url.includes('/notification-inbox/')) return json({ items: INBOX_ITEMS, nextCursor: null });
		if (/\/notifications\/[^/]+\/(\d+\/)?events/.test(url)) {
			await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
			return;
		}

		// --- /subjects ---
		if (url.includes('/subjects/scheduling-authority')) return json({ subjects: SUBJECTS, termAuthority: TERM_AUTHORITY });
		if (url.includes('/subjects')) return json({ subjects: SUBJECTS });
		if (url.includes('/faculty-assignments/coverage/summary')) {
			return json({
				rows: SUBJECTS.map((s) => ({
					subjectId: s.id,
					subjectCode: s.code,
					subjectName: s.name,
					isActive: true,
					relevantSectionCount: 2,
					ownedSectionCount: 2,
					ownedByPlaceholderCount: 0,
					ownedByRealFacultyCount: 1,
					uncoveredSectionCount: 0,
					uncoveredSections: [],
					coveragePercent: 100,
					status: 'FULL',
					placeholderFacultyIds: [],
				})),
				zeroCoverageSubjectCodes: [],
				partiallyCoveredSubjectCodes: [],
				fullyCoveredSubjectCodes: SUBJECTS.map((s) => s.code),
			});
		}

		// --- /audit ---
		if (url.includes('/faculty-assignments/summary')) {
			// A DETERMINISTIC delay, so the page's LOADING state is genuinely
			// observable. Every other mock resolves in a microtask, so without
			// this the spinner never paints and a "from loading to resolved data"
			// row silently only ever proves the resolved half. The value is read
			// from the environment so the delay is a property of the harness, not
			// a magic number buried in a route handler.
			await new Promise((resolve) => setTimeout(resolve, Number(process.env.A5_C2B_AUDIT_DELAY_MS ?? 400)));
			return json({
				faculty: AUDIT_FACULTY,
				items: AUDIT_FACULTY,
				page: 1,
				pageSize: 25,
				total: AUDIT_FACULTY.length,
				totalPages: 1,
				departments: [],
				rosterStats: { totalCount: 2, activeCount: 2, assignedCount: 2, unassignedCount: 0, overCapCount: 0 },
				fetchedAt: '2026-09-28T00:00:00.000Z',
			});
		}
		if (/\/preferences\/\d+\/\d+\/audit/.test(url)) {
			// One teacher with matching subjects far more than 50% unavailable,
			// which is what drives a real `blocker` finding and a non-zero count.
			return json({ audit: [{ id: 7, specialization: 'SCI', department: 'SCI', unavailabilityPercent: 80 }] });
		}
		if (url.includes('/sections/summary/')) return json({ sections: [], source: 'enrollpro' });
		if (url.includes('/class-templates')) return json({ templates: [] });
		if (url.includes('/map/schools/')) return json({ buildings: [] });
		if (url.includes('/specialization-aliases')) return json({ aliases: [] });

		// --- /faculty/room-preferences ---
		// The real path is `/room-preferences/<school>/<year>/latest/summary`
		// (`OfficerRoomPreferences.tsx:74`). Matched on the collection prefix so
		// the `latest` segment cannot be dropped by a later edit.
		if (url.includes('/room-preferences/') && url.includes('/summary')) {
			// Version 7, zero requests, no collaborators — the exact state the
			// report observed, reached with SUBMITTED + PENDING already selected.
			return json({
				runId: 'run-7',
				runVersion: 7,
				schoolYearId: 9,
				counts: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
				requests: [],
				activeSchoolYearId: 9,
			});
		}
		// The room-preference event stream. `OfficerRoomPreferences.tsx:117`
		// opens an EventSource at `/room-preferences/<school>/<year>/events`;
		// answering JSON makes the browser abort on the MIME type, which the
		// per-row console gate then (correctly) reports. Served as a real empty
		// event stream — the shape a scheduler with no live events sees.
		if (/\/room-preferences\/\d+\/\d+\/events/.test(url)) {
			await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
			return;
		}

		// App-shell chrome the other routes also mount. FIXTURED rather than
		// absorbed, for the reason on `unmockedRequests`.
		if (url.includes('/faculty/grade-preferences')) return json({ preferences: [] });

		// --- /dashboard (mounted by `/`, the route A5-C2B-5 navigates to) ---
		//
		// This branch was MISSING, and the ISO row caught it. `useDashboardData`
		// (`useDashboardData.ts:532`) fetches `/dashboard/readiness-summary` on
		// every shell mount; with no branch here it reached the fallback, was
		// answered a bare `{}`, and `summary.campus.buildings` (`:537`, an
		// UNGUARDED dereference) threw inside the `.then`. Whether that throw
		// surfaced as a console error or was swallowed depended on mount
		// ordering, so the ISO row failed roughly one run in two — a mandatory row
		// reporting a race, not a fact.
		//
		// The payload is the real `DashboardReadinessSummary`
		// (`dashboard-readiness.service.ts:191-215`). It deliberately carries an
		// `activeSchoolYearId` AND a resolved `activeTerm`, because that is what
		// makes the hook issue its four FOLLOW-ON reads
		// (`useDashboardData.ts:567-612`). Each is mocked below rather than left
		// to the fallback, so the surface is complete by construction instead of
		// by luck. This slice asserts nothing about the Dashboard's own copy; the
		// branches exist so the bell row runs on a shell that actually loaded.
		if (url.includes('/dashboard/readiness-summary')) {
			return json({
				schoolId: 1,
				activeSchoolYearId: 9,
				activeSchoolYearLabel: '2026-2027',
				resolvedAt: '2026-09-28T00:00:00.000Z',
				sourceState: 'verified_live',
				sourceMessage: 'Read live from ATLAS and the active EnrollPro year.',
				campus: {
					available: true,
					campusImageUrl: null,
					buildings: [],
					teachingRoomCount: 0,
					totalRoomCount: 0,
					buildingSetupStatus: { done: false, subMessage: 'No buildings have been mapped yet.' },
				},
				subjects: { available: true, subjectCount: 3, unassignedSubjectCount: 0 },
				faculty: { available: true, facultyCount: 2, lastSyncedAt: '2026-09-28T00:00:00.000Z' },
				sections: { available: true, sectionCount: 3, lastSyncedAt: '2026-09-28T00:00:00.000Z' },
				generation: {
					available: true,
					latestRunStatus: 'NONE',
					latestRunId: null,
					blockingHardCount: 0,
					softViolationCount: 0,
					isPublished: false,
					publishedRunId: null,
					createdAt: null,
					finishedAt: null,
				},
				derivedDemand: {
					available: true,
					ready: true,
					yearLabel: '2026-2027',
					revision: 'a5c2b-revision',
					termStructure: {
						format: 'TRIMESTER',
						terms: [
							{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
							{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
							{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
						],
					},
					blockers: [],
					subjectMetadataExceptions: [],
					totals: { totalLines: 3, totalPairs: 3, byTerm: { T1: 1, T2: 1, T3: 1 } },
					blockerCode: null,
					blockerMessage: null,
					error: null,
				},
				// `ActiveTermResult` — active-term-adapter.service.ts.
				activeTerm: {
					source: 'persisted_term_contract',
					reachable: true,
					verified: true,
					activeTerm: 'T1',
					termIndex: 1,
					schoolYearId: 9,
					matchedSchoolYear: true,
					code: null,
					message: 'Active term read from the persisted verified contract.',
					orderedTerms: [
						{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
						{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
						{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
					],
					termFormat: 'TRIMESTER',
					termCount: 3,
				},
				lifecyclePhase: 'PREFERENCES',
				sources: {
					runtimeContext: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
					campus: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
					subjects: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
					faculty: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
					sections: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
					generation: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
					derivedDemand: { state: 'verified_live', message: 'ok', source: 'atlas', fetchedAt: '2026-09-28T00:00:00.000Z' },
				},
			});
		}
		// The three follow-on reads the resolved `activeTerm` above makes the
		// Dashboard issue (`useDashboardData.ts:578-612`). Their shapes are
		// read from the consuming expressions, not guessed.
		if (/\/schools\/\d+\/schedules\/published/.test(url)) {
			return json({ source: { termScope: 'explicit' }, published: true, runId: null, entries: [] });
		}
		if (/\/generation\/\d+\/\d+\/runs\/latest\/violations/.test(url)) {
			// `resolveRunWideHardViolationCount` reads `counts.runWide`
			// (DASHBOARD-TRUTH-C01), so a bare `{}` would not be a valid report.
			return json({
				violations: [],
				counts: { runWide: { hard: 0, soft: 0 } },
				termIndex: 1,
				runId: null,
			});
		}
		if (/\/generation\/\d+\/\d+\/runs\/latest(\?|$)/.test(url)) {
			return json({ run: { id: null, status: 'NONE', unassignedItems: [] } });
		}

		unmockedRequests.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
		return json({});
	});
}

test.beforeEach(async ({ page }) => {
	await installMocks(page);
});

// ─────────────────────────── rendered measurements ───────────────────────────

/**
 * Is any part of this element's painted box outside the viewport, or outside
 * the nearest clipping ancestor's box? This is the measurement the report's
 * clipping rows are about — "the right-side control is clipped, with a
 * horizontal scrollbar below the rows" — and it is deliberately GEOMETRY, not
 * a class name.
 */
async function readVisibility(page: Page, selector: string) {
	return page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const style = getComputedStyle(el);
		// Walk up to the nearest ancestor that actually clips.
		let clip: { left: number; right: number; top: number; bottom: number } = {
			left: 0,
			right: window.innerWidth,
			top: 0,
			bottom: window.innerHeight,
		};
		let cursor: Element | null = el.parentElement;
		while (cursor && cursor !== document.body) {
			const s = getComputedStyle(cursor);
			if (/^(hidden|auto|scroll|clip)$/.test(s.overflowX) || /^(hidden|auto|scroll|clip)$/.test(s.overflowY)) {
				const r = cursor.getBoundingClientRect();
				clip = { left: Math.max(clip.left, r.left), right: Math.min(clip.right, r.right), top: Math.max(clip.top, r.top), bottom: Math.min(clip.bottom, r.bottom) };
			}
			cursor = cursor.parentElement;
		}
		return {
			right: rect.right,
			left: rect.left,
			width: rect.width,
			height: rect.height,
			viewportWidth: window.innerWidth,
			clipRight: clip.right,
			// The two facts the report turned on.
			cutByViewport: rect.right > window.innerWidth + 0.5 || rect.left < -0.5,
			cutByAncestor: rect.right > clip.right + 0.5 || rect.left < clip.left - 0.5,
			textOverflowing: el.scrollWidth > el.clientWidth + 1,
			visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
		};
	}, selector);
}

/** Real console/page errors accumulated so far, for the per-row gate. */
async function gateConsole(page: Page, label: string) {
	expect(consoleErrors, `${label} produced console/page errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
	await expect(page.locator('text=/Something went wrong|Application error/i')).toHaveCount(0);
}

// ───────────────────── item 4 — /audit, rendered copy ────────────────────────

test('A5-C2B-4 RENDERED: /audit scopes the blocker count to the setup records, dates it, and grades the roster load', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	// Loading state first: the report's rows are about resolved copy, and a row
	// that only ever sees the spinner proves nothing about it. The audit
	// summary mock answers after a deliberate delay so this is a real
	// observation of the loading state rather than a race.
	await page.goto('/audit');
	await expect(page.getByText('Checking readiness...')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('Needs fixes before scheduling').first()).toBeVisible({ timeout: 30_000 });

	// (1) THE VERDICT. The report's quoted contradiction is "must be fixed
	// before scheduling review is reliable"; it must be gone from the RENDERED
	// page, and the count must survive (the report asked to scope it, not
	// delete it).
	const bodyText = await page.locator('body').innerText();
	expect(bodyText, 'the contradictory verdict sentence is still rendered on /audit').not.toContain('must be fixed before scheduling review is reliable');
	expect(bodyText, 'the blocker count was deleted instead of scoped').toMatch(/\d+ readiness blockers? in the setup records/);

	// (2) SCOPE AND DATE. This is the report's "Explain the scope/date of the
	// audit versus the published schedule", taken literally.
	const scope = page.getByTestId('audit-blocker-scope');
	await expect(scope).toBeVisible();
	const scopeText = (await scope.innerText()).replace(/\s+/g, ' ');
	expect(scopeText).toContain('these are findings about your setup records');
	expect(scopeText).toContain('They are not findings about a published schedule');
	// The DATE must be a real timestamp, not a placeholder: the page records the
	// moment the evidence was read, so the sentence carries a time.
	expect(scopeText, `the scope sentence promises a date but rendered none: "${scopeText}"`).toMatch(/read\s+\w{3}\w*\s+\d{1,2},?\s+\d{4}/);

	// (3) THE ROSTER LOAD. A percentage with its denominator, its target and a
	// decision. "56.6% of each teacher's maximum weekly hours" — a grade of
	// 56.5% must read as below the 30-hour standard, with a next step.
	expect(bodyText).toContain('of each teacher');
	expect(bodyText).toContain('maximum weekly hours');
	const loadVerdict = page.getByTestId('audit-roster-load-verdict');
	await expect(loadVerdict).toBeVisible();
	const loadText = (await loadVerdict.innerText()).replace(/\s+/g, ' ');
	expect(loadText, `the roster-load verdict renders no decision: "${loadText}"`).toMatch(/(Below|At or above|At or over)/);
	expect(loadText).toContain('Target is 75% (30 hours against a 40-hour maximum)');
	expect(loadText).toMatch(/Check Teaching Load\.|Fix the teacher-coverage items above/);

	// A VISUAL CUE BESIDE THE STATUS (the audience is an older, mouse-first
	// scheduler). The grade is bold and the panel has a non-colour marker, so
	// the state does not depend on hue alone.
	const weight = await loadVerdict.evaluate((el) => getComputedStyle(el.querySelector('span') as HTMLElement).fontWeight);
	expect(Number(weight), 'the roster-load verdict has no visual cue beside it').toBeGreaterThanOrEqual(600);

	await gateConsole(page, '/audit');
});

// ────────────── item 5 — notifications popover on /, rendered ───────────────

test('A5-C2B-5 RENDERED: the bell names what changed, leaks no raw id, and does not hard-clip', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto('/');
	await expect(page.getByTestId('notification-bell-trigger')).toBeVisible({ timeout: 30_000 });

	await page.getByTestId('notification-bell-trigger').click();
	const panel = page.getByTestId('notification-bell-panel');
	await expect(panel).toBeVisible();
	// Three rows, including the long notice.
	await expect(page.getByTestId('notification-bell-item')).toHaveCount(3);

	// (1) NO RAW ENTRY IDS ANYWHERE IN THE PANEL. `MOVE_ENT...` and
	// `entry-321::t2` are the report's own quoted observations.
	const panelText = (await panel.innerText()).replace(/\s+/g, ' ');
	expect(panelText, `the report saw "MOVE_ENT..." and "entry-321::t2" in the panel; rendered: ${panelText}`).not.toMatch(/MOVE_ENT|entry-321|::t2/);
	expect(panelText).not.toMatch(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/);

	// (2) IT SAYS WHAT CHANGED — from the REAL payload. An earlier revision of
	// this row asserted `SCI10`, `Bonifacio`, `Santos, Miguel` and `Lab 3`, and
	// passed on a fixture that invented those keys. No producer writes them, so
	// on the real surface the row read as the unnamed fallback. What the real
	// metadata carries is the ACTION, the DAY, the TIME WINDOW and the request
	// state, and those are what must now be on screen.
	expect(panelText).toContain('Room request');
	expect(panelText).toContain('a different room was requested');
	expect(panelText).toContain('Mon');
	expect(panelText).toContain('07:30-08:30');
	expect(panelText).toContain('sent for review');
	// The identifiers the same payload carries must NOT be printed as tokens.
	expect(panelText).not.toMatch(/entry-321|SCI10|Bonifacio|Lab 3/);

	// (3) THE LEGACY ROW STILL SAYS SOMETHING USEFUL, NOT A TOKEN.
	const firstSummary = (await page.getByTestId('notification-bell-item').first().innerText()).replace(/\s+/g, ' ');
	expect(firstSummary).toContain('Timetable change');

	// (4) NOT HARD-CLIPPED — MEASURED. The report: "long notices are clipped in
	// the narrow popover". The long row's own text must be fully laid out:
	// every client rect the browser produces for it must have real width, and
	// the element must not be overflowing its own box.
	const longRow = page.getByTestId('notification-bell-item').nth(2);
	const summary = longRow.locator('[data-testid="notification-bell-summary"], [data-testid="notification-bell-open"]').first();
	const summaryText = ((await summary.innerText()) ?? '').replace(/\s+/g, ' ').trim();
	expect(summaryText.length, 'the long notice rendered empty').toBeGreaterThan(40);
	const clipReading = await summary.evaluate((el) => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const rects = Array.from(range.getClientRects());
		const own = el.getBoundingClientRect();
		return {
			lineCount: rects.length,
			zeroWidthLines: rects.filter((r) => r.width < 1).length,
			overflowsSelf: el.scrollWidth > el.clientWidth + 1,
			whiteSpace: getComputedStyle(el).whiteSpace,
			textOverflow: getComputedStyle(el).textOverflow,
			ownWidth: own.width,
			clientWidth: el.clientWidth,
			scrollWidth: el.scrollWidth,
		};
	});
	// A hard clip is `truncate` (one line, ellipsis) or a line clamp. Measured:
	// the long notice WRAPS onto more than one line and nothing is ellipsised.
	expect(clipReading.lineCount, 'the long notice is on a single line, so it is being clipped').toBeGreaterThan(1);
	expect(clipReading.zeroWidthLines, 'a rendered line of the long notice has zero width').toBe(0);
	expect(clipReading.whiteSpace, `the summary is ${clipReading.whiteSpace}, so it cannot wrap`).not.toBe('nowrap');
	expect(clipReading.overflowsSelf, 'the summary overflows its own box').toBe(false);

	// (5) AN EXPANDABLE DETAIL, not a hard clip — and the raw record is still
	// reachable in it, so nothing was destroyed to make the panel readable.
	await page.getByTestId('notification-bell-detail-toggle').first().click();
	const detail = page.getByTestId('notification-bell-detail').first();
	await expect(detail).toBeVisible();
	const detailText = (await detail.innerText()).trim();
	expect(detailText, 'the recorded detail is not the stored row').toContain('MOVE_ENTRY entry-321::t2');

	await gateConsole(page, '/ (notification bell)');

	// (6) THE SHELL'S STARTUP TRAFFIC MUST SETTLE BEFORE THIS ROW ENDS, OR THE
	// ISO ROW IS A COIN FLIP. The Dashboard resolves its actor school
	// asynchronously (`useDashboardData.ts:449-483`) and DISCARDS a resolution
	// whose token epoch moved while it was in flight (`:466`), so
	// `/dashboard/readiness-summary` is issued on a LATER frame than the bell
	// assertions above. Row 5 finished in ~440ms, which is often before that
	// frame lands — the page is then closed and the request never happens. That
	// is why the ISO row failed roughly one run in two for a reviewer and passed
	// three in a row for the executor: both were measuring the same race, and a
	// pass proved only that the request had not arrived yet.
	//
	// The settle is bounded and its duration comes from the environment, so the
	// row is a deliberate wait rather than a sleep that hides a slow leak. It
	// waits for the readiness request to be OBSERVED, and fails loudly if it
	// never arrives — which is what makes the mock surface below load-bearing
	// instead of decorative.
	const settleMs = Number(process.env.A5_C2B_DASHBOARD_SETTLE_MS ?? 3000);
	const readinessAnswered = await page
		.waitForRequest((request) => request.url().includes('/dashboard/readiness-summary'), { timeout: settleMs })
		// The RESPONSE, not the request: the route handler records an escape into
		// `unmockedRequests` and only then fulfils, so awaiting the request event
		// alone returns while the record is still unobservable. That is the same
		// ordering bug one level down, and it would have made the ISO row pass
		// without ever seeing its own escape list.
		.then((request) => request.response())
		.then(() => true)
		.catch(() => false);
	expect(
		readinessAnswered,
		`the mounted Dashboard never issued and received an answer for /dashboard/readiness-summary within ${settleMs}ms, so this row is no longer proving the shell's isolation — the actor-scope resolution at useDashboardData.ts:449-483 stopped firing`,
	).toBe(true);
});

// ───────── item 6 — /faculty/room-preferences, rendered ─────────

test('A5-C2B-6 RENDERED: the room queue leads with its own state, names the active filter, and clears it', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto('/faculty/room-preferences');
	// Loading state, then the empty queue with SUBMITTED + PENDING preselected.
	await expect(page.getByTestId('room-requests-empty')).toBeVisible({ timeout: 30_000 });

	// (1) IT LEADS WITH THE QUEUE. The report: the page "leads with 'Current
	// working schedule Version 7', 'active run' and collaborator count although
	// there are zero requests". "No room requests" must be the first thing read.
	const empty = page.getByTestId('room-requests-empty');
	const emptyText = (await empty.innerText()).replace(/\s+/g, ' ');
	expect(emptyText).toMatch(/^No room requests/);
	// The empty state also NAMES the filter, on its own line. The report's own
	// suggestion was "No submitted, pending requests". Putting the filter inside
	// the headline would have satisfied this and broken the lead-with-the-queue
	// requirement, so they are deliberately two lines.
	expect(emptyText, `the empty state does not name the filter that hid the queue: "${emptyText}"`).toContain('No submitted and pending room requests');

	// (2) THE ACTIVE FILTERS ARE VISIBLE AND CLEARABLE. One control, one verb.
	const clear = page.getByTestId('room-requests-empty-clear-filters');
	await expect(clear).toBeVisible();
	const filters = page.getByTestId('room-requests-active-filters');
	await expect(filters).toBeVisible();
	expect(((await filters.innerText()) ?? '').replace(/\s+/g, ' ')).toContain('Showing submitted and pending.');

	// (3) THE CLEAR ACTUALLY CLEARS — the row discriminates a control from a
	// label. After clicking, both dropdowns read "All".
	await clear.click();
	await expect(page.getByRole('combobox').nth(0)).toContainText('All submissions');
	await expect(page.getByRole('combobox').nth(1)).toContainText('All decisions');
	await expect(page.getByTestId('room-requests-active-filters')).toHaveCount(0);

	// (4) VERSION / COLLABORATION IS SECONDARY, NOT THE HEADLINE. The run
	// detail must still be present — the report asked for it to be moved, not
	// deleted — but it must not be the leading sentence.
	const body = ((await page.locator('body').innerText()) ?? '').replace(/\s+/g, ' ');
	expect(body).toContain('Working schedule Version 7');
	const firstHeading = ((await page.locator('main, [role="main"], body').first().innerText()) ?? '').trim().split('\n')[0].trim();
	expect(firstHeading, `the page still leads with run detail, not the queue: "${firstHeading}"`).not.toContain('Current working schedule');

	await gateConsole(page, '/faculty/room-preferences');
});

// ───────── item 7 — /subjects, rendered code translation and geometry ─────────

test('A5-C2B-7a RENDERED: the room-need column reads as a department, never the stored OWNER_DEPT marker', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto('/subjects');
	await expect(page.locator('th[data-sort-field="name"]')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('table tbody tr').first()).toBeVisible();

	// The room-need CELL TEXT, which is what the operator read. The report
	// quoted `OWNER_DEPT:AP` and `OWNER_DEPT:MAPEH` as the leak.
	//
	// VISIBLE TEXT ONLY, and this distinction is the row. `AccessibleInfo`
	// mirrors its `shortHelp` into a `sr-only` span so screen readers always
	// have the description; Playwright's `innerText` includes those spans,
	// because `sr-only` is technically rendered (1px, clipped). A scheduler
	// LOOKING at the row never sees them, so the report's complaint is about the
	// visible text, and a row that used the raw `innerText` would have reported
	// a leak that no operator can see. Reachability is therefore asserted
	// SEPARATELY and POSITIVELY below, on the accessible tree — which makes
	// this stronger than either assertion alone, because a presenter that
	// dropped the marker entirely would fail the second half.
	const cellTexts = (await page.locator('table tbody tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
	const visible = await page.evaluate(() => {
		const walk = (node: Node): string => {
			let out = '';
			node.childNodes.forEach((child) => {
				if (child.nodeType === Node.TEXT_NODE) {
					out += child.textContent ?? '';
					return;
				}
				if (!(child instanceof HTMLElement)) return;
				// A visually-hidden subtree is not what a sighted scheduler reads.
				if (child.classList.contains('sr-only')) return;
				if (child.getAttribute('aria-hidden') === 'true') return;
				const style = getComputedStyle(child);
				if (style.display === 'none' || style.visibility === 'hidden') return;
				out += ` ${walk(child)} `;
			});
			return out;
		};
		return Array.from(document.querySelectorAll('table tbody tr')).map((tr) => walk(tr).replace(/\s+/g, ' ').trim());
	});
	const joined = visible.join(' | ');
	expect(joined, `the stored marker still reaches the VISIBLE room column: ${joined}`).not.toContain('OWNER_DEPT');
	// The plain/translated read is present for BOTH codes: the mapped one keeps
	// its glossary name and the unmapped one shows the department's own code.
	expect(joined).toContain('Owned by Araling Panlipunan department');
	expect(joined).toContain('Owned by MAPEH');

	// THE MARKER IS NOT COUNTED AS A ROOM FEATURE — asserted PER ROW, on the one
	// row that actually carries a marker plus exactly one real feature
	// (`OWNER_DEPT:MAPEH` + `LAB_BENCH`). A page-wide `not.toContain('+2')` would
	// be wrong, not strict: the LTE row holds TWO REAL features and correctly
	// reads `+2 features`, so the negative has to name the row it is about.
	const mapehRow = visible.find((t) => t.includes('Owned by MAPEH'));
	expect(mapehRow, `no row renders the MAPEH ownership read: ${joined}`).toBeTruthy();
	expect(mapehRow!, `the MAPEH row must count its ONE real room feature: "${mapehRow}"`).toContain('+1 feature');
	expect(mapehRow!, `the ownership marker is being counted as a room feature: "${mapehRow}"`).not.toContain('+2 feature');
	// `LAB_BENCH` is the row's REAL room feature, but it lives in the
	// `AccessibleInfo` `sr-only` help rather than the visible cell text, so it is
	// NOT asserted on the visible row here. The reachable assertion for it is the
	// accessibility-mirror row below, which is where it must survive.
	// And the primary read must not be the token in EITHER form.
	expect(cellTexts.join(' | ')).not.toMatch(/Owned by OWNER_DEPT/);

	// REACHABILITY, asserted positively: the stored marker is still in the
	// accessible description, so the fix moved it off the primary line rather
	// than destroying the diagnostic an officer needs when a code is wrong.
	const accessible = await page.evaluate(() => {
		const out: string[] = [];
		document.querySelectorAll('.sr-only').forEach((el) => out.push(el.textContent ?? ''));
		return out.join(' | ');
	});
	expect(accessible, 'the stored marker is no longer reachable anywhere on the row').toContain('OWNER_DEPT:MAPEH');
	expect(accessible).toContain('OWNER_DEPT:AP');
	// The real room feature remains reachable in the same description, so the
	// `+1 feature` count is backed by something an officer can read on demand.
	expect(accessible, 'the real room feature must stay reachable in the help text').toContain('LAB_BENCH');

	await gateConsole(page, '/subjects (room-need copy)');
});

test('A5-C2B-7b RENDERED: the row action is inside the viewport at 1366px, measured, and the page does not scroll sideways', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto('/subjects');
	await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 });

	// (1) THE ACTION IS IN VIEW. Measured on the ACTION CELL of the first row —
	// the element the report said was "clipped, with a horizontal scrollbar
	// below the rows". Two independent facts: its painted right edge is inside
	// the viewport, and it is not cut by any clipping ancestor.
	const cell = page.locator('table tbody tr').first().locator('td').last();
	const reading = await readVisibility(page, 'table tbody tr:first-child td:last-child');
	// The WIDTH, measured, so a reader can see whether the fixture really
	// reproduces the operator's viewport pressure. If the table fits, this row
	// is vacuous and must not be read as proof.
	const tableWidth = await page.evaluate(() => {
		const table = document.querySelector('table') as HTMLElement;
		const scroller = table.parentElement as HTMLElement;
		return { table: table.scrollWidth, client: scroller.clientWidth, scrolls: scroller.scrollWidth > scroller.clientWidth + 1 };
	});
	console.log('A5-C2B-7b table width reading: ' + JSON.stringify(tableWidth));
	expect(reading, 'the action cell was not found').not.toBeNull();
	expect(reading!.visible, 'the action cell has no size').toBe(true);
	expect(
		reading!.cutByViewport,
		`the row action is painted to x=${reading!.right} but the viewport ends at ${reading!.viewportWidth} — this is the clipping the report saw`,
	).toBe(false);
	expect(reading!.cutByAncestor, `the row action is cut by a clipping ancestor (cell right ${reading!.right} > clip ${reading!.clipRight})`).toBe(false);

	// (2) IT IS REACHABLE BY A REAL CLICK, at its real position. A pinned
	// element behind a scrollbar is not reachable; this drives the actual
	// pointer at the measured centre and proves the dialog opens.
	await expect(cell.getByRole('button', { name: /Review teacher coverage for/ })).toBeVisible();
	await cell.getByRole('button', { name: /Review teacher coverage for/ }).click({ timeout: 15_000 });
	await expect(page.getByTestId('subject-coverage-dialog')).toBeVisible();
	await page.keyboard.press('Escape');

	// (3) THE ONE-VERB LABEL. The report's audience guidance: one verb per
	// action. The accessible name is unchanged, so nothing is lost.
	const label = (await cell.getByRole('button', { name: /Review teacher coverage for/ }).innerText()).replace(/\s+/g, ' ').trim();
	expect(label, `the action label is "${label}", not one verb`).toBe('Review');

	// (4) NO HORIZONTAL SCROLLBAR ON THE PAGE. The report named it explicitly.
	const blowout = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(blowout.scrollWidth, `the page has a horizontal scrollbar (${blowout.scrollWidth} > ${blowout.clientWidth})`).toBeLessThanOrEqual(blowout.clientWidth);

	await gateConsole(page, '/subjects (row action geometry)');
});

// ─────────────────────────── the isolation gate ──────────────────────────────

test('A5-C2B-ISO: the run attempted no write, and no request escaped the mocks', async () => {
	expect(attemptedMutations, `the page attempted a write: ${attemptedMutations.join(', ')}`).toEqual([]);
	expect(unmockedRequests, `requests escaped the mocks and were answered {}: ${unmockedRequests.join(', ')}`).toEqual([]);
	expect(consoleErrors, `console/page errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
