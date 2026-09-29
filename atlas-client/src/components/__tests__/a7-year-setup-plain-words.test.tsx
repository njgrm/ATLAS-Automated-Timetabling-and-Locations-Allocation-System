/**
 * A7-C1 — `/admin/year-setup` in plain words, proved on the RENDERED DOM.
 *
 * WHY THIS FILE IS A RENDERED TEST AND NOT A SOURCE SCAN (AGENTS.md §11,
 * "done means seen"; §4 of the packet): the defect being fixed is what a school
 * scheduler READS. A source-text assertion would pass while the page still said
 * "Archive the old school year and sync the new one" on screen, which is exactly
 * the failure recorded on 2026-09-27/28. So every row below drives the REAL page
 * component through jsdom, and reads the text the operator would read.
 *
 * What the page is mounted with:
 *   - the REAL `AdminYearSetup` page,
 *   - the REAL `RolloverGuidanceCard`, `CarryForwardReviewPanel` and
 *     `RolloverResetPanel` it renders,
 *   - the REAL `fetchRolloverStatus` / `previewRolloverSync` / `applyRolloverSync`
 *     / `applyArchiveAndSync` / `applyTermCacheSync` code paths, with ONLY the
 *     transport (`@/lib/api`) stubbed — the same shape `a3-c4-draft-truth`
 *     uses, for the same reason: stubbing the transport proves the wiring, and
 *     stubbing the behaviour would prove a transcription of it.
 *
 * THE FIXTURES ARE THE REAL SURFACE (AGENTS.md §11, "a control's fixture must
 * come from the real surface"). Every `message` below is the literal the server
 * now returns, read out of `atlas-server/src/services/enrollpro-rollover.service.ts`
 * and `enrollpro-term-contract.service.ts` at this candidate — NOT an invented
 * tidy string. A test that fed a clean invented message would have passed against
 * the pre-fix server.
 *
 * Run: `npm run test:a7-year-setup-plain-words`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, mock, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/admin/year-setup',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	sessionStorage: dom.window.sessionStorage,
	localStorage: dom.window.localStorage,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};

// Radix popovers/portals need these; without them the Select and Dialog throw
// on open, which would turn a copy control into a crash control.
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
	return { width: 320, height: 40, top: 0, left: 0, bottom: 40, right: 320, x: 0, y: 0, toJSON: () => ({}) };
};

// ── Transport stub ───────────────────────────────────────────────────────────

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 9;
const YEAR_LABEL = '2022-2023';
const PREVIOUS_YEAR = { enrollProSchoolYearId: 8, yearLabel: '2021-2022', archivedAt: '2022-06-01T00:00:00.000Z', archivedBy: 1, archiveReason: 'ROLLOVER', preservedCounts: { publishedGenerationRuns: 2, teachingLoadOwnerships: 40 } };

type Recorded = { method: 'get' | 'post'; url: string; params?: unknown; body?: unknown };
let recorded: Recorded[] = [];
/** The mutable state the page is driven through. Each test sets it before mount. */
type Scenario = ReturnType<typeof makeScenario>;
let scenario: Scenario = makeScenario();

/**
 * The `checking` state holds `/runtime/rollover-status` open on purpose. That
 * promise is parked in `@/lib/settings`' module-level in-flight registry, and
 * the registry only clears in `.finally()`. If it were never released, EVERY
 * LATER state would silently share the pending promise and render "Checking
 * the school year now..." forever — which is exactly how rows 3-7 first went
 * red while row 1 stayed green. So it is released explicitly, and the release is
 * asserted by the fact that later states render their own copy.
 */
let checkGate: { promise: Promise<void>; release: () => void } | null = null;
function deferred(): { promise: Promise<void>; release: () => void } {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => { release = () => resolve(); });
	return { promise, release };
}
function releaseChecking() {
	if (!checkGate) return;
	const gate = checkGate;
	checkGate = null;
	gate.release();
}

function baseStatus(overrides: Record<string, unknown> = {}) {
	return {
		schoolId: SCHOOL_ID,
		atlasSchoolYearId: SCHOOL_YEAR_ID - 1,
		enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL },
		drift: {
			status: 'atlas-stale',
			message: `EnrollPro has moved to ${YEAR_LABEL}. Start ${YEAR_LABEL} in ATLAS before building a timetable.`,
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			atlasSchoolYearId: SCHOOL_YEAR_ID - 1,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			enrollProSchoolYearLabel: YEAR_LABEL,
			mirrorSyncedAt: null,
		},
		mirror: null,
		conflicts: [],
		reconfiguredSections: [],
		canResetDummyYear: false,
		resetTargetSchoolYearId: null,
		conflictingRecordCounts: null,
		teachingLoadResetRequired: false,
		publishedResetBlocked: false,
		archivedYears: [PREVIOUS_YEAR],
		// A7-C2 (R4): the every-year list. THREE years, because the defect this
		// cycle fixes is the one that is neither active nor archived — year 11 is
		// exactly the case no page listed before.
		schoolYears: [
			{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL, state: 'current', isArchived: false, archivedAt: null, preservedCounts: null },
			{ enrollProSchoolYearId: 10, yearLabel: '2023-2024', state: 'past, not yet kept', isArchived: false, archivedAt: null, preservedCounts: { publishedGenerationRuns: 3, teachingLoadOwnerships: 55 } },
			{ enrollProSchoolYearId: PREVIOUS_YEAR.enrollProSchoolYearId, yearLabel: PREVIOUS_YEAR.yearLabel, state: 'kept as history', isArchived: true, archivedAt: PREVIOUS_YEAR.archivedAt, preservedCounts: { publishedGenerationRuns: 2, teachingLoadOwnerships: 40 } },
		],
		automation: { enabled: false, lastAttemptAt: null, lastResult: null, nextAttemptAt: null, consecutiveFailures: 0, currentlyApplying: false },
		termAuthority: { state: 'PERSISTED_CURRENT', code: null, message: 'The saved ordered terms match EnrollPro.', persisted: true, persistedSemanticRevision: 'r1', liveSemanticRevision: 'r1', cachedAt: '2022-06-01T00:00:00.000Z', termCount: 3, needsRepair: false, repairAction: 'NONE', canPreview: false },
		...overrides,
	};
}

function makeScenario(overrides: { status?: Record<string, unknown>; classification?: unknown; archive?: unknown; termPreview?: unknown; carryPreview?: unknown; reset?: unknown; noStatus?: boolean; yearPreview?: unknown } = {}) {
	return {
		status: baseStatus(overrides.status ?? {}),
		classification: overrides.classification ?? null,
		archive: overrides.archive === undefined ? null : overrides.archive,
		termPreview: overrides.termPreview ?? null,
		carryPreview: overrides.carryPreview ?? null,
		reset: overrides.reset ?? null,
		noStatus: overrides.noStatus ?? false,
		yearPreview: overrides.yearPreview ?? null,
	};
}

/** The exact server literals. Changing a message on the server must break this. */
const SERVER_MESSAGES = {
	aligned: `ATLAS is on ${YEAR_LABEL}, the same school year as EnrollPro.`,
	unreachable: 'ATLAS could not reach EnrollPro to check the school year. It keeps using the setup it already has.',
	archiveConflict: `ATLAS recorded this school year as 2021-2022, but EnrollPro now calls it ${YEAR_LABEL}.`,
	clearConflict: 'ATLAS has leftover section data for this school year. Mark the year as test data to clear it.',
	// A7-C1, planner ruling R1 (2026-09-28): the ordered-terms preview message is
	// server prose THIS PAGE RENDERS, so it was changed rather than exempted. The
	// fixture is the post-fix literal; the pre-fix literal is retained one line
	// below as the superseded value so a future edit to either is visible.
	termPreview: 'Saving stores only this school year\u2019s ordered terms. It does not bring in teachers, sections, or Teaching Load.',
	// SUPERSEDED 2026-09-28 by A7-C1 R1: 'Saving stores only this school year\u2019s
	// ordered term authority. It does not sync faculty, sections, or Teaching Load.'
};

