import { type ManualEditBatchPreviewResult } from './manual-edit.service.js';
import { type Violation } from './constraint-validator.js';
import type { DraftReport } from './generation.service.js';
export type TeachingLoadRepairChange = {
    entryId: string;
    subjectId: number;
    sectionId: number;
    fromFacultyId: number | null;
    toFacultyId: number;
};
export type TeachingLoadRepairRequest = {
    changes: TeachingLoadRepairChange[];
    expectedRunVersion?: number;
    expectedFacultyVersions?: Record<string, number>;
    allowSoftOverride?: boolean;
};
export type TeachingLoadOwnershipDelta = {
    entryId: string;
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
export type TeachingLoadRepairPreviewResult = ManualEditBatchPreviewResult & {
    ownershipDeltas: TeachingLoadOwnershipDelta[];
    affectedTeachers: TeachingLoadAffectedTeacher[];
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
};
export declare function previewTeachingLoadRepair(runId: number, schoolId: number, schoolYearId: number, request: TeachingLoadRepairRequest): Promise<TeachingLoadRepairPreviewResult>;
export declare function applyTeachingLoadRepair(runId: number, schoolId: number, schoolYearId: number, actorId: number, request: TeachingLoadRepairRequest): Promise<TeachingLoadRepairApplyResult>;
