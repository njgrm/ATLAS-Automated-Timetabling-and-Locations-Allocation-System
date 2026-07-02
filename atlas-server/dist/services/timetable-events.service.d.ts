export type TimetableEventType = 'TIMETABLE_EDIT_COMMITTED' | 'TIMETABLE_REVERTED';
export type TimetableEvent = {
    id: number;
    type: TimetableEventType;
    timestamp: string;
    schoolId: number;
    schoolYearId: number;
    runId: number;
    actorId: number;
    message: string;
    metadata?: Record<string, unknown>;
};
export declare function publishTimetableEvent(event: Omit<TimetableEvent, 'id' | 'timestamp'>): TimetableEvent;
export declare function onTimetableEvent(listener: (event: TimetableEvent) => void): () => void;
export declare function subscribeTimetableEvents(params: {
    schoolId: number;
    schoolYearId: number;
    send: (event: TimetableEvent) => void;
}): () => void;
export declare function getTimetableEventsSince(eventId: number, scope: {
    schoolId: number;
    schoolYearId: number;
}): TimetableEvent[];
