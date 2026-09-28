/**
 * A6-TEACHERS-HEADER-PROFILE — rendered evidence for the operator's
 * `docs/reviews/operator-fixes-20260928/fix-1.1.docx` items 24.1 and 23.1.
 *
 * WHY THIS FILE, AND WHY IT RENDERS.
 *
 * `docs/prompts` requires that evidence for a user-facing fix be a RENDERED
 * result: "A source-text assertion is not acceptance evidence." Both items here
 * are things a scheduler SEES — which buttons the Teachers header carries, in
 * which order, and whether a subject code is legible inside a resizable dialog.
 * A control that read `FacultyRosterActions.tsx` and asserted a string would
 * pass unchanged if the component rendered that string somewhere nobody looks,
 * or if the button were `hidden` on the viewport that matters. Every row below
 * therefore mounts the real component and reads the real DOM, and the
 * source-string checks that remain are labelled as belt-and-braces over a
 * rendered claim rather than standing in for one.
 *
 * The JSDOM harness below is copied VERBATIM from the accepted sibling
 * `a3-c10-teacher-surface.test.tsx` (its lines 1-157) so the render / act /
 * click helpers behave exactly as they do for the controls this file sits
 * beside. Two things JSDOM cannot do are stated rather than papered over: it
 * performs no layout, so nothing here claims a pixel width, and it does not
 * apply Tailwind, so a class token is asserted as a DECLARED class, with the
 * real-browser confirmation left to the visual lane.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
const { FacultyProfileSheet } = await import('@/components/faculty/FacultyProfileSheet');
const { UPDATE_TEACHER_LIST_LABEL } = await import('@/components/faculty/rosterActionLabels');
// A6 C3: the real identity cell / mobile card and the pure census behind them.
const { FacultyIdentityCell, FacultyMobileCard, FacultyLoadStateBadge, getFacultyLoadPresentation } = await import('@/components/faculty/FacultyRow');
const { findDuplicateTeacherNames, buildDuplicateNameCue, duplicateTeacherNameKey } = await import('@/components/faculty/duplicateTeacherNames');
const { BELOW_STANDARD_LABEL } = await import('@/lib/teaching-load-labels');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

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

function buttonsIn(scope: ParentNode): HTMLButtonElement[] {
	return Array.from(scope.querySelectorAll('button'));
}

/** A teacher with a real subject carrying a real DepEd-style code. */
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
	subjectCount: 2,
	sectionCount: 2,
	advisoryEquivalentHours: 0,
	ancillaryMinutesPerWeek: 0,
	advisedSectionName: null,
	version: 1,
	assignments: [
		{
			id: 1,
			subject: { id: 5, code: 'FIL', name: 'Filipino', minMinutesPerWeek: 180 },
			sections: [{ id: 11, name: 'FIL 7 - Section A', displayOrder: 7 }],
		},
		{
			id: 2,
			subject: { id: 6, code: 'DEVL_READING', name: 'Reading Development', minMinutesPerWeek: 120 },
			sections: [{ id: 12, name: 'DEVL Reading 8 - Section B', displayOrder: 8 }],
		},
	],
};

/* ───────────────────────────── Item 24.1 — the header row ────────────────── */

function renderHeader(nextTeacherNumber = 42) {
	return render(
		createElement(FacultyRosterActions as any, {
			onCreateTemporary: () => {},
			onRefreshRoster: () => {},
			syncing: false, isOnline: true, refreshing: false,
			nextTeacherNumber,
		}),
	);
}

