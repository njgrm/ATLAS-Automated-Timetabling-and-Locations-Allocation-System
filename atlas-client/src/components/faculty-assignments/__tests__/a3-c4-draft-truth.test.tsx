/**
 * A3-C4 — Teaching Load draft truth (walkthrough #7) and one word for
 * "not enough hours" (top-10 #10).
 *
 * DEFECT A — walkthrough #7 claimed: "Opening the teacher workload dialog
 * silently switches Teaching Load into a draft with Save enabled. A user
 * 'just looking' can save by accident." The packet requirement is verbatim:
 * "Enter draft only on a real change."
 *
 * VERDICT: NOT_REPRODUCED, with no product change. Two independent structural
 * facts make the reported path unreachable, and both were confirmed against the
 * production source:
 *
 *  1. `effectiveDraftAssignmentsByFaculty` (src/hooks/useTeachingLoadData.ts:758)
 *     is a FILTER OVER THE KEYS OF `draftAssignmentsByFaculty`. It cannot
 *     introduce a key that is not already in the draft map, so with an empty
 *     draft map `activeDraftCount` is 0 for any implementation whatsoever.
 *  2. Neither the dialog-open path nor a background section-summary refresh
 *     writes `setDraftAssignmentsByFaculty`. Only a real edit, and
 *     `applyGlobalMutableSnapshot` (undo/redo), do.
 *
 *  A background refresh can therefore change the sectionMap a draft is
 *  normalised against, but it can never be the ORIGIN of a draft entry.
 *
 *  WHAT THESE CONTROLS ARE, PRECISELY: they are the negative half — proof that
 *  the non-operator actions the finding names leave the draft set untouched —
 *  against a hook that is genuinely loaded and writable. They are NOT proof of
 *  a fix, because no fix was made and none is needed. No speculative guard flag
 *  was added to production code to make a test pass.
 *
 * F1 CORRECTION (QA: "the six Defect A controls are vacuous") — BRANCH TAKEN:
 * FIXED HARNESS, not honest relabelling. The previous revision of this file was
 * green on every control while the hook had loaded NOTHING, so the controls
 * could not fail. Two independent fixture defects caused it:
 *
 *  (a) the JSDOM globals never exposed `sessionStorage` / `localStorage`, and
 *      `getPreferredAccessToken` reads a BARE `sessionStorage` inside a silent
 *      try/catch (src/lib/auth.ts:82). The seeded token was never stored, so
 *      `resolveActorSchoolId` bailed at its no-session guard
 *      (src/lib/settings.ts:543) without ever dispatching `/auth/me`;
 *  (b) the `/auth/me` fixture returned the user fields at the top level, but
 *      `resolveActorSchoolId` reads `data.user.schoolId`
 *      (src/lib/settings.ts:569) and fails closed without that envelope.
 *
 *  Both are fixed. `assertLoadedWritableScope()` now asserts the precondition
 *  that was previously only claimed in prose (faculty loaded, subjects loaded,
 *  sectionMap populated, settled, writable), and A1 additionally proves the
 *  DRAFT GATE by flipping Save from disabled to enabled with one real draft.
 *  `settle()` waits for the loaded state instead of flushing a fixed number of
 *  turns. Every control was then shown to go RED under two mutations; see the
 *  handoff for the literal before/after hashes. A5 additionally had to gain a
 *  NON-EMPTY draft map: with an empty one the mutated loop never executes, which
 *  is why QA's mutation left it green.
 *
 * DEFECT B — the below-standard status label becomes the single word "Under".
 * Rationale: one plain word, no jargon, and the existing help text still
 * supplies the standard ("below the 20h standard"), so nothing is lost.
 * "Wide span" is a DIFFERENT concept (subject span, not hours) and is left
 * alone — see B4. The sweep is closed everywhere except two sites a PINNED test
 * contractually forbids moving; B6 names both with file:line.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement, useEffect, useState } from 'react';
import { JSDOM } from 'jsdom';
import { mock } from 'node:test';
// Type-only, so it is erased at transform time and cannot disturb the
// `mock.module` ordering below.
import type { FacultyAssignmentDraft } from '@/lib/faculty-assignment-helpers';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teaching-load',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
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
	// F1 — SECOND INDEPENDENT DEFECT. `getPreferredAccessToken` reads a BARE
	// `sessionStorage` global (src/lib/auth.ts:82) and every read/write is
	// wrapped in a silent try/catch. Without these two globals the seeded token
	// was never stored, `getPreferredAccessToken()` returned null, and
	// `resolveActorSchoolId` bailed out at its "no session" guard
	// (src/lib/settings.ts:543) WITHOUT EVER DISPATCHING /auth/me — so fixing the
	// response shape alone still loaded nothing.
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

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

/* ------------------------------------------------------------------ *
 * Transport stub.
 *
 * `useTeachingLoadData` resolves its scope through `resolveActorSchoolId`
 * (`/auth/me`) and `resolveActiveSchoolYearContext`, then reads four feeds.
 * We stub the transport at `@/lib/api` — the ONE module every one of those
 * reads goes through — so the hook itself runs its real production code
 * (scope binding, normalisation, the draft memo, the history hook) rather
 * than a transcription of it.
 * ------------------------------------------------------------------ */
