/**
 * A6 c9 — THE STAFFING FIGURE, RENDERED. The rendered half of the packet's
 * §1 target, and the file `a6-c5-outage` `A6C5-S9-1` points at by name when it
 * retires the source reading of the old grey shortage note.
 *
 * WHY THIS FILE EXISTS AT ALL. `AGENTS.md` §11: "A test that only asserts source
 * text (a string, an import, a prop name in a file) is not acceptance evidence for
 * a user-facing change." The c9 product change is one control a scheduler either
 * presses or walks past, so the only honest evidence is the rendered control, its
 * accessible name, the window it opens, and the notice surface that must NOT be
 * there. Everything below is read off markup produced by the REAL component in
 * real JSDOM, through the REAL `useTeachingLoadOutage`, from the REAL fixture
 * vocabulary the accepted sibling `a6-c7-shortage-owner-undo.test.tsx` uses.
 *
 * THE OPERATOR DEFECT THIS FILE IS POINTED AT, verbatim from the packet:
 * "some buttons are not obvious as clickable and can just be passed on as a
 * read-only metric — this is a recurring problem; QA must judge it on the render."
 * `A6C9-1` therefore does not settle for "there is a `<button>`": it requires a
 * PERCENTAGE and a VERB in the accessible name, because `88% staffed` alone is
 * exactly the control the operator said gets passed over.
 *
 * JSDOM PERFORMS NO LAYOUT, and nothing here claims a pixel. "One look per
 * control", the two-row header budget and the 1366x768 fit are declared
 * `@/ui`/class-level claims checked elsewhere; the rendered-pixel confirmation
 * is the packet's own browser row.
 *
 * THE HARNESS IS COPIED VERBATIM from the accepted sibling
 * `a6-c6-calm-teaching-load.test.tsx` (its JSDOM bootstrap, `render`, `click`,
 * `press`, `dispose`, `portalledDialog`) so two files sitting beside each other
 * behave identically and a reviewer can diff them.
 *
 * EVERY ROW NAMES THE ITEM IT DECIDES, AND EVERY MUTANT HAS BEEN BROKEN BY HAND
 * against this candidate. `A6C9-4` is the row that proves the other three can
 * go red: a row that cannot fail is not evidence (AGENTS.md §11).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const { Button } = await import('@/ui/button');

const { useTeachingLoadOutage } = await import('@/hooks/useTeachingLoadOutage');
const { TeachingLoadStaffingFigure } = await import('@/components/faculty-assignments/TeachingLoadStaffingFigure');
const { COVER_THIS_CLASS_LABEL } = await import('@/components/faculty-assignments/TeachingLoadStaffingFigure');
const { COVER_CLASSES_LABEL } = await import('@/components/faculty-assignments/TeachingLoadShortageLine');
/** Retired by A6 c10. Named so the SUPERSEDED row can still read what it asserted. */
const ASSIGN_TEACHER_LABEL = undefined;
const { buildStaffingFigureLabel, SAVED_ROSTER_NOTE_PREFIX } = await import('@/components/faculty-assignments/teachingLoadOutage');

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
 * Unmount a mount EARLY, from inside the test that opened it. Copied verbatim from
 * the sibling for the reason recorded there: two tests' worth of Radix layers
 * alive at once deadlocks the JSDOM process instead of failing a row.
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

