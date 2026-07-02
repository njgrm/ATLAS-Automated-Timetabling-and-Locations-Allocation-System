/**
 * Manual schedule edit service — preview, commit, revert, and history
 * for manual drag-and-drop adjustments during the Review phase.
 * Business logic only; no transport concerns.
 */
import { type ValidatorContext, type ScheduledEntry, type ValidationResult, type Violation } from './constraint-validator.js';
import type { RunSummary, DraftReport } from './generation.service.js';
import type { UnassignedItem } from './schedule-constructor.js';
export type ManualEditType = 'PLACE_UNASSIGNED' | 'MOVE_ENTRY' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | 'CHANGE_TIMESLOT' | 'SWAP_ENTRIES' | 'REVERT';
export interface ManualEditProposal {
    editType: ManualEditType;
    /** For PLACE_UNASSIGNED: the unassigned item index/identity */
    sectionId?: number;
    subjectId?: number;
    session?: number;
    /** The existing entryId being moved (for MOVE_ENTRY, CHANGE_ROOM, etc.) */
    entryId?: string;
    /** Target values */
    targetDay?: string;
    targetStartTime?: string;
    targetEndTime?: string;
    targetRoomId?: number;
    targetFacultyId?: number;
}
export interface PreviewResult {
    allowed: boolean;
    hardViolations: Violation[];
    softViolations: Violation[];
    /** Net change in violation counts relative to current draft */
    violationDelta: {
        hardBefore: number;
        hardAfter: number;
        softBefore: number;
        softAfter: number;
    };
    /** Human-readable conflict descriptions built server-side */
    humanConflicts: HumanConflict[];
    /** Entries affected by this edit (before/after pair) */
    affectedEntries: AffectedEntry[];
    /** Policy threshold summaries for delta display */
    policyImpactSummary: PolicyImpact[];
}
export interface ManualEditBatchPreviewItem {
    index: number;
    proposal: ManualEditProposal;
    status: 'READY' | 'FAILED';
    entryId?: string;
    subjectId?: number;
    sectionId?: number;
    currentFacultyId?: number | null;
    targetFacultyId?: number | null;
    errorCode?: string;
    errorMessage?: string;
}
export interface ManualEditBatchPreviewResult extends PreviewResult {
    proposalCount: number;
    errorCount: number;
    proposals: ManualEditBatchPreviewItem[];
}
/** Machine-readable code + human-readable strings for UI rendering */
export interface HumanConflict {
    code: string;
    severity: 'HARD' | 'SOFT';
    /** Short title for card header, e.g. "Faculty Time Conflict" */
    humanTitle: string;
    /** Full human-readable detail, e.g. "Dela Cruz, Juan is already teaching 7-Einstein in Room 101 on Mon 8:00 AM–9:00 AM" */
    humanDetail: string;
    /** Optional delta string, e.g. "Limit: 200 min · Observed: 320 min · Δ +120 min" */
    delta?: string;
}
export interface AffectedEntry {
    entryId: string;
    subjectId: number;
    sectionId: number;
    facultyId: number | null;
    roomId: number;
    day: string;
    startTime: string;
    endTime: string;
    /** 'before' = the entry before the edit, 'after' = the entry after the edit */
    phase: 'before' | 'after';
    entryKind?: 'SECTION' | 'COHORT';
    cohortCode?: string | null;
    cohortName?: string | null;
    programType?: string | null;
    programCode?: string | null;
    programName?: string | null;
}
export interface PolicyImpact {
    code: string;
    label: string;
    /** e.g. "Limit: 200 min · Observed: 320 min · Δ +120 min" */
    summary: string;
    severity: 'HARD' | 'SOFT';
}
export interface CommitResult {
    editId: number;
    editIds?: number[];
    draft: DraftReport;
    violationDelta: PreviewResult['violationDelta'];
    warnings: Violation[];
    newVersion: number;
}
export interface ManualEditRecord {
    id: number;
    runId: number;
    actorId: number;
    editType: string;
    beforePayload: unknown;
    afterPayload: unknown;
    validationSummary: unknown;
    createdAt: string;
}
export declare function loadRunContext(runId: number, schoolId: number, schoolYearId: number): Promise<{
    run: {
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
    };
    entries: ScheduledEntry[];
    unassignedItems: UnassignedItem[];
    faculty: {
        id: number;
        maxHoursPerWeek: number;
    }[];
    facultySubjects: {
        facultyId: number;
        subjectId: number;
        gradeLevels: number[];
        sectionIds: number[];
    }[];
    rooms: {
        id: number;
        buildingId: number;
        type: import("@prisma/client").$Enums.RoomType;
        capacity: number | null;
        isTeachingSpace: boolean;
    }[];
    subjects: {
        id: number;
        gradeLevels: number[];
        minMinutesPerWeek: number;
        preferredRoomType: import("@prisma/client").$Enums.RoomType;
    }[];
    policyRecord: {
        id: number;
        schoolId: number;
        createdAt: Date;
        updatedAt: Date;
        schoolYearId: number;
        maxConsecutiveTeachingMinutesBeforeBreak: number;
        minBreakMinutesAfterConsecutiveBlock: number;
        maxTeachingMinutesPerDay: number;
        periodLengthMinutes: number;
        periodsPerDay: number;
        earliestStartTime: string;
        latestEndTime: string;
        maxWalkingDistanceMetersPerTransition: number;
        maxBuildingTransitionsPerDay: number;
        maxBackToBackTransitionsWithoutBuffer: number;
        maxIdleGapMinutesPerDay: number;
        targetFacultyDailyVacantMinutes: number;
        targetSectionDailyVacantPeriods: number;
        maxCompressedTeachingMinutesPerDay: number;
        flagCeremonyStartTime: string;
        flagCeremonyEndTime: string;
        recessStartTime: string;
        recessEndTime: string;
        lunchStartTime: string;
        lunchEndTime: string;
        teacherMoveEnabled: boolean;
        enforceConsecutiveBreakAsHard: boolean;
        enableTravelWellbeingChecks: boolean;
        avoidEarlyFirstPeriod: boolean;
        avoidLateLastPeriod: boolean;
        enableVacantAwareConstraints: boolean;
        enforceLunchWindow: boolean;
        showSpecialEventsInGrid: boolean;
        enableFlagCeremony: boolean;
        enableRecess: boolean;
        enableLunchWindow: boolean;
        enableTleTwoPassPriority: boolean;
        allowFlexibleSubjectAssignment: boolean;
        allowConsecutiveLabSessions: boolean;
        constraintConfig: import(".prisma/client/runtime/library").JsonValue | null;
    };
    buildings: {
        id: number;
        y: number;
        x: number;
    }[];
    facultyNameMap: Map<number, string>;
    roomNameMap: Map<number, string>;
    subjectNameMap: Map<number, string>;
    sectionEnrollment: Map<number, number>;
}>;
export declare function isPublishedSummary(summary: unknown): boolean;
export declare function buildValidatorCtx(schoolId: number, schoolYearId: number, runId: number, entries: ScheduledEntry[], refData: Awaited<ReturnType<typeof loadRunContext>>): ValidatorContext;
export type AppliedManualEdit = {
    index: number;
    proposal: ManualEditProposal;
    beforeEntry: ScheduledEntry | null;
    afterEntry: ScheduledEntry | null;
    removedUnassigned: UnassignedItem | null;
};
export declare function applyProposalBatch(entries: ScheduledEntry[], unassigned: UnassignedItem[], proposals: ManualEditProposal[]): {
    newEntries: ScheduledEntry[];
    newUnassigned: UnassignedItem[];
    applied: AppliedManualEdit[];
    items: ManualEditBatchPreviewItem[];
};
export declare function computeSummary(entries: ScheduledEntry[], unassigned: unknown[], validation: ValidationResult): RunSummary;
/**
 * Preserve publication state and display-slot metadata when a manual edit recomputes
 * a run's summary. Manual edits to a published run must not silently unpublish it;
 * unpublish must be an explicit action with its own audit trail.
 */