const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 1;

const SECTIONS_V1 = [
	{ id: 11, name: 'Grade 7 - A', gradeLevel: 7, displayOrder: 1, schoolId: SCHOOL_ID },
	{ id: 12, name: 'Grade 7 - B', gradeLevel: 7, displayOrder: 2, schoolId: SCHOOL_ID },
];
const SECTIONS_V2 = [
	// A background refresh that DROPS a section the saved assignment points at.
	{ id: 11, name: 'Grade 7 - A', gradeLevel: 7, displayOrder: 1, schoolId: SCHOOL_ID },
];

const SUBJECTS = [
	{ id: 101, code: 'MATH', name: 'Mathematics', schoolId: SCHOOL_ID, isActive: true },
	{ id: 102, code: 'FIL', name: 'Filipino', schoolId: SCHOOL_ID, isActive: true },
	{ id: 103, code: 'HG', name: 'Homeroom', schoolId: SCHOOL_ID, isActive: true },
];

/** Saved state: faculty 9 owns MATH 7-A; faculty 10 owns FIL 7-B. */
function facultySnapshot() {
	return {
		faculty: [
			{
				id: 9, firstName: 'Maria', lastName: 'Dela Cruz', department: 'Mathematics',
				employmentStatus: 'REGULAR', employeeId: 'EMP-0009', isActiveForScheduling: true,
				isClassAdviser: false, isPlaceholder: false, maxHoursPerWeek: 40,
				assignments: [
					{ subjectId: 101, sectionIds: [11], gradeLevels: [7] },
					{ subjectId: 102, sectionIds: [12], gradeLevels: [7] },
				],
			},
			{
				id: 10, firstName: 'Ana', lastName: 'Reyes', department: 'Filipino',
				employmentStatus: 'REGULAR', employeeId: 'EMP-0010', isActiveForScheduling: true,
				isClassAdviser: false, isPlaceholder: false, maxHoursPerWeek: 40,
				assignments: [{ subjectId: 102, sectionIds: [12], gradeLevels: [7] }],
			},
		],
		ownershipIndex: [],
		coverageTotals: undefined,
		integrityDiagnostics: undefined,
		workloadPolicy: {
			status: 'CONFIGURED',
			teachingStandardHours: 20,
			advisoryCreditHours: 0,
			minimumLoadHours: 20,
			maxHoursPerWeek: 40,
		},
		workloadPolicyStatus: 'CONFIGURED',
		fetchedAt: '2026-09-28T00:00:00.000Z',
	};
}

/** Mutable so a control can land a background refresh with a different map. */
const state = { sections: SECTIONS_V1 };

