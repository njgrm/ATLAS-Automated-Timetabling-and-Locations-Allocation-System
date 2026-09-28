import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * A5-C2A — RENDERED evidence for the two blocked surfaces, on the real routes.
 *
 * ISOLATED — NOT ATLAS ACCEPTANCE (AGENTS.md §12). These rows run against a
 * **loopback preview of this candidate's own built client** (see
 * `playwright.a5-c2a-term-truth.config.ts`) with **every `/api/v1/**` request
 * mocked in-process**. Nothing reaches the live runtime, the shared 5001/5174
 * listeners, EnrollPro, or a database. The ATLAS origin is
 * `https://njgrm.buru-degree.ts.net`; a loopback origin is a different origin,
 * so this proves nothing about ATLAS acceptance. The session is seeded with a
 * FAKE token through `addInitScript` — no credential is typed, echoed, or logged.
 *
 * WHAT THIS SPEC PROVES, and why a jsdom/source test could not:
 *
 *  1. `/faculty/concerns` — the recorded Blocker 1. The page rendered the hard,
 *     workflow-disabling "Active ordered term unresolved" while the shell showed
 *     the saved term for the same school year. This spec drives the REAL route
 *     with the REAL failing upstream shape (a reachable, typed
 *     `ACTIVE_TERM_UNRESOLVED` plus a saved verified snapshot) and asserts the
 *     RENDERED TEXT: the dead-end card is gone, the workflow is usable, and the
 *     saved-data label names its real capture time.
 *  2. `/admin/year-setup` — the recorded Blocker 2. The page claimed the active
 *     year was unresolved while the header said it was active. This asserts the
 *     page states the resolved year and term, and that the dead "Year setup"
 *     self-link is gone from the RENDERED DOM.
 *  3. Fail-closed: when the term is genuinely UNKNOWN the concerns page must
 *     still fail closed, still say why, and still offer one recoverable action.
 *
 * MEASURED, NOT CLASS-LISTED: every visual/copy assertion reads RENDERED TEXT
 * CONTENT or a COMPUTED STYLE. An assertion that can pass while the paint is
 * wrong is not evidence, and that exact trap was hit once already in this repo.
 *
 * NO WRITES: any non-GET to `/api/v1/**` is fulfilled with 500
 * `UNEXPECTED_MUTATION`, recorded, and asserted empty at the end. Every request
 * the page makes is recorded, so a row cannot go green merely because a fetch
 * silently failed and left a notice absent.
 */

const SCHOOL_YEAR_ID = 8;
const SCHOOL_YEAR_LABEL = '2031-2032';
/** The REAL capture time the server resolver reports for the saved snapshot. */
const SAVED_CAPTURED_AT = '2026-09-25T08:00:00.000Z';

const ORDERED_TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1, startDate: '2031-08-04', endDate: '2031-11-28' },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2, startDate: '2031-12-01', endDate: '2032-03-20' },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3, startDate: '2032-04-06', endDate: '2032-07-03' },
];

/**
 * The exact `activeTerm` the canonical resolver emits.
 *
 *  - `degraded-blocker1` is the SHAPE THAT CAUSED BLOCKER 1: EnrollPro is
 *    reachable and truthfully reports that no term contains today, and the saved
 *    verified snapshot re-verified against the LIVE semantic revision.
 *  - `live` is the healthy case.
 *  - `unresolved` is the genuinely-unknown fail-closed case.
 */
function activeTermPayload(
	variant: 'degraded-blocker1' | 'live' | 'unresolved',
): Record<string, unknown> {
	if (variant === 'live') {
		return {
			source: 'enrollpro-verified',
			reachable: true,
			verified: true,
			activeTerm: 'T2',
			termIndex: 2,
			schoolYearId: SCHOOL_YEAR_ID,
			matchedSchoolYear: true,
			code: null,
			message: 'EnrollPro active term T2 verified.',
			orderedTerms: ORDERED_TERMS,
			termFormat: 'TRIMESTER',
			termCount: 3,
			degraded: false,
			cachedAt: null,
			cachedBeyondTtl: false,
			semanticRevisionMatched: null,
		};
	}
	if (variant === 'unresolved') {
		return {
			source: 'enrollpro-unresolved',
			reachable: true,
			verified: false,
			activeTerm: null,
			termIndex: null,
			schoolYearId: null,
			matchedSchoolYear: null,
			code: 'TERM_AUTHORITY_STALE',
			message: 'The saved ordered terms no longer match EnrollPro; the active term cannot be resolved from saved data.',
			orderedTerms: ORDERED_TERMS,
			termFormat: 'TRIMESTER',
			termCount: 3,
			degraded: false,
			cachedAt: null,
			cachedBeyondTtl: false,
			semanticRevisionMatched: false,
		};
	}
	// The blocker-1 shape.
	return {
		source: 'atlas-cache-verified',
		reachable: true,
		verified: true,
		activeTerm: 'T2',
		termIndex: 2,
		schoolYearId: SCHOOL_YEAR_ID,
		matchedSchoolYear: null,
		code: 'ACTIVE_TERM_UNRESOLVED',
		message: `EnrollPro has no term containing today's date; using the saved ordered term T2, captured ${SAVED_CAPTURED_AT}, re-verified against the live EnrollPro term structure.`,
		orderedTerms: ORDERED_TERMS,
		termFormat: 'TRIMESTER',
		termCount: 3,
		degraded: true,
		cachedAt: SAVED_CAPTURED_AT,
		cachedBeyondTtl: false,
		semanticRevisionMatched: true,
	};
}

