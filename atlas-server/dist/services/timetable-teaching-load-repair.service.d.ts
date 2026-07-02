import { type ManualEditProposal, type ManualEditBatchPreviewResult } from './manual-edit.service.js';
import { type Violation } from './constraint-validator.js';
import type { DraftReport } from './generation.service.js';
export type EntryTeachingLoadRepairChange = {
    kind?: 'ENTRY';
    entryId: string;
    subjectId: number;
    sectionId: number;
    fromFacultyId: number | null;
    toFacultyId: number;
};
export type UnassignedTeachingLoadRepairChange = {
    kind: 'UNASSIGNED';
    unassignedKey: string;
    subjectId: number;
    sectionId: number;
    session: number;
    entryKind: 'SECTION' | 'COHORT';
    cohortCode?: string | null;
    fromFacultyId: number | null;
    toFacultyId: number;
};
export type TeachingLoadRepairChange = EntryTeachingLoadRepairChange | UnassignedTeachingLoadRepairChange;
export type TeachingLoadRepairRequest = {
    changes: TeachingLoadRepairChange[];
    placementProposal?: ManualEditProposal;
    expectedRunVersion?: number;
    expectedFacultyVersions?: Record<string, number>;
    allowSoftOverride?: boolean;
};
export type TeachingLoadOwnershipDelta = {
    kind: 'ENTRY' | 'UNASSIGNED';
    entryId?: string;
    unassignedKey?: string;
    subjectId: number;
    sectionId: number;
    fromFacultyId: number | null;
    toFacultyId: number;
    currentOwnerId: number | null;
    timetableAction: 'NO_CHANGE' | 'CHANGE_FACULTY';
    ownershipAction: 'NO_CHANGE' | 'TRANSFER';
};
export type TeachingLoadAffectedTeacher = {
    facultyId: number;
    beforeTeachingHours: number;
    afterTeachingHours: number;
    version: number | null;
};
export type TeachingLoadUnassignedReadiness = {
    unassignedKey: string;
    subjectId: number;
    sectionId: number;
    session: number;
    currentOwnerId: number | null;
    proposedOwnerId: number;
    canPlaceNow: boolean;
    placementBlockers: string[];
    topBlockerCopy: string | null;
    suggestedPlacements: ManualEditProposal[];
};
export type TeachingLoadRepairPreviewResult = ManualEditBatchPreviewResult & {
    ownershipDeltas: TeachingLoadOwnershipDelta[];
    affectedTeachers: TeachingLoadAffectedTeacher[];
    unassignedReadiness: TeachingLoadUnassignedReadiness[];
};
export type TeachingLoadRepairApplyResult = {
    editId: number;
    editIds: number[];
    draft: DraftReport;
    violationDelta: ManualEditBatchPreviewResult['violationDelta'];
    warnings: Violation[];
    newVersion: number;
    ownershipDeltas: TeachingLoadOwnershipDelta[];
    affectedTeachers: TeachingLoadAffectedTeacher[];
    unassignedReadiness: TeachingLoadUnassignedReadiness[];
};
export declare function previewTeachingLoadRepair(runId: number, schoolId: number, schoolYearId: number, request: TeachingLoadRepairRequest): Promise<TeachingLoadRepairPreviewResult>;
export declare function applyTeachingLoadRepair(runId: number, schoolId: number, schoolYearId: number, actorId: number, request: TeachingLoadRepairRequest): Promise<TeachingLoadRepairApplyResult>;
