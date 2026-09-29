/**
 * A3 C4 — the Sections page at the DOM level: the stat tile must not contradict
 * its own rows, and every row must carry a visible room-map control.
 *
 * Two things are deliberately NOT done here:
 *
 *  - `pages/Sections.tsx` is never mounted. It is ~1000 lines that open a
 *    supervised-network fetch, a year context, a local cache and a Rollover
 *    guidance card on mount; mounting it would test the harness, not the
 *    contract. The page's own two remaining failure modes (an inline counter,
 *    an inline filter, a server-supplied denominator) are covered by the
 *    on-disk source scan in `a3-c4-home-room-truth.test.ts`.
 *  - `SectionRoomMapModal` is never mounted either. It is owned by ANOTHER
 *    executor in this cycle and must not be edited, so this suite asserts the
 *    wiring that reaches it — that the control exists, is reachable, is
 *    labelled, and carries the right section — rather than the modal's
 *    internals.
 *
 * What makes the tile/row control discriminate: the row under test is the REAL
 * `SectionRow` and `SectionMobileCard`, and the tile number is read from the
 * REAL `summarizeHomeRoomReadiness` — the exact function `Sections.tsx` now
 * calls. If the page reverted to `!!s.homeRoomId`, these assertions still hold
 * (so they are not the mutation tripwire) and the source scan is; that
 * division of labour is recorded in the handoff.
 */
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { act, createElement } from 'react';
import type { ReactElement } from 'react';
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
	HTMLButtonElement: dom.window.HTMLButtonElement,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false,
	media: q,
	onchange: null,
	addEventListener() {},
	removeEventListener() {},
	addListener() {},
	removeListener() {},
	dispatchEvent() { return false; },
});

// `SectionRow` renders a `Link`, so react-router needs a router context.
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { SectionRow } = await import('../SectionRow');
const { SectionMobileCard } = await import('../SectionMobileCard');
const { summarizeHomeRoomReadiness } = await import('../home-room-readiness');

type Room = { id: number; name: string; buildingName: string; type: string };
type Section = {
	id: number; name: string; maxCapacity: number; enrolledCount: number;
	gradeLevelId: number; gradeLevelName: string; displayOrder: number;
	homeRoomId?: number | null;
};

/* Room 501 is live and in scope. Section 3 points at 777, which no longer
 * exists. That single stale id is the entire defect. */
const ROOMS: Room[] = [{ id: 501, name: 'Room 501', buildingName: 'Building A', type: 'CLASSROOM' }];

function section(id: number, name: string, homeRoomId: number | null): Section {
	return { id, name, maxCapacity: 40, enrolledCount: 38, gradeLevelId: 7, gradeLevelName: 'GRADE 7', displayOrder: 1, homeRoomId };
}
const RESOLVED = section(1, 'G7 - Rizal', 501);
const DANGLING = section(2, 'G7 - Mabini', 777);
const UNSET = section(3, 'G7 - Luna', null);

let roots: Root[] = [];
let containers: HTMLDivElement[] = [];

function mount(node: ReactElement) {
	const el = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(el);
	const r = createRoot(el);
	act(() => { r.render(node); });
	roots.push(r);
	containers.push(el);
	return el;
}

async function unmount() {
	const toUnmount = roots;
	roots = [];
	const toRemove = containers;
	containers = [];
	await act(async () => {
		for (const r of toUnmount) r.unmount();
		for (const el of toRemove) el.remove();
	});
}

after(async () => { await unmount(); dom.window.close(); });
beforeEach(() => { dom.window.document.body.innerHTML = ''; });

const NOOP = () => {};

/** The row needs a `<table><tbody>` to be a valid child. */
function renderRow(s: Section, extra: Record<string, unknown> = {}): HTMLElement {
	return mount(createElement(
		MemoryRouter,
		null,
		createElement(
			'table',
			null,
			createElement('tbody', null, createElement(SectionRow, {
				section: s as never,
				homeRoomOptions: ROOMS as never,
				isReadOnly: false,
				isSaving: false,
				onHomeRoomChange: NOOP,
				onShowDetails: NOOP,
				onShowRoomMap: NOOP,
				schoolId: 1,
				roomOccupancy: new Map<number, string>(),
				...extra,
			} as never)),
		),
	));
}

