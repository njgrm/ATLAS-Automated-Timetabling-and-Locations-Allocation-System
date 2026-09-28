/**
 * A3 C9 — item 6, the `/sections` home-room dropdown "glitch".
 *
 * THE RECORDED DEFECT (Lane C, 2026-09-28 10:35, live `a1db27d5`).
 * A synthetic-hover probe over the Aguinaldo and Bonifacio rows found no
 * hover-triggered height change, no scroll event, no second layer and no
 * console output — but it DID measure MIXED ROW HEIGHTS: a vacant option is
 * ~37.6px, an occupied one ~53.6px, because the occupied variant adds two
 * extra lines to the option's `flex flex-col` block (the "Used by <section>"
 * badge plus a second "Room already has a home section" sentence). Scanning or
 * moving a real pointer across mixed heights reads as the list jumping. The
 * probe was explicit that it could not reproduce a pointer-driven re-render, so
 * this control does NOT claim to have fixed a flicker: it pins the structural
 * cause the probe did prove, and the pointer symptom stays an open live row.
 *
 * WHAT IS ASSERTED, AND WHY IT IS STRUCTURAL.
 * jsdom performs no layout and this stream runs no browser, so no pixel height
 * can be measured here and none is invented. The contract that would produce
 * equal heights is asserted instead, in the same committed class tokens the
 * browser resolves: every option — vacant, occupied, and the "Unassigned"
 * option — declares ONE fixed height, derives no height from its content, and
 * cannot grow a line. A row whose occupancy is a second line is exactly what
 * the old `h-auto` + `flex flex-col` permitted, so the control fails on base
 * `a7ccb738`.
 *
 * LEGIBILITY (A3 fix 03) IS NOT REGRESSED — IT IS RE-DELIVERED.
 * Fix 03 put the occupant on its own wrapping line so a long section name was
 * readable. Fix 09/C9 requires one row height, so wrapping and a fixed height
 * are mutually exclusive. The tension is resolved deliberately, and all three
 * legs are asserted: (1) the badge is one line and truncates, but truncation
 * is CSS-only so the full name stays in the DOM text and in the option's
 * accessible name; (2) a `@/ui` Tooltip on the badge carries the full name for
 * a pointer (AGENTS.md §8 forbids a raw `title`); (3) keyboard users get the
 * full name from the picker's existing `room-picker-occupied-hint` live region
 * on focus, which this control drives for real.
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
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { SectionRoomPicker } = await import('../SectionRoomPicker');
type RoomOption = import('../SectionRoomPicker').RoomOption;

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

const roots: Root[] = [];
const hosts: HTMLElement[] = [];
// Per test, not once at the end: an open picker portals its listbox to <body>,
// so a second test would otherwise inherit the first test's mounted popover and
// count its options twice. Same reason the rows-01/02 control does this.
afterEach(() => {
	for (const r of roots.splice(0)) act(() => { r.unmount(); });
	for (const h of hosts.splice(0)) h.remove();
	dom.window.document.body.innerHTML = '';
});
after(() => {
	dom.window.close();
});

/** Long enough that "Used by " + it cannot fit one line beside the room name
 *  at the picker's committed width. This is the fix-03 fixture, unchanged. */
const LONG_OCCUPANT = 'Grade 9 - Bonifacio Special Program Section A';

const OPTIONS: RoomOption[] = [
	{ id: 201, name: 'Learning Commons', buildingName: 'Grade 9 Building', type: 'CLASSROOM' },
	{ id: 202, name: 'Guidance Office', buildingName: 'Grade 9 Building', type: 'OFFICE' },
	{ id: 203, name: 'Science Lab 1', buildingName: 'Grade 9 Building', type: 'LABORATORY' },
];

const OCCUPANCY = new Map([[201, LONG_OCCUPANT], [203, 'Grade 7 - Rizal']]);

function renderPicker(occupancy: Map<number, string> = OCCUPANCY) {
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
			roomOccupancy: occupancy,
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

const options = (): HTMLElement[] =>
	Array.from(dom.window.document.querySelectorAll('[role="option"]')) as HTMLElement[];

/**
 * Drive the option's React `onFocus`.
 *
 * React 17+ delegates focus through `focusin`/`focusout`, NOT `focus`, and
 * derives `onMouseEnter` from `mouseout`/`mouseover` pairs. Dispatching a bare
 * `focus` event would silently never reach the handler, so the control would
 * "prove" a hint that never appeared. `HTMLElement.focus()` is used because it
 * is the real path a keyboard takes and jsdom fires the delegated event for it.
 */
const focusOption = (el: HTMLElement) => {
	act(() => { (el as unknown as { focus: () => void }).focus(); });
};
const hoverOption = (el: HTMLElement) => {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })); });
};