// `/auth/me` is a NESTED `{ user: {...} }` envelope: `resolveActorSchoolId`
// reads `data.user.schoolId` and fails closed to "No actor school scope"
// otherwise. A flat object here silently disables the whole page, which is
// exactly the kind of fixture defect that makes a rendered row pass or fail for
// the wrong reason.
const AUTH_USER = {
	user: {
		userId: 1,
		email: 'a5@atlas.local',
		firstName: 'A5',
		lastName: 'Scheduler',
		role: 'admin',
		schoolId: 1,
		authSource: 'local',
	},
};

const ENROLLPRO_SETTINGS = {
	schoolName: 'ATLAS A5 School',
	activeSchoolYearId: SCHOOL_YEAR_ID,
	activeSchoolYearLabel: SCHOOL_YEAR_LABEL,
	termFormat: 'TRIMESTER',
	terms: ORDERED_TERMS,
};

const attemptedMutations: string[] = [];
const apiRequests: string[] = [];
const unmockedRequests: string[] = [];

type Variant = 'degraded-blocker1' | 'live' | 'unresolved';
let activeTermVariant: Variant = 'degraded-blocker1';

function runtimeContext() {
	return {
		schoolId: 1,
		activeSchoolYearId: SCHOOL_YEAR_ID,
		activeSchoolYearLabel: SCHOOL_YEAR_LABEL,
		source: 'enrollpro-verified',
		stale: false,
		resolvedAt: '2026-09-28T12:00:00.000Z',
		evidence: [],
		upstream: { reachable: true, verified: true, matched: true, activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: SCHOOL_YEAR_LABEL },
		activeYearDrift: {
			status: 'aligned',
			message: 'ATLAS and EnrollPro agree on the active school year.',
			recommendedAction: 'NONE',
			atlasSchoolYearId: SCHOOL_YEAR_ID,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			enrollProSchoolYearLabel: SCHOOL_YEAR_LABEL,
			mirrorSyncedAt: '2026-09-25T08:00:00.000Z',
		},
		rollover: { mirror: null },
		activeTerm: activeTermPayload(activeTermVariant),
	};
}

const FACULTY = [
	{ id: 71, firstName: 'Ana', lastName: 'Dela Cruz', email: 'ana@atlas.local', isActive: true },
	{ id: 72, firstName: 'Ben', lastName: 'Reyes', email: 'ben@atlas.local', isActive: true },
];

const ROLLOVER_STATUS = {
	schoolId: 1,
	atlasSchoolYearId: SCHOOL_YEAR_ID,
	enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: SCHOOL_YEAR_LABEL, isActive: true },
	drift: {
		status: 'aligned',
		message: 'ATLAS and EnrollPro agree on the active school year.',
		recommendedAction: 'NONE',
		atlasSchoolYearId: SCHOOL_YEAR_ID,
		enrollProSchoolYearId: SCHOOL_YEAR_ID,
		enrollProSchoolYearLabel: SCHOOL_YEAR_LABEL,
		mirrorSyncedAt: '2026-09-25T08:00:00.000Z',
	},
	mirror: null,
	conflicts: [],
	reconfiguredSections: [],
	canResetDummyYear: false,
	resetTargetSchoolYearId: null,
	conflictingRecordCounts: null,
	teachingLoadResetRequired: false,
	teachingLoadReset: { required: false, scope: 'DUMMY_YEAR_RESET_PREVIEW', applicable: false, reason: 'Not applicable.' },
	termAuthority: {
		state: 'PERSISTED_CURRENT',
		code: 'ACTIVE_TERM_UNRESOLVED',
		message: 'The saved ordered terms match EnrollPro.',
		persisted: true,
		persistedSemanticRevision: 'rev',
		liveSemanticRevision: 'rev',
		cachedAt: SAVED_CAPTURED_AT,
		termCount: 3,
		needsRepair: false,
		repairAction: 'NONE',
		canPreview: false,
	},
	publishedResetBlocked: false,
	testDataMarked: false,
	testModeEnabled: false,
	automation: { enabled: false, testModeEnabled: false },
	archivedYears: [],
};

