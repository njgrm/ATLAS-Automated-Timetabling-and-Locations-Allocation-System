/**
 * A3 A1 — the unlabelled percentage on the Teaching Load roster.
 *
 * THE DEFECT THIS EXISTS TO PROVE ABSENT, measured live at 1366x768 by the
 * planner (`docs/reviews/a3-browser-acceptance-20260927/evidence.md`, #53): the
 * roster card rendered `15.0h · 50%`, `18.8h · 62.7%`, `22.5h · 75%` in a single
 * 85x16px `<p>`. Nothing beside the percentage said what it was a percentage OF,
 * and its only explanation was a `cursor-help` Tooltip — a hover-only affordance,
 * invisible to the mouse-first older scheduler this surface is graded for, and
 * not a keyboard or touch path either. The same metric is labelled `% staffed` on
 * the dashboard readiness card, so the roster was the bare one of two
 * disagreeing screens.
 *
 * These controls render the REAL `TeacherGridMode` from a real `FacultySummary`
 * through the real `teachingUtilizationPercentFor` helper — 15h against a 30h
 * standard reproduces the planner's measured `15.0h · 50%` exactly — so the
 * assertion is on the production path, not on an isolated sub-component. A
 * separate wiring control then pins that `TeacherGridMode` still renders the
 * readout, so this file cannot pass while production silently reverts to an
 * inline string.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/teaching-load',
	pretendToBeVisual: true,
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
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false,
	media: q,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { TeacherGridMode } = await import('@/components/faculty-assignments/TeacherGridMode');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

const roots: unknown[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => (root as { unmount: () => void }).unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
});

/**
 * The planner's measured row, as real data. 15.0h against a 30h standard is
 * `15/30 = 50%` — the exact figure observed live — so the fixture is the real
 * surface rather than an invented one.
 */
function faculty(overrides: Record<string, unknown> = {}) {
	return {
		id: 9,
		firstName: 'Maria',
		lastName: 'Dela Cruz',
		department: 'Mathematics',
		departmentLabel: 'MATH',
		employmentStatus: 'REGULAR',
		employeeId: 'EMP-0009',
		isActiveForScheduling: true,
		isClassAdviser: false,
		isPlaceholder: false,
		maxHoursPerWeek: 40,
		policyCreditedHours: 24,
		sectionTeachingHours: 15,
		actualTeachingHours: 15,
		gradeTeachingHours: null,
		syntheticCoverageHours: null,
		subjectCount: 3,
		sectionCount: 4,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: 0,
		advisedSectionName: null,
		version: 1,
		assignments: [],
		...overrides,
	};
}

function renderGrid(member: Record<string, unknown>, opts: { standardHours: number | null; policyReady?: boolean }) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);

	const one = [member] as never[];
	const props: Record<string, unknown> = {
		loading: false,
		faculty: one,
		filteredFaculty: one,
		groupedFaculty: [['MATH', one]],
		selectedId: null,
		onSelectTeacher: () => {},
		effectiveAssignmentsByFaculty: {},
		effectiveDraftAssignmentsByFaculty: {},
		subjects: [],
		sectionsBySubject: {},
		saving: false,
		isReadOnlyMode: false,
		effectiveOwnershipMap: {},
		savedConflictMap: {},
		onSetSections: () => {},
		onSwapSectionOwnership: () => {},
		departmentQualifiedSubjects: [],
		outsideDepartmentSubjects: [],
		homeroomHint: null,
		loadProfile: null,
		onHoverLoadMinutes: () => {},
		onClearHoverLoad: () => {},
		activeFacultyIds: new Set<number>(),
		resolveSectionHoverDeltaMinutes: () => 0,
		onResetAssignments: () => {},
		searchQuery: '',
		onSearchQueryChange: () => {},
		filterStatus: 'all',
		onFilterStatusChange: () => {},
		statusFacetCounts: { all: 1, 'needs-load': 0, 'over-cap': 0, 'under-load': 0 } as never,
		loadFilter: 'all',
		loadFacetCounts: { 'below-standard': 1, 'at-standard': 0, excess: 0 },
		onLoadFilterChange: () => {},
		departmentFilter: 'all',
		onDepartmentFilterChange: () => {},
		departmentOptions: [],
		filterAnnouncement: '',
		onClearTeachingLoadFilters: () => {},
		effectiveActualHours: new Map<number, number>(),
		teachingStandardHours: opts.standardHours,
		policyReady: opts.policyReady ?? true,
		sortOrder: 'name',
		onSortOrderChange: () => {},
		showFilters: false,
		onToggleFilters: () => {},
		showOutsideDept: false,
		onToggleOutsideDept: () => {},
		showUnmappedSpecialization: false,
		onShowUnmappedSpecializationChange: () => {},
		completedSectionIds: new Set<number>(),
		workspaceStateLabel: '',
		workspaceStateNextAction: '',
		writeBlockedReason: null,
	};

	act(() => {
		root.render(
			createElement(
				MemoryRouter as never,
				{ initialEntries: ['/teaching-load'] },
				createElement(TooltipProvider as never, { delayDuration: 200 }, createElement(TeacherGridMode as never, props)),
			),
		);
	});
	return host;
}

