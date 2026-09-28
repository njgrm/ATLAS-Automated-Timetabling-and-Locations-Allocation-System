/**
 * A2-C12 ITEM P — the section-switch render path.
 *
 * A section switch fires NO request (`setEntityFilter` is local state and
 * `entityFilter` is not part of `buildScopeKey`), so the cost of a switch is
 * render/memo work. This module holds the two pieces of that work that were
 * being redone on every switch:
 *
 *   P1  `buildEntityEntryIndex` — one pass over the filtered entries produces
 *       three id -> entries maps, so selecting a section is a map lookup
 *       instead of an O(n) `Array.prototype.filter` over the whole run.
 *
 *   P2  `buildRoomSortRanks` — the room list's building-then-name order is
 *       resolved ONCE per `roomMap` into an integer rank per room, so the
 *       switch path compares integers and performs zero `toLowerCase()` and
 *       zero `localeCompare()` calls.
 *
 * It lives in `src/lib/` rather than in `useTimetableData.ts` because that hook
 * is already well past the AGENTS.md §8 line cap: adding the logic there would
 * have grown a file that is too long, and here it is independently testable
 * against the behaviour it replaced.
 */

/** The three pivot axes the timetable grid can be sliced on. */
export type EntityPivotMode = 'section' | 'faculty' | 'room';

/** The subset of a scheduled entry the index needs. */
export type IndexableEntityEntry = {
	sectionId: number;
	facultyId: number | null;
	roomId: number;
};

export type EntityEntryIndex<T> = {
	/**
	 * The list this index was built from — the same array reference the caller
	 * passed in. The grid's entry point is ONE function over the index, and
	 * keeping the source list on the index means that index can also be
	 * compared against the list it claims to describe.
	 */
	entries: readonly T[];
	bySectionId: Map<number, T[]>;
	byFacultyId: Map<number, T[]>;
	byRoomId: Map<number, T[]>;
};

/**
 * The `===` comparison the replaced filter used is false for every
 * non-number, and false for NaN as well. A Map key is SameValueZero, under
 * which NaN DOES match NaN and `null` would match a `null` key — so indexing
 * anything that is not a real number would make the index return rows the
 * filter never did. Index only real numbers; that keeps the two identical.
 */
function pushIntoIndex<T>(index: Map<number, T[]>, entry: T, value: number | null | undefined): void {
	if (typeof value !== 'number' || Number.isNaN(value)) return;
	const bucket = index.get(value);
	// A single forward pass, so each bucket keeps the exact order
	// `Array.prototype.filter` produced. The grid renders in that order.
	if (bucket) bucket.push(entry);
	else index.set(value, [entry]);
}

/**
 * P1: index the filtered entries by each pivot axis in one pass.
 *
 * Keyed on the entries alone, so the caller can depend on this memo instead of
 * on the selected entity.
 */
export function buildEntityEntryIndex<T extends IndexableEntityEntry>(entries: readonly T[]): EntityEntryIndex<T> {
	const bySectionId = new Map<number, T[]>();
	const byFacultyId = new Map<number, T[]>();
	const byRoomId = new Map<number, T[]>();
	for (const entry of entries) {
		pushIntoIndex(bySectionId, entry, entry.sectionId);
		pushIntoIndex(byFacultyId, entry, entry.facultyId);
		pushIntoIndex(byRoomId, entry, entry.roomId);
	}
	return { entries, bySectionId, byFacultyId, byRoomId };
}

/**
 * The `Number(entityFilter)` + `if (!id) return []` guard the grid used, kept
 * verbatim: `''`, `'all'`, `'0'`, `'-0'`, `'NaN'` and any unparseable string
 * all yield a falsy id, which selected nothing.
 */
export function resolveEntitySelectionId(rawEntityFilter: string): number | null {
	const id = Number(rawEntityFilter);
	return id ? id : null;
}

/**
 * P1: the per-id slice for the selected entity.
 *
 * The bucket is copied rather than handed out, because the old code returned a
 * fresh array from `filter` and these buckets are internal to the index. The
 * copy is the size of ONE entity's rows, not the size of the run, so this is
 * still a lookup rather than a scan.
 */