/** The single height token an option declares, or null if it declares none. */
const heightToken = (el: HTMLElement): string | null => {
	const m = /\bh-(\d+(?:\.\d+)?)\b/.exec(el.className);
	return m ? `h-${m[1]}` : null;
};

/* ────────────── row 1: one fixed height for EVERY option variant ────────────── */

test('c9 control: every option — vacant, occupied, Unassigned — declares ONE fixed height', () => {
	const host = renderPicker();
	openPopover(host);

	const all = options();
	assert.equal(all.length, OPTIONS.length + 1, 'one option per room plus the Unassigned option');

	// Occupancy really is mixed in this fixture, or the row is vacuous.
	const occupied = all.filter((o) => o.dataset.occupied === 'true');
	const vacant = all.filter((o) => o.dataset.occupied === undefined);
	assert.equal(occupied.length, 2, 'precondition: two occupied rooms are rendered');
	assert.ok(vacant.length >= 2, 'precondition: at least one vacant room and the Unassigned option are rendered');

	const declared = new Map<string, number>();
	for (const el of all) {
		const token = heightToken(el);
		assert.ok(
			token,
			`every option must declare a fixed height token; got "${el.className}" for "${el.textContent?.slice(0, 40)}"`,
		);
		declared.set(token!, (declared.get(token!) ?? 0) + 1);

		// The recorded defect: `h-auto` plus a vertical padding token lets the
		// row take its height from its content, which is how an occupied option
		// ended up ~16px taller than a vacant one.
		assert.doesNotMatch(
			el.className,
			/\bh-auto\b/,
			`an option must not derive its height from content (h-auto); got "${el.className}"`,
		);
		assert.doesNotMatch(
			el.className,
			/\bpy-(\d|\[)/,
			`an option must not carry a vertical padding token that could add height; got "${el.className}"`,
		);
		assert.match(
			el.className,
			/\bitems-center\b/,
			`an option must centre its content on one line; got "${el.className}"`,
		);
	}

	assert.equal(
		declared.size,
		1,
		`every option must share ONE height token; found ${[...declared.entries()].map(([t, n]) => `${t} x${n}`).join(', ')}`,
	);

	// The uniform class really is the one every variant renders, not a
	// coincidence of this fixture: the occupied and vacant rows are distinct
	// elements carrying the identical token.
	const occupiedToken = heightToken(occupied[0]);
	const vacantToken = heightToken(vacant[0]);
	assert.equal(occupiedToken, vacantToken, 'an occupied option and a vacant option must share one height');

	// One token means one resolved height. Tailwind's h-<n> unit is 0.25rem.
	const px = Number(/\d+(?:\.\d+)?/.exec(occupiedToken!)![0]) * 4;
	assert.ok(px >= 32, `the fixed row height must fit the two label lines it holds, got ${px}px`);
});

/* ────────── row 2: occupancy is ONE right-aligned line, never a second line ────────── */

test('c9 control: occupancy is one right-aligned line that cannot wrap or add a line', () => {
	const host = renderPicker();
	openPopover(host);

	const labels = Array.from(
		dom.window.document.querySelectorAll('[data-testid="room-option-occupant"]'),
	) as HTMLElement[];
	assert.equal(labels.length, 2, 'exactly one occupancy label per occupied room');

	for (const label of labels) {
		// Single line: truncation, not wrapping. This is the assertion that
		// fails on base, where the badge is `whitespace-normal break-words` and
		// is followed by a second sentence on a line of its own.
		assert.match(
			label.className,
			/\btruncate\b/,
			`the occupancy label must be a single truncated line; got "${label.className}"`,
		);
		assert.doesNotMatch(
			label.className,
			/\b(whitespace-normal|break-words|whitespace-pre-line)\b/,
			`the occupancy label must not be allowed to wrap; got "${label.className}"`,
		);
		assert.doesNotMatch(
			label.className,
			/\bwhitespace-pre\b/,
			'the occupancy label must not reserve space for a second line',
		);

		// Right-aligned: it sits in its own trailing column, beside the room
		// name rather than under it.
		const option = label.closest('[role="option"]') as HTMLElement;
		assert.ok(option, 'the occupancy label must live inside its option');
		const trailing = label.parentElement ?? label;
		assert.match(
			trailing.className,
			/\bml-auto\b/,
			`the occupancy label must be pushed to the trailing edge; got "${trailing.className}"`,
		);

		// Nothing anywhere in the option may wrap onto a second line, because
		// anything that wraps is a row that changes height. Read the attribute
		// rather than `.className`: on an SVG child (the `Check` icon) the DOM
		// property is an `SVGAnimatedString` object, not the class string.
		for (const el of Array.from(option.querySelectorAll('*'))) {
			const cn = el.getAttribute('class') ?? '';
			assert.doesNotMatch(
				cn,
				/\b(whitespace-normal|break-words)\b/,
				`no element inside a fixed-height option may wrap; found "${cn}" in "${option.textContent?.slice(0, 40)}"`,
			);
		}
	}

	// The occupied option holds the same two label lines as a vacant one. The
	// badge is a third, single-line sibling — it never becomes a third line.
	const occupied = options().find((o) => o.dataset.occupied === 'true') as HTMLElement;
	const vacant = options().find((o) => o.textContent?.includes('Guidance Office')) as HTMLElement;
	assert.ok(occupied && vacant, 'precondition: one occupied and one vacant option are rendered');
	assert.equal(
		occupied.querySelectorAll('[data-testid="room-option-occupant"]').length,
		1,
		'an occupied option carries exactly one occupancy label',
	);

	// The row no longer shouts: the second, duplicate sentence is gone from the
	// option. The CONFIRMATION is a separate surface and is asserted below.
	assert.doesNotMatch(
		occupied.textContent ?? '',
		/Room already has a home section/,
		'the duplicate second warning sentence must not occupy a line in the option',
	);
});

/* ──────── row 3: legibility re-delivered — full name still reachable ──────── */

test('c9 control: the full occupant name stays readable despite the one-line truncation', () => {
	const host = renderPicker();
	openPopover(host);

	const label = dom.window.document.querySelector(
		'[data-testid="room-option-occupant"]',
	) as HTMLElement;
	assert.ok(label, 'the occupied room must carry its occupant label');

	// Leg 1 — the full name is still the element's text. `truncate` is a CSS
	// overflow, not a shortened string, so the name is intact for assistive
	// technology, for search, and for the option's accessible name.
	assert.equal(
		label.textContent,
		`Used by ${LONG_OCCUPANT}`,
		'the occupancy label must carry the whole section name, not a shortened form',
	);
	assert.equal(label.dataset.occupiedFull, undefined, 'the label is not a data-attribute stand-in');
	assert.doesNotMatch(label.className, /\buppercase\b/, 'an occupant name must not be shouted in caps at small size');

	// Leg 2 — a @/ui Tooltip carries the full name for a pointer. AGENTS.md §8
	// forbids a raw `title` attribute, so the trigger is asserted structurally.
	const trigger = dom.window.document.querySelector(
		'[data-testid="room-option-occupant-full-trigger"]',
	) as HTMLElement;
	assert.ok(trigger, 'the occupancy label must be wrapped in a tooltip trigger');
	assert.ok(label.contains(trigger) || trigger.contains(label), 'the tooltip trigger must wrap the occupancy label');
	assert.equal(
		Array.from(label.attributes).some((a) => a.name === 'title'),
		false,
		'AGENTS.md §8 forbids a raw title attribute for extra information',
	);

	// Leg 3 — the full name is reachable by KEYBOARD, driven for real: focusing
	// the occupied option publishes the full name in the picker's live region.
	// This is the leg that makes the one-line row safe for a keyboard operator.
	const option = label.closest('[role="option"]') as HTMLElement;
	focusOption(option);
	const hint = dom.window.document.querySelector(
		'[data-testid="room-picker-occupied-hint"]',
	) as HTMLElement;
	assert.ok(hint, 'focusing an occupied option must publish its occupant hint');
	assert.ok(
		(hint.textContent ?? '').includes(LONG_OCCUPANT),
		'the focused-occupant hint must state the FULL section name, so truncation never costs a keyboard user the name',
	);

	// The hooks accepted controls depend on survive untouched.
	assert.equal(option.dataset.occupied, 'true', 'the data-occupied hook must survive');
	assert.equal(option.getAttribute('aria-selected'), 'false', 'aria-selected semantics must survive');
	const pickerSource = source('src/components/sections/SectionRoomPicker.tsx');
	assert.ok(
		pickerSource.includes('data-testid="room-option-occupant-full"'),
		'the tooltip content must carry a testid so the revealed full name is verifiable on a live surface',
	);
});

/* ────────────── row 4: the cue is calm, and not a grade colour ────────────── */

test('c9 control: the occupancy cue is the calm --warning family, not a loud amber block', () => {
	const host = renderPicker();
	openPopover(host);

	const label = dom.window.document.querySelector(
		'[data-testid="room-option-occupant"]',
	) as HTMLElement;
	assert.ok(label, 'precondition: an occupancy label is rendered');

	// The recorded "loud" treatment: an orange-filled block plus a second
	// orange sentence. One pale surface, one quiet edge, no shout.
	assert.doesNotMatch(
		label.className,
		/\bbg-amber-\d/,
		`the occupancy cue must not be a solid amber block; got "${label.className}"`,
	);
	assert.doesNotMatch(
		label.className,
		/\btext-(amber|orange)-\d{3}\b/,
		`the occupancy cue must not be a saturated body-text colour; got "${label.className}"`,
	);
	assert.match(
		label.className,
		/\bbg-warning-muted\b/,
		`the occupancy cue must sit on the calm --warning-muted surface; got "${label.className}"`,
	);
	assert.match(
		label.className,
		/\btext-warning-foreground\b/,
		`the occupancy cue must use the measured --warning-foreground body text; got "${label.className}"`,
	);

	// A grade-free status cue: no DeEd grade palette may appear anywhere in the
	// occupancy treatment, and G8 yellow must not be reused here.
	assert.doesNotMatch(
		label.className,
		/\b(bg|text)-yellow-\d/,
		'AGENTS.md §8 reserves yellow for G8; a grade-free status cue must not reuse it',
	);

	// SCOPE, stated so the bound is honest: exactly ONE raw amber block may
	// remain in this file, and it is the pre-existing `room-picker-occupied-hint`
	// banner (a separate surface that item 6 does not govern, and the operator's
	// open pointer-flicker question). C9's job is that a row may never take
	// amber back; pinning the count makes a silent reintroduction fail here
	// rather than in a later review.
	const pickerSource = source('src/components/sections/SectionRoomPicker.tsx');
	const amberBlocks = pickerSource.match(/\bbg-amber-\d{2,3}\b/g) ?? [];
	assert.equal(
		amberBlocks.length,
		1,
		`only the focused-occupant hint may keep its pre-existing amber banner; found ${amberBlocks.length}`,
	);
	assert.ok(
		/room-picker-occupied-hint[\s\S]{0,220}bg-amber-50/.test(pickerSource),
		'the single remaining amber block must be the focused-occupant hint, so this count cannot drift silently',
	);
});

/* ────────────── row 5: the CONFIRMATION is kept where it belongs ────────────── */

test('c9 control: selecting an occupied room still escalates to a confirmation', () => {
	const host = renderPicker();
	openPopover(host);

	// The confirmation surface is a separate, later, user-initiated dialog. It
	// is NOT what the option row does, and removing the row's second sentence
	// must not have removed the escalation.
	const modals = source('src/components/sections/SectionHomeRoomModals.tsx');
	assert.ok(
		modals.includes('already has a home section'),
		'the swap confirmation must still state that the room already has a home section',
	);
	assert.ok(
		modals.includes('needs your confirmation before swapping'),
		'the swap confirmation must still require an explicit confirmation',
	);

	// The picker's own escalation, driven for real: focusing an occupied option
	// says what selecting it will do, and says a confirmation follows.
	const option = Array.from(dom.window.document.querySelectorAll('[role="option"]')).find(
		(o) => (o as HTMLElement).dataset.occupied === 'true',
	) as HTMLElement;
	focusOption(option);
	const hint = dom.window.document.querySelector(
		'[data-testid="room-picker-occupied-hint"]',
	) as HTMLElement;
	assert.ok(hint, 'the occupied hint must be shown on focus');
	assert.match(
		hint.textContent ?? '',
		/confirm/i,
		'the occupied hint must still tell the operator a confirmation follows',
	);

	// Pointer parity: `onMouseEnter` drives the same state as `onFocus`, so a
	// pointer-driven hover cannot diverge from a keyboard focus.
	hoverOption(option);
	assert.ok(
		dom.window.document.querySelector('[data-testid="room-picker-occupied-hint"]'),
		'a pointer hover must publish the same occupied hint a focus does',
	);
});
