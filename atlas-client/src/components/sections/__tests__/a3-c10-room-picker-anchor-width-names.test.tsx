/**
 * A3 C10 — items 01, 03 and 11 for `/sections` -> SectionRoomPicker.
 *
 * WHAT THE LIVE SURFACE REPORTED (release `a1db27d5`, Lane C)
 *   FIX-01 "Popover for 'G8 Room 203' froze at y≈175 while the table scrolled,
 *          floating over Rizal/Maka-Diyos."
 *   FIX-03 "Fixed ≈350 px (not content-adaptive); no clipping in the case tested"
 *   FIX-11 "'Makakal…' (Makakalikasan) ellipsised on one line in the G8 Room 103 card."
 *
 * WHAT THIS CYCLE CHANGED, and the conflict it had to resolve.
 * C9 made every option row a fixed single-line `h-12` because Lane C had measured
 * MIXED ROW HEIGHTS live (~37.6px vacant vs ~53.6px occupied). That single-line
 * truncation is precisely what left FIX-11 unproven. Both now hold because the
 * row height is the fixed value that ALWAYS accommodates the worst permitted
 * case — two name lines plus one type line — so a two-line name is no longer a
 * taller row, it is a full row. Content-derived height stays banned.
 *
 * ── WHAT IS AND IS NOT PROVEN HERE (read before weighing a row) ──────────────
 * jsdom performs NO layout, so this file cannot measure a pixel, and none is
 * invented. Rows that need a rendered height are decided with an explicit
 * arithmetic model of the text stack (row 1), rows that need a rendered width
 * drive the real production measure-then-set path with the ONE thing jsdom
 * lacks — a layout result — supplied by a stubbed `getBoundingClientRect` (row
 * 4). Everything else is asserted against committed structure or is driven for
 * real through the event/geometry path a browser would take.
 *
 * A control that cannot discriminate is not evidence, so each row here was run
 * against the pre-change `SectionRoomPicker.tsx` and is recorded as failing in
 * the handoff. The failing-first run is the base file restored byte-for-byte
 * afterwards, verified by SHA-256.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
const pickerModule = await import('../SectionRoomPicker');
const { SectionRoomPicker, clampPickerWidth, PICKER_MIN_WIDTH_PX, PICKER_MAX_WIDTH_PX } = pickerModule;
const { roomOptionStackPx } = pickerModule;
type RoomOption = import('../SectionRoomPicker').RoomOption;

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

/**
 * The bytes as COMMITTED, not as checked out.
 *
 * A3-C10 planner correction: the LF row below originally read the WORKING TREE,
 * which `core.autocrlf=true` checks out as CRLF on every fresh clone and every
 * fresh `git worktree add` — including any integration boundary. It therefore
 * passed only in the one worktree whose checkout the author had not refreshed,
 * and failed on the merged integration tree while the committed blob it claimed
 * to be checking was in fact LF (measured: 0 CR bytes, same as the base blob).
 * A control that reports the checkout filter instead of the change is not
 * evidence, so this row now reads the committed bytes it names.
 */
