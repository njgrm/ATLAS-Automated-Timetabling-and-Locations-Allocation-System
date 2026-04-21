import type { DayOfWeek, RoomPreferenceDecisionStatus, RoomPreferenceStatus } from '@prisma/client';
import * as generationService from './generation.service.js';
import * as manualEditService from './manual-edit.service.js';
type DraftEntry = generationService.DraftReport['entries'][number];
export interface SaveRoomPreferenceDraftInput {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    facultyId: number;
    entryId: string;
    requestedRoomId: number;
    rationale?: string | null;
    expectedRunVersion?: number;
    requestVersion?: number;
}
export interface SubmitRoomPreferenceInput extends SaveRoomPreferenceDraftInput {
    requestVersion?: number;
}
export interface ReviewRoomPreferenceInput {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    requestId: number;
    reviewerId: number;
    decisionStatus: 'APPROVED' | 'REJECTED';
    reviewerNotes?: string | null;
    expectedRunVersion?: number;
    requestVersion?: number;
    allowSoftOverride?: boolean;
}
export interface FacultyRoomPreferenceEntry {
    entryId: string;
    subjectId: number;
    sectionId: number;
    facultyId: number;
    currentRoomId: number;
    currentRoomName: string;
    requestedRoomId: number | null;
    requestedRoomName: string | null;
    day: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    status: RoomPreferenceStatus | null;
    decisionStatus: RoomPreferenceDecisionStatus | null;
    rationale: string | null;
    submittedAt: string | null;
    version: number | null;
    subjectCode: string;
    subjectName: string;
    sectionName: string;
    requestId: number | null;
    reviewerNotes: string | null;
    reviewedAt: string | null;
    entryKind?: DraftEntry['entryKind'];
    cohortCode?: string | null;
    cohortName?: string | null;
    programCode?: string | null;
    programName?: string | null;
}
export interface FacultyRoomPreferenceState {
    runId: number;
    runVersion: number;
    entries: FacultyRoomPreferenceEntry[];
}
export interface RoomPreferenceSummaryItem {
    id: number;
    runId: number;
    entryId: string;
    facultyId: number;
    facultyName: string;
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    sectionId: number;
    sectionName: string;
    currentRoomId: number;
    currentRoomName: string;
    requestedRoomId: number;
    requestedRoomName: string;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    status: RoomPreferenceStatus;
    decisionStatus: RoomPreferenceDecisionStatus;
    rationale: string | null;
    submittedAt: string | null;
    version: number;
    reviewerId: number | null;
    reviewerNotes: string | null;
    reviewedAt: string | null;
    entryKind?: DraftEntry['entryKind'];
    cohortCode?: string | null;
    cohortName?: string | null;
    programCode?: string | null;
    programName?: string | null;
}
export interface RoomPreferenceSummaryResponse {
    runId: number;
    counts: {
        total: number;
        draft: number;
        submitted: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    requests: RoomPreferenceSummaryItem[];
    runVersion: number;
}
export declare function getFacultyRoomPreferenceState(schoolId: number, schoolYearId: number, runId: number, facultyId: number): Promise<FacultyRoomPreferenceState>;
export declare function getLatestFacultyRoomPreferenceState(schoolId: number, schoolYearId: number, facultyId: number): Promise<FacultyRoomPreferenceState>;
export declare function saveRoomPreferenceDraft(input: SaveRoomPreferenceDraftInput): Promise<FacultyRoomPreferenceState>;
export declare function submitRoomPreference(input: SubmitRoomPreferenceInput): Promise<FacultyRoomPreferenceState>;
export declare function deleteRoomPreferenceDraft(schoolId: number, schoolYearId: number, runId: number, facultyId: number, entryId: string, requestVersion?: number): Promise<FacultyRoomPreferenceState>;
export declare function getRoomPreferenceSummary(schoolId: number, schoolYearId: number, runId: number, filters?: {
    status?: RoomPreferenceStatus;
    decisionStatus?: RoomPreferenceDecisionStatus;
    facultyId?: number;
    requestedRoomId?: number;
}): Promise<RoomPreferenceSummaryResponse>;
export declare function getLatestRoomPreferenceSummary(schoolId: number, schoolYearId: number, filters?: {
    status?: RoomPreferenceStatus;
    decisionStatus?: RoomPreferenceDecisionStatus;
    facultyId?: number;
    requestedRoomId?: number;
}): Promise<RoomPreferenceSummaryResponse>;
export declare function getRoomPreferenceDetail(schoolId: number, schoolYearId: number, runId: number, requestId: number): Promise<{
    request: RoomPreferenceSummaryItem;
    runVersion: number;
}>;
export declare function previewRoomPreferenceDecision(schoolId: number, schoolYearId: number, runId: number, requestId: number): Promise<{
    request: RoomPreferenceSummaryItem;
    runVersion: number;
    preview: manualEditService.PreviewResult;
}>;
export declare function reviewRoomPreference(input: ReviewRoomPreferenceInput): Promise<{
    request: {
        id: number;
        schoolId: number;
        createdAt: Date;
        updatedAt: Date;
        facultyId: number;
        subjectId: number;
        version: number;
        schoolYearId: number;
        status: import("@prisma/client").$Enums.RoomPreferenceStatus;
        submittedAt: Date | null;
        startTime: string;
        day: import("@prisma/client").$Enums.DayOfWeek;
        endTime: string;
        reviewerId: number | null;
        reviewerNotes: string | null;
        reviewedAt: Date | null;
        sectionId: number;
        runId: number;
        entryId: string;
        currentRoomId: number;
        requestedRoomId: number;
        rationale: string | null;
        decisionStatus: import("@prisma/client").$Enums.RoomPreferenceDecisionStatus;
    };
    commitResult: manualEditService.CommitResult | null;
}>;
export {};
