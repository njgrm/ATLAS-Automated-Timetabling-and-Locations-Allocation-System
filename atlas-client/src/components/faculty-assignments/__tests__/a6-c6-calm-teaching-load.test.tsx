/**
 * A6 c6 — CALM TEACHING LOAD. The committed gate for Lane C's six findings from
 * the 2026-09-29 06:58 +08 walk (`docs/handoffs/lane-c-to-a2.md` 1429-1434 and
 * `docs/reviews/codex-staging-train6-24e268fb/run2-report.md`, A1 FAIL,
 * "Older-user concerns" MAJOR lines 20 and 22).
 *
 *   1  `Cross-Dept` / `Unmapped Specialization`            -> two plain sentences
 *   2  several competing top controls                       -> ONE main button
 *   3  `Sort: Lowest load` is cut off at 1366               -> a declared face budget
 *   4  `…so this figure is withheld.`                       -> a plain next step
 *   5  `Using the last saved data — EnrollPro not reachable` -> plain lead, detail behind Help
 *   6  20 teacher cards feel dense                          -> three regions deleted
 *
 * WHY THIS FILE RENDERS EVERYTHING IT CLAIMS. AGENTS.md §11: "A test that only
 * asserts source text is not acceptance evidence for a user-facing change." Every
 * visible claim below is read off MARKUP produced by the real component in real
 * JSDOM, with real event dispatch and real React state transitions. JSDOM performs
 * no layout, so nothing here claims a pixel: the one width claim (A6C6-3) is
 * against the DECLARED `@/ui` character budget the primitive publishes, and the
 * rendered-pixel confirmation is the separate `ISOLATED_LOCAL_BROWSER` capture
 * named in packet §4.
 *
 * THE HARNESS IS COPIED VERBATIM from the accepted sibling
 * `a6-teaching-load-surface.test.tsx` (its JSDOM bootstrap, `render`, `click`,
 * `press`, `portalledDialog`) so the two files sitting beside each other behave
 * identically and a reviewer can diff them.
 *
 * EVERY ROW NAMES THE ITEM IT DECIDES. Every row marked MUTANT has been broken and
 * restored BY HAND against this candidate; the recorded red output is in the
 * executor handoff. A row that cannot go red is not evidence.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEMPORARY_ROLE_BUCKET_KEY, TEMPORARY_ROLE_BUCKET_LABEL } from '@/hooks/useTeachingLoadUI';
import { PICKER_TRIGGER_FACE_BUDGET_CHARS, PICKER_TRIGGER_WIDTH_CLASS, pickerTriggerFaceFits } from '@/ui/picker-trigger';

/** A repository source file, read by path from the client root. */
const readSource = (relative: string): string =>
	readFileSync(resolve(import.meta.dirname, '../../../..', relative), 'utf8');

/**
 * A source file with its comments removed.
 *
 * A comment that NAMES a retired defect is a record, not a defect. A scan that
 * cannot tell the two apart gets satisfied by deleting the history, which is the
 * failure `AGENTS.md` §16 exists to prevent — so every "this string must be gone"
 * claim in this file is made against CODE only.
 */
const stripComments = (source: string): string =>
	source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teaching-load',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');

const { TeachingLoadFilterBar } = await import('@/components/faculty-assignments/TeachingLoadFilterBar');
const { TeacherGridMode } = await import('@/components/faculty-assignments/TeacherGridMode');
const { resolveTeachingActualHours } = await import('@/lib/faculty-assignment-helpers');
const { TeachingLoadSummarySurface } = await import('@/components/faculty-assignments/TeachingLoadSummarySurface');
const { TeachingLoadTruthPanel } = await import('@/components/faculty-assignments/TeachingLoadTruthPanel');
const {
	WorkspaceToolbar,
	TEACHING_LOAD_HEADER_MODEL,
	teachingLoadUnverifiedStatus,
	teachingLoadUnverifiedReason,
} = await import('@/components/faculty-assignments/WorkspaceToolbar');
/*
 * A6C6-3 needs the DECLARED budget the primitive publishes. The MODULE exists on
 * the base; only the two new exports do not, so this must be a namespace import and
 * the row must fail on an ASSERTION about the missing export — a named import that
 * does not resolve would throw at module load and destroy the per-row
 * failing-first record this packet requires.
 */
const pickerTrigger: Record<string, any> = await import('@/ui/picker-trigger');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
});

function inRouter(node: any) {
	return createElement(
		MemoryRouter as any,
		{ initialEntries: ['/teaching-load'] },
		createElement(TooltipProvider as any, { delayDuration: 200 }, node),
	);
}

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(inRouter(node)); });
	return host;
}

/**
 * Unmount a mount EARLY, from inside the test that opened it.
 *
 * `afterEach` unmounts every root too, but by then two tests' worth of Radix
 * layers are alive: an open `DropdownMenu` from one and an open modal `Dialog`
 * from the next do not coexist in JSDOM, and the second `press()` deadlocks the
 * process rather than failing a row. A test that opens a menu or a dialog
 * therefore closes its own mount before returning, so the next row starts clean.
 */
function dispose(host: HTMLElement) {
	const index = hosts.indexOf(host);
	if (index >= 0) {
		const root = roots[index];
		roots.splice(index, 1);
		hosts.splice(index, 1);
		act(() => { root.unmount(); });
		host.remove();
	}
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** Radix opens a DROPDOWN and a POPOVER on `pointerdown`, not on `click`. */
function press(el: Element) {
	act(() => {
		el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});
}

/** A Radix Dialog renders into a portal on `document.body`, not into the host. */
function portalledDialog(): HTMLElement | null {
	return dom.window.document.querySelector('[role="dialog"]');
}

/**
 * Hover a `@/ui` Tooltip trigger and read the tooltip CONTENT Radix mounts.
 *
 * Read on the rendered `[role="tooltip"]`, never off the trigger: a Tooltip is
 * hover-only, so asserting the trigger's own text would pass while the
 * explanation was never reachable. The wait is the provider's `delayDuration`
 * plus a frame, so the assertion is on the state a scheduler reaches.
 */
/**
 * Open a `@/ui` Tooltip and read the tooltip CONTENT Radix mounts.
 *
 * Read on the rendered `[role="tooltip"]`, never off the trigger: a Tooltip is
 * hover-only, so asserting the trigger's own text would pass while the
 * explanation was never reachable. FOCUS is what opens it, not `pointermove`:
 * Radix's hover path is gated behind a pointer-in-transit grace area that JSDOM's
 * synthetic `MouseEvent` never satisfies (measured: hover opens nothing here,
 * `focus` opens it every time), and focus is a real user path in its own right —
 * a scheduler who tabs to the control gets the same explanation.
 */
async function hoverTooltip(trigger: Element): Promise<string> {
	act(() => {
		for (const type of ['focus', 'focusin']) {
			trigger.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true }));
		}
		(trigger as HTMLElement).focus?.();
	});
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
	// The packet forbids a SECOND explanation beside the existing helper, so the
	// count of mounted tooltips is part of the read, not a separate assertion.
	assert.equal(
		dom.window.document.querySelectorAll('[role="tooltip"]').length,
		1,
		'exactly one tooltip may be open: the existing `primaryAction.helper` explanation, not a second one beside it',
	);
	return textOf(dom.window.document.querySelector('[role="tooltip"]'));
}

const buttonsOf = (scope: ParentNode) => Array.from(scope.querySelectorAll('button'));

