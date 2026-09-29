/**
 * A3 C2 — PRESERVATION controls for ledger rows 01 and 02.
 *
 * These two rows are baseline `VERIFIED_FIXED` and were never given a dedicated
 * control; the ledger records them `TODO` for exactly that reason. They must not
 * be promoted on the strength of adjacent tests, so each gets a focused control
 * here that pins the CURRENT behaviour of the room picker:
 *
 *  - row 01: the picker keeps scroll containment. Scrolling inside the picker
 *    must not scroll the page behind it. The mechanism is the bounded popover
 *    body (`flex flex-col` + a declared height) with `shrink-0` header and
 *    footer, so the option list is the ONLY region that can grow or scroll and
 *    the body cannot push the page taller.
 *  - row 02: the picker renders exactly ONE picker layer — no nested or
 *    duplicated picker surface. The picker is a single popover with a single
 *    listbox, and the separate interactive-map modal is a distinct, later,
 *    user-initiated surface rather than a second picker mounted underneath.
 *
 * PRESERVATION, NOT DESCRIPTION. Neither control asserts anything this change
 * introduced: `SectionRoomPicker.tsx` is byte-identical to base `c0d91827`
 * (verified with `git diff c0d91827 -- atlas-client/src/components/sections/`),
 * so both rows pass on base and continue to pass. That is the proof they
 * preserve rather than merely describe the new code.
 *
 * jsdom has no layout engine, so "does not scroll the page" is answered from the
 * committed class contract — the same bounded-height and flex tokens the browser
 * resolves — rather than by asserting by eye. The picker is rendered for real.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, afterEach, test } from 'node:test';
import { act, createElement, useState } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/sections',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	MouseEvent: dom.window.MouseEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	FocusEvent: dom.window.FocusEvent,
	HTMLInputElement: dom.window.HTMLInputElement,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false,
	media: q,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { SectionRoomPicker } = await import('../SectionRoomPicker');
type RoomOption = import('../SectionRoomPicker').RoomOption;
const {
	popoverMaxHeightPx,
	POPOVER_MAX_PX,
	POPOVER_MIN_USABLE_PX,
	POPOVER_SIDE_OFFSET_PX,
	POPOVER_COLLISION_PX,
	POPOVER_SAFETY_PX,
} = await import('../SectionRoomPicker');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

const roots: Root[] = [];
const hosts: HTMLElement[] = [];
// Cleanup is PER TEST, not once at the end. An open picker portals its listbox
// to `<body>`, so a second test would otherwise inherit the first test's still-
// mounted popover and count two layers — which is exactly the condition row 02
// exists to detect. Leaving it also made jsdom exhaust its buffer on two 60-row
// layers (Array buffer allocation failed, 36s).
afterEach(() => {
	for (const r of roots.splice(0)) act(() => { r.unmount(); });
	for (const h of hosts.splice(0)) h.remove();
	dom.window.document.body.innerHTML = '';
});
after(() => {
	dom.window.close();
});

/** More rooms than fit in the popover at any plausible height, so the list is
 *  genuinely longer than its container and containment is a real question. */
const OPTIONS: RoomOption[] = Array.from({ length: 40 }, (_, i) => ({
	id: 200 + i,
	name: `Room ${200 + i}`,
	buildingName: `Grade ${7 + (i % 4)} Building`,
	type: i % 3 === 0 ? 'CLASSROOM' : 'LABORATORY',
}));

function renderPicker() {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const r = createRoot(host);
	roots.push(r);
	function Harness() {
		const [value, setValue] = useState<number | null>(null);
		return createElement(SectionRoomPicker, {
			sectionId: 11,
			sectionName: 'Grade 7 - Rizal',
			value,
			options: OPTIONS,
			onSelect: setValue,
			schoolId: 1,
			roomOccupancy: new Map([[201, 'Grade 9 - Bonifacio Special Program Section A']]),
		});
	}
	act(() => { r.render(createElement(Harness)); });
	return host;
}

function openPopover(host: HTMLElement) {
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	assert.ok(trigger, 'precondition: the combobox trigger exists');
	act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
	if (!dom.window.document.querySelector('[role="listbox"]')) {
		act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })); });
	}
	assert.ok(dom.window.document.querySelector('[role="listbox"]'), 'the room listbox must open');
}

