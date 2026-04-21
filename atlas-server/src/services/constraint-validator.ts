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
	'ROOM_CAPACITY_EXCEEDED',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
	'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
	'FACULTY_BREAK_REQUIREMENT_VIOLATED',
	'FACULTY_DAILY_MAX_EXCEEDED',
	'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
	'FACULTY_INSUFFICIENT_DAILY_VACANT',
	'SECTION_OVERCOMPRESSED',
	'SESSION_PATTERN_VIOLATED',
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
	entryKind?: 'SECTION' | 'COHORT';
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	cohortMemberSectionIds?: number[];
	cohortExpectedEnrollment?: number | null;
	adviserId?: number | null;
	adviserName?: string | null;
}

// ─── Reference data ───

export interface FacultyRef {
	id: number;
	maxHoursPerWeek: number;
}

export interface FacultySubjectRef {
	facultyId: number;
	subjectId: number;
	sectionIds: number[];
}

export interface RoomRef {
	id: number;
	type: RoomType;
	capacity: number | null;
}

export interface SubjectRef {
	id: number;
	preferredRoomType: RoomType;
	sessionPattern?: 'MWF' | 'TTH' | 'ANY';
}

export interface PolicyRef {
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
}

export interface TravelPolicyRef {
	enableTravelWellbeingChecks: boolean;
	maxWalkingDistanceMetersPerTransition: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
}

export interface BuildingRef {
	id: number;
	x: number;
	y: number;
}

export interface RoomBuildingRef {
	roomId: number;
	buildingId: number;
}

export interface VacantPolicyRef {
	enableVacantAwareConstraints: boolean;
	targetFacultyDailyVacantMinutes: number;
	targetSectionDailyVacantPeriods: number;
	maxCompressedTeachingMinutesPerDay: number;
}

export interface ConstraintOverrideRef {
	enabled: boolean;
	weight: number; // 1–10
	treatAsHard: boolean;
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
	/** Map of sectionId → enrolledCount for capacity checks */
	sectionEnrollment?: Map<number, number>;
	policy?: PolicyRef;
	travelPolicy?: TravelPolicyRef;
	vacantPolicy?: VacantPolicyRef;
	buildings?: BuildingRef[];
	roomBuildings?: RoomBuildingRef[];
	constraintConfig?: Record<string, ConstraintOverrideRef>;
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

function getEffectiveSectionIds(entry: ScheduledEntry): number[] {
	if (entry.entryKind === 'COHORT' && Array.isArray(entry.cohortMemberSectionIds) && entry.cohortMemberSectionIds.length > 0) {
		return entry.cohortMemberSectionIds;
	}
	return [entry.sectionId];
}

function isSameCohortGroup(left: ScheduledEntry, right: ScheduledEntry): boolean {
	return Boolean(left.cohortCode && right.cohortCode && left.cohortCode === right.cohortCode);
}

// ─── Validator ───

export function validateHardConstraints(ctx: ValidatorContext): ValidationResult {
	const violations: Violation[] = [];
	const base = { severity: 'HARD' as const, schoolId: ctx.schoolId, schoolYearId: ctx.schoolYearId, runId: ctx.runId };

	// Build lookup maps
	const facultyMap = new Map(ctx.faculty.map((f) => [f.id, f]));
	const roomMap = new Map(ctx.rooms.map((r) => [r.id, r]));
	const subjectMap = new Map(ctx.subjects.map((s) => [s.id, s]));
	const qualifiedSet = new Set(
		ctx.facultySubjects.flatMap((fs) => fs.sectionIds.map((sectionId) => `${fs.facultyId}:${fs.subjectId}:${sectionId}`)),
	);

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
				if (timesOverlap(a, b) && !isSameCohortGroup(a, b)) {
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
				if (timesOverlap(a, b) && !isSameCohortGroup(a, b)) {
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

	// ── 4b) Room capacity exceeded ──
	if (ctx.sectionEnrollment) {
		for (const e of ctx.entries) {
			const room = roomMap.get(e.roomId);
			if (!room || room.capacity == null) continue;
			const enrolled = e.cohortExpectedEnrollment ?? ctx.sectionEnrollment.get(e.sectionId) ?? 0;
			if (enrolled > room.capacity) {
				violations.push({
					...base,
					code: 'ROOM_CAPACITY_EXCEEDED',
					message: e.entryKind === 'COHORT' && e.cohortCode
						? `Entry ${e.entryId}: cohort ${e.cohortCode} has ${enrolled} learners but room ${e.roomId} capacity is only ${room.capacity}.`
						: `Entry ${e.entryId}: section ${e.sectionId} has ${enrolled} students but room ${e.roomId} capacity is only ${room.capacity}.`,
					entities: { roomId: e.roomId, sectionId: e.sectionId, entryIds: [e.entryId] },
					meta: {
						enrolledCount: enrolled,
						roomCapacity: room.capacity,
						...(e.cohortCode ? { cohortCode: e.cohortCode } : {}),
						...(e.cohortName ? { cohortName: e.cohortName } : {}),
					},
				});
			}
		}
	}

	// ── 4c) Session pattern violated ──
	{
		const MWF_DAYS = new Set(['MONDAY', 'WEDNESDAY', 'FRIDAY']);
		const TTH_DAYS = new Set(['TUESDAY', 'THURSDAY']);
		for (const e of ctx.entries) {
			const subject = subjectMap.get(e.subjectId);
			if (!subject || !subject.sessionPattern || subject.sessionPattern === 'ANY') continue;
			const allowed = subject.sessionPattern === 'MWF' ? MWF_DAYS : TTH_DAYS;
			if (!allowed.has(e.day)) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'SESSION_PATTERN_VIOLATED',
					message: `Entry ${e.entryId}: subject ${e.subjectId} prefers ${subject.sessionPattern} pattern but is scheduled on ${e.day}.`,
					entities: { subjectId: e.subjectId, sectionId: e.sectionId, day: e.day, entryIds: [e.entryId] },
					meta: { sessionPattern: subject.sessionPattern, actualDay: e.day },
				});
			}
		}
	}

