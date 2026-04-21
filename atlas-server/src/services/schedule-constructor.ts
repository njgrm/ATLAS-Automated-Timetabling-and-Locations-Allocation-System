/**
 * Deterministic baseline schedule constructor.
 * Produces ScheduledEntry[] from setup data using a greedy single-pass algorithm.
 *
 * Determinism rules:
 *  - Grades sorted by ascending displayOrder (7, 8, 9, 10)
 *  - Sections sorted by ascending id within each grade
 *  - Subjects sorted by ascending id within each section
 *  - Faculty candidates sorted by ascending facultyId
 *  - Slot candidates sorted by preference score → day index → period index
 *  - Room candidates sorted by ascending room id
 *  - No randomness; identical inputs → identical output
 *
 * Assignment policy (baseline):
 *  - For each section-subject pair, compute sessions per week
 *  - Pick first qualified faculty with available load
 *  - Pick best available timeslot (prefer faculty PREFERRED slots, spread across days)
 *  - Pick first compatible room available at that slot
 *  - If no valid candidate exists, count as unassigned (never fabricate invalid data)
 */

import type { ScheduledEntry } from './constraint-validator.js';
import type { SectionsByGrade } from './section-adapter.js';
import type { RoomType } from '@prisma/client';

// ─── Standard time grid (JHS 8-period day) ───

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/** Default period slots — used when no policy lunch window override is provided. */
const DEFAULT_PERIOD_SLOTS = [
	{ startTime: '07:30', endTime: '08:20' },
	{ startTime: '08:20', endTime: '09:10' },
	{ startTime: '09:10', endTime: '10:00' },
	{ startTime: '10:00', endTime: '10:50' },
	{ startTime: '10:50', endTime: '11:40' },
	{ startTime: '11:40', endTime: '12:30' },
	{ startTime: '12:30', endTime: '13:20' },
	{ startTime: '13:20', endTime: '14:10' },
	{ startTime: '14:10', endTime: '15:00' },
	{ startTime: '15:00', endTime: '15:50' },
] as const;

const STANDARD_PERIOD_MINUTES = 50;

// ─── Input types ───

export interface SubjectInput {
	id: number;
	code: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	sessionPattern: 'MWF' | 'TTH' | 'ANY';
	gradeLevels: number[];
	interSectionEnabled?: boolean;
	interSectionGradeLevels?: number[];
}

export interface InstructionalCohortInput {
	cohortCode: string;
	specializationCode: string;
	specializationName: string;
	gradeLevel: number;
	memberSectionIds: number[];
	expectedEnrollment: number;
	preferredRoomType?: RoomType | null;
}

export interface FacultyInput {
	id: number;
	maxHoursPerWeek: number;
}

export interface FacultySubjectInput {
	facultyId: number;
	subjectId: number;
	gradeLevels: number[];
	sectionIds: number[];
}

export interface RoomInput {
	id: number;
	type: RoomType;
	isTeachingSpace: boolean;
	capacity: number | null;
}

export interface PreferenceSlotInput {
	day: string;
	startTime: string;
	endTime: string;
	preference: string;
}

export interface FacultyPreferenceInput {
	facultyId: number;
	status: string;
	timeSlots: PreferenceSlotInput[];
}

export interface PolicyInput {
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	lunchStartTime?: string;
	lunchEndTime?: string;
	enforceLunchWindow?: boolean;
	enableTleTwoPassPriority?: boolean;
	allowFlexibleSubjectAssignment?: boolean;
	allowConsecutiveLabSessions?: boolean;
}

type PeriodSlot = { startTime: string; endTime: string };

/**
 * Build period slots dynamically from policy bounds and optional lunch window.
 * Generates consecutive 50-minute periods between earliest and latest times,
 * excluding any slot that overlaps the lunch window.
 */