function responseFor(url: string) {
	if (url.includes('/auth/me')) {
		// F1 — THE ROOT CAUSE OF THE VACUOUS HARNESS.
		//
		// `resolveActorSchoolId` reads `data.user.schoolId`
		// (src/lib/settings.ts:569) and fails CLOSED to `null` when that envelope
		// is absent. The pre-correction fixture returned the user fields at the
		// TOP level, so every control in this file ran against a hook that had
		// resolved no actor school at all: faculty 0, subjects 0, sectionMap 0,
		// readOnly true, and a permanently zero draft count. Six green controls
		// that were green because no data existed were not a guard.
		return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'SCHEDULER', schoolYearId: SCHOOL_YEAR_ID, activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2026-2027' } } };
	}
	if (url.includes('/runtime/context')) {
		// `enrollpro-verified` is what makes `isUpstreamBackedSchoolYearSource`
		// true for the resolved year. Together with a sections `source` of
		// 'enrollpro' below, the hook then settles on `dataSource === 'live'`.
		return { data: { schoolId: SCHOOL_ID, activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2026-2027', source: 'enrollpro-verified', stale: false, resolvedAt: '2026-09-28T00:00:00.000Z', evidence: [] } };
	}
	if (url.includes('/settings/active-school-year')) {
		return { data: { activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2026-2027', source: 'api' } };
	}
	if (url.includes('/faculty-assignments/summary')) {
		return { data: facultySnapshot() };
	}
	if (url.includes('/sections/summary/')) {
		// The `source: 'enrollpro'` is load-bearing for the same live-scope reason.
		return { data: {
			schoolId: SCHOOL_ID,
			schoolYearId: SCHOOL_YEAR_ID,
			totalSections: state.sections.length,
			totalEnrolled: 0,
			byGradeLevel: {},
			enrolledByGradeLevel: {},
			source: 'enrollpro',
			sourceMode: 'enrollpro',
			sections: state.sections,
			fetchedAt: '2026-09-28T00:00:00.000Z',
		} };
	}
	if (url.includes('/sections/assigned-classes')) {
		return { data: { sections: [] } };
	}
	if (url.includes('/subjects')) {
		return { data: { subjects: SUBJECTS } };
	}
	if (url.includes('/homeroom-hint')) {
		return { data: { subjectId: 103, sectionId: null } };
	}
	return { data: {} };
}

const apiUrl = import.meta.resolve('@/lib/api');
mock.module(apiUrl, {
	defaultExport: {
		get: async (url: string) => responseFor(url),
		post: async (url: string) => responseFor(url),
		patch: async (url: string) => responseFor(url),
		put: async (url: string) => responseFor(url),
		delete: async (url: string) => responseFor(url),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
// Seed a real session token so the PRODUCTION `resolveActorSchoolId` succeeds
// against the stubbed transport. The resolvers are left real on purpose: the
// finding is about the draft state machine, and mocking the resolver would
// mean the scope binding under test is not the real one.
const { setLocalToken } = await import('@/lib/auth');
setLocalToken('a3-c4-draft-truth-token', false);
// The REAL hook under test. Everything below composes it; nothing retypes it.
const { useTeachingLoadData } = await import('@/hooks/useTeachingLoadData');
// The REAL production dialog opener named by the finding.
const { openTeacherReview } = await import('@/components/faculty-assignments/teacherReviewEntry');
// The REAL component that owns the Save gate the finding names.
const { TeachingLoadDraftActionBar } = await import('@/components/faculty-assignments/TeachingLoadDraftActionBar');
// The REAL filter bar, which renders the below-standard copy (defect B).
const { TeachingLoadFilterBar } = await import('@/components/faculty-assignments/TeachingLoadFilterBar');
const { BELOW_STANDARD_LABEL } = await import('@/lib/teaching-load-labels');

const roots: any[] = [];
const hosts: HTMLElement[] = [];

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
}
afterEach(teardown);

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/teaching-load'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, node),
		));
	});
	return host;
}

async function flush() {
	await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
	await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

/* ================================================================== *
 * DEFECT A — the mandatory control.
 *
 * A host that mounts the REAL hook, publishes the real `activeDraftCount`,
 * renders the REAL `TeachingLoadDraftActionBar`, and exposes the REAL
 * `openTeacherReview` wired to real view-mode + dialog state, exactly as
 * `pages/TeachingLoad.tsx:583` wires it.
 * ================================================================== */
type HostHandle = {
	activeDraftCount: number;
	activeDraftKeys: number[];
	facultyCount: number;
	subjectCount: number;
	sectionCount: number;
	sectionMapSize: number;
	loading: boolean;
	isReadOnlyMode: boolean;
	dataSource: string;
	error: string | null;
	viewMode: 'teacher' | 'allocation';
	dialogOpen: boolean;
	openReview: () => void;
	setViewMode: (m: 'teacher' | 'allocation') => void;
	changeSelection: () => void;
	refresh: () => Promise<void>;
	pushHistory: () => void;
	/** The hook's OWN setter — the same one `pages/TeachingLoad.tsx` uses on a real edit. */
	seedDraft: (draft: Record<number, FacultyAssignmentDraft[]>) => void;
	canUndo: boolean;
	canRedo: boolean;
	handleUndo: () => void;
	handleRedo: () => void;
};

let handle: HostHandle | null = null;

function TeachingLoadDraftTruthHost() {
	const data = useTeachingLoadData();
	const [viewMode, setViewMode] = useState<'teacher' | 'allocation'>('teacher');
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		handle = {
			activeDraftCount: data.activeDraftCount,
			// The KEYS, not just the count: "is faculty 10 a draft?" and "is
			// faculty 9 a draft?" are different questions, and a count alone
			// cannot tell them apart. A5 needs the distinction.
			activeDraftKeys: Object.keys(data.effectiveDraftAssignmentsByFaculty)
				.map(Number)
				.sort((left, right) => left - right),
			facultyCount: data.faculty.length,
			subjectCount: data.subjects.length,
			sectionCount: data.allKnownSections.length,
			sectionMapSize: data.sectionMap.size,
			loading: data.loading,
			isReadOnlyMode: data.isReadOnlyMode,
			dataSource: data.dataSource,
			error: data.error,
			viewMode,
			dialogOpen,
			// The REAL opener, the REAL setters — the page's own wiring.
			openReview: () => openTeacherReview({ setViewMode, setReviewModalOpen: setDialogOpen }),
			setViewMode,
			changeSelection: () => data.setSelectedId(10),
			refresh: () => data.fetchData({ forceRefresh: true }),
			pushHistory: data.pushHistory,
			seedDraft: (draft) => data.setDraftAssignmentsByFaculty(draft),
			canUndo: data.canUndo,
			canRedo: data.canRedo,
			handleUndo: data.handleUndo,
			handleRedo: data.handleRedo,
		};
	});

	/*
	 * FIX 40: `TeachingLoadDraftActionBar` is now an inline toolbar group rather
	 * than a bottom sticky footer, and its props changed with it:
	 *
	 *   - `canRedo` / `onRedo` ADDED. Redo was unreachable in the footer, so the
	 *     real redo stack behind `data.canRedo` / `data.handleRedo` had no
	 *     control at all. A6's controls below already exercise both, and the
	 *     component now receives them.
	 *   - `statusMessage` / `writeBlockedReason` REMOVED. They rendered the
	 *     footer-only `DRAFT STATUS` heading and its helper paragraph. The page
	 *     still owns `draftStatusMessage` (it feeds the toasts); only the footer
	 *     that displayed it is gone.
	 *
	 * `onSave` is a no-op here: on the real page it OPENS a confirmation rather
	 * than committing, and A6's own suite renders the real confirmation. What
	 * this suite owns is the DRAFT GATE — the `disabled` state — and that is
	 * entirely a function of `activeDraftCount`, `saving` and `isReadOnlyMode`.
	 */
	return createElement(TeachingLoadDraftActionBar as any, {
		activeDraftCount: data.activeDraftCount,
		canUndo: data.canUndo,
		canRedo: data.canRedo,
		isReadOnlyMode: data.isReadOnlyMode,
		saving: data.saving,
		onUndo: data.handleUndo,
		onRedo: data.handleRedo,
		onDiscard: () => {},
		onSave: () => {},
	});
}

