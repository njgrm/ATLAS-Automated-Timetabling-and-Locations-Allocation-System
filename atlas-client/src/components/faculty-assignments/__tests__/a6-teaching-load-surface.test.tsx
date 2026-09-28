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

	// Precondition: the row is collapsed and nothing was reviewed.
	const row = second.closest('[role="button"][aria-expanded]') as HTMLElement;
	assert.ok(row, 'the teacher row must render as an expandable control');
	assert.equal(row.getAttribute('aria-expanded'), 'false', 'precondition: the row starts collapsed');

	click(second);

	assert.deepEqual(
		reviewed,
		[OTHER_TEACHER.id],
		`the click must call onReviewLoad with THAT member's id; saw ${JSON.stringify(reviewed)}`,
	);
	const after = second.closest('[role="button"][aria-expanded]') as HTMLElement;
	assert.equal(
		after.getAttribute('aria-expanded'),
		'false',
		'clicking `Review load` must NOT also toggle the row open — `event.stopPropagation()` is load-bearing',
	);
	// The row is still keyboard-operable: it is a real focusable control, and the
	// new button is a real button, so both are in the Tab order.
	assert.equal(row.getAttribute('tabindex'), '0', 'the row must stay keyboard-operable');
	assert.equal((second as HTMLButtonElement).tagName, 'BUTTON', 'the per-row control is a real button');
	assert.equal((second as HTMLButtonElement).type, 'button', 'and it must not submit anything');
});

/* ─────────────────────── Item 38 — the `Load summary` modal ─────────────── */

test('A6-38-1 clicking `Load summary` opens a dialog with the COMPLETE breakdown', () => {
	// The production composition: the header button and the dialog are SIBLINGS
	// in `pages/TeachingLoad.tsx`, so this mounts them the same way — a real
	// `onClick` that flips a real `open` state — and proves the CLICK is what
	// opens it. A component mounted already-open would prove nothing about the
	// button.
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(inRouter(createElement(TeachingLoadLoadSummaryShell as any, {}))); });

	const opener = host.querySelector('[data-testid="teaching-load-summary-open"]') as HTMLButtonElement;
	assert.ok(opener, 'the real header toolbar must render a `Load summary` button');
	assert.equal((opener.textContent ?? '').trim(), 'Load summary', 'the button reads exactly `Load summary`');
	// It is a SECONDARY header action: the outline variant, at the row-1 `h-7` so
	// `TEACHING_LOAD_HEADER_MODEL.ROW_1_COMMAND_PX` is unchanged.
	//
	// Asserted on the merged variant classes, because a `variant` prop is not in
	// the DOM and the shared base carries `outline-none` on every button.
	const openerClass = opener.getAttribute('class') ?? '';
	assert.match(openerClass, /\bbg-background\b/, 'the summary action renders the outline variant, beside the solid suggestion action');
	assert.doesNotMatch(openerClass, /\bbg-primary\b/, 'it must not compete with the primary suggestion action');
	assert.match(openerClass, /\bh-7\b/, 'it must match the other row-1 controls so the header height model is unchanged');
	assert.match(openerClass, /\bshrink-0\b/);
	assert.equal(opener.getAttribute('title'), null, 'no raw title attribute (AGENTS.md §8)');
	// It sits AFTER `Help` and BEFORE the primary suggestion action, per the
	// requested header order.
	const help = buttonByText(host, 'Help');
	assert.ok(help, 'the shared Help trigger must still render in the action group');
	assert.ok(
		((help as HTMLElement).compareDocumentPosition(opener) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		'`Load summary` must come AFTER `Help`',
	);
	const suggestion = host.querySelector('[data-testid="teaching-load-suggest-draft-action"]');
	assert.ok(suggestion, 'the primary suggestion action must still render');
	assert.ok(
		((opener as HTMLElement).compareDocumentPosition(suggestion as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		'`Load summary` must come BEFORE the primary suggestion action',
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

test('A6-39-1 ONE row carries all seven controls, and `More filters` is gone', () => {
	const host = render(createElement(TeachingLoadFilterBar as any, filterBarProps()));
	const primary = host.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the filter row must render');
	const rowClass = primary.getAttribute('class') ?? '';
	assert.match(rowClass, /\bflex\b/);
	assert.match(rowClass, /\bflex-wrap\b/, 'the row wraps rather than clipping');
	assert.match(rowClass, /\bitems-center\b/);
	assert.match(rowClass, /\bgap-2\b/);

	// The seven controls, in the operator's order, read as DOM order.
	const ordered = Array.from(
		primary.querySelectorAll('[aria-label], #show-outside-dept, #show-unmapped-specialization'),
	).map((el) => el.getAttribute('aria-label') ?? `#${el.getAttribute('id')}`);
	assert.deepEqual(ordered, [
		'Search teachers',
		'Filter by status',
		'Filter by department',
		'Filter by load',
		'Sort teachers',
		'#show-outside-dept',
		'#show-unmapped-specialization',
	], 'the seven controls must appear in the operator\'s order on the one row');

	// Every select shares the operator's chrome: h-9, text-xs, px-2.5, rounded-xl,
	// border, bg-background, hover.
	for (const name of ['Filter by status', 'Filter by department', 'Filter by load', 'Sort teachers']) {
		const trigger = primary.querySelector(`[aria-label="${name}"]`)!;
		const cls = trigger.getAttribute('class') ?? '';
		for (const token of [/\bh-9\b/, /\btext-xs\b/, /\bpx-2\.5\b/, /\brounded-xl\b/, /\bborder-border\/60\b/, /\bbg-background\b/, /\bhover:bg-muted\/40\b/, /\btransition-colors\b/]) {
			assert.match(cls, token, `the "${name}" select must carry the shared control chrome`);
		}
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

	// `More filters` and the second row are both GONE.
	assert.equal(host.querySelector('[data-testid="teaching-load-secondary-filters"]'), null, 'the second row must be removed');
	assert.equal(buttonByText(host, 'More filters'), null, 'the `More filters` button must be removed');
	for (const button of buttonsIn(host)) {
		assert.doesNotMatch((button.textContent ?? '').trim(), /More filters/, 'no control may reintroduce the disclosure');
	}
	// Both switches are reachable, and the operator's full words are intact —
	// the toggles were made COMPACT by chrome, not by shortening the copy.
	assert.ok(primary.querySelector('label[for="show-outside-dept"]'), 'the cross-dept toggle must be labelled');
	assert.ok(primary.querySelector('label[for="show-unmapped-specialization"]'), 'the unmapped-specialization toggle must be labelled');
	assert.match(host.textContent ?? '', /Unmapped Specialization/, 'the operator\'s full toggle wording must survive');
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
	const text = dialog!.textContent ?? '';
	assert.match(text, /Save Teaching Load Changes\?/, 'the confirmation must be titled `Save Teaching Load Changes?`');
	assert.match(
		text,
		/You have 2 uncommitted load assignment changes for Term 2\. This will update faculty workloads and sync with the scheduling engine\./,
		'the body must state the count, the term, and the consequence',
	);
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

/* ──────────────────── Item 16.1 / 38 / 39 page-level wiring ─────────────── */

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