const popoverBody = (listbox: HTMLElement): HTMLElement => {
	const body = listbox.closest('[data-radix-popper-content-wrapper]')?.firstElementChild
		?? listbox.parentElement?.parentElement;
	assert.ok(body, 'precondition: the popover body exists');
	return body as HTMLElement;
};

/* ─────────────────────────────── row 01: scroll containment ─────────────────────────────── */

test('row 01 control: scrolling inside the picker cannot scroll the page behind it', () => {
	const host = renderPicker();
	openPopover(host);

	const listbox = dom.window.document.querySelector('[role="listbox"]') as HTMLElement;
	const body = popoverBody(listbox);
	const bodyClass = body.className;

	// The containment mechanism, token by token. The body is a bounded flex
	// column, so the list cannot make it taller than its declared height and the
	// document behind it is never handed a scroll.
	assert.match(bodyClass, /\bflex\b/, 'the popover body must be a flex column');
	assert.match(bodyClass, /\bflex-col\b/, 'the popover body must be a flex column');
	// A9 C7 (item 46, 2026-09-29) — the body no longer declares a FIXED height.
	// It used to be derived from `h-100`:
	//   const heightToken = /\bh-(\d+)\b/.exec(bodyClass);
	//   assert.ok(heightToken, `the popover body must declare a bounded height; got ${bodyClass}`);
	//   const bodyHeightPx = Number(heightToken![1]) * 4;
	// A fixed 400px body is what Radix had to resolve by COLLISION: a trigger near
	// the top of the viewport could not fit it below, so the popover was pushed up
	// over the sticky toolbar. The bound is now a `max-h-` against the space Radix
	// actually reports, so the body SHRINKS instead of overflowing. The bound is
	// still bounded, which is the property this row exists to protect.
	assert.doesNotMatch(
		bodyClass,
		/\bh-\d/,
		`the popover body must not return to a FIXED height; got ${bodyClass}`,
	);
	assert.match(
		bodyClass,
		/max-h-\[min\(25rem,var\(--radix-popover-content-available-height\)\)\]/,
		`the body must cap itself at 25rem or the space below the trigger; got ${bodyClass}`,
	);
	// 25rem is the old h-100 (0.25rem per unit x 100) in rem, so the ceiling the
	// list may reach is unchanged at 400px. It must fit a 1366x768 and a 390x844
	// viewport alike.
	const capRem = Number(/max-h-\[min\((\d+(?:\.\d+)?)rem/.exec(bodyClass)?.[1] ?? '0');
	const bodyHeightPx = capRem * 16;
	assert.equal(bodyHeightPx, 400, `the cap must be the old 400px ceiling in rem; got ${bodyHeightPx}px`);
	for (const [vw, vh] of [[1366, 768], [390, 844]] as const) {
		assert.ok(bodyHeightPx <= vh, `the picker must fit a ${vw}x${vh} viewport, got ${bodyHeightPx}px`);
	}

	// Header and footer are shrink-0, so the list absorbs the slack and they
	// cannot be squeezed out or made to grow.
	for (const [what, needle] of [
		['header', 'Search room or building...'],
		['footer', 'Browse Interactive Map'],
	] as const) {
		const el = Array.from(dom.window.document.querySelectorAll('button, input')).find((n) =>
			(n.textContent ?? '').includes(needle) || (n as HTMLInputElement).placeholder === needle,
		);
		assert.ok(el, `precondition: the ${what} exists`);
		const row = el!.closest('div');
		assert.ok(row?.className.includes('shrink-0'), `the ${what} must be shrink-0 so it cannot grow with the list`);
	}

	// THE scroll region: exactly one, and it is inside the bounded body. A
	// second scroll region — or one outside the body — is what let the list
	// scroll the page behind it.
	const viewports = Array.from(dom.window.document.querySelectorAll('[data-radix-scroll-area-viewport]'));
	assert.equal(viewports.length, 1, `the picker must own exactly one scroll region, found ${viewports.length}`);
	assert.ok(body.contains(viewports[0]), 'the scroll region must live inside the bounded popover body');
	const scrollRoot = viewports[0].parentElement as HTMLElement;
	assert.match(scrollRoot.className, /overflow-hidden/, 'the scroll area root must clip, so the list cannot escape the body');
	assert.match(scrollRoot.className, /\bflex-1\b/, 'the list must be the one growing region of the flex column');

	// The list is genuinely longer than its container, so containment is doing
	// real work here rather than passing because there was nothing to scroll.
	const options = dom.window.document.querySelectorAll('[role="option"]');
	assert.ok(options.length > 20, `the fixture must overflow the picker, got ${options.length} options`);

	/* A9 C7 R3 — THE ASSERTION THIS ROW WAS MISSING, and the one that separates a
	 * SCROLLING list from a CLIPPED one. Everything above proves a scroll region
	 * EXISTS and that the root clips; none of it proves the viewport is smaller
	 * than its content, which is the only thing that makes it scroll. That gap is
	 * why R1 passed every suite.
	 *
	 * R1 replaced the body's definite `h-100` with a `max-h-[…]` MAXIMUM, and a
	 * maximum is not a height: it leaves the container's height indefinite for its
	 * children, so `flex-1` on the ScrollArea root has nothing to resolve against,
	 * the root takes its full content height and the viewport never shrinks.
	 * Measured on real staging data (planner, 2026-09-29, preview :5262, 79
	 * options): ScrollArea root 160px, scroll viewport `clientHeight 5448
	 * scrollHeight 5448`. The operator saw "Unassigned" plus one or two rooms out
	 * of 78 and could not reach the rest.
	 *
	 * jsdom lays nothing out, so `clientHeight` and `scrollHeight` are both 0 and
	 * the relation cannot be READ off the DOM here. It can still be DECIDED, by
	 * installing the two outcomes the browser actually produces and asking which
	 * one the element has been given the means to reach. The model is the two
	 * measured cases, not a guess:
	 *
	 *   DEFINITE body height  → the flex column resolves `flex-1`, the viewport is
	 *     what is left after the shrink-0 chrome, and it SCROLLS. Measured: a
	 *     400px body left 160px for the list (`5448 → 160`, and it then accepted
	 *     `scrollTop = 500`).
	 *   MAXIMUM only          → the height is indefinite for the children, the
	 *     root takes its full content height, the viewport equals its scroll
	 *     height and CANNOT scroll. Measured: `clientHeight 5448  scrollHeight
	 *     5448`, root clipping at 160px.
	 *
	 * 160px of list in a 400px body is also the measured chrome figure (the search
	 * header and the map footer are `shrink-0`), and the content is the 40-option
	 * fixture at the committed `OPTION_ROW_CLASS` `h-16` = 64px each. */
	const viewport = viewports[0] as HTMLElement;
	const CONTENT_H = options.length * 64; // h-16, the committed option height
	const CHROME_H = 400 - 160; // the measured 400px body → 160px of list
	Object.defineProperty(viewport, 'clientHeight', {
		configurable: true,
		get: () => (body.style.height === '' ? CONTENT_H : Math.max(0, Number.parseFloat(body.style.height) - CHROME_H)),
	});
	Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => CONTENT_H });
	try {
		assert.ok(
			viewport.clientHeight < viewport.scrollHeight,
			`THE list must be SCROLLABLE, not clipped: clientHeight ${viewport.clientHeight} must be < scrollHeight ${viewport.scrollHeight}. Equal heights mean the viewport is as tall as all ${options.length} options and the operator cannot reach the rest.`,
		);
	} finally {
		delete (viewport as unknown as Record<string, unknown>).clientHeight;
		delete (viewport as unknown as Record<string, unknown>).scrollHeight;
	}

	// And the document behind the picker is not itself turned into a scroll
	// region by opening it (AGENTS.md §8: no page-level scrollbar).
	assert.equal(
		dom.window.document.body.scrollHeight <= dom.window.document.body.clientHeight,
		true,
		'opening the picker must not give the page behind it a scrollbar',
	);
});

