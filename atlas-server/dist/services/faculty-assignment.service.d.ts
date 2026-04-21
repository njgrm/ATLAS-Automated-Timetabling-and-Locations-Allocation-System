import { type AssignmentScopeInput } from './faculty-assignment-scope.service.js';
export type AssignmentMutationResult = {
    success: true;
    version: number;
} | {
    success: false;
    code: 'FACULTY_NOT_FOUND' | 'FACULTY_INACTIVE' | 'VERSION_CONFLICT' | 'SCHOOL_SCOPE_MISMATCH' | 'INVALID_SUBJECTS' | 'INVALID_ASSIGNMENT_SCOPE' | 'DUPLICATE_SECTION_OWNERSHIP';
    error: string;
    details?: Record<string, unknown>;
};
export declare function getAssignmentsByFaculty(facultyId: number, schoolYearId: number, authToken?: string): Promise<{
    facultyId: number;
    version: number;
    assignments: {
        gradeLevels: number[];
        sectionIds: number[];
        sections: import("./faculty-assignment-scope.service.js").ScopedSection[];
        id: number;
        facultyId: number;
        subjectId: number;
        schoolId: number;
        assignedBy: number;
        assignedAt: Date;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        subject: {
            id: number;
            name: string;
            code: string;
            minMinutesPerWeek: number;
        };
    }[];
} | null>;
export declare function setAssignments(facultyId: number, schoolId: number, schoolYearId: number, assignedBy: number, expectedVersion: number, assignments: AssignmentScopeInput[], authToken?: string): Promise<AssignmentMutationResult>;
export declare function getAssignmentSummary(schoolId: number, schoolYearId: number, authToken?: string): Promise<{
    id: number;
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    employmentStatus: string;
    isClassAdviser: boolean;
    advisoryEquivalentHours: number;
    canTeachOutsideDepartment: boolean;
    isActiveForScheduling: boolean;
    maxHoursPerWeek: number;
    version: number;
    subjectCount: number;
    sectionCount: number;
    subjectHours: number;
    assignments: {
        gradeLevels: number[];
        sectionIds: number[];
        sections: import("./faculty-assignment-scope.service.js").ScopedSection[];
        id: number;
        facultyId: number;
        subjectId: number;
        schoolId: number;
        assignedBy: number;
        assignedAt: Date;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        subject: {
            id: number;
            name: string;
            code: string;
            minMinutesPerWeek: number;
        };
    }[];
}[]>;
