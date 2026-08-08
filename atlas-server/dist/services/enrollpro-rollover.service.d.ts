import { syncFacultyFromExternal, type FacultySyncMode } from './faculty.service.js';
import { syncSectionsFromExternal } from './section.service.js';
type DriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RolloverAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR';
export type EnrollProYearInfo = {
    id: number;
    yearLabel: string;
};
export type ActiveYearDriftState = {
    status: DriftStatus;
    message: string;
    recommendedAction: RolloverAction;
    atlasSchoolYearId: number | null;
    enrollProSchoolYearId: number | null;
    enrollProSchoolYearLabel: string | null;
    mirrorSyncedAt: string | null;
};
export type RolloverFeedCounts = {
    facultyCount: number;
    sectionCount: number;
    settingsReachable: boolean;
};
export type RolloverConflict = {
    code: string;
    message: string;
    details?: Record<string, unknown>;
};
export type RolloverDummyYearRecordCounts = {
    sectionMirrors: number;
    facultyPreferences: number;
    preferenceTimeSlots: number;
    preferenceReviews: number;
    facultyRoomPreferences: number;
    roomRequestAppeals: number;
    roomRequestAppealHistory: number;
    schedulingPolicies: number;
    generationRuns: number;
    publishedGenerationRuns: number;
    manualScheduleEdits: number;
    followUpFlags: number;
    publishedScheduleRevisions: number;
    auditLogs: number;
    lockedSessions: number;
    lockedSessionActions: number;
    gradeShiftWindows: number;
    facultySnapshots: number;
    sectionSnapshots: number;
    instructionalCohorts: number;
    teachingLoadFacultySubjects: number;
    teachingLoadOwnerships: number;
};
export type RolloverDummyYearResetPreview = {
    targetSchoolYearId: number | null;
    confirmationText: string;
    canResetDummyYear: boolean;
    publishedResetBlocked: boolean;
    teachingLoadResetRequired: boolean;
    counts: RolloverDummyYearRecordCounts;
    blockers: RolloverConflict[];
};
export type RolloverStatusResult = {
    schoolId: number;
    atlasSchoolYearId: number | null;
    enrollProActiveYear: EnrollProYearInfo | null;
    drift: ActiveYearDriftState;
    mirror: {
        enrollProSchoolYearId: number;
        yearLabel: string;
        isActive: boolean;
        lastVerifiedAt: string | null;
        lastSyncedAt: string | null;
        facultyCount: number;
        sectionCount: number;
        syncStatus: string;
        lastFailureSummary: string | null;
    } | null;
    counts?: RolloverFeedCounts;
    conflicts: RolloverConflict[];
    canResetDummyYear: boolean;
    resetTargetSchoolYearId: number | null;
    conflictingRecordCounts: RolloverDummyYearRecordCounts | null;
    teachingLoadResetRequired: boolean;
    publishedResetBlocked: boolean;
};
export type RolloverApplyResult = RolloverStatusResult & {
    applied: boolean;
    sync: {
        faculty: Awaited<ReturnType<typeof syncFacultyFromExternal>> | null;
        sections: Awaited<ReturnType<typeof syncSectionsFromExternal>> | null;
        policyReady: boolean;
    };
};
export type ResetDummyYearInput = {
    schoolId: number;
    actorId: number;
    authToken?: string;
    confirmReset?: boolean;
    confirmationText?: string;
};
export type RolloverDummyYearResetResult = RolloverStatusResult & {
    previewOnly: boolean;
    resetApplied: boolean;
    reset: RolloverDummyYearResetPreview;
    rolloverApply: RolloverApplyResult | null;
};
export declare function getRolloverStatus(schoolId: number, authToken?: string, options?: {
    includeCounts?: boolean;
    atlasSchoolYearId?: number | null;
}): Promise<RolloverStatusResult>;
export declare function previewRolloverSync(schoolId: number, authToken?: string): Promise<RolloverStatusResult>;
export declare function applyRolloverSync(schoolId: number, authToken?: string, options?: {
    facultyMode?: FacultySyncMode;
}): Promise<RolloverApplyResult>;
export declare function resetDummyYearAndApplyRollover(input: ResetDummyYearInput): Promise<RolloverDummyYearResetResult>;
export {};