const readout = (host: HTMLElement) => host.querySelector('[data-testid="teacher-load-readout"]') as HTMLElement;
const text = (host: HTMLElement) => (readout(host).textContent ?? '').replace(/\s+/g, ' ').trim();

/* ─────────────────────────────────────────────────────── the measured defect ────────────────────── */

test('A1 control: the roster percentage carries a VISIBLE label beside it, not only a hover tooltip', () => {
	const host = renderGrid(faculty(), { standardHours: 30 });

	// The planner's exact live figure is reproduced from real data.
	assert.match(text(host), /15\.0h/, 'the hours figure is unchanged');
	assert.match(text(host), /50%/, 'the measured percentage is unchanged: 15.0/30');

	// THE FIX. The label is inside the readout element's own rendered text, so
	// it is present without a pointer, a keyboard or a touch.
	const label = readout(host).querySelector('[data-testid="teacher-load-utilization-label"]');
	assert.ok(label, 'the percentage must have a visible label element beside it');
	assert.equal((label!.textContent ?? '').trim().toLowerCase(), 'of standard');
	assert.match(text(host), /of standard/i, 'the label must be part of the rendered text, not hover-only');
	assert.doesNotMatch(text(host), /\b50% of\b/, 'the label must not be glued onto the number as prose');

	// It must be VISIBLE, not hidden behind a breakpoint: the compact mobile
	// layout drops the `Hours / week` caption, so a label that shares that
	// caption's `hidden sm:block` would be invisible on exactly the small
	// screens where a bare number is least explicable.
	assert.doesNotMatch(label!.className, /\bhidden\b/, 'the label must not be hidden at any breakpoint');
	assert.doesNotMatch(label!.className, /sr-only/, 'the label must be visually present, not screen-reader-only');
	assert.doesNotMatch(label!.className, /opacity-0/, 'the label must not be transparent');
});

test('A1 control: the unknown-standard case is its own visible state, not a bare hour figure', () => {
	const host = renderGrid(faculty(), { standardHours: null });

	// Pre-fix this rendered `15.0h` alone, which read like a complete figure.
	assert.match(text(host), /15\.0h/);
	assert.doesNotMatch(text(host), /\d+%/, 'no percentage may be invented when the standard is unset');
	const state = readout(host).querySelector('[data-testid="teacher-load-no-percentage"]');
	assert.ok(state, 'the withheld case must state itself visibly');
	assert.equal((state!.textContent ?? '').trim().toLowerCase(), 'no standard set');
	assert.doesNotMatch(text(host), /of standard/i, 'the measured label must not appear when there is no measurement');
});

test('A1 control: a placeholder row states "temporary" rather than dropping the percentage silently', () => {
	const host = renderGrid(
		faculty({ isPlaceholder: true, actualTeachingHours: null, gradeTeachingHours: 15, syntheticCoverageHours: null }),
		{ standardHours: 30 },
	);
	assert.match(text(host), /15\.0h/);
	assert.doesNotMatch(text(host), /\d+%/, 'a placeholder row has no standard to be a percentage of');
	const state = readout(host).querySelector('[data-testid="teacher-load-no-percentage"]');
	assert.ok(state, 'the placeholder case must state itself visibly');
	assert.equal(
		(state!.textContent ?? '').trim().toLowerCase(),
		'temporary',
		'"temporary" is the house word for a placeholder row (TeachingLoadTruthPanel, WorkspaceToolbar)',
	);
});