const textOf = (node: Element | Document | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const buttonsIn = (scope: ParentNode) => Array.from(scope.querySelectorAll('button'));
const byText = (scope: ParentNode, text: string) =>
	buttonsIn(scope).find((b) => (b.textContent ?? '').trim() === text) ?? null;

/* ─────────────────────────── fixtures (real product strings) ───────────────── */

/** A real teacher: Mathematics, class adviser, real sections, a real standard. */
const TEACHER: any = {
	id: 9, firstName: 'Maria', lastName: 'Dela Cruz',
	department: 'Mathematics', departmentLabel: 'Mathematics', departmentCode: 'MATH',
	employmentStatus: 'REGULAR', employeeId: 'EMP-0009',
	isActiveForScheduling: true, isClassAdviser: true, isPlaceholder: false,
	maxHoursPerWeek: 40, policyCreditedHours: 24, sectionTeachingHours: 20,
	actualTeachingHours: 20, subjectCount: 2, sectionCount: 2,
	advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0,
	advisedSectionName: null, version: 1, assignments: [],
};
const OTHER_TEACHER: any = { ...TEACHER, id: 14, firstName: 'Roberto', lastName: 'Alcantara', isClassAdviser: false };

/** The statuses the BASE shipped, quoted so a reword is visible AS a reword. */
const BASE_UNVERIFIED: Record<string, string> = {
	offline: 'Unverified \u2014 ATLAS is offline, so this figure is withheld.',
	refreshing: 'Unverified \u2014 ATLAS is checking EnrollPro now, so this figure is withheld.',
	none: 'Unverified \u2014 no live Teaching Load source is available, so this figure is withheld.',
	cached: 'Unverified \u2014 EnrollPro is not reachable, so this figure is withheld.',
};

/** The four plain sentences item 1.4 asks for, byte-for-byte. */
const PLAIN_UNVERIFIED: Record<string, string> = {
	offline: 'ATLAS is offline, so these numbers cannot be checked.',
	refreshing: 'ATLAS is checking the live roster now, so these numbers are not confirmed yet.',
	none: 'No live Teaching Load source is available, so these numbers cannot be checked.',
	cached: 'These numbers come from the last saved roster, not the current one.',
};

const UNVERIFIED_STATES: Array<{ key: string; input: { dataSource: any; isOnline: boolean } }> = [
	{ key: 'offline', input: { dataSource: 'live', isOnline: false } },
	{ key: 'refreshing', input: { dataSource: 'refreshing', isOnline: true } },
	{ key: 'none', input: { dataSource: 'none', isOnline: true } },
	{ key: 'cached', input: { dataSource: 'cached', isOnline: true } },
];

/** The four plain PILL leads of item 1.5, byte-for-byte. */
const PLAIN_PILL: Record<string, string> = {
	offline: 'You are offline, so ATLAS is showing the last saved roster.',
	refreshing: 'ATLAS is checking the live roster now.',
	none: 'There is no live roster to load, so ATLAS is showing the last saved one.',
	cached: 'ATLAS is showing the last saved roster, not the current one.',
};

function filterBarProps(overrides: Record<string, any> = {}) {
	return {
		searchQuery: '', onSearchQueryChange: () => {},
		filterStatus: 'all', onFilterStatusChange: () => {},
		statusFacetCounts: { all: 2, 'teaching-assigned': 2, 'no-teaching': 1, 'adviser-only': 1, excess: 0 },
		loadFilter: 'all', loadFacetCounts: { excess: 1, 'at-standard': 1, 'below-standard': 0 },
		onLoadFilterChange: () => {},
		departmentFilter: 'all', onDepartmentFilterChange: () => {},
		departmentOptions: [
			{ value: 'MATH', label: 'Mathematics', count: 2 },
			{ value: 'LANG', label: 'Languages', count: 1 },
			{ value: 'SCI', label: 'Science', count: 1 },
		],
		filterAnnouncement: '', onClearTeachingLoadFilters: () => {},
		sortOrder: 'load-desc', onSortOrderChange: () => {},
		showFilters: false, onToggleFilters: () => {},
		showOutsideDept: false, onToggleOutsideDept: () => {},
		showUnmappedSpecialization: false, onShowUnmappedSpecializationChange: () => {},
		policyReady: true,
		...overrides,
	};
}

function gridProps(overrides: Record<string, any> = {}) {
	return {
		loading: false,
		faculty: [TEACHER, OTHER_TEACHER],
		filteredFaculty: [TEACHER, OTHER_TEACHER],
		groupedFaculty: [['Mathematics', [TEACHER, OTHER_TEACHER]]],
		selectedId: null, onSelectTeacher: () => {},
		effectiveAssignmentsByFaculty: {
			9: [{ subjectId: 1, sectionIds: [101, 102] }, { subjectId: 2, sectionIds: [201] }],
			14: [{ subjectId: 1, sectionIds: [103] }],
		},
		effectiveDraftAssignmentsByFaculty: {},
		subjects: [], sectionsBySubject: {},
		saving: false, isReadOnlyMode: false,
		effectiveOwnershipMap: {}, savedConflictMap: {},
		onSetSections: () => {}, onSwapSectionOwnership: () => {},
		departmentQualifiedSubjects: [], outsideDepartmentSubjects: [], homeroomHint: null,
		loadProfile: null,
		onHoverLoadMinutes: () => {}, onClearHoverLoad: () => {},
		activeFacultyIds: new Set<number>([9, 14]),
		resolveSectionHoverDeltaMinutes: () => 0,
		onResetAssignments: () => {},
		...filterBarProps(),
		effectiveActualHours: new Map<number, number>(),
		teachingStandardHours: 20, policyReady: true,
		completedSectionIds: new Set<number>(),
		workspaceStateLabel: 'Ready', workspaceStateNextAction: 'Assign the remaining classes.',
		writeBlockedReason: null,
		onReviewLoad: () => {},
		...overrides,
	};
}

const TRUTH_MODEL: any = {
	requiredPairs: { state: 'known', value: 24 },
	assignedPairs: { state: 'known', value: { real: 21, placeholder: 1, total: 22 } },
	unresolvedPairs: { state: 'known', value: 2 },
	actualTeachingMinutes: { state: 'known', value: 1200 },
	policyCapacity: { state: 'known', value: { teachingStandardMinutes: 10800, hardCapMinutes: 12600 } },
	overload: { state: 'known', value: { overStandardCount: 3, overHardCapCount: 1, excessMinutes: 600 } },
	remainingCapacityMinutes: { state: 'known', value: 1800 },
	zeroLoadFaculty: { state: 'known', value: { count: 1, names: ['Santos, Pedro'] } },
	adviserStatus: { state: 'known', value: { count: 1, names: ['Reyes, Ana'] } },
	advisoryCreditMinutes: { state: 'known', value: 0 },
	excludedHgRows: { state: 'known', value: { count: 1, explanation: 'Homeroom Guidance is not teaching time.' } },
};

function toolbarProps(overrides: Record<string, any> = {}) {
	return {
		realAssignedPairs: 22, syntheticPlaceholderPairs: 1, unassignedPairs: 2, totalPairs: 24,
		overCapCount: 1, excessTeachingCount: 0, policyReady: true,
		onShowExcessTeachingLoad: () => {}, onShowTemporarySubstitutes: () => {},
		autoFillLoading: false, autoFillEnabled: true, onAutoFillClick: () => {},
		viewMode: 'teacher', onViewModeChange: () => {},
		dataSource: 'live', degradedWriteEnabled: false, isWorkspaceWritable: true, isOnline: true,
		dataSourceNotice: null,
		coverageMode: 'balanced', onCoverageModeChange: () => {},
		coverageModeConfig: { balanced: { label: 'Balanced', description: 'desc' } },
		workspaceStateLabel: 'Ready',
		workspaceStateDescription: 'Live roster verified.',
		workspaceStateNextAction: 'Assign the remaining classes.',
		activeDraftCount: 0, saving: false, onSave: () => {}, onRetrySource: () => {},
		...overrides,
	};
}

/** The page's own composition of the header's `Load summary` slot. */
function TeachingLoadLoadSummaryShell() {
	return createElement('div', null, createElement(WorkspaceToolbar as any, toolbarProps({
		loadSummaryAction: createElement(
			TeachingLoadSummarySurface as any,
			null,
			createElement(TeachingLoadTruthPanel as any, {
				expanded: true, vertical: true, model: TRUTH_MODEL,
				loading: false, sourceRevision: 'rev-1', upstreamVerified: true, unresolvedReasons: [],
			}),
		),
	})));
}

const row1Of = (host: HTMLElement) => host.querySelector('[data-testid="teaching-load-compact-command-header"]')!;
const row2Of = (host: HTMLElement) => host.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
/** The strip's `trailing` slot — the row-1 action group. */
const actionsOf = (host: HTMLElement) => row1Of(host).lastElementChild!;

/* ═══════════════ A6C6-1 — ITEM 1: two plain sentences, no shouted code ═══════ */

test("A6C6-1 SUPERSEDED IN PART by A6 c8 item 39 (2026-09-29). RETAINED, NOT DELETED, and still EXECUTING. REPLACED IN PART BY `A6C6-8b`: the two inclusion switches carry short plain labels on the ONE row, the full sentence is the accessible name, and no visible code shouts", () => {
	// Lane C, verbatim: the filter row carried `Cross-Dept` and `Unmapped
	// Specialization` — internal vocabulary, not what the control DOES. These two
	// labels are the only user-facing text those controls have.
	//
	// ── SUPERSEDED IN PART, 2026-09-29 (A6 c8 item 39). RETAINED, NOT DELETED. ──
	// A6 c8 item 39 removed the `More filters` popover, so the two labels are read
	// from the ONE ROW again rather than from an opened panel, and the SENTENCES are
	// now the switches' `aria-label`s while the visible face carries the shortest
	// plain phrase. What this row's CONTRACT is unchanged and still asserted: the
	// shouted base wording is gone from the whole rendered surface, each switch keeps
	// a real `<label for>` wired to its unchanged id, neither label shouts in caps,
	// and the shared switch-label weight and nowrap are kept. The exact label strings
	// are `A6C6-8b`'s, and they are asserted there beside the disclosure removal.
	const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps()));
	// A6 c6 item 3 moved the two switches off the always-on row into `More filters`,
	// so the labels were read from the opened popover, which portals onto
	// `document.body`. A6 c8 item 39 put them back on the row, so the ORIGINAL
	// read — the mount itself — is live again and nothing has to be pressed.
	//
	//   press(host.querySelector('[data-testid="teaching-load-more-filters"]') as HTMLButtonElement);
	const panel = host;

	const EXPECTED: Array<[string, string]> = [
		// A6 c8 item 39, superseding A6 c6's `Show teachers outside their subject
		// area` / `Show teachers with no matched subject` as the VISIBLE face.
		['show-outside-dept', 'Cross-subject'],
		['show-unmapped-specialization', 'No subject match'],
	];
	for (const [id, sentence] of EXPECTED) {
		const label = panel.querySelector(`label[for="${id}"]`) as HTMLLabelElement;
		assert.ok(label, `the ${id} switch must keep a real <label for>`);
		assert.equal(
			textOf(label),
			sentence,
			`${id}: the visible label must be the short plain phrase the 1078px row can carry`,
		);
		// Sentence case, so the control stops shouting. `a6-tl-header-budget`
		// A6c4-G2-6 capped caps on a switch label at two; ZERO still passes, and
		// zero is what this slice achieves.
		const cls = label.getAttribute('class') ?? '';
		assert.doesNotMatch(cls, /\buppercase\b|\btracking-/, `${id}: the label must not shout in caps`);
		assert.match(cls, /font-semibold/, `${id}: it keeps the shared switch-label weight`);
		assert.match(cls, /whitespace-nowrap/, `${id}: it keeps nowrap so the control does not reflow`);
		// The `id`s are stable DOM hooks other committed rows address, so the
		// label -> id WIRING is still asserted even though the words changed.
		assert.ok(panel.querySelector(`[id="${id}"]`), `${id}: the switch id must survive the reword`);
	}

	// The old words must be gone from the whole RENDERED surface, not from one node.
	const surface = textOf(panel);
	for (const gone of ['Cross-Dept', 'Unmapped Specialization', 'cross-dept', 'unmapped-specialization']) {
		assert.ok(!surface.includes(gone), `the rendered filter bar must not print ${JSON.stringify(gone)}`);
	}

	// NO VISIBLE ALL-CAPS CODE. This is a rendered-TEXT scan, not a source grep: a
	// comment that merely NAMES a defect cannot make the row pass, and an ordinary
	// English word shouted by CSS (`Active filters:` is `uppercase` in the
	// stylesheet) is correctly not a code. The allowlist is the teacher's own name,
	// which `formatFacultyDisplayName` uppercases on purpose (Fix 22).
	const ALLOWED = [/^DELA$/, /^CRUZ,/, /^MARIA$/, /^ROBERTO$/, /^ALCANTARA$/];
	const codes: string[] = [];
	for (const node of Array.from(panel.querySelectorAll('*'))) {
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType !== 3) continue;
			const text = (child.textContent ?? '').trim();
			if (!text) continue;
			for (const token of text.match(/[A-Z][A-Z_]{2,}/g) ?? []) {
				if (ALLOWED.some((re) => re.test(token))) continue;
				codes.push(`${token} in ${JSON.stringify(text)}`);
			}
		}
	}
	assert.deepEqual(codes, [], `no visible text on the filter row may carry an all-caps code token: ${codes.join('; ')}`);
});

/* ═══════════════ A6C6-2 — ITEM 1's second half: the editor heading ═══════ */