/**
 * The Save button's disabled state, read from the REAL rendered component.
 *
 * FIX 40 note: the bar is an inline toolbar group now, so it lives inside the
 * filter row in production. This host still renders the bar directly, which is
 * correct for what it measures — the DRAFT GATE, which is a function of the bar's
 * own props and has nothing to do with where the bar is mounted. The mount
 * position is pinned by A6's `a6-teaching-load-surface.test.tsx`.
 *
 * `/Save/` still matches the button: the operator's label is exactly
 * `Save changes` (deliberately not the old count-bearing `Save 3` form), and
 * this helper asserts a DISABLED STATE, not a string.
 */
function saveButtonIsDisabled(host: HTMLElement): boolean {
	const bar = host.querySelector('[data-testid="teaching-load-draft-action-bar"]');
	assert.ok(bar, 'the real draft action bar must render');
	const save = Array.from(bar!.querySelectorAll('button')).find((b) => /Save/.test(b.textContent ?? ''));
	assert.ok(save, `a Save button must render; saw: ${Array.from(bar!.querySelectorAll('button')).map((b) => JSON.stringify(b.textContent)).join(', ')}`);
	return (save as HTMLButtonElement).disabled;
}

/**
 * Wait for the REAL load to finish rather than for a fixed number of turns.
 * "Flush a few times" is what let a never-resolving scope look like a settled
 * one; this asserts the loaded state the controls depend on.
 */
async function settle(): Promise<void> {
	for (let i = 0; i < 40; i += 1) {
		await flush();
		if (handle && !handle.loading && handle.facultyCount > 0 && handle.sectionMapSize > 0) return;
	}
	assert.ok(handle, 'the host must have published its handle');
}

/**
 * THE PRECONDITION EVERY DEFECT A CONTROL DEPENDS ON, asserted once and reused.
 *
 * `isReadOnlyMode = !canPersistAssignments`, and `canPersistAssignments` needs a
 * resolved scope plus real faculty/subject/section evidence. The pre-correction
 * fixture resolved no scope, so Save was disabled by READ-ONLY MODE and A1's
 * claim that it exercised the DRAFT GATE was false.
 */
function assertLoadedWritableScope(): void {
	assert.ok(handle!.facultyCount > 0, `the hook must LOAD faculty; saw ${handle!.facultyCount}`);
	assert.ok(handle!.subjectCount > 0, `the hook must LOAD subjects; saw ${handle!.subjectCount}`);
	assert.ok(handle!.sectionMapSize > 0, `sectionMap must be POPULATED; saw size ${handle!.sectionMapSize}`);
	assert.equal(handle!.loading, false, 'the initial load must have settled');
	assert.equal(handle!.isReadOnlyMode, false, 'a loaded scope is writable, so Save is gated ONLY by the draft count');
	assert.notEqual(handle!.dataSource, 'none', 'the load must resolve, not fall into the empty error branch');
	assert.equal(handle!.error, null, `a loaded scope carries no error; saw ${JSON.stringify(handle!.error)}`);
}

