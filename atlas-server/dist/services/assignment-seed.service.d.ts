/**
 * Assignment Seed Service
 *
 * Seeds FacultySubject (assignment) records for faculty×subject pairs where
 * `faculty.department` is contained in `subject.allowedSpecializations`.
 *
 * This runs automatically after every faculty sync to pre-populate the
 * FacultyAssignments page with qualified pairings that the Scheduler fills.
 */
export interface AssignmentSeedResult {
    created: number;
    skipped: number;
}
/**
 * For each non-stale active faculty member, scan all subjects whose
 * `allowedSpecializations` array includes the faculty's `department`.
 * Create a FacultySubject record (with empty sectionIds) if one doesn't exist.
 */
export declare function seedQualifiedAssignments(schoolId: number, _schoolYearId: number): Promise<AssignmentSeedResult>;