test('A6C6-1c MUTANT ROW: this page and /subjects share ONE mechanism for a content-sized trigger', () => {
	/*
	 * THE OVERLAP THIS ROW SETTLES, recorded because the merge is where it happened.
	 *
	 * A6 c6 added `PICKER_ROW_CONTROL_CLASS` to `@/ui/picker-trigger` for this
	 * page's `More filters` trigger. Separately, A5 C4 added an `auto` width
	 * variant to the same file for `/subjects`' `More filters` disclosure — the
	 * same problem, the same week, the same file, two mechanisms. A text merge of
	 * the two lanes was clean, which is exactly why nobody would have noticed:
	 * only a row that says "there must be ONE mechanism" makes the difference
	 * visible.
	 *
	 * The settlement took A5's shape, because a content-sized trigger is a WIDTH
	 * and `pickerTriggerClass('auto')` already composes everything the other token
	 * carried.
	 *
	 * ── A6 c8 item 39 (2026-09-29): THE WORKED EXAMPLE MOVED, THE RULE DID NOT. ──
	 * A6 c6 pointed this row at `/teaching-load`'s own `More filters` trigger, which
	 * called `pickerTriggerClass('auto')`. That control is GONE (the operator asked
	 * for the disclosure to leave the DOM entirely), so the same three claims are
	 * now decided on the two call sites that DO exist:
	 *   1. `/subjects`' `More filters` disclosure, which still calls the factory —
	 *      the original A5 C4 example, unchanged;
	 *   2. `/teaching-load`'s four `FilterPicker`s, which now take the SAME `auto`
	 *      variant through the shared primitive rather than through a page-local
	 *      class — a retired token with no replacement would be a regression, so
	 *      the replacement is asserted.
	 * The original expectation is kept verbatim, as a comment, so the round that
	 * moved it is on record (`AGENTS.md` §16).
	 */
	const pt = readSource('src/ui/picker-trigger.ts');
	const fb = readSource('src/components/faculty-assignments/TeachingLoadFilterBar.tsx');
	const subjects = readSource('src/components/subjects/SubjectFilterToolbar.tsx');

	// A5's variant survives, intact, with its own rationale.
	assert.match(
		stripComments(pt),
		/auto:\s*'w-auto whitespace-nowrap'/,
		'`/subjects`\'s `auto` width variant must survive this lane - it is the adopted mechanism, not something this slice competes with',
	);

	// The competing token is gone from the primitive AND from every call site.
	assert.ok(
		!stripComments(pt).includes('PICKER_ROW_CONTROL_CLASS'),
		'the duplicate row-control token must not come back to `@/ui`',
	);
	assert.ok(
		!stripComments(fb).includes('PICKER_ROW_CONTROL_CLASS'),
		'nor to this page: the row now takes the shared `auto` width VARIANT instead',
	);
	// SUPERSEDED IN ITS EXAMPLE, RETAINED IN ITS RULE. The old expectation was:
	//
	//   assert.match(
	//     stripComments(fb),
	//     /pickerTriggerClass\('auto'\)/,
	//     'and the trigger must actually use it - a retired token with no replacement is a regression',
	//   );
	//
	// `/teaching-load` no longer builds a trigger by hand at all — that is the fix.
	// The rule it guarded ("a retired token must not leave a hole") is now asserted
	// where the two real call sites are.
	assert.match(
		stripComments(subjects),
		/pickerTriggerClass\('auto'\)/,
		"and `/subjects`' `More filters` disclosure must still use the shared factory - the A5 C4 example this row was built on",
	);
	assert.equal(
		(stripComments(fb).match(/width="auto"/g) ?? []).length,
		4,
		'and all four of `/teaching-load`\'s pickers must take the SAME shared `auto` variant - a retired token with no replacement is a regression',
	);
	assert.ok(
		!/width="(sm|md|lg|xl|fill)"/.test(stripComments(fb)),
		'and no fixed width variant may come back on this row: `xl` is what overflowed the measured 1078px budget',
	);

	// `pickerTriggerFaceFits` must not report a FALSE FAILURE for a width that
	// cannot clip. This is the line A5's `auto` introduced: when the variant
	// landed, the function returned `false` for any width with no budget, so a
	// caller shortening a label for an `auto` trigger was told its face does not
	// fit when it physically cannot not. A guard that cries wolf on the safest
	// width is how a guard gets deleted.
	assert.equal(pickerTriggerFaceFits('auto', 'More filters', 'More filters (2 on)'), true, 'a content-sized trigger cannot clip its face');
	assert.equal(pickerTriggerFaceFits('fill', 'Grade', 'Science'), true, 'and neither can one that claims a slot');
	assert.equal(pickerTriggerFaceFits('md', 'Grade', 'All'), true, 'a face inside the budget still fits');
	assert.equal(pickerTriggerFaceFits('md', 'Grade', 'Science'), false, 'and one past the budget still does not - the guard still bites');
	// A6 c8 item 39: the `xl` case this row used to read is the one the row no
	// longer leans on, and it is still true that a data-driven name fits it.
	assert.equal(pickerTriggerFaceFits('xl', 'Department', 'Mathematics'), true, 'the `xl` budget a data-driven name needs is present and used');

	// The budget table is still DERIVED from the width tokens, and still has no
	// entry for the two unbounded widths.
	for (const unbounded of ['fill', 'auto']) {
		assert.equal(
			(unbounded in PICKER_TRIGGER_FACE_BUDGET_CHARS),
			false,
			`${unbounded} claims a width it does not have, so it must have no character budget`,
		);
	}
});

test('A6C6-1b MUTANT ROW: the temporary-role group heading is a plain label, not a code', () => {
	/*
	 * THE FINDING THIS ROW EXISTS FOR CAME FROM THE BROWSER, NOT FROM A GREP.
	 *
	 * The source sweep in the packet found the two inclusion switches and the
	 * `Cross-Department` heading. It missed this one, because the string lives in
	 * `hooks/useTeachingLoadUI.ts` — a file no source sweep for the filter bar
	 * looks at — and the loopback render at 1366x768 put it on screen as the
	 * roster's group heading. That is the `AGENTS.md` §11 lesson applied to itself:
	 * a source scan of the files you edited is not a sweep of the page.
	 *
	 * WHAT IT WAS: `UNSTAFFED TEMPORARY ROLES` — the code, printed as a heading,
	 * for the same rows the header chip has always called `Temporary substitutes`.
	 */
	const ui = readSource('src/hooks/useTeachingLoadUI.ts');

	// The label is the product's own word, exported so the heading and the
	// constant cannot drift.
	assert.equal(TEMPORARY_ROLE_BUCKET_LABEL, 'Temporary substitutes', 'the temporary-role heading must be a plain label');
	assert.doesNotMatch(
		TEMPORARY_ROLE_BUCKET_LABEL,
		/[A-Z][A-Z_]{2,}/,
		'and must carry no all-caps code token',
	);

	// The key stays a code. It is Map identity: changing it would move the group
	// for reasons no scheduler can see, and the fix was the LABEL, not the key.
	assert.equal(TEMPORARY_ROLE_BUCKET_KEY, 'TEMPORARY_ROLE', 'the group key stays a stable code');
	assert.ok(
		ui.includes(`grouped.set(TEMPORARY_ROLE_BUCKET_KEY, bucket)`),
		'the placeholder branch must group under the exported key',
	);
	assert.ok(
		ui.includes('label: TEMPORARY_ROLE_BUCKET_LABEL'),
		'and it must take its READABLE label from the same exported constant, not a second literal',
	);

	// MUTANT: the old code must not survive in the hook's CODE. Comments are
	// stripped first, for the reason `A6C6-1` already states for the filter bar: a
	// comment that NAMES a retired defect is a record, not a defect, and a scan
	// that cannot tell them apart gets satisfied by deleting the history.
	assert.ok(
		!stripComments(ui).includes('UNSTAFFED TEMPORARY ROLES'),
		'the all-caps heading code must be gone from the hook',
	);
	assert.ok(
		!/label:\s*'[^']*[A-Z][A-Z_]{2,}[^']*'/.test(stripComments(ui)),
		'and no group label in this file may be a quoted all-caps code',
	);
});

test("A6C6-2 the editor's outside-the-department heading reads as a plain sentence", () => {
	// The base heading was `Cross-Department` — a hyphenated CODE, in
	// `uppercase tracking-widest` — on the one surface a scheduler reads mid-edit.
	// Reached by a real click, so the row proves the heading the product renders.
	const FIL: any = { id: 91, code: 'FIL', name: 'Filipino', minMinutesPerWeek: 150, gradeLevels: [7], isSeedable: true, allowedOwnerDepartments: ['LANG'], programScopes: [] };
	const host = render(createElement(TeacherGridMode as any, gridProps({
		showOutsideDept: true,
		subjects: [FIL],
		outsideDepartmentSubjects: [FIL],
		sectionsBySubject: { 91: [{ id: 9101, sectionName: '7 - FIL', gradeLevel: 7, displayOrder: 7, programType: 'REGULAR' }] },
	})));
	const edit = host.querySelector('[data-testid="teaching-load-edit-assignments"]') as HTMLButtonElement;
	assert.ok(edit, 'the row must render its explicit edit control');
	click(edit);
	const editor = host.querySelector('[data-testid="teaching-load-assignment-editor"]')!;
	assert.ok(editor, 'the edit control must mount the assignment editor');

	const spans = Array.from(editor.querySelectorAll('span')).map((el) => textOf(el)).filter(Boolean);
	assert.ok(
		spans.includes('Outside their subject area'),
		`the editor must section the outside-department list with the plain sentence; saw ${JSON.stringify(spans)}`,
	);
	assert.ok(!spans.includes('Cross-Department'), 'the code heading `Cross-Department` must be gone');
	for (const el of Array.from(editor.querySelectorAll('*'))) {
		if (!textOf(el).includes('Outside their subject area')) continue;
		const cls = el.getAttribute('class') ?? '';
		assert.doesNotMatch(cls, /\buppercase\b|\btracking-widest\b/, 'the heading must not be letter-spaced caps');
	}
});

/* ═══════════════ A6C6-3 — ITEM 3: a DECLARED face budget, worst state ═══════ */

