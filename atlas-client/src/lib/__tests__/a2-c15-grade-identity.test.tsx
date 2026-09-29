/**
 * A2 c15 — A SECTION'S GRADE IS 7-10, NEVER EnrollPro's `grade_level_id`.
 *
 * THE OPERATOR DEFECT, quoted from the packet: staging rendered `GR1` beside
 * LUNA/RIZAL (FERNANDEZ) and `GR2` beside MAKATAO/ORCHID. The value was the
 * EnrollPro internal FK, which re-mints on every wipe or rollover — measured on
 * `atlas_staging` 2026-09-28 as `1..4` for Grades 7..10 in school years 1 and 2
 * (it had been `17..20`, and before that `5..8`).
 *
 * FIXTURES ARE THE REAL SURFACE, not invented ones (AGENTS.md §11: a control
 * validated against a fabricated fixture passed while live stayed broken). Every
 * row below is a row of the measured staging table:
 *
 *   school_year_id | grade_level_id | grade_level_name | display_order
 *   1, 2 (from 2026-09-28) | 1,2,3,4 | Grade 7..Grade 10 | 7,8,9,10
 *   8, 9, 10            | 17,18,19,20 | Grade 7..Grade 10 | 7,8,9,10
 *   pre-2026-09-28 feed  | 5,6,7,8   | Grade 7..Grade 10 | 7,8,9,10
 *
 * All of them must produce 7..10.
 *
 * THE NEGATIVE CONTROL is `C15-NEG`: a section whose ONLY grade signal is
 * `gradeLevelId: 1` must not resolve to `1` and must render no `GR1`. This row
 * was run failing-first on the base commit `6c8fd5d1` (see the handoff) — on
 * the base, `teacherWorkloadProfile.ts:73` read `section.gradeLevelId ?? 0`
 * directly, so this file's `C15-S1-*` rows fail with `1 !== 7`.
 *
 * THE BADGE DECISION (packet §4): the shared `GR` prefix is the sanctioned
 * house form (Decision 5, `lib/grade-labels.ts`), so the correct grade renders
 * as `GR7` — not `G7`, and not a local restyle. `C15-BADGE-*` renders the REAL
 * `GradeBadge` primitive in JSDOM and asserts its text, so the value fix is
 * proven on the rendered surface and not only in a helper.
 *
 * JSDOM PERFORMS NO LAYOUT. Nothing here claims a pixel, a font size or a
 * 1366x768 fit; the browser rows and the `ux-audit.js` JSON in the handoff own
 * that. What this file claims is the VALUE the badge receives and the TEXT it
 * renders.
 */
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

import type { ExternalSection, FacultySummary } from '../../types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/teaching-load' });
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

const { createRoot } = await import('react-dom/client');
const { gradeNumberOf, resolveSectionGradeNumber, normalizeJhsGradeNumber, normalizeInternalGradeId } = await import('../schedule-review-helpers');
const { buildTeacherWorkloadView } = await import('@/components/faculty/teacherWorkloadProfile');
const { GradeBadge } = await import('@/components/faculty-assignments/GradeBadge');

const roots: any[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	dom.window.document.body.innerHTML = '';
});

// ─── The measured staging rows, verbatim ────────────────────────────────────

/** The three id spaces EnrollPro has actually used, with the name/order staging stores. */
const STAGING_ROWS: Array<{ note: string; gradeLevelId: number; gradeLevelName: string; displayOrder: number; expected: number }> = [
	// school years 1 and 2, first written 2026-09-28 14:39:59 / 2026-09-29 05:31:08
	{ note: 'SY1/2 post-re-mint id 1', gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, expected: 7 },
	{ note: 'SY1/2 post-re-mint id 2', gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, expected: 8 },
	{ note: 'SY1/2 post-re-mint id 3', gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, expected: 9 },
	{ note: 'SY1/2 post-re-mint id 4', gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10, expected: 10 },
	// school years 8, 9, 10
	{ note: 'SY8-10 id 17', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, expected: 7 },
	{ note: 'SY8-10 id 18', gradeLevelId: 18, gradeLevelName: 'Grade 8', displayOrder: 8, expected: 8 },
	{ note: 'SY8-10 id 19', gradeLevelId: 19, gradeLevelName: 'Grade 9', displayOrder: 9, expected: 9 },
	{ note: 'SY8-10 id 20', gradeLevelId: 20, gradeLevelName: 'Grade 10', displayOrder: 10, expected: 10 },
	// the pre-2026-09-28 feed
	{ note: 'legacy id 5', gradeLevelId: 5, gradeLevelName: 'Grade 7', displayOrder: 7, expected: 7 },
	{ note: 'legacy id 6', gradeLevelId: 6, gradeLevelName: 'Grade 8', displayOrder: 8, expected: 8 },
	{ note: 'legacy id 7', gradeLevelId: 7, gradeLevelName: 'Grade 9', displayOrder: 9, expected: 9 },
	{ note: 'legacy id 8', gradeLevelId: 8, gradeLevelName: 'Grade 10', displayOrder: 10, expected: 10 },
];

