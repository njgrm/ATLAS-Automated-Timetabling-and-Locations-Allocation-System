/**
 * A6-TEACHING-LOAD-SURFACE — rendered evidence for the operator's
 * `docs/reviews/operator-fixes-20260928/fix-2.docx` items 38, 39, 40, and for
 * `fix-1.1.docx` item 16.1 on the Teaching Load side.
 *
 * WHY EVERY ROW HERE RENDERS.
 *
 * `docs/prompts`: "evidence per fix must be a RENDERED test that shows the
 * requested visible result. A source-text assertion is not acceptance
 * evidence." These four items are all things a scheduler SEES:
 *
 *   16.1  a `Review load` button in every teacher row's gap
 *   38    a `Load summary` header button that opens the complete breakdown
 *   39    one filter row with all seven controls, and no `More filters`
 *   40    draft controls in the toolbar, and a confirmation before saving
 *
 * A control that read the `.tsx` and asserted a string would pass unchanged if
 * the element were `hidden`, if the click were bound to a no-op, or if the
 * dialog opened a different teacher. So each row below mounts the REAL
 * component, finds the control by its rendered text or test id, and CLICKS it,
 * then reads the resulting DOM. The handful of source-string rows are labelled
 * as belt-and-braces over a rendered claim and never stand in for one.
 *
 * JSDOM limits, stated rather than hidden: it performs no layout (so nothing
 * here claims a pixel width — a class token is asserted as a DECLARED class and
 * the real-browser confirmation is left to the visual lane) and it does not
 * apply Tailwind. What it does give is the real element tree, real event
 * dispatch, and real React state transitions, which is what every claim below
 * turns on.
 *
 * The JSDOM harness is copied VERBATIM from the accepted sibling
 * `a3-teachers-load-c3.test.tsx` (its lines 1-~120) so the render / act / click
 * helpers behave exactly as they do for the controls this file sits beside.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement, useState } from 'react';
import { JSDOM } from 'jsdom';

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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');

const { TeachingLoadFilterBar } = await import('@/components/faculty-assignments/TeachingLoadFilterBar');
const { TeacherGridMode } = await import('@/components/faculty-assignments/TeacherGridMode');
const { TeachingLoadDraftActionBar } = await import('@/components/faculty-assignments/TeachingLoadDraftActionBar');
const { TeachingLoadSummaryDialog } = await import('@/components/faculty-assignments/TeachingLoadSummaryDialog');
const { TeachingLoadSummarySurface } = await import('@/components/faculty-assignments/TeachingLoadSummarySurface');
const { TeachingLoadTruthPanel } = await import('@/components/faculty-assignments/TeachingLoadTruthPanel');
const { TeachingLoadInspectorTriggers } = await import('@/components/faculty-assignments/TeachingLoadInspectorTriggers');
const { WorkspaceToolbar } = await import('@/components/faculty-assignments/WorkspaceToolbar');
const { TeachingLoadModals } = await import('@/components/faculty-assignments/TeachingLoadModals');
const { TeachingLoadRepairQueue } = await import('@/components/faculty-assignments/TeachingLoadRepairQueue');
// A6 C2 CORRECTION: the real hook, so row 2's slot carries the hook's OWN
// strings. Hand-written items here are what let the degraded defect through.
const { useTeachingLoadRepairQueue } = await import('@/hooks/useTeachingLoadRepairQueue');
const { SectionGridMode } = await import('@/components/faculty-assignments/SectionGridMode');
const { ReviewTeachersModal } = await import('@/components/faculty-assignments/ReviewTeachersModal');
const { WorkloadInspector } = await import('@/components/faculty-assignments/WorkloadInspector');
const teacherReviewEntry = await import('@/components/faculty-assignments/teacherReviewEntry');
const { openTeacherReview, STAFF_WORKLOAD_REVIEW_LABEL } = teacherReviewEntry as unknown as {
	openTeacherReview: (s: { setViewMode: (m: 'teacher' | 'allocation') => void; setReviewModalOpen: (o: boolean) => void }) => void;
	STAFF_WORKLOAD_REVIEW_LABEL: string;
};
const { reviewModalCopy, buildTeachingLoadWorkspaceState } = await import('@/components/faculty-assignments/teachingLoadWorkspaceMetrics');
const {
	isTeachingLoadSourceDegraded,
	isTeachingLoadSourceUnverified,
	teachingLoadUnverifiedReason,
	teachingLoadUnverifiedStatus,
} = await import('@/components/faculty-assignments/WorkspaceToolbar');
const { Link } = (await import('react-router-dom')) as any;
const { Fragment: Fragment2 } = (await import('react')) as any;
const { ConfirmationModal } = await import('@/ui/confirmation-modal');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
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

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** Radix opens a DROPDOWN on `pointerdown`, not on `click`. */
function press(el: Element) {
	act(() => {
		el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});
}

/**
 * A GENUINE outside pointer-down, on a real element outside the dialog.
 *
 * The target is the host DIV, not `document.body`: Radix's `DismissableLayer`
 * ignores a pointer-down whose target has `pointer-events: none`, and while a
 * dialog is open it sets exactly that on `body`. Dispatching on `body` therefore
 * proves nothing — it is the event a real browser would not even deliver.
 */
async function outsidePointerDown(dialog: Element | null) {
	const outside = Array.from(dom.window.document.body.children)
		.find((child) => !dialog || !dialog.contains(child)) ?? dom.window.document.body;
	// Radix `usePointerDownOutside` registers its document listener inside a
	// `setTimeout(0)`, so a synchronous dispatch would find no listener and
	// prove nothing. Let that timer run FIRST, then deliver a real event.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	await act(async () => {
		for (const type of ['pointerdown', 'pointerup']) {
			outside.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
		}
		await Promise.resolve();
	});
}

function buttonsIn(scope: ParentNode): HTMLButtonElement[] {
	return Array.from(scope.querySelectorAll('button'));
}

function buttonByText(scope: ParentNode, text: string): HTMLButtonElement | null {
	return buttonsIn(scope).find((b) => (b.textContent ?? '').trim() === text) ?? null;
}

/** A Radix Dialog renders into a portal on `document.body`, not into the host. */
function portalledDialog(): HTMLElement | null {
	return dom.window.document.querySelector('[role="dialog"]');
}

const textOf = (el: Element | Document | null | undefined) => (el?.textContent ?? '').trim();

const TEACHER: any = {
	id: 9,
	firstName: 'Maria',
	lastName: 'Dela Cruz',
	department: 'Mathematics',
	employmentStatus: 'REGULAR',
	employeeId: 'EMP-0009',
	isActiveForScheduling: true,
	isClassAdviser: false,
	isPlaceholder: false,
	maxHoursPerWeek: 40,
	policyCreditedHours: 24,
	sectionTeachingHours: 20,
	actualTeachingHours: 20,
	subjectCount: 1,
	sectionCount: 1,
	advisoryEquivalentHours: 0,
	ancillaryMinutesPerWeek: 0,
	advisedSectionName: null,
	version: 1,
	assignments: [],
};

const OTHER_TEACHER: any = { ...TEACHER, id: 14, firstName: 'Roberto', lastName: 'Alcantara' };

/** A canonical truth model with KNOWN values, so the dialog has figures to show. */
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

/** A filter bar with the default props every committed control already uses. */
function filterBarProps(overrides: Record<string, any> = {}) {
	return {
		searchQuery: '', onSearchQueryChange: () => {},
		filterStatus: 'all', onFilterStatusChange: () => {},
		statusFacetCounts: { all: 5, 'teaching-assigned': 3, 'no-teaching': 1, 'adviser-only': 1, excess: 0 },
		loadFilter: 'all', loadFacetCounts: { excess: 0, 'at-standard': 2, 'below-standard': 3 },
		onLoadFilterChange: () => {},
		departmentFilter: 'all', onDepartmentFilterChange: () => {},
		departmentOptions: [{ value: 'all', label: 'All departments', count: 5 }],
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
		selectedId: null,
		onSelectTeacher: () => {},
		effectiveAssignmentsByFaculty: { 9: [], 14: [] },
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
		searchQuery: '', onSearchQueryChange: () => {},
		filterStatus: 'all', onFilterStatusChange: () => {},
		statusFacetCounts: { all: 2, 'teaching-assigned': 2, 'no-teaching': 0, 'adviser-only': 0, excess: 0 },
		loadFilter: 'all', loadFacetCounts: { excess: 0, 'at-standard': 2, 'below-standard': 0 },
		onLoadFilterChange: () => {},
		departmentFilter: 'all', onDepartmentFilterChange: () => {},
		departmentOptions: [],
		filterAnnouncement: '', onClearTeachingLoadFilters: () => {},
		effectiveActualHours: new Map<number, number>(),
		teachingStandardHours: 20, policyReady: true,
		sortOrder: 'load-desc', onSortOrderChange: () => {},
		showFilters: false, onToggleFilters: () => {},
		showOutsideDept: false, onToggleOutsideDept: () => {},
		showUnmappedSpecialization: false, onShowUnmappedSpecializationChange: () => {},
		completedSectionIds: new Set<number>(),
		workspaceStateLabel: 'Ready', workspaceStateNextAction: 'Assign the remaining classes.',
		writeBlockedReason: null,
		onReviewLoad: () => {},
		...overrides,
	};
}

/* ──────────────────────────── Item 16.1 — per-row `Review load` ─────────── */

test('A6-16.1-1 EVERY teacher row shows a `Review load` button in its own gap', () => {
	const host = render(createElement(TeacherGridMode as any, gridProps()));
	const rowControls = host.querySelectorAll('[data-testid="teaching-load-row-review"]');
	assert.equal(rowControls.length, 2, 'each rendered teacher row must carry its own review control');

	// The visible label is exactly the operator's two words, on every row.
	for (const control of Array.from(rowControls)) {
		assert.equal(
			(buttonOf(control).textContent ?? '').trim(),
			'Review load',
			'the per-row control must read `Review load`',
		);
	}
	// `Review load`, not `Review teachers`: the button is inside one teacher's
	// row, so the name says which teacher rather than claiming a whole roster.
	assert.equal(host.querySelectorAll('[data-testid="teaching-load-review-open"]').length, 0, 'the detached control must not exist');

	// The accessible name contains the visible label (WCAG 2.5.3 Label in Name)
	// and additionally names that row's teacher.
	const first = rowControls[0] as HTMLElement;
	const aria = first.getAttribute('aria-label') ?? '';
	assert.ok(aria.startsWith('Review load'), `accessible name must contain the visible label; got "${aria}"`);
	assert.match(aria, /DELA CRUZ/, `the accessible name must name this row's teacher; got "${aria}"`);
	// The compact shape the operator asked for, so it fits the row's gap.
	const cls = first.getAttribute('class') ?? '';
	assert.match(cls, /\bh-8\b/, 'the control must be compact enough for the row gap');
	assert.match(cls, /\bshrink-0\b/, 'the control must not be squeezed by the load signals');
	assert.match(cls, /\boutline\b/, 'the control is a secondary action inside a data row');
	assert.equal(first.getAttribute('title'), null, 'no raw title attribute (AGENTS.md §8)');

	// It sits BETWEEN the name/department block and the load-signals block —
	// the spacious gap the operator named — not after the signals.
	//
	// `!== 0` rather than `=== true`: `compareDocumentPosition` returns a
	// BITMASK, and the `&` against the constant yields a number.
	const name = Array.from(host.querySelectorAll('h4'))
		.find((h) => (h.textContent ?? '').includes('DELA CRUZ'));
	assert.ok(name, 'the teacher name must render in the row');
	assert.ok(
		((name as HTMLElement).compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		'the control must come AFTER the name block',
	);
	const hoursLabel = Array.from(host.querySelectorAll('p'))
		.find((p) => (p.textContent ?? '').trim().toUpperCase() === 'HOURS / WEEK');
	assert.ok(hoursLabel, 'the HOURS / WEEK signal must render in the row');
	assert.ok(
		(first.compareDocumentPosition(hoursLabel as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		'the control must come BEFORE the HOURS / WEEK signal — i.e. in the gap between them',
	);
});

function buttonOf(el: Element): HTMLElement {
	return el as HTMLElement;
}

test('A6-16.1-2 clicking `Review load` opens THAT teacher and does NOT expand the row', () => {
	// The whole point of the control. The row is a `div role="button"` that
	// toggles expansion, so without `stopPropagation` ONE click both opens the
	// modal and expands the body behind it — the two claims below fail together
	// if that call is ever removed.
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	const reviewed: number[] = [];
	act(() => {
		root.render(inRouter(createElement(TeacherGridMode as any, gridProps({
			onReviewLoad: (id: number) => { reviewed.push(id); },
		}))));
	});

	// The SECOND row, so the assertion cannot pass on a hard-coded first id.
	const controls = Array.from(host.querySelectorAll('[data-testid="teaching-load-row-review"]'));
	assert.equal(controls.length, 2);
	const second = controls[1] as HTMLElement;
	assert.match(second.getAttribute('aria-label') ?? '', /ALCANTARA/, 'precondition: this is Alcantara\'s row');

	// Precondition: the row advertises no inline expansion.
	//
	// SUPERSEDED BY A6 C2 (Slice 3, Major 4) — the ORIGINAL expectation, verbatim:
	//
	//   const row = second.closest('[role="button"][aria-expanded]') as HTMLElement;
	//   assert.ok(row, 'the teacher row must render as an expandable control');
	//   assert.equal(row.getAttribute('aria-expanded'), 'false', 'precondition: the row starts collapsed');
	//   ...
	//   const after = second.closest('[role="button"][aria-expanded]') as HTMLElement;
	//   assert.equal(
	//     after.getAttribute('aria-expanded'),
	//     'false',
	//     'clicking `Review load` must NOT also toggle the row open — `event.stopPropagation()` is load-bearing',
	//   );
	//
	// WHY. Lane C: a compact 58px card "expands INLINE into a very long assignment
	// editor containing `Unassign all`, `Assign GR8`, checkboxes, and Swap
	// controls… it pushes the entire roster away and places destructive-looking
	// controls among ordinary inspection content." The row is no longer a
	// disclosure AT ALL — inspecting opens a read-only profile dialog and only the
	// explicit `Edit assignments` control mounts the editor — so there is no
	// `aria-expanded` left to read.
	//
	// The claim is UNCHANGED and STRICTLY STRONGER. `stopPropagation()` is still
	// load-bearing, and instead of watching a state FLAG the replacement below
	// watches the rendered CONTENT: if the click bubbled to the row, the editor
	// would be in the DOM, and these editor controls would be on screen among the
	// ordinary inspection content the operator is reading. A flag can be wrong
	// while the page is right; the controls cannot.
	const row = second.closest('[role="button"]') as HTMLElement;
	assert.ok(row, 'the teacher row must still render as a control');
	assert.equal(
		row.getAttribute('aria-expanded'),
		null,
		'the row must not advertise an expansion it no longer performs (A6 C2)',
	);
	assert.equal(
		host.querySelector('[data-testid="teaching-load-assignment-editor"]') === null,
		true,
		'precondition: no inline assignment editor is mounted while the row is collapsed',
	);

	click(second);

	assert.deepEqual(
		reviewed,
		[OTHER_TEACHER.id],
		`the click must call onReviewLoad with THAT member's id; saw ${JSON.stringify(reviewed)}`,
	);
	// The load-bearing claim, on rendered content: `stopPropagation()` is what
	// keeps a profile click from ALSO mounting the editor behind the dialog.
	assert.equal(
		host.querySelector('[data-testid="teaching-load-assignment-editor"]') === null,
		true,
		'clicking `Review load` must NOT also mount the inline assignment editor — `event.stopPropagation()` is load-bearing',
	);
	const rosterAfter = host.textContent ?? '';
	for (const forbidden of ['Unassign all', 'Assign GR', 'Reset assignments']) {
		assert.equal(
			rosterAfter.includes(forbidden),
			false,
			`inspection must not expose "${forbidden}" in the roster`,
		);
	}
	// The row stays keyboard-operable: it is a real focusable control, and
	// the new button is a real button, so both are in the Tab order.
	assert.equal(row.getAttribute('tabindex'), '0', 'the row must stay keyboard-operable');
	assert.equal((second as HTMLButtonElement).tagName, 'BUTTON', 'the per-row control is a real button');
	assert.equal((second as HTMLButtonElement).type, 'button', 'and it must not submit anything');
});

/* ─────────────────────── Item 38 — the `Load summary` modal ─────────────── */

/** Open the header's `More` menu and return its items. The one way to reach them. */
function openMoreMenu(host: HTMLElement): HTMLElement[] {
	press(host.querySelector('button[aria-label="More Teaching Load tools"]')!);
	return Array.from(dom.window.document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
}

/**
 * Open `Load summary` the way a scheduler now does: through the `More` menu.
 * A6 c6 item 2 moved the control off header row 1, so every row that used to
 * `click()` it on the row now takes this path. It is a helper and not a change of
 * claim: each row still decides its own assertion about the dialog it opens.
 */
function openSummaryFromMore(host: HTMLElement): HTMLElement {
	const item = openMoreMenu(host).find(
		(el) => el.getAttribute('data-testid') === 'teaching-load-summary-open',
	) as HTMLElement;
	assert.ok(item, 'the More menu must render the `Load summary` item');
	press(item);
	return host;
}

test('A6-38-1 SUPERSEDED FOR POSITION by A6-38-1b (A6 c6 item 2, 2026-09-29): clicking `Load summary` opens a dialog with the COMPLETE breakdown', () => {
	// The production composition: the header button and the dialog are SIBLINGS
	// in `pages/TeachingLoad.tsx`, so this mounts them the same way — a real
	// `onClick` that flips a real `open` state — and proves the CLICK is what
	// opens it. A component mounted already-open would prove nothing about the
	// button.
	//
	// ── SUPERSEDED IN PART, 2026-09-29 (A6 c6 item 2). RETAINED, NOT DELETED. ──
	// Lane C, verbatim: "several competing top controls (`Load summary`, `Retry
	// source`, `More Teaching Load tools`), not one clear main button." `Load
	// summary` is therefore no longer a row-1 control: it is the FIRST item inside
	// the `More` menu. Everything this row asserts about the CONTROL — its exact
	// accessible name `Load summary`, its `data-testid`, and the complete
	// breakdown the dialog renders — is UNCHANGED and still asserted, and the
	// REPLACEMENT row `A6-38-1b` below proves the same dialog opens from the new
	// place by opening the menu and clicking the item.
	// ── WHAT IS SUPERSEDED, precisely: the `h-7` / `bg-background` / `shrink-0`
	// row-1 chrome assertions and the two `compareDocumentPosition` ORDER
	// assertions. They cannot survive: the packet forbids a `<button>` nested
	// inside a `DropdownMenuItem`, and a menu item is not `h-7` and does not carry
	// the row-1 `outline` variant. The claim they made — "this control is on row
	// 1, after Help, before the primary action" — is the exact claim the slice
	// reverses, so it is superseded in full rather than half-kept.
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(inRouter(createElement(TeachingLoadLoadSummaryShell as any, {}))); });

	// ── SUPERSEDED, A6 c6 item 2: the opener is no longer a row-1 `<button>`, so
	// it cannot be found in the CLOSED header. The control's NAME and TESTID are
	// what this row still decides, and they are read from the open menu — which
	// `A6-38-1b` now owns end to end.
	const more = host.querySelector('button[aria-label="More Teaching Load tools"]') as HTMLButtonElement;
	assert.ok(more, 'the `More` trigger must render; `Load summary` now lives inside it');
	const items = openMoreMenu(host);
	const opener = items.find((item) => item.getAttribute('data-testid') === 'teaching-load-summary-open') as HTMLElement;
	assert.ok(opener, 'the More menu must carry the `Load summary` control, with its testid intact');
	assert.equal((opener.textContent ?? '').trim(), 'Load summary', 'the control reads exactly `Load summary`');
	assert.equal(opener.getAttribute('title'), null, 'no raw title attribute (AGENTS.md §8)');
	assert.equal(
		items.indexOf(opener),
		0,
		'it is the FIRST item, above `Archived load` and the `Staffing mode` group',
	);

	// Precondition: no dialog.
	assert.equal(portalledDialog() === null, true, 'precondition: no dialog before the click');

	click(opener);

	const dialog = portalledDialog();
	assert.ok(dialog, 'clicking `Load summary` must open a dialog');
	// It is a real accessible dialog with the requested title.
	assert.equal(
		dialog!.getAttribute('data-testid'),
		'teaching-load-summary-dialog',
		'the dialog must be addressable by its own test id',
	);
	const dialogText = dialog!.textContent ?? '';
	assert.match(dialogText, /Load summary/, 'the dialog is titled `Load summary`');

	// The COMPLETE breakdown: overall class assignment figures AND capacity
	// metrics, exactly as the operator enumerated them.
	for (const figure of [
		'Classes needing a teacher',
		'Total teaching hours',
		'Standard load',
		'School hard cap',
		'Above standard',
		'Hours still available',
	]) {
		assert.ok(
			dialogText.includes(figure),
			`the summary dialog must state "${figure}"; saw ${JSON.stringify(dialogText.slice(0, 400))}`,
		);
	}
	// The figures are the model's, not placeholders.
	assert.match(dialogText, /24/, 'the required-pair count from the model must render');
	assert.match(dialogText, /20h/, 'the 1200 teaching minutes must render as 20h');
	// The disclosure is OPEN, so the breakdown is visible without a second click.
	assert.ok(
		dialog!.querySelector('[data-testid="teaching-load-truth-summary"]'),
		'the metric rows must be present in the open dialog',
	);
	// One scroll region, bounded — no global scrollbar.
	const scrollers = Array.from(dialog!.querySelectorAll('*'))
		.filter((el) => /\boverflow-y-auto\b/.test(el.getAttribute('class') ?? ''));
	assert.equal(scrollers.length, 1, `the dialog must contain exactly one scroll region, found ${scrollers.length}`);
	assert.match(
		(scrollers[0] as HTMLElement).getAttribute('class') ?? '',
		/max-h-\[70vh\]/,
		'the dialog scroll region must be bounded so it can never exceed the viewport',
	);
	// Belt-and-braces: the dialog frame duplicates no metric, it takes a node.
	const dialogSource = read('src/components/faculty-assignments/TeachingLoadSummaryDialog.tsx');
	assert.doesNotMatch(
		dialogSource,
		/Classes needing|Standard load|Total teaching hours/,
		'the dialog must not re-list the metrics; it renders the caller\'s real panel node',
	);
	assert.match(dialogSource, /children: ReactNode/, 'the dialog takes the real panel as children');
});

test('A6-38-1b THE REPLACEMENT for the superseded POSITION half of A6-38-1 (A6 c6 item 2): `More` -> `Load summary` opens the SAME dialog', () => {
	// WHAT THIS ROW IS FOR. Lane C asked for one clear main button, so
	// `Load summary` moved into the `More` menu. The risk of that move is
	// REACHABILITY, and a static render cannot see it: Radix mounts no menu
	// content until the menu is open, so a control could have been deleted
	// outright and every source-level assertion would still be green. This row
	// therefore does the whole path the old row did — open the menu, find the item
	// by its testid, CLICK it, read the dialog — and adds the one thing the old row
	// did not need: that row 1 is left with exactly ONE page action.
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(inRouter(createElement(TeachingLoadLoadSummaryShell as any, {}))); });

	// (a) Row 1 no longer offers the breakdown, and offers exactly one action.
	const row1 = host.querySelector('[data-testid="teaching-load-compact-command-header"]')!;
	assert.equal(
		row1.querySelectorAll('[data-testid="teaching-load-summary-open"]').length,
		0,
		'`Load summary` must not be a row-1 control any more: the header is title, tabs, the two status chips, Help, ONE primary action and More',
	);
	assert.equal(
		buttonsIn(row1).filter((b) => (b.getAttribute('data-testid') ?? '').startsWith('teaching-load-')).length,
		1,
		'row 1 must render exactly ONE page action outside More',
	);
	assert.ok(buttonByText(row1, 'Help'), '`Help` stays on row 1 — the packet does not move it');
	const suggestion = row1.querySelector('[data-testid="teaching-load-suggest-draft-action"]');
	assert.ok(suggestion, 'and that one action is still the primary suggestion action');

	// (b) The item is reachable, is a real menu item, and is the FIRST one.
	const items = openMoreMenu(host);
	const item = items.find((el) => el.getAttribute('data-testid') === 'teaching-load-summary-open') as HTMLElement;
	assert.ok(item, 'the More menu must render `Load summary`, testid intact');
	assert.equal(item.getAttribute('role'), 'menuitem', 'it is a real menu item');
	assert.equal(textOf(item), 'Load summary', 'the accessible name is unchanged: exactly `Load summary`');
	assert.equal(item.querySelectorAll('button').length, 0, 'and no <button> is nested inside the item — the item IS the control');
	assert.equal(items.indexOf(item), 0, 'it is the FIRST item, above `Archived load` and `Staffing mode`');

	// (c) Selecting it opens the SAME dialog with the SAME breakdown.
	assert.equal(portalledDialog() === null, true, 'precondition: no dialog before the item is selected');
	press(item);
	const dialog = portalledDialog();
	assert.ok(dialog, 'selecting the menu item must open the summary dialog');
	assert.equal(dialog!.getAttribute('data-testid'), 'teaching-load-summary-dialog', 'the SAME dialog, by its own test id');
	const dialogText = dialog!.textContent ?? '';
	assert.match(dialogText, /Load summary/, 'the dialog is still titled `Load summary`');
	for (const figure of [
		'Classes needing a teacher',
		'Total teaching hours',
		'Standard load',
		'School hard cap',
		'Above standard',
		'Hours still available',
	]) {
		assert.ok(dialogText.includes(figure), `the summary dialog must still state "${figure}"`);
	}
	assert.match(dialogText, /24/, "the model's own required-pair count must render — the panel authority did not move");
	assert.match(dialogText, /20h/, 'the 1200 teaching minutes must render as 20h — the panel is unchanged');
	assert.ok(
		dialog!.querySelector('[data-testid="teaching-load-truth-summary"]'),
		'the disclosure is OPEN, so the breakdown is visible without a second click',
	);
	assert.equal(
		Array.from(dialog!.querySelectorAll('*')).filter((el) => /\boverflow-y-auto\b/.test(el.getAttribute('class') ?? '')).length,
		1,
		'and it is still the ONE bounded scroll region Lane C asked for',
	);
});