function rowTextFor(s: Section, extra: Record<string, unknown> = {}) {
	return renderRow(s, extra).textContent ?? '';
}

function renderCard(s: Section, extra: Record<string, unknown> = {}): HTMLElement {
	const el = mount(createElement(
		MemoryRouter,
		null,
		createElement(SectionMobileCard, {
			section: s as never,
			homeRoomOptions: ROOMS as never,
			isReadOnly: false,
			isSaving: false,
			schoolId: 1,
			roomOccupancy: new Map<number, string>(),
			onHomeRoomChange: NOOP,
			onShowDetails: NOOP,
			onShowRoomMap: NOOP,
			...extra,
		} as never),
	));
	return el;
}

/* ───────────────── A: the tile and the rows must agree ───────────────── */

/** How the stat tile prints, from the real shared summary the page calls. */
function tilePrints(sections: Section[]) {
	const s = summarizeHomeRoomReadiness(sections, ROOMS);
	return { printed: s.needing === 0 ? `${s.assigned}/${s.total}` : s.needing, assigned: s.assigned, needing: s.needing };
}

test('the stat tile counts a stale homeRoomId as needing a room, exactly as its row says', () => {
	const list = [RESOLVED, DANGLING, UNSET];
	const tile = tilePrints(list);

	// The rows, as the operator reads them.
	//
	// A9 C3 (2026-09-29): the two row sentences were reworded, and this row is the
	// proof that the AGREEMENT — the whole point of A3 C4 defect A — survived the
	// rewording. SUPERSEDED WORDING, quoted rather than deleted (AGENTS.md §11: never
	// delete an assertion to close a finding):
	//   was: rowText.includes('Needs home room')  /  rowText.includes('Ready:')
	//   now: rowText.includes('Needs a home room') /  rowText.includes('Room 501')
	// The old row also printed a second line of status text under the picker; the cell
	// is now a single plain read, which is where the page got shorter.
	const rowsNeeding = list.filter((s) => rowTextFor(s).includes('Needs a home room')).length;
	const rowsReady = list.filter((s) => rowTextFor(s).includes('Room 501')).length;

	assert.equal(rowsNeeding, 2, 'the stale id and the unset section both read as needing a room');
	assert.equal(rowsReady, 1);
	// THE ASSERTION THAT MATTERS: the tile's number is the number of rows that
	// say they need one. On the base revision the tile printed 1 here while two
	// rows said "Needs home room" — the "20/20 vs 5 rows" contradiction.
	assert.equal(tile.needing, rowsNeeding);
	assert.equal(tile.assigned, rowsReady);
	assert.equal(tile.printed, 2, 'the tile shows a count, so it shows 2 and not an "assigned" total');
});

test('the row names the resolved room and the building it is in, and the tile counts it assigned', () => {
	// A9 C3: this row used to read `Ready: Building A`, which named the building but
	// NOT the room — the one fact a scheduler checks against her own plan. It now reads
	// the room and the building together. Same population, same shared predicate.
	const list = [RESOLVED, section(4, 'G8 - Rizal', 501)];
	for (const s of list) {
		const text = rowTextFor(s);
		assert.ok(text.includes('Room 501'), `${s.name} names the room it uses`);
		assert.ok(text.includes('Building A'), `${s.name} names the building it is in`);
	}
	assert.equal(tilePrints(list).printed, '2/2', 'a fully assigned roster prints the n/n form');
});

