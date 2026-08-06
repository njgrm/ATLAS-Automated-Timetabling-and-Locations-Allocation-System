type RuntimeContextEvidenceType = 'school-year-mirror' | 'scheduling-policy' | 'section-mirror' | 'section-snapshot' | 'faculty-snapshot' | 'generation-run';
type RuntimeContextSource = 'atlas-persisted' | 'enrollpro-verified';
type RuntimeDriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RuntimeDriftAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO';
export type RuntimeContextEvidence = {
    type: RuntimeContextEvidenceType;
    schoolYearId: number;
    timestamp: string;
    source: string;
};
export type RuntimeYearEvidence = {
    yearId: number;
    timestamp: Date;
    type: RuntimeContextEvidenceType;
    source: string;
};
export type RuntimeContextResult = {
    schoolId: number;
    activeSchoolYearId: number;
    activeSchoolYearLabel: string | null;
    source: RuntimeContextSource;
    stale: boolean;
    resolvedAt: string;
    evidence: RuntimeContextEvidence[];
    upstream: {
        reachable: boolean;
        verified: boolean;
        matched: boolean | null;
        activeSchoolYearId: number | null;
        activeSchoolYearLabel: string | null;
    };
    activeYearDrift: {
        status: RuntimeDriftStatus;
        message: string;
        recommendedAction: RuntimeDriftAction;
        atlasSchoolYearId: number | null;
        enrollProSchoolYearId: number | null;
        enrollProSchoolYearLabel: string | null;
        mirrorSyncedAt: string | null;
    };
    rollover: {
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
    };
};
type ResolveRuntimeContextOptions = {
    verifyUpstream?: boolean;
};
export declare function pickBestRuntimeYear(evidence: RuntimeYearEvidence[]): RuntimeYearEvidence | null;
export declare function resolveRuntimeContext(schoolId: number, authToken?: string, options?: ResolveRuntimeContextOptions): Promise<RuntimeContextResult | null>;
export {};
