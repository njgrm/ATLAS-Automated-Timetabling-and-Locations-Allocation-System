/**
 * Benchmark service — repeatable generation run harness.
 * Triggers N generation runs, collects timing/quality metrics, and outputs
 * a machine-readable benchmark report.
 *
 * Business logic only; no transport concerns.
 */
import { triggerGenerationRun } from './generation.service.js';
// ─── Helpers ───
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}
function minMaxMean(values) {
    if (values.length === 0)
        return { min: 0, max: 0, mean: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return { min, max, mean };
}
// ─── Main ───
export async function runBenchmark(schoolId, schoolYearId, actorId, runCount = 5, sectionSourceMode = 'unknown') {
    const runs = [];
    for (let i = 0; i < runCount; i++) {
        const completed = await triggerGenerationRun(schoolId, schoolYearId, actorId);
        const summary = (completed.summary ?? {});
        runs.push({
            runId: completed.id,
            status: completed.status,
            durationMs: completed.durationMs ?? 0,
            error: completed.error ?? null,
            assignedCount: summary.assignedCount ?? 0,
            unassignedCount: summary.unassignedCount ?? 0,
            hardViolationCount: summary.hardViolationCount ?? 0,
            policyBlockedCount: summary.policyBlockedCount ?? 0,
            classesProcessed: summary.classesProcessed ?? 0,
            violationCounts: summary.violationCounts,
        });
    }
    // Compute stats from successful runs
    const successRuns = runs.filter((r) => r.status === 'COMPLETED');
    const failRuns = runs.filter((r) => r.status !== 'COMPLETED');
    const durations = successRuns.map((r) => r.durationMs).sort((a, b) => a - b);
    const stats = {
        runCount,
        successCount: successRuns.length,
        failCount: failRuns.length,
        durations: {
            p50: percentile(durations, 50),
            p95: percentile(durations, 95),
            max: durations.length > 0 ? durations[durations.length - 1] : 0,
            min: durations.length > 0 ? durations[0] : 0,
            mean: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        },
        assignedCount: minMaxMean(successRuns.map((r) => r.assignedCount)),
        unassignedCount: minMaxMean(successRuns.map((r) => r.unassignedCount)),
        hardViolationCount: minMaxMean(successRuns.map((r) => r.hardViolationCount)),
        policyBlockedCount: minMaxMean(successRuns.map((r) => r.policyBlockedCount)),
    };
    // Guardrails
    const allRunsSucceeded = failRuns.length === 0;
    const hardViolationsStable = successRuns.every((r) => r.hardViolationCount === successRuns[0]?.hardViolationCount);
    const maxDurationUnder60s = stats.durations.max < 60_000;
    return {
        meta: {
            timestamp: new Date().toISOString(),
            schoolId,
            schoolYearId,
            runCount,
            actorId,
            sectionSourceMode,
        },
        runs,
        stats,
        guardrails: {
            allRunsSucceeded,
            hardViolationsStable,
            maxDurationUnder60s,
            overallPass: allRunsSucceeded && hardViolationsStable && maxDurationUnder60s,
        },
    };
}
//# sourceMappingURL=benchmark.service.js.map