	// ── 5) Faculty-subject qualification ──
	const checkedPairs = new Set<string>();
	for (const e of ctx.entries) {
		for (const sectionId of getEffectiveSectionIds(e)) {
			const pairKey = `${e.facultyId}:${e.subjectId}:${sectionId}`;
			if (checkedPairs.has(pairKey)) continue;
			checkedPairs.add(pairKey);
			if (!qualifiedSet.has(pairKey)) {
				violations.push({
					...base,
					code: 'FACULTY_SUBJECT_NOT_QUALIFIED',
					message: `Faculty ${e.facultyId} is not qualified/assigned for subject ${e.subjectId} in section ${sectionId}.`,
					entities: { facultyId: e.facultyId, subjectId: e.subjectId, sectionId },
				});
			}
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

			// 6a) Daily teaching max — always HARD
			const dailyMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
			if (dailyMinutes > policy.maxTeachingMinutesPerDay) {
				violations.push({
					...base, severity: 'HARD',
					code: 'FACULTY_DAILY_MAX_EXCEEDED',
					message: `Faculty ${facultyId} teaches ${dailyMinutes} min on ${day}, exceeds daily max ${policy.maxTeachingMinutesPerDay} min.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: { dailyMinutes, maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay },
				});
			}

			// 6b) Consecutive teaching without break + break requirement
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
					// Gap exists but is insufficient — emit break-requirement violation
					if (gapMinutes > 0) {
						violations.push({
							...base, severity,
							code: 'FACULTY_BREAK_REQUIREMENT_VIOLATED',
							message: `Faculty ${facultyId} has only ${gapMinutes} min break on ${day} between ${prev.endTime} and ${entry.startTime}, requires ${policy.minBreakMinutesAfterConsecutiveBlock} min.`,
							entities: { facultyId, day, entryIds: [prev.entryId, entry.entryId] },
							meta: { actualGapMinutes: gapMinutes, requiredBreakMinutes: policy.minBreakMinutesAfterConsecutiveBlock },
						});
					}
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

	// ── 7) Travel / well-being soft constraints ──
	if (ctx.travelPolicy?.enableTravelWellbeingChecks && ctx.buildings && ctx.roomBuildings) {
		const tp = ctx.travelPolicy;
		const buildingMap = new Map(ctx.buildings.map((b) => [b.id, b]));
		const roomToBld = new Map(ctx.roomBuildings.map((rb) => [rb.roomId, rb.buildingId]));

		// Group entries by faculty+day, sorted by startTime
		const byFacDay = new Map<string, ScheduledEntry[]>();
		for (const e of ctx.entries) {
			const key = `${e.facultyId}:${e.day}`;
			const arr = byFacDay.get(key) ?? [];
			arr.push(e);
			byFacDay.set(key, arr);
		}

		for (const [key, dayEntries] of byFacDay) {
			const [facIdStr, day] = key.split(':');
			const facultyId = Number(facIdStr);
			const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

			let buildingTransitions = 0;
			let backToBackCross = 0;

			for (let i = 1; i < sorted.length; i++) {
				const prev = sorted[i - 1];
				const curr = sorted[i];
				const fromBldId = roomToBld.get(prev.roomId);
				const toBldId = roomToBld.get(curr.roomId);
				if (fromBldId == null || toBldId == null) continue;

				const gapMinutes = timeToMinutes(curr.startTime) - timeToMinutes(prev.endTime);
				const isCrossBuilding = fromBldId !== toBldId;

				if (isCrossBuilding) {
					buildingTransitions++;

					// Estimate Euclidean distance between building centers
					const fromBld = buildingMap.get(fromBldId);
					const toBld = buildingMap.get(toBldId);
					const estimatedDistance = (fromBld && toBld)
						? Math.round(Math.sqrt((toBld.x - fromBld.x) ** 2 + (toBld.y - fromBld.y) ** 2))
						: 0;

					// 7a) Excessive travel distance per transition
					if (estimatedDistance > tp.maxWalkingDistanceMetersPerTransition) {
						violations.push({
							...base, severity: 'SOFT',
							code: 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
							message: `Faculty ${facultyId} must travel ~${estimatedDistance}m between buildings on ${day} (${prev.endTime}→${curr.startTime}), exceeds ${tp.maxWalkingDistanceMetersPerTransition}m limit.`,
							entities: { facultyId, day, entryIds: [prev.entryId, curr.entryId] },
							meta: {
								facultyId, day,
								fromRoomId: prev.roomId, toRoomId: curr.roomId,
								fromBuildingId: fromBldId, toBuildingId: toBldId,
								gapMinutes, estimatedDistanceMeters: estimatedDistance,
								configuredThresholds: { maxWalkingDistanceMetersPerTransition: tp.maxWalkingDistanceMetersPerTransition },
							},
						});
					}

					// 7c) Track back-to-back cross-building with short/no gap
					if (gapMinutes <= 5) {
						backToBackCross++;
					}
				}
			}

			// 7b) Excessive building transitions per day
			if (buildingTransitions > tp.maxBuildingTransitionsPerDay) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
					message: `Faculty ${facultyId} has ${buildingTransitions} building transitions on ${day}, exceeds limit of ${tp.maxBuildingTransitionsPerDay}.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: {
						facultyId, day,
						buildingTransitions,
						configuredThresholds: { maxBuildingTransitionsPerDay: tp.maxBuildingTransitionsPerDay },
					},
				});
			}

			// 7c) Insufficient transition buffer (too many back-to-back cross-building)
			if (backToBackCross > tp.maxBackToBackTransitionsWithoutBuffer) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
					message: `Faculty ${facultyId} has ${backToBackCross} back-to-back cross-building transitions without buffer on ${day}, exceeds limit of ${tp.maxBackToBackTransitionsWithoutBuffer}.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: {
						facultyId, day,
						backToBackTransitions: backToBackCross,
						configuredThresholds: { maxBackToBackTransitionsWithoutBuffer: tp.maxBackToBackTransitionsWithoutBuffer },
					},
				});
			}
		}
	}

	// ── 8) Well-being soft constraints: idle gap, early start, late end ──
	if (ctx.travelPolicy?.enableTravelWellbeingChecks) {
		const tp = ctx.travelPolicy;

		// Group entries by faculty+day, sorted by startTime
		const byFacDayWB = new Map<string, ScheduledEntry[]>();
		for (const e of ctx.entries) {
			const key = `${e.facultyId}:${e.day}`;
			const arr = byFacDayWB.get(key) ?? [];
			arr.push(e);
			byFacDayWB.set(key, arr);
		}

		for (const [key, dayEntries] of byFacDayWB) {
			const [facIdStr, day] = key.split(':');
			const facultyId = Number(facIdStr);
			const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

			// 8a) Excessive idle gap: sum of gaps between consecutive classes
			let totalIdleMinutes = 0;
			for (let i = 1; i < sorted.length; i++) {
				const gap = timeToMinutes(sorted[i].startTime) - timeToMinutes(sorted[i - 1].endTime);
				if (gap > 0) totalIdleMinutes += gap;
			}
			if (totalIdleMinutes > tp.maxIdleGapMinutesPerDay) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'FACULTY_EXCESSIVE_IDLE_GAP',
					message: `Faculty ${facultyId} has ${totalIdleMinutes} min idle gaps on ${day}, exceeds limit of ${tp.maxIdleGapMinutesPerDay} min.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: {
						facultyId, day,
						totalIdleMinutes,
						configuredThresholds: { maxIdleGapMinutesPerDay: tp.maxIdleGapMinutesPerDay },
					},
				});
			}

			// 8b) Early start preference
			if (tp.avoidEarlyFirstPeriod && sorted.length > 0) {
				const firstStart = sorted[0].startTime;
				const policyRef = ctx.policy;
				const earliest = policyRef?.earliestStartTime ?? '07:00';
				// "Early" = scheduled in first period slot (within 15 min of earliest)
				if (timeToMinutes(firstStart) <= timeToMinutes(earliest) + 15) {
					violations.push({
						...base, severity: 'SOFT',
						code: 'FACULTY_EARLY_START_PREFERENCE',
						message: `Faculty ${facultyId} has a class starting at ${firstStart} on ${day} (early first period).`,
						entities: { facultyId, day, entryIds: [sorted[0].entryId] },
						meta: { facultyId, day, startTime: firstStart, earliestStartTime: earliest },
					});
				}
			}

			// 8c) Late end preference
			if (tp.avoidLateLastPeriod && sorted.length > 0) {
				const lastEnd = sorted[sorted.length - 1].endTime;
				const policyRef = ctx.policy;
				const latest = policyRef?.latestEndTime ?? '17:00';
				// "Late" = class ending within 15 min of latest end time
				if (timeToMinutes(lastEnd) >= timeToMinutes(latest) - 15) {
					violations.push({
						...base, severity: 'SOFT',
						code: 'FACULTY_LATE_END_PREFERENCE',
						message: `Faculty ${facultyId} has a class ending at ${lastEnd} on ${day} (late last period).`,
						entities: { facultyId, day, entryIds: [sorted[sorted.length - 1].entryId] },
						meta: { facultyId, day, endTime: lastEnd, latestEndTime: latest },
					});
				}
			}
		}
	}

	// ── 9) Vacant-aware constraints ──
	if (ctx.vacantPolicy?.enableVacantAwareConstraints) {
		const vp = ctx.vacantPolicy;

		// 9a) Faculty insufficient daily vacant time
		// For each faculty per day, compute total time span minus teaching minutes = vacant minutes
		const facDayForVacant = new Map<string, ScheduledEntry[]>();
		for (const e of ctx.entries) {
			const key = `${e.facultyId}:${e.day}`;
			const arr = facDayForVacant.get(key) ?? [];
			arr.push(e);
			facDayForVacant.set(key, arr);
		}

		for (const [key, dayEntries] of facDayForVacant) {
			const [facIdStr, day] = key.split(':');
			const facultyId = Number(facIdStr);
			const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

			const firstStart = timeToMinutes(sorted[0].startTime);
			const lastEnd = timeToMinutes(sorted[sorted.length - 1].endTime);
			const spanMinutes = lastEnd - firstStart;
			const teachingMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
			const vacantMinutes = spanMinutes - teachingMinutes;

			if (vacantMinutes < vp.targetFacultyDailyVacantMinutes) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'FACULTY_INSUFFICIENT_DAILY_VACANT',
					message: `Faculty ${facultyId} has only ${vacantMinutes} min vacant time on ${day}, target is ${vp.targetFacultyDailyVacantMinutes} min.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: {
						facultyId, day,
						vacantMinutes,
						targetVacantMinutes: vp.targetFacultyDailyVacantMinutes,
						teachingMinutes, spanMinutes,
					},
				});
			}
		}

		// 9b) Section overcompressed — section has too many teaching minutes in a single day
		const secDayForVacant = new Map<string, ScheduledEntry[]>();
		for (const e of ctx.entries) {
			for (const sectionId of getEffectiveSectionIds(e)) {
				const key = `${sectionId}:${e.day}`;
				const arr = secDayForVacant.get(key) ?? [];
				arr.push({ ...e, sectionId });
				secDayForVacant.set(key, arr);
			}
		}

		for (const [key, dayEntries] of secDayForVacant) {
			const [secIdStr, day] = key.split(':');
			const sectionId = Number(secIdStr);
			const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

			// Check vacancy periods — count gaps >= minBreak that qualify as vacant periods
			const minBreak = ctx.policy?.minBreakMinutesAfterConsecutiveBlock ?? 15;
			let vacantPeriods = 0;
			for (let i = 1; i < sorted.length; i++) {
				const gap = timeToMinutes(sorted[i].startTime) - timeToMinutes(sorted[i - 1].endTime);
				if (gap >= minBreak) vacantPeriods++;
			}

			if (vacantPeriods < vp.targetSectionDailyVacantPeriods) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'SECTION_OVERCOMPRESSED',
					message: `Section ${sectionId} has only ${vacantPeriods} vacant period(s) on ${day}, target is ${vp.targetSectionDailyVacantPeriods}.`,
					entities: { sectionId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: {
						sectionId, day,
						vacantPeriods,
						targetVacantPeriods: vp.targetSectionDailyVacantPeriods,
					},
				});
			}

			// Also check day-level compressed teaching minutes for section
			const sectionDailyMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
			if (sectionDailyMinutes > vp.maxCompressedTeachingMinutesPerDay) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'SECTION_OVERCOMPRESSED',
					message: `Section ${sectionId} has ${sectionDailyMinutes} teaching min on ${day}, exceeds compressed limit of ${vp.maxCompressedTeachingMinutesPerDay} min.`,
					entities: { sectionId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: {
						sectionId, day,
						sectionDailyMinutes,
						maxCompressedMinutes: vp.maxCompressedTeachingMinutesPerDay,
					},
				});
			}
		}
	}

	// ── 10) Apply constraintConfig overrides ──
	// Filter out disabled soft constraints and promote treatAsHard; inject weight into meta.
	const cc = ctx.constraintConfig;
	let finalViolations = violations;
	if (cc) {
		finalViolations = [];
		for (const v of violations) {
			const override = cc[v.code];
			if (!override) {
				// No override for this code — keep as-is (hard constraints, etc.)
				finalViolations.push(v);
				continue;
			}
			// If override disables this constraint and the violation is SOFT, drop it
			if (!override.enabled && v.severity === 'SOFT') continue;
			// Promote to HARD if treatAsHard and currently SOFT
			const severity = (override.treatAsHard && v.severity === 'SOFT') ? 'HARD' as const : v.severity;
			finalViolations.push({
				...v,
				severity,
				meta: { ...v.meta, constraintWeight: override.weight },
			});
		}
	}

	// ── Aggregate counts ──
	const byCode = {} as Record<ViolationCode, number>;
	for (const code of VIOLATION_CODES) byCode[code] = 0;
	for (const v of finalViolations) {
		byCode[v.code]++;
	}

	return {
		violations: finalViolations,
		counts: { total: finalViolations.length, byCode },
	};
}