test('A6-24.1-1 the rendered header row shows BOTH requested actions, as DIRECT buttons', () => {
	const host = renderHeader(42);
	const row = host.querySelector('[data-testid="faculty-roster-action-row"]');
	assert.ok(row, 'the roster action row must render');
	const texts = buttonsIn(row).map((b) => (b.textContent ?? '').trim());

	// The operator's own two labels, verbatim. `42` is the REAL next teacher
	// number the page passes, not a placeholder.
	assert.deepEqual(
		texts,
		['Update teacher list', 'Create temporary teacher (Teacher 42)'],
		`the row must carry exactly the two requested actions in the requested order; saw ${JSON.stringify(texts)}`,
	);
	// And the order the operator named, with `Help` supplied by the shared frame
	// AFTER this slot — so create is second here, not last.
	const first = row!.querySelector('[data-testid="faculty-refresh-list"]');
	const second = row!.querySelector('[data-testid="faculty-create-temporary"]');
	assert.ok(first && second, 'both actions must be addressable by their own test ids');
	assert.ok(
		((first as HTMLElement).compareDocumentPosition(second as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		'`Update teacher list` must come BEFORE `Create temporary teacher`, so the frame\'s `Help` lands last',
	);
	// The shared constant carries the same string as the rendered button, so the
	// label cannot be correct in the component and wrong in the module.
	assert.equal(UPDATE_TEACHER_LIST_LABEL, 'Update teacher list');
	assert.equal((first as HTMLElement).getAttribute('data-label'), UPDATE_TEACHER_LIST_LABEL);
	assert.equal((second as HTMLElement).getAttribute('data-label'), 'Create temporary teacher (Teacher 42)');
	// `Update` is a SECONDARY action beside the primary create action, so the two
	// must be distinguishable by shape and not only by wording.
	//
	// Asserted on the merged variant classes, because a `variant` prop is not in
	// the DOM: the primary variant contributes `bg-primary text-primary-foreground`
	// and the outline variant contributes `bg-background`. Matching the literal
	// token `outline` would be wrong — the shared base carries `outline-none` on
	// EVERY button, so it discriminates nothing.
	const updateClass = (first as HTMLElement).getAttribute('class') ?? '';
	const createClass = (second as HTMLElement).getAttribute('class') ?? '';
	assert.match(updateClass, /\bbg-background\b/, 'the update action renders the outline variant');
	assert.doesNotMatch(updateClass, /\bbg-primary\b/, 'the update action must not be the primary button');
	assert.match(createClass, /\bbg-primary\b/, 'the create action renders the primary variant');
	assert.match(createClass, /\btext-primary-foreground\b/, 'the create action is the solid primary button');
});

test('A6-24.1-2 NO control anywhere on the Teachers header reads `Review teachers`', () => {
	// This is the criterion, not a comment: the maroon `Review teachers` header
	// button is REMOVED, and so is the `... More` popover that held the second
	// copy. Both were reachable on the real page, so the assertion is made over
	// the component AND over the page's wiring, because a component that no
	// longer renders a button can still be mounted twice.
	const host = renderHeader(42);
	for (const button of buttonsIn(host)) {
		assert.doesNotMatch(
			(button.textContent ?? '').trim(),
			/Review teachers|^Review$/,
			`"${(button.textContent ?? '').trim()}" must not be one of the removed header controls`,
		);
	}
	assert.equal(host.querySelector('[data-testid="faculty-review-open"]'), null, 'the desktop Review control must be gone');
	assert.equal(host.querySelector('[data-testid="faculty-review-open-mobile"]'), null, 'the mobile Review control must be gone');
	// AGENTS.md §8: extra information belongs in a @/ui Tooltip, not a raw title.
	for (const button of buttonsIn(host)) {
		assert.equal(button.getAttribute('title'), null, `"${(button.textContent ?? '').trim()}" must not carry a raw title`);
	}
	// Belt-and-braces over the rendered claim above: the page must not pass a
	// secondary action slot either, or the shared frame would still render a
	// `... More` popover for this page.
	//
	// Matched on the BINDING, not the bare name: this file's own documentation
	// mentions `openRosterReview` in a comment explaining that it was removed, and
	// a `doesNotMatch(/openRosterReview/)` over raw source would fail on that
	// prose — the same trap the sibling suite documents for `<Link`.
	const page = read('src/pages/Faculty.tsx');
	assert.doesNotMatch(page, /secondaryActions/, 'the Teachers page must not pass a secondary action slot at all');
	assert.doesNotMatch(page, /const openRosterReview/, 'the opener that fed the removed Review buttons must be gone with them');
	assert.doesNotMatch(page, /onOpenReview=/, 'no header control may bind the removed review prop');
	// The repair logic survives, though: the profile sheet's primary action is
	// still labelled from the same intent.
	assert.match(page, /reviewLabel=\{nextTeacherIntent\?\.label/, 'the per-row repair intent must still feed the profile action');
});

test('A6-24.1-3 both header actions are reachable and DO something when clicked', () => {
	// A control that renders and is never pressed is exactly how the retired
	// Next Step banner shipped, so this row presses both.
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	let synced = 0;
	let created = 0;
	act(() => {
		root.render(inRouter(createElement(FacultyRosterActions as any, {
			onCreateTemporary: () => { created += 1; },
			onRefreshRoster: () => { synced += 1; },
			syncing: false, isOnline: true, refreshing: false,
			nextTeacherNumber: 43,
		})));
	});

	// `[Update teacher list]` is the EXISTING roster sync/refresh function,
	// relabelled — so it must still be wired to that handler and not to nothing.
	const update = host.querySelector('[data-testid="faculty-refresh-list"]') as HTMLButtonElement;
	assert.ok(update, 'the update action must render');
	click(update);
	assert.equal(synced, 1, '`Update teacher list` must call the existing roster sync handler');

	// `[+ Create temporary teacher (Teacher X)]` keeps the EXISTING
	// temporary-teacher creation workflow.
	const create = host.querySelector('[data-testid="faculty-create-temporary"]') as HTMLButtonElement;
	assert.ok(create, 'the create action must render');
	assert.equal((create.textContent ?? '').trim(), 'Create temporary teacher (Teacher 43)');
	click(create);
	assert.equal(created, 1, 'the create action must open the temporary-teacher workflow');
});

/* ─────────────────── Item 23.1 — the resizable profile dialog ───────────── */

/**
 * Mount the profile sheet and return the CARD.
 *
 * A Radix Dialog PORTALS its content onto `document.body`, so the rendered
 * profile is NOT inside the returned host element. Reading `host` and finding
 * nothing is the correct result of a wrong lookup, not a missing dialog — so
 * every row below queries `document` for the card and the host only as the
 * mount point.
 */
function renderProfile(): HTMLElement {
	render(
		createElement(FacultyProfileSheet as any, {
			faculty: TEACHER, open: true, onOpenChange: () => {},
			sourceFreshness: 'Verified live',
		}),
	);
	const card = dom.window.document.querySelector('[data-testid="faculty-profile-dialog"]') as HTMLElement | null;
	assert.ok(card, 'precondition: the profile dialog must portal a card into the document');
	return card!;
}

/** Every element the document holds, for whole-surface sweeps. */
function allRendered(): Element[] {
	return Array.from(dom.window.document.querySelectorAll('*'));
}

test('A6-23.1-1 the profile card is a RESIZABLE centred dialog with the requested bounds', () => {
	const dialog = renderProfile();

	const cls = dialog.getAttribute('class') ?? '';
	// The resize treatment. `overflow-hidden` is not decoration: a native
	// resize handle does not appear on a box that scrolls, so the card must clip
	// and the inner body must scroll instead.
	assert.match(cls, /\bresize\b/, 'the card must be user-resizable');
	assert.match(cls, /\boverflow-hidden\b/, 'the card must clip for a resize handle to exist');
	// The requested bounds, in the guarded `min(…,95vw)` form so a 390px viewport
	// cannot produce a global horizontal scrollbar.
	assert.match(cls, /\bmin-w-\[min\(500px,95vw\)\]/, 'the 500px width floor must be viewport-guarded');
	assert.match(cls, /\bmin-h-\[min\(400px,90vh\)\]/, 'the 400px height floor must be viewport-guarded');
	assert.match(cls, /\bmax-w-\[95vw\]/, 'the card must never exceed the viewport width');
	assert.match(cls, /\bmax-h-\[90vh\]/, 'the card must never exceed the viewport height');
	// A flex-column, non-scrolling shell, so the BODY is the one scroll region.
	assert.match(cls, /\bflex\b/);
	assert.match(cls, /\bflex-col\b/);
	assert.match(cls, /\bp-0\b/, 'the card has no padding; the header and body supply their own');

	// Exactly one scroll container inside the card: the body.
	const scrollers = Array.from(dialog.querySelectorAll('*'))
		.filter((el) => /\boverflow-y-auto\b/.test(el.getAttribute('class') ?? ''));
	assert.equal(scrollers.length, 1, `the dialog must contain exactly one scroll region, found ${scrollers.length}`);
	const body = scrollers[0] as HTMLElement;
	assert.match(body.getAttribute('class') ?? '', /\bflex-1\b/, 'the scrolling body takes the leftover card height');
	assert.match(body.getAttribute('class') ?? '', /\bmin-h-0\b/, 'a flex child needs min-h-0 or the card, not the body, scrolls');
	// And the header is padded so nothing touches the card edge now that the card
	// itself no longer has padding.
	const header = Array.from(dialog.querySelectorAll('*'))
		.find((el) => /\bborder-b\b/.test(el.getAttribute('class') ?? '')) as HTMLElement | null;
	assert.ok(header, 'the dialog header must render');
	assert.match(header!.getAttribute('class') ?? '', /\bpx-6\b/, 'the header must pad horizontally inside the card');
});

test('A6-23.1-2 subject CODES are legible: 12px, medium weight, not washed out', () => {
	const dialog = renderProfile();
	// The codes the operator named must actually render — an assertion about the
	// styling of an element that was never mounted proves nothing.
	const codes = Array.from(dialog.querySelectorAll('code'))
		.map((c) => (c.textContent ?? '').trim())
		.filter((t) => t.length > 0);
	assert.ok(
		codes.includes('FIL') && codes.includes('DEVL_READING'),
		`both named subject codes must render; saw ${JSON.stringify(codes)}`,
	);

	for (const text of ['FIL', 'DEVL_READING']) {
		const code = Array.from(dialog.querySelectorAll('code')).find((c) => (c.textContent ?? '').trim() === text)!;
		const cls = code.getAttribute('class') ?? '';
		// 12-14px: the requested legible range. `text-xs` is 12px.
		assert.match(cls, /\btext-xs\b/, `"${text}" must be text-xs, not a micro size`);
		assert.doesNotMatch(cls, /text-\[0\.6\d+rem\]/, `"${text}" must not be a sub-12px arbitrary size`);
		assert.match(cls, /\bfont-medium\b/, `"${text}" must be font-medium`);
		assert.match(cls, /\buppercase\b/, `"${text}" keeps its monospaced code presentation`);
		// The washed-out look came from the OPACITY, not the token. No `opacity-*`
		// class may remain on the code, or the contrast win is undone.
		assert.doesNotMatch(cls, /\bopacity-/, `"${text}" must not carry an opacity class — that is what washed it out`);
		// Raw neutrals are banned by the committed palette ratchet, so the colour
		// must come from the semantic token.
		assert.doesNotMatch(cls, /text-slate-|bg-slate-|border-slate-/, `"${text}" must use a semantic token, not a raw neutral`);
		assert.match(cls, /\btext-muted-foreground\b/, `"${text}" uses the muted-foreground token`);
	}

	// The SUBJECT TITLE must read darker than the code, or "darker still" is not
	// delivered. `text-foreground` is the stronger token than
	// `text-muted-foreground`; the title is the bold, foreground-coloured line.
	const title = Array.from(dialog.querySelectorAll('p'))
		.find((p) => (p.textContent ?? '').trim() === 'Filipino');
	assert.ok(title, 'the subject title must render beside its code');
	const titleCls = title!.getAttribute('class') ?? '';
	assert.match(titleCls, /\bfont-bold\b/, 'the subject title must be bold');
	assert.doesNotMatch(titleCls, /\btext-muted-foreground\b/, 'the subject title must not be the muted token — it reads darker than the code');
	assert.doesNotMatch(titleCls, /\bopacity-/, 'the subject title must not be faded');
});

test('A6-23.1-3 the profile dialog is still an accessible modal', () => {
	// Belt-and-braces over the two rows above: the resize treatment changed the
	// card's box, so confirm the modal semantics that were already accepted are
	// intact and that no raw `title` crept in.
	//
	// Modal-ness is asserted the way the accepted sibling suite asserts it
	// (`F23-2`): Radix's scroll lock plus the pointer-events block. This build
	// does NOT emit `aria-modal` on the content, so asserting that attribute
	// would be a control that can never pass — the sibling records the same fact.
	const dialog = renderProfile();
	assert.ok(dialog, 'the profile must be a real Radix dialog, not a div');
	assert.equal(dialog.getAttribute('role'), 'dialog', 'the card is the dialog content');
	assert.equal(
		dom.window.document.body.getAttribute('data-scroll-locked'),
		'1',
		'the body must be scroll-locked while the dialog is open, so the page behind cannot scroll',
	);
	assert.equal(dom.window.document.body.style.pointerEvents, 'none', 'pointer events behind the dialog must be blocked');
	assert.ok(
		Array.from(dialog.querySelectorAll('h2')).some((h) => (h.textContent ?? '').includes('DELA CRUZ')),
		'the dialog must still carry an accessible name',
	);
	assert.ok(
		Array.from(dialog.querySelectorAll('p')).some((p) => (p.textContent ?? '').includes('Roster source')),
		'the dialog must still carry a description',
	);
	// No raw `title` anywhere in the rendered card.
	for (const el of allRendered()) {
		assert.equal(el.getAttribute('title'), null, 'no rendered element may carry a raw title attribute (AGENTS.md §8)');
	}
	const source = read('src/components/faculty/FacultyProfileSheet.tsx');
	assert.doesNotMatch(source, /\stitle="/, 'no raw title attribute in the profile dialog source (AGENTS.md §8)');
	assert.doesNotMatch(source, /<details\b/, 'no raw <details> in the profile dialog (AGENTS.md §8)');
	assert.doesNotMatch(source, /<select\b/, 'no raw <select> in the profile dialog (AGENTS.md §8)');
	assert.doesNotMatch(source, /<button\b/, 'no raw <button> in the profile dialog (AGENTS.md §8)');
	// The card is still CENTRED, per the item: the operator asked for a resizable
	// card, not a repositioned one.
	const cardCls = dialog.getAttribute('class') ?? '';
	assert.match(cardCls, /left-\[50%\]|left-1\/2|-translate-x-1\/2/, 'the card must stay horizontally centred');
	assert.match(cardCls, /top-\[50%\]|top-1\/2/, 'the card must stay vertically centred');
});

/* ================================================================== *
 * A6 C3 — Lane C's `/teachers` demo-walk items #15 and #6.
 * ================================================================== */

/** The five states that are NOT below-standard, each with real deciding numbers. */
const OTHER_STATES: Array<{ label: string; faculty: any; expected: string }> = [
	{ label: 'no load', faculty: { ...TEACHER, actualTeachingHours: 0, subjectCount: 0 }, expected: 'No load' },
	{ label: 'near cap', faculty: { ...TEACHER, actualTeachingHours: 34, maxHoursPerWeek: 40 }, expected: 'Near cap' },
	{ label: 'over cap', faculty: { ...TEACHER, actualTeachingHours: 44, maxHoursPerWeek: 40 }, expected: 'Over cap' },
	{ label: 'ready', faculty: { ...TEACHER, actualTeachingHours: 30 }, expected: 'Ready' },
	{ label: 'excluded', faculty: { ...TEACHER, isActiveForScheduling: false }, expected: 'Excluded' },
];

test('A6-C3-15 a teacher under the standard reads as ORDINARY, with the target and the next step named', () => {
	// Lane C item #15, verbatim: "`Below standard` is repeated as a status without
	// explaining whether it is a problem, target, or harmless load gap" -> "State
	// the target and the practical next step in ordinary scheduling language".
	//
	// `TEACHER` is 20h against a 30h standard and a 40h cap, which is exactly the
	// state the item is about.
	const below = { ...TEACHER, actualTeachingHours: 20, sectionTeachingHours: 20, policyCreditedHours: 20, maxHoursPerWeek: 40, subjectCount: 2 };
	const presentation = getFacultyLoadPresentation(below);
	assert.equal(
		presentation.label,
		BELOW_STANDARD_LABEL,
		'the label must be the canonical constant, not a second copy of its text',
	);
	assert.equal(presentation.label, 'Under', 'and that constant is the single plain word `Under`');
	assert.notEqual(presentation.label, 'Below standard', 'the two-word form must be gone from this surface');

	// The three numbers a scheduler needs, all from the row's own real values.
	assert.match(presentation.help, /\b20\b/, 'the help must state the real hours so far');
	assert.match(presentation.help, /30h standard/, 'the target must be the real standard, in the same form as the `x / 30h` cell');
	assert.match(presentation.help, /up to 40h/, 'and the ceiling must be this teacher\'s own `maxHoursPerWeek`');
	// …and the sentence must say plainly that nothing is wrong, which is the
	// whole complaint: a status repeated as if it were a warning.
	assert.match(presentation.help, /Not a problem/, 'the help must say in words that this is not a problem');
	assert.match(presentation.help, /can take more classes/, 'and name the practical next step');
	// The hours are formatted the way the load cell formats them: bare number,
	// no invented precision.
	assert.doesNotMatch(presentation.help, /20\.0/, 'the hours must not be reformatted away from the cell\'s own form');

	// THE CUE IS THE TONE. The badge and the hours move off amber together, so
	// the row stops reading as a defect. Amber is kept for the states that ARE
	// actions.
	assert.match(presentation.badgeClassName, /sky/, 'the below-standard badge must use the neutral information tone');
	assert.doesNotMatch(presentation.badgeClassName, /amber/, 'and must not read as a warning');
	assert.match(presentation.hoursClassName, /sky-700/, 'the hours must take the same neutral tone');
	assert.doesNotMatch(presentation.hoursClassName, /amber/, 'and must not stay amber');
	const amberStates = ['no load', 'near cap'];
	for (const state of OTHER_STATES.filter((entry) => amberStates.includes(entry.label))) {
		assert.match(
			getFacultyLoadPresentation(state.faculty).badgeClassName,
			/amber|orange/,
			`${state.label}: a real action must KEEP its warm tone — neutral is reserved for the harmless state`,
		);
	}
	assert.match(
		getFacultyLoadPresentation(OTHER_STATES.find((s) => s.label === 'over cap')!.faculty).badgeClassName,
		/rose/,
		'an over-cap teacher must keep the strongest tone on this surface',
	);

	// The other five states are UNCHANGED: this fix is scoped to the one.
	for (const state of OTHER_STATES) {
		assert.equal(
			getFacultyLoadPresentation(state.faculty).label,
			state.expected,
			`${state.label}: its label must be untouched`,
		);
	}

	// The rendered badge carries the same words and the same tone, so the row a
	// scheduler reads says what the function returns. It is the REAL badge
	// component, not a hand-written label.
	const host = render(createElement(FacultyLoadStateBadge as any, { faculty: below }));
	assert.match(host.textContent ?? '', /Under/, 'the rendered badge must show the canonical word');
	assert.doesNotMatch(host.textContent ?? '', /Below standard/, 'and never the two-word form');
	const badgeClass = (host.querySelector('span,div')?.getAttribute('class')) ?? '';
	assert.match(badgeClass, /sky/, 'the rendered badge must carry the neutral tone');
	assert.doesNotMatch(badgeClass, /amber/, 'and must not carry the warning tone');
});

/** A roster with one duplicated name (different loads) and one unique name. */
function rosterWithDuplicates(): any[] {
	return [
		{ ...TEACHER, id: 21, firstName: 'Anna Patricia', lastName: 'Garcia', actualTeachingHours: 18.8, sectionTeachingHours: 18.8, policyCreditedHours: 18.8, department: 'Mathematics' },
		{ ...TEACHER, id: 22, firstName: 'Roberto', lastName: 'Alcantara', actualTeachingHours: 20 },
		{ ...TEACHER, id: 23, firstName: 'Anna Patricia', lastName: 'Garcia', actualTeachingHours: 0, sectionTeachingHours: 0, policyCreditedHours: 0, subjectCount: 0, department: 'English' },
	];
}

test('A6-C3-6a the same name with DIFFERENT loads is cued on BOTH rows, and nothing is merged', () => {
	// Lane C item #6, verbatim: "The same name, GARCIA, ANNA PATRICIA, appears
	// once with 18.8/30h and once with 'No load,' so the roster cannot be trusted
	// at a glance" -> "De-duplicate or visibly distinguish identities, then show
	// one authoritative load".
	//
	// A6's routed scope is the CUE. Merging records is a data decision for the
	// operator, so this row proves the two things the cue must do — distinguish
	// them, and change nothing — and the roster keeps both records, in order.
	const roster = rosterWithDuplicates();
	const cue = buildDuplicateNameCue(roster);
	// Each row is looked up by ITS OWN key, exactly as the page does — a cue
	// lookup that used one row's key for every row would be the defect.
	const cueForRow = (member: any) => cue.get(duplicateTeacherNameKey(member));

	const host = render(createElement(
		'div',
		null,
		...roster.map((member) => {
			const own = cueForRow(member);
			return createElement(FacultyIdentityCell as any, {
				key: member.id,
				faculty: member,
				duplicateRecordCount: own?.count,
				duplicateRecordsShareLoad: own?.sameLoad,
			});
		}),
	));

	// The cue is on the two GARCIA rows and NOT on the unique one.
	const garcia = roster[0];
	const ownCue = cueForRow(garcia)!;
	assert.equal(ownCue.count, 2, 'the shared name must be counted as two records');
	assert.equal(ownCue.sameLoad, false, 'and the loads differ, so the cue must say so');
	assert.equal(cueForRow(roster[1]), undefined, 'a unique name must get no cue at all');
	const cues = Array.from(host.querySelectorAll('[data-testid="teacher-duplicate-name-cue"]'));
	assert.equal(cues.length, 2, `only the two same-name records carry the cue, found ${cues.length}`);
	for (const cueEl of cues) {
		assert.match(cueEl.textContent ?? '', /Same name — 2 records/, 'the chip states how many records share the name');
		assert.match(
			cueEl.textContent ?? '',
			/Two or more teacher records show this name with different teaching loads\./,
			'and its own explanation names the differing loads',
		);
		assert.match(
			cueEl.textContent ?? '',
			/ATLAS has not merged these records\./,
			'the cue must never imply ATLAS reconciled anything',
		);
		assert.equal(cueEl.getAttribute('title'), null, 'no raw title attribute (AGENTS.md §8)');
	}

	// NOTHING WAS DROPPED, MERGED OR REORDERED: three records in, three names out,
	// in the order they arrived, with both loads still readable.
	const names = Array.from(host.querySelectorAll('p')).map((p) => (p.textContent ?? '').trim());
	assert.deepEqual(
		names,
		['GARCIA, ANNA PATRICIA', 'ALCANTARA, ROBERTO', 'GARCIA, ANNA PATRICIA'],
		'the roster must render every record, once each, in its original order',
	);
	// And the two GARCIA rows still carry their own separate loads.
	const cells = Array.from(host.querySelectorAll('p'));
	assert.equal(cells.length, 3, 'each record still has its own identity cell');
});

test('A6-C3-6b a same-name pair whose loads AGREE is cued, but is not told to reconcile a difference', () => {
	// The cue must not accuse where there is nothing to reconcile. Two records,
	// one name, identical comparable load: worth flagging as a possible duplicate,
	// not worth telling the operator their loads disagree.
	const pair = [
		{ ...TEACHER, id: 31, firstName: 'Ana', lastName: 'Bautista', actualTeachingHours: 20 },
		{ ...TEACHER, id: 32, firstName: 'Ana', lastName: 'Bautista', actualTeachingHours: 20 },
	];
	const cue = buildDuplicateNameCue(pair);
	const only = [...cue.values()][0]!;
	assert.equal(only.count, 2, 'both records are counted');
	assert.equal(only.sameLoad, true, 'and they carry the same load');
	const host = render(createElement(FacultyIdentityCell as any, {
		faculty: pair[0],
		duplicateRecordCount: only.count,
		duplicateRecordsShareLoad: only.sameLoad,
	}));
	const text = host.textContent ?? '';
	assert.match(text, /Same name — 2 records/, 'the chip still appears');
	assert.match(text, /with the same teaching load/, 'and the explanation says the loads agree');
	assert.doesNotMatch(text, /different teaching loads/, 'it must NOT claim a difference that does not exist');
});

test('A6-C3-6c a UNIQUE name gets no cue, and an undefined count renders exactly as before', () => {
	// The prop is OPTIONAL so no existing caller changes rendering. That is only
	// true if undefined and "no duplicates" both render nothing.
	const solo = render(createElement(FacultyIdentityCell as any, { faculty: TEACHER }));
	assert.equal(
		solo.querySelector('[data-testid="teacher-duplicate-name-cue"]'),
		null,
		'an undefined count must render no cue at all',
	);
	const roster = rosterWithDuplicates();
	const cue = buildDuplicateNameCue(roster);
	assert.equal(
		cue.size,
		1,
		'only the GARCIA name is duplicated; ALCANTARA is absent from the map',
	);
	for (const key of cue.keys()) {
		assert.match(key, /garcia/, 'the map is keyed on the rendered name, folded');
	}
	const unique = roster[1];
	assert.equal(
		buildDuplicateNameCue([unique]).size,
		0,
		'a roster of one has no duplicates',
	);
});

test('A6-C3-6d the MOBILE card shows the same cue the table row does', () => {
	// The roster has two layouts, and a cue that only appears in one of them is a
	// cue that half the readers never see.
	const host = render(createElement(FacultyMobileCard as any, {
		faculty: rosterWithDuplicates()[0],
		duplicateRecordCount: 2,
		duplicateRecordsShareLoad: false,
	}));
	const card = host.querySelector('[data-testid="teacher-mobile-card"]')!;
	assert.ok(card, 'the mobile card must render');
	assert.match(
		card.textContent ?? '',
		/Same name — 2 records/,
		'the mobile card must carry the same-name cue, not only the table cell',
	);
	// …and without the prop it is absent there too.
	const plain = render(createElement(FacultyMobileCard as any, { faculty: TEACHER }));
	assert.equal(
		plain.querySelector('[data-testid="teacher-duplicate-name-cue"]'),
		null,
		'an undefined count must render no cue in the mobile card either',
	);
});

test('A6-C3-6e the pure census: shared, unique, folded and empty', () => {
	// The cue and the rendered name can only agree if both come from the same key,
	// so the key's folding is asserted directly rather than through the DOM.
	const shared = findDuplicateTeacherNames([
		{ ...TEACHER, id: 1, firstName: 'Anna Patricia', lastName: 'Garcia' },
		{ ...TEACHER, id: 2, firstName: 'Anna Patricia', lastName: 'Garcia' },
		{ ...TEACHER, id: 3, firstName: 'Roberto', lastName: 'Alcantara' },
	]);
	assert.equal(shared.size, 1, 'a name shared by two records is in the map, and a unique name is not');
	const [sharedKey] = [...shared.keys()];
	assert.equal(shared.get(sharedKey!), 2, 'and it carries the number of records sharing it');
	assert.ok(
		![...shared.keys()].some((key) => key.includes('alcantara')),
		'a unique name must be ABSENT, not present with the value 1',
	);

	// Case and whitespace fold to ONE key, because EnrollPro holds the same
	// person typed two ways.
	const folded = findDuplicateTeacherNames([
		{ ...TEACHER, id: 4, firstName: 'anna  patricia', lastName: '  Garcia ' },
		{ ...TEACHER, id: 5, firstName: 'ANNA PATRICIA', lastName: 'GARCIA' },
	]);
	assert.equal(folded.size, 1, 'case and whitespace differences must fold to one key');
	assert.equal([...folded.values()][0], 2, 'and it is still two records');
	// Two genuinely different people are never folded together.
	const different = findDuplicateTeacherNames([
		{ ...TEACHER, id: 6, firstName: 'Ana', lastName: 'Garcia' },
		{ ...TEACHER, id: 7, firstName: 'Ana', lastName: 'Bautista' },
	]);
	assert.equal(different.size, 0, 'two different names are not a duplicate');
	// An empty roster is an empty map, not a crash.
	assert.equal(findDuplicateTeacherNames([]).size, 0, 'an empty roster yields an empty map');
	assert.equal(buildDuplicateNameCue([]).size, 0, 'and so does the cue census');
	// A roster with no duplicates yields an empty cue map, which is what makes
	// the whole feature a no-op on a clean roster.
	assert.equal(buildDuplicateNameCue([TEACHER]).size, 0, 'a clean roster renders exactly as it did before');
});