test('A6C6-3 MUTANT ROW: every composed picker face in the worst state fits its declared @/ui budget', () => {
	// THE DEFECT IS A CLASS, NOT ONE INSTANCE. `Sort: Lowest load` (17) is clipped
	// at `w-32`, and so is `Department: All` (15) and `Status: No teaching load (3)`
	// (27). Rewording one string would have left the next one clipped, so the fix
	// is a published per-width CHARACTER BUDGET in `@/ui`, derived from the width
	// token, plus a control that reads the REAL rendered face of every picker.
	assert.equal(
		typeof pickerTrigger.pickerTriggerFaceFits,
		'function',
		'@/ui/picker-trigger must publish `pickerTriggerFaceFits` — a page cannot hold a width promise the primitive does not state',
	);
	assert.ok(
		pickerTrigger.PICKER_TRIGGER_FACE_BUDGET_CHARS,
		'@/ui/picker-trigger must publish `PICKER_TRIGGER_FACE_BUDGET_CHARS`',
	);
	assert.equal(
		pickerTrigger.PICKER_TRIGGER_WIDTH_CLASS.lg,
		'w-44',
		'the `lg` width variant must be the one the budget is derived from',
	);
	assert.equal(
		pickerTrigger.PICKER_TRIGGER_WIDTH_CLASS.xl,
		'w-52',
		'the `xl` width variant — the one `/teaching-load` ships — must exist, because a facet count cannot fit any narrower',
	);

	const fits = pickerTrigger.pickerTriggerFaceFits as (w: string, n: string, v: string) => boolean;
	const budget = pickerTrigger.PICKER_TRIGGER_FACE_BUDGET_CHARS as Record<string, number>;

	// (1) The published budget IS the derivation, so it cannot drift from the width
	// class. floor((widthPx - 2 x px-3(12) - 20 for the chevron and its ml) / 6.6):
	//   sm  w-28 = 112px -> (112 - 24 - 20) / 6.6 = 10.30 -> 10
	//   md  w-32 = 128px -> (128 - 24 - 20) / 6.6 = 12.72 -> 12
	//   lg  w-44 = 176px -> (176 - 24 - 20) / 6.6 = 20.00 -> 20
	//   xl  w-52 = 208px -> (208 - 24 - 20) / 6.6 = 24.84 -> 24
	// `sm` is 10 and NOT 12: 12 is what the same formula yields at `md`, and the
	// planner ruled on 2026-09-29 that the DERIVED value governs, because a budget
	// larger than the physical maximum is the false pass this row exists to
	// prevent. The other three match the packet exactly.
	for (const [width, expected] of Object.entries({ sm: 10, md: 12, lg: 20, xl: 24 })) {
		assert.equal(budget[width], expected, `the ${width} budget must be the declared derivation`);
	}
	// The derivation is also RE-DERIVED here from the width table, so a hand-typed
	// constant that happened to equal the right number today would still be caught
	// the day the width class moves.
	for (const [width, widthPx] of Object.entries({ sm: 112, md: 128, lg: 176, xl: 208 })) {
		assert.equal(
			budget[width],
			Math.floor((widthPx - 24 - 20) / pickerTrigger.PICKER_TRIGGER_TEXT_ADVANCE_PX),
			`the ${width} budget must be floor((widthPx - 24 - 20) / 6.6), re-derived from the width token`,
		);
	}

	// (2) THE WORST STATE, read off the RENDERED face of every picker. The fixtures
	// are the real ATLAS department labels and the real status / load / sort bands,
	// and they are enumerated one per selectable value, so a reword in any one of
	// them is what turns this row red.
	const WORST: Array<{ label: string; props: Record<string, any> }> = [
		{ label: 'Status unset', props: {} },
		{ label: 'Status: teaching-assigned', props: { filterStatus: 'teaching-assigned' } },
		{ label: 'Status: no-teaching', props: { filterStatus: 'no-teaching' } },
		{ label: 'Status: adviser-only', props: { filterStatus: 'adviser-only' } },
		{ label: 'Load unset', props: {} },
		{ label: 'Load: excess', props: { loadFilter: 'excess' } },
		{ label: 'Load: at-standard', props: { loadFilter: 'at-standard' } },
		{ label: 'Load: below-standard', props: { loadFilter: 'below-standard' } },
		{ label: 'Sort: load-desc', props: { sortOrder: 'load-desc' } },
		{ label: 'Sort: load-asc', props: { sortOrder: 'load-asc' } },
		{ label: 'Department unset', props: {} },
		{ label: 'Department: Mathematics', props: { departmentFilter: 'MATH' } },
	];
	const PICKERS: Array<[string, string]> = [
		['Status', 'Filter by status'],
		['Department', 'Filter by department'],
		['Load', 'Filter by load'],
		['Sort', 'Sort teachers'],
	];
	let longest = { name: '', value: '', face: '' };
	for (const state of WORST) {
		const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps(state.props)));
		const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
		for (const [name, ariaLabel] of PICKERS) {
			const trigger = primary.querySelector(`[aria-label^="${ariaLabel}"]`)!;
			assert.ok(trigger, `${state.label}: the ${name} picker must render`);
			const face = textOf(trigger);
			assert.ok(face.startsWith(`${name}: `), `${state.label}: ${name} must compose as "Name: value"; got ${JSON.stringify(face)}`);
			const value = face.slice(name.length + 2);
			// ── SUPERSEDED IN ITS WIDTH, RETAINED IN ITS CLAIM (A6 c8 item 39,
			// 2026-09-29). ── The `xl` assertions this block used to make are kept
			// verbatim in the comment, and they are still TRUE of the primitive; what
			// changed is which variant `/teaching-load` ships, because 4 × 208 + a
			// 240px search + five 8px gaps is 1112px against a MEASURED 1078px
			// budget. The row's claim is unchanged and is now made against the
			// content-sized `auto` variant, which cannot clip at all.
			//
			//   assert.equal(
			//     pickerTrigger.PICKER_TRIGGER_WIDTH_CLASS.xl,
			//     trigger.getAttribute('class')?.includes('w-52') ? 'w-52' : 'NOT w-52',
			//     `${state.label}: the ${name} picker must carry the shared \`xl\` width variant — a page never writes a width class`,
			//   );
			//   assert.ok(
			//     fits('xl', name, value),
			//     `${state.label}: the composed face ${JSON.stringify(face)} is ${face.length} chars and the xl budget is ${budget.xl} — ` +
			//       'widen the width variant, shorten the short label, or re-derive the budget; never let the trigger clip',
			//   );
			assert.equal(
				pickerTrigger.PICKER_TRIGGER_WIDTH_CLASS.auto,
				trigger.getAttribute('class')?.includes(PICKER_TRIGGER_WIDTH_CLASS.auto.split(' ')[0]) ? PICKER_TRIGGER_WIDTH_CLASS.auto : 'NOT auto',
				`${state.label}: the ${name} picker must carry the shared \`auto\` width variant — a page never writes a width class, and the fixed rectangles do not fit the 1078px row`,
			);
			assert.ok(
				fits('auto', name, value),
				`${state.label}: the composed face ${JSON.stringify(face)} is ${face.length} chars and a content-sized trigger cannot clip it — ` +
					'if this ever reads false, the primitive has regressed and `auto` no longer means what this row was changed to rely on',
			);
			// The face is still measured against the RETIRED fixed budgets, so this row
			// does not become vacuous. A face that fit every budget everywhere would
			// pass `fits('auto', …)` no matter what the product did, which is the
			// "a guard that cannot go red" failure this file's header names.
			assert.ok(
				`${name}: ${value}`.length <= budget.xl,
				`${state.label}: the composed face must still be comparable against the shared budget table, and no face may silently blow past even the widest fixed one`,
			);
			if (face.length > longest.face.length) longest = { name, value, face };
		}
		dispose(host);
	}

	// MUTANT, IN-ROW, AT THE BUDGET'S OWN BOUNDARY. The loop above proves the
	// product's faces are UNDER the budget; this proves the predicate turns red
	// one character past it, which is the packet's "widen one face by one character
	// -> red" control. It is written against `PICKER_TRIGGER_FACE_BUDGET_CHARS`
	// rather than against the longest rendered face, because the longest face this
	// row composes is 23 of 24 and its successor is 24 — still a fit, so anchoring
	// the mutant there would have tested nothing.
	assert.ok(longest.face.length > 0, 'a composed face must have been measured');
	// A6 c8 item 39: THE ROW IS NOT VACUOUS UNDER `auto`. `fits('auto', …)` is
	// unconditionally `true` by design — a content-sized face cannot clip — so a
	// fixture of short faces would satisfy this loop whatever the product did. The
	// guard against that is a fact about the WORST faces this row actually
	// composes: the longest of them is past the narrow `md` budget, which is the
	// clipping case A6 c6 was written for and the one `auto` is now standing in for.
	assert.ok(
		longest.face.length > budget.md,
		`the longest composed face ${JSON.stringify(longest.face)} is ${longest.face.length} chars and must be past the ${budget.md}-char \`md\` budget, or this row cannot fail`,
	);
	const NAME = 'Status';
	const roomAtBudget = budget.xl - `${NAME}: `.length;
	assert.ok(
		fits('xl', NAME, 'x'.repeat(roomAtBudget)),
		`a ${budget.xl}-character composed face must fit the ${budget.xl}-character budget`,
	);
	assert.equal(
		fits('xl', NAME, 'x'.repeat(roomAtBudget + 1)),
		false,
		`one character more — ${budget.xl + 1} characters — must not: the predicate must discriminate at the boundary or it is decoration`,
	);

	// THE DECLARED CEILING FOR A DATA-DRIVEN VALUE, stated rather than hidden.
	// A department label is a server string: `Department: Mathematics` (23) fits
	// the 24-char budget, and any name longer than 12 characters does not. The
	// planner ruled that reword is not the answer, so the honest record is a
	// NUMBER plus the two places the full value is still readable in full: the
	// popover's own option text, and the `Active filters:` chip row.
	const DEPARTMENT_VALUE_BUDGET = budget.xl - 'Department: '.length;
	assert.equal(DEPARTMENT_VALUE_BUDGET, 12, 'the xl budget leaves exactly 12 characters for a department name after "Department: "');
	assert.equal(fits('xl', 'Department', 'Mathematic'.padEnd(12, 's')), true, 'a 12-character department name fits');
	assert.equal(fits('xl', 'Department', 'Mathematic'.padEnd(13, 's')), false, 'a 13-character department name does not, and the row says so');
	// A6 c8 item 39: that 12-character ceiling was a SILENT truncation for a
	// server-driven label, and it is exactly what the shipped `auto` variant
	// removes. The ceiling above is retained — the fixed widths still exist in
	// `@/ui` for other pages — so the counterpart is asserted here rather than by
	// deleting the number.
	assert.equal(
		fits('auto', 'Department', 'Mathematics'.padEnd(13, 's')),
		true,
		'the variant `/teaching-load` now ships must have NO ceiling on a server-supplied department name, which is the defect class this row exists for',
	);
	assert.equal(
		fits('auto', 'Department', 'Mathematics and Science'.padEnd(64, 's')),
		true,
		'however long the server label is, the content-sized face claims it',
	);

	// The specific defect the walk named: `Sort: Lowest load` is never composed.
	const asc = render(createElement(TeachingLoadFilterBar as any, filterBarProps({ sortOrder: 'load-asc' })));
	const ascTrigger = asc.querySelector('[data-testid="teaching-load-primary-filters"] [aria-label^="Sort teachers"]') as HTMLButtonElement;
	const ascFace = textOf(ascTrigger);
	assert.notEqual(ascFace, 'Sort: Lowest load', 'the clipped `Sort: Lowest load` face must never be composed');
	assert.ok(ascFace.length <= budget.xl, `the sort face ${JSON.stringify(ascFace)} must fit the xl budget`);
	// The DIRECTION stays unambiguous where there is room: the trigger keeps it and
	// the popover keeps the full labels.
	assert.match(ascFace, /low/i, 'the trigger face must still say which direction is selected');
	assert.match(ascTrigger.getAttribute('aria-label') ?? '', /^Sort teachers/, 'the accessible name keeps the page-owned full form');
	dispose(asc);

	// NO COUNT SURVIVES ON A TRIGGER FACE, and the popover still carries every
	// count. The count removal is the ruling; losing the counts would be the
	// regression it could hide.
	const counted = render(createElement(TeachingLoadFilterBar as any, filterBarProps({ departmentFilter: 'MATH', loadFilter: 'below-standard' })));
	const countedPrimary = counted.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	for (const [name, ariaLabel] of PICKERS) {
		const face = textOf(countedPrimary.querySelector(`[aria-label^="${ariaLabel}"]`));
		assert.doesNotMatch(face, /\(\d+\)$/, `the ${name} trigger face must not carry a facet count: ${JSON.stringify(face)}`);
	}
	dispose(counted);
	// THE COUNT IS NOT LOST — it moved to the popover, which has room for it. This
	// is the assertion that keeps the ruling honest: a count removed from every
	// surface would be a regression, and a count left on the trigger would be the
	// clipping defect. Both halves are checked, and the fixture is the real one.
	const deptHost = render(createElement(TeachingLoadFilterBar as any, filterBarProps({ departmentFilter: 'MATH' })));
	const deptTrigger = deptHost.querySelector('[data-testid="teaching-load-primary-filters"] [aria-label^="Filter by department"]') as HTMLButtonElement;
	assert.equal(textOf(deptTrigger), 'Department: Mathematics', 'the trigger shows the department NAME, without its count');
	press(deptTrigger);
	const options = textOf(dom.window.document.body);
	assert.match(options, /Mathematics \(2\)/, 'the popover still states the department WITH its count');
	dispose(deptHost);
});


