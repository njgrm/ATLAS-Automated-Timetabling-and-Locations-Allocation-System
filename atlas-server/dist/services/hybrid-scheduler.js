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
import { constructBaseline, computeDemand, } from './schedule-constructor.js';
/** Build a subjectId:sectionId → qualified-faculty-count index for constraint scoring. */
function buildQualifiedCountIndex(input) {
    const qualifiedSets = new Map();
    for (const fs of input.facultySubjects) {
        for (const sectionId of fs.sectionIds) {
            const key = `${fs.subjectId}:${sectionId}`;
            const s = qualifiedSets.get(key) ?? new Set();
            s.add(fs.facultyId);
            qualifiedSets.set(key, s);
        }
    }
    const result = new Map();
    for (const [key, s] of qualifiedSets) {
        result.set(key, s.size);
    }
    return result;
}
/** Return the minimum qualified-faculty count for a demand item (bottleneck metric). */
function getDemandConstraintScore(item, qualifiedCountIndex) {
    if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds?.length) {
        const counts = item.cohortMemberSectionIds.map((sid) => qualifiedCountIndex.get(`${item.subjectId}:${sid}`) ?? 0);
        return counts.length > 0 ? Math.min(...counts) : 0;
    }
    return qualifiedCountIndex.get(`${item.subjectId}:${item.sectionId}`) ?? 0;
}
const SESSION_PATTERN_ORDER = { MWF: 0, TTH: 1, ANY: 2 };
/** All seed profiles. Deterministic — no randomness; identical inputs → identical output. */
const SEED_PROFILES = [
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
                if (scoreA !== scoreB)
                    return scoreA - scoreB;
                return a.gradeLevel - b.gradeLevel || a.subjectId - b.subjectId;
            });
        },
    },
    {
        id: 'GRADE_DESC_SUBJECT_ASC',
        label: 'Grade descending (G10 first), subject ascending',
        orderDemand: (demand) => [...demand].sort((a, b) => b.gradeLevel - a.gradeLevel || a.subjectId - b.subjectId),
    },
    {
        id: 'SESSION_PATTERN_PRIORITY',
        label: 'Session pattern priority (MWF → TTH → ANY)',
        orderDemand: (demand) => [...demand].sort((a, b) => (SESSION_PATTERN_ORDER[a.sessionPattern] ?? 2) -
            (SESSION_PATTERN_ORDER[b.sessionPattern] ?? 2) ||
            a.gradeLevel - b.gradeLevel ||
            a.subjectId - b.subjectId),
    },
];
const HARD_VIOLATION_PENALTY = 1000;
const SOFT_VIOLATION_PENALTY = 10;
const UNASSIGNED_PENALTY = 50;
const POLICY_BLOCKED_PENALTY = 5;
/**
 * Pure fitness function — higher score is better.
 * Hard violations dominate (1000 pts each), ensuring infeasible candidates
 * rank below fully-assigned feasible candidates.
 */
