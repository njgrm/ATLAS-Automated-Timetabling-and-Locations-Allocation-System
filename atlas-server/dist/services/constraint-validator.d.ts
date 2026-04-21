/**
 * Hard-constraint validator for timetable generation runs.
 * Deterministic, unit-testable. No transport or persistence concerns.
 *
 * Consumes a DraftSchedule (array of scheduled class entries) plus
 * reference data (faculty loads, faculty-subject qualifications, room types,
 * subject preferred room types) and emits a typed violation array.
 */
import type { RoomType } from '@prisma/client';
export declare const VIOLATION_CODES: readonly ["FACULTY_TIME_CONFLICT", "ROOM_TIME_CONFLICT", "FACULTY_OVERLOAD", "ROOM_TYPE_MISMATCH", "ROOM_CAPACITY_EXCEEDED", "FACULTY_SUBJECT_NOT_QUALIFIED", "FACULTY_CONSECUTIVE_LIMIT_EXCEEDED", "FACULTY_BREAK_REQUIREMENT_VIOLATED", "FACULTY_DAILY_MAX_EXCEEDED", "FACULTY_EXCESSIVE_TRAVEL_DISTANCE", "FACULTY_EXCESSIVE_BUILDING_TRANSITIONS", "FACULTY_INSUFFICIENT_TRANSITION_BUFFER", "FACULTY_EXCESSIVE_IDLE_GAP", "FACULTY_EARLY_START_PREFERENCE", "FACULTY_LATE_END_PREFERENCE", "FACULTY_INSUFFICIENT_DAILY_VACANT", "SECTION_OVERCOMPRESSED", "SESSION_PATTERN_VIOLATED"];
export type ViolationCode = (typeof VIOLATION_CODES)[number];
export interface ScheduledEntry {
    /** Unique id of this class assignment within the draft */
    entryId: string;
    facultyId: number;
    roomId: number;
    subjectId: number;
    sectionId: number;
    day: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
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
export interface FacultyRef {
    id: number;
    maxHoursPerWeek: number;
}
export interface FacultySubjectRef {
    facultyId: number;
    subjectId: number;
    sectionIds: number[];
}
export interface RoomRef {
    id: number;
    type: RoomType;
    capacity: number | null;
}
export interface SubjectRef {
    id: number;
    preferredRoomType: RoomType;
    sessionPattern?: 'MWF' | 'TTH' | 'ANY';
}
export interface PolicyRef {
    maxConsecutiveTeachingMinutesBeforeBreak: number;
    minBreakMinutesAfterConsecutiveBlock: number;
    maxTeachingMinutesPerDay: number;
    earliestStartTime: string;
    latestEndTime: string;
    enforceConsecutiveBreakAsHard: boolean;
}
export interface TravelPolicyRef {
    enableTravelWellbeingChecks: boolean;
    maxWalkingDistanceMetersPerTransition: number;
    maxBuildingTransitionsPerDay: number;
    maxBackToBackTransitionsWithoutBuffer: number;
    maxIdleGapMinutesPerDay: number;
    avoidEarlyFirstPeriod: boolean;
    avoidLateLastPeriod: boolean;
}
export interface BuildingRef {
    id: number;
    x: number;
    y: number;
}
export interface RoomBuildingRef {
    roomId: number;
    buildingId: number;
}
export interface VacantPolicyRef {
    enableVacantAwareConstraints: boolean;
    targetFacultyDailyVacantMinutes: number;
    targetSectionDailyVacantPeriods: number;
    maxCompressedTeachingMinutesPerDay: number;
}
export interface ConstraintOverrideRef {
    enabled: boolean;
    weight: number;
    treatAsHard: boolean;
}
export interface ValidatorContext {
    schoolId: number;
    schoolYearId: number;
    runId: number;
    entries: ScheduledEntry[];
    faculty: FacultyRef[];
    facultySubjects: FacultySubjectRef[];
    rooms: RoomRef[];
    subjects: SubjectRef[];
    /** Map of sectionId → enrolledCount for capacity checks */
    sectionEnrollment?: Map<number, number>;
    policy?: PolicyRef;
    travelPolicy?: TravelPolicyRef;
    vacantPolicy?: VacantPolicyRef;
    buildings?: BuildingRef[];
    roomBuildings?: RoomBuildingRef[];
    constraintConfig?: Record<string, ConstraintOverrideRef>;
}
export interface Violation {
    code: ViolationCode;
    severity: 'HARD' | 'SOFT';
    message: string;
    schoolId: number;
    schoolYearId: number;
    runId: number;
    entities: {
        facultyId?: number;
        roomId?: number;
        subjectId?: number;
        sectionId?: number;
        day?: string;
        startTime?: string;
        endTime?: string;
        entryIds?: string[];
    };
    meta?: Record<string, unknown>;
}
export interface ValidationResult {
    violations: Violation[];
    counts: {
        total: number;
        byCode: Record<ViolationCode, number>;
    };
}
export declare function validateHardConstraints(ctx: ValidatorContext): ValidationResult;
