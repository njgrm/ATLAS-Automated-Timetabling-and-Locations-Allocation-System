/**
 * Grade shift window service — time window restrictions per grade band.
 * Business logic only; no transport concerns.
 */
export interface GradeWindowInput {
    gradeLevel: number;
    startTime: string;
    endTime: string;
}
export interface GradeWindowRow {
    id: number;
    schoolId: number;
    schoolYearId: number;
    gradeLevel: number;
    startTime: string;
    endTime: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare function listGradeWindows(schoolId: number, schoolYearId: number): Promise<GradeWindowRow[]>;
export declare function upsertGradeWindow(schoolId: number, schoolYearId: number, input: GradeWindowInput): Promise<GradeWindowRow>;
export declare function upsertGradeWindows(schoolId: number, schoolYearId: number, windows: GradeWindowInput[]): Promise<GradeWindowRow[]>;
export declare function deleteGradeWindow(schoolId: number, schoolYearId: number, gradeLevel: number): Promise<void>;