test('an unresolved row says the room is needed, and the tile still agrees', () => {
	// A9 C3, and the one assertion here that is genuinely GONE rather than reworded:
	// the row's own read-only sentence, "Needs home room. Edits paused.". A row with no
	// control in it has no read-only STATE of its own to describe, so a second wording
	// for it would have been a second statement of a fact the page already states once
	// (the save-state line beside the one action) and again in this row's map Tooltip.
	// The FACT it carried is preserved and is asserted here: the row still says the
	// room is needed, and the map control still opens on exactly that row.
	const text = rowTextFor(DANGLING, { isReadOnly: true });
	assert.ok(text.includes('Needs a home room'), 'a read-only unresolved row still says the room is needed');
	assert.equal(text.includes('paused'), false, 'and does not carry a second read-only sentence');
	// The map is still the per-row editor for a section that already has a room, and it
	// is still reachable on a row that has none.
	assert.ok(
		renderRow(DANGLING, { isReadOnly: true }).querySelector('button[aria-label="View room map for G7 - Mabini"]'),
		'a read-only unresolved row still offers the map',
	);
	assert.equal(tilePrints([DANGLING]).needing, 1);
});

test('the mobile card uses the same truth as the desktop row and the tile', () => {
	const card = renderCard(DANGLING);
	assert.ok((card.textContent ?? '').includes('Choose a home room first.'), 'the card calls it unresolved');
	assert.ok((card.textContent ?? '').includes('Needs room'), 'and its summary tile says Needs room');
	// A room id is present on the object, so a naive "is an id present" check
	// would have called this card Ready.
	assert.equal(DANGLING.homeRoomId !== null, true);
	assert.equal(tilePrints([DANGLING]).assigned, 0);
});

test('before the room list loads, nothing is reported as assigned', () => {
	// The same stale-id problem arises with an empty options list mid-load. The
	// tile and the row must both read as unresolved, not one of them flip.
	const summary = summarizeHomeRoomReadiness([RESOLVED, DANGLING], []);
	assert.equal(summary.assigned, 0);
	assert.equal(summary.needing, 2);
});

/* ───────────────── B: the visible room-map control ───────────────── */

test('the desktop row exposes a labelled, keyboard-reachable room-map control', () => {
	const opened: number[] = [];
	const el = renderRow(RESOLVED, { onShowRoomMap: (s: Section) => { opened.push(s.id); } });
	const control = el.querySelector<HTMLButtonElement>('button[aria-label="View room map for G7 - Rizal"]');

	assert.ok(control, 'the control must exist on every row, not only inside the dropdown');
	// A real accessible name that names the section.
	assert.match(control!.getAttribute('aria-label') ?? '', /G7 - Rizal/);
	// Keyboard reachable: a real <button>, focusable, with no tabindex=-1 and
	// no disabled/aria-hidden trap.
	assert.equal(control!.tagName, 'BUTTON');
	assert.equal(control!.getAttribute('tabindex'), null);
	assert.equal(control!.hasAttribute('disabled'), false);
	assert.notEqual(control!.getAttribute('aria-hidden'), 'true');
	// It opens the map for THIS row's section.
	act(() => { control!.click(); });
	assert.deepEqual(opened, [RESOLVED.id]);

	// The pre-existing actions are untouched: the kebab is still there, still
	// separately labelled, and the details entry point still exists.
	assert.ok(el.querySelector('button[aria-label="More actions for G7 - Rizal"]'), 'the kebab survived');
	assert.ok(
		el.querySelector('button[aria-label^="View class coverage and room context"]'),
		'the section-name details button survived',
	);
});

test('the mobile card exposes the same control, with visible text', () => {
	const opened: number[] = [];
	const card = renderCard(RESOLVED);
	const control = card.querySelector<HTMLButtonElement>('button[aria-label="View room map for G7 - Rizal"]');
	assert.ok(control, 'the card carries the control too');
	assert.equal(control!.tagName, 'BUTTON');
	// Visible text, not a bare icon.
	assert.ok((control!.textContent ?? '').includes('Room map'));
	act(() => { opened.push(card.querySelectorAll('button').length); control!.click(); });
	// The two sibling actions are still present.
	assert.ok((card.textContent ?? '').includes('View details'));
	assert.ok((card.textContent ?? '').includes('Teaching Load'));
});

