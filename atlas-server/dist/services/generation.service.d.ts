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
    prePlacedCount?: number;
    invalidPrePlacedCount?: number;
    skippedPrePlacedReasons?: string[];
    violationCounts?: Record<string, number>;
    lockWarnings?: string[];
    cohortCount?: number;
    cohortizedClassCount?: number;
    contractWarnings?: string[];
}
export declare function triggerGenerationRun(schoolId: number, schoolYearId: number, actorId: number): Promise<{
    error: string | null;
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    version: number;
    updatedAt: Date;
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
export declare function assertGenerationRoomRequestGate(schoolId: number, schoolYearId: number): Promise<{
    blocked: boolean;
    openCount: number;
    runId: null;
} | {
    blocked: boolean;
    openCount: number;
    runId: number;
}>;
export declare function getGenerationRoomRequestGateStatus(schoolId: number, schoolYearId: number): Promise<{
    blocked: boolean;
    openCount: number;
    runId: null;
} | {
    blocked: boolean;
    openCount: number;
    runId: number;
}>;
export declare function getRunById(runId: number, schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    version: number;
    updatedAt: Date;
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
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    version: number;
    updatedAt: Date;
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
export declare function getLatestValidRun(schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    version: number;
    updatedAt: Date;
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
export declare function assertLatestRunIsCurrent(schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    version: number;
    updatedAt: Date;
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
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    version: number;
    updatedAt: Date;
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
export declare function invalidateStaleCompletedRuns(schoolId: number, schoolYearId: number): Promise<{
    invalidatedCount: number;
    staleRunIds: number[];
}>;