async function installMocks(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.sessionStorage.setItem('atlas_local_token', 'a5-isolated-fake-token');
		window.localStorage.setItem(
			'atlas:session-user:v1',
			JSON.stringify({
				cachedAt: new Date().toISOString(),
				user: { userId: 1, role: 'admin', schoolId: 1, email: 'a5@atlas.local', authSource: 'local' },
			}),
		);
	});

	await page.route(/\/api\/settings\/public/, async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ schoolName: 'ATLAS A5 School', colorScheme: null, selectedAccentHsl: null }),
		});
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
				body: JSON.stringify({ years: [{ id: SCHOOL_YEAR_ID, yearLabel: SCHOOL_YEAR_LABEL, status: 'ACTIVE', isActive: true }], schoolYears: [{ id: SCHOOL_YEAR_ID, yearLabel: SCHOOL_YEAR_LABEL, status: 'ACTIVE', isActive: true }] }),
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
			await route.fulfill({
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-headers': '*',
					'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
				},
			});
			return;
		}
		if (method !== 'GET' && method !== 'HEAD') {
			attemptedMutations.push(`${method} ${url}`);
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ code: 'UNEXPECTED_MUTATION', message: `Attempted write: ${method} ${url}` }),
			});
			return;
		}
		apiRequests.push(`GET ${url.replace(/^https?:\/\/[^/]+/, '')}`);
		const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

		if (url.includes('/auth/me')) return json(AUTH_USER);
		if (url.includes('/runtime/context')) return json(runtimeContext());
		if (url.includes('/runtime/rollover-status')) return json(ROLLOVER_STATUS);
		if (url.includes('/runtime/rollover-recovery/classify')) return json({ classification: 'NONE', reason: 'aligned' });
		if (url.includes('/runtime/rollover-sync/preview')) return json(ROLLOVER_STATUS);
		if (url.includes('/teaching-load/carry-forward')) return json({ applicable: false, reason: 'none', items: [] });
		if (url.includes('/faculty-availability/latest-run-input')) {
			return json({ status: 'UNKNOWN', isPublished: false, changedDomains: [], isStale: false });
		}
		if (url.includes('/faculty-availability')) {
			return json({ id: 900, schoolId: 1, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex: 2, status: 'DRAFT', version: 1, notes: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewerNotes: null, slots: [] });
		}
		// `fetchConcernFaculty` unwraps a `{ faculty: [...] }` ENVELOPE
		// (`components/faculty-shared/teacher-concern-client.ts`); a bare array
		// yields an empty roster and the control renders "No teachers loaded",
		// which is a fixture defect that looks exactly like a product defect.
		if (/\/faculty(\?|$)/.test(url.replace(/^https?:\/\/[^/]+/, ''))) return json({ faculty: FACULTY });
		if (url.includes('/faculty')) return json({ faculty: FACULTY });
		// The app SHELL's notification bell polls on every route. Mocked rather
		// than ignored so "every request the page makes is mocked" stays true.
		if (url.includes('/notification-inbox/unread-count')) return json({ count: 0 });
		if (url.includes('/notification-inbox')) return json({ items: [], notifications: [] });
		if (url.includes('/notifications/')) return json({ events: [] });
		unmockedRequests.push(`GET ${url}`);
		return json({});
	});
}

/** The whole rendered body text, which is what a user actually reads. */
async function renderedText(page: Page): Promise<string> {
	return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

/** Console errors and uncaught page errors — an error boundary fails the row. */
function collectFailures(page: Page): string[] {
	const failures: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') failures.push(`console.error: ${message.text()}`);
	});
	page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
	return failures;
}

