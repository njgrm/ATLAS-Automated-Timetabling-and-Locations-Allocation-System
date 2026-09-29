/**
 * A9 c8 (2026-09-29) — ONE teaching-room number, ONE definition, on every surface.
 *
 * ── WHAT WAS WRONG ────────────────────────────────────────────────────────────────────────
 * The Campus page (`/map`) and the Dashboard printed different answers for one school on one
 * screen, and both screens carried the same room list:
 *   · Dashboard tile  `Teaching Rooms 78/103` — 78 TEACHING rooms over 103 rooms in the
 *     school. A fraction across two populations, which reads as "78 of 103 are ready".
 *   · Dashboard panel `Teaching rooms 78/103` (the same figure, a second time) and a
 *     separate `7 ready` badge that called a BUILDING ready for holding one teaching room
 *     out of twenty.
 *   · Campus banner   `78 of 78 teaching rooms are ready to be used for classes.` — the
 *     honest fraction, both ends of it the same population.
 *   · Dashboard panel `100%` (the map toolbar's ZOOM readout) printed directly above a
 *     building whose panel read `0 teaching rooms ready`. A percentage with no denominator
 *     an older reader can check next to a readiness sentence.
 *
 * ── WHAT THIS FILE IS ─────────────────────────────────────────────────────────────────────
 * The DEFINITION, once, as pure functions, so no surface can re-derive it:
 *   · `teachingRoomTotals`  — the ONE numerator/denominator pair. Both ends are TEACHING
 *     rooms, from the same room list, so the fraction can never span two populations again.
 *   · `isReadyTeachingRoom` — what "ready" means here, unchanged from the Campus banner's
 *     own rule (A9 C3): a persisted teaching room with a seat count and a real room type.
 *     `type !== 'OTHER'` is the same signal `home-room-auto-assign.service.ts` filters on, so
 *     a room this calls ready is a room the home-room step can actually assign. It is NOT
 *     `buildingStatus(building) === 'ready'`, which is the weaker "holds one teaching room"
 *     claim the retired `7 ready` badge made.
 *   · `selectedBuildingRoomsSentence` — the Campus page's own sentence for one building,
 *     including the zero case, so the Dashboard panel cannot say "0 teaching rooms ready"
 *     about a building the Campus page calls dead.
 *
 * A9 C3's own reasoning is preserved verbatim: `needs-section` is deliberately NOT in the
 * numerator. It depends on the latest generated draft, so a header figure would swing every
 * time a draft loads. Rooms that are fine but not yet in a timetable are reported where that
 * fact lives — the problems region, under "have no section yet".
 */
import type { Building, Room } from '@/types';

/** A room this page can PROVE can hold a class. A9 C3's rule, unchanged. */
export function isReadyTeachingRoom(room: Room): boolean {
	return room.isTeachingSpace === true && !!room.capacity && room.capacity > 0 && room.type !== 'OTHER';
}

/** Teaching rooms in one building — the denominator of any per-building fraction. */
export function buildingTeachingRoomCount(building: Pick<Building, 'rooms'>): number {
	return (building.rooms ?? []).filter((room) => room.isTeachingSpace).length;
}

export type TeachingRoomTotals = {
	/** Teaching rooms the page can prove can hold a class. */
	ready: number;
	/** Every teaching room — the denominator. Never the school's total room count. */
	teaching: number;
};

/** THE one room figure, from one room list. Both ends are teaching rooms. */
export function teachingRoomTotals(buildings: readonly Pick<Building, 'rooms'>[]): TeachingRoomTotals {
	let ready = 0;
	let teaching = 0;
	for (const building of buildings) {
		for (const room of building.rooms ?? []) {
			if (!room.isTeachingSpace) continue;
			teaching += 1;
			if (isReadyTeachingRoom(room)) ready += 1;
		}
	}
	return { ready, teaching };
}

/** The compact tile/mini-stat form: `78 of 78`. Never a bare percentage. */
export function teachingRoomsFigure(totals: TeachingRoomTotals): string {
	return `${totals.ready} of ${totals.teaching}`;
}

/**
 * THE line under that figure, in the Campus banner's own words.
 *
 * One status per fact (`AGENTS.md` §8): a complete figure says "ready to be used for
 * classes" and nothing else; an incomplete one names what is missing on the rooms, which is
 * a room defect the scheduler can fix, rather than a vaguer "unmarked".
 */
export function teachingRoomsStatusLine(totals: TeachingRoomTotals): string {
	if (totals.teaching === 0) return 'No rooms are marked as teaching classrooms yet.';
	if (totals.ready === totals.teaching) return 'Ready to be used for classes';
	const remaining = totals.teaching - totals.ready;
	return `${remaining} ${remaining === 1 ? 'room needs' : 'rooms need'} a seat count or room type`;
}

/**
 * The Campus page's sentence for ONE building, copied rather than reworded on the Dashboard
 * (`AGENTS.md` §11 "copy what works"). The zero case is stated, because a building with no
 * teaching room is dead: no section can be placed there.
 */
export function selectedBuildingRoomsSentence(building: Pick<Building, 'rooms'> | null | undefined): string {
	if (!building) return 'Open editor mode to draw buildings and add rooms.';
	const totalRooms = (building.rooms ?? []).length;
	const teachingRooms = buildingTeachingRoomCount(building);
	// A building with NO rooms at all (the capture's `Speech Lab`, `rooms: []`) must not read
	// "None of its 0 rooms are marked as a teaching classroom": it has nothing to mark, and
	// the action is to add rooms, not to re-mark them. This branch did not exist before and
	// it is the one the Dashboard and `/map` both print for a real building on real data.
	if (totalRooms === 0) return 'It has no rooms yet. Add the rooms that are used for classes.';
	if (teachingRooms === 0) {
		return `None of its ${totalRooms} ${totalRooms === 1 ? 'room is' : 'rooms are'} marked as a teaching classroom, so no class can be held there.`;
	}
	return `${teachingRooms} of ${totalRooms} ${totalRooms === 1 ? 'room is' : 'rooms are'} used for classes.`;
}
