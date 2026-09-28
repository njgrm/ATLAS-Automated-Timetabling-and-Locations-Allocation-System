/**
 * A2-C12 ITEM P — the section-switch render path (P1 + P2 + P3).
 *
 * A section switch fires NO request; `setEntityFilter` is local state and
 * `entityFilter` is not in `buildScopeKey`. So this gate pins the two pieces of
 * render work that a switch used to redo, and pins them to the behaviour they
 * replaced:
 *
 *   P1  the per-entity index must return, for every mode and every id, exactly
 *       what `entries.filter((e) => e[key] === id)` returned.
 *   P2  the room order must be what the OLD `localeCompare` comparator produced
 *       (reimplemented here as the oracle), and the section-focus dependency
 *       must be scoped so a section switch cannot invalidate the room list.
 *   P3  the body comparator must still watch the FULL context key set — the
 *       body reads all twenty-two of them, so there was nothing to shrink to.
 *
 * Run: `npx tsx --test src/lib/__tests__/a2-c12-entity-index-p1.test.ts`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	buildEntityEntryIndex,
	buildRoomSortRanks,
	resolveGridEntries,
	resolveEntitySelectionId,
	sectionFocusDependencyForMode,
	sortRoomIdsByRank,
	type EntityPivotMode,
	type IndexableEntityEntry,
} from '@/lib/timetable-entity-index';
import {
	SCHEDULE_REVIEW_WORKSPACE_BODY_COMPARED_KEYS,
	areScheduleReviewWorkspaceBodyPropsEqual,
	type ScheduleReviewWorkspaceBodyProps,
} from '@/components/timetable/ScheduleReviewWorkspaceBody';

type Entry = IndexableEntityEntry & { entryId: string; day: string };

/**
 * The entries the filter is asked to slice, covering the awkward cases: a
 * `null` facultyId, a roomId of 0, a sectionId repeated across many entries, an
 * entry carrying all three ids, and a `null` roomId smuggled past the declared
 * `number` type (the grid does read real runs, so the index must not trust it).
 */
const ENTRIES: Entry[] = [
	{ entryId: 'e1', day: 'MON', sectionId: 7, facultyId: 41, roomId: 9 },
	{ entryId: 'e2', day: 'TUE', sectionId: 7, facultyId: null, roomId: 9 },
	{ entryId: 'e3', day: 'WED', sectionId: 7, facultyId: 42, roomId: 0 },
	{ entryId: 'e4', day: 'THU', sectionId: 8, facultyId: 41, roomId: 10 },
	{ entryId: 'e5', day: 'FRI', sectionId: 8, facultyId: 42, roomId: 10 },
	{ entryId: 'e6', day: 'MON', sectionId: 9, facultyId: 41, roomId: 10 },
	{ entryId: 'e7', day: 'TUE', sectionId: 9, facultyId: 43, roomId: 11 },
	{ entryId: 'e8', day: 'WED', sectionId: 7, facultyId: 41, roomId: 11 },
	{ entryId: 'e9', day: 'THU', sectionId: 10, facultyId: 44, roomId: 12 },
	{ entryId: 'e10', day: 'FRI', sectionId: 10, facultyId: null, roomId: 12 },
];

const ID_PROBES = [0, 7, 8, 9, 10, 41, 42, 43, 44, 99, -7];
const MODES: EntityPivotMode[] = ['section', 'faculty', 'room'];

/** THE ORACLE: the exact `gridEntries` body the switch path used to run. */
function oldGridEntries(entries: readonly Entry[], mode: EntityPivotMode, rawEntityFilter: string): Entry[] {
	const id = Number(rawEntityFilter);
	if (!id) return [];
	if (mode === 'section') return entries.filter((e) => e.sectionId === id);
	if (mode === 'faculty') return entries.filter((e) => e.facultyId === id);
	return entries.filter((e) => e.roomId === id);
}

// ── Row 1 ─ the index matches the old filter, exactly, for every mode ─────────

