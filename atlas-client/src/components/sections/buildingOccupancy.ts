/**
 * A3 C4 — building teaching-space occupancy (extracted from
 * `pages/Sections.tsx`).
 *
 * WHY THIS MOVED OUT (review finding B1, 2026-09-28): the page passed the
 * 1000-line AGENTS.md §8 cap at 1063 physical lines (982 at base). This was a
 * self-contained derivation — a pure function of `buildings` and the set of
 * occupied room ids — trapped inside a `useMemo` in the page body, and it is
 * about the ROOM MAP, not about the sections roster the page coordinates.
 *
 * It is deliberately a plain function rather than a hook: it has no state of its
 * own, and calling it inside the page's existing `useMemo` keeps the memo
 * dependency list exactly as it was. Nothing about the arithmetic changed in the
 * move.
 *
 * WHAT THE NUMBER MEANS, and the honesty constraint on it: the percentage is
 * `occupied teaching spaces / teaching spaces in that building`, i.e. it
 * answers "how full is this building", NOT "how many sections are placed". A
 * building whose rooms are all non-teaching space reports 0 rather than
 * dividing by zero. This is a room-map input only; it never feeds the
 * home-room readiness counter, which has exactly one source in
 * `home-room-readiness.ts`.
 */
import type { Building, Room } from '@/types';

/** Room types that are NOT teaching space, so they are excluded from the ratio. */
const NON_TEACHING_ROOM_TYPES = ['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER'] as const;

function isTeachingRoom(room: Room): boolean {
	// Be robust: treat as teaching space if explicitly true or if type is a standard teaching type
	return (
		room.isTeachingSpace === true ||
		!(NON_TEACHING_ROOM_TYPES as readonly string[]).includes(room.type)
	);
}

export function deriveBuildingOccupancy(
	buildings: readonly Building[],
	occupiedRoomIds: ReadonlyMap<number, string>,
): Map<number, number> {
	const map = new Map<number, number>();
	buildings.forEach((b) => {
		const teachingRooms = (b.rooms ?? []).filter(isTeachingRoom);
		if (teachingRooms.length === 0) {
			map.set(b.id, 0);
			return;
		}
		const occupiedCount = teachingRooms.filter((r) => occupiedRoomIds.has(r.id)).length;
		map.set(b.id, (occupiedCount / teachingRooms.length) * 100);
	});
	return map;
}