export function scoreFitness(result, hardViolationCount = 0, softViolationCount = 0) {
    const classesProcessed = result.classesProcessed;
    const completionRate = classesProcessed > 0 ? result.assignedCount / classesProcessed : 0;
    const score = result.assignedCount * 100
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
/** Maximum relocation attempts to bound repair-pass runtime. */
const MAX_REPAIR_ATTEMPTS = 30;
function buildOccupancySets(entries) {
    const faculty = new Set();
    const room = new Set();
    const section = new Set();
    for (const e of entries) {
        faculty.add(`${e.facultyId}:${e.day}:${e.startTime}`);
        room.add(`${e.roomId}:${e.day}:${e.startTime}`);
        const sectionIds = e.entryKind === 'COHORT' && e.cohortMemberSectionIds?.length
            ? e.cohortMemberSectionIds
            : [e.sectionId];
        for (const sid of sectionIds) {
            section.add(`${sid}:${e.day}:${e.startTime}`);
        }
    }
    return { faculty, room, section };
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
export function repairHardConflicts(entries, lockedEntryIds) {
    const repaired = [...entries];
    let attemptsTotal = 0;
    let conflictsResolved = 0;
    let conflictsUnresolved = 0;
    // Collect all unique (day, startTime, endTime) period slots from existing entries
    const slotMap = new Map();
    for (const e of repaired) {
        const key = `${e.day}:${e.startTime}`;
        if (!slotMap.has(key)) {
            slotMap.set(key, { day: e.day, startTime: e.startTime, endTime: e.endTime });
        }
    }
    const availableSlots = [...slotMap.values()].sort((a, b) => a.day.localeCompare(b.day) || a.startTime.localeCompare(b.startTime));
    // Detect faculty-time conflicts
    const conflictingIds = new Set();
    const facultyBuckets = new Map();
    for (const e of repaired) {
        const key = `${e.facultyId}:${e.day}:${e.startTime}`;
        const arr = facultyBuckets.get(key) ?? [];
        arr.push(e.entryId);
        facultyBuckets.set(key, arr);
    }
    for (const ids of facultyBuckets.values()) {
        if (ids.length > 1)
            for (let i = 1; i < ids.length; i++)
                conflictingIds.add(ids[i]);
    }
    // Detect room-time conflicts
    const roomBuckets = new Map();
    for (const e of repaired) {
        const key = `${e.roomId}:${e.day}:${e.startTime}`;
        const arr = roomBuckets.get(key) ?? [];
        arr.push(e.entryId);
        roomBuckets.set(key, arr);
    }
    for (const ids of roomBuckets.values()) {
        if (ids.length > 1)
            for (let i = 1; i < ids.length; i++)
                conflictingIds.add(ids[i]);
    }
    // Detect section-time conflicts
    const sectionBuckets = new Map();
    for (const e of repaired) {
        const sectionIds = e.entryKind === 'COHORT' && e.cohortMemberSectionIds?.length
            ? e.cohortMemberSectionIds
            : [e.sectionId];
        for (const sid of sectionIds) {
            const key = `${sid}:${e.day}:${e.startTime}`;
            const arr = sectionBuckets.get(key) ?? [];
            arr.push(e.entryId);
            sectionBuckets.set(key, arr);
        }
    }
    for (const ids of sectionBuckets.values()) {
        if (ids.length > 1)
            for (let i = 1; i < ids.length; i++)
                conflictingIds.add(ids[i]);
    }
    if (conflictingIds.size === 0) {
        return { entries: repaired, impact: { attemptsTotal: 0, conflictsResolved: 0, conflictsUnresolved: 0 } };
    }
    const occ = buildOccupancySets(repaired);
    const entryById = new Map(repaired.map((e) => [e.entryId, e]));
    for (const conflictId of conflictingIds) {
        if (attemptsTotal >= MAX_REPAIR_ATTEMPTS)
            break;
        const target = entryById.get(conflictId);
        if (!target || lockedEntryIds.has(target.entryId)) {
            conflictsUnresolved++;
            continue;
        }
        attemptsTotal++;
        let resolved = false;
        const targetSectionIds = target.entryKind === 'COHORT' && target.cohortMemberSectionIds?.length
            ? target.cohortMemberSectionIds
            : [target.sectionId];
        for (const slot of availableSlots) {
            // Skip the same slot — that's where the conflict already is
            if (slot.day === target.day && slot.startTime === target.startTime)
                continue;
            // Check all three occupancy constraints
            const fKey = `${target.facultyId}:${slot.day}:${slot.startTime}`;
            if (occ.faculty.has(fKey))
                continue;
            const rKey = `${target.roomId}:${slot.day}:${slot.startTime}`;
            if (occ.room.has(rKey))
                continue;
            const sKeys = targetSectionIds.map((sid) => `${sid}:${slot.day}:${slot.startTime}`);
            if (sKeys.some((k) => occ.section.has(k)))
                continue;
            // Remove old occupancy marks
            occ.faculty.delete(`${target.facultyId}:${target.day}:${target.startTime}`);
            occ.room.delete(`${target.roomId}:${target.day}:${target.startTime}`);
            for (const sid of targetSectionIds) {
                occ.section.delete(`${sid}:${target.day}:${target.startTime}`);
            }
            // Apply relocation
            const relocated = { ...target, day: slot.day, startTime: slot.startTime, endTime: slot.endTime };
            // Add new occupancy marks
            occ.faculty.add(fKey);
            occ.room.add(rKey);
            for (const k of sKeys)
                occ.section.add(k);
            // Update arrays
            const idx = repaired.findIndex((e) => e.entryId === conflictId);
            if (idx >= 0)
                repaired[idx] = relocated;
            entryById.set(conflictId, relocated);
            resolved = true;
            conflictsResolved++;
            break;
        }
        if (!resolved)
            conflictsUnresolved++;
    }
    return { entries: repaired, impact: { attemptsTotal, conflictsResolved, conflictsUnresolved } };
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
export function runHybridScheduler(input) {
    const seedQuality = [];
    const candidates = [];
    // H-ALG-1: Compute base demand once, permute per profile
    const baseDemand = computeDemand(input.sectionsByGrade, input.subjects, input.cohorts ?? []);
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
            console.log(`[hybrid-scheduler] profile=${profile.id} assigned=${result.assignedCount} unassigned=${result.unassignedCount} policyBlocked=${result.policyBlockedCount} score=${fitness.total}`);
        }
        catch (profileError) {
            // A seed profile failure must never abort generation — skip and continue
            console.warn(`[hybrid-scheduler] Profile ${profile.id} failed:`, profileError instanceof Error ? profileError.message : String(profileError));
        }
    }
    if (candidates.length === 0) {
        // Catastrophic fallback — all profiles failed; run direct baseline
        console.error('[hybrid-scheduler] All seed profiles failed — falling back to direct baseline.');
        const fallback = constructBaseline(input);
        return {
            ...fallback,
            seedQuality: [],
            repairImpact: { attemptsTotal: 0, conflictsResolved: 0, conflictsUnresolved: 0 },
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
    console.log(`[hybrid-scheduler] Selected profile=${best.profile.id} ` +
        `(assigned=${best.result.assignedCount} unassigned=${best.result.unassignedCount} ` +
        `policyBlocked=${best.result.policyBlockedCount})`);
    // H-ALG-3: Repair hard conflicts in the best candidate
    // Locked entries are already conflict-free from the constructor pre-placement logic.
    // We pass an empty set since locked entryIds are opaque at this layer.
    const { entries: repairedEntries, impact: repairImpact } = repairHardConflicts(best.result.entries, new Set());
    if (repairImpact.conflictsResolved > 0 || repairImpact.conflictsUnresolved > 0) {
        console.log(`[hybrid-scheduler] Repair: attempts=${repairImpact.attemptsTotal} ` +
            `resolved=${repairImpact.conflictsResolved} unresolved=${repairImpact.conflictsUnresolved}`);
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
//# sourceMappingURL=hybrid-scheduler.js.map