/**
 * A3-C16-NO-CODES-ON-SCREEN — rendered evidence that the Teachers roster leads
 * with a subject NAME, not an internal code.
 *
 * WHY THIS FILE, AND WHY IT RENDERS.
 *
 * The defect the operator named is a thing a scheduler SEES: the "Assigned
 * classes" cell read `STE_APPLIED_PHYS 1` and `MATH · 8 sections` while the
 * name ("Applied Physics") sat unread on the same record. A source-text
 * assertion cannot decide that — it would pass unchanged if the component
 * rendered the name somewhere nobody looks, or kept the code in a branch the
 * test never mounted. Every DOM row below therefore mounts the real component
 * and reads the real rendered text.
 *
 * The JSDOM harness is copied VERBATIM from the accepted sibling
 * `a6-teachers-header-profile.test.tsx` (its lines 26-134) so the render / act /
 * click behaviour matches the controls this file sits beside. Two things
 * JSDOM cannot do are stated rather than papered over: it performs no layout,
 * so nothing here claims a pixel width, and it does not apply Tailwind.
 *
 * The fix follows the precedent already committed in
 * `src/lib/teaching-load-history-plain.ts` (`tlHistorySubjectPrimary` /
 * `tlHistorySubjectCodeDetail`): the name leads, and the code is a muted detail
 * that appears ONLY when it differs from the name and is `''` when it does not.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teachers',
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

const {
	FacultyAssignedClassesCell,
	FacultyMobileCard,
	facultySubjectDisplayName,
	facultySubjectCodeDetail,
} = await import('@/components/faculty/FacultyRow');

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
		{ initialEntries: ['/teachers'] },
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

/** The visible text of a scope, with whitespace collapsed. */
function textOf(scope: ParentNode): string {
	return (scope.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A section shaped like the real `ExternalSection` the roster reads. */
const section = (id: number, name: string, displayOrder: number, gradeLevel: number) => ({
	id, name, displayOrder, gradeLevelId: gradeLevel, gradeLevelName: `Grade ${gradeLevel}`,
});

const FACULTY_BASE: any = {
	id: 9,
	firstName: 'Maria',
	lastName: 'Dela Cruz',
	department: 'Mathematics',
	specialization: null,
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

function facultyWith(assignments: any[]): any {
	return { ...FACULTY_BASE, assignments };
}

/* ───────────────────────── The name-lead helpers (the testable table) ─────── */

test('A3-c16-1 the roster label is the subject NAME; the code is a detail only', () => {
	// The real staging shapes named in the packet.
	assert.equal(facultySubjectDisplayName({ code: 'STE_APPLIED_PHYS', name: 'Applied Physics' }), 'Applied Physics');
	assert.equal(facultySubjectDisplayName({ code: 'SCI_BIO', name: 'Science - Biology' }), 'Science - Biology');
	assert.equal(facultySubjectDisplayName({ code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts' }), 'TLE Exploratory - Agriculture and Fishery Arts');

	// A blank name falls back to the code, so the cell is never empty.
	assert.equal(facultySubjectDisplayName({ code: 'MATH', name: '' }), 'MATH');
	assert.equal(facultySubjectDisplayName({ code: 'MATH', name: '   ' }), 'MATH');

	// No subject record at all: plain words, never an internal id.
	assert.equal(facultySubjectDisplayName(null), 'Unknown subject');
	assert.equal(facultySubjectDisplayName(undefined), 'Unknown subject');
	assert.equal(facultySubjectDisplayName({ code: null, name: null }), 'Unknown subject');
	assert.doesNotMatch(facultySubjectDisplayName(null), /SUBJ#/, 'a bare internal id must never become a label');

	// The code detail follows `tlHistorySubjectCodeDetail`: it appears only when
	// it says something the name does not, and is '' when the label already IS
	// the code. That is what makes "the code appears once" true by construction.
	assert.equal(facultySubjectCodeDetail({ code: 'STE_APPLIED_PHYS', name: 'Applied Physics' }), 'STE_APPLIED_PHYS');
	assert.equal(facultySubjectCodeDetail({ code: 'AP', name: 'AP' }), '');
	assert.equal(facultySubjectCodeDetail({ code: 'ap', name: 'AP' }), '');
	assert.equal(facultySubjectCodeDetail({ code: 'MATH', name: '' }), '', 'the fallback label is the code; the detail must not repeat it');
	assert.equal(facultySubjectCodeDetail(null), '');
});

/* ──────────────────────────── The rendered roster cells ───────────────────── */

test('A3-c16-2 the desktop single-subject cell reads the NAME, not `MATH`', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 5,
				subject: { id: 5, code: 'MATH', name: 'Mathematics' },
				sections: [
					section(11, 'Math 7 - Section A', 7, 7),
					section(12, 'Math 8 - Section B', 8, 8),
					section(13, 'Math 9 - Section C', 9, 9),
				],
			},
		]),
	}));

	const cell = host.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	assert.ok(cell, 'the assigned-classes cell must render');
	const text = textOf(cell!);
	assert.match(text, /^Mathematics · 3 sections/, `the cell must lead with the name; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /MATH/, `the code must not lead the cell; saw ${JSON.stringify(text)}`);
	// The section list and its existing `+N` overflow are untouched.
	assert.match(text, /Sections: GR7 Math 7 - Section A, GR8 Math 8 - Section B \+1/);
});

test('A3-c16-3 the desktop multi-subject cell reads NAMES, not the raw codes', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 41,
				subject: { id: 41, code: 'TLE_ICT_EXP', name: 'TLE Exploratory - ICT' },
				sections: Array.from({ length: 6 }, (_, i) => section(50 + i, `ICT 7 - Section ${i + 1}`, i, 7)),
			},
			{
				id: 2,
				subjectId: 42,
				subject: { id: 42, code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts' },
				sections: Array.from({ length: 10 }, (_, i) => section(70 + i, `AFA 7 - Section ${i + 1}`, i, 7)),
			},
			{
				id: 3,
				subjectId: 43,
				subject: { id: 43, code: 'ESP', name: 'ESP/GMRC' },
				sections: [section(90, 'ESP 8 - Section A', 8, 8)],
			},
		]),
	}));

	const cell = host.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	assert.ok(cell, 'the assigned-classes cell must render');
	const text = textOf(cell!);
	// A3 c16 (D3): these two names are 21 + 41 characters and do not fit the 291px
	// cell on one line, so the cell keeps the FIRST name and reports the rest
	// through the overflow it already had. Row 9 below is the dedicated control.
	assert.match(text, /^TLE Exploratory - ICT 6 \+2 more/,
		`one long name plus the existing overflow; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /TLE_ICT_EXP/, `a raw code was printed; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /TLE_AFA_EXP/, `a raw code was printed; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /Agriculture and Fishery Arts/, `the second long name must not wrap into the cell; saw ${JSON.stringify(text)}`);
});

