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
	computeDemand,
	type ConstructorInput,
	type ConstructorResult,
	type DemandItem,
} from './schedule-constructor.js';
import type { ScheduledEntry } from './constraint-validator.js';

// ─── H-ALG-1: Seed profiles ───

export type SeedProfileId =
	| 'GRADE_ASC_SUBJECT_ASC'    // default (mirrors existing single-seed behavior)
	| 'MOST_CONSTRAINED_FIRST'   // fewest qualified faculty → harder classes first
	| 'GRADE_DESC_SUBJECT_ASC'   // G10 first, then G9 etc. — promotes senior-grade room access
	| 'SESSION_PATTERN_PRIORITY'; // MWF → TTH → ANY — groups by pattern to reduce fragmentation

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

const SESSION_PATTERN_ORDER: Record<string, number> = { MWF: 0, TTH: 1, ANY: 2 };

/** All seed profiles. Deterministic — no randomness; identical inputs → identical output. */
const SEED_PROFILES: SeedProfile[] = [
	{
		id: 'GRADE_ASC_SUBJECT_ASC',
		label: 'Grade ascending, subject ascending (baseline)',
		// computeDemand already produces this ordering — no permutation needed
		orderDemand: (demand) => [...demand],
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
		label: 'Session pattern priority (MWF → TTH → ANY)',
		orderDemand: (demand) =>
			[...demand].sort(
				(a, b) =>
					(SESSION_PATTERN_ORDER[a.sessionPattern] ?? 2) -
					(SESSION_PATTERN_ORDER[b.sessionPattern] ?? 2) ||
					a.gradeLevel - b.gradeLevel ||
					a.subjectId - b.subjectId,
			),
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

// ─── H-ALG-4 + H-ALG-5: Hybrid run result ───

export interface HybridSchedulerResult extends ConstructorResult {
	/** Per-seed quality summaries for review diagnostics (H-ALG-5). */
	seedQuality: SeedQualitySummary[];
	/** Repair operator impact (H-ALG-3 diagnostics). */
	repairImpact: RepairImpact;
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

	// H-ALG-1: Compute base demand once, permute per profile
	const baseDemand = computeDemand(input.sectionsByGrade, input.subjects, input.cohorts ?? [], input.classTemplatePeriods ?? {});

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

	return {
		...best.result,
		entries: repairedEntries,
		seedQuality,
		repairImpact,
		selectedProfileId: best.profile.id,
		hybridEnabled: true,
	};
}
