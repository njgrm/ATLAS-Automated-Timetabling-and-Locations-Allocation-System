export type GenerationInputDomain = 'teachingLoad' | 'policy' | 'rooms' | 'sections' | 'subjects';
export type GenerationInputDomainSnapshot = {
    fingerprint: string;
    signals: Record<string, number | string | null>;
};
export type GenerationInputSnapshot = {
    schemaVersion: 1;
    schoolId: number;
    schoolYearId: number;
    computedAt: string;
    fingerprint: string;
    domains: Record<GenerationInputDomain, GenerationInputDomainSnapshot>;
};
export type GenerationInputComparison = {
    status: 'FRESH' | 'STALE' | 'UNKNOWN';
    message: string;
    actionHint: string;
    changedDomains: GenerationInputDomain[];
    checkedAt: string;
    runFingerprint?: string;
    currentFingerprint?: string;
    missingReason?: 'MISSING_RUN_SNAPSHOT' | 'SNAPSHOT_VERSION_MISMATCH' | 'COMPARISON_FAILED';
};
export declare function extractGenerationInputSnapshot(summary: unknown): GenerationInputSnapshot | null;
export declare function compareGenerationInputSnapshots(runSnapshot: GenerationInputSnapshot | null, currentSnapshot: GenerationInputSnapshot, checkedAt?: string): GenerationInputComparison;
export declare function computeGenerationInputSnapshot(schoolId: number, schoolYearId: number): Promise<GenerationInputSnapshot>;
export declare function compareCurrentInputsForRun(summary: unknown, schoolId: number, schoolYearId: number): Promise<GenerationInputComparison>;
