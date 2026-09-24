import {
	evaluateCandidateInvariants,
	intervalsOverlap,
	roomCanFitEnrollment,
	type TimetableCandidateInvariantInput,
} from './timetable-candidate-domain.js';

/**
 * Hard-constraint validator for timetable generation runs.
 * Deterministic, unit-testable. No transport or persistence concerns.
 *
 * Consumes a DraftSchedule (array of scheduled class entries) plus
 * reference data (faculty loads, faculty-subject qualifications, room types,
 * subject preferred room types) and emits a typed violation array.
 */

import type { RoomType } from '@prisma/client';
import {
	isPromotableConstraintCode,
	resolveMaxConsecutiveTeachingMinutesBeforeBreak,
	resolvePolicyPlacementSemantics,
} from './scheduling-policy.service.js';
import {
	type BreakWindowRef,
	type SectionScopeRef,
	type ShiftWindowRef,
	normalizeWarningProgramType,
} from './warning-window-authority.service.js';
import {
	expandEffectiveScheduledResources,
	findEffectiveFacultyOverlaps,
	entryTermScope,
	effectiveTermsOverlap,
} from './effective-scheduled-resources.js';
import { roomRequiredFeatures } from './subject-ownership.service.js';

// ─── Violation codes ───

export const VIOLATION_CODES = [
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
	'SECTION_TIME_CONFLICT',
	'FACULTY_OVERLOAD',
	'ROOM_TYPE_MISMATCH',
	'ROOM_FEATURE_MISMATCH',
	'ROOM_CAPACITY_EXCEEDED',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
	'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
	'FACULTY_BREAK_REQUIREMENT_VIOLATED',
	'FACULTY_DAILY_STANDARD_EXCEEDED',
	'FACULTY_DAILY_MAX_EXCEEDED',
	'FACULTY_FLOOR_TRANSITION',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
	'FACULTY_INSUFFICIENT_DAILY_VACANT',
	'FACULTY_LUNCH_WINDOW_VIOLATION',
	'SPECIALIZED_ROOM_UNAVAILABLE',
	'UNASSIGNED_SECTION',
	'ZONE_IMBALANCE_WARNING',
	'SECTION_OVERCOMPRESSED',
	'LACKING_FACULTY',
	'INCOMPLETE_MODULAR_GROUP',
] as const;

export type ViolationCode = (typeof VIOLATION_CODES)[number];

export type ViolationCopy = {
	/** Short operator-facing heading. Never a raw code or enum name. */
	title: string;
	/** One sentence saying what the warning means. */
	meaning: string;
	/** The next action where one exists; empty string only when no action applies. */
	action: string;
};

/**
 * WARNING-READABILITY-C01 (R1): operator-facing copy for every canonical
 * violation code. Presentation only — the constraint math below never reads
 * this map. A code without copy is a defect even when it is unreachable in
 * the current UI, so the readability suite enumerates VIOLATION_CODES and
 * fails on any code missing from this map.
 */
export const VIOLATION_COPY: Record<ViolationCode, ViolationCopy> = {
	FACULTY_TIME_CONFLICT: { title: 'Teacher double-booked', meaning: 'One teacher is assigned to two classes that meet at the same time.', action: 'Move one class or assign another qualified teacher.' },
	ROOM_TIME_CONFLICT: { title: 'Room double-booked', meaning: 'Two classes use the same room at the same time.', action: 'Move one class to a free room or time.' },
	SECTION_TIME_CONFLICT: { title: 'Section double-booked', meaning: 'One class of learners has two lessons scheduled at the same time.', action: 'Move one of the lessons to another time.' },
	FACULTY_OVERLOAD: { title: 'Teacher above weekly load', meaning: 'The teacher is scheduled for more minutes in one week than the saved weekly maximum allows.', action: 'Move classes to another qualified teacher or review the saved load limit.' },
	ROOM_TYPE_MISMATCH: { title: 'Room type does not fit', meaning: 'The assigned room is not of the type the subject needs.', action: 'Choose a room of the required type or correct the subject requirement.' },
	ROOM_FEATURE_MISMATCH: { title: 'Room missing required equipment', meaning: 'The assigned room lacks equipment the subject needs.', action: 'Choose a room with the required equipment or correct the room record.' },
	ROOM_CAPACITY_EXCEEDED: { title: 'Room may be too small', meaning: 'The class has more learners than seats recorded for the room.', action: 'Choose a larger room or verify the room capacity and class size.' },
	FACULTY_SUBJECT_NOT_QUALIFIED: { title: 'Teaching assignment needs review', meaning: 'The saved teaching load does not authorize this teacher for the subject and class.', action: 'Review Teaching Load and assign an authorized teacher.' },
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: { title: 'Long teaching block', meaning: 'The teacher teaches more back-to-back periods than the scheduling policy allows.', action: 'Insert a break or move one period to shorten the block.' },
	FACULTY_BREAK_REQUIREMENT_VIOLATED: { title: 'Break is too short', meaning: 'The rest gap after a long teaching block is shorter than the required break.', action: 'Extend the break or move a neighboring class.' },
	FACULTY_DAILY_STANDARD_EXCEEDED: { title: 'Daily teaching target exceeded', meaning: 'The teacher is above the preferred daily teaching target but below the hard cap.', action: 'Move a class to another day when a more balanced slot is available.' },
	FACULTY_DAILY_MAX_EXCEEDED: { title: 'Daily teaching maximum exceeded', meaning: 'The teacher is scheduled for more minutes in one day than the daily maximum allows.', action: 'Move or reassign at least one class on that day.' },
	FACULTY_FLOOR_TRANSITION: { title: 'Cross-floor move', meaning: 'The teacher finishes on one floor and starts on another without enough time to move.', action: 'Add a gap between the classes or place one of them on the same floor.' },
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { title: 'Too many building changes', meaning: 'The teacher changes buildings more often in one day than the policy recommends.', action: 'Group the teacher classes in fewer buildings.' },
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: { title: 'Not enough time between buildings', meaning: 'Back-to-back classes leave too little time for the teacher to change buildings.', action: 'Add a free period or place the classes in the same building.' },
	FACULTY_EXCESSIVE_IDLE_GAP: { title: 'Long idle gap', meaning: 'The teacher has a long unscheduled gap between classes on one day.', action: 'Move classes closer together when that creates no harder conflict.' },
	FACULTY_EARLY_START_PREFERENCE: { title: 'Starts earlier than preferred', meaning: 'The first class of the day begins earlier than the teacher preferred start.', action: 'Move the first class later when another valid slot is available.' },
	FACULTY_LATE_END_PREFERENCE: { title: 'Ends later than preferred', meaning: 'The last class of the day ends later than the teacher preferred end.', action: 'Move the last class earlier when another valid slot is available.' },
	FACULTY_INSUFFICIENT_DAILY_VACANT: { title: 'Too little preparation time', meaning: 'The teacher has fewer free periods in the day than the preparation target.', action: 'Move a class to another day or redistribute the load.' },
	FACULTY_LUNCH_WINDOW_VIOLATION: { title: 'Teacher has no free lunch window', meaning: 'The teacher is assigned a class across the lunch window of the grade band they teach, so no free block covers it.', action: 'Move the class out of the lunch window or assign another qualified teacher.' },
	SPECIALIZED_ROOM_UNAVAILABLE: { title: 'Specialized room unavailable', meaning: 'No suitable specialized room was free for this session.', action: 'Free a suitable room, change the time, or review whether the specialization is required.' },
	UNASSIGNED_SECTION: { title: 'Class session unassigned', meaning: 'A required class session could not be placed in the timetable.', action: 'Open the unassigned queue and resolve its teacher, room, or time blocker.' },
	ZONE_IMBALANCE_WARNING: { title: 'Campus zone imbalance (retired)', meaning: 'An older run recorded a campus-zone concentration warning that current ATLAS no longer calculates.', action: 'Regenerate with the current policy before acting on this historical warning.' },
	SECTION_OVERCOMPRESSED: { title: 'Class day is too compressed', meaning: 'The class has too many back-to-back periods without a sufficient break.', action: 'Spread the classes out or add a break.' },
	LACKING_FACULTY: { title: 'No teacher available', meaning: 'A required session has no qualified teacher available.', action: 'Assign a qualified teacher in Teaching Load or free an authorized teacher.' },
	INCOMPLETE_MODULAR_GROUP: { title: 'Rotating subject group incomplete', meaning: 'A rotating subject family is missing a required term-specific member or assignment.', action: 'Complete the subject, teacher, and room assignments for every term.' },
};

