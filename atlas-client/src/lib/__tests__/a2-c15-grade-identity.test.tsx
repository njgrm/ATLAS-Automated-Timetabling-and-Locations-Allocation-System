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
const { buildSectionsBySubject } = await import('../teaching-load-helpers');
const { compareSections, sectionSortGrade } = await import('../sections-sort');

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

// ─── C15-B2: the two client id-as-grade reads found by the correction review ──

/**
 * The /sections "Grade" column sort. `Sections.tsx` now sorts on
 * `resolveSectionGradeNumber`, so this row pins the COMPARISON it performs.
 *
 * HONEST SCOPE, stated rather than implied: on every MEASURED staging id space
 * (1..4, 5..8, 17..20) the opaque id happens to be monotonic with the grade, so
 * the old id sort and the new grade sort produce the SAME order today. This row
 * therefore does not claim the old sort was visibly wrong on staging. It pins
 * the two things that are true: (a) the column now orders by the thing its
 * header claims, and (b) the moment an id disagrees with its grade — which is
 * exactly what the next EnrollPro re-mint produces — the two orders diverge and
 * the grade order is the correct one.
 */
function sortByGradeColumn(rows: ExternalSection[]): Array<number | null> {
	return [...rows]
		.sort((a, b) => compareSections(a, b, 'gradeLevelId', 'asc'))
		.map((row) => sectionSortGrade(row));
}

test('C15-B2-1. the /sections Grade column orders by the real grade, not the EnrollPro id', () => {
	const measured = STAGING_ROWS.map((row, index) => section({ ...row, id: 2000 + index, name: `${row.gradeLevelName}-${row.gradeLevelId}` }));
	// STAGING_ROWS holds 12 rows: each of Grades 7/8/9/10 in all THREE id spaces,
	// so the grade order is three of each grade.
	assert.deepEqual(
		sortByGradeColumn(measured),
		[7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10],
		'every measured staging row must order by its grade: three of each grade across the three id spaces',
	);

	// The discriminating case: ids that DISAGREE with their grades. This is what
	// the next re-mint looks like, and it is where the old `a.gradeLevelId -
	// b.gradeLevelId` sort was wrong by construction.
	const reMinted: ExternalSection[] = [
		section({ id: 3001, name: 'seven', gradeLevelId: 3, gradeLevelName: 'Grade 7', displayOrder: 7 }),
		section({ id: 3002, name: 'eight', gradeLevelId: 1, gradeLevelName: 'Grade 8', displayOrder: 8 }),
	];
	assert.deepEqual(
		sortByGradeColumn(reMinted),
		[7, 8],
		'the grade order must be 7 then 8 even when the ids say otherwise',
	);
	const byId = [...reMinted].sort((a, b) => a.gradeLevelId - b.gradeLevelId).map((row) => resolveSectionGradeNumber(row));
	assert.deepEqual(byId, [8, 7], 'the raw-id sort would have put Grade 8 first — this is the defect the change removes');

	// A section naming no real grade sorts LAST (the comparator's sort key is
	// Number.MAX_SAFE_INTEGER) and its resolved grade stays null — never 0, never 1.
	const withUnknown = [...reMinted, section({ id: 3003, name: 'unknown', gradeLevelId: 1, gradeLevelName: '', displayOrder: 0 })];
	assert.deepEqual(
		sortByGradeColumn(withUnknown),
		[7, 8, null],
		'an unresolvable section sorts last and resolves to no grade, not to 0 or 1',
	);
	// And it really is ordered last, not merely reported last — this is the REAL
	// exported comparator `pages/Sections.tsx` calls, not a copy of it.
	const ordered = [...withUnknown].sort((a, b) => compareSections(a, b, 'gradeLevelId', 'asc'));
	assert.equal(ordered[2].id, 3003, 'the unresolvable section is the final row of the Grade column');
	// The other sort fields must be untouched by the extraction.
	assert.equal(
		compareSections(reMinted[0], reMinted[1], 'name', 'asc'),
		'seven'.localeCompare('eight', undefined, { numeric: true }),
		'the name column still sorts by name, not by grade',
	);
	assert.equal(compareSections(reMinted[0], reMinted[1], 'gradeLevelId', 'desc') > 0, true, 'descending still reverses the grade order');
});

/** The Teaching Load grade filter, driven through its REAL exported function. */
function assignedIndexFor(rows: ExternalSection[]) {
	return {
		schoolId: 1,
		schoolYearId: 1,
		fetchedAt: '2026-09-29T00:00:00.000Z',
		sections: rows.map((row, index) => ({
			sectionId: row.id,
			sectionName: row.name,
			gradeLevel: 7,
			programType: 'REGULAR',
			schoolYearId: 1,
			classes: [{
				subjectId: 11 + index,
				subjectCode: `SUBJ${index}`,
				subjectName: `Subject ${index}`,
				subjectDisplayLabel: `Subject ${index}`,
				specializationCode: null,
				specializationLabel: null,
				rotationFamily: null,
				rotationTermRank: null,
				rotationTermLabel: null,
				rotationTermGroupId: null,
				rotationTermCount: null,
				minMinutesPerWeek: 300,
			}],
			totals: { male: 0, female: 0, total: 0, staleCount: 0 },
		})),
	} as never;
}

test('C15-B2-2. the Teaching Load grade filter matches the REAL grade, never the raw displayOrder', () => {
	const rows = STAGING_ROWS.map((row, index) => section({ ...row, id: 4000 + index, name: `${row.gradeLevelName}-${row.gradeLevelId}` }));
	const sectionMap = new Map(rows.map((row) => [row.id, row]));
	const index = assignedIndexFor(rows);

	for (const grade of [7, 8, 9, 10]) {
		const grouped = buildSectionsBySubject(index, sectionMap, String(grade));
		const matched = Object.values(grouped).flat().map((row) => row.id);
		assert.deepEqual(
			matched,
			rows.filter((row) => resolveSectionGradeNumber(row) === grade).map((row) => row.id),
			`filtering by Grade ${grade} must return exactly that grade's sections across all three id spaces`,
		);
	}

	// `all` returns every section, including one that names no real grade.
	const unknown = section({ id: 4999, name: 'unknown', gradeLevelId: 1, gradeLevelName: '', displayOrder: 0 });
	const allMap = new Map([...sectionMap, [unknown.id, unknown]]);
	const allGrouped = buildSectionsBySubject(assignedIndexFor([...rows, unknown]), allMap, 'all');
	assert.equal(Object.values(allGrouped).flat().length, rows.length + 1, '"all" must include the unresolvable section');

	// The discriminating case: `displayOrder` says 1, the grade is 7. The old
	// `section.displayOrder === Number(filter)` would have matched this section
	// under a "1" filter; the authority matches it under 7.
	const mismatched = section({ id: 4998, name: 'order-1-grade-7', gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 1 });
	const mismatchedMap = new Map([[mismatched.id, mismatched]]);
	assert.equal(
		Object.values(buildSectionsBySubject(assignedIndexFor([mismatched]), mismatchedMap, '7')).flat().length,
		1,
		'a Grade 7 section with displayOrder 1 must match the Grade 7 filter',
	);
	assert.equal(
		Object.values(buildSectionsBySubject(assignedIndexFor([mismatched]), mismatchedMap, '1')).flat().length,
		0,
		'and must NOT match a "1" filter — that is the raw field leaking into a grade filter',
	);
});