test('P1 row 1: the per-entity index deep-equals the old filter for every mode, id and fixture', () => {
	const fixtures: Array<{ name: string; entries: Entry[] }> = [
		{ name: 'awkward ids', entries: ENTRIES },
		{ name: 'empty filteredDraftEntries', entries: [] },
		{ name: 'single entry', entries: [ENTRIES[0]] },
		{ name: 'a null roomId the declared type forbids', entries: [{ entryId: 'x', day: 'MON', sectionId: 1, facultyId: 1, roomId: null as unknown as number }] },
		{ name: 'a NaN sectionId', entries: [{ entryId: 'y', day: 'MON', sectionId: NaN, facultyId: 2, roomId: 3 }] },
		{ name: 'one sectionId on every entry', entries: ENTRIES.map((e) => ({ ...e, sectionId: 7 })) },
	];

	for (const { name, entries } of fixtures) {
		const index = buildEntityEntryIndex(entries);
		for (const mode of MODES) {
			for (const id of [...ID_PROBES, Number.NaN, Number.POSITIVE_INFINITY]) {
				// The oracle is the WHOLE old body, guard included — not just its
				// filter. A roomId of 0 is indexed but is unselectable, because
				// `if (!id) return []` rejected 0 before the old filter ever ran,
				// and the new entry point has to reject it identically.
				const expected = oldGridEntries(entries, mode, String(id));
				// Through the PRODUCTION entry point the hook's gridEntries memo
				// calls, not the internal lookup, so reverting that function to a
				// filter is what this row catches.
				const actual = resolveGridEntries(index, mode, String(id));
				assert.deepEqual(
					actual.map((e) => e.entryId),
					expected.map((e) => e.entryId),
					`${name} / ${mode} / ${String(id)}: index order and membership must equal the old filter`,
				);
			}
		}
	}
});

test('P1 row 1b: a null facultyId or roomId is never a map key (=== was false, a map would have matched)', () => {
	const index = buildEntityEntryIndex(ENTRIES);
	// `null === 41` is false, so e2 must not be reachable through any faculty id.
	assert.equal(resolveGridEntries(index, 'faculty', '41').some((e) => e.entryId === 'e2'), false);
	// roomId 0 is a real id and must stay reachable; the `!id` guard rejects 0 as
	// a SELECTION, which is a different thing and is covered by row 2.
	assert.equal(resolveGridEntries(index, 'room', '0').map((e) => e.entryId).join(','), '');
	assert.equal(index.byRoomId.get(0)?.map((e) => e.entryId).join(','), 'e3');
	// The index must not have created a key for the null faculty id.
	assert.equal([...index.byFacultyId.keys()].some((k) => k === null || Number.isNaN(k as number)), false);
});

test('P1 row 1c: the returned slice is a fresh array, never the index\'s own bucket', () => {
	const index = buildEntityEntryIndex(ENTRIES);
	const first = resolveGridEntries(index, 'section', '7');
	first.push(ENTRIES[0]);
	const second = resolveGridEntries(index, 'section', '7');
	assert.equal(second.length, 4, 'a caller mutating its slice must not corrupt the index');
	assert.notEqual(first, index.bySectionId.get(7));
});

// ── Row 2 ─ a non-numeric / empty / zero entityFilter selects nothing ─────────

test('P1 row 2: a non-numeric, empty or zero entityFilter yields no rows and no crash', () => {
	const index = buildEntityEntryIndex(ENTRIES);
	for (const raw of ['', 'all', '0', '-0', 'NaN', 'not-a-number', '   ', 'undefined', 'null', '[]', '{}']) {
		assert.equal(resolveEntitySelectionId(raw), null, `"${raw}" must not resolve to a selection`);
		// This is the memo's own guard, exactly as the module applies it.
		const gridEntries = resolveGridEntries(index, 'section', raw);
		assert.deepEqual(gridEntries, [], `"${raw}" must select nothing`);
		// The OLD body returned `[]` for the same inputs — pinned so the guard is
		// the same guard, not merely a safe one.
		assert.deepEqual(oldGridEntries(ENTRIES, 'section', raw), [], `"${raw}" selected nothing before either`);
	}
	// A real selection still resolves.
	assert.equal(resolveEntitySelectionId('41'), 41);
	assert.equal(resolveEntitySelectionId(' 41 '), 41);

	// Parity for EVERY raw filter, including the ones that are truthy but
	// absurd. `Number('1e999')` is Infinity, which is truthy, so the old code
	// selected with it too — the guard is `!id`, not "is finite". Pinning the
	// whole body against the oracle is what proves the guard was not quietly
	// widened while removing the filter.
	const RAW_PROBES = ['', 'all', '0', '-0', 'NaN', 'not-a-number', '41', ' 41 ', '1e999', '-Infinity', '7', '0.0'];
	for (const mode of MODES) {
		for (const raw of RAW_PROBES) {
			const actual = resolveGridEntries(index, mode, raw);
			assert.deepEqual(
				actual.map((e) => e.entryId),
				oldGridEntries(ENTRIES, mode, raw).map((e) => e.entryId),
				`${mode} / "${raw}": the whole gridEntries body must equal the old body`,
			);
		}
	}
});

