import type { ExternalSection, SectionsByGrade } from './section-adapter.js';
export interface ScopedSection extends ExternalSection {
    displayOrder: number;
}
export interface SectionRosterIndex {
    sectionMap: Map<number, ScopedSection>;
    sectionsByGrade: Map<number, ScopedSection[]>;
}
export interface AssignmentScopeInput {
    subjectId: number;
    gradeLevels?: number[] | null;
    sectionIds?: number[] | null;
}
export interface NormalizedAssignmentScope {
    subjectId: number;
    gradeLevels: number[];
    sectionIds: number[];
    sections: ScopedSection[];
    scopeSource: 'sectionIds' | 'legacyGradeLevels';
}
export interface ScopeNormalizationError {
    code: 'INVALID_SECTION_IDS' | 'INVALID_GRADE_LEVELS' | 'EMPTY_SCOPE';
    message: string;
    invalidSectionIds?: number[];
    invalidGradeLevels?: number[];
}
export interface ScopeNormalizationResult {
    ok: true;
    value: NormalizedAssignmentScope;
}
export interface ScopeNormalizationFailure {
    ok: false;
    error: ScopeNormalizationError;
}
export interface FacultySectionOwnership {
    facultyId: number;
    facultyName: string;
    subjectId: number;
    sectionIds: number[];
}
export interface OwnershipConflict {
    subjectId: number;
    sectionId: number;
    ownerFacultyId: number;
    ownerFacultyName: string;
}
export declare function buildSectionRosterIndex(gradeLevels: SectionsByGrade[]): SectionRosterIndex;
export declare function normalizeIncomingAssignmentScope(assignment: AssignmentScopeInput, rosterIndex: SectionRosterIndex): ScopeNormalizationResult | ScopeNormalizationFailure;
export declare function normalizeStoredAssignmentScope(assignment: AssignmentScopeInput, rosterIndex: SectionRosterIndex): NormalizedAssignmentScope;
export declare function getAssignmentOwnershipKey(subjectId: number, sectionId: number): string;
export declare function detectSectionOwnershipConflicts(proposedFacultyId: number, proposedAssignments: Pick<NormalizedAssignmentScope, 'subjectId' | 'sectionIds'>[], existingAssignments: FacultySectionOwnership[]): OwnershipConflict[];
/**
 * Derives sorted unique grade levels from an array of sectionIds by looking up
 * each section's displayOrder in the provided map. Used by scope repair and
 * normalization operations that work directly against the SectionMirror table
 * instead of the section adapter HTTP service.
 */
export declare function deriveGradeLevelsFromSectionIds(sectionIds: readonly number[], sectionDisplayOrderMap: ReadonlyMap<number, number>): number[];
/**
 * Expands grade levels to section IDs using a Map<gradeLevel, sectionId[]>.
 * Produces a sorted, deduplicated list. Used by legacy-row repair where
 * sectionIds is empty but gradeLevels is populated.
 */
export declare function expandGradeLevelsToSectionIds(gradeLevels: readonly number[], sectionsByGrade: ReadonlyMap<number, number[]>): number[];
