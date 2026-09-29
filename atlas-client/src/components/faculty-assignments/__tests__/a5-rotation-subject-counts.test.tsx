/**
 * A5 (2026-09-30) — rotation-aware subject counts, RENDERED per edited site.
 *
 * The rule itself is pinned in `src/lib/__tests__/rotation-subject-count.test.ts`.
 * This file proves each of the four CLIENT surfaces actually shows the collapsed
 * number, by mounting the real component in real JSDOM and reading the produced
 * markup — a source-text assertion would pass while a call site stayed on
 * `.length`.
 *
 * Sites exercised:
 *   1. Subjects header tiles           `useSubjectStats` (driven through a probe)
 *   2. Teaching Load section grid      `SectionGridMode` ("Grade G • N Subjects")
 *   3. Teaching Load other subjects    `TeacherGridMode` ("Show other subjects (N)")
 *   4. Teachers profile stat           `FacultyProfileSheet` ("Subjects")
 *
 * The JSDOM bootstrap and `render` helper are copied from the accepted siblings
 * `a6-c6-calm-teaching-load.test.tsx` / `a3-c17-teacher-profile.test.tsx`, so the
 * three files behave identically and a reviewer can diff them.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

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
	SVGElement: dom.window.SVGElement,
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
const { useSubjectStats } = await import('@/components/subjects/useSubjectStats');
const { SectionGridMode } = await import('@/components/faculty-assignments/SectionGridMode');
const { TeacherGridMode } = await import('@/components/faculty-assignments/TeacherGridMode');
const { FacultyProfileSheet } = await import('@/components/faculty/FacultyProfileSheet');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
});

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(
			createElement(
				MemoryRouter as any,
				{ initialEntries: ['/teaching-load'] },
				createElement(TooltipProvider as any, { delayDuration: 200 }, node),
			),
		);
	});
	return host;
}

const textOf = (node: Element | Document | null | undefined) =>
	(node?.textContent ?? '').replace(/\s+/g, ' ').trim();

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/* ─────────────────────────── fixtures ─────────────────────────── */

/** A subject row shaped like the real `Subject`, minimal-but-complete enough
 *  for the three components to render their header lines. */
function subject(over: Record<string, unknown> = {}) {
	return {
		id: 1,
		schoolId: 1,
		code: 'SCI_BIO',
		name: 'Science - Biology',
		isActive: true,
		isSeedable: false,
		preferredRoomType: 'CLASSROOM',
		requiredFeatures: [],
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		interSectionEnabled: false,
		interSectionGradeLevels: [],
		allowedSpecializations: [],
		minMinutesPerWeek: 225,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		rotationFamily: null,
		termGroupId: null,
		createdAt: '2026-09-30T00:00:00.000Z',
		updatedAt: '2026-09-30T00:00:00.000Z',
		...over,
	} as any;
}

const SCIENCE = [
	subject({ id: 11, code: 'SCI_BIO', termGroupId: 'SCIENCE', rotationFamily: 'SCIENCE', preferredRoomType: 'LABORATORY' }),
	subject({ id: 12, code: 'SCI_CHEM', termGroupId: 'SCIENCE', rotationFamily: 'SCIENCE', preferredRoomType: 'LABORATORY' }),
	subject({ id: 13, code: 'SCI_ES', termGroupId: 'SCIENCE', rotationFamily: 'SCIENCE', preferredRoomType: 'LABORATORY' }),
];
const TLE = [
	subject({ id: 21, code: 'TLE_AFA_EXP', termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'TLE' }),
	subject({ id: 22, code: 'TLE_FCS_EXP', termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'TLE' }),
	subject({ id: 23, code: 'TLE_ICT_EXP', termGroupId: 'TLE_EXPLORATORY', rotationFamily: 'TLE' }),
];
const STANDALONE = [
	subject({ id: 31, code: 'MATH', termGroupId: null, rotationFamily: null }),
	subject({ id: 32, code: 'FIL', termGroupId: null, rotationFamily: null }),
];
const ALL_SUBJECTS = [...SCIENCE, ...TLE, ...STANDALONE];