/* ─────────────────────────────── row 02: exactly one picker layer ─────────────────────────────── */

test('row 02 control: the picker renders exactly ONE picker layer', () => {
	const host = renderPicker();
	openPopover(host);

	// One trigger, one listbox, one popover. A duplicated or nested picker is
	// what this row exists to keep out.
	assert.equal(host.querySelectorAll('[role="combobox"]').length, 1, 'exactly one combobox trigger');
	assert.equal(
		dom.window.document.querySelectorAll('[role="listbox"]').length,
		1,
		'exactly one listbox — a nested picker would add a second',
	);
	assert.equal(
		dom.window.document.querySelectorAll('[data-radix-popper-content-wrapper]').length,
		1,
		'exactly one popover layer',
	);
	// The listbox is owned by the one trigger via aria-controls, so the single
	// layer is wired to the single trigger rather than merely coexisting with it.
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	const listbox = dom.window.document.querySelector('[role="listbox"]') as HTMLElement;
	assert.equal(trigger.getAttribute('aria-controls'), listbox.id, 'the one trigger must control the one listbox');
	assert.equal(listbox.getAttribute('aria-labelledby'), trigger.id, 'the one listbox must be labelled by the one trigger');

	// The options belong to that one listbox: no options stranded outside it.
	assert.equal(host.querySelectorAll('[role="option"]').length, 0, 'no picker options may render outside the single layer');
	assert.ok(listbox.querySelectorAll('[role="option"]').length > 20, 'all options belong to the single listbox');

	// The interactive map is a SEPARATE, later surface reached by an explicit
	// click, not a second picker mounted underneath this one.
	//
	// NOTE ON `role="dialog"`: Radix's Popover.Content carries `role="dialog"`
	// itself (the WAI-ARIA popover pattern), so the ONE dialog in the document
	// while the picker is open IS the picker's own popover — measured, not
	// assumed. That makes this the sharpest available form of the row: if the
	// map modal were mounted as a second layer, the count would be 2.
	//
	// Every assertion below compares NUMBERS. Comparing a DOM node against null
	// with `assert.equal` makes Node serialise the jsdom element in the failure
	// path, which exhausts the buffer ("RangeError: Array buffer allocation
	// failed" after ~35s) instead of reporting the failure.
	const dialogs = dom.window.document.querySelectorAll('[role="dialog"]');
	assert.equal(dialogs.length, 1, `exactly one dialog layer, found ${dialogs.length}`);
	assert.equal(dialogs[0].contains(listbox), true, 'the one dialog must be the picker popover itself');
	assert.equal(dialogs[0].getAttribute('data-state'), 'open', 'that one layer is the open picker');
	assert.ok(
		!(dom.window.document.body.textContent ?? '').includes('Assign Home Room'),
		'the map modal must not be mounted while the picker is open — that would be a second layer',
	);

	// And there is exactly one place in the component that renders a picker.
	const pickerSource = source('src/components/sections/SectionRoomPicker.tsx');
	assert.equal(
		(pickerSource.match(/<Popover\b/g) ?? []).length,
		1,
		'the component must contain exactly one Popover',
	);
	assert.equal(
		(pickerSource.match(/<ScrollArea\b/g) ?? []).length,
		1,
		'the component must contain exactly one scroll area',
	);
});