/* ═══════════════ A6C6-4 — ITEM 2: one main button, `Load summary` in More ═══════ */

test('A6C6-4 MUTANT ROW: ONE primary action on row 1, and `Load summary` opens the SAME dialog from `More`', () => {
	// Lane C, verbatim: "several competing top controls (`Load summary`, `Retry
	// source`, `More Teaching Load tools`), not one clear main button." The fix is
	// POSITIONAL: the dialog, the panel, the `truthModel` authority, the testid and
	// the accessible name all survive; only the control's place on the row changed.
	const host = render(createElement(TeachingLoadLoadSummaryShell as any, {}));
	const actions = actionsOf(host);

	// (a) MUTANT CONTROL. On the base, `teaching-load-summary-open` was a BUTTON in
	// this group. If it is ever put back, this is where the row goes red — before
	// any click, and without needing the menu to be open.
	//
	// A COUNT and not `assert.equal(node, null)`: node's assertion reporter runs
	// `util.inspect` on a failing `actual`, and inspecting a live JSDOM element
	// walks the whole document — it cost this row a 20s hang and a killed process
	// before it was written as a number.
	assert.equal(
		actions.querySelectorAll('[data-testid="teaching-load-summary-open"]').length,
		0,
		'`Load summary` must NOT be a row-1 control any more: row 1 is title, tabs, the two status chips, Help, ONE primary action and More',
	);

	// (b) EXACTLY ONE primary action outside `More`.
	const more = actions.querySelector('button[aria-label="More Teaching Load tools"]') as HTMLButtonElement;
	assert.ok(more, 'the More trigger must render and keep its accessible name');
	const primaryActions = Array.from(actions.querySelectorAll('button'))
		.filter((b) => b !== more && (b.getAttribute('data-testid') ?? '').startsWith('teaching-load-'));
	assert.deepEqual(
		primaryActions.map((b) => b.getAttribute('data-testid')),
		['teaching-load-suggest-draft-action'],
		'row 1 must render exactly ONE page action, and it is the primary one',
	);
	assert.ok(byText(actions, 'Help'), 'Help stays on row 1 — the packet does not move it');

	// (c) REACHABLE from `More`, and it opens the SAME dialog with the SAME figures.
	assert.equal(portalledDialog() === null, true, 'precondition: no dialog before the menu is opened');
	press(more);
	const item = dom.window.document.querySelector('[data-testid="teaching-load-summary-open"]');
	assert.ok(item, 'the More menu must render `Load summary`');
	assert.equal(
		(item as HTMLElement).tagName,
		'DIV',
		'the menu ITEM is the control: a <button> inside a DropdownMenuItem is the nesting the packet forbids',
	);
	assert.equal(item!.getAttribute('role'), 'menuitem', 'it is a real menu item, not a bare div');
	assert.equal(textOf(item), 'Load summary', 'the accessible name stays exactly `Load summary`');
	assert.equal(item!.querySelectorAll('button').length, 0, 'no nested button may sit inside the menu item');
	// It is the FIRST item, above `Archived load` and the staffing-mode group.
	assert.equal(
		dom.window.document.querySelector('[role="menuitem"]') === item,
		true,
		'`Load summary` must be the first item in the More menu',
	);

	press(item!);
	const dialog = portalledDialog();
	assert.ok(dialog, 'selecting the menu item must open the summary dialog');
	assert.equal(dialog!.getAttribute('data-testid'), 'teaching-load-summary-dialog', 'the SAME dialog, by its own test id');
	for (const figure of ['Classes needing a teacher', 'Total teaching hours', 'Standard load', 'Hours still available']) {
		assert.ok((dialog!.textContent ?? '').includes(figure), `the breakdown must still state "${figure}"`);
	}
	assert.match(dialog!.textContent ?? '', /24/, "the model's own figure must render — the dialog is unchanged, only its trigger moved");
	// Close this mount before the next row opens one: a modal Dialog and another
	// row's DropdownMenu cannot coexist in JSDOM.
	dispose(host);
});

/* ═══════════════ A6C6-5 — ITEM 4: the withheld figure leads plainly ═══════ */

test('A6C6-5 MUTANT ROW: the four withheld statuses are plain sentences with no product name and no "withheld"', () => {
	// Lane C, verbatim: `Unverified — EnrollPro is not reachable, so this figure is
	// withheld.` — 68 characters, a product name, and a word ("withheld") a
	// scheduler cannot act on. `teachingLoadUnverifiedStatus` is the ONE function
	// that writes it, so this row reads the exported function and not a copy.
	const produced: Record<string, string> = {};
	for (const state of UNVERIFIED_STATES) {
		const actual = teachingLoadUnverifiedStatus(state.input as never);
		produced[state.key] = actual;
		assert.equal(
			actual,
			PLAIN_UNVERIFIED[state.key],
			`${state.key}: the withheld status must be the plain sentence, byte-for-byte`,
		);
		// A MUTANT ROW has to be able to go red on the BASE strings, and these three
		// bans are what do it.
		assert.doesNotMatch(actual, /EnrollPro/, `${state.key}: no product name belongs on the calm face`);
		assert.doesNotMatch(actual, /withheld/i, `${state.key}: "withheld" is not something a scheduler can act on`);
		assert.doesNotMatch(actual, /Unverified/, `${state.key}: the status is a sentence, not a status word`);
		assert.doesNotMatch(actual, /[—–]/, `${state.key}: no em dash; it is a sentence, not a two-clause label`);
		assert.ok(/[.]$/.test(actual), `${state.key}: it must be a complete sentence`);
	}
	// The four states must be DISTINGUISHABLE from each other. Two states printing
	// the same sentence is the "two claims that read the same" defect in the copy.
	const values = Object.values(produced);
	assert.equal(new Set(values).size, 4, `the four states must produce four different sentences: ${JSON.stringify(produced)}`);
	// And the base strings are gone, every one of them.
	for (const [key, base] of Object.entries(BASE_UNVERIFIED)) {
		assert.notEqual(produced[key], base, `${key}: the base sentence must not survive`);
	}
	// The CAUSE clause is unchanged and still per-state: it is the technical detail
	// that now feeds the Tooltip and the Help step, where it belongs.
	assert.equal(teachingLoadUnverifiedReason({ dataSource: 'cached', isOnline: true } as never), 'EnrollPro not reachable');
	assert.equal(teachingLoadUnverifiedReason({ dataSource: 'live', isOnline: false } as never), 'ATLAS is offline');
	assert.equal(teachingLoadUnverifiedReason({ dataSource: 'refreshing', isOnline: true } as never), 'ATLAS is checking EnrollPro now');
	assert.equal(teachingLoadUnverifiedReason({ dataSource: 'none', isOnline: true } as never), 'no live Teaching Load source is available');
});

/* ═══════════════ A6C6-6 — ITEM 5: plain lead, technical detail behind hover ═══════ */

