/**
 * Preference events service — bilateral SSE for time-slot and well-being preferences.
 * Faculty actions → scheduler view; scheduler decisions → faculty view.
 */
export type PreferenceEventType = 'PREFERENCE_DRAFT_SAVED' | 'PREFERENCE_SUBMITTED' | 'PREFERENCE_REVIEWED' | 'PREFERENCE_REMINDER_SENT' | 'PREFERENCE_LOCKED';
export type PreferenceEvent = {
    id: number;
    type: PreferenceEventType;
    timestamp: string;
    schoolId: number;
    schoolYearId: number;
    /** Set when the event affects a specific faculty member. */
    facultyId: number | null;
    /** Preference record id, if applicable. */
    preferenceId: number | null;
    message: string;
    metadata?: Record<string, unknown>;
};
export declare function publishPreferenceEvent(event: Omit<PreferenceEvent, 'id' | 'timestamp'>): PreferenceEvent;
export declare function subscribePreferenceEvents(params: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
    send: (event: PreferenceEvent) => void;
}): () => void;
export declare function getPreferenceEventsSince(eventId: number, scope: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
}): PreferenceEvent[];