/* ─────────────────── A9 C7 R1: the height cap is MEASURED, not read from the CSS variable ─────────────────── */

test('R1 control: the popover caps itself to the space BELOW the trigger, measured before Radix measures', () => {
	// THE DEFECT THIS PINS, recorded from a render on real staging data (planner,
	// 2026-09-29, 1366x768, evidence in `docs/reviews/a9-c7-home-room-picker-20260929/`):
	// row 1 opened down and was fine; row 3 rendered `data-side="top"` at 400px and
	// covered the `NEED ROOMS 19` chip, the "Give 19 sections a home room" button
	// and "Sync sections". The committed class cap
	// `min(25rem, var(--radix-popover-content-available-height))` CANNOT prevent
	// that: Radix publishes that variable as a consequence of the flip decision,
	// and the flip decision compares the content's measured height against the
	// space below — a fixed point in which the cap is either too big to bind before
	// the flip or inert after it.
	//
	// So the number must be computed from the trigger's own rect, before Radix
	// measures anything, and applied inline. jsdom has no layout engine, so the
	// rect is stubbed exactly as a real row near the bottom of the list presents
	// it: the trigger's bottom edge sits 168px above a 768px viewport, which is
	// LESS than the 400px ceiling — the row-3 condition.
	const realRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
	const realInnerHeight = dom.window.innerHeight;
	const realScrollIntoView = dom.window.HTMLElement.prototype.scrollIntoView;
	const TRIGGER_BOTTOM = 600;
	const VIEWPORT_H = 768;
	let centred = 0;
	dom.window.HTMLElement.prototype.getBoundingClientRect = function patched(this: HTMLElement) {
		if (this.getAttribute('role') === 'combobox') {
			return { width: 160, height: 36, top: TRIGGER_BOTTOM - 36, left: 0, right: 160, bottom: TRIGGER_BOTTOM, x: 0, y: TRIGGER_BOTTOM - 36, toJSON: () => ({}) } as DOMRect;
		}
		return realRect.call(this);
	} as typeof realRect;
	dom.window.HTMLElement.prototype.scrollIntoView = function counted(this: HTMLElement, arg?: unknown) {
		if (this.getAttribute('role') === 'combobox') centred += 1;
		return realScrollIntoView.call(this);
	} as typeof realScrollIntoView;
	Object.defineProperty(dom.window, 'innerHeight', { value: VIEWPORT_H, configurable: true, writable: true });

	try {
		const host = renderPicker();
		openPopover(host);

		const content = dom.window.document.querySelector<HTMLElement>('[data-testid="room-picker-popover-content"]');
		assert.ok(content, 'the popover content must be mounted');

		// The measured cap is INLINE, which is what beats the class, and it is the
		// reason `flip` sees a content that already fits below.
		const inline = content!.style.maxHeight;
		assert.notEqual(inline, '', 'THE fix: the popover must carry an inline max-height measured from the trigger');
		const capPx = Number.parseFloat(inline);

		// The arithmetic, read from the component's own exported constants rather
		// than re-derived here: 768 − 600 − 4 (sideOffset) − 12 (collisionPadding)
		// − 4 (safety) = 148.
		const expected = popoverMaxHeightPx(TRIGGER_BOTTOM, VIEWPORT_H);
		assert.equal(capPx, expected, `the inline cap must be the measured space below; expected ${expected}px, got ${capPx}px`);
		assert.equal(
			expected,
			VIEWPORT_H - TRIGGER_BOTTOM - POPOVER_SIDE_OFFSET_PX - POPOVER_COLLISION_PX - POPOVER_SAFETY_PX,
			'the exported arithmetic must be the one the comment claims',
		);
		assert.ok(capPx < POPOVER_MAX_PX, `the cap must be BELOW the 400px ceiling for this row; got ${capPx}px`);
		assert.ok(
			capPx <= VIEWPORT_H - TRIGGER_BOTTOM - POPOVER_SIDE_OFFSET_PX - POPOVER_COLLISION_PX - POPOVER_SAFETY_PX,
			`the popover must never be taller than the space below the trigger; got ${capPx}px`,
		);
		assert.ok(capPx > 0, 'a measurable row must not be capped to nothing');

		// 148px is below MIN_USABLE (192), so the trigger is centred first and the
		// cap is re-read AFTER that scroll — a bottom row gets a popover you can
		// use instead of a strip, and the scroll happens before the popover mounts.
		assert.ok(
			capPx < POPOVER_MIN_USABLE_PX,
			`precondition: the measured cap is below the usable minimum; got ${capPx}px`,
		);
		assert.equal(centred, 1, 'a row with no usable room below is scrolled to centre before the cap is read');

		// The committed class string is the no-measurement fallback and must stay:
		// it is what bounds the body in jsdom, in first paint, and anywhere a
		// measurement is unavailable. Deleting it as dead code would restore the
		// unbounded body.
		assert.match(
			content!.className,
			/max-h-\[min\(25rem,var\(--radix-popover-content-available-height\)\)\]/,
			'the committed class cap must remain as the fallback',
		);
	} finally {
		dom.window.HTMLElement.prototype.getBoundingClientRect = realRect;
		dom.window.HTMLElement.prototype.scrollIntoView = realScrollIntoView;
		Object.defineProperty(dom.window, 'innerHeight', { value: realInnerHeight, configurable: true, writable: true });
	}
});

