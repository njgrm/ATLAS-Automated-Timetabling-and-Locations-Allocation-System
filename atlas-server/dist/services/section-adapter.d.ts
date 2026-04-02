/**
 * Section adapter interface and implementations.
 * Mirrors the faculty-adapter pattern: EnrollPro adapter (default) with stub fallback.
 */
export interface ExternalSection {
    id: number;
    name: string;
    maxCapacity: number;
    gradeLevelId: number;
    gradeLevelName: string;
}
export interface SectionsByGrade {
    gradeLevelId: number;
    gradeLevelName: string;
    displayOrder: number;
    sections: ExternalSection[];
}
export interface SectionSummary {
    totalSections: number;
    byGradeLevel: Record<number, number>;
    sections: ExternalSection[];
}
export interface SectionAdapter {
    fetchSectionsBySchoolYear(schoolYearId: number, authToken?: string): Promise<SectionsByGrade[]>;
}
export declare class StubSectionAdapter implements SectionAdapter {
    fetchSectionsBySchoolYear(_schoolYearId: number): Promise<SectionsByGrade[]>;
}
export declare class EnrollProSectionAdapter implements SectionAdapter {
    private baseUrl;
    constructor(baseUrl?: string);
    fetchSectionsBySchoolYear(schoolYearId: number, authToken?: string): Promise<SectionsByGrade[]>;
}
export declare const sectionAdapter: SectionAdapter;
