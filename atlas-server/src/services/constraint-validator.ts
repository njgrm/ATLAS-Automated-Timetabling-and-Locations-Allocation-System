/**
 * Hard-constraint validator for timetable generation runs.
 * Deterministic, unit-testable. No transport or persistence concerns.
 *
 * Consumes a DraftSchedule (array of scheduled class entries) plus
 * reference data (faculty loads, faculty-subject qualifications, room types,
 * subject preferred room types) and emits a typed violation array.
 */

import type { RoomType } from '@prisma/client';

// ─── Violation codes ───

export const VIOLATION_CODES = [
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
	'FACULTY_OVERLOAD',
	'ROOM_TYPE_MISMATCH',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
] as const;

export type ViolationCode = (typeof VIOLATION_CODES)[number];

// ─── Draft schedule input shape ───

export interface ScheduledEntry {
	/** Unique id of this class assignment within the draft */
	entryId: string;
	facultyId: number;
	roomId: number;
	subjectId: number;
	sectionId: number;
	day: string;          // e.g. 'MONDAY'
	startTime: string;    // HH:mm
	endTime: string;      // HH:mm
	durationMinutes: number;
}

// ─── Reference data ───

export interface FacultyRef {
	id: number;
	maxHoursPerWeek: number;
}

export interface FacultySubjectRef {
	facultyId: number;
	subjectId: number;
}

export interface RoomRef {
	id: number;
	type: RoomType;
}

export interface SubjectRef {
	id: number;
	preferredRoomType: RoomType;
}

export interface ValidatorContext {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	entries: ScheduledEntry[];
	faculty: FacultyRef[];
	facultySubjects: FacultySubjectRef[];
	rooms: RoomRef[];
	subjects: SubjectRef[];
}

// ─── Violation output ───

export interface Violation {
	code: ViolationCode;
	severity: 'HARD';
	message: string;
	schoolId: number;
	schoolYearId: number;
	runId: number;
	entities: {
		facultyId?: number;
		roomId?: number;
		subjectId?: number;
		sectionId?: number;
		day?: string;
		startTime?: string;
		endTime?: string;
		entryIds?: string[];
	};
	meta?: Record<string, unknown>;
}

export interface ValidationResult {
	violations: Violation[];
	counts: {
		total: number;
		byCode: Record<ViolationCode, number>;
	};
}

// ─── Time overlap helper ───