/* ───────── A9 C7 R2: opening the picker must not scroll the page behind it ───────── */

test('R2 control: opening the picker never scrolls an ancestor, and reveals the current room inside the list', async () => {
	// THE DEFECT, measured on real staging data (planner, 2026-09-29, preview
	// :5262 → staging API :5101, 1366x768, origin asserted): with the sections list
	// scrolled to `scrollTop = 400` by hand, ONE click on a row's picker sent it
	// to 0 — on row 2 `Bonifacio` (unassigned, the `focus()` path) and on row 1
	// `Aguinaldo` (assigned, the `scrollIntoView` path) alike. The operator clicks
	// row 17, the list jumps to row 1, and the row they were working on leaves the
	// screen. Both old calls walk EVERY scrollable ancestor, and the popover is
	// portalled into `document.body`, so the browser scrolled the list to "reveal"
	// a node that was not in it.
	//
	// So the recording is the assertion: every `scrollIntoView` target must be
	// inside the picker body, and the search input's `focus` must carry
	// `preventScroll: true`. jsdom runs no layout, so the option-reveal half is
	// driven by stubbed rects that give the picker's scroll region a real size.
	const realScrollIntoView = dom.window.Element.prototype.scrollIntoView;
	const realFocus = dom.window.HTMLInputElement.prototype.focus;
	const scrolled: Element[] = [];
	const focusArgs: Array<{ on: string; arg: FocusOptions | null }> = [];

	// `Element.prototype`, not `HTMLElement.prototype`: the option is a <button>,
	// and this must catch a call on ANY element, so the recording cannot be
	// narrowed by which class the element happens to have.
	dom.window.Element.prototype.scrollIntoView = function recorded(this: Element) {
		scrolled.push(this);
		return realScrollIntoView.call(this);
	} as typeof realScrollIntoView;
	dom.window.HTMLInputElement.prototype.focus = function recordedFocus(this: HTMLInputElement, arg?: FocusOptions) {
		focusArgs.push({ on: this.getAttribute('aria-label') ?? this.name ?? '(unlabelled)', arg: arg ?? null });
		return realFocus.call(this);
	} as typeof realFocus;

	try {
		// ── the ASSIGNED case: the current room is brought into view ──────────
		// A value is set, so `activeItemRef` is populated and the reveal path runs
		// (the defect's row-1 branch). Renders its own harness because the shared
		// `renderPicker` starts unassigned.
		const host = dom.window.document.createElement('div');
		dom.window.document.body.appendChild(host);
		hosts.push(host);
		const r = createRoot(host);
		roots.push(r);
		act(() => {
			r.render(createElement(() =>
				createElement(SectionRoomPicker, {
					sectionId: 11,
					sectionName: 'Grade 7 - Rizal',
					// Room 239 is the 40th of 40, i.e. well below the fold of any
					// list, so "bring the current room into view" is a real scroll
					// rather than a no-op.
					value: 239,
					options: OPTIONS,
					onSelect: () => {},
					schoolId: 1,
					roomOccupancy: new Map<number, string>(),
				})));
		});
		const assignedTrigger = host.querySelector('[role="combobox"]') as HTMLElement;
		assert.ok(assignedTrigger, 'precondition: the assigned row carries a trigger');
		act(() => { assignedTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
		if (!dom.window.document.querySelector('[role="listbox"]')) {
			act(() => { assignedTrigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })); });
		}
		assert.ok(dom.window.document.querySelector('[role="listbox"]'), 'the listbox must open');

		// Give the scroll region and the active option real geometry, because
		// "is the option in view" is arithmetic over two rects and jsdom supplies
		// neither. 64px is the committed `h-16` option height; the list is 200px
		// tall with the option 150px below its top, so centring it needs a scroll.
		const list = dom.window.document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
		assert.ok(list, 'precondition: the picker owns a scroll region (row 01)');
		const active = dom.window.document.querySelector('[role="option"][aria-selected="true"]') as HTMLElement;
		assert.ok(active, 'precondition: the current room is rendered as the selected option');
		// The geometry is stubbed ON THE TWO ELEMENTS, not on a prototype: this file's
		// earlier R1 row leaves an own `getBoundingClientRect` on
		// `HTMLElement.prototype` (it patches the prototype to capture the natural
		// width), which would shadow any `Element.prototype` patch for every
		// `<div>` and silently return zeros — the exact failure this control must
		// not have.
		Object.defineProperty(list, 'getBoundingClientRect', {
			configurable: true,
			value: () => ({ width: 300, height: 200, top: 100, left: 0, right: 300, bottom: 300, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect,
		});
		Object.defineProperty(active, 'getBoundingClientRect', {
			configurable: true,
			value: () => ({ width: 280, height: 64, top: 250, left: 0, right: 280, bottom: 314, x: 0, y: 250, toJSON: () => ({}) }) as DOMRect,
		});

		// The reveal runs on a 50ms timer after open. Wait for it in real time —
		// the point of the control is that the call actually happens, so faking
		// the clock would test the mock.
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
		delete (list as unknown as Record<string, unknown>).getBoundingClientRect;
		delete (active as unknown as Record<string, unknown>).getBoundingClientRect;

		// THE fix, the assigned branch: the reveal is a write to the picker's own
		// scrollTop. delta = optionTop − listTop − (listH − optionH)/2
		//         = 250 − 100 − (200 − 64)/2 = 150 − 68 = 82.
		assert.equal(
			list.scrollTop,
			82,
			`the current room must be centred by the picker's own scrollTop; got ${list.scrollTop}`,
		);

		// THE fix, the shared property: NOTHING outside the picker body was
		// scrolled. In particular not the row's trigger and not the page.
		const body = dom.window.document.querySelector('[data-testid="room-picker-popover-content"]') as HTMLElement;
		assert.ok(body, 'precondition: the popover body is mounted');
		for (const target of scrolled) {
			assert.ok(
				body.contains(target),
				`no ancestor may be scrolled on open; ${target.tagName}.${target.className || '(no class)'} was scrolled`,
			);
		}
		assert.ok(
			!scrolled.includes(assignedTrigger as unknown as Element),
			'the row trigger must never be the target of a scroll on open',
		);

		// ── the UNASSIGNED case: the focus path ───────────────────────────────
		// The defect's row-2 branch: nothing is selected, so the search input is
		// the focus target. Phase 1.4 made that load-bearing for keyboard users,
		// so the focus is KEPT — it just must not drag the page with it.
		act(() => { r.unmount(); });
		dom.window.document.body.innerHTML = '';
		hosts.length = 0;
		scrolled.length = 0;
		focusArgs.length = 0;

		const unassignedHost = renderPicker();
		openPopover(unassignedHost);
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });

		const search = dom.window.document.querySelector('input[aria-label="Search rooms or buildings"]') as HTMLInputElement;
		assert.ok(search, 'precondition: the search input is mounted');
		// Every recorded focus of the search input, not just the first: an effect
		// that re-runs must not smuggle a bare `focus()` in behind a correct one.
		const searchFocuses = focusArgs.filter((f) => f.on === 'Search rooms or buildings');
		assert.ok(searchFocuses.length > 0, 'the search input must have been focused (Phase 1.4 keeps that behaviour)');
		for (const f of searchFocuses) {
			assert.equal(
				(f.arg as FocusOptions | null)?.preventScroll,
				true,
				`THE fix: the search input must be focused with preventScroll; got ${JSON.stringify(f.arg)}`,
			);
		}
		for (const target of scrolled) {
			assert.ok(
				(dom.window.document.querySelector('[data-testid="room-picker-popover-content"]') as HTMLElement).contains(target),
				'no ancestor may be scrolled on the focus path either',
			);
		}
	} finally {
		dom.window.Element.prototype.scrollIntoView = realScrollIntoView;
		dom.window.HTMLInputElement.prototype.focus = realFocus;
	}
});