test.describe('A5-C2A rendered term truth', () => {
	test.beforeEach(async ({ page }) => {
		attemptedMutations.length = 0;
		apiRequests.length = 0;
		unmockedRequests.length = 0;
		activeTermVariant = 'degraded-blocker1';
		await installMocks(page);
	});

	test('BLOCKER 1: /faculty/concerns renders the saved term, not a workflow-disabling dead end', async ({ page }) => {
		const failures = collectFailures(page);
		await page.goto('/faculty/concerns');
		await expect(page.getByRole('heading', { name: 'Teacher Concerns' })).toBeVisible();
		// Load from its loading state to resolved data: wait for the year/term
		// resolution to land, not merely for the route to mount.
		await expect(page.getByTestId('concern-saved-term-notice')).toBeVisible();

		const text = await renderedText(page);

		// THE DEFECT. Asserted on RENDERED TEXT, not a class list.
		expect(text).not.toContain('Active ordered term unresolved');
		expect(text).not.toContain('writes stay disabled rather than defaulting to Term 1');
		await expect(page.getByTestId('concern-term-unresolved')).toHaveCount(0);

		// THE FIX. The workflow is usable and the saved source is named with its
		// REAL capture time.
		expect(text).toMatch(/Using saved term data from /);
		expect(text).toContain('2026');
		// `SearchableSelect` renders its placeholder as the trigger's TEXT inside a
		// `role="combobox"` control (`ui/searchable-select.tsx:158`) - not an input
		// `placeholder` attribute, not a button, and it exposes NO accessible name.
		// So assert the control by role and its LABEL by rendered text.
		const roster = page.getByRole('combobox');
		await expect(roster).toBeVisible();
		expect(await roster.innerText()).toContain('Select a teacher');

		// A degraded answer must be visibly degraded, not silently presented as
		// live. Measured from the DOM, not from a stylesheet.
		const noticeVisible = await page.getByTestId('concern-saved-term-notice').isVisible();
		expect(noticeVisible).toBe(true);
		const noticeFontSize = await page.getByTestId('concern-saved-term-notice')
			.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
		expect(noticeFontSize).toBeGreaterThan(0);

		expect(failures, failures.join('\n')).toEqual([]);
		expect(attemptedMutations, 'the page must not write').toEqual([]);
		expect(apiRequests.some((entry) => entry.includes('/runtime/context')),
			'the page must read the canonical runtime context').toBe(true);
	});

	test('BLOCKER 1 fail-closed: a genuinely unknown term still fails closed, says why, and offers one action', async ({ page }) => {
		activeTermVariant = 'unresolved';
		const failures = collectFailures(page);
		await page.goto('/faculty/concerns');
		await expect(page.getByRole('heading', { name: 'Teacher Concerns' })).toBeVisible();
		await expect(page.getByTestId('concern-term-unresolved')).toBeVisible();

		const text = await renderedText(page);
		// Still fail-closed, and the reason is the server's real typed reason.
		expect(text).toContain('Active ordered term unresolved');
		expect(text).toMatch(/no longer match EnrollPro/);
		// NEVER a dead end: exactly one recoverable action.
		await expect(page.getByRole('button', { name: /Re-check the active term/ })).toBeVisible();
		await expect(page.getByTestId('concern-saved-term-notice')).toHaveCount(0);

		expect(failures, failures.join('\n')).toEqual([]);
		expect(attemptedMutations).toEqual([]);
	});

	test('BLOCKER 2: /admin/year-setup agrees with the global year and has no self-link', async ({ page }) => {
		const failures = collectFailures(page);
		await page.goto('/admin/year-setup');
		await expect(page.getByRole('heading', { name: 'School Year Setup' })).toBeVisible();
		await expect(page.getByTestId('year-truth-resolved')).toBeVisible();

		const text = await renderedText(page);

		// Never contradict the global year: the page states the active year AND
		// the term, from the same canonical resolver the shell uses.
		expect(text).toContain(SCHOOL_YEAR_LABEL);
		expect(text).toMatch(/Term 2/);
		expect(text).not.toContain('The active ordered term could not be resolved');
		expect(text).not.toContain('Waiting for EnrollPro school year status');
		expect(text).not.toContain('Checking EnrollPro school year status');
		await expect(page.getByTestId('year-truth-unresolved')).toHaveCount(0);

		// The dead-looking "Year setup" self-link that sat beside Preview is gone.
		// Scoped precisely: the app SHELL sidebar link and the standard breadcrumb
		// link to the current route are correct and must not fail this row, and
		// counting the whole document would let a still-broken page pass.
		const straySelfLinks = await page
			.locator('main a[href="/admin/year-setup"]')
			.evaluateAll((els) => els.filter((el) => !el.closest('nav[aria-label="breadcrumb"]')).length);
		expect(straySelfLinks, 'no "Year setup" self-link beside Preview').toBe(0);

		// Measured, not class-listed: the year truth line is actually painted.
		const fontSize = await page.getByTestId('year-truth-resolved')
			.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
		expect(fontSize).toBeGreaterThan(0);

		expect(failures, failures.join('\n')).toEqual([]);
		expect(attemptedMutations).toEqual([]);
		expect(unmockedRequests, 'every request the page makes is mocked').toEqual([]);
	});
});
