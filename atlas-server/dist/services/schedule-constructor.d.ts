/**
 * Deterministic baseline schedule constructor.
 * Produces ScheduledEntry[] from setup data using a greedy single-pass algorithm.
 *
 * Determinism rules:
 *  - Grades sorted by ascending displayOrder (7, 8, 9, 10)
 *  - Sections sorted by ascending id within each grade
 *  - Subjects sorted by ascending id within each section
 *  - Faculty candidates sorted by ascending facultyId
 *  - Slot candidates sorted by preference score → day index → period index
 *  - Room candidates sorted by ascending room id
 *  - No randomness; identical inputs → identical output
 *
 * Assignment policy (baseline):
 *  - For each section-subject pair, compute sessions per week
 *  - Pick first qualified faculty with available load
 *  - Pick best available timeslot (prefer faculty PREFERRED slots, spread across days)
 *  - Pick first compatible room available at that slot
 *  - If no valid candidate exists, count as unassigned (never fabricate invalid data)
 */
import type { ScheduledEntry } from './constraint-validator.js';
import type { SectionsByGrade } from './section-adapter.js';
import type { RoomType } from '@prisma/client';
export interface SubjectInput {
    id: number;
    code: string;
    minMinutesPerWeek: number;
    preferredRoomType: RoomType;
    sessionPattern: 'MWF' | 'TTH' | 'ANY';
    gradeLevels: number[];
    interSectionEnabled?: boolean;
    interSectionGradeLevels?: number[];
}
export interface InstructionalCohortInput {
    cohortCode: string;
    specializationCode: string;
    specializationName: string;
    gradeLevel: number;
    memberSectionIds: number[];
    expectedEnrollment: number;
    preferredRoomType?: RoomType | null;
}
export interface FacultyInput {
    id: number;
    maxHoursPerWeek: number;
}
export interface FacultySubjectInput {
    facultyId: number;
    subjectId: number;
    gradeLevels: number[];
    sectionIds: number[];
}
export interface RoomInput {
    id: number;
    type: RoomType;
    isTeachingSpace: boolean;
    capacity: number | null;
    buildingId?: number | null;
}
export interface PreferenceSlotInput {
    day: string;
    startTime: string;
    endTime: string;
    preference: string;
}
export interface FacultyPreferenceInput {
    facultyId: number;
    status: string;
    timeSlots: PreferenceSlotInput[];
}
export interface PolicyInput {
    maxConsecutiveTeachingMinutesBeforeBreak: number;
    minBreakMinutesAfterConsecutiveBlock: number;
    maxTeachingMinutesPerDay: number;
    earliestStartTime: string;
    latestEndTime: string;
    lunchStartTime?: string;
    lunchEndTime?: string;
    enforceLunchWindow?: boolean;
    enableLunchWindow?: boolean;
    showSpecialEventsInGrid?: boolean;
    enableFlagCeremony?: boolean;
    flagCeremonyStartTime?: string;
    flagCeremonyEndTime?: string;
    enableRecess?: boolean;
    recessStartTime?: string;
    recessEndTime?: string;
    enableTleTwoPassPriority?: boolean;
    allowFlexibleSubjectAssignment?: boolean;
    allowConsecutiveLabSessions?: boolean;
}
type PeriodSlot = {
    startTime: string;
    endTime: string;
    isSpecialEvent?: boolean;
    eventName?: string;
};
/**
 * Build schedulable class period slots from policy bounds and lunch window.
 * Special event rows are built separately via buildSpecialEventSlots().
 */
declare function buildPeriodSlots(policy?: PolicyInput): PeriodSlot[];
declare function buildSpecialEventSlots(policy?: PolicyInput): PeriodSlot[];
declare function mergeDisplaySlots(periodSlots: PeriodSlot[], specialEventSlots: PeriodSlot[]): PeriodSlot[];
/** Exported for use by room-schedule service and other consumers. */
export { buildPeriodSlots, buildSpecialEventSlots, mergeDisplaySlots, type PeriodSlot };
export interface ConstructorInput {
    schoolId: number;
    schoolYearId: number;
    sectionsByGrade: SectionsByGrade[];
    subjects: SubjectInput[];
    cohorts?: InstructionalCohortInput[];
    faculty: FacultyInput[];
    facultySubjects: FacultySubjectInput[];
    rooms: RoomInput[];
    preferences: FacultyPreferenceInput[];
    policy?: PolicyInput;
    lockedEntries?: LockedEntryInput[];
    gradeWindows?: GradeWindowInput[];
    buildings?: Array<{
        id: number;
        name: string;
    }>;
    /**
     * Optional demand override — bypasses computeDemand() to allow seed profile
     * reordering in the hybrid multi-seed constructor (H-ALG-1).
     * When provided, this array is used directly instead of calling computeDemand().
     */
    demandOverride?: DemandItem[];
}
export interface LockedEntryInput {
    sectionId: number;
    subjectId: number;
    facultyId?: number | null;
    roomId?: number | null;
    entryKind?: 'SECTION' | 'COHORT';
    cohortCode?: string | null;
    day: string;
    startTime: string;
    endTime: string;
}
export interface GradeWindowInput {
    gradeLevel: number;
    startTime: string;
    endTime: string;
}
export interface UnassignedItem {
    sectionId: number;
    subjectId: number;
    gradeLevel: number;
    session: number;
    reason: 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM';
    entryKind?: 'SECTION' | 'COHORT';
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
export interface ConstructorResult {
    entries: ScheduledEntry[];
    unassignedItems: UnassignedItem[];
    lockWarnings: string[];
    assignedCount: number;
    unassignedCount: number;
    classesProcessed: number;
    policyBlockedCount: number;
}
export interface DemandItem {
    sectionId: number;
    subjectId: number;
    subjectCode: string;
    gradeLevel: number;
    sessionsPerWeek: number;
    durationPerSession: number;
    enrolledCount: number;
    sessionPattern: 'MWF' | 'TTH' | 'ANY';
    entryKind: 'SECTION' | 'COHORT';
    programType?: string | null;
    programCode?: string | null;
    programName?: string | null;
    cohortCode?: string | null;
    cohortName?: string | null;
    cohortMemberSectionIds?: number[];
    roomTypePreference?: RoomType;
    adviserId?: number | null;
    adviserName?: string | null;
}
export declare function computeDemand(sectionsByGrade: SectionsByGrade[], subjects: SubjectInput[], cohorts?: InstructionalCohortInput[]): DemandItem[];
export declare function getDemandSectionIds(item: DemandItem): number[];
export declare function getDemandAssignmentKey(item: DemandItem): string;
export declare function constructBaseline(input: ConstructorInput): ConstructorResult;
