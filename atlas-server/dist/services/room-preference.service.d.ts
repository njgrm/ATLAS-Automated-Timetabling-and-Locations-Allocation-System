import type { DayOfWeek, RoomRequestAppealHistoryAction, RoomRequestAppealStatus, RoomPreferenceDecisionStatus, RoomPreferenceStatus } from '@prisma/client';
import * as generationService from './generation.service.js';
import * as manualEditService from './manual-edit.service.js';
type DraftEntry = generationService.DraftReport['entries'][number];
export interface SaveRoomPreferenceDraftInput {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    facultyId: number;
    entryId: string;
    requestedRoomId?: number;
    actionType?: RoomPreferenceActionType;
    targetDay?: string;
    targetStartTime?: string;
    targetEndTime?: string;
    targetEntryId?: string;
    rationale?: string | null;
    expectedRunVersion?: number;
    requestVersion?: number;
}
export interface SubmitRoomPreferenceInput extends SaveRoomPreferenceDraftInput {
    requestVersion?: number;
}
export type RoomPreferenceSyncActionType = 'SAVE_DRAFT' | 'SUBMIT' | 'DELETE';
export type RoomPreferenceActionType = 'ROOM_CHANGE' | 'MOVE_TO_EMPTY_SLOT' | 'SWAP_WITH_OCCUPIED' | 'TIME_AND_ROOM_CHANGE';
export interface RoomPreferenceRequestMeta {
    actionType: RoomPreferenceActionType;
    targetDay?: string;
    targetStartTime?: string;
    targetEndTime?: string;
    targetEntryId?: string;
}
export interface RoomPreferenceSyncAction {
    actionId: string;
    type: RoomPreferenceSyncActionType;
    entryId: string;
    requestedRoomId?: number;
    actionType?: RoomPreferenceActionType;
    targetDay?: string;
    targetStartTime?: string;
    targetEndTime?: string;
    targetEntryId?: string;
    rationale?: string | null;
    expectedRunVersion?: number;
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
    subjectDisplayLabel: string;
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
    actionType?: RoomPreferenceActionType | null;
    targetDay?: string | null;
    targetStartTime?: string | null;
    targetEndTime?: string | null;
    targetEntryId?: string | null;
    /** True when the requested room type differs from the subject's preferred room type. Warning-only. */
    roomTypeOverride?: boolean;
}
export interface FacultyGlobalDraftEntry {
    entryId: string;
    facultyId: number | null;
    facultyName: string;
    sectionId: number;
    sectionName: string;
    subjectId: number;
    subjectCode: string;
    subjectDisplayLabel: string;
    subjectName: string;
    roomId: number;
    roomName: string;
    day: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    owned: boolean;
    entryKind?: DraftEntry['entryKind'];
    cohortCode?: string | null;
    cohortName?: string | null;
    programCode?: string | null;
    programName?: string | null;
}
export interface FacultyRoomPreferenceState {
    runId: number;
    runVersion: number;
    runGeneratedAt: string | null;
    entries: FacultyRoomPreferenceEntry[];
    globalEntries: FacultyGlobalDraftEntry[];
}
export interface RoomPreferenceSummaryItem {
    id: number;
    runId: number;
    entryId: string;
    facultyId: number;
    facultyName: string;
    subjectId: number;
    subjectCode: string;
    subjectDisplayLabel: string;
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
    appealCount: number;
    openAppealCount: number;
    latestAppealStatus: RoomRequestAppealStatus | null;
    latestAppealUpdatedAt: string | null;
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
export interface RoomRequestAppealHistoryItem {
    id: number;
    actorId: number;
    actorName: string;
    action: RoomRequestAppealHistoryAction;
    fromStatus: RoomRequestAppealStatus | null;
    toStatus: RoomRequestAppealStatus | null;
    note: string | null;
    createdAt: string;
}
export interface RoomRequestAppealItem {
    id: number;
    requestId: number;
    requesterId: number;
    requesterName: string;
    reason: string;
    status: RoomRequestAppealStatus;
    createdAt: string;
    updatedAt: string;
    history: RoomRequestAppealHistoryItem[];
}
export interface RoomPreferenceDetailResponse {
    request: RoomPreferenceSummaryItem;
    runVersion: number;
    appeals: RoomRequestAppealItem[];
}
export declare function getFacultyRoomPreferenceState(schoolId: number, schoolYearId: number, runId: number, facultyId: number): Promise<FacultyRoomPreferenceState>;
export declare function getLatestFacultyRoomPreferenceState(schoolId: number, schoolYearId: number, facultyId: number): Promise<FacultyRoomPreferenceState>;
export declare function previewFacultyRoomPreferenceAction(input: SaveRoomPreferenceDraftInput): Promise<{
    actionType: "SWAP_WITH_OCCUPIED";
    target: {
        actionType: RoomPreferenceActionType;
        targetDay: string;
        targetStartTime: string;
        targetEndTime: string;
        targetEntryId: string | null;
        requestedRoomId: number;
    };
    preview: manualEditService.PreviewResult;
    swap: manualEditService.SwapPreviewResult;
} | {
    actionType: "ROOM_CHANGE" | "MOVE_TO_EMPTY_SLOT" | "TIME_AND_ROOM_CHANGE";
    target: {
        actionType: RoomPreferenceActionType;
        targetDay: string;
        targetStartTime: string;
        targetEndTime: string;
        targetEntryId: string | null;
        requestedRoomId: number;
    };
    preview: manualEditService.PreviewResult;
    swap?: undefined;
}>;
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
    appeals: RoomRequestAppealItem[];
}>;
export declare function previewRoomPreferenceDecision(schoolId: number, schoolYearId: number, runId: number, requestId: number): Promise<{
    request: RoomPreferenceSummaryItem;
    runVersion: number;
    appeals: RoomRequestAppealItem[];
    preview: manualEditService.PreviewResult;
}>;
export declare function listRoomRequestAppeals(schoolId: number, schoolYearId: number, runId: number, requestId: number): Promise<RoomRequestAppealItem[]>;
export declare function createRoomRequestAppeal(input: {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    requestId: number;
    requesterId: number;
    reason: string;
}): Promise<{
    appealId: number;
    status: import("@prisma/client").$Enums.RoomRequestAppealStatus;
}>;
export declare function updateRoomRequestAppealStatus(input: {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    requestId: number;
    appealId: number;
    actorId: number;
    status: RoomRequestAppealStatus;
    note?: string | null;
}): Promise<{
    appealId: number;
    status: import("@prisma/client").$Enums.RoomRequestAppealStatus;
}>;
export declare function reviewRoomPreference(input: ReviewRoomPreferenceInput): Promise<{
    request: {
        id: number;
        schoolId: number;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        schoolYearId: number;
        sectionId: number;
        facultyId: number;
        subjectId: number;
        day: import("@prisma/client").$Enums.DayOfWeek;
        status: import("@prisma/client").$Enums.RoomPreferenceStatus;
        startTime: string;
        endTime: string;
        termIndex: number;
        runId: number;
        decisionStatus: import("@prisma/client").$Enums.RoomPreferenceDecisionStatus;
        submittedAt: Date | null;
        reviewerId: number | null;
        reviewerNotes: string | null;
        reviewedAt: Date | null;
        entryId: string;
        currentRoomId: number;
        requestedRoomId: number;
        rationale: string | null;
    };
    commitResult: manualEditService.CommitResult | null;
}>;
export declare function processQueuedRoomPreferenceActions(input: {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    facultyId: number;
    actions: RoomPreferenceSyncAction[];
}): Promise<{
    runId: number;
    runVersion: number;
    results: {
        actionId: string;
        ok: boolean;
        state?: FacultyRoomPreferenceState;
        error?: {
            code: string;
            message: string;
            statusCode: number;
        };
    }[];
    state: FacultyRoomPreferenceState;
}>;
export {};