function buildPeriodSlots(policy?: PolicyInput): PeriodSlot[] {
	if (!policy) return [...DEFAULT_PERIOD_SLOTS];

	const earliest = timeToMinutes(policy.earliestStartTime);
	const latest = timeToMinutes(policy.latestEndTime);
	const lunchEnforced = policy.enforceLunchWindow !== false;
	const lunchStart = lunchEnforced && policy.lunchStartTime ? timeToMinutes(policy.lunchStartTime) : -1;
	const lunchEnd = lunchEnforced && policy.lunchEndTime ? timeToMinutes(policy.lunchEndTime) : -1;

	const slots: PeriodSlot[] = [];
	let cursor = earliest;

	while (cursor + STANDARD_PERIOD_MINUTES <= latest) {
		const slotEnd = cursor + STANDARD_PERIOD_MINUTES;

		// Skip slots that overlap lunch window
		if (lunchStart >= 0 && cursor < lunchEnd && slotEnd > lunchStart) {
			// Jump cursor past lunch window
			cursor = lunchEnd;
			continue;
		}

		const hh = (min: number) => String(Math.floor(min / 60)).padStart(2, '0');
		const mm = (min: number) => String(min % 60).padStart(2, '0');
		slots.push({
			startTime: `${hh(cursor)}:${mm(cursor)}`,
			endTime: `${hh(slotEnd)}:${mm(slotEnd)}`,
		});

		cursor = slotEnd;
	}

	return slots;
}

/** Exported for use by room-schedule service and other consumers. */
export { buildPeriodSlots, type PeriodSlot };

export interface ConstructorInput {
	schoolId: number;
	schoolYearId: number;
	sectionsByGrade: SectionsByGrade[];
	subjects: SubjectInput[];
	cohorts?: InstructionalCohortInput[];
	faculty: FacultyInput[];
	facultySubjects: FacultySubjectInput[];
	rooms: RoomInput[];
	preferences: FacultyPreferenceInput[];
	policy?: PolicyInput;
	lockedEntries?: LockedEntryInput[];
	gradeWindows?: GradeWindowInput[];
}

export interface LockedEntryInput {
	sectionId: number;
	subjectId: number;
	facultyId?: number | null;
	roomId?: number | null;
	day: string;
	startTime: string;
	endTime: string;
}

export interface GradeWindowInput {
	gradeLevel: number;
	startTime: string;
	endTime: string;
}

