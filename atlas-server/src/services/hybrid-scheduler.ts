/**
 * Hybrid scheduling orchestrator: greedy multi-seed + repair.
 *
 * Implements H-ALG-1 through H-ALG-5 per docs/phases/algorithm-hybrid-refactor-plan.md.
 *
 * H-ALG-1: Multi-seed constructor  — N diverse demand orderings → initial population
 * H-ALG-2: Fitness scoring         — hard-violation dominant penalty, soft-weighted
 * H-ALG-3: Repair operators        — bounded hard-conflict resolution
 * H-ALG-4: Benchmark support       — per-seed quality summary exposed for diagnostics
 * H-ALG-5: Diagnostics             — seed quality array, repair impact, selected profile
 */

import {
	constructBaseline,
	resolveTimetableShapeContract,
	type ConstructorInput,
	type ConstructorResult,
	type DemandItem,
	type RoomInput,
	type SubjectInput,
	type UnassignedItem,
} from './schedule-constructor.js';
import { isRoomGradeScopeCompatible, roomCanFitEnrollment } from './timetable-candidate-domain.js';
import type { ScheduledEntry } from './constraint-validator.js';

// ─── H-ALG-1: Seed profiles ───

export type SeedProfileId =
	| 'GRADE_ASC_SUBJECT_ASC'    // default (mirrors existing single-seed behavior)
	| 'MOST_CONSTRAINED_FIRST'   // fewest qualified faculty → harder classes first
	| 'GRADE_DESC_SUBJECT_ASC'   // G10 first, then G9 etc. — promotes senior-grade room access
	| 'SESSION_PATTERN_PRIORITY' // retained as a legacy profile id for deterministic fallback ordering
	| 'PACKED_BLOCK_PRIORITY' // cohort + heavier session loads first to reduce late-stage slot starvation
	| 'LOAD_DENSITY_SLOT_PRIORITY' // dense grade/program buckets first to reduce slot starvation
	| 'SUBJECT_DESC_SECTION_ASC'; // subject-major descending, section ascending — opposite subject packing order

export interface SeedProfile {
	id: SeedProfileId;
	label: string;
	orderDemand: (demand: DemandItem[], input: ConstructorInput) => DemandItem[];
}

/** Build a subjectId:sectionId → qualified-faculty-count index for constraint scoring. */
function buildQualifiedCountIndex(input: ConstructorInput): Map<string, number> {
	const qualifiedSets = new Map<string, Set<number>>();
	for (const fs of input.facultySubjects) {
		for (const sectionId of fs.sectionIds) {
			const key = `${fs.subjectId}:${sectionId}`;
			const s = qualifiedSets.get(key) ?? new Set<number>();
			s.add(fs.facultyId);
			qualifiedSets.set(key, s);
		}
	}
	const result = new Map<string, number>();
	for (const [key, s] of qualifiedSets) {
		result.set(key, s.size);
	}
	return result;
}

/** Return the minimum qualified-faculty count for a demand item (bottleneck metric). */
function getDemandConstraintScore(item: DemandItem, qualifiedCountIndex: Map<string, number>): number {
	if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds?.length) {
		const counts = item.cohortMemberSectionIds.map(
			(sid) => qualifiedCountIndex.get(`${item.subjectId}:${sid}`) ?? 0,
		);
		return counts.length > 0 ? Math.min(...counts) : 0;
	}
	return qualifiedCountIndex.get(`${item.subjectId}:${item.sectionId}`) ?? 0;
}

function getGradeProgramBucket(item: DemandItem): string {
	const programCode = (item.programCode ?? item.programType ?? 'REGULAR').toUpperCase();
	return `${item.gradeLevel}:${programCode}`;
}

function buildBucketLoadIndex(demand: DemandItem[]): Map<string, number> {
	const bucketLoad = new Map<string, number>();
	for (const item of demand) {
		const bucket = getGradeProgramBucket(item);
		const itemMinutes = item.sessionsPerWeek * item.durationPerSession;
		bucketLoad.set(bucket, (bucketLoad.get(bucket) ?? 0) + itemMinutes);
	}
	return bucketLoad;
}

