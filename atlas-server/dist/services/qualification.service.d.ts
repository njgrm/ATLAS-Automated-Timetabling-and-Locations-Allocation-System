export type QualificationTier = 1 | 2 | 3 | null;
export interface QualificationResult {
    tier: QualificationTier;
    reason: string;
}
export declare class QualificationService {
    /**
     * Tiered Qualification Matcher (Backend — Alias-Aware)
     *
     * Tier 1 (Explicit): An administrator-defined SpecializationAlias record maps
     *   the faculty's specialization to this subject's code.
     * Tier 2 (Structural): The faculty's specialization/department is in the
     *   subject's allowedSpecializations array (legacy fallback).
     * Tier 3 (Fuzzy): Legacy keyword heuristic.
     */
    static getQualificationTier(schoolId: number, faculty: {
        specialization: string | null;
        department: string | null;
    }, subject: {
        code: string;
        name: string;
        allowedSpecializations?: string[];
    }): Promise<QualificationResult>;
    private static matchesLegacyKeywords;
}