// ── Row 3 ─ the room order is byte-identical to the old comparator ───────────

type Room = { id: number; name: string; buildingName: string; buildingShortCode: string | null; isTeachingSpace: boolean };

/** THE ORACLE: the old room comparator, reimplemented verbatim. */
function oldRoomComparator(rooms: ReadonlyMap<number, Room>) {
	return (a: number, b: number): number => {
		const ra = rooms.get(a);
		const rb = rooms.get(b);
		if (!ra || !rb) return a - b;
		const bldgA = (ra.buildingShortCode || ra.buildingName).toLowerCase();
		const bldgB = (rb.buildingShortCode || rb.buildingName).toLowerCase();
		if (bldgA !== bldgB) return bldgA.localeCompare(bldgB);
		return ra.name.localeCompare(rb.name);
	};
}

const ROOM_FIXTURES: Array<{ name: string; rooms: Room[]; ids: number[] }> = [
	{
		// The discriminating case: building order is the REVERSE of id order.
		name: 'building order is the reverse of numeric id order',
		rooms: [
			{ id: 9, name: 'Room 9', buildingName: 'Zeta Hall', buildingShortCode: null, isTeachingSpace: true },
			{ id: 10, name: 'Room 10', buildingName: 'Alpha Hall', buildingShortCode: null, isTeachingSpace: true },
		],
		ids: [9, 10],
	},
	{
		// A shorter building name that is a PREFIX of a longer one: the case a
		// single composite sort key would get wrong.
		name: 'one building name is a prefix of another',
		rooms: [
			{ id: 3, name: 'Zulu', buildingName: 'A', buildingShortCode: null, isTeachingSpace: true },
			{ id: 4, name: 'Alpha', buildingName: 'A B', buildingShortCode: null, isTeachingSpace: true },
		],
		ids: [3, 4],
	},
	{
		name: 'shortCode wins over buildingName, and names order within a building',
		rooms: [
			{ id: 21, name: 'Bravo', buildingName: 'Ignored', buildingShortCode: 'zz', isTeachingSpace: true },
			{ id: 22, name: 'Alpha', buildingName: 'zz', buildingShortCode: null, isTeachingSpace: true },
			{ id: 23, name: 'Charlie', buildingName: 'aaa', buildingShortCode: null, isTeachingSpace: true },
			{ id: 24, name: 'Alpha', buildingName: 'aaa', buildingShortCode: null, isTeachingSpace: true },
		],
		ids: [21, 22, 23, 24],
	},
	{
		name: 'an id with no room keeps the numeric fallback, against ranked rooms',
		rooms: [
			{ id: 2, name: 'Room 2', buildingName: 'Zeta', buildingShortCode: null, isTeachingSpace: true },
			{ id: 5, name: 'Room 5', buildingName: 'Alpha', buildingShortCode: null, isTeachingSpace: true },
		],
		ids: [2, 5, 999],
	},
	{
		name: 'two rooms with identical building and name keep the id-list order',
		rooms: [
			{ id: 31, name: 'Lab', buildingName: 'Sci', buildingShortCode: null, isTeachingSpace: true },
			{ id: 32, name: 'Lab', buildingName: 'Sci', buildingShortCode: null, isTeachingSpace: true },
		],
		ids: [32, 31],
	},
	{
		name: 'no rooms at all',
		rooms: [],
		ids: [],
	},
];

