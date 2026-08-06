import { syncFacultyFromExternal } from './faculty.service.js';
import { syncSectionsFromExternal } from './section.service.js';
type DriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RolloverAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO';
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
};
export type RolloverApplyResult = RolloverStatusResult & {
    applied: boolean;
    sync: {
        faculty: Awaited<ReturnType<typeof syncFacultyFromExternal>> | null;
        sections: Awaited<ReturnType<typeof syncSectionsFromExternal>> | null;
        policyReady: boolean;
    };
};
export declare function getRolloverStatus(schoolId: number, authToken?: string, options?: {
    includeCounts?: boolean;
    atlasSchoolYearId?: number | null;
}): Promise<RolloverStatusResult>;
export declare function previewRolloverSync(schoolId: number, authToken?: string): Promise<RolloverStatusResult>;
export declare function applyRolloverSync(schoolId: number, authToken?: string): Promise<RolloverApplyResult>;
export {};
