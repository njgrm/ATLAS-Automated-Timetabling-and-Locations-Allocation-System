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
import { isSubjectAllowedForSectionProgram } from './subject-program-scope.service.js';
import {
	matchesSubjectOwnershipDepartment,
} from './subject-ownership.service.js';
import { resolvePolicyPlacementSemantics } from './scheduling-policy.service.js';
import { getEffectiveEvents, type SpecialEventRowLike } from '../lib/policy-special-events.js';

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

const STANDARD_PERIOD_MINUTES = 45;

// ─── Input types ───

export interface SubjectInput {
	id: number;
	code: string;
	name?: string;
	minMinutesPerWeek: number;
	preferredRoomType: RoomType;
	gradeLevels: number[];
	interSectionEnabled?: boolean;
	interSectionGradeLevels?: number[];
	/** Stored program scopes from DB — used for data-driven filtering */
	programScopes?: string[];
	allowedSpecializations?: string[];
	modularGroupId?: string | null;
	modularOrder?: number | null;
	requiredFeatures?: string[];
	ownerDepartment?: string | null;
	qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
}

function normalizeSpecializationCode(value?: string | null): string {
	return (value ?? '').trim().toUpperCase();
}

function normalizeGradeLevel(value: number): number {
	if (!Number.isFinite(value)) return value;

	// If it's already a valid actual grade number (7-10), return as-is
	if (value >= 7 && value <= 10) return value;

	// EnrollPro internal grade_level_id -> actual grade number mapping
	// Historical IDs 5-8 and current feed IDs 17-20 map to Grades 7-10.
	const ENROLLPRO_MAPPINGS: Record<number, number> = {
		5: 7,
		6: 8,
		7: 9,
		8: 10,
		17: 7,
		18: 8,
		19: 9,
		20: 10,
	};

	if (value in ENROLLPRO_MAPPINGS) return ENROLLPRO_MAPPINGS[value];

	// If value >= 100, use modulo normalization
	if (value >= 100) {
		const normalized = value % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}

	return value;
}

function gradeLevelMatches(candidates: number[] | undefined, target: number): boolean {
	if (!Array.isArray(candidates) || candidates.length === 0) return false;
	const targetNormalized = normalizeGradeLevel(target);
	return candidates.some((candidate) => candidate === target || normalizeGradeLevel(candidate) === targetNormalized);
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
	department?: string | null;
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
	isSharedFacility?: boolean;
	capacity: number | null;
	buildingId?: number | null;
	buildingZoneId?: string | null;
	buildingGradeScope?: number[];
	features?: string[];
}

function intersectCandidateLists(candidateLists: number[][]): number[] {
	if (candidateLists.length === 0) return [];
	const [first, ...rest] = candidateLists;
	return first.filter((candidateId) => rest.every((list) => list.includes(candidateId)));
}

/** A room is grade-scope compatible if its building scope is empty (any grade) or includes the section grade. */
function isRoomGradeScopeCompatible(room: RoomInput, sectionGradeLevel: number): boolean {
	const scope = room.buildingGradeScope;
	if (!scope || scope.length === 0) return true;
	return scope.includes(sectionGradeLevel);
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
	periodLengthMinutes?: number;
	periodsPerDay?: number;
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard?: boolean;
	lunchStartTime?: string;
	lunchEndTime?: string;
	enforceLunchWindow?: boolean;
	enableLunchWindow?: boolean;
	showSpecialEventsInGrid?: boolean;
	enableFlagCeremony?: boolean;
	flagCeremonyStartTime?: string;
	flagCeremonyEndTime?: string;
	enableRecess?: boolean;
	recessStartTime?: string;
	recessEndTime?: string;
	enableTleTwoPassPriority?: boolean;
	allowFlexibleSubjectAssignment?: boolean;
	allowConsecutiveLabSessions?: boolean;
	specialEvents?: Array<{
		eventType: string;
		label: string;
		startTime: string;
		endTime: string;
		gradeGroup?: string | null;
		programType?: string | null;
	}>;
}

type PeriodSlot = { startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string };

/**
 * Build schedulable class period slots from policy bounds and lunch window.
 * Special event rows are built separately via buildSpecialEventSlots().
 */
function buildPeriodSlots(policy?: PolicyInput): PeriodSlot[] {
	let slots: PeriodSlot[] = [];
	
	if (!policy) {
		slots = [...DEFAULT_PERIOD_SLOTS];
	} else {
		const earliest = timeToMinutes(policy.earliestStartTime);
		const latest = timeToMinutes(policy.latestEndTime);
		const blockedWindows: Array<{ start: number; end: number }> = [];

		const hasShiftEvents = policy.specialEvents && policy.specialEvents.length > 0;

		if (hasShiftEvents) {
			// Use shift-specific events for blocked windows
			for (const evt of policy.specialEvents!) {
				blockedWindows.push({
					start: timeToMinutes(evt.startTime),
					end: timeToMinutes(evt.endTime),
				});
			}
		} else {
			// Fall back to global policy fields
			if (policy.enableFlagCeremony ?? true) {
				blockedWindows.push({
					start: timeToMinutes(policy.flagCeremonyStartTime ?? '07:00'),
					end: timeToMinutes(policy.flagCeremonyEndTime ?? '07:30'),
				});
			}

			if (policy.enableRecess ?? true) {
				blockedWindows.push({
					start: timeToMinutes(policy.recessStartTime ?? '09:45'),
					end: timeToMinutes(policy.recessEndTime ?? '10:00'),
				});
			}

			const lunchEnforced = policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true;
			if (lunchEnforced) {
				blockedWindows.push({
					start: timeToMinutes(policy.lunchStartTime ?? '11:55'),
					end: timeToMinutes(policy.lunchEndTime ?? '12:55'),
				});
			}
		}

		let cursor = earliest;
		const slotLength = policy.periodLengthMinutes && policy.periodLengthMinutes > 0
			? policy.periodLengthMinutes
			: STANDARD_PERIOD_MINUTES;
		const maxPeriods = policy.periodsPerDay && policy.periodsPerDay > 0
			? policy.periodsPerDay
			: Number.POSITIVE_INFINITY;
		let builtPeriods = 0;

		while (cursor + slotLength <= latest && builtPeriods < maxPeriods) {
			const slotEnd = cursor + slotLength;

			const overlappingWindow = blockedWindows
				.filter((window) => window.end > window.start)
				.find((window) => cursor < window.end && slotEnd > window.start);
			if (overlappingWindow) {
				cursor = Math.max(cursor + 1, overlappingWindow.end);
				continue;
			}

			const hh = (min: number) => String(Math.floor(min / 60)).padStart(2, '0');
			const mm = (min: number) => String(min % 60).padStart(2, '0');
			slots.push({
				startTime: `${hh(cursor)}:${mm(cursor)}`,
				endTime: `${hh(slotEnd)}:${mm(slotEnd)}`,
			});
			builtPeriods += 1;

			cursor = slotEnd;
		}
	}

	return slots;
}

function buildSpecialEventSlots(policy?: PolicyInput): PeriodSlot[] {
	if (!policy) {
		return [];
	}

	const events: PeriodSlot[] = [];

	const hasShiftEvents = policy.specialEvents && policy.specialEvents.length > 0;

	if (hasShiftEvents) {
		// Use shift-specific events directly
		for (const evt of policy.specialEvents!) {
			events.push({
				startTime: evt.startTime,
				endTime: evt.endTime,
				isSpecialEvent: true,
				eventName: evt.label,
			});
		}
	} else {
		// Fall back to global policy fields
		if (policy.enableFlagCeremony ?? true) {
			events.push({
				startTime: policy.flagCeremonyStartTime ?? '07:00',
				endTime: policy.flagCeremonyEndTime ?? '07:30',
				isSpecialEvent: true,
				eventName: 'FLAG CEREMONY',
			});
		}
		if (policy.enableRecess ?? true) {
			events.push({
				startTime: policy.recessStartTime ?? '09:45',
				endTime: policy.recessEndTime ?? '10:00',
				isSpecialEvent: true,
				eventName: 'RECESS',
			});
		}
		if (policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true) {
			events.push({
				startTime: policy.lunchStartTime ?? '11:55',
				endTime: policy.lunchEndTime ?? '12:55',
				isSpecialEvent: true,
				eventName: 'LUNCH BREAK',
			});
		}
	}

	return events.sort((left, right) => {
		const leftStart = timeToMinutes(left.startTime);
		const rightStart = timeToMinutes(right.startTime);
		if (leftStart !== rightStart) return leftStart - rightStart;
		return timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
	});
}

function mergeDisplaySlots(periodSlots: PeriodSlot[], specialEventSlots: PeriodSlot[]): PeriodSlot[] {
	return [...periodSlots, ...specialEventSlots].sort((left, right) => {
		const leftStart = timeToMinutes(left.startTime);
		const rightStart = timeToMinutes(right.startTime);
		if (leftStart !== rightStart) return leftStart - rightStart;
		return timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
	});
}

/** Exported for use by room-schedule service and other consumers. */
export { buildPeriodSlots, buildSpecialEventSlots, mergeDisplaySlots, type PeriodSlot };

export interface TimetableShapeContract {
	gradeLevel: number;
	programType: string;
	startTime: string;
	endTime: string;
	periodLengthMinutes: number;
	periodsPerDay: number;
	periodSlots: PeriodSlot[];
	displaySlots: PeriodSlot[];
	/** Canonical class-program slots for this grade/program (from stakeholder template) */
	canonicalSlots?: Array<{ startTime: string; endTime: string; subjectFamily: string | null; subjectLabel?: string | null; rowKind: string }>;
}

function normalizeProgramType(programType?: string | null): string {
	return (programType ?? 'REGULAR').toUpperCase();
}