// ─── Draft schedule input shape ───

export interface ScheduledEntry {
	/** Unique id of this class assignment within the draft */
	entryId: string;
	facultyId: number | null;
	roomId: number;
	subjectId: number;
	subjectCode?: string | null;
	sectionId: number;
	day: string;          // e.g. 'MONDAY'
	startTime: string;    // HH:mm
	endTime: string;      // HH:mm
	durationMinutes: number;
	termIndex?: 1 | 2 | 3 | 4;
	entryKind?: 'SECTION' | 'COHORT';
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	specializationCode?: string | null;
	specializationName?: string | null;
	cohortMemberSectionIds?: number[];
	cohortExpectedEnrollment?: number | null;
	adviserId?: number | null;
	adviserName?: string | null;
	metadata?: {
		roomAssignmentReason?: string;
		homeRoomFallbackCause?:
			| 'HOME_ROOM_OCCUPIED'
			| 'NO_SAME_ZONE_STANDARD_ROOM'
			| 'CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED'
			| 'ONLY_SPECIALIZED_ROOMS_AVAILABLE'
			| 'FACULTY_DAILY_LIMIT_EXCEEDED'
			| 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'
			| 'NO_VALID_PERIOD_IN_POLICY_WINDOW'
			| 'POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE';
		crossBuildingFallbackUsed?: boolean;
		fallbackTier?: 'HOME_ROOM' | 'SAME_ZONE' | 'CROSS_BUILDING' | 'GENERAL_POOL';
		fallbackTrace?: string[];
		capacityOverflowBypass?: boolean;
		deferredRoomTypePreference?: boolean;
		deferredPreferredRoomType?: RoomType;
		/**
		 * R5/D-E closed-set deviation reason recorded by the constructor when the
		 * resolved room authority was not satisfied by a room of its own type.
		 */
		roomAuthorityDeviationReason?:
			| 'HOME_ROOM_CONTRACT'
			| 'PREFERRED_ROOM_UNUSABLE_NO_COMPATIBLE_ROOM'
			| 'PREFERRED_ROOM_UNUSABLE_CAPACITY'
			| 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES';
		modularGroupId?: string;
		modularAssignments?: Array<{
			termIndex: 1 | 2 | 3 | 4;
			facultyId: number;
			subjectCode: string;
		}>;
	};
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
	features?: string[];
	/** Authoritative vertical position (Room.floor). `floorNumber` is never consulted. */
	floor?: number | null;
}

export interface SubjectRef {
	id: number;
	preferredRoomType: RoomType;
	requiredFeatures?: string[];
}

export interface PolicyRef {
	/**
	 * Explicit consecutive-teaching threshold in minutes. When absent (or when
	 * the persisted value is the retired non-slot-aligned constant) the
	 * slot-aligned default `periodLengthMinutes × allowedConsecutivePeriods` is
	 * derived — see `resolveMaxConsecutiveTeachingMinutesBeforeBreak`.
	 */
	maxConsecutiveTeachingMinutesBeforeBreak?: number;
	/** Authoritative slot length; the consecutive threshold derives from it. */
	periodLengthMinutes?: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
	/** D9 — teacher-lunch constraint switches (absent = disabled, legacy callers). */
	enableTeacherLunchWindow?: boolean;
	enforceTeacherLunchWindow?: boolean;
	/** D9 fallback lunch window, used only when no canonical/grade-scoped lunch row applies. */
	lunchStartTime?: string;
	lunchEndTime?: string;
	enableLunchWindow?: boolean;
}

/**
 * Warning-family policy (R2/R3). The legacy
 * `enableTravelWellbeingChecks`/`maxWalkingDistanceMetersPerTransition` fields
 * remain only for backward compatibility with older callers; they never gate a
 * family in this validator. Each family is gated by its own flag (resolved once
 * through `resolveWarningFamilyPolicy`) and by its per-code `enabled` override.
 */
export interface TravelPolicyRef {
	/** @deprecated legacy master switch — never consulted for gating. */
	enableTravelWellbeingChecks?: boolean;
	/** @deprecated false-precision metric threshold — no producer remains. */
	maxWalkingDistanceMetersPerTransition?: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
	enableBuildingTransitionChecks?: boolean;
	enableFloorTransitionChecks?: boolean;
	enableIdleGapChecks?: boolean;
	enableEarlyStartChecks?: boolean;
	enableLateEndChecks?: boolean;
	buildingTransitionBufferMinutes?: number;
	floorTransitionThreshold?: number;
	floorTransitionBufferMinutes?: number;
}