test('A3-c16-4 the mobile card branch reads NAMES too', () => {
	const single = render(createElement(FacultyMobileCard as any, {
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 5,
				subject: { id: 5, code: 'MATH', name: 'Mathematics' },
				sections: [section(11, 'Math 7 - Section A', 7, 7)],
			},
		]),
		onProfileClick: () => {},
	}));
	const singleTrigger = single.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	assert.ok(singleTrigger, 'the mobile card must render its assigned-classes trigger');
	assert.match(textOf(singleTrigger!), /Mathematics · 1 section/);
	assert.doesNotMatch(textOf(singleTrigger!), /MATH/);

	const multi = render(createElement(FacultyMobileCard as any, {
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 41,
				subject: { id: 41, code: 'TLE_ICT_EXP', name: 'TLE Exploratory - ICT' },
				sections: Array.from({ length: 6 }, (_, i) => section(50 + i, `ICT 7 - Section ${i + 1}`, i, 7)),
			},
			{
				id: 2,
				subjectId: 42,
				subject: { id: 42, code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts' },
				sections: Array.from({ length: 10 }, (_, i) => section(70 + i, `AFA 7 - Section ${i + 1}`, i, 7)),
			},
			{
				id: 3,
				subjectId: 43,
				subject: { id: 43, code: 'ESP', name: 'ESP/GMRC' },
				sections: [section(90, 'ESP 8 - Section A', 8, 8)],
			},
		]),
		onProfileClick: () => {},
	}));
	const multiTriggers = Array.from(multi.querySelectorAll('[data-testid="teacher-row-assigned-classes-summary-trigger"]'));
	const multiText = textOf(multiTriggers[multiTriggers.length - 1]);
	assert.match(multiText, /^TLE Exploratory - ICT 6 \+2 more/);
	assert.doesNotMatch(multiText, /TLE_ICT_EXP|TLE_AFA_EXP/, `a raw code was printed on the mobile card; saw ${JSON.stringify(multiText)}`);
});

/* ─────────────────────────── The assignment breakdown popover ─────────────── */

function openPopover(host: HTMLElement) {
	const trigger = host.querySelector('button[aria-label="View full class breakdown"]');
	assert.ok(trigger, 'the breakdown popover trigger must render');
	click(trigger!);
	return textOf(dom.window.document.body);
}

test('A3-c16-5 the breakdown popover lists the NAME and never leads with the code', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 5,
				subject: { id: 5, code: 'MATH', name: 'Mathematics' },
				sections: [section(11, 'Math 7 - Section A', 7, 7)],
			},
		]),
	}));

	const text = openPopover(host);
	assert.match(text, /Assigned classes/, 'the existing heading must survive');
	assert.match(text, /Mathematics/, 'the popover must list the subject name');
	assert.match(text, /1 section/, 'the existing section count must survive');
	assert.match(text, /GR7/, 'the existing GR range must survive');
	// The code may appear once as a muted detail, but it is never the primary
	// text: the name must precede it on the row.
	assert.ok(
		text.indexOf('Mathematics') < text.indexOf('MATH') || text.indexOf('MATH') === -1,
		`the name must lead the code in the popover; saw ${JSON.stringify(text)}`,
	);
});