function timesOverlap(a: { day: string; startTime: string; endTime: string }, b: { day: string; startTime: string; endTime: string }): boolean {
	if (a.day !== b.day) return false;
	// HH:mm string comparison works for same-day ranges
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

// ─── Validator ───

export function validateHardConstraints(ctx: ValidatorContext): ValidationResult {
	const violations: Violation[] = [];
	const base = { severity: 'HARD' as const, schoolId: ctx.schoolId, schoolYearId: ctx.schoolYearId, runId: ctx.runId };

	// Build lookup maps
	const facultyMap = new Map(ctx.faculty.map((f) => [f.id, f]));
	const roomMap = new Map(ctx.rooms.map((r) => [r.id, r]));
	const subjectMap = new Map(ctx.subjects.map((s) => [s.id, s]));
	const qualifiedSet = new Set(ctx.facultySubjects.map((fs) => `${fs.facultyId}:${fs.subjectId}`));

	// ── 1) Faculty time conflict ──
	const byFacultyDay = new Map<string, ScheduledEntry[]>();
	for (const e of ctx.entries) {
		const key = `${e.facultyId}:${e.day}`;
		const arr = byFacultyDay.get(key);
		if (arr) arr.push(e);
		else byFacultyDay.set(key, [e]);
	}

	for (const [, dayEntries] of byFacultyDay) {
		for (let i = 0; i < dayEntries.length; i++) {
			for (let j = i + 1; j < dayEntries.length; j++) {
				const a = dayEntries[i];
				const b = dayEntries[j];
				if (timesOverlap(a, b)) {
					violations.push({
						...base,
						code: 'FACULTY_TIME_CONFLICT',
						message: `Faculty ${a.facultyId} has overlapping assignments on ${a.day}: ${a.startTime}-${a.endTime} vs ${b.startTime}-${b.endTime}.`,
						entities: { facultyId: a.facultyId, day: a.day, startTime: a.startTime, endTime: b.endTime, entryIds: [a.entryId, b.entryId] },
					});
				}
			}
		}
	}

	// ── 2) Room time conflict ──
	const byRoomDay = new Map<string, ScheduledEntry[]>();
	for (const e of ctx.entries) {
		const key = `${e.roomId}:${e.day}`;
		const arr = byRoomDay.get(key);
		if (arr) arr.push(e);
		else byRoomDay.set(key, [e]);
	}

	for (const [, dayEntries] of byRoomDay) {
		for (let i = 0; i < dayEntries.length; i++) {
			for (let j = i + 1; j < dayEntries.length; j++) {
				const a = dayEntries[i];
				const b = dayEntries[j];
				if (timesOverlap(a, b)) {
					violations.push({
						...base,
						code: 'ROOM_TIME_CONFLICT',
						message: `Room ${a.roomId} double-booked on ${a.day}: ${a.startTime}-${a.endTime} vs ${b.startTime}-${b.endTime}.`,
						entities: { roomId: a.roomId, day: a.day, startTime: a.startTime, endTime: b.endTime, entryIds: [a.entryId, b.entryId] },
					});
				}
			}
		}
	}

	// ── 3) Faculty load over max ──
	const minutesByFaculty = new Map<number, number>();
	for (const e of ctx.entries) {
		minutesByFaculty.set(e.facultyId, (minutesByFaculty.get(e.facultyId) ?? 0) + e.durationMinutes);
	}

	for (const [facultyId, totalMinutes] of minutesByFaculty) {
		const fac = facultyMap.get(facultyId);
		if (!fac) continue;
		const maxMinutes = fac.maxHoursPerWeek * 60;
		if (totalMinutes > maxMinutes) {
			violations.push({
				...base,
				code: 'FACULTY_OVERLOAD',
				message: `Faculty ${facultyId} assigned ${totalMinutes} min/week, exceeds max ${maxMinutes} min (${fac.maxHoursPerWeek} h).`,
				entities: { facultyId },
				meta: { totalMinutes, maxMinutes, maxHoursPerWeek: fac.maxHoursPerWeek },
			});
		}
	}

	// ── 4) Room/type incompatibility ──
	for (const e of ctx.entries) {
		const room = roomMap.get(e.roomId);
		const subject = subjectMap.get(e.subjectId);
		if (!room || !subject) continue;
		if (room.type !== subject.preferredRoomType) {
			violations.push({
				...base,
				code: 'ROOM_TYPE_MISMATCH',
				message: `Entry ${e.entryId}: room ${e.roomId} type "${room.type}" does not match subject ${e.subjectId} preferred type "${subject.preferredRoomType}".`,
				entities: { roomId: e.roomId, subjectId: e.subjectId, sectionId: e.sectionId, entryIds: [e.entryId] },
				meta: { roomType: room.type, preferredRoomType: subject.preferredRoomType },
			});
		}
	}

	// ── 5) Faculty-subject qualification ──
	const checkedPairs = new Set<string>();
	for (const e of ctx.entries) {
		const pairKey = `${e.facultyId}:${e.subjectId}`;
		if (checkedPairs.has(pairKey)) continue;
		checkedPairs.add(pairKey);
		if (!qualifiedSet.has(pairKey)) {
			violations.push({
				...base,
				code: 'FACULTY_SUBJECT_NOT_QUALIFIED',
				message: `Faculty ${e.facultyId} is not qualified/assigned for subject ${e.subjectId}.`,
				entities: { facultyId: e.facultyId, subjectId: e.subjectId },
			});
		}
	}

	// ── Aggregate counts ──
	const byCode: Record<ViolationCode, number> = {
		FACULTY_TIME_CONFLICT: 0,
		ROOM_TIME_CONFLICT: 0,
		FACULTY_OVERLOAD: 0,
		ROOM_TYPE_MISMATCH: 0,
		FACULTY_SUBJECT_NOT_QUALIFIED: 0,
	};
	for (const v of violations) {
		byCode[v.code]++;
	}

	return {
		violations,
		counts: { total: violations.length, byCode },
	};
}