const TEACHER: any = {
	id: 9, firstName: 'Maria', lastName: 'Dela Cruz',
	department: 'Mathematics', departmentLabel: 'Mathematics', departmentCode: 'MATH',
	employmentStatus: 'REGULAR', employeeId: 'EMP-0009',
	isActiveForScheduling: true, isClassAdviser: false, isPlaceholder: false,
	maxHoursPerWeek: 40, policyCreditedHours: 24, sectionTeachingHours: 20,
	actualTeachingHours: 20, subjectCount: 4, sectionCount: 1,
	advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0,
	advisedSectionName: null, version: 1, assignments: [],
};

/* ─────────────────── Site 1: Subjects header tiles ─────────────────── */

/** A probe that renders `useSubjectStats`'s tiles, so the hook's numbers are
 *  read off real markup rather than a direct call. */
function StatsProbe({ subjects, coverageVerdictBySubjectId }: any) {
	const stats = useSubjectStats({ subjects, coverageBySubjectId: null, coverageVerdictBySubjectId });
	return createElement(
		'div',
		null,
		stats.map((tile: any) =>
			createElement(
				'span',
				{ key: tile.label, 'data-tile': tile.label },
				typeof tile.value === 'number' ? String(tile.value) : 'pending',
			),
		),
	);
}

test('A5-RSC-1 Subjects tiles collapse a rotation family to one subject', () => {
	// All three Science term rows are at risk; TLE and the two standalone are covered.
	const verdicts = new Map<number, any>([
		[11, { fullyCoveredByRealTeachers: false, label: 'Needs a teacher' }],
		[12, { fullyCoveredByRealTeachers: false, label: 'Needs a teacher' }],
		[13, { fullyCoveredByRealTeachers: false, label: 'Needs a teacher' }],
		[21, { fullyCoveredByRealTeachers: true, label: 'Covered' }],
		[22, { fullyCoveredByRealTeachers: true, label: 'Covered' }],
		[23, { fullyCoveredByRealTeachers: true, label: 'Covered' }],
		[31, { fullyCoveredByRealTeachers: true, label: 'Covered' }],
		[32, { fullyCoveredByRealTeachers: true, label: 'Covered' }],
	]);
	const host = render(createElement(StatsProbe, { subjects: ALL_SUBJECTS, coverageVerdictBySubjectId: verdicts }));

	assert.equal(
		textOf(host.querySelector('[data-tile="Active subjects"]')),
		'4',
		'Active subjects must read FOUR (Science + TLE + 2 standalone), not 8',
	);
	assert.equal(
		textOf(host.querySelector('[data-tile="Missing coverage"]')),
		'1',
		'the Science family has a coverage gap and must read as ONE, not three',
	);
	assert.equal(
		textOf(host.querySelector('[data-tile="Room constrained"]')),
		'1',
		'the Science family needs a lab and must read as ONE constrained subject',
	);
});

/* ─────────────────── Site 2: TL section grid ─────────────────── */

function sectionProps(overrides: Record<string, any> = {}) {
	const sectionsBySubject: Record<number, any[]> = {};
	const ownership: Record<string, any> = {};
	for (const s of ALL_SUBJECTS) {
		sectionsBySubject[s.id] = [{ id: 101, name: '7-Rizal', programCode: 'REG', displayOrder: 7, isSpecialProgram: false }];
		ownership[`${s.id}:101`] = { facultyId: 9, isPending: false };
	}
	return {
		loading: false,
		subjects: ALL_SUBJECTS,
		sectionsBySubject,
		faculty: [TEACHER],
		effectiveOwnershipMap: ownership,
		onSetSections: () => {}, saving: false, isReadOnlyMode: false,
		activeFacultyIds: new Set<number>([9]), sectionModeFilter: 'all',
		onSectionModeFilterChange: () => {}, effectiveAssignmentsByFaculty: { 9: [] },
		selectedSectionId: null, onSelectSection: () => {},
		workspaceStateLabel: 'Ready', workspaceStateNextAction: 'x', writeBlockedReason: null,
		teachingStandardHours: 20, completedSectionIds: new Set<number>(),
		...overrides,
	};
}

test('A5-RSC-2 TL section grid reads "4 Subjects", not the raw catalogue total', () => {
	const host = render(createElement(SectionGridMode as any, sectionProps()));
	const line = textOf(host.querySelector('p'));
	assert.match(
		line,
		/Grade 7 • 4 Subjects/,
		'the section header must read FOUR subjects for Science(3)+TLE(3)+2 standalone',
	);
	assert.equal(line.includes('8 Subjects'), false, 'the raw catalogue total (8) must not be shown');

	const body = textOf(host);
	assert.match(body, /4 \/ 4/, 'the staffed fraction must collapse to 4 / 4, never 8 / 8');
	assert.equal(body.includes('/ 8'), false, 'a raw / 8 denominator must not survive');
});

