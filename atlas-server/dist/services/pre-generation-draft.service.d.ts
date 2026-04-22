import { type PreGenerationDraftStatus, type RoomType } from '@prisma/client';
import { type Violation } from './constraint-validator.js';
import { type ConstructorInput, type PeriodSlot } from './schedule-constructor.js';
export interface DraftPlacementInput {
    placementId?: number;
    entryKind?: 'SECTION' | 'COHORT';
    sectionId: number;
    subjectId: number;
    facultyId: number;
    roomId: number;
    day: string;
    startTime: string;
    endTime: string;
    cohortCode?: string | null;
    notes?: string | null;
    expectedVersion?: number;
}
export interface DraftPlacementRow {
    id: number;
    schoolId: number;
    schoolYearId: number;
    entryKind: 'SECTION' | 'COHORT';
    sectionId: number;
    subjectId: number;
    facultyId: number | null;
    roomId: number | null;
    day: string;
    startTime: string;
    endTime: string;
    cohortCode: string | null;
    status: PreGenerationDraftStatus;
    lockedRunId: number | null;
    notes: string | null;
    version: number;
    createdBy: number;
    createdAt: string;
    updatedAt: string;
}
export interface DraftQueueItem {
    assignmentKey: string;
    entryKind: 'SECTION' | 'COHORT';
    sectionId: number;
    sectionName: string;
    gradeLevel: number;
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    sessionNumber: number;
    sessionsPerWeek: number;
    preferredRoomType: RoomType;
    cohortCode: string | null;
    cohortName: string | null;
    programCode: string | null;
    programName: string | null;
    expectedEnrollment: number | null;
    facultyOptions: number[];
}
export interface DraftBoardState {
    placements: DraftPlacementRow[];
    queue: DraftQueueItem[];
    periodSlots: PeriodSlot[];
    counts: {
        draft: number;
        lockedForRun: number;
        archived: number;
        unscheduled: number;
    };
    filters: {
        grades: number[];
        departments: string[];
        buildings: Array<{
            id: number;
            name: string;
            shortCode: string | null;
        }>;
    };
}
export interface DraftPlacementPreview {
    allowed: boolean;
    hardViolations: Violation[];
    softViolations: Violation[];
    violationDelta: {
        hardBefore: number;
        hardAfter: number;
        softBefore: number;
        softAfter: number;
    };
    humanConflicts: Array<{
        code: string;
        severity: 'HARD' | 'SOFT';
        humanTitle: string;
        humanDetail: string;
    }>;
    affectedEntries: Array<{
        entryId: string;
        subjectId: number;
        sectionId: number;
        facultyId: number;
        roomId: number;
        day: string;
        startTime: string;
        endTime: string;
        phase: 'before' | 'after';
        entryKind?: 'SECTION' | 'COHORT';
        cohortCode?: string | null;
    }>;
    policyImpactSummary: Array<{
        code: string;
        label: string;
        summary: string;
        severity: 'HARD' | 'SOFT';
    }>;
}
export interface DraftPlacementCommitResult {
    placement: DraftPlacementRow;
    preview: DraftPlacementPreview;
    board: DraftBoardState;
}
export interface DraftConsumeResult {
    lockedEntries: ConstructorInput['lockedEntries'];
    prePlacedCount: number;
    invalidPrePlacedCount: number;
    skippedPrePlacedReasons: string[];
    acceptedPlacementIds: number[];
}
export declare function previewPlacement(schoolId: number, schoolYearId: number, input: DraftPlacementInput): Promise<DraftPlacementPreview>;
export declare function listDraftBoardState(schoolId: number, schoolYearId: number): Promise<DraftBoardState>;
export declare function getDraftPlacement(schoolId: number, schoolYearId: number, placementId: number): Promise<DraftPlacementRow>;
export declare function commitPlacement(schoolId: number, schoolYearId: number, actorId: number, input: DraftPlacementInput, allowSoftOverride?: boolean): Promise<DraftPlacementCommitResult>;
export declare function clearDraft(schoolId: number, schoolYearId: number, actorId: number): Promise<DraftBoardState>;
export declare function undoLastPlacement(schoolId: number, schoolYearId: number, actorId: number): Promise<DraftBoardState>;
export declare function consumeDraftPlacementsForRun(runId: number, schoolId: number, schoolYearId: number): Promise<DraftConsumeResult>;
export declare function markPlacementsLockedForRun(schoolId: number, schoolYearId: number, runId: number, placementIds: number[]): Promise<void>;
export declare function archivePlacementsForRun(runId: number, schoolId: number, schoolYearId: number): Promise<void>;