/**
 * Faculty 9's saved state is MATH 7-A + FIL 7-B. Moving FIL from 7-B to 7-A is
 * a REAL edit, so it is a real draft — the baseline every control perturbs.
 */
const GENUINE_EDIT_9 = [
	{ subjectId: 101, sectionIds: [11], gradeLevels: [7] },
	{ subjectId: 102, sectionIds: [11], gradeLevels: [7] },
];

/**
 * Faculty 10's saved state is FIL 7-B. This entry ALSO points at section 99,
 * which is in no section map on either side of the refresh. Normalisation drops
 * an unknown section id, so on the healthy path this draft collapses onto the
 * saved signature and is NOT a draft at all.
 *
 * That is the whole point: A5's defect class is a RAW-vs-NORMALISED signature
 * asymmetry. A control can only detect that asymmetry if some input differs
 * before and after normalisation — and with the pre-correction empty draft map
 * the loop in `effectiveDraftAssignmentsByFaculty` never executed at all.
 */
const PHANTOM_EDIT_10 = [
	{ subjectId: 102, sectionIds: [12, 99], gradeLevels: [7] },
];

async function seedDraft(draft: Record<number, FacultyAssignmentDraft[]>) {
	await act(async () => { handle!.seedDraft(draft); });
	await flush();
}

test('A1 CONTROLLING: the real hook loads a WRITABLE scope, and the draft gate alone disables Save', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assertLoadedWritableScope();

	// The draft gate, on its own, with no read-only mode in the way.
	assert.equal(handle!.activeDraftCount, 0, 'a freshly loaded scope has no drafts');
	assert.deepEqual(handle!.activeDraftKeys, [], 'a freshly loaded scope attributes no drafts');
	assert.equal(saveButtonIsDisabled(host), true, 'Save must be disabled before any operator action');

	// ... and one real draft through the hook's OWN setter flips it. This is the
	// assertion the old harness could not make: under the pre-correction fixture
	// `isReadOnlyMode` was true, so Save stayed disabled and "the draft gate" was
	// never exercised at all.
	await seedDraft({ 9: GENUINE_EDIT_9 });
	assert.equal(handle!.activeDraftCount, 1, 'a genuine edit is a draft');
	assert.deepEqual(handle!.activeDraftKeys, [9], 'the draft is attributed to the edited faculty');
	assert.equal(saveButtonIsDisabled(host), false, 'Save must enable on a real draft in a writable scope');
});

test('A2: opening the workload dialog alone must NOT create a draft (walkthrough #7)', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assertLoadedWritableScope();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft before the dialog opens');

	// The exact action the finding names: "just looking" at the workload dialog.
	await act(async () => { handle!.openReview(); });
	await flush();

	assert.equal(handle!.dialogOpen, true, 'precondition: the dialog actually opened');
	assert.equal(
		handle!.activeDraftCount,
		0,
		'OPENING THE DIALOG must not enter draft mode — "Enter draft only on a real change."',
	);
	assert.equal(saveButtonIsDisabled(host), true, 'Save must stay disabled after a dialog open');

	// The same claim, now with a draft already on the board so the observation is
	// not trivially satisfied: opening the dialog must not ADD to a real draft
	// set, which is what a "silently switches into a draft" regression looks like
	// when an operator already has work in progress.
	await seedDraft({ 9: GENUINE_EDIT_9 });
	assert.equal(handle!.activeDraftCount, 1, 'precondition: a real draft exists before the dialog re-opens');
	await act(async () => { handle!.openReview(); });
	await flush();
	assert.deepEqual(
		handle!.activeDraftKeys,
		[9],
		'OPENING THE DIALOG must not attribute a draft to anyone the operator did not edit',
	);
	assert.equal(handle!.activeDraftCount, 1, 'the dialog must not change the draft count');
});

test('A3: switching view mode alone must NOT create a draft', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assertLoadedWritableScope();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft before the view switch');

	for (const mode of ['allocation', 'teacher'] as const) {
		await act(async () => { handle!.setViewMode(mode); });
		await flush();
		assert.equal(handle!.activeDraftCount, 0, `view mode "${mode}" must not enter draft mode`);
		assert.equal(saveButtonIsDisabled(host), true, `Save must stay disabled in "${mode}" mode`);
	}

	await seedDraft({ 9: GENUINE_EDIT_9 });
	for (const mode of ['allocation', 'teacher'] as const) {
		await act(async () => { handle!.setViewMode(mode); });
		await flush();
		assert.deepEqual(handle!.activeDraftKeys, [9], `view mode "${mode}" must not touch a real draft set`);
		assert.equal(handle!.activeDraftCount, 1, `view mode "${mode}" must not change the draft count`);
	}
});