test('P2 row 3: sortRoomIdsByRank reproduces the old comparator, byte for byte', () => {
	for (const { name, rooms, ids } of ROOM_FIXTURES) {
		const roomMap = new Map(rooms.map((r) => [r.id, r]));
		const expected = Array.from(ids).sort(oldRoomComparator(roomMap));
		const actual = sortRoomIdsByRank(ids, buildRoomSortRanks(roomMap));
		assert.deepEqual(actual, expected, `${name}: rank order must equal the old comparator's order`);
		// And repeated runs must be stable, not merely equal once.
		assert.deepEqual(sortRoomIdsByRank(ids, buildRoomSortRanks(roomMap)), expected, `${name}: stable across runs`);
	}
});

test('P2 row 3b: the order is genuinely NOT the numeric id order, so the row above can discriminate', () => {
	const rooms = new Map<number, Room>([
		[9, { id: 9, name: 'Room 9', buildingName: 'Zeta Hall', buildingShortCode: null, isTeachingSpace: true }],
		[10, { id: 10, name: 'Room 10', buildingName: 'Alpha Hall', buildingShortCode: null, isTeachingSpace: true }],
	]);
	const byRank = sortRoomIdsByRank([9, 10], buildRoomSortRanks(rooms));
	assert.deepEqual(byRank, [10, 9]);
	assert.notDeepEqual(byRank, [9, 10], 'if this equals the id order the fixture proves nothing');
});

test('P2 row 3c: sortRoomIdsByRank runs no toLowerCase and no localeCompare of its own', () => {
	// The switch path is `sortRoomIdsByRank` plus the id Set build. Guard the
	// comparator itself, which is the only part that could reach for collation.
	const ranks = buildRoomSortRanks(new Map<number, Room>([
		[1, { id: 1, name: 'A', buildingName: 'B', buildingShortCode: null, isTeachingSpace: true }],
		[2, { id: 2, name: 'B', buildingName: 'A', buildingShortCode: null, isTeachingSpace: true }],
	]));
	const lower = String.prototype.toLowerCase as (...args: unknown[]) => string;
	const compare = String.prototype.localeCompare as (...args: unknown[]) => number;
	let lowerCalls = 0;
	let localeCalls = 0;
	String.prototype.toLowerCase = function patched(this: string, ...rest: unknown[]) {
		lowerCalls += 1;
		return lower.apply(this, rest);
	};
	String.prototype.localeCompare = function patched(this: string, ...rest: unknown[]) {
		localeCalls += 1;
		return compare.apply(this, rest);
	};
	try {
		sortRoomIdsByRank([1, 2], ranks);
	} finally {
		String.prototype.toLowerCase = lower;
		String.prototype.localeCompare = compare;
	}
	assert.equal(lowerCalls, 0, 'the switch path must perform 0 toLowerCase calls');
	assert.equal(localeCalls, 0, 'the switch path must perform 0 localeCompare calls');
});

// ── Row 4 ─ the section-focus dependency is mode-scoped ──────────────────────

/** A faithful stand-in for `useMemo`'s dep comparison, so the claim is testable. */
function createMemoCell<T>(compute: () => T): { run: (deps: readonly unknown[]) => { value: T; recomputed: boolean } } {
	let lastDeps: readonly unknown[] | null = null;
	let lastValue: T;
	return {
		run(deps) {
			const same = lastDeps !== null && deps.length === lastDeps.length && deps.every((d, i) => Object.is(d, lastDeps![i]));
			if (same) return { value: lastValue, recomputed: false };
			lastValue = compute();
			lastDeps = deps;
			return { value: lastValue, recomputed: true };
		},
	};
}

