/**
 * A9 C6 (2026-09-29) — fix 1.2 ITEM 7.2, RENDERED: the readiness list is narrowed by
 * four real filter buttons, in the order a human says the rooms out loud, and it says
 * so in a sentence when a filter has nothing behind it.
 *
 * THE OPERATOR'S OWN REQUEST (`docs/prompts/fix-1.2-2026-09-29.md`, item 7.2), verbatim:
 * "Room readiness pills become filter buttons: All rooms (default) / Ready / Needs
 * attention / Unavailable, with an obvious active state; rooms always in natural name
 * order (G10 Room 101, 102 … 201); empty state 'No rooms currently marked as Needs
 * attention.'"
 *
 * WHY HALF OF THIS FILE IS A MOUNT AND HALF IS PURE. The four claims split cleanly, and
 * the split is the point (`AGENTS.md` §11: a test that only asserts source text is not
 * acceptance evidence):
 *   - WHAT THE PAGE MAY CLAIM is a pure decision — which status belongs to which filter,
 *     what the order is, what the sentence says. Deciding it from the exported functions
 *     means a control reads the DATA, not the JSX, which is the split
 *     `a3-c4-home-room-truth.test.ts` forced on the Sections tile after a 17/17 suite
 *     shipped "Home rooms 3/3" beside two rows that said otherwise.
 *   - WHAT THE SCHEDULER SEES is a mount. `aria-pressed`, the active state, the set of
 *     rows after a click, and the empty sentence on screen are DOM facts; no source read
 *     can decide them. The mount asserts `window.location.origin` and every row below
 *     states the base value it differs from.
 *
 * FAILING-FIRST, recorded rather than asserted. On the base revision (`7d008db7`) this
 * file's DOM half had NO `room-readiness-filter` element at all — the list was behind a
 * single `room-readiness-show-all` toggle, so the four buttons, the counts, the active
 * state, the natural order and the empty sentence did not exist and every row below
 * fails. The pure half is the same: `roomMatchesFilter`, `compareRoomNamesNatural` and
 * `roomReadinessFilterEmptySentence` were not exported, so the import itself fails.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, beforeEach, test } from 'node:test';

import { JSDOM } from 'jsdom';

// This file is at `src/components/campus-map/__tests__/`, so the client root is four
// levels up. Recorded literally because a wrong depth here reads as a missing file
// rather than as a wrong path, and that is a confusing way to lose a run.
const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const LIST = resolve(CLIENT_ROOT, 'src/components/campus-map/RoomReadinessList.tsx');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/map',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	SVGElement: dom.window.SVGElement,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	MouseEvent: dom.window.MouseEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	FocusEvent: dom.window.FocusEvent,
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
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
// `RoomReadinessList` renders a `Link` into the editor deep link, so react-router
// context is required — the same reason `a3-c4-sections-surface.test.tsx` mounts one.
const { MemoryRouter } = await import('react-router-dom');
const {
	ROOM_READINESS_FILTERS,
	RoomReadinessList,
	buildRoomProblemGroups,
	compareRoomNamesNatural,
	roomMatchesFilter,
	roomProblemSummary,
	roomReadinessCounts,
	roomReadinessFilterEmptySentence,
} = await import('../RoomReadinessList');

type Room = import('@/types').Room;
type Building = import('@/types').Building;
type Status = import('@/components/campus-map/RoomReadinessList').RoomReadinessStatus;
type Filter = import('@/components/campus-map/RoomReadinessList').RoomReadinessFilter;
type WithBuilding = import('@/components/campus-map/RoomReadinessList').RoomWithBuilding;

const ALL_STATUSES: readonly Status[] = ['ready', 'needs-capacity', 'needs-room-type', 'needs-section', 'unavailable'];

/**
 * THE FILE'S BYTES, newline-normalised.
 *
 * This checkout is CRLF, so a regex written against `\n\t` silently matches nothing and the
 * assertion fails with a whole-file dump instead of the two characters that differ. Reading
 * and normalising once is what keeps a source assertion decidable.
 */
function source(): string {
	return readFileSync(LIST, 'utf8').replace(/\r\n/g, '\n');
}

