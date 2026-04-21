/**
 * Benchmark service — repeatable generation run harness.
 * Triggers N generation runs, collects timing/quality metrics, and outputs
 * a machine-readable benchmark report.
 *
 * Business logic only; no transport concerns.
 */
export interface BenchmarkRunResult {
    runId: number;
    status: string;
    durationMs: number;
    error?: string | null;
    assignedCount: number;
    unassignedCount: number;
    hardViolationCount: number;
    policyBlockedCount: number;
    classesProcessed: number;
    violationCounts?: Record<string, number>;
}
export interface BenchmarkStats {
    runCount: number;
    successCount: number;
    failCount: number;
    durations: {
        p50: number;
        p95: number;
        max: number;
        min: number;
        mean: number;
    };
    assignedCount: {
        min: number;
        max: number;
        mean: number;
    };
    unassignedCount: {
        min: number;
        max: number;
        mean: number;
    };
    hardViolationCount: {
        min: number;
        max: number;
        mean: number;
    };
    policyBlockedCount: {
        min: number;
        max: number;
        mean: number;
    };
}
export interface BenchmarkReport {
    meta: {
        timestamp: string;
        schoolId: number;
        schoolYearId: number;
        runCount: number;
        actorId: number;
        sectionSourceMode: string;
    };
    runs: BenchmarkRunResult[];
    stats: BenchmarkStats;
    guardrails: {
        allRunsSucceeded: boolean;
        hardViolationsStable: boolean;
        maxDurationUnder60s: boolean;
        overallPass: boolean;
    };
}
export declare function runBenchmark(schoolId: number, schoolYearId: number, actorId: number, runCount?: number, sectionSourceMode?: string): Promise<BenchmarkReport>;