export function buildTimetableShapeContract(input: {
	gradeLevel: number;
	programType?: string | null;
	startTime: string;
	endTime: string;
	periodLengthMinutes: number;
	periodsPerDay: number;
	basePolicy?: PolicyInput;
	canonicalSlots?: Array<{ startTime: string; endTime: string; subjectFamily: string | null; subjectLabel?: string | null; rowKind: string }>;
}): TimetableShapeContract {
	// Apply per-grade/program effective event resolution
	const effectiveSpecialEvents = getEffectiveEvents(
		(input.basePolicy?.specialEvents as SpecialEventRowLike[] | undefined) ?? [],
		input.gradeLevel,
		input.programType,
	);

	const policyForShape: PolicyInput = {
		maxConsecutiveTeachingMinutesBeforeBreak: input.basePolicy?.maxConsecutiveTeachingMinutesBeforeBreak ?? 180,
		minBreakMinutesAfterConsecutiveBlock: input.basePolicy?.minBreakMinutesAfterConsecutiveBlock ?? 20,
		maxTeachingMinutesPerDay: input.basePolicy?.maxTeachingMinutesPerDay ?? 420,
		earliestStartTime: input.startTime,
		latestEndTime: input.endTime,
		periodLengthMinutes: input.periodLengthMinutes,
		periodsPerDay: input.periodsPerDay,
		lunchStartTime: input.basePolicy?.lunchStartTime,
		lunchEndTime: input.basePolicy?.lunchEndTime,
		enableLunchWindow: input.basePolicy?.enableLunchWindow,
		enforceLunchWindow: input.basePolicy?.enforceLunchWindow,
		showSpecialEventsInGrid: input.basePolicy?.showSpecialEventsInGrid,
		enableFlagCeremony: input.basePolicy?.enableFlagCeremony,
		flagCeremonyStartTime: input.basePolicy?.flagCeremonyStartTime,
		flagCeremonyEndTime: input.basePolicy?.flagCeremonyEndTime,
		enableRecess: input.basePolicy?.enableRecess,
		recessStartTime: input.basePolicy?.recessStartTime,
		recessEndTime: input.basePolicy?.recessEndTime,
		enableTleTwoPassPriority: input.basePolicy?.enableTleTwoPassPriority,
		allowFlexibleSubjectAssignment: input.basePolicy?.allowFlexibleSubjectAssignment,
		allowConsecutiveLabSessions: input.basePolicy?.allowConsecutiveLabSessions,
		specialEvents: effectiveSpecialEvents,
	};
	const canonicalRows = [...(input.canonicalSlots ?? [])].sort((left, right) => {
		const startDiff = timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
		return startDiff !== 0 ? startDiff : timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
	});
	const canonicalClassRows = canonicalRows.filter((row) => row.rowKind === 'CLASS');
	const hasCanonicalRows = canonicalClassRows.length > 0;
	const periodSlots = hasCanonicalRows
		? canonicalClassRows.map((row) => ({ startTime: row.startTime, endTime: row.endTime }))
		: buildPeriodSlots(policyForShape);
	const specialEventSlots = hasCanonicalRows
		? canonicalRows
			.filter((row) => row.rowKind === 'BREAK' || row.rowKind === 'SPECIAL_EVENT')
			.map((row) => ({
				startTime: row.startTime,
				endTime: row.endTime,
				isSpecialEvent: true,
				eventName: row.subjectLabel ?? undefined,
			}))
		: buildSpecialEventSlots(policyForShape);
	const displaySlots = (policyForShape.showSpecialEventsInGrid ?? true)
		? mergeDisplaySlots(periodSlots, specialEventSlots)
		: periodSlots;
	const canonicalStartTime = canonicalRows[0]?.startTime ?? input.startTime;
	const canonicalEndTime = canonicalRows[canonicalRows.length - 1]?.endTime ?? input.endTime;

	return {
		gradeLevel: input.gradeLevel,
		programType: normalizeProgramType(input.programType),
		startTime: hasCanonicalRows ? canonicalStartTime : input.startTime,
		endTime: hasCanonicalRows ? canonicalEndTime : input.endTime,
		periodLengthMinutes: hasCanonicalRows ? 45 : input.periodLengthMinutes,
		periodsPerDay: hasCanonicalRows ? periodSlots.length : input.periodsPerDay,
		periodSlots,
		displaySlots,
		canonicalSlots: input.canonicalSlots,
	};
}

export function resolveTimetableShapeContract(
	contracts: TimetableShapeContract[] | undefined,
	gradeLevel: number,
	programType?: string | null,
): TimetableShapeContract | undefined {
	if (!contracts || contracts.length === 0) return undefined;
	const normalizedProgramType = normalizeProgramType(programType);
	const normalizedGradeLevel = normalizeGradeLevel(gradeLevel);

	// Try exact grade + program match first
	const exactMatch = contracts.find(
		(c) => normalizeGradeLevel(c.gradeLevel) === normalizedGradeLevel && c.programType === normalizedProgramType,
	);
	if (exactMatch) return exactMatch;

	// Try grade + REGULAR fallback (same grade only)
	const regularFallback = contracts.find(
		(c) => normalizeGradeLevel(c.gradeLevel) === normalizedGradeLevel && c.programType === 'REGULAR',
	);
	if (regularFallback) return regularFallback;

	// Try grade-only fallback (same grade only, any program)
	const gradeFallback = contracts.find(
		(c) => normalizeGradeLevel(c.gradeLevel) === normalizedGradeLevel,
	);
	if (gradeFallback) return gradeFallback;

	// NO FALLBACK across grade levels — return undefined
	return undefined;
}