export interface BuildingRef {
	id: number;
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
	/**
	 * C07A — configured non-teaching (break) windows: recess, lunch, flag
	 * ceremony, and the shift-specific `PolicySpecialEvent` break rows. Time
	 * inside these windows is never counted as idle and a gap fully covered by a
	 * configured break resets the consecutive block.
	 *
	 * When absent/empty the legacy behavior is preserved (no window is excluded):
	 * an absent authority means "not configured", never "no break exists".
	 */
	breakWindows?: BreakWindowRef[];
	/**
	 * C07A — applicable teaching-shift windows (persisted `GradeShiftWindow`
	 * rows). Only time inside a window that applies to BOTH bounding entries is
	 * counted as idle, so cross-shift time is never reported as idle.
	 *
	 * When absent/empty no shift restriction is applied (legacy full-gap count).
	 */
	shiftWindows?: ShiftWindowRef[];
	/** sectionId → grade/program scope used to resolve which windows apply. */
	sectionScope?: Map<number, SectionScopeRef>;
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

const timesOverlap = intervalsOverlap;

export function evaluateManualCandidateInvariants(input: TimetableCandidateInvariantInput) {
	return evaluateCandidateInvariants(input);
}

/**
 * C07A — one constraint-override contract for every emitted violation.
 *
 * The validator's own violations and the violations injected by the generation
 * service (unassigned sessions, modular-group warnings) must obey
 * the SAME configured authority: a disabled SOFT constraint is dropped, an
 * allowlisted `treatAsHard` promotes a SOFT constraint to HARD, and the
 * configured weight is attached. A non-allowlisted `treatAsHard` never promotes
 * (R4 trust boundary).
 */
export function applyConstraintOverrides(
	violations: Violation[],
	constraintConfig: Record<string, ConstraintOverrideRef> | null | undefined,
): Violation[] {
	if (!constraintConfig) return violations;
	const result: Violation[] = [];
	for (const v of violations) {
		const override = constraintConfig[v.code];
		if (!override) {
			// No override for this code — keep as-is (hard constraints, etc.)
			result.push(v);
			continue;
		}
		// If override disables this constraint and the violation is SOFT, drop it
		if (!override.enabled && v.severity === 'SOFT') continue;
		const severity = (override.treatAsHard && v.severity === 'SOFT' && isPromotableConstraintCode(v.code))
			? 'HARD' as const
			: v.severity;
		result.push({
			...v,
			severity,
			meta: { ...v.meta, constraintWeight: override.weight },
		});
	}
	return result;
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

const TERM_KEY_SEP = '\u0001';

/**
 * R5 — term-aware grouping for every faculty/day and section/day calculation.
 *
 * A per-term-resolved entry contributes its minutes only inside each ordered
 * term. An unscoped (year-round) entry contributes to every term observed in
 * the schedule, so its repeating load is never summed across terms into a
 * fabricated HARD daily-max violation.
 *
 * `buildKey(entry, term)` must produce a stable key including the term bucket.
 */
function groupEntriesByTerm<T extends { termIndex?: number }>(
	entries: T[],
	buildKey: (entry: T, term: number) => string,
): Map<string, T[]> {
	const observedTerms = new Set<number>();
	for (const entry of entries) {
		const scope = entryTermScope(entry);
		if (scope > 0) observedTerms.add(scope);
	}
	const buckets = observedTerms.size > 0 ? [...observedTerms] : [0];

	const grouped = new Map<string, T[]>();
	for (const entry of entries) {
		const scope = entryTermScope(entry);
		const targets = scope > 0 ? [scope] : buckets;
		for (const term of targets) {
			const key = buildKey(entry, term);
			const arr = grouped.get(key);
			if (arr) arr.push(entry);
			else grouped.set(key, [entry]);
		}
	}
	return grouped;
}

function facultyDayTermKey(entry: ScheduledEntry, term: number): string {
	return `${entry.facultyId}${TERM_KEY_SEP}${entry.day}${TERM_KEY_SEP}${term}`;
}

function sectionDayTermKey(sectionId: number, entry: ScheduledEntry, term: number): string {
	return `${sectionId}${TERM_KEY_SEP}${entry.day}${TERM_KEY_SEP}${term}`;
}

function parseFacultyDayTermKey(key: string): { facultyId: number; day: string } {
	const [facultyId, day] = key.split(TERM_KEY_SEP);
	return { facultyId: Number(facultyId), day };
}

function parseSectionDayTermKey(key: string): { sectionId: number; day: string } {
	const [sectionId, day] = key.split(TERM_KEY_SEP);
	return { sectionId: Number(sectionId), day };
}

// ─── C07A window authority helpers ───

interface MinuteInterval {
	start: number;
	end: number;
}

/**
 * Total length of the union of `intervals` clipped to `[start, end)`.
 * Deterministic: intervals are sorted and merged before measurement.
 */
function coveredMinutes(intervals: MinuteInterval[], start: number, end: number): number {
	if (intervals.length === 0 || end <= start) return 0;
	const sorted = [...intervals].sort((left, right) => left.start - right.start || left.end - right.end);
	let covered = 0;
	let cursor = start;
	for (const interval of sorted) {
		const from = Math.max(interval.start, start);
		const to = Math.min(interval.end, end);
		if (to <= from) continue;
		if (from > cursor) cursor = from;
		if (to > cursor) {
			covered += to - cursor;
			cursor = to;
		}
		if (cursor >= end) break;
	}
	return covered;
}

function scopeMatches(
	window: { gradeLevel?: number | null; programType?: string | null },
	scope: SectionScopeRef | null,
): boolean {
	if (window.gradeLevel != null) {
		if (scope == null || window.gradeLevel !== scope.gradeLevel) return false;
		if (window.programType != null) {
			if (normalizeWarningProgramType(window.programType) !== normalizeWarningProgramType(scope.programType)) return false;
		}
		return true;
	}
	if (window.programType != null) {
		if (scope == null || normalizeWarningProgramType(window.programType) !== normalizeWarningProgramType(scope.programType)) return false;
	}
	return true;
}

function shiftWindowKey(window: MinuteInterval): string {
	return `${window.start}-${window.end}`;
}

function toMinuteInterval(window: { startTime: string; endTime: string }): MinuteInterval | null {
	const start = timeToMinutes(window.startTime);
	const end = timeToMinutes(window.endTime);
	return end > start ? { start, end } : null;
}

/**
 * Break windows applicable to one entry on one weekday. A window with no
 * `dayOfWeek` applies every weekday; Flag/HGP is Monday-only.
 */
function breakWindowsForEntry(
	ctx: ValidatorContext,
	entry: ScheduledEntry,
	day: string,
): MinuteInterval[] {
	const windows = ctx.breakWindows;
	if (!windows || windows.length === 0) return [];
	const scope = ctx.sectionScope?.get(entry.sectionId) ?? null;
	const intervals: MinuteInterval[] = [];
	for (const window of windows) {
		if (!scopeMatches(window, scope)) continue;
		const windowDay = (window.dayOfWeek ?? '').trim().toUpperCase();
		if (windowDay && windowDay !== day) continue;
		const interval = toMinuteInterval(window);
		if (interval) intervals.push(interval);
	}
	return intervals;
}

/** Union of the break windows applicable to any entry of a faculty/day group. */
function groupBreakIntervals(ctx: ValidatorContext, entries: ScheduledEntry[], day: string): MinuteInterval[] {
	const intervals: MinuteInterval[] = [];
	for (const entry of entries) intervals.push(...breakWindowsForEntry(ctx, entry, day));
	return intervals;
}

/**
 * Shift windows applicable to an entry. Returns `null` when the context carries
 * no shift authority at all, which preserves the legacy full-gap behavior.
 */
function shiftWindowsForEntry(ctx: ValidatorContext, entry: ScheduledEntry): MinuteInterval[] | null {
	const windows = ctx.shiftWindows;
	if (!windows || windows.length === 0) return null;
	const scope = ctx.sectionScope?.get(entry.sectionId) ?? null;
	const intervals: MinuteInterval[] = [];
	for (const window of windows) {
		if (!scopeMatches(window, scope)) continue;
		const interval = toMinuteInterval(window);
		if (interval) intervals.push(interval);
	}
	return intervals;
}

/**
 * Idle minutes for a gap between two consecutive entries on the same day.
 *
 *   - No shift authority → the whole gap is counted (legacy behavior).
 *   - Shift authority present → only the portion inside a shift window that
 *     applies to BOTH entries counts. Cross-shift time is therefore never
 *     reported as idle.
 *   - Configured break windows inside the counted region are always excluded.
 */
function idleMinutesForGap(
	ctx: ValidatorContext,
	prev: ScheduledEntry,
	curr: ScheduledEntry,
	day: string,
	breakIntervals: MinuteInterval[],
): number {
	const gapStart = timeToMinutes(prev.endTime);
	const gapEnd = timeToMinutes(curr.startTime);
	if (gapEnd <= gapStart) return 0;

	const prevShifts = shiftWindowsForEntry(ctx, prev);
	const currShifts = shiftWindowsForEntry(ctx, curr);

	let inShift: number;
	if (prevShifts == null || currShifts == null) {
		inShift = gapEnd - gapStart;
	} else {
		const shared = new Map<string, MinuteInterval>();
		const currKeys = new Set(currShifts.map(shiftWindowKey));
		for (const window of prevShifts) {
			const key = shiftWindowKey(window);
			if (currKeys.has(key)) shared.set(key, window);
		}
		inShift = coveredMinutes([...shared.values()], gapStart, gapEnd);
	}

	const breakCovered = Math.min(coveredMinutes(breakIntervals, gapStart, gapEnd), inShift);
	return inShift - breakCovered;
}

/**
 * True when the entire positive gap is covered by configured break windows —
 * a canonical configured break. Such a gap satisfies the break requirement and
 * must reset the consecutive block without emitting a violation.
 */
function isCanonicalBreakGap(breakIntervals: MinuteInterval[], gapStart: number, gapEnd: number): boolean {
	const gap = gapEnd - gapStart;
	if (gap <= 0) return false;
	return coveredMinutes(breakIntervals, gapStart, gapEnd) >= gap;
}

function minutesToClock(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * D9 — the lunch windows that apply to one faculty/day group.
 *
 * A teacher's lunch window is the lunch window of the grade band they teach:
 * the effective `LUNCH_BREAK` break windows already resolved for the scopes of
 * the group's sections — canonical grade-scoped rows when present, otherwise
 * the persisted `PolicySpecialEvent` rows. When no such window exists the
 * policy row's own lunch window is the fallback. An absent authority yields no
 * window, so the constraint never invents a lunch band.
 */
function teacherLunchWindowsForGroup(
	ctx: ValidatorContext,
	entries: ScheduledEntry[],
): Array<{ start: number; end: number; label: string }> {
	const windows = ctx.breakWindows ?? [];
	const seen = new Set<string>();
	const result: Array<{ start: number; end: number; label: string }> = [];
	for (const entry of entries) {
		const scope = ctx.sectionScope?.get(entry.sectionId) ?? null;
		for (const window of windows) {
			if (String(window.eventType).trim().toUpperCase() !== 'LUNCH_BREAK') continue;
			if (!scopeMatches(window, scope)) continue;
			const interval = toMinuteInterval(window);
			if (!interval) continue;
			const key = `${interval.start}-${interval.end}`;
			if (seen.has(key)) continue;
			seen.add(key);
			result.push({ start: interval.start, end: interval.end, label: window.label || 'Lunch Break' });
		}
	}
	if (result.length === 0 && ctx.policy) {
		const lunchEnabled = ctx.policy.enableLunchWindow !== false;
		const start = ctx.policy.lunchStartTime;
		const end = ctx.policy.lunchEndTime;
		if (lunchEnabled && start && end) {
			const interval = toMinuteInterval({ startTime: start, endTime: end });
			if (interval) result.push({ start: interval.start, end: interval.end, label: 'Lunch Break' });
		}
	}
	return result;
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

	// ── 1) Faculty time conflict (canonical effective-resource view) ──
	// Prompt 01 (Dynamic Timetable Recovery): modular compact entries carry their
	// real teachers in metadata.modularAssignments; the top-level facultyId is
	// null. Validating only entry.facultyId hid real teacher double-bookings
	// (run 633's hidden-overlap class). Expand every entry into per-teacher,
	// per-term effective reservations and detect overlaps with term-scope
	// semantics: same teacher + same day + overlapping intervals + overlapping
	// terms (term 0 = year-round overlaps all; distinct terms rotate).
	{
		const effectiveReservations = expandEffectiveScheduledResources(ctx.entries);
		const effectiveOverlaps = findEffectiveFacultyOverlaps(effectiveReservations);
		for (const { a, b } of effectiveOverlaps) {
			if (isSameCohortGroup(
				ctx.entries.find((e) => e.entryId === a.entryId) as ScheduledEntry,
				ctx.entries.find((e) => e.entryId === b.entryId) as ScheduledEntry,
			)) continue;
			violations.push({
				...base,
				code: 'FACULTY_TIME_CONFLICT',
				message: `Faculty ${a.facultyId} has overlapping assignments on ${a.day}: ${a.startTime}-${a.endTime} vs ${b.startTime}-${b.endTime}${a.termIndex !== b.termIndex && a.termIndex !== 0 && b.termIndex !== 0 ? '' : ` (term scope: ${a.termIndex} vs ${b.termIndex})`}.`,
				entities: { facultyId: a.facultyId, day: a.day, startTime: a.startTime, endTime: b.endTime, entryIds: [a.entryId, b.entryId] },
			});
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
				// TT-OUTPUT-C03R3: term-aware conflict identity. Rotating/longitudinal
				// entries in different ordered terms may share the same room and
				// interval; only same-term (or unscoped) overlaps conflict.
				if (!effectiveTermsOverlap(entryTermScope(a), entryTermScope(b))) continue;
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

	// ── 3) Section time conflict ──
	const bySectionDay = new Map<string, ScheduledEntry[]>();
	for (const entry of ctx.entries) {
		for (const sectionId of getEffectiveSectionIds(entry)) {
			const key = `${sectionId}:${entry.day}`;
			const entries = bySectionDay.get(key);
			if (entries) entries.push(entry);
			else bySectionDay.set(key, [entry]);
		}
	}

	for (const [key, dayEntries] of bySectionDay) {
		const [rawSectionId, day] = key.split(':');
		const sectionId = Number(rawSectionId);
		for (let index = 0; index < dayEntries.length; index++) {
			for (let nextIndex = index + 1; nextIndex < dayEntries.length; nextIndex++) {
				const left = dayEntries[index];
				const right = dayEntries[nextIndex];
				if (left.entryId === right.entryId) continue;
				// TT-OUTPUT-C03R3: a section repeats the same weekly grid in every
				// ordered term; only same-term (or unscoped) overlaps conflict.
				if (!effectiveTermsOverlap(entryTermScope(left), entryTermScope(right))) continue;
				if (timesOverlap(left, right) && !isSameCohortGroup(left, right)) {
					violations.push({
						...base,
						code: 'SECTION_TIME_CONFLICT',
						message: `Section ${sectionId} has overlapping assignments on ${day}: ${left.startTime}-${left.endTime} vs ${right.startTime}-${right.endTime}.`,
						entities: {
							sectionId,
							day,
							startTime: left.startTime,
							endTime: right.endTime,
							entryIds: [left.entryId, right.entryId],
						},
					});
				}
			}
		}
	}

	// ── 4) Faculty load over max (canonical effective-resource view, term-aware) ──
	// Product contract (TL-02 + Prompt 01): the weekly cap bounds a teacher's
	// CONCURRENT weekly load — what they teach in any single week of a term.
	// Modular reservations rotate across terms, so a teacher's concurrent load is
	// the per-term sum of their reservations in that term; the cap applies to the
	// WORST term. Direct (year-round) reservations count in every term.
	{
		const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
		// facultyId -> termIndex -> minutes (term 0 = year-round direct)
		const minutesByFacultyTerm = new Map<number, Map<number, number>>();
		const effectiveReservations = expandEffectiveScheduledResources(ctx.entries);
		for (const r of effectiveReservations) {
			const dur = toMin(r.endTime) - toMin(r.startTime);
			const terms = minutesByFacultyTerm.get(r.facultyId) ?? new Map<number, number>();
			terms.set(r.termIndex, (terms.get(r.termIndex) ?? 0) + dur);
			minutesByFacultyTerm.set(r.facultyId, terms);
		}

		for (const [facultyId, terms] of minutesByFacultyTerm) {
			const fac = facultyMap.get(facultyId);
			if (!fac) continue;
			const maxMinutes = fac.maxHoursPerWeek * 60;
			// Concurrent weekly load = direct (term 0) + the worst rotation term.
			const direct = terms.get(0) ?? 0;
			let worstTerm = 0;
			for (const [term, mins] of terms) if (term !== 0 && mins > worstTerm) worstTerm = mins;
			const concurrentMinutes = direct + worstTerm;
			if (concurrentMinutes > maxMinutes) {
				violations.push({
					...base,
					code: 'FACULTY_OVERLOAD',
					message: `Faculty ${facultyId} concurrently assigned ${concurrentMinutes} min/week (term-peak), exceeds max ${maxMinutes} min (${fac.maxHoursPerWeek} h).`,
					entities: { facultyId },
					meta: { totalMinutes: concurrentMinutes, maxMinutes, maxHoursPerWeek: fac.maxHoursPerWeek, directMinutes: direct, worstTermMinutes: worstTerm },
				});
			}
		}
	}

	// ── 5) Room/type incompatibility (R5: only on genuine preferred-room failure) ──
	for (const e of ctx.entries) {
		const room = roomMap.get(e.roomId);
		const subject = subjectMap.get(e.subjectId);
		if (!room || !subject) continue;

		// R5/D-E: the resolved authority is the persisted `Subject.preferredRoomType`.
		// `ROOM_TYPE_MISMATCH` is emitted ONLY when the placed room type does not
		// satisfy that authority AND the constructor recorded an auditable
		// `PREFERRED_ROOM_UNUSABLE_*` reason. A satisfied authority and the
		// documented classroom/home-room contract never emit it. `HARD` is reserved
		// for an unsatisfied authority with NO recorded reason (a regression signal
		// that must never occur in accepted fixtures).
		const deviationReason = e.metadata?.roomAuthorityDeviationReason;
		const recordedPreferredRoomFailure = deviationReason === 'PREFERRED_ROOM_UNUSABLE_NO_COMPATIBLE_ROOM'
			|| deviationReason === 'PREFERRED_ROOM_UNUSABLE_CAPACITY'
			|| deviationReason === 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES';
		const documentedHomeRoomContract = deviationReason === 'HOME_ROOM_CONTRACT';
		const isModularPoolAssignment = e.metadata?.roomAssignmentReason === 'MODULAR_POOL_ASSIGNED';

		// Type match
		if (room.type !== subject.preferredRoomType && !documentedHomeRoomContract) {
			const shouldDeferRoomType = recordedPreferredRoomFailure
				|| isModularPoolAssignment
				|| e.metadata?.deferredRoomTypePreference === true;
			violations.push({
				...base,
				severity: shouldDeferRoomType ? 'SOFT' : 'HARD',
				code: 'ROOM_TYPE_MISMATCH',
				message: shouldDeferRoomType
					? `Entry ${e.entryId}: room ${e.roomId} uses the documented home-room contract because subject ${e.subjectId} could not use its preferred "${subject.preferredRoomType}" room${deviationReason ? ` (${deviationReason})` : ''}.`
					: `Entry ${e.entryId}: room ${e.roomId} type "${room.type}" does not match subject ${e.subjectId} preferred type "${subject.preferredRoomType}" and no deviation reason was recorded.`,
				entities: { roomId: e.roomId, subjectId: e.subjectId, sectionId: e.sectionId, entryIds: [e.entryId] },
				meta: {
					roomType: room.type,
					preferredRoomType: subject.preferredRoomType,
					deferredRoomTypePreference: shouldDeferRoomType,
					deferredByModularPool: isModularPoolAssignment,
					roomAuthorityDeviationReason: deviationReason ?? null,
					attemptedRoomType: subject.preferredRoomType,
					attemptedCapacity: e.cohortExpectedEnrollment ?? ctx.sectionEnrollment?.get(e.sectionId) ?? null,
					roomAssignmentReason: e.metadata?.roomAssignmentReason,
				},
			});
		}

		// Feature match — same "genuine failure" rule; silent when no features are required.
		// requiredFeatures also carries OWNER_DEPT:<code> ownership markers, which
		// no room declares. They are not room features and must never raise a
		// ROOM_FEATURE_MISMATCH (a HARD violation that would block publication).
		const roomFeatureRequirements = roomRequiredFeatures(subject.requiredFeatures);
		if (roomFeatureRequirements.length > 0) {
			const roomFeatures = new Set(room.features || []);
			const missing = roomFeatureRequirements.filter(f => !roomFeatures.has(f));
			if (missing.length > 0) {
				const shouldDeferRoomFeatures = isModularPoolAssignment || e.metadata?.deferredRoomTypePreference === true;
				violations.push({
					...base,
					severity: shouldDeferRoomFeatures ? 'SOFT' : 'HARD',
					code: 'ROOM_FEATURE_MISMATCH',
					message: shouldDeferRoomFeatures
						? `Entry ${e.entryId}: room ${e.roomId} remains on the documented home-room contract without required specialist features: ${missing.join(', ')}.`
						: `Entry ${e.entryId}: room ${e.roomId} lacks required features: ${missing.join(', ')}.`,
					entities: { roomId: e.roomId, subjectId: e.subjectId, sectionId: e.sectionId, entryIds: [e.entryId] },
					meta: {
						required: roomFeatureRequirements,
						actual: room.features || [],
						missing,
						deferredRoomTypePreference: shouldDeferRoomFeatures,
						deferredByModularPool: isModularPoolAssignment,
						roomAuthorityDeviationReason: deviationReason ?? null,
						roomAssignmentReason: e.metadata?.roomAssignmentReason,
					},
				});
			}
		}
	}

	// ── 4b) Room capacity exceeded ──
	if (ctx.sectionEnrollment) {
		for (const e of ctx.entries) {
			const room = roomMap.get(e.roomId);
			if (!room || room.capacity == null) continue;
			const enrolled = e.cohortExpectedEnrollment ?? ctx.sectionEnrollment.get(e.sectionId) ?? 0;
			if (!roomCanFitEnrollment(room.capacity, enrolled)) {
				violations.push({
					...base,
					severity: 'SOFT',
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

	// ── 5) Faculty-subject qualification ──
	const checkedPairs = new Set<string>();
	for (const e of ctx.entries) {
		if (e.facultyId == null) continue;
		const effectiveSectionIds = getEffectiveSectionIds(e);
		if (e.entryKind === 'COHORT') {
			const cohortPairs = effectiveSectionIds.map((sectionId) => `${e.facultyId}:${e.subjectId}:${sectionId}`);
			const cohortQualified = cohortPairs.some((pairKey) => qualifiedSet.has(pairKey));
			const cohortKey = `COHORT:${e.facultyId}:${e.subjectId}:${effectiveSectionIds.join(',')}`;
			if (!checkedPairs.has(cohortKey) && !cohortQualified) {
				checkedPairs.add(cohortKey);
				violations.push({
					...base,
					code: 'FACULTY_SUBJECT_NOT_QUALIFIED',
					message: `Faculty ${e.facultyId} is not qualified/assigned for subject ${e.subjectId} in any member section of cohort ${e.cohortCode ?? e.sectionId}.`,
					entities: { facultyId: e.facultyId, subjectId: e.subjectId, sectionId: effectiveSectionIds[0] },
					meta: {
						cohortCode: e.cohortCode ?? null,
						memberSectionIds: effectiveSectionIds,
					},
				});
			}
			continue;
		}

		for (const sectionId of effectiveSectionIds) {
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
		const placementSemantics = resolvePolicyPlacementSemantics(policy);
		const severity = placementSemantics.enforceConsecutiveBreakAsHard ? 'HARD' as const : 'SOFT' as const;
		const standardDailyLimitMinutes = 360;
		const hardDailyLimitMinutes = placementSemantics.hardDailyLimitMinutes;
		// C07A: slot-aligned default derived from the authoritative period length;
		// an explicitly configured, slot-aligned persisted threshold is honored.
		const maxConsecutiveMinutes = resolveMaxConsecutiveTeachingMinutesBeforeBreak(policy);
		const resolvedPeriodMinutes = Number.isInteger(Number(policy.periodLengthMinutes)) && Number(policy.periodLengthMinutes) > 0
			? Number(policy.periodLengthMinutes)
			: 45;

		// Group entries by faculty+day+term, sorted by startTime. Term identity is
		// mandatory: a year-long entry repeating in every term must contribute its
		// minutes once per term, never summed across terms.
		const facDayEntries = groupEntriesByTerm(
			ctx.entries.filter((e) => e.facultyId != null),
			facultyDayTermKey,
		);

		for (const [key, dayEntries] of facDayEntries) {
			const { facultyId, day } = parseFacultyDayTermKey(key);
			const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));
			const breakIntervals = groupBreakIntervals(ctx, sorted, day);

			// 6a) Daily teaching target — warn above 6h, hard-block above 8h
			const dailyMinutes = sorted.reduce((sum, e) => sum + e.durationMinutes, 0);
			if (dailyMinutes > standardDailyLimitMinutes && dailyMinutes <= hardDailyLimitMinutes) {
				violations.push({
					...base, severity: 'SOFT',
					code: 'FACULTY_DAILY_STANDARD_EXCEEDED',
					message: `Faculty ${facultyId} teaches ${dailyMinutes} min on ${day}, exceeds the 6 hour standard daily target.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: { dailyMinutes, standardDailyMinutes: standardDailyLimitMinutes },
				});
			}
			if (dailyMinutes > hardDailyLimitMinutes) {
				violations.push({
					...base, severity: 'HARD',
					code: 'FACULTY_DAILY_MAX_EXCEEDED',
					message: `Faculty ${facultyId} teaches ${dailyMinutes} min on ${day}, exceeds hard daily max ${hardDailyLimitMinutes} min.`,
					entities: { facultyId, day, entryIds: sorted.map((e) => e.entryId) },
					meta: { dailyMinutes, maxTeachingMinutesPerDay: hardDailyLimitMinutes },
				});
			}

			// 6b) Consecutive teaching without break + break requirement
			//
			// C07A: exactly ONE violation is emitted per violating contiguous
			// teaching block (the former per-entry emission produced one row per
			// member period), and `entities.entryIds` names every member of that
			// block. A gap that satisfies the break requirement — including a gap
			// fully covered by a configured break window (Health Break, Lunch,
			// Recess, Flag ceremony) — resets the block and emits nothing.
			let consecutiveMinutes = 0;
			let blockEntries: string[] = [];

			const flushBlock = () => {
				if (consecutiveMinutes <= maxConsecutiveMinutes) return;
				violations.push({
					...base, severity,
					code: 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
					message: `Faculty ${facultyId} teaches ${consecutiveMinutes} consecutive minutes (${blockEntries.length} periods) on ${day}, above the ${maxConsecutiveMinutes}-minute limit.`,
					entities: { facultyId, day, entryIds: [...blockEntries] },
					meta: {
						consecutiveMinutes,
						maxConsecutive: maxConsecutiveMinutes,
						periodLengthMinutes: resolvedPeriodMinutes,
						blockEntryIds: [...blockEntries],
					},
				});
			};

			for (let i = 0; i < sorted.length; i++) {
				const entry = sorted[i];

				if (i === 0) {
					consecutiveMinutes = entry.durationMinutes;
					blockEntries = [entry.entryId];
					continue;
				}

				const prev = sorted[i - 1];
				const prevEnd = timeToMinutes(prev.endTime);
				const entryStart = timeToMinutes(entry.startTime);
				const gapMinutes = entryStart - prevEnd;
				const configuredBreakSatisfied = gapMinutes > 0 && isCanonicalBreakGap(breakIntervals, prevEnd, entryStart);
				const breakSatisfied = gapMinutes >= policy.minBreakMinutesAfterConsecutiveBlock || configuredBreakSatisfied;

				if (!breakSatisfied) {
					// Gap exists but is insufficient — emit the break-requirement violation
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
					continue;
				}

				// Gap satisfies the configured break — close the block and restart
				flushBlock();
				consecutiveMinutes = entry.durationMinutes;
				blockEntries = [entry.entryId];
			}
			flushBlock();
		}

		// 6c) D9 — teacher lunch window.
		//
		// A teacher keeps a free block over the lunch window of the grade band
		// they teach. The window is resolved from the effective LUNCH_BREAK
		// windows already scoped to the group's sections (canonical grade-scoped
		// rows when present, otherwise the persisted special-event rows), with
		// the policy row's lunch window as the fallback. Gated by
		// `enableTeacherLunchWindow`; SOFT by default and HARD when
		// `enforceTeacherLunchWindow` is on, so it blocks publication.
		if (ctx.policy.enableTeacherLunchWindow === true) {
			const lunchSeverity = ctx.policy.enforceTeacherLunchWindow === true ? 'HARD' as const : 'SOFT' as const;
			for (const [key, dayEntries] of facDayEntries) {
				const { facultyId, day } = parseFacultyDayTermKey(key);
				const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));
				const lunchWindows = teacherLunchWindowsForGroup(ctx, sorted);
				for (const lunch of lunchWindows) {
					const overlapping = sorted.filter((entry) => {
						const entryStart = timeToMinutes(entry.startTime);
						const entryEnd = timeToMinutes(entry.endTime);
						return entryStart < lunch.end && lunch.start < entryEnd;
					});
					if (overlapping.length === 0) continue;
					violations.push({
						...base, severity: lunchSeverity,
						code: 'FACULTY_LUNCH_WINDOW_VIOLATION',
						message: `Faculty ${facultyId} teaches across the ${lunch.label} window (${minutesToClock(lunch.start)}-${minutesToClock(lunch.end)}) on ${day}; no free block covers the teacher lunch window.`,
						entities: {
							facultyId, day,
							startTime: minutesToClock(lunch.start),
							endTime: minutesToClock(lunch.end),
							entryIds: overlapping.map((entry) => entry.entryId),
						},
						meta: {
							facultyId, day,
							lunchWindowStart: minutesToClock(lunch.start),
							lunchWindowEnd: minutesToClock(lunch.end),
							lunchWindowLabel: lunch.label,
							overlappingEntryIds: overlapping.map((entry) => entry.entryId),
						},
					});
				}
			}
		}
	}

	// ── 7) Transition soft constraints: building transitions + floor transitions ──
	// R1/R2: the false-precision metric travel warning has no producer. Only
	// identity-based building/floor movement is emitted, always term-aware.
	if (ctx.travelPolicy && ctx.roomBuildings) {
		const tp = ctx.travelPolicy;
		const roomToBld = new Map(ctx.roomBuildings.map((rb) => [rb.roomId, rb.buildingId]));
		const bufferMinutes = tp.buildingTransitionBufferMinutes ?? 5;
		const buildingChecksEnabled = tp.enableBuildingTransitionChecks !== false;

		if (buildingChecksEnabled) {
			const byFacDay = groupEntriesByTerm(
				ctx.entries.filter((e) => e.facultyId != null),
				facultyDayTermKey,
			);

			for (const [key, dayEntries] of byFacDay) {
				const { facultyId, day } = parseFacultyDayTermKey(key);
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
					if (fromBldId !== toBldId) {
						buildingTransitions++;
						// 7a) Track back-to-back cross-building with short/no gap.
						if (gapMinutes <= bufferMinutes) backToBackCross++;
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
							configuredThresholds: {
								maxBackToBackTransitionsWithoutBuffer: tp.maxBackToBackTransitionsWithoutBuffer,
								buildingTransitionBufferMinutes: bufferMinutes,
							},
						},
					});
				}
			}
		}

		// 7d) Cross-floor transitions inside one building. Authority is Room.floor
		// only; `floorNumber` is never consulted. 1–2 floor moves never warn.
		const floorChecksEnabled = tp.enableFloorTransitionChecks !== false;
		if (floorChecksEnabled) {
			const floorThreshold = tp.floorTransitionThreshold ?? 3;
			const floorBuffer = tp.floorTransitionBufferMinutes ?? 5;
			const floorByRoom = new Map(ctx.rooms.map((room) => [room.id, room.floor ?? null]));

			const byFacDay = groupEntriesByTerm(
				ctx.entries.filter((e) => e.facultyId != null),
				facultyDayTermKey,
			);

			for (const [key, dayEntries] of byFacDay) {
				const { facultyId, day } = parseFacultyDayTermKey(key);
				const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

				for (let i = 1; i < sorted.length; i++) {
					const prev = sorted[i - 1];
					const curr = sorted[i];
					const fromBldId = roomToBld.get(prev.roomId);
					const toBldId = roomToBld.get(curr.roomId);
					if (fromBldId == null || toBldId == null || fromBldId !== toBldId) continue;

					const fromFloor = floorByRoom.get(prev.roomId) ?? null;
					const toFloor = floorByRoom.get(curr.roomId) ?? null;
					if (fromFloor == null || toFloor == null) continue;

					const floorDelta = Math.abs(toFloor - fromFloor);
					if (floorDelta < floorThreshold) continue;

					const gapMinutes = timeToMinutes(curr.startTime) - timeToMinutes(prev.endTime);
					if (gapMinutes >= floorBuffer) continue;

					violations.push({
						...base, severity: 'SOFT',
						code: 'FACULTY_FLOOR_TRANSITION',
						message: `Faculty ${facultyId} finishes on floor ${fromFloor} at ${prev.endTime} and starts on floor ${toFloor} at ${curr.startTime} on ${day} — ${gapMinutes === 0 ? 'no time' : `only ${gapMinutes} minutes`} to move.`,
						entities: { facultyId, day, entryIds: [prev.entryId, curr.entryId] },
						meta: {
							facultyId, day,
							fromRoomId: prev.roomId, toRoomId: curr.roomId,
							fromBuildingId: fromBldId, toBuildingId: toBldId,
							fromFloor, toFloor, floorDelta, gapMinutes,
							configuredThresholds: {
								floorTransitionThreshold: floorThreshold,
								floorTransitionBufferMinutes: floorBuffer,
							},
						},
					});
				}
			}
		}
	}

	// ── 8) Well-being soft constraints: idle gap, early start, late end ──
	// R3: each family is gated only by its own flag. The deprecated master
	// `enableTravelWellbeingChecks` never gates idle/early/late here.
	if (ctx.travelPolicy) {
		const tp = ctx.travelPolicy;
		const idleEnabled = tp.enableIdleGapChecks !== false;
		const earlyEnabled = tp.enableEarlyStartChecks !== false;
		const lateEnabled = tp.enableLateEndChecks !== false;

		if (idleEnabled || earlyEnabled || lateEnabled) {
			const byFacDayWB = groupEntriesByTerm(
				ctx.entries.filter((e) => e.facultyId != null),
				facultyDayTermKey,
			);

			for (const [key, dayEntries] of byFacDayWB) {
				const { facultyId, day } = parseFacultyDayTermKey(key);
				const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

				// 8a) Excessive idle gap
				//
				// C07A: idle time is only the genuine unscheduled time INSIDE the
				// teacher's applicable shift. Configured break windows (Health
				// Break, Lunch, Recess, Flag ceremony) are non-teaching time and are
				// never counted; cross-shift and outside-shift gaps are never
				// counted. When the context carries no window authority the legacy
				// full-gap behavior is preserved.
				if (idleEnabled) {
					const breakIntervals = groupBreakIntervals(ctx, sorted, day);
					let totalIdleMinutes = 0;
					for (let i = 1; i < sorted.length; i++) {
						totalIdleMinutes += idleMinutesForGap(ctx, sorted[i - 1], sorted[i], day, breakIntervals);
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
								excludedBreakWindows: breakIntervals.length,
								configuredThresholds: { maxIdleGapMinutesPerDay: tp.maxIdleGapMinutesPerDay },
							},
						});
					}
				}

				// 8b) Early start preference
				if (earlyEnabled && sorted.length > 0) {
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
				if (lateEnabled && sorted.length > 0) {
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
	}

	// ── 9) Vacant-aware constraints ──
	if (ctx.vacantPolicy?.enableVacantAwareConstraints) {
		const vp = ctx.vacantPolicy;

		// 9a) Faculty insufficient daily vacant time
		// For each faculty per day+term, compute total time span minus teaching
		// minutes = vacant minutes. Term identity prevents cross-term summation.
		const facDayForVacant = groupEntriesByTerm(
			ctx.entries.filter((e) => e.facultyId != null),
			facultyDayTermKey,
		);

		for (const [key, dayEntries] of facDayForVacant) {
			const { facultyId, day } = parseFacultyDayTermKey(key);
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

		// 9b) Section overcompressed — section has too many teaching minutes in a single day+term
		const secDayForVacant = groupEntriesByTerm(
			ctx.entries.flatMap((entry) => getEffectiveSectionIds(entry).map((sectionId) => ({ ...entry, sectionId }))),
			(entry, term) => sectionDayTermKey(entry.sectionId, entry, term),
		);

		for (const [key, dayEntries] of secDayForVacant) {
			const { sectionId, day } = parseSectionDayTermKey(key);
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
	let finalViolations = violations;
	if (ctx.constraintConfig) {
		finalViolations = applyConstraintOverrides(violations, ctx.constraintConfig);
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
