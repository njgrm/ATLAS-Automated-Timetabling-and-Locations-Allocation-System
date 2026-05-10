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
import { type ConstructorInput, type ConstructorResult, type DemandItem } from './schedule-constructor.js';
import type { ScheduledEntry } from './constraint-validator.js';
export type SeedProfileId = 'GRADE_ASC_SUBJECT_ASC' | 'MOST_CONSTRAINED_FIRST' | 'GRADE_DESC_SUBJECT_ASC' | 'SESSION_PATTERN_PRIORITY';
export interface SeedProfile {
    id: SeedProfileId;
    label: string;
    orderDemand: (demand: DemandItem[], input: ConstructorInput) => DemandItem[];
}
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
/**
 * Pure fitness function — higher score is better.
 * Hard violations dominate (1000 pts each), ensuring infeasible candidates
 * rank below fully-assigned feasible candidates.
 */
export declare function scoreFitness(result: ConstructorResult, hardViolationCount?: number, softViolationCount?: number): FitnessScore;
export interface RepairImpact {
    /** Total relocation attempts made. */
    attemptsTotal: number;
    /** Conflicts successfully resolved by relocation. */
    conflictsResolved: number;
    /** Conflicts that could not be relocated within the cap. */
    conflictsUnresolved: number;
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
export declare function repairHardConflicts(entries: ScheduledEntry[], lockedEntryIds: Set<string>): {
    entries: ScheduledEntry[];
    impact: RepairImpact;
};
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
export declare function runHybridScheduler(input: ConstructorInput): HybridSchedulerResult;