/**
 * The production composition for item 38: the REAL `WorkspaceToolbar` (which
 * owns the `Load summary` header button) beside the REAL summary dialog, wired
 * by the same `setLoadSummaryOpen` the page uses.
 *
 * The real toolbar is used rather than a stand-in button on purpose. A control
 * that mounts its own `<button>Load summary</button>` and clicks it proves the
 * DIALOG works, and nothing about the header — the button's variant, its
 * position in the action group, or whether it is wired at all. The toolbar takes
 * a fixed prop set; every value below is a plain scalar or a no-op, and
 * `stateLineSlot` is left out so the row renders only the actions under test.
 *
 * The slot is composed EXACTLY as `pages/TeachingLoad.tsx` composes it:
 * `WorkspaceToolbar`'s `loadSummaryAction` carries the real
 * `TeachingLoadSummarySurface`, which owns the open flag and renders the real
 * `TeachingLoadSummaryDialog` around the real `TeachingLoadTruthPanel`. The
 * test therefore clicks the production button and the state transition is the
 * production one, not a harness copy of it.
 */
function TeachingLoadLoadSummaryShell() {
	return createElement(
		'div',
		null,
		createElement(WorkspaceToolbar as any, {
			realAssignedPairs: 22, syntheticPlaceholderPairs: 1, unassignedPairs: 2, totalPairs: 24,
			overCapCount: 0, excessTeachingCount: 3, policyReady: true,
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
			// The one prop item 38 adds, carrying the real surface node.
			loadSummaryAction: createElement(
				TeachingLoadSummarySurface as any,
				null,
			createElement(TeachingLoadTruthPanel as any, {
				expanded: true,
				// A6 C2 (Major 3): the page passes `vertical` next to `expanded`,
				// so this fixture must too — a control that mounted the pill layout
				// while the product renders the stacked one would measure a fiction.
				vertical: true,
				model: TRUTH_MODEL,
				loading: false,
				sourceRevision: 'rev-1',
				upstreamVerified: true,
				unresolvedReasons: [],
			}),
			),
		}),
	);
}

test('A6-38-2 the page header state line no longer carries the inline summary band', () => {
	// The removal half of item 38, asserted on the page's own source because the
	// claim is about a component NOT being rendered. The rendered half is
	// A6-38-1 above: the same figures are still reachable, in one click.
	const page = read('src/pages/TeachingLoad.tsx');
	// `[Archived load]` must STAY in the header action group — it is a
	// navigation link, not a figure, and item 38 did not ask to move it.
	assert.match(page, /data-testid="teaching-load-history-link"/, '`Archived load` must remain in the header action group');
	// The inline truth panel is gone from the header state line, and the header
	// is wired to the summary surface that replaced it.
	assert.match(page, /loadSummaryAction=\{/, 'the header must be wired to the summary surface');
	assert.match(
		page,
		/<TeachingLoadSummarySurface>[\s\S]{0,200}<TeachingLoadTruthPanel\s+expanded/,
		'the surface must wrap the real, expanded `<TeachingLoadTruthPanel` in this file',
	);
	// The truth panel still renders in this file — as the dialog's body — and
	// stays spelled `<TeachingLoadTruthPanel` for the committed contract test
	// that inspects the 400 characters before it.
	assert.match(
		page,
		/<TeachingLoadTruthPanel/,
		'the page must still render the real truth panel',
	);
	// And the panel is no longer `inline` anywhere on the page: that mode is what
	// put it on the dense state line in the first place.
	assert.doesNotMatch(page, /<TeachingLoadTruthPanel\s+inline/, 'the panel must not be back in the header state line');
	// The summary surface is a SIBLING of the shell, not inside `stateLineSlot`.
	assert.doesNotMatch(
		page,
		/stateLineSlot=\{[^}]*TeachingLoadSummary/,
		'the summary surface must not be rendered inside the header state line slot',
	);
});

/* ──────────────────────── Item 39 — the one compact filter row ──────────── */

test('A6-39-1 SUPERSEDED IN PART by A6-39-1b (A6 c6 items 1 and 3, 2026-09-29): ONE row carries all seven controls, and `More filters` is gone', () => {
	// ── SUPERSEDED IN PART, 2026-09-29. RETAINED, NOT DELETED. ──
	// A6 c6 item 3 moved the two optional-inclusion SWITCHES out of the
	// always-visible row into a `More filters` popover on that same row, so this
	// row's claims about the two switches and about the ABSENCE of a `More filters`
	// control are both superseded. Item 1 also reworded the switch labels.
	// EVERYTHING ELSE IN THIS ROW STANDS AND STILL RUNS BELOW: one continuous
	// wrapping flex row, no second row, the shared picker chrome, and the fixed
	// 240px non-elastic search box. The replacement `A6-39-1b` carries the new
	// contract: the five named controls plus `More filters`, both switches inside
	// it, and the ids unchanged so the label->id wiring is still asserted.
	const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps()));
	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the filter row must render');
	const rowClass = primary.getAttribute('class') ?? '';
	assert.match(rowClass, /\bflex\b/);
	assert.match(rowClass, /\bflex-wrap\b/, 'the row wraps rather than clipping');
	assert.match(rowClass, /\bitems-center\b/);
	assert.match(rowClass, /\bgap-2\b/);

	// ── SUPERSEDED: "The seven controls, in the operator's order, read as DOM
	// order" listed the two switch ids as the sixth and seventh members of the
	// always-visible row. Those two are now inside the `More filters` popover, so
	// the ORDER assertion is over four fewer elements and the ids are absent from
	// this row by design. The five that remain are still ordered, and that is
	// asserted here AND, with the `More filters` trigger, in the replacement.
	//
	//   const ordered = Array.from(
	//     primary.querySelectorAll('[aria-label], #show-outside-dept, #show-unmapped-specialization'),
	//   ).map((el) => el.getAttribute('aria-label')?.split(':')[0] ?? `#${el.getAttribute('id')}`);
	//   assert.deepEqual(ordered, [
	//     'Search teachers', 'Filter by status', 'Filter by department',
	//     'Filter by load', 'Sort teachers',
	//     '#show-outside-dept', '#show-unmapped-specialization',
	//   ], 'the seven controls must appear in the operator\'s order on the one row');
	const ordered = Array.from(primary.querySelectorAll('[aria-label^="Search teachers"], [aria-label^="Filter by"], [aria-label^="Sort teachers"]'))
		.map((el) => el.getAttribute('aria-label')?.split(':')[0]);
	assert.deepEqual(ordered, [
		'Search teachers',
		'Filter by status',
		'Filter by department',
		'Filter by load',
		'Sort teachers',
	], 'the five named controls must appear in the operator\'s order on the one row');

	// Every pick in the row shares the ONE chrome: `@/ui/picker-trigger`, as
	// `/subjects` shipped it. A5 C3 slice B, update not delete.
	//
	// BEFORE this loop required the PAGE-LOCAL chrome, verbatim:
	//   [h-9, text-xs, px-2.5, rounded-xl, border-border/60, bg-background,
	//    hover:bg-muted/40, transition-colors]
	// That was `CONTROL_CHROME` — a page's own string applied to a shared control, which
	// `AGENTS.md` §8 "One look per control" forbids, and the reason this row looked like no
	// other filter in the product. R1 B4 removes it.
	//
	// A6 c6 item 3, update again: the four picks now take the shared `xl` width
	// variant (`w-52`, a 24-character declared budget) instead of `md` (`w-32`, 12
	// characters), because the base clipped `Sort: Lowest load`, `Department: All`
	// and `Status: No teaching load (3)` at 1366. §8 "One look per control" is
	// about a ROW not mixing a control's looks, so all four take the same width and
	// the old `w-32` assertion is superseded by the `w-52` one below.
	for (const name of ['Filter by status', 'Filter by department', 'Filter by load', 'Sort teachers']) {
		// Prefix match, because the shared primitive composes `: <selected value>` onto
		// the page's own accessible name (the same contract `/subjects` shipped with).
		// BEFORE: an exact match on `Filter by status`.
		const trigger = primary.querySelector(`[aria-label^="${name}"]`)!;
		const cls = trigger.getAttribute('class') ?? '';
		for (const token of [/\bh-9\b/, /\bw-52\b/, /\btext-xs\b/, /\bpx-3\b/, /\brounded-lg\b/, /\bbg-background\b/, /\bnormal-case\b/]) {
			assert.match(cls, token, `the "${name}" pick must carry the shared control chrome`);
		}
		// The page-local look is gone, not renamed.
		for (const gone of [/\brounded-xl\b/, /\bborder-border\/60\b/, /\bhover:bg-muted\/40\b/, /\buppercase\b/, /\btracking-tight\b/]) {
			assert.doesNotMatch(cls, gone, `the "${name}" pick still carries a page-local look override`);
		}
		// The slice-A trap: a hard min-width floor overrides the variant in CSS whatever
		// the class list says.
		assert.doesNotMatch(
			cls,
			/min-w-\[[^\]]*\]/,
			`the "${name}" pick has a min-width floor, which will override the shared width variant in CSS`,
		);
	}

	// The search input: fixed 240px, h-9, text-xs, and NOT elastic any more.
	const search = primary.querySelector('input[aria-label="Search teachers"]')!;
	const container = search.parentElement!;
	const containerClass = container.getAttribute('class') ?? '';
	assert.match(containerClass, /w-\[240px\]/, 'the search container is fixed at 240px');
	assert.doesNotMatch(containerClass, /\bflex-1\b/, 'the search box must not be elastic');
	assert.doesNotMatch(containerClass, /\bw-full\b/, 'the search box must not be full-width');
	const searchClass = search.getAttribute('class') ?? '';
	assert.match(searchClass, /\bh-9\b/, 'the search input is h-9');
	assert.match(searchClass, /\btext-xs\b/, 'the search input is text-xs');

	// ── SUPERSEDED: "`More filters` and the second row are both GONE." The SECOND
	// ROW is still gone and is still asserted below; the `More filters` CONTROL is
	// back, as a popover on the same row, and its replacement is in `A6-39-1b`.
	// The secondary row's absence is a no-scroll claim and it is not in doubt.
	assert.equal(host.querySelector('[data-testid="teaching-load-secondary-filters"]'), null, 'the second row must be removed');
	// ── SUPERSEDED: `assert.equal(buttonByText(host, 'More filters'), null, …)` and
	// the `for (const button of buttonsIn(host))` loop banning the label. The
	// control exists again; what must not come back is a SECOND ROW, which the
	// assertion above already covers.
	//
	//   assert.equal(buttonByText(host, 'More filters'), null, 'the `More filters` button must be removed');
	//   for (const button of buttonsIn(host)) {
	//     assert.doesNotMatch((button.textContent ?? '').trim(), /More filters/, 'no control may reintroduce the disclosure');
	//   }

	// ── SUPERSEDED: "Both switches are reachable, and the operator's full words are
	// intact … `assert.match(host.textContent, /Unmapped Specialization/, …)`". A6
	// c6 item 1 replaced both labels with plain sentences — `Show teachers outside
	// their subject area` and `Show teachers with no matched subject` — and item 3
	// moved them into the `More filters` popover, so they are not in this row's
	// text at all. The IDS are UNCHANGED, so the label->id wiring is still asserted
	// — in `A6-39-1b`, from the opened popover rather than from a closed row.
	//
	//   assert.ok(primary.querySelector('label[for="show-outside-dept"]'), 'the cross-dept toggle must be labelled');
	//   assert.ok(primary.querySelector('label[for="show-unmapped-specialization"]'), 'the unmapped-specialization toggle must be labelled');
	//   assert.match(host.textContent ?? '', /Unmapped Specialization/, 'the operator\'s full toggle wording must survive');

	// The bar still adds NO scroll container, and the active-filter summary and
	// the sr-only announcement are untouched.
	assert.equal(host.querySelector('[data-testid="teaching-load-filter-announcement"]') !== null, true, 'the sr-only announcement must survive');
	for (const el of Array.from(host.querySelectorAll('*'))) {
		assert.doesNotMatch(
			el.getAttribute('class') ?? '',
			/\boverflow-(y-)?(auto|scroll)\b/,
			'the filter bar must not introduce a scroll container',
		);
	}
	// A suppressed variant: with active filters the badge row still renders and
	// the control row is unchanged.
	const active = render(createElement(TeachingLoadFilterBar as any, filterBarProps({ searchQuery: 'dela' })));
	assert.ok(
		active.querySelector('[data-testid="teaching-load-active-filters"]'),
		'the active-filter badge row must still render',
	);
	assert.equal(
		active.querySelectorAll('[data-testid="teaching-load-primary-filters"]').length,
		1,
		'there is still exactly one control row',
	);
});

