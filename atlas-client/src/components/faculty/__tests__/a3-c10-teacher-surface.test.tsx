/**
 * A3-C10-S4 — the c10 re-issue of Fix 22, Fix 24 and Fix 25 on the Teachers
 * roster.
 *
 * WHY THIS FILE EXISTS ALONGSIDE `a3-teachers-load-c3.test.tsx`.
 *
 * That file carries the EARLIER cycle's controls, two of which encode a
 * narrowing that c10 overrules. They are marked SUPERSEDED in place there (a
 * correction is additive: the control is never deleted), and the corrected
 * assertions live here beside them. Where the two files disagree, this file is
 * the one c10 stands behind.
 *
 *   - Fix 22's `F22-1`/`F22-2` asserted that the display helper NEVER changes
 *     letter casing. The original criterion says "Teacher names render
 *     consistently uppercase in targeted UI", so that control is superseded.
 *   - Fix 24's `F24-1` asserted the shortened labels "Add temporary" and
 *     "Refresh roster" fit. The original requested copy is
 *     `Create temporary teacher (Teacher X)` and `Refresh teacher list`, so that
 *     control is superseded.
 *
 * WHAT IS DELIBERATELY NOT CLAIMED HERE.
 *
 * No test in this file asserts a pixel width. JSDOM reports every
 * `getBoundingClientRect()` as 0, so a test that "proves" the label fits would
 * be proving nothing. `actionLabelFits` is therefore exercised as the PURE
 * function it is, over the real longest label at 1366px and at a narrow width,
 * and the runtime half publishes `data-label-fits` for a real-browser pass to
 * read. `unmeasurable` is asserted to be a distinct outcome so a no-layout
 * environment can never masquerade as a pass.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement, useState } from 'react';
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

const { FacultyRosterActions } = await import('@/components/faculty/FacultyRosterActions');
const { FacultyWorkloadModal } = await import('@/components/faculty/FacultyWorkloadModal');
const { FacultyIdentityCell } = await import('@/components/faculty/FacultyRow');
const { getTeacherRepairIntent, useFacultyRowActions } = await import('@/components/faculty/FacultyRowActions');
const {
	formatFacultyDisplayName,
	formatFacultyStoredName,
	formatFacultyInitials,
	teacherNameSortKey,
} = await import('@/components/faculty/teacherNameDisplay');
const {
	actionLabelFits,
	measureRosterActionLabel,
	LONGEST_ROSTER_ACTION_LABEL,
	UPDATE_TEACHER_LIST_LABEL,
	temporaryTeacherActionLabel,
	ACTION_LABEL_PADDING_PX,
} = await import('@/components/faculty/rosterActionLabels');
const { buildTeacherWorkloadView } = await import('@/components/faculty/teacherWorkloadProfile');
const { findScrollableAncestor } = await import('@/components/faculty/rosterScrollMemory');
const { useRosterScrollMemory } = await import('@/components/faculty/rosterScrollMemory');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

/**
 * Source text with comments and doc-comments removed.
 *
 * A `doesNotMatch(source, /<Link\b/)` over raw source is a trap: the file's own
 * explanation of the Fix 25 history contains the string `<Link>`, so the control
 * fails on prose rather than on code. Every source assertion below runs on the
 * stripped text.
 */
