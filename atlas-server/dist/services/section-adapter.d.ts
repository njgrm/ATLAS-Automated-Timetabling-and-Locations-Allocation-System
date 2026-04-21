/**
 * Section adapter interface and implementations.
 * Wave 3.5: Special program support + durable cache.
 *
 * Source metadata is always returned so callers can surface live vs fallback state.
 */
export type ProgramType = 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER';
type AdmissionMode = 'REGULAR' | 'SCP';
interface ProgramMetadata {
    programType: ProgramType;
    programCode: string;
    programName: string;
    admissionMode: AdmissionMode;
    isSpecialProgram: boolean;
}
export declare function normalizeProgramMetadata(rawProgramType: unknown, warnings?: string[]): ProgramMetadata & {
    upstreamProgramType: string | null;
};
export declare function normalizeEnrollProSectionsResponse(body: unknown): {
    gradeLevels: SectionsByGrade[];
    warnings: string[];
};
export interface ExternalSection {
    id: number;
    name: string;
    maxCapacity: number;
    enrolledCount: number;
    gradeLevelId: number;
    gradeLevelName: string;
    displayOrder: number;
    programType?: ProgramType;
    programCode?: string | null;
    programName?: string | null;
    admissionMode?: string | null;
    adviserId?: number | null;
    adviserName?: string | null;
    upstreamProgramType?: string | null;
    isSpecialProgram?: boolean;
}
export interface SectionsByGrade {
    gradeLevelId: number;
    gradeLevelName: string;
    displayOrder: number;
    sections: ExternalSection[];
}
export type SectionSourceLabel = 'enrollpro' | 'stub' | 'cached-enrollpro';
export interface SectionFetchResult {
    gradeLevels: SectionsByGrade[];
    source: SectionSourceLabel;
    fetchedAt: Date;
    fallbackReason?: string;
    isStale?: boolean;
    contractWarnings?: string[];
}
export interface SectionSummary {
    schoolId: number;
    schoolYearId: number;
    totalSections: number;
    totalEnrolled: number;
    byGradeLevel: Record<number, number>;
    enrolledByGradeLevel: Record<number, number>;
    sections: ExternalSection[];
    source: SectionSourceLabel;
    fetchedAt: Date | null;
    isStale: boolean;
    fallbackReason?: string;
    contractWarnings?: string[];
}
export interface SectionAdapter {
    fetchSectionsBySchoolYear(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionFetchResult>;
}
export declare class StubSectionAdapter implements SectionAdapter {
    fetchSectionsBySchoolYear(_schoolYearId: number, _schoolId: number): Promise<SectionFetchResult>;
}
export declare class EnrollProSectionAdapter implements SectionAdapter {
    private baseUrl;
    constructor(baseUrl?: string);
    fetchSectionsBySchoolYear(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionFetchResult>;
}
/**
 * Section source mode (env: SECTION_SOURCE_MODE).
 *   stub     — always use deterministic stub data
 *   enrollpro — always use EnrollPro API (fails clearly if unreachable)
 *   auto     — prefer EnrollPro, fallback to cached upstream snapshot only
 *
 * Legacy env vars SECTION_ADAPTER / FACULTY_ADAPTER = 'stub' are honoured
 * as shorthand for SECTION_SOURCE_MODE=stub.
 *
 * SECTION_STRICT_UPSTREAM=true makes 'auto' behave like fail-fast (no fallback).
 */
export type SectionSourceMode = 'stub' | 'enrollpro' | 'auto';
export declare const sectionSourceMode: SectionSourceMode;
export declare const sectionAdapter: SectionAdapter;
export {};
