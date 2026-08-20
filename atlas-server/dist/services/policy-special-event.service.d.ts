/**
 * Policy special-event service — shift-specific break/event CRUD and effective-event resolution.
 * Business logic only; no transport concerns.
 */
import { VALID_EVENT_TYPES, VALID_GRADE_GROUPS, getEffectiveEvents, type GradeGroup, type SpecialEventType, type EffectiveSpecialEvent } from '../lib/policy-special-events.js';
export { VALID_EVENT_TYPES, VALID_GRADE_GROUPS, getEffectiveEvents };
export type { GradeGroup, SpecialEventType, EffectiveSpecialEvent };
export interface SpecialEventInput {
    eventType: SpecialEventType;
    label: string;
    gradeGroup?: GradeGroup | null;
    programType?: string | null;
    startTime: string;
    endTime: string;
    enabled?: boolean;
    sortOrder?: number;
}
export interface SpecialEventRow {
    id: number;
    schoolId: number;
    schoolYearId: number;
    eventType: string;
    label: string;
    gradeGroup: string | null;
    programType: string | null;
    startTime: string;
    endTime: string;
    enabled: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Canonicalize programType: trim whitespace, uppercase, map default/empty to null.
 * This prevents duplicate effective scopes caused by casing or whitespace differences.
 */
export declare function normalizeProgramType(raw: string | null | undefined): string | null;
export declare function listSpecialEvents(schoolId: number, schoolYearId: number): Promise<SpecialEventRow[]>;
export declare function upsertSpecialEvent(schoolId: number, schoolYearId: number, input: SpecialEventInput): Promise<SpecialEventRow>;
export declare function upsertSpecialEvents(schoolId: number, schoolYearId: number, events: SpecialEventInput[]): Promise<SpecialEventRow[]>;
export declare function deleteSpecialEvent(schoolId: number, schoolYearId: number, eventId: number): Promise<void>;
export declare function deleteSpecialEventsByType(schoolId: number, schoolYearId: number, eventType: SpecialEventType): Promise<number>;
/**
 * Seed default shift-specific events for the real 2026-2027 baseline.
 * Checks the full scope key (eventType + gradeGroup + programType) so missing
 * grade-group counterparts are created even if another row of the same eventType exists.
 */
export declare function seedShiftBaseline(schoolId: number, schoolYearId: number): Promise<SpecialEventRow[]>;
