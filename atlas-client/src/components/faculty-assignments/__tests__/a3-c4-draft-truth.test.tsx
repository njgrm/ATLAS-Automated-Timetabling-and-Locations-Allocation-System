/**
 * A3-C4 — Teaching Load draft truth (walkthrough #7) and one word for
 * "not enough hours" (top-10 #10).
 *
 * DEFECT A — walkthrough #7 claimed: "Opening the teacher workload dialog
 * silently switches Teaching Load into a draft with Save enabled. A user
 * 'just looking' can save by accident." The packet requirement is verbatim:
 * "Enter draft only on a real change."
 *
 * WHAT THIS FILE DOES FIRST, BEFORE ANY FIX: it drives the REAL
 * `useTeachingLoadData` hook — not a retyped copy of its logic — against a
 * stubbed transport, then performs each non-operator action the finding names
 * (open the workload dialog through the REAL `openTeacherReview`, switch view
 * mode, change selection, land a background section-summary refresh) and
 * asserts `activeDraftCount === 0` and the REAL `TeachingLoadDraftActionBar`
 * renders its Save button disabled.
 *
 * If it passes on base, the row is UN-REPRODUCED and this file is a green
 * guard, NOT evidence of a fix. See the handoff. No existing control is
 * weakened or deleted to reach green (AGENTS.md §16).
 *
 * DEFECT B — the below-standard status label becomes the single word "Under".
 * Rationale: one plain word, no jargon, and the existing help text still
 * supplies the standard ("below the 20h standard"), so nothing is lost.
 * "Wide span" is a DIFFERENT concept (subject span, not hours) and is left
 * alone — see B5.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement, useEffect, useState } from 'react';
import { JSDOM } from 'jsdom';
import { mock } from 'node:test';

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
		return { data: { id: 46, schoolId: SCHOOL_ID, role: 'SCHEDULER', schoolYearId: SCHOOL_YEAR_ID, activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2026-2027' } };
	}
	if (url.includes('/runtime/context') || url.includes('/settings/active-school-year')) {
		return { data: { activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2026-2027', source: 'api' } };
	}
	if (url.includes('/faculty-assignments/summary')) {
		return { data: facultySnapshot() };
	}
	if (url.includes('/sections/summary/')) {
		return { data: { sections: state.sections } };
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
	viewMode: 'teacher' | 'allocation';
	dialogOpen: boolean;
	openReview: () => void;
	setViewMode: (m: 'teacher' | 'allocation') => void;
	changeSelection: () => void;
	refresh: () => Promise<void>;
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
			viewMode,
			dialogOpen,
			// The REAL opener, the REAL setters — the page's own wiring.
			openReview: () => openTeacherReview({ setViewMode, setReviewModalOpen: setDialogOpen }),
			setViewMode,
			changeSelection: () => data.setSelectedId(10),
			refresh: () => data.fetchData({ forceRefresh: true }),
			canUndo: data.canUndo,
			canRedo: data.canRedo,
			handleUndo: data.handleUndo,
			handleRedo: data.handleRedo,
		};
	});

	return createElement(TeachingLoadDraftActionBar as any, {
		activeDraftCount: data.activeDraftCount,
		canUndo: data.canUndo,
		isReadOnlyMode: data.isReadOnlyMode,
		saving: data.saving,
		statusMessage: 'Ready.',
		writeBlockedReason: null,
		onUndo: data.handleUndo,
		onDiscard: () => {},
		onSave: () => {},
	});
}

/** The Save button's disabled state, read from the REAL rendered component. */
function saveButtonIsDisabled(host: HTMLElement): boolean {
	const bar = host.querySelector('[data-testid="teaching-load-draft-action-bar"]');
	assert.ok(bar, 'the real draft action bar must render');
	const save = Array.from(bar!.querySelectorAll('button')).find((b) => /Save/.test(b.textContent ?? ''));
	assert.ok(save, `a Save button must render; saw: ${Array.from(bar!.querySelectorAll('button')).map((b) => JSON.stringify(b.textContent)).join(', ')}`);
	return (save as HTMLButtonElement).disabled;
}

async function settle(): Promise<HTMLElement> {
	// The hook fetches on mount and retries with backoff; give it several turns.
	for (let i = 0; i < 6; i += 1) await flush();
	assert.ok(handle, 'the host must have published its handle');
	return dom.window.document.body;
}

test('A1 CONTROLLING: the real hook loads a writable scope with zero drafts and a disabled Save', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assert.equal(handle!.activeDraftCount, 0, 'a freshly loaded scope has no drafts');
	assert.equal(saveButtonIsDisabled(host), true, 'Save must be disabled before any operator action');
});

test('A2: opening the workload dialog alone must NOT create a draft (walkthrough #7)', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
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
});

test('A3: switching view mode alone must NOT create a draft', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft before the view switch');

	for (const mode of ['allocation', 'teacher'] as const) {
		await act(async () => { handle!.setViewMode(mode); });
		await flush();
		assert.equal(handle!.activeDraftCount, 0, `view mode "${mode}" must not enter draft mode`);
		assert.equal(saveButtonIsDisabled(host), true, `Save must stay disabled in "${mode}" mode`);
	}
});

test('A4: changing the selected teacher alone must NOT create a draft', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft before the selection change');

	await act(async () => { handle!.changeSelection(); });
	await flush();

	assert.equal(handle!.activeDraftCount, 0, 'changing selection must not enter draft mode');
	assert.equal(saveButtonIsDisabled(host), true, 'Save must stay disabled after a selection change');
});

test('A5: a background section-summary refresh must NOT create a draft', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
	assert.equal(handle!.activeDraftCount, 0, 'precondition: no draft before the refresh');

	// A refresh that lands a DIFFERENT section map — the sharpest form of the
	// "normalisation difference with no operator action" question. Section 12
	// disappears, so faculty 10's saved FIL 7-B normalises to nothing. If the
	// page created a draft from that, it would be reporting a change nobody made.
	state.sections = SECTIONS_V2;
	await act(async () => { await handle!.refresh(); });
	await flush();

	assert.equal(
		handle!.activeDraftCount,
		0,
		'a background refresh must not create a draft entry; nothing was edited',
	);
	assert.equal(saveButtonIsDisabled(host), true, 'Save must stay disabled after a background refresh');
});

test('A6: undo and redo with EMPTY stacks must not create a draft', async () => {
	state.sections = SECTIONS_V1;
	const host = render(createElement(TeachingLoadDraftTruthHost));
	await settle();
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
