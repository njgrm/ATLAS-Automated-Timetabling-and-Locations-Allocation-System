/**
 * Benchmark harness: baseline vs hybrid scheduler (H-ALG-4).
 *
 * Runs both the single-pass baseline constructor and the hybrid multi-seed
 * orchestrator on a dense synthetic fixture dataset.
 *
 * Outputs a benchmark report artifact comparing:
 *   - Completion rate (assigned / classesProcessed)
 *   - Unassigned count
 *   - Policy blocked count
 *   - Runtime (p50/p95/max across N iterations)
 *
 * Usage:
 *   npx tsx src/scripts/benchmark-hybrid.ts [--iterations=5]
 *
 * Acceptance gate (H-ALG-4):
 *   - Hybrid must NOT regress completion rate vs baseline.
 *   - Hybrid runtime must stay within 60 s budget per run.
 *   - Benchmark must be reproducible across identical inputs.
 */
import { constructBaseline } from '../services/schedule-constructor.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
/** Build a minimal valid SectionsByGrade for the benchmark fixture. */
function benchGrade(displayOrder, sections) {
    return {
        gradeLevelId: displayOrder,
        gradeLevelName: `Grade ${displayOrder}`,
        displayOrder,
        sections: sections.map((s) => ({
            id: s.id,
            name: s.name,
            maxCapacity: 45,
            enrolledCount: s.enrolledCount,
            gradeLevelId: displayOrder,
            gradeLevelName: `Grade ${displayOrder}`,
            displayOrder,
            programType: 'REGULAR',
            adviserId: s.adviserId,
            adviserName: s.adviserName,
        })),
    };
}
// ─── Synthetic dense fixture ───
const FIXTURE_INPUT = {
    schoolId: 1,
    schoolYearId: 1,
    sectionsByGrade: [
        benchGrade(7, [
            { id: 1, name: '7-A', enrolledCount: 42, adviserId: 1, adviserName: 'Santos' },
            { id: 2, name: '7-B', enrolledCount: 40, adviserId: 2, adviserName: 'Reyes' },
            { id: 3, name: '7-C', enrolledCount: 38, adviserId: 3, adviserName: 'Cruz' },
        ]),
        benchGrade(8, [
            { id: 4, name: '8-A', enrolledCount: 40, adviserId: 4, adviserName: 'Bautista' },
            { id: 5, name: '8-B', enrolledCount: 38, adviserId: 5, adviserName: 'Dela Cruz' },
        ]),
        benchGrade(9, [
            { id: 6, name: '9-A', enrolledCount: 36, adviserId: 6, adviserName: 'Garcia' },
            { id: 7, name: '9-B', enrolledCount: 35, adviserId: 7, adviserName: 'Hernandez' },
        ]),
        benchGrade(10, [
            { id: 8, name: '10-A', enrolledCount: 33, adviserId: 8, adviserName: 'Lim' },
        ]),
    ],
    subjects: [
        { id: 1, code: 'ENG', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
        { id: 2, code: 'MATH', minMinutesPerWeek: 250, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
        { id: 3, code: 'SCI', minMinutesPerWeek: 200, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10] },
        { id: 4, code: 'FIL', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
        { id: 5, code: 'AP', minMinutesPerWeek: 100, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
        { id: 6, code: 'ESP', minMinutesPerWeek: 100, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8] },
        { id: 7, code: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
        { id: 8, code: 'TLE', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10] },
        { id: 9, code: 'HG', minMinutesPerWeek: 50, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
    ],
    faculty: [
        { id: 1, maxHoursPerWeek: 24 },
        { id: 2, maxHoursPerWeek: 24 },
        { id: 3, maxHoursPerWeek: 24 },
        { id: 4, maxHoursPerWeek: 24 },
        { id: 5, maxHoursPerWeek: 24 },
        { id: 6, maxHoursPerWeek: 24 },
        { id: 7, maxHoursPerWeek: 24 },
        { id: 8, maxHoursPerWeek: 24 },
        { id: 9, maxHoursPerWeek: 24 },
        { id: 10, maxHoursPerWeek: 24 },
    ],
    facultySubjects: [
        // English (all sections)
        { facultyId: 1, subjectId: 1, gradeLevels: [7, 8], sectionIds: [1, 2, 3, 4, 5] },
        // Math (all sections)
        { facultyId: 2, subjectId: 2, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // Science (lab)
        { facultyId: 3, subjectId: 3, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // Filipino
        { facultyId: 4, subjectId: 4, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // AP
        { facultyId: 5, subjectId: 5, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // ESP
        { facultyId: 6, subjectId: 6, gradeLevels: [7, 8], sectionIds: [1, 2, 3, 4, 5] },
        // MAPEH
        { facultyId: 7, subjectId: 7, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // TLE
        { facultyId: 8, subjectId: 8, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // HG
        { facultyId: 9, subjectId: 9, gradeLevels: [7, 8, 9, 10], sectionIds: [1, 2, 3, 4, 5, 6, 7, 8] },
        // English G9/10
        { facultyId: 10, subjectId: 1, gradeLevels: [9, 10], sectionIds: [6, 7, 8] },
    ],
    rooms: [
        { id: 1, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 2, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 3, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 4, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 5, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 6, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 7, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 8, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 },
        { id: 9, type: 'LABORATORY', isTeachingSpace: true, capacity: 40 },
        { id: 10, type: 'TLE_WORKSHOP', isTeachingSpace: true, capacity: 40 },
    ],
    preferences: [],
    policy: {
        maxConsecutiveTeachingMinutesBeforeBreak: 150,
        minBreakMinutesAfterConsecutiveBlock: 10,
        maxTeachingMinutesPerDay: 360,
        earliestStartTime: '07:30',
        latestEndTime: '16:00',
        lunchStartTime: '11:40',
        lunchEndTime: '12:30',
        enforceLunchWindow: true,
        enableTleTwoPassPriority: true,
    },
};
function runBaseline(input) {
    const t0 = performance.now();
    const result = constructBaseline(input);
    const runtimeMs = performance.now() - t0;
    return {
        label: 'baseline',
        assignedCount: result.assignedCount,
        unassignedCount: result.unassignedCount,
        policyBlockedCount: result.policyBlockedCount,
        classesProcessed: result.classesProcessed,
        completionRate: result.classesProcessed > 0 ? result.assignedCount / result.classesProcessed : 0,
        runtimeMs,
    };
}
function runHybrid(input) {
    const t0 = performance.now();
    const result = runHybridScheduler(input);
    const runtimeMs = performance.now() - t0;
    return {
        label: 'hybrid',
        assignedCount: result.assignedCount,
        unassignedCount: result.unassignedCount,
        policyBlockedCount: result.policyBlockedCount,
        classesProcessed: result.classesProcessed,
        completionRate: result.classesProcessed > 0 ? result.assignedCount / result.classesProcessed : 0,
        runtimeMs,
        selectedProfile: result.selectedProfileId,
        seedCount: result.seedQuality.length,
    };
}
function percentile(values, pct) {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}
// ─── Main ───
const args = process.argv.slice(2);
const iterationsArg = args.find((a) => a.startsWith('--iterations='));
const iterations = iterationsArg ? parseInt(iterationsArg.split('=')[1], 10) : 5;
console.log('═'.repeat(60));
console.log('H-ALG-4 Benchmark: Baseline vs Hybrid Scheduler');
console.log(`Dataset: synthetic dense fixture (${FIXTURE_INPUT.sectionsByGrade.flatMap((g) => g.sections).length} sections, ${FIXTURE_INPUT.subjects.length} subjects, ${FIXTURE_INPUT.faculty.length} faculty, ${FIXTURE_INPUT.rooms.length} rooms)`);
console.log(`Iterations: ${iterations}`);
console.log('═'.repeat(60));
const baselineRuns = [];
const hybridRuns = [];
// Warm up
runBaseline(FIXTURE_INPUT);
runHybrid(FIXTURE_INPUT);
for (let i = 0; i < iterations; i++) {
    baselineRuns.push(runBaseline(FIXTURE_INPUT));
    hybridRuns.push(runHybrid(FIXTURE_INPUT));
}
const baselineRuntimes = baselineRuns.map((r) => r.runtimeMs);
const hybridRuntimes = hybridRuns.map((r) => r.runtimeMs);
const lastBaseline = baselineRuns[baselineRuns.length - 1];
const lastHybrid = hybridRuns[hybridRuns.length - 1];
console.log('\n── Results ──');
console.log('');
console.log(`${'Metric'.padEnd(28)} ${'Baseline'.padEnd(15)} Hybrid`);
console.log('-'.repeat(60));
console.log(`${'Assigned'.padEnd(28)} ${String(lastBaseline.assignedCount).padEnd(15)} ${lastHybrid.assignedCount}`);
console.log(`${'Unassigned'.padEnd(28)} ${String(lastBaseline.unassignedCount).padEnd(15)} ${lastHybrid.unassignedCount}`);
console.log(`${'Policy Blocked'.padEnd(28)} ${String(lastBaseline.policyBlockedCount).padEnd(15)} ${lastHybrid.policyBlockedCount}`);
console.log(`${'Classes Processed'.padEnd(28)} ${String(lastBaseline.classesProcessed).padEnd(15)} ${lastHybrid.classesProcessed}`);
console.log(`${'Completion Rate'.padEnd(28)} ${(lastBaseline.completionRate * 100).toFixed(1).padEnd(14)}% ${(lastHybrid.completionRate * 100).toFixed(1)}%`);
console.log(`${'Runtime p50 (ms)'.padEnd(28)} ${percentile(baselineRuntimes, 50).toFixed(1).padEnd(14)}  ${percentile(hybridRuntimes, 50).toFixed(1)}`);
console.log(`${'Runtime p95 (ms)'.padEnd(28)} ${percentile(baselineRuntimes, 95).toFixed(1).padEnd(14)}  ${percentile(hybridRuntimes, 95).toFixed(1)}`);
console.log(`${'Runtime max (ms)'.padEnd(28)} ${Math.max(...baselineRuntimes).toFixed(1).padEnd(14)}  ${Math.max(...hybridRuntimes).toFixed(1)}`);
console.log(`${'Selected Profile'.padEnd(28)} ${'(single)'.padEnd(15)} ${lastHybrid.selectedProfile}`);
console.log(`${'Seed Count'.padEnd(28)} ${'1'.padEnd(15)} ${lastHybrid.seedCount}`);
// H-ALG-4: Acceptance gate evaluation
console.log('\n── H-ALG-4 Acceptance Gate ──');
const runtimeBudgetMs = 60_000;
const hybridMaxRuntime = Math.max(...hybridRuntimes);
const baselineMaxRuntime = Math.max(...baselineRuntimes);
const completionRegression = lastHybrid.completionRate < lastBaseline.completionRate;
let passed = true;
function gate(condition, label) {
    const mark = condition ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${mark}: ${label}`);
    if (!condition)
        passed = false;
}
gate(!completionRegression, `Hybrid completion rate (${(lastHybrid.completionRate * 100).toFixed(1)}%) >= baseline (${(lastBaseline.completionRate * 100).toFixed(1)}%)`);
gate(hybridMaxRuntime < runtimeBudgetMs, `Hybrid max runtime (${hybridMaxRuntime.toFixed(0)} ms) < 60 000 ms budget`);
gate(baselineRuns[0].assignedCount === baselineRuns[1]?.assignedCount, 'Baseline is deterministic across runs');
gate(hybridRuns[0].selectedProfile === hybridRuns[1]?.selectedProfile, 'Hybrid selected profile is deterministic');
console.log('');
if (passed) {
    console.log('BENCHMARK RESULT: GO ✓ — Hybrid meets all acceptance gates.');
}
else {
    console.log('BENCHMARK RESULT: NO-GO ✗ — One or more acceptance gates failed.');
    process.exitCode = 1;
}
console.log('\n── Benchmark artifact (JSON) ──');
const artifact = {
    datasetDescription: 'synthetic-dense-fixture',
    sectionCount: FIXTURE_INPUT.sectionsByGrade.flatMap((g) => g.sections).length,
    subjectCount: FIXTURE_INPUT.subjects.length,
    facultyCount: FIXTURE_INPUT.faculty.length,
    roomCount: FIXTURE_INPUT.rooms.length,
    iterations,
    baseline: {
        assigned: lastBaseline.assignedCount,
        unassigned: lastBaseline.unassignedCount,
        policyBlocked: lastBaseline.policyBlockedCount,
        completionRate: lastBaseline.completionRate,
        runtimeP50Ms: percentile(baselineRuntimes, 50),
        runtimeP95Ms: percentile(baselineRuntimes, 95),
        runtimeMaxMs: Math.max(...baselineRuntimes),
    },
    hybrid: {
        assigned: lastHybrid.assignedCount,
        unassigned: lastHybrid.unassignedCount,
        policyBlocked: lastHybrid.policyBlockedCount,
        completionRate: lastHybrid.completionRate,
        selectedProfile: lastHybrid.selectedProfile,
        seedCount: lastHybrid.seedCount,
        runtimeP50Ms: percentile(hybridRuntimes, 50),
        runtimeP95Ms: percentile(hybridRuntimes, 95),
        runtimeMaxMs: Math.max(...hybridRuntimes),
    },
    gate: passed ? 'GO' : 'NO-GO',
};
console.log(JSON.stringify(artifact, null, 2));
