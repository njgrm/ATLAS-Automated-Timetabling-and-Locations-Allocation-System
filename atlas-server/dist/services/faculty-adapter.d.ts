/**
 * Faculty adapter interface and stub implementation.
 * In v1 the stub returns realistic mock data.
 * Swap to EnrollProFacultyAdapter when the real API is available.
 */
export interface ExternalFaculty {
    id: number;
    firstName: string;
    lastName: string;
    department: string;
    contactInfo: string | null;
}
export interface FacultyAdapter {
    fetchFacultyBySchool(schoolId: number, authToken?: string): Promise<ExternalFaculty[]>;
}
export declare class StubFacultyAdapter implements FacultyAdapter {
    fetchFacultyBySchool(_schoolId: number): Promise<ExternalFaculty[]>;
}
export declare class EnrollProFacultyAdapter implements FacultyAdapter {
    private baseUrl;
    constructor(baseUrl: string);
    fetchFacultyBySchool(_schoolId: number, authToken?: string): Promise<ExternalFaculty[]>;
}
export declare function createFacultyAdapter(): FacultyAdapter;