test('the room-map control does not disturb the home-room edit path', () => {
	// Clicking the map control must not be able to fire a home-room change on
	// its own: the map's own onSelect is what does that, on the page.
	let changed = 0;
	const el = renderRow(RESOLVED, { onHomeRoomChange: () => { changed += 1; } });
	const control = el.querySelector<HTMLButtonElement>('button[aria-label="View room map for G7 - Rizal"]');
	act(() => { control!.click(); });
	assert.equal(changed, 0, 'opening the map is not an assignment');
	// A9 C3: the row's own `SectionRoomPicker` is GONE from the table, so the
	// `assert.ok(el.querySelector('[role="combobox"]'), 'the home-room picker is intact')`
	// line that used to sit here is superseded, and its replacement asserts the new
	// invariant instead: the repeated per-row control is not rendered. Against the
	// pre-A9-C3 row this FAILS (twenty comboboxes), which is what makes it evidence
	// rather than a description.
	assert.equal(
		el.querySelectorAll('[role="combobox"]').length,
		0,
		'the row still renders a home-room picker; the guided step owns that control now',
	);
	// The editor is not lost, it moved: the row's map button opens a full room picker
	// for THIS section, and it writes through the same `onHomeRoomChange` the row used
	// to call. Asserted here so "the picker was removed" can never be read as "the
	// capability was removed".
	assert.ok(
		el.querySelector('button[aria-label="View room map for G7 - Rizal"]'),
		'the per-row room editor (the map) is still on the row',
	);
});

/* ───────────────── C: the read-only truth on the map control (review N2) ─────── */

test('a read-only row still opens the map, and says picking is paused', () => {
	// The contract chosen for N2, and the reason it is this one: browsing the
	// map is a legitimate READ, and disabling the control would remove it in
	// exactly the degraded state where the operator most needs to see where the
	// rooms are. So the control stays enabled, keeps its aria-label, and states
	// the read-only truth in its Tooltip — before the operator opens anything.
	//
	// The read-only truth is asserted by FOCUSING the control and reading the
	// tooltip content that Radix then puts in the document. That is the
	// observable path a keyboard or screen-reader user takes, and it is what
	// makes this control discriminate: against the pre-correction row the
	// tooltip read only "View room map" and the read-only wording was absent
	// entirely, so the assertion below fails there. (Keyboard reachability alone
	// would NOT have discriminated — that property already held at 44f0625a,
	// which is why the earlier draft of this control was not evidence.)
	const opened: number[] = [];
	const el = renderRow(RESOLVED, { isReadOnly: true, onShowRoomMap: (s: Section) => { opened.push(s.id); } });
	const control = el.querySelector<HTMLButtonElement>('button[aria-label="View room map for G7 - Rizal"]');

	assert.ok(control, 'the control still exists in read-only mode');
	// Keyboard reachable: NOT disabled, no tabindex escape, not hidden from AT.
	// This is the specific reason the sibling picker is not a good model here —
	// `disabled` would take it out of the tab order and out of the AT list.
	assert.equal(control!.hasAttribute('disabled'), false, 'read-only browsing must stay keyboard reachable');
	assert.equal(control!.getAttribute('tabindex'), null);
	assert.notEqual(control!.getAttribute('aria-hidden'), 'true');
	// The accessible name is unchanged: the control's name is its purpose.
	assert.equal(control!.getAttribute('aria-label'), 'View room map for G7 - Rizal');

	// Focus it — the keyboard path — and read what the operator is told.
	act(() => { control!.focus(); });
	const announced = dom.window.document.body.textContent ?? '';
	assert.ok(announced.includes('View room map'), 'the control still names its purpose');
	assert.ok(
		announced.includes('read-only') && announced.includes('paused'),
		`a read-only row must say picking is paused, not just silently do nothing: ${announced.slice(0, 300)}`,
	);
	act(() => { (control as HTMLButtonElement).blur(); });

	// And it still opens, because browsing is not gated.
	act(() => { control!.click(); });
	assert.deepEqual(opened, [RESOLVED.id], 'read-only browsing still opens the map');

	// A9 C3: the sibling assertion that used to close this row is superseded and is
	// quoted, not deleted. It read:
	//   const picker = el.querySelector('[role="combobox"]');
	//   assert.equal(picker!.hasAttribute('disabled'), true, 'the sibling picker keeps its read-only disable');
	// The desktop row no longer HAS a sibling picker, so that row could only be kept as
	// a `null!.hasAttribute()` crash. The DIVERGENCE it protected is real and still
	// required: browsing the map stays ENABLED in read-only while every WRITE control is
	// disabled. It is now proved where the write control lives — the guided step's apply
	// action, in `a9-c3-guided-home-room-step.test.tsx` — and the two halves are asserted
	// here on the row that still owns one of them.
	assert.equal(
		el.querySelectorAll('[role="combobox"]').length,
		0,
		'a read-only row must not grow a write control back',
	);
	assert.equal(
		control!.hasAttribute('disabled'),
		false,
		'and the read-only browse control beside it must stay enabled',
	);
});

