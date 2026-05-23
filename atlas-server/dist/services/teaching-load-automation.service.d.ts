/**
 * Teaching Load Automation Service
 *
 * Implements the state-preserving Auto-Fill algorithm per DO 005 s.2024.
 *
 * Algorithm Overview:
 *  1. Build a resolved-pair set and capacity map from existing SubjectSectionOwnership rows.
 *  2. Verify HG records for all active advisers (warn if missing).
 *  3. Build a work queue: all active subject × section pairs not already resolved.
 *  4. For each unresolved pair, find the best-qualified, lowest-loaded candidate.
 *  5. Respect DO 005 caps (standard = 1,800 min/week, hard = 2,400 min/week).
 *  6. Modular bundles: attempt entire group; persist partial if cap is hit mid-bundle.
 *  7. Persist FacultySubject + SubjectSectionOwnership in a single transaction.
 *  8. Return { preserved, created, unresolved, warnings, staffingReport }.
 *
 * Design invariants:
 * - NEVER overwrites an existing SubjectSectionOwnership row.
 * - HG advisory records are not touched (already written by hg-advisory.service).
 * - Business logic is entirely in this service; controllers are transport-only.
 */
export interface AutoFillResult {
    preserved: number;
    created: number;
    assignmentsCreated: number;
    uniqueTeachersAffected: number;
    unresolved: number;
    warnings: string[];
    staffingReport: StaffingReport;
}
export interface StaffingCrossTrainee {
    department: string;
    availableTeachers: number;
    totalSpareHours: number;
    qualifiedRecoveryHoursPerWeek?: number;
}
export interface StaffingReport {
    department: string;
    dominantShortageDepartment: string;
    unassignedSections: number;
    missingHoursPerWeek: number;
    concurrentUnassignedSections: number;
    concurrentMissingHoursPerWeek: number;
    recoverableConcurrentRows: number;
    recoverableConcurrentMissingHoursPerWeek: number;
    recoverableConcurrentMissingMinutesPerWeek: number;
    constrainedConcurrentRows: number;
    constrainedConcurrentMissingHoursPerWeek: number;
    constrainedConcurrentMissingMinutesPerWeek: number;
    recommendedNewHires: number;
    internalCrossTrainees: StaffingCrossTrainee[];
    missingMinutesPerWeek: number;
    concurrentMissingMinutesPerWeek: number;
    rotationAdjustedMinutesPerWeek: number;
    shortages: StaffingShortageDetail[];
}
export interface StaffingShortageDetail {
    department: string;
    count: number;
    missingMinutesPerWeek: number;
    concurrentCount: number;
    concurrentMissingMinutesPerWeek: number;
    recoverableConcurrentCount: number;
    recoverableConcurrentMissingMinutesPerWeek: number;
    constrainedConcurrentCount: number;
    constrainedConcurrentMissingMinutesPerWeek: number;
    rotationAdjustedMinutesPerWeek: number;
    sections: Array<{
        subjectId: number;
        subjectCode: string;
        subjectName: string;
        sectionId: number;
        sectionName: string;
        programType: string;
    }>;
}
export declare function autoFill(schoolId: number, schoolYearId: number, authToken?: string, options?: {
    previewOnly?: boolean;
    staffingOnly?: boolean;
}): Promise<AutoFillResult>;
