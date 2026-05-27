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
    name?: string;
    minMinutesPerWeek: number;
    preferredRoomType: RoomType;
    gradeLevels: number[];
    interSectionEnabled?: boolean;
    interSectionGradeLevels?: number[];
    /** Stored program scopes from DB — used for data-driven filtering */
    programScopes?: string[];
    allowedSpecializations?: string[];
    modularGroupId?: string | null;
    modularOrder?: number | null;
    requiredFeatures?: string[];
    ownerDepartment?: string | null;
    qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
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
    department?: string | null;
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
    isSharedFacility?: boolean;
    capacity: number | null;
    buildingId?: number | null;
    buildingZoneId?: string | null;
    features?: string[];
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
    periodLengthMinutes?: number;
    periodsPerDay?: number;
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
export interface TimetableShapeContract {
    gradeLevel: number;
    programType: string;
    startTime: string;
    endTime: string;
    periodLengthMinutes: number;
    periodsPerDay: number;
    periodSlots: PeriodSlot[];
    displaySlots: PeriodSlot[];
}
export declare function buildTimetableShapeContract(input: {
    gradeLevel: number;
    programType?: string | null;
    startTime: string;
    endTime: string;
    periodLengthMinutes: number;
    periodsPerDay: number;
    basePolicy?: PolicyInput;
}): TimetableShapeContract;
export declare function resolveTimetableShapeContract(contracts: TimetableShapeContract[] | undefined, gradeLevel: number, programType?: string | null): TimetableShapeContract | undefined;
export declare function buildUnionClassPeriodSlots(contracts: TimetableShapeContract[] | undefined): PeriodSlot[];
export declare function buildUnionDisplaySlots(contracts: TimetableShapeContract[] | undefined): PeriodSlot[];
export interface ConstructorInput {
    schoolId: number;
    schoolYearId: number;
    roomingStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
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
     * Per-program period length overrides from class templates.
     * Key: program type (e.g. 'STE', 'SPA'). Value: period length in minutes.
     * When provided, the constructor uses this length instead of STANDARD_PERIOD_MINUTES
     * for sections of the matching program type.
     */
    classTemplatePeriods?: Record<string, number>;
    timetableShapes?: TimetableShapeContract[];
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
    programType?: string | null;
    startTime: string;
    endTime: string;
}
export type RoomAssignmentReason = 'LOCKED_ENTRY' | 'HOME_ROOM_ASSIGNED' | 'HOME_ROOM_UNAVAILABLE' | 'CROSS_BUILDING_FALLBACK_ASSIGNED' | 'SPECIALIZED_ROOM' | 'SPECIALIZED_ROOM_UNAVAILABLE' | 'GENERAL_POOL_ASSIGNED' | 'MODULAR_POOL_ASSIGNED' | 'ROOM_PATH_EXHAUSTED' | 'NO_QUALIFIED_FACULTY' | 'FACULTY_SLOT_UNAVAILABLE' | 'POLICY_SLOT_BLOCKED' | 'FALLBACK_UNRESOLVED';
export type HomeRoomFallbackCause = 'HOME_ROOM_OCCUPIED' | 'NO_SAME_ZONE_STANDARD_ROOM' | 'CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED' | 'ONLY_SPECIALIZED_ROOMS_AVAILABLE' | 'POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE';
export interface UnassignedItem {
    sectionId: number;
    subjectId: number;
    gradeLevel: number;
    session: number;
    reason: 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM' | 'ROOM_CAPACITY_EXCEEDED';
    roomAssignmentReason?: RoomAssignmentReason;
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
    homeRoomId?: number | null;
    homeRoomFallbackCause?: HomeRoomFallbackCause;
}
export interface ConstructorResult {
    entries: ScheduledEntry[];
    unassignedItems: UnassignedItem[];
    lockWarnings: string[];
    modularWarnings?: ModularWarning[];
    assignedCount: number;
    unassignedCount: number;
    classesProcessed: number;
    policyBlockedCount: number;
}
export interface ModularAssignment {
    termIndex: 1 | 2 | 3;
    facultyId: number;
    subjectCode: string;
}
export interface ModularWarning {
    code: 'LACKING_FACULTY' | 'INCOMPLETE_MODULAR_GROUP';
    sectionId: number;
    subjectId: number;
    message: string;
    meta?: Record<string, unknown>;
}
export interface DemandItem {
    sectionId: number;
    subjectId: number;
    subjectCode: string;
    gradeLevel: number;
    sourceMinutesPerWeek?: number;
    sessionsPerWeek: number;
    durationPerSession: number;
    enrolledCount: number;
    entryKind: 'SECTION' | 'COHORT';
    homeRoomId?: number | null;
    buildingZoneId?: string | null;
    programType?: string | null;
    programCode?: string | null;
    programName?: string | null;
    cohortCode?: string | null;
    cohortName?: string | null;
    cohortMemberSectionIds?: number[];
    roomTypePreference?: RoomType;
    adviserId?: number | null;
    adviserName?: string | null;
    modularGroupId?: string | null;
    modularSubjects?: Array<{
        subjectId: number;
        subjectCode: string;
        modularOrder: number;
        minMinutesPerWeek: number;
    }>;
    modularExpectedCount?: number;
}
export declare function computeDemand(sectionsByGrade: SectionsByGrade[], subjects: SubjectInput[], cohorts?: InstructionalCohortInput[], classTemplatePeriods?: Record<string, number>, policyPeriodLengthMinutes?: number): DemandItem[];
export declare function getDemandSectionIds(item: DemandItem): number[];
export declare function getDemandAssignmentKey(item: DemandItem): string;
export declare function constructBaseline(input: ConstructorInput): ConstructorResult;