export function buildUnionClassPeriodSlots(contracts: TimetableShapeContract[] | undefined): PeriodSlot[] {
	if (!contracts || contracts.length === 0) return [];
	const dedupe = new Map<string, PeriodSlot>();
	for (const contract of contracts) {
		for (const slot of contract.periodSlots) {
			const key = `${slot.startTime}-${slot.endTime}`;
			if (!dedupe.has(key)) dedupe.set(key, { startTime: slot.startTime, endTime: slot.endTime });
		}
	}
	return [...dedupe.values()].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * Get preferred class slots for a section based on canonical class-program template.
 * Returns canonical CLASS rows if available, otherwise returns the global period slots.
 * Break, special-event, and conflict rows are never included as candidate class slots.
 */
export function getPreferredSlotsForSection(
	contracts: TimetableShapeContract[] | undefined,
	gradeLevel: number,
	programType: string | null,
): PeriodSlot[] {
	if (!contracts || contracts.length === 0) return [];

	// Find the contract for this grade/program
	const normalizedGrade = normalizeGradeLevel(gradeLevel);
	const normalizedProgram = normalizeProgramType(programType);
	const contract = contracts.find(c =>
		normalizeGradeLevel(c.gradeLevel) === normalizedGrade
		&& c.programType === normalizedProgram
	) ?? contracts.find(c =>
		normalizeGradeLevel(c.gradeLevel) === normalizedGrade
		&& c.programType === 'REGULAR'
	) ?? contracts.find(c =>
		normalizeGradeLevel(c.gradeLevel) === normalizedGrade
	);

	if (!contract) {
		// Once canonical contracts are present, never borrow a different grade's
		// shape. Legacy callers with no canonical data retain global fallback.
		return contracts.some(c => (c.canonicalSlots?.length ?? 0) > 0)
			? []
			: buildUnionClassPeriodSlots(contracts);
	}

	if (!contract.canonicalSlots || contract.canonicalSlots.length === 0) {
		// No canonical slots — use global period slots
		return buildUnionClassPeriodSlots(contracts);
	}

	// Use only CLASS rows from canonical slots as candidate class slots
	const canonicalClassSlots = contract.canonicalSlots
		.filter(s => s.rowKind === 'CLASS')
		.map(s => ({ startTime: s.startTime, endTime: s.endTime }));

	if (canonicalClassSlots.length === 0) {
		// No CLASS rows in canonical template — fall back to global slots
		return buildUnionClassPeriodSlots(contracts);
	}

	return canonicalClassSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function buildUnionDisplaySlots(contracts: TimetableShapeContract[] | undefined): PeriodSlot[] {
	if (!contracts || contracts.length === 0) return [];
	const dedupe = new Map<string, PeriodSlot>();
	for (const contract of contracts) {
		for (const slot of contract.displaySlots) {
			const key = `${slot.startTime}-${slot.endTime}-${slot.eventName ?? ''}-${slot.isSpecialEvent ? '1' : '0'}`;
			if (!dedupe.has(key)) dedupe.set(key, {
				startTime: slot.startTime,
				endTime: slot.endTime,
				isSpecialEvent: slot.isSpecialEvent,
				eventName: slot.eventName,
			});
		}
	}
	return [...dedupe.values()].sort((a, b) => {
		const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
		if (startDiff !== 0) return startDiff;
		return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
	});
}

export interface ConstructorInput {
	schoolId: number;
	schoolYearId: number;
	roomingStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
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
	buildings?: Array<{ id: number; name: string }>;
	/**
	 * Per-program period length overrides from class templates.
	 * Key: program type (e.g. 'STE', 'SPA'). Value: period length in minutes.
	 * When provided, the constructor uses this length instead of STANDARD_PERIOD_MINUTES
	 * for sections of the matching program type.
	 */
	classTemplatePeriods?: Record<string, number>;
	timetableShapes?: TimetableShapeContract[];
	/**
	 * Optional demand override — bypasses computeDemand() to allow seed profile
	 * reordering in the hybrid multi-seed constructor (H-ALG-1).
	 * When provided, this array is used directly instead of calling computeDemand().
	 */
	demandOverride?: DemandItem[];
}

export interface LockedEntryInput {
	sectionId: number;
	subjectId: number;
	facultyId?: number | null;
	roomId?: number | null;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	day: string;
	startTime: string;
	endTime: string;
}

export interface GradeWindowInput {
	gradeLevel: number;
	programType?: string | null;
	startTime: string;
	endTime: string;
}

export type RoomAssignmentReason =
	| 'LOCKED_ENTRY'
	| 'HOME_ROOM_ASSIGNED'
	| 'HOME_ROOM_UNAVAILABLE'
	| 'CROSS_BUILDING_FALLBACK_ASSIGNED'
	| 'SPECIALIZED_ROOM'
	| 'SPECIALIZED_ROOM_UNAVAILABLE'
	| 'GENERAL_POOL_ASSIGNED'
	| 'MODULAR_POOL_ASSIGNED'
	| 'ROOM_PATH_EXHAUSTED'
	| 'NO_QUALIFIED_FACULTY'
	| 'FACULTY_SLOT_UNAVAILABLE'
	| 'POLICY_SLOT_BLOCKED'
	| 'FALLBACK_UNRESOLVED';

export type HomeRoomFallbackCause =
	| 'HOME_ROOM_OCCUPIED'
	| 'NO_SAME_ZONE_STANDARD_ROOM'
	| 'CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED'
	| 'ONLY_SPECIALIZED_ROOMS_AVAILABLE'
	| 'FACULTY_DAILY_LIMIT_EXCEEDED'
	| 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'
	| 'NO_VALID_PERIOD_IN_POLICY_WINDOW';

export interface UnassignedItem {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM' | 'ROOM_CAPACITY_EXCEEDED';
	roomAssignmentReason?: RoomAssignmentReason;
	facultyId?: number | null;
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
	homeRoomId?: number | null;
	homeRoomFallbackCause?: HomeRoomFallbackCause;
	/**
	 * TL-02 term-load diagnostics. Populated for rotation-session refusals
	 * (`FACULTY_SLOT_UNAVAILABLE`) so audits can distinguish per-term overage
	 * from cumulative overage. `facultyTermLoad` is the projected load in
	 * `termIndex` AFTER charging this session would have been attempted; in
	 * refusal rows it represents the load at the time of refusal.
	 */
	termIndex?: 1 | 2 | 3;
	facultyTermLoad?: number;
	facultyMax?: number;
}

export interface ConstructorResult {
	entries: ScheduledEntry[];
	unassignedItems: UnassignedItem[];
	lockWarnings: string[];
	modularWarnings?: ModularWarning[];
	assignedCount: number;
	unassignedCount: number;
	classesProcessed: number;
	policyBlockedCount: number;
}

export interface ModularAssignment {
	termIndex: 1 | 2 | 3;
	facultyId: number;
	subjectCode: string;
}

export interface ModularWarning {
	code: 'LACKING_FACULTY' | 'INCOMPLETE_MODULAR_GROUP';
	sectionId: number;
	subjectId: number;
	message: string;
	meta?: Record<string, unknown>;
}

// ─── Demand computation ───

export interface DemandItem {
	sectionId: number;
	subjectId: number;
	subjectCode: string;
	gradeLevel: number;
	sourceMinutesPerWeek?: number;
	sessionsPerWeek: number;
	durationPerSession: number;
	enrolledCount: number;
	entryKind: 'SECTION' | 'COHORT';
	homeRoomId?: number | null;
	buildingZoneId?: string | null;
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	cohortMemberSectionIds?: number[];
	roomTypePreference?: RoomType;
	adviserId?: number | null;
	adviserName?: string | null;
	modularGroupId?: string | null;
	modularSubjects?: Array<{
		subjectId: number;
		subjectCode: string;
		modularOrder: number;
		minMinutesPerWeek: number;
	}>;
	modularExpectedCount?: number;
}

export function computeDemand(
	sectionsByGrade: SectionsByGrade[],
	subjects: SubjectInput[],
	cohorts: InstructionalCohortInput[] = [],
	classTemplatePeriods: Record<string, number> = {},
	policyPeriodLengthMinutes?: number,
): DemandItem[] {
	const EXPECTED_MODULAR_SUBJECTS: Record<string, number> = {
		SCIENCE: 3,
	};

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
		const cohortsForGrade = activeCohorts.filter((cohort) =>
			cohort.gradeLevel === gradeNum
			|| normalizeGradeLevel(cohort.gradeLevel) === normalizeGradeLevel(gradeNum),
		);
		const modularGroups = new Map<string, SubjectInput[]>();
		const modularSubjectIds = new Set<number>();

		for (const subject of sortedSubjects) {
			if (!gradeLevelMatches(subject.gradeLevels, gradeNum)) continue;
			if (!subject.modularGroupId) continue;
			const groupId = subject.modularGroupId.trim().toUpperCase();
			if (!groupId) continue;
			const groupSubjects = modularGroups.get(groupId) ?? [];
			groupSubjects.push(subject);
			modularGroups.set(groupId, groupSubjects);
			modularSubjectIds.add(subject.id);
		}

		for (const [groupId, groupSubjects] of modularGroups) {
			const orderedModules = [...groupSubjects].sort((left, right) => {
				const leftOrder = left.modularOrder ?? Number.MAX_SAFE_INTEGER;
				const rightOrder = right.modularOrder ?? Number.MAX_SAFE_INTEGER;
				return leftOrder - rightOrder || left.id - right.id;
			});
			if (orderedModules.length === 0) continue;

			const primary = orderedModules[0];
			const maxMinutesPerWeek = Math.max(...orderedModules.map((moduleSubject) => moduleSubject.minMinutesPerWeek));
			const expectedCount = EXPECTED_MODULAR_SUBJECTS[groupId] ?? orderedModules.length;

			for (const section of sortedSections) {
				const applicableModules = orderedModules.filter((moduleSubject) =>
					isSubjectAllowedForSectionProgram(moduleSubject.code, section.programCode, moduleSubject.programScopes),
				);
				if (applicableModules.length === 0) continue;

				const periodLength = (policyPeriodLengthMinutes && policyPeriodLengthMinutes > 0)
					? policyPeriodLengthMinutes
					: (classTemplatePeriods[(section.programCode ?? '').toUpperCase()] ?? STANDARD_PERIOD_MINUTES);
				const sessions = Math.ceil(maxMinutesPerWeek / periodLength);
				const duration = Math.ceil(maxMinutesPerWeek / sessions);

				demand.push({
					sectionId: section.id,
					subjectId: primary.id,
					subjectCode: groupId,
					gradeLevel: gradeNum,
					sourceMinutesPerWeek: maxMinutesPerWeek,
					sessionsPerWeek: sessions,
					durationPerSession: duration,
					enrolledCount: section.enrolledCount,
					entryKind: 'SECTION',
					homeRoomId: section.homeRoomId ?? null,
					buildingZoneId: section.buildingZoneId ?? null,
					programType: section.programType ?? null,
					programCode: section.programCode ?? null,
					programName: section.programName ?? null,
					roomTypePreference: primary.preferredRoomType,
					adviserId: section.adviserId ?? null,
					adviserName: section.adviserName ?? null,
					modularGroupId: groupId,
					modularSubjects: applicableModules.map((moduleSubject, index) => ({
						subjectId: moduleSubject.id,
						subjectCode: moduleSubject.code,
						modularOrder: moduleSubject.modularOrder ?? index + 1,
						minMinutesPerWeek: moduleSubject.minMinutesPerWeek,
					})),
					modularExpectedCount: expectedCount,
				});
			}
		}

		for (const subject of sortedSubjects) {
			if (!gradeLevelMatches(subject.gradeLevels, gradeNum)) continue;
			if (modularSubjectIds.has(subject.id)) continue;

			/**
			 * Resolve period length for a section from the active policy day shape.
			 * Class-template values remain fallback-only for older rows.
			 */
			const getPeriodLength = (programCode: string | null | undefined): number => {
				const code = (programCode ?? '').toUpperCase();
				if (policyPeriodLengthMinutes && policyPeriodLengthMinutes > 0) {
					return policyPeriodLengthMinutes;
				}
				return classTemplatePeriods[code] ?? STANDARD_PERIOD_MINUTES;
			};

			const computeSessions = (programCode: string | null | undefined) => {
				const periodLen = getPeriodLength(programCode);
				const s = Math.ceil(subject.minMinutesPerWeek / periodLen);
				const d = Math.ceil(subject.minMinutesPerWeek / s);
				return { sessions: s, duration: d };
			};

			const usesCohorts = subject.interSectionEnabled === true
				&& (subject.interSectionGradeLevels?.length ? gradeLevelMatches(subject.interSectionGradeLevels, gradeNum) : true)
				&& cohortsForGrade.length > 0;

			if (usesCohorts) {
				const allowedSpecializationCodes = new Set(
					(subject.allowedSpecializations ?? [])
						.map((specializationCode) => normalizeSpecializationCode(specializationCode))
						.filter((specializationCode) => specializationCode.length > 0),
				);
				const specializationBoundCohort = allowedSpecializationCodes.size > 0;
				const eligibleCohorts = specializationBoundCohort
					? cohortsForGrade.filter((cohort) => allowedSpecializationCodes.has(normalizeSpecializationCode(cohort.specializationCode)))
					: cohortsForGrade;

				if (eligibleCohorts.length === 0 && specializationBoundCohort) {
					continue;
				}

				const cohortSectionIds = new Set<number>();
				for (const cohort of eligibleCohorts) {
					const memberSections = cohort.memberSectionIds
						.map((memberSectionId) => sectionsById.get(memberSectionId))
						.filter((memberSection): memberSection is SectionsByGrade['sections'][number] => memberSection != null);
					const applicableMembers = memberSections.filter((memberSection) =>
						isSubjectAllowedForSectionProgram(subject.code, memberSection.programCode, subject.programScopes),
					);
					if (applicableMembers.length === 0) continue;

					const maxMemberEnrollment = applicableMembers.reduce(
						(maxEnrollment, memberSection) => Math.max(maxEnrollment, memberSection.enrolledCount),
						0,
					);
					const summedMemberEnrollment = applicableMembers.reduce(
						(total, memberSection) => total + memberSection.enrolledCount,
						0,
					);
					// Inter-section cohorts use one room at a time, so capacity should match the largest member section.
					const effectiveCohortEnrollment = maxMemberEnrollment > 0
						? maxMemberEnrollment
						: (cohort.expectedEnrollment > 0 ? cohort.expectedEnrollment : summedMemberEnrollment);

					for (const memberSection of applicableMembers) {
						cohortSectionIds.add(memberSection.id);
					}

					const anchorSection = applicableMembers[0];
					const { sessions, duration } = computeSessions(anchorSection.programCode);
					demand.push({
						sectionId: anchorSection.id,
						subjectId: subject.id,
						subjectCode: subject.code,
						gradeLevel: gradeNum,
						sourceMinutesPerWeek: subject.minMinutesPerWeek,
						sessionsPerWeek: sessions,
						durationPerSession: duration,
						enrolledCount: effectiveCohortEnrollment,
						entryKind: 'COHORT',
						homeRoomId: null,
						buildingZoneId: anchorSection.buildingZoneId ?? null,
						programType: anchorSection.programType ?? null,
						programCode: anchorSection.programCode ?? null,
						programName: anchorSection.programName ?? null,
						cohortCode: cohort.cohortCode,
						cohortName: cohort.specializationName,
						cohortMemberSectionIds: applicableMembers.map((memberSection) => memberSection.id),
						roomTypePreference: specializationBoundCohort
							? subject.preferredRoomType
							: (cohort.preferredRoomType ?? subject.preferredRoomType),
						adviserId: null,
						adviserName: null,
					});
				}

				for (const section of sortedSections) {
					if (cohortSectionIds.has(section.id)) continue;
					if (!isSubjectAllowedForSectionProgram(subject.code, section.programCode, subject.programScopes)) continue;
					const { sessions, duration } = computeSessions(section.programCode);
					demand.push({
						sectionId: section.id,
						subjectId: subject.id,
						subjectCode: subject.code,
						gradeLevel: gradeNum,
						sourceMinutesPerWeek: subject.minMinutesPerWeek,
						sessionsPerWeek: sessions,
						durationPerSession: duration,
						enrolledCount: section.enrolledCount,
						entryKind: 'SECTION',
						homeRoomId: section.homeRoomId ?? null,
						buildingZoneId: section.buildingZoneId ?? null,
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
				if (!isSubjectAllowedForSectionProgram(subject.code, section.programCode, subject.programScopes)) continue;
				const { sessions, duration } = computeSessions(section.programCode);
				demand.push({
					sectionId: section.id,
					subjectId: subject.id,
					subjectCode: subject.code,
					gradeLevel: gradeNum,
					sourceMinutesPerWeek: subject.minMinutesPerWeek,
					sessionsPerWeek: sessions,
					durationPerSession: duration,
					enrolledCount: section.enrolledCount,
					entryKind: 'SECTION',
					homeRoomId: section.homeRoomId ?? null,
					buildingZoneId: section.buildingZoneId ?? null,
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

export function getDemandSectionIds(item: DemandItem): number[] {
	if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds && item.cohortMemberSectionIds.length > 0) {
		return item.cohortMemberSectionIds;
	}
	return [item.sectionId];
}

export function getDemandAssignmentKey(item: DemandItem): string {
	if (item.entryKind === 'COHORT' && item.cohortCode) {
		return `${item.cohortCode}:${item.subjectId}`;
	}
	return `${item.sectionId}:${item.subjectId}`;
}

function getMostFrequentSlotDuration(slots: PeriodSlot[]): number {
	const durationCounts = new Map<number, number>();
	for (const slot of slots) {
		const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
		if (duration <= 0) continue;
		durationCounts.set(duration, (durationCounts.get(duration) ?? 0) + 1);
	}

	let selectedDuration = 0;
	let selectedCount = -1;
	for (const [duration, count] of durationCounts) {
		if (count > selectedCount) {
			selectedDuration = duration;
			selectedCount = count;
		}
	}

	return selectedDuration;
}

function normalizeDemandSessionsForActiveSlots(
	demand: DemandItem[],
	timetableShapes: TimetableShapeContract[] | undefined,
	fallbackPeriodSlots: PeriodSlot[],
): DemandItem[] {
	if (demand.length === 0) return demand;

	const defaultSlotLength = getMostFrequentSlotDuration(fallbackPeriodSlots) || STANDARD_PERIOD_MINUTES;
	if (defaultSlotLength <= 0) return demand;

	return demand.map((item) => {
		const shape = resolveTimetableShapeContract(timetableShapes, item.gradeLevel, item.programType);
		const shapeSlots = shape?.periodSlots?.length ? shape.periodSlots : fallbackPeriodSlots;
		const slotLength = getMostFrequentSlotDuration(shapeSlots) || defaultSlotLength;
		if (slotLength <= 0) return item;

		const totalMinutes = Math.max(1, item.sourceMinutesPerWeek ?? (item.sessionsPerWeek * item.durationPerSession));
		const normalizedSessions = Math.max(1, Math.ceil(totalMinutes / slotLength));
		if (normalizedSessions === item.sessionsPerWeek) return item;

		return {
			...item,
			sessionsPerWeek: normalizedSessions,
			durationPerSession: Math.ceil(totalMinutes / normalizedSessions),
		};
	});
}

// ─── Occupancy tracker ───

class OccupancyTracker {
	private occupied = new Map<string, Array<{ start: number; end: number }>>();

	isOccupied(entityId: number, day: string, startTime: string, endTime: string): boolean {
		const key = `${entityId}:${day}`;
		const start = timeToMinutes(startTime);
		const end = timeToMinutes(endTime);
		const intervals = this.occupied.get(key);
		if (!intervals) return false;
		return intervals.some((interval) => interval.start < end && start < interval.end);
	}

	mark(entityId: number, day: string, startTime: string, endTime: string): void {
		const key = `${entityId}:${day}`;
		const start = timeToMinutes(startTime);
		const end = timeToMinutes(endTime);
		const intervals = this.occupied.get(key) ?? [];
		intervals.push({ start, end });
		this.occupied.set(key, intervals);
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

type UnavailableTimeRange = { day: string; startTime: string; endTime: string };

/**
 * Build a time-range-based lookup for UNAVAILABLE faculty preferences.
 * Used by canonical slot placement where period indices are not available.
 * Keyed by facultyId → array of {day, startTime, endTime} for UNAVAILABLE slots.
 */
function buildUnavailableTimeRanges(preferences: FacultyPreferenceInput[]): Map<number, UnavailableTimeRange[]> {
	const ranges = new Map<number, UnavailableTimeRange[]>();

	// Group by faculty — prefer SUBMITTED over DRAFT
	const byFaculty = new Map<number, FacultyPreferenceInput>();
	for (const pref of preferences) {
		const existing = byFaculty.get(pref.facultyId);
		if (!existing || (pref.status === 'SUBMITTED' && existing.status !== 'SUBMITTED')) {
			byFaculty.set(pref.facultyId, pref);
		}
	}

	for (const [facultyId, pref] of byFaculty) {
		const facultyRanges: UnavailableTimeRange[] = [];
		for (const ts of pref.timeSlots) {
			if (ts.preference === 'UNAVAILABLE') {
				facultyRanges.push({ day: ts.day, startTime: ts.startTime, endTime: ts.endTime });
			}
		}
		if (facultyRanges.length > 0) {
			ranges.set(facultyId, facultyRanges);
		}
	}

	return ranges;
}

// ─── Time helper ───

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

// ─── Main constructor ───

export function constructBaseline(input: ConstructorInput): ConstructorResult {
	const { subjects, faculty, facultySubjects, rooms, preferences, sectionsByGrade, policy, lockedEntries, gradeWindows, timetableShapes } = input;
	const useHomeRoomPriority = input.roomingStrategy === 'HOME_ROOM_FIRST';

	// Build period slots dynamically from the active policy day shape.
	const PERIOD_SLOTS = buildUnionClassPeriodSlots(timetableShapes);
	const FALLBACK_PERIOD_SLOTS = PERIOD_SLOTS.length > 0 ? PERIOD_SLOTS : buildPeriodSlots(policy);

	// Use demandOverride when provided (H-ALG-1 multi-seed support), otherwise compute fresh demand.
	const rawDemand = input.demandOverride ?? computeDemand(
		sectionsByGrade,
		subjects,
		input.cohorts ?? [],
		input.classTemplatePeriods ?? {},
		input.policy?.periodLengthMinutes,
	);
	const demand = normalizeDemandSessionsForActiveSlots(rawDemand, timetableShapes, FALLBACK_PERIOD_SLOTS);

	// Teaching rooms sorted by id, grouped by type
	const teachingRooms = rooms.filter((r) => r.isTeachingSpace).sort((a, b) => a.id - b.id);
	const roomsByType = new Map<string, RoomInput[]>();
	for (const r of teachingRooms) {
		const arr = roomsByType.get(r.type) ?? [];
		arr.push(r);
		roomsByType.set(r.type, arr);
	}

	// ─── Building → Grade Level mapping ───
	// Grade-level buildings follow pattern "Grade X Academic Wing"
	// Shared buildings (Science, MAPEH, TLE, Admin) don't restrict to a grade
	function extractGradeLevelFromBuildingName(name: string): number | null {
		const match = name.match(/Grade\s+(\d+)/i);
		return match ? Number(match[1]) : null;
	}

	const buildingGradeMap = new Map<number | null, number | null>(); // buildingId → gradeLevel (null if shared)
	if (input.buildings && input.buildings.length > 0) {
		for (const building of input.buildings) {
			const gradeLevel = extractGradeLevelFromBuildingName(building.name);
			buildingGradeMap.set(building.id, gradeLevel);
		}
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

	function isFacultyQualified(f: FacultyInput, s: SubjectInput): boolean {
		const departmentMatch = matchesSubjectOwnershipDepartment(
			f.department,
			s.code,
			s.name,
			s.ownerDepartment,
			s.requiredFeatures,
		);

		if (departmentMatch) {
			return true;
		}

		return false;
	}

	function getQualifiedFacultyIds(item: DemandItem, day: string, slot: { startTime: string; endTime: string }, pi: number, unavailableTimeRanges?: Map<number, UnavailableTimeRange[]>, termIndex?: 1 | 2 | 3): { ids: number[], reason?: UnassignedItem['reason'] } {
		const subject = subjectMap.get(item.subjectId);
		
		// Priority 1: Explicit Assignments from qualifiedMap
		let candidates: number[] = [];
		if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds && item.cohortMemberSectionIds.length > 0) {
			const candidateLists = item.cohortMemberSectionIds.map(
				(sectionId) => qualifiedMap.get(`${item.subjectId}:${sectionId}`) ?? [],
			);
			const hasAnyCandidates = candidateLists.some((candidateList) => candidateList.length > 0);
			if (hasAnyCandidates) {
				const intersection = candidateLists.some((candidateList) => candidateList.length === 0)
					? []
					: intersectCandidateLists(candidateLists);
				if (intersection.length > 0) {
					candidates = intersection;
				} else {
					candidates = [...new Set(candidateLists.flat())];
				}
			}
		} else {
			candidates = [...(qualifiedMap.get(`${item.subjectId}:${item.sectionId}`) ?? [])];
		}

		// Priority 2: Optional fallback to tiered qualification when flexible assignment is enabled.
		// For cohort entries, also widen the pool when explicit assignment depth is too thin
		// to avoid single-teacher slot starvation on inter-section sessions.
		const shouldAugmentWithTieredCandidates = subject != null && allowFlexible;
		if (shouldAugmentWithTieredCandidates && subject) {
			const tieredCandidates = faculty.filter((facultyMember) => isFacultyQualified(facultyMember, subject)).map((facultyMember) => facultyMember.id);
			if (candidates.length === 0) {
				candidates = tieredCandidates;
			} else if (tieredCandidates.length > 0) {
				candidates = [...new Set([...candidates, ...tieredCandidates])];
			}
		}

		if (candidates.length === 0) {
			return { ids: [], reason: 'NO_QUALIFIED_FACULTY' };
		}

		const canRelaxPreferenceForEntry = item.entryKind === 'COHORT'
			|| (useHomeRoomPriority && item.entryKind === 'SECTION');

		const isWithinLoadAndOccupancy = (facId: number): boolean => {
			const maxLoad = facultyMax.get(facId) ?? 0;
			// Non-rotation sessions run in every term (baseLoad already includes them).
			// Rotation sessions only charge the term the session will run in (termIndex).
			const relevantLoad = getFacultyProjectedLoadForTerm(facId, termIndex);
			if (relevantLoad + item.durationPerSession > maxLoad) return false;
			if (facultyOcc.isOccupied(facId, day, slot.startTime, slot.endTime)) return false;
			return true;
		};

		// Filter candidates based on load and availability at this specific slot
		const available = candidates.filter((facId) => {
			if (!isWithinLoadAndOccupancy(facId)) return false;

			const facPrefs = prefLookup.get(facId);
			if (facPrefs) {
				// Check by period index if available
				if (pi >= 0 && facPrefs.get(`${day}:${pi}`) === 'UNAVAILABLE') return false;
				// When pi is not available (canonical slots), check time-range overlap
				if (pi < 0) {
					const timeRanges = unavailableTimeRanges?.get(facId);
					if (timeRanges) {
						const slotStart = timeToMinutes(slot.startTime);
						const slotEnd = timeToMinutes(slot.endTime);
						for (const range of timeRanges) {
							if (range.day !== day) continue;
							const rangeStart = timeToMinutes(range.startTime);
							const rangeEnd = timeToMinutes(range.endTime);
							// Check overlap: slot overlaps range if slot starts before range ends AND slot ends after range starts
							if (slotStart < rangeEnd && slotEnd > rangeStart) {
								return false;
							}
						}
					}
				}
			}

			return true;
		});

		if (available.length === 0) {
			if (canRelaxPreferenceForEntry) {
				const relaxed = candidates.filter((facId) => isWithinLoadAndOccupancy(facId));
				if (relaxed.length > 0) {
					return { ids: relaxed.sort((a, b) => a - b) };
				}
			}

			// Check if it's overload or preference (term-aware)
			const overloaded = candidates.every((facId) => {
				const maxLoad = facultyMax.get(facId) ?? 0;
				const relevantLoad = getFacultyProjectedLoadForTerm(facId, termIndex);
				return relevantLoad + item.durationPerSession > maxLoad;
			});
			return { ids: [], reason: overloaded ? 'FACULTY_OVERLOADED' : 'NO_AVAILABLE_SLOT' };
		}

		return { ids: available.sort((a, b) => a - b) };
	}

	// Prompt 01: per-term ranked modular candidate pool for the CURRENT demand
	// item's family. Populated by buildModularAssignments; consumed by the
	// placement loop to resolve the actual teacher at the chosen slot against
	// effective per-term occupancy.
	const modularCandidatePoolByTerm = new Map<number, number[]>();

	function buildModularAssignments(item: DemandItem): { assignments: ModularAssignment[]; missingTerms: number[] } {
		if (!item.modularSubjects || item.modularSubjects.length === 0) {
			return { assignments: [], missingTerms: [] };
		}

		// Prompt 01: per-term ranked candidate pool for this demand's modular family.
		// Reset per item — each section's lane resolves its own teachers at slot time.
		modularCandidatePoolByTerm.clear();
		const sortedModules = [...item.modularSubjects].sort((left, right) => left.modularOrder - right.modularOrder);
		const assignments: ModularAssignment[] = [];
		const missingTerms: number[] = [];

		for (const moduleSubject of sortedModules) {
			const termIndex: 1 | 2 | 3 = moduleSubject.modularOrder <= 1
				? 1
				: moduleSubject.modularOrder === 2
					? 2
					: 3;
			const subjectRow = subjectMap.get(moduleSubject.subjectId);
			const explicitFacultyIds = qualifiedMap.get(`${moduleSubject.subjectId}:${item.sectionId}`) ?? [];
			const tieredFacultyIds = subjectRow
				? faculty.filter((facultyMember) => isFacultyQualified(facultyMember, subjectRow)).map((facultyMember) => facultyMember.id)
				: [];
			const facultyIds = explicitFacultyIds.length > 0
				? explicitFacultyIds
				: [...new Set(tieredFacultyIds)].sort((left, right) => left - right);
			if (facultyIds.length === 0) {
				missingTerms.push(termIndex);
				continue;
			}
			// Prompt 01 (Dynamic Timetable Recovery): the modular teacher is a REAL
			// per-term reservation. The slot is chosen AFTER this function runs, so
			// the teacher CANNOT be finalized here — committing to rankedFacultyIds[0]
			// double-booked one teacher across all sections that shared a slot.
			// Store the full ranked candidate pool; the placement loop resolves the
			// actual teacher per slot against effective per-term occupancy.
			const rankedFacultyIds = [...facultyIds].sort((left, right) => {
				const leftLoad = getFacultyProjectedLoadForTerm(left, termIndex);
				const rightLoad = getFacultyProjectedLoadForTerm(right, termIndex);
				if (leftLoad !== rightLoad) return leftLoad - rightLoad;
				return left - right;
			});
			assignments.push({
				termIndex,
				facultyId: rankedFacultyIds[0],
				subjectCode: moduleSubject.subjectCode,
			});
			// candidate pool for slot-time resolution (termIndex -> ranked ids)
			modularCandidatePoolByTerm.set(termIndex, rankedFacultyIds);
		}

		if (missingTerms.length > 0) {
			modularWarnings.push({
				code: 'LACKING_FACULTY',
				sectionId: item.sectionId,
				subjectId: item.subjectId,
				message: `Lacking Faculty for modular group ${item.modularGroupId ?? item.subjectCode} in section ${item.sectionId}. Missing term(s): ${missingTerms.join(', ')}.`,
				meta: {
					modularGroupId: item.modularGroupId ?? null,
					missingTerms,
				},
			});
		}

		if (item.modularExpectedCount && sortedModules.length < item.modularExpectedCount) {
			modularWarnings.push({
				code: 'INCOMPLETE_MODULAR_GROUP',
				sectionId: item.sectionId,
				subjectId: item.subjectId,
				message: `Incomplete Modular Group ${item.modularGroupId ?? item.subjectCode} in section ${item.sectionId}: found ${sortedModules.length} of expected ${item.modularExpectedCount} module subjects.`,
				meta: {
					modularGroupId: item.modularGroupId ?? null,
					foundSubjects: sortedModules.length,
					expectedSubjects: item.modularExpectedCount,
					subjectCodes: sortedModules.map((moduleSubject) => moduleSubject.subjectCode),
				},
			});
		}

		return { assignments, missingTerms };
	}

	// Preference lookup
	const prefLookup = buildPreferenceLookup(preferences, FALLBACK_PERIOD_SLOTS);
	const unavailableTimeRanges = buildUnavailableTimeRanges(preferences);

	// Occupancy trackers
	const facultyOcc = new OccupancyTracker();
	const roomOcc = new OccupancyTracker();
	const sectionOcc = new OccupancyTracker();

	// Faculty load tracking — TL-02 term-aware model.
	//   baseLoad: minutes that run in EVERY term concurrently (non-rotation subjects).
	//   facultyLoadByTerm: minutes that run only in a specific term (rotation/modular subjects).
	// A session with a `sessionTermIndex` charges facultyLoadByTerm[thatTerm];
	// a session WITHOUT a term index charges baseLoad (i.e., runs every term).
	const facultyLoadBase = new Map<number, number>();
	const facultyLoadByTerm = new Map<number, Map<1 | 2 | 3, number>>();
	const facultyLoad = new Map<number, number>();
	const facultyMax = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek * 60]));

	function chargeFacultyLoad(facId: number, minutes: number, termIndex: 1 | 2 | 3 | undefined): void {
		if (termIndex === 1 || termIndex === 2 || termIndex === 3) {
			const termMap = facultyLoadByTerm.get(facId) ?? new Map<1 | 2 | 3, number>();
			termMap.set(termIndex, (termMap.get(termIndex) ?? 0) + minutes);
			facultyLoadByTerm.set(facId, termMap);
		} else {
			facultyLoadBase.set(facId, (facultyLoadBase.get(facId) ?? 0) + minutes);
		}
		// Cumulative mirror retained for diagnostic parity with previous behavior.
		facultyLoad.set(facId, (facultyLoad.get(facId) ?? 0) + minutes);
	}

	function getFacultyProjectedLoadForTerm(facId: number, termIndex: 1 | 2 | 3 | undefined): number {
		const baseLoad = facultyLoadBase.get(facId) ?? 0;
		if (termIndex === 1 || termIndex === 2 || termIndex === 3) {
			const termMap = facultyLoadByTerm.get(facId);
			const termLoad = termMap?.get(termIndex) ?? 0;
			return baseLoad + termLoad;
		}
		// Non-rotation candidate check — every term carries baseLoad plus any rotation charge.
		const termMap = facultyLoadByTerm.get(facId);
		if (!termMap) return baseLoad;
		const term1 = termMap.get(1) ?? 0;
		const term2 = termMap.get(2) ?? 0;
		const term3 = termMap.get(3) ?? 0;
		return baseLoad + Math.max(term1, term2, term3);
	}
	const roomById = new Map(rooms.map((room) => [room.id, room]));

	const entries: ScheduledEntry[] = [];
	const unassignedItems: UnassignedItem[] = [];
	const lockWarnings: string[] = [];
	const modularWarnings: ModularWarning[] = [];
	let assignedCount = 0;
	let unassignedCount = 0;
	let policyBlockedCount = 0;
	let entryCounter = 0;

	// Faculty daily teaching minutes tracker: "facultyId:day" → total minutes
	const facultyDailyMinutes = new Map<string, number>();
	// Faculty day placement tracker for consecutive check: "facultyId:day" → sorted period indices
	const facultyDayPeriods = new Map<string, Array<{ startTime: string; endTime: string; duration: number }>>();

	// ─── Pre-place locked entries ───
	// "sectionId:subjectId" → count of sessions already fulfilled by locks
	const lockSessionCounts = new Map<string, number>();

	if (lockedEntries && lockedEntries.length > 0) {
		for (const lock of lockedEntries) {
			const pi = FALLBACK_PERIOD_SLOTS.findIndex(
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
			const period = FALLBACK_PERIOD_SLOTS[pi];
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
				entryKind: lock.entryKind,
				cohortCode: lock.cohortCode ?? null,
				metadata: {
					roomAssignmentReason: 'LOCKED_ENTRY',
				},
			});

			// Mark occupancy for locked placements
			sectionOcc.mark(lock.sectionId, lock.day, period.startTime, period.endTime);
			facultyOcc.mark(lock.facultyId, lock.day, period.startTime, period.endTime);
			// Locked entries don't carry an explicit term — treat them as concurrent (every term).
			chargeFacultyLoad(lock.facultyId, durationMinutes, undefined);
			const dailyKey = `${lock.facultyId}:${lock.day}`;
			facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + durationMinutes);
			const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
			dayPeriods.push({ startTime: period.startTime, endTime: period.endTime, duration: durationMinutes });
			facultyDayPeriods.set(dailyKey, dayPeriods);
			roomOcc.mark(lock.roomId, lock.day, period.startTime, period.endTime);

			assignedCount++;

			// Track lock session counts
			const lockKey = lock.entryKind === 'COHORT' && lock.cohortCode
				? `${lock.cohortCode}:${lock.subjectId}`
				: `${lock.sectionId}:${lock.subjectId}`;
			lockSessionCounts.set(lockKey, (lockSessionCounts.get(lockKey) ?? 0) + 1);
		}
	}

	// ─── Grade window lookup ───
	// gradeLevel + optional programType → { startMin, endMin }
	const gradeWindowMap = new Map<string, { startMin: number; endMin: number }>();
	if (gradeWindows && gradeWindows.length > 0) {
		for (const gw of gradeWindows) {
			const programKey = (gw.programType ?? 'ALL').toUpperCase();
			const normalizedGradeLevel = normalizeGradeLevel(gw.gradeLevel);
			gradeWindowMap.set(`${normalizedGradeLevel}:${programKey}`, {
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
		for (let pi = 0; pi < FALLBACK_PERIOD_SLOTS.length; pi++) {
			const slot = FALLBACK_PERIOD_SLOTS[pi];
			if (timeToMinutes(slot.startTime) >= earliestMin && timeToMinutes(slot.endTime) <= latestMin) {
				validPeriodIndices.push(pi);
			}
		}
	}

	/**
	 * Check if placing a class at periodIdx for faculty on a given day
	 * would exceed the consecutive teaching limit (without required break).
	 */
	function wouldExceedConsecutive(facId: number, day: string, startTime: string, endTime: string, duration: number): boolean {
		if (!policy) return false;

		const dayKey = `${facId}:${day}`;
		const existing = facultyDayPeriods.get(dayKey) ?? [];
		// Build period list with start times for ordering
		const allPeriods = [...existing.map(p => ({ startTime: p.startTime, endTime: p.endTime, duration: p.duration })),
			{ startTime, endTime, duration }].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

		// Walk periods and compute consecutive blocks
		let consecutive = 0;
		for (let i = 0; i < allPeriods.length; i++) {
			const period = allPeriods[i];
			const slotDuration = period.duration;

			if (i === 0) {
				consecutive = slotDuration;
				continue;
			}

			const prevPeriod = allPeriods[i - 1];
			const gapMinutes = timeToMinutes(period.startTime) - timeToMinutes(prevPeriod.endTime);

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
	function wouldCreateConsecutiveLab(sectionId: number, day: string, startTime: string, endTime: string, roomType: string): boolean {
		if (allowConsecutiveLab) return false;
		if (!LAB_ROOM_TYPES.has(roomType)) return false;

		const dayKey = `${sectionId}:${day}`;
		const existing = sectionDayLabPeriods.get(dayKey) ?? [];
		const targetStart = timeToMinutes(startTime);

		// Check if any existing lab period is adjacent to this one
		for (const period of existing) {
			const existingEnd = timeToMinutes(period.endTime);
			const gap = Math.abs(targetStart - existingEnd);
			if (gap <= 5) return true; // Adjacent or overlapping
		}
		return false;
	}

	// ─── Two-pass TLE priority scheduling ───
	// When enabled, schedule TLE subjects first (Bucket A), then everything else (Bucket B)
	const enableTwoPass = policy?.enableTleTwoPassPriority !== false;
	let orderedDemand: DemandItem[];
	const prioritizeCohorts = (items: DemandItem[]) =>
		[...items].sort((left, right) => {
			const leftPriority = left.entryKind === 'COHORT' ? 0 : 1;
			const rightPriority = right.entryKind === 'COHORT' ? 0 : 1;
			if (leftPriority !== rightPriority) return leftPriority - rightPriority;
			return 0;
		});
	const interleaveByGradeLevel = (items: DemandItem[]) => {
		const queues = new Map<number, DemandItem[]>();
		for (const item of items) {
			const gradeLevel = normalizeGradeLevel(item.gradeLevel);
			const queue = queues.get(gradeLevel) ?? [];
			queue.push(item);
			queues.set(gradeLevel, queue);
		}
		const orderedGrades = [...queues.keys()].sort((left, right) => left - right);
		const ordered: DemandItem[] = [];
		let hasRemaining = true;
		while (hasRemaining) {
			hasRemaining = false;
			for (const gradeLevel of orderedGrades) {
				const queue = queues.get(gradeLevel);
				if (!queue || queue.length === 0) continue;
				ordered.push(queue.shift() as DemandItem);
				hasRemaining = true;
			}
		}
		return ordered;
	};
	const isTleLikeDemand = (item: DemandItem) => {
		const code = (item.subjectCode ?? '').toUpperCase();
		return code === 'TLE' || code.startsWith('TLE_');
	};

	if (enableTwoPass) {
		const tleDemand = demand.filter((item) => isTleLikeDemand(item));
		const otherDemand = demand.filter((item) => !isTleLikeDemand(item));
		orderedDemand = [
			...interleaveByGradeLevel(prioritizeCohorts(tleDemand)),
			...interleaveByGradeLevel(prioritizeCohorts(otherDemand)),
		];
	} else {
		orderedDemand = interleaveByGradeLevel(prioritizeCohorts(demand));
	}

	const sectionWeeklyDemandSessions = new Map<number, number>();
	for (const demandItem of orderedDemand) {
		if (demandItem.entryKind !== 'SECTION') continue;
		const existing = sectionWeeklyDemandSessions.get(demandItem.sectionId) ?? 0;
		sectionWeeklyDemandSessions.set(demandItem.sectionId, existing + demandItem.sessionsPerWeek);
	}

	const allowFlexible = policy?.allowFlexibleSubjectAssignment === true;
	const allowConsecutiveLab = policy?.allowConsecutiveLabSessions === true;
	const placementSemantics = policy ? resolvePolicyPlacementSemantics(policy) : null;
	const allFacultyIds = faculty.map((f) => f.id).sort((a, b) => a - b);

	// Lab-like room types for consecutive lab check
	const LAB_ROOM_TYPES: Set<string> = new Set(['LABORATORY', 'TLE_WORKSHOP', 'COMPUTER_LAB']);
	const SPECIALIZED_ROOM_TYPES: Set<string> = new Set(['LABORATORY', 'TLE_WORKSHOP', 'COMPUTER_LAB', 'GYMNASIUM']);
	const MAX_CROSS_BUILDING_FALLBACK_ROOMS = 8;

	// Section-day placement tracker for consecutive lab check: "sectionId:day" → array of {periodIdx, isLab}
	const sectionDayLabPeriods = new Map<string, Array<{ startTime: string; endTime: string }>>();

	function scoreFacultyForSlot(facultyId: number, day: string, startTime: string): number {
		const dayKey = `${facultyId}:${day}`;
		const periods = [...(facultyDayPeriods.get(dayKey) ?? [])].sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
		if (periods.length === 0) {
			// Slightly prefer using already-active teaching days for better packing.
			return 1;
		}

		const targetStart = timeToMinutes(startTime);
		const nearestDistance = Math.min(...periods.map((existingPeriod) => Math.abs(targetStart - timeToMinutes(existingPeriod.startTime))));
		if (nearestDistance <= 15) return -1.5;
		if (nearestDistance <= 30) return -0.4;
		if (nearestDistance >= 60) return 1.2;
		return 0;
	}

	function scoreRoomForFacultyAtSlot(room: RoomInput, facultyId: number, day: string, startTime: string, endTime: string): number {
		const dayKey = `${facultyId}:${day}`;
		const periods = facultyDayPeriods.get(dayKey) ?? [];
		if (periods.length === 0) return 0;

		let score = 0;
		const targetBuildingId = room.buildingId ?? null;
		const targetStart = timeToMinutes(startTime);
		for (const existingPeriod of periods) {
			const distance = Math.abs(targetStart - timeToMinutes(existingPeriod.startTime));
			if (distance > 2) continue;
			const matchingEntry = entries.find((entry) =>
				entry.facultyId === facultyId
				&& entry.day === day
				&& entry.startTime === existingPeriod.startTime
				&& entry.endTime === existingPeriod.endTime,
			);
			if (!matchingEntry) continue;
			const existingRoom = roomById.get(matchingEntry.roomId);
			if (!existingRoom) continue;
			if (existingRoom.buildingId != null && targetBuildingId != null && existingRoom.buildingId !== targetBuildingId) {
				score += distance === 1 ? 2.5 : 1.2;
			}
		}

		return score;
	}

	for (const item of orderedDemand) {
		const subject = subjectMap.get(item.subjectId);
		const modularAssignmentInfo = item.modularGroupId ? buildModularAssignments(item) : null;
		const modularTermCycle = modularAssignmentInfo?.assignments
			? [...new Set(modularAssignmentInfo.assignments.map((assignment) => assignment.termIndex))].sort((a, b) => a - b)
			: [];
		if (!subject) {
			for (let s = 0; s < item.sessionsPerWeek; s++) {
				const requestedRoomType = item.roomTypePreference;
				const deferSpecializedRoomTypePreference =
					useHomeRoomPriority
					&& item.entryKind === 'SECTION'
					&& requestedRoomType != null
					&& requestedRoomType !== 'CLASSROOM';
				unassignedItems.push({
					sectionId: item.sectionId,
					subjectId: item.subjectId,
					gradeLevel: item.gradeLevel,
					session: s + 1,
					reason: 'NO_QUALIFIED_FACULTY',
					roomAssignmentReason: !deferSpecializedRoomTypePreference && item.roomTypePreference && ['LABORATORY', 'TLE_WORKSHOP', 'COMPUTER_LAB', 'GYMNASIUM'].includes(item.roomTypePreference)
						? 'SPECIALIZED_ROOM_UNAVAILABLE'
						: 'FALLBACK_UNRESOLVED',
					facultyId: null,
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
					homeRoomId: item.homeRoomId ?? null,
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
		let gradeValidPeriods = validPeriodIndices ?? Array.from({ length: FALLBACK_PERIOD_SLOTS.length }, (_, i) => i);
		const shapeContract = resolveTimetableShapeContract(timetableShapes, item.gradeLevel, item.programType);
		if (shapeContract) {
			const sectionDemandSessions = item.entryKind === 'SECTION'
				? (sectionWeeklyDemandSessions.get(item.sectionId) ?? item.sessionsPerWeek)
				: item.sessionsPerWeek;
			const shapeWeeklyCapacity = shapeContract.periodSlots.length * DAYS.length;
			const shouldBypassShapeFilter = item.entryKind === 'SECTION' && sectionDemandSessions > shapeWeeklyCapacity;
			if (!shouldBypassShapeFilter) {
				// Use canonical CLASS slots if available, otherwise use shape contract period slots
				const canonicalClassSlots = shapeContract.canonicalSlots?.filter(s => s.rowKind === 'CLASS');
				const allowedSlots = canonicalClassSlots && canonicalClassSlots.length > 0
					? canonicalClassSlots
					: shapeContract.periodSlots;
				const allowedSlotKeys = new Set(allowedSlots.map((slot) => `${slot.startTime}-${slot.endTime}`));
				gradeValidPeriods = gradeValidPeriods.filter((pi) => {
					const slot = FALLBACK_PERIOD_SLOTS[pi];
					return allowedSlotKeys.has(`${slot.startTime}-${slot.endTime}`);
				});
			}
		}
		const normalizedItemGradeLevel = normalizeGradeLevel(item.gradeLevel);
		const gradeProgramKey = `${normalizedItemGradeLevel}:${(item.programType ?? 'ALL').toUpperCase()}`;
		const gw = gradeWindowMap.get(gradeProgramKey) ?? gradeWindowMap.get(`${normalizedItemGradeLevel}:ALL`);
		if (gw) {
			gradeValidPeriods = gradeValidPeriods.filter((pi) => {
				const slot = FALLBACK_PERIOD_SLOTS[pi];
				return timeToMinutes(slot.startTime) >= gw.startMin && timeToMinutes(slot.endTime) <= gw.endMin;
			});
		}

		// Track which days we already used for this section-subject pair (spread sessions across days)
		const daysUsedForPair = new Set<string>();
		
		// Track failure reasons across all attempts for this session
		const sessionFailureReasons = new Set<UnassignedItem['reason']>();

		for (let session = 0; session < sessionsNeeded; session++) {
			let placed = false;
			let policyBlockedForSession = false;
			const sessionTermIndex = modularTermCycle.length > 0
				? modularTermCycle[session % modularTermCycle.length]
				: undefined;
			let fallbackCauseForPlacement: HomeRoomFallbackCause | undefined;
			let sawNoSameZoneStandardRoom = false;
			let sawCrossBuildingFallbackOptions = false;
			let sawOnlySpecializedRooms = false;
			let sawDailyHardLimit = false;
			let sawConsecutiveHardLimit = false;
			let sawNoValidPeriodInPolicyWindow = false;
			let sawFacultySlotUnavailable = false;
			let sawCapacityOverflow = false;
			let sawCapacityBlockedRoomForSession = false;

			const preferredHomeRoomId = useHomeRoomPriority && item.entryKind === 'SECTION'
				? (item.homeRoomId ?? null)
				: null;
			const preferredHomeRoom = preferredHomeRoomId != null
				? rooms.find((room) => room.id === preferredHomeRoomId) ?? null
				: null;
			const preferredZone = (item.buildingZoneId ?? preferredHomeRoom?.buildingZoneId ?? null)?.toUpperCase() ?? null;

		// Build possible slot candidates (deterministic scoring)
		// Use canonical CLASS rows directly when available, otherwise use FALLBACK_PERIOD_SLOTS
		const canonicalClassSlots = shapeContract?.canonicalSlots?.filter(s => s.rowKind === 'CLASS');
		const useCanonicalSlots = canonicalClassSlots && canonicalClassSlots.length > 0;

		const possibleSlots: { day: string; startTime: string; endTime: string; score: number; pi?: number }[] = [];
		for (let di = 0; di < DAYS.length; di++) {
			const day = DAYS[di];

			if (useCanonicalSlots) {
				// Use canonical CLASS rows directly as candidates
				for (const canonicalSlot of canonicalClassSlots!) {
					if (getDemandSectionIds(item).some((sectionId) => sectionOcc.isOccupied(sectionId, day, canonicalSlot.startTime, canonicalSlot.endTime))) continue;

					let score = 1;
					if (daysUsedForPair.has(day)) score += item.entryKind === 'COHORT' ? 1.5 : 2.5;
					if (preferredHomeRoom != null) {
						if (roomOcc.isOccupied(preferredHomeRoom.id, day, canonicalSlot.startTime, canonicalSlot.endTime)) score += 2;
						else score -= 0.5;
					}
					possibleSlots.push({ day, startTime: canonicalSlot.startTime, endTime: canonicalSlot.endTime, score });
				}
			} else {
				// Fall back to legacy FALLBACK_PERIOD_SLOTS
				for (const pi of gradeValidPeriods) {
					const slot = FALLBACK_PERIOD_SLOTS[pi];
					if (getDemandSectionIds(item).some((sectionId) => sectionOcc.isOccupied(sectionId, day, slot.startTime, slot.endTime))) continue;

					let score = 1;
					if (daysUsedForPair.has(day)) score += item.entryKind === 'COHORT' ? 1.5 : 2.5;
					if (preferredHomeRoom != null) {
						if (roomOcc.isOccupied(preferredHomeRoom.id, day, slot.startTime, slot.endTime)) score += 2;
						else score -= 0.5;
					}
					possibleSlots.push({ day, startTime: slot.startTime, endTime: slot.endTime, score, pi });
				}
			}
		}

			if (possibleSlots.length === 0 && preferredHomeRoomId != null) {
				sawNoValidPeriodInPolicyWindow = true;
			}

			possibleSlots.sort((a, b) => {
				if (a.score !== b.score) return a.score - b.score;
				const dayDiff = DAYS.indexOf(a.day as typeof DAYS[number]) - DAYS.indexOf(b.day as typeof DAYS[number]);
				if (dayDiff !== 0) return dayDiff;
				return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
			});

			for (const slotCandidate of possibleSlots) {
				if (placed) break;

				const slot = { startTime: slotCandidate.startTime, endTime: slotCandidate.endTime };
				const isModularUnified = Boolean(item.modularGroupId);

				// Prompt 01: a modular lane is only placeable at this slot when EVERY
				// term of its family has at least one conflict-free qualified teacher.
				// Skipping this check stacked all concurrent lanes at one slot-time and
				// double-booked the shared TLE/Science pool. When the pool cannot cover
				// the slot, try the next slot instead of emitting a known-conflicting lane.
				if (isModularUnified && modularCandidatePoolByTerm.size > 0) {
					const everyTermCovered = Array.from(modularCandidatePoolByTerm.entries())
						.every(([, pool]) => pool.some((candidate) =>
							!facultyOcc.isOccupied(candidate, slotCandidate.day, slot.startTime, slot.endTime),
						));
					if (!everyTermCovered) {
						sawFacultySlotUnavailable = true;
						continue;
					}
				}

				// For canonical slots, use a simplified faculty lookup without pi index
				const { ids: rawCandidates, reason: qReason } = isModularUnified
					? { ids: [0] as number[], reason: undefined }
					: getQualifiedFacultyIds(item, slotCandidate.day, slot, -1, unavailableTimeRanges, sessionTermIndex);
				const candidates = isModularUnified
					? rawCandidates
					: [...rawCandidates].sort((left, right) => {
						// Compare per-term load using the term this session would run in,
						// so the constructor spreads rotation work across teachers within terms.
						const leftLoad = getFacultyProjectedLoadForTerm(left, sessionTermIndex);
						const rightLoad = getFacultyProjectedLoadForTerm(right, sessionTermIndex);
						if (leftLoad !== rightLoad) return leftLoad - rightLoad;
						return left - right;
					});

				if (qReason) {
					sessionFailureReasons.add(qReason);
					if (qReason === 'FACULTY_OVERLOADED' || qReason === 'NO_AVAILABLE_SLOT') sawFacultySlotUnavailable = true;
				}
				if (candidates.length === 0) continue;

				const requestedRoomType = item.roomTypePreference ?? subject.preferredRoomType;
				const deferSpecializedRoomTypePreference =
					useHomeRoomPriority
					&& item.entryKind === 'SECTION'
					&& requestedRoomType !== 'CLASSROOM';
				const effectiveRoomTypePreference = deferSpecializedRoomTypePreference ? 'CLASSROOM' : requestedRoomType;
				let compatibleRooms = roomsByType.get(effectiveRoomTypePreference) ?? [];
				const isSpecializedDemand = effectiveRoomTypePreference !== 'CLASSROOM';
				let sameZoneStandardRooms: RoomInput[] = [];
				let broaderStandardRooms: RoomInput[] = [];

				if (!isSpecializedDemand) {
					compatibleRooms = compatibleRooms.filter(
						(room) => room.type === 'CLASSROOM' && !room.isSharedFacility && isRoomGradeScopeCompatible(room, item.gradeLevel),
					);

					if (preferredHomeRoomId != null) {
						const isSameZoneRoom = (room: RoomInput): boolean => {
							if (preferredZone != null) {
								return (room.buildingZoneId ?? null)?.toUpperCase() === preferredZone;
							}
							if (preferredHomeRoom?.buildingId != null && room.buildingId != null) {
								return room.buildingId === preferredHomeRoom.buildingId;
							}
							return false;
						};

						sameZoneStandardRooms = compatibleRooms.filter((room) => room.id !== preferredHomeRoomId && isSameZoneRoom(room));
						broaderStandardRooms = compatibleRooms
							.filter((room) => room.id !== preferredHomeRoomId && !isSameZoneRoom(room))
							.slice(0, MAX_CROSS_BUILDING_FALLBACK_ROOMS);
						sawCrossBuildingFallbackOptions = broaderStandardRooms.length > 0;

						const homeRoomAllowed = preferredHomeRoom != null
							&& preferredHomeRoom.type === 'CLASSROOM'
							&& !preferredHomeRoom.isSharedFacility
							&& isRoomGradeScopeCompatible(preferredHomeRoom, item.gradeLevel);
						const homeRoomCandidate = homeRoomAllowed ? [preferredHomeRoom] : [];
						compatibleRooms = [...homeRoomCandidate, ...sameZoneStandardRooms, ...broaderStandardRooms];

						if (homeRoomCandidate.length === 0 && sameZoneStandardRooms.length === 0 && broaderStandardRooms.length === 0) {
							const hasSpecializedInventory = teachingRooms.some((room) => room.type !== 'CLASSROOM');
							if (hasSpecializedInventory) sawOnlySpecializedRooms = true;
							else sawNoSameZoneStandardRoom = true;
						} else if (sameZoneStandardRooms.length === 0 && broaderStandardRooms.length > 0) {
							sawNoSameZoneStandardRoom = true;
						}
					}

					const hasCapacityCompliantClassroom = compatibleRooms.some((room) => room.capacity == null || room.capacity >= item.enrolledCount);
					sawCapacityOverflow = compatibleRooms.length > 0 && !hasCapacityCompliantClassroom;
					if (!hasCapacityCompliantClassroom) {
						const overflowRooms = teachingRooms
							.filter((room) => !room.isSharedFacility)
							.filter((room) => room.type !== 'CLASSROOM')
							.filter((room) => room.capacity == null || room.capacity >= item.enrolledCount)
							.filter((room) => isRoomGradeScopeCompatible(room, item.gradeLevel))
							.sort((left, right) => {
								const leftZoneMatch = preferredZone != null && (left.buildingZoneId ?? null)?.toUpperCase() === preferredZone ? 0 : 1;
								const rightZoneMatch = preferredZone != null && (right.buildingZoneId ?? null)?.toUpperCase() === preferredZone ? 0 : 1;
								if (leftZoneMatch !== rightZoneMatch) return leftZoneMatch - rightZoneMatch;
								return left.id - right.id;
							});
						compatibleRooms = [...compatibleRooms, ...overflowRooms];
					}
				} else if (compatibleRooms.length > 0 && buildingGradeMap.size > 0) {
					compatibleRooms = compatibleRooms.filter((room) => {
						const buildingId = room.buildingId;
						if (!buildingId) return true;
						const buildingGradeLevel = buildingGradeMap.get(buildingId);
						if (buildingGradeLevel === null) return true;
						return buildingGradeLevel === item.gradeLevel;
					});
				}

				if (compatibleRooms.length === 0) {
					sessionFailureReasons.add(sawCapacityOverflow ? 'ROOM_CAPACITY_EXCEEDED' : 'NO_COMPATIBLE_ROOM');
					if (preferredHomeRoomId != null) {
						sawNoSameZoneStandardRoom = true;
					}
					continue;
				}

				for (const facId of candidates) {
					if (placed) break;
					let policyBlockedForFaculty = false;

					if (policy && !isModularUnified) {
						const dailyKey = `${facId}:${slotCandidate.day}`;
						const dailyUsed = facultyDailyMinutes.get(dailyKey) ?? 0;
						const hardDailyLimitMinutes = placementSemantics?.hardDailyLimitMinutes ?? policy.maxTeachingMinutesPerDay;
						if (dailyUsed + item.durationPerSession > hardDailyLimitMinutes) {
							sessionFailureReasons.add('FACULTY_OVERLOADED');
							sawDailyHardLimit = true;
							policyBlockedForSession = true;
							policyBlockedForFaculty = true;
							continue;
						}

						if (
							placementSemantics?.enforceConsecutiveBreakAsHard === true
							&& wouldExceedConsecutive(facId, slotCandidate.day, slotCandidate.startTime, slotCandidate.endTime, item.durationPerSession)
						) {
							sessionFailureReasons.add('NO_AVAILABLE_SLOT');
							sawConsecutiveHardLimit = true;
							policyBlockedForSession = true;
							policyBlockedForFaculty = true;
							continue;
						}
					}

					const roomBaseOrder = new Map(compatibleRooms.map((room, index) => [room.id, index]));
					const sortedRooms = isModularUnified
						? compatibleRooms
						: [...compatibleRooms].sort((left, right) => {
							const scoreDiff = scoreRoomForFacultyAtSlot(left, facId, slotCandidate.day, slotCandidate.startTime, slotCandidate.endTime)
								- scoreRoomForFacultyAtSlot(right, facId, slotCandidate.day, slotCandidate.startTime, slotCandidate.endTime);
							if (scoreDiff !== 0) return scoreDiff;
							const baseOrderDiff = (roomBaseOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
								- (roomBaseOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER);
							if (baseOrderDiff !== 0) return baseOrderDiff;
							return left.id - right.id;
						});

					let capacityRejectedForFaculty = false;
					let capacityOverrideUsedForPlacement = false;
					let sawOpenRoomForFaculty = false;
					for (const room of sortedRooms) {
						if (roomOcc.isOccupied(room.id, slotCandidate.day, slot.startTime, slot.endTime)) {
							continue;
						}
						sawOpenRoomForFaculty = true;
						const exceedsRoomCapacity = room.capacity != null && item.enrolledCount > room.capacity;
						const canBypassCapacityForHomeRoom = exceedsRoomCapacity
							&& useHomeRoomPriority
							&& item.entryKind === 'SECTION'
							&& item.gradeLevel >= 9
							&& preferredHomeRoomId != null
							&& room.id === preferredHomeRoomId
							&& room.type === 'CLASSROOM';
						if (exceedsRoomCapacity && !canBypassCapacityForHomeRoom) {
							capacityRejectedForFaculty = true;
							continue;
						}
						if (canBypassCapacityForHomeRoom) {
							capacityOverrideUsedForPlacement = true;
						}

						if (!deferSpecializedRoomTypePreference && subject.requiredFeatures && subject.requiredFeatures.length > 0) {
							const roomFeatures = new Set(room.features || []);
							if (!subject.requiredFeatures.every((feature) => roomFeatures.has(feature))) continue;
						}

						if (getDemandSectionIds(item).some((sectionId) => wouldCreateConsecutiveLab(sectionId, slotCandidate.day, slotCandidate.startTime, slotCandidate.endTime, room.type))) continue;

						if (preferredHomeRoomId != null && room.id !== preferredHomeRoomId) {
							if (sameZoneStandardRooms.some((sameZoneRoom) => sameZoneRoom.id === room.id)) {
								fallbackCauseForPlacement = 'HOME_ROOM_OCCUPIED';
							} else if (sameZoneStandardRooms.length === 0 && broaderStandardRooms.length > 0) {
								fallbackCauseForPlacement = 'NO_SAME_ZONE_STANDARD_ROOM';
							} else {
								fallbackCauseForPlacement = 'HOME_ROOM_OCCUPIED';
							}
						}

					entryCounter++;
					const usedCrossBuildingFallback = preferredHomeRoomId != null && broaderStandardRooms.some((broaderRoom) => broaderRoom.id === room.id);
					const usedSameZoneFallback = preferredHomeRoomId != null && sameZoneStandardRooms.some((sameZoneRoom) => sameZoneRoom.id === room.id);

					// Prompt 01: for a modular lane, resolve the ACTUAL per-term teachers
					// now that the slot (day/time) is known. Pick, per term, the first
					// ranked candidate who is not already reserved for this slot by an
					// earlier lane — this is what prevents 10 sections at the same
					// day/time from all taking the same teacher.
					let resolvedModularAssignments = modularAssignmentInfo?.assignments ?? [];
					if (isModularUnified && modularAssignmentInfo && modularCandidatePoolByTerm.size > 0) {
						resolvedModularAssignments = modularAssignmentInfo.assignments.map((assignment) => {
							const pool = modularCandidatePoolByTerm.get(assignment.termIndex) ?? [];
							if (pool.length === 0) return assignment;
							const chosen = pool.find((candidate) =>
								!facultyOcc.isOccupied(candidate, slotCandidate.day, slot.startTime, slot.endTime),
							) ?? pool[pool.length - 1];
							return { ...assignment, facultyId: chosen };
						});
					}
						const fallbackTier = preferredHomeRoomId == null
							? 'GENERAL_POOL'
							: room.id === preferredHomeRoomId
								? 'HOME_ROOM'
								: usedSameZoneFallback
									? 'SAME_ZONE'
									: usedCrossBuildingFallback
										? 'CROSS_BUILDING'
										: 'GENERAL_POOL';
						entries.push({
							entryId: `entry-${entryCounter}`,
							facultyId: isModularUnified ? null : facId,
							roomId: room.id,
							subjectId: item.subjectId,
							sectionId: item.sectionId,
							day: slotCandidate.day,
							startTime: slot.startTime,
							endTime: slot.endTime,
							durationMinutes: item.durationPerSession,
							termIndex: sessionTermIndex,
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
						metadata: isModularUnified
							? {
								roomAssignmentReason: 'MODULAR_POOL_ASSIGNED',
								modularGroupId: item.modularGroupId ?? undefined,
								modularAssignments: resolvedModularAssignments,
								deferredRoomTypePreference: true,
								deferredPreferredRoomType: requestedRoomType,
							}
								: {
									roomAssignmentReason: preferredHomeRoomId != null
										? (room.id === preferredHomeRoomId
											? 'HOME_ROOM_ASSIGNED'
											: usedCrossBuildingFallback
												? 'CROSS_BUILDING_FALLBACK_ASSIGNED'
												: 'HOME_ROOM_UNAVAILABLE')
										: (isSpecializedDemand && SPECIALIZED_ROOM_TYPES.has(room.type)
											? 'SPECIALIZED_ROOM'
											: 'GENERAL_POOL_ASSIGNED'),
									homeRoomFallbackCause: preferredHomeRoomId != null && room.id !== preferredHomeRoomId
										? fallbackCauseForPlacement
										: undefined,
									crossBuildingFallbackUsed: usedCrossBuildingFallback || undefined,
									fallbackTier,
									fallbackTrace: preferredHomeRoomId != null ? ['HOME_ROOM', 'SAME_ZONE', 'CROSS_BUILDING'] : undefined,
									capacityOverflowBypass: capacityOverrideUsedForPlacement || undefined,
									deferredRoomTypePreference: deferSpecializedRoomTypePreference || undefined,
									deferredPreferredRoomType: deferSpecializedRoomTypePreference ? requestedRoomType : undefined,
								},
						});

					if (!isModularUnified) {
						facultyOcc.mark(facId, slotCandidate.day, slot.startTime, slot.endTime);
					} else if (resolvedModularAssignments.length > 0) {
						// Prompt 01: modular compact lanes reserve their per-term teachers
						// for the chosen day/time. Every consumer of this lane sees these
						// effective reservations; the constructor must track them too so
						// a later lane cannot silently double-book the same teacher.
						for (const assignment of resolvedModularAssignments) {
							facultyOcc.mark(assignment.facultyId, slotCandidate.day, slot.startTime, slot.endTime);
							chargeFacultyLoad(assignment.facultyId, item.durationPerSession, assignment.termIndex);
						}
					}
					roomOcc.mark(room.id, slotCandidate.day, slot.startTime, slot.endTime);
						for (const sectionId of getDemandSectionIds(item)) {
							sectionOcc.mark(sectionId, slotCandidate.day, slot.startTime, slot.endTime);
						}

						if (!isModularUnified) {
							// Charge the term this session actually runs in (TL-02 per-term lane model).
							chargeFacultyLoad(facId, item.durationPerSession, sessionTermIndex);
							const dailyKey = `${facId}:${slotCandidate.day}`;
							facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + item.durationPerSession);
							const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
							// Store with startTime/endTime for constraint checks
							dayPeriods.push({ startTime: slotCandidate.startTime, endTime: slotCandidate.endTime, duration: item.durationPerSession });
							facultyDayPeriods.set(dailyKey, dayPeriods);
						}

						daysUsedForPair.add(slotCandidate.day);
						placed = true;

						if (LAB_ROOM_TYPES.has(room.type)) {
							for (const sectionId of getDemandSectionIds(item)) {
								const labKey = `${sectionId}:${slotCandidate.day}`;
								const labPeriods = sectionDayLabPeriods.get(labKey) ?? [];
								labPeriods.push({ startTime: slotCandidate.startTime, endTime: slotCandidate.endTime });
								sectionDayLabPeriods.set(labKey, labPeriods);
							}
						}
						break;
					}

					if (!placed && capacityRejectedForFaculty) {
						sawCapacityBlockedRoomForSession = true;
					} else if (!placed && !policyBlockedForFaculty) {
						sessionFailureReasons.add('NO_COMPATIBLE_ROOM');
					}
				}

				if (!placed && sawCapacityBlockedRoomForSession) {
					sessionFailureReasons.add('ROOM_CAPACITY_EXCEEDED');
				}
			}

			if (placed) {
				assignedCount++;
			} else {
				if (policyBlockedForSession) {
					policyBlockedCount++;
				}
				// Priority of reasons: NO_QUALIFIED > FACULTY_OVERLOADED > ROOM_CAPACITY_EXCEEDED > NO_COMPATIBLE_ROOM > NO_AVAILABLE_SLOT
				let reason: UnassignedItem['reason'] = 'NO_AVAILABLE_SLOT';
				if (sessionFailureReasons.has('NO_QUALIFIED_FACULTY')) reason = 'NO_QUALIFIED_FACULTY';
				else if (sessionFailureReasons.has('FACULTY_OVERLOADED')) reason = 'FACULTY_OVERLOADED';
				else if (sessionFailureReasons.has('ROOM_CAPACITY_EXCEEDED')) reason = 'ROOM_CAPACITY_EXCEEDED';
				else if (sessionFailureReasons.has('NO_COMPATIBLE_ROOM')) reason = 'NO_COMPATIBLE_ROOM';

				const requestedRoomType = item.roomTypePreference ?? subject.preferredRoomType;
				const deferSpecializedRoomTypePreference =
					useHomeRoomPriority
					&& item.entryKind === 'SECTION'
					&& requestedRoomType !== 'CLASSROOM';
				const isSpecializedDemand = !deferSpecializedRoomTypePreference && SPECIALIZED_ROOM_TYPES.has(requestedRoomType);
				const roomAssignmentReason: RoomAssignmentReason = isSpecializedDemand
					? 'SPECIALIZED_ROOM_UNAVAILABLE'
					: reason === 'NO_QUALIFIED_FACULTY'
						? 'NO_QUALIFIED_FACULTY'
						: sawDailyHardLimit || sawConsecutiveHardLimit
							? 'POLICY_SLOT_BLOCKED'
							: reason === 'FACULTY_OVERLOADED' || sawFacultySlotUnavailable
							? 'FACULTY_SLOT_UNAVAILABLE'
								: reason === 'NO_COMPATIBLE_ROOM' || reason === 'ROOM_CAPACITY_EXCEEDED'
									? 'ROOM_PATH_EXHAUSTED'
									: 'FALLBACK_UNRESOLVED';
				const homeRoomFallbackCause: HomeRoomFallbackCause | undefined = preferredHomeRoomId != null
					? (sawDailyHardLimit
						? 'FACULTY_DAILY_LIMIT_EXCEEDED'
						: sawConsecutiveHardLimit
							? 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'
							: sawNoValidPeriodInPolicyWindow
								? 'NO_VALID_PERIOD_IN_POLICY_WINDOW'
						: sawOnlySpecializedRooms
							? 'ONLY_SPECIALIZED_ROOMS_AVAILABLE'
							: sawNoSameZoneStandardRoom
								? (sawCrossBuildingFallbackOptions ? 'CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED' : 'NO_SAME_ZONE_STANDARD_ROOM')
								: 'HOME_ROOM_OCCUPIED')
					: undefined;
				const assignedFacultyIds = qualifiedMap.get(`${item.subjectId}:${item.sectionId}`) ?? [];
				const assignedFacultyId = assignedFacultyIds[0] ?? null;
				// TL-02 term-load diagnostics: when a rotation session is refused for overload,
				// capture the per-term projected load vs the cap so audits distinguish
				// cumulative overage from per-term overage.
				const isFacultyOverloadRefusal = reason === 'FACULTY_OVERLOADED';
				const facultyTermLoad = isFacultyOverloadRefusal && assignedFacultyId != null
					? getFacultyProjectedLoadForTerm(assignedFacultyId, sessionTermIndex)
					: undefined;
				const facultyMaxLoad = isFacultyOverloadRefusal && assignedFacultyId != null
					? facultyMax.get(assignedFacultyId)
					: undefined;
				unassignedItems.push({
					sectionId: item.sectionId,
					subjectId: item.subjectId,
					gradeLevel: item.gradeLevel,
					session: session + 1,
					reason,
					roomAssignmentReason,
					facultyId: assignedFacultyId,
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
					homeRoomId: item.homeRoomId ?? null,
					homeRoomFallbackCause,
					termIndex: sessionTermIndex,
					facultyTermLoad,
					facultyMax: facultyMaxLoad,
				});
				unassignedCount++;
			}
		}
	}

	return {
		entries,
		unassignedItems,
		lockWarnings,
		modularWarnings,
		assignedCount,
		unassignedCount,
		classesProcessed: assignedCount + unassignedCount,
		policyBlockedCount,
	};
}