test('A6-39-1b THE REPLACEMENT for the superseded switch half of A6-39-1 (A6 c6 items 1 and 3): five controls + `More filters`, and both switches inside it', () => {
	const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps({
		showOutsideDept: true, showUnmappedSpecialization: true,
	})));
	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the filter row must render');

	// The ORDER, including the new trigger: five named controls, then `More filters`.
	const ordered = Array.from(
		primary.querySelectorAll('input[aria-label="Search teachers"], [aria-label^="Filter by"], [aria-label^="Sort teachers"], [data-testid="teaching-load-more-filters"]'),
	).map((el) => el.getAttribute('data-testid') ?? el.getAttribute('aria-label')?.split(':')[0]);
	assert.deepEqual(ordered, [
		'Search teachers',
		'Filter by status',
		'Filter by department',
		'Filter by load',
		'Sort teachers',
		'teaching-load-more-filters',
	], 'the row is the five named controls in order, then `More filters`');

	// BOTH SWITCHES ARE INSIDE IT, and the TRIGGER STATES THE COUNT, so a narrowed
	// roster is never narrowed silently.
	const trigger = primary.querySelector('[data-testid="teaching-load-more-filters"]') as HTMLButtonElement;
	assert.ok(trigger, 'the `More filters` trigger must render');
	assert.match(trigger.getAttribute('class') ?? '', /\bh-9\b/, 'it shares the pickers\' height token');
	assert.equal(
		(trigger.textContent ?? '').trim(),
		'More filters (2 on)',
		'the trigger must state how many inclusion switches are on',
	);
	assert.equal(
		primary.querySelectorAll('#show-outside-dept, #show-unmapped-specialization').length,
		0,
		'neither switch may remain on the always-visible row',
	);

	press(trigger);
	const panel = dom.window.document.querySelector('[data-testid="teaching-load-more-filters-panel"]');
	assert.ok(panel, 'the `More filters` popover must mount');
	// THE IDS ARE UNCHANGED, so the label->id WIRING is still asserted here — this
	// is the direct replacement for the superseded `label[for=…] must be labelled`
	// assertions, and it is STRONGER: it reads the label a scheduler actually
	// sees, not merely that one exists.
	for (const [id, sentence] of [
		['show-outside-dept', 'Show teachers outside their subject area'],
		['show-unmapped-specialization', 'Show teachers with no matched subject'],
	] as Array<[string, string]>) {
		assert.ok(panel!.querySelector(`#${id}`), `${id} must be reachable from \`More filters\``);
		assert.equal(textOf(panel!.querySelector(`label[for="${id}"]`)), sentence, `${id} keeps Lane C's exact plain sentence`);
	}
	assert.doesNotMatch(textOf(panel), /Cross-Dept|Unmapped Specialization/, 'the old shouted wording must not survive anywhere in the popover');

	// And the second row is still gone: `More filters` is a popover on the SAME
	// row, not the second band fix 39 removed.
	assert.equal(
		dom.window.document.querySelectorAll('[data-testid="teaching-load-secondary-filters"]').length,
		0,
		'no second control row may come back',
	);
	assert.equal(
		host.querySelectorAll('[data-testid="teaching-load-primary-filters"]').length,
		1,
		'there is still exactly ONE control row',
	);
});

/* ───────────── Item 40 — no sticky footer, and a save confirmation ───────── */

test('A6-40-1 the draft controls live INSIDE the filter row, with no footer bar', () => {
	// The rendered mount point is the claim: the old footer was a `border-t
	// bg-background px-3 py-2` sibling of the workspace shell.
	const host = render(
		createElement(TeacherGridMode as any, gridProps({
			draftControls: createElement(TeachingLoadDraftActionBar as any, {
				activeDraftCount: 0, canUndo: false, canRedo: false,
				isReadOnlyMode: false, saving: false,
				onUndo: () => {}, onRedo: () => {}, onDiscard: () => {}, onSave: () => {},
			}),
		})),
	);
	const bar = host.querySelector('[data-testid="teaching-load-draft-action-bar"]');
	assert.ok(bar, 'the draft control group must render');
	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the filter row must render');
	assert.ok(
		primary.contains(bar),
		'the draft group must be INSIDE the single filter row, not a separate bottom bar',
	);
	// Right-aligned on that row, so the seven filters stay left and the actions
	// sit at the end of the same line.
	const slot = bar!.parentElement!;
	assert.match(slot.getAttribute('class') ?? '', /\bml-auto\b/, 'the draft group must be pushed to the end of the row');
	// And the footer chrome is genuinely gone.
	const barClass = bar!.getAttribute('class') ?? '';
	assert.doesNotMatch(barClass, /\bborder-t\b/, 'no footer border');
	assert.doesNotMatch(barClass, /\bpx-3\b/, 'no footer padding');
	assert.equal(host.querySelector('[data-testid="teaching-load-draft-save-reason"]'), null, 'the footer helper line must be removed');
	assert.doesNotMatch(host.textContent ?? '', /DRAFT STATUS/, 'the footer heading must be removed');
	// Exactly ONE such group on the page.
	assert.equal(
		host.querySelectorAll('[data-testid="teaching-load-draft-action-bar"]').length,
		1,
		'the draft group must render once, not in two places',
	);
});

function renderDraftBar(overrides: Record<string, any> = {}) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	const calls = { undo: 0, redo: 0, discard: 0, save: 0 };
	act(() => {
		root.render(inRouter(createElement(TeachingLoadDraftActionBar as any, {
			activeDraftCount: 0, canUndo: false, canRedo: false,
			isReadOnlyMode: false, saving: false,
			onUndo: () => { calls.undo += 1; },
			onRedo: () => { calls.redo += 1; },
			onDiscard: () => { calls.discard += 1; },
			onSave: () => { calls.save += 1; },
			...overrides,
		})));
	});
	return { host, calls };
}

test('A6-40-2 `Save changes` is disabled with no drafts, enabled with drafts, and Undo/Redo are reachable', () => {
	// Rest first.
	const atRest = renderDraftBar();
	const restBar = atRest.host.querySelector('[data-testid="teaching-load-draft-action-bar"]')!;
	const saveAtRest = buttonByText(restBar, 'Save changes');
	assert.ok(saveAtRest, 'the bar must render a button labelled exactly `Save changes`');
	assert.equal((saveAtRest as HTMLButtonElement).disabled, true, '`Save changes` must be disabled while no draft action exists');
	assert.match(
		saveAtRest!.getAttribute('class') ?? '',
		/\bopacity-60\b/,
		'the disabled primary must recede with low opacity',
	);
	// Undo and Redo are icon buttons with the requested tooltips, disabled with
	// no draft actions. AGENTS.md §8 forbids a raw `title=`, so the tooltip text
	// is the accessible name plus TooltipContent — both asserted here.
	const undo = restBar.querySelector('[aria-label="Undo change"]') as HTMLButtonElement;
	const redo = restBar.querySelector('[aria-label="Redo change"]') as HTMLButtonElement;
	assert.ok(undo && redo, 'both icon controls must be addressable by their accessible names');
	assert.equal(undo.disabled, true, 'Undo must be disabled with no draft actions');
	assert.equal(redo.disabled, true, 'Redo must be disabled with no draft actions');
	for (const icon of [undo, redo]) {
		assert.equal(icon.getAttribute('title'), null, 'no raw title attribute for the tooltips (AGENTS.md §8)');
		assert.match(icon.getAttribute('class') ?? '', /\bh-8\b/, 'the icon buttons are compact');
	}
	const barSource = read('src/components/faculty-assignments/TeachingLoadDraftActionBar.tsx');
	assert.match(barSource, />Undo change</, 'the Undo tooltip must read exactly `Undo change`');
	assert.match(barSource, />Redo change</, 'the Redo tooltip must read exactly `Redo change`');
	// `Discard` is a small outline button.
	const discard = buttonByText(restBar, 'Discard');
	assert.ok(discard, 'a `Discard` control must render');
	assert.match(discard!.getAttribute('class') ?? '', /\boutline\b/);
	assert.equal((discard as HTMLButtonElement).disabled, true, 'Discard must be disabled with no draft actions');

	// Now a real draft: `Save changes` must come forward.
	const withDraft = renderDraftBar({ activeDraftCount: 3, canUndo: true, canRedo: true });
	const draftBar = withDraft.host.querySelector('[data-testid="teaching-load-draft-action-bar"]')!;
	const saveWithDraft = buttonByText(draftBar, 'Save changes')!;
	assert.equal((saveWithDraft as HTMLButtonElement).disabled, false, '`Save changes` must enable once a draft change exists');
	assert.doesNotMatch(
		saveWithDraft.getAttribute('class') ?? '',
		/\bopacity-60\b/,
		'the enabled primary must be highlighted, not faded',
	);
	// The label does NOT carry the count: a count in the label changes what the
	// button says every time a draft changes. The count belongs in the
	// confirmation.
	assert.equal((saveWithDraft.textContent ?? '').trim(), 'Save changes', 'the label must be exactly `Save changes`');
	// And the enabled controls are actually pressable.
	click(saveWithDraft);
	click(draftBar.querySelector('[aria-label="Undo change"]')!);
	click(draftBar.querySelector('[aria-label="Redo change"]')!);
	click(buttonByText(draftBar, 'Discard')!);
	assert.deepEqual(
		withDraft.calls,
		{ undo: 1, redo: 1, discard: 1, save: 1 },
		'every enabled control must reach its handler',
	);
});

test('A6-40-3 `Save changes` opens a CONFIRMATION, and `Cancel` saves nothing', () => {
	// The gate itself. A click on `Save changes` must NOT commit: it must open a
	// dialog that says what is about to change, and `Cancel` must leave without
	// saving.
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	let committed = 0;	function Shell() {
		const [open, setOpen] = useState(false);
		return createElement(
			'div',
			null,
			createElement(TeachingLoadDraftActionBar as any, {
				activeDraftCount: 2, canUndo: true, canRedo: false,
				isReadOnlyMode: false, saving: false,
				onUndo: () => {}, onRedo: () => {}, onDiscard: () => {},
				// The click must open, not commit.
				onSave: () => setOpen(true),
			}),
			createElement(ConfirmationModal as any, {
				open,
				onOpenChange: setOpen,
				title: 'Save Teaching Load Changes?',
				description: `You have 2 uncommitted load assignment changes for Term 2. This will update faculty workloads and sync with the scheduling engine.`,
				onConfirm: () => { committed += 1; },
				confirmText: 'Confirm & Save',
				variant: 'primary',
			}),
		);
	}
	act(() => { root.render(inRouter(createElement(Shell as any))); });

	// Precondition: no dialog, nothing committed.
	assert.equal(portalledDialog() === null, true, 'precondition: no confirmation before the save click');
	assert.equal(committed, 0, 'precondition: nothing committed yet');

	const save = buttonByText(host, 'Save changes')!;
	click(save);

	// The click opened a dialog and did NOT commit.
	assert.equal(committed, 0, 'clicking `Save changes` must NOT commit directly');
	const dialog = portalledDialog();
	assert.ok(dialog, 'clicking `Save changes` must open a confirmation dialog');

	// The title, and a body that summarises the pending change in the operator's
	// own sentence shape.
	//
	// SUPERSEDED AS A COPY CLAIM — the row above is a LAYOUT/FLOW control only.
	// The `Shell` at :756 authors its OWN `ConfirmationModal`, so the `description`
	// it asserts below is a literal this test wrote, not the string the product
	// renders. QA's blocking finding was that replacing the real
	// `TeachingLoadModals` description template left this row green, which is the
	// signature of a control that cannot fail. The original expectation is kept
	// VERBATIM, not deleted (AGENTS.md: corrections are additive), and the real
	// copy is now owned by `A6-40-3-REAL` below, which mounts the real component.
	//
	//   assert.match(
	//     text,
	//     /You have 2 uncommitted load assignment changes for Term 2\. This will update faculty workloads and sync with the scheduling engine\./,
	//     'the body must state the count, the term, and the consequence',
	//   );
	//
	// It is superseded because BOTH of its numbers were wrong against the real
	// surface: `2` was a teacher count standing in for a change count, and
	// `for Term 2` was a term scope the whole-year draft does not have.
	const text = dialog!.textContent ?? '';
	assert.match(text, /Save Teaching Load Changes\?/, 'the confirmation must be titled `Save Teaching Load Changes?`');
	const cancel = buttonByText(dialog!, 'Cancel');
	const confirm = buttonByText(dialog!, 'Confirm & Save');
	assert.ok(cancel, 'the dialog must offer `Cancel`');
	assert.ok(confirm, 'the dialog must offer `Confirm & Save`');
	// `Confirm & Save` is the solid maroon primary, per the operator's wording.
	const modals = read('src/components/faculty-assignments/TeachingLoadModals.tsx');
	assert.match(modals, /confirmText="Confirm & Save"/, 'the confirm button is labelled `Confirm & Save`');
	assert.match(modals, /variant="primary"/, 'the confirm button must be the solid maroon primary');
	// The EXISTING timetable-sync warning survives as a SEPARATE, later gate.
	// Both gates must be present in the modals component and both must be driven
	// by the page; the brief is explicit that neither replaces the other.
	assert.match(modals, /open=\{saveWarningOpen\}/, 'the sync warning modal must survive beside the new confirmation');
	assert.match(modals, /onConfirm=\{onSaveConfirm\}/, 'the sync warning keeps its own confirm handler');
	assert.match(modals, /title="Save teaching load changes\?"/, 'the sync warning keeps its own title, distinct from the new one');
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(page, /saveWarningOpen=\{showSaveWarning\}/, 'the page must still drive the sync warning');
	assert.match(page, /onSaveConfirm=\{\(\) => handleSave\(true\)\}/, 'the sync warning must still force the save past the gate');

	// `Cancel` closes and saves nothing.
	click(cancel!);
	assert.equal(committed, 0, '`Cancel` must not save');
	assert.equal(portalledDialog() === null, true, '`Cancel` must close the dialog');

	// Re-open and confirm, so the gate is proven to be passable, not a wall.
	click(buttonByText(host, 'Save changes')!);
	const again = portalledDialog();
	assert.ok(again, 'the confirmation must be re-openable');
	click(buttonByText(again!, 'Confirm & Save')!);
	assert.equal(committed, 1, '`Confirm & Save` must perform the save exactly once');
});

/* ──────────────────── FIX-40 CORRECTION: the real save-confirmation copy ──── */

/**
 * A6-40-3-REAL — QA BLOCKING 1. The copy of the pre-save confirmation, read off
 * the REAL `TeachingLoadModals` with REAL props.
 *
 * WHY THIS ROW EXISTS BESIDE A6-40-3. That row mounts a harness-authored `Shell`
 * whose `description` is a literal the test itself writes, so it cannot fail
 * when the production template changes: QA replaced the real template with a
 * generic sentence and both suites stayed green. §11 requires a control's
 * fixture to come from the surface the row is about. This row mounts
 * `TeachingLoadModals` itself, so the string under test is the shipped one.
 *
 * FAILING-FIRST (the mutant QA used): replacing
 * `description={buildSaveChangesDescription(...)}` in `TeachingLoadModals.tsx`
 * with a generic sentence that drops BOTH the count and the scope makes
 * A6-40-3-REAL fail, because the assertions below read the rendered text.
 */
