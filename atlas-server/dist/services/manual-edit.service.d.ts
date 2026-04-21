/**
 * Manual schedule edit service — preview, commit, revert, and history
 * for manual drag-and-drop adjustments during the Review phase.
 * Business logic only; no transport concerns.
 */
import { type Violation } from './constraint-validator.js';
import type { DraftReport } from './generation.service.js';
export type ManualEditType = 'PLACE_UNASSIGNED' | 'MOVE_ENTRY' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | 'CHANGE_TIMESLOT' | 'REVERT';
export interface ManualEditProposal {
    editType: ManualEditType;
    /** For PLACE_UNASSIGNED: the unassigned item index/identity */
    sectionId?: number;
    subjectId?: number;
    session?: number;
    /** The existing entryId being moved (for MOVE_ENTRY, CHANGE_ROOM, etc.) */
    entryId?: string;
    /** Target values */
    targetDay?: string;
    targetStartTime?: string;
    targetEndTime?: string;
    targetRoomId?: number;
    targetFacultyId?: number;
}
export interface PreviewResult {
    allowed: boolean;
    hardViolations: Violation[];
    softViolations: Violation[];
    /** Net change in violation counts relative to current draft */
    violationDelta: {
        hardBefore: number;
        hardAfter: number;
        softBefore: number;
        softAfter: number;
    };
    /** Human-readable conflict descriptions built server-side */
    humanConflicts: HumanConflict[];
    /** Entries affected by this edit (before/after pair) */
    affectedEntries: AffectedEntry[];
    /** Policy threshold summaries for delta display */
    policyImpactSummary: PolicyImpact[];
}
/** Machine-readable code + human-readable strings for UI rendering */
export interface HumanConflict {
    code: string;
    severity: 'HARD' | 'SOFT';
    /** Short title for card header, e.g. "Faculty Time Conflict" */
    humanTitle: string;
    /** Full human-readable detail, e.g. "Dela Cruz, Juan is already teaching 7-Einstein in Room 101 on Mon 8:00 AM–9:00 AM" */
    humanDetail: string;
    /** Optional delta string, e.g. "Limit: 200 min · Observed: 320 min · Δ +120 min" */
    delta?: string;
}
export interface AffectedEntry {
    entryId: string;
    subjectId: number;
    sectionId: number;
    facultyId: number;
    roomId: number;
    day: string;
    startTime: string;
    endTime: string;
    /** 'before' = the entry before the edit, 'after' = the entry after the edit */
    phase: 'before' | 'after';
    entryKind?: 'SECTION' | 'COHORT';
    cohortCode?: string | null;
    cohortName?: string | null;
    programType?: string | null;
    programCode?: string | null;
    programName?: string | null;
}
export interface PolicyImpact {
    code: string;
    label: string;
    /** e.g. "Limit: 200 min · Observed: 320 min · Δ +120 min" */
    summary: string;
    severity: 'HARD' | 'SOFT';
}
export interface CommitResult {
    editId: number;
    draft: DraftReport;
    violationDelta: PreviewResult['violationDelta'];
    warnings: Violation[];
    newVersion: number;
}
export interface ManualEditRecord {
    id: number;
    runId: number;
    actorId: number;
    editType: string;
    beforePayload: unknown;
    afterPayload: unknown;
    validationSummary: unknown;
    createdAt: string;
}
export declare function previewManualEdit(runId: number, schoolId: number, schoolYearId: number, proposal: ManualEditProposal): Promise<PreviewResult>;
export declare function commitManualEdit(runId: number, schoolId: number, schoolYearId: number, actorId: number, proposal: ManualEditProposal, expectedVersion: number, allowSoftOverride?: boolean): Promise<CommitResult>;
export declare function revertLastEdit(runId: number, schoolId: number, schoolYearId: number, actorId: number): Promise<CommitResult>;
export declare function listManualEdits(runId: number, schoolId: number, schoolYearId: number): Promise<ManualEditRecord[]>;
export declare function getRunVersion(runId: number, schoolId: number, schoolYearId: number): Promise<number>;
