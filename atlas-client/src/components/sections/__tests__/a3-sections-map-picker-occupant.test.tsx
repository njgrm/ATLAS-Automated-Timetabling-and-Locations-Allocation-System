/**
 * A3 S1 — the occupied-room warning in the room picker (fix 03).
 *
 * The recorded defect: the popover body was a fixed `w-70` (17.5rem) and the
 * "Used by <section>" badge sat on the same non-wrapping flex row as the room
 * name, pushed to the far edge with `ml-auto`, while the room name carried
 * `truncate`. With a long section name the occupant was either clipped or the
 * row overflowed, so the warning the user is supposed to read before
 * displacing another section was unreadable.
 *
 * jsdom has no layout engine, so the "is it clipped" question is answered from
 * the committed class contract — the same width and height tokens the browser
 * would resolve — rather than asserted by eye. The occupant legibility is
 * asserted on the rendered element's own text and wrapping classes.
 *
 * ── A3 C9 ADDITIVE SUPERSESSION (packet item 6) ──────────────────────────────
 * A mixed-row-height defect was measured on the live surface (vacant ~37.6px,
 * occupied ~53.6px) and the cure is ONE fixed row height for every option. A
 * fixed height and a wrapping occupant label are mutually exclusive, so the
 * MECHANISM half of this control is superseded. Per AGENTS.md §16 nothing here
 * is deleted: each superseded assertion is marked `SUPERSEDED (A3 C9)` in place
 * and its replacement is asserted beside it, and the fix's actual promise —
 * "a long section name is fully readable" — is re-delivered on three legs and
 * still asserted below. The dedicated control for the new geometry is
 * `a3-room-picker-uniform-rows.test.tsx` (reachable from `test:a3-sections-map`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
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
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { SectionRoomPicker } = await import('../SectionRoomPicker');
type RoomOption = import('../SectionRoomPicker').RoomOption;

let root: Root | null = null;
after(() => {
	if (root) act(() => { root!.unmount(); });
	dom.window.close();
});

/** A real section name, long enough to have clipped in 17.5rem. */
const LONG_OCCUPANT = 'Grade 9 - Bonifacio Special Program Section A';
const OPTIONS: RoomOption[] = [
	{ id: 201, name: 'Learning Commons', buildingName: 'Grade 9 Building', type: 'CLASSROOM' },
	{ id: 202, name: 'Guidance Office', buildingName: 'Grade 9 Building', type: 'OFFICE' },
];

function renderPicker(occupancy: Map<number, string>) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	root = createRoot(host);
	function Harness() {
		const [value, setValue] = useState<number | null>(null);
		return createElement(SectionRoomPicker, {
			sectionId: 11,
			sectionName: 'Grade 7 - Rizal',
			value,
			options: OPTIONS,
			onSelect: setValue,
			schoolId: 1,
			roomOccupancy: occupancy,
		});
	}
	act(() => { root!.render(createElement(Harness)); });
	return host;
}

function openPopover(host: HTMLElement) {
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	assert.ok(trigger, 'precondition: the combobox trigger exists');
	act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
	// Radix opens on a pointerdown; drive that too so the control does not
	// depend on which event the primitive happens to listen to.
	const openNow = dom.window.document.querySelector('[role="listbox"]');
	if (!openNow) {
		act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })); });
	}
	assert.ok(dom.window.document.querySelector('[role="listbox"]'), 'the room listbox must open');
}