export interface UnassignedItem {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM';
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

export interface ConstructorResult {
	entries: ScheduledEntry[];
	unassignedItems: UnassignedItem[];
	lockWarnings: string[];
	assignedCount: number;
	unassignedCount: number;
	classesProcessed: number;
	policyBlockedCount: number;
}

// ─── Demand computation ───

interface DemandItem {
	sectionId: number;
	subjectId: number;
	subjectCode: string;
	gradeLevel: number;
	sessionsPerWeek: number;
	durationPerSession: number;
	enrolledCount: number;
	sessionPattern: 'MWF' | 'TTH' | 'ANY';
	entryKind: 'SECTION' | 'COHORT';
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	cohortMemberSectionIds?: number[];
	roomTypePreference?: RoomType;
	adviserId?: number | null;
	adviserName?: string | null;
}

function computeDemand(
	sectionsByGrade: SectionsByGrade[],
	subjects: SubjectInput[],
	cohorts: InstructionalCohortInput[] = [],
): DemandItem[] {
	const demand: DemandItem[] = [];
	const sortedGrades = [...sectionsByGrade].sort((a, b) => a.displayOrder - b.displayOrder);
	const sortedSubjects = [...subjects].sort((a, b) => a.id - b.id);
	const activeCohorts = [...cohorts]
		.filter((cohort) => cohort.memberSectionIds.length > 0)
		.sort((left, right) => left.gradeLevel - right.gradeLevel || left.cohortCode.localeCompare(right.cohortCode));

	for (const grade of sortedGrades) {
		const gradeNum = grade.displayOrder;
		const sortedSections = [...grade.sections].sort((a, b) => a.id - b.id);
		const sectionsById = new Map(sortedSections.map((section) => [section.id, section]));
		const cohortsForGrade = activeCohorts.filter((cohort) => cohort.gradeLevel === gradeNum);

		for (const subject of sortedSubjects) {
			if (!subject.gradeLevels.includes(gradeNum)) continue;

			const sessions = Math.ceil(subject.minMinutesPerWeek / STANDARD_PERIOD_MINUTES);
			const duration = Math.ceil(subject.minMinutesPerWeek / sessions);
			const usesCohorts = subject.interSectionEnabled === true
				&& (subject.interSectionGradeLevels?.length ? subject.interSectionGradeLevels.includes(gradeNum) : true)
				&& cohortsForGrade.length > 0;

			if (usesCohorts) {
				const cohortSectionIds = new Set<number>();
				for (const cohort of cohortsForGrade) {
					const memberSections = cohort.memberSectionIds
						.map((memberSectionId) => sectionsById.get(memberSectionId))
						.filter((memberSection): memberSection is SectionsByGrade['sections'][number] => memberSection != null);
					if (memberSections.length === 0) continue;

					for (const memberSection of memberSections) {
						cohortSectionIds.add(memberSection.id);
					}

					const anchorSection = memberSections[0];
					demand.push({
						sectionId: anchorSection.id,
						subjectId: subject.id,
						subjectCode: subject.code,
						gradeLevel: gradeNum,
						sessionsPerWeek: sessions,
						durationPerSession: duration,
						enrolledCount: cohort.expectedEnrollment > 0
							? cohort.expectedEnrollment
							: memberSections.reduce((total, memberSection) => total + memberSection.enrolledCount, 0),
						sessionPattern: subject.sessionPattern ?? 'ANY',
						entryKind: 'COHORT',
						programType: anchorSection.programType ?? null,
						programCode: anchorSection.programCode ?? null,
						programName: anchorSection.programName ?? null,
						cohortCode: cohort.cohortCode,
						cohortName: cohort.specializationName,
						cohortMemberSectionIds: memberSections.map((memberSection) => memberSection.id),
						roomTypePreference: cohort.preferredRoomType ?? subject.preferredRoomType,
						adviserId: null,
						adviserName: null,
					});
				}

				for (const section of sortedSections) {
					if (cohortSectionIds.has(section.id)) continue;
					demand.push({
						sectionId: section.id,
						subjectId: subject.id,
						subjectCode: subject.code,
						gradeLevel: gradeNum,
						sessionsPerWeek: sessions,
						durationPerSession: duration,
						enrolledCount: section.enrolledCount,
						sessionPattern: subject.sessionPattern ?? 'ANY',
						entryKind: 'SECTION',
						programType: section.programType ?? null,
						programCode: section.programCode ?? null,
						programName: section.programName ?? null,
						roomTypePreference: subject.preferredRoomType,
						adviserId: section.adviserId ?? null,
						adviserName: section.adviserName ?? null,
					});
				}
				continue;
			}

			for (const section of sortedSections) {
				demand.push({
					sectionId: section.id,
					subjectId: subject.id,
					subjectCode: subject.code,
					gradeLevel: gradeNum,
					sessionsPerWeek: sessions,
					durationPerSession: duration,
					enrolledCount: section.enrolledCount,
					sessionPattern: subject.sessionPattern ?? 'ANY',
					entryKind: 'SECTION',
					programType: section.programType ?? null,
					programCode: section.programCode ?? null,
					programName: section.programName ?? null,
					roomTypePreference: subject.preferredRoomType,
					adviserId: section.adviserId ?? null,
					adviserName: section.adviserName ?? null,
				});
			}
		}
	}

	return demand;
}

function getDemandSectionIds(item: DemandItem): number[] {
	if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds && item.cohortMemberSectionIds.length > 0) {
		return item.cohortMemberSectionIds;
	}
	return [item.sectionId];
}

function getDemandAssignmentKey(item: DemandItem): string {
	if (item.entryKind === 'COHORT' && item.cohortCode) {
		return `${item.cohortCode}:${item.subjectId}`;
	}
	return `${item.sectionId}:${item.subjectId}`;
}

// ─── Occupancy tracker ───

class OccupancyTracker {
	private occupied = new Set<string>();

	isOccupied(entityId: number, day: string, periodIdx: number): boolean {
		return this.occupied.has(`${entityId}:${day}:${periodIdx}`);
	}

	mark(entityId: number, day: string, periodIdx: number): void {
		this.occupied.add(`${entityId}:${day}:${periodIdx}`);
	}
}

// ─── Preference lookup ───

