/**
 * Fix Suggestions Service
 *
 * Provides deterministic, human-readable fix suggestions for unassigned schedule items.
 * Maps each unassigned reason to a set of actionable suggestions including manual-edit
 * proposals that the frontend can preview before committing.
 */
type UnassignedReason = 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM';
type EntryKind = 'SECTION' | 'COHORT';
type FixActionType = 'ASSIGN_CANDIDATE_FACULTY' | 'SUGGEST_COMPATIBLE_ROOM' | 'PLACE_NEXT_BEST_SLOT' | 'OPEN_POLICY_SUGGESTION' | 'CONVERT_TO_FOLLOW_UP';
interface FixSuggestion {
    action: FixActionType;
    label: string;
    description: string;
    proposal?: Record<string, unknown>;
    policyHint?: string;
}
interface UnassignedExplanation {
    reason: UnassignedReason;
    humanLabel: string;
    humanDetail: string;
    impact: 'PUBLISH_BLOCKER' | 'WARNING';
    suggestions: FixSuggestion[];
}
interface UnassignedItemInput {
    sectionId: number;
    subjectId: number;
    gradeLevel: number;
    session: number;
    reason: UnassignedReason;
    entryKind?: EntryKind;
    programType?: string | null;
    programCode?: string | null;
    programName?: string | null;
    cohortCode?: string | null;
    cohortName?: string | null;
    cohortMemberSectionIds?: number[];
    cohortExpectedEnrollment?: number | null;
    adviserId?: number | null;
    adviserName?: string | null;
}
export declare function getFixSuggestions(schoolId: number, schoolYearId: number, runId: number, item: UnassignedItemInput): Promise<{
    item: UnassignedItemInput;
    explanation: UnassignedExplanation;
}>;
export {};