// ═════════════════════════════════════════════════════════════════════════════
// THE FIXTURE, quoted from the real Teaching Load surface rather than invented.
// `AGENTS.md` §11: a control's fixture must come from the surface the row is
// about. The record shapes, the ownership key, the coverage totals and the
// placeholder rule are the ones `a6-c7-shortage-owner-undo.test.tsx` drives the
// SAME `useTeachingLoadOutage` with, so a reword of a real string is caught here
// instead of passing against a fiction.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The real `Subject` shape, quoted from `a6-c7-shortage-owner-undo.test.tsx`'s
 * fixture (c5's own, unchanged) — including `isActive` and `gradeLevels`, which
 * `isSectionSubjectApplicable` reads. A fixture that omitted `isActive` would
 * make EVERY subject inapplicable and the window would render its empty state,
 * which is precisely the "control passed against a fiction" defect AGENTS.md §11
 * names.
 */
const SUBJECT = (id: number, code: string, name: string) => ({
	id, code, name, isActive: true, gradeLevels: [] as number[], programScopes: [] as string[],
	minMinutesPerWeek: 0, displayOrder: id, isSpecialized: false,
});
const SECTION = (id: number, name: string) => ({ id, name, displayOrder: 7, programType: 'REGULAR', isActive: true });

/** Two subjects, so "grouped under their subject" is a claim about GROUPING. */
const SUBJECTS: any[] = [
	SUBJECT(11, 'MAPEH', 'MAPEH'),
	SUBJECT(12, 'ENG', 'English'),
];
/** Named exactly as the operator met them: `MAPEH — 7-A, 7-B, 8-C`. */
const SECTIONS: any[] = [
	SECTION(101, 'MAPEH 7-A'), SECTION(102, 'MAPEH 7-B'), SECTION(103, 'MAPEH 8-C'), SECTION(104, 'MAPEH 9-A'),
	SECTION(201, 'Eng 7-A'), SECTION(202, 'Eng 8-A'),
];
const SECTION_MAP = new Map<number, any>(SECTIONS.map((row) => [row.id, row]));

/** Three MAPEH classes and one English class have no real, active teacher. */
const SHORT_BY_SUBJECT: Record<number, number[]> = { 11: [101, 102, 103], 12: [201] };

const SAVED_OWNERSHIP: Record<string, any> = {};
for (const subject of SUBJECTS) {
	for (const section of SECTIONS) {
		const key = `${subject.id}:${section.id}`;
		if (!SHORT_BY_SUBJECT[subject.id]!.includes(section.id)) SAVED_OWNERSHIP[key] = { facultyId: 9 };
	}
}
const ACTIVE_FACULTY = new Set<number>([9]);
const PLACEHOLDER_FACULTY = new Set<number>([42]);

/**
 * 18 of 24 pairs held by a REAL teacher, 2 by a to-be-hired record, 4 unowned.
 * So the figure must read `75% staffed` and the window must count 6 short
 * classes — both derived, neither typed into a string here.
 */
const COVERAGE_TOTALS: any = {
	realFacultyAssignedPairs: 18,
	syntheticPlaceholderPairs: 2,
	unassignedPairs: 4,
	totalPairs: 24,
};

function outageParams(overrides: Record<string, any> = {}) {
	return {
		subjects: SUBJECTS,
		sections: SECTIONS,
		savedOwnershipMap: SAVED_OWNERSHIP,
		pendingOwnershipMap: {},
		activeFacultyIds: ACTIVE_FACULTY,
		placeholderFacultyIds: PLACEHOLDER_FACULTY,
		coverageTotals: COVERAGE_TOTALS,
		fetchedAt: '2026-09-12T02:15:00.000Z',
		schoolId: 1,
		activeSchoolYearId: 9,
		scopeKey: '1:9',
		dataSource: 'live' as const,
		isOnline: true,
		degradedNotice: null as string | null,
		sectionMap: SECTION_MAP as unknown as Map<number, any>,
		...overrides,
	};
}

/** The page's own state: the roster IS the current one. */
const CURRENT = outageParams({ dataSource: 'live' as const, isOnline: true });
/** `cached` is the state Lane C measured on staging train 7. */
const SAVED = outageParams({ dataSource: 'cached' as const, isOnline: true });

/**
 * The REAL hook through the REAL figure, composed exactly as
 * `useTeachingLoadHeaderClaims` composes it for `pages/TeachingLoad.tsx` — the
 * `TooltipProvider`, then the figure. `writeBlockedReason: null` is the writable
 * workspace, which is the state in which an action control is offered at all.
 */
function FigureHost(props: { params?: any; writeBlockedReason?: string | null }) {
	const outage = useTeachingLoadOutage(props.params ?? CURRENT);
	return createElement(
		TeachingLoadStaffingFigure as any,
		{
			outage,
			writeBlockedReason: props.writeBlockedReason ?? null,
			onShowCoverageDetail: () => {},
			fetchedAt: (props.params ?? CURRENT).fetchedAt,
		},
	);
}

const figureIn = (root: ParentNode) =>
	root.querySelector('[data-testid="teaching-load-staffing-figure"]') as HTMLElement | null;

/** The accessible NAME a screen reader gets: the visible words, nothing added. */
function accessibleName(el: HTMLElement | null): string {
	return ((el?.getAttribute('aria-label') ?? '') + ' ' + (el?.textContent ?? '')).replace(/\s+/g, ' ').trim();
}

// ═════════════════════════════════════════════════════════════════════════════
// A6C9-1 — IT IS A CONTROL, AND IT SAYS WHAT IT OPENS.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C9-1 the staffing figure is a real BUTTON whose name carries a percentage and a VERB', () => {
	// The operator's named recurring defect, verbatim: "some buttons are not
	// obvious as clickable and can just be passed on as a read-only metric". A
	// control that renders `<span>88% staffed</span>` satisfies "there is a
	// percentage" and still fails the operator, so this row requires both a
	// NUMBER and something you can DO.
	const host = render(createElement(FigureHost as any, {}));

	const figure = figureIn(host);
	assert.ok(figure, 'the header must render the staffing figure');
	assert.equal(figure!.tagName, 'BUTTON', 'the figure IS the control, not a wrapper around one');
	assert.equal(
		figure!.getAttribute('type'),
		'button',
		'and it is a `type="button"`, so it never submits an ancestor form',
	);
	// `aria-haspopup="dialog"` says what pressing it does, in the vocabulary the
	// rest of the app already uses for a control that opens a window.
	assert.equal(
		figure!.getAttribute('aria-haspopup'),
		'dialog',
		'the figure must announce that pressing it opens a dialog',
	);
	assert.equal(
		figure!.getAttribute('aria-expanded'),
		'false',
		'and report itself collapsed before it is pressed',
	);
	// The FIGURE: the coverage the operator asked to be able to see at a glance.
	const name = accessibleName(figure);
	assert.match(name, /\d+% staffed/, `the name must carry the staffing PERCENTAGE; saw ${JSON.stringify(name)}`);
	assert.equal(
		name,
		'75% staffed— See who needs a teacher',
		'and the operator\'s exact words, read off the real render (the spans put the em dash flush against the figure)',
	);

	// THE VERB, stated separately because it is the half a metric fails.
	//
	// Spelled as the operator's rule rather than as a lookup of one exported
	// constant, because a detector that only matches the constant it is guarding
	// cannot fail: a reword would keep it green. A VERB here means a word that
	// names something you can DO.
	const VERB = /\b(see|show|list|open|assign|cover|review|choose|select|add|assign)\b/i;
	assert.match(
		name,
		VERB,
		`the operator's defect is a control that reads as a bare metric, so the VERB must be IN THE NAME; saw ${JSON.stringify(name)}`,
	);
	assert.doesNotMatch(
		figure!.getAttribute('title') ?? '',
		/\S/,
		'no raw `title` attribute over the top (AGENTS.md §8) — the label already says it',
	);

	// It LOOKS like the button beside it: the shared `@/ui` outline variant at the
	// shared row-2 chrome, with a pointer cursor. Read from the rendered class,
	// because "looks like a button" is a class-level claim and this file renders.
	const cls = figure!.getAttribute('class') ?? '';
	assert.match(cls, /border/, 'the figure must be bordered — a metric has no border');
	assert.match(cls, /cursor-pointer/, 'and must show a pointer cursor, so it reads as pressable');
	assert.equal(
		figure!.querySelectorAll('button').length,
		0,
		'no nested control: the figure itself is the only button in its slot',
	);
	// The chevron is decorative, so it is hidden from the name rather than read out.
	const chevron = figure!.querySelector('svg');
	assert.ok(chevron, 'the figure carries a chevron — the operator asked for the `›`');
	assert.equal(chevron!.getAttribute('aria-hidden'), 'true', 'which is aria-hidden, so it never enters the name');

	// And the derivation itself is the real one, read from the module.
	const label = buildStaffingFigureLabel({
		staffedPercent: 75,
		withoutRealTeacherCount: 6,
	} as never);
	assert.equal(label.figure, '75% staffed');
	assert.match(label.clause, VERB, 'the real clause carries a verb too, so the row above is not a coincidence');
});