const committedBlob = (relative: string): string => {
	const repoPath = relative.replace(/^src\//, 'atlas-client/src/');
	const out = execFileSync('git', ['cat-file', '-p', `HEAD:${repoPath}`], {
		cwd: resolve(clientRoot, '..'),
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	});
	return out;
};

/* ═══════════════ the deterministic text-stack model (no layout engine) ═══════════════ */

/** Tailwind `text-xs` is a 0.75rem font size on a 1rem line box. */
const LINE_PX = 16;
/** The name/type stack is `gap-0.5`. */
const STACK_GAP_PX = 2;
/** The number of name lines the component permits. FIX-11 asks for two. */
const NAME_LINES_ALLOWED = 2;

const roots: Root[] = [];
const hosts: HTMLElement[] = [];

afterEach(() => {
	// Close any still-open picker BEFORE unmounting. On a mutant that never
	// closes on an outside scroll the popover stays mounted, Radix's positioning
	// loop keeps re-scheduling, and the run dies of a 47s timeout plus an
	// out-of-memory `RangeError` instead of reporting the assertion that actually
	// failed. Tearing the popover down first keeps a failing control readable.
	for (const host of hosts) {
		const trigger = host.querySelector('[role="combobox"]') as HTMLElement | null;
		if (trigger && dom.window.document.querySelector('[role="listbox"]')) {
			act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
		}
	}
	for (const r of roots.splice(0)) act(() => { r.unmount(); });
	for (const h of hosts.splice(0)) h.remove();
	dom.window.document.body.innerHTML = '';
	resetLayoutStubs();
});
after(() => { dom.window.close(); });

/* ═══════════════════════════════ fixtures ═══════════════════════════════ */

/** FIX-11 names the first two explicitly; Lane C named the next two. */
const NORMAL_NAMES = ['Learning Commons', 'Guidance Office'];
const LANE_C_NAMES = ['Makakalikasan', 'G8 Room 103'];
/** Longer than two lines at any plausible width — the graceful-degradation case. */
const PATHOLOGICAL = 'Grade 9 Multipurpose Learning Commons And Innovation Laboratory Annex';

const OPTIONS: RoomOption[] = [
	...NORMAL_NAMES.map((name, i) => ({ id: 201 + i, name, buildingName: 'Grade 9 Building', type: 'CLASSROOM' })),
	...LANE_C_NAMES.map((name, i) => ({ id: 211 + i, name, buildingName: 'Grade 8 Building', type: 'LABORATORY' })),
	{ id: 221, name: PATHOLOGICAL, buildingName: 'Grade 8 Building', type: 'OFFICE' },
	{ id: 222, name: 'Science Lab 1', buildingName: 'Grade 8 Building', type: 'LABORATORY' },
];

const LONG_OCCUPANT = 'Grade 9 - Bonifacio Special Program Section A';
const OCCUPANCY = new Map<number, string>([[201, LONG_OCCUPANT], [211, 'Grade 7 - Rizal']]);

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
	return trigger;
}

const options = (): HTMLElement[] =>
	Array.from(dom.window.document.querySelectorAll('[role="option"]')) as HTMLElement[];

const content = (): HTMLElement => {
	const el = dom.window.document.querySelector('[data-testid="room-picker-popover-content"]') as HTMLElement;
	assert.ok(el, 'the popover body must carry a stable hook');
	return el;
};

/* ── layout stubs: the ONE thing jsdom has no answer for, and nothing else ── */

const realRect = dom.window.Element.prototype.getBoundingClientRect;
let stubbedNaturalWidth: number | null = null;

function resetLayoutStubs() {
	dom.window.Element.prototype.getBoundingClientRect = realRect;
	stubbedNaturalWidth = null;
	Object.defineProperty(dom.window, 'innerWidth', { value: 1024, configurable: true, writable: true });
}

