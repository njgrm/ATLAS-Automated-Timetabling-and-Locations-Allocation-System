/**
 * A3 C17 — the Teachers profile / to-be-hired identity rows, as RENDERED
 * evidence plus two pure-function controls.
 *
 * ============================ WHAT THIS IS, AND IS NOT =====================
 *
 * Rows 1, 2, 3, 4, 6 and 7 are things a scheduler SEES, so they are decided
 * here by mounting the real component and reading the real rendered text. A
 * source-text assertion cannot decide them: it would pass unchanged if the
 * component kept the old markup in a branch no test mounted, or if the grade
 * group were built and then not rendered. Every row below therefore reads the
 * DOM.
 *
 * JSDOM performs NO LAYOUT and applies NO Tailwind. Stated rather than
 * papered over: nothing here claims a pixel width, a wrap, or a computed
 * font-size. Row 6's floor is checked against the class CONTRACT the component
 * emits, which is a floor and not a rendered measurement; row 7's resize
 * behaviour is a class contract too, and the drag proof is the planner's
 * (AGENTS.md "Done means seen").
 *
 * ============================== THE CONTROLS ==============================
 *
 * A3C17-1   two grades of one subject render as two grade boxes, every section
 *           name present (the operator's example: MAPEH -> Grade 7 with five
 *           sections, Grade 8 with three).
 * A3C17-1N  NEGATIVE CONTROL: a section carrying a junk `gradeLevelId` that the
 *           authority cannot resolve renders NO `GR1` and no invented grade. This
 *           is the control that makes 1 discriminate — it is the exact defect
 *           the row exists to remove, because EnrollPro re-mints `grade_level_id`
 *           and reading it as a grade rendered `GR1`.
 * A3C17-1M  MUTANT: the same junk section DOES render `GR1` when the internal id
 *           is read directly, so the negative control is a real failure and not
 *           a fixture that happens to be unresolvable.
 * A3C17-2   the subject total equals sections x `minMinutesPerWeek` at the
 *           badge's own one-decimal precision, and "each" appears only above one
 *           section.
 * A3C17-3   a placeholder header shows `To be hired`, no `ID-PENDING`, no
 *           `Active teacher`; a real teacher with no `employeeId` shows neither
 *           a code chip nor `To be hired`; a real teacher with one keeps `#id`.
 * A3C17-4   `formatFacultyDisplayName` reads "To be hired: …" for the STORED
 *           sentinel, `formatFacultyStoredName` / `teacherNameSortKey` still
 *           return the stored casing (search and sort safety), and initials
 *           stay two-or-one characters rather than six words.
 * A3C17-5   with a roster whose saved maximum is 32, the helper states 32 and
 *           not 40h; the counted set wins over the roster-wide maximum; an
 *           empty roster falls back to the policy constant.
 * A3C17-6   no `text-[0.7rem]` / `text-[0.65rem]` remains in the profile file,
 *           and no arbitrary sub-14px font size survives in it.
 * A3C17-7   the workload modal's own className carries no `max-w-` cap, so the
 *           SHARED `DIALOG_RESIZABLE_CLASSES` bounds govern the drag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teachers',
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
	HTMLCollection: dom.window.HTMLCollection,
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
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
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
const { DIALOG_RESIZABLE_CLASSES } = await import('@/ui/dialog');
const { FacultyProfileSheet } = await import('@/components/faculty/FacultyProfileSheet');
const {
	formatFacultyDisplayName,
	formatFacultyStoredName,
	formatFacultyInitials,
	teacherNameSortKey,
	isPlaceholderSentinelName,
} = await import('@/components/faculty/teacherNameDisplay');
const { resolveSectionGradeNumber } = await import('@/lib/schedule-review-helpers');
const { MAX_WEEKLY_TEACHING_HOURS } = await import('@/lib/faculty-assignment-helpers');
const { overCapChipHelper, overCapWeeklyMaxHours } = await import('@/pages/Faculty');

// This file lives at `src/components/faculty/__tests__/`, so `src/` is three
// levels up. A row that reads source resolves against THIS, and a wrong depth
// silently becomes an ENOENT that looks like a missing file rather than a wrong
// base — which is how a class-contract row can quietly stop testing anything.
const SRC_ROOT = new URL('../../../', import.meta.url);
const readSource = (rel: string) => readFileSync(new URL(rel, SRC_ROOT), 'utf8');

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
				{ initialEntries: ['/teachers'] },
				createElement(TooltipProvider as any, { delayDuration: 200 }, node),
			),
		);
	});
	return host;
}

/** The visible text of a scope, whitespace-collapsed. */
function textOf(scope: ParentNode): string {
	return (scope.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A section shaped like the real `ExternalSection` the roster reads. */
function section(over: Partial<Record<string, unknown>> = {}) {
	return {
		id: 1,
		name: 'Luna',
		maxCapacity: 40,
		enrolledCount: 30,
		gradeLevelId: 1,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		...over,
	} as any;
}

function assignment(over: Record<string, unknown> = {}) {
	return {
		id: 100,
		subjectId: 5,
		gradeLevels: [],
		sectionIds: [],
		sections: [],
		subject: {
			id: 5,
			name: 'MAPEH',
			code: 'MAPEH',
			minMinutesPerWeek: 225,
		},
		...over,
	} as any;
}

function faculty(over: Record<string, unknown> = {}) {
	return {
		id: 46,
		firstName: 'Roberto',
		lastName: 'Alcantara',
		department: 'MATH',
		employmentStatus: 'Permanent',
		employeeId: 'T-0046',
		isActiveForScheduling: true,
		isClassAdviser: false,
		isPlaceholder: false,
		advisedSectionName: null,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: 0,
		sectionTeachingHours: 30,
		policyCreditedHours: 30,
		maxHoursPerWeek: 40,
		subjectCount: 1,
		sectionCount: 1,
		assignments: [],
		...over,
	} as any;
}

/**
 * Mount the real profile dialog and return its host.
 *
 * The dialog is queried from `document.body`, NOT from the render host: Radix
 * `DialogContent` renders through a PORTAL, so a host-scoped query finds an
 * empty container while the dialog is plainly on the page. That is a harness
 * fact, and getting it wrong looks exactly like "the component renders nothing".
 */
function renderProfile(summary: any): HTMLElement {
	// Unmount anything already on the page FIRST. Radix portals the dialog into
	// `document.body`, so a second render leaves TWO dialogs there and a
	// `querySelector` silently returns the FIRST one — the previous test's
	// teacher. Every assertion after the first would then be reading stale DOM,
	// which is the worst kind of green.
	for (const root of roots.splice(0)) act(() => root.unmount());
	dom.window.document.body.innerHTML = '';

	const host = render(
		createElement(FacultyProfileSheet as any, {
			faculty: summary,
			open: true,
			onOpenChange: () => {},
			sourceFreshness: 'Roster checked against EnrollPro',
		}),
	);
	const dialog = dom.window.document.body.querySelector('[data-testid="faculty-profile-dialog"]');
	assert.ok(dialog, 'the profile dialog did not mount');
	return dialog as unknown as HTMLElement;
}

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-1 / 1N / 1M — grade grouping, and the negative control that makes it
// a control at all.
// ═══════════════════════════════════════════════════════════════════════════

test('A3C17-1 two grades of one subject render as two grade boxes with every section name present', () => {
	// The operator's own example, verbatim in shape: MAPEH -> Grade 7 with
	// Aguinaldo, Bonifacio, Luna, Mabini, Rizal; Grade 8 with Maka-Diyos,
	// Makakalikasan, Makatao.
	const dialog = renderProfile(
		faculty({
			assignments: [
				assignment({
					sections: [
						section({ id: 11, name: 'Aguinaldo', gradeLevelName: 'Grade 7' }),
						section({ id: 12, name: 'Bonifacio', gradeLevelName: 'Grade 7' }),
						section({ id: 13, name: 'Luna', gradeLevelName: 'Grade 7' }),
						section({ id: 14, name: 'Mabini', gradeLevelName: 'Grade 7' }),
						section({ id: 15, name: 'Rizal', gradeLevelName: 'Grade 7' }),
						section({ id: 21, name: 'Maka-Diyos', gradeLevelName: 'Grade 8' }),
						section({ id: 22, name: 'Makakalikasan', gradeLevelName: 'Grade 8' }),
						section({ id: 23, name: 'Makatao', gradeLevelName: 'Grade 8' }),
					],
				}),
			],
		}),
	);

	const text = textOf(dialog);
	for (const name of [
		'Aguinaldo', 'Bonifacio', 'Luna', 'Mabini', 'Rizal',
		'Maka-Diyos', 'Makakalikasan', 'Makatao',
	]) {
		assert.ok(text.includes(name), `the section name "${name}" is not on screen`);
	}

	// TWO grade boxes, not eight rows: one badge per resolved grade.
	const badges = [...dialog.querySelectorAll('[data-testid="grade-badge"]')];
	assert.equal(badges.length, 2, 'expected exactly one grade badge per resolved grade');
	assert.deepEqual(
		badges.map((b) => b.getAttribute('data-grade')),
		['7', '8'],
		'grades must group ascending and carry the resolved grade, not a list order',
	);
	assert.ok(text.includes('Grade 7'), 'the Grade 7 box must be labelled');
	assert.ok(text.includes('Grade 8'), 'the Grade 8 box must be labelled');

	// The DepEd colour still comes from the one shared primitive, not a second
	// map introduced here. `GradeBadge` puts `data-grade` on an outer WRAPPER
	// span and the colour on the `GradeLevelBadge` inside it, so the colour is
	// read from the badge's own subtree rather than from the wrapper.
	const seven = badges.find((b) => b.getAttribute('data-grade') === '7');
	const colourHost = seven?.querySelector('[class]');
	const classAttr = colourHost?.getAttribute('class') ?? '';
	assert.ok(
		/(bg|text|border)-(green|yellow|red|blue)/.test(classAttr),
		`the Grade 7 badge lost its DepEd colour: "${classAttr}"`,
	);
});

test('A3C17-1N a section whose grade cannot be resolved renders no GR1 and no invented grade', () => {
	// `gradeLevelId: 1` is the EnrollPro internal FK that re-mints; there is no
	// name and no displayOrder to carry a real grade, so the authority returns
	// null. Reading the id directly is what produced `GR1` in the first place.
	const dialog = renderProfile(
		faculty({
			assignments: [
				assignment({
					sections: [
						section({ id: 31, name: 'Bonifacio', gradeLevelName: 'Grade 7' }),
						section({ id: 32, name: 'Mabini', gradeLevelName: '', displayOrder: 0, gradeLevelId: 1 }),
					],
				}),
			],
		}),
	);

	const text = textOf(dialog);

	assert.ok(text.includes('Bonifacio'), 'precondition: the resolvable section is present');
	assert.ok(text.includes('Mabini'), 'precondition: the unresolvable section is still NAMED');

	assert.ok(!text.includes('GR1'), 'a junk gradeLevelId must not become GR1');
	assert.ok(!/\bGrade 1\b/.test(text), 'a junk gradeLevelId must not become a "Grade 1" label');

	// It is still rendered, under an honest heading, and with NO grade badge —
	// a badge is a claim.
	assert.ok(text.includes('Grade not set'), 'the unresolvable group must be labelled honestly');
	const unset = [...dialog.querySelectorAll('*')].find(
		(el) => textOf(el) === 'Grade not set',
	);
	assert.ok(unset, 'the "Grade not set" heading did not render');
	assert.equal(
		unset!.parentElement?.querySelector('[data-testid="grade-badge"]'),
		null,
		'the unresolved group must carry no GradeBadge',
	);
});

test('A3C17-1M MUTANT: the unresolvable section DOES render GR1 when the internal id is read directly', () => {
	// The negative control above is only worth anything if the fixture is
	// genuinely resolvable by the wrong authority. It is: the legacy inline
	// expression this row replaced rendered `GR1` from exactly this id.
	const junk = section({ id: 32, name: 'Mabini', gradeLevelName: '', displayOrder: 0, gradeLevelId: 1 });
	assert.equal(
		resolveSectionGradeNumber(junk),
		null,
		'precondition: the shared authority refuses this section',
	);
	const inlineGrade = junk.gradeLevelId as number;
	assert.ok(
		Number.isFinite(inlineGrade),
		'precondition: the removed inline expression had a finite number to render',
	);
	// What the old code produced, stated as the number the mutant would paint.
	assert.equal(`GR${inlineGrade}`, 'GR1', 'precondition: the defect really was a rendered GR1');

	// And the live one is different, which is the point.
	const real = section({ id: 33, name: 'Luna', gradeLevelName: 'Grade 7' });
	assert.equal(resolveSectionGradeNumber(real), 7, 'a named grade still resolves');
});

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-2 — hours that add up.
// ═══════════════════════════════════════════════════════════════════════════

test('A3C17-2 the subject total is sections x minMinutesPerWeek, and "each" only above one section', () => {
	const eightSections = Array.from({ length: 8 }, (_, i) =>
		section({ id: 40 + i, name: `Sec-${i + 1}`, gradeLevelName: 'Grade 7' }),
	);
	const dialog = renderProfile(faculty({ assignments: [assignment({ sections: eightSections })] }));

	const text = textOf(dialog);

	// 8 sections of 225 minutes. The exact sum is 1800 minutes = 30.0 hours, and
	// THAT is what the card must read. It said "30h a week" originally, then
	// C3 changed it to "30.4h" and C3-FIX put the truthful 30 back — 30.4 was
	// 8 × 3.8, an artefact of rounding 3.75 up eight times, and it contradicted
	// the card's own server-fed "Current weekly hours" line. The POSITIVE
	// assertion carries the weight; the "not 30.4h" form is kept below.
	assert.ok(text.includes('8 classes'), `the class count is missing: ${text.slice(0, 400)}`);
	assert.ok(
		text.includes('30h a week'),
		'the subject total must be the TRUTHFUL sum of the actual minutes: 8 x 225 = 1800 min = 30h',
	);
	// 225 min = 3.75h, and 8 x 3.8 = 30.4 does NOT reproduce 30 — so the friendly
	// hours clause must not appear. The exact minutes clause takes its place.
	assert.ok(
		!text.includes('3.8h each'),
		'a rounded hours "each" must not be printed beside a total it does not reproduce',
	);
	assert.ok(
		text.includes('225 min each'),
		'when the hours clause would not reproduce the total, the per-section figure must be stated in exact minutes',
	);
	// The BADGE is the requester's literal ask and is deliberately NOT part of
	// the totals arithmetic, so it still reads 3.8h even though the clause beside
	// it now reads "225 min each". Both are true; they answer different
	// questions. Asserted here so a future harmonisation is a visible change
	// rather than a silent one.
	assert.ok(text.includes('3.8h'), 'the per-section badge must still read 3.8h');
	const badge = [...dialog.querySelectorAll('[data-slot="badge"], span')]
		.map((el) => textOf(el))
		.find((t) => t === '3.8h');
	assert.equal(
		badge,
		'3.8h',
		"the badge is the requester's literal figure for minMinutesPerWeek and is unchanged",
	);

	/**
	 * The subject card's own hours line, read out of the mounted DOM.
	 *
	 * Scoped to that line rather than to the whole dialog: the word "each"
	 * occurs elsewhere in this dialog's prose ("Move classes before generating"),
	 * so a dialog-wide negative would be asserting nothing about the row and
	 * would pass or fail by accident. It is captured as a STRING before the
	 * next render, because `renderProfile` unmounts the previous dialog — reading
	 * a detached node afterwards is how a stale-DOM false green happens.
	 */
	const hoursLineOf = (scope: HTMLElement) =>
		[...scope.querySelectorAll('p')]
			.map((p) => textOf(p))
			// `class(?:es)?`, NOT `classes?`: the latter matches "classe"/"classes"
			// and silently misses the singular, which is the case this row is
			// about. A row whose own fixture it cannot match is a row that reports
			// a green it never earned.
			.find((t) => /\d+ class(?:es)? ·/.test(t)) ?? '';

	// THE EXACT LINE, for the 8 x 225 case. History, because this string has been
	// through three positions and the reasons are the substance:
	//   "8 classes · 30h a week · 3.8h each"      — the original. Truthful total,
	//                                               but 8 x 3.8 = 30.4 ≠ 30.
	//   "8 classes · 30.4h a week · 3.8h each"    — C3. Identity held, but the
	//                                               total became a lie (30.4 is
	//                                               not this teacher's load) and
	//                                               contradicted the card's own
	//                                               30h "Current weekly hours".
	//   the one below                          — C3-FIX. Truthful total restored,
	//                                               and the per-section clause
	//                                               yields to exact minutes.
	assert.equal(
		hoursLineOf(dialog),
		'8 classes · 30h a week · 225 min each',
		'the total is the exact sum of minutes, and the per-section clause is exact minutes when hours would not reproduce it',
	);
	// The identity the scheduler can actually check, at the precision both
	// figures are displayed: 225 min x 8 = 1800 min = 30h.
	assert.equal(
		225 * 8,
		1800,
		'precondition: 225 min each x 8 classes is 1800 minutes',
	);
	assert.equal(
		Number((1800 / 60).toFixed(1)),
		30,
		'precondition: which is the 30h a week now shown',
	);
	// And the negative that carries the regression: the rounded hours clause
	// must not be back. The old C3 form of this row demanded the OPPOSITE
	// (`assert.ok(text.includes('30.4h a week'))`); it is quoted here rather than
	// deleted, because it is the belief C3-FIX rejects.
	assert.ok(
		!/3\.8h each/.test(textOf(dialog)),
		'a rounded "3.8h each" must never reappear beside a 30h total it does not reproduce',
	);

	// ONE section: singular, and no "each" — "1 classes" and "3.8h each" for a
	// single section are both small lies a scheduler can catch.
	const single = renderProfile(
		faculty({ assignments: [assignment({ sections: [section({ id: 50, name: 'Solo' })] })] }),
	);
	const singleLine = hoursLineOf(single);
	assert.ok(
		singleLine.includes('1 class ·'),
		`a single section reads "1 class · …"; all <p> texts were ${JSON.stringify([...single.querySelectorAll('p')].map((p) => textOf(p)))}`,
	);
	assert.ok(
		!/\bclasses\b/.test(singleLine),
		`the plural must not leak into a one-section card: "${singleLine}"`,
	);
	assert.ok(
		!singleLine.includes('each'),
		`"each" must not appear for a single section: "${singleLine}"`,
	);
	assert.ok(
		singleLine.includes('3.8h a week'),
		`one section of 225 minutes is 3.8h a week: "${singleLine}"`,
	);

	// A subject with no weekly minutes still states its class count rather than
	// printing a bare dash, so the line is never empty. The override goes on
	// `subject`, which is where `minMinutesPerWeek` actually lives — spreading
	// it at the top level would be silently ignored and this row would pass for
	// the wrong reason.
	const noMinutes = renderProfile(
		faculty({
			assignments: [
				{
					...assignment({ sections: [section({ id: 60, name: 'Zamora' })] }),
					subject: { ...assignment().subject, minMinutesPerWeek: 0 },
				},
			],
		}),
	);
	const noMinutesLine = hoursLineOf(noMinutes);
	assert.ok(
		/^1 class · 0h a week$/.test(noMinutesLine),
		`a subject with no weekly minutes states zero rather than nothing: "${noMinutesLine}"`,
	);

	// A3 C17 C3-FIX INVERTED THIS BACK, and both prior forms are preserved above
	// in comments rather than deleted, because the swing is the record of the
	// mistake:
	//
	//   the ORIGINAL row required the raw-minutes total, which is what put
	//     "11.3h a week" beside "3.8h each" on a three-section ESP load;
	//   C3 then required the OPPOSITE of that —
	//     assert.ok(text.includes('30.4h'), ...)
	//     assert.ok(!text.includes('· 30h a week'), ...)
	//   — buying a consistent identity by printing a total that is not the
	//     teacher's load and contradicting the card's own 30h weekly-hours line.
	//
	// The requirement is the truth: the total is `sections x minMinutesPerWeek`,
	// and the per-section CLAUSE is the figure that yields.
	assert.ok(
		text.includes('30h a week'),
		'the total is sections x minMinutesPerWeek: 8 x 225 = 1800 min = 30h, the real load',
	);
	assert.ok(
		!text.includes('30.4h'),
		'the C3 artefact 8 x 3.75 rounded up eight times is not a load and must not be shown',
	);
});

test('A3C17-2B whatever pair of figures is rendered, the two agree', () => {
	/**
	 * THE RULE, AS A PROPERTY, OVER THE WHOLE MATRIX.
	 *
	 * For every (minutes, count) the card renders a TOTAL and a per-section
	 * CLAUSE. The pair is acceptable if and only if EITHER the clause is hours
	 * and `clause x count` reproduces the total at the displayed precision, OR
	 * the clause is exact minutes and `clause x count / 60` reproduces the total.
	 * A rounded hours clause that fails to reproduce its own total is the defect
	 * this row exists to catch, in whichever direction the total came from.
	 *
	 * Driven through the MOUNTED dialog, not through a copy of the arithmetic:
	 * a property test over a re-implementation of the rule would agree with a
	 * broken component by construction.
	 */
	const toHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
	const cases: Array<[number, number]> = [];
	for (const minutes of [225, 230, 240]) {
		for (const count of [1, 3, 8]) cases.push([minutes, count]);
	}

	for (const [minutes, count] of cases) {
		const dialog = renderProfile(
			faculty({
				assignments: [
					assignment({
						// ON THE ASSIGNMENT, not on `faculty()`: `minMinutesPerWeek`
						// lives on `fs.subject`, and `assignment()` spreads `over` last,
						// so passing it one level up is silently ignored and the whole
						// matrix would be measured against 225 minutes every time. That
						// exact trap is why this row is driven from a fixture that has to
						// be right for the numbers to mean anything.
						subject: { id: 5, name: 'MAPEH', code: 'MAPEH', minMinutesPerWeek: minutes },
						sections: Array.from({ length: count }, (_, i) =>
							section({ id: 200 + i, name: `S${i + 1}`, gradeLevelName: 'Grade 7' }),
						),
					}),
				],
			}),
		);

		const line = [...dialog.querySelectorAll('p')]
			.map((p) => textOf(p))
			.find((t) => /\d+ class(?:es)? ·/.test(t)) ?? '';
		const label = `${minutes} min x ${count}`;

		// The TOTAL is the exact sum, always. This is the assertion with weight.
		const shownTotal = Number(/·\s*([\d.]+)h a week/.exec(line)?.[1]);
		assert.equal(
			shownTotal,
			toHours(minutes * count),
			`${label}: the total must be the exact sum of the actual minutes, rounded once to one decimal, got "${line}"`,
		);
		// In MINUTES the total is exact — with one honest limit, which this row
		// found by failing on it first: one decimal of HOURS cannot represent
		// 3.75h, so a 225-minute subject shows "3.8h" and 3.8 x 60 is 228, not
		// 225. That is a property of the unit, not a defect, and it is exactly
		// why the per-section CLAUSE below falls back to minutes: 225 x 8 = 1800
		// minutes = 30.0h, which IS representable, and is shown as "30h".
		//
		// So the total is required to be exact in minutes whenever the total
		// lands on a whole tenth of an hour (6-minute steps), and required to be
		// the correctly-ROUNDED value otherwise. Both are asserted; neither is
		// assumed.
		const totalMinutesExact = shownTotal * 60;
		// The bound is 3 MINUTES, not 3 hundredths: a tenth of an hour is 6
		// minutes, so one-decimal rounding can be wrong by at most half of that.
		assert.ok(
			Math.abs(totalMinutesExact - minutes * count) <= 3.000001,
			`${label}: the displayed total must be within 3 minutes of the real sum; ${shownTotal}h = ${totalMinutesExact} min vs ${minutes * count} min`,
		);
		if ((minutes * count) % 6 === 0) {
			assert.equal(
				totalMinutesExact,
				minutes * count,
				`${label}: this total lands on a tenth of an hour and must therefore be exact in minutes`,
			);
		}

		if (count === 1) {
			assert.ok(!/each/.test(line), `${label}: a single section needs no "each" clause: "${line}"`);
			continue;
		}

		const hoursClause = /·\s*([\d.]+)h each/.exec(line);
		const minutesClause = /·\s*(\d+) min each/.exec(line);

		if (hoursClause) {
			// The friendly form is allowed ONLY when it reproduces the total.
			assert.equal(
				toHours(Number(hoursClause[1]) * count),
				shownTotal,
				`${label}: an hours "each" clause is printed but it does not reproduce the total — "${line}"`,
			);
		} else {
			// Otherwise the clause must be exact minutes, and it must reproduce the
			// total exactly. A card with no clause at all is the silent failure.
			assert.ok(minutesClause, `${label}: the card must state a per-section figure: "${line}"`);
			assert.equal(
				Number(minutesClause![1]) * count,
				minutes * count,
				`${label}: the minutes clause must be the real per-section figure`,
			);
		}
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-3 — the to-be-hired header.
// ═══════════════════════════════════════════════════════════════════════════

test('A3C17-3 a placeholder header says "To be hired" and shows no ID-PENDING and no "Active teacher"', () => {
	const dialog = renderProfile(
		faculty({
			isPlaceholder: true,
			firstName: 'MAPEH',
			lastName: '— TO BE HIRED',
			employeeId: null,
			isActiveForScheduling: true,
		}),
	);
	const text = textOf(dialog);

	assert.ok(text.includes('To be hired'), 'a to-be-hired record must say so');
	assert.ok(!text.includes('ID-PENDING'), 'a placeholder has no employee number to show');
	assert.ok(!/#ID-PENDING/.test(text), 'the pending code chip must be gone entirely');
	assert.ok(!text.includes('Active teacher'), 'a to-be-hired record is not an active teacher');
	// The plain-words display name, from the same shared predicate.
	assert.ok(text.includes('To be hired: MAPEH'), `the display name did not render: ${text.slice(0, 300)}`);

	// VALIDITY, caught by rendering rather than by reading the source: a `Badge`
	// is a `<div>` and `DialogDescription` is a `<p>`, so parking the chip inside
	// the description produced a `<div>` inside a `<p>`. React reports that as a
	// hydration error and a browser may re-parent it, which is how a status chip
	// silently moves out of the line it was laid out in.
	const chip = [...dialog.querySelectorAll('*')].find(
		(el) => textOf(el) === 'To be hired' && el.tagName === 'DIV',
	);
	assert.ok(chip, 'the To be hired chip did not render as an element');
	for (let node = chip!.parentElement; node; node = node.parentElement) {
		assert.notEqual(
			node.tagName,
			'P',
			'a block-level status chip must not be nested inside a <p> (DialogDescription)',
		);
	}
});

test('A3C17-3 a real teacher with no employeeId shows neither a code chip nor "To be hired"', () => {
	const dialog = renderProfile(faculty({ employeeId: null, isPlaceholder: false }));
	const text = textOf(dialog);

	assert.ok(!text.includes('To be hired'), 'a real teacher must not be relabelled to-be-hired');
	assert.ok(!text.includes('ID-PENDING'), 'a missing employee id is not a pending identity');
	assert.ok(!text.includes('#'), 'no code chip may render for a real teacher without an employee id');
	assert.ok(text.includes('Active teacher'), 'a real active teacher keeps its status');
});

test('A3C17-3 a real teacher with an employeeId keeps the #<id> chip', () => {
	const text = textOf(renderProfile(faculty({ employeeId: 'T-0046' })));
	assert.ok(text.includes('#T-0046'), 'the employee code chip must survive for a real teacher');
	assert.ok(!text.includes('To be hired'), 'a real teacher must not be relabelled');
});

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-4 — to-be-hired names, and the stored-name contract they must not break.
// ═══════════════════════════════════════════════════════════════════════════

test('A3C17-4 the display name reads "To be hired: …" for the stored sentinel, everywhere the formatter is used', () => {
	// The two strings Lane C read on staging, verbatim.
	const mapeh = { firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true };
	const teacher1 = { firstName: 'TEACHER', lastName: '1 — TO BE HIRED', isPlaceholder: true };

	assert.equal(
		formatFacultyDisplayName(mapeh),
		'To be hired: MAPEH',
		'a sentinel placeholder reads as a status plus its label, and the stored sentinel is gone',
	);
	assert.equal(
		formatFacultyDisplayName(teacher1),
		'To be hired: TEACHER 1',
		'the leading numeric counter is kept as a trailing identifier, not as leading punctuation',
	);

	// No leaked punctuation, and no shouted sentinel as a standalone name.
	for (const display of [formatFacultyDisplayName(mapeh), formatFacultyDisplayName(teacher1)]) {
		assert.ok(!display.includes('—'), `a display name must not leak the stored dash: "${display}"`);
		assert.ok(!display.includes('-'), `a display name must not leak a dash: "${display}"`);
		assert.ok(!/^\d/.test(display), `a display name must not lead with a digit: "${display}"`);
	}

	// A REAL person is untouched. A3 C17 C2 CHANGED THE SECOND HALF of this
	// block, which used to assert that a flagged record carrying a real name
	// rendered as 'ALCANTARA, ROBERTO' — i.e. as a hired teacher. That was the
	// flag+sentinel rule, and it meant a placeholder typed in through
	// `CreatePlaceholderDialog` (which never writes the sentinel) rendered as a
	// real person. Under rule (a) the name is still intact and the status is
	// declared, which is the requester's "for isPlaceholder" read literally.
	assert.equal(
		formatFacultyDisplayName({ firstName: 'Roberto', lastName: 'Alcantara', isPlaceholder: false }),
		'ALCANTARA, ROBERTO',
		'a real teacher keeps the canonical display name',
	);
	assert.equal(
		formatFacultyDisplayName({ firstName: 'Roberto', lastName: 'Alcantara', isPlaceholder: true }),
		'To be hired: ALCANTARA, ROBERTO',
		'C2: a flagged record with a real name keeps the whole name and gains the status',
	);

	// Every consumer calls this one function, which is why the row is one row.
	assert.equal(formatFacultySummaryNameProxy(), 'To be hired: MAPEH');
});

/** The summary overload is the convenience every roster call site uses. */
function formatFacultySummaryNameProxy(): string {
	return summaryDisplayName({ firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true } as any);
}

const { formatFacultySummaryName: summaryDisplayName } = await import('@/components/faculty/teacherNameDisplay');

test('A3C17-4 the stored-name and sort-key contract is unchanged by the display change', () => {
	// SEARCH / SORT SAFETY. The roster's search compares a lower-cased query
	// against the raw fields and its sort uses this key. If the display change
	// leaked into either, searching "to be hired" or sorting the roster would
	// quietly change behaviour.
	const stored = { firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true };

	assert.equal(
		formatFacultyStoredName(stored),
		'— TO BE HIRED, MAPEH',
		'the stored name is byte-preserved: the display transform must not write back',
	);
	assert.equal(
		teacherNameSortKey(stored),
		'— TO BE HIRED MAPEH',
		'the sort key keeps stored casing and the stored dash',
	);

	// Mixed casing still surfaces both forms, which is the Fix 22 contract the
	// module exists to keep.
	assert.equal(
		formatFacultyStoredName({ firstName: 'Carlo Miguel', lastName: 'Aguilar' }),
		'Aguilar, Carlo Miguel',
	);
	assert.equal(teacherNameSortKey({ firstName: 'Carlo Miguel', lastName: 'Aguilar' }), 'Aguilar Carlo Miguel');
});

test('A3C17-4 initials stay short for a placeholder, and the sentinel predicate agrees with the name', () => {
	const initials = formatFacultyInitials({
		firstName: 'MAPEH',
		lastName: '— TO BE HIRED',
		isPlaceholder: true,
	} as any);

	assert.ok(
		initials.length <= 2,
		`a circular avatar must not render a status: got "${initials}" (${initials.length} chars)`,
	);
	assert.ok(
		/^[A-Z0-9]{1,2}$/.test(initials),
		`initials must be letters, not words: got "${initials}"`,
	);
	assert.ok(!initials.includes('TO'), `initials must not come from the sentinel: "${initials}"`);
	assert.equal(initials, 'M', 'the initial comes from the stripped LABEL, not the sentinel');

	// A real teacher is unaffected.
	assert.equal(
		formatFacultyInitials({ firstName: 'Roberto', lastName: 'Alcantara' } as any),
		'RA',
	);

	// The predicate the profile header reads and the name the formatter returns
	// must never disagree about which record is a to-be-hired one.
	//
	// A3 C17 C2 CHANGED LINE 2 OF THIS BLOCK. It used to read
	// `assert.equal(isPlaceholderSentinelName({ Roberto, Alcantara, isPlaceholder: true }), false)`
	// — the flag+sentinel rule, under which a flagged record with a real name was
	// NOT a placeholder. C2 settled on rule (a): the FLAG alone decides identity,
	// so that answer is now `true`, and the display name is
	// "To be hired: ALCANTARA, ROBERTO" — the real name kept, the status
	// declared. The broader C2 rows live in the sibling
	// `a3-c17-timetable-identity.test.tsx`; this block keeps the invariant that
	// the badge and the name cannot disagree.
	assert.equal(isPlaceholderSentinelName({ firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true }), true);
	// C2: the flag decides, so a flagged record with NO sentinel is still
	// to-be-hired — and keeps its whole name, surname included.
	assert.equal(isPlaceholderSentinelName({ firstName: 'Roberto', lastName: 'Alcantara', isPlaceholder: true }), true);
	assert.equal(
		formatFacultyDisplayName({ firstName: 'Roberto', lastName: 'Alcantara', isPlaceholder: true } as any),
		'To be hired: ALCANTARA, ROBERTO',
		'C2: a flagged record with a real name keeps the name and gains the status',
	);
	assert.equal(isPlaceholderSentinelName({ firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: false }), false);
	assert.equal(
		isPlaceholderSentinelName({ firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true }),
		formatFacultyDisplayName({ firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true } as any).startsWith('To be hired'),
		'the header badge and the display name must read the same fact',
	);
	// And the converse, which is the half that keeps the flag from being ignored:
	// the stored sentinel alone never promotes a record.
	assert.equal(
		formatFacultyDisplayName({ firstName: 'MAPEH', lastName: '— TO BE HIRED' } as any),
		'— TO BE HIRED, MAPEH',
		'C2: the sentinel is a text rule inside the flagged branch, not an identity rule',
	);
	assert.equal(
		formatFacultyInitials({ firstName: 'MAPEH', lastName: '1 — TO BE HIRED', isPlaceholder: true } as any),
		'M',
		'the counter must not become an initial',
	);
});

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-5 — the weekly maximum is read, not typed.
// ═══════════════════════════════════════════════════════════════════════════

function rosterMember(over: Record<string, unknown> = {}) {
	return {
		id: 1,
		firstName: 'A',
		lastName: 'B',
		isActiveForScheduling: true,
		isPlaceholder: false,
		policyCreditedHours: 30,
		maxHoursPerWeek: 40,
		...over,
	} as any;
}

test('A3C17-5 a teacher on a 32h maximum makes the helper read 32, not 40h', () => {
	const roster = [
		rosterMember({ id: 1, firstName: 'Ana', lastName: 'Reyes', maxHoursPerWeek: 32, policyCreditedHours: 36 }),
		rosterMember({ id: 2, firstName: 'Ben', lastName: 'Cruz', maxHoursPerWeek: 40, policyCreditedHours: 30 }),
	];

	assert.equal(overCapWeeklyMaxHours(roster), 32, 'the maximum among the counted teachers is 32');

	const helper = overCapChipHelper(roster);
	assert.ok(helper.includes('32'), `the helper must state the saved maximum: "${helper}"`);
	assert.ok(!helper.includes('40h'), `the literal 40h must be gone: "${helper}"`);
	assert.ok(
		helper.startsWith('Active teachers above the 32h weekly maximum.'),
		`the sentence shape must be preserved: "${helper}"`,
	);
	assert.ok(helper.length > 24, 'the fixture would not discriminate if the sentence were too short');
});

test('A3C17-5 the fallbacks are ordered: counted, then roster-wide, then the policy constant', () => {
	// Counted set wins over a higher roster-wide maximum: a 60h teacher who is
	// NOT over cap must not raise the ceiling the over-cap chip talks about.
	const mixed = [
		rosterMember({ id: 1, maxHoursPerWeek: 32, policyCreditedHours: 36 }),
		rosterMember({ id: 2, maxHoursPerWeek: 60, policyCreditedHours: 30 }),
	];
	assert.equal(overCapWeeklyMaxHours(mixed), 32, 'the counted set is the first authority');

	// Nobody over cap: the roster-wide maximum still states a real saved number.
	const noneOver = [rosterMember({ id: 1, maxHoursPerWeek: 30, policyCreditedHours: 20 })];
	assert.equal(overCapWeeklyMaxHours(noneOver), 30, 'the roster-wide maximum is the second authority');

	// An empty roster reaches the policy constant, and says so honestly.
	assert.equal(
		overCapWeeklyMaxHours([]),
		MAX_WEEKLY_TEACHING_HOURS,
		'an empty roster falls back to the policy constant',
	);
	assert.ok(overCapChipHelper([]).includes(`${MAX_WEEKLY_TEACHING_HOURS}h`));

	// A placeholder is a slot, not a person over a cap: a to-be-hired record on
	// a 60h maximum must not raise the number the chip explains.
	const withPlaceholder = [
		rosterMember({ id: 1, maxHoursPerWeek: 32, policyCreditedHours: 36 }),
		rosterMember({ id: 2, isPlaceholder: true, maxHoursPerWeek: 60, policyCreditedHours: 90 }),
	];
	assert.equal(overCapWeeklyMaxHours(withPlaceholder), 32, 'a placeholder is not counted over a cap');
});

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-6 — the 14px floor in the profile dialog.
// ═══════════════════════════════════════════════════════════════════════════

test('A3C17-6 no sub-14px arbitrary font size survives in the profile dialog, and the micro-labels are 14px', () => {
	const source = readSource('components/faculty/FacultyProfileSheet.tsx');
	const stripped = source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map((line) => {
			const t = line.trim();
			if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
			const i = line.indexOf('//');
			return i > 0 && line[i - 1] !== ':' ? line.slice(0, i) : line;
		})
		.join('\n');

	// The exact tokens the packet names.
	for (const token of ['text-[0.7rem]', 'text-[0.65rem]']) {
		assert.ok(
			!stripped.includes(token),
			`${token} is 10.4-11.2px and is still declared in the profile dialog`,
		);
	}

	// And the general floor, so a NEW small value cannot arrive by another name.
	const arbitrary = /text-\[\s*(\d*\.?\d+)(px|rem|em|pt)?\s*\]/g;
	const offenders: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = arbitrary.exec(stripped)) !== null) {
		const value = Number.parseFloat(match[1]);
		const px = match[2] === 'px' || match[2] === undefined ? value : value * 16;
		if (px < 14) offenders.push(`${match[0]} (${px}px)`);
	}
	assert.deepEqual(offenders, [], `sub-14px text in the profile dialog: ${offenders.join(', ')}`);

	// And the RENDERED dialog, so this row is not a source-text check wearing a
	// rendered hat: the labels below are read out of the mounted DOM.
	const dialog = renderProfile(faculty());

	// The labels the packet named are now sentence case at `text-sm`, which
	// computes to 14px. Checked as a CLASS CONTRACT, because a string match on
	// the whole attribute would be brittle about attribute order; what matters is
	// that each named label carries `text-sm` and no `uppercase`.
	for (const label of ['Roster identity', 'Department', 'Status', 'Adviser and source context']) {
		const el = [...dialog.querySelectorAll('h4, p')].find((node) => textOf(node) === label);
		assert.ok(el, `"${label}" must still be rendered as a label`);
		const cls = el!.getAttribute('class') ?? '';
		assert.ok(cls.includes('text-sm'), `"${label}" must be 14px (text-sm), got: "${cls}"`);
		assert.ok(!cls.includes('uppercase'), `"${label}" must be sentence case, not uppercase: "${cls}"`);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// A3C17-7 — the review load dialog must not carry its own width cap.
// ═══════════════════════════════════════════════════════════════════════════

test('A3C17-7 the workload modal has no width cap of its own, so the shared bounds govern the drag', () => {
	const source = readSource('components/faculty/FacultyWorkloadModal.tsx');
	// The className this surface passes to the shared `DialogContent`.
	const className = /<DialogContent[\s\S]*?className="([^"]*)"/.exec(source)?.[1];
	assert.ok(className, 'the workload modal must still pass a className to DialogContent');

	assert.ok(
		!/(^|\s)(sm:)?max-w-/.test(className!),
		`a local max-width defeats the drag handler's inline style.width: "${className}"`,
	);
	assert.ok(
		!/(^|\s)w-\[/.test(className!) && !/style=\{\{[^}]*width/.test(source),
		'a local width or inline width is a second width authority on this surface',
	);
	assert.ok(!/\bresize\b/.test(className!), 'the page-local resize class stays gone; the shared handles own it');

	// What stays is this surface's own, and what governs is the shared contract.
	assert.ok(className!.includes('max-h-[85svh]'), "the surface keeps its own height cap");
	assert.ok(className!.includes('overflow-hidden'), 'the surface keeps its own clipping box');
	assert.ok(/className="[^"]*resizable/.test(source.replace(/\s+/g, ' ')) || /\n\s*resizable\b/.test(source),
		'the surface still takes the shared resizable handling');

	assert.ok(
		DIALOG_RESIZABLE_CLASSES.includes('max-w-[95vw]'),
		'precondition: the shared contract still supplies the ceiling',
	);
	assert.ok(
		DIALOG_RESIZABLE_CLASSES.includes('min-w-[min(480px,95vw)]'),
		'precondition: the shared contract still supplies the floor',
	);
});
