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
import type { ProgramType, RoomType } from '@prisma/client';
import { resolveCanonicalSlotsFromRows, type ClassProgramSlotRow } from './class-program-slot.service.js';
import { isSubjectAllowedForSectionProgram } from './subject-program-scope.service.js';
import {
	matchesSubjectOwnershipDepartment,
	roomRequiredFeatures,
} from './subject-ownership.service.js';
import {
	resolveMaxConsecutiveTeachingMinutesBeforeBreak,
	resolvePolicyPlacementSemantics,
} from './scheduling-policy.service.js';
import {
	getEffectiveEvents,
	isFlagCeremonyEvent,
	isRejectedFlagCeremonyRow,
	resolveFlagCeremonyDayAuthority,
	resolveSpecialEventDayOfWeek,
	type SpecialEventRowLike,
} from '../lib/policy-special-events.js';
import {
	evaluateCandidateInvariants,
	intervalsOverlap,
	isHomeroomGuidanceCandidate,
	isRoomGradeScopeCompatible as matchesRoomGradeScope,
	roomCanFitEnrollment,
	type TimetableCandidateInvariantInput,
} from './timetable-candidate-domain.js';

export { roomCanFitEnrollment } from './timetable-candidate-domain.js';

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

/**
 * Maximum verified ordered-term cardinality the scheduler term model supports.
 * EnrollPro admits `TRIMESTER` (3) and `QUARTERS` (4). Term indices are used
 * verbatim: a fourth ordered term is never collapsed onto term 3.
 */
export const MAX_SUPPORTED_TERMS = 4;

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
	return matchesRoomGradeScope(room, sectionGradeLevel);
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
		dayOfWeek?: string | null;
		enabled?: boolean;
		gradeGroup?: string | null;
		programType?: string | null;
	}>;
}

type PeriodSlot = { startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string };

/**
 * Build schedulable class period slots from policy bounds and lunch window.
 * Special event rows are built separately via buildSpecialEventSlots().
 */
