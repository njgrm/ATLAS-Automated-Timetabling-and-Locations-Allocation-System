/**
 * C11 M2 — which rooms are FREE at a class's own time, from data already loaded.
 *
 * The recorded defect (`docs/reviews/codex-timetable-walk-20260928/report.md`,
 * defect 2): `Change room` "silently does nothing" — the selection and the action
 * bar disappear, no picker and no message, and the grid is unchanged. An operator
 * who asked to move a class and got silence has no way to tell a refusal from a bug.
 *
 * M2's requirement is therefore as much about the NEGATIVE case as the positive
 * one: a picker listing the free rooms, OR the plain sentence "No other room is
 * free at this time" WITH the selection kept. Never nothing.
 *
 * ── WHY NO NEW FETCH ─────────────────────────────────────────────────────────
 *
 * The rooms and the occupied slots are already in the tree: `roomMap` and
 * `draftEntries` are props of `ManualEditPanel` today, and
 * `useScheduleReviewWorkspaceState` already derives the inline-placement room
 * options from the same two. So the availability question is answered by a pure
 * function over data the panel is handed — no request, no cache, and no second
 * source of truth that could disagree with the grid on screen.
 */

export type RoomOccupancyInput = {
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
};

/** The minimum a room record needs for this question. Kept structural, not Prisma-shaped. */
export type RoomRecordLike = {
	id: number;
	name: string;
	type?: string | null;
	buildingShortCode?: string | null;
	buildingName?: string | null;
	active?: boolean | null;
};

export type FreeRoom = {
	id: number;
	label: string;
};

/** The exact sentence the M2 contract names, used wherever no room can be offered. */
export const NO_OTHER_ROOM_FREE = 'No other room is free at this time';

/**
 * Two slots overlap when each starts before the other ends. Half-open intervals, so
 * a class ending exactly when another begins is NOT an overlap — which is how the
 * grid's own adjacency works, and a room wrongly excluded here would be a room the
 * operator is never offered.
 */
export function slotsOverlap(
	a: { startTime: string; endTime: string },
	b: { startTime: string; endTime: string },
): boolean {
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

/**
 * Every room that is free for this class's own day and time, in label order.
 *
 * Excluded, and each for a stated reason:
 *  - the class's CURRENT room — choosing it is not a change, and offering it would
 *    let the operator "move" a class to where it already is and see nothing happen
 *    (the same silence this target exists to remove);
 *  - a room occupied at that exact slot by any other entry in the run;
 *  - an inactive room, which cannot be assigned at all.
 *
 * A room with no record in `roomMap` is not offered: this function only ever
 * returns rooms it can name, so the picker never renders a bare id.
 */
export function freeRoomsAtSlot(input: {
	rooms: readonly RoomRecordLike[];
	occupied: readonly RoomOccupancyInput[];
	currentRoomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
}): FreeRoom[] {
	const slot = { startTime: input.startTime, endTime: input.endTime };
	return input.rooms
		.filter((room) => room.active !== false)
		.filter((room) => room.id !== input.currentRoomId)
		.filter((room) => !input.occupied.some((entry) => (
			entry.roomId === room.id
			&& entry.day === input.day
			&& slotsOverlap(slot, entry)
		)))
		.map((room) => ({ id: room.id, label: labelForRoom(room) }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

/** The same "Room 103 · G7AW" shape the grid and the inline picker already use. */
export function labelForRoom(room: RoomRecordLike): string {
	const building = room.buildingShortCode || room.buildingName || '';
	return building ? `${room.name} · ${building}` : room.name;
}