function code(relative: string): string {
	return read(relative)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

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

function buttonsIn(root: ParentNode): HTMLButtonElement[] {
	return Array.from(root.querySelectorAll('button'));
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** The exact mixed-casing pair Lane C observed live at 1366x768. */
const AGUILAR: any = {
	id: 1, firstName: 'CARLO MIGUEL', lastName: 'AGUILAR', department: 'Mathematics',
	employmentStatus: 'REGULAR', employeeId: 'E1', isActiveForScheduling: true,
	isClassAdviser: false, isPlaceholder: false, maxHoursPerWeek: 40,
	policyCreditedHours: 20, sectionTeachingHours: 20, actualTeachingHours: 20,
	subjectCount: 2, sectionCount: 2, advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0,
	advisedSectionName: null, version: 1, assignments: [],
};
const ALCANTARA: any = {
	...AGUILAR,
	id: 2, firstName: 'Roberto', lastName: 'Alcantara', department: 'English',
	policyCreditedHours: 18, actualTeachingHours: 18, subjectCount: 1, sectionCount: 1,
};
/** A teacher with a real assignment so the modal has classes to show. */
const DELA_CRUZ: any = {
	id: 9, firstName: 'Maria', lastName: 'Dela Cruz', department: 'Mathematics',
	employmentStatus: 'REGULAR', employeeId: 'EMP-0009', isActiveForScheduling: true,
	isClassAdviser: true, isPlaceholder: false, maxHoursPerWeek: 40,
	policyCreditedHours: 24, sectionTeachingHours: 20, actualTeachingHours: 20,
	subjectCount: 3, sectionCount: 4, advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0,
	advisedSectionName: 'Rizal', version: 1,
	// A coherent policy: 20h taught against a 30h standard is 66.67% utilised
	// with 600 minutes (10h) of room left. Every figure below is consistent, so
	// a projection error shows up as a wrong number rather than as a fixture that
	// happened to satisfy the assertion.
	teachingUtilizationPercent: 66.67, teachingCapacityRemainingMinutes: 600,
	excessTeachingMinutes: 0, rotationFamilyOvercountHours: 0,
	assignments: [
		{
			id: 1, subjectId: 5, gradeLevels: [7], sectionIds: [101],
			sections: [{ id: 101, name: 'St. Anne', gradeLevelId: 7, gradeLevelName: 'GR7', maxCapacity: 40, enrolledCount: 38, displayOrder: 1 }],
			subject: { id: 5, name: 'Mathematics', code: 'MATH', minMinutesPerWeek: 300 },
		},
	],
};

// ─────────────────────────────────────────────────────────── Fix 22

test('F22-c10-1 the display name is UPPERCASE for BOTH stored casings, and the stored value is untouched', () => {
	// The live defect: these two teachers sit on the same screen with the same
	// renderer, and any stored-casing-preserving renderer shows them differently.
	assert.equal(formatFacultyDisplayName(AGUILAR), 'AGUILAR, CARLO MIGUEL');
	assert.equal(formatFacultyDisplayName(ALCANTARA), 'ALCANTARA, ROBERTO');
	// The defect was that these two rendered differently on ONE screen. They now
	// agree on the one standard, so neither can look foreign beside the other.
	assert.equal(
		/\b[a-z]/.test(formatFacultyDisplayName(AGUILAR)),
		/\b[a-z]/.test(formatFacultyDisplayName(ALCANTARA)),
		'both names must render through the same uppercase standard',
	);
	assert.doesNotMatch(formatFacultyDisplayName(ALCANTARA), /[a-z]/, 'no lowercase letter may survive the display transform');

	// The underlying value is still there, byte for byte.
	assert.equal(formatFacultyStoredName(ALCANTARA), 'Alcantara, Roberto');
	// And the input object was not mutated: display-only, never a rewrite.
	assert.equal(ALCANTARA.firstName, 'Roberto');
	assert.equal(ALCANTARA.lastName, 'Alcantara');
	assert.equal(AGUILAR.lastName, 'AGUILAR');
});

test('F22-c10-2 search and sort still run on the UNDERLYING value, so "alcantara" matches', () => {
	// Search: the roster's client filter lower-cases the query and matches it
	// against the stored fields, exactly as pages/Faculty.tsx does.
	const query = 'alcantara'.toLowerCase();
	const matched = [AGUILAR, ALCANTARA].filter(
		(f) =>
			f.firstName.toLowerCase().includes(query) ||
			f.lastName.toLowerCase().includes(query) ||
			(f.department ?? '').toLowerCase().includes(query) ||
			(f.specialization ?? '').toLowerCase().includes(query),
	);
	assert.equal(matched.length, 1, 'a lowercase search must still find the Title Case teacher');
	assert.equal(matched[0].lastName, 'Alcantara');
	// ...even though the row displays UPPERCASE.
	assert.equal(formatFacultyDisplayName(matched[0]), 'ALCANTARA, ROBERTO');

	// Sort: the key is derived from the stored fields, so a display change cannot
	// reorder the roster. Both names sort by their stored last name.
	assert.equal(teacherNameSortKey(ALCANTARA).toLowerCase(), 'alcantara roberto');
	assert.equal(teacherNameSortKey(AGUILAR).toLowerCase(), 'aguilar carlo miguel');
	assert.ok(
		teacherNameSortKey(AGUILAR).localeCompare(teacherNameSortKey(ALCANTARA)) < 0,
		'AGUILAR must sort before Alcantara by stored value',
	);

	// The sort key must NOT be the display string: if it were, an uppercase
	// display would have leaked into ordering.
	assert.notEqual(teacherNameSortKey(ALCANTARA), formatFacultyDisplayName(ALCANTARA));
});

test('F22-c10-3 avatar initials are uppercase too (the badges/avatars audit row)', () => {
	assert.equal(formatFacultyInitials(ALCANTARA), 'RA');
	assert.equal(formatFacultyInitials(AGUILAR), 'CA');
	assert.equal(formatFacultyInitials({ firstName: 'Roberto', lastName: null }), 'R');
	assert.equal(formatFacultyInitials({ firstName: null, lastName: null }), '');
});

test('F22-c10-4 the roster identity cell renders the uppercase name and uppercase initials', () => {
	const host = render(createElement(FacultyIdentityCell as any, { faculty: ALCANTARA }));
	const text = host.textContent ?? '';
	assert.match(text, /ALCANTARA, ROBERTO/, 'the visible name must be uppercase');
	assert.doesNotMatch(text, /Alcantara, Roberto/, 'the stored casing must not reach the display');
	assert.match(text, /RA/, 'the avatar initials must be uppercase');
	// Display-only: the fixture is untouched by rendering it.
	assert.equal(ALCANTARA.lastName, 'Alcantara');
});

test('F22-c10-5 the centralized formatter standardises the two out-of-fence consumers without editing them', () => {
	// `WorkloadInspector` and `TeacherGridMode` live in `components/faculty-assignments/`,
	// owned by the parallel FIX-26 lane. Neither may be edited from here. The
	// centralized formatter is what makes the standard reach them.
	for (const file of [
		'src/components/faculty-assignments/WorkloadInspector.tsx',
		'src/components/faculty-assignments/TeacherGridMode.tsx',
	]) {
		assert.match(
			read(file),
			/import \{[^}]*formatFacultyDisplayName[^}]*\} from '@\/components\/faculty\/teacherNameDisplay'/,
			`${file} must render names through the centralized formatter`,
		);
	}
	// Nothing in this lane writes a name: no uppercasing on a write path.
	assert.doesNotMatch(
		read('src/pages/Faculty.tsx'),
		/firstName:\s*[A-Za-z_.]*toUpperCase|lastName:\s*[A-Za-z_.]*toUpperCase/,
		'no persisted name may be rewritten on any write path',
	);
});

