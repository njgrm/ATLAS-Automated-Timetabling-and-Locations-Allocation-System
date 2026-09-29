/**
 * A6 a6-tl-advisory — THE ADVISER STAR GETS A NAME ON THE TEACHING LOAD CARD.
 *
 * The user is an older, mouse-first scheduler staffing Teaching Load. On the
 * Teaching Load teacher card the class-adviser star was a bare icon: a fact with
 * no name attached, so the scheduler could not tell WHICH section the teacher
 * advises without leaving the page. The Teachers page already solved this — its
 * roster identity cell prints the amber star followed by `Adviser: <section>`
 * (or exactly `Adviser` when no section label exists). This file proves the
 * Teaching Load card now prints the same words, from the same component.
 *
 * WHY THIS FILE RENDERS EVERYTHING IT CLAIMS. AGENTS.md §11: "A test that only
 * asserts source text is not acceptance evidence for a user-facing change."
 * Every visible claim below is read off MARKUP produced by the real components
 * in real JSDOM. The one source-text assertion (R4, second half) is not the
 * acceptance evidence for the copy: it is a structural control that the two
 * surfaces reference ONE shared component rather than two drifting copies.
 *
 * THE HARNESS IS COPIED VERBATIM from the accepted sibling
 * `a6-c6-calm-teaching-load.test.tsx` (its JSDOM bootstrap, `render`, `click`,
 * `dispose`, `textOf` and `gridProps` fixtures) so the two files behave
 * identically and a reviewer can diff them.
 *
 * EVERY ROW NAMES THE ITEM IT DECIDES. R1 is the failing-first row: it is red on
 * the base (only the bare star renders) and green after the fix.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A repository source file, read by path from the client root. */
const readSource = (relative: string): string =>
	readFileSync(resolve(import.meta.dirname, '../../../..', relative), 'utf8');

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

const { TeacherGridMode } = await import('@/components/faculty-assignments/TeacherGridMode');
const { FacultyIdentityCell } = await import('@/components/faculty/FacultyRow');

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

const textOf = (node: Element | Document | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

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

/** The adviser WITH a section label — the exact case the fix is about. */
const ADVISER_TEACHER: any = { ...TEACHER, advisedSectionName: 'Rizal' };
/** The adviser WITHOUT a section label — must fall back to the bare word. */
const NULL_ADVISER_TEACHER: any = { ...TEACHER, advisedSectionName: null };
/** A teacher who is not an adviser at all. */
const NON_ADVISER_TEACHER: any = OTHER_TEACHER;

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

/** The TL grid with ONE adviser teacher slotted into the default group. */
function gridPropsWith(adviserTeacher: any, otherTeacher: any = OTHER_TEACHER) {
	return gridProps({
		faculty: [adviserTeacher, otherTeacher],
		filteredFaculty: [adviserTeacher, otherTeacher],
		groupedFaculty: [['Mathematics', [adviserTeacher, otherTeacher]]],
	});
}

/** The teacher card (the `div.rounded-xl` wrapper around the row) for a name. */
function cardFor(host: HTMLElement, nameFragment: string): HTMLElement | null {
	for (const row of Array.from(host.querySelectorAll('[data-testid="teaching-load-row-review"]'))) {
		const card = row.closest('div.rounded-xl') as HTMLElement | null;
		if (card && textOf(card).includes(nameFragment)) return card;
	}
	return null;
}

/* ═══════════════ R1 — the fix: the star gets the section's name ═══════════ */

test('R1 the Teaching Load card names the advisory section beside the adviser star', () => {
	const host = render(createElement(TeacherGridMode as any, gridPropsWith(ADVISER_TEACHER)));
	const card = cardFor(host, 'DELA CRUZ');
	assert.ok(card, 'the adviser teacher card must render');
	const line = card!.querySelector('[data-testid="adviser-section-line"]');
	assert.ok(line, 'the adviser star+words line must render on the card (base renders only the bare star)');
	assert.equal(textOf(line), 'Adviser: Rizal', 'the card must print the advisory section, exactly as the Teachers page does');
	assert.ok(line!.querySelector('svg'), 'the adviser star sits inside the line, beside the words');
	const nameRow = line!.parentElement as HTMLElement;
	assert.ok(nameRow.querySelector('h4'), 'the advisory words sit on the same inline row as the teacher name');
});

/* ═══════════════ R2 — the fallback word, identical to Teachers ═══════════ */

test('R2 with no section label the fallback word is exactly `Adviser` (Teachers-page parity)', () => {
	const host = render(createElement(TeacherGridMode as any, gridPropsWith(NULL_ADVISER_TEACHER)));
	const card = cardFor(host, 'DELA CRUZ');
	assert.ok(card, 'the adviser card must render');
	const line = card!.querySelector('[data-testid="adviser-section-line"]');
	assert.ok(line, 'the adviser line still renders for an adviser with no section label');
	assert.equal(textOf(line), 'Adviser', 'the fallback word is exactly `Adviser`, the same as the Teachers page');
});

/* ═══════════════ R3 — negative control: a non-adviser ═══════════ */

test('R3 a non-adviser card shows no adviser star and no advisory words', () => {
	const host = render(createElement(TeacherGridMode as any, gridPropsWith(NON_ADVISER_TEACHER, ADVISER_TEACHER)));
	const card = cardFor(host, 'ALCANTARA');
	assert.ok(card, 'the non-adviser card must render');
	assert.equal(
		card!.querySelector('[data-testid="adviser-section-line"]'),
		null,
		'a non-adviser must carry no adviser line (and therefore no adviser star)',
	);
	assert.ok(
		!/\bAdviser\b/.test(textOf(card)),
		`a non-adviser must carry no advisory words; the card reads ${JSON.stringify(textOf(card))}`,
	);
});

/* ═══════════════ R4 — one record, one string, one component ═══════════ */

test('R4 the same faculty record prints byte-equal advisory words on both surfaces, from ONE component', () => {
	const tlHost = render(createElement(TeacherGridMode as any, gridPropsWith(ADVISER_TEACHER)));
	const tlLine = cardFor(tlHost, 'DELA CRUZ')!.querySelector('[data-testid="adviser-section-line"]');

	const teachersHost = render(createElement(FacultyIdentityCell as any, { faculty: ADVISER_TEACHER }));
	const teachersLine = teachersHost.querySelector('[data-testid="adviser-section-line"]');

	assert.ok(tlLine && teachersLine, 'both the Teaching Load card and the Teachers roster render the shared adviser line');
	assert.equal(textOf(tlLine), textOf(teachersLine), 'both surfaces print the identical advisory string');
	assert.equal(textOf(tlLine), 'Adviser: Rizal');

	// The two surfaces must reference the ONE shared component, not two copies
	// that can drift. This is a structural control, not the acceptance evidence.
	for (const file of [
		'src/components/faculty/FacultyRow.tsx',
		'src/components/faculty-assignments/TeacherGridMode.tsx',
	]) {
		assert.match(
			readSource(file),
			/from '@\/components\/faculty-shared\/AdviserSectionLine'/,
			`${file} must render the shared AdviserSectionLine, not a local copy`,
		);
	}
});

/* ═══════════════ R5 — preservation: the star stays ═══════════════ */

test('R5 the class-adviser star stays on the adviser row', () => {
	const host = render(createElement(TeacherGridMode as any, gridPropsWith(ADVISER_TEACHER)));
	const card = cardFor(host, 'DELA CRUZ');
	assert.ok(card, 'the adviser card must render');
	assert.ok(card!.querySelector('svg'), 'the class-adviser star stays on an adviser row');
});
