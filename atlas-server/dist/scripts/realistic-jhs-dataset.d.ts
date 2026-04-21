export type UpstreamProgramType = 'REGULAR' | 'SCIENCE_TECHNOLOGY_AND_ENGINEERING' | 'SPECIAL_PROGRAM_IN_THE_ARTS' | 'SPECIAL_PROGRAM_IN_SPORTS' | 'SPECIAL_PROGRAM_IN_JOURNALISM' | 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE' | 'SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION';
export interface RealisticTeacherSeed {
    sequence: number;
    employeeId: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    specialization: string | null;
    email: string;
    contactNumber: string;
    employmentStatus: 'PERMANENT' | 'PROBATIONARY';
    maxHoursPerWeek: number;
    canTeachOutsideDepartment: boolean;
}
export interface RealisticSectionBlueprint {
    sequence: number;
    name: string;
    gradeLevelName: string;
    displayOrder: number;
    maxCapacity: number;
    enrolledCount: number;
    upstreamProgramType: UpstreamProgramType;
    programCode: string | null;
    programName: string | null;
    admissionMode: 'REGULAR' | 'COMPETITIVE' | null;
}
export interface RealisticGradeBlueprint {
    gradeLevelName: string;
    displayOrder: number;
    sections: RealisticSectionBlueprint[];
}
export declare function buildRealisticGradeBlueprints(): RealisticGradeBlueprint[];
export declare function flattenRealisticSections(gradeBlueprints?: RealisticGradeBlueprint[]): RealisticSectionBlueprint[];
export declare function buildRealisticTeacherSeeds(): RealisticTeacherSeed[];
export declare const REALISTIC_SECTION_COUNT: number;
export declare const REALISTIC_TEACHER_COUNT: number;
