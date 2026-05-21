export type SubjectQualificationPriority = 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
export declare function normalizeDepartmentCode(value: string | null | undefined): string | null;
export declare function isSpecializationPrimarySubjectCode(subjectCode: string | null | undefined): boolean;
export declare function resolveSubjectOwnerDepartmentCode(subjectCode: string | null | undefined, subjectName?: string | null): string | null;
export declare function resolveSubjectQualificationPriority(subjectCode: string | null | undefined): SubjectQualificationPriority;
export declare function matchesSubjectOwnershipDepartment(facultyDepartment: string | null | undefined, subjectCode: string | null | undefined, subjectName?: string | null): boolean;
export declare function resolveSubjectRotationFamily(subjectCode: string | null | undefined, modularGroupId: string | null | undefined): string | null;