export function lookupEntityEntries<T>(index: EntityEntryIndex<T>, mode: EntityPivotMode, id: number): T[] {
	const bucket =
		mode === 'section' ? index.bySectionId.get(id)
		: mode === 'faculty' ? index.byFacultyId.get(id)
		: index.byRoomId.get(id);
	return bucket ? bucket.slice() : [];
}

/**
 * P1: the grid's single entry point — the exact body `gridEntries` used to
 * have, with the three `filter` calls replaced by one index lookup.
 *
 * This is the function the hook's `gridEntries` memo calls, so it is what the
 * gate drives, and reverting it to a `filter` is the mutant the gate must
 * catch.
 */
export function resolveGridEntries<T extends IndexableEntityEntry>(
	index: EntityEntryIndex<T>,
	mode: EntityPivotMode,
	rawEntityFilter: string,
): T[] {
	const id = resolveEntitySelectionId(rawEntityFilter);
	if (id === null) return [];
	return lookupEntityEntries(index, mode, id);
}

/** The subset of a room the sort rank needs. */
export type RoomSortRoom = {
	id: number;
	name: string;
	buildingName: string;
	buildingShortCode: string | null;
};

/**
 * The building-then-name comparison the room list used, moved here verbatim so
 * it runs once per `roomMap` instead of once per sort.
 *
 * Note the name is compared with `localeCompare` and NOT lowercased, while the
 * building is lowercased first. That asymmetry is why this is expressed as a
 * rank over two fields rather than as one precomputed composite string: merging
 * `building` and `name` into a single comparable string changes the order
 * whenever one building name is a prefix of another ("a" + name vs "a b" +
 * name), because the building field would then be compared together with the
 * first character of the name. Ranking keeps the two-field comparison exactly.
 */
function compareRoomsForRank(a: RoomSortRoom, b: RoomSortRoom): number {
	const buildingA = (a.buildingShortCode || a.buildingName).toLowerCase();
	const buildingB = (b.buildingShortCode || b.buildingName).toLowerCase();
	if (buildingA !== buildingB) return buildingA.localeCompare(buildingB);
	return a.name.localeCompare(b.name);
}

/**
 * P2: resolve the room order once per `roomMap` into a dense integer rank.
 *
 * Two rooms share a rank exactly when the old comparator returned 0 for them,
 * so a stable sort of the id list over the ranks reproduces the old order
 * including its tie behaviour (equal keys keep the id list's own order).
 */
export function buildRoomSortRanks(rooms: ReadonlyMap<number, RoomSortRoom>): Map<number, number> {
	const ordered = Array.from(rooms.values()).sort(compareRoomsForRank);
	const ranks = new Map<number, number>();
	let previous: RoomSortRoom | null = null;
	let rank = 0;
	for (const room of ordered) {
		if (previous !== null && compareRoomsForRank(previous, room) !== 0) rank += 1;
		ranks.set(room.id, rank);
		previous = room;
	}
	return ranks;
}

/**
 * P2: order room ids by their precomputed rank.
 *
 * An id missing from `roomMap` keeps the old `a - b` numeric fallback, so an id
 * with no room still sorts by id against everything else, as it did before.
 */
export function sortRoomIdsByRank(ids: Iterable<number>, ranks: ReadonlyMap<number, number>): number[] {
	return Array.from(ids).sort((a, b) => {
		const rankA = ranks.get(a);
		const rankB = ranks.get(b);
		if (rankA === undefined || rankB === undefined) return a - b;
		return rankA - rankB;
	});
}

/**
 * P2: the dependency value for the pivot id list, scoped to the mode that
 * reads it.
 *
 * Only the section branch adds `sectionFocusId` to the id set, so in room and
 * faculty mode it is not an input to the result at all. Returning `null` there
 * means switching sections cannot invalidate the room or faculty list, while
 * section mode still sees every focus change.
 */
export function sectionFocusDependencyForMode(mode: EntityPivotMode, sectionFocusId: number | null): number | null {
	return mode === 'section' ? sectionFocusId : null;
}