/* ─────────────────── Site 3: TL "Show other subjects (N)" ─────────────────── */

function gridProps(overrides: Record<string, any> = {}) {
	return {
		loading: false,
		faculty: [TEACHER],
		filteredFaculty: [TEACHER],
		groupedFaculty: [['Mathematics', [TEACHER]]],
		selectedId: null,
		onSelectTeacher: () => {},
		effectiveAssignmentsByFaculty: { 9: [] },
		effectiveDraftAssignmentsByFaculty: {},
		subjects: [], sectionsBySubject: {},
		saving: false, isReadOnlyMode: false,
		effectiveOwnershipMap: {}, savedConflictMap: {},
		onSetSections: () => {}, onSwapSectionOwnership: () => {},
		departmentQualifiedSubjects: [],
		outsideDepartmentSubjects: [...SCIENCE, ...TLE],
		homeroomHint: null,
		loadProfile: null,
		onHoverLoadMinutes: () => {}, onClearHoverLoad: () => {},
		activeFacultyIds: new Set<number>([9]),
		resolveSectionHoverDeltaMinutes: () => 0,
		onResetAssignments: () => {},
		searchQuery: '', onSearchQueryChange: () => {},
		filterStatus: 'all', onFilterStatusChange: () => {},
		statusFacetCounts: { all: 1, 'teaching-assigned': 1, 'no-teaching': 0, 'adviser-only': 0, excess: 0 },
		loadFilter: 'all', loadFacetCounts: { excess: 0, 'at-standard': 1, 'below-standard': 0 },
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

test('A5-RSC-3 TL "Show other subjects (N)" collapses the outside-department family', () => {
	const host = render(createElement(TeacherGridMode as any, gridProps()));
	// The outside-department control lives inside the per-teacher assignment editor,
	// so open the editor first (the real operator path).
	const edit = Array.from(host.querySelectorAll('button')).find((b) => textOf(b) === 'Edit assignments');
	assert.ok(edit, 'the "Edit assignments" control must render as a precondition');
	click(edit!);

	const control = host.querySelector('[data-testid="teaching-load-show-other-subjects"]');
	assert.ok(control, 'the outside-department control must render once the editor is open');
	assert.equal(
		textOf(control),
		'Show other subjects (2)',
		'Science(3)+TLE(3) outside the department must read as TWO subjects, not six',
	);
});

/* ─────────────────── Site 4: Teachers profile stat ─────────────────── */

function facultySummary(over: Record<string, unknown> = {}) {
	return {
		...TEACHER,
		// The server scalar still says SIX (one per catalogue row); the tile must ignore it.
		subjectCount: 6,
		assignments: [...SCIENCE, ...TLE].map((s, index) => ({
			id: 200 + index,
			subjectId: s.id,
			gradeLevels: [7],
			sectionIds: [101],
			sections: [],
			subject: { id: s.id, name: s.name, code: s.code, minMinutesPerWeek: 225, rotationFamily: s.rotationFamily, termGroupId: s.termGroupId },
		})),
		...over,
	} as any;
}

test('A5-RSC-4 Teachers profile "Subjects" stat is rotation-aware', () => {
	render(
		createElement(FacultyProfileSheet as any, {
			faculty: facultySummary(),
			open: true,
			onOpenChange: () => {},
			sourceFreshness: 'Roster checked against EnrollPro',
		}),
	);
	// Radix dialogues portal onto document.body, not the render host.
	const dialog = dom.window.document.body.querySelector('[data-testid="faculty-profile-dialog"]');
	assert.ok(dialog, 'the profile dialog did not mount');
	const label = Array.from(dialog!.querySelectorAll('p')).find((p) => textOf(p) === 'Subjects');
	assert.ok(label, 'the "Subjects" stat label must render');
	const value = label!.closest('div')!.querySelector('p.text-2xl');
	assert.equal(
		textOf(value),
		'2',
		'the Subjects stat must collapse Science(3)+TLE(3) to TWO, not the server scalar 6',
	);
});