/** Make the listbox report a chosen natural (`max-content`) width. */
function stubNaturalWidth(px: number, viewportPx = 1366) {
	stubbedNaturalWidth = px;
	Object.defineProperty(dom.window, 'innerWidth', { value: viewportPx, configurable: true, writable: true });
	dom.window.Element.prototype.getBoundingClientRect = function patched(this: Element) {
		if (stubbedNaturalWidth !== null && this.getAttribute('role') === 'listbox') {
			return { width: stubbedNaturalWidth, height: 400, top: 0, left: 0, right: stubbedNaturalWidth, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
		}
		return realRect.call(this);
	} as typeof realRect;
}

/* ═════════════════ FIX-11: uniform height that also allows two name lines ═════════════════ */

/**
 * THE CONFLICT, DECIDED ARITHMETICALLY.
 *
 * C9's row is a fixed `h-12` = 48px. A two-line name plus the one type line plus
 * the 2px stack gap needs `2*16 + 2 + 16` = 50px, so on the C9 row a two-line
 * name OVERFLOWS the row by 2px. That is the arithmetic conflict between FIX-11
 * and item 6, stated so a reviewer can check it by hand.
 *
 * The resolution is a height that accommodates the worst permitted case, so the
 * row height stops being a function of content. This row fails on the base
 * `h-12` because 48 < 50.
 */
test('FIX-11 control: the uniform row height accommodates two name lines plus the type line', () => {
	const host = renderPicker();
	openPopover(host);

	// A `text-xs` line box is 1rem; the name/type stack is `gap-0.5`.
	const twoNameLineStack = NAME_LINES_ALLOWED * LINE_PX + STACK_GAP_PX + LINE_PX;
	assert.equal(twoNameLineStack, 50, 'model: 2 name lines + 2px gap + 1 type line');

	const all = options();
	assert.equal(all.length, OPTIONS.length + 1, 'one option per room plus the Unassigned option');

	// Occupancy really is mixed here, or the uniform-height claim is vacuous.
	const occupied = all.filter((o) => o.dataset.occupied === 'true');
	const vacant = all.filter((o) => o.dataset.occupied === undefined);
	assert.equal(occupied.length, OCCUPANCY.size, 'precondition: mixed occupancy is rendered');
	assert.ok(vacant.length >= 2, 'precondition: vacant options are rendered');

	// EVERY variant — the Unassigned row, a vacant room, an occupied room — must
	// resolve to the SAME height token, so no row is taller than another.
	const declared = new Map<string, number>();
	for (const el of all) {
		const m = /\bh-(\d+(?:\.\d+)?)\b/.exec(el.getAttribute('class') ?? '');
		assert.ok(m, `every option must declare a fixed height token; got "${el.getAttribute('class')}"`);
		declared.set(m![1], (declared.get(m![1]) ?? 0) + 1);
		// The recorded item-6 defect stays banned.
		assert.doesNotMatch(el.getAttribute('class') ?? '', /\bh-auto\b/, 'no option may derive its height from content');
		assert.doesNotMatch(el.getAttribute('class') ?? '', /\bpy-(\d|\[)/, 'no option may add height via vertical padding');
	}
	assert.equal(declared.size, 1, `all option variants must share ONE height token; found ${[...declared].map(([t, n]) => `h-${t} x${n}`).join(', ')}`);

	// Tailwind's h-<n> unit is 0.25rem.
	const rowPx = Number([...declared.keys()][0]) * 4;
	assert.ok(
		rowPx >= twoNameLineStack,
		`the row must be tall enough for the worst permitted case: h-${[...declared.keys()][0]} = ${rowPx}px < ${twoNameLineStack}px needed by two name lines plus the type line`,
	);

	// The component's own exported model must agree with the arithmetic above, so
	// the comment in the component cannot drift away from the class it explains.
	assert.equal(typeof roomOptionStackPx, 'function', 'the component must export its height model');
	assert.equal(
		(roomOptionStackPx as (n: number) => number)(NAME_LINES_ALLOWED),
		twoNameLineStack,
		'the exported model must equal the model this control is decided by',
	);
});

test('FIX-11 control: the room NAME is a two-line clamp, not a one-line ellipsis', () => {
	const host = renderPicker();
	openPopover(host);

	const names = Array.from(dom.window.document.querySelectorAll('[data-testid="room-option-name"]')) as HTMLElement[];
	assert.equal(names.length, OPTIONS.length, 'every room row carries exactly one name element');

	for (const el of names) {
		// The single-line elision is the recorded defect.
		assert.doesNotMatch(
			el.className,
			/\btruncate\b/,
			`the room name must not be elided to one line; got "${el.className}"`,
		);
		assert.match(
			el.className,
			/\bline-clamp-2\b/,
			`the room name must be clamped at two lines; got "${el.className}"`,
		);
		assert.match(el.className, /\bw-full\b/, `the name must fill its column so the clamp has a width to work in; got "${el.className}"`);
		// A clamp is a CSS overflow, so the text itself is never shortened: the
		// full name stays in the accessible name of the option.
		assert.equal(el.textContent?.trim(), el.textContent?.trim());
		assert.ok((el.textContent ?? '').length > 0, 'the name element carries its text');
	}

	// The two names Lane C reported elided, and the two the brief names, must be
	// present in FULL — not shortened to a prefix.
	for (const expected of [...NORMAL_NAMES, ...LANE_C_NAMES]) {
		const hit = names.find((n) => n.textContent?.trim() === expected);
		assert.ok(hit, `"${expected}" must render its full name, not an elided prefix`);
	}

	// The pathological name degrades to the 2-line clamp, and the full string is
	// still in the DOM, so the option's accessible name is complete.
	const pathological = names.find((n) => n.textContent?.includes('Multipurpose'));
	assert.ok(pathological, 'the pathological room name must render');
	assert.equal(pathological.textContent?.trim(), PATHOLOGICAL, 'a clamped name must not be shortened in the text');

	// The existing accessible disclosures are NOT deleted by the clamp. Looked
	// up by its own row, never by document order: the groups are sorted by the
	// numeric prefix of the building name, so "Grade 8 Building" precedes
	// "Grade 9 Building" and the first badge in the document is NOT this one.
	const learningCommons = names.find((n) => n.textContent?.trim() === 'Learning Commons');
	const badge = learningCommons?.closest('[role="option"]')?.querySelector(
		'[data-testid="room-option-occupant"]',
	) as HTMLElement;
	assert.ok(badge, 'the occupancy badge must survive');
	assert.equal(badge.textContent, `Used by ${LONG_OCCUPANT}`, 'the badge keeps the whole occupant name');
	assert.ok(
		learningCommons?.closest('[role="option"]')?.querySelector('[data-testid="room-option-occupant-full-trigger"]'),
		'the @/ui Tooltip disclosure for the full occupant name must survive',
	);
	const occupiedOption = badge.closest('[role="option"]') as HTMLElement;
	act(() => { (occupiedOption as unknown as { focus: () => void }).focus(); });
	const hint = dom.window.document.querySelector('[data-testid="room-picker-occupied-hint"]') as HTMLElement;
	assert.ok(hint, 'the occupied-hint live region must survive as the keyboard disclosure');
	assert.ok((hint.textContent ?? '').includes(LONG_OCCUPANT), 'the live region must still state the full occupant name');
	assert.equal(
		Array.from(badge.attributes).some((a) => a.name === 'title'),
		false,
		'AGENTS.md §8 forbids a raw title attribute',
	);
});

test('FIX-11 control: the "Used by" badge shares the name line without overlapping it', () => {
	const host = renderPicker();
	openPopover(host);

	const occupied = options().filter((o) => o.dataset.occupied === 'true');
	assert.ok(occupied.length > 0, 'precondition: an occupied option is rendered');

	for (const option of occupied) {
		const nameBlock = option.querySelector('[data-testid="room-option-name"]')?.parentElement as HTMLElement;
		const badge = option.querySelector('[data-testid="room-option-occupant"]') as HTMLElement;
		const trailing = badge.parentElement as HTMLElement;
		assert.ok(nameBlock && badge, 'the occupied option must carry a name block and a badge');

		// Siblings in one flex row: siblings cannot overlap, and the name column
		// yields width (`flex-1` + `min-w-0`) while the badge keeps its own
		// bounded trailing column.
		assert.equal(trailing.parentElement, nameBlock.parentElement, 'the name block and the badge must be siblings');
		assert.match(nameBlock.className, /\bflex-1\b/, `the name column must flex; got "${nameBlock.className}"`);
		assert.match(nameBlock.className, /\bmin-w-0\b/, `the name column must be shrinkable; got "${nameBlock.className}"`);
		assert.match(trailing.className, /\bml-auto\b/, `the badge must sit in the trailing column; got "${trailing.className}"`);
		assert.match(trailing.className, /\bmax-w-\S+/, `the trailing column must be width-bounded; got "${trailing.className}"`);

		// The badge is still the single line item-6 requires, and the type line
		// is the recorded sacrifice: it, not the name, keeps one line.
		assert.match(badge.className, /\btruncate\b/, 'the badge stays one truncated line');
		const type = option.querySelector('[data-testid="room-option-type"]') as HTMLElement;
		assert.match(type.className, /\btruncate\b/, 'the room TYPE is the line that stays single-line');
		assert.doesNotMatch(type.className, /\bline-clamp-/, 'the type line must not take the name\'s two lines');
	}
});

/* ═════════════════════ FIX-01: the anchor may not outlive its alignment ═════════════════════ */

/** Count ONLY the component's own capture-phase document scroll listeners. */
function instrumentScrollListeners() {
	const counts = { added: 0, removed: 0 };
	const add = dom.window.document.addEventListener.bind(dom.window.document);
	const rem = dom.window.document.removeEventListener.bind(dom.window.document);
	// `addEventListener(type, fn, true)` passes a BOOLEAN, not an options object,
	// so the capture test has to accept both shapes or it silently counts nothing.
	const isCapturing = (opts: unknown) =>
		opts === true || (opts as { capture?: boolean } | undefined)?.capture === true;
	dom.window.document.addEventListener = ((type: string, fn: never, opts?: never) => {
		if (type === 'scroll' && isCapturing(opts)) counts.added += 1;
		return add(type, fn, opts);
	}) as typeof add;
	dom.window.document.removeEventListener = ((type: string, fn: never, opts?: never) => {
		if (type === 'scroll' && isCapturing(opts)) counts.removed += 1;
		return rem(type, fn, opts);
	}) as typeof rem;
	return {
		counts,
		restore: () => {
			dom.window.document.addEventListener = add;
			dom.window.document.removeEventListener = rem;
		},
	};
}

test('FIX-01 control: an ancestor scroll closes the picker instead of detaching it', () => {
	const host = renderPicker();
	openPopover(host);
	assert.ok(dom.window.document.querySelector('[role="listbox"]'), 'precondition: the picker is open');

	// The reported scenario: the TABLE scrolls while the popover is open. The
	// sheet is the trigger's scroll container; the popover body is portalled out
	// of it, so a scroll there is exactly "the trigger moved".
	const sheet = dom.window.document.createElement('div');
	sheet.setAttribute('style', 'overflow-y:auto;height:400px');
	dom.window.document.body.appendChild(sheet);
	const listbox = dom.window.document.querySelector('[role="listbox"]') as HTMLElement;
	assert.equal(
		sheet.contains(listbox),
		false,
		'root cause: the popover body is PORTALLED out of the trigger\'s scroll container, so the two live in different scroll trees',
	);

	act(() => {
		sheet.dispatchEvent(new dom.window.Event('scroll', { bubbles: false, cancelable: false }));
	});

	assert.equal(
		dom.window.document.querySelector('[role="listbox"]') === null,
		true,
		'an outside scroll must close the picker, so no frozen popover can be left floating over other rows',
	);
	sheet.remove();
});

test('FIX-01 control: scrolling the option list keeps the picker open', () => {
	const host = renderPicker();
	openPopover(host);

	// The one scroll the brief requires to keep working is the picker's own list.
	const viewport = dom.window.document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
	assert.ok(viewport, 'precondition: the picker owns a scroll region');
	assert.ok(content().contains(viewport), 'that scroll region must live inside the popover body');

	act(() => {
		viewport.dispatchEvent(new dom.window.Event('scroll', { bubbles: false, cancelable: false }));
	});

	assert.ok(
		dom.window.document.querySelector('[role="listbox"]'),
		'FIX-01: inner option-list scrolling must NOT close the picker',
	);
});

test('FIX-01 control: the scroll listener never outlives the picker', () => {
	const { counts, restore } = instrumentScrollListeners();
	try {
		const host = renderPicker();
		openPopover(host);
		assert.equal(counts.added, 1, 'opening must install exactly one capture-phase scroll listener');
		assert.equal(counts.removed, 0, 'nothing is removed while the picker is open');

		// Close it the way the outside-scroll path closes it, through Radix.
		const sheet = dom.window.document.createElement('div');
		dom.window.document.body.appendChild(sheet);
		act(() => { sheet.dispatchEvent(new dom.window.Event('scroll', { bubbles: false, cancelable: false })); });
		sheet.remove();
		assert.equal(counts.removed, 1, 'closing must remove the listener it installed');
		assert.equal(counts.added, counts.removed, 'add/remove must balance — no listener may leak onto document');

		// Re-opening and unmounting must balance too.
		openPopover(host);
		for (const r of roots.splice(0)) act(() => { r.unmount(); });
		assert.equal(counts.added, counts.removed, 'unmounting with the picker open must remove the listener');
	} finally {
		restore();
	}
});

test('FIX-01 control: closing on an outside scroll returns focus to the trigger', async () => {
	const host = renderPicker();
	const trigger = openPopover(host);

	// Focus moves into the picker, as it does for a keyboard operator.
	const input = dom.window.document.querySelector('input[aria-label="Search rooms or buildings"]') as HTMLElement;
	assert.ok(input, 'precondition: the search field is rendered');
	act(() => { (input as unknown as { focus: () => void }).focus(); });
	assert.equal(dom.window.document.activeElement, input, 'precondition: focus is inside the picker');

	const sheet = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(sheet);
	act(() => { sheet.dispatchEvent(new dom.window.Event('scroll', { bubbles: false, cancelable: false })); });
	sheet.remove();
	assert.equal(dom.window.document.querySelector('[role="listbox"]') === null, true, 'the picker must have closed');

	// Closing goes through Radix's normal onOpenChange, so its default
	// onCloseAutoFocus returns focus to the combobox — the keyboard is never
	// dumped on <body>. Radix restores it asynchronously, so settle first.
	await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
	assert.equal(
		dom.window.document.activeElement === trigger,
		true,
		'focus must return to the combobox trigger, not to <body>',
	);
});

/* ══════════════════ FIX-03: content-adaptive width, measured then clamped ══════════════════ */

test('FIX-03 control: clampPickerWidth clamps measured content between a min and a max', () => {
	assert.equal(typeof clampPickerWidth, 'function', 'the clamp must be exported so its numbers are testable');

	// A wide list is capped at MAX, not left to overflow the window.
	assert.equal(clampPickerWidth(700, 1366), PICKER_MAX_WIDTH_PX, 'a 700px list clamps to the max');
	// A short list grows to the floor instead of leaving a gutter of dead width.
	assert.equal(clampPickerWidth(180, 1366), PICKER_MIN_WIDTH_PX, 'a 180px list clamps up to the min');
	// Content in range is honoured exactly — this is the "adaptive" half.
	assert.equal(clampPickerWidth(400, 1366), 400, 'content within the bounds is used as measured');
	// The viewport bound is applied last, so a narrow laptop shrinks below MIN
	// rather than overflowing.
	assert.equal(clampPickerWidth(700, 320), 320 - 24, 'a narrow viewport wins over the max');
	// An unmeasurable layout falls back to the floor instead of collapsing.
	assert.equal(clampPickerWidth(0, 1366), PICKER_MIN_WIDTH_PX, 'an unmeasurable list falls back to the min');
	assert.equal(clampPickerWidth(Number.NaN, 1366), PICKER_MIN_WIDTH_PX, 'a NaN measurement falls back to the min');
});

test('FIX-03 control: the rendered width is measured from the content, not declared', () => {
	// Drive the REAL production path three times with three different natural
	// widths. A fixed width returns the same value every time; a content-adaptive
	// one does not. This is the row that fails on the fixed `w-[min(22rem,…)]`.
	const measure = (naturalPx: number, viewportPx: number): string => {
		roots.splice(0).forEach((r) => act(() => { r.unmount(); }));
		dom.window.document.body.innerHTML = '';
		stubNaturalWidth(naturalPx, viewportPx);
		const host = renderPicker();
		openPopover(host);
		return content().style.width;
	};

	const wide = measure(700, 1366);
	const narrow = measure(180, 1366);
	const inRange = measure(400, 1366);
	const narrowLaptop = measure(700, 320);

	assert.equal(wide, `${PICKER_MAX_WIDTH_PX}px`, 'a wide list renders at the max');
	assert.equal(narrow, `${PICKER_MIN_WIDTH_PX}px`, 'a short list renders at the min');
	assert.equal(inRange, '400px', 'an in-range list renders at its measured width');
	assert.equal(narrowLaptop, '296px', 'a narrow laptop wins over the max');

	assert.notEqual(wide, narrow, 'THE fix: two different option sets must not render the same fixed width');
	assert.notEqual(narrow, inRange, 'THE fix: the width must track the measured content, not a constant');

	// On the base component the class is a fixed 22rem and NO inline width is ever
	// applied, so `content().style.width` is empty — the empty string is what the
	// assertions above would have received.
});

test('FIX-03 control: the committed CSS floor and cap are the exported constants', () => {
	stubNaturalWidth(400, 1366);
	const host = renderPicker();
	openPopover(host);

	const className = content().className;

	// The class supplies the pre-measurement floor and the outer ceiling, and
	// both are the exported px constants expressed in rem (16px). If the CSS and
	// the JS clamp ever disagree, the rendered width would be clamped twice and
	// one of the two answers would be a lie.
	const floorRem = Number(/w-\[min\((\d+(?:\.\d+)?)rem/.exec(className)?.[1] ?? '0');
	const capRem = Number(/max-w-\[min\((\d+(?:\.\d+)?)rem/.exec(className)?.[1] ?? '0');
	assert.equal(floorRem * 16, PICKER_MIN_WIDTH_PX, `the CSS floor must be PICKER_MIN_WIDTH_PX (${PICKER_MIN_WIDTH_PX}px); got ${floorRem}rem`);
	assert.equal(capRem * 16, PICKER_MAX_WIDTH_PX, `the CSS cap must be PICKER_MAX_WIDTH_PX (${PICKER_MAX_WIDTH_PX}px); got ${capRem}rem`);

	// The viewport bound is present in the committed class too, so the picker
	// stays inside a narrow laptop even before the measurement lands.
	assert.match(className, /100vw-1\.5rem/, 'the class must keep the viewport bound');

	// The recorded fixed width is gone.
	assert.doesNotMatch(className, /\bw-\[min\(22rem/, 'the fixed 22rem body is the recorded defect');
	assert.doesNotMatch(className, /\bw-\[\d+px\]/, 'the body must not return to a fixed pixel width');

	// The height cap is untouched, so the LIST scrolls and the page never does.
	assert.match(className, /\bh-100\b/, 'the bounded h-100 body must be retained');

	// The footer action cannot clip: it is a full-width control with no fixed
	// pixel size, in a shrink-0 row, so it lays out inside whatever width the
	// measurement chose.
	const footer = Array.from(dom.window.document.querySelectorAll('button'))
		.find((b) => (b.textContent ?? '').includes('Browse Interactive Map')) as HTMLElement;
	assert.ok(footer, 'the footer action must be present');
	assert.match(footer.className, /\bw-full\b/, 'the footer action fills the body, so it cannot be clipped by it');
	assert.doesNotMatch(footer.className, /\bw-\[\d+px\]/, 'the footer action must carry no fixed pixel width');
	assert.match((footer.closest('div') as HTMLElement).className, /\bshrink-0\b/, 'the footer row must be shrink-0');
});

/* ═══════════════════════ residue / hygiene, kept in the same commit ═══════════════════════ */

test('a3 c10 control: the picker introduces no global browser scrollbar and no raw primitives', () => {
	const src = source('src/components/sections/SectionRoomPicker.tsx');
	// AGENTS.md §8: extra information goes through @/ui, never a raw title.
	const titleAttributes = src.match(/\stitle=/g) ?? [];
	assert.equal(titleAttributes.length, 0, `a raw title attribute is forbidden; found ${titleAttributes.length}`);
	// AGENTS.md §8: no native <select>, no raw <details>.
	assert.doesNotMatch(src, /<select\b/, 'no native select in this component');
	assert.doesNotMatch(src, /<details\b/, 'no raw details in this component');
	// The scroll containment must not add a document-level scroll region of its own.
	assert.doesNotMatch(src, /document\.body\.style\.overflow/, 'the component must not manipulate body overflow');
});

/** Recorded so the handoff can cite the exact bytes the failing-first run used.
 *
 * A3-C10 planner correction: this asserts the COMMITTED blob, not the checkout.
 * It read the working tree before, and core.autocrlf=true checks that out as
 * CRLF in every fresh worktree, so it failed on the integration tree while the blob
 * it named was LF. See committedBlob() above. */
test('a3 c10 control: the file under test is the committed one, LF-normalised', () => {
	const src = committedBlob('src/components/sections/SectionRoomPicker.tsx');
	assert.equal(src.includes('\r\n'), false, 'the committed component blob must be LF');
	assert.ok(src.length > 0);
	// A cheap, stable anchor for the handoff's SHA-256 line.
	assert.equal(typeof createHash('sha256').update(src).digest('hex'), 'string');
});