/** All seed profiles. Deterministic — no randomness; identical inputs → identical output. */
const SEED_PROFILES: SeedProfile[] = [
	{
		id: 'GRADE_ASC_SUBJECT_ASC',
		label: 'Grade ascending, subject ascending (baseline)',
		// computeDemand already produces this ordering — no permutation needed
		orderDemand: (demand) => [...demand],
	},
	{
		id: 'SUBJECT_DESC_SECTION_ASC',
		label: 'Subject descending, section ascending (subject-major packing)',
		// A fixed, deterministic subject-major ordering. The constructor re-groups
		// demand by grade and TLE priority, so this profile varies the within-bucket
		// insertion order and explores a packing the grade-major profiles miss.
		orderDemand: (demand) =>
			[...demand].sort((a, b) => b.subjectId - a.subjectId || a.sectionId - b.sectionId),
	},
	{
		id: 'MOST_CONSTRAINED_FIRST',
		label: 'Most-constrained classes first (fewest qualified faculty)',
		orderDemand: (demand, input) => {
			const idx = buildQualifiedCountIndex(input);
			return [...demand].sort((a, b) => {
				const scoreA = getDemandConstraintScore(a, idx);
				const scoreB = getDemandConstraintScore(b, idx);
				if (scoreA !== scoreB) return scoreA - scoreB;
				return a.gradeLevel - b.gradeLevel || a.subjectId - b.subjectId;
			});
		},
	},
	{
		id: 'GRADE_DESC_SUBJECT_ASC',
		label: 'Grade descending (G10 first), subject ascending',
		orderDemand: (demand) =>
			[...demand].sort((a, b) => b.gradeLevel - a.gradeLevel || a.subjectId - b.subjectId),
	},
	{
		id: 'SESSION_PATTERN_PRIORITY',
		label: 'Legacy profile (grade/subject fallback)',
		orderDemand: (demand) =>
			[...demand].sort(
				(a, b) =>
					a.gradeLevel - b.gradeLevel ||
					a.subjectId - b.subjectId,
			),
	},
	{
		id: 'PACKED_BLOCK_PRIORITY',
		label: 'Packed block priority (cohorts + heavier weekly loads first)',
		orderDemand: (demand) =>
			[...demand].sort((a, b) => {
				const cohortPriorityA = a.entryKind === 'COHORT' ? 0 : 1;
				const cohortPriorityB = b.entryKind === 'COHORT' ? 0 : 1;
				if (cohortPriorityA !== cohortPriorityB) return cohortPriorityA - cohortPriorityB;

				const minutesA = a.sessionsPerWeek * a.durationPerSession;
				const minutesB = b.sessionsPerWeek * b.durationPerSession;
				if (minutesA !== minutesB) return minutesB - minutesA;

				if (a.sessionsPerWeek !== b.sessionsPerWeek) return b.sessionsPerWeek - a.sessionsPerWeek;
				if (a.gradeLevel !== b.gradeLevel) return b.gradeLevel - a.gradeLevel;
				return a.subjectId - b.subjectId;
			}),
	},
	{
		id: 'LOAD_DENSITY_SLOT_PRIORITY',
		label: 'Load-density slot priority (dense grade/program buckets first)',
		orderDemand: (demand, input) => {
			const qualifiedCountIndex = buildQualifiedCountIndex(input);
			const bucketLoadIndex = buildBucketLoadIndex(demand);
			return [...demand].sort((left, right) => {
				const leftCohortPriority = left.entryKind === 'COHORT' ? 0 : 1;
				const rightCohortPriority = right.entryKind === 'COHORT' ? 0 : 1;
				if (leftCohortPriority !== rightCohortPriority) return leftCohortPriority - rightCohortPriority;

				const leftBucketLoad = bucketLoadIndex.get(getGradeProgramBucket(left)) ?? 0;
				const rightBucketLoad = bucketLoadIndex.get(getGradeProgramBucket(right)) ?? 0;
				if (leftBucketLoad !== rightBucketLoad) return rightBucketLoad - leftBucketLoad;

				const leftConstraint = getDemandConstraintScore(left, qualifiedCountIndex);
				const rightConstraint = getDemandConstraintScore(right, qualifiedCountIndex);
				if (leftConstraint !== rightConstraint) return leftConstraint - rightConstraint;

				const leftMinutes = left.sessionsPerWeek * left.durationPerSession;
				const rightMinutes = right.sessionsPerWeek * right.durationPerSession;
				if (leftMinutes !== rightMinutes) return rightMinutes - leftMinutes;

				if (left.gradeLevel !== right.gradeLevel) return right.gradeLevel - left.gradeLevel;
				return left.subjectId - right.subjectId;
			});
		},
	},
];

// ─── H-ALG-2: Fitness scoring ───

export interface FitnessScore {
	/** Composite score — higher is better. */
	total: number;
	/** Fraction of demand items that were assigned (0..1). */
	completionRate: number;
	/** Hard violation count at scoring time (0 when using proxy fitness). */
	hardViolations: number;
	/** Soft violation count at scoring time (0 when using proxy fitness). */
	softViolations: number;
}

/** Per-seed quality summary exposed in diagnostics. */
export interface SeedQualitySummary {
	profileId: SeedProfileId;
	profileLabel: string;
	assignedCount: number;
	unassignedCount: number;
	policyBlockedCount: number;
	/** Proxy fitness score (without full constraint validation). */
	fitnessScore: number;
	/** Fraction of demand items assigned (0..1). */
	completionRate: number;
}

const HARD_VIOLATION_PENALTY = 1000;
const SOFT_VIOLATION_PENALTY = 10;
const UNASSIGNED_PENALTY = 50;
const POLICY_BLOCKED_PENALTY = 5;

/**
 * Pure fitness function — higher score is better.
 * Hard violations dominate (1000 pts each), ensuring infeasible candidates
 * rank below fully-assigned feasible candidates.
 */
export function scoreFitness(
	result: ConstructorResult,
	hardViolationCount = 0,
	softViolationCount = 0,
): FitnessScore {
	const classesProcessed = result.classesProcessed;
	const completionRate = classesProcessed > 0 ? result.assignedCount / classesProcessed : 0;
	const score =
		result.assignedCount * 100
		- hardViolationCount * HARD_VIOLATION_PENALTY
		- softViolationCount * SOFT_VIOLATION_PENALTY
		- result.unassignedCount * UNASSIGNED_PENALTY
		- result.policyBlockedCount * POLICY_BLOCKED_PENALTY;

	return {
		total: score,
		completionRate,
		hardViolations: hardViolationCount,
		softViolations: softViolationCount,
	};
}

// ─── H-ALG-3: Repair operators ───

export interface RepairImpact {
	/** Total relocation attempts made. */
	attemptsTotal: number;
	/** Conflicts successfully resolved by relocation. */
	conflictsResolved: number;
	/** Conflicts that could not be relocated within the cap. */
	conflictsUnresolved: number;
	/** Breakdown for unresolved relocations. */
	unresolvedByReason: {
		lockedOrMissing: number;
		noFeasibleSlot: number;
		attemptCapReached: number;
	};
}

/** Maximum relocation attempts to bound repair-pass runtime. */
const MAX_REPAIR_ATTEMPTS = 120;

function timeToMinutes(value: string): number {
	const [h, m] = value.split(':').map(Number);
	return h * 60 + m;
}

function intervalsOverlap(left: { startTime: string; endTime: string }, right: { startTime: string; endTime: string }): boolean {
	return timeToMinutes(left.startTime) < timeToMinutes(right.endTime)
		&& timeToMinutes(right.startTime) < timeToMinutes(left.endTime);
}

function getEffectiveSectionIds(entry: ScheduledEntry): number[] {
	return entry.entryKind === 'COHORT' && entry.cohortMemberSectionIds?.length
		? entry.cohortMemberSectionIds
		: [entry.sectionId];
}