test('A1 control: a real 0% is still shown as 0% with its label, not converted to the unknown state', () => {
	// Guards against over-correcting: 0h against a 30h standard is a genuine
	// measurement, and a "hide anything falsy" fix would lose it.
	const host = renderGrid(faculty({ actualTeachingHours: 0, sectionTeachingHours: 0 }), { standardHours: 30 });
	assert.match(text(host), /0\.0h/);
	assert.match(text(host), /0%/, 'a measured 0% must still render as 0%');
	assert.equal(
		readout(host).querySelector('[data-testid="teacher-load-no-percentage"]'),
		null,
		'a measured zero must not fall into the withheld state',
	);
	assert.ok(readout(host).querySelector('[data-testid="teacher-load-utilization-label"]'), 'a measured zero keeps its label');
});

/* ─────────────────────────────────────────────────────── the over/under colour survives ────────────────────── */

test('A1 control: the over/under colour treatment is unchanged and still applied to the hours', () => {
	const under = renderGrid(faculty(), { standardHours: 30 });
	assert.match(readout(under).className, /text-emerald-600/, '15h against a 30h standard is under, and stays green');

	// rose is `displayHours > maxHoursPerWeek` (40 in this fixture), so 45h is
	// the first value that reaches it. 36h would be amber, not rose: over the
	// 30h standard but still under the cap.
	const over = renderGrid(faculty({ actualTeachingHours: 45, sectionTeachingHours: 45 }), { standardHours: 30 });
	assert.match(readout(over).className, /text-rose-600/, '45h is over the 40h cap, and stays rose');
	assert.match(text(over), /150%/, 'the over-cap percentage is unchanged: 45/30');

	const between = renderGrid(faculty({ actualTeachingHours: 36, sectionTeachingHours: 36 }), { standardHours: 30 });
	assert.match(readout(between).className, /text-amber-600/, '36h is over the standard but under the cap, and stays amber');
	assert.match(text(between), /120%/, 'the over-standard percentage is unchanged: 36/30');

	// An unconfigured standard keeps the muted treatment, as before.
	const unset = renderGrid(faculty(), { standardHours: null });
	assert.match(readout(unset).className, /text-muted-foreground/);
});

/* ─────────────────────────────────────────────────────── §8 and the wiring ────────────────────── */

test('A1 control: the tooltip still routes through the @/ui primitive, with no raw title attribute', () => {
	const text_ = source('src/components/faculty-assignments/TeacherLoadReadout.tsx');
	assert.match(text_, /from '@\/ui\/tooltip'/, 'the explanation must use the @/ui Tooltip primitive');
	assert.doesNotMatch(text_, /\btitle=/, 'AGENTS.md §8 forbids a raw title attribute');
	assert.doesNotMatch(text_, /<select\b/i, 'no native select');
	assert.doesNotMatch(text_, /<button\b/i, 'no raw unstyled button');
	// The visible label is an addition, not a replacement: the long-form
	// explanation must survive.
	assert.match(text_, /busiest term, compared with the/, 'the long-form explanation must be kept');
	assert.match(text_, /standard load is not set for this school year/, 'the existing honest copy must be kept');
});

test('A1 control: TeacherGridMode really renders the readout, and the old inline string is gone', () => {
	// Without this, the DOM controls above would still pass against a
	// sub-component that production no longer uses.
	const grid = source('src/components/faculty-assignments/TeacherGridMode.tsx');
	assert.match(grid, /import \{ TeacherLoadReadout \} from '\.\/TeacherLoadReadout';/);
	assert.match(grid, /<TeacherLoadReadout/, 'the roster row must render the readout');
	assert.doesNotMatch(
		grid,
		/utilization == null \? `\$\{displayHours\.toFixed\(1\)\}h`/,
		'the pre-fix inline ternary must not survive',
	);
});