test('fix 03 control: a long occupant name is fully readable, on a single line with full-name recovery', () => {
	const host = renderPicker(new Map([[201, LONG_OCCUPANT]]));
	openPopover(host);

	const occupant = dom.window.document.querySelector('[data-testid="room-option-occupant"]') as HTMLElement;
	assert.ok(occupant, 'the occupied room must carry its occupant label');
	assert.equal(
		occupant.textContent,
		`Used by ${LONG_OCCUPANT}`,
		'the occupant label must contain the whole section name, not a shortened form',
	);
	assert.equal(occupant.dataset.occupiedFull, undefined, 'the label is not a data-attribute stand-in');

	// ── SUPERSEDED (A3 C9), retained in place as history ──────────────────────
	// These four asserted the fix-03 MECHANISM: that legibility came from the
	// label being ALLOWED TO WRAP. C9 makes the row a fixed height, so wrapping
	// would reintroduce the mixed-row-height defect. The promise they stood for
	// is re-asserted immediately below.
	//   was: assert.match(occupant.className, /break-words/, ...)
	assert.doesNotMatch(occupant.className, /\bbreak-words\b/, 'SUPERSEDED (A3 C9): the label must no longer wrap');
	//   was: assert.match(occupant.className, /whitespace-normal/, ...)
	assert.doesNotMatch(occupant.className, /\bwhitespace-normal\b/, 'SUPERSEDED (A3 C9): the label must no longer wrap');
	//   was: assert.doesNotMatch(occupant.className, /\btruncate\b/, ...)
	assert.match(occupant.className, /\btruncate\b/, 'REPLACEMENT: the label is one truncated line, so the row height is fixed');
	//   was: assert.doesNotMatch(occupant.className, /whitespace-nowrap/, ...)
	assert.doesNotMatch(occupant.className, /\bwhitespace-nowrap\b/, 'the label truncates with ellipsis rather than clipping at the edge');

	// ── SUPERSEDED (A3 C9), retained in place as history ──────────────────────
	// `ml-auto` was forbidden because the label shared a non-wrapping row with
	// the room name and was pushed off the edge. It now sits in its OWN trailing
	// column, which is exactly the "single right-aligned badge" the live report
	// asked for, and truncation bounds it.
	//   was: assert.doesNotMatch(occupant.className, /ml-auto/, ...)
	const trailing = occupant.parentElement as HTMLElement;
	assert.match(trailing.className, /\bml-auto\b/, 'REPLACEMENT: the label lives in its own right-aligned trailing column');
	assert.match(trailing.className, /\bmax-w-\S+/, 'REPLACEMENT: the trailing column is width-bounded, so the name truncates instead of overflowing');

	// REPLACEMENT leg 1 — the full name survives truncation, because truncation
	// is a CSS overflow and not a shortened string. This is the invariant the
	// four superseded wrapping assertions above used to provide.
	assert.equal(occupant.textContent, `Used by ${LONG_OCCUPANT}`, 'REPLACEMENT: truncation must never shorten the name');

	// REPLACEMENT leg 2 — a pointer recovers the full name through a @/ui
	// Tooltip. AGENTS.md §8 forbids a raw `title` attribute, so the trigger is
	// asserted structurally rather than by the attribute it must not have.
	const tip = dom.window.document.querySelector('[data-testid="room-option-occupant-full-trigger"]') as HTMLElement;
	assert.ok(tip, 'REPLACEMENT: the occupant label must be wrapped in a tooltip trigger');
	assert.equal(
		Array.from(occupant.attributes).some((a) => a.name === 'title'),
		false,
		'REPLACEMENT: AGENTS.md §8 forbids a raw title attribute',
	);

	// REPLACEMENT leg 3 — a keyboard operator reads the full name, driven for
	// real. React delegates focus through focusin, so HTMLElement.focus() is the
	// path that actually reaches the handler.
	const option = occupant.closest('[role="option"]') as HTMLElement;
	act(() => { (option as unknown as { focus: () => void }).focus(); });
	const hint = dom.window.document.querySelector('[data-testid="room-picker-occupied-hint"]') as HTMLElement;
	assert.ok(hint, 'REPLACEMENT: focusing the occupied option must publish its occupant hint');
	assert.ok(
		(hint.textContent ?? '').includes(LONG_OCCUPANT),
		'REPLACEMENT: the hint must state the FULL section name, so a one-line row never costs a keyboard operator the name',
	);

	assert.doesNotMatch(occupant.className, /\buppercase\b/, 'an occupant name must not be shouted in caps at small size');
});