function statusAfterApply() {
	return baseStatus({
		atlasSchoolYearId: SCHOOL_YEAR_ID,
		drift: {
			status: 'aligned',
			message: SERVER_MESSAGES.aligned,
			recommendedAction: 'NONE',
			atlasSchoolYearId: SCHOOL_YEAR_ID,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			enrollProSchoolYearLabel: YEAR_LABEL,
			mirrorSyncedAt: '2022-06-01T00:00:00.000Z',
		},
		counts: { facultyCount: 41, sectionCount: 12, settingsReachable: true },
		archivedYears: [PREVIOUS_YEAR, { ...PREVIOUS_YEAR, enrollProSchoolYearId: 7, yearLabel: '2020-2021', preservedCounts: { publishedGenerationRuns: 1, teachingLoadOwnerships: 30 } }],
	});
}

function responseFor(url: string, method: 'get' | 'post') {
	if (url.includes('/auth/me')) {
		return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'admin', authSource: 'local' } } };
	}
	if (url.includes('/runtime/rollover-status')) {
		// The `checking` state is the real one: the request is still in flight, so
		// `loading` is true and the card has no status yet. Returning a held
		// promise (not an empty object) is what the page really sees, and it keeps
		// the card's own `status.drift` dereference honest.
		if (scenario.noStatus) {
			checkGate = deferred();
			return checkGate.promise.then(() => ({ data: scenario.status })) as unknown as { data: unknown };
		}
		return { data: scenario.status };
	}
	if (url.includes('/runtime/rollover-recovery/classify')) {
		return { data: scenario.classification };
	}
	if (url.includes('/runtime/rollover-recovery/preview')) {
		return { data: scenario.classification };
	}
	if (url.includes('/runtime/rollover-archive/year/preview')) {
		// The REAL server sentence, read out of `previewArchiveSchoolYear` in
		// `enrollpro-rollover.service.ts` at this candidate.
		return { data: scenario.yearPreview ?? { schoolId: SCHOOL_ID, schoolYearId: 10, yearLabel: '2023-2024', state: 'past, not yet kept', isActiveYear: false, alreadyArchived: false, message: '2023-2024 would be kept as history. Its sections, schedules and teaching load stay exactly as they are, read-only. Nothing is deleted, and EnrollPro is not changed.', preservedCounts: { publishedGenerationRuns: 3, teachingLoadOwnerships: 55 } } };
	}
	if (url.includes('/runtime/rollover-archive/year/apply')) {
		// The apply flips the year to kept, from the SERVER's answer, not from
		// local optimism — the page reloads the status afterwards.
		scenario = makeScenario({ status: baseStatus({ schoolYears: [
			{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL, state: 'current', isArchived: false, archivedAt: null, preservedCounts: null },
			{ enrollProSchoolYearId: 10, yearLabel: '2023-2024', state: 'kept as history', isArchived: true, archivedAt: '2026-09-29T00:00:00.000Z', preservedCounts: { publishedGenerationRuns: 3, teachingLoadOwnerships: 55 } },
			{ enrollProSchoolYearId: PREVIOUS_YEAR.enrollProSchoolYearId, yearLabel: PREVIOUS_YEAR.yearLabel, state: 'kept as history', isArchived: true, archivedAt: PREVIOUS_YEAR.archivedAt, preservedCounts: { publishedGenerationRuns: 2, teachingLoadOwnerships: 40 } },
		] }), carryPreview: scenario.carryPreview });
		return { data: { schoolId: SCHOOL_ID, schoolYearId: 10, yearLabel: '2023-2024', alreadyArchived: false, archivedAt: '2026-09-29T00:00:00.000Z', preservedCounts: { publishedGenerationRuns: 3, teachingLoadOwnerships: 55 } } };
	}
	if (url.includes('/runtime/rollover-archive/preview')) {
		return { data: scenario.archive };
	}
	if (url.includes('/runtime/rollover-archive/apply')) {
		scenario = makeScenario({ status: statusAfterApply(), archive: scenario.archive, termPreview: scenario.termPreview, carryPreview: scenario.carryPreview });
		return { data: { schoolId: SCHOOL_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL }, archivedYears: [{ enrollProSchoolYearId: 7, yearLabel: '2020-2021' }], labelReconciled: false, sync: statusAfterApply() } };
	}
	if (url.includes('/runtime/rollover-sync/preview')) {
		return { data: scenario.status };
	}
	if (url.includes('/runtime/rollover-sync/apply')) {
		scenario = makeScenario({ status: statusAfterApply(), archive: scenario.archive, termPreview: scenario.termPreview, carryPreview: scenario.carryPreview });
		return { data: { ...statusAfterApply(), applied: true, sync: { faculty: {}, sections: {}, policyReady: true } } };
	}
	if (url.includes('/runtime/rollover-sync/reset-dummy-year')) {
		return { data: scenario.reset };
	}
	if (url.includes('/runtime/term-authority/preview')) {
		return { data: scenario.termPreview };
	}
	if (url.includes('/runtime/term-authority/apply')) {
		return { data: { ...scenario.termPreview, applied: true, written: true } };
	}
	if (url.includes('/teaching-load/carry-forward/preview')) {
		return { data: scenario.carryPreview };
	}
	void method;
	return { data: {} };
}

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string, config?: { params?: unknown }) => {
			recorded.push({ method: 'get', url, params: config?.params });
			return responseFor(url, 'get');
		},
		post: async (url: string, body?: unknown) => {
			recorded.push({ method: 'post', url, body });
			return responseFor(url, 'post');
		},
		patch: async (url: string) => responseFor(url, 'patch' as 'get'),
		put: async (url: string) => responseFor(url, 'put' as 'get'),
		delete: async (url: string) => responseFor(url, 'delete' as 'get'),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { setLocalToken } = await import('@/lib/auth');
const { default: AdminYearSetup } = await import('@/pages/AdminYearSetup');
const { RolloverGuidanceCard } = await import('@/components/runtime/RolloverGuidanceCard');
const { PLAIN_INTRO, PLAIN_NEXT_STEP_LINE, PLAIN_SECONDARY_LABEL, plainStartedCopy } = await import('@/components/runtime/rollover-plain-copy');

const roots: any[] = [];
const hosts: HTMLElement[] = [];

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
}
afterEach(teardown);

async function renderPage(): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/admin/year-setup'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, createElement(AdminYearSetup as any)),
		));
	});
	await flush();
	return host;
}

async function renderNode(node: unknown, entry = '/'): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: [entry] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, node as any),
		));
	});
	await flush();
	return host;
}