function buildPreferenceLookup(preferences: FacultyPreferenceInput[], periodSlots: PeriodSlot[]): Map<number, Map<string, string>> {
	const lookup = new Map<number, Map<string, string>>();

	// Group by faculty — prefer SUBMITTED over DRAFT
	const byFaculty = new Map<number, FacultyPreferenceInput>();
	for (const pref of preferences) {
		const existing = byFaculty.get(pref.facultyId);
		if (!existing || (pref.status === 'SUBMITTED' && existing.status !== 'SUBMITTED')) {
			byFaculty.set(pref.facultyId, pref);
		}
	}

	for (const [facultyId, pref] of byFaculty) {
		const slotMap = new Map<string, string>();

		for (const ts of pref.timeSlots) {
			for (let pi = 0; pi < periodSlots.length; pi++) {
				const period = periodSlots[pi];
				// Check if preference slot overlaps this standard period
				if (ts.startTime < period.endTime && period.startTime < ts.endTime) {
					const key = `${ts.day}:${pi}`;
					const existing = slotMap.get(key);
					// UNAVAILABLE is most restrictive — always wins
					if (!existing || ts.preference === 'UNAVAILABLE') {
						slotMap.set(key, ts.preference);
					}
				}
			}
		}

		lookup.set(facultyId, slotMap);
	}

	return lookup;
}

// ─── Time helper ───

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

// ─── Main constructor ───