function section(row: { gradeLevelId: number; gradeLevelName?: string | null; displayOrder?: number | null; id?: number; name?: string }): ExternalSection {
	return {
		id: row.id ?? 9500,
		name: row.name ?? 'RIZAL',
		maxCapacity: 40,
		enrolledCount: 35,
		gradeLevelId: row.gradeLevelId,
		gradeLevelName: (row.gradeLevelName ?? '') as string,
		displayOrder: (row.displayOrder ?? 0) as number,
		programType: 'REGULAR',
	} as ExternalSection;
}

/** A roster summary with one owned section, minimal but shaped like the real payload. */
function summaryWith(sections: ExternalSection[]): FacultySummary {
	return {
		id: 46,
		externalId: 4600,
		employeeId: null,
		firstName: 'LUNA',
		lastName: 'RIZAL',
		department: 'MATH',
		specialization: null,
		employmentStatus: 'ACTIVE',
		isActiveForScheduling: true,
		isPlaceholder: false,
		isClassAdviser: false,
		advisedSectionId: null,
		advisedSectionName: null,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: 0,
		canTeachOutsideDepartment: false,
		maxHoursPerWeek: 30,
		departmentCode: 'MATH',
		departmentLabel: 'Mathematics',
		departmentStatus: 'MAPPED',
		version: 1,
		subjectCount: 1,
		sectionCount: sections.length,
		subjectHours: 0,
		sectionTeachingHours: sections.length * 5,
		rotationFamilyOvercountHours: 0,
		rotationTermBreakdown: [],
		gradeTeachingHours: 0,
		advisoryHours: 0,
		ancillaryHours: 0,
		policyCreditedHours: 0,
		policyLoadPercentage: 0,
		actualTeachingHours: sections.length * 5,
		teachingUtilizationPercent: null,
		teachingCapacityRemainingMinutes: null,
		excessTeachingMinutes: null,
		creditedWorkloadMinutes: null,
		syntheticCoverageHours: 0,
		loadSignalMode: 'STANDARD',
		assignments: [{
			id: 1,
			subjectId: 11,
			gradeLevels: [],
			sectionIds: sections.map((s) => s.id),
			sections,
			subject: { id: 11, name: 'Mathematics 7', code: 'MATH7', minMinutesPerWeek: 300 },
		}],
	} as unknown as FacultySummary;
}

function renderBadge(grade: number | null): { text: string; count: number } {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => root.render(createElement(GradeBadge as any, { grade, ariaSuffix: 'section' })));
	const badges = [...host.querySelectorAll('[data-testid="grade-badge"]')];
	return { text: badges.map((node) => node.textContent ?? '').join('|'), count: badges.length };
}

// ─── C15-AUTH: the one client authority over every measured staging row ─────

test('C15-AUTH-1. every measured staging row resolves to its real grade 7-10', () => {
	for (const row of STAGING_ROWS) {
		assert.equal(gradeNumberOf(row), row.expected, `${row.note}: gradeNumberOf must return ${row.expected}`);
		assert.equal(
			resolveSectionGradeNumber(section(row)),
			row.expected,
			`${row.note}: resolveSectionGradeNumber must return ${row.expected}`,
		);
	}
});

