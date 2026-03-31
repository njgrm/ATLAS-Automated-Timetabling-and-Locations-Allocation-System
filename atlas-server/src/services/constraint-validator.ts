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
	'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
	'FACULTY_BREAK_REQUIREMENT_VIOLATED',
	'FACULTY_DAILY_MAX_EXCEEDED',
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

export interface PolicyRef {
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
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
	policy?: PolicyRef;
}

// ─── Violation output ───

export interface Violation {
	code: ViolationCode;
	severity: 'HARD' | 'SOFT';
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

// ─── Time helpers ───

function timesOverlap(a: { day: string; startTime: string; endTime: string }, b: { day: string; startTime: string; endTime: string }): boolean {
	if (a.day !== b.day) return false;
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
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

	// ── 6) Policy-based checks (consecutive, daily max, break requirement) ──
	if (ctx.policy) {
		const policy = ctx.policy;
		const severity = policy.enforceConsecutiveBreakAsHard ? 'HARD' as const : 'SOFT' as const;

		// Group entries by faculty+day, sorted by startTime
		const facDayEntries = new Map<string, ScheduledEntry[]>();
		for (const e of ctx.entries) {
			const key = `${e.facultyId}:${e.day}`;
			const arr = facDayEntries.get(key) ?? [];
			arr.push(e);
			facDayEntries.set(key, arr);
		}

		for (const [key, dayEntries] of facDayEntries) {
			const [facIdStr, day] = key.split(':');
			const facultyId = Number(facIdStr);
			const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

			// 6a) Daily teaching max
			const dailyMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
			if (dailyMinutes > policy.maxTeachingMinutesPerDay) {
				violations.push({
					...base, severity,
					code: 'FACULTY_DAILY_MAX_EXCEEDED',
					message: `Faculty ${facultyId} teaches ${dailyMinutes} min on ${day}, exceeds daily max ${policy.maxTeachingMinutesPerDay} min.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: { dailyMinutes, maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay },
				});
			}

			// 6b) Consecutive teaching without break
			let consecutiveMinutes = 0;
			let blockEntries: string[] = [];

			for (let i = 0; i < sorted.length; i++) {
				const entry = sorted[i];

				if (i === 0) {
					consecutiveMinutes = entry.durationMinutes;
					blockEntries = [entry.entryId];
					continue;
				}

				const prev = sorted[i - 1];
				const gapMinutes = timeToMinutes(entry.startTime) - timeToMinutes(prev.endTime);

				if (gapMinutes < policy.minBreakMinutesAfterConsecutiveBlock) {
					// Contiguous or gap too short — extend block
					consecutiveMinutes += entry.durationMinutes;
					blockEntries.push(entry.entryId);
				} else {
					// Gap is sufficient — reset
					consecutiveMinutes = entry.durationMinutes;
					blockEntries = [entry.entryId];
				}

				if (consecutiveMinutes > policy.maxConsecutiveTeachingMinutesBeforeBreak) {
					violations.push({
						...base, severity,
						code: 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
						message: `Faculty ${facultyId} has ${consecutiveMinutes} consecutive teaching min on ${day}, exceeds limit ${policy.maxConsecutiveTeachingMinutesBeforeBreak} min.`,
						entities: { facultyId, day, entryIds: [...blockEntries] },
						meta: { consecutiveMinutes, maxConsecutive: policy.maxConsecutiveTeachingMinutesBeforeBreak },
					});
				}
			}
		}
	}

	// ── Aggregate counts ──
	const byCode = {} as Record<ViolationCode, number>;
	for (const code of VIOLATION_CODES) byCode[code] = 0;
	for (const v of violations) {
		byCode[v.code]++;
	}

	return {
		violations,
		counts: { total: violations.length, byCode },
	};
}
