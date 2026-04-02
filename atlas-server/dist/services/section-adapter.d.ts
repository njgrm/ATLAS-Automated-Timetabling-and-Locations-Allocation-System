/**
 * Section adapter interface and implementations.
 * Mirrors the faculty-adapter pattern: EnrollPro adapter (default) with stub fallback.
 */
export interface ExternalSection {
    id: number;
    name: string;
    maxCapacity: number;
    enrolledCount: number;
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
    schoolId: number;
    schoolYearId: number;
    totalSections: number;
    totalEnrolled: number;
    byGradeLevel: Record<number, number>;
    enrolledByGradeLevel: Record<number, number>;
    sections: ExternalSection[];
}
export interface SectionAdapter {
    fetchSectionsBySchoolYear(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionsByGrade[]>;
}
export declare class StubSectionAdapter implements SectionAdapter {
    fetchSectionsBySchoolYear(_schoolYearId: number, _schoolId: number): Promise<SectionsByGrade[]>;
}
export declare class EnrollProSectionAdapter implements SectionAdapter {
    private baseUrl;
    constructor(baseUrl?: string);
    fetchSectionsBySchoolYear(schoolYearId: number, _schoolId: number, authToken?: string): Promise<SectionsByGrade[]>;
}
export declare const sectionAdapter: SectionAdapter;
