import type { RevisionPayloadChange } from '@/lib/published-revision-client';
import type { ScheduledEntry } from '@/types';

/**
 * LANE-C C03 (B3) — one class changed on a published schedule.
 *
 * The 2026-09-25 audit found no way to move one class after publishing: Manual
 * edit and "Choose a new time" call the direct-edit route, which a published run
 * refuses. A published change is a dated revision instead. This module builds
 * the revision change for a class moved to a new time and/or given a new room,
 * carrying only the fields that change, each with its current value (the server
 * refuses a change whose previous values no longer match).
 */

export type PublishedEntryChangeSlot = { day: string; startTime: string; endTime: string };

export type PublishedEntryChangeRequest = {
	entry: ScheduledEntry;
	/** The new time chosen on the grid; `null` keeps the class at its time. */
	target: PublishedEntryChangeSlot | null;
	/** Which change the user started from; decides the panel's first focus. */
	mode: 'move' | 'room';
};

export const PUBLISHED_ENTRY_MOVE = 'PUBLISHED_MOVE';
export const PUBLISHED_ENTRY_ROOM_CHANGE = 'PUBLISHED_ROOM_CHANGE';

export function buildPublishedEntryChange(
	entry: ScheduledEntry,
	next: { target: PublishedEntryChangeSlot | null; roomId: number | null },
): RevisionPayloadChange | null {
	const previous: Record<string, unknown> = {};
	const values: Record<string, unknown> = {};
	const target = next.target;
	const timeChanged = target != null
		&& (target.day !== entry.day || target.startTime !== entry.startTime || target.endTime !== entry.endTime);
	if (timeChanged) {
		previous.day = entry.day;
		previous.startTime = entry.startTime;
		previous.endTime = entry.endTime;
		values.day = target.day;
		values.startTime = target.startTime;
		values.endTime = target.endTime;
	}
	const currentRoomId = entry.roomId ?? null;
	const roomChanged = next.roomId !== currentRoomId;
	if (roomChanged) {
		previous.roomId = currentRoomId;
		values.roomId = next.roomId;
	}
	if (!timeChanged && !roomChanged) return null;
	return {
		entryId: entry.entryId,
		changeType: timeChanged ? PUBLISHED_ENTRY_MOVE : PUBLISHED_ENTRY_ROOM_CHANGE,
		previous,
		next: values,
	};
}

/** LANE-C C03 (B3) — what to do when a direct edit meets a published run. */
export const PUBLISHED_DIRECT_EDIT_MESSAGE = 'This schedule is published, so it cannot be edited directly. Click the class, then choose “Choose a new time”, “Change room” or “Swap with another class”; the change starts on a date you choose.';

/** True when the server refused a direct edit because the run is published. */
export function isPublishedDirectEditRefusal(error: unknown): boolean {
	const data = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data;
	return data?.code === 'RUN_ALREADY_PUBLISHED';
}
