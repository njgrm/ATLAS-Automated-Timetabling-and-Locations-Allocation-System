import { type AssignmentScopeInput } from './faculty-assignment-scope.service.js';
export type AssignmentMutationResult = {
    success: true;
    version: number;
} | {
    success: false;
    code: 'FACULTY_NOT_FOUND' | 'FACULTY_INACTIVE' | 'VERSION_CONFLICT' | 'SCHOOL_SCOPE_MISMATCH' | 'INVALID_SUBJECTS' | 'INVALID_ASSIGNMENT_SCOPE' | 'DUPLICATE_SECTION_OWNERSHIP' | 'HG_ADVISORY_IMMUTABLE';
    error: string;
    details?: Record<string, unknown>;
};
type AssignmentLoadShape = {
    subject: {
        minMinutesPerWeek: number;
    };
    sectionIds: number[];
    gradeLevels: number[];
};
export type TeachingLoadFormula = 'section' | 'grade';
export type DuplicateOwnershipInput = {
    facultyId: number;
    facultyName: string;
    subjectId: number;
    sectionIds: number[];
};
export type DuplicateOwnershipTuple = {
    subjectId: number;
    sectionId: number;
    owners: Array<{
        facultyId: number;
        facultyName: string;
    }>;
};
export type OwnershipConflictCandidate = {
    subjectId: number;
    sectionId: number;
    facultyId: number;
};
export type OwnershipConflictDetail = {
    subjectId: number;
    sectionId: number;
    ownerFacultyId: number;
    ownerFacultyName: string;
};
export type SubjectSectionOwnershipIndexEntry = {
    subjectId: number;
    sectionId: number;
    facultyId: number;
    facultyName: string;
};
export declare function computeTeachingLoadMinutes(assignments: AssignmentLoadShape[], formula: TeachingLoadFormula): number;
export declare function detectDuplicateOwnershipTuples(assignments: DuplicateOwnershipInput[]): DuplicateOwnershipTuple[];
export declare function buildOwnershipConflictDetails(conflicts: OwnershipConflictCandidate[], ownerNamesByFacultyId: Map<number, string>): OwnershipConflictDetail[];
export declare function buildDuplicateOwnershipBlockingResult(conflicts: OwnershipConflictCandidate[], ownerNamesByFacultyId: Map<number, string>): AssignmentMutationResult | null;
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
    faculty: {
        id: number;
        externalId: number;
        employeeId: string | null;
        firstName: string;
        lastName: string;
        department: string | null;
        specialization: string | null;
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
        loadPercentage: number;
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
    }[];
    ownershipIndex: SubjectSectionOwnershipIndexEntry[];
}>;
export {};