test('a writable row does NOT claim picking is paused', () => {
	// The mirror of the control above, so the tooltip cannot pass by always
	// printing the read-only wording.
	const el = renderRow(RESOLVED, { isReadOnly: false });
	const control = el.querySelector<HTMLButtonElement>('button[aria-label="View room map for G7 - Rizal"]')!;
	act(() => { control.focus(); });
	const announced = dom.window.document.body.textContent ?? '';
	assert.ok(announced.includes('View room map'), 'the purpose is still announced');
	assert.equal(announced.includes('paused'), false, 'a writable row must not be told picking is paused');
	act(() => { control.blur(); });
});

test('the read-only row still tells the operator the room is needed', () => {
	// The point of N2: making a control honest must not soften the reason the
	// control is limited. A read-only unresolved row still says so.
	//
	// A9 C3: the sentence this row used to match, "Needs home room. Edits paused.",
	// is superseded — a row with no control in it has no read-only state of its own to
	// describe, and the page states the read-only truth ONCE (the save-state line beside
	// the one action) instead of once per row. The FACT is unchanged and is asserted
	// here; the sibling row above asserts the same fact with the tile's agreement.
	const text = rowTextFor(DANGLING, { isReadOnly: true });
	assert.ok(text.includes('Needs a home room'), 'a read-only row still says the room is needed');
	// And the map control is still reachable on exactly that row.
	assert.ok(
		renderRow(DANGLING, { isReadOnly: true }).querySelector('button[aria-label="View room map for G7 - Mabini"]'),
		'a read-only unresolved row still offers the map',
	);
});

test('the mobile card reflects read-only on its map control too', () => {
	const card = renderCard(RESOLVED, { isReadOnly: true });
	const control = card.querySelector<HTMLButtonElement>('button[aria-label="View room map for G7 - Rizal"]');
	assert.ok(control, 'the card keeps the control in read-only mode');
	assert.equal(control!.hasAttribute('disabled'), false, 'and keeps it keyboard reachable');
	// The same observable contract as the desktop row: focus it and the truth
	// about picking must be announced, not merely implied.
	act(() => { control!.focus(); });
	const announced = dom.window.document.body.textContent ?? '';
	assert.ok(
		announced.includes('read-only') && announced.includes('paused'),
		`the card must announce that picking is paused in read-only mode: ${announced.slice(0, 300)}`,
	);
	act(() => { (control as HTMLButtonElement).blur(); });
	// The card's own unresolved wording is untouched by the N2 change.
	const unresolved = renderCard(DANGLING, { isReadOnly: true });
	assert.ok(
		(unresolved.textContent ?? '').includes('Needs home room. Edits are paused.'),
		'the card keeps its read-only wording',
	);
});