/**
 * THE FILE'S MARKUP, with the leading header comment removed.
 *
 * The header is REQUIRED EVIDENCE here — the subtraction ledger has to name the control it
 * removed — so a whole-file scan for `room-readiness-show-all` or `Show all rooms` can never
 * go red, because the ledger mentions both. The assertions about what is GONE therefore
 * read the markup, which is where a surviving control would actually be.
 */
function markup(): string {
	return source().replace(/^\/\*\*[\s\S]*?\*\//, '');
}

function room(id: number, name: string, over: Partial<Room> = {}): Room {
	return { id, name, type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floor: 1, floorPosition: id - 400, ...over } as Room;
}

function building(id: number, name: string, rooms: Room[]): Building {
	return { id, name, floorCount: 1, x: 0, y: 0, width: 100, height: 100, color: '#fff', rotation: 0, gradeScope: [], isTeachingBuilding: true, rooms } as unknown as Building;
}

function entry(buildingId: number, buildingName: string, r: Room, status: Status): WithBuilding {
	return { building: building(buildingId, buildingName, []), room: r, status };
}

/* ───────────────────────── 1: the four filters, their labels, and the default ───────────── */

test('7.2 a: the four filters are the operator\'s four, in her order, and `all` is the default', () => {
	assert.deepEqual(
		ROOM_READINESS_FILTERS.map((f) => f.id),
		['all', 'ready', 'needs-attention', 'unavailable'],
		'the row must be All rooms / Ready / Needs attention / Unavailable, in that order',
	);
	assert.deepEqual(
		ROOM_READINESS_FILTERS.map((f) => f.label),
		['All rooms', 'Ready', 'Needs attention', 'Unavailable'],
		'the labels are the operator\'s words verbatim',
	);
	// The default is a claim about the RENDERED row, asserted in the mount half; here
	// it is asserted as a fact about the data: `all` must claim every measured status,
	// or "All rooms" would read less than the total.
	for (const status of ALL_STATUSES) {
		assert.ok(roomMatchesFilter(status, 'all'), `\`all\` must include ${status} — All rooms that shows less than every room is a lie told by a button`);
	}
});

test('7.2 a: the show/hide toggle is GONE, not kept beside the new row', () => {
	// `AGENTS.md` §11 rule 3, subtract first. The `All rooms` default subsumes it, so
	// keeping it would put two controls for one job on the same row.
	const text = markup();
	assert.doesNotMatch(text, /room-readiness-show-all/, 'the toggle\'s test hook must be removed with the control');
	assert.doesNotMatch(text, /showAllRooms/, 'the toggle\'s state must be removed with the control');
	assert.doesNotMatch(text, /Show all rooms|Hide all rooms/, 'the toggle\'s two labels must be removed with the control');
	assert.doesNotMatch(text, /ChevronDown/, 'the icon it rotated is now unused and must not be left imported');
	// …and the ledger in the header still NAMES it, which is why the assertions above read
	// the markup: a correction is additive evidence, not a scrubbed file (AGENTS.md §16).
	assert.match(source(), /REMOVED {2}the `Show all rooms`/, 'the ledger must still record what was removed');
});

/* ───────────────────────── 2: the status → filter mapping, over every status ───────────── */

test('7.2 b: `needs-attention` is exactly the three `needs-*` statuses, and never `unavailable`', () => {
	// The load-bearing half: a store room is not BROKEN, it was never meant for a class.
	// Folding it into "needs attention" would tell the scheduler that rooms she does not
	// need to fix are rooms she needs to fix.
	assert.ok(roomMatchesFilter('needs-capacity', 'needs-attention'));
	assert.ok(roomMatchesFilter('needs-room-type', 'needs-attention'));
	assert.ok(roomMatchesFilter('needs-section', 'needs-attention'));
	assert.ok(!roomMatchesFilter('ready', 'needs-attention'));
	assert.ok(!roomMatchesFilter('unavailable', 'needs-attention'), 'a non-teaching room is not a problem room');
});

test('7.2 b: the whole matrix — every measured status against every filter', () => {
	// Transcribed from the contract, and it is the full 5x4 grid rather than a sample,
	// because a gap in it is a room the operator cannot find by filtering.
	const expected: Record<Filter, readonly Status[]> = {
		all: ['ready', 'needs-capacity', 'needs-room-type', 'needs-section', 'unavailable'],
		ready: ['ready'],
		'needs-attention': ['needs-capacity', 'needs-room-type', 'needs-section'],
		unavailable: ['unavailable'],
	};
	for (const filter of ROOM_READINESS_FILTERS) {
		for (const status of ALL_STATUSES) {
			assert.equal(
				roomMatchesFilter(status, filter.id),
				expected[filter.id].includes(status),
				`${status} under \`${filter.id}\``,
			);
		}
	}
});

test('7.2 b: an unknown filter id matches NOTHING rather than everything', () => {
	// Fail closed. A typo in a filter id that fell through to "no statuses" would print
	// the whole list under a label promising otherwise; one that fell through to "match
	// everything" would do the same. Neither is acceptable, and only the second is
	// reachable if the predicate is written as `!entry || entry.statuses.includes(...)`.
	assert.equal(roomMatchesFilter('ready', 'nonsense' as Filter), false);
	assert.equal(roomMatchesFilter('needs-section', 'ALL' as Filter), false, 'the comparison is case-sensitive, so a stray capital cannot silently select everything');
});

test('7.2 b: the counts are the rooms each filter would show, and `all` is the total', () => {
	const rooms: WithBuilding[] = [
		entry(1, 'North Wing', room(1, 'G10 Room 101'), 'ready'),
		entry(1, 'North Wing', room(2, 'G10 Room 102'), 'ready'),
		entry(1, 'North Wing', room(3, 'G10 Room 103'), 'needs-capacity'),
		entry(2, 'South Wing', room(4, 'G10 Room 201'), 'needs-room-type'),
		entry(2, 'South Wing', room(5, 'G10 Room 202'), 'needs-section'),
		entry(2, 'South Wing', room(6, 'Store Room'), 'unavailable'),
	];
	assert.deepEqual(roomReadinessCounts(rooms), { all: 6, ready: 2, 'needs-attention': 3, unavailable: 1 });
	// The counts and the predicate must never disagree, or the button says one number and
	// the click shows another — the exact class of defect this suite exists to catch.
	for (const filter of ROOM_READINESS_FILTERS) {
		const shown = rooms.filter((r) => roomMatchesFilter(r.status, filter.id)).length;
		assert.equal(roomReadinessCounts(rooms)[filter.id], shown, `the \`${filter.id}\` button count must equal what clicking it shows`);
	}
	assert.deepEqual(roomReadinessCounts([]), { all: 0, ready: 0, 'needs-attention': 0, unavailable: 0 });
});

/* ───────────────────────── 3: the empty sentences, verbatim ───────────────────────── */

test('7.2 d: each filter has its own sentence, and the operator\'s is used verbatim', () => {
	assert.equal(
		roomReadinessFilterEmptySentence('needs-attention'),
		'No rooms currently marked as Needs attention.',
		'the operator wrote this sentence; it must be reproduced exactly, not paraphrased',
	);
	// Same SHAPE for the other three, not invented wording: they name the filter and
	// say "currently", and `all` reuses the sentence this card has always printed.
	assert.equal(roomReadinessFilterEmptySentence('ready'), 'No rooms are currently marked as Ready.');
	assert.equal(roomReadinessFilterEmptySentence('unavailable'), 'No rooms are currently marked as Unavailable.');
	assert.equal(
		roomReadinessFilterEmptySentence('all'),
		'No rooms yet. Open Edit maps to add the first teaching room.',
		'the zero-rooms sentence is the one this card already prints, reused rather than reworded',
	);
});

/* ───────────────────────── 4: natural name order ───────────────────────── */

test('7.2 c: rooms sort the way a human counts them, not the way a string does', () => {
	const names = ['G10 Room 201', 'G10 Room 102', 'G10 Room 101', 'G10 Room 2', 'G10 Room 10'];
	const sorted = names
		.map((n, i) => entry(1, 'North Wing', room(100 + i, n), 'ready'))
		.sort(compareRoomNamesNatural)
		.map((e) => e.room.name);
	assert.deepEqual(
		sorted,
		['G10 Room 2', 'G10 Room 10', 'G10 Room 101', 'G10 Room 102', 'G10 Room 201'],
		'2 < 10 < 101 < 102 < 201 as numbers',
	);
	// The two cases the operator did not spell out, stated as failures of a plain sort
	// rather than as preferences: a lexicographic sort puts "Room 10" before "Room 2"
	// and "Room 102" before "Room 2"'s successors.
	const lexicographic = [...names].sort();
	assert.ok(lexicographic.indexOf('G10 Room 10') < lexicographic.indexOf('G10 Room 2'), 'precondition: a plain string sort really does mis-order these');
	assert.ok(sorted.indexOf('G10 Room 10') < sorted.indexOf('G10 Room 101'));
});

test('7.2 c: two buildings that both hold a `G10 Room 101` order deterministically', () => {
	const pair = [
		entry(2, 'South Wing', room(1, 'G10 Room 101'), 'ready'),
		entry(1, 'North Wing', room(1, 'G10 Room 101'), 'ready'),
	];
	const forward = [...pair].sort(compareRoomNamesNatural).map((e) => e.building.name);
	const reversed = [...pair].reverse().sort(compareRoomNamesNatural).map((e) => e.building.name);
	assert.deepEqual(forward, ['North Wing', 'South Wing'], 'the BUILDING name breaks the tie, so declaration order cannot leak through');
	assert.deepEqual(reversed, forward, 'the order must not depend on the input order — the same rooms must print the same way twice');
	// A third key so the comparator is total even when two buildings share a name.
	const sameName = [
		entry(1, 'Twin Wing', room(9, 'G10 Room 101'), 'ready'),
		entry(1, 'Twin Wing', room(2, 'G10 Room 101'), 'ready'),
	];
	assert.deepEqual(
		[...sameName].sort(compareRoomNamesNatural).map((e) => e.room.id),
		[2, 9],
		'a tie the building name cannot break falls through to the room id, so the sort is total',
	);
});

/* ───────────────────────── 5: the problems region is UNCHANGED ───────────────────────── */

test('7.2 e regression: `buildRoomProblemGroups` and `roomProblemSummary` behave exactly as before', () => {
	// This is the preservation half of 4e, and it is the guard that lets a reviewer read
	// the diff without re-deriving the problems region. Fixture: one building with two
	// faults, one healthy building (absent from the region by design), one building whose
	// rooms are all non-teaching (present, because zero teaching rooms IS the defect).
	const rooms: WithBuilding[] = [
		entry(1, 'North Wing', room(1, 'G10 Room 101'), 'ready'),
		entry(1, 'North Wing', room(2, 'G10 Room 102'), 'needs-capacity'),
		entry(1, 'North Wing', room(3, 'G10 Room 103'), 'needs-section'),
		entry(2, 'East Wing', room(4, 'G10 Room 201'), 'ready'),
		entry(2, 'East Wing', room(5, 'G10 Room 202'), 'ready'),
		entry(3, 'Annex', room(6, 'Store Room', { isTeachingSpace: false }), 'unavailable'),
		entry(3, 'Annex', room(7, 'Lobby', { isTeachingSpace: false }), 'unavailable'),
	];
	const groups = buildRoomProblemGroups(rooms);
	assert.equal(groups.length, 2, 'the healthy building is absent; the Annex is present with zero teaching rooms');	assert.deepEqual(groups.map((g) => g.buildingName), ['North Wing', 'Annex'], 'worst first, then by name — NOT the natural room order this change introduced');
	assert.equal(groups[0].teachingRooms, 3);
	assert.equal(groups[0].totalRooms, 3);
	assert.equal(groups[0].problems.length, 2);
	assert.equal(
		groups[0].consequence,
		'1 of its 3 teaching rooms have no seat count, so no class can be sized into them.',
		'the consequence copy is byte-identical, and it counts the DOMINANT fault (1) rather than every problem (2) — the group lists both, the sentence names the one that blocks the most',
	);
	assert.equal(groups[0].fix, 'Add how many students each room seats.', 'the fix copy is byte-identical');
	assert.equal(
		groups[1].consequence,
		'None of its 2 rooms is marked as a teaching classroom, so no class can be held there.',
		'the zero-teaching-rooms case still reads the way it did',
	);
	assert.deepEqual(roomProblemSummary(groups), { rooms: 2, buildings: 2 });

	// The ORDER of the problems region must not have been taken from the new comparator.
	// This is stated as a discrimination check: a comparator-aware region would put
	// "G10 Room 103" (needs-section, reported last by priority) before "G10 Room 102".
	assert.deepEqual(groups[0].problems.map((p) => p.name), ['G10 Room 102', 'G10 Room 103']);
	// Sorting the INPUT must not be what the component did: the comparator is total, so
	// a caller may sort in place, but the region above was handed declaration order and
	// produced declaration order, which is the state this change must not have altered.
	assert.deepEqual(rooms.map((e) => e.room.name)[0], 'G10 Room 101');
});

test('7.2 e regression: the problems-region markup, its test hooks and the status badge are all still there', () => {
	const text = source();
	for (const hook of ['room-problem-groups', 'room-problem-group', 'room-problem-rooms', 'room-problem-group-action', 'room-readiness-summary', 'room-readiness-all-rooms']) {
		assert.ok(markup().includes(`data-testid="${hook}"`), `${hook} must survive — 4e forbids removing it`);
	}
	// `getRoomStatus` is the measured truth and must be byte-identical: a filter can
	// only narrow what this function already decided, never widen it.
	assert.match(
		text,
		/function getRoomStatus\(room: Room, roomOccupancy\?: Map<number, string>\): RoomReadinessStatus \{\n\tif \(!room\.isTeachingSpace\) return 'unavailable';/,
		'getRoomStatus must be unchanged, clause for clause — no readiness this page does not measure may be claimed',
	);
	// The per-row badge keeps every STATUS_COPY class string, because those are the
	// colours `palette-token-sweep-a3-s-e.test.ts` counts per file.
	for (const fragment of [
		'border-emerald-200 bg-emerald-50 text-emerald-700',
		'border-amber-200 bg-amber-50 text-amber-700',
		'border-sky-200 bg-sky-50 text-sky-700',
		'border-slate-200 bg-slate-100 text-slate-600',
	]) {
		assert.ok(text.includes(fragment), `STATUS_COPY must keep \`${fragment}\``);
	}
	assert.match(text, /shrink-0 gap-1 text-\[11px\] \$\{copy\.className\}/, 'the per-row status Badge must stay, and stay `shrink-0` beside a now-wrapping name');
	assert.doesNotMatch(text, /text-\[(9|10)px\]/, 'no new sub-11px text may be added to this room surface');
});

test('7.2 e regression: the name WRAPS and the secondary locator line still truncates', () => {
	// Fix 1.2 item 10.2 named `CampusMapOverview.tsx:722` and this row is the same
	// defect on the same list. `min-w-0` is what lets the flex child shrink at all, so
	// without it `break-words` has no width to work in and the row clips instead.
	const text = source();
	assert.match(
		text,
		/<p className="break-words text-xs font-semibold text-slate-800">\{room\.name\}<\/p>/,
		'the room NAME must wrap (break-words), not truncate',
	);
	assert.doesNotMatch(
		text,
		/truncate text-xs font-semibold text-slate-800/,
		'the old truncating name class must be gone',
	);
	assert.match(text, /<div className="min-w-0">\s*\n\s*{?\/\* FIX 1\.2 ITEM 10\.2/, '`min-w-0` must stay on the wrapping parent');
	// The `Building · N seats` line is a secondary locator, not the thing being read,
	// so it keeps its single-line form deliberately.
	assert.match(text, /className="truncate text-\[11px\] text-muted-foreground"/);
});

/* ───────────────────────── 6: RENDERED — the four buttons, in the DOM ───────────────────── */

let root: import('react-dom/client').Root | null = null;
let container: HTMLElement | null = null;

async function mount(buildings: Building[], roomOccupancy?: Map<number, string>) {
	if (!container) {
		container = dom.window.document.createElement('div');
		dom.window.document.body.appendChild(container);
		root = createRoot(container);
	}
	const element = createElement(MemoryRouter, null, createElement(RoomReadinessList, { buildings, roomOccupancy }));
	await act(async () => {
		root?.render(element);
	});
	return container as HTMLElement;
}

function filterButtons(host: HTMLElement): Element[] {
	return [...host.querySelectorAll('[data-testid="room-readiness-filter"]')];
}

function renderedRoomNames(host: HTMLElement): string[] {
	return [...host.querySelectorAll('[data-testid="room-readiness-all-rooms"] [data-room-status]')].map(
		(row) => row.querySelector('p')?.textContent ?? '',
	);
}

beforeEach(async () => {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	if (container) { container.remove(); container = null; }
});

after(() => { dom.window.close(); });

/**
 * THE LIVE SHAPE, and a fixture chosen so DECLARATION order and NATURAL order differ.
 *
 * `G10 Room 2` is declared in the second building, after `G10 Room 103`, and sorts FIRST —
 * which is the whole point of the comparator and also what makes the "the base order is
 * genuinely different" precondition below discriminate instead of agreeing with whatever
 * order the component happened to be handed.
 *
 * `roomOccupancy` is supplied on purpose: `getRoomStatus` only reaches `needs-section` when
 * a draft occupancy map is present, so without it there would be no such room to filter for
 * and the `Needs attention` column would be untested on the one status that is a timetable
 * fact rather than a room defect.
 */
function liveBuildings(): Building[] {
	return [
		building(1, 'North Wing', [
			room(1, 'G10 Room 101'),
			room(2, 'G10 Room 102'),
			// No capacity: `needs-capacity`.
			room(3, 'G10 Room 103', { capacity: 0 }),
		]),
		building(2, 'South Wing', [
			// Absent from the occupancy map: `needs-section`.
			room(4, 'G10 Room 2'),
			room(5, 'G10 Room 201'),
			// Not a teaching space: `unavailable`.
			room(6, 'Store Room', { isTeachingSpace: false }),
		]),
	];
}

/** The draft occupancy map: everything occupied except `G10 Room 2`. */
function liveOccupancy(): Map<number, string> {
	return new Map([[1, 'Sampaguita'], [2, 'Orchid'], [3, 'Narra'], [5, 'Acacia'], [6, 'Store']]);
}

const NATURAL_ORDER = ['G10 Room 2', 'G10 Room 101', 'G10 Room 102', 'G10 Room 103', 'G10 Room 201', 'Store Room'];

test('RENDERED: four filter buttons, `All rooms` pressed, and the whole list shown by default', async () => {
	const host = await mount(liveBuildings(), liveOccupancy());
	// The origin, asserted on the row that is the acceptance evidence (AGENTS.md §12).
	assert.equal(dom.window.location.origin, 'https://njgrm.buru-degree.ts.net');

	const buttons = filterButtons(host);
	assert.equal(buttons.length, 4, 'exactly four filters, not the old toggle plus four');
	assert.deepEqual(
		buttons.map((b) => b.getAttribute('data-filter')),
		['all', 'ready', 'needs-attention', 'unavailable'],
	);
	// The LABEL and the COUNT are read from their own nodes, not from a concatenated
	// `textContent`: the visual gap between them is the `ml-1` class, so a text read
	// would be asserting on markup spacing rather than on what the operator reads.
	assert.deepEqual(
		buttons.map((b) => b.textContent?.replace(/\s*\d+$/, '')),
		['All rooms', 'Ready', 'Needs attention', 'Unavailable'],
		'the labels are the operator\'s words verbatim, inside the buttons',
	);
	assert.deepEqual(
		buttons.map((b) => b.querySelector('span')?.textContent),
		['6', '3', '2', '1'],
		'each button carries its own count, and no count line was added outside them',
	);
	// The obvious active state, from the real DOM attributes rather than a class string.
	assert.deepEqual(buttons.map((b) => b.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false']);
	assert.deepEqual(buttons.map((b) => b.getAttribute('data-active')), ['true', 'false', 'false', 'false']);
	// The removed control is absent from the rendered surface, not merely unstyled.
	assert.equal(host.querySelector('[data-testid="room-readiness-show-all"]'), null, 'the show/hide toggle must not be on the page');
	assert.equal(host.textContent?.includes('Show all rooms'), false);

	// `All rooms` is the DEFAULT, so the list is already open — that is the whole point
	// of replacing the toggle with a filter.
	assert.equal(host.querySelector('[data-testid="room-readiness-empty"]'), null);
	assert.deepEqual(renderedRoomNames(host), NATURAL_ORDER, 'the list is in NATURAL NAME ORDER on first render, not in building declaration order');
	assert.equal(host.querySelector('[aria-label="Filter rooms by readiness"]') !== null, true, 'the row is a labelled region, so a screen reader can find it');
});

test('RENDERED: the active filter LOOKS active, not just `aria-pressed` — the defect the render caught', async () => {
	const host = await mount(liveBuildings(), liveOccupancy());
	const buttons = filterButtons(host);
	const active = buttons.find((b) => b.getAttribute('aria-pressed') === 'true')!;
	const inactive = buttons.filter((b) => b.getAttribute('aria-pressed') === 'false');

	// The reason this row exists as a case at all: the operator asked for "an obvious
	// active state", and `aria-pressed` is the STATE, not the look. A screen reader and a
	// sighted older user get different information, and only the second one is what the
	// operator asked for.
	//
	// MEASURED on a loopback preview against REAL staging data at 1366x768, with the
	// active chip on `variant="secondary"`:
	//     active   background rgb(243, 244, 246)   border rgba(0, 0, 0, 0)
	//     inactive background rgb(255, 255, 255)   border rgb(229, 231, 235)
	// A 3% grey shift, and the "active" chip had a TRANSPARENT border while every
	// inactive chip had a visible one — so it read as a read-only metric and looked
	// LESS like a control than its neighbours. On `variant="default"` the same
	// measurement is background rgb(27, 121, 87) with rgb(255, 255, 255) text.
	//
	// jsdom applies no stylesheet, so what is decidable here is the CONTRACT, not the
	// pixels: the active chip must carry a FILLED background token, and its class list
	// must differ from every inactive one. Delete the variant swap below and this goes
	// red, which is what stops the next person re-introducing an invisible active state.
	const activeClasses = active.className;
	for (const token of ['bg-secondary', 'bg-muted', 'bg-accent', 'bg-transparent', 'bg-background']) {
		assert.doesNotMatch(
			activeClasses,
			new RegExp(`(?:^|\\s)${token}(?:\\s|$)`),
			`the active filter must not wear \`${token}\` — that is the invisible-active-state defect this case was written for. Got: "${activeClasses}"`,
		);
	}
	assert.match(
		activeClasses,
		/(?:^|\s)bg-primary(?:\s|$)/,
		'the active filter must carry the FILLED `bg-primary` of `variant="default"`, so it is obviously pressed',
	);
	for (const button of inactive) {
		assert.notEqual(button.className, activeClasses, 'the active filter must be visually distinct from every inactive one');
	}

	// The count inside the active chip must stay legible on a FILLED background. With
	// `text-muted-foreground` (dark slate) on the filled green `default` background it
	// was near-unreadable, which is why the count now tracks the variant's own
	// foreground with `opacity-80` instead of hard-coding a colour.
	const activeCount = active.querySelector('span');
	assert.equal(activeCount?.textContent, '6');
	assert.doesNotMatch(
		activeCount?.className ?? '',
		/text-muted-foreground/,
		'the count must not hard-code a muted foreground: on the filled active chip that is dark slate on dark green',
	);
	assert.match(activeCount?.className ?? '', /tabular-nums/, 'the count keeps its tabular figures');

	// And the whole control must look pressable: the operator\'s standing rule is that
	// anything which filters carries a pointer cursor. The shared `@/ui` `Button`
	// primitive sets none, so the class has to be here (a shared-primitive fix is a
	// follow-up, because `ui/button.tsx` is in another lane\'s hands this cycle).
	for (const button of buttons) {
		assert.match(
			button.className,
			/(?:^|\s)cursor-pointer(?:\s|$)/,
			`every filter must carry \`cursor-pointer\`; the shared Button primitive sets no cursor. ${button.getAttribute('data-filter')}`,
		);
	}
});

test('RENDERED: the list order is natural, and the BASE order (declaration) is genuinely different', async () => {
	const host = await mount(liveBuildings(), liveOccupancy());
	const names = renderedRoomNames(host);
	assert.deepEqual(names, NATURAL_ORDER);
	// Discrimination: this fixture's declaration order is 101, 102, 103, Room 2, 201, Store
	// Room, so the assertion above is not agreeing with the order it was handed. A
	// component that kept the old `buildings.flatMap` order fails here.
	const declarationOrder = [...liveBuildings()].flatMap((b) => (b.rooms ?? []).map((r) => r.name));
	assert.notDeepEqual(names, declarationOrder, 'precondition: this fixture\'s declaration order differs from its natural order, so the assertion above discriminates');
	// The order holds in a FILTERED view too, not just in `All rooms` — that was the
	// operator\'s "rooms always in natural name order", with the word "always" in it.
	await act(async () => {
		filterButtons(host)[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
	assert.deepEqual(
		renderedRoomNames(host),
		['G10 Room 101', 'G10 Room 102', 'G10 Room 201'],
		'`Ready` is natural-ordered too, and the no-capacity room, the no-section room and the store room are all gone from it',
	);
});

test('RENDERED: clicking `Needs attention` shows only the problem rooms and moves the active state', async () => {
	const host = await mount(liveBuildings(), liveOccupancy());
	assert.ok(host.textContent?.includes('Store Room'), 'precondition: the store room is in the list before the filter is applied');
	const button = filterButtons(host).find((b) => b.getAttribute('data-filter') === 'needs-attention');
	assert.ok(button, 'precondition: the Needs attention button exists');

	await act(async () => {
		button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});

	assert.deepEqual(
		filterButtons(host).map((b) => b.getAttribute('data-active')),
		['false', 'false', 'true', 'false'],
		'the active state MOVED; it did not merely stay on the default',
	);
	assert.deepEqual(
		renderedRoomNames(host),
		['G10 Room 2', 'G10 Room 103'],
		'only the two problem rooms remain: the no-section room and the no-capacity room',
	);
	// The store room is NOT a problem room: a room that was never meant for a class is
	// not a room to fix, and folding it into this filter is the mistake 4b names.
	assert.equal(host.textContent?.includes('Store Room'), false, 'a non-teaching room must not be presented as something that needs attention');
	assert.equal(host.querySelector('[data-testid="room-readiness-empty"]'), null);
	// The problems region is a summary of what is broken and is deliberately NOT filtered
	// by this row — the row governs the list beneath it and nothing else.
	assert.equal(host.querySelector('[data-testid="room-problem-groups"]') !== null, true, 'the problems region is not filtered away by a list filter');
	// The per-row status badge survives the filter, which is what carries the colour truth.
	assert.deepEqual(
		[...host.querySelectorAll('[data-testid="room-readiness-all-rooms"] [data-room-status]')].map((r) => r.getAttribute('data-room-status')),
		['needs-section', 'needs-capacity'],
	);
});

test('RENDERED: a filter with nothing behind it says so, in the operator\'s sentence', async () => {
	// A school whose rooms are all ready: the `Needs attention` filter has nothing to
	// show, and a blank box under a filter is the defect this row exists for.
	const host = await mount(
		[building(1, 'North Wing', [room(1, 'G10 Room 101'), room(2, 'G10 Room 102')])],
		new Map([[1, 'Sampaguita'], [2, 'Orchid']]),
	);
	assert.equal(host.querySelector('[data-testid="room-readiness-empty"]'), null, 'precondition: `All rooms` has rooms, so no empty state yet');

	await act(async () => {
		filterButtons(host).find((b) => b.getAttribute('data-filter') === 'needs-attention')!
			.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});

	const empty = host.querySelector('[data-testid="room-readiness-empty"]');
	assert.ok(empty, 'the empty state must be rendered, not an empty box');
	assert.equal(
		empty?.textContent,
		'No rooms currently marked as Needs attention.',
		'verbatim: the operator wrote this sentence',
	);
	assert.equal(host.querySelector('[data-testid="room-readiness-all-rooms"]'), null, 'no empty grid behind the sentence');
	// Back to `All rooms` the list returns, so the filter is not a one-way door.
	await act(async () => {
		filterButtons(host).find((b) => b.getAttribute('data-filter') === 'all')!
			.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
	assert.equal(host.querySelector('[data-testid="room-readiness-empty"]'), null);
	assert.deepEqual(renderedRoomNames(host), ['G10 Room 101', 'G10 Room 102']);
});

test('RENDERED: a school with no rooms keeps the sentence this card always printed', async () => {
	// 4d: the zero-rooms branch for the WHOLE card is unchanged, so the summary line
	// still carries the sentence and the filter row is not drawn over nothing.
	const host = await mount([building(1, 'North Wing', [])]);
	assert.equal(host.querySelector('[data-testid="room-readiness-summary"]')?.textContent, 'No rooms yet. Open Edit maps to add the first teaching room.');
	assert.equal(filterButtons(host).length, 0, 'no four-button row over a school with no rooms');
	assert.equal(host.querySelector('[data-testid="room-readiness-empty"]'), null, 'the existing zero-rooms branch is kept, not replaced by a second empty state');
});
