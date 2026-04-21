/**
 * Locked-session service — CRUD for pre-generation pinned schedule entries.
 * Business logic only; no transport concerns.
 */
import { type PeriodSlot } from './schedule-constructor.js';
export interface LockedSessionInput {
    sectionId: number;
    subjectId: number;
    facultyId: number;
    roomId: number;
    day: string;
    startTime: string;
    endTime: string;
}
export interface LockedSessionRow {
    id: number;
    schoolId: number;
    schoolYearId: number;
    sectionId: number;
    subjectId: number;
    facultyId: number | null;
    roomId: number | null;
    day: string;
    startTime: string;
    endTime: string;
    createdBy: number;
    createdAt: Date;
}
export declare function listLocks(schoolId: number, schoolYearId: number): Promise<LockedSessionRow[]>;
export declare function createLock(schoolId: number, schoolYearId: number, actorId: number, input: LockedSessionInput): Promise<LockedSessionRow>;
export declare function getEffectivePeriodSlots(schoolId: number, schoolYearId: number): Promise<PeriodSlot[]>;
export declare function deleteLock(lockId: number, schoolId: number, schoolYearId: number): Promise<void>;