test('A3-c16-6 a subject whose name is blank still renders the code, never an empty cell', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 5,
				subject: { id: 5, code: 'SCI_BIO', name: '' },
				sections: [section(11, 'Bio 7 - Section A', 7, 7)],
			},
		]),
	}));

	const cell = host.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	assert.ok(cell, 'the assigned-classes cell must render');
	const text = textOf(cell!);
	assert.match(text, /SCI_BIO · 1 section/, `the code is the documented fallback for a blank name; saw ${JSON.stringify(text)}`);
	// ...and it is the label, so the code detail must not repeat it beside it.
	const popoverText = openPopover(host);
	assert.doesNotMatch(popoverText, /SCI_BIO SCI_BIO/, 'the fallback label must not be duplicated as its own detail');
});

test('A3-c16-7 an assignment with no subject record renders plain words, never `SUBJ#`', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			{
				id: 1,
				subjectId: 12,
				subject: null,
				sections: [section(11, 'Section A', 7, 7)],
			},
		]),
	}));

	const cell = host.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	assert.ok(cell, 'the assigned-classes cell must render');
	const text = textOf(cell!);
	assert.match(text, /Unknown subject · 1 section/, `a missing record must say so in words; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /SUBJ#/, `an internal id must never be printed; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /\b12\b/, `the raw subject id must never be printed; saw ${JSON.stringify(text)}`);

	// The `SUBJ#` synthetic key still exists in the data (it is the React key and
	// the "No sections yet" filter), so the negative control is that it is not
	// READABLE anywhere in the popover either.
	assert.doesNotMatch(openPopover(host), /SUBJ#/);
});

/**
 * A3 c16 (D3) - the rendered 1366x768 pass showed that swapping a code for a
 * name made ONE row worse: a teacher on two long special-program subjects read
 * `Special Program in the Arts: Specialization 2, Special Program in Sports:
 * Specialization 2 +1 more` across three lines, in a row taller than its
 * neighbours, with two near-identical 40-character titles. These rows pin the
 * correction - the cell subtracts the second name rather than adding a clamp,
 * an ellipsis or a line.
 *
 * JSDOM performs no layout, so these assert the RULE and its rendered output.
 * The pixel budget itself was measured in the browser (291px cell, ~40
 * characters at 14px) and is recorded in `pickInlineSubjects`.
 */
const longProgram = (code: string, name: string) => ({
	id: 9,
	subjectId: 9,
	subject: { id: 9, code, name },
	sections: [section(11, 'Arts 7 - Section A', 7, 7), section(12, 'Arts 8 - Section A', 7, 8)],
});

test('A3-c16-8 two SHORT subject names both stay inline on one line', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			{ id: 1, subjectId: 5, subject: { id: 5, code: 'DEVL_READING', name: 'Developmental Reading' }, sections: [section(11, 'Rizal 7', 7, 7)] },
			{ id: 2, subjectId: 6, subject: { id: 6, code: 'FIL', name: 'Filipino' }, sections: [section(12, 'Mabini 7', 7, 8), section(13, 'Mabini 8', 7, 8), section(14, 'Mabini 9', 7, 9), section(15, 'Mabini 10', 7, 10), section(16, 'Mabini 7-B', 7, 7)] },
		]),
	}));

	const cell = host.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	const text = textOf(cell!);
	// This is the improvement: the row used to read `DEVL_READING 1, FIL 5`.
	assert.match(text, /Developmental Reading 1, Filipino 5/, `both short names belong inline; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /DEVL_READING|FIL/, 'no code may appear in the inline cell');
});

test('A3-c16-9 two LONG subject names subtract the second name instead of wrapping', () => {
	const host = render(createElement(FacultyAssignedClassesCell as any, {
		// `onClick` is what makes the cell the interactive wrapper the roster
		// renders, and it is the only branch carrying the addressing test id.
		onClick: () => {},
		faculty: facultyWith([
			longProgram('SPA_SPEC', 'Special Program in the Arts: Specialization'),
			longProgram('SPS_SPEC', 'Special Program in Sports: Specialization'),
			{ id: 3, subjectId: 7, subject: { id: 7, code: 'FIL', name: 'Filipino' }, sections: [section(13, 'Bonifacio 7', 7, 9)] },
		]),
	}));

	const cell = host.querySelector('[data-testid="teacher-row-assigned-classes-summary-trigger"]');
	const text = textOf(cell!);
	assert.match(text, /Special Program in the Arts: Specialization 2 \+2 more/, `the overflow must carry the hidden two; saw ${JSON.stringify(text)}`);
	assert.doesNotMatch(text, /Special Program in Sports/, `the second long name must not wrap into the cell; saw ${JSON.stringify(text)}`);
	// ...and it is still one click away, with its own count intact.
	const popoverText = openPopover(host);
	assert.match(popoverText, /Special Program in Sports: Specialization/, 'the dropped name must remain in the popover breakdown');
	assert.match(popoverText, /Filipino/, 'every subject must remain in the popover breakdown');
});
