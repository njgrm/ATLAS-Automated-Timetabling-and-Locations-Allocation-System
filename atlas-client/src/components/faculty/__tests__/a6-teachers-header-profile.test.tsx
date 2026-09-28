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