// ─────────────────────────────────────────────────────────── Fix 24

test('F24-c10-1 the rendered labels are the ORIGINAL requested copy, verbatim', () => {
	const host = render(
		createElement(FacultyRosterActions as any, {
			onCreateTemporary: () => {},
			onRefreshRoster: () => {}, syncing: false, isOnline: true, refreshing: false,
		}),
	);
	const texts = buttonsIn(host).map((b) => (b.textContent ?? '').trim());

	// `Create Temporary` -> `Create temporary teacher (Teacher X)`. Fix 24.2: `X`
	// is the operator's LITERAL capital X, not the next roster number, so the
	// label is the same string at every roster size.
	assert.ok(
		texts.includes('Create temporary teacher (Teacher X)'),
		`expected the restored create copy, got ${JSON.stringify(texts)}`,
	);
	// FIX 24.1 renames the refresh copy once more: `Refresh teacher list` ->
	// `Update teacher list`. The EXISTING roster sync function is unchanged; only
	// the label is relabelled, so the constant is renamed with it.
	assert.equal(UPDATE_TEACHER_LIST_LABEL, 'Update teacher list');
	assert.ok(
		texts.includes(UPDATE_TEACHER_LIST_LABEL),
		`expected "Update teacher list", got ${JSON.stringify(texts)}`,
	);
	// The narrowed strings are gone.
	assert.ok(!texts.includes('Add temporary'), 'the narrowed create copy must be gone');
	assert.ok(!texts.includes('Refresh roster'), 'the narrowed refresh copy must be gone');
	assert.ok(!texts.some((t) => t === 'Refresh teacher roster'), 'the 21-character copy must be gone');
	// The replacement really is the longer, more specific string the criterion
	// asked for — the earlier cycle shortened it, c10 restores it.
	assert.ok(
		'Create temporary teacher (Teacher X)'.length > 'Add temporary'.length,
		'the restored label must not be the shortened one',
	);
});

/**
 * F24.2 EXACTNESS — the parenthetical is a LITERAL `X`.
 *
 * This is the control that distinguishes fix 24.2 from the behaviour it replaced.
 * An interpolation and a literal produce the same string for one number, so
 * "the label is present" cannot tell them apart; only "the parenthetical carries
 * no digits" can, and only across more than one roster size.
 */
