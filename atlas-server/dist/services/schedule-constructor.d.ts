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
    minMinutesPerWeek: number;
    preferredRoomType: RoomType;
    gradeLevels: number[];
}
export interface FacultyInput {
    id: number;
    maxHoursPerWeek: number;
}
export interface FacultySubjectInput {
    facultyId: number;
    subjectId: number;
    gradeLevels: number[];
}
export interface RoomInput {
    id: number;
    type: RoomType;
    isTeachingSpace: boolean;
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
}
export interface ConstructorInput {
    schoolId: number;
    schoolYearId: number;
    sectionsByGrade: SectionsByGrade[];
    subjects: SubjectInput[];
    faculty: FacultyInput[];
    facultySubjects: FacultySubjectInput[];
    rooms: RoomInput[];
    preferences: FacultyPreferenceInput[];
    policy?: PolicyInput;
}
export interface ConstructorResult {
    entries: ScheduledEntry[];
    assignedCount: number;
    unassignedCount: number;
    classesProcessed: number;
    policyBlockedCount: number;
}
export declare function constructBaseline(input: ConstructorInput): ConstructorResult;