export function constructBaseline(input: ConstructorInput): ConstructorResult {
	const { subjects, faculty, facultySubjects, rooms, preferences, sectionsByGrade, policy, lockedEntries, gradeWindows } = input;

	// Build period slots dynamically from policy (lunch window, school day bounds)
	const PERIOD_SLOTS = buildPeriodSlots(policy);

	const demand = computeDemand(sectionsByGrade, subjects, input.cohorts ?? []);

	// Teaching rooms sorted by id, grouped by type
	const teachingRooms = rooms.filter((r) => r.isTeachingSpace).sort((a, b) => a.id - b.id);
	const roomsByType = new Map<string, RoomInput[]>();
	for (const r of teachingRooms) {
		const arr = roomsByType.get(r.type) ?? [];
		arr.push(r);
		roomsByType.set(r.type, arr);
	}

	const subjectMap = new Map(subjects.map((s) => [s.id, s]));

	// Qualified faculty index: "subjectId:sectionId" → sorted [facultyId, ...]
	const qualifiedMap = new Map<string, number[]>();
	const sortedFS = [...facultySubjects].sort((a, b) => a.facultyId - b.facultyId);
	for (const fs of sortedFS) {
		for (const sectionId of fs.sectionIds) {
			const key = `${fs.subjectId}:${sectionId}`;
			const arr = qualifiedMap.get(key) ?? [];
			arr.push(fs.facultyId);
			qualifiedMap.set(key, arr);
		}
	}

	function intersectCandidateLists(candidateLists: number[][]): number[] {
		if (candidateLists.length === 0) return [];
		let intersection = [...candidateLists[0]];
		for (let index = 1; index < candidateLists.length; index++) {
			const candidateSet = new Set(candidateLists[index]);
			intersection = intersection.filter((facultyId) => candidateSet.has(facultyId));
			if (intersection.length === 0) return [];
		}
		return intersection.sort((left, right) => left - right);
	}

	function getQualifiedFacultyIds(item: DemandItem): number[] {
		if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds && item.cohortMemberSectionIds.length > 0) {
			const candidateLists = item.cohortMemberSectionIds.map(
				(sectionId) => qualifiedMap.get(`${item.subjectId}:${sectionId}`) ?? [],
			);
			if (candidateLists.some((candidateList) => candidateList.length === 0)) {
				return [];
			}
			return intersectCandidateLists(candidateLists);
		}

		return [...(qualifiedMap.get(`${item.subjectId}:${item.sectionId}`) ?? [])].sort((left, right) => left - right);
	}

	// Preference lookup
	const prefLookup = buildPreferenceLookup(preferences, PERIOD_SLOTS);

	// Occupancy trackers
	const facultyOcc = new OccupancyTracker();
	const roomOcc = new OccupancyTracker();
	const sectionOcc = new OccupancyTracker();

	// Faculty load (total assigned minutes)
	const facultyLoad = new Map<number, number>();
	const facultyMax = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek * 60]));

	const entries: ScheduledEntry[] = [];
	const unassignedItems: UnassignedItem[] = [];
	const lockWarnings: string[] = [];
	let assignedCount = 0;
	let unassignedCount = 0;
	let policyBlockedCount = 0;
	let entryCounter = 0;

	// Faculty daily teaching minutes tracker: "facultyId:day" → total minutes
	const facultyDailyMinutes = new Map<string, number>();
	// Faculty day placement tracker for consecutive check: "facultyId:day" → sorted period indices
	const facultyDayPeriods = new Map<string, number[]>();

	// ─── Pre-place locked entries ───
	// "sectionId:subjectId" → count of sessions already fulfilled by locks
	const lockSessionCounts = new Map<string, number>();

	if (lockedEntries && lockedEntries.length > 0) {
		for (const lock of lockedEntries) {
			const pi = PERIOD_SLOTS.findIndex(
				(s) => s.startTime === lock.startTime && s.endTime === lock.endTime,
			);
			if (pi < 0) {
				lockWarnings.push(`Lock for section ${lock.sectionId}, subject ${lock.subjectId} at ${lock.day} ${lock.startTime}-${lock.endTime} does not match any canonical period slot and was skipped.`);
				continue;
			}

			if (!lock.facultyId || lock.facultyId < 1) {
				lockWarnings.push(`Lock for section ${lock.sectionId}, subject ${lock.subjectId} at ${lock.day} ${lock.startTime}-${lock.endTime} has no valid facultyId and was skipped.`);
				continue;
			}
			if (!lock.roomId || lock.roomId < 1) {
				lockWarnings.push(`Lock for section ${lock.sectionId}, subject ${lock.subjectId} at ${lock.day} ${lock.startTime}-${lock.endTime} has no valid roomId and was skipped.`);
				continue;
			}

			entryCounter++;
			const period = PERIOD_SLOTS[pi];
			const durationMinutes = timeToMinutes(period.endTime) - timeToMinutes(period.startTime);

			entries.push({
				entryId: `entry-${entryCounter}`,
				facultyId: lock.facultyId,
				roomId: lock.roomId,
				subjectId: lock.subjectId,
				sectionId: lock.sectionId,
				day: lock.day,
				startTime: period.startTime,
				endTime: period.endTime,
				durationMinutes,
			});

			// Mark occupancy for locked placements
			sectionOcc.mark(lock.sectionId, lock.day, pi);
			facultyOcc.mark(lock.facultyId, lock.day, pi);
			facultyLoad.set(lock.facultyId, (facultyLoad.get(lock.facultyId) ?? 0) + durationMinutes);
			const dailyKey = `${lock.facultyId}:${lock.day}`;
			facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + durationMinutes);
			const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
			dayPeriods.push(pi);
			facultyDayPeriods.set(dailyKey, dayPeriods);
			roomOcc.mark(lock.roomId, lock.day, pi);

			assignedCount++;

			// Track lock session counts
			const lockKey = `${lock.sectionId}:${lock.subjectId}`;
			lockSessionCounts.set(lockKey, (lockSessionCounts.get(lockKey) ?? 0) + 1);
		}
	}

	// ─── Grade window lookup ───
	// gradeLevel → { startMin, endMin }
	const gradeWindowMap = new Map<number, { startMin: number; endMin: number }>();
	if (gradeWindows && gradeWindows.length > 0) {
		for (const gw of gradeWindows) {
			gradeWindowMap.set(gw.gradeLevel, {
				startMin: timeToMinutes(gw.startTime),
				endMin: timeToMinutes(gw.endTime),
			});
		}
	}

	// Pre-filter valid period indices by policy time bounds
	let validPeriodIndices: number[] | null = null;
	if (policy) {
		const earliestMin = timeToMinutes(policy.earliestStartTime);
		const latestMin = timeToMinutes(policy.latestEndTime);
		validPeriodIndices = [];
		for (let pi = 0; pi < PERIOD_SLOTS.length; pi++) {
			const slot = PERIOD_SLOTS[pi];
			if (timeToMinutes(slot.startTime) >= earliestMin && timeToMinutes(slot.endTime) <= latestMin) {
				validPeriodIndices.push(pi);
			}
		}
	}

	/**
	 * Check if placing a class at periodIdx for faculty on a given day
	 * would exceed the consecutive teaching limit (without required break).
	 */
	function wouldExceedConsecutive(facId: number, day: string, periodIdx: number, duration: number): boolean {
		if (!policy) return false;

		const dayKey = `${facId}:${day}`;
		const existing = facultyDayPeriods.get(dayKey) ?? [];
		const allPeriods = [...existing, periodIdx].sort((a, b) => a - b);

		// Walk periods and compute consecutive blocks
		let consecutive = 0;
		for (let i = 0; i < allPeriods.length; i++) {
			const pi = allPeriods[i];
			const slotDuration = (pi === periodIdx) ? duration : STANDARD_PERIOD_MINUTES;

			if (i === 0) {
				consecutive = slotDuration;
				continue;
			}

			const prevPi = allPeriods[i - 1];
			const prevEnd = PERIOD_SLOTS[prevPi].endTime;
			const currStart = PERIOD_SLOTS[pi].startTime;
			const gapMinutes = timeToMinutes(currStart) - timeToMinutes(prevEnd);

			if (gapMinutes < policy.minBreakMinutesAfterConsecutiveBlock) {
				consecutive += slotDuration;
			} else {
				consecutive = slotDuration;
			}

			if (consecutive > policy.maxConsecutiveTeachingMinutesBeforeBreak) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if placing a lab/workshop session at periodIdx for a section on a given day
	 * would create consecutive lab sessions (when policy disallows it).
	 */
	function wouldCreateConsecutiveLab(sectionId: number, day: string, periodIdx: number, roomType: string): boolean {
		if (allowConsecutiveLab) return false;
		if (!LAB_ROOM_TYPES.has(roomType)) return false;

		const dayKey = `${sectionId}:${day}`;
		const existing = sectionDayLabPeriods.get(dayKey) ?? [];

		// Check if any existing lab period is adjacent to this one
		for (const pi of existing) {
			if (Math.abs(pi - periodIdx) === 1) return true;
		}
		return false;
	}

	// ─── Two-pass TLE priority scheduling ───
	// When enabled, schedule TLE subjects first (Bucket A), then everything else (Bucket B)
	const enableTwoPass = policy?.enableTleTwoPassPriority !== false;
	let orderedDemand: DemandItem[];

	if (enableTwoPass) {
		const tleDemand = demand.filter((d) => d.subjectCode === 'TLE');
		const otherDemand = demand.filter((d) => d.subjectCode !== 'TLE');
		orderedDemand = [...tleDemand, ...otherDemand];
	} else {
		orderedDemand = demand;
	}

	const allowFlexible = policy?.allowFlexibleSubjectAssignment === true;
	const allowConsecutiveLab = policy?.allowConsecutiveLabSessions === true;
	const allFacultyIds = faculty.map((f) => f.id).sort((a, b) => a - b);

	// Session pattern → allowed day sets
	const SESSION_PATTERN_DAYS: Record<string, Set<string>> = {
		MWF: new Set(['MONDAY', 'WEDNESDAY', 'FRIDAY']),
		TTH: new Set(['TUESDAY', 'THURSDAY']),
		ANY: new Set(DAYS),
	};

	// Lab-like room types for consecutive lab check
	const LAB_ROOM_TYPES: Set<string> = new Set(['LABORATORY', 'TLE_WORKSHOP', 'COMPUTER_LAB']);

	// Section-day placement tracker for consecutive lab check: "sectionId:day" → array of {periodIdx, isLab}
	const sectionDayLabPeriods = new Map<string, number[]>();

	for (const item of orderedDemand) {
		const subject = subjectMap.get(item.subjectId);
		if (!subject) {
			for (let s = 0; s < item.sessionsPerWeek; s++) {
				unassignedItems.push({
					sectionId: item.sectionId,
					subjectId: item.subjectId,
					gradeLevel: item.gradeLevel,
					session: s + 1,
					reason: 'NO_QUALIFIED_FACULTY',
					entryKind: item.entryKind,
					programType: item.programType ?? null,
					programCode: item.programCode ?? null,
					programName: item.programName ?? null,
					cohortCode: item.cohortCode ?? null,
					cohortName: item.cohortName ?? null,
					cohortMemberSectionIds: item.cohortMemberSectionIds,
					cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
					adviserId: item.adviserId ?? null,
					adviserName: item.adviserName ?? null,
				});
			}
			unassignedCount += item.sessionsPerWeek;
			continue;
		}

		// Reduce sessions needed by already-placed locked entries
		const lockKey = getDemandAssignmentKey(item);
		const lockedSessions = lockSessionCounts.get(lockKey) ?? 0;
		const sessionsNeeded = Math.max(0, item.sessionsPerWeek - lockedSessions);

		// Grade window: narrow valid periods for this item's grade level
		let gradeValidPeriods = validPeriodIndices ?? Array.from({ length: PERIOD_SLOTS.length }, (_, i) => i);
		const gw = gradeWindowMap.get(item.gradeLevel);
		if (gw) {
			gradeValidPeriods = gradeValidPeriods.filter((pi) => {
				const slot = PERIOD_SLOTS[pi];
				return timeToMinutes(slot.startTime) >= gw.startMin && timeToMinutes(slot.endTime) <= gw.endMin;
			});
		}

		// Get qualified faculty; if none and flexible assignment is enabled, use all faculty
		let candidateFaculty = getQualifiedFacultyIds(item);
		if (candidateFaculty.length === 0 && allowFlexible) {
			candidateFaculty = allFacultyIds;
		}
		const compatibleRooms = roomsByType.get(item.roomTypePreference ?? subject.preferredRoomType) ?? [];

		// Track which days we already used for this section-subject pair (spread sessions across days)
		const daysUsedForPair = new Set<string>();

		for (let session = 0; session < sessionsNeeded; session++) {
			let placed = false;

			// Try each faculty candidate (sorted by id)
			for (const facId of candidateFaculty) {
				if (placed) break;

				// Check faculty load
				const currentLoad = facultyLoad.get(facId) ?? 0;
				const maxLoad = facultyMax.get(facId) ?? 0;
				if (currentLoad + item.durationPerSession > maxLoad) continue;

				// Get faculty preference map
				const facPrefs = prefLookup.get(facId);

				// Build slot candidates with deterministic scoring
				const candidates: { day: string; pi: number; score: number }[] = [];

				for (let di = 0; di < DAYS.length; di++) {
					const day = DAYS[di];

					// Session pattern: skip days not matching subject's preferred pattern
					const allowedDays = SESSION_PATTERN_DAYS[item.sessionPattern] ?? SESSION_PATTERN_DAYS.ANY;
					if (!allowedDays.has(day)) continue;

					// Policy: check daily max before considering this day
					if (policy) {
						const dailyKey = `${facId}:${day}`;
						const dailyUsed = facultyDailyMinutes.get(dailyKey) ?? 0;
						if (dailyUsed + item.durationPerSession > policy.maxTeachingMinutesPerDay) continue;
					}

					const periodsToCheck = gradeValidPeriods;

					for (const pi of periodsToCheck) {
						if (getDemandSectionIds(item).some((sectionId) => sectionOcc.isOccupied(sectionId, day, pi))) continue;
						if (facultyOcc.isOccupied(facId, day, pi)) continue;

						const prefKey = `${day}:${pi}`;
						const pref = facPrefs?.get(prefKey);
						if (pref === 'UNAVAILABLE') continue;

						// Policy: check consecutive teaching limit
						if (wouldExceedConsecutive(facId, day, pi, item.durationPerSession)) {
							policyBlockedCount++;
							continue;
						}

						// Score: PREFERRED=0, AVAILABLE/other=1, +10 if day already used for this pair
						let score = pref === 'PREFERRED' ? 0 : 1;
						if (daysUsedForPair.has(day)) score += 10;

						candidates.push({ day, pi, score });
					}
				}

				// Deterministic sort: score → day index → period index
				candidates.sort((a, b) => {
					if (a.score !== b.score) return a.score - b.score;
					const dayDiff = DAYS.indexOf(a.day as typeof DAYS[number]) - DAYS.indexOf(b.day as typeof DAYS[number]);
					if (dayDiff !== 0) return dayDiff;
					return a.pi - b.pi;
				});

				// Try each slot with compatible rooms
				for (const cand of candidates) {
					if (placed) break;
					for (const room of compatibleRooms) {
						if (roomOcc.isOccupied(room.id, cand.day, cand.pi)) continue;

						// Capacity check: skip room if section enrollment exceeds room capacity
						if (room.capacity != null && item.enrolledCount > room.capacity) continue;

						// Consecutive lab check: skip if would create adjacent lab sessions
						if (getDemandSectionIds(item).some((sectionId) => wouldCreateConsecutiveLab(sectionId, cand.day, cand.pi, room.type))) continue;

						// Place the entry
						entryCounter++;
						const period = PERIOD_SLOTS[cand.pi];
						entries.push({
							entryId: `entry-${entryCounter}`,
							facultyId: facId,
							roomId: room.id,
							subjectId: item.subjectId,
							sectionId: item.sectionId,
							day: cand.day,
							startTime: period.startTime,
							endTime: period.endTime,
							durationMinutes: item.durationPerSession,
							entryKind: item.entryKind,
							programType: item.programType ?? null,
							programCode: item.programCode ?? null,
							programName: item.programName ?? null,
							cohortCode: item.cohortCode ?? null,
							cohortName: item.cohortName ?? null,
							cohortMemberSectionIds: item.cohortMemberSectionIds,
							cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
							adviserId: item.adviserId ?? null,
							adviserName: item.adviserName ?? null,
						});

						// Mark occupancy
						facultyOcc.mark(facId, cand.day, cand.pi);
						roomOcc.mark(room.id, cand.day, cand.pi);
						for (const sectionId of getDemandSectionIds(item)) {
							sectionOcc.mark(sectionId, cand.day, cand.pi);
						}

						// Update load
						facultyLoad.set(facId, currentLoad + item.durationPerSession);

						// Track daily minutes and period indices for policy
						const dailyKey = `${facId}:${cand.day}`;
						facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + item.durationPerSession);
						const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
						dayPeriods.push(cand.pi);
						facultyDayPeriods.set(dailyKey, dayPeriods);

						daysUsedForPair.add(cand.day);
						placed = true;

						// Track lab periods for consecutive lab check
						if (LAB_ROOM_TYPES.has(room.type)) {
							for (const sectionId of getDemandSectionIds(item)) {
								const labKey = `${sectionId}:${cand.day}`;
								const labPeriods = sectionDayLabPeriods.get(labKey) ?? [];
								labPeriods.push(cand.pi);
								sectionDayLabPeriods.set(labKey, labPeriods);
							}
						}

						break;
					}
				}
			}

			if (placed) {
				assignedCount++;
			} else {
				// Determine the reason for failure
				let reason: UnassignedItem['reason'] = 'NO_AVAILABLE_SLOT';
				if (candidateFaculty.length === 0) {
					reason = 'NO_QUALIFIED_FACULTY';
				} else if (compatibleRooms.length === 0) {
					reason = 'NO_COMPATIBLE_ROOM';
				} else {
					// Check if all faculty were overloaded
					const allOverloaded = candidateFaculty.every((fid) => {
						const load = facultyLoad.get(fid) ?? 0;
						const max = facultyMax.get(fid) ?? 0;
						return load + item.durationPerSession > max;
					});
					if (allOverloaded) reason = 'FACULTY_OVERLOADED';
				}
				unassignedItems.push({
					sectionId: item.sectionId,
					subjectId: item.subjectId,
					gradeLevel: item.gradeLevel,
					session: session + 1,
					reason,
					entryKind: item.entryKind,
					programType: item.programType ?? null,
					programCode: item.programCode ?? null,
					programName: item.programName ?? null,
					cohortCode: item.cohortCode ?? null,
					cohortName: item.cohortName ?? null,
					cohortMemberSectionIds: item.cohortMemberSectionIds,
					cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
					adviserId: item.adviserId ?? null,
					adviserName: item.adviserName ?? null,
				});
				unassignedCount++;
			}
		}
	}

	return {
		entries,
		unassignedItems,
		lockWarnings,
		assignedCount,
		unassignedCount,
		classesProcessed: assignedCount + unassignedCount,
		policyBlockedCount,
	};
}
