export type NotificationAudience = 'ALL' | 'FACULTY' | 'PRIVILEGED';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
export type NotificationDomain = 'preference' | 'room-request' | 'timetable' | 'published-schedule' | 'generation' | 'integration';
export type NotificationEvent = {
    id: number;
    type: string;
    domain: NotificationDomain;
    severity: NotificationSeverity;
    audience: NotificationAudience;
    timestamp: string;
    schoolId: number;
    schoolYearId: number;
    facultyId: number | null;
    facultyIds?: number[];
    message: string;
    metadata?: Record<string, unknown>;
    sourceEventId?: number;
    sourceEventType?: string;
};
export declare function publishNotificationEvent(event: Omit<NotificationEvent, 'id' | 'timestamp'> & {
    timestamp?: string;
}): NotificationEvent;
export declare function subscribeNotificationEvents(params: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
    send: (event: NotificationEvent) => void;
}): () => void;
export declare function getNotificationEventsSince(eventId: number, scope: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
}): NotificationEvent[];
export declare function initializeNotificationEventBridges(): void;
export declare function disposeNotificationEventBridges(): void;