test('A4: changing the selected teacher alone must NOT create a draft', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assertLoadedWritableScope();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft before the selection change');

	await act(async () => { handle!.changeSelection(); });
	await flush();

	assert.equal(handle!.activeDraftCount, 0, 'changing selection must not enter draft mode');
	assert.equal(saveButtonIsDisabled(host), true, 'Save must stay disabled after a selection change');

	await seedDraft({ 9: GENUINE_EDIT_9 });
	await act(async () => { handle!.changeSelection(); });
	await flush();
	assert.deepEqual(handle!.activeDraftKeys, [9], 'changing selection must not touch a real draft set');
	assert.equal(handle!.activeDraftCount, 1, 'changing selection must not change the draft count');
});

test('A5 DISCRIMINATING: a background section-summary refresh must neither manufacture nor drop a draft entry', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assertLoadedWritableScope();
	assert.equal(handle!.sectionMapSize, 2, 'precondition: both sections are mapped before the refresh');

	await seedDraft({ 9: GENUINE_EDIT_9, 10: PHANTOM_EDIT_10 });
	// Faculty 9's edit is real. Faculty 10's entry normalises onto its saved
	// signature, so it is NOT a draft — and the control can now tell the
	// difference instead of observing an empty map and concluding "no change".
	assert.equal(handle!.activeDraftCount, 1, 'precondition: exactly one genuine draft');
	assert.deepEqual(handle!.activeDraftKeys, [9], 'precondition: only the genuine edit is a draft');

	// A refresh that lands a DIFFERENT section map — the sharpest form of the
	// "normalisation difference with no operator action" question. Section 12
	// disappears, so faculty 10's saved FIL 7-B normalises to nothing. If the
	// page created a draft from that, it would be reporting a change nobody made.
	state.sections = SECTIONS_V2;
	await act(async () => { await handle!.refresh(); });
	await flush();
	assert.equal(handle!.sectionMapSize, 1, 'precondition: the refresh really changed the section map');

	assert.deepEqual(
		handle!.activeDraftKeys,
		[9],
		'a background refresh must neither add nor drop a draft entry; nobody edited anything',
	);
	assert.equal(handle!.activeDraftCount, 1, 'a background refresh must not create a draft entry');
	assert.equal(saveButtonIsDisabled(host), false, 'the genuine draft still stands after the refresh');
});

test('A6: undo and redo must not create a draft — with EMPTY stacks and with a REAL one', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assertLoadedWritableScope();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft');

	// Both history handlers come from the real hook; call them directly with no
	// operator edit ever having happened.
	assert.equal(handle!.canUndo, false, 'precondition: the undo stack is empty');
	assert.equal(handle!.canRedo, false, 'precondition: the redo stack is empty');

	await act(async () => { handle!.handleUndo(); });
	await flush();
	assert.equal(handle!.activeDraftCount, 0, 'undo with an empty stack must not create a draft');

	await act(async () => { handle!.handleRedo(); });
	await flush();
	assert.equal(handle!.activeDraftCount, 0, 'redo with an empty stack must not create a draft');
	assert.equal(saveButtonIsDisabled(host), true, 'Save must stay disabled after empty undo/redo');

	// The same claim against a NON-empty stack, which is where undo can actually
	// change something. `pushHistory` is the real pre-edit call the page makes.
	await act(async () => { handle!.pushHistory(); });
	await flush();
	assert.equal(handle!.canUndo, true, 'precondition: the real push made the undo stack non-empty');
	await seedDraft({ 9: GENUINE_EDIT_9 });
	assert.equal(handle!.activeDraftCount, 1, 'precondition: a real draft is on the board');

	await act(async () => { handle!.handleUndo(); });
	await flush();
	assert.equal(handle!.activeDraftCount, 0, 'undo must REVERT the draft, not add one');
	assert.deepEqual(handle!.activeDraftKeys, [], 'undo must not attribute a draft to anyone');
	assert.equal(saveButtonIsDisabled(host), true, 'Save must go back to disabled once the draft is reverted');

	// Redo replays the snapshot captured at undo time — the pre-undo state, which
	// is faculty 9's genuine edit. It must restore THAT and nobody else: a redo
	// that manufactured a second draft entry would be the walkthrough #7 defect in
	// a different costume.
	await act(async () => { handle!.handleRedo(); });
	await flush();
	assert.deepEqual(
		handle!.activeDraftKeys,
		[9],
		'redo must restore the one genuine edit and attribute no other draft',
	);
	assert.equal(handle!.activeDraftCount, 1, 'redo round-trips the real edit without inventing drafts');
});