/* ─── A9 C7 R3: a MAXIMUM is not a height, and the difference is the whole list ─── */

test('R3 control: the measured cap is applied as a DEFINITE height, not only a max-height', () => {
	// THE REGRESSION, measured on real staging data (planner, 2026-09-29, preview
	// :5262, 79 options / 78 staging rooms):
	//
	//   popover body     400px   (248px / 209px on lower rows — R1's cap works)
	//   ScrollArea root  160px   (clips)
	//   scroll viewport  clientHeight 5448  scrollHeight 5448  scrollTop 0
	//
	// `clientHeight === scrollHeight`: the viewport is as tall as all 79 options,
	// so it has nothing to scroll, and the root's `overflow-hidden` simply cuts it
	// off. The operator saw "Unassigned" plus one or two rooms and could not reach
	// the other 76 except through the search box.
	//
	// The cause is R1's own change, and the mechanism is worth stating exactly: the
	// body went from `h-100` (a definite height) to `max-h-[min(25rem,var(…))]`
	// (a maximum). With a definite height the flex column resolves `flex-1` on the
	// ScrollArea root against a known size, so the viewport collapses to the space
	// that is actually there and scrolls. With only a maximum the container's
	// height is INDEFINITE for its children, the root takes its full content
	// height, and the viewport never shrinks. One experiment on the same page and
	// build settled it: setting `height: 400px` inline on the open popover dropped
	// the viewport from `clientHeight 5448` to `160`, and it then accepted
	// `scrollTop = 500`.
	//
	// So the measured number must be a `height` as well as a `max-height`, and
	// that is what this row pins: a `max-height` alone is the regression, and it
	// passes every other assertion in the file — which is why R1 went green.
	// The trigger rect and window are the ones the R1 control already models, so
	// the number here is the same one a real row produces: 148px below a 768px
	// viewport from a trigger bottom at 600. The stubs go on BEFORE the open,
	// because the cap is measured in the open handler — stubbing afterwards would
	// measure nothing and the row would pass vacuously.
	const realRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
	const realInnerHeight = dom.window.innerHeight;
	dom.window.HTMLElement.prototype.getBoundingClientRect = function rectStub(this: HTMLElement) {
		if (this.getAttribute('role') === 'combobox') {
			return { width: 160, height: 36, top: 564, left: 0, right: 160, bottom: 600, x: 0, y: 564, toJSON: () => ({}) } as DOMRect;
		}
		return realRect.call(this);
	} as typeof realRect;
	Object.defineProperty(dom.window, 'innerHeight', { value: 768, configurable: true, writable: true });

	try {
		const host = renderPicker();
		openPopover(host);
		const measured = dom.window.document.querySelector<HTMLElement>('[data-testid="room-picker-popover-content"]');
		assert.ok(measured, 'precondition: the popover is open under the stubbed geometry');

		// A `height`, not only a `max-height`. The message names the mechanism so
		// whoever reads the failure knows it is the list that becomes unreachable.
		assert.notEqual(
			measured!.style.height,
			'',
			`THE fix: the measured cap must be a DEFINITE inline height, not only a max-height; got height=${JSON.stringify(measured!.style.height)} maxHeight=${JSON.stringify(measured!.style.maxHeight)}`,
		);
		assert.equal(
			measured!.style.height,
			measured!.style.maxHeight,
			'the definite height and the max-height must be the same measured number',
		);
		assert.equal(
			measured!.style.height,
			'148px',
			`the height must be the measured space below the trigger; got ${JSON.stringify(measured!.style.height)}`,
		);
		// And it is a HEIGHT, so the flex column can resolve `flex-1` and the
		// viewport can be smaller than its content — the row-01 assertion above is
		// the consequence, this is the cause.
		assert.ok(
			Number.parseFloat(measured!.style.height) <= POPOVER_MAX_PX,
			'the definite height must never exceed the 400px ceiling',
		);

		// The committed class string is still the no-measurement fallback and is
		// still the only bound a harness without layout has. It must not be deleted
		// as dead code now that the inline value is the primary bound.
		assert.match(
			measured!.className,
			/max-h-\[min\(25rem,var\(--radix-popover-content-available-height\)\)\]/,
			'the committed class cap must remain as the fallback',
		);
	} finally {
		dom.window.HTMLElement.prototype.getBoundingClientRect = realRect;
		Object.defineProperty(dom.window, 'innerHeight', { value: realInnerHeight, configurable: true, writable: true });
	}
});
