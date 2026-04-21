import { type SectionsByGrade } from './section-adapter.js';
type FacultyLoadRow = {
    facultyId: number;
    facultyName: string;
    department: string | null;
    assignedSections: number;
    assignedSubjects: number;
    loadHours: number;
    maxHours: number;
    utilization: number;
};
export interface SeededTeachingLoadStats {
    min: number;
    p50: number;
    p95: number;
    max: number;
    mean: number;
}
export interface SeededTeachingLoadDiagnostics {
    facultyCount: number;
    sectionCount: number;
    requiredPairCount: number;
    assignedPairCount: number;
    unassignedSectionSubjectCount: number;
    facultyWithoutAssignmentsCount: number;
    adviserCount: number;
    adviserHomeroomMatchCount: number;
    maxAssignedHours: number;
    duplicateOwnershipCount: number;
    mtbFacultyCount: number;
    loadStats: SeededTeachingLoadStats;
    highestLoadFaculty: FacultyLoadRow[];
    unassignedPairs: Array<{
        sectionId: number;
        sectionName: string;
        subjectCode: string;
        subjectName: string;
    }>;
    facultyWithoutAssignments: Array<{
        facultyId: number;
        facultyName: string;
        department: string | null;
    }>;
}
export interface SeedTeachingLoadBaselineResult {
    diagnostics: SeededTeachingLoadDiagnostics;
    createdAssignmentRows: number;
    sectionSource: string;
    subjectCount: number;
}
export interface SeedTeachingLoadBaselineInput {
    schoolId: number;
    schoolYearId: number;
    assignedBy: number;
    authToken?: string;
    gradeLevels?: SectionsByGrade[];
    maxWeeklyHoursCap?: number;
}
export declare function collectSeededTeachingLoadDiagnostics(input: Pick<SeedTeachingLoadBaselineInput, 'schoolId' | 'schoolYearId' | 'authToken' | 'gradeLevels'>): Promise<SeededTeachingLoadDiagnostics>;
export declare function seedTeachingLoadBaseline(input: SeedTeachingLoadBaselineInput): Promise<SeedTeachingLoadBaselineResult>;
export {};
