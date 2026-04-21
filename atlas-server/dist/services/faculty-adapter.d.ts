/**
 * Faculty adapter interface and stub implementation.
 * In v1 the stub returns realistic mock data.
 * Swap to EnrollProFacultyAdapter when the real API is available.
 */
export interface ExternalFaculty {
    id: number;
    firstName: string;
    lastName: string;
    department: string | null;
    employmentStatus?: 'PERMANENT' | 'PROBATIONARY';
    isClassAdviser?: boolean;
    advisoryEquivalentHours?: number;
    canTeachOutsideDepartment?: boolean;
    contactInfo: string | null;
    advisedSectionId?: number | null;
    advisedSectionName?: string | null;
}
export interface FacultyFetchResult {
    teachers: ExternalFaculty[];
    source: 'enrollpro' | 'stub';
    fetchedAt: Date;
}
export interface FacultyAdapter {
    fetchFacultyBySchoolYear(schoolId: number, schoolYearId: number, authToken?: string): Promise<FacultyFetchResult>;
}
export declare class StubFacultyAdapter implements FacultyAdapter {
    fetchFacultyBySchoolYear(_schoolId: number, _schoolYearId: number): Promise<FacultyFetchResult>;
}
export declare class EnrollProFacultyAdapter implements FacultyAdapter {
    private baseUrl;
    constructor(baseUrl: string);
    fetchFacultyBySchoolYear(_schoolId: number, schoolYearId: number, authToken?: string): Promise<FacultyFetchResult>;
}
export declare function createFacultyAdapter(): FacultyAdapter;