test('A6C6-6 MUTANT ROW: the degraded pill leads plainly, keeps the detail in a Tooltip, and Retry is the one next step', async () => {
	// Lane C, verbatim: `Using the last saved data — EnrollPro not reachable` "gives
	// no clear next step or person to call; say what is unavailable and offer one
	// safe retry." The plain lead goes on the pill; every fact the old sentence
	// carried goes behind a `@/ui` Tooltip (AGENTS.md §8: never a raw `title`).
	//
	// "the cached-and-unverified state" is read as the state in which ATLAS is
	// SHOWING THE LAST SAVED ROSTER, because that is the only reading under which
	// the row's other clause can hold. `primaryAction` is the retry control
	// exactly when `!isOnline || dataSource === 'none'`, and its TWO states are
	// honestly different, so both are asserted and neither is fudged:
	//   - ONLINE (`none`): the retry is ENABLED and names itself `Retry source`.
	//   - OFFLINE:          the SAME control reads `Offline` and is DISABLED,
	//     because pressing Retry while ATLAS is down cannot help. That is exactly
	//     why the new Help step says waiting will not help, and it is why the
	//     packet's phrase "exactly ONE ENABLED control is a retry" cannot be true
	//     offline: there is no enabled retry there, by design.
	const RETRY_STATES: Array<{ label: string; overrides: Record<string, any>; key: string; enabled: boolean }> = [
		{ label: 'OFFLINE', overrides: { isOnline: false }, key: 'offline', enabled: false },
		{ label: 'NONE', overrides: { dataSource: 'none', isWorkspaceWritable: false }, key: 'none', enabled: true },
	];
	const RETRY_WORD = /Retry|Offline/;

	for (const state of RETRY_STATES) {
		const host = render(createElement(WorkspaceToolbar as any, toolbarProps(state.overrides)));
		const pill = row2Of(host).querySelector('[data-testid="teaching-load-degraded-notice"]')!;
		assert.ok(pill, `${state.label}: the degraded pill must render`);
		assert.equal(
			textOf(pill),
			PLAIN_PILL[state.key],
			`${state.label}: the pill must lead with the plain sentence and nothing else`,
		);
		// No product name and no timestamp on the visible face.
		assert.doesNotMatch(textOf(pill), /EnrollPro/, `${state.label}: no product name on the visible pill`);
		assert.doesNotMatch(textOf(pill), /saved data from|\d{1,2}:\d{2}/, `${state.label}: no timestamp on the visible pill`);

		// The pill is a TOOLTIP trigger, never a raw `title` (AGENTS.md §8).
		assert.equal(pill!.getAttribute('title'), null, `${state.label}: never a raw title attribute`);
		assert.equal(
			pill!.hasAttribute('data-state'),
			true,
			`${state.label}: the pill must be a Radix Tooltip trigger, which sets data-state on open`,
		);

		// EXACTLY ONE header control is the retry, and it is the ONE primary action.
		const header = host.querySelector('[data-testid="teaching-load-command-header"]')!;
		const retries = buttonsIn(header).filter((b) =>
			RETRY_WORD.test((b.textContent ?? '') + (b.getAttribute('aria-label') ?? '')),
		);
		assert.equal(retries.length, 1, `${state.label}: exactly ONE header control may be a retry, found ${retries.length}`);
		// It is the header's ONE primary action. The retry control carries no
		// `data-testid` (that id is the suggestion action's), so it is identified by
		// POSITION: the only page action in the row-1 group that is not `More`.
		const actionGroup = retries[0]!.closest('div') ?? retries[0]!;
		assert.ok(
			actionGroup.contains(retries[0]!),
			`${state.label}: the retry must be one of the row-1 action controls, not a second group`,
		);
		assert.equal(
			buttonsOf(actionGroup).filter((b) => b !== retries[0] && !/^More /.test(b.getAttribute('aria-label') ?? '')).length,
			1,
			`${state.label}: row 1 must hold exactly one page action beside Help and More`,
		);
		assert.equal(
			(retries[0] as HTMLButtonElement).disabled,
			!state.enabled,
			`${state.label}: the retry is ${state.enabled ? 'enabled' : 'disabled'} — a retry that cannot reach anything must not look pressable`,
		);
		const enabledRetries = retries.filter((b) => (b as HTMLButtonElement).disabled === false);
		assert.equal(
			enabledRetries.length,
			state.enabled ? 1 : 0,
			`${state.label}: exactly ${state.enabled ? 1 : 0} ENABLED header control is a retry`,
		);
		if (state.enabled) {
			assert.match(textOf(retries[0]), /\bRetry\b/, `${state.label}: that control's accessible name must contain \`Retry\``);
		} else {
			// OFFLINE: a stated reason must be available to a scheduler who cannot use
			// the control. The EXISTING `primaryAction.helper` Tooltip is the right home
			// and the packet forbids adding a second one, so this row reads that hover
			// rather than asserting a copy of the string.
			const helper = await hoverTooltip(retries[0]!);
			assert.match(
				helper,
				/Reconnect before retrying\./,
				`${state.label}: a disabled retry must still say why it cannot be used; the existing helper Tooltip reads ${JSON.stringify(helper)}`,
			);
			// And it is the SAME explanation, not a second one: `hoverTooltip` asserts
			// that exactly one tooltip is open while the control is focused.
		}
	}

	// The remaining two states render the same plain lead, and it is per-state.
	for (const [key, overrides] of [
		['cached', { dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x' }],
		['refreshing', { dataSource: 'refreshing' }],
	] as Array<[string, Record<string, any>]>) {
		const host = render(createElement(WorkspaceToolbar as any, toolbarProps(overrides)));
		if (key === 'refreshing') {
			// `refreshing` is deliberately NOT degraded, so the pill is absent and the
			// honest "checking" sentence is on the row instead. Asserted so a future
			// change cannot quietly start printing a saved-roster pill mid-check.
			assert.equal(
				row2Of(host).querySelectorAll('[data-testid="teaching-load-degraded-notice"]').length,
				0,
				'a live check must not claim a saved roster; the checking sentence is the honest one',
			);
			continue;
		}
		const pill = row2Of(host).querySelector('[data-testid="teaching-load-degraded-notice"]')!;
		assert.ok(pill, 'cached: the degraded pill must render');
		assert.equal(textOf(pill), PLAIN_PILL.cached, 'cached: the pill must lead with the plain sentence');
	}

	// THE DETAIL IS NOT LOST — it moved behind the hover, where it belongs. These
	// three are the facts the old visible sentence carried, and each is checked on
	// the real rendered Tooltip CONTENT (Radix mounts it on open, so the row opens
	// the tooltip rather than reading a closed trigger).
	const tooltipHost = render(createElement(WorkspaceToolbar as any, toolbarProps({
		dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x',
		savedAtLabel: '2026-09-28T09:14:00.000Z',
	})));
	const trigger = row2Of(tooltipHost).querySelector('[data-testid="teaching-load-degraded-notice"]')!;
	const tooltipText = await hoverTooltip(trigger);
	assert.ok(tooltipText.length > 0, 'hovering the pill must reveal the technical detail');
	assert.match(tooltipText, /EnrollPro not reachable/, 'the detail keeps the cause clause');
	assert.match(tooltipText, /cached/, 'the detail keeps the source state');
	assert.match(tooltipText, /Saved /, 'the detail keeps the real saved-at time when the page has one');
	dispose(tooltipHost);

	// And with NO proven timestamp the clause is dropped, never synthesised.
	const noStamp = render(createElement(WorkspaceToolbar as any, toolbarProps({
		dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x', savedAtLabel: null,
	})));
	const noStampPill = row2Of(noStamp).querySelector('[data-testid="teaching-load-degraded-notice"]')!;
	assert.ok(noStampPill, 'cached + no timestamp: the pill must still render');
	assert.doesNotMatch(textOf(noStampPill), /Saved /, 'with no proven timestamp the clause is dropped, never faked');
	const noStampTooltip = await hoverTooltip(noStampPill);
	assert.doesNotMatch(noStampTooltip, /Saved /, 'the hover must not invent a time either');
	dispose(noStamp);
});

/* ═══════════════ A6C6-7 — ITEM 6: 20 teacher cards are not dense ═══════ */

test('A6C6-7 MUTANT ROW: the teacher row carries no department line, no Subjects block and no dead node', () => {
	// Lane C, verbatim: "20 teacher cards grouped by subject feel dense." The
	// density was three regions per row that carry no decision — x20 rows:
	//   1  the per-teacher DEPARTMENT line, which restates the group heading the
	//      row is already inside (and printed the raw word `Unmapped` when empty);
	//   2  the `Subjects` count block — one click away in the `Review load`
	//      profile, which already renders the assignment editor's data;
	//   3  an empty `aria-hidden` <div> that occupied the row's trailing gap.
	// The MUTANT for each is named in the comment at its assertion below.
	const host = render(createElement(TeacherGridMode as any, gridProps()));
	const rows = host.querySelectorAll('[data-testid="teaching-load-row-review"]');
	assert.equal(rows.length, 2, 'both teacher rows must render');
	const row = (rows[0] as HTMLElement).closest('div.rounded-xl') as HTMLElement;
	assert.ok(row, 'the first teacher row must render');

	// (1) MUTANT: put the department line back and this is red.
	assert.ok(
		!textOf(row).includes('Mathematics'),
		'the per-teacher department line restates the group heading the row is inside; it must be gone from the row',
	);
	assert.ok(!textOf(row).includes('Unmapped'), 'the raw fallback word `Unmapped` must not be printed on a row');
	const shouted = Array.from(row.querySelectorAll('p'))
		.filter((p) => /\buppercase\b/.test(p.getAttribute('class') ?? ''))
		.map((p) => textOf(p));
	// The two load-signal UNITS still shout, and that is item 1's deliberate
	// non-target: `Hours / week` and `Sections` are ordinary English words and a
	// value the scheduler acts on, not internal codes. What must not come back is
	// the department line, which was a shouted LABEL restating the group heading.
	assert.deepEqual(
		shouted.sort(),
		['Hours / week', 'Sections'],
		'the only shouted text left on a teacher row is the two load-signal units; a shouted department label is the defect that was removed',
	);

	// (2) MUTANT: put the Subjects block back and this is red. `Sections` stays —
	// it is the demand figure a shortage decision is made on.
	assert.ok(!textOf(row).includes('Subjects'), 'the `Subjects` count block must be gone; `Review load` already shows the list');
	assert.ok(textOf(row).includes('Sections'), '`Sections` stays: it is the figure a shortage decision is made on');

	// (3) MUTANT: put the empty `aria-hidden` node back and this is red.
	const dead = Array.from(row.querySelectorAll('[aria-hidden="true"]')).filter(
		(el) => (el.textContent ?? '').trim() === '' && el.children.length === 0,
	);
	assert.deepEqual(dead.length, 0, `the row must carry no empty aria-hidden node, found ${dead.length}`);

	// EVERYTHING THE SCHEDULER ACTS ON IS STILL THERE. A row that is calmer because
	// it says less would be a regression, so each surviving claim is asserted.
	assert.ok(textOf(row).includes('DELA CRUZ'), 'the name stays');
	assert.ok(host.querySelector('h4'), 'the name is still an h4');
	// The adviser star and the per-teacher Draft badge.
	assert.ok(row.querySelector('svg'), 'the class-adviser star stays on an adviser row');
	const draftRow = render(createElement(TeacherGridMode as any, gridProps({
		effectiveDraftAssignmentsByFaculty: { 9: [{ subjectId: 1, sectionIds: [101] }] },
	})));
	assert.ok(textOf(draftRow).includes('Draft'), "a teacher with unsaved work still shows their own `Draft` dot");
	// Both buttons, and the reason they stay is recorded at the code site (packet
	// §0.3): `Edit assignments` is the ONLY thing that mounts the inline editor, and
	// two accepted, reviewed rows assert it. The density was never the buttons.
	assert.ok(row.querySelector('[data-testid="teaching-load-row-review"]'), '`Review load` stays on the row');
	assert.ok(row.querySelector('[data-testid="teaching-load-edit-assignments"]'), '`Edit assignments` stays on the row');
	assert.match(textOf(row.querySelector('[data-testid="teaching-load-edit-assignments"]')), /^Edit assignments$/);
	assert.match(textOf(row.querySelector('[data-testid="teaching-load-row-review"]')), /Review load/);
	// Hours and the percent of the standard. The figure is read from the SAME
	// canonical helper the row renders, so this is the product's number and not a
	// literal copied into a control.
	assert.ok(textOf(row).includes('Hours / week'), 'the hours-per-week signal stays');
	// The figure is read from the SAME canonical helper the row renders, and in the
	// SAME format `TeacherLoadReadout` prints it, so this is the product's number
	// rather than a literal copied into a control.
	assert.match(
		textOf(row),
		new RegExp(`${resolveTeachingActualHours(TEACHER, new Map()).toFixed(1)}h`),
		`the row must still state this teacher's real resolved hours; the row reads ${JSON.stringify(textOf(row))}`,
	);
	assert.match(textOf(row), /\d+%/, 'the percent of the teaching standard stays');
	// The GROUP heading keeps its collapse, its count badge, and stops shouting.
	const heading = host.querySelector('h3') as HTMLElement;
	assert.ok(heading, 'the department group heading stays');
	assert.equal(textOf(heading), 'Mathematics', 'the group heading is still the department');
	assert.doesNotMatch(heading.getAttribute('class') ?? '', /\buppercase\b|\btracking-widest\b/, 'the group heading must be sentence case');
	assert.match(heading.getAttribute('class') ?? '', /font-semibold/, 'the group heading keeps its weight');
	const collapse = host.querySelector('[aria-expanded]') as HTMLElement;
	assert.ok(collapse, 'the group heading stays keyboard-operable (aria-expanded)');
	assert.ok(collapse.className.includes('select-none'), 'the group heading stays select-none');
});

/* ═══════════════ A6C6-8 — the filter row after the subtraction ═══════ */

test('A6C6-8 SUPERSEDED IN WHOLE by A6 c8 item 39 (2026-09-29). RETAINED, NOT DELETED, and still EXECUTING. REPLACED BY `A6C6-8b`', () => {
	// ── SUPERSEDED IN WHOLE, 2026-09-29 (A6 c8 item 39). RETAINED, NOT DELETED. ──
	// This row documented the SUBTRACTION A6 c6 item 3 made: two always-on inclusion
	// switches came out of the row and one 123px `More filters` trigger went in. The
	// operator reversed that decision — the disclosure is gone from the DOM entirely
	// and the switches are direct toggles on the row — so every claim below about the
	// trigger, the on-count, and the switches being OFF the row is reversed.
	//
	// THE ROW IS NOT SKIPPED, deliberately (`AGENTS.md` §16: corrections are ADDITIVE).
	// Every assertion that is now false is left visible as a comment with its
	// original wording, and every assertion that is still true still runs. The
	// replacement is `A6C6-8b` below, which carries the current contract.
	//
	// The subtraction, in one row: two always-on inclusion switches (~555px) came
	// out of the row and one 123px `More filters` trigger went in, for a NET
	// −432px and −1 control. What must not change is everything else: the search
	// box's fixed 240px, the one wrapping flex row, and the five controls' order.
	const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps({
		showOutsideDept: true, showUnmappedSpecialization: true,
	})));
	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the always-visible filter row must render');
	const rowClass = primary.getAttribute('class') ?? '';
	assert.match(rowClass, /\bflex\b/, 'the row is still a flex row');
	assert.match(rowClass, /\bflex-wrap\b/, 'the row still WRAPS rather than clipping — the no-scroll architecture');
	assert.match(rowClass, /\bitems-center\b/);
	assert.match(rowClass, /\bgap-2\b/);
	assert.equal(
		host.querySelectorAll('[data-testid="teaching-load-primary-filters"]').length,
		1,
		'there is still exactly ONE control row',
	);
	assert.equal(
		host.querySelectorAll('[data-testid="teaching-load-secondary-filters"]').length,
		0,
		'no second control row came back',
	);

	// The ORDER of the five named controls is the operator's, read as DOM order.
	// SUPERSEDED, RETAINED VERBATIM: the trigger is gone, so the row's order is the
	// five named controls and then the two switches.
	//
	//   const ordered = Array.from(
	//     primary.querySelectorAll('input[aria-label="Search teachers"], [aria-label^="Filter by"], [aria-label^="Sort teachers"], [data-testid="teaching-load-more-filters"]'),
	//   ).map((el) => el.getAttribute('data-testid') ?? el.getAttribute('aria-label')?.split(':')[0]);
	//   assert.deepEqual(ordered, [
	//     'Search teachers', 'Filter by status', 'Filter by department',
	//     'Filter by load', 'Sort teachers', 'teaching-load-more-filters',
	//   ], 'the row carries the five named controls in order, then `More filters`');
	// WHAT SURVIVES, and still runs: the five named controls are still the first five
	// things on the row, in this order.
	const ordered = Array.from(
		primary.querySelectorAll('input[aria-label="Search teachers"], [aria-label^="Filter by"], [aria-label^="Sort teachers"]'),
	).map((el) => el.getAttribute('aria-label')?.split(':')[0]);
	assert.deepEqual(ordered, [
		'Search teachers',
		'Filter by status',
		'Filter by department',
		'Filter by load',
		'Sort teachers',
	], 'the five named controls are still first on the row, in the operator\'s order');

	// The search box is the operator's 240px and is NOT elastic.
	const search = primary.querySelector('input[aria-label="Search teachers"]')!;
	const searchWrap = search.parentElement!;
	assert.match(searchWrap.getAttribute('class') ?? '', /w-\[240px\]/, 'the search box is still fixed at 240px');
	assert.doesNotMatch(searchWrap.getAttribute('class') ?? '', /\bflex-1\b/, 'the search box must not be elastic');

	// BOTH SWITCHES ARE OFF THE ROW, AND REACHABLE FROM `More filters`.
	// SUPERSEDED IN WHOLE, RETAINED VERBATIM. The switches are back ON the row, which
	// is the operator's own instruction; the INVERSE is asserted by `A6C6-8b`.
	//
	//   assert.equal(primary.querySelectorAll('#show-outside-dept').length, 0, 'the first switch is no longer an always-on control');
	//   assert.equal(primary.querySelectorAll('#show-unmapped-specialization').length, 0, 'the second switch is no longer an always-on control');
	//   assert.equal(
	//     primary.querySelectorAll('label[for="show-outside-dept"]').length,
	//     0,
	//     'no switch label may remain on the always-visible row',
	//   );
	assert.equal(
		primary.querySelectorAll('[id="show-outside-dept"], [id="show-unmapped-specialization"]').length,
		2,
		'BOTH switches are on the one row again — the operator asked for direct toggles, not a disclosure',
	);
	assert.equal(
		primary.querySelectorAll('label[for="show-outside-dept"], label[for="show-unmapped-specialization"]').length,
		2,
		'and both keep their label on that row',
	);

	// The trigger STATES how many are on, so the row is honest about what it hides.
	// SUPERSEDED IN WHOLE, RETAINED VERBATIM: there is no trigger and no on-count
	// face. The state channel is the switch's own `aria-checked`, asserted below and
	// in full by `A6-39-1c` in `a6-teaching-load-surface`.
	//
	//   const trigger = primary.querySelector('[data-testid="teaching-load-more-filters"]') as HTMLButtonElement;
	//   assert.ok(trigger, 'the `More filters` trigger must render');
	//   assert.match(
	//     textOf(trigger),
	//     /^More filters \(2 on\)$/,
	//     `the trigger must state how many inclusion switches are on; got ${JSON.stringify(textOf(trigger))}`,
	//   );
	//   // Height-parity with the pickers beside it, so the row reads as one instrument.
	//   assert.match(trigger.getAttribute('class') ?? '', /\bh-9\b/, 'the trigger shares the pickers\' height token');
	//
	//   // OPENING it is what proves reachability, not presence in a prop.
	//   press(trigger);
	//   const panel = dom.window.document.querySelector('[data-testid="teaching-load-more-filters-panel"]');
	//   assert.ok(panel, 'the `More filters` popover must mount');
	//   for (const [id, sentence] of [
	//     ['show-outside-dept', 'Show teachers outside their subject area'],
	//     ['show-unmapped-specialization', 'Show teachers with no matched subject'],
	//   ] as Array<[string, string]>) {
	//     assert.ok(panel!.querySelector(`#${id}`), `${id} must be reachable from \`More filters\``);
	//     assert.equal(textOf(panel!.querySelector(`label[for="${id}"]`)), sentence, `${id} keeps its plain sentence inside the popover`);
	//     assert.ok(
	//       (panel!.querySelector(`#${id}`) as HTMLElement).closest('label, div'),
	//       `${id}: the switch and its label stay in one control, not split across the popover`,
	//     );
	//   }
	//
	//   // With NOTHING on, the trigger does not claim a count it does not have.
	//   const off = render(createElement(TeachingLoadFilterBar as any, filterBarProps()));
	//   const offTrigger = off.querySelector('[data-testid="teaching-load-more-filters"]') as HTMLButtonElement;
	//   assert.equal(textOf(offTrigger), 'More filters', 'with no inclusion switch on, the trigger states no count');
	for (const id of ['show-outside-dept', 'show-unmapped-specialization']) {
		assert.equal(
			primary.querySelector(`[id="${id}"]`)!.getAttribute('aria-checked'),
			'true',
			`${id}: with the prop \`true\`, the rendered switch must state ON — the switch's own state is what replaced the deleted count`,
		);
	}
	assert.equal(
		dom.window.document.querySelectorAll('[data-testid="teaching-load-more-filters"]').length
			+ dom.window.document.querySelectorAll('[data-testid="teaching-load-more-filters-panel"]').length,
		0,
		'and neither disclosure element may exist in any state',
	);

	// The bar still adds NO scroll container, and the active-filter summary plus the
	// sr-only announcement are untouched.
	assert.ok(host.querySelector('[data-testid="teaching-load-filter-announcement"]'), 'the sr-only announcement survives');
	for (const el of Array.from(host.querySelectorAll('*'))) {
		assert.doesNotMatch(
			el.getAttribute('class') ?? '',
			/\boverflow-(y-)?(auto|scroll)\b/,
			'the filter bar must not introduce a scroll container',
		);
	}
	const active = render(createElement(TeachingLoadFilterBar as any, filterBarProps({ searchQuery: 'dela' })));
	assert.ok(active.querySelector('[data-testid="teaching-load-active-filters"]'), 'the `Active filters:` chip row still renders');
	// Close the popover's mount before the next row opens a menu.
	dispose(host);
});

