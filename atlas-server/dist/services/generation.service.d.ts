/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { type ScheduledEntry, type Violation } from './constraint-validator.js';
import { type TimetableShapeContract, type UnassignedItem } from './schedule-constructor.js';
import { type SeedQualitySummary, type RepairImpact } from './hybrid-scheduler.js';
type PublishedStateReconciliationResult = {
    reconciledCount: number;
    reconciledRunIds: number[];
};
export declare function reconcileInvalidPublishedRunStates(schoolId: number, options?: {
    schoolYearId?: number;
    reason?: string;
    actorId?: number;
}): Promise<PublishedStateReconciliationResult>;
export interface RunSummary {
    classesProcessed: number;
    assignedCount: number;
    unassignedCount: number;
    roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
    homeRoomAttemptedCount?: number;
    homeRoomAssignedCount?: number;
    homeRoomSuccessRate?: number;
    policyBlockedCount: number;
    hardViolationCount: number;
    prePlacedCount?: number;
    invalidPrePlacedCount?: number;
    skippedPrePlacedReasons?: string[];
    violationCounts?: Record<string, number>;
    lockWarnings?: string[];
    modularWarnings?: string[];
    cohortCount?: number;
    contractWarnings?: string[];
    hybridEnabled?: boolean;
    selectedSeedProfile?: string;
    seedQuality?: SeedQualitySummary[];
    repairImpact?: RepairImpact;
    resourceDiagnostics?: {
        qualifiedFacultyCoverageBySubject: Array<{
            subjectId: number;
            subjectCode: string;
            requiredAssignments: number;
            qualifiedAssignments: number;
            coveragePercent: number;
        }>;
        slotSaturationByInterval: Array<{
            day: string;
            startTime: string;
            endTime: string;
            assigned: number;
            capacity: number;
            saturationPercent: number;
        }>;
        unassignedBySubjectGrade: Array<{
            subjectId: number;
            subjectCode: string;
            gradeLevel: number;
            count: number;
            reasons: Record<string, number>;
        }>;
        roomAssignmentReasonCounts?: Record<string, number>;
        homeRoomFallbackDiagnostics?: {
            homeRoomOccupied: number;
            noSameZoneStandardRoom: number;
            onlySpecializedRoomsAvailable: number;
            policyOrShiftWindowIncompatible: number;
        };
        zoneDistributionByTerm?: Array<{
            termIndex: 1 | 2 | 3;
            total: number;
            byZone: Record<string, {
                count: number;
                percent: number;
            }>;
        }>;
    };
    shiftWindowPolicy?: 'ENFORCED' | 'DISABLED';
    configuredShiftWindowCount?: number;
    termCounts?: {
        term1: number;
        term2: number;
        term3: number;
    };
    timetableShapeContracts?: TimetableShapeContract[];
    timetableDisplaySlots?: Array<{
        startTime: string;
        endTime: string;
        eventName?: string;
        isSpecialEvent?: boolean;
    }>;
}
export declare function triggerGenerationRun(schoolId: number, schoolYearId: number, actorId: number, options?: {
    ignoreRoomRequestGate?: boolean;
    enforceShiftWindows?: boolean;
    roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
    authToken?: string;
}): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
    id: number;
    schoolId: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
export declare function getLatestValidRun(schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
export declare function assertLatestRunIsCurrent(schoolId: number, schoolYearId: number): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
export declare function publishRun(schoolId: number, schoolYearId: number, runId: number, actorId: number, options?: {
    acknowledgeSoftViolations?: boolean;
}): Promise<{
    error: string | null;
    id: number;
    schoolId: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
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
export interface ViolationReport {
    runId: number;
    status: string;
    violations: Violation[];
    counts: {
        total: number;
        byCode: Record<string, number>;
    };
}
export declare function getRunViolations(runId: number, schoolId: number, schoolYearId: number, termIndex?: number): Promise<ViolationReport>;
export declare function getLatestRunViolations(schoolId: number, schoolYearId: number, termIndex?: number): Promise<ViolationReport>;
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
    unpublishedRunIds: number[];
}>;
export {};
