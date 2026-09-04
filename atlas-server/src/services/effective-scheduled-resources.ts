/**
 * Canonical effective-resource expansion for compact modular timetable entries.
 *
 * Prompt 01 (Dynamic Timetable Recovery, 2026-09-03):
 * A compact modular lane reserves one physical section/room/day/time slot while
 * each `metadata.modularAssignments[]` row reserves its assigned teacher and
 * subject only in that assignment's term. Every consumer — constructor
 * occupancy, validation, repair, faculty load, exports, publish readiness —
 * must see the SAME effective reservation view so a null top-level facultyId
 * can never hide a real teacher double-booking.
 */

export type EffectiveTermIndex = number;

export type EffectiveResourceReservation = {
	/** Stable identity: `${entryId}:term:${termIndex}:faculty:${facultyId}` */
	reservationId: string;
	entryId: string;
	/** The effective teacher — from modularAssignments, never null here */
	facultyId: number;
	/** Effective subject identity for this term (subjectCode when modular) */
	subjectCode: string | null;
	subjectId: number | null;
	sectionId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	/** The term this reservation applies to (from the modular assignment) */
	termIndex: EffectiveTermIndex;
	/** True when the reservation comes from a modular assignment row */
	isModular: boolean;
	/** True for a year-round direct entry (reserves in every applicable term) */
	isDirect: boolean;
};

export type ExpandableEntry = {
	entryId: string;
	facultyId: number | null;
	roomId: number;
	subjectId?: number | null;
	subjectCode?: string | null;
	sectionId: number;
	day: string;
	startTime: string;
	endTime: string;
	termIndex?: number | null;
	metadata?: {
		modularAssignments?: Array<{
			termIndex: number;
			facultyId: number;
			subjectCode: string;
		}> | null;
	} | null;
};

/**
 * Expand entries into effective per-teacher, per-term reservations.
 *
 * - A direct entry (no modularAssignments) with a facultyId produces one
 *   reservation in its own termIndex (or term 0 when unscoped, meaning
 *   year-round/all-terms for conflict purposes).
 * - A compact modular entry produces one reservation per modularAssignments
 *   row: the teacher + subject reserved ONLY in that row's term. The physical
 *   lane (section/room/day/time) is shared, but teachers are distinct per term.
 * - A direct entry with null facultyId produces NO faculty reservation (there
 *   is genuinely no teacher assigned — e.g. an unplaced placeholder lane).
 */
export function expandEffectiveScheduledResources(entries: readonly ExpandableEntry[]): EffectiveResourceReservation[] {
	const reservations: EffectiveResourceReservation[] = [];

	for (const entry of entries) {
		const modular = entry.metadata?.modularAssignments;

		if (Array.isArray(modular) && modular.length > 0) {
			for (const assignment of modular) {
				if (typeof assignment.facultyId !== 'number' || !Number.isFinite(assignment.facultyId)) continue;
				const termIndex = Number(assignment.termIndex);
				reservations.push({
					reservationId: `${entry.entryId}:term:${termIndex}:faculty:${assignment.facultyId}`,
					entryId: entry.entryId,
					facultyId: assignment.facultyId,
					subjectCode: assignment.subjectCode ?? null,
					subjectId: null,
					sectionId: entry.sectionId,
					roomId: entry.roomId,
					day: entry.day,
					startTime: entry.startTime,
					endTime: entry.endTime,
					termIndex,
					isModular: true,
					isDirect: false,
				});
			}
			continue;
		}

		if (typeof entry.facultyId === 'number' && Number.isFinite(entry.facultyId)) {
			const termIndex = typeof entry.termIndex === 'number' && Number.isFinite(entry.termIndex)
				? entry.termIndex
				: 0; // 0 = unscoped/year-round: conflicts with any term overlap
			reservations.push({
				reservationId: `${entry.entryId}:term:${termIndex}:faculty:${entry.facultyId}`,
				entryId: entry.entryId,
				facultyId: entry.facultyId,
				subjectCode: entry.subjectCode ?? null,
				subjectId: entry.subjectId ?? null,
				sectionId: entry.sectionId,
				roomId: entry.roomId,
				day: entry.day,
				startTime: entry.startTime,
				endTime: entry.endTime,
				termIndex,
				isModular: false,
				isDirect: true,
			});
		}
	}

	return reservations;
}

/**
 * Two effective reservations conflict when the SAME teacher is reserved for
 * overlapping intervals on the same day AND the reservations apply to
 * overlapping term scopes.
 *
 * Term-scope overlap rules:
 * - term 0 (year-round/unscoped) overlaps every term
 * - two scoped terms overlap only when equal (term rotation means term 1 and
 *   term 2 of the same lane are different points in time)
 */
export function effectiveTermsOverlap(a: EffectiveTermIndex, b: EffectiveTermIndex): boolean {
	if (a === 0 || b === 0) return true;
	return a === b;
}

export function effectiveTimesOverlap(
	a: { startTime: string; endTime: string },
	b: { startTime: string; endTime: string },
): boolean {
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

/**
 * Find effective teacher double-bookings: same teacher, same day, overlapping
 * intervals, overlapping term scope — deduplicated by reservation identity so
 * one pair is reported once regardless of how many consumers ask.
 */
export function findEffectiveFacultyOverlaps(
	reservations: readonly EffectiveResourceReservation[],
): Array<{ a: EffectiveResourceReservation; b: EffectiveResourceReservation }> {
	const byFacultyDay = new Map<string, EffectiveResourceReservation[]>();
	for (const r of reservations) {
		const key = `${r.facultyId}:${r.day}`;
		const arr = byFacultyDay.get(key);
		if (arr) arr.push(r);
		else byFacultyDay.set(key, [r]);
	}

	const overlaps: Array<{ a: EffectiveResourceReservation; b: EffectiveResourceReservation }> = [];
	for (const [, dayReservations] of byFacultyDay) {
		for (let i = 0; i < dayReservations.length; i++) {
			for (let j = i + 1; j < dayReservations.length; j++) {
				const a = dayReservations[i];
				const b = dayReservations[j];
				if (a.entryId === b.entryId) continue; // same compact lane
				if (!effectiveTimesOverlap(a, b)) continue;
				if (!effectiveTermsOverlap(a.termIndex, b.termIndex)) continue;
				overlaps.push({ a, b });
			}
		}
	}
	return overlaps;
}