test('F24.2-1 the create label renders a LITERAL X, with no digits in the parenthetical', () => {
	// The exported single source, and the function that must no longer take a
	// number. `temporaryTeacherActionLabel.length` is 0: an ignored parameter
	// would be a future lie about where the copy comes from.
	assert.equal(temporaryTeacherActionLabel.length, 0, 'the label must no longer accept a number argument');
	assert.equal(temporaryTeacherActionLabel(), 'Create temporary teacher (Teacher X)');

	// The token where the teacher NUMBER used to be, read out of the rendered
	// string rather than sliced at a hand-counted offset (a brittle slice that
	// silently shifts the moment the prefix is reworded).
	const parenthetical = /\(([^)]*)\)\s*$/.exec('Create temporary teacher (Teacher X)')?.[1] ?? '';
	assert.equal(parenthetical, 'Teacher X', 'the parenthetical is not the requested text');
	assert.equal(
		/\d/.test(parenthetical),
		false,
		`the parenthetical must contain no digits, got ${JSON.stringify(parenthetical)}`,
	);
	assert.equal(
		parenthetical.trim().split(/\s+/).pop(),
		'X',
		'the token in place of the teacher number must be a bare capital X',
	);

	// And the same holds on a RENDERED button, at two very different roster
	// counts, which is exactly what the interpolation used to change.
	for (const totalCount of [1, 42, 9999]) {
		const host = render(
			createElement(FacultyRosterActions as any, {
				onCreateTemporary: () => {},
				onRefreshRoster: () => {}, syncing: false, isOnline: true, refreshing: false,
			}),
		);
		const texts = buttonsIn(host).map((b) => (b.textContent ?? '').trim());
		assert.ok(
			texts.includes('Create temporary teacher (Teacher X)'),
			`roster size ${totalCount} must render the literal label, got ${JSON.stringify(texts)}`,
		);
		// A rendered label can never carry a number, at any roster size.
		assert.equal(
			/Create temporary teacher \(Teacher \d+\)/.test(texts.join(' | ')),
			false,
			`a number was interpolated into the label at roster size ${totalCount}`,
		);
	}

	// The fit budget is decided ONCE, not re-derived from a live count.
	assert.equal(LONGEST_ROSTER_ACTION_LABEL, 'Create temporary teacher (Teacher X)');
});