function hasOverlapConflict(target: ScheduledEntry, entries: ScheduledEntry[]): { faculty: boolean; room: boolean; section: boolean } {
	let faculty = false;
	let room = false;
	let section = false;
	const targetSections = new Set(getEffectiveSectionIds(target));

	for (const entry of entries) {
		if (entry.entryId === target.entryId || entry.day !== target.day) continue;
		if (!intervalsOverlap(target, entry)) continue;
		if (entry.facultyId != null && target.facultyId != null && entry.facultyId === target.facultyId) faculty = true;
		if (entry.roomId === target.roomId) room = true;
		if (getEffectiveSectionIds(entry).some((sectionId) => targetSections.has(sectionId))) section = true;
		if (faculty || room || section) return { faculty, room, section };
	}

	return { faculty, room, section };
}

function canPlaceWithoutConflict(target: ScheduledEntry, entries: ScheduledEntry[]): boolean {
	const checks = hasOverlapConflict(target, entries);
	return !(checks.faculty || checks.room || checks.section);
}

/**
 * H-ALG-3: Bounded repair pass for hard slot conflicts.
 *
 * Detects faculty-time, room-time, and section-time conflicts in the schedule.
 * For each conflicting entry, attempts to relocate it to a free (day, slot) combination
 * found within the existing schedule's time grid.
 *
 * - Locked entries are never relocated.
 * - Capped at MAX_REPAIR_ATTEMPTS to ensure sub-second runtime.
 * - Pure function — does not mutate input array.
 */
export function repairHardConflicts(
	entries: ScheduledEntry[],
	lockedEntryIds: Set<string>,
	maxAttempts = MAX_REPAIR_ATTEMPTS,
): { entries: ScheduledEntry[]; impact: RepairImpact } {
	const repaired = [...entries];
	let attemptsTotal = 0;
	let conflictsResolved = 0;
	let conflictsUnresolved = 0;
	const unresolvedByReason: RepairImpact['unresolvedByReason'] = {
		lockedOrMissing: 0,
		noFeasibleSlot: 0,
		attemptCapReached: 0,
	};

	// Collect all unique (day, startTime, endTime) period slots from existing entries
	const slotMap = new Map<string, { day: string; startTime: string; endTime: string }>();
	for (const e of repaired) {
		const key = `${e.day}:${e.startTime}:${e.endTime}`;
		if (!slotMap.has(key)) {
			slotMap.set(key, { day: e.day, startTime: e.startTime, endTime: e.endTime });
		}
	}
	const availableSlots = [...slotMap.values()].sort(
		(a, b) => a.day.localeCompare(b.day) || a.startTime.localeCompare(b.startTime),
	);

	const conflictingIds = new Set<string>();
	for (let index = 0; index < repaired.length; index++) {
		for (let nextIndex = index + 1; nextIndex < repaired.length; nextIndex++) {
			const left = repaired[index];
			const right = repaired[nextIndex];
			if (left.day !== right.day || !intervalsOverlap(left, right)) continue;
			const leftSections = new Set(getEffectiveSectionIds(left));
			const rightSections = getEffectiveSectionIds(right);
			const sectionOverlap = rightSections.some((sectionId) => leftSections.has(sectionId));
			if ((left.facultyId != null && right.facultyId != null && left.facultyId === right.facultyId) || left.roomId === right.roomId || sectionOverlap) {
				conflictingIds.add(right.entryId);
			}
		}
	}

	if (conflictingIds.size === 0) {
		return {
			entries: repaired,
			impact: {
				attemptsTotal: 0,
				conflictsResolved: 0,
				conflictsUnresolved: 0,
				unresolvedByReason: { lockedOrMissing: 0, noFeasibleSlot: 0, attemptCapReached: 0 },
			},
		};
	}

	const entryById = new Map(repaired.map((e) => [e.entryId, e]));

	for (const conflictId of conflictingIds) {
		if (attemptsTotal >= maxAttempts) {
			conflictsUnresolved++;
			unresolvedByReason.attemptCapReached++;
			continue;
		}

		const target = entryById.get(conflictId);
		if (!target || lockedEntryIds.has(target.entryId)) {
			conflictsUnresolved++;
			unresolvedByReason.lockedOrMissing++;
			continue;
		}

		attemptsTotal++;
		let resolved = false;

		for (const slot of availableSlots) {
			// Skip the same slot — that's where the conflict already is
			if (slot.day === target.day && slot.startTime === target.startTime && slot.endTime === target.endTime) continue;

			// Apply relocation
			const relocated: ScheduledEntry = { ...target, day: slot.day, startTime: slot.startTime, endTime: slot.endTime };
			const candidateEntries = repaired.map((entry) => (entry.entryId === conflictId ? relocated : entry));
			if (!canPlaceWithoutConflict(relocated, candidateEntries.filter((entry) => entry.entryId !== conflictId))) continue;

			// Update arrays
			const idx = repaired.findIndex((e) => e.entryId === conflictId);
			if (idx >= 0) repaired[idx] = relocated;
			entryById.set(conflictId, relocated);

			resolved = true;
			conflictsResolved++;
			break;
		}

		if (!resolved) {
			conflictsUnresolved++;
			unresolvedByReason.noFeasibleSlot++;
		}
	}

	return { entries: repaired, impact: { attemptsTotal, conflictsResolved, conflictsUnresolved, unresolvedByReason } };
}

// ─── H-ALG-3b: Bounded ejection-chain repair for residual unassigned sessions ───

/**
 * Diagnostics for the ejection-chain repair. This pass is additive: it only
 * ever MOVES already-placed entries to other shape slots and PLACES a residual
 * session into a slot freed by such a move. It never changes demand, capacity,
 * the workload policy, the canonical grids, or the emitted blocker vocabulary.
 */
export interface EjectionRepairImpact {
	/** Unassigned items considered by the pass. */
	considered: number;
	/** Items placed by an ejection move. */
	placed: number;
	/** Placed entries relocated to make room. */
	relocatedEntries: number;
	/** Items with no feasible depth-1 ejection within the bound. */
	failed: number;
	/** Bounded relocation probes attempted. */
	probes: number;
	/** true when the probe cap stopped the pass early. */
	probeCapReached: boolean;
}

const EJECTION_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
/** Hard cap on relocation probes so the pass stays bounded on any dataset. */
const EJECTION_MAX_PROBES = 60_000;

interface EjectionTimeSlot {
	startTime: string;
	endTime: string;
}

