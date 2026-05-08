type RoomPreferenceEventType = 'ROOM_REQUEST_DRAFT_SAVED' | 'ROOM_REQUEST_SUBMITTED' | 'ROOM_REQUEST_DELETED' | 'ROOM_REQUEST_REVIEWED' | 'ROOM_REQUEST_SYNC_COMPLETED';
export type RoomPreferenceEvent = {
    id: number;
    type: RoomPreferenceEventType;
    timestamp: string;
    schoolId: number;
    schoolYearId: number;
    runId: number;
    facultyId: number | null;
    requestId: number | null;
    entryId: string | null;
    message: string;
    metadata?: Record<string, unknown>;
};
export declare function publishRoomPreferenceEvent(event: Omit<RoomPreferenceEvent, 'id' | 'timestamp'>): RoomPreferenceEvent;
export declare function subscribeRoomPreferenceEvents(params: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
    send: (event: RoomPreferenceEvent) => void;
}): () => void;
export declare function getRoomPreferenceEventsSince(eventId: number, scope: {
    schoolId: number;
    schoolYearId: number;
    facultyId?: number | null;
}): RoomPreferenceEvent[];
export {};