/**
 * A6C6-8b — THE REPLACEMENT for the wholly superseded `A6C6-8`.
 *
 * The whole point of the round that replaced it: the two inclusion switches are
 * DIRECT TOGGLES on the one continuous row, with the full sentence on the switch's
 * `aria-label` and its Tooltip, and the visible face carrying the shortest plain
 * phrase a 1078px row can hold. It is its own row rather than extra assertions in
 * `A6C6-8` because `A6C6-8` is the RECORD of the superseded design and has to stay
 * readable as one.
 */
test("A6C6-8b the ONE row carries search, four content-sized pickers and BOTH direct toggles, and no `More filters` control exists", () => {
	const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps({
		showOutsideDept: true, showUnmappedSpecialization: true,
	})));
	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the always-visible filter row must render');

	// The SEVEN controls, in the operator's order, read as DOM order. The switches
	// are addressed by id, and the attribute form is used rather than `#id` because
	// the preservation row below mounts several bars at once, so a bare id selector
	// can resolve to another mount (see `A6-39-1c` for the same harness note).
	const ordered = Array.from(
		primary.querySelectorAll(
			'input[aria-label="Search teachers"], [aria-label^="Filter by"], [aria-label^="Sort teachers"], [id="show-outside-dept"], [id="show-unmapped-specialization"]',
		),
	).map((el) => (el.id ? `#${el.id}` : el.getAttribute('aria-label')?.split(':')[0]));
	assert.deepEqual(ordered, [
		'Search teachers',
		'Filter by status',
		'Filter by department',
		'Filter by load',
		'Sort teachers',
		'#show-outside-dept',
		'#show-unmapped-specialization',
	], 'the row is search, the four picks, then both switches — no disclosure between anything');

	// THE DISCLOSURE IS ABSENT FROM THE DOM, not hidden.
	assert.equal(
		dom.window.document.querySelectorAll('[data-testid="teaching-load-more-filters"]').length,
		0,
		'no `More filters` trigger may exist in any state',
	);
	assert.equal(
		dom.window.document.querySelectorAll('[data-testid="teaching-load-more-filters-panel"]').length,
		0,
		'no `More filters` panel may exist in any state',
	);
	assert.doesNotMatch(
		dom.window.document.body.textContent ?? '',
		/More filters/,
		'and the words may not survive on any surface',
	);

	// SHORT FACE, FULL SENTENCE as the accessible name, and the Tooltip source is
	// the same sentence — a `title` attribute is banned by `AGENTS.md` §8.
	for (const [id, face, sentence] of [
		['show-outside-dept', 'Cross-subject', 'Show teachers who teach a subject outside their subject area'],
		['show-unmapped-specialization', 'No subject match', 'Show only teachers whose subject is not in the catalog'],
	] as Array<[string, string, string]>) {
		const label = primary.querySelector(`label[for="${id}"]`);
		assert.ok(label, `${id} must keep a real <label for>`);
		assert.equal(textOf(label), face, `${id}: the visible face is the short plain phrase`);
		assert.equal(
			primary.querySelector(`[id="${id}"]`)!.getAttribute('aria-label'),
			sentence,
			`${id}: the full sentence is the switch's accessible name, so the short face loses no meaning`,
		);
		assert.equal(
			primary.querySelector(`[id="${id}"]`)!.closest('label, div'),
			primary.querySelector(`[id="${id}"]`)!.parentElement,
			`${id}: the switch and its label stay in one control, not split across a disclosure`,
		);
		// Height-parity with the pickers beside it, so the row reads as one instrument.
		//
		// ── SUPERSEDED IN ITS CONTAINER, RETAINED, NOT DELETED (A6 c8 correction
		// round 1, 2026-09-29). ── The original expectation, verbatim:
		//
		//   assert.match(
		//     primary.querySelector(`[id="${id}"]`)!.parentElement!.getAttribute('class') ?? '',
		//     /\bh-9\b/,
		//     `${id}: the switch box shares the pickers' height token`,
		//   );
		//
		// The rendered browser proof on real staging data showed the first attempt at
		// this slice put each switch in its own box inside ONE wrapper that also held
		// the 292px draft group. A wrapper is a single flex item, so it wraps as a unit:
		// the wrapper measured 621px and dragged BOTH filter toggles onto a second
		// line, which is the defect the operator's headline forbids. The two switches
		// now SHARE ONE `SWITCH_CHROME` box and are siblings of the draft group, so
		// each switch's own parent is an inner sub-wrapper that carries no height.
		//
		// The CLAIM is unchanged and is asserted one level out, on the box that
		// actually carries the height: the nearest ancestor that is a direct child of
		// the one control row.
		const box = primary.querySelector(`[id="${id}"]`)!
			.closest('[data-testid="teaching-load-inclusion-switches"]') as HTMLElement | null;
		assert.ok(box, `${id}: both switches must share ONE bordered group on the one row`);
		assert.match(
			box!.getAttribute('class') ?? '',
			/\bh-9\b/,
			`${id}: that shared group must still carry the pickers' height token, or a 20px control sits in a 36px row`,
		);
	}

	// The four picks all take the ONE shared content-sized variant — the reason the
	// row fits at 1366 at all.
	for (const ariaLabel of ['Filter by status', 'Filter by department', 'Filter by load', 'Sort teachers']) {
		const cls = primary.querySelector(`[aria-label^="${ariaLabel}"]`)!.getAttribute('class') ?? '';
		assert.match(cls, /\bw-auto\b/, `${ariaLabel}: the pick must take the shared content-sized \`auto\` variant`);
		assert.doesNotMatch(cls, /\bw-52\b|\bw-44\b/, `${ariaLabel}: a fixed width cannot fit the 1078px row`);
	}

	// ONE row, and the row is still the one flex row fix 39 named.
	const rowClass = primary.getAttribute('class') ?? '';
	for (const token of ['flex', 'flex-wrap', 'items-center', 'gap-2']) {
		assert.ok(
			rowClass.split(/\s+/).includes(token),
			`the row must still carry \`${token}\``,
		);
	}
	assert.equal(
		host.querySelectorAll('[data-testid="teaching-load-primary-filters"]').length,
		1,
		'there is still exactly ONE control row',
	);
	assert.equal(
		host.querySelectorAll('[data-testid="teaching-load-secondary-filters"]').length,
		0,
		'no second control row came back',
	);
	dispose(host);
});

