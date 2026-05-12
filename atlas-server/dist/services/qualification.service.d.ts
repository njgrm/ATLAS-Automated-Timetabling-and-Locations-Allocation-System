export type QualificationTier = 1 | 2 | 3 | null;
export interface QualificationResult {
    tier: QualificationTier;
    reason: string;
}
export declare class QualificationService {
    /**
     * Tiered Qualification Matcher (Backend Implementation)
     * Tier 1: Explicit Specialization match (Source of Truth)
     * Tier 2: Structural Department match
     * Tier 3: Fuzzy Keyword match (Smart Suggestion via SpecializationAlias)
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
