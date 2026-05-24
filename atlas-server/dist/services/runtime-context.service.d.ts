type RuntimeContextEvidenceType = 'scheduling-policy' | 'section-mirror' | 'section-snapshot' | 'faculty-snapshot' | 'generation-run';
type RuntimeContextSource = 'atlas-persisted' | 'enrollpro-verified';
export type RuntimeContextEvidence = {
    type: RuntimeContextEvidenceType;
    schoolYearId: number;
    timestamp: string;
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
    };
};
export declare function resolveRuntimeContext(schoolId: number, authToken?: string): Promise<RuntimeContextResult | null>;
export {};
