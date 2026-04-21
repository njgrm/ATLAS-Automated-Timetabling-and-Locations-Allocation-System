/**
 * Pure metric helpers for room schedule summaries.
 * Kept separate from room-schedule.service.ts so unit tests can import
 * these helpers without requiring Prisma/database wiring.
 */
export interface TimeIntervalEntry {
    day: string;
    startTime: string;
    endTime: string;
}
/**
 * Calculates occupied minutes by taking the union of occupied time intervals
 * per day, then summing across days.
 */
export declare function computeOccupiedMinutesByIntervalUnion(entries: TimeIntervalEntry[], days: readonly string[]): number;
export declare function countUniqueEntryIds(entries: Array<{
    entryId: string;
}>): number;
