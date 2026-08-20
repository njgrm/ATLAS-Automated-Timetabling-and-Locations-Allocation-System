/**
 * Pure helpers for policy special-event resolution.
 * No Prisma dependency — safe for use in schedule-constructor and tests.
 */
export declare const VALID_EVENT_TYPES: readonly ["FLAG_OR_HGP", "HEALTH_BREAK", "LUNCH_BREAK", "CUSTOM"];
export type SpecialEventType = (typeof VALID_EVENT_TYPES)[number];
export declare const VALID_GRADE_GROUPS: readonly ["7-8", "9-10"];
export type GradeGroup = (typeof VALID_GRADE_GROUPS)[number];
export interface SpecialEventRowLike {
    eventType: string;
    label: string;
    gradeGroup: string | null;
    programType: string | null;
    startTime: string;
    endTime: string;
    enabled: boolean;
}
/** Shape consumed by the schedule constructor. */
export interface EffectiveSpecialEvent {
    eventType: string;
    label: string;
    startTime: string;
    endTime: string;
    gradeGroup: string | null;
    programType: string | null;
}
/**
 * Grade group resolver: maps a numeric grade level to its grade group string.
 */
export declare function resolveGradeGroup(gradeLevel: number): GradeGroup | null;
/**
 * Build the effective special events list for a specific grade/program combination.
 * Returns exactly ONE row per eventType — the highest-priority match.
 *
 * Priority per eventType (highest first):
 *   1. Shift + exact program  (gradeGroup matches, programType matches)
 *   2. Shift default          (gradeGroup matches, programType == null)
 *   3. Program-global         (gradeGroup == null, programType matches)
 *   4. Global                 (gradeGroup == null, programType == null)
 *
 * @param specialEvents - All persisted special event rows for this policy
 * @param gradeLevel - The grade level to resolve events for
 * @param programType - Optional program type filter
 * @returns Exactly one effective event per eventType that has any enabled match
 */
export declare function getEffectiveEvents(specialEvents: SpecialEventRowLike[], gradeLevel: number, programType?: string | null): EffectiveSpecialEvent[];
