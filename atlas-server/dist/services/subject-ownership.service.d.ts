export type SubjectQualificationPriority = 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
type SubjectContractDefaultsInput = {
    subjectCode: string | null | undefined;
    subjectName?: string | null;
    modularGroupId?: string | null;
};
export declare function normalizeDepartmentCode(value: string | null | undefined): string | null;
export declare function isSpecializationPrimarySubjectCode(subjectCode: string | null | undefined): boolean;
export declare function normalizeSubjectQualificationPriority(value: string | null | undefined): SubjectQualificationPriority;
export declare function resolveSubjectOwnerDepartmentCode(subjectCode: string | null | undefined, subjectName?: string | null): string | null;
export declare function resolveSubjectQualificationPriority(subjectCode: string | null | undefined, explicitPriority?: string | null): SubjectQualificationPriority;
export declare function extractAdditionalOwnerDepartments(requiredFeatures: string[] | null | undefined): string[];
export declare function mergeRequiredFeaturesWithAdditionalOwnerDepartments(requiredFeatures: string[] | null | undefined, additionalOwnerDepartments: string[] | null | undefined): string[];
export declare function resolveSubjectAllowedOwnerDepartments(explicitOwnerDepartment: string | null | undefined, subjectCode: string | null | undefined, subjectName: string | null | undefined, requiredFeatures: string[] | null | undefined): string[];
export declare function resolveSubjectOutputLabel(subjectCode: string | null | undefined, subjectName?: string | null, modularGroupId?: string | null): string;
export declare function resolveSubjectContractDefaults(input: SubjectContractDefaultsInput): {
    ownerDepartment: string | null;
    qualificationPriority: SubjectQualificationPriority;
    rotationFamily: string | null;
    outputLabel: string;
    isSystemManaged: boolean;
};
export declare function matchesSubjectOwnershipDepartment(facultyDepartment: string | null | undefined, subjectCode: string | null | undefined, subjectName?: string | null, explicitOwnerDepartment?: string | null, requiredFeatures?: string[] | null): boolean;
export declare function resolveSubjectRotationFamily(subjectCode: string | null | undefined, modularGroupId: string | null | undefined): string | null;
export {};
