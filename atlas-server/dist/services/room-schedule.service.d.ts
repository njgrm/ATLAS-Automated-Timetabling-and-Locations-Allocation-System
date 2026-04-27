/**
 * Room schedule projection service.
 * Reads draft entries from generation runs and projects a room-centric timetable view.
 * Business logic only; no transport concerns.
 */
declare const DAYS: readonly ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
export interface RoomScheduleEntry {
    entryId: string;
    subjectId: number;
    sectionId: number;
    facultyId: number;
    startTime: string;
    endTime: string;
    durationMinutes: number;
}
export interface RoomScheduleCell {
    day: string;
    occupied: boolean;
    entries: RoomScheduleEntry[];
    conflict: boolean;
}
export interface RoomScheduleView {
    room: {
        id: number;
        name: string;
        type: string;
        buildingId?: number;
        buildingName?: string;
        floor?: number;
    };
    source: {
        mode: 'LATEST' | 'RUN' | 'DRAFT';
        runId: number | null;
        status: string;
        generatedAt?: string;
    };
    timeSlots: Array<{
        startTime: string;
        endTime: string;
    }>;
    days: typeof DAYS;
    grid: Array<{
        timeSlot: {
            startTime: string;
            endTime: string;
        };
        cells: RoomScheduleCell[];
    }>;
    summary: {
        occupiedMinutes: number;
        availableMinutes: number;
        utilizationPercent: number;
        entryCount: number;
        conflictCount: number;
    };
}
export declare function getRoomScheduleView(schoolId: number, schoolYearId: number, roomId: number, source: {
    mode: 'LATEST';
} | {
    mode: 'RUN';
    runId: number;
} | {
    mode: 'DRAFT';
}): Promise<RoomScheduleView>;
export {};