test('A6-40-3-REAL the REAL confirmation states the CHANGE count and the teachers it spans, with no unproven term', () => {
	const CHANGE_COUNT = 7;
	const TEACHER_COUNT = 3;

	function realModals(props: Record<string, unknown>) {
		return createElement(TeachingLoadModals as any, {
			summaryModalOpen: false,
			onSummaryModalOpenChange: () => {},
			autoFillResult: null,
			onApplySuggestion: () => {},
			suggestionApplying: false,
			saveWarningOpen: false,
			onSaveWarningOpenChange: () => {},
			onSaveConfirm: () => {},
			discardConfirmOpen: false,
			onDiscardConfirmOpenChange: () => {},
			onDiscardConfirm: () => {},
			activeDraftCount: TEACHER_COUNT,
			reviewModalOpen: false,
			onReviewModalOpenChange: () => {},
			reviewInspector: null,
			reviewTitle: 'Review teachers',
			reviewDescription: 'Review',
			// The gate under test, open.
			saveChangesConfirmOpen: true,
			onSaveChangesConfirmOpenChange: () => {},
			onSaveChangesConfirm: () => {},
			...props,
		});
	}

	// Precondition: the two figures genuinely DIFFER, which is the situation the
	// pre-correction sentence mislabelled (a 3-teacher / 7-assignment draft read
	// "You have 3 uncommitted load assignment changes").
	assert.notEqual(CHANGE_COUNT, TEACHER_COUNT, 'this row only decides the mislabelling case when the two figures differ');

	const host = render(realModals({ pendingChangeCount: CHANGE_COUNT, pendingChangeTeacherCount: TEACHER_COUNT, pendingChangeScope: '' }));

	const dialog = portalledDialog();
	assert.ok(dialog, 'the real confirmation must render when open');
	const text = dialog!.textContent ?? '';

	assert.equal(
		text.includes('Save Teaching Load Changes?'),
		true,
		'the title must be the operator\'s `Save Teaching Load Changes?`',
	);
	// THE BLOCKING DEFECT: the sentence must name the CHANGE count, not the
	// teacher count. A body built from the teacher figure fails here.
	assert.match(
		text,
		/You have 7 uncommitted load assignment changes/,
		'the body must state the number of uncommitted load ASSIGNMENT CHANGES, from the change count prop',
	);
	assert.doesNotMatch(
		text,
		/You have 3 uncommitted/,
		'the body must NOT state the teacher count as the change count — that is the blocking defect',
	);
	// Both units, so no reader can confuse them.
	assert.match(text, /across 3 teachers/, 'the body must name the teacher count the change count spans');
	// The consequence sentence survives.
	assert.match(
		text,
		/This will update faculty workloads and sync with the scheduling engine\./,
		'the consequence sentence must survive',
	);
	// The term clause is withheld because it cannot be proven from a whole-year
	// draft; asserting ` for Term` here would re-introduce the unproven scope.
	assert.doesNotMatch(text, /for Term/, 'no term may be claimed: the draft is not term-scoped');
});

test('A6-40-3-REAL-SINGULAR the real body singularises one change and omits a one-teacher span', () => {
	// Its own row, NOT a second render in the row above: two open Radix dialogs
	// coexist in `document.body`, and `querySelector` would return the first, so
	// the singular case would have been asserted against the plural dialog. The
	// `afterEach` teardown is what keeps this honest.
	const host = render(
		createElement(TeachingLoadModals as any, {
			summaryModalOpen: false,
			onSummaryModalOpenChange: () => {},
			autoFillResult: null,
			onApplySuggestion: () => {},
			suggestionApplying: false,
			saveWarningOpen: false,
			onSaveWarningOpenChange: () => {},
			onSaveConfirm: () => {},
			discardConfirmOpen: false,
			onDiscardConfirmOpenChange: () => {},
			onDiscardConfirm: () => {},
			activeDraftCount: 1,
			reviewModalOpen: false,
			onReviewModalOpenChange: () => {},
			reviewInspector: null,
			reviewTitle: 'Review teachers',
			reviewDescription: 'Review',
			saveChangesConfirmOpen: true,
			onSaveChangesConfirmOpenChange: () => {},
			onSaveChangesConfirm: () => {},
			pendingChangeCount: 1,
			pendingChangeTeacherCount: 1,
			pendingChangeScope: '',
		}),
	);
	assert.ok(host, 'the singular render must mount');

	const text = portalledDialog()?.textContent ?? '';
	assert.match(text, /You have 1 uncommitted load assignment change\./, 'one change must not read as a typo');
	assert.doesNotMatch(text, /1 uncommitted load assignment changes/, 'the singular form must be used for exactly one change');
	assert.doesNotMatch(text, /across 1 teachers/, 'a single teacher needs no span clause, and "1 teachers" is ungrammatical');
});

test('A6-40-3-REAL the page wires the CHANGE count prop, not the teacher count', () => {
	// Belt-and-braces over the row above, on the ONE thing the row above cannot
	// see: which hook value the page feeds the prop. A component row proves the
	// component honours its prop; only the page wiring proves the prop is the
	// right number.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(
		page,
		/pendingChangeCount=\{data\.activeDraftAssignmentChangeCount\}/,
		'the page must pass the change count, not the teacher count',
	);
	assert.doesNotMatch(
		page,
		/pendingChangeCount=\{data\.activeDraftCount\}/,
		'wiring the teacher count into the change-count prop is the blocking defect and must be absent',
	);
	assert.match(
		page,
		/pendingChangeTeacherCount=\{data\.activeDraftCount\}/,
		'the teacher count must be passed alongside so the body can name both figures',
	);
	assert.match(page, /pendingChangeScope=""/, 'the unprovable term clause must not be reintroduced');

	// The derivation itself is a real one, in the data layer, counting pairs in
	// BOTH directions (a removals-only draft has no pairs left in it to count).
	const hook = read('src/hooks/useTeachingLoadData.ts');
	assert.match(hook, /const activeDraftAssignmentChangeCount = useMemo/, 'the change count must be derived in the data layer');
	assert.match(hook, /for \(const pair of draftPairs\) if \(!savedPairs\.has\(pair\)\) total \+= 1;/, 'additions must be counted');
	assert.match(hook, /for \(const pair of savedPairs\) if \(!draftPairs\.has\(pair\)\) total \+= 1;/, 'removals must be counted, or a removals-only draft reports a false 0');
	assert.match(hook, /^\s*activeDraftCount,$/m, 'the hook must return the change count alongside the teacher count');
});