function buildPeriodSlots(policy?: PolicyInput, canonical?: ResolvedCanonicalDisplayScope | null): PeriodSlot[] {
	let slots: PeriodSlot[] = [];

	// SLOT-BREAK-AUTHORITY-C11R: when the scope HAS canonical `classProgramSlot`
	// rows, its CLASS rows ARE the period grid. The policy path below is a
	// fallback for scopes with no canonical rows.
	if (canonical?.hasCanonicalRows) {
		return canonical.periodSlots.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime }));
	}

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
				// R3: an explicit non-Monday Flag/HGP row is rejected authority and
				// never contributes any window.
				if (isRejectedFlagCeremonyRow(evt.eventType, evt.dayOfWeek, evt.label)) continue;
				// A day-scoped event is rendered on that day while the same
				// time boundary remains a valid class slot for the other
				// weekdays. N2: resolve the day through the ONE shared label-aware
				// authority so `buildPeriodSlots` and the shape contract cannot
				// disagree about a label-identity flag row.
				const eventDay = resolveSpecialEventDayOfWeek(evt.eventType, evt.dayOfWeek, evt.label) ?? undefined;
				if (eventDay) continue;
				blockedWindows.push({
					start: timeToMinutes(evt.startTime),
					end: timeToMinutes(evt.endTime),
				});
			}
		} else {
			// Fall back to global policy fields
			// Flag ceremony is Monday-only by contract. Because these fallback
			// period slots are day-agnostic, retain the boundary here and let
			// buildSpecialEventSlots() render the Monday-only event alongside
			// the shared weekly time grid.

			if (policy.enableRecess ?? true) {
				blockedWindows.push({
					start: timeToMinutes(policy.recessStartTime ?? '09:45'),
					end: timeToMinutes(policy.recessEndTime ?? '10:00'),
				});
			}

			const lunchEnforced = policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true;
			// SLOT-BREAK-AUTHORITY-C11R: never invent the retired 11:55-12:55 window.
			// An enabled lunch window without explicit bounds contributes no block;
			// the canonical `classProgramSlot` grid (when present) is the authority.
			if (lunchEnforced && policy.lunchStartTime && policy.lunchEndTime) {
				blockedWindows.push({
					start: timeToMinutes(policy.lunchStartTime),
					end: timeToMinutes(policy.lunchEndTime),
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

function buildSpecialEventSlots(policy?: PolicyInput, canonical?: ResolvedCanonicalDisplayScope | null): PeriodSlot[] {
	// SLOT-BREAK-AUTHORITY-C11R: when the scope HAS canonical `classProgramSlot`
	// rows, its BREAK rows ARE the break bands. The Monday Flag/HGP overlay stays
	// owned by the policy row (it is never a canonical BREAK row) and is snapped
	// to the single canonical CLASS row that contains it.
	if (canonical?.hasCanonicalRows) {
		return mergeDisplaySlots(canonical.canonicalBreakSlots, resolvePolicyFlagOverlaySlots(policy, canonical.periodSlots));
	}

	if (!policy) {
		return [];
	}

	const events: PeriodSlot[] = [];

	const hasShiftEvents = policy.specialEvents && policy.specialEvents.length > 0;

	if (hasShiftEvents) {
		// Use shift-specific events directly
		for (const evt of policy.specialEvents!) {
			// R3: a Flag/HGP row persisted with an explicit non-Monday day is
			// rejected authority — it is never rendered as a Wednesday/Thursday
			// ceremony overlay.
			if (isRejectedFlagCeremonyRow(evt.eventType, evt.dayOfWeek, evt.label)) continue;
			events.push({
				startTime: evt.startTime,
				endTime: evt.endTime,
				isSpecialEvent: true,
				eventName: evt.label,
				dayOfWeek: resolveSpecialEventDayOfWeek(evt.eventType, evt.dayOfWeek, evt.label) ?? undefined,
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
				dayOfWeek: 'MONDAY',
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
		if ((policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true) && policy.lunchStartTime && policy.lunchEndTime) {
			events.push({
				startTime: policy.lunchStartTime,
				endTime: policy.lunchEndTime,
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

// ─── SLOT-BREAK-AUTHORITY-C11R: canonical display authority ───

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isClockTime(value: unknown): value is string {
	return typeof value === 'string' && CLOCK_TIME.test(value);
}

function normalizeCanonicalScopeProgramType(programType?: string | null): string | null {
	if (typeof programType !== 'string' || programType.trim().length === 0) return null;
	return programType.trim().toUpperCase();
}

function dedupeIntervalSlots(slots: PeriodSlot[]): PeriodSlot[] {
	const deduped = new Map<string, PeriodSlot>();
	for (const slot of slots) {
		const key = `${slot.startTime}-${slot.endTime}`;
		if (!deduped.has(key)) deduped.set(key, slot);
	}
	return [...deduped.values()].sort((left, right) => {
		const startDiff = timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
		return startDiff !== 0 ? startDiff : timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
	});
}

/**
 * SLOT-BREAK-AUTHORITY-C11R — a persisted canonical `classProgramSlot` row the
 * DISPLAY path consumes. Structurally a subset of `ClassProgramSlotRow`, so a
 * production `select` can return exactly this shape.
 */
export interface CanonicalDisplayRow {
	gradeLevel: number;
	programType: string | null;
	startTime: string;
	endTime: string;
	rowKind: string;
	subjectLabel?: string | null;
	dayOfWeek?: string | null;
}

export interface CanonicalDisplayScope {
	gradeLevel: number;
	programType: string | null;
}

/**
 * A canonical BREAK row's owning `(gradeLevel, programType)` scope. The resolved
 * rows carry their OWN scope (a known program never falls back to grade-generic
 * rows), so this is the truthful owner of the interval even under the
 * grade-generic fallback.
 */
export interface CanonicalBreakScope {
	startTime: string;
	endTime: string;
	gradeLevel: number;
	programType: string | null;
}

/**
 * SPECIAL-EVENT-SCOPE-C01 (D8) — the additive scope a published
 * `specialEvents[]` window carries. `appliesToAll` is true ONLY for genuinely
 * school-wide windows (the policy Flag/HGP overlay, or the legacy policy-global
 * fallback); otherwise `gradeLevels`/`programTypes` list the canonical scopes
 * that own the window, accumulated as a SET across the collapsed union so one
 * distinct window stays ONE row.
 */
export interface CanonicalDisplayWindowScope {
	appliesToAll: boolean;
	gradeLevels: number[];
	programTypes: string[];
}

export interface ResolvedCanonicalDisplayScope {
	hasCanonicalRows: boolean;
	/** Canonical CLASS rows — the effective period grid and shift bounds. */
	periodSlots: PeriodSlot[];
	/** Canonical BREAK rows only — parity identity with the C11 validator authority. */
	canonicalBreakSlots: PeriodSlot[];
	/** The owning `(gradeLevel, programType)` of each canonical BREAK row, for payload attribution. */
	canonicalBreakScopes: CanonicalBreakScope[];
	/** Min start / max end of the canonical CLASS rows. */
	shiftWindow: { startTime: string; endTime: string } | null;
}

/**
 * SLOT-BREAK-AUTHORITY-C11R — resolve the canonical display authority for ONE
 * `(gradeLevel, programType)` scope.
 *
 * Resolution reuses `resolveCanonicalSlotsFromRows`, the SAME exact-match /
 * known-program / grade-generic fallback / dedupe / ordering semantics the live
 * scheduler resolver and the C11 validator authority (`warning-window-authority`)
 * use, so display and validator can never disagree about which grid governs a
 * scope. A known program type never falls back to the grade-generic rows.
 *
 * `hasCanonicalRows: false` means the scope has NO canonical rows; the caller
 * must then keep the persisted policy fallback (never coerce a missing scope to
 * another grade/program, and never invent a window).
 */
export function resolveCanonicalDisplayScope(args: {
	rows?: readonly CanonicalDisplayRow[] | null;
	gradeLevel: number;
	programType?: string | null;
}): ResolvedCanonicalDisplayScope {
	const empty: ResolvedCanonicalDisplayScope = { hasCanonicalRows: false, periodSlots: [], canonicalBreakSlots: [], canonicalBreakScopes: [], shiftWindow: null };
	const rows = args.rows ?? [];
	if (rows.length === 0) return empty;

	const resolved = resolveCanonicalSlotsFromRows(
		rows as unknown as readonly ClassProgramSlotRow[],
		args.gradeLevel,
		[normalizeCanonicalScopeProgramType(args.programType) as ProgramType | null],
	);
	if (resolved.length === 0) return empty;

	const breakRows = resolved.filter((row) => row.rowKind === 'BREAK' && isClockTime(row.startTime) && isClockTime(row.endTime));
	const periodSlots = dedupeIntervalSlots(
		resolved
			.filter((row) => row.rowKind === 'CLASS' && isClockTime(row.startTime) && isClockTime(row.endTime))
			.map((row) => ({ startTime: row.startTime, endTime: row.endTime })),
	);
	const canonicalBreakSlots = dedupeIntervalSlots(
		breakRows.map((row) => ({
			startTime: row.startTime,
			endTime: row.endTime,
			isSpecialEvent: true,
			eventName: (row.subjectLabel ?? '').trim() || 'BREAK',
		})),
	);
	// SPECIAL-EVENT-SCOPE-C01 (D8) — the owning scope of each canonical BREAK row,
	// read from the RESOLVED row (not the requested scope) so a grade-generic
	// fallback attributes the interval to the grade-generic owner it truly has.
	const canonicalBreakScopes: CanonicalBreakScope[] = breakRows.map((row) => ({
		startTime: row.startTime,
		endTime: row.endTime,
		gradeLevel: row.gradeLevel,
		programType: normalizeCanonicalScopeProgramType(row.programType),
	}));

	let shiftWindow: { startTime: string; endTime: string } | null = null;
	if (periodSlots.length > 0) {
		shiftWindow = {
			startTime: periodSlots.reduce((min, slot) => (timeToMinutes(slot.startTime) < timeToMinutes(min) ? slot.startTime : min), periodSlots[0].startTime),
			endTime: periodSlots.reduce((max, slot) => (timeToMinutes(slot.endTime) > timeToMinutes(max) ? slot.endTime : max), periodSlots[0].endTime),
		};
	}

	return { hasCanonicalRows: true, periodSlots, canonicalBreakSlots, canonicalBreakScopes, shiftWindow };
}

/**
 * The Monday Flag/HGP overlay is policy-row owned, never a canonical BREAK row.
 * It must occupy the single canonical CLASS row that fully contains its persisted
 * window (`resolveContainingClassRow`); a window that no canonical CLASS row
 * contains yields no synthesized interval, preserving the preflight's typed
 * `FLAG_CEREMONY_SCOPE_INVALID` fail-closed behaviour. A Flag/HGP row persisted
 * with an explicit non-Monday day is rejected authority and never rendered.
 */
function resolvePolicyFlagOverlaySlots(policy: PolicyInput | undefined, canonicalClassRows: PeriodSlot[]): PeriodSlot[] {
	if (!policy) return [];
	const events = Array.isArray(policy.specialEvents) ? policy.specialEvents : [];
	const flagRows = events.filter((event) => isFlagCeremonyEvent(event.eventType, event.label));

	const overlay: PeriodSlot[] = [];
	if (flagRows.length > 0) {
		for (const event of flagRows) {
			if (isRejectedFlagCeremonyRow(event.eventType, event.dayOfWeek, event.label)) continue;
			const snapped = resolveContainingClassRow(canonicalClassRows, event.startTime, event.endTime);
			if (!snapped) continue;
			const day = resolveSpecialEventDayOfWeek(event.eventType, event.dayOfWeek, event.label) ?? 'MONDAY';
			overlay.push({ startTime: snapped.startTime, endTime: snapped.endTime, isSpecialEvent: true, eventName: event.label, dayOfWeek: day });
		}
	} else if (policy.enableFlagCeremony ?? true) {
		const snapped = resolveContainingClassRow(canonicalClassRows, policy.flagCeremonyStartTime ?? '07:00', policy.flagCeremonyEndTime ?? '07:30');
		if (snapped) {
			overlay.push({ startTime: snapped.startTime, endTime: snapped.endTime, isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' });
		}
	}
	return overlay.slice(0, 1);
}

/**
 * SPECIAL-EVENT-SCOPE-C01 (D8) — the persisted policy `gradeGroup` values map to
 * their grade levels. A policy event row with no grade group is school-wide.
 */
const POLICY_GRADE_GROUP_LEVELS: Record<string, number[]> = {
	'7-8': [7, 8],
	'9-10': [9, 10],
};

/**
 * The additive scope of a persisted policy special-event row. A row carrying a
 * known `gradeGroup` is grade-scoped; a row with no grade group (or an unknown
 * one) is genuinely school-wide and reports `appliesToAll`.
 */
function policyEventWindowScope(event: { gradeGroup?: string | null; programType?: string | null }): CanonicalDisplayWindowScope {
	const gradeGroup = (event.gradeGroup ?? '').trim();
	const levels = POLICY_GRADE_GROUP_LEVELS[gradeGroup];
	if (!levels || levels.length === 0) {
		return { appliesToAll: true, gradeLevels: [], programTypes: [] };
	}
	const programType = normalizeCanonicalScopeProgramType(event.programType);
	return { appliesToAll: false, gradeLevels: [...levels], programTypes: programType ? [programType] : [] };
}

/** A window that belongs to no grade/program scope (policy-global fallback). */
function schoolWideWindowScope(): CanonicalDisplayWindowScope {
	return { appliesToAll: true, gradeLevels: [], programTypes: [] };
}

/**
 * SLOT-BREAK-AUTHORITY-C11R — the canonical display grid for a set of scopes.
 *
 * When at least one scope resolves canonical rows, the deduped union of those
 * scopes' CLASS rows is the period grid, their BREAK rows are the break bands,
 * and the shift bounds are the min/max of the CLASS rows. Scopes with NO
 * canonical rows never contribute (they are never forced to another scope's
 * grid). When NO requested scope has canonical rows the persisted policy
 * fallback is returned unchanged.
 *
 * SPECIAL-EVENT-SCOPE-C01 (D8): `specialEventWindowScopes` is aligned
 * index-for-index with `specialEventSlots` and reports the accumulated
 * `(gradeLevel, programType)` SET of each collapsed window — one row per distinct
 * window, never one row per grade.
 *
 * `scopes` omitted/empty means "every distinct (gradeLevel, programType) scope
 * present in `rows`" — an honest union, never a coerced single scope.
 */
export function buildCanonicalDisplayGrid(args: {
	rows?: readonly CanonicalDisplayRow[] | null;
	scopes?: ReadonlyArray<CanonicalDisplayScope> | null;
	policy?: PolicyInput;
}): {
	hasCanonicalRows: boolean;
	periodSlots: PeriodSlot[];
	canonicalBreakSlots: PeriodSlot[];
	shiftWindow: { startTime: string; endTime: string } | null;
	specialEventSlots: PeriodSlot[];
	specialEventWindowScopes: CanonicalDisplayWindowScope[];
	displaySlots: PeriodSlot[];
} {
	const rows = args.rows ?? [];
	const scopes: CanonicalDisplayScope[] = args.scopes && args.scopes.length > 0
		? args.scopes.map((scope) => ({ gradeLevel: scope.gradeLevel, programType: normalizeCanonicalScopeProgramType(scope.programType) }))
		: [...new Map(rows.map((row) => [
			`${row.gradeLevel}:${row.programType ?? '*'}`,
			{ gradeLevel: row.gradeLevel, programType: row.programType ?? null },
		] as const)).values()];

	const periodSlots: PeriodSlot[] = [];
	const canonicalBreakSlots: PeriodSlot[] = [];
	// The accumulated owner SET per distinct window key.
	const breakScopeByWindow = new Map<string, { gradeLevels: Set<number>; programTypes: Set<string> }>();
	for (const scope of scopes) {
		const resolved = resolveCanonicalDisplayScope({ rows, gradeLevel: scope.gradeLevel, programType: scope.programType });
		if (!resolved.hasCanonicalRows) continue;
		periodSlots.push(...resolved.periodSlots);
		canonicalBreakSlots.push(...resolved.canonicalBreakSlots);
		for (const breakScope of resolved.canonicalBreakScopes) {
			const key = `${breakScope.startTime}-${breakScope.endTime}`;
			const entry = breakScopeByWindow.get(key) ?? { gradeLevels: new Set<number>(), programTypes: new Set<string>() };
			entry.gradeLevels.add(breakScope.gradeLevel);
			if (breakScope.programType) entry.programTypes.add(breakScope.programType);
			breakScopeByWindow.set(key, entry);
		}
	}

	if (periodSlots.length === 0 && canonicalBreakSlots.length === 0) {
		// No requested scope has canonical rows — keep the persisted policy path.
		const fallbackPeriodSlots = buildPeriodSlots(args.policy);
		const fallbackSpecialEventSlots = buildSpecialEventSlots(args.policy);
		const fallbackScopeByWindow = new Map<string, CanonicalDisplayWindowScope>();
		for (const event of args.policy?.specialEvents ?? []) {
			const key = `${event.startTime}-${event.endTime}`;
			if (!fallbackScopeByWindow.has(key)) fallbackScopeByWindow.set(key, policyEventWindowScope(event));
		}
		return {
			hasCanonicalRows: false,
			periodSlots: fallbackPeriodSlots,
			canonicalBreakSlots: [],
			shiftWindow: null,
			specialEventSlots: fallbackSpecialEventSlots,
			specialEventWindowScopes: fallbackSpecialEventSlots.map((slot) => fallbackScopeByWindow.get(`${slot.startTime}-${slot.endTime}`) ?? schoolWideWindowScope()),
			displaySlots: (args.policy?.showSpecialEventsInGrid ?? true)
				? mergeDisplaySlots(fallbackPeriodSlots, fallbackSpecialEventSlots)
				: fallbackPeriodSlots,
		};
	}

	const dedupedPeriodSlots = dedupeIntervalSlots(periodSlots);
	const dedupedBreakSlots = dedupeIntervalSlots(canonicalBreakSlots);
	const flagOverlaySlots = resolvePolicyFlagOverlaySlots(args.policy, dedupedPeriodSlots);
	// The Monday Flag/HGP overlay is policy-row owned: it is school-wide, not a
	// canonical BREAK row, so it never claims a grade/program scope.
	const flagWindowKeys = new Set(flagOverlaySlots.map((slot) => `${slot.startTime}-${slot.endTime}`));
	const specialEventSlots = mergeDisplaySlots(dedupedBreakSlots, flagOverlaySlots);
	const specialEventWindowScopes = specialEventSlots.map((slot) => {
		const key = `${slot.startTime}-${slot.endTime}`;
		if (flagWindowKeys.has(key)) return schoolWideWindowScope();
		const entry = breakScopeByWindow.get(key);
		if (!entry || entry.gradeLevels.size === 0) {
			// A canonical-derived interval whose owner set is empty is not derivable;
			// the caller emits `appliesToAll:false` with empty arrays plus a typed note.
			return { appliesToAll: false, gradeLevels: [], programTypes: [] };
		}
		return {
			appliesToAll: false,
			gradeLevels: [...entry.gradeLevels].sort((left, right) => left - right),
			programTypes: [...entry.programTypes].sort(),
		};
	});
	return {
		hasCanonicalRows: true,
		periodSlots: dedupedPeriodSlots,
		canonicalBreakSlots: dedupedBreakSlots,
		// Shift bounds are the canonical CLASS grid's min start / max end across
		// the resolved scopes — never the policy row's earliest/latest bounds.
		shiftWindow: dedupedPeriodSlots.length > 0
			? {
				startTime: dedupedPeriodSlots.reduce((min, slot) => (timeToMinutes(slot.startTime) < timeToMinutes(min) ? slot.startTime : min), dedupedPeriodSlots[0].startTime),
				endTime: dedupedPeriodSlots.reduce((max, slot) => (timeToMinutes(slot.endTime) > timeToMinutes(max) ? slot.endTime : max), dedupedPeriodSlots[0].endTime),
			}
			: null,
		specialEventSlots,
		specialEventWindowScopes,
		displaySlots: (args.policy?.showSpecialEventsInGrid ?? true)
			? mergeDisplaySlots(dedupedPeriodSlots, specialEventSlots)
			: dedupedPeriodSlots,
	};
}

/**
 * A persisted `grade_shift_windows` row (the school grade-to-shift map).
 */
export interface ShiftWindowLike {
	gradeLevel: number;
	programType?: string | null;
	startTime: string;
	endTime: string;
}

/** A resolved shift band. `label` is `null` — ATLAS persists no shift label. */
export interface SpecialEventShiftPayload {
	label: string | null;
	startTime: string;
	endTime: string;
}

/**
 * SPECIAL-EVENT-SCOPE-C01 (D8) — the additive `scope` object emitted on every
 * published `specialEvents[]` element.
 */
export interface SpecialEventScopePayload {
	appliesToAll: boolean;
	gradeLevels: number[];
	programTypes: string[];
	shift: SpecialEventShiftPayload | null;
	/** Present ONLY when scope genuinely cannot be derived — never fabricated. */
	note?: string;
}

/** Typed note emitted when a window's scope cannot be derived from authority. */
export const SPECIAL_EVENT_SCOPE_NOT_DERIVABLE = 'SCOPE_NOT_DERIVABLE';

function normalizeShiftProgramType(value?: string | null): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toUpperCase();
	return normalized.length > 0 ? normalized : null;
}

/**
 * The shift window that governs ONE grade level. A program-specific window whose
 * program is in the scope's program set is preferred; otherwise the grade-generic
 * (`programType: null`) window. Never crosses grade levels. Returns `null` when
 * the grade has no window or its candidates disagree.
 */
function shiftWindowForGrade(
	gradeLevel: number,
	programTypes: readonly string[],
	shiftWindows: readonly ShiftWindowLike[],
): SpecialEventShiftPayload | null {
	const candidates = shiftWindows.filter((window) => window.gradeLevel === gradeLevel);
	if (candidates.length === 0) return null;
	const programSet = new Set(programTypes.map((program) => program.toUpperCase()));
	const programSpecific = candidates.filter((window) => {
		const program = normalizeShiftProgramType(window.programType);
		return program != null && programSet.has(program);
	});
	const chosen = programSpecific.length > 0
		? programSpecific
		: candidates.filter((window) => normalizeShiftProgramType(window.programType) == null);
	if (chosen.length === 0) return null;
	const distinct = new Map<string, SpecialEventShiftPayload>();
	for (const window of chosen) {
		distinct.set(`${window.startTime}-${window.endTime}`, { label: null, startTime: window.startTime, endTime: window.endTime });
	}
	if (distinct.size !== 1) return null;
	return [...distinct.values()][0];
}

/**
 * The shift of a grade/program-scoped window: the single distinct shift band
 * across the window's owning grades. `null` when the scope spans shifts, has no
 * shift row, or is otherwise ambiguous (the consumer then maps per grade through
 * `source.shiftWindows[]`).
 */
function resolveScopedShift(
	gradeLevels: readonly number[],
	programTypes: readonly string[],
	shiftWindows: readonly ShiftWindowLike[],
): SpecialEventShiftPayload | null {
	if (gradeLevels.length === 0) return null;
	const shifts = new Map<string, SpecialEventShiftPayload>();
	for (const gradeLevel of gradeLevels) {
		const window = shiftWindowForGrade(gradeLevel, programTypes, shiftWindows);
		if (!window) continue;
		shifts.set(`${window.startTime}-${window.endTime}`, window);
	}
	if (shifts.size !== 1) return null;
	return [...shifts.values()][0];
}

/**
 * The shift of a genuinely school-wide window: the single shift band that
 * CONTAINS the event interval, when exactly one does. Otherwise `null` — never a
 * guessed shift.
 */
function resolveSchoolWideShift(
	startTime: string,
	endTime: string,
	shiftWindows: readonly ShiftWindowLike[],
): SpecialEventShiftPayload | null {
	const start = timeToMinutes(startTime);
	const end = timeToMinutes(endTime);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
	const containing = new Map<string, SpecialEventShiftPayload>();
	for (const window of shiftWindows) {
		const windowStart = timeToMinutes(window.startTime);
		const windowEnd = timeToMinutes(window.endTime);
		if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) continue;
		if (windowStart <= start && windowEnd >= end) {
			containing.set(`${window.startTime}-${window.endTime}`, { label: null, startTime: window.startTime, endTime: window.endTime });
		}
	}
	if (containing.size !== 1) return null;
	return [...containing.values()][0];
}

/**
 * SPECIAL-EVENT-SCOPE-C01 (D8) — build the additive scope for one emitted window.
 * An unknown/empty scope never fabricates an owner: it reports
 * `appliesToAll:false` with empty arrays plus the typed
 * `SPECIAL_EVENT_SCOPE_NOT_DERIVABLE` note.
 */
export function resolveSpecialEventScope(
	windowScope: CanonicalDisplayWindowScope | undefined,
	event: { startTime: string; endTime: string },
	shiftWindows: readonly ShiftWindowLike[] = [],
): SpecialEventScopePayload {
	if (!windowScope) {
		return { appliesToAll: false, gradeLevels: [], programTypes: [], shift: null, note: SPECIAL_EVENT_SCOPE_NOT_DERIVABLE };
	}
	if (windowScope.appliesToAll) {
		return {
			appliesToAll: true,
			gradeLevels: [],
			programTypes: [],
			shift: resolveSchoolWideShift(event.startTime, event.endTime, shiftWindows),
		};
	}
	if (windowScope.gradeLevels.length === 0) {
		return { appliesToAll: false, gradeLevels: [], programTypes: [], shift: null, note: SPECIAL_EVENT_SCOPE_NOT_DERIVABLE };
	}
	return {
		appliesToAll: false,
		gradeLevels: [...windowScope.gradeLevels],
		programTypes: [...windowScope.programTypes],
		shift: resolveScopedShift(windowScope.gradeLevels, windowScope.programTypes, shiftWindows),
	};
}

/** A special event bound to one weekday (e.g. Monday Flag/HGP). */
export interface DayScopedEventWindow {
	day: string;
	startTime: string;
	endTime: string;
	label: string;
}

/**
 * Resolve the weekday a persisted special event belongs to.
 * Schema-shaped `FLAG_OR_HGP` rows historically omitted `dayOfWeek`; their
 * canonical contract is Monday. Events without an explicit day and without the
 * Flag/HGP identity (recess, lunch) apply to every weekday.
 *
 * Re-exported from the single shared authority in `lib/policy-special-events.ts`
 * (R3) so every consumer — constructor, room view, published view, preflight —
 * resolves Flag/HGP identity and day scope identically.
 */
export { resolveSpecialEventDayOfWeek };

/**
 * Capability gate for day-scoped placement blocking.
 *
 * A Flag Ceremony / HGP row is an OVERLAY *inside* an instructional period.
 * Every SY 2026-2027 stakeholder class program prints `Flag Ceremony/HGP` in
 * the Monday cell of a row whose Tue–Fri cells are ordinary subjects, and the
 * printed daily totals are identical Mon–Thu; teacher programs state the
 * period is "45 mins Inclusive of HGP/PEACE Campaign (Monday)". The overlay
 * therefore never removes a teaching slot and must never block candidate
 * construction. Break-like events and unknown event types remain
 * capacity-blocking (fail-closed) unless they carry the Flag/HGP identity.
 *
 * Identity comes from the ONE shared authority (`isFlagCeremonyEvent`) so the
 * constructor, preflight, room view, and published view cannot disagree.
 */
export function isCapacityBlockingSpecialEvent(
	eventType: string | null | undefined,
	label: string | null | undefined,
): boolean {
	return !isFlagCeremonyEvent(eventType, label);
}

/**
 * Day-scoped non-schedulable windows. A Monday-only capacity-blocking event
 * must block candidate construction on Monday while leaving the identical
 * interval eligible on every other instructional weekday.
 *
 * A Flag/HGP overlay is excluded entirely (`isCapacityBlockingSpecialEvent`):
 * it occupies an INSTRUCTIONAL period, so it must never be pushed as a
 * block. Break-like events (health/lunch) with an explicit weekday keep their
 * day scope; day-agnostic breaks stay owned by `buildPeriodSlots`.
 *
 * R3: a Flag/HGP row persisted with an explicit non-Monday day is REJECTED
 * authority and no longer produces any window here (it can never block, and
 * the display path drops it) so a bypassed preflight cannot silently schedule
 * a Wednesday/Thursday ceremony.
 *
 * R2: when canonical CLASS rows are supplied, a capacity-blocking window is
 * snapped to the single containing CLASS row (the underlying
 * advisory-section period). A window that no canonical CLASS row contains —
 * or that more than one contains — yields no synthesized window; the
 * preflight reports the typed `FLAG_CEREMONY_SCOPE_INVALID` blocker.
 */
export function buildDayScopedEventWindows(
	policy?: PolicyInput,
	canonicalClassRows?: Array<{ startTime: string; endTime: string }>,
): DayScopedEventWindow[] {
	if (!policy) return [];
	const windows: DayScopedEventWindow[] = [];
	const hasShiftEvents = policy.specialEvents && policy.specialEvents.length > 0;
	if (hasShiftEvents) {
		for (const evt of policy.specialEvents!) {
			// A Flag/HGP overlay occupies an instructional period and must never
			// remove a teachable slot. Unknown/break-like events stay blocking.
			if (!isCapacityBlockingSpecialEvent(evt.eventType, evt.label)) continue;
			const flagAuthority = resolveFlagCeremonyDayAuthority(evt.eventType, evt.dayOfWeek, evt.label);
			if (flagAuthority.explicitNonMonday) continue;
			const day = flagAuthority.day ?? resolveSpecialEventDayOfWeek(evt.eventType, evt.dayOfWeek, evt.label);
			if (!day) continue;
			const snapped = flagAuthority.day ? resolveContainingClassRow(canonicalClassRows, evt.startTime, evt.endTime) : undefined;
			if (flagAuthority.day && canonicalClassRows && canonicalClassRows.length > 0 && !snapped) continue;
			windows.push({
				day,
				startTime: snapped?.startTime ?? evt.startTime,
				endTime: snapped?.endTime ?? evt.endTime,
				label: evt.label,
			});
		}
	}
	// The synthetic global flag window is intentionally retired: a global Flag
	// Ceremony is still an in-period overlay, never a placement block.
	// `buildPeriodSlots` already owns recess/lunch capacity removal.
	return windows;
}

/**
 * The single canonical CLASS row that fully contains `[startTime, endTime]`.
 * Returns `undefined` when zero or more than one CLASS row contains the window,
 * which callers treat as unresolved authority (never synthesize an interval).
 */
export function resolveContainingClassRow(
	classRows: Array<{ startTime: string; endTime: string }> | undefined,
	startTime: string,
	endTime: string,
): { startTime: string; endTime: string } | undefined {
	if (!classRows || classRows.length === 0) return undefined;
	const windowStart = timeToMinutes(startTime);
	const windowEnd = timeToMinutes(endTime);
	if (windowEnd <= windowStart) return undefined;
	const containing = classRows.filter(
		(row) => timeToMinutes(row.startTime) <= windowStart && timeToMinutes(row.endTime) >= windowEnd,
	);
	return containing.length === 1 ? containing[0] : undefined;
}

export function isIntervalBlockedByDayScopedEvent(
	windows: DayScopedEventWindow[],
	day: string,
	startTime: string,
	endTime: string,
): boolean {
	if (windows.length === 0) return false;
	const slotStart = timeToMinutes(startTime);
	const slotEnd = timeToMinutes(endTime);
	return windows.some((window) =>
		window.day === day
		&& timeToMinutes(window.startTime) < slotEnd
		&& slotStart < timeToMinutes(window.endTime),
	);
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
		// C07A-R1: the shape policy consumes the ONE canonical slot-aligned
		// threshold. The former `?? 180` literal diverged from the validator's
		// resolved default; the resolver now derives it from the same authority.
		maxConsecutiveTeachingMinutesBeforeBreak: resolveMaxConsecutiveTeachingMinutesBeforeBreak(
			input.basePolicy,
			input.periodLengthMinutes,
		),
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
	const canonicalSpecialEventSlots = canonicalRows
			.filter((row) => row.rowKind === 'BREAK' || row.rowKind === 'SPECIAL_EVENT')
			.map((row) => ({
				startTime: row.startTime,
				endTime: row.endTime,
				isSpecialEvent: true,
				eventName: row.subjectLabel ?? undefined,
			}))
	// R2/R3: the Monday Flag/HGP overlay is an OVERLAY on the underlying
	// advisory-section period. Its interval must equal the single canonical CLASS
	// row that contains the persisted window; it never creates a second interval,
	// an extra period slot, extra minutes, or extra demand. A Flag/HGP row with an
	// explicit non-Monday day is rejected authority and is dropped here so a
	// bypassed preflight cannot render a Wednesday/Thursday ceremony.
	const canonicalFlagIntervals = new Set(
		canonicalRows
			.filter((row) => isFlagCeremonyEvent(null, row.subjectLabel))
			.map((row) => `${row.startTime}-${row.endTime}`),
	);
	const policyFlagSlots = effectiveSpecialEvents
		.filter((event) => isFlagCeremonyEvent(event.eventType, event.label))
		.filter((event) => !isRejectedFlagCeremonyRow(event.eventType, event.dayOfWeek, event.label))
		.flatMap((event) => {
			const snapped = hasCanonicalRows
				? resolveContainingClassRow(canonicalClassRows, event.startTime, event.endTime)
				: undefined;
			// Never synthesize an overlay interval that no canonical row defines.
			if (hasCanonicalRows && !snapped) return [];
			const startTime = snapped?.startTime ?? event.startTime;
			const endTime = snapped?.endTime ?? event.endTime;
			if (canonicalFlagIntervals.has(`${startTime}-${endTime}`)) return [];
			return [{
				startTime,
				endTime,
				isSpecialEvent: true,
				eventName: event.label,
				dayOfWeek: 'MONDAY',
			}];
		})
		.slice(0, 1);
	const specialEventSlots = hasCanonicalRows
		? mergeDisplaySlots(canonicalSpecialEventSlots, policyFlagSlots)
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
				dayOfWeek: slot.dayOfWeek,
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
	/**
	 * GEN-C02R Correction 7: canonical Teaching Load owner for each
	 * `subjectId:sectionId` pair. When present, the scheduler candidate pool for
	 * that pair is the owner only; flexible qualification may not override
	 * approved ownership.
	 */
	pairOwners?: Record<string, number>;
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

/**
 * R5/D-E closed-set deviation vocabulary recorded on an entry when the resolved
 * room authority was not satisfied by a room of its own type. `HOME_ROOM_CONTRACT`
 * marks the documented classroom/home-room contract where the authority IS
 * satisfied; the `PREFERRED_ROOM_UNUSABLE_*` values mark genuine preferred-room
 * failure and are the ONLY reasons that may raise `ROOM_TYPE_MISMATCH`.
 */
export type RoomAuthorityDeviationReason =
	| 'HOME_ROOM_CONTRACT'
	| 'PREFERRED_ROOM_UNUSABLE_NO_COMPATIBLE_ROOM'
	| 'PREFERRED_ROOM_UNUSABLE_CAPACITY'
	| 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES';

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
	termIndex?: 1 | 2 | 3 | 4;
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
	termIndex: 1 | 2 | 3 | 4;
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
	/**
	 * DEMAND-C01/GEN-C02: ordered term identities this demand pair actually runs
	 * in. Present on derived-demand projections so per-subject consumers (draft
	 * board, sync/setup, quick-place) can enforce exact ordered-term identity and
	 * reject wrong-term retained placements instead of silently carrying them.
	 */
	applicableTermIdentities?: string[];
}

export function evaluateConstructorCandidateInvariants(input: TimetableCandidateInvariantInput) {
	return evaluateCandidateInvariants(input);
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
			if (isHomeroomGuidanceCandidate(subject.code)) continue;
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
			if (isHomeroomGuidanceCandidate(subject.code)) continue;
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
	private occupied = new Map<string, Array<{ startTime: string; endTime: string }>>();

	isOccupied(entityId: number, day: string, startTime: string, endTime: string): boolean {
		const key = `${entityId}:${day}`;
		const intervals = this.occupied.get(key);
		if (!intervals) return false;
		return intervals.some((interval) => intervalsOverlap(
			{ day, startTime, endTime },
			{ day, startTime: interval.startTime, endTime: interval.endTime },
		));
	}

	mark(entityId: number, day: string, startTime: string, endTime: string): void {
		const key = `${entityId}:${day}`;
		const intervals = this.occupied.get(key) ?? [];
		intervals.push({ startTime, endTime });
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

/**
 * TEACHER-AVAILABILITY-AUTHORITY-C01: build a time-range lookup for `PREFERRED`
 * availability. Unlike `UNAVAILABLE`, a `PREFERRED` window is a ranked SOFT
 * signal — it only orders otherwise-available candidates; it never excludes a
 * candidate and never changes HARD violation counts.
 */
function buildPreferredTimeRanges(preferences: FacultyPreferenceInput[]): Map<number, UnavailableTimeRange[]> {
	const ranges = new Map<number, UnavailableTimeRange[]>();
	for (const pref of preferences) {
		const facultyRanges: UnavailableTimeRange[] = [];
		for (const ts of pref.timeSlots) {
			if (ts.preference === 'PREFERRED') {
				facultyRanges.push({ day: ts.day, startTime: ts.startTime, endTime: ts.endTime });
			}
		}
		if (facultyRanges.length > 0) {
			ranges.set(pref.facultyId, facultyRanges);
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

/**
 * C07A-R1: resolve the ONE canonical slot-aligned consecutive-teaching threshold
 * for every constructor read.
 *
 * The persisted legacy constant (`LEGACY_MAX_CONSECUTIVE_TEACHING_MINUTES`, 120)
 * is the pre-C07 hardcoded value and is not expressible as a whole number of
 * 45-minute periods. `resolveMaxConsecutiveTeachingMinutesBeforeBreak` derives
 * the period-aligned default (45 × 3 = 135) for it and honors an explicitly
 * configured, slot-expressible value verbatim. Routing the constructor input
 * through this helper keeps the constructor, the validator, and the policy
 * read/display on the SAME effective value, so the constructor can no longer
 * refuse a third legitimate period while the validator stays silent.
 *
 * Exported so the decisive control can exercise the exact production derivation
 * `constructBaseline` applies.
 */
export function resolveConstructorPolicy(policy?: PolicyInput): PolicyInput | undefined {
	if (!policy) return policy;
	return {
		...policy,
		maxConsecutiveTeachingMinutesBeforeBreak: resolveMaxConsecutiveTeachingMinutesBeforeBreak(
			policy,
			policy.periodLengthMinutes,
		),
	};
}

export function constructBaseline(input: ConstructorInput): ConstructorResult {
	const { subjects, faculty, facultySubjects, rooms, preferences, sectionsByGrade, policy: rawPolicy, lockedEntries, gradeWindows, timetableShapes, pairOwners } = input;
	// C07A-R1: the constructor consumes the ONE canonical slot-aligned
	// consecutive-teaching threshold so it can never disagree with the validator
	// or the policy read. Resolving here (in addition to the preflight assembly)
	// also covers every direct `constructBaseline` caller.
	const policy = resolveConstructorPolicy(rawPolicy) ?? rawPolicy;
	const useHomeRoomPriority = input.roomingStrategy === 'HOME_ROOM_FIRST';

	// Build period slots dynamically from the active policy day shape.
	const PERIOD_SLOTS = buildUnionClassPeriodSlots(timetableShapes);
	const FALLBACK_PERIOD_SLOTS = PERIOD_SLOTS.length > 0 ? PERIOD_SLOTS : buildPeriodSlots(policy);
	// Day-scoped special events (Monday Flag/HGP) block ONLY their own weekday.
	// The underlying interval stays a valid class period for other weekdays.
	const dayScopedEventWindows = buildDayScopedEventWindows(policy);

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
	// GEN-C02R Correction 7: canonical owner is the candidate authority for its
	// pair. This overrides the broad qualified pool so a generated schedule
	// cannot disagree with the reconciled Teaching Load.
	const isOwnerControlledPair = (subjectId: number, sectionId: number): boolean =>
		pairOwners != null && pairOwners[`${subjectId}:${sectionId}`] !== undefined;
	if (pairOwners) {
		for (const [key, ownerFacultyId] of Object.entries(pairOwners)) {
			if (!Number.isInteger(ownerFacultyId)) continue;
			qualifiedMap.set(key, [ownerFacultyId]);
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

	function getQualifiedFacultyIds(item: DemandItem, day: string, slot: { startTime: string; endTime: string }, pi: number, unavailableTimeRanges?: Map<number, UnavailableTimeRange[]>, termIndex?: 1 | 2 | 3 | 4): { ids: number[], reason?: UnassignedItem['reason'] } {
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
		// GEN-C02R Correction 7: flexible qualification must never override the
		// canonical owner for an ordinary (non-cohort) pair.
		const ownerControlled = item.entryKind !== 'COHORT' && isOwnerControlledPair(item.subjectId, item.sectionId);
		const shouldAugmentWithTieredCandidates = subject != null && allowFlexible && !ownerControlled;
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

		/**
		 * A persisted `UNAVAILABLE` window is a HARD exclusion — it is never
		 * relaxed. Only *preference* ranking may be relaxed (R2d). Covers both
		 * authority forms:
		 *  - period-index form (`pi >= 0`) via the `day:periodIndex` preference map;
		 *  - canonical/range form (`pi < 0`) via day-scoped time-range overlap.
		 */
		const isUnavailableAtSlot = (facId: number): boolean => {
			const facPrefs = prefLookup.get(facId);
			if (!facPrefs) return false;
			// Check by period index if available
			if (pi >= 0 && facPrefs.get(`${day}:${pi}`) === 'UNAVAILABLE') return true;
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
						// Slot overlaps the range when it starts before the range ends
						// and ends after the range starts.
						if (slotStart < rangeEnd && slotEnd > rangeStart) return true;
					}
				}
			}
			return false;
		};

		// Filter candidates based on load and availability at this specific slot
		const available = candidates.filter((facId) => {
			if (!isWithinLoadAndOccupancy(facId)) return false;
			if (isUnavailableAtSlot(facId)) return false;
			return true;
		});

		if (available.length === 0) {
			if (canRelaxPreferenceForEntry) {
				// Relax preference/ranking only. A persisted UNAVAILABLE window is a
				// hard exclusion and must never be re-admitted here, otherwise the
				// authority is silently overridden and the session is scheduled into
				// an unavailable slot.
				const relaxed = candidates.filter((facId) => isWithinLoadAndOccupancy(facId) && !isUnavailableAtSlot(facId));
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
			const termIndex = Number.isInteger(moduleSubject.modularOrder)
				&& moduleSubject.modularOrder >= 1
				&& moduleSubject.modularOrder <= MAX_SUPPORTED_TERMS
				? (moduleSubject.modularOrder as 1 | 2 | 3 | 4)
				: null;
			if (termIndex == null) {
				// Never collapse, clamp, cycle, or alias an out-of-range rotation
				// order onto another term.
				missingTerms.push(moduleSubject.modularOrder);
				continue;
			}
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
	const preferredTimeRanges = buildPreferredTimeRanges(preferences);
	/**
	 * TEACHER-AVAILABILITY-AUTHORITY-C01: the reviewed `PREFERRED` soft rank at a
	 * concrete slot. Never a HARD exclusion (that is `UNAVAILABLE`).
	 */
	const isPreferredAtSlot = (facId: number, day: string, startTime: string, endTime: string): boolean => {
		const ranges = preferredTimeRanges.get(facId);
		if (!ranges) return false;
		const slotStart = timeToMinutes(startTime);
		const slotEnd = timeToMinutes(endTime);
		return ranges.some((range) => range.day === day && slotStart < timeToMinutes(range.endTime) && slotEnd > timeToMinutes(range.startTime));
	};

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
	const facultyLoadByTerm = new Map<number, Map<1 | 2 | 3 | 4, number>>();
	const facultyLoad = new Map<number, number>();
	const facultyMax = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek * 60]));

	function chargeFacultyLoad(facId: number, minutes: number, termIndex: 1 | 2 | 3 | 4 | undefined): void {
		if (termIndex === 1 || termIndex === 2 || termIndex === 3 || termIndex === 4) {
			const termMap = facultyLoadByTerm.get(facId) ?? new Map<1 | 2 | 3 | 4, number>();
			termMap.set(termIndex, (termMap.get(termIndex) ?? 0) + minutes);
			facultyLoadByTerm.set(facId, termMap);
		} else {
			facultyLoadBase.set(facId, (facultyLoadBase.get(facId) ?? 0) + minutes);
		}
		// Cumulative mirror retained for diagnostic parity with previous behavior.
		facultyLoad.set(facId, (facultyLoad.get(facId) ?? 0) + minutes);
	}

	function getFacultyProjectedLoadForTerm(facId: number, termIndex: 1 | 2 | 3 | 4 | undefined): number {
		const baseLoad = facultyLoadBase.get(facId) ?? 0;
		if (termIndex === 1 || termIndex === 2 || termIndex === 3 || termIndex === 4) {
			const termMap = facultyLoadByTerm.get(facId);
			const termLoad = termMap?.get(termIndex) ?? 0;
			return baseLoad + termLoad;
		}
		// Non-rotation candidate check — every term carries baseLoad plus any rotation charge.
		const termMap = facultyLoadByTerm.get(facId);
		if (!termMap) return baseLoad;
		return baseLoad + Math.max(0, ...termMap.values());
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
				// R2/F9 (Site A): a demand item with no subject binding is a data
				// failure, never a room result. The room reason must stay consistent
				// with the pushed `reason` — `SPECIALIZED_ROOM_UNAVAILABLE` would
				// launder a genuine hard blocker into a SOFT room warning.
				unassignedItems.push({
					sectionId: item.sectionId,
					subjectId: item.subjectId,
					gradeLevel: item.gradeLevel,
					session: s + 1,
					reason: 'NO_QUALIFIED_FACULTY',
					roomAssignmentReason: 'NO_QUALIFIED_FACULTY',
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
			// GEN-C02R Correction 9: canonical capacity is a constraint, never an
			// escape hatch. The former `shouldBypassShapeFilter` treated demand
			// greater than the canonical weekly capacity as permission to fall back
			// to broader day-span slots outside the approved shift/class-program
			// shape. That loophole is removed: fallback slots must themselves be
			// authoritative canonical CLASS rows (or shape period slots). Overflow
			// is reported by readiness/preflight as CANONICAL_SHAPE_CAPACITY_EXCEEDED.
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
					if (isIntervalBlockedByDayScopedEvent(dayScopedEventWindows, day, canonicalSlot.startTime, canonicalSlot.endTime)) continue;

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
					if (isIntervalBlockedByDayScopedEvent(dayScopedEventWindows, day, slot.startTime, slot.endTime)) continue;

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
						// TEACHER-AVAILABILITY-AUTHORITY-C01: the reviewed `PREFERRED`
						// availability is a ranked SOFT signal. It orders candidates
						// that already passed the load/occupancy/HARD-UNAVAILABLE
						// filters above; it never excludes and never changes HARD
						// counts. Per-term load spreading and stable id follow.
						const leftPreferred = isPreferredAtSlot(left, slotCandidate.day, slot.startTime, slot.endTime) ? 0 : 1;
						const rightPreferred = isPreferredAtSlot(right, slotCandidate.day, slot.startTime, slot.endTime) ? 0 : 1;
						if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
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

				// R4/D-A: room authority is data-driven — the resolved authority comes
				// only from the persisted `Subject.preferredRoomType` (or the cohort's
				// own `preferredRoomType`). No code path consults the subject code,
				// name, rotationFamily, weekly minutes, curriculum content, or the
				// presence of laboratory rooms. The former unconditional
				// specialized-room deferral (which forced CLASSROOM for any
				// non-classroom authority under HOME_ROOM_FIRST) is removed.
				const requestedRoomType = item.roomTypePreference ?? subject.preferredRoomType;
				let compatibleRooms = (roomsByType.get(requestedRoomType) ?? [])
					.filter((room) => isRoomGradeScopeCompatible(room, item.gradeLevel));
				const isSpecializedDemand = requestedRoomType !== 'CLASSROOM';
				let sameZoneStandardRooms: RoomInput[] = [];
				let broaderStandardRooms: RoomInput[] = [];
				// R5/D-E: the auditable deviation reason recorded on the entry when a
				// specialized authority cannot be satisfied by its own room type.
				let roomAuthorityDeviationReason: RoomAuthorityDeviationReason | undefined;

				const homeRoomAllowed = useHomeRoomPriority
					&& preferredHomeRoom != null
					&& preferredHomeRoom.type === 'CLASSROOM'
					&& !preferredHomeRoom.isSharedFacility
					&& isRoomGradeScopeCompatible(preferredHomeRoom, item.gradeLevel);

				const featuresOf = (room: RoomInput) => new Set(room.features || []);
				// Only REAL room features may gate room selection. requiredFeatures
				// also carries OWNER_DEPT:<code> ownership markers (written by
				// mergeRequiredFeaturesWithAdditionalOwnerDepartments and read back
				// by the qualification evaluator), which no room declares. Treating
				// them as room requirements fails every room and reports a false
				// ROOM_RESOURCE_UNAVAILABLE for the whole subject.
				const requiredFeatures = roomRequiredFeatures(subject.requiredFeatures);

				if (!isSpecializedDemand) {
					// D-A: CLASSROOM authority may use only grade-scope-compatible,
					// non-shared CLASSROOM teaching rooms plus the section's documented
					// home room. The old non-classroom "overflow relief" pool is removed:
					// a capacity/type shortfall is reported truthfully and never absorbed
					// by a laboratory or other specialist room.
					compatibleRooms = compatibleRooms.filter(
						(room) => room.type === 'CLASSROOM' && !room.isSharedFacility,
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

						const homeRoomCandidate = homeRoomAllowed ? [preferredHomeRoom!] : [];
						compatibleRooms = [...homeRoomCandidate, ...sameZoneStandardRooms, ...broaderStandardRooms];

						if (homeRoomCandidate.length === 0 && sameZoneStandardRooms.length === 0 && broaderStandardRooms.length === 0) {
							const hasSpecializedInventory = teachingRooms.some((room) => room.type !== 'CLASSROOM');
							if (hasSpecializedInventory) sawOnlySpecializedRooms = true;
							else sawNoSameZoneStandardRoom = true;
						} else if (sameZoneStandardRooms.length === 0 && broaderStandardRooms.length > 0) {
							sawNoSameZoneStandardRoom = true;
						}
					}

					const hasCapacityCompliantClassroom = compatibleRooms.some((room) => roomCanFitEnrollment(room.capacity, item.enrolledCount));
					sawCapacityOverflow = compatibleRooms.length > 0 && !hasCapacityCompliantClassroom;
					roomAuthorityDeviationReason = 'HOME_ROOM_CONTRACT';
				} else {
					// Specialized authority: attempt compatible rooms of its own type
					// first (type, grade scope, capacity, features). Only if none is
					// usable at the evaluated slot does the documented home-room
					// contract apply — and the entry must then record the auditable
					// deviation reason.
					const specializedRooms = compatibleRooms;
					const capacityCompliant = specializedRooms.filter((room) =>
						roomCanFitEnrollment(room.capacity, item.enrolledCount),
					);
					const featureCompliant = requiredFeatures.length > 0
						? capacityCompliant.filter((room) => requiredFeatures.every((feature) => featuresOf(room).has(feature)))
						: capacityCompliant;
					if (specializedRooms.length === 0) {
						roomAuthorityDeviationReason = 'PREFERRED_ROOM_UNUSABLE_NO_COMPATIBLE_ROOM';
					} else if (capacityCompliant.length === 0) {
						roomAuthorityDeviationReason = 'PREFERRED_ROOM_UNUSABLE_CAPACITY';
					} else if (featureCompliant.length === 0) {
						roomAuthorityDeviationReason = 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES';
					}
					sawCapacityOverflow = specializedRooms.length > 0 && capacityCompliant.length === 0;
					compatibleRooms = featureCompliant.length > 0
						? featureCompliant
						: (homeRoomAllowed && preferredHomeRoom ? [preferredHomeRoom] : []);
					if (compatibleRooms.length === 0 && !roomAuthorityDeviationReason) {
						roomAuthorityDeviationReason = 'PREFERRED_ROOM_UNUSABLE_NO_COMPATIBLE_ROOM';
					}
					if (specializedRooms.length > 0 && buildingGradeMap.size > 0) {
						const filtered = compatibleRooms.filter((room) => {
							const buildingId = room.buildingId;
							if (!buildingId) return true;
							const buildingGradeLevel = buildingGradeMap.get(buildingId);
							if (buildingGradeLevel === null) return true;
							return buildingGradeLevel === item.gradeLevel;
						});
						if (filtered.length > 0) compatibleRooms = filtered;
					}
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
						const exceedsRoomCapacity = !roomCanFitEnrollment(room.capacity, item.enrolledCount);
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
						if (!isModularUnified && room.type === 'CLASSROOM' && !canBypassCapacityForHomeRoom) {
							const invariantVerdict = evaluateConstructorCandidateInvariants({
								facultyId: facId,
								sectionId: item.sectionId,
								roomId: room.id,
								day: slotCandidate.day,
								startTime: slot.startTime,
								endTime: slot.endTime,
								subjectCode: item.subjectCode,
								enrolledCount: item.enrolledCount,
								room,
								gradeLevel: item.gradeLevel,
								// Specialized and homeroom fallback strategy remains path-specific below.
								allowedRoomTypes: [room.type],
							});
							if (!invariantVerdict.accepted) continue;
						}

						// Ownership markers (OWNER_DEPT:*) are not room features and
						// must not gate room selection here either.
						const roomFeatureRequirements = roomRequiredFeatures(subject.requiredFeatures);
						if (roomFeatureRequirements.length > 0) {
							const roomFeatures = new Set(room.features || []);
							if (!roomFeatureRequirements.every((feature) => roomFeatures.has(feature))) continue;
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
									// R5/D-E: closed-set auditable reason. A satisfied specialized
									// authority carries no deviation; a CLASSROOM authority carries
									// the documented classroom/home-room contract marker; an
									// unsatisfied specialized authority carries the recorded
									// PREFERRED_ROOM_UNUSABLE_* reason.
									roomAuthorityDeviationReason: isSpecializedDemand && room.type === requestedRoomType
										? undefined
										: roomAuthorityDeviationReason,
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

				// R2/F9 (Site B): the room reason is ordered by the OBSERVED failure
				// cause; the resolved room authority qualifies only the room path. A
				// faculty/data failure must never be reported as a room result, because
				// `generation.service.ts` maps SPECIALIZED_ROOM_UNAVAILABLE to a SOFT
				// room warning and would launder a genuine hard blocker.
				//
				// G9G10-FLAG-SOURCE-LANE §3.3: the converse holds too. `reason` is
				// already resolved by the documented priority above, so when it IS a
				// room cause (NO_COMPATIBLE_ROOM / ROOM_CAPACITY_EXCEEDED) that cause
				// is decisive and must outrank the `sawFacultySlotUnavailable`
				// residue — which is also set by a bare slot collision
				// (`qReason === 'NO_AVAILABLE_SLOT'`, line ~2464). A genuine
				// per-term weekly-cap breach keeps `reason === 'FACULTY_OVERLOADED'`
				// (line ~1841), so it still resolves to FACULTY_SLOT_UNAVAILABLE and
				// is classified WORKLOAD_POLICY_BLOCK by the preflight.
				const requestedRoomType = item.roomTypePreference ?? subject.preferredRoomType;
				const isSpecializedDemand = SPECIALIZED_ROOM_TYPES.has(requestedRoomType);
				const roomPathExhausted = reason === 'NO_COMPATIBLE_ROOM' || reason === 'ROOM_CAPACITY_EXCEEDED';
				const roomAssignmentReason: RoomAssignmentReason = reason === 'NO_QUALIFIED_FACULTY'
					? 'NO_QUALIFIED_FACULTY'
					: sawDailyHardLimit || sawConsecutiveHardLimit
						? 'POLICY_SLOT_BLOCKED'
						: reason === 'FACULTY_OVERLOADED'
							? 'FACULTY_SLOT_UNAVAILABLE'
							: roomPathExhausted
								? (isSpecializedDemand ? 'SPECIALIZED_ROOM_UNAVAILABLE' : 'ROOM_PATH_EXHAUSTED')
								: sawFacultySlotUnavailable
									? 'FACULTY_SLOT_UNAVAILABLE'
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
