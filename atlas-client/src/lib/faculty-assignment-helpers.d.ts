import type { ExternalSection, Subject } from '../types';
export declare const STANDARD_WEEKLY_TEACHING_HOURS = 30;
export declare const MAX_WEEKLY_TEACHING_HOURS = 40;
export declare const CLASS_ADVISER_EQUIVALENT_HOURS = 5;
export type LoadStatus = 'below-standard' | 'compliant' | 'overload-allowed' | 'over-cap';
export type FacultyAssignmentDraft = {
    subjectId: number;
    sectionIds: number[];
    gradeLevels: number[];
};
export type FacultyOwnershipState = {
    facultyId: number;
    facultyName: string;
    source: 'saved' | 'pending';
};
export type SubjectSectionOwnershipIndexEntry = {
    subjectId: number;
    sectionId: number;
    facultyId: number;
    facultyName: string;
};
export type LoadBreakdownItem = {
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    sectionId: number;
    sectionName: string;
    gradeLevel: number;
    minutesPerWeek: number;
    totalMinutes: number;
};
export type LoadProfile = {
    actualTeachingHours: number;
    equivalentHours: number;
    creditedTotalHours: number;
    overloadHours: number;
    overCapHours: number;
    status: LoadStatus;
    statusLabel: string;
    breakdown: LoadBreakdownItem[];
};
export declare function deriveLoadStatus(actualTeachingHours: number): {
    status: LoadStatus;
    label: string;
};
export declare function buildSectionMap(sections: ExternalSection[]): Map<number, ExternalSection>;
export declare function deriveGradeLevelsForSections(sectionIds: readonly number[], sectionMap: Map<number, ExternalSection>): number[];
export declare function normalizeDraftAssignments(assignments: FacultyAssignmentDraft[], sectionMap: Map<number, ExternalSection>): FacultyAssignmentDraft[];
export declare function buildAssignmentSignature(assignments: FacultyAssignmentDraft[]): string;
export declare function getAssignmentOwnershipKey(subjectId: number, sectionId: number): string;
export declare function buildOwnershipMap(assignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>, facultyNames: Record<number, string>, source: FacultyOwnershipState['source']): Record<string, FacultyOwnershipState>;
export declare function buildOwnershipMapFromIndex(ownershipIndex: SubjectSectionOwnershipIndexEntry[]): Record<string, FacultyOwnershipState>;
/**
 * Like buildOwnershipMap but accumulates ALL owners per key instead of last-write-wins.
 * Use this to detect database-level duplicate ownership conflicts that bypass the
 * transaction guardrails (e.g. via seeding scripts).
 */
export declare function buildMultiOwnerSavedMap(savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>, facultyNames: Record<number, string>): Record<string, FacultyOwnershipState[]>;
/**
 * Returns the set of ownership keys (subjectId:sectionId) that are owned by more
 * than one faculty in saved data — these are hard database-level conflicts.
 */
export declare function detectSavedConflictKeys(multiOwnerMap: Record<string, FacultyOwnershipState[]>): Set<string>;
export declare function buildPendingOwnershipMap(savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>, draftAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>, facultyNames: Record<number, string>): Record<string, FacultyOwnershipState>;
export declare function buildTeachingLoadProfile(assignments: FacultyAssignmentDraft[], subjects: Subject[], sectionMap: Map<number, ExternalSection>, equivalentHours?: number): LoadProfile;