test('A6-40-4 the page deletes the footer, moves the panel, and keeps the sync warning', () => {
	// Belt-and-braces over the rendered rows above: these are claims about what
	// the page STOPS rendering, which a component test cannot see.
	const page = read('src/pages/TeachingLoad.tsx');
	// 40 — the bottom footer element is gone as a direct child of the shell, and
	// the group is passed through the grid's `draftControls`.
	assert.match(page, /draftControls=\{\(/, 'the draft group must be passed as `draftControls`');
	assert.match(page, /canRedo=\{data\.canRedo\}/, 'the page must wire the real redo capability');
	assert.match(page, /onRedo=\{data\.handleRedo\}/, 'the page must wire the real redo handler');
	assert.match(page, /onSave=\{\(\) => setSaveConfirmOpen\(true\)\}/, 'the bar\'s save must open the confirmation');
	// The page still owns `draftStatusMessage` — it feeds the toasts — it just no
	// longer renders it in a footer.
	assert.match(page, /draftStatusMessage/, 'the page must keep its draft status message for the toasts');
	// 16.1 — the removed prop is not bound anywhere.
	assert.doesNotMatch(page, /onOpenReview=\{/, 'the detached control prop must be gone');
	// The page drives BOTH save gates, and they are DIFFERENT: the pre-save
	// confirmation on `saveConfirmOpen`, the later sync warning on
	// `showSaveWarning`. One is not allowed to stand in for the other.
	assert.match(page, /saveChangesConfirmOpen=\{saveConfirmOpen\}/, 'the pre-save confirmation must be wired');
	assert.match(page, /onSaveChangesConfirm=\{\(\) => void handleSave\(\)\}/, 'the pre-save confirmation must perform the real save');
	assert.match(page, /saveWarningOpen=\{showSaveWarning\}/, 'the sync warning must still be wired');
	assert.match(page, /const \[showSaveWarning, setShowSaveWarning\] = useState\(false\)/, 'the sync warning keeps its own state');
	// The row review control is bound to the ONE wrapper, and that wrapper is
	// declared before the repair queue that also uses it.
	assert.ok(
		page.indexOf('const openTeacherReviewFor') < page.indexOf('useTeachingLoadRepairQueue({'),
		'`openTeacherReviewFor` must be declared before the repair queue consumes it',
	);
	// 38/39 — the removed pieces really are absent.
	assert.doesNotMatch(page, /teaching-load-secondary-filters/, 'the page must not reintroduce the second filter row');
	assert.doesNotMatch(page, /<TeachingLoadTruthPanel\s+inline/, 'the page must not put the panel back on the state line');
	assert.doesNotMatch(page, /<TeachingLoadDraftActionBar[\s\S]{0,400}statusMessage=/, 'the footer must not be given a status line back');
	// 39 — the page still PASSES `showFilters` / `onToggleFilters`, because the
	// filter bar's props are required and existing callers and controls all send
	// them. What item 39 removed is the RENDERED toggle, pinned by A6-39-1; the
	// props surviving here is deliberate and is asserted so a future cleanup
	// removes them from both sides at once rather than breaking the build.
	assert.match(page, /showFilters=\{ui\.showFilters\}/, 'the page still passes `showFilters`; the bar ignores it');
	assert.match(page, /onToggleFilters=\{\(\) => ui\.setShowFilters\(!ui\.showFilters\)\}/, 'the page still passes `onToggleFilters`; the bar renders no toggle');
	assert.match(
		read('src/components/faculty-assignments/TeachingLoadFilterBar.tsx'),
		/showFilters: boolean;[\s\S]{0,80}onToggleFilters: \(\) => void;/,
		'the bar keeps both props in its signature, documented as retained-but-unrendered',
	);
});

test('A6-16.1-3 the detached control component renders only the mobile affordance', () => {
	// The component named by item 16.1's "completely remove" must have exactly
	// one control left, and it must be the preserved small-screen one.
	const host = render(
		createElement(TeachingLoadInspectorTriggers as any, { visible: true, onOpenMobile: () => {} }),
	);
	assert.equal(buttonsIn(host).length, 1, 'only the mobile control may remain');
	assert.equal(
		host.querySelector('[data-testid="teaching-load-mobile-inspector-open"]') !== null,
		true,
		'the mobile `View profile` control must be preserved',
	);
	assert.equal(host.querySelector('[data-testid="teaching-load-review-open"]'), null, 'the detached control must be gone');
	// The page no longer passes a review prop to it.
	assert.doesNotMatch(
		read('src/pages/TeachingLoad.tsx'),
		/<TeachingLoadInspectorTriggers[\s\S]{0,200}onOpenReview/,
		'the page must not pass the removed prop',
	);
});

/* ══════════════════════════════════════════════════════════════════════════ *
 * A6 C2 — the operator's 2026-09-28 Teaching Load walk, rendered.
 * `docs/reviews/codex-teaching-load-walk-20260928/report.md`, items 1-5 and 7.
 * Every row below MOUNTS THE REAL COMPONENT and reads the RENDERED result: a
 * source-string assertion is not acceptance evidence for a visible change.
 * FAILING-FIRST is recorded per slice in the commit body (revert -> red -> restore).
 * ══════════════════════════════════════════════════════════════════════════ */

/** The thirteen metrics the operator enumerated, in the order the panel must show them. */
const ALL_METRIC_IDS = [
	'teaching-load-truth-required-pairs',
	'teaching-load-truth-assigned-pairs',
	'teaching-load-truth-unresolved-pairs',
	'teaching-load-truth-actual-hours',
	'teaching-load-truth-standard',
	'teaching-load-truth-hard-cap',
	'teaching-load-truth-over-standard',
	'teaching-load-truth-over-hard-cap',
	'teaching-load-truth-remaining',
	'teaching-load-truth-zero-load',
	'teaching-load-truth-advisers',
	'teaching-load-truth-advisory-credit',
	'teaching-load-truth-hg-excluded',
];

test('A6-C2-1 the `Load summary` breakdown has NO sideways scroller and stacks every metric', () => {
	// Walk item 3, verbatim: "opening it produces two 34px-high horizontal
	// scrollers. At 1366 their content is 1,189px and 2,388px wide inside 451px;
	// even at 1920 it is 1,189px/2,388px inside 897px." The cause was the two
	// `flex … flex-nowrap … overflow-x-auto` pill rows.
	//
	// ENTRY PATH, NOT A SUPERSESSION (A6 c6 item 2, 2026-09-29): the `Load summary`
	// control is now the first item of the `More` menu, so this row opens the menu
	// and selects the item before reading the dialog. The CLAIM is untouched — it
	// is about the DIALOG's layout, and it is still read from the real dialog.
	const host = render(createElement(TeachingLoadLoadSummaryShell as any, {}));
	openSummaryFromMore(host);
	const dialog = portalledDialog();
	assert.ok(dialog, 'precondition: the summary dialog must be open');

	// (a) NO descendant of the dialog may declare horizontal overflow. Not the
	// rows, not a grid, not a wrapper — the whole subtree.
	const sideways = Array.from(dialog!.querySelectorAll('*')).filter((el) => {
		const cls = el.getAttribute('class') ?? '';
		return /(^|\s)overflow-x-(auto|scroll)(\s|$)/.test(cls);
	});
	assert.equal(
		sideways.length,
		0,
		`no descendant of the dialog may scroll sideways; found ${sideways.length}: ` +
			sideways.map((el) => `${el.getAttribute('data-testid') ?? el.tagName}="${el.getAttribute('class')}"`).join(' | '),
	);
	// And the pill treatment itself is gone from the dialog body.
	assert.equal(
		dialog!.querySelectorAll('[data-metric-layout="vertical"]').length,
		2,
		'both metric groups must render in the vertical definition-list layout',
	);

	// (b) All thirteen figures are still present, each with its metric state.
	for (const id of ALL_METRIC_IDS) {
		const node: HTMLElement | null = dialog!.querySelector(`[data-testid="${id}"]`);
		assert.ok(node, `the breakdown must still show ${id}`);
		assert.equal(
			node!.getAttribute('data-metric-state'),
			'known',
			`${id} must report a known state from the real model, not an invented 0`,
		);
	}

	// (c) It is a STACKED definition list in document order — a dt/dd pair per
	// metric, label before value. A wrapped grid that can still spill would fail
	// this; so would a `<ul>` of pills.
	const groups = Array.from(dialog!.querySelectorAll('[data-metric-layout="vertical"]')) as HTMLElement[];
	assert.equal(groups.length, 2, 'the breakdown has two metric groups');
	const order: string[] = [];
	for (const dl of groups) {
		assert.equal(dl.tagName, 'DL', 'each metric group must be a real description list');
		const dts = Array.from(dl.querySelectorAll('dt'));
		const dds = Array.from(dl.querySelectorAll('dd'));
		assert.equal(dts.length, dds.length, 'each `<dt>` must have its `<dd>` in the same group');
		assert.ok(dts.length > 0, 'a metric group must not be empty');
		// Label before value in document order, one pair per metric element.
		for (const pair of Array.from(dl.children)) {
			assert.equal(pair.tagName, 'DIV', 'each definition is wrapped in its own row');
			const kids = Array.from(pair.children);
			assert.equal(kids.length, 2, 'a definition row is exactly a `<dt>` and a `<dd>`');
			assert.equal(kids[0]!.tagName, 'DT', 'the LABEL comes first');
			assert.equal(kids[1]!.tagName, 'DD', 'the VALUE comes second');
			order.push(pair.getAttribute('data-testid')!);
		}
	}
	assert.deepEqual(order, ALL_METRIC_IDS, 'the thirteen metrics must appear in the operator\'s order, stacked');
	assert.equal(groups[0]!.getAttribute('data-testid'), 'teaching-load-truth-summary');
	assert.equal(groups[1]!.getAttribute('data-testid'), 'teaching-load-truth-capacity');
	// Real visible text on both sides of the first pair, from the real model.
	const firstPair = groups[0]!.children[0]!;
	assert.equal(firstPair.querySelector('dt')!.textContent, 'Classes needing a teacher');
	assert.equal(firstPair.querySelector('dd')!.textContent, '24', 'the value must be the model\'s, not a placeholder');

	// (d) The dialog body is the ONE scroll region, still bounded.
	const scrollers = Array.from(dialog!.querySelectorAll('*'))
		.filter((el) => /(^|\s)overflow-y-auto(\s|$)/.test(el.getAttribute('class') ?? ''));
	assert.equal(scrollers.length, 1, `the dialog must contain exactly one vertical scroll region, found ${scrollers.length}`);
	assert.match(scrollers[0]!.getAttribute('class') ?? '', /max-h-\[70vh\]/, 'and it must be bounded to the viewport');
});

/**
 * A6 C2 CORRECTION — row 2's slot is now the REAL repair queue driven by the
 * REAL hook, not a hand-written item.
 *
 * WHY THE OLD FIXTURE WAS WRONG, and why the row that used it stayed green
 * through a real defect. `headerHost` used to pass
 * `{ kind: 'review-ready', status: 'Ready for review' }` — a paraphrase. The
 * production `review-ready` status is
 * `${coverageAssigned} of ${coverageTotal} classes have a teacher.`
 * (`useTeachingLoadRepairQueue.ts`), so the A6-C2-3 assertion
 * `doesNotMatch(rowText, /\b\d+ classes? need/)` never saw the number that was
 * actually on the row, and never saw the number's sibling claim,
 * `Teaching Load looks ready`. AGENTS.md §11: a control's fixture must come
 * from the real surface, or it passes against a fiction. The fixture below is
 * the hook's own output, so a future reword of the real string is caught here.
 *
 * The values are QA's own, so the numbers are the ones the operator would see:
 * 23 assigned of 24 total, one class open, and no draft — which is the state
 * that resolves to the single `review-ready` item.
 */
const REAL_QUEUE_COVERAGE = { coverageAssigned: 23, coverageTotal: 24, coverageUnassigned: 0, activeDraftCount: 0 };

function RealRepairQueueSlot(props: {
	sourceDegraded: boolean;
	/**
	 * A6 c4 (G1) — the `advancedGridVisible` knob is GONE. It used to let a row
	 * mount the queue in the state the Guided placeholder forced, which is a
	 * rendering the product no longer has. The `?:` default is removed with it:
	 * there is no second state to fall back to, and a default would let a new row
	 * pick one silently.
	 */
	/**
	 * A6 C3 (QA finding B3, 2026-09-29): REQUIRED in the HARNESS, exactly as it
	 * is in the hook. This parameter used to be optional with a
	 * `{ dataSource: 'live', isOnline: true }` default, which meant a new row
	 * could reach the healthy rendering by omitting a required argument — the
	 * harness would quietly stand in for a caller's decision. There is no default
	 * now, so TypeScript names every mount that must state the source it is
	 * about, and a row cannot be added without saying so.
	 */
	sourceState: { dataSource: 'live' | 'cached' | 'refreshing' | 'none'; isOnline: boolean };
	isReadOnlyMode?: boolean;
	writeBlockedReason?: string | null;
}) {
	const queue = useTeachingLoadRepairQueue({
		searchParams: new URLSearchParams(),
		setSearchParams: () => {},
		faculty: [],
		effectiveAssignmentsByFaculty: {},
		activeDraftCount: REAL_QUEUE_COVERAGE.activeDraftCount,
		isReadOnlyMode: props.isReadOnlyMode ?? false,
		selectedId: null,
		coverageAssigned: REAL_QUEUE_COVERAGE.coverageAssigned,
		coverageTotal: REAL_QUEUE_COVERAGE.coverageTotal,
		coverageUnassigned: REAL_QUEUE_COVERAGE.coverageUnassigned,
		sourceDegraded: props.sourceDegraded,
		// The verified source is the DEFAULT here, so the healthy rows above stay
		// exactly as they were. Every degraded row passes the state it is actually
		// about, because the withheld string now depends on it.
		sourceState: props.sourceState,
		writeBlockedReason: props.writeBlockedReason ?? null,
		onSelectFaculty: () => {},
		onSave: () => {},
		onShowSubjectCoverage: () => {},
		onShowTeachersWithoutLoad: () => {},
		onShowOverloaded: () => {},
		onShowPlaceholder: () => {},
		onOpenReview: () => {},
	});
	return createElement(TeachingLoadRepairQueue as any, {
		items: queue.repairQueueItems,
		activeItemId: queue.activeRepairId,
		isReadOnly: false, saving: false,
		onPrimaryAction: queue.handleRepairPrimaryAction,
	});
}

/** Row 2 as the page composes it: the REAL repair queue, plus the More-menu link. */
function headerHost(overrides: Record<string, any> = {}, slotOverrides: Record<string, any> = {}, sourceDegraded = false) {
	// A6 C3 (QA finding B3): the queue's REQUIRED `sourceState` is wired from the
	// SAME toolbar props the row is about, because that is exactly what the page
	// does — one `data.dataSource` / `data.isOnline` pair feeds the header and the
	// hook. So a row that states its source on the header cannot leave the queue
	// out, and the healthy mounts below need no special case. `slotOverrides` is
	// spread LAST and still wins, for the rows that pin the slot explicitly.
	const props: Record<string, any> = {
		realAssignedPairs: 22, syntheticPlaceholderPairs: 1, unassignedPairs: 2, totalPairs: 24,
		overCapCount: 1, excessTeachingCount: 0, policyReady: true,
		onShowExcessTeachingLoad: () => {}, onShowTemporarySubstitutes: () => {},
		autoFillLoading: false, autoFillEnabled: true, onAutoFillClick: () => {},
		viewMode: 'teacher', onViewModeChange: () => {},
		dataSource: 'live', degradedWriteEnabled: false, isWorkspaceWritable: true, isOnline: true,
		dataSourceNotice: null, coverageMode: 'balanced', onCoverageModeChange: () => {},
		coverageModeConfig: { balanced: { label: 'Balanced', description: 'desc' } },
		workspaceStateLabel: 'Ready', workspaceStateDescription: 'Live roster verified.',
		workspaceStateNextAction: 'Assign the remaining classes.',
		activeDraftCount: 0, saving: false, onSave: () => {}, onRetrySource: () => {},
		...overrides,
	};
	return render(createElement(WorkspaceToolbar as any, {
		...props,
		// A6 C2 CORRECTION: the slot is the hook's OWN output. `slotOverrides`
		// stays for the one caller that needs to pin a prop, and it is spread
		// LAST so it can still override.
		stateLineSlot: createElement(Fragment2, null, createElement(RealRepairQueueSlot as any, {
			sourceDegraded,
			sourceState: { dataSource: props.dataSource, isOnline: props.isOnline },
			...slotOverrides,
		})),
		historyAction: createElement(Link as any, { to: '/teaching-load/history', 'data-testid': 'teaching-load-history-link' }, 'Archived load'),
	}));
}

test('A6-C2-2 row 2 is one status sentence + ONE action, and never scrolls sideways', () => {
	// Walk item 1, verbatim: the second row "tries to hold 140px `% staffed`,
	// 231px `Classes without a teacher`, 451px summary, a 223px next-step/warning,
	// 169px Assign, and 117px Archived link… only its icon is visible."
	const host = headerHost();
	const row2 = host.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
	assert.ok(row2, 'row 2 must render');

	// (a) No sideways scroll on the row. This is the operator's rejection.
	assert.doesNotMatch(
		row2.getAttribute('class') ?? '',
		/overflow-x-(auto|scroll)/,
		'row 2 must not scroll sideways; a long sentence must truncate instead',
	);
	// (b) The status sentence, present, and ONE status sentence.
	const sentence = row2.querySelector('[data-testid="teaching-load-status-sentence"]')!;
	assert.ok(sentence, 'row 2 must carry a status sentence');
	assert.equal(
		row2.querySelectorAll('[data-testid="teaching-load-status-sentence"]').length, 1,
		'there must be one status sentence, not several competing ones',
	);
	// SUPERSEDED BY A6 c5 S3 (2026-09-29) — recorded, not deleted. The old
	// assertion was `/96% staffed/`, which read (22 real + 1 synthetic
	// placeholder) / 24: a to-be-hired record counted as a teacher. A6 c5 fixes
	// the computation itself, so the truthful figure is 22/24 = 92%. The rule
	// this control exists for — "the % staffed figure is in the sentence" — is
	// unchanged and is asserted by the line below.
	assert.match(sentence.textContent ?? '', /92% staffed/, 'the % staffed figure is in the sentence');
	assert.match(sentence.textContent ?? '', /2 classes need a teacher/, 'the classes-needing-a-teacher clause is in the sentence');
	// The alert keeps its test id and its number, inside the sentence.
	assert.ok(row2.querySelector('[data-testid="teaching-load-alert-over-cap"]'), 'the alert stays addressable');
	assert.match(row2.textContent ?? '', /Above weekly max: 1/, 'the alert still states its number');

	// (c) EXACTLY ONE button on the row: the ONE primary action.
	const row2Buttons = Array.from(row2.querySelectorAll('button'));
	assert.equal(row2Buttons.length, 1, `row 2 must hold exactly ONE action, found ${row2Buttons.length}`);
	assert.equal(
		row2Buttons[0]!.getAttribute('data-testid'),
		'teaching-load-repair-review',
		'the ONE action must be the repair queue\'s primary action',
	);
	assert.match(row2Buttons[0]!.textContent ?? '', new RegExp(STAFF_WORKLOAD_REVIEW_LABEL));

	// (d) The `Archived load` link is NOT on row 2 — it moved into the More menu.
	assert.equal(
		row2.querySelector('[data-testid="teaching-load-history-link"]') === null,
		true,
		'`Archived load` must not be on the state line',
	);
	// And it IS reachable: the page still builds it and hands it to the header.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(page, /data-testid="teaching-load-history-link"/, 'the page must still build the link');
	assert.match(page, /historyAction=\{/, 'the header must own its position');
	// The More menu renders it. Radix only mounts menu content on open, so the
	// click is what proves reachability rather than mere presence in a prop.
	press(host.querySelector('button[aria-label="More Teaching Load tools"]')!);
	const menuLink = dom.window.document.querySelector('[data-testid="teaching-load-history-link"]');
	assert.ok(menuLink, 'the More menu must render the `Archived load` link');
	assert.equal(menuLink!.getAttribute('href'), '/teaching-load/history', 'it must be a real link to the archived surface');
});

test('A6-C2-3 a degraded source shows ONE amber line and NO live-looking derived count', () => {
	// Walk item 2, verbatim: "`% staffed 100%` and `Classes without a teacher 0`
	// sit beside `Unknown number of classes`… A scheduler can falsely conclude
	// staffing is complete."
	//
	// A6 C2 CORRECTION — the slot is the REAL queue on the REAL hook, so this row
	// now sees the strings the operator sees. It previously asserted against a
	// hand-written `status: 'Ready for review'`, which is why the repair queue's
	// real `23 of 24 classes have a teacher.` and its `Teaching Load looks ready`
	// completeness title passed straight through a row whose whole subject is
	// derived counts beside an unknown. `REAL_QUEUE_COVERAGE` is non-zero on both
	// figures precisely so the number WOULD render if the withholding regressed.
	const DEGRADED_STATES: Array<{ label: string; toolbar: Record<string, any>; slot: Record<string, any> }> = [
		// `CACHED + read-only + degradedNotice` — the exact state QA rendered.
		{
			label: 'CACHED + read-only + degradedNotice',
			toolbar: { dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'EnrollPro could not be reached, so ATLAS is using the last saved sections.' },
			slot: { sourceDegraded: true, sourceState: { dataSource: 'cached', isOnline: true } },
		},
		// `CACHED + a real saved-at timestamp`.
		{
			label: 'CACHED + realSavedAt',
			toolbar: { dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x', savedAtLabel: '2026-09-28T09:14:00.000Z' },
			slot: { sourceDegraded: true, sourceState: { dataSource: 'cached', isOnline: true } },
		},
		// `OFFLINE`: EnrollPro is not what is down, but the source is still not verified.
		{
			label: 'OFFLINE',
			toolbar: { isOnline: false },
			slot: { sourceDegraded: true, sourceState: { dataSource: 'live', isOnline: false } },
		},
		// `NONE`: there is no source at all.
		{
			label: 'NONE',
			toolbar: { dataSource: 'none', isWorkspaceWritable: false },
			slot: { sourceDegraded: true, sourceState: { dataSource: 'none', isOnline: true } },
		},
	];

	for (const state of DEGRADED_STATES) {
		const host = headerHost(state.toolbar, state.slot);
		const row2 = host.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
		assert.ok(row2, `${state.label}: row 2 must render`);

		const amber = Array.from(row2.querySelectorAll('[data-testid="teaching-load-degraded-notice"]'));
	// (a) EXACTLY ONE amber line. SUPERSEDED 2026-09-29 by A6 c6 item 5
		// (RETAINED, NOT DELETED): the old assertion required the VISIBLE line to
		// name the cause —
		//
		//   assert.match(amber[0].textContent ?? '',
		//     /(EnrollPro not reachable|ATLAS is offline|no live Teaching Load source is available)/,
		//     `${state.label}: the amber line must name the cause in its own honest words`);
		//
		// Lane C's finding was that `Using the last saved data — EnrollPro not
		// reachable` "gives no clear next step or person to call", so the cause moved
		// into the pill's `@/ui` Tooltip and the face now leads with a plain
		// sentence. The REPLACEMENT below is stronger than the old claim in the way
		// that matters: it forbids the product name on the calm face (the defect)
		// while still requiring that the state is stated as a plain sentence, and
		// the cause's continued reachability is proved on the rendered Tooltip by
		// `a6-c6-calm-teaching-load` `A6C6-6`, which mounts it. A static render
		// cannot open a Radix tooltip, so this file's instrument cannot.
		assert.equal(amber.length, 1, `${state.label}: exactly ONE amber line, found ${amber.length}`);
		assert.doesNotMatch(
			amber[0]!.textContent ?? '',
			/EnrollPro/,
			`${state.label}: the visible line must not name a product an older scheduler cannot act on`,
		);
		assert.match(
			amber[0]!.textContent ?? '',
			/ATLAS is (showing|checking)|You are offline/,
			`${state.label}: the line must still say, in plain words, what is unavailable`,
		);
		assert.match(
			amber[0]!.getAttribute('class') ?? '',
			/warning-muted/,
			`${state.label}: the degraded line must be visibly amber, not an ordinary chip`,
		);
		assert.equal(
			row2.querySelectorAll('[data-testid="teaching-load-status-sentence"]').length,
			0,
			`${state.label}: the live status sentence must be REPLACED, not printed beside the amber line`,
		);

		// (b) THE BLOCKING HALF: nothing on row 2 may read as a live completeness
		// claim, and no unlabelled derived count may survive. These shapes are the
		// hook's OWN strings, so a reword that reintroduces a number fails here.
		const rowText = row2.textContent ?? '';
		assert.doesNotMatch(
			rowText,
			/% staffed/,
			`${state.label}: the \`% staffed\` figure must be suppressed while degraded`,
		);
		assert.doesNotMatch(
			rowText,
			/\b\d+ classes? need/,
			`${state.label}: a computed classes-needing-a-teacher count must be suppressed`,
		);
		assert.doesNotMatch(
			rowText,
			/\b\d+ of \d+ classes have a teacher/,
			`${state.label}: the repair queue's \`N of M classes have a teacher\` completeness figure must be suppressed — this is the blocking defect`,
		);
		assert.doesNotMatch(
			rowText,
			/Teaching Load looks ready/,
			`${state.label}: the queue's \`Teaching Load looks ready\` title asserts completeness and must be suppressed`,
		);
		assert.doesNotMatch(
			rowText,
			/Above weekly max/,
			`${state.label}: the alert count must be suppressed too, or it states an unverifiable number`,
		);
		assert.doesNotMatch(rowText, /\b100%\b/, `${state.label}: never a confident 100% next to an unknown`);
		// And no element on the row still claims a staffing percentage at all.
		assert.equal(
			row2.querySelector('[data-testid="teaching-load-alert-over-cap"]'),
			null,
			`${state.label}: no alert count while degraded`,
		);

		// (c) Withheld is not silent: the queue states its own uncertainty on the
		// row, so a reader is not left with a gap they must interpret.
		const queueChip = row2.querySelector('[data-testid="teaching-load-current-repair"]');
		assert.ok(queueChip, `${state.label}: the repair queue must still render on the degraded row`);
		// SUPERSEDED BY A6-C3-3 (N-3), 2026-09-29, AND AGAIN BY A6 c6 item 4 on
		// 2026-09-29: the withheld string must name the cause the page actually has.
		// This assertion was applied to ALL FOUR states, so it demanded "EnrollPro is
		// not reachable" from `OFFLINE` (where ATLAS is the thing that is down) and
		// from `NONE` (where there is no source to reach) — both false. It is RETAINED,
		// not deleted, and now scoped to the states where it is true; the replacement
		// table below covers all four. A6 c6 then removed the cause from the calm
		// face entirely, so the clause it asserted is now the TOOLTIP's content and
		// the row asserts the plain sentence instead — the specific rule that survives
		// is "the queue must say something in place of the figure, never nothing".
		if (state.slot.sourceState.dataSource === 'cached') {
			assert.match(
				queueChip!.textContent ?? '',
				/These numbers come from the last saved roster, not the current one\./,
				`${state.label}: the queue must name what is unknown in place of the figure`,
			);
		}
		// A6-C3-3 (N-3), the replacement: the withheld string is per STATE, and it
		// must not blame EnrollPro for a state EnrollPro did not cause.
		const chipText = queueChip!.textContent ?? '';
		if (state.slot.sourceState.isOnline === false) {
			// SUPERSEDED 2026-09-29 by A6 c6 item 4, in its FORM ONLY. The rule —
			// "the withheld string must name ATLAS, which is what is down, and must
			// NOT blame EnrollPro" — is unchanged and is still the assertion; only
			// the sentence it matches changed, because the cause moved to the pill's
			// Tooltip. The replacement states the new sentence verbatim and keeps the
			// ban on blaming EnrollPro, which is the half that was ever at risk.
			assert.match(chipText, /ATLAS is offline, so these numbers cannot be checked\./, `${state.label}: the withheld string must name ATLAS, which is what is down`);
			assert.doesNotMatch(chipText, /EnrollPro is not reachable/, `${state.label}: do not blame EnrollPro when ATLAS is offline`);
		} else if (state.slot.sourceState.dataSource === 'none') {
			assert.match(chipText, /No live Teaching Load source is available, so these numbers cannot be checked\./, `${state.label}: the withheld string must name the missing source`);
			assert.doesNotMatch(chipText, /EnrollPro/, `${state.label}: do not name EnrollPro when there is no source at all`);
		} else {
			// SUPERSEDED 2026-09-29 by A6 c6 item 4 — RETAINED, NOT DELETED. The
			// old assertion was `/Unverified .* EnrollPro is not reachable/` with the
			// message "the cached case keeps its established wording". A6 c6 moved the
			// product name off the calm face, so the wording the queue keeps is the
			// plain sentence, and the rule that survives is that it must be
			// DISTINGUISHABLE from the offline and none cases rather than identical to
			// them — which is the defect A6 C3 (N-3) opened and A6 c6 closed.
			assert.match(chipText, /These numbers come from the last saved roster, not the current one\./, `${state.label}: the cached case keeps the plain saved-roster sentence`);
			assert.doesNotMatch(chipText, /ATLAS is offline|no live Teaching Load source is available/, `${state.label}: and it must stay DISTINGUISHABLE from the offline and none cases`);
		}
		assert.match(
			queueChip!.textContent ?? '',
			/Teaching Load not verified/,
			`${state.label}: the queue's title must state non-verification, not readiness`,
		);

		// (d) NOT a dead row. The ONE primary action is the header's whole reason
		// for existing, and a degraded row that cannot act is a different defect.
		const action = row2.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLButtonElement;
		assert.ok(action, `${state.label}: the ONE primary action must remain on row 2`);
		assert.equal(action.disabled, false, `${state.label}: the primary action must stay operable while degraded`);
		assert.match(action.textContent ?? '', new RegExp(STAFF_WORKLOAD_REVIEW_LABEL), `${state.label}: its label must be the operator's`);
		assert.ok(
			((amber[0] as HTMLElement).compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
			`${state.label}: the action must sit after the amber line, on the same row`,
		);
	}

	// Two mounted headers, one with a real timestamp and one without.
	const stamped = headerHost(
		{ dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x', savedAtLabel: '2026-09-28T09:14:00.000Z' },
		{ sourceDegraded: true, sourceState: { dataSource: 'cached', isOnline: true } },
	);
	const unstamped = headerHost(
		{ dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x' },
		{ sourceDegraded: true, sourceState: { dataSource: 'cached', isOnline: true } },
	);
	// (e) The saved-at time is used when the caller supplies one, and OMITTED
	// rather than invented when it does not. SUPERSEDED 2026-09-29 by A6 c6 item 5
	// — RETAINED, NOT DELETED, and its RULE is unchanged and still asserted: a real
	// timestamp is used when the page has one, and the clause is dropped rather
	// than fabricated when it does not. What moved is WHERE it is printed. The old
	// assertions read it off the visible line —
	//
	//   assert.match(stampedLine.textContent, /Using saved data from /, 'a real timestamp is used when the page has one');
	//   assert.match(unstampedLine.textContent, /Using the last saved data/, 'with no proven timestamp the clause is dropped, never faked');
	//
	// A6 c6 put no timestamp on the visible face at all (Lane C: the face must
	// lead with a plain next step) and moved the clause into the pill's Tooltip,
	// so the visible line is now IDENTICAL in both states. The replacement below
	// asserts the stronger thing the move makes possible: the visible face does
	// not vary with a timestamp, and the clause is reachable through the one
	// control the page can be trusted with.
	const stampedLine = stamped.querySelector('[data-testid="teaching-load-degraded-notice"]')!;
	const unstampedLine = unstamped.querySelector('[data-testid="teaching-load-degraded-notice"]')!;
	assert.ok(stampedLine && unstampedLine, 'the degraded notice must render in both fixtures');
	assert.equal(
		(stampedLine.textContent ?? '').trim(),
		(unstampedLine.textContent ?? '').trim(),
		'the VISIBLE face must be identical with and without a timestamp: a time is not part of a calm next step',
	);
	assert.doesNotMatch(
		stampedLine.textContent ?? '',
		/Using saved data from/,
		'the old `Using saved data from <time>` sentence is superseded: the clause moved to the Tooltip',
	);
	// The rule itself, still live: the Tooltip is fed the page's real field or
	// nothing. `a6-c6-calm-teaching-load` `A6C6-6` proves both branches on the
	// MOUNTED tooltip, because Radix does not mount a closed one into this
	// file's `renderToStaticMarkup` tree and this file runs no browser.
	const toolbarSource = read('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	assert.match(
		read('src/components/faculty-assignments/teachingLoadDegradedCopy.ts'),
		/if \(!savedAtLabel\) return null;/,
		'a `Saved <time>` clause may only be built from a real `savedAtLabel`; with none it is dropped, never synthesised',
	);
	assert.match(
		toolbarSource,
		/degraded: isSourceDegraded, savedAtLabel/,
		"and the page's real field is the one threaded into that derivation",
	);
});

test('A6-C2-3-HEALTHY the verified source still STATES its count and its queue title', () => {
	// THE POSITIVE ROW for the correction above, and it exists so that fix cannot
	// be satisfied by deleting the information everywhere. It is its own row
	// rather than an extra render inside A6-C2-3 for the same reason
	// `A6-40-3-REAL-SINGULAR` is: a second mount in the same test would share the
	// `afterEach` teardown story and blur which mount a failure came from.
	//
	// It asserts the EXACT strings the withheld row above forbids, from the same
	// `REAL_QUEUE_COVERAGE` figures. If the hook stopped publishing them while
	// healthy, this goes red — so the corrected row is discriminating about
	// STATE, not about text that was simply removed.
	const host = headerHost();
	const row2 = host.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
	const rowText = row2.textContent ?? '';

	assert.equal(
		row2.querySelectorAll('[data-testid="teaching-load-degraded-notice"]').length,
		0,
		'a verified source must NOT render the degraded line',
	);
	assert.match(
		rowText,
		/23 of 24 classes have a teacher/,
		'the verified source must still state the queue\'s real completeness figure, from the hook\'s own coverage values',
	);
	assert.match(
		rowText,
		/Teaching Load looks ready/,
		'the verified source must still state the queue\'s real readiness title',
	);
	// And the header's own sentence is untouched, which is the rest of the row's job.
	// SUPERSEDED BY A6 c5 S3 (2026-09-29) — the old assertion was `/96% staffed/`
	// on the same (22 real + 1 synthetic placeholder) / 24 fixture, which counted
	// a to-be-hired record as a teacher. A6 c5's corrected figure is 92%.
	assert.match(rowText, /92% staffed/, 'the verified source keeps the `% staffed` figure');
	assert.match(rowText, /2 classes need a teacher/, 'and the classes-needing-a-teacher clause');

	// The status element is the REAL rendered surface, not a substring of a
	// tooltip: it is `hidden sm:inline`, so it is visible at 1366 and above.
	const status = row2.querySelector('[data-testid="teaching-load-repair-status"]')!;
	assert.ok(status, 'the queue\'s status element must render while healthy');
	assert.equal(
		(status.textContent ?? '').trim(),
		'23 of 24 classes have a teacher.',
		'the status must be the hook\'s exact sentence, and it must be on the chip itself',
	);
});

test('A6-C2-3-WIRING one shared predicate decides BOTH the amber line and the queue', () => {
	// Belt-and-braces over the rendered rows, on the one thing they cannot see:
	// WHICH truth the page hands each consumer. A row can render correctly while
	// the page feeds the queue a boolean the header never used, and then the two
	// disagree in production on a state this file does not enumerate.
	//
	// Labelled as a wiring row and never as acceptance evidence for the visible
	// change: the visible claim is A6-C2-3 and A6-C2-3-HEALTHY, which render.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(
		page,
		/isTeachingLoadSourceDegraded\(\{ dataSource: data\.dataSource, isOnline: data\.isOnline, dataSourceNotice: data\.degradedNotice \}\)/,
		'the page must derive the queue\'s degraded state from the REAL data fields through the shared predicate',
	);
	assert.match(
		page,
		/sourceDegraded,$/m,
		'the derived boolean must be what the page passes to the repair queue hook',
	);
	// Required, not optional: an omitted argument must not render healthy.
	const hook = read('src/hooks/useTeachingLoadRepairQueue.ts');
	assert.match(hook, /\tsourceDegraded: boolean;/, 'the hook parameter must be REQUIRED, so a new caller cannot inherit the healthy rendering');
	assert.doesNotMatch(hook, /sourceDegraded\?:/, 'an optional degraded parameter would reopen this defect silently');

	// The header's own copy is the same function, so the two cannot drift.
	const toolbar = read('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	assert.match(
		toolbar,
		/export function isTeachingLoadSourceDegraded\(/,
		'the predicate must be exported, or the page would have to re-state the rule',
	);
	assert.match(
		toolbar,
		/const isSourceDegraded = isTeachingLoadSourceDegraded\(\{ dataSource, isOnline, dataSourceNotice \}\)/,
		'the amber line must be decided by the same predicate, not a second copy of the rule',
	);
	// `refreshing` stays NON-degraded in the shared predicate: ATLAS is actively
	// asking EnrollPro, so "not reachable" would be a lie mid-check. This is the
	// one branch where the two implementations could silently disagree, so it is
	// pinned here.
	assert.match(
		toolbar,
		/if \(input\.dataSource === 'refreshing'\) return false;/,
		'a live check must never count as degraded, and the order is load-bearing',
	);
});

test('A6-C2-4 the header is still at most 2 band rows, in sentence case, with a draft chip', () => {
	// The band-row filter is the same idea as `a3-c10`'s: an `sr-only` line is
	// clipped to 1px and a `hidden` band is `display:none`, so neither is a row.
	// Copied in 5 lines rather than imported, so this file owns its own reader.
	const isRendered = (el: Element): boolean => {
		if (el.hasAttribute('hidden')) return false;
		const cls = el.getAttribute('class') ?? '';
		return !/\b(sr-only|hidden|invisible)\b/.test(cls);
	};

	const host = headerHost();
	const strip = host.querySelector('[data-testid="teaching-load-command-header"]')!;
	const bands = Array.from(strip.children).filter(isRendered);
	assert.equal(bands.length, 2, `the strip must render at most 2 band rows, found ${bands.length}: ${bands.map((b) => b.getAttribute('data-testid') ?? '(row)').join(', ')}`);
	assert.equal(bands[0]!.getAttribute('data-testid'), 'teaching-load-compact-command-header', 'row 1 is the command row');
	assert.equal(bands[1]!.getAttribute('data-testid'), 'teaching-load-readiness-strip', 'row 2 is the status line');

	// Sentence case: no `uppercase` and no letter-spaced `tracking-widest`
	// anywhere on the rendered header. `tracking-tight` on the h1 is a
	// pre-existing, separately-pinned scale choice and is not ALL CAPS.
	for (const el of Array.from(strip.querySelectorAll('*'))) {
		const cls = el.getAttribute('class') ?? '';
		assert.doesNotMatch(cls, /(^|\s)uppercase(\s|$)/, `no header node may shout in caps: ${el.tagName} "${cls}"`);
		assert.doesNotMatch(cls, /(^|\s)tracking-widest(\s|$)/, `no header label may be letter-spaced: ${el.tagName} "${cls}"`);
	}

	// The draft chip, on row 1, beside the source badge, with both states.
	const chip = strip.querySelector('[data-testid="teaching-load-draft-chip"]')!;
	assert.ok(chip, 'the draft chip must render on row 1');
	assert.equal(chip.textContent, 'Saved', 'no unsaved draft reads `Saved`');
	assert.equal(chip.getAttribute('data-draft-state'), 'saved');
	assert.equal(strip.querySelectorAll('[data-source-state]').length, 1, 'the source-verification badge is kept, not replaced');
	const withDraft = headerHost({ activeDraftCount: 3 });
	const draftChip = withDraft.querySelector('[data-testid="teaching-load-draft-chip"]')!;
	assert.equal(draftChip.textContent, 'Draft — not saved', 'an unsaved draft reads `Draft — not saved`');
	assert.equal(draftChip.getAttribute('data-draft-state'), 'unsaved');

	// And the suggestion action is the operator's word, secondary, not red.
	const suggest = strip.querySelector('[data-testid="teaching-load-suggest-draft-action"]')!;
	assert.ok(suggest, 'the suggestion action must render');
	assert.match(suggest.textContent ?? '', /Suggest assignments/, 'the operator asked for `Suggest assignments`');
	const suggestClass = suggest.getAttribute('class') ?? '';
	assert.match(suggestClass, /\bbg-secondary\b/, 'it must be the secondary variant');
	assert.doesNotMatch(suggestClass, /\bbg-primary\b/, 'it must not be the primary action');
	assert.doesNotMatch(suggestClass, /\bbg-destructive\b|\btext-destructive\b/, 'and not red');
	assert.doesNotMatch(suggestClass, /(^|\s)uppercase(\s|$)/, 'no letter-spaced caps on the action');
});

test('A6-C2-5 inspection shows a read-only profile; only `Edit assignments` opens the editor', async () => {
	// Walk item 4, verbatim: "a compact 58px card expands INLINE into a very long
	// assignment editor containing `Unassign all`, `Assign GR8`, checkboxes, and
	// Swap controls… it pushes the entire roster away."
	// The host mirrors the page: `onReviewLoad` is the page's own
	// `openTeacherReviewFor`, and the dialog is the real `ReviewTeachersModal`
	// carrying the real `WorkloadInspector` node.
	function TeacherProfileHost(props: { onRowSelect?: (id: number) => void } = {}) {
		const [selected, setSelected] = useState<any>(null);
		const [open, setOpen] = useState(false);
		const review = (facultyId: number) => {
			setSelected(facultyId === TEACHER.id ? TEACHER : OTHER_TEACHER);
			openTeacherReview({ setViewMode: () => {}, setReviewModalOpen: setOpen });
		};
		const copy = reviewModalCopy('teacher', selected);
		return createElement(Fragment2, null,
			createElement(TeacherGridMode as any, gridProps({
				selectedId: selected?.id ?? null,
				onSelectTeacher: props.onRowSelect ?? setSelected,
				onReviewLoad: review,
				departmentQualifiedSubjects: [
					{ id: 1, code: 'FIL', title: 'Filipino', gradeLevels: [7], programScopes: [], isActive: true } as any,
				],
			})),
			createElement(ReviewTeachersModal as any, {
				open, onOpenChange: setOpen, title: copy.title, description: copy.description,
			}, createElement(WorkloadInspector as any, {
				selected, loadProfile: null, rotationTermBreakdown: [], hoveredIncomingMinutes: 0,
				previewLoadHours: 0, isReadOnlyMode: false, activeTermIndex: 0,
				teachingStandardHours: 20, policyReady: true, writeBlockedReason: null,
			})),
		);
	}
	const host = render(createElement(TeacherProfileHost as any, {}));

	// (a) Inspect: the profile control opens a dialog with NONE of the editor's
	// controls. Asserted on the rendered TEXT and on the rendered ELEMENTS.
	assert.equal(portalledDialog() === null, true, 'precondition: no dialog before the click');
	click(host.querySelector('[data-testid="teaching-load-row-review"]')!);
	const dialog = portalledDialog();
	assert.ok(dialog, 'the profile control must open a read-only dialog');
	assert.equal(dialog!.getAttribute('data-testid'), 'teaching-load-review-modal', 'it must be the real review/profile dialog');
	const dialogText = dialog!.textContent ?? '';
	for (const forbidden of ['Unassign all', 'Assign GR', 'Reset assignments']) {
		assert.equal(dialogText.includes(forbidden), false, `the profile dialog must not contain "${forbidden}"`);
	}
	assert.equal(dialog!.querySelectorAll('input[type="checkbox"]').length, 0, 'no section checkboxes in the profile');
	assert.equal(dialog!.querySelectorAll('[role="checkbox"]').length, 0, 'no checkbox roles in the profile');
	assert.equal(/swap/i.test(dialogText), false, 'no Swap control in the read-only profile');
	// It really is the inspector, not an empty frame.
	assert.match(dialogText, /Dela Cruz/i, 'the profile must name the teacher it is about');

	// (a2) THE ROSTER BEHIND THE DIALOG. Walk item 4's own words: the inline
	// editor "pushes the entire roster away and places destructive-looking
	// controls among ordinary inspection content". Reading only the dialog would
	// miss exactly that, because the editor renders in the ROSTER, not the modal.
	assert.equal(
		host.querySelector('[data-testid="teaching-load-assignment-editor"]') === null,
		true,
		'inspecting a teacher must not mount the inline editor in the roster behind the dialog',
	);
	const rosterBehind = host.textContent ?? '';
	for (const forbidden of ['Unassign all', 'Assign GR', 'Reset assignments']) {
		assert.equal(rosterBehind.includes(forbidden), false, `the roster must not show "${forbidden}" while inspecting`);
	}

	// (b) A GENUINE outside pointerdown closes it. Radix listens for
	// `pointerdown` on the ownerDocument, so a real event on `document.body`
	// outside the dialog is dispatched — not a synthetic `close()` call.
	assert.ok(dom.window.document.body.contains(dialog!), 'precondition: the dialog is on the document');
	await outsidePointerDown(dialog!);
	assert.equal(
		portalledDialog() === null,
		true,
		'an outside pointer-down must dismiss the profile dialog (Lane C verified this on the sibling modal)',
	);

	// (c) The SEPARATE, explicit edit entry point is what opens the editor.
	const edit = host.querySelector('[data-testid="teaching-load-edit-assignments"]')!;
	assert.ok(edit, 'an explicit `Edit assignments` control must exist');
	assert.equal((edit.textContent ?? '').trim(), 'Edit assignments', 'it must be labelled as an edit');
	assert.equal(edit.getAttribute('aria-expanded'), 'false', 'it must announce the editor is closed');
	click(edit);
	assert.equal(edit.getAttribute('aria-expanded'), 'true', 'clicking it must announce the editor is open');
	assert.ok(host.querySelector('[data-testid="teaching-load-assignment-editor"]'), 'the editor must mount');
	assert.equal(edit.getAttribute('aria-controls'), host.querySelector('[data-testid="teaching-load-assignment-editor"]')!.getAttribute('id'));
	// The editor's inner TOOLS live behind the `Row tools` menu, so asserting on
	// their text would be asserting on a portal that is not open. The editor's own
	// heading and its real `SubjectRow` control are in the DOM and are what
	// distinguishes the real editor from an empty placeholder.
	assert.match(
		host.querySelector('[data-testid="teaching-load-assignment-editor"]')!.textContent ?? '',
		/Maria Dela Cruz assignments/,
		'it must be the real per-teacher editor, with its own subject rows',
	);
	// Inspecting again must never bring the editor back: the row click opens the
	// profile, and the profile contains none of the editor's controls.
	click(host.querySelector('[data-testid="teaching-load-edit-assignments"]')!);
	click(host.querySelector('[data-testid="teaching-load-row-review"]')!);
	assert.equal(
		portalledDialog()!.textContent!.includes('Unassign all'),
		false,
		'inspecting while the editor is closed must still show no editor control',
	);
});

/** `SectionGridMode` props with a real staffed section, so only the filter is in play. */
function sectionProps(overrides: Record<string, any> = {}) {
	return {
		loading: false,
		subjects: [{ id: 1, code: 'FIL', title: 'Filipino', gradeLevels: [7], programScopes: [], isActive: true }],
		sectionsBySubject: { 1: [{ id: 101, name: 'FIL 7 - A', programCode: 'REG', displayOrder: 7, isSpecialProgram: false }] },
		faculty: [TEACHER], effectiveOwnershipMap: { '1:101': { facultyId: 9, isPending: false } },
		onSetSections: () => {}, saving: false, isReadOnlyMode: false,
		activeFacultyIds: new Set<number>([9]), sectionModeFilter: 'all',
		onSectionModeFilterChange: () => {}, effectiveAssignmentsByFaculty: { 9: [] },
		selectedSectionId: null, onSelectSection: () => {},
		workspaceStateLabel: 'Ready', workspaceStateNextAction: 'x', writeBlockedReason: null,
		teachingStandardHours: 20, completedSectionIds: new Set<number>(),
		...overrides,
	};
}

test('A6-C2-6 the Sections empty state names the SEARCH, the FILTER, or the missing data', () => {
	// Walk item 5, verbatim: after searching `zzzzzz` it said "NO SECTIONS
	// REQUIRE ATTENTION" / "All visible sections match this filter" — a STAFFING
	// diagnosis for a SEARCH result. Three causes, three messages.

	// (1) A search with no match. Typed into the REAL input, because the query is
	// local state the page does not own.
	const searched = render(createElement(SectionGridMode as any, sectionProps()));
	assert.ok(searched.querySelector('[data-testid="teaching-load-section-row"]'), 'precondition: sections are rendered before searching');
	const input = searched.querySelector('input') as HTMLInputElement;
	act(() => {
		const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
		setter.call(input, 'zzzzzz');
		input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
	});
	assert.equal(input.value, 'zzzzzz', 'precondition: the real search input took the query');
	const searchEmpty = searched.querySelector('[data-testid="teaching-load-section-empty"]')!;
	assert.ok(searchEmpty, 'the empty state must render');
	assert.equal(
		searchEmpty.querySelector('[data-testid="teaching-load-section-empty-title"]')!.textContent,
		"No sections match 'zzzzzz'",
		'the message must name the QUERIED TERM, in the operator\'s words',
	);
	assert.equal(searchEmpty.textContent!.includes('require attention'), false, 'no staffing diagnosis for a search result');
	// A working way back.
	const clear = searchEmpty.querySelector('[data-testid="teaching-load-section-clear-search"]')!;
	assert.ok(clear, 'a `Clear search` control must be offered');
	click(clear);
	assert.equal((searched.querySelector('input') as HTMLInputElement).value, '', 'clicking it must empty the search');
	assert.ok(searched.querySelector('[data-testid="teaching-load-section-row"]'), 'and the sections must come back');

	// (2) A filter with no match and no search term: the ACTIVE FILTER is named.
	const filtered = render(createElement(SectionGridMode as any, sectionProps({ sectionModeFilter: 'unassigned' })));
	const filterEmpty = filtered.querySelector('[data-testid="teaching-load-section-empty"]')!;
	assert.ok(filterEmpty, 'the filter empty state must render');
	assert.match(
		filterEmpty.querySelector('[data-testid="teaching-load-section-empty-title"]')!.textContent ?? '',
		/Needs staffing/,
		'the message must name the ACTIVE filter, not the search',
	);
	assert.equal(filterEmpty.querySelector('[data-testid="teaching-load-section-clear-search"]'), null, 'no `Clear search` when there is no search');
	const back = filterEmpty.querySelector('[data-testid="teaching-load-section-clear-filter"]')!;
	assert.ok(back, 'a way back to All sections must be offered');
	// Sentence case: the old heading shouted `NO SECTIONS REQUIRE ATTENTION`.
	assert.doesNotMatch(filterEmpty.textContent ?? '', /require attention/i, 'the rejected copy must be gone');

	// (3) No subject-section data at all: the ORIGINAL message is untouched.
	const empty = render(createElement(SectionGridMode as any, sectionProps({ sectionsBySubject: {} })));
	const noneLoaded = empty.querySelector('[data-testid="teaching-load-section-empty"]');
	assert.equal(noneLoaded === null, true, 'case 3 is a different branch and keeps its own message');
	assert.match(
		empty.textContent ?? '',
		/No section assignment needs loaded/,
		'the no-data message must survive unchanged',
	);
});

test('A6-C2-7 both entry points share `openTeacherReview`, and the dialog names a staff-workload audit', () => {
	// Walk item 7, verbatim: the label "neither says workload audit nor explains
	// why one teacher is the subject."
	assert.equal(typeof openTeacherReview, 'function', 'the ONE opener must be importable');
	assert.equal(STAFF_WORKLOAD_REVIEW_LABEL, 'Review staff workload', 'the label constant must be the operator\'s words');

	// Both entry points route through it: the repair queue's action label and the
	// per-row control. Neither declares the label or the opener itself.
	const queue = read('src/components/faculty-assignments/TeachingLoadRepairQueue.tsx');
	assert.match(queue, /STAFF_WORKLOAD_REVIEW_LABEL/, 'the repair queue must use the shared label constant');
	assert.doesNotMatch(queue, /'Review teachers'/, 'and must not re-declare the rejected label');
	const hook = read('src/hooks/useTeachingLoadRepairQueue.ts');
	assert.match(hook, /openTeacherReview|onOpenReview/, 'the queue action flows to the shared opener');
	// The page drives it once, and both entry points land there.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(page, /openTeacherReview\(\{ setViewMode: ui\.setViewMode, setReviewModalOpen \}\)/, 'the page must call the one opener');
	assert.match(page, /onReviewLoad=\{openTeacherReviewFor\}/, 'the per-row control must use that wrapper');
	assert.match(page, /onOpenReview: \(\) => openTeacherReviewFor\(null\)/, 'and the repair queue the same wrapper');

	// The dialog, rendered. The TITLE is roster-level; the DESCRIPTION names the
	// subject when there is one.
	const host = render(createElement(ReviewTeachersModal as any, {
		open: true, onOpenChange: () => {},
		...reviewModalCopy('teacher', null),
	}, createElement('div', null, 'inspector body')));
	const dialog = portalledDialog()!;
	assert.ok(dialog, 'the review dialog must render when open');
	assert.match(
		dialog.querySelector('[data-testid="teaching-load-review-modal-title"]')!.textContent ?? '',
		/Staff workload audit/,
		'the title must name a STAFF-WORKLOAD AUDIT, not one person',
	);
	assert.doesNotMatch(dialog.textContent ?? '', /Teacher workload:/, 'the roster-wide audit must not be titled as one person');
	assert.match(dialog.textContent ?? '', /Every active teacher/, 'with no selection it must say the census is roster-wide');
});

test('A6-C2-7b with a teacher selected the DESCRIPTION names them, and the title stays roster-level', async () => {
	// Its OWN test, not a second render inside A6-C2-7: two open Radix dialogs
	// coexist in `document.body` and `querySelector` returns the first, so the
	// selected case would have been asserted against the unselected dialog. The
	// `afterEach` teardown is what keeps this honest — the same reasoning already
	// recorded for `A6-40-3-REAL-SINGULAR`.
	// A stateful wrapper, so `onOpenChange` really closes it: with a stubbed
	// handler the dismissal assertion below would pass for the wrong reason.
	function SelectedReviewHost() {
		const [open, setOpen] = useState(true);
		return createElement(ReviewTeachersModal as any, {
			open, onOpenChange: setOpen,
			...reviewModalCopy('teacher', { lastName: 'Valdez', firstName: 'Gabriela Luz' }),
		}, createElement('div', null, 'inspector body'));
	}
	const host = render(createElement(SelectedReviewHost as any, {}));
	assert.ok(host, 'the selected-case render must mount');
	const withTeacher = portalledDialog()!;
	assert.ok(withTeacher, 'the dialog must render for the selected case');
	assert.equal(
		withTeacher.querySelector('[data-testid="teaching-load-review-modal-title"]')!.textContent,
		'Staff workload audit',
		'the title stays roster-level even with a teacher selected',
	);
	assert.match(
		withTeacher.textContent ?? '',
		/Narrowed to Valdez, Gabriela Luz/,
		'the description must say, in words, which teacher the audit is narrowed to',
	);
	// A genuine outside pointer-down must still dismiss it — the dismissal path is
	// shared with the profile dialog and is not re-implemented per copy.
	await outsidePointerDown(withTeacher);
	assert.equal(portalledDialog() === null, true, 'the dialog must still dismiss on an outside pointer-down');
});

/* ================================================================== *
 * A6 C3 SLICE 1 — the workspace-state copy builder, extracted out of
 * `pages/TeachingLoad.tsx` (which was 995 physical lines against the
 * AGENTS.md §8 cap of 1000).
 *
 * The row is table-driven over ALL SIX branches, and the expected strings are
 * written out byte-for-byte rather than derived from the function, so a
 * reword inside the extraction is caught here. That is the whole risk of this
 * slice: an extraction that quietly improves a string is still a behaviour
 * change wearing a refactor's name.
 * ================================================================== */

test('A6-C3-1-EXTRACT the extracted workspace-state builder returns all six branches verbatim', () => {
	const BASE = {
		isOnline: true,
		dataSource: 'live' as const,
		canPersistAssignments: true,
		activeDraftCount: 0,
		degradedNotice: null,
		error: null,
	};

	const ROWS: Array<{ label: string; input: Record<string, any>; expected: Record<string, any> }> = [
		{
			label: 'OFFLINE wins over every source state',
			input: { ...BASE, isOnline: false, dataSource: 'live' },
			expected: {
				label: 'Offline',
				description: 'ATLAS is showing the last saved teaching load. Changes stay off until the connection returns.',
				nextAction: 'Reconnect, then refresh before saving assignments.',
				writeBlockedReason: 'Saving is off until ATLAS reconnects. Your work is safe to review.',
			},
		},
		{
			label: 'REFRESHING is its own state, not a failure',
			input: { ...BASE, dataSource: 'refreshing' },
			expected: {
				label: 'Checking source',
				description: 'ATLAS is comparing the saved workspace with EnrollPro. The last saved snapshot remains visible while this finishes.',
				nextAction: 'Wait for verification before saving new changes.',
				writeBlockedReason: 'Saving is off while ATLAS verifies the roster with EnrollPro.',
			},
		},
		{
			label: 'LIVE + writable, no draft',
			input: { ...BASE },
			expected: {
				label: 'EnrollPro roster verified',
				description: 'ATLAS Teaching Load draft. Assignment data was checked against EnrollPro. Draft changes can be saved.',
				nextAction: 'Inspect one teacher or fill section coverage gaps.',
				writeBlockedReason: null,
			},
		},
		{
			label: 'LIVE + writable, WITH a draft \u2014 the next action names the draft',
			input: { ...BASE, activeDraftCount: 3 },
			expected: {
				label: 'EnrollPro roster verified',
				description: 'ATLAS Teaching Load draft. Assignment data was checked against EnrollPro. Draft changes can be saved.',
				nextAction: 'Save the draft changes before leaving this page.',
				writeBlockedReason: null,
			},
		},
		{
			label: 'CACHED + writable, no notice \u2014 the default sentence is used',
			input: { ...BASE, dataSource: 'cached' },
			expected: {
				label: 'ATLAS Teaching Load draft',
				description: 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected. Draft changes can be saved.',
				nextAction: 'Check the classes below. Refresh later to pick up any new EnrollPro changes.',
				writeBlockedReason: null,
			},
		},
		{
			label: 'CACHED + writable + a real notice \u2014 the page\'s notice WINS over the default',
			input: { ...BASE, dataSource: 'cached', activeDraftCount: 2, degradedNotice: 'EnrollPro could not be reached, so ATLAS is using the last saved sections.' },
			expected: {
				label: 'ATLAS Teaching Load draft',
				description: 'EnrollPro could not be reached, so ATLAS is using the last saved sections.',
				nextAction: 'Save your changes. Refresh later to pick up any new EnrollPro changes.',
				writeBlockedReason: null,
			},
		},
		{
			label: 'CACHED + read-only',
			input: { ...BASE, dataSource: 'cached', canPersistAssignments: false },
			expected: {
				label: 'Read-only saved data',
				description: 'ATLAS can show the saved assignments, but it cannot safely save changes yet.',
				nextAction: 'Refresh from EnrollPro before saving, suggesting, or resetting assignments.',
				writeBlockedReason: 'Saving is off until ATLAS reconnects to EnrollPro.',
			},
		},
		{
			label: 'NONE, with a real error',
			input: { ...BASE, dataSource: 'none', canPersistAssignments: false, error: 'The Teaching Load source returned an error.' },
			expected: {
				label: 'No assignment data',
				description: 'The Teaching Load source returned an error.',
				nextAction: 'Retry the connection before assigning teachers.',
				writeBlockedReason: 'Saving is off because no teaching load data is available.',
			},
		},
		{
			label: 'NONE + LIVE-but-not-writable falls through to the same last branch',
			input: { ...BASE, dataSource: 'live', canPersistAssignments: false },
			expected: {
				label: 'No assignment data',
				description: 'ATLAS could not load a live source or a saved teaching load.',
				nextAction: 'Retry the connection before assigning teachers.',
				writeBlockedReason: 'Saving is off because no teaching load data is available.',
			},
		},
	];

	for (const row of ROWS) {
		const state = buildTeachingLoadWorkspaceState(row.input as any);
		assert.equal(state.label, row.expected.label, `${row.label}: label`);
		assert.equal(state.description, row.expected.description, `${row.label}: description`);
		assert.equal(state.nextAction, row.expected.nextAction, `${row.label}: nextAction`);
		assert.equal(state.writeBlockedReason, row.expected.writeBlockedReason, `${row.label}: writeBlockedReason`);
	}
});

test('A6-C3-1-WIRING the page CALLS the extracted builder and no longer inlines the copy', () => {
	// The extraction is only real if the page stopped holding the strings. This
	// row is a wiring row, not acceptance evidence for a visible change: the
	// copy itself is byte-identical, so nothing a scheduler sees moved.
	const page = read('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(
		page,
		/label: 'No assignment data'/,
		'the page must not carry the last branch\'s copy inline any more \u2014 the builder is the authority',
	);
	assert.doesNotMatch(
		page,
		/label: 'EnrollPro roster verified'/,
		'no branch of the header copy may remain inline in the page',
	);
	assert.match(
		page,
		/buildTeachingLoadWorkspaceState,/,
		'the page must import and call the extracted builder',
	);
	assert.match(
		page,
		/useMemo\(\(\) => buildTeachingLoadWorkspaceState\(/,
		'the page still decides WHEN to recompute, through the same useMemo',
	);
	// And the builder really lives in the pure-derivation module that holds the
	// page's other derivations, with no React import beside it.
	const metrics = read('src/components/faculty-assignments/teachingLoadWorkspaceMetrics.ts');
	assert.match(
		metrics,
		/export function buildTeachingLoadWorkspaceState\(/,
		'the builder must be exported from the pure-derivation module',
	);
	assert.doesNotMatch(
		metrics,
		/^import .* from 'react'/m,
		'the extraction target must stay React-free, or the page could hide a side effect in it',
	);
});

/* ================================================================== *
 * A6 C3 SLICE 2 — the c2 follow-ups N-1, N-2 and N-3.
 *
 * N-1  while `refreshing`, no snapshot-derived figure may be printed as if
 *      it were live (the header alert and the queue's readiness claim).
 * N-2  the withholding is per item, not one blanket loop: a department label
 *      survives, every derived figure is withheld, and every TITLE is
 *      qualified so no row asserts a snapshot state flatly.
 * N-3  the withheld string names the cause the page actually has, instead of
 *      always claiming EnrollPro is down.
 * ================================================================== */

test('A6-C3-3-N1 while ATLAS is CHECKING, no snapshot figure is printed as if it were live', () => {
	// THE STATE A6 C2 MISSED. `refreshing` is deliberately not "degraded" — ATLAS
	// is actively asking EnrollPro — so the header correctly showed
	// `Checking EnrollPro for the latest roster…`. But the repair queue was
	// gated on the DEGRADED predicate, so on the same row it published
	// `Teaching Load looks ready` and `23 of 24 classes have a teacher` from the
	// last saved snapshot, and the header's own `Above weekly max: 1` count came
	// from that same snapshot. Three unconfirmed numbers on one row, beside the
	// sentence saying the check is still running.
	const host = headerHost(
		{ dataSource: 'refreshing', dataSourceNotice: null },
		{ sourceDegraded: false, sourceState: { dataSource: 'refreshing', isOnline: true } },
	);
	const row2 = host.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
	assert.ok(row2, 'row 2 must render in the refreshing state');
	const rowText = row2.textContent ?? '';

	// The honest sentence stays, and it is the ONLY status on the row.
	assert.match(
		rowText,
		/Checking EnrollPro for the latest roster/,
		'the checking sentence is the honest one and must survive',
	);
	assert.equal(
		row2.querySelectorAll('[data-testid="teaching-load-degraded-notice"]').length,
		0,
		'a live check must NOT claim EnrollPro is unreachable (A6 C2 kept this, and it is right)',
	);
	// And nothing on the row asserts a snapshot-derived state.
	assert.doesNotMatch(rowText, /Teaching Load looks ready/, 'the queue must not claim readiness mid-check');
	assert.doesNotMatch(rowText, /23 of 24 classes have a teacher/, 'the completeness figure must be withheld mid-check');
	assert.match(
		rowText,
		/Teaching Load not verified/,
		'and the queue must state non-verification rather than readiness',
	);
	// SUPERSEDED 2026-09-29 by A6 c6 item 4 — RETAINED, NOT DELETED. The old
	// assertion demanded the SENTENCE name the cause while ATLAS is only checking:
	//
	//   assert.match(rowText, /Unverified — ATLAS is checking EnrollPro now, so this figure is withheld\./,
	//     'the withheld string must name the actual cause, not blame EnrollPro while ATLAS is only checking');
	//
	// That was the right rule — do not blame EnrollPro for a check that is still
	// running — and it is now enforced differently and more strongly: the sentence
	// must name NO product at all in any state, which subsumes the specific case.
	// The technical cause is still stated, in the pill's Tooltip, and the
	// rendered proof of that is `a6-c6-calm-teaching-load` `A6C6-6`.
	assert.doesNotMatch(
		rowText,
		/EnrollPro is not reachable/,
		'the withheld string must not blame EnrollPro while ATLAS is only checking',
	);
	assert.doesNotMatch(
		rowText,
		/Unverified|withheld/i,
		'the withheld status is a plain sentence now, not a status label with a clause bolted on',
	);
	assert.match(
		rowText,
		/ATLAS is checking the live roster now, so these numbers are not confirmed yet\./,
		"and it must say, in the scheduler's own terms, that these numbers are not confirmed yet",
	);
	assert.doesNotMatch(rowText, /% staffed/, 'the staffed percentage must be withheld mid-check');
	assert.doesNotMatch(rowText, /\b\d+ classes? need a teacher/, 'a computed open-class count must be withheld mid-check');
	assert.doesNotMatch(rowText, /Above weekly max/, 'the over-cap count comes from the last saved snapshot and must be withheld mid-check');
	assert.doesNotMatch(rowText, /\b100%\b/, 'never a confident 100% beside a running check');
	assert.equal(
		row2.querySelector('[data-testid="teaching-load-alert-over-cap"]'),
		null,
		'the alert count must be absent while the source is unconfirmed, not merely reworded',
	);
	// Not a dead row: the queue and its ONE action are still there.
	assert.ok(row2.querySelector('[data-testid="teaching-load-current-repair"]'), 'the queue must still render while checking');
	const action = row2.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLButtonElement;
	assert.ok(action, 'the ONE primary action must remain while checking');
	assert.equal(action.disabled, false, 'and it must stay operable');
});

/** A real teacher with no load, and a real teacher over their own cap. */
const MISSING_LOAD_TEACHER: any = {
	id: 11, firstName: 'Ana', lastName: 'Bautista', department: 'Mathematics',
	isActiveForScheduling: true, isPlaceholder: false,
	maxHoursPerWeek: 40, actualTeachingHours: 0, sectionTeachingHours: 0, policyCreditedHours: 0,
};
const OVER_CAP_TEACHER: any = {
	id: 12, firstName: 'Rene', lastName: 'Cruz', department: 'English',
	isActiveForScheduling: true, isPlaceholder: false,
	maxHoursPerWeek: 20, actualTeachingHours: 26, sectionTeachingHours: 26, policyCreditedHours: 26,
};

/** The REAL hook over REAL teachers, with the queue focused on one item. */
function RealFacultyQueueHost(props: {
	sourceState: { dataSource: 'live' | 'cached' | 'refreshing' | 'none'; isOnline: boolean };
	activeItemId: string;
	coverageUnassigned?: number;
}) {
	const queue = useTeachingLoadRepairQueue({
		searchParams: new URLSearchParams(),
		setSearchParams: () => {},
		faculty: [MISSING_LOAD_TEACHER, OVER_CAP_TEACHER],
		effectiveAssignmentsByFaculty: {},
		activeDraftCount: 0,
		isReadOnlyMode: false,
		selectedId: null,
		coverageAssigned: 6,
		coverageTotal: 8,
		coverageUnassigned: props.coverageUnassigned ?? 0,
		sourceDegraded: props.sourceState.dataSource !== 'live' || !props.sourceState.isOnline,
		sourceState: props.sourceState,
		writeBlockedReason: null,
		onSelectFaculty: () => {},
		onSave: () => {},
		onShowSubjectCoverage: () => {},
		onShowTeachersWithoutLoad: () => {},
		onShowOverloaded: () => {},
		onShowPlaceholder: () => {},
		onOpenReview: () => {},
	});
	return createElement(TeachingLoadRepairQueue as any, {
		items: queue.repairQueueItems,
		// Focused by id so EVERY row can be read from the real component, not
		// just whichever one sorts first.
		activeItemId: props.activeItemId,
		isReadOnly: false, saving: false,
		onPrimaryAction: queue.handleRepairPrimaryAction,
	});
}

test('A6-C3-3-N2 the withholding is PER ITEM: a department survives, every figure and title is qualified', () => {
	// A6 C2 withheld EVERYTHING non-draft with one blanket loop. That was too
	// WIDE in one item and too NARROW in one state. This row pins the corrected
	// policy on the three items it distinguishes, with real teachers rather than
	// invented items, and the coverage figure is non-zero so the `countLabel`
	// assertion is not vacuous.
	const STATE = { dataSource: 'cached', isOnline: true } as const;
	const mounted = render(createElement(RealFacultyQueueHost as any, {
		sourceState: STATE,
		activeItemId: 'over-cap-12',
		coverageUnassigned: 2,
	}));
	const queue = mounted.querySelector('[data-testid="teaching-load-repair-queue"]')!;
	assert.ok(queue, 'the real queue must render');

	/** Re-render the same real queue focused on one item, and read that row. */
	function rowFor(itemId: string): { text: string; actionLabel: string | null; disabled: boolean } {
		const host = render(createElement(RealFacultyQueueHost as any, {
			sourceState: STATE,
			activeItemId: itemId,
			coverageUnassigned: 2,
		}));
		const chip = host.querySelector('[data-testid="teaching-load-current-repair"]');
		assert.ok(chip, `${itemId}: the item must still be in the queue, not dropped`);
		assert.equal(
			chip!.getAttribute('data-repair-kind'),
			{ 'missing-load': 'missing-load', 'teacher-missing-load': 'teacher-missing-load', 'over-cap': 'over-cap' }[itemId === 'missing-load' ? 'missing-load' : (itemId === 'teacher-missing-11' ? 'teacher-missing-load' : 'over-cap')],
			`${itemId}: the queue must still address the item by its own kind`,
		);
		const button = host.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLButtonElement;
		assert.ok(button, `${itemId}: the row must keep its ONE action \u2014 a withheld row must never be a dead row`);
		return { text: chip!.textContent ?? '', actionLabel: button.getAttribute('aria-label'), disabled: button.disabled };
	}

	// (1) `teacher-missing-load` KEEPS its department. It is a label on a record
	// already on screen, not a figure derived from the snapshot, so withholding
	// it told the scheduler LESS and hid nothing they could not already read.
	const missing = rowFor('teacher-missing-11');
	assert.match(
		missing.text,
		/Mathematics department/,
		'a department label on an on-screen record must survive the withholding',
	);
	assert.doesNotMatch(
		missing.text,
		/Unverified/,
		'and it must not be replaced by the withheld string either \u2014 that was the over-reach',
	);
	// (4) …but its TITLE is still qualified: `… has no load` is a
	// snapshot-derived state and must not sit flatly on the row.
	assert.match(
		missing.text,
		/Last saved data \u2014 Bautista, Ana has no load/,
		'a snapshot-derived title must be qualified, not printed as current',
	);
	assert.equal(missing.actionLabel, 'Assign teaching load', 'and the action must be the operator\u2019s own, unchanged');

	// (2) `over-cap` loses its figure AND its qualification is explicit.
	const overCap = rowFor('over-cap-12');
	assert.match(
		overCap.text,
		/Last saved data \u2014 Cruz, Rene is over the weekly max/,
		'the over-cap title must be qualified too',
	);
	assert.doesNotMatch(
		overCap.text,
		/\d+(\.\d+)?h used \/ \d+h max/,
		'the snapshot figure itself must be withheld, not merely caveated',
	);
	// SUPERSEDED 2026-09-29 by A6 c6 item 4 — RETAINED, NOT DELETED. The old
	// assertion was:
	//
	//   assert.match(overCap.text, /Unverified — EnrollPro is not reachable, so this figure is withheld\./,
	//     'and replaced by the withheld string, which names the real cause');
	//
	// `overCap.text` is the REAL row off the REAL hook, so the string it matched
	// was the product's own. The replacement keeps the row's contract — a withheld
	// figure is replaced by a SENTENCE that says why, and it is not the bare word
	// `Unverified` — and states the new sentence exactly, which is stronger than
	// matching a shape.
	assert.doesNotMatch(overCap.text, /Unverified\b/, 'the row must not print the bare status word');
	assert.match(
		overCap.text,
		/These numbers come from the last saved roster, not the current one\./,
		'and it must be replaced by the plain withheld sentence, verbatim',
	);
	assert.equal(overCap.actionLabel, 'Move classes', 'the over-cap action must be untouched');

	// (3) `missing-load` keeps its task and loses its count badge.
	const open = rowFor('missing-load');
	assert.match(
		open.text,
		/Last saved data \u2014 Assign teachers to open classes/,
		'the open-class title is also snapshot-derived and must be qualified',
	);
	assert.doesNotMatch(
		open.text,
		/2 open/,
		'the countLabel badge must be deleted while the figure is withheld',
	);
	assert.equal(open.actionLabel, 'Review subject coverage', 'and its action must be untouched');

	// (5) NO row became a dead row, and NONE of them was dropped: the hook still
	// produced every item it would have produced when verified.
	for (const row of [missing, overCap, open]) {
		assert.equal(row.disabled, false, 'a withheld row must stay operable');
	}
});

test('A6-C3-3-N3 the withheld string names the cause the page ACTUALLY has', () => {
	// The defect, as rendered: `OFFLINE` and `NONE` both published
	// `Unverified \u2014 EnrollPro is not reachable`. That is false when ATLAS is the
	// thing that is down, and false when there is no source to reach at all. An
	// operator told "EnrollPro not reachable" while offline waits for the wrong
	// thing to come back.
	const STATES: Array<{ label: string; input: { dataSource: any; isOnline: boolean }; unverified: boolean; reason: string; status: string }> = [
		{
			label: 'LIVE + online',
			input: { dataSource: 'live', isOnline: true },
			unverified: false,
			reason: 'EnrollPro not reachable',
			// SUPERSEDED 2026-09-29 by A6 c6 item 4 — the four `status` values in
			// this table were `Unverified — …, so this figure is withheld.` in all
			// four states, which is what made `OFFLINE` and `NONE` indistinguishable
			// and put a product name on the calm face. The values below are the four
			// plain sentences, verbatim, and the loop below now ALSO asserts that no
			// two states produce the same string — a check the old table could not
			// have passed, since three of its entries were byte-identical.
			status: 'These numbers come from the last saved roster, not the current one.',
		},
		{
			label: 'CACHED + online',
			input: { dataSource: 'cached', isOnline: true },
			unverified: true,
			reason: 'EnrollPro not reachable',
			status: 'These numbers come from the last saved roster, not the current one.',
		},
		{
			label: 'REFRESHING + online',
			input: { dataSource: 'refreshing', isOnline: true },
			unverified: true,
			reason: 'ATLAS is checking EnrollPro now',
			status: 'ATLAS is checking the live roster now, so these numbers are not confirmed yet.',
		},
		{
			label: 'OFFLINE',
			input: { dataSource: 'live', isOnline: false },
			unverified: true,
			reason: 'ATLAS is offline',
			status: 'ATLAS is offline, so these numbers cannot be checked.',
		},
		{
			label: 'NONE + online',
			input: { dataSource: 'none', isOnline: true },
			unverified: true,
			reason: 'no live Teaching Load source is available',
			status: 'No live Teaching Load source is available, so these numbers cannot be checked.',
		},
		{
			label: 'OFFLINE beats every other state',
			input: { dataSource: 'none', isOnline: false },
			unverified: true,
			reason: 'ATLAS is offline',
			status: 'ATLAS is offline, so these numbers cannot be checked.',
		},
	];

	for (const state of STATES) {
		assert.equal(
			isTeachingLoadSourceUnverified(state.input),
			state.unverified,
			`${state.label}: the wider unverified predicate`,
		);
		assert.equal(
			teachingLoadUnverifiedReason(state.input),
			state.reason,
			`${state.label}: the amber line's clause`,
		);
		assert.equal(
			teachingLoadUnverifiedStatus(state.input),
			state.status,
			`${state.label}: the withheld sentence`,
		);
	}

	// The one hard compatibility promise, asserted as its own comparison rather
	// than as another table entry. SUPERSEDED 2026-09-29 by A6 c6 item 4,
	// RETAINED AS EVIDENCE: the old promise was
	//
	//   assert.equal(teachingLoadUnverifiedStatus({ dataSource: 'cached', isOnline: true }),
	//     'Unverified — EnrollPro is not reachable, so this figure is withheld.',
	//     'the cached + online withheld string must be byte-identical to the one A6 C2 printed');
	//
	// which is why the string was frozen with a product name in it. The
	// REPLACEMENT keeps the promise and changes its direction: the cached case
	// must now be the plain sentence, AND it must still be the string ATLAS C2
	// left intact rather than the `LIVE` one — so a future edit cannot quietly
	// make every unverified state read the same.
	assert.equal(
		teachingLoadUnverifiedStatus({ dataSource: 'cached', isOnline: true }),
		'These numbers come from the last saved roster, not the current one.',
		'the cached + online withheld string must be the plain sentence, verbatim',
	);
	// THE NEW INVARIANT the old table could not carry: the four states are
	// DISTINGUISHABLE. Three of the pre-A6-c6 entries were byte-identical, so this
	// is the check that closes the `OFFLINE`/`NONE` confusion A6 C3 (N-3) opened.
	const fourStates = [
		teachingLoadUnverifiedStatus({ dataSource: 'live', isOnline: false }),
		teachingLoadUnverifiedStatus({ dataSource: 'refreshing', isOnline: true }),
		teachingLoadUnverifiedStatus({ dataSource: 'none', isOnline: true }),
		teachingLoadUnverifiedStatus({ dataSource: 'cached', isOnline: true }),
	];
	assert.equal(
		new Set(fourStates).size,
		4,
		`the four unverified states must produce four DIFFERENT sentences: ${JSON.stringify(fourStates)}`,
	);
	for (const sentence of fourStates) {
		assert.doesNotMatch(sentence, /EnrollPro/, 'no product name belongs on the calm face in any state');
		assert.doesNotMatch(sentence, /withheld|Unverified/i, 'nor a status word a scheduler cannot act on');
	}
	// And the narrower predicate is UNCHANGED, including `refreshing`, so the
	// header keeps its right to say "checking" rather than "down". This is the
	// REAL exported function, not a copy of it.
	//
	// A6 C3 (QA finding B2, 2026-09-29): this used to declare a LOCAL clone of
	// `isTeachingLoadSourceDegraded` and assert against that clone. A control that
	// re-implements the rule it is meant to police passes whatever production
	// does — it was vacuous, and it would have stayed green if the real predicate
	// had been deleted. The clone is gone; the import above is the one under test.
	// The predicate's OWN parameter type, so the table below is checked against
	// the real signature instead of an `any` bag that would accept a renamed or
	// dropped field. `WorkspaceToolbarProps['dataSource']` is the union the
	// production signature uses.
	type DegradedInput = Parameters<typeof isTeachingLoadSourceDegraded>[0];
	const NARROW_STATES: Array<{ label: string; input: DegradedInput; degraded: boolean }> = [
		{ label: 'LIVE + online + no notice', input: { dataSource: 'live', isOnline: true, dataSourceNotice: null }, degraded: false },
		{ label: 'LIVE + a leftover notice', input: { dataSource: 'live', isOnline: true, dataSourceNotice: 'x' }, degraded: true },
		{ label: 'CACHED + online', input: { dataSource: 'cached', isOnline: true, dataSourceNotice: null }, degraded: true },
		{ label: 'REFRESHING + online', input: { dataSource: 'refreshing', isOnline: true, dataSourceNotice: null }, degraded: false },
		{ label: 'REFRESHING + a leftover notice', input: { dataSource: 'refreshing', isOnline: true, dataSourceNotice: 'x' }, degraded: false },
		{ label: 'NONE + online', input: { dataSource: 'none', isOnline: true, dataSourceNotice: null }, degraded: true },
		{ label: 'OFFLINE', input: { dataSource: 'live', isOnline: false, dataSourceNotice: null }, degraded: true },
	];
	for (const state of NARROW_STATES) {
		assert.equal(
			isTeachingLoadSourceDegraded(state.input),
			state.degraded,
			`${state.label}: the narrow predicate must still decide the amber line — a live check is NOT a failure, and a leftover notice does not turn one into a failure`,
		);
	}
	// The distinction that B1/B2 are about, stated against the two REAL
	// functions: `refreshing` is not degraded, but it IS unverified.
	assert.equal(
		isTeachingLoadSourceDegraded({ dataSource: 'refreshing', isOnline: true, dataSourceNotice: null }),
		false,
		'a live check must never be called a failure — the header keeps its own honest wording',
	);
	assert.equal(
		isTeachingLoadSourceUnverified({ dataSource: 'refreshing', isOnline: true }),
		true,
		'while the SAME state must still withhold the figures, which is the wider question',
	);
});

test('A6-C3-3-WIRING the page threads the SOURCE STATE, and the hook requires it', () => {
	const page = read('src/pages/TeachingLoad.tsx');
	assert.match(
		page,
		/sourceState: \{ dataSource: data\.dataSource, isOnline: data\.isOnline \}/,
		'the page must hand the hook the real source state, not a second boolean',
	);
	assert.match(
		page,
		/^\t\tsourceDegraded,$/m,
		'the existing shared-predicate boolean must stay, next to it',
	);
	// Required, not optional: an omitted argument must not render live figures.
	const hook = read('src/hooks/useTeachingLoadRepairQueue.ts');
	assert.match(hook, /^\tsourceState: \{/m, 'the hook parameter must be REQUIRED');
	assert.doesNotMatch(hook, /sourceState\?:/, 'an optional source state would reopen this defect silently');
	// The rule has ONE implementation, and the module-level constant it replaced
	// is gone rather than left beside the new one.
	const toolbar = read('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	assert.match(toolbar, /export function isTeachingLoadSourceUnverified\(/, 'the wider predicate must be exported from the shared module');
	assert.match(toolbar, /export function teachingLoadUnverifiedReason\(/, 'the cause must be written in the shared module');
	assert.match(toolbar, /export function teachingLoadUnverifiedStatus\(/, 'and so must the withheld sentence');
	assert.doesNotMatch(
		hook,
		/const UNVERIFIED_STATUS =/,
		'the one-size-fits-all constant must be deleted, not left beside the per-state one',
	);
	assert.match(
		hook,
		/isTeachingLoadSourceUnverified\(sourceState\)/,
		'the hook must derive the flag from the shared module rather than re-state the rule',
	);
	// The amber line still uses the NARROW predicate \u2014 a live check must not be
	// called a failure.
	assert.match(
		toolbar,
		/const isSourceDegraded = isTeachingLoadSourceDegraded\(\{ dataSource, isOnline, dataSourceNotice \}\)/,
		'the amber line keeps the narrow predicate, and its call is byte-identical to before',
	);
	assert.match(
		toolbar,
		/const isSourceUnverified = isTeachingLoadSourceUnverified\(\{ dataSource, isOnline \}\)/,
		'the wider predicate is decided once, here',
	);
});