test('P2 row 4: in room mode a sectionFocusId change cannot invalidate the room list', () => {
	// The dependency value the hook now uses, in each mode.
	assert.equal(sectionFocusDependencyForMode('room', 41), null);
	assert.equal(sectionFocusDependencyForMode('room', null), null);
	assert.equal(sectionFocusDependencyForMode('faculty', 41), null);
	assert.equal(sectionFocusDependencyForMode('section', 41), 41);
	assert.equal(sectionFocusDependencyForMode('section', null), null);

	// Drive the real room-list computation the way the hook wires it: the only
	// focus input is the scoped dependency, and the rank is memoised on roomMap.
	const rooms = new Map<number, Room>([
		[2, { id: 2, name: 'Room 2', buildingName: 'Zeta', buildingShortCode: null, isTeachingSpace: true }],
		[5, { id: 5, name: 'Room 5', buildingName: 'Alpha', buildingShortCode: null, isTeachingSpace: true }],
	]);
	const roomSortRanks = buildRoomSortRanks(rooms);
	const computeRoomIds = () => sortRoomIdsByRank([5, 2], roomSortRanks);
	const cell = createMemoCell(computeRoomIds);

	const first = cell.run(['room', sectionFocusDependencyForMode('room', null), roomSortRanks]);
	const afterSwitch = cell.run(['room', sectionFocusDependencyForMode('room', 41), roomSortRanks]);
	assert.equal(first.recomputed, true);
	assert.equal(afterSwitch.recomputed, false, 'a section switch in room mode must not recompute the room list');
	assert.equal(afterSwitch.value, first.value, 'and the array reference must be the same cached value');
	assert.deepEqual(afterSwitch.value, [5, 2]);

	// The section branch still sees the focus, so a focus change there DOES land.
	const computeSectionIds = (focus: number | null) => {
		const ids = new Set<number>([2, 5]);
		if (focus != null) ids.add(focus);
		return Array.from(ids).sort((a, b) => a - b);
	};
	assert.deepEqual(computeSectionIds(sectionFocusDependencyForMode('section', 41)), [2, 5, 41]);
	assert.equal(sectionFocusDependencyForMode('section', 41), 41, 'section mode must still observe every focus change');
});

// ── Row 5 (MUTANT TARGET) ─ the switch path must not scan the run ────────────

/**
 * Row 5 is the MUTANT row, and it exists because an output-comparing test
 * CANNOT catch this mutation.
 *
 * Reverting `resolveGridEntries` to the old `filter` was run against rows 1-4
 * and all of them still passed — correctly. The contract of the entry point is
 * "return the same array", and the filter and the index both satisfy it, so
 * they are observationally identical and no assertion on output separates them.
 *
 * What genuinely differs is the WORK. The old filter reads one id property off
 * every entry in the run; the index reads nothing, because the reads happened
 * once when the index was built. So this row counts property reads on the
 * switch path, and it fails the moment the index is reverted.
 */
function countingEntries(entries: Entry[]): { entries: Entry[]; reset: () => void; total: () => number } {
	let reads = 0;
	const wrapped = entries.map(
		(entry) =>
			new Proxy(entry, {
				get(target, prop, receiver) {
					if (typeof prop !== 'symbol') reads += 1;
					return Reflect.get(target, prop, receiver);
				},
			}) as Entry,
	);
	return { entries: wrapped, reset: () => { reads = 0; }, total: () => reads };
}

test('P1 row 5 MUTANT TARGET: the switch path reads 0 entry properties (a filter reads N)', () => {
	const counted = countingEntries(ENTRIES);
	const index = buildEntityEntryIndex(counted.entries);
	// The index build legitimately reads 3 ids per entry, once.
	assert.ok(counted.total() > 0, 'building the index must read the ids');
	const buildReads = counted.total();

	counted.reset();
	const slice = resolveGridEntries(index, 'section', '7');
	// Read the counter BEFORE any assertion touches the entries, or the
	// assertion's own `.map` would be counted as production work.
	const switchReads = counted.total();
	assert.deepEqual(slice.map((e) => e.entryId), ['e1', 'e2', 'e3', 'e8'], 'the switch still returns the right rows');
	assert.equal(
		switchReads,
		0,
		`the switch path must read 0 entry properties; a reverted filter reads ${ENTRIES.length}. ` +
		`(the index build itself read ${buildReads})`,
	);
});

test('P1 row 5b MUTANT TARGET: across every mode and id, the switch path stays O(1) in entry reads', () => {
	const counted = countingEntries(ENTRIES);
	const index = buildEntityEntryIndex(counted.entries);
	const N = ENTRIES.length;
	for (const mode of ['section', 'faculty', 'room'] as const) {
		for (const id of ['7', '41', '10', '99']) {
			counted.reset();
			resolveGridEntries(index, mode, id);
			assert.ok(
				counted.total() <= N / 2,
				`${mode}/${id}: the switch path read ${counted.total()} entry properties, which is scan-shaped, not lookup-shaped`,
			);
		}
	}
});

