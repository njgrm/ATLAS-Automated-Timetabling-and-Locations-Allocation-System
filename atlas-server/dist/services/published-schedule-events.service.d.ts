/**
 * Published schedule events service — SSE updates for schedule publication and revisions.
 */
export type PublishedScheduleEventType = 'SCHEDULE_PUBLISHED' | 'SCHEDULE_REVISED';
export type PublishedScheduleEvent = {
    id: number;
    type: PublishedScheduleEventType;
    timestamp: string;
    schoolId: number;
    schoolYearId: number;
    message: string;
    metadata?: Record<string, unknown>;
};
export declare function publishPublishedScheduleEvent(event: Omit<PublishedScheduleEvent, 'id' | 'timestamp'>): PublishedScheduleEvent;
export declare function onPublishedScheduleEvent(listener: (event: PublishedScheduleEvent) => void): () => void;
export declare function subscribePublishedScheduleEvents(params: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
    send: (event: PublishedScheduleEvent) => void;
}): () => void;
export declare function getPublishedScheduleEventsSince(eventId: number, scope: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
}): PublishedScheduleEvent[];
