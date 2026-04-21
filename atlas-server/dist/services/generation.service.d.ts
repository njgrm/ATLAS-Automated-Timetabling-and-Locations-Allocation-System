/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { type ScheduledEntry, type Violation } from './constraint-validator.js';
import { type UnassignedItem } from './schedule-constructor.js';
export interface RunSummary {
    classesProcessed: number;
    assignedCount: number;
    unassignedCount: number;
    policyBlockedCount: number;
    hardViolationCount: number;
    violationCounts?: Record<string, number>;
    lockWarnings?: string[];
    cohortCount?: number;
    cohortizedClassCount?: number;
    contractWarnings?: string[];
}
export declare function triggerGenerationRun(schoolId: number, schoolYearId: number, actorId: number): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    schoolYearId: number;
    status: import("@prisma/client").$Enums.GenerationRunStatus;
    runType: string;
    triggeredBy: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    durationMs: number | null;
    summary: import(".prisma/client/runtime/library").JsonValue | null;
    violations: import(".prisma/client/runtime/library").JsonValue | null;
    draftEntries: import(".prisma/client/runtime/library").JsonValue | null;
    unassignedItems: import(".prisma/client/runtime/library").JsonValue | null;
}>;
export declare function getRunById(runId: number, schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    schoolYearId: number;
    status: import("@prisma/client").$Enums.GenerationRunStatus;
    runType: string;
    triggeredBy: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    durationMs: number | null;
    summary: import(".prisma/client/runtime/library").JsonValue | null;
    violations: import(".prisma/client/runtime/library").JsonValue | null;
    draftEntries: import(".prisma/client/runtime/library").JsonValue | null;
    unassignedItems: import(".prisma/client/runtime/library").JsonValue | null;
}>;
export declare function getLatestRun(schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    schoolYearId: number;
    status: import("@prisma/client").$Enums.GenerationRunStatus;
    runType: string;
    triggeredBy: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    durationMs: number | null;
    summary: import(".prisma/client/runtime/library").JsonValue | null;
    violations: import(".prisma/client/runtime/library").JsonValue | null;
    draftEntries: import(".prisma/client/runtime/library").JsonValue | null;
    unassignedItems: import(".prisma/client/runtime/library").JsonValue | null;
}>;
export declare function listRuns(schoolId: number, schoolYearId: number, limit?: number): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    schoolYearId: number;
    status: import("@prisma/client").$Enums.GenerationRunStatus;
    runType: string;
    triggeredBy: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    durationMs: number | null;
    summary: import(".prisma/client/runtime/library").JsonValue | null;
    violations: import(".prisma/client/runtime/library").JsonValue | null;
    draftEntries: import(".prisma/client/runtime/library").JsonValue | null;
    unassignedItems: import(".prisma/client/runtime/library").JsonValue | null;
}[]>;
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
    unassignedItems: UnassignedItem[];
    summary: RunSummary | null;
    version: number;
    finishedAt: string | null;
    createdAt: string;
}
export declare function getRunDraft(runId: number, schoolId: number, schoolYearId: number): Promise<DraftReport>;
export declare function getLatestRunDraft(schoolId: number, schoolYearId: number): Promise<DraftReport>;