export declare function mergePreservedSummaryFields(existingSummary: unknown, newSummary: RunSummary): RunSummary & Record<string, unknown>;
export declare function buildHumanConflicts(violations: Violation[], entries: ScheduledEntry[], refData: Awaited<ReturnType<typeof loadRunContext>>): HumanConflict[];
export declare function buildPolicyImpacts(violations: Violation[], refData: Awaited<ReturnType<typeof loadRunContext>>): PolicyImpact[];
export declare function previewManualEdit(runId: number, schoolId: number, schoolYearId: number, proposal: ManualEditProposal): Promise<PreviewResult>;
export declare function previewManualEditBatch(runId: number, schoolId: number, schoolYearId: number, proposals: ManualEditProposal[]): Promise<ManualEditBatchPreviewResult>;
export declare function commitManualEdit(runId: number, schoolId: number, schoolYearId: number, actorId: number, proposal: ManualEditProposal, expectedVersion: number, allowSoftOverride?: boolean): Promise<CommitResult>;
export declare function commitManualEditBatch(runId: number, schoolId: number, schoolYearId: number, actorId: number, proposals: ManualEditProposal[], expectedVersion: number, allowSoftOverride?: boolean): Promise<CommitResult>;
export declare function revertLastEdit(runId: number, schoolId: number, schoolYearId: number, actorId: number): Promise<CommitResult>;
export declare function listManualEdits(runId: number, schoolId: number, schoolYearId: number): Promise<ManualEditRecord[]>;
export type SwapStrategy = 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE';
export interface SwapPreviewResult {
    entryIdA: string;
    entryIdB: string;
    direct: PreviewResult;
    recommendedStrategy: 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE' | 'BLOCKED';
    autoFixBlockingTarget: {
        day: string;
        startTime: string;
        endTime: string;
    } | null;
    autoFixBlockingPreview: PreviewResult | null;
    autoFixSourceTarget: {
        day: string;
        startTime: string;
        endTime: string;
    } | null;
    autoFixSourcePreview: PreviewResult | null;
}
export declare function previewManualSwapEntries(runId: number, schoolId: number, schoolYearId: number, entryIdA: string, entryIdB: string): Promise<SwapPreviewResult>;
export declare function swapManualEntries(runId: number, schoolId: number, schoolYearId: number, actorId: number, entryIdA: string, entryIdB: string, expectedVersion: number, strategy?: SwapStrategy, autoFixTarget?: {
    day: string;
    startTime: string;
    endTime: string;
} | null): Promise<CommitResult>;
export declare function getRunVersion(runId: number, schoolId: number, schoolYearId: number): Promise<number>;