// Stable identities: two calls to makeContext() must produce contexts that
// compare EQUAL, which is only true if the function-valued keys are the same
// references. Minting fresh arrows per call would make every context unequal.
const FN = {
	leftPanelRef: { current: null },
	violations: [],
	setIsLeftCollapsed: () => undefined,
	setLeftTab: () => undefined,
	openPublishDialog: () => undefined,
	sectionLabel: () => '',
	subjectLabel: () => '',
	facultyLabel: () => '',
	leftRailContentContext: {},
	centerWorkspaceContext: {},
	rightPanelContext: {},
};

function makeContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		leftPanelRef: FN.leftPanelRef,
		setIsLeftCollapsed: FN.setIsLeftCollapsed,
		isLeftCollapsed: false,
		isDesktop: true,
		isPreGenerationWorkspace: false,
		leftTab: 'violations',
		setLeftTab: FN.setLeftTab,
		violations: FN.violations,
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		violationScopeLabel: 'All terms',
		summary: null,
		roomRequestSummary: null,
		openPublishDialog: FN.openPublishDialog,
		activeGeneratedRunId: null,
		sectionLabel: FN.sectionLabel,
		subjectLabel: FN.subjectLabel,
		facultyLabel: FN.facultyLabel,
		leftRailContentContext: FN.leftRailContentContext,
		centerWorkspaceContext: FN.centerWorkspaceContext,
		rightPanelContext: FN.rightPanelContext,
		...overrides,
	};
}

function props(context: Record<string, unknown>): ScheduleReviewWorkspaceBodyProps {
	return { context, layoutMode: 'advanced' } as unknown as ScheduleReviewWorkspaceBodyProps;
}

test('P3 row 6: the comparator watches every context key the body reads (all 22)', () => {
	const watched = [...SCHEDULE_REVIEW_WORKSPACE_BODY_COMPARED_KEYS];
	const base = makeContext();

	// (a) The watched set is exactly the context type's key set — no key is
	//     unwatched, so nothing can fall outside the comparator. The compile
	//     error in the component is the load-bearing half of this; this is the
	//     runtime statement of the same fact.
	assert.equal(watched.length, 22);
	assert.deepEqual([...watched].sort(), Object.keys(base).sort(), 'watched keys must equal the context key set');

	// (b) Every watched key actually discriminates: changing only that key must
	//     make the comparator report "not equal" (i.e. the body re-renders).
	for (const key of watched) {
		const next = makeContext({ [key]: { changed: true } });
		assert.equal(
			areScheduleReviewWorkspaceBodyPropsEqual(props(base), props(next)),
			false,
			`the comparator must notice a change to "${key}" — the body reads it, so skipping it would be a stale render`,
		);
	}

	// (c) An identical context still compares equal, and the comparison allocates
	//     no key arrays: with the list hoisted, `Object.keys` is never called.
	const equal = areScheduleReviewWorkspaceBodyPropsEqual(props(makeContext()), props(makeContext()));
	assert.equal(equal, true, 'two contexts with equal values must still short-circuit the re-render');

	const keysSpy: string[] = [];
	const originalKeys = Object.keys;
	(Object as { keys: unknown }).keys = function spied(this: unknown, ...rest: unknown[]) {
		keysSpy.push('called');
		return (originalKeys as any).apply(this, rest);
	};
	try {
		areScheduleReviewWorkspaceBodyPropsEqual(props(base), props(makeContext({ hardCount: 1 })));
		areScheduleReviewWorkspaceBodyPropsEqual(props(base), props(makeContext()));
	} finally {
		(Object as { keys: unknown }).keys = originalKeys;
	}
	assert.deepEqual(keysSpy, [], 'the comparator must not call Object.keys on either context');

	// (d) The non-context props are still compared individually.
	assert.equal(
		areScheduleReviewWorkspaceBodyPropsEqual(
			{ ...props(base), layoutMode: 'simple' } as ScheduleReviewWorkspaceBodyProps,
			props(base),
		),
		false,
	);
});