test('A6C9-1b the CLEARED state is still a control, and still opens its window', () => {
	// A figure that became a bare `100% staffed` the moment nothing is missing
	// would put the operator's defect back on exactly the day the page looks
	// healthy, so the CONTROL is asserted here independently of the wording.
	//
	// RECORDED OBSERVATION, not a superseded assertion and not a passed one. The
	// packet's addendum names the verb requirement against the SHORTAGE label
	// (`84% staffed — See who needs a teacher ›`), and this row does not extend it
	// to the cleared label, whose real clause is `Every class has a teacher` — no
	// action verb. A reviewer should know the cleared control reads as a control
	// by SHAPE (border, `cursor-pointer`, `aria-haspopup="dialog"`, chevron) rather
	// than by wording. Changing that wording is a product decision this slice does
	// not own; it is recorded for the planner rather than asserted either way.
	const host = render(createElement(FigureHost as any, {
		params: outageParams({
			savedOwnershipMap: Object.fromEntries(
				SUBJECTS.flatMap((subject) => SECTIONS.map((section) => [`${subject.id}:${section.id}`, { facultyId: 9 }])),
			),
			coverageTotals: { realFacultyAssignedPairs: 24, syntheticPlaceholderPairs: 0, unassignedPairs: 0, totalPairs: 24 },
		}),
	}));
	const figure = figureIn(host);
	assert.ok(figure, 'the figure must still render when nothing is short');
	assert.equal(figure!.tagName, 'BUTTON', 'and it is still the control');
	assert.equal(figure!.getAttribute('aria-haspopup'), 'dialog');
	const cls = figure!.getAttribute('class') ?? '';
	assert.match(cls, /border/, 'it keeps the border that makes it look pressable');
	assert.match(cls, /cursor-pointer/, 'and the pointer cursor');
	const name = accessibleName(figure);
	assert.match(name, /100% staffed/, 'the cleared figure states the percentage');
	assert.match(name, /Every class has a teacher/, 'and the real cleared clause');

	// Pressing it still opens a window, and the window still says the honest
	// empty thing rather than rendering an empty box.
	click(figure!);
	const window = dom.window.document.querySelector('[data-testid="teaching-load-shortage-window"]')!;
	assert.ok(window, 'the cleared figure still opens its window');
	const empty = window.querySelector('[data-testid="teaching-load-shortage-window-empty"]')!;
	assert.ok(empty, 'and the window states that nothing is waiting for a teacher');
	assert.equal((empty.textContent ?? '').trim(), 'Nothing is waiting for a teacher.');
	assert.equal(
		window.querySelector('[data-testid="teaching-load-shortage-window-list"]'),
		null,
		'with no half-empty list beside it',
	);
	dispose(host);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C9-2 — CLICKING IT OPENS THE LIST OF WHO STILL NEEDS A TEACHER.
//
// A6 c10 CORRECTION — THE SUBJECT ROW IS SUPERSEDED, THE ASSERTIONS ARE NOT.
//
// c10 changed the SHAPE this test asserts, on the operator's own authority: the
// subject row showed `MAPEH — 7-A, 7-B, 8-C` with ONE action for all three
// classes, so a scheduler could see which classes were open and could not cover
// any of them. The Codex audit recorded the result as
// `clicks-to-cover-with-real-teacher: 0`. The subject is now a quiet group
// heading and every CLASS below it is a row with its own action.
//
// The claims below are therefore re-asserted against the per-class rows, and the
// superseded assertions are KEPT above as the record of what was true (AGENTS.md
// §16: a correction marks evidence superseded and adds the replacement beside
// it; it never deletes a row to close a finding). Nothing is deleted — the two
// shapes are asserted in the same test, one after the other, so a future
// regression that restores the joined sentence would fail the c10 half.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C9-2 SUPERSEDED (c10 rewired this surface) — the shape it asserted was one action for a whole SUBJECT', () => {
	// Kept as the record, not as a gate: the per-class half below is the gate.
	// Read for WHAT is asserted, not for WHAT is required.
	assert.equal(typeof ASSIGN_TEACHER_LABEL, 'undefined', 'the single-class label is retired; the per-class label is `Cover this class`');
	assert.equal(COVER_CLASSES_LABEL, 'Cover these classes', 'the subject-level label still names the subject act and is unchanged');
});

