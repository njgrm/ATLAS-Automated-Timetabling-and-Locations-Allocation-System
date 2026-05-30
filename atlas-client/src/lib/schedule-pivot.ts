/**
 * Client-side pivot helpers that re-shape a generation DraftReport's flat
 * ScheduledEntry list into the same RoomScheduleView grid the room
 * endpoint returns. Used by the admin Schedules page to support
 * Rooms / Teachers / Sections views from a single fetch.
 */

import type { DraftReport, RoomScheduleEntry, RoomScheduleView, ScheduledEntry } from '@/types';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

export type PivotEntityKind = 'rooms' | 'teachers' | 'sections';

function timesOverlap(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }): boolean {
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

function mapEntry(
	e: ScheduledEntry,
	subjectMap: Map<number, string>,
	sectionMap?: Map<number, string>,
	facultyMap?: Map<number, string>,
): RoomScheduleEntry {
	return {
		entryId: e.entryId,
		subjectId: e.subjectId,
		subjectDisplayLabel: subjectMap.get(e.subjectId),
		sectionId: e.sectionId,
		sectionDisplayLabel: sectionMap?.get(e.sectionId),
		facultyId: e.facultyId,
		facultyDisplayLabel: e.facultyId != null ? facultyMap?.get(e.facultyId) : 'Unassigned Faculty',
		roomId: e.roomId,
		startTime: e.startTime,
		endTime: e.endTime,
		durationMinutes: e.durationMinutes,
		termIndex: (e.termIndex ?? 1) as 1 | 2 | 3,
	};
}

export interface PivotedEntity {
	id: number;
	name: string;
	subtitle?: string;
}

/**
 * Build a RoomScheduleView from the latest DraftReport, filtered by an entity.
 * `entity.id === 0` means "all entries" but currently unused.
 */
export function pivotDraftToView(
	report: DraftReport,
	entityKind: PivotEntityKind,
	entityId: number,
	entity: PivotedEntity,
	subjectMap: Map<number, string>,
	sectionMap?: Map<number, string>,
	facultyMap?: Map<number, string>,
): RoomScheduleView {
	const filtered = report.entries.filter((e) => {
		if (entityKind === 'rooms') return e.roomId === entityId;
		if (entityKind === 'teachers') return e.facultyId === entityId;
		if (entityKind === 'sections') return e.sectionId === entityId;
		return false;
	});

	// Pull display slots from summary; fall back to derived slots if missing
	const displaySlots = report.summary?.timetableDisplaySlots && report.summary.timetableDisplaySlots.length > 0
		? report.summary.timetableDisplaySlots.map((s) => ({
			startTime: s.startTime,
			endTime: s.endTime,
			isSpecialEvent: s.isSpecialEvent,
			eventName: s.eventName,
		}))
		: (() => {
			const seen = new Map<string, { startTime: string; endTime: string }>();
			for (const e of filtered) {
				seen.set(`${e.startTime}-${e.endTime}`, { startTime: e.startTime, endTime: e.endTime });
			}
			return Array.from(seen.values()).sort(
				(a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime),
			);
		})();

	displaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

	const entriesByDay = new Map<string, ScheduledEntry[]>();
	for (const e of filtered) {
		const arr = entriesByDay.get(e.day) ?? [];
		arr.push(e);
		entriesByDay.set(e.day, arr);
	}

	let conflictCount = 0;
	const grid = displaySlots.map((slot) => {
		const eventLabel = slot.eventName ?? null;
		const cells = DAYS.map((day) => {
			if (slot.isSpecialEvent) {
				return { day, occupied: false, entries: [], conflict: false };
			}
			const dayEntries = entriesByDay.get(day) ?? [];
			const overlapping = dayEntries.filter((e) => timesOverlap(slot, e));
			const mapped = overlapping.map((e) => mapEntry(e, subjectMap, sectionMap, facultyMap));
			const hasConflict = mapped.length > 1;
			if (hasConflict) conflictCount++;
			return { day, occupied: mapped.length > 0, entries: mapped, conflict: hasConflict };
		});
		return {
			timeSlot: {
				startTime: slot.startTime,
				endTime: slot.endTime,
				eventLabel,
				isSpecialEvent: slot.isSpecialEvent,
			},
			cells,
		};
	});

	// Summary metrics — keep simple aggregations consistent with room view
	const uniqueEntryIds = new Set(filtered.map((e) => e.entryId));
	const occupiedMinutes = filtered.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
	const classSlots = displaySlots.filter((s) => !s.isSpecialEvent);
	const slotMinutesTotal = classSlots.reduce((sum, s) => {
		const [sh, sm] = s.startTime.split(':').map(Number);
		const [eh, em] = s.endTime.split(':').map(Number);
		return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
	}, 0);
	const availableMinutes = slotMinutesTotal * DAYS.length;
	const utilizationPercent = availableMinutes > 0
		? Math.round((occupiedMinutes / availableMinutes) * 10000) / 100
		: 0;

	return {
		room: {
			id: entity.id,
			name: entity.name,
			type: entityKind,
			buildingName: entity.subtitle,
		},
		source: {
			mode: 'LATEST',
			runId: report.runId,
			status: report.status,
			generatedAt: report.finishedAt ?? report.createdAt,
		},
		timeSlots: displaySlots.map((s) => ({
			startTime: s.startTime,
			endTime: s.endTime,
			eventLabel: s.eventName ?? null,
			isSpecialEvent: s.isSpecialEvent,
		})),
		days: [...DAYS],
		grid,
		summary: {
			occupiedMinutes,
			availableMinutes,
			utilizationPercent,
			entryCount: uniqueEntryIds.size,
			conflictCount,
		},
	};
}
