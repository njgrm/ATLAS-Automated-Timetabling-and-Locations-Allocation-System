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
	e: ScheduledEntry & { termIndex: number },
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
		// The caller has already proved this entry belongs to the ONE selected
		// term, so the index is known rather than assumed. This line used to
		// default an absent term identity to Term 1 — a fail-open, because it
		// reported a verified single-term schedule the draft could not support,
		// and a missing term must never become Term 1. NOTE: the academic-term
		// boundary guard matches source text, so do not write that fallback out
		// literally in a comment here; it will fail this file's own gate.
		termIndex: e.termIndex,
	};
}

export interface PivotedEntity {
	id: number;
	name: string;
	subtitle?: string;
}

/**
 * Why a pivot refused to build a view.
 *
 * `TERM_IDENTITY_UNAVAILABLE` is the fail-closed case: at least one entry for
 * the requested entity carries no `termIndex`, so it cannot be proven which
 * term it belongs to. Returning it is deliberate — the alternative is to guess
 * Term 1 and merge, which is the defect this change exists to remove. The
 * server-side room endpoint answers the same condition with a typed
 * `501 TERM_FILTER_NOT_READY`, so the two views fail the same way.
 */
export type PivotRefusal = 'TERM_IDENTITY_UNAVAILABLE';

export type PivotResult =
	| { ok: true; view: RoomScheduleView }
	| { ok: false; reason: PivotRefusal };

export function isPivotRefusal(result: PivotResult): result is { ok: false; reason: PivotRefusal } {
	return !result.ok;
}

/**
 * Build a RoomScheduleView from a DraftReport, scoped to **exactly one verified
 * ordered term** and to one entity.
 *
 * `termIndex` is REQUIRED and is never defaulted, clamped or cycled. Entries
 * from other terms are excluded outright rather than merged, because a weekly
 * grid built from three terms at once reports the same class three times in one
 * slot and the grid then counts that as a room conflict that does not exist.
 */
export function pivotDraftToView(
	report: DraftReport,
	entityKind: PivotEntityKind,
	entityId: number,
	entity: PivotedEntity,
	termIndex: number,
	subjectMap: Map<number, string>,
	sectionMap?: Map<number, string>,
	facultyMap?: Map<number, string>,
): PivotResult {
	if (!Number.isInteger(termIndex) || termIndex < 1) {
		return { ok: false, reason: 'TERM_IDENTITY_UNAVAILABLE' };
	}

	const forEntity = report.entries.filter((e) => {
		if (entityKind === 'rooms') return e.roomId === entityId;
		if (entityKind === 'teachers') return e.facultyId === entityId;
		if (entityKind === 'sections') return e.sectionId === entityId;
		return false;
	});

	// Fail closed BEFORE building anything, so a partially-identified draft can
	// never render as a confident single-term schedule.
	if (forEntity.some((e) => typeof e.termIndex !== 'number')) {
		return { ok: false, reason: 'TERM_IDENTITY_UNAVAILABLE' };
	}

	const filtered = forEntity.filter(
		(e): e is ScheduledEntry & { termIndex: number } => e.termIndex === termIndex,
	);

	// Pull display slots from summary; fall back to derived slots if missing
	const displaySlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string }> = report.summary?.timetableDisplaySlots && report.summary.timetableDisplaySlots.length > 0
		? report.summary.timetableDisplaySlots.map((s) => ({
			startTime: s.startTime,
			endTime: s.endTime,
			isSpecialEvent: s.isSpecialEvent,
			eventName: s.eventName,
			dayOfWeek: s.dayOfWeek,
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

	// Typed with the narrowed entry so `mapEntry` cannot be handed an entry whose
	// term identity is still unknown.
	const entriesByDay = new Map<string, Array<ScheduledEntry & { termIndex: number }>>();
	for (const e of filtered) {
		const arr = entriesByDay.get(e.day) ?? [];
		arr.push(e);
		entriesByDay.set(e.day, arr);
	}

	let conflictCount = 0;
	const grid = displaySlots.map((slot) => {
		const eventLabel = slot.eventName ?? null;
		const cells = DAYS.map((day) => {
			// Day-scoped events (Monday Flag/HGP) empty only their own weekday; the
			// same interval remains an ordinary class cell on other weekdays.
			if (slot.isSpecialEvent && (!slot.dayOfWeek || slot.dayOfWeek === day)) {
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
				dayOfWeek: slot.dayOfWeek,
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
		ok: true,
		view: {
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
				dayOfWeek: s.dayOfWeek,
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
		},
	};
}