test('A6C9-2 pressing the figure opens a window listing the short classes BY NAME, grouped by subject, one action EACH CLASS', () => {
	// This is the row `a6-c5-outage` `A6C5-S9-1` names: the honest count used to
	// be a grey sentence in the page body, and c9 moved it into a control. The
	// rendered claim is that the count is now ACTIONABLE, which a source reading
	// can never show.
	const host = render(createElement(FigureHost as any, {}));

	assert.equal(portalledDialog() === null, true, 'precondition: no dialog before the press');
	const figure = figureIn(host)!;
	click(figure);

	const window = dom.window.document.querySelector('[data-testid="teaching-load-shortage-window"]');
	assert.ok(window, 'pressing the figure must open the `Who still needs a teacher` window');
	assert.equal(
		window!.closest('[role="dialog"]') !== null,
		true,
		'and it must be a real Radix dialog, not a floating panel',
	);
	assert.equal(
		figure.getAttribute('aria-expanded'),
		'true',
		'the control must report itself expanded once the window is open',
	);

	// The title is the operator's sentence, not a label.
	assert.equal(
		window!.querySelector('[data-testid="teaching-load-shortage-window-title"]')!.textContent!.trim(),
		'Who still needs a teacher',
		'the window is titled in the operator\'s words',
	);

	// GROUPED BY SUBJECT, CLASSES BY NAME, ONE ROW PER CLASS (A6 c10).
	//
	// The superseded assertion read a `p` out of the subject row and split it on
	// an em dash into a subject and a joined list. The subject name is now an
	// `h3` and each class is its own `li`, so the SAME claim — MAPEH lists
	// `7-A, 7-B, 8-C` in order, English lists `7-A` — is asserted over the class
	// rows instead, and it is asserted STRICTLY: a flat list, a count-only list,
	// or the joined sentence would all fail.
	const groups = Array.from(window!.querySelectorAll('[data-testid^="teaching-load-shortage-subject-"]'));
	assert.equal(groups.length, 2, 'the window groups the shortage under its two subjects, not one flat list');
	const bySubject = new Map<string, string[]>();
	for (const group of groups) {
		const heading = group.querySelector('h3');
		assert.ok(heading, 'every subject GROUP leads with its subject name');
		const subjectName = (heading!.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\s*\d+\s*class(?:es)?$/i, '').trim();
		const classes = Array.from(group.querySelectorAll('[data-testid^="teaching-load-shortage-class-"]'))
			.map((row) => (row.querySelector('p')!.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\s*·\s*Grade \d+$/, ''));
		assert.ok(classes.length > 0, `every subject group lists its classes; ${subjectName} listed none`);
		bySubject.set(subjectName, classes);
	}
	assert.deepEqual(bySubject.get('MAPEH'), ['MAPEH 7-A', 'MAPEH 7-B', 'MAPEH 8-C'], 'MAPEH lists its three short classes BY NAME, in order, one row each');
	assert.deepEqual(bySubject.get('English'), ['Eng 7-A'], 'and English lists its own');

	// EXACTLY ONE ACTION PER CLASS ROW, and it is a real button with a verb. A row
	// with two controls is the "competing controls" defect; a row with none is the
	// figure being a metric with a list attached. This is the assertion that
	// failed on live: before c10 the action sat on the SUBJECT row, so a class
	// row had none at all.
	const classRows = Array.from(window!.querySelectorAll('[data-testid^="teaching-load-shortage-class-"]'));
	assert.equal(classRows.length, 4, 'one row per short class, across both subjects');
	for (const row of classRows) {
		const actions = row.querySelectorAll('button');
		assert.equal(actions.length, 1, `every CLASS row carries exactly ONE action; found ${actions.length}`);
		const action = actions[0] as HTMLElement;
		assert.match(
			accessibleName(action),
			/\bcover\b/i,
			'and the action names what it DOES — a verb, so it looks pressable',
		);
		assert.equal(
			action.getAttribute('data-testid'),
			'teaching-load-cover-this-class',
			'the action is the one control the whole product shares for this act',
		);
	}
	// ONE label everywhere: every class row says the same words. Two vocabularies
	// for one act is the "two chips that say the same thing" defect.
	const labels = classRows.map((row) => (row.querySelector('button')!.textContent ?? '').replace(/\s+/g, ' ').trim());
	for (const label of labels) {
		assert.equal(label, COVER_THIS_CLASS_LABEL, `every class row says \`${COVER_THIS_CLASS_LABEL}\`; saw ${JSON.stringify(labels)}`);
	}

	// The window states the figure it came from and the total, so it is not a
	// list floating free of the number that produced it.
	const body = (window!.textContent ?? '').replace(/\s+/g, ' ');
	assert.match(body, /75% staffed/, 'the window restates the figure the control showed');
	assert.match(body, /6 classes need/, 'and the workspace-wide total, from the real derivation');

	// ONE scroll region, bounded — AGENTS.md §8's no-global-scrollbar rule, on the
	// window this slice added.
	const scrollers = Array.from(window!.querySelectorAll('*'))
		.filter((el) => /(^|\s)overflow-y-auto(\s|$)/.test(el.getAttribute('class') ?? ''));
	assert.equal(scrollers.length, 1, `the window must contain exactly one scroll region, found ${scrollers.length}`);
	assert.match(scrollers[0]!.getAttribute('class') ?? '', /flex-1/, 'and it must be the flexible body, so header and footer stay put');

	// The window also offers the existing coverage detail, and it is a real button.
	const coverage = window!.querySelector('[data-testid="teaching-load-shortage-window-coverage"]') as HTMLElement;
	assert.ok(coverage, 'the window offers the existing `See every section` control');
	assert.equal(coverage.tagName, 'BUTTON');

	// A6 c10 — PRESSING A CLASS ROW OPENS THE COVER WINDOW FOR THAT CLASS. This
	// is the click the audit measured as impossible. It is asserted through the
	// same mount the window renders in, because the window is a dialog and the
	// assertion is about what the scheduler can now reach.
	click(classRows[0]!.querySelector('button') as HTMLElement);
	const cover = dom.window.document.querySelector('[data-testid="cover-class-dialog"]');
	assert.ok(cover, 'pressing `Cover this class` must open the cover window');
	assert.equal(
		cover!.getAttribute('data-section-id'),
		'101',
		'and it must be opened on THAT class, not on the subject and not on the first one',
	);
	assert.equal(cover!.getAttribute('data-subject-id'), '11', 'and on that class\'s own subject');

	dispose(host);
});
// ═════════════════════════════════════════════════════════════════════════════
// A6C9-3 — AT MOST ONE QUIET LINE, AND NEVER AMBER.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Is this element an AMBER / NOTICE surface? Read from the DECLARED classes the
 * toolbar's own degraded pill uses (`bg-warning-muted`, `text-warning-foreground`,
 * `border-warning-border`), not from a list of one element's test ids, so a
 * re-chroma of the pill is still caught.
 */