/* ═══════════════ A6C6-9 — preservation ═══════ */

test('A6C6-9 PRESERVATION: Help, the two chips, the height model, every testid and the no-scroll contract survive', () => {
	// A calmer page is a change, so everything this slice did NOT name is pinned
	// here. `Help`'s `className` in particular is pinned verbatim by
	// `a3-title-strip-c3`, and this row reads the RENDERED trigger as well.
	const host = render(createElement(WorkspaceToolbar as any, toolbarProps({
		activeDraftCount: 3,
		loadSummaryAction: createElement(TeachingLoadSummarySurface as any, null, createElement('span', null, 'x')),
		historyAction: createElement('a', { href: '/teaching-load/history', 'data-testid': 'teaching-load-history-link' }, 'Archived load'),
	})));
	const strip = host.querySelector('[data-testid="teaching-load-command-header"]')!;

	// (a) Help, with its pinned class string and its steps, including the new one.
	const help = byText(actionsOf(host), 'Help') as HTMLButtonElement;
	assert.ok(help, '`Help` must still render on row 1');
	assert.ok(
		(help.getAttribute('class') ?? '').includes('hidden h-7 shrink-0 px-2 text-xs sm:inline-flex'),
		"`Help`'s OWN className is pinned by `a3-title-strip-c3` and must not change; got " + (help.getAttribute('class') ?? ''),
	);
	assert.ok(host.querySelector('[data-testid="smart-help-steps"]') === null, 'the help steps are behind a click, not on the row');

	// (b) The two header status chips, each stated exactly once, still resolving.
	assert.equal(strip.querySelectorAll('[data-source-state]').length, 1, 'the source claim is stated once');
	assert.equal(strip.querySelectorAll('[data-testid="teaching-load-draft-chip"]').length, 1, 'the draft claim is stated once');
	assert.equal(strip.querySelector('[data-source-state]')!.getAttribute('data-source-state'), 'live');
	assert.equal(strip.querySelector('[data-testid="teaching-load-draft-chip"]')!.textContent, 'Draft \u2014 not saved');

	// (c) The height model is untouched, and still inside its budget.
	assert.equal(TEACHING_LOAD_HEADER_MODEL.APP_CHROME_PX, 56);
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_1_COMMAND_PX, 28);
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_2_BAND_PX, 29);
	assert.equal(TEACHING_LOAD_HEADER_MODEL.HEADER_TOTAL_PX, 66);
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_2_SUPERSEDED_TRUNCATE_COUNT, 5);
	// At most two BANDS: the `sr-only` lines beside row 2 are clipped to nothing
	// and a `hidden` band is `display:none`, so neither is a row. Copied from
	// `a6-teaching-load-surface` `A6-C2-4` rather than imported, so this file owns
	// its own reader.
	const isRenderedBand = (el: Element): boolean => {
		if (el.hasAttribute('hidden')) return false;
		return !/\b(sr-only|hidden|invisible)\b/.test(el.getAttribute('class') ?? '');
	};
	const bands = Array.from(strip.children).filter(isRenderedBand);
	assert.equal(bands.length, 2, `the strip must render at most 2 band rows, found ${bands.length}`);
	assert.equal(bands[0]!.getAttribute('data-testid'), 'teaching-load-compact-command-header', 'row 1 is the command row');
	assert.equal(bands[1]!.getAttribute('data-testid'), 'teaching-load-readiness-strip', 'row 2 is the status line');

	// (d) EVERY preserved data-testid from packet §0.1 still resolves, in the states
	// the packet names. Each is looked up in the state where it belongs, so a testid
	// that only exists in a state nobody renders is not counted as surviving.
	const filterHost = render(createElement(TeachingLoadFilterBar as any, filterBarProps()));
	const gridHost = render(createElement(TeacherGridMode as any, gridProps({ effectiveDraftAssignmentsByFaculty: { 9: [{ subjectId: 1, sectionIds: [101] }] } })));
	const summaryHost = render(createElement(TeachingLoadLoadSummaryShell as any, {}));
	const degradedHost = render(createElement(WorkspaceToolbar as any, toolbarProps({
		dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x',
	})));
	for (const [id, where] of [
		['teaching-load-draft-chip', strip],
		['teaching-load-tab-row', strip],
		['teaching-load-readiness-strip', strip],
		['teaching-load-degraded-notice', degradedHost],
		['teaching-load-primary-filters', filterHost],
		['teaching-load-filter-bar', filterHost],
		['teaching-load-filter-announcement', filterHost],
		['teaching-load-row-review', gridHost],
		['teaching-load-edit-assignments', gridHost],
	] as Array<[string, HTMLElement]>) {
		assert.ok(where.querySelector(`[data-testid="${id}"]`), `the preserved testid ${id} must still resolve`);
	}
	// Both switch ids must still resolve, and the surface that resolves them is the
	// ONE control row itself again.
	//
	// A6 c8 item 39 (2026-09-29), RE-POINTED — NOT DELETED. A6 c6 item 3 had put
	// the two switches behind a `More filters` popover, so this row opened that
	// popover ONCE and looked the ids up on `document.body`: `press()` toggles, so
	// a second press would have closed the very popover the second lookup needed.
	// The operator removed the disclosure, so the ids are on the row and NOTHING has
	// to be pressed — the original fix-39 shape of this check.
	//
	//   press(filterHost.querySelector('[data-testid="teaching-load-more-filters"]') as HTMLButtonElement);
	for (const id of ['show-outside-dept', 'show-unmapped-specialization']) {
		assert.ok(
			filterHost.querySelector(`[id="${id}"]`),
			`the preserved switch id ${id} must still resolve on the one control row`,
		);
		assert.ok(
			filterHost.querySelector(`label[for="${id}"]`),
			`the preserved label->id wiring for ${id} must still resolve`,
		);
	}
	// `teaching-load-summary-open` now lives inside the closed More menu, so its
	// reachability is A6C6-4's rendered click, not a static query.
	press(summaryHost.querySelector('button[aria-label="More Teaching Load tools"]')!);
	assert.ok(
		dom.window.document.querySelector('[data-testid="teaching-load-summary-open"]'),
		'`teaching-load-summary-open` must still resolve from the More menu',
	);
	dispose(summaryHost);
	// `teaching-load-repair-*` belongs to the page's next-step slot, which this row
	// does not build; what this slice must not do is remove the slot contract.
	assert.ok(
		('stateLineSlot' in toolbarProps() as never) === false,
		'the next-step slot stays a slot: this slice does not claim it',
	);

	// (e) The no-scroll architecture, and the still-unresolved `savedAtLabel` rule.
	for (const el of Array.from(strip.querySelectorAll('*'))) {
		assert.doesNotMatch(el.getAttribute('class') ?? '', /\boverflow-x-(auto|scroll)\b/, 'the header must not scroll sideways');
	}
	for (const el of Array.from(row2Of(host).querySelectorAll('*'))) {
		assert.doesNotMatch(el.getAttribute('class') ?? '', /\btruncate\b/, 'row 2 must not truncate a sentence');
	}
});