test('fix 03 control: the popover is viewport-relative, so nothing is clipped at 1280px', () => {
	const host = renderPicker(new Map([[201, LONG_OCCUPANT]]));
	openPopover(host);

	const listbox = dom.window.document.querySelector('[role="listbox"]') as HTMLElement;
	const content = listbox.closest('[data-radix-popper-content-wrapper]')?.firstElementChild
		?? listbox.parentElement?.parentElement;
	assert.ok(content, 'precondition: the popover body exists');
	const className = (content as HTMLElement).className;

	// The pre-fix width was a fixed token, which is the defect.
	assert.doesNotMatch(className, /\bw-70\b/, 'the fixed w-70 body is the recorded defect');
	assert.doesNotMatch(className, /\bw-\[\d+px\]/, 'the body must not return to a fixed pixel width');
	const widthToken = className.match(/w-\[(min\([^)]*\)|[^\]]*)\]/);
	assert.ok(widthToken, `the body must declare a viewport-relative width; got ${className}`);
	assert.match(widthToken![0], /100vw/, 'the width must be bounded by the viewport');

	// Resolve the committed tokens at 1280x768 and check both axes fit.
	const VIEWPORT_W = 1280;
	const VIEWPORT_H = 768;
	const remPx = (rem: number) => rem * 16;
	const minRem = Number(widthToken![0].match(/min\((\d+(?:\.\d+)?)rem/)?.[1] ?? '0');
	const vwMargin = Number(widthToken![0].match(/100vw-([\d.]+)rem/)?.[1] ?? '0');
	const resolvedWidth = Math.min(minRem * remPx(1), VIEWPORT_W - vwMargin * remPx(1));
	assert.ok(resolvedWidth <= VIEWPORT_W, `the popover must fit the viewport width, got ${resolvedWidth}px`);
	// The vertical bound is still bounded, but A9 C7 (item 46, 2026-09-29) stopped
	// declaring it as a FIXED `h-100`. The row this replaces, quoted:
	//   const heightToken = /\bh-(\d+)\b/.exec(className);
	//   assert.ok(heightToken, 'the popover must declare a bounded height');
	//   const resolvedHeight = Number(heightToken![1]) * 4;
	// A fixed 400px body is what Radix had to resolve by COLLISION near the top of
	// the viewport, flipping the popover up over the sticky toolbar. The bound is
	// now a `max-h-` against the space Radix reports, so the body SHRINKS to what
	// is below the trigger. The 400px ceiling itself is unchanged, so this row's
	// real property — "the popover fits a 1280x768 viewport on both axes" — still
	// gets the same arithmetic.
	assert.doesNotMatch(className, /\bh-\d/, 'the popover must not return to a FIXED height');
	const heightCap = /max-h-\[min\((\d+(?:\.\d+)?)rem,var\(--radix-popover-content-available-height\)\)\]/.exec(className);
	assert.ok(heightCap, `the popover must declare a bounded, available-relative height; got ${className}`);
	const resolvedHeight = Number(heightCap![1]) * remPx(1);
	assert.equal(resolvedHeight, 400, `the ceiling must be the old 400px in rem; got ${resolvedHeight}px`);
	assert.ok(resolvedHeight <= VIEWPORT_H, `the popover must fit the viewport height, got ${resolvedHeight}px`);

	// The footer is the last thing the user needs, so it must not be the
	// element that gets squeezed out.
	const footer = Array.from(dom.window.document.querySelectorAll('button'))
		.find((b) => (b.textContent ?? '').includes('Browse Interactive Map'));
	assert.ok(footer, 'the "Browse Interactive Map" footer control must be present');
	const footerEl = footer!.closest('div');
	assert.ok(footerEl?.className.includes('shrink-0'), 'the footer must be shrink-0 so it cannot be squeezed by the list');

	// ── SUPERSEDED (A3 C9), retained in place as history ──────────────────────
	// This asserted the phrase "Room already has a home section" appears in the
	// open list. That text was the SECOND line inside an occupied option, and a
	// line inside an option is the exact defect C9 removes. The intent — "the
	// occupant warning must still be stated, not only implied by the badge" — is
	// preserved and asserted immediately below on the two surfaces that now own
	// it: the picker's focused-occupant hint and the swap confirmation dialog.
	//   was: assert.ok(body.textContent.includes('Room already has a home section'), ...)
	assert.doesNotMatch(
		dom.window.document.body.textContent ?? '',
		/Room already has a home section/,
		'SUPERSEDED (A3 C9): that sentence must no longer occupy a line inside the open option list',
	);

	// REPLACEMENT — the warning is still STATED, on the focused-occupant hint.
	// Scoped to the listbox this test resolved, because the file unmounts only at
	// the end, so an earlier test's portalled popover can still be in the body.
	const option = listbox.querySelector('[data-occupied="true"]') as HTMLElement;
	assert.ok(option, 'REPLACEMENT: the occupied option must still be discoverable');
	act(() => { (option as unknown as { focus: () => void }).focus(); });
	const hint = dom.window.document.querySelector('[data-testid="room-picker-occupied-hint"]') as HTMLElement;
	assert.ok(hint, 'REPLACEMENT: the focused-occupant hint of the picker must still exist');
	assert.match(
		hint.textContent ?? '',
		/out of this room/,
		'REPLACEMENT: the hint must still say what selecting the occupied room will do',
	);
	assert.match(hint.textContent ?? '', /confirm/i, 'REPLACEMENT: the hint must still say a confirmation follows');

	// REPLACEMENT — and the escalation itself is still a separate, later,
	// user-initiated confirmation surface, untouched by the row redesign.
	const modals = readFileSync(
		resolve(import.meta.dirname, '../SectionHomeRoomModals.tsx'),
		'utf8',
	);
	assert.ok(
		modals.includes('already has a home section'),
		'REPLACEMENT: the swap confirmation must still state that the room already has a home section',
	);
	assert.ok(
		modals.includes('needs your confirmation before swapping'),
		'REPLACEMENT: the swap confirmation must still require an explicit confirmation',
	);
});