async function flush() {
	for (let i = 0; i < 6; i += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

function reset() {
	recorded = [];
	scenario = makeScenario();
	dom.window.sessionStorage.clear();
	dom.window.localStorage.clear();
	setLocalToken('a7-year-setup-plain-words-token', false);
}

/**
 * Every word the operator can read.
 *
 * Read from `document.body`, NOT from the mount host: Radix renders `Dialog`
 * and `Select` content into a portal on `document.body`, so the ordered-terms
 * dialog and the reset dialog are on the same surface a person sees. Reading the
 * host alone would have "passed" the jargon ban on those two states while the
 * dialog was invisible to the test — a green row that skipped the state.
 */
function visibleText(): string {
	return (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function click(el: Element | null | undefined) {
	assert.ok(el, 'the control under test did not render');
	act(() => {
		el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
}

// ── Row 1: the jargon ban, over rendered text, in every reachable state ───────

/**
 * The words the operator must never have to decode. `EnrollPro` is deliberately
 * NOT here: the operator's own sentence uses it ("Start the new school year in
 * ATLAS after EnrollPro moves to it"), so naming it is plain, not leakage.
 */
const BANNED = ['sync', 'synced', 'mirror', 'election', 'drift', 'archive', 'archived', 'carry-forward', 'dummy'] as const;
/**
 * A7-C2 item 4 (2026-09-29): the guard's hole, closed.
 *
 * `'carry-forward'` did NOT catch the bare `carry` in `MATH: 2 carry · 1
 * skipped`, because the pre-fix panel wrote the bare word on that line, and
 * `'carry'` was never in the list. Neither was `'hard cap'`. Both are internal
 * distribution-band names that a scheduler cannot decode, so both are now
 * banned outright — including inside `carry-forward`, which the old entry
 * already covered and the new bare entry covers directly.
 */
const BANNED_BARE = ['carry', 'hard cap'] as const;
const BANNED_ALL = [...BANNED, ...BANNED_BARE] as readonly string[];
/** A raw database id rendered to a person. */
const RAW_ID = /#\d+/;

type StateSpec = {
	name: string;
	scenario: () => Scenario;
	/** Extra interaction before the text is read (e.g. open a dialog). */
	drive?: (host: HTMLElement) => Promise<void>;
};

const ARCHIVE_PREVIEW = {
	schoolId: SCHOOL_ID,
	enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL },
	atlasSchoolYearId: SCHOOL_YEAR_ID - 1,
	drift: baseStatus().drift,
	yearsToArchive: [{ schoolYearId: 7, yearLabel: '2020-2021', preservedCounts: { publishedGenerationRuns: 1, teachingLoadOwnerships: 30 } }],
	labelReconcileRequired: false,
	// The REAL server strings, kept technical on purpose: plain mode must not be
	// quoting them, and this is what proves it.
	summary: `Archive 2020-2021 (#7) as read-only history, then sync ${YEAR_LABEL} from EnrollPro. Nothing is deleted.`,
	syncPlan: `Faculty reconcile, section upsert, policy bootstrap, and mirror activation for ${YEAR_LABEL}.`,
};

const CARRY_PREVIEW = {
	schoolId: SCHOOL_ID,
	fingerprint: 'fp',
	sourceRevision: 'a',
	targetRevision: 'b',
	derivedDemandRevision: null,
	sourceYear: { enrollProSchoolYearId: 8, yearLabel: '2021-2022', cycle: { state: 'POPULATED', version: 3, ownershipCount: 4 } },
	targetYear: { enrollProSchoolYearId: 9, yearLabel: YEAR_LABEL, cycle: { state: 'EMPTY', version: 0, ownershipCount: 0 } },
	totals: { EXACT_CARRY: 2, ALREADY_OCCUPIED: 1, MISSING_FACULTY: 1, MISSING_SECTION: 0, NO_CURRENT_DEMAND: 0, UNQUALIFIED: 0, CAP_BLOCKED: 0, AMBIGUOUS: 0, OTHER: 0 },
	totalsSummary: { sourceRows: 4, carried: 2, skipped: 2 },
	before: { ownershipCount: 0, demandCount: 10, distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 } },
	after: { distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 }, overloadChanges: [] },
	perDepartment: [{ department: 'MATH', carry: 2, skipped: 2 }],
	adviserCoverage: { satisfied: 0, unsatisfied: 1 },
	rows: [
		{ sourceOwnershipId: 1, sourceFacultyExternalId: 1, sourceSubjectCode: 'MATH', sourceSectionExternalId: 1, reason: 'EXACT_CARRY', action: 'CARRY', targetSubjectCode: 'MATH', targetSectionExternalId: 1, targetSectionKey: '7:REGULAR:A', targetFacultyId: 9, targetFacultyName: 'Cruz, Ana', targetDepartment: 'MATH', weeklyMinutes: 240, detail: null },
		{ sourceOwnershipId: 2, sourceFacultyExternalId: 2, sourceSubjectCode: 'FIL', sourceSectionExternalId: 2, reason: 'ALREADY_OCCUPIED', action: 'SKIP', targetSubjectCode: 'FIL', targetSectionExternalId: 2, targetSectionKey: '7:REGULAR:B', targetFacultyId: 10, targetFacultyName: 'Reyes, Ana', targetDepartment: 'FIL', weeklyMinutes: 120, detail: null },
	],
	confirmationText: 'APPLY TEACHING LOAD CARRY-FORWARD',
	zeroWriteProof: { preview: true, writes: 0 },
	authorizesMutation: false,
};

const TERM_PREVIEW = {
	schoolId: SCHOOL_ID,
	schoolYearId: SCHOOL_YEAR_ID,
	yearLabel: YEAR_LABEL,
	mirrorId: 5,
	state: 'READY',
	code: null,
	message: SERVER_MESSAGES.termPreview,
	format: 'TRIMESTER',
	terms: [
		{ identity: 'Q-A', displayLabel: 'Opening Cycle', order: 1, startDate: null, endDate: null },
		{ identity: 'Q-B', displayLabel: 'Second Cycle', order: 2, startDate: null, endDate: null },
		{ identity: 'Q-C', displayLabel: 'Closing Cycle', order: 3, startDate: null, endDate: null },
	],
	liveSemanticRevision: 'r2',
	persistedSemanticRevision: 'r1',
	cachedAt: '2022-06-01T00:00:00.000Z',
	activeTermAvailability: 'NO_TERM_FOR_DATE',
	fingerprint: 'fp-2',
	confirmationText: 'SAVE_TERM_AUTHORITY_1_9',
	zeroWrite: true,
};

const RESET_RESULT = {
	...baseStatus({ canResetDummyYear: true, resetTargetSchoolYearId: SCHOOL_YEAR_ID, counts: { facultyCount: 3, sectionCount: 5, settingsReachable: true } }),
	previewOnly: true,
	resetApplied: false,
	reset: {
		targetSchoolYearId: SCHOOL_YEAR_ID,
		confirmationText: 'RESET_DUMMY_SCHOOL_YEAR_1',
		canResetDummyYear: true,
		publishedResetBlocked: false,
		teachingLoadResetRequired: true,
		counts: { sectionMirrors: 5, facultyPreferences: 4, preferenceTimeSlots: 0, preferenceReviews: 0, facultyRoomPreferences: 0, roomRequestAppeals: 0, roomRequestAppealHistory: 0, schedulingPolicies: 2, generationRuns: 1, publishedGenerationRuns: 0, manualScheduleEdits: 0, followUpFlags: 0, publishedScheduleRevisions: 0, auditLogs: 9, lockedSessions: 0, lockedSessionActions: 0, gradeShiftWindows: 0, facultySnapshots: 0, sectionSnapshots: 0, instructionalCohorts: 0, teachingLoadFacultySubjects: 6, teachingLoadOwnerships: 4 },
		blockers: [],
	},
};

const STATES: StateSpec[] = [
	{ name: 'checking', scenario: () => makeScenario({ noStatus: true }) },
	{ name: 'aligned', scenario: () => makeScenario({ status: { drift: { ...baseStatus().drift, status: 'aligned', message: SERVER_MESSAGES.aligned, recommendedAction: 'NONE' } } }) },
	{ name: 'atlas-stale (new year needs setup)', scenario: () => makeScenario() },
	{
		name: 'mapping-conflict (archive-shaped)',
		scenario: () => makeScenario({
			status: {
				drift: { ...baseStatus().drift, status: 'mapping-conflict', message: 'EnrollPro has moved to a new school year. Keep the old school year for reference, then start the new one in ATLAS.', recommendedAction: 'RUN_ARCHIVE_AND_SYNC' },
				conflicts: [{ code: 'YEAR_LABEL_MISMATCH', message: SERVER_MESSAGES.archiveConflict }],
			},
			archive: ARCHIVE_PREVIEW,
			classification: { classification: 'ARCHIVE_AND_SYNC_AVAILABLE', schoolId: SCHOOL_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL }, atlasSchoolYearId: SCHOOL_YEAR_ID - 1, conflictCode: 'YEAR_LABEL_MISMATCH', artifactCounts: null, blockers: [], confirmationText: 'RESET_DUMMY_SCHOOL_YEAR_1', message: 'EnrollPro has moved to a new school year. The old school year is kept for reference.', canClearTestData: false, testDataMarked: false },
		}),
	},
	{
		name: 'mapping-conflict (clear-shaped)',
		scenario: () => makeScenario({
			status: {
				drift: { ...baseStatus().drift, status: 'mapping-conflict', message: SERVER_MESSAGES.clearConflict, recommendedAction: 'RESET_DUMMY_YEAR' },
				conflicts: [{ code: 'SECTION_ID_COLLISION', message: `ATLAS already has section data for this school year, but it does not match EnrollPro ${YEAR_LABEL}.` }],
			},
			classification: { classification: 'TEST_DATA_RECOVERY_BLOCKED', schoolId: SCHOOL_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL }, atlasSchoolYearId: SCHOOL_YEAR_ID - 1, conflictCode: 'SECTION_ID_COLLISION', artifactCounts: { sectionMirrors: 5 }, blockers: [], confirmationText: 'RESET_DUMMY_SCHOOL_YEAR_1', message: SERVER_MESSAGES.clearConflict, canClearTestData: false, testDataMarked: false },
		}),
	},
	{
		name: 'enrollpro-unreachable',
		scenario: () => makeScenario({
			status: {
				enrollProActiveYear: null,
				drift: { status: 'enrollpro-unreachable', message: SERVER_MESSAGES.unreachable, recommendedAction: 'RETRY_ENROLLPRO', atlasSchoolYearId: SCHOOL_YEAR_ID - 1, enrollProSchoolYearId: null, enrollProSchoolYearLabel: null, mirrorSyncedAt: null },
			},
		}),
	},
	{
		name: 'carry-forward empty',
		scenario: () => makeScenario({ status: { archivedYears: [] } }),
	},
	{
		name: 'carry-forward with preview',
		scenario: () => makeScenario({ carryPreview: CARRY_PREVIEW }),
		drive: async (host) => {
			click(host.querySelector('[data-testid="carry-forward-preview-button"]'));
			await flush();
		},
	},
	{ name: 'archived list present', scenario: () => makeScenario() },
	{
		name: 'terms-repair dialog open',
		scenario: () => makeScenario({
			status: { termAuthority: { state: 'MISSING', code: null, message: 'The school year is current, but its ordered terms have not been saved in ATLAS yet.', persisted: false, persistedSemanticRevision: null, liveSemanticRevision: 'r2', cachedAt: null, termCount: 3, needsRepair: true, repairAction: 'PREVIEW_TERM_CACHE_SYNC', canPreview: true } },
			termPreview: TERM_PREVIEW,
		}),
		drive: async (host) => {
			click(host.querySelector('[data-testid="rollover-term-repair-action"]'));
			await flush();
		},
	},
	{
		name: 'reset advanced open',
		scenario: () => makeScenario({ status: { canResetDummyYear: true, resetTargetSchoolYearId: SCHOOL_YEAR_ID, counts: { facultyCount: 3, sectionCount: 5, settingsReachable: true } }, reset: RESET_RESULT }),
		drive: async (host) => {
			click(host.querySelector('[data-testid="rollover-reset-preview"]'));
			await flush();
		},
	},
];

test('row 1: no jargon reaches the operator in ANY reachable Year Setup state', async () => {
	for (const state of STATES) {
		reset();
		scenario = state.scenario();
		const host = await renderPage();
		if (state.drive) await state.drive(host);
		const text = visibleText();
		// A state that rendered NOTHING would pass this row vacuously. So each
		// state must first prove it put real content on the page.
		assert.ok(
			text.length > 40,
			`state "${state.name}": the page rendered ${text.length} characters of text, so the ban below would pass vacuously. Rendered: ${text}`,
		);
		assert.ok(
			host.querySelector('[data-testid="admin-year-setup-next-step"]') !== null || text.includes('Checking your access'),
			`state "${state.name}": the status card did not render, so nothing was checked. Rendered: ${text}`,
		);
		for (const word of BANNED_ALL) {
			const hit = new RegExp(`\\b${word}\\b`, 'i').exec(text);
			assert.equal(
				hit,
				null,
				`state "${state.name}": the page still shows the word "${word}"${hit ? `: …${text.slice(Math.max(0, hit.index - 60), hit.index + 60)}…` : '.'}`,
			);
		}
		assert.equal(
			RAW_ID.exec(text),
			null,
			`state "${state.name}": the page renders a raw database id: ${text}`,
		);
		// Leave no held request behind for the next state.
		releaseChecking();
		await flush();
	}
	assert.equal(
		STATES.length,
		11,
		`the ban must cover all 11 required states; this file drives ${STATES.length}: ${STATES.map((s) => s.name).join(' | ')}`,
	);
});

test('row 1 control: the ban really bites — the pre-fix copy fails it', () => {
	// A ban that cannot go red is not evidence. These are the exact pre-A7-C1
	// strings, fed to the same detector the row above uses.
	for (const legacy of [
		'Automatic year sync is off. Sync stays manual.',
		'Archive the old school year and sync the new one',
		'These years are read-only history. Their schedules, sections, and teaching-load data are preserved and never win the active-year election.',
		'Preview carry-forward',
		'Archived school years',
	]) {
		const hit = BANNED.find((word) => new RegExp(`\\b${word}\\b`, 'i').test(legacy));
		assert.ok(hit, `the detector missed the pre-fix copy "${legacy}"`);
	}
	assert.ok(RAW_ID.test('2020-2021 (#7) as read-only history'), 'the detector must catch a raw id');
});

test('row 1c (A7-C2 item 4): the ban also catches the bare words the old guard let through', () => {
	// The exact pre-A7-C2 distribution-block lines Lane C reported. Each must
	// be caught by the NEW entries specifically — a control that also tripped on
	// an old word would not show the hole was closed.
	for (const [legacy, mustBe] of [
		['MATH: 2 carry · 1 skipped', 'carry'],
		['Over hard cap: 3 → 1', 'hard cap'],
	] as const) {
		const hit = BANNED_BARE.find((word) => new RegExp(`\\b${word}\\b`, 'i').test(legacy));
		assert.equal(hit, mustBe, `"${legacy}" must be caught by the new bare-word ban, and by "${mustBe}"`);
		assert.equal(
			BANNED.includes(mustBe as typeof BANNED[number]),
			false,
			`"${mustBe}" was already covered by an old entry, so this control would prove nothing`,
		);
	}
	// And the whole list must still bite on the full pre-fix line.
	assert.ok(new RegExp(`\\bcarry\\b`, 'i').test('MATH: 2 carry · 1 skipped'));
	assert.ok(new RegExp(`\\bhard cap\\b`, 'i').test('Over hard cap: 3 → 1'));
});

// ── Row 2: the intro paragraph ───────────────────────────────────────────────

test('row 2: the intro is the plain two-sentence version, and none of the removed system phrasing survives', async () => {
	reset();
	scenario = makeScenario();
	const host = await renderPage();
	const intro = host.querySelector('[data-testid="admin-year-setup-intro"]');
	assert.ok(intro, 'the intro paragraph did not render');
	assert.equal(intro!.textContent?.trim(), PLAIN_INTRO, 'the intro is not the plain two-sentence paragraph');
	assert.equal(intro!.textContent?.trim(), 'Start the new school year in ATLAS after EnrollPro moves to it. Last year\'s schedules are kept for reference.');
	const sentences = intro!.textContent!.trim().split(/(?<=[.!?])\s+/);
	assert.ok(sentences.length <= 2, `the intro is ${sentences.length} sentences; the packet allows at most two`);
	for (const removed of ['read-only history', 'Normal setup pages link here', 'advanced destructive reset', 'disposable test data']) {
		assert.equal(intro!.textContent!.includes(removed), false, `the intro still contains the removed phrasing "${removed}"`);
	}
});

// ── Row 3: one primary action per card ───────────────────────────────────────

/** The `default` Button variant is the only one that paints `bg-primary`. */
function primaryControlsIn(root: Element | null): Element[] {
	if (!root) return [];
	return Array.from(root.querySelectorAll('button.bg-primary, a.bg-primary'));
}

test('row 3: exactly one primary action per card, and the primary names the year', async () => {
	for (const state of STATES.filter((entry) => entry.name !== 'checking')) {
		reset();
		scenario = state.scenario();
		const host = await renderPage();
		if (state.drive) await state.drive(host);

		const card = host.querySelector('[data-testid="rollover-guidance-card"]');
		assert.ok(card, `state "${state.name}": the status card did not render`);
		const primaries = primaryControlsIn(card);
		assert.ok(
			primaries.length <= 1,
			`state "${state.name}": the card renders ${primaries.length} primary controls (${primaries.map((el) => el.textContent?.trim()).join(' | ')}); one card gets one main action.`,
		);

		// Every interactive control is mouse-first sized (AGENTS.md §8).
		for (const control of Array.from(card!.querySelectorAll('button, a'))) {
			const className = control.getAttribute('class') ?? '';
			assert.ok(
				/min-h-11|h-10|h-8/.test(className),
				`state "${state.name}": control "${control.textContent?.trim()}" has no mouse-first target height (${className}).`,
			);
		}

		// When ATLAS knows the year, the main action must name it. It is located
		// by its PAINTED variant and its VISIBLE label, not by a guessed testid,
		// so this row states the claim instead of a string.
		const primary = primaries[0];
		if (primary && !state.name.startsWith('terms-repair')) {
			assert.ok(
				primary.textContent?.includes(YEAR_LABEL),
				`state "${state.name}": the main action "${primary.textContent?.trim()}" does not name ${YEAR_LABEL}.`,
			);
		}
		releaseChecking();
		await flush();
	}
});

test('row 3b: the one primary carries the year and the plain secondary is the calm read-only preview', async () => {
	reset();
	scenario = makeScenario();
	const host = await renderPage();
	const card = host.querySelector('[data-testid="rollover-guidance-card"]');
	assert.ok(card, 'the status card did not render');
	const primaries = primaryControlsIn(card);
	assert.equal(primaries.length, 1, `expected exactly one painted primary, found ${primaries.length}`);
	assert.equal(primaries[0].textContent?.trim(), `Start ${YEAR_LABEL} in ATLAS`);

	const secondary = host.querySelector('[data-testid="rollover-banner-preview"]');
	assert.ok(secondary, 'the plain secondary did not render');
	assert.equal(secondary!.textContent?.trim(), PLAIN_SECONDARY_LABEL);
	// Calm, not destructive: the safe read-only preview must not be painted as a
	// destructive action (A7-C1 §1.2). The `destructive` VARIANT paints
	// `bg-destructive/10` + `text-destructive`; the shared Button base carries
	// `aria-invalid:*destructive*` for the invalid state, which is not a painting,
	// so the check is on the variant's own surface and text colour.
	const className = secondary!.getAttribute('class') ?? '';
	assert.equal(
		/bg-destructive\/10/.test(className) || /(^|\s)text-destructive(\s|$)/.test(className),
		false,
		`the safe preview is painted as a destructive action: ${className}`,
	);
	assert.equal(/bg-primary/.test(className), false, `the secondary is painted as a second primary: ${className}`);
});

// ── Row 4: the self-link is gone ─────────────────────────────────────────────

test('row 4: no anchor points back at /admin/year-setup in any state', async () => {
	for (const state of STATES) {
		reset();
		scenario = state.scenario();
		const host = await renderPage();
		if (state.drive) await state.drive(host);
		const selfLinks = Array.from(dom.window.document.body.querySelectorAll('a[href="/admin/year-setup"]'));
		assert.equal(
			selfLinks.length,
			0,
			`state "${state.name}": the page links to itself ${selfLinks.length} time(s); "Year setup" on the Year Setup page is a circular link.`,
		);
		releaseChecking();
		await flush();
	}
});

// ── Row 5: the post-click confirmation, and no new request ───────────────────

test('row 5: driving the main action shows the year, the counts, and the next step — with no new request', async () => {
	reset();
	scenario = makeScenario();
	const host = await renderPage();

	assert.equal(host.querySelector('[data-testid="admin-year-setup-started"]'), null, 'the confirmation rendered before anything was applied');

	const primary = host.querySelector('[data-testid="rollover-banner-sync"]');
	assert.ok(primary, `the plain main action did not render in the new-year-needs-setup state. Rendered: ${visibleText().slice(0, 600)}`);
	click(primary);
	await flush();

	const confirmation = host.querySelector('[data-testid="admin-year-setup-started"]');
	assert.ok(confirmation, 'the post-click confirmation did not render');
	const text = confirmation!.textContent!.replace(/\s+/g, ' ');
	assert.ok(text.includes(`${YEAR_LABEL} is now the school year in ATLAS.`), `the confirmation does not name the year: ${text}`);
	assert.ok(text.includes('12 sections and 41 teachers were brought in from EnrollPro.'), `the confirmation does not carry the brought-in counts: ${text}`);
	assert.ok(text.includes(PLAIN_NEXT_STEP_LINE), `the confirmation does not give the next step: ${text}`);

	// The request list. The page reads rollover-status once on mount; the apply
	// itself is the second call, and the apply RESPONSE already carries
	// `counts` (`applyRolloverSync` returns `getRolloverStatus(includeCounts:true)`
	// — atlas-server/src/services/enrollpro-rollover.service.ts:1724). A7-C1 added
	// no request, and this row is what makes that claim falsifiable: the exact
	// list, with no post-apply reload.
	//
	// A5-C2A merge (2026-09-29): `/runtime/context` is in this list because
	// A5-C2A's `YearTruthBanner` on THIS page resolves the active year/term
	// through the canonical runtime context. That is a different feature from
	// A7-C1's plain-word copy, and it was added to the page by the A5-C2A lane,
	// not by A7-C1. The claim this row exists to falsify is still asserted below
	// in its own right: A7-C1's confirmation adds NO request, which is checked
	// separately against the pre-click list.
	const urls = recorded.map((call) => call.url);
	// A3-C14 (2026-09-29): this row used to assert the ORDERED list, with
	// `/runtime/context` before `/runtime/rollover-status`. A3-C14 moved
	// `YearTruthBanner` — the only source of `/runtime/context` on this page —
	// from above the status card to inside the page's "Details for IT" fold,
	// which is rendered below the card, so the two reads now mount in the other
	// order. The claim this row exists to falsify is "exactly these requests, no
	// post-apply reload", and that claim is about the MULTISET, not the order:
	// sorting both sides keeps every original failure mode (a missing request, an
	// extra request, a duplicate post-apply reload) and drops only the ordering
	// constraint that the layout change legitimately moved. The superseded
	// ordered literal is retained below so the change is additive evidence.
	assert.deepEqual(
		[...urls].sort(),
		[
			'/auth/me',
			'/runtime/context',
			'/runtime/rollover-status',
			'/runtime/rollover-sync/apply',
		].sort(),
		`the page must make exactly these requests: the session, A5-C2A's year/term read, the status read, and the apply - with no post-apply reload. Recorded: ${JSON.stringify(urls)}`,
	);
	assert.equal(
		JSON.stringify(urls),
		JSON.stringify(['/auth/me', '/runtime/rollover-status', '/runtime/context', '/runtime/rollover-sync/apply']),
		'SUPERSEDED 2026-09-29 by A3-C14: the pre-A3-C14 ORDER was /auth/me, /runtime/context, /runtime/rollover-status, '
			+ '/runtime/rollover-sync/apply. The fold moved the year/term read below the status card. The multiset row above '
			+ 'still fails on a missing, extra or duplicated request, which is what this row was written to catch.',
	);
	// A7-C1's own claim, isolated from A5-C2A's: nothing the confirmation did
	// added a request. Compared by SET so it stays true if the mount order shifts.
	const applyOnly = new Set(['/auth/me', '/runtime/context', '/runtime/rollover-status', '/runtime/rollover-sync/apply']);
	assert.deepEqual(
		[...new Set(urls)].sort(),
		[...applyOnly].sort(),
		`A7-C1 must not add a request: no URL outside the pre-existing set may appear. Recorded: ${JSON.stringify(urls)}`,
	);
});

test('row 5b: with no counts available the confirmation says so instead of inventing a number', () => {
	// STATED SCOPE, because a stronger claim than the harness is a rumour: this
	// branch is DEFENSIVE, and a count-less post-apply status is not a state the
	// apply path produces (the apply response always carries `counts`; the server
	// only omits them when EnrollPro is unreachable). So it is proved at the
	// function boundary against the REAL production function, not by inventing a
	// page state that cannot occur.
	for (const counts of [null, { sectionCount: null, facultyCount: null }]) {
		const lines = plainStartedCopy({
			yearLabel: YEAR_LABEL,
			sectionCount: counts?.sectionCount ?? null,
			facultyCount: counts?.facultyCount ?? null,
			keptYearLabels: ['2021-2022'],
		});
		const text = lines.join(' ');
		assert.ok(
			text.includes('Sections and teachers were brought in.'),
			`a count-less apply must say so in plain words: ${text}`,
		);
		assert.equal(
			/\d+ sections and \d+ teachers/.test(text),
			false,
			`a number was invented without a count: ${text}`,
		);
		assert.ok(text.includes(PLAIN_NEXT_STEP_LINE), `the next step is missing: ${text}`);
	}

	// And the real end-to-end confirmation carries the counts when they exist.
	const withCounts = plainStartedCopy({ yearLabel: YEAR_LABEL, sectionCount: 12, facultyCount: 41, keptYearLabels: [] });
	assert.ok(withCounts[1] === '12 sections and 41 teachers were brought in from EnrollPro.');
});

// ── Row 6: the non-plain mounts are byte-identical ───────────────────────────

test('row 6: without the new prop the card still renders today\'s strings (other lanes\' pages)', async () => {
	reset();
	const host = await renderNode(createElement(RolloverGuidanceCard as any, { schoolId: SCHOOL_ID }));
	// These are the pre-A7-C1 strings, verbatim from the base file.
	for (const legacy of [
		'Automatic year sync is off. Sync stays manual.',
		'Preview',
		'Year setup',
	]) {
		assert.ok(
			visibleText().includes(legacy),
			`the non-plain card lost the string "${legacy}". Dashboard, Sections, Faculty, TeachingLoad and the two timetable banners mount the card without the prop and must not change. Rendered: ${visibleText().slice(0, 600)}`,
		);
	}
	assert.equal(
		primaryControlsIn(host.querySelector('[data-testid="rollover-guidance-card"]')).length >= 1,
		true,
		'the non-plain card lost its primary control, which is a behaviour change, not a copy change',
	);
	assert.equal(host.querySelector('a[href="/admin/year-setup"]') !== null, true, 'the non-plain card lost its Year setup link, which other pages depend on to reach the reset surface');
});

// ── Row 7: the carry-forward card is safe by its own words ───────────────────

test('row 7: the "Start from last year" card states that nothing changes until confirmation', async () => {
	reset();
	scenario = makeScenario({ carryPreview: CARRY_PREVIEW });
	const host = await renderPage();
	const panel = host.querySelector('[data-testid="carry-forward-panel"]');
	assert.ok(panel, 'the carry-forward panel did not render');
	const text = panel!.textContent!.replace(/\s+/g, ' ');
	assert.ok(
		text.includes("Copy last year's teacher assignments into this year's Teaching Load as a starting point. Nothing changes until you choose to confirm."),
		`the panel does not tell the operator it is safe: ${text}`,
	);
	assert.ok(text.includes('See what would be copied'), `the preview action is not in plain words: ${text}`);
	assert.ok(text.includes('Which year to copy from'), `the year picker is not in plain words: ${text}`);

	click(host.querySelector('[data-testid="carry-forward-preview-button"]'));
	await flush();
	const summary = host.querySelector('[data-testid="carry-forward-summary"]');
	assert.ok(summary, 'the carry-forward summary did not render');
	const summaryText = summary!.textContent!.replace(/\s+/g, ' ');
	assert.ok(summaryText.includes('Nothing has been changed yet'), `the safety badge is not in plain words: ${summaryText}`);
	assert.ok(summaryText.includes('2 would be copied'), `the brought-in count is not in plain words: ${summaryText}`);
	assert.ok(summaryText.includes('Would be copied'), `the reason label is not in plain words: ${summaryText}`);
	assert.ok(summaryText.includes('teacher + subject slot'), `"target pair" is still on screen: ${summaryText}`);

	// And the machine contract survived the wording change.
	const reasonLabels = Array.from(host.querySelectorAll('[data-testid^="carry-forward-reason-"]')).map((el) => el.getAttribute('data-testid'));
	assert.deepEqual(reasonLabels.sort(), ['carry-forward-reason-ALREADY_OCCUPIED', 'carry-forward-reason-EXACT_CARRY', 'carry-forward-reason-MISSING_FACULTY']);
});

// ── A7-C2 item 4: the distribution block, in plain words ────────────────────

test('A7-C2 item 4: the distribution block is plain, and both numbers are the server numbers', async () => {
	reset();
	// A non-zero `overCap` on BOTH sides, so the sentence has to state a number
	// rather than fall through to a "no change" wording.
	scenario = makeScenario({ carryPreview: { ...CARRY_PREVIEW, before: { ...CARRY_PREVIEW.before, distribution: { ...CARRY_PREVIEW.before.distribution, overCap: 3 } }, after: { ...CARRY_PREVIEW.after, distribution: { ...CARRY_PREVIEW.after.distribution, overCap: 1 } } } });
	const host = await renderPage();
	click(host.querySelector('[data-testid="carry-forward-preview-button"]'));
	await flush();

	const overCap = host.querySelector('[data-testid="carry-forward-over-cap"]');
	assert.ok(overCap, 'the over-limit line did not render');
	const text = overCap!.textContent!.replace(/\s+/g, ' ').trim();
	assert.equal(
		/over the allowed teaching hours/.test(text),
		true,
		`the over-limit line is not a plain statement about teaching hours: ${text}`,
	);
	assert.ok(text.includes('1 teacher'), `the AFTER number is missing or wrong: ${text}`);
	assert.ok(text.includes('3 teachers'), `the BEFORE number is missing or wrong: ${text}`);
	assert.equal(/hard cap/i.test(text), false, `"hard cap" is still on screen: ${text}`);

	const dept = host.querySelector('[data-testid="carry-forward-department-MATH"]');
	assert.ok(dept, 'the per-department line did not render');
	const deptText = dept!.textContent!.replace(/\s+/g, ' ').trim();
	assert.equal(deptText, 'MATH: 2 would be copied · 2 would not be copied', `the bare "carry"/"skipped" pair is still on screen: ${deptText}`);
	assert.equal(/\bcarry\b/i.test(deptText), false, `"carry" is still on screen: ${deptText}`);

	// The REAL production function, not a transcription of it.
	const { overLimitSentence } = await import('@/components/runtime/CarryForwardReviewPanel');
	assert.equal(overLimitSentence(1, 1), '1 teacher would be over the allowed teaching hours.');
	assert.ok(overLimitSentence(0, 2).startsWith('2 teachers would be over'));
	assert.ok(overLimitSentence(5, 2).includes('was 5 teachers'));
});

// ── A7-C2 item 1: every school year is listed ───────────────────────────────

test('A7-C2 item 1: every school year is listed, including the one that is neither current nor kept', async () => {
	reset();
	const host = await renderPage();
	const card = host.querySelector('[data-testid="admin-year-setup-school-years"]');
	assert.ok(card, 'the every-year card did not render');
	const text = card!.textContent!.replace(/\s+/g, ' ');

	// The load-bearing row: year 10 is NOT the active year and NOT archived.
	// Before A7-C2 it had no row anywhere, which is the whole defect.
	const notKept = host.querySelector('[data-testid="year-setup-year-state-10"]');
	assert.ok(notKept, 'the past-not-yet-kept year has no row on the page');
	assert.equal(
		notKept!.textContent!.replace(/\s+/g, ' ').trim(),
		'2023-2024 is a past year with 3 published timetable(s) that you have not kept as history yet.',
		'the not-yet-kept year has no plain status sentence',
	);
	for (const [id, expected] of [[9, '2022-2023 is the school year ATLAS is using now.'], [8, '2021-2022 is already kept as history, with 2 published timetable(s).']] as const) {
		const cell = host.querySelector(`[data-testid="year-setup-year-state-${id}"]`);
		assert.ok(cell, `year ${id} has no row on the page`);
		assert.equal(cell!.textContent!.replace(/\s+/g, ' ').trim(), expected);
	}
	// One row per year, so the list is not a summary that hides a year. Matched
	// with an exact `year-setup-year-<digits>` id: a `^=` prefix selector would
	// also count the `year-setup-year-state-<id>` sentence and double the answer.
	const rowIds = Array.from(host.querySelectorAll('[data-testid]'))
		.map((el) => el.getAttribute('data-testid') ?? '')
		.filter((id) => /^year-setup-year-\d+$/.test(id));
	assert.deepEqual(rowIds.sort(), ['year-setup-year-10', 'year-setup-year-8', 'year-setup-year-9']);
});

// ── A7-C2 item 2: Keep as history, preview first ────────────────────────────

test('A7-C2 item 2: "Keep as history" previews first, in plain words, and needs an explicit confirmation', async () => {
	reset();
	const host = await renderPage();

	// The action exists ONLY for the year that is not yet kept.
	assert.equal(host.querySelector('[data-testid="year-setup-keep-10"]') !== null, true, 'the not-yet-kept year has no Keep as history action');
	for (const keptId of [9, 8]) {
		assert.equal(
			host.querySelector(`[data-testid="year-setup-keep-${keptId}"]`),
			null,
			`year ${keptId} must not offer a keep action; it is already current or kept`,
		);
	}

	click(host.querySelector('[data-testid="year-setup-keep-10"]'));
	await flush();

	// The dialog is a PORTAL, so it is read from `document.body` like row 1 does.
	assert.ok(
		dom.window.document.body.querySelector('[data-testid="year-setup-keep-dialog"]'),
		'the keep dialog did not open',
	);
	// PREVIEW FIRST: the only request so far is the zero-write preview.
	assert.deepEqual(
		recorded.filter((c) => c.url.includes('/rollover-archive/year/')).map((c) => c.url),
		['/runtime/rollover-archive/year/preview'],
		'the keep flow must PREVIEW before it can apply',
	);

	const dialogText = (dom.window.document.body.querySelector('[data-testid="year-setup-keep-dialog"]')!.textContent ?? '').replace(/\s+/g, ' ');
	assert.ok(dialogText.includes('Keep 2023-2024 as history?'), `the dialog does not name the year: ${dialogText}`);
	assert.ok(
		dialogText.includes('Nothing is deleted, and nothing in EnrollPro changes.'),
		`the dialog does not say plainly that nothing is deleted: ${dialogText}`,
	);
	assert.ok(
		dialogText.includes('Its sections, schedules and teaching load stay exactly as they are, read-only.'),
		`the dialog does not say what is kept: ${dialogText}`,
	);
	assert.ok(dialogText.includes('Yes, keep this year as history'), 'there is no explicit confirmation to click');

	// The apply is UNREACHABLE until the confirmation is given.
	const applyButton = dom.window.document.body.querySelector('[data-testid="year-setup-keep-apply"]') as HTMLButtonElement | null;
	assert.ok(applyButton, 'the apply button did not render');
	assert.equal(applyButton.disabled, true, 'the apply is reachable without the confirmation');

	click(dom.window.document.body.querySelector('[data-testid="year-setup-keep-confirm"]'));
	await flush();
	assert.equal(
		(dom.window.document.body.querySelector('[data-testid="year-setup-keep-apply"]') as HTMLButtonElement).disabled,
		false,
		'confirming did not enable the apply',
	);

	click(dom.window.document.body.querySelector('[data-testid="year-setup-keep-apply"]'));
	await flush();

	// The apply is the SECOND request, and the page reloads the real status
	// afterwards so the row flips from the server's answer, not local state.
	const urls = recorded.filter((c) => c.url.includes('/rollover-archive/year/') || c.url.includes('/runtime/rollover-status')).map((c) => c.url);
	assert.deepEqual(
		urls,
		[
			'/runtime/rollover-status',
			'/runtime/rollover-archive/year/preview',
			'/runtime/rollover-archive/year/apply',
			'/runtime/rollover-status',
		],
		`the keep flow must preview, apply, then reload the status: ${JSON.stringify(urls)}`,
	);
	assert.equal(
		dom.window.document.body.querySelector('[data-testid="year-setup-keep-dialog"]'),
		null,
		'the dialog stayed open after a successful keep',
	);
	assert.equal(
		host.querySelector('[data-testid="year-setup-keep-10"]'),
		null,
		'a kept year must not still offer the keep action',
	);
});

// ── A7-C2 item 3 / R6: the read-only links on every past-year row ───────────

test('A7-C2 item 3: every past-year row links read-only Teaching Load AND the past-year Timetable', async () => {
	reset();
	const host = await renderPage();

	// R6: the SAME `enrollProSchoolYearId` the existing Teaching Load link uses.
	assert.equal(
		host.querySelector('[data-testid="year-setup-tl-10"]')?.getAttribute('href'),
		'/teaching-load/history?schoolYearId=10',
		'the Teaching Load link changed destination or id',
	);
	assert.equal(
		host.querySelector('[data-testid="year-setup-tl-8"]')?.getAttribute('href'),
		'/teaching-load/history?schoolYearId=8',
		'the Teaching Load link changed destination or id',
	);

	// R6, flipped 2026-09-29. A2's route is live: the client reads
	// `location.search` at ScheduleReviewWorkspace and the server gates the read
	// through `resolvePastYearReadScope`. The id space is proved to be the same on
	// both sides by `a7-past-year-id-space-c2.test.ts` on the server.
	const { TIMETABLE_READS_SCHOOL_YEAR_PARAM } = await import('@/components/runtime/rollover-plain-copy');
	assert.equal(
		TIMETABLE_READS_SCHOOL_YEAR_PARAM,
		true,
		'the past-year timetable route is live, so the link must be offered; if the route regresses, set this back to false rather than shipping a link that shows the wrong year',
	);

	// Every PAST year gets the link, and it carries that year's own id — the id
	// space is the whole point, so assert the values, not just the count.
	assert.equal(
		host.querySelector('[data-testid="year-setup-timetable-10"]')?.getAttribute('href'),
		'/timetable?schoolYearId=10',
		'the past-year Timetable link must name the year it opens',
	);
	assert.equal(
		host.querySelector('[data-testid="year-setup-timetable-8"]')?.getAttribute('href'),
		'/timetable?schoolYearId=8',
		'the past-year Timetable link must name the year it opens',
	);

	// The fail-closed sentence is GONE now that the link is real. It must not
	// linger, or the page contradicts itself.
	assert.equal(
		host.querySelector('[data-testid="year-setup-timetable-unavailable-10"]'),
		null,
		'the fail-closed "cannot show a past school year yet" sentence is still shown next to a live link',
	);
	// A7-C3: the link is for PAST years only. Asked for the CURRENT year the
	// past-year scope answers with a notice, not a timetable, so linking it there
	// would be a control that goes nowhere.
	assert.equal(
		host.querySelector('[data-testid="year-setup-timetable-1"]'),
		null,
		'the current year must not be offered a past-year-scope Timetable link',
	);
	const anchors = Array.from(dom.window.document.body.querySelectorAll('a[href^="/timetable"]'));
	assert.equal(anchors.length, 2, 'one Timetable link per PAST year, and none for the current year');
	assert.equal(
		anchors.every((a) => /^\/timetable\?schoolYearId=\d+$/.test(a.getAttribute('href') ?? '')),
		true,
		'every Timetable link must be exactly /timetable?schoolYearId=<digits>, with no extra parameters',
	);
});

/**
 * The fail-closed half is retained rather than deleted. Evidence is additive
 * (AGENTS.md §16): the row above now asserts the link IS rendered, and this one
 * proves the guard still bites if the route ever stops honouring the parameter —
 * so a future regression turns RED instead of quietly shipping a lying link.
 */
test('A7-C2 R6 fail-closed: with the flag false the Timetable link disappears and the plain sentence returns', async () => {
	reset();
	const copy = await import('@/components/runtime/rollover-plain-copy');
	const original = copy.TIMETABLE_READS_SCHOOL_YEAR_PARAM;
	assert.equal(original, true, 'this control assumes the flag is currently true');
	// The flag is a module constant, so the honest control is over the exported
	// href helper, which is what the card actually consults.
	const hrefFor = copy.plainTimetableYearHref;
	assert.equal(hrefFor(10), '/timetable?schoolYearId=10', 'with the flag true the helper must return the link');
	// With no route the helper must return null, and the card then renders the
	// plain sentence. Proven by the same source path, asserted here so the two
	// halves cannot drift apart silently.
	const source = readFileSync(
		new URL('../runtime/SchoolYearListCard.tsx', import.meta.url),
		'utf8',
	);
	assert.ok(
		source.includes('PLAIN_TIMETABLE_YEAR_UNAVAILABLE'),
		'the card must still own the fail-closed sentence, so setting the flag back to false restores it',
	);
	// QA N2: the retained half is a SOURCE assertion and cannot prove the card
	// CALLS the helper. This pins the indirection — the card must branch on the
	// helper's RETURN VALUE, not read the flag itself — so a card that stopped
	// consulting the helper cannot pass on the strength of these two strings
	// alone. The render above proves the helper's return value reaches the DOM.
	// A full scoped re-render with the flag mocked to false is still owed and is
	// recorded as a follow-up row, not claimed here.
	assert.ok(
		/timetableHref\s*\?/.test(source),
		'the card must branch on plainTimetableYearHref()\'s return value, not on its own copy of the flag',
	);
	assert.equal(
		/\bTIMETABLE_READS_SCHOOL_YEAR_PARAM\b/.test(source),
		false,
		'the card must not read the flag directly; one source of truth is the whole point of the helper',
	);
});

// ── A7-C2 R5: the ordered-terms dialog sentence ─────────────────────────────

test('A7-C2 R5: the terms dialog explains itself in plain words and keeps the interlock byte-identical', async () => {
	reset();
	scenario = makeScenario({
		status: { termAuthority: { state: 'MISSING', code: null, message: 'The school year is current, but its ordered terms have not been saved in ATLAS yet.', persisted: false, persistedSemanticRevision: null, liveSemanticRevision: 'r2', cachedAt: null, termCount: 3, needsRepair: true, repairAction: 'PREVIEW_TERM_CACHE_SYNC', canPreview: true } },
		termPreview: TERM_PREVIEW,
	});
	const host = await renderPage();
	click(host.querySelector('[data-testid="rollover-term-repair-action"]'));
	await flush();

	const dialog = dom.window.document.body.querySelector('[data-testid="rollover-term-repair-dialog"]');
	assert.ok(dialog, 'the ordered-terms dialog did not open');
	const text = (dialog!.textContent ?? '').replace(/\s+/g, ' ');

	// R5: the SENTENCE is plain, and it says what saving does.
	assert.ok(
		!/Type .* to confirm/.test(text),
		`the instruction is still the pre-R5 sentence: ${text}`,
	);
	assert.ok(
		/press Save terms/i.test(text),
		`the plain instruction is missing: ${text}`,
	);
	assert.ok(
		/Saving stores only this school year/.test(text),
		`the dialog does not say what saving does: ${text}`,
	);
	// R5: the PHRASE is byte-identical, in a readable box of its own.
	const code = dialog!.querySelector('[data-testid="rollover-term-repair-code"]');
	assert.ok(code, 'the code is not presented in its own readable box');
	assert.equal(code!.textContent!.trim(), 'SAVE_TERM_AUTHORITY_1_9', 'the interlock phrase changed; that is not this lane\'s decision');
	// And the comparison against the server's confirmationText is untouched:
	// the field's placeholder is still that exact phrase.
	const input = dialog!.querySelector('#term-repair-confirmation') as HTMLInputElement | null;
	assert.ok(input, 'the confirmation input did not render');
	assert.equal(input!.getAttribute('placeholder'), 'SAVE_TERM_AUTHORITY_1_9');
});
