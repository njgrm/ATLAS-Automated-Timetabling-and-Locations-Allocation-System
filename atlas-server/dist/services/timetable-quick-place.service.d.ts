import type { Violation } from './constraint-validator.js';
import type { UnassignedItem } from './schedule-constructor.js';
export type PlacedSessionResult = {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    sectionId: number;
    sectionName: string;
    session: number;
    day: string;
    startTime: string;
    endTime: string;
    roomId: number;
    roomName: string;
    facultyId: number;
    facultyName: string;
};
export type UnplacedSessionResult = {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    sectionId: number;
    sectionName: string;
    session: number;
    reason: string;
};
export declare function solveQuickPlace(runId: number, schoolId: number, schoolYearId: number): Promise<{
    placed: PlacedSessionResult[];
    unplaced: UnplacedSessionResult[];
    newEntries: {
        entryId: string;
        facultyId: number | null;
        roomId: number;
        subjectId: number;
        subjectCode?: string | null;
        sectionId: number;
        day: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        termIndex?: 1 | 2 | 3;
        entryKind?: "SECTION" | "COHORT";
        programType?: string | null;
        programCode?: string | null;
        programName?: string | null;
        cohortCode?: string | null;
        cohortName?: string | null;
        specializationCode?: string | null;
        specializationName?: string | null;
        cohortMemberSectionIds?: number[];
        cohortExpectedEnrollment?: number | null;
        adviserId?: number | null;
        adviserName?: string | null;
        metadata?: {
            roomAssignmentReason?: string;
            homeRoomFallbackCause?: "HOME_ROOM_OCCUPIED" | "NO_SAME_ZONE_STANDARD_ROOM" | "CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED" | "ONLY_SPECIALIZED_ROOMS_AVAILABLE" | "FACULTY_DAILY_LIMIT_EXCEEDED" | "FACULTY_CONSECUTIVE_LIMIT_EXCEEDED" | "NO_VALID_PERIOD_IN_POLICY_WINDOW" | "POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE";
            crossBuildingFallbackUsed?: boolean;
            fallbackTier?: "HOME_ROOM" | "SAME_ZONE" | "CROSS_BUILDING" | "GENERAL_POOL";
            fallbackTrace?: string[];
            capacityOverflowBypass?: boolean;
            deferredRoomTypePreference?: boolean;
            deferredPreferredRoomType?: import("@prisma/client").RoomType;
            modularGroupId?: string;
            modularAssignments?: Array<{
                termIndex: 1 | 2 | 3;
                facultyId: number;
                subjectCode: string;
            }>;
        };
    }[];
    newUnassigned: UnassignedItem[];
    violations: Violation[];
}>;
export declare function applyQuickPlace(runId: number, schoolId: number, schoolYearId: number, actorId: number, expectedVersion: number): Promise<{
    success: boolean;
    placedCount: number;
    version: number;
    draft: {
        runId: number;
        status: import("@prisma/client").$Enums.GenerationRunStatus;
        entries: any;
        unassignedItems: any;
        summary: any;
        version: number;
        finishedAt: string | null;
        createdAt: string;
    };
}>;
