/**
 * HG Advisory Service
 *
 * Manages the physical database persistence of Homeroom Guidance (HG)
 * SubjectSectionOwnership records for class advisers.
 *
 * Architectural invariant: every active class adviser with a known
 * advisedSectionId MUST have a corresponding FacultySubject + SubjectSectionOwnership
 * row for the HG subject pointing to their advisory section. These rows are
 * immutable — setAssignments cannot delete them.
 */
export declare const HG_SUBJECT_CODE = "HG";
export declare const SYSTEM_ASSIGNED_BY = 0;
export interface HgSyncSummary {
    upserted: number;
    skipped: number;
    removed: number;
}
/**
 * After each faculty sync, call this to ensure every active class adviser has
 * a physical HG ownership record for their advisory section.
 *
 * Idempotent: safe to call multiple times. Existing correct records are not touched.
 */
export declare function syncAdvisoryHgAssignments(schoolId: number): Promise<HgSyncSummary>;