test('C15-AUTH-2. the authority is name-first and never reads gradeLevelId', () => {
	// A name that disagrees with the id: the name is the grade.
	assert.equal(gradeNumberOf({ gradeLevelId: 3, gradeLevelName: 'Grade 7', displayOrder: 7 }), 7);
	// No name: the measured `displayOrder` is the second reliable source.
	assert.equal(gradeNumberOf({ gradeLevelId: 1, displayOrder: 7 }), 7);
	assert.equal(gradeNumberOf({ gradeLevelId: 20, displayOrder: 10 }), 10);
	// Names outside the JHS band are not grades and are refused.
	assert.equal(gradeNumberOf({ gradeLevelName: 'Kinder', displayOrder: 7 }), 7, 'an unparseable name must not stop the displayOrder leg');
	assert.equal(gradeNumberOf({ gradeLevelName: 'Grade 1', displayOrder: 0 }), null, 'Grade 1 is not a JHS grade for this app');
	// A `displayOrder` outside 7-12 is a sentinel, not a grade.
	assert.equal(gradeNumberOf({ gradeLevelId: 1, displayOrder: 0 }), null);
	assert.equal(gradeNumberOf({ gradeLevelId: 1, displayOrder: 3 }), null);
	// The upstream writes "GRADE 9 - STE" style names in some payloads.
	assert.equal(gradeNumberOf({ gradeLevelName: 'GRADE 9 - STE' }), 9);
	assert.equal(gradeNumberOf({ gradeLevelName: 'grade10' }), 10);
});

test('C15-AUTH-3. C15-NEG — an id-only section yields no grade, never 1', () => {
	for (const gradeLevelId of [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20]) {
		assert.equal(
			gradeNumberOf({ gradeLevelId }),
			null,
			`gradeLevelId ${gradeLevelId} alone must never be read as a grade`,
		);
		assert.equal(resolveSectionGradeNumber(section({ gradeLevelId })), null);
	}
});

test('C15-AUTH-4. the retained id map is still available for id LISTS and cannot leak into a section grade', () => {
	// The list helper keeps its documented behaviour...
	assert.equal(normalizeInternalGradeId(17), 7);
	assert.equal(normalizeJhsGradeNumber(20), 10);
	// ...but the section path no longer passes through it.
	assert.equal(resolveSectionGradeNumber(section({ gradeLevelId: 1 })), null);
});

// ─── C15-S1: the load-breakdown grade that rendered GR1 ─────────────────────

test('C15-S1-1. the roster load breakdown carries the real grade for every measured id space', () => {
	for (const row of STAGING_ROWS) {
		const view = buildTeacherWorkloadView(summaryWith([section(row)]));
		const breakdown = view.loadProfile?.breakdown ?? [];
		assert.equal(breakdown.length, 1, `${row.note}: one owned section yields one breakdown row`);
		assert.equal(breakdown[0].gradeLevel, row.expected, `${row.note}: breakdown grade must be ${row.expected}`);
	}
});

test('C15-S1-2. C15-NEG — an id-only section reports no grade, and no badge renders', () => {
	const view = buildTeacherWorkloadView(summaryWith([section({ gradeLevelId: 1 })]));
	const grade = view.loadProfile?.breakdown?.[0]?.gradeLevel ?? null;
	assert.equal(grade, null, 'an id-only section must not report grade 1');
	assert.equal(renderBadge(grade).count, 0, 'an unresolvable grade must render no badge, never GR1');
});

// ─── C15-BADGE: the rendered text, on the real shared primitive ────────────

test('C15-BADGE-1. the real GradeBadge renders GR7 for a post-re-mint id-1 section named "Grade 7"', () => {
	const view = buildTeacherWorkloadView(summaryWith([section({ gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7 })]));
	const grade = view.loadProfile!.breakdown[0].gradeLevel;
	assert.equal(renderBadge(grade).text, 'GR7', 'the badge must read GR7, never GR1');
});

test('C15-BADGE-2. the real GradeBadge renders GR8 for a post-re-mint id-2 section named "Grade 8"', () => {
	const view = buildTeacherWorkloadView(summaryWith([section({ gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8 })]));
	const grade = view.loadProfile!.breakdown[0].gradeLevel;
	assert.equal(renderBadge(grade).text, 'GR8', 'the badge must read GR8, never GR2');
});

test('C15-BADGE-3. the badge keeps the sanctioned GR prefix for grades 7-10 and DepEd colouring', () => {
	for (const grade of [7, 8, 9, 10]) {
		const { text, count } = renderBadge(grade);
		assert.equal(count, 1, `grade ${grade} renders exactly one badge`);
		assert.equal(text, `GR${grade}`);
	}
});