test('F24-c10-2 the same string source drives both header buttons', () => {
	// Both actions are the same two strings, so the copy must come from one
	// source and cannot drift. Asserted on the comment-stripped source, because
	// the module's own explanation of the rename history would otherwise be
	// counted as code.
	const source = code('src/components/faculty/FacultyRosterActions.tsx');
	// The meaningful property is not an occurrence count (a label is legitimately
	// read more than once, e.g. for `data-label`), it is that NEITHER copy is
	// ever spelled out as a literal here. A literal is what allowed the desktop
	// and menu variants to drift in the first place.
	assert.doesNotMatch(source, /['"`]Create temporary teacher/, 'the create copy must not be duplicated as a literal');
	assert.doesNotMatch(source, /['"`]Update teacher list/, 'the update copy must not be duplicated as a literal');
	// Both are constructed only through the shared module. Fix 24.2 removed the
	// number argument, so the call is now argument-free; the RENDERED text is
	// pinned separately by `F24.2-1`, which is the behavioural proof (this row
	// deliberately checks only that the copy is not spelled out as a literal at
	// a call site).
	assert.match(source, /temporaryTeacherActionLabel\(\)/);
	assert.match(source, /:\s*UPDATE_TEACHER_LIST_LABEL/);
	// The hard-coded narrowed strings are gone from the code.
	assert.doesNotMatch(source, /['"`]Add temporary/);
	assert.doesNotMatch(source, /['"`]Refresh roster/);
	// Fix 24.2: the dead plumbing is gone, not left behind as an ignored prop.
	// An unused parameter is a future lie about where the label comes from.
	assert.doesNotMatch(
		source,
		/nextTeacherNumber/,
		'nextTeacherNumber survived in FacultyRosterActions; an ignored prop is a future lie',
	);
	assert.doesNotMatch(
		read('src/pages/Faculty.tsx'),
		/nextTeacherNumber/,
		'the roster-count computation is dead in pages/Faculty.tsx and must be removed',
	);
});

test('F24-c10-3 no raw title attribute survives on the header actions (AGENTS.md §8)', () => {
	const host = render(
		createElement(FacultyRosterActions as any, {
			onCreateTemporary: () => {},
			onRefreshRoster: () => {}, syncing: false, isOnline: true, refreshing: false,
		}),
	);
	for (const button of buttonsIn(host)) {
		assert.equal(
			button.getAttribute('title'),
			null,
			`"${(button.textContent ?? '').trim()}" must not carry a raw title attribute`,
		);
	}
	// The extra information moved to the @/ui Tooltip rather than being dropped.
	assert.match(
		read('src/components/faculty/FacultyRosterActions.tsx'),
		/Update the teacher list from EnrollPro/,
		'the "from EnrollPro" detail must survive as Tooltip content',
	);
	// And the accessible name is the visible label (WCAG 2.5.3 Label in Name), so
	// no `aria-label` may contradict the visible text.
	for (const button of buttonsIn(host)) {
		assert.equal(button.getAttribute('aria-label'), null, 'the visible label is the accessible name');
	}
});

test('F24-c10-4 the action row grows to its labels, and cannot wrap or clip them', () => {
	const host = render(
		createElement(FacultyRosterActions as any, {
			onCreateTemporary: () => {},
			onRefreshRoster: () => {}, syncing: false, isOnline: true, refreshing: false,
		}),
	);
	const row = host.querySelector('[data-testid="faculty-roster-action-row"]') as HTMLElement;
	assert.ok(row, 'the action row must exist to carry the fit contract');
	const rowClass = row.getAttribute('class') ?? '';
	assert.match(rowClass, /\bw-max\b/, 'the row must grow to its full intrinsic width');
	assert.match(rowClass, /\bshrink-0\b/, 'the row must not be squeezed');
	for (const button of buttonsIn(row)) {
		assert.match(
			button.getAttribute('class') ?? '',
			/\bwhitespace-nowrap\b/,
			`"${(button.textContent ?? '').trim()}" must be nowrap so it cannot wrap`,
		);
	}
});

test('F24-c10-5 the fit predicate is exercised at 1366x768 and at a narrow width, over the real longest label', () => {
	// A realistic rendered width for the longest label this row can ever be
	// asked to show, in a 12px semibold UI font.
	const longestLabelPx = 268;
	// 1366x768, the size Lane C reported at.
	assert.equal(actionLabelFits(longestLabelPx, 900, 1366).outcome, 'fits');
	// Narrow: the row is still `w-max`, so it takes what it needs down to a
	// narrow viewport rather than clipping.
	assert.equal(actionLabelFits(longestLabelPx, 320, 390).outcome, 'fits');
	// A label that genuinely cannot fit is reported as clipping, not as a pass.
	const clipped = actionLabelFits(longestLabelPx, 120, 1366);
	assert.equal(clipped.outcome, 'clips');
	assert.equal(clipped.available, 120 - ACTION_LABEL_PADDING_PX);
	// The measured case is the FIXED literal label. Fix 24.2 removed the number
	// interpolation, so the fit budget is a constant decided at authoring time
	// and is identical at every roster size.
	assert.equal(LONGEST_ROSTER_ACTION_LABEL, 'Create temporary teacher (Teacher X)');
	assert.equal(
		/\d/.test(LONGEST_ROSTER_ACTION_LABEL.slice(LONGEST_ROSTER_ACTION_LABEL.indexOf('('))),
		false,
		'the longest label must carry no digits',
	);
});

test('F24-c10-6 a JSDOM measurement is UNMEASURABLE, never a pass', () => {
	// JSDOM reports every rect as 0. If "fits" were the default, a test with no
	// layout engine would certify the very thing it cannot see.
	const degenerate = actionLabelFits(0, 0, 0);
	assert.equal(degenerate.outcome, 'unmeasurable');
	// The runtime half publishes `unmeasurable` until a real engine lays it out.
	const row = dom.window.document.createElement('div');
	const label = dom.window.document.createElement('span');
	row.appendChild(label);
	assert.equal(row.dataset.labelFits, undefined, 'nothing is claimed before measurement');
	assert.equal(measureRosterActionLabel(label, row, 1366).outcome, 'unmeasurable');
	assert.equal(row.dataset.labelFits, 'unmeasurable');
	// A missing element is also unmeasurable, never a pass.
	assert.equal(measureRosterActionLabel(null, row, 1366).outcome, 'unmeasurable');
});

// ─────────────────────────────────────────────────────────── Fix 25

test('F25-c10-1 the row action is a button for EVERY intent variant, not a link', () => {
	// All four intents share this one control. Leaving any variant as a link
	// would have left the defect half-fixed.
	const variants = [
		{ teacher: DELA_CRUZ, task: 'review', label: 'Review load' },
		{ teacher: { ...DELA_CRUZ, subjectCount: 0, sectionCount: 0 }, task: 'missing-load', label: 'Assign teaching load' },
		{ teacher: { ...DELA_CRUZ, policyCreditedHours: 44 }, task: 'over-cap', label: 'Move classes' },
		{ teacher: { ...DELA_CRUZ, isPlaceholder: true }, task: 'review-placeholders', label: 'Review temporary' },
		{ teacher: { ...DELA_CRUZ, isActiveForScheduling: false }, task: 'review', label: 'View details' },
	];
	for (const variant of variants) {
		assert.equal(getTeacherRepairIntent(variant.teacher).task, variant.task);
		assert.equal(getTeacherRepairIntent(variant.teacher).label, variant.label);
	}

	// The source of the row action must contain no router Link at all.
	const source = code('src/components/faculty/FacultyRowActions.tsx');
	assert.doesNotMatch(source, /to=\{?`?\/teaching-load/, 'the row action must not navigate');
	assert.doesNotMatch(source, /<Link\b/, 'the row action must not render a link');
	// ...and the page must not reintroduce one.
	assert.doesNotMatch(
		code('src/pages/Faculty.tsx'),
		/\/teaching-load\?facultyId=/,
		'pages/Faculty.tsx must not navigate to /teaching-load from a row action',
	);
});

/**
 * Roster + row action + modal wired EXACTLY as `pages/Faculty.tsx` wires them.
 *
 * This is a harness, not the page: it renders the real `useFacultyRowActions`,
 * `useRosterScrollMemory` and `FacultyWorkloadModal` in the same arrangement, so
 * the round trip below exercises production behaviour. The page's own use of the
 * same three symbols is asserted separately in `F25-c10-5`, so the harness
 * cannot quietly diverge from the page.
 */
function RosterHarness(props: { faculty: any; searchQuery: string; sortField: string }) {
	const [target, setTarget] = useState<any>(null);
	const scroll = useRosterScrollMemory();
	const rowActions = useFacultyRowActions({
		onReviewLoad: (teacher: any, event: any) => {
			scroll.captureFrom(event.currentTarget);
			setTarget({ faculty: teacher, intent: getTeacherRepairIntent(teacher) });
		},
		onOpenProfile: () => {},
		onEditTemporary: () => {},
		onDeleteTemporary: () => {},
	});
	return createElement(
		'div',
		null,
		// The roster's own scroll region, as `AdminWorkspaceFrame` provides it.
		createElement(
			'div',
			{ 'data-testid': 'roster-scroll', style: { overflowY: 'auto', height: '400px' } },
			createElement('input', {
				'data-testid': 'roster-search', value: props.searchQuery, readOnly: true,
			}),
			createElement('div', { 'data-testid': 'roster-sort' }, props.sortField),
			rowActions.primary(props.faculty),
		),
		createElement(FacultyWorkloadModal as any, {
			faculty: target?.faculty ?? null,
			open: target !== null,
			intent: target?.intent ?? null,
			scrollRegionRef: scroll.regionRef,
			onClose: () => { scroll.restore(); setTarget(null); },
		}),
	);
}

test('F25-c10-2 Review load opens the modal IN PLACE and does not navigate', () => {
	let navigations: string[] = [];
	const Routed = (props: any) => createElement(
		'div',
		null,
		createElement('a', { href: '/teachers', 'data-testid': 'home-link', onClick: () => { navigations.push('/teachers'); } }, 'home'),
		createElement(RosterHarness as any, props),
	);
	const host = render(createElement(Routed as any, { faculty: DELA_CRUZ, searchQuery: '', sortField: 'name' }));

	assert.equal(dom.window.document.querySelector('[role="dialog"]'), null, 'precondition: no dialog before the click');
	click(host.querySelector('[data-testid="teacher-row-primary-action"]')!);

	const dialog = dom.window.document.querySelector('[role="dialog"]');
	assert.ok(dialog, 'the click must OPEN a dialog, not leave the page');
	// The row action was a button, so no anchor navigation could have occurred.
	assert.equal(
		dom.window.document.querySelector('[data-testid="teacher-row-primary-action"]')!.tagName,
		'BUTTON',
		'the row action must be a button',
	);
	assert.deepEqual(navigations, [], 'opening the modal must not navigate');

	// The dialog is centred, bounded and scrolls internally.
	const content = dom.window.document.querySelector('[data-testid="faculty-workload-modal"]')!;
	const cls = content.getAttribute('class') ?? '';
	assert.match(cls, /sm:max-w-\d/, 'the modal must have a bounded, responsive width');
	assert.match(cls, /max-h-\[/, 'the modal must be height-bounded so it scrolls internally');
	assert.match(cls, /overflow-hidden/, 'the modal frame must not itself scroll');
	assert.ok(content.querySelector('.overflow-auto'), 'the modal body must scroll internally');
});

test('F25-c10-3 the modal data matches the SELECTED teacher', () => {
	const host = render(createElement(RosterHarness as any, { faculty: DELA_CRUZ, searchQuery: '', sortField: 'name' }));
	click(host.querySelector('[data-testid="teacher-row-primary-action"]')!);

	// Identity, uppercase per Fix 22.
	const title = dom.window.document.querySelector('[data-testid="faculty-workload-modal-title"]')!;
	assert.equal(title.textContent, 'DELA CRUZ, MARIA');

	const dialogText = dom.window.document.querySelector('[data-testid="faculty-workload-modal"]')!.textContent ?? '';
	// Weekly hours and the remaining-room figure, both from the selected teacher.
	assert.match(dialogText, /20h/, 'the selected teacher\'s weekly teaching hours must be shown');
	assert.match(dialogText, /Room for more classes/, 'remaining room for classes must be shown');
	assert.match(dialogText, /10\.0h/, 'the remaining-room figure must match the selected teacher');
	assert.match(dialogText, /DELA CRUZ, MARIA/, 'the identity must be the selected teacher');
	assert.match(dialogText, /Mathematics|GR7|St\. Anne/, 'assigned classes / identity detail must be shown');
	// The unconfigured-policy panel must NOT appear for a teacher whose policy
	// figures are present, i.e. real data is rendered rather than a fallback.
	assert.doesNotMatch(dialogText, /Teaching standard not configured/);
});

test('F25-c10-4 the deep link navigates ONLY when clicked, and carries the same intent', () => {
	const host = render(createElement(RosterHarness as any, { faculty: DELA_CRUZ, searchQuery: '', sortField: 'name' }));
	click(host.querySelector('[data-testid="teacher-row-primary-action"]')!);

	const deep = dom.window.document.querySelector('[data-testid="faculty-workload-deep-link"]') as HTMLAnchorElement;
	assert.ok(deep, 'the optional deep link must still exist');
	assert.equal(deep.tagName, 'A', 'the deep link is the one anchor in the modal');
	const href = deep.getAttribute('href') ?? '';
	assert.equal(href, '/teaching-load?facultyId=9&task=review', 'the deep link must reproduce facultyId and task');
});

test('F25-c10-5 roster FILTER state and SCROLL POSITION survive the modal round trip', () => {
	const host = render(
		createElement(RosterHarness as any, {
			faculty: DELA_CRUZ, searchQuery: 'del', sortField: 'weeklyLoad',
		}),
	);
	const region = host.querySelector('[data-testid="roster-scroll"]') as HTMLElement;
	// A real scroll offset on a real scrollable element.
	region.scrollTop = 240;

	const search = () => (host.querySelector('[data-testid="roster-search"]') as HTMLInputElement).value;
	const sort = () => host.querySelector('[data-testid="roster-sort"]')!.textContent;
	assert.equal(search(), 'del');
	assert.equal(sort(), 'weeklyLoad');
	assert.equal(region.scrollTop, 240, 'precondition: the roster really is scrolled');

	click(host.querySelector('[data-testid="teacher-row-primary-action"]')!);
	assert.ok(dom.window.document.querySelector('[role="dialog"]'), 'the modal opened');

	// Simulate the scroll the shared Dialog's background scroll lock / the
	// user's own scrolling can produce while the modal is open.
	region.scrollTop = 0;
	assert.equal(region.scrollTop, 0, 'precondition: something did move the offset');

	// Dismiss through the modal's own Close control.
	const close = Array.from(dom.window.document.querySelectorAll('button'))
		.find((b) => (b.textContent ?? '').trim() === 'Close')!;
	click(close);

	assert.equal(dom.window.document.querySelector('[role="dialog"]'), null, 'the modal must be closed');
	assert.equal(region.scrollTop, 240, 'the roster scroll offset must be restored to 240');
	// Filter and sort were never touched: they are React state in the same
	// component, and the modal is a sibling of the roster, not a route.
	assert.equal(search(), 'del', 'the search filter must be unchanged after the round trip');
	assert.equal(sort(), 'weeklyLoad', 'the sort order must be unchanged after the round trip');
});

test('F25-c10-6 the scrollable ancestor is resolved from the clicked control, not guessed', () => {
	const outer = dom.window.document.createElement('div');
	outer.style.overflowY = 'auto';
	const inner = dom.window.document.createElement('div');
	const button = dom.window.document.createElement('button');
	outer.appendChild(inner);
	inner.appendChild(button);
	dom.window.document.body.appendChild(outer);
	hosts.push(outer);

	assert.equal(findScrollableAncestor(button), outer, 'the nearest scrollable ancestor is the roster region');
	// No scrollable ancestor anywhere means null, not a guessed container: a
	// wrong region would restore an offset the user never set.
	const detached = dom.window.document.createElement('button');
	assert.equal(findScrollableAncestor(detached), null);
});

test('F25-c10-7 the page wires the same three symbols the harness does', () => {
	const page = read('src/pages/Faculty.tsx');
	// The modal is a sibling of the table, so the roster is never unmounted.
	assert.match(page, /<FacultyWorkloadModal/);
	assert.match(page, /useRosterScrollMemory\(\)/);
	assert.match(page, /useFacultyRowActions\(/);
	// Filter/sort/page state is never reset by opening the modal.
	assert.doesNotMatch(
		page.slice(page.indexOf('const openWorkloadModal'), page.indexOf('const closeWorkloadModal')),
		/set(SearchQuery|SchedulingFilter|AssignmentFilter|DepartmentFilter|GradeLevelFilter|AttentionFilter|SortField|SortDir|Page)\(/,
		'opening the modal must not mutate roster filter or sort state',
	);
});

test('F25-c10-8 the workload view projects the roster summary, not a different authority', () => {
	const view = buildTeacherWorkloadView(DELA_CRUZ);
	assert.ok(view.loadProfile, 'a load profile is produced for a selected teacher');
	assert.equal(view.loadProfile!.actualTeachingHours, 20);
	assert.equal(view.loadProfile!.creditedTotalHours, 24);
	// Credited total = teaching + advisory/ancillary credit.
	assert.equal(view.loadProfile!.equivalentHours, 4);
	// 20h against the canonical 30h standard is below standard, and the status
	// comes from the ONE shared `deriveLoadStatus`, so it cannot disagree with
	// the rest of the product.
	assert.equal(view.loadProfile!.status, 'below-standard');
	// The remaining-room figure is read from the summary, in minutes -> hours.
	assert.equal(view.loadProfile!.remainingHours, 10);
	// The raw figure reconstructs the teaching hours through the rotation line.
	assert.equal(
		view.loadProfile!.rawTeachingHours - view.loadProfile!.rotationOvercountHours,
		view.loadProfile!.actualTeachingHours,
	);
	assert.equal(view.loadProfile!.breakdown.length, 1, 'the assigned class is present');
	assert.equal(view.loadProfile!.breakdown[0].sectionName, 'St. Anne');
	assert.equal(view.loadProfile!.breakdown[0].gradeLevel, 7);
	// The standard is read from the summary's own arithmetic, not a constant.
	assert.equal(view.teachingStandardHours, 30);

	// Unconfigured policy must be reported honestly, not papered over.
	const unconfigured = buildTeacherWorkloadView({ ...DELA_CRUZ, teachingUtilizationPercent: null, teachingCapacityRemainingMinutes: null });
	assert.equal(unconfigured.policyReady, false);
	assert.equal(unconfigured.teachingStandardHours, null);
	// No teacher selected.
	assert.equal(buildTeacherWorkloadView(null).loadProfile, null);
});

test('F25-c10-9 the modal reuses WorkloadInspector rather than copying its metrics', () => {
	// The one place the modal renders the workload body must be the shared
	// component from the other lane's directory, imported and never edited.
	const modal = read('src/components/faculty/FacultyWorkloadModal.tsx');
	assert.match(modal, /import \{ WorkloadInspector \} from '@\/components\/faculty-assignments\/WorkloadInspector'/);
	assert.match(modal, /<WorkloadInspector/);
	// And this lane did not touch that file.
	assert.doesNotMatch(
		modal,
		/workload-headline|Room for more classes|Classes taught/,
		'the modal must not re-declare the inspector\'s metrics',
	);
});