/* ================================================================== *
 * DEFECT B — one word for "not enough hours".
 * ================================================================== */

test('B1: the canonical below-standard label is the single word "Under"', async () => {
	assert.equal(
		BELOW_STANDARD_LABEL,
		'Under',
		'the canonical below-standard label must be exactly one plain word',
	);
	assert.ok(!/\s/.test(BELOW_STANDARD_LABEL), '"Under" must not gain a second word');
});

test('B2 FAILING-FIRST GUARD: no in-fence Teaching Load surface still says "Below standard"', () => {
	// The fence the planner set: `components/faculty-assignments/**`.
	const files = [
		'TeachingLoadFilterBar.tsx',
		'WorkloadInspector.tsx',
		'TeacherLoadReadout.tsx',
		'StackedWorkloadBar.tsx',
		'TeachingLoadTruthPanel.tsx',
		'TeachingLoadRepairQueue.tsx',
		'WorkspaceToolbar.tsx',
		'TeacherGridMode.tsx',
		'SectionGridMode.tsx',
		'SubjectRow.tsx',
		'TeachingLoadHistoryView.tsx',
		'TeachingLoadCandidateDiagnostics.tsx',
		'GradeBadge.tsx',
		'AutoFillSummaryModal.tsx',
		'SectionInspector.tsx',
	];
	for (const file of files) {
		const source = read(`src/components/faculty-assignments/${file}`);
		assert.doesNotMatch(
			source,
			/['"`]Below standard['"`]/,
			`${file} must use the canonical BELOW_STANDARD_LABEL, not the literal "Below standard"`,
		);
	}
});

test('B3: the real filter bar renders the canonical word in its option and its active-filter badge', async () => {
	// `loadFilter: 'below-standard'` makes the active-filter badge render, so this
	// covers BOTH in-fence sites the finding names — the SelectItem label (which
	// is inside a portal-less Radix Select that stays closed) and the badge.
	const barProps = {
		searchQuery: '', onSearchQueryChange: () => {},
		filterStatus: 'all', onFilterStatusChange: () => {},
		statusFacetCounts: { 'teaching-assigned': 2, 'no-teaching': 0, 'adviser-only': 0 },
		loadFilter: 'below-standard',
		loadFacetCounts: { 'below-standard': 3, 'at-standard': 2, excess: 0 },
		onLoadFilterChange: () => {},
		departmentFilter: 'all', onDepartmentFilterChange: () => {},
		departmentOptions: [], filterAnnouncement: '', onClearTeachingLoadFilters: () => {},
		sortOrder: 'load-asc', onSortOrderChange: () => {},
		showFilters: true, onToggleFilters: () => {},
		showOutsideDept: false, onToggleOutsideDept: () => {},
		showUnmappedSpecialization: false, onShowUnmappedSpecializationChange: () => {},
		policyReady: true,
	};

	// B3a — the rendered active-filter badge.
	const host = render(createElement(TeachingLoadFilterBar as any, barProps));
	await flush();
	const text = host.textContent ?? '';
	assert.doesNotMatch(text, /Below standard/, 'the rendered filter bar must not show the old two-word form');
	assert.ok(text.includes('Under'), `the filter bar must show "Under"; saw: ${JSON.stringify(text.slice(0, 400))}`);
	teardown();

	// B3b — the SelectItem label inside the option list. The Radix Select only
	// mounts its content when open, so the source literal is what decides it;
	// that is the OTHER of the two sites the finding named.
	const source = read('src/components/faculty-assignments/TeachingLoadFilterBar.tsx');
	assert.match(source, /BELOW_STANDARD_LABEL/, 'the option label must be built from the canonical constant');
});

test('B4: "wide span" is a DIFFERENT concept and is left alone', () => {
	// Subject span, not hours. The planner's decision was explicit: leave it.
	// This control exists so a future "one word" sweep does not swallow it.
	const facultyRow = read('src/components/faculty/FacultyRow.tsx');
	assert.match(facultyRow, /Wide span/, '"Wide span" must remain; it is subject span, not hours');
});

test('B5 CROSS_LANE: the out-of-fence two-word form is reported, not edited', () => {
	// `components/faculty/**` is NOT this stream's fence. Assert the old label is
	// still there (we did not edit it) and pin the exact line for the owning lane
	// so the planner can hand it over in one sentence.
	const lines = read('src/components/faculty/FacultyRow.tsx').split('\n');
	const offenders = lines
		.map((line, index) => ({ line: index + 1, text: line }))
		.filter((entry) => entry.text.includes("'Below standard'"));
	assert.ok(
		offenders.length > 0,
		'FacultyRow.tsx is expected to still carry "Below standard" — this stream must NOT have edited it',
	);
	for (const offender of offenders) {
		console.log(`CROSS_LANE_FOLLOWUP: atlas-client/src/components/faculty/FacultyRow.tsx:${offender.line} — ${offender.text.trim()}`);
	}
});

/* ------------------------------------------------------------------ *
 * B6 — the copy sweep, closed to exactly the two sites a PINNED test
 * contractually forbids moving.
 *
 * A blanket "this file must not contain the literal" sweep is impossible here:
 * two of the sites are asserted verbatim by committed tests that this stream
 * does not own. So the control is a RATCHET — it names the exact remaining
 * occurrence, the function it sits in, and the test that pins it. If a later
 * edit closes one of them, this fails and the pin must be re-baselined
 * deliberately rather than the assertion quietly relaxed.
 * ------------------------------------------------------------------ */

/** Line numbers (1-based) whose text contains `needle`. */
function occurrencesOf(relative: string, needle: string): number[] {
	return read(relative)
		.split('\n')
		.map((text, index) => ({ text, line: index + 1 }))
		.filter((entry) => entry.text.includes(needle))
		.map((entry) => entry.line);
}

/** The nearest `export function <name>` above `line`, so a claim survives edits above it. */
function enclosingExport(relative: string, line: number): string {
	const lines = read(relative).split('\n');
	for (let index = line - 1; index >= 0; index -= 1) {
		const match = /^export function ([A-Za-z0-9_]+)/.exec(lines[index]);
		if (match) return match[1];
	}
	return '<none>';
}

test('B6 FAILING-FIRST GUARD: the below-standard copy sweep is closed except at the two PINNED sites', () => {
	// CLOSED: the un-routed surface QA found. Display copy only; no wire
	// discriminant, filter value, or domain type changed.
	assert.deepEqual(
		occurrencesOf('src/components/runtime/CarryForwardReviewPanel.tsx', 'Below standard'),
		[],
		'CarryForwardReviewPanel.tsx must use BELOW_STANDARD_LABEL for its distribution row',
	);
	assert.deepEqual(
		occurrencesOf('src/lib/faculty-assignment-helpers.ts', 'label: \'Below standard\'')
			.map((line) => enclosingExport('src/lib/faculty-assignment-helpers.ts', line)),
		['deriveLoadStatus'],
		'only deriveLoadStatus may still hold the two-word label; deriveTeachingLoadStatus is routed to BELOW_STANDARD_LABEL',
	);

	// PINNED — left deliberately, with the pinning test named.
	const reconciliationPins = occurrencesOf('src/lib/teaching-load-reconciliation-helpers.ts', 'Below standard');
	assert.equal(
		reconciliationPins.length,
		1,
		`exactly one pinned literal may remain in the reconciliation helpers; saw lines ${reconciliationPins.join(', ')}`,
	);
	assert.equal(
		enclosingExport('src/lib/teaching-load-reconciliation-helpers.ts', reconciliationPins[0]),
		'formatStatusLabel',
		'the remaining literal must be formatStatusLabel\'s below-standard case, not an un-routed surface',
	);
	console.log(
		'PINNED_SITE: atlas-client/src/lib/teaching-load-reconciliation-helpers.ts:'
		+ `${reconciliationPins[0]} — pinned by src/lib/__tests__/teaching-load-reconciliation-ui.test.ts:85`,
	);
	console.log(
		'PINNED_SITE: atlas-client/src/lib/faculty-assignment-helpers.ts (deriveLoadStatus) — pinned by'
		+ ' src/lib/__tests__/faculty-assignment-helpers.test.ts:22 and :41',
	);
});

test('B7: the filter bar is wired to the canonical constants, not inlined copies of their text', () => {
	// F4: `AT_STANDARD_LABEL` and `EXCESS_LOAD_LABEL` were exported but never
	// imported while the filter bar still inlined their text, so the module read
	// as authority while drifting from the only surface that showed them. They
	// are now WIRED, which is stronger than deleting them: the constants are the
	// single source the rendered copy is built from.
	const source = read('src/components/faculty-assignments/TeachingLoadFilterBar.tsx');
	for (const name of ['BELOW_STANDARD_LABEL', 'AT_STANDARD_LABEL', 'EXCESS_LOAD_LABEL']) {
		assert.ok(
			source.includes(`{${name}}`),
			`${name} must be used by the filter bar, not an inlined copy of its text`,
		);
	}
	assert.doesNotMatch(source, />At standard \(/, 'the at-standard option must not inline its label');
	assert.doesNotMatch(source, />Excess teaching load \(/, 'the excess option must not inline its label');
});