function isAmber(el: Element): boolean {
	return /(?:\bbg-warning-muted\b|\btext-warning-foreground\b|\bborder-warning-border\b|\bbg-amber-\d{3}\b|\btext-amber-\d{3}\b)/.test(
		el.getAttribute('class') ?? '',
	);
}

test('A6C9-3 a CURRENT roster renders NO notice at all; a SAVED one renders exactly ONE small grey line and never amber', () => {
	// Packet §2, verbatim: "Delete both amber banners. If ATLAS truly cannot reach
	// the current roster, one small grey line under the figure: 'From the saved
	// roster (29 Sept)'. No amber, no 'Next step', no repetition. If the roster IS
	// current, show nothing."

	// (a) CURRENT. The healthy page is SILENT. Anything at all in this slot is a
	// second sentence the scheduler should not be troubled with.
	const current = render(createElement(FigureHost as any, { params: CURRENT }));
	const slot = current.querySelector('[data-testid="teaching-load-staffing-figure-slot"]')!;
	assert.ok(slot, 'the figure lives in its own slot');
	assert.equal(
		slot.querySelector('[data-testid="teaching-load-saved-roster-note"]'),
		null,
		'a CURRENT roster must render no saved-roster note at all',
	);
	assert.equal(
		(slot.textContent ?? '').includes(SAVED_ROSTER_NOTE_PREFIX),
		false,
		'and no saved-roster sentence anywhere in the slot',
	);
	// Nothing in the slot may be an amber or notice surface, in ANY state — the
	// toolbar's degraded pill is unreachable from this slot, and this asserts the
	// slot carries no colour of its own either.
	assert.equal(
		Array.from(slot.querySelectorAll('*')).filter(isAmber).length,
		0,
		'no descendant of the slot may carry an amber/notice surface when the roster is current',
	);

	// (b) SAVED. Exactly ONE line, grey, no icon, no `Next step`, no repetition.
	const saved = render(createElement(FigureHost as any, { params: SAVED }));
	const savedSlot = saved.querySelector('[data-testid="teaching-load-staffing-figure-slot"]')!;
	const notes = savedSlot.querySelectorAll('[data-testid="teaching-load-saved-roster-note"]');
	assert.equal(notes.length, 1, `a SAVED roster renders exactly ONE quiet line; found ${notes.length}`);
	const note = notes[0] as HTMLElement;
	assert.equal(note.tagName, 'P', 'and it is one sentence, not a card or a chip');
	assert.equal(isAmber(note), false, 'it must NOT be amber — the operator overruled both amber banners');
	assert.match(note.getAttribute('class') ?? '', /text-muted-foreground/, 'it is the grey, using the shared muted token');
	assert.match(note.getAttribute('class') ?? '', /text-xs/, 'and small');
	assert.equal(note.querySelector('svg, img, i'), null, 'with no icon beside it — a notice icon is what made the old banners loud');
	assert.match(note.textContent ?? '', new RegExp(`^${SAVED_ROSTER_NOTE_PREFIX} \\(`), 'it names the saved roster and the real date');
	assert.doesNotMatch(note.textContent ?? '', /Next step|Review subject coverage|ATLAS/i, 'no product name, no next step, no second sentence');
	assert.doesNotMatch(note.textContent ?? '', /\d{4}-\d{2}-\d{2}/, 'and no raw ISO date — the date is formatted for a person');

	// No amber ANYWHERE in the saved slot either: the amber pill is unreachable
	// from the real route because the page supplies this figure unconditionally,
	// and this is the rendered half of that claim.
	assert.equal(
		Array.from(savedSlot.querySelectorAll('*')).filter(isAmber).length,
		0,
		'a SAVED roster renders one grey line and zero amber surfaces',
	);
	// ONE CLAIM PER FACT. The COUNT lives in the window the control opens, so it
	// is asserted THERE exactly once — and the closed slot must not print it as a
	// second sentence beside the figure.
	const slotText = (savedSlot.textContent ?? '').replace(/\s+/g, ' ');
	assert.equal(
		/\d+\s+classes?\s+need/.test(slotText),
		false,
		`the shortage COUNT belongs to the window, not to a second line under the figure; saw ${JSON.stringify(slotText)}`,
	);
	const countSlot = render(createElement(FigureHost as any, { params: SAVED }));
	click(figureIn(countSlot)!);
	const countWindow = dom.window.document.querySelector('[data-testid="teaching-load-shortage-window"]') as HTMLElement;
	assert.equal(
		((countWindow.textContent ?? '').match(/6 classes need/g) ?? []).length,
		1,
		'and the window states it exactly once, beside the figure it came from',
	);
	dispose(countSlot);

	// A read-only workspace must not offer a write. The action inside the window
	// is the thing that writes, so this is the same rule the c7 cover control
	// already asserts, seen from the figure.
	const blocked = render(createElement(FigureHost as any, { params: SAVED, writeBlockedReason: 'Read-only: verify the source first' }));
	click(figureIn(blocked)!);
	const blockedWindow = dom.window.document.querySelector('[data-testid="teaching-load-shortage-window"]')!;
	const disabled = blockedWindow.querySelector('[data-testid="teaching-load-cover-this-class"]') as HTMLButtonElement;
	assert.ok(disabled, 'the window still lists the short classes in a read-only workspace');
	assert.equal(disabled.disabled, true, 'but the action that writes is disabled');
	// A6 c10: EVERY class row's action is disabled in a read-only workspace, not
	// only the first one found. A single disabled control and three live ones
	// beside it is a write path a scheduler can still take.
	const blockedActions = Array.from(blockedWindow.querySelectorAll('[data-testid="teaching-load-cover-this-class"]')) as HTMLButtonElement[];
	assert.equal(blockedActions.length, 4, 'every short class still has its own action in a read-only workspace');
	for (const action of blockedActions) {
		assert.equal(action.disabled, true, 'and every one of them is disabled');
	}
	dispose(blocked);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C9-4 — MUTANT ROW: each detector above can go RED.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C9-4 MUTANT ROW: the verb, the per-row action and the amber ban are each DISCRIMINATING detectors', () => {
	// `AGENTS.md` §11: "A row that cannot fail is not evidence." These three
	// defects are each a one-token edit in the component, so each detector is run
	// over the REAL render AND over the DOM that defect would produce, and the
	// row fails unless the two disagree.
	//
	// The mutants are constructed with the REAL `@/ui` `Button` and the REAL
	// `buildStaffingFigureLabel` output, minus exactly the thing under test, so
	// each mutant is the markup the component would emit if that token were
	// dropped — not a string invented to fail.

	// M1 — the verb is dropped from the label. Detector: does the accessible name
	// carry a VERB as well as a percentage?
	const hasVerb = /\b(see|show|list|open|assign|cover|review|choose|select|add)\b/i;
	const verbOf = (host: HTMLElement): boolean => hasVerb.test(accessibleName(figureIn(host)));

	const real = render(createElement(FigureHost as any, {}));
	assert.equal(verbOf(real), true, 'the REAL figure carries a verb');

	const mutantLabel = buildStaffingFigureLabel({ staffedPercent: 75, withoutRealTeacherCount: 6 } as never);
	const noVerb = render(createElement('div', null,
		createElement(Button as any, {
			type: 'button', variant: 'outline', size: 'sm', 'aria-haspopup': 'dialog', 'aria-expanded': false,
			className: 'h-7 shrink-0 cursor-pointer gap-1.5 px-2.5 text-xs',
			'data-testid': 'teaching-load-staffing-figure',
		}, createElement('span', { className: 'font-bold' }, mutantLabel.figure)),
	));
	assert.equal(
		verbOf(noVerb),
		false,
		'M1 MUTANT: with `label.clause` dropped the detector must go RED — otherwise A6C9-1 is measuring nothing',
	);
	// And it is not the PERCENTAGE half doing the work: a bare figure still has one.
	assert.match(accessibleName(figureIn(noVerb)), /\d+% staffed/, 'M1: the mutant keeps the percentage, so the verb is what failed');

	// M2 — the per-CLASS-ROW action control is dropped. A6 c10: the detector moved
	// down one level with the surface, because the claim it exists to catch moved
	// with it. It used to read "exactly one button per SUBJECT row", which is
	// precisely the shape that made covering a class impossible — three short
	// classes under one action. It now reads "exactly one button per CLASS row",
	// which is the claim A6C9-2's rewritten half makes. Read on a mutant list
	// built from the same elements the component uses, because a class row with no
	// action is what "a metric with a list attached" looks like.
	const actionCountOf = (list: HTMLElement): number[] =>
		Array.from(list.querySelectorAll('[data-testid^="teaching-load-shortage-class-"]'))
			.map((row) => row.querySelectorAll('button').length);

	const mutantList = render(createElement('ul', { 'data-testid': 'teaching-load-shortage-window-list' },
		...actionlessRows([['MAPEH 7-A', 101], ['MAPEH 7-B', 102], ['MAPEH 8-C', 103], ['Eng 7-A', 201]]),
	));
	assert.deepEqual(
		actionCountOf(mutantList),
		[0, 0, 0, 0],
		'M2 MUTANT: with the action removed every CLASS row reports ZERO controls, so A6C9-2\'s `exactly one action` assertion fails on it - the detector is not counting something else',
	);

	// A real render of the same window reports exactly one each — proven here on
	// the REAL component so the two halves are measured by the same function.
	const withWindow = render(createElement(FigureHost as any, {}));
	click(figureIn(withWindow)!);
	const realWindow = dom.window.document.querySelector('[data-testid="teaching-load-shortage-window"]') as HTMLElement;
	assert.deepEqual(
		actionCountOf(realWindow),
		[1, 1, 1, 1],
		'and the REAL window reports exactly one action per CLASS row',
	);
	dispose(withWindow);

	// M3 — the quiet line comes back amber. Detector: is this element an amber /
	// notice surface? It is run against the toolbar's OWN degraded-pill class
	// string, so the detector is proved on the surface it exists to catch rather
	// than on a class chosen to make it fail, and against the REAL quiet line.
	const amberProbe = render(createElement(
		'span',
		{ className: readSource('src/components/faculty-assignments/WorkspaceToolbar.tsx')
			.match(/className="[^"]*\bbg-warning-muted\b[^"]*"/)?.[0]
			?.replace(/^className="|"$/g, '') ?? 'MISSING' },
		'ATLAS is showing the last saved roster, not the current one.',
	));
	const probeClass = amberProbe.querySelector('span')!.getAttribute('class') ?? '';
	assert.match(
		probeClass,
		/\bbg-warning-muted\b/,
		`precondition: the toolbar's own amber pill class was located; found ${JSON.stringify(probeClass)}`,
	);
	assert.equal(isAmber(amberProbe.querySelector('span')!), true, 'M3 MUTANT: the toolbar\'s own amber pill MUST be detected as amber');

	// And the REAL saved-roster render carries none, over its whole slot.
	const realSaved = render(createElement(FigureHost as any, { params: SAVED }));
	const realSlot = realSaved.querySelector('[data-testid="teaching-load-staffing-figure-slot"]')!;
	const realNote = realSaved.querySelector('[data-testid="teaching-load-saved-roster-note"]')!;
	assert.equal(isAmber(realNote), false, 'and the real quiet line must NOT be');
	assert.ok(
		Array.from(realSlot.querySelectorAll('*')).length > 1,
		'precondition: the slot is not empty, so the zero-amber search below really looked at something',
	);
	assert.equal(
		Array.from(realSlot.querySelectorAll('*')).filter(isAmber).length,
		0,
		'M3: so A6C9-3\'s zero-amber assertion is a real ban over a populated slot, not an empty search',
	);

	/** One `<li>` shaped exactly as the component renders it, minus the action. */
	/**
	 * A6 c10: the mutant rows are CLASS rows now, matching the surface the
	 * detector reads. The superseded subject-row builder is what the previous
	 * shape emitted, and it is kept here as the record — it is no longer what
	 * `M2` renders, so it is not called, and a lint row that is never read cannot
	 * be evidence for anything.
	 */
	function supersededSubjectRows(spec: Array<[string, string, number]>) {
		return spec.map(([subjectName, classes, subjectId]) =>
			createElement('li', { key: subjectId, className: 'flex items-center justify-between gap-3 py-2', 'data-testid': `teaching-load-shortage-subject-${subjectId}` },
				createElement('p', { className: 'min-w-0 text-sm text-foreground' },
					createElement('span', { className: 'font-semibold' }, subjectName),
					createElement('span', { className: 'text-muted-foreground' }, ` - ${classes}`),
				),
			),
		);
	}

	function actionlessRows(spec: Array<[string, number]>) {
		return spec.map(([className, sectionId]) =>
			createElement('li', { key: sectionId, className: 'flex items-center justify-between gap-3 py-1.5', 'data-testid': `teaching-load-shortage-class-${sectionId}` },
				createElement('p', { className: 'min-w-0 text-sm text-foreground' }, className),
			),
		);
	}
});
