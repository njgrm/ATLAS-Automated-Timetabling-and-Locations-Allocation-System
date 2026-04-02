/**
 * Hard-constraint validator for timetable generation runs.
 * Deterministic, unit-testable. No transport or persistence concerns.
 *
 * Consumes a DraftSchedule (array of scheduled class entries) plus
 * reference data (faculty loads, faculty-subject qualifications, room types,
 * subject preferred room types) and emits a typed violation array.
 */
import type { RoomType } from '@prisma/client';
export declare const VIOLATION_CODES: readonly ["FACULTY_TIME_CONFLICT", "ROOM_TIME_CONFLICT", "FACULTY_OVERLOAD", "ROOM_TYPE_MISMATCH", "FACULTY_SUBJECT_NOT_QUALIFIED", "FACULTY_CONSECUTIVE_LIMIT_EXCEEDED", "FACULTY_BREAK_REQUIREMENT_VIOLATED", "FACULTY_DAILY_MAX_EXCEEDED"];
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
}
export interface FacultyRef {
    id: number;
    maxHoursPerWeek: number;
}
export interface FacultySubjectRef {
    facultyId: number;
    subjectId: number;
}
export interface RoomRef {
    id: number;
    type: RoomType;
}
export interface SubjectRef {
    id: number;
    preferredRoomType: RoomType;
}
export interface PolicyRef {
    maxConsecutiveTeachingMinutesBeforeBreak: number;
    minBreakMinutesAfterConsecutiveBlock: number;
    maxTeachingMinutesPerDay: number;
    earliestStartTime: string;
    latestEndTime: string;
    enforceConsecutiveBreakAsHard: boolean;
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
    policy?: PolicyRef;
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