interface EjectionPlacement {
	day: string;
	startTime: string;
	endTime: string;
}

/**
 * Resolve the candidate class slots for a grade/program scope. Canonical
 * `classProgramSlot` CLASS rows are authoritative; the observed entry grid is a
 * deterministic fallback for scopes without canonical rows. Cached per scope.
 */
function ejectionShapeSlots(
	input: ConstructorInput,
	gradeLevel: number,
	programType: string | null | undefined,
	cache: Map<string, EjectionTimeSlot[]>,
	observedSlots: EjectionTimeSlot[],
): EjectionTimeSlot[] {
	const cacheKey = `${gradeLevel}:${(programType ?? 'REGULAR').toUpperCase()}`;
	const cached = cache.get(cacheKey);
	if (cached) return cached;
	const contract = resolveTimetableShapeContract(input.timetableShapes, gradeLevel, programType);
	const canonical = (contract?.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'CLASS');
	const source: EjectionTimeSlot[] = canonical.length > 0
		? canonical.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime }))
		: observedSlots;
	const deduped: EjectionTimeSlot[] = [];
	const seen = new Set<string>();
	for (const slot of source) {
		const key = `${slot.startTime}-${slot.endTime}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push({ startTime: slot.startTime, endTime: slot.endTime });
	}
	deduped.sort((left, right) => {
		const startDiff = timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
		return startDiff !== 0 ? startDiff : timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
	});
	cache.set(cacheKey, deduped);
	return deduped;
}

/** True when the slot satisfies the persisted grade shift window (if any). */
function ejectionWithinGradeWindow(
	input: ConstructorInput,
	gradeLevel: number,
	programType: string | null | undefined,
	slot: EjectionTimeSlot,
): boolean {
	if (!input.gradeWindows || input.gradeWindows.length === 0) return true;
	const normalizedProgram = (programType ?? 'ALL').toUpperCase();
	const match = input.gradeWindows.find(
		(window) => window.gradeLevel === gradeLevel && (window.programType ?? 'ALL').toUpperCase() === normalizedProgram,
	) ?? input.gradeWindows.find(
		(window) => window.gradeLevel === gradeLevel && (window.programType ?? 'ALL').toUpperCase() === 'ALL',
	);
	if (!match) return true;
	return timeToMinutes(slot.startTime) >= timeToMinutes(match.startTime)
		&& timeToMinutes(slot.endTime) <= timeToMinutes(match.endTime);
}

/**
 * H-ALG-3b: bounded deterministic depth-1 ejection-chain repair.
 *
 * For each residual unassigned session, finds a shape slot where its section is
 * free, then relocates ONE already-placed entry that occupies its teacher at
 * that slot to another conflict-free shape slot, and finally places the session
 * into the freed slot. All moves are conservative and term-blind with respect
 * to occupancy (stronger than the term-aware validator), and respect the daily
 * teaching maximum and the weekly load cap.
 *
 * Deterministic: fixed iteration order, fixed slot ordering, no randomness and
 * no wall-clock input.
 * Bounded: at most `maxProbes` relocation probes; no move is made without an
 * immediate successful placement, so the pass can only reduce `unassigned`.
 */
export function repairUnassignedByEjection(
	input: ConstructorInput,
	entries: ScheduledEntry[],
	unassignedItems: UnassignedItem[],
	options: { lockedEntryIds?: Set<string>; maxProbes?: number } = {},
): { entries: ScheduledEntry[]; unassignedItems: UnassignedItem[]; impact: EjectionRepairImpact } {
	const impact: EjectionRepairImpact = {
		considered: 0,
		placed: 0,
		relocatedEntries: 0,
		failed: 0,
		probes: 0,
		probeCapReached: false,
	};
	if (unassignedItems.length === 0 || entries.length === 0) {
		return { entries, unassignedItems, impact };
	}
	const maxProbes = options.maxProbes ?? EJECTION_MAX_PROBES;
	const lockedEntryIds = options.lockedEntryIds ?? new Set<string>();

	const demandByKey = new Map<string, DemandItem>();
	for (const item of input.demandOverride ?? []) {
		const key = `${item.sectionId}:${item.subjectId}`;
		if (!demandByKey.has(key)) demandByKey.set(key, item);
	}
	const subjectById = new Map<number, SubjectInput>(input.subjects.map((subject) => [subject.id, subject]));
	const facultyMaxById = new Map<number, number>(input.faculty.map((member) => [member.id, member.maxHoursPerWeek * 60]));

	const observedSlotMap = new Map<string, EjectionTimeSlot>();
	for (const entry of entries) {
		observedSlotMap.set(`${entry.startTime}-${entry.endTime}`, { startTime: entry.startTime, endTime: entry.endTime });
	}
	const observedSlots = [...observedSlotMap.values()];
	const shapeCache = new Map<string, EjectionTimeSlot[]>();

	// Section scope fallback for entries whose demand binding is not in the override.
	const sectionScope = new Map<number, { gradeLevel: number; programType: string | null }>();
	for (const grade of input.sectionsByGrade) {
		for (const section of grade.sections) {
			sectionScope.set(section.id, { gradeLevel: grade.displayOrder, programType: section.programType ?? null });
		}
	}
	const scopeForEntry = (entry: ScheduledEntry): { gradeLevel: number; programType: string | null } => {
		const demand = demandByKey.get(`${entry.sectionId}:${entry.subjectId}`);
		if (demand) return { gradeLevel: demand.gradeLevel, programType: demand.programType ?? null };
		return sectionScope.get(entry.sectionId) ?? { gradeLevel: 0, programType: null };
	};

	const sectionBusy = new Map<number, Array<{ day: string; startTime: string; endTime: string }>>();
	const facultyBusy = new Map<number, Array<{ day: string; startTime: string; endTime: string }>>();
	const roomBusy = new Map<number, Array<{ day: string; startTime: string; endTime: string }>>();
	const facultyDayMinutes = new Map<string, number>();
	const facultyDayPeriods = new Map<string, Array<{ startTime: string; endTime: string; duration: number }>>();
	const facultyBaseMinutes = new Map<number, number>();
	const facultyTermMinutes = new Map<number, Map<number, number>>();

	const teachersOf = (entry: ScheduledEntry): number[] => {
		const modular = entry.metadata?.modularAssignments;
		if (modular && modular.length > 0) return modular.map((assignment) => assignment.facultyId);
		return entry.facultyId != null ? [entry.facultyId] : [];
	};
	const toggleBusy = (
		map: Map<number, Array<{ day: string; startTime: string; endTime: string }>>,
		id: number,
		slot: { day: string; startTime: string; endTime: string },
		add: boolean,
	): void => {
		if (add) {
			const list = map.get(id) ?? [];
			list.push(slot);
			map.set(id, list);
		} else {
			const list = map.get(id);
			if (!list) return;
			const index = list.findIndex((candidate) => candidate.day === slot.day
				&& candidate.startTime === slot.startTime
				&& candidate.endTime === slot.endTime);
			if (index >= 0) list.splice(index, 1);
		}
	};
	const applyEntry = (entry: ScheduledEntry, add: boolean): void => {
		const sign = add ? 1 : -1;
		const slot = { day: entry.day, startTime: entry.startTime, endTime: entry.endTime };
		for (const sectionId of getEffectiveSectionIds(entry)) toggleBusy(sectionBusy, sectionId, slot, add);
		for (const teacherId of teachersOf(entry)) toggleBusy(facultyBusy, teacherId, slot, add);
		toggleBusy(roomBusy, entry.roomId, slot, add);
		for (const teacherId of teachersOf(entry)) {
			const dayKey = `${teacherId}:${entry.day}`;
			facultyDayMinutes.set(dayKey, (facultyDayMinutes.get(dayKey) ?? 0) + sign * entry.durationMinutes);
			const periods = facultyDayPeriods.get(dayKey) ?? [];
			if (add) {
				periods.push({ startTime: entry.startTime, endTime: entry.endTime, duration: entry.durationMinutes });
			} else {
				const index = periods.findIndex((period) => period.startTime === entry.startTime && period.endTime === entry.endTime);
				if (index >= 0) periods.splice(index, 1);
			}
			facultyDayPeriods.set(dayKey, periods);
		}
		const modular = entry.metadata?.modularAssignments;
		if (modular && modular.length > 0) {
			for (const assignment of modular) {
				const termMap = facultyTermMinutes.get(assignment.facultyId) ?? new Map<number, number>();
				termMap.set(assignment.termIndex, (termMap.get(assignment.termIndex) ?? 0) + sign * entry.durationMinutes);
				facultyTermMinutes.set(assignment.facultyId, termMap);
			}
		} else if (entry.facultyId != null) {
			if (entry.termIndex != null) {
				const termMap = facultyTermMinutes.get(entry.facultyId) ?? new Map<number, number>();
				termMap.set(entry.termIndex, (termMap.get(entry.termIndex) ?? 0) + sign * entry.durationMinutes);
				facultyTermMinutes.set(entry.facultyId, termMap);
			} else {
				facultyBaseMinutes.set(entry.facultyId, (facultyBaseMinutes.get(entry.facultyId) ?? 0) + sign * entry.durationMinutes);
			}
		}
	};
	for (const entry of entries) applyEntry(entry, true);

	const busyHas = (
		map: Map<number, Array<{ day: string; startTime: string; endTime: string }>>,
		id: number,
		day: string,
		startTime: string,
		endTime: string,
	): boolean => (map.get(id) ?? []).some((slot) => slot.day === day && intervalsOverlap(slot, { startTime, endTime }));
	const sectionHas = (sectionIds: number[], day: string, startTime: string, endTime: string): boolean =>
		sectionIds.some((sectionId) => busyHas(sectionBusy, sectionId, day, startTime, endTime));
	const facultyHas = (teacherIds: number[], day: string, startTime: string, endTime: string): boolean =>
		teacherIds.some((teacherId) => busyHas(facultyBusy, teacherId, day, startTime, endTime));
	const roomHas = (roomId: number, day: string, startTime: string, endTime: string): boolean =>
		busyHas(roomBusy, roomId, day, startTime, endTime);

	const unavailableByFaculty = new Map<number, Array<{ day: string; startTime: string; endTime: string }>>();
	for (const preference of input.preferences ?? []) {
		for (const slot of preference.timeSlots ?? []) {
			if (String(slot.preference).toUpperCase() !== 'UNAVAILABLE') continue;
			const list = unavailableByFaculty.get(preference.facultyId) ?? [];
			list.push({ day: String(slot.day), startTime: String(slot.startTime), endTime: String(slot.endTime) });
			unavailableByFaculty.set(preference.facultyId, list);
		}
	}
	const isUnavailable = (facultyId: number, day: string, startTime: string, endTime: string): boolean => {
		const ranges = unavailableByFaculty.get(facultyId);
		if (!ranges) return false;
		for (const range of ranges) {
			if (range.day !== day) continue;
			if (intervalsOverlap({ startTime, endTime }, range)) return true;
		}
		return false;
	};

	/** Worst concurrent weekly load (base + heaviest per-term rotation load). */
	const projectedWorstTerm = (facultyId: number, termIndex: 1 | 2 | 3 | 4 | undefined, duration: number): number => {
		const base = facultyBaseMinutes.get(facultyId) ?? 0;
		const termMap = facultyTermMinutes.get(facultyId);
		if (termIndex == null) {
			let worst = 0;
			for (const minutes of termMap?.values() ?? []) worst = Math.max(worst, minutes);
			return base + duration + worst;
		}
		let worst = 0;
		let sawTerm = false;
		for (const [term, minutes] of termMap ?? []) {
			if (term === termIndex) {
				sawTerm = true;
				worst = Math.max(worst, minutes + duration);
			} else {
				worst = Math.max(worst, minutes);
			}
		}
		if (!sawTerm) worst = Math.max(worst, duration);
		return base + worst;
	};
	const canLoadTeacher = (facultyId: number, termIndex: 1 | 2 | 3 | 4 | undefined, day: string, duration: number): boolean => {
		if (input.policy) {
			const usedToday = facultyDayMinutes.get(`${facultyId}:${day}`) ?? 0;
			if (usedToday + duration > input.policy.maxTeachingMinutesPerDay) return false;
		}
		const max = facultyMaxById.get(facultyId);
		if (max != null && projectedWorstTerm(facultyId, termIndex, duration) > max) return false;
		return true;
	};
	const wouldExceedConsecutive = (facultyId: number, day: string, startTime: string, endTime: string, duration: number): boolean => {
		if (!input.policy || input.policy.enforceConsecutiveBreakAsHard !== true) return false;
		const all = [
			...(facultyDayPeriods.get(`${facultyId}:${day}`) ?? []),
			{ startTime, endTime, duration },
		].sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
		let consecutive = 0;
		for (let index = 0; index < all.length; index++) {
			if (index === 0) {
				consecutive = all[index].duration;
				continue;
			}
			const gap = timeToMinutes(all[index].startTime) - timeToMinutes(all[index - 1].endTime);
			consecutive = gap < input.policy.minBreakMinutesAfterConsecutiveBlock ? consecutive + all[index].duration : all[index].duration;
			if (consecutive > input.policy.maxConsecutiveTeachingMinutesBeforeBreak) return true;
		}
		return false;
	};

	const roomFeatureRequirements = (subject: SubjectInput | undefined): string[] =>
		(subject?.requiredFeatures ?? []).filter((feature) => !feature.startsWith('OWNER_DEPT:'));
	const pickRoom = (demand: DemandItem, day: string, startTime: string, endTime: string): RoomInput | undefined => {
		const subject = subjectById.get(demand.subjectId);
		const requiredType = demand.roomTypePreference ?? subject?.preferredRoomType ?? 'CLASSROOM';
		const requiredFeatures = roomFeatureRequirements(subject);
		return input.rooms
			.filter((room) => room.isTeachingSpace && room.type === requiredType)
			.filter((room) => isRoomGradeScopeCompatible(room, demand.gradeLevel))
			.filter((room) => requiredType !== 'CLASSROOM' || room.isSharedFacility !== true)
			.filter((room) => !roomHas(room.id, day, startTime, endTime))
			.filter((room) => roomCanFitEnrollment(room.capacity, demand.enrolledCount))
			.filter((room) => requiredFeatures.every((feature) => (room.features ?? []).includes(feature)))
			.sort((left, right) => {
				const leftHome = demand.homeRoomId != null && left.id === demand.homeRoomId ? 0 : 1;
				const rightHome = demand.homeRoomId != null && right.id === demand.homeRoomId ? 0 : 1;
				if (leftHome !== rightHome) return leftHome - rightHome;
				return left.id - right.id;
			})[0];
	};

	const candidatePlacements = (gradeLevel: number, programType: string | null): EjectionPlacement[] => {
		const timeSlots = ejectionShapeSlots(input, gradeLevel, programType, shapeCache, observedSlots);
		const placements: EjectionPlacement[] = [];
		for (const day of EJECTION_DAYS) {
			for (const slot of timeSlots) {
				if (!ejectionWithinGradeWindow(input, gradeLevel, programType, slot)) continue;
				placements.push({ day, startTime: slot.startTime, endTime: slot.endTime });
			}
		}
		return placements;
	};

	/**
	 * Find a conflict-free target for `entry`. On entry, `entry` is temporarily
	 * removed from the occupancy/load trackers so the candidate is evaluated
	 * against the schedule WITHOUT it. Returns the relocated entry (still
	 * unapplied), or applies `entry` back and returns undefined.
	 */
	const findRelocation = (entry: ScheduledEntry, blocked: EjectionPlacement): ScheduledEntry | undefined => {
		if (lockedEntryIds.has(entry.entryId)) return undefined;
		if (entry.metadata?.roomAssignmentReason === 'LOCKED_ENTRY') return undefined;
		const scope = scopeForEntry(entry);
		const entrySectionIds = getEffectiveSectionIds(entry);
		const entryTeachers = teachersOf(entry);
		if (entryTeachers.length === 0) return undefined;
		const placements = candidatePlacements(scope.gradeLevel, scope.programType).sort((left, right) => {
			const leftSameDay = left.day === blocked.day ? 0 : 1;
			const rightSameDay = right.day === blocked.day ? 0 : 1;
			if (leftSameDay !== rightSameDay) return leftSameDay - rightSameDay;
			const dayDiff = EJECTION_DAYS.indexOf(left.day as (typeof EJECTION_DAYS)[number])
				- EJECTION_DAYS.indexOf(right.day as (typeof EJECTION_DAYS)[number]);
			if (dayDiff !== 0) return dayDiff;
			const startDiff = timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
			return startDiff !== 0 ? startDiff : timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
		});
		applyEntry(entry, false);
		for (const placement of placements) {
			if (placement.day === entry.day && placement.startTime === entry.startTime && placement.endTime === entry.endTime) continue;
			impact.probes++;
			if (impact.probes > maxProbes) {
				impact.probeCapReached = true;
				break;
			}
			if (sectionHas(entrySectionIds, placement.day, placement.startTime, placement.endTime)) continue;
			if (facultyHas(entryTeachers, placement.day, placement.startTime, placement.endTime)) continue;
			// Keep the entry's own room when it is free, otherwise take another free
			// room of the same resolved authority at the target slot so a full-room
			// target slot is not a dead end.
			let targetRoomId = entry.roomId;
			if (roomHas(targetRoomId, placement.day, placement.startTime, placement.endTime)) {
				const entryDemand = demandByKey.get(`${entry.sectionId}:${entry.subjectId}`);
				const alternativeRoom = entryDemand
					? pickRoom(entryDemand, placement.day, placement.startTime, placement.endTime)
					: undefined;
				if (!alternativeRoom) continue;
				targetRoomId = alternativeRoom.id;
			}
			if (entryTeachers.some((teacherId) => isUnavailable(teacherId, placement.day, placement.startTime, placement.endTime))) continue;
			let loadOk = true;
			for (const teacherId of entryTeachers) {
				if (!canLoadTeacher(teacherId, entry.termIndex, placement.day, entry.durationMinutes)) {
					loadOk = false;
					break;
				}
				if (wouldExceedConsecutive(teacherId, placement.day, placement.startTime, placement.endTime, entry.durationMinutes)) {
					loadOk = false;
					break;
				}
			}
			if (!loadOk) continue;
			const relocated: ScheduledEntry = {
				...entry,
				roomId: targetRoomId,
				day: placement.day,
				startTime: placement.startTime,
				endTime: placement.endTime,
			};
			applyEntry(entry, true);
			return relocated;
		}
		applyEntry(entry, true);
		return undefined;
	};

	const working = [...entries];
	const remainingUnassigned: UnassignedItem[] = [];
	let ejectionCounter = 0;

	for (const item of unassignedItems) {
		impact.considered++;
		const demand = demandByKey.get(`${item.sectionId}:${item.subjectId}`);
		const isModular = Boolean(demand && (demand.modularGroupId || (demand.modularSubjects?.length ?? 0) > 0));
		const teacherIds = item.facultyId != null ? [item.facultyId] : [];
		if (!demand || isModular || item.entryKind === 'COHORT' || teacherIds.length === 0) {
			impact.failed++;
			remainingUnassigned.push(item);
			continue;
		}

		const sessionTermIndex = (item.termIndex ?? undefined) as 1 | 2 | 3 | 4 | undefined;
		const placements = candidatePlacements(demand.gradeLevel, demand.programType ?? null);

		const tryPlaceAt = (placement: EjectionPlacement): boolean => {
			if (sectionHas([item.sectionId], placement.day, placement.startTime, placement.endTime)) return false;
			if (facultyHas(teacherIds, placement.day, placement.startTime, placement.endTime)) return false;
			if (teacherIds.some((teacherId) => isUnavailable(teacherId, placement.day, placement.startTime, placement.endTime))) return false;
			for (const teacherId of teacherIds) {
				if (!canLoadTeacher(teacherId, sessionTermIndex, placement.day, demand.durationPerSession)) return false;
				if (wouldExceedConsecutive(teacherId, placement.day, placement.startTime, placement.endTime, demand.durationPerSession)) return false;
			}
			const room = pickRoom(demand, placement.day, placement.startTime, placement.endTime);
			if (!room) return false;
			const newEntry: ScheduledEntry = {
				entryId: `ejection-${ejectionCounter + 1}`,
				facultyId: teacherIds[0],
				roomId: room.id,
				subjectId: item.subjectId,
				sectionId: item.sectionId,
				day: placement.day,
				startTime: placement.startTime,
				endTime: placement.endTime,
				durationMinutes: demand.durationPerSession,
				termIndex: sessionTermIndex,
				entryKind: 'SECTION',
				programType: demand.programType ?? null,
				programCode: demand.programCode ?? null,
				programName: demand.programName ?? null,
				metadata: { roomAssignmentReason: 'GENERAL_POOL_ASSIGNED' },
			};
			ejectionCounter++;
			working.push(newEntry);
			applyEntry(newEntry, true);
			return true;
		};

		/**
		 * Relocate one blocking placed entry to a conflict-free shape slot, then
		 * attempt to place the residual session in the freed slot. Reverts the
		 * relocation if the placement still fails, so the schedule is unchanged
		 * unless the move strictly succeeds.
		 */
		const relocateAndPlace = (blocker: ScheduledEntry, placement: EjectionPlacement): boolean => {
			const relocated = findRelocation(blocker, placement);
			if (!relocated) return false;
			const index = working.findIndex((entry) => entry.entryId === blocker.entryId);
			if (index < 0) return false;
			applyEntry(blocker, false);
			working[index] = relocated;
			applyEntry(relocated, true);
			if (tryPlaceAt(placement)) {
				impact.relocatedEntries++;
				return true;
			}
			applyEntry(relocated, false);
			working[index] = blocker;
			applyEntry(blocker, true);
			return false;
		};

		let placed = false;
		for (const placement of placements) {
			// Case 1: the section and the owner teacher are both free.
			if (tryPlaceAt(placement)) {
				placed = true;
				break;
			}

			const sectionOccupant = working.find((entry) => entry.day === placement.day
				&& intervalsOverlap(entry, placement)
				&& getEffectiveSectionIds(entry).includes(item.sectionId));
			const teacherBusy = facultyHas(teacherIds, placement.day, placement.startTime, placement.endTime);

			// Case 2: the section owns the slot but the teacher is free — relocate
			// the section's own entry to another shape slot, then place here.
			if (sectionOccupant && !teacherBusy) {
				if (relocateAndPlace(sectionOccupant, placement)) {
					placed = true;
					break;
				}
				continue;
			}

			// Case 3: the section is free but the owner teacher is occupied —
			// relocate one teacher-blocking entry, then place here.
			if (!sectionOccupant && teacherBusy) {
				const blockers = working.filter((entry) => entry.day === placement.day
					&& intervalsOverlap(entry, placement)
					&& teachersOf(entry).some((teacherId) => teacherIds.includes(teacherId)));
				for (const blocker of blockers) {
					if (relocateAndPlace(blocker, placement)) {
						placed = true;
						break;
					}
				}
				if (placed) break;
			}

			// Case 4: section and teacher both occupied — two moves required; skip.
		}

		if (placed) {
			impact.placed++;
			continue;
		}
		impact.failed++;
		remainingUnassigned.push(item);
	}

	return { entries: working, unassignedItems: remainingUnassigned, impact };
}

// ─── H-ALG-4 + H-ALG-5: Hybrid run result ───

export interface HybridSchedulerResult extends ConstructorResult {
	/** Per-seed quality summaries for review diagnostics (H-ALG-5). */
	seedQuality: SeedQualitySummary[];
	/** Repair operator impact (H-ALG-3 diagnostics). */
	repairImpact: RepairImpact;
	/** Ejection-chain repair impact for residual unassigned sessions (H-ALG-3b). */
	ejectionImpact: EjectionRepairImpact;
	/** ID of the seed profile selected as best candidate. */
	selectedProfileId: SeedProfileId;
	/** true unless all profiles failed (catastrophic fallback). */
	hybridEnabled: boolean;
}

// ─── Main orchestrator ───

/**
 * H-ALG-1 through H-ALG-5: Run multi-seed greedy construction + repair.
 *
 * 1. Compute base demand once, then permute it per profile (H-ALG-1).
 * 2. Score each candidate with the proxy fitness function (H-ALG-2).
 * 3. Select the best candidate: fewest unassigned → highest fitness score.
 * 4. Apply bounded repair operators to resolve residual hard conflicts (H-ALG-3).
 * 5. Return repaired result with full seed quality + repair diagnostics (H-ALG-4/5).
 *
 * Falls back to single-baseline behavior if all profiles fail (should never happen).
 */
export function runHybridScheduler(input: ConstructorInput): HybridSchedulerResult {
	const seedQuality: SeedQualitySummary[] = [];
	const candidates: Array<{ result: ConstructorResult; profile: SeedProfile; fitness: FitnessScore }> = [];

	// H-ALG-1 / DEMAND-C01 / GEN-C02: the caller MUST supply the canonical
	// derived-demand override. This orchestrator never falls back to the legacy
	// catalog `computeDemand()` (term-blind, rotation-blind): a missing override
	// is a typed failure so no current-year path can silently use legacy demand.
	if (input.demandOverride == null) {
		const error = new Error('runHybridScheduler requires the canonical derived demand override; legacy catalog demand is not permitted on the current-year path.') as Error & { statusCode: number; code: string };
		error.statusCode = 409;
		error.code = 'DERIVED_DEMAND_REQUIRED';
		throw error;
	}
	const baseDemand = input.demandOverride;

	for (const profile of SEED_PROFILES) {
		try {
			const orderedDemand = profile.orderDemand(baseDemand, input);
			// demandOverride bypasses computeDemand inside constructBaseline
			const result = constructBaseline({ ...input, demandOverride: orderedDemand });

			// H-ALG-2: Proxy fitness — no full validator needed here; violation counts use 0
			const fitness = scoreFitness(result);

			candidates.push({ result, profile, fitness });
			seedQuality.push({
				profileId: profile.id,
				profileLabel: profile.label,
				assignedCount: result.assignedCount,
				unassignedCount: result.unassignedCount,
				policyBlockedCount: result.policyBlockedCount,
				fitnessScore: fitness.total,
				completionRate: fitness.completionRate,
			});

			console.log(
				`[hybrid-scheduler] profile=${profile.id} assigned=${result.assignedCount} unassigned=${result.unassignedCount} policyBlocked=${result.policyBlockedCount} score=${fitness.total}`,
			);
		} catch (profileError) {
			// A seed profile failure must never abort generation — skip and continue
			console.warn(
				`[hybrid-scheduler] Profile ${profile.id} failed:`,
				profileError instanceof Error ? profileError.message : String(profileError),
			);
		}
	}

	if (candidates.length === 0) {
		// Catastrophic fallback — all profiles failed; run direct baseline
		console.error('[hybrid-scheduler] All seed profiles failed — falling back to direct baseline.');
		const fallback = constructBaseline(input);
		return {
			...fallback,
			seedQuality: [],
			repairImpact: {
				attemptsTotal: 0,
				conflictsResolved: 0,
				conflictsUnresolved: 0,
				unresolvedByReason: { lockedOrMissing: 0, noFeasibleSlot: 0, attemptCapReached: 0 },
			},
			ejectionImpact: {
				considered: 0,
				placed: 0,
				relocatedEntries: 0,
				failed: 0,
				probes: 0,
				probeCapReached: false,
			},
			selectedProfileId: 'GRADE_ASC_SUBJECT_ASC',
			hybridEnabled: false,
		};
	}

	// Select best candidate: fewest unassigned (completion), then highest fitness score
	candidates.sort((a, b) => {
		if (a.result.unassignedCount !== b.result.unassignedCount) {
			return a.result.unassignedCount - b.result.unassignedCount;
		}
		return b.fitness.total - a.fitness.total;
	});

	const best = candidates[0];
	console.log(
		`[hybrid-scheduler] Selected profile=${best.profile.id} ` +
		`(assigned=${best.result.assignedCount} unassigned=${best.result.unassignedCount} ` +
		`policyBlocked=${best.result.policyBlockedCount})`,
	);

	// H-ALG-3: Repair hard conflicts in the best candidate
	// Locked entries are already conflict-free from the constructor pre-placement logic.
	// We pass an empty set since locked entryIds are opaque at this layer.
	const { entries: repairedEntries, impact: repairImpact } = repairHardConflicts(
		best.result.entries,
		new Set<string>(),
	);

	if (repairImpact.conflictsResolved > 0 || repairImpact.conflictsUnresolved > 0) {
		console.log(
			`[hybrid-scheduler] Repair: attempts=${repairImpact.attemptsTotal} ` +
			`resolved=${repairImpact.conflictsResolved} unresolved=${repairImpact.conflictsUnresolved}`,
		);
	}

	// H-ALG-3b: depth-1 ejection-chain repair for the residual unassigned sessions.
	// The pass only relocates already-placed entries into conflict-free shape slots
	// and places a residual session into the freed slot; it never weakens demand,
	// capacity, the workload policy, or the blocker vocabulary.
	const ejection = repairUnassignedByEjection(input, repairedEntries, best.result.unassignedItems, {
		lockedEntryIds: new Set<string>(),
	});
	if (ejection.impact.considered > 0) {
		console.log(
			`[hybrid-scheduler] Ejection repair: considered=${ejection.impact.considered} ` +
			`placed=${ejection.impact.placed} relocated=${ejection.impact.relocatedEntries} ` +
			`failed=${ejection.impact.failed} probes=${ejection.impact.probes}` +
			`${ejection.impact.probeCapReached ? ' probeCapReached' : ''}`,
		);
	}

	return {
		...best.result,
		entries: ejection.entries,
		unassignedItems: ejection.unassignedItems,
		assignedCount: best.result.assignedCount + ejection.impact.placed,
		unassignedCount: Math.max(0, best.result.unassignedCount - ejection.impact.placed),
		seedQuality,
		repairImpact,
		ejectionImpact: ejection.impact,
		selectedProfileId: best.profile.id,
		hybridEnabled: true,
	};
}
