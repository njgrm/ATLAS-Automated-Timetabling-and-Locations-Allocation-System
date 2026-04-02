/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { type ScheduledEntry, type Violation } from './constraint-validator.js';
export interface RunSummary {
    classesProcessed: number;
    assignedCount: number;
    unassignedCount: number;
    policyBlockedCount: number;
    hardViolationCount: number;
    violationCounts?: Record<string, number>;
}
export declare function triggerGenerationRun(schoolId: number, schoolYearId: number, actorId: number): Promise<any>;
export declare function getRunById(runId: number, schoolId: number, schoolYearId: number): Promise<any>;
export declare function getLatestRun(schoolId: number, schoolYearId: number): Promise<any>;
export declare function listRuns(schoolId: number, schoolYearId: number, limit?: number): Promise<any>;
export interface ViolationReport {
    runId: number;
    status: string;
    violations: Violation[];
    counts: {
        total: number;
        byCode: Record<string, number>;
    };
}
export declare function getRunViolations(runId: number, schoolId: number, schoolYearId: number): Promise<ViolationReport>;
export declare function getLatestRunViolations(schoolId: number, schoolYearId: number): Promise<ViolationReport>;
export interface DraftReport {
    runId: number;
    status: string;
    entries: ScheduledEntry[];
    summary: RunSummary | null;
    finishedAt: string | null;
    createdAt: string;
}
export declare function getRunDraft(runId: number, schoolId: number, schoolYearId: number): Promise<DraftReport>;
export declare function getLatestRunDraft(schoolId: number, schoolYearId: number): Promise<DraftReport>;
