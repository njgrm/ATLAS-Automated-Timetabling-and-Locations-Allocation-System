import { onPreferenceEvent } from './preference-events.service.js';
import { onPublishedScheduleEvent } from './published-schedule-events.service.js';
import { onRoomPreferenceEvent } from './room-preference-events.service.js';
import { onTimetableEvent } from './timetable-events.service.js';
const MAX_BUFFER = 500;
let nextEventId = 1;
let bridgesInitialized = false;
let disposeBridges = [];
const subscribers = new Set();
const buffer = [];
function canReceive(subscriber, event) {
    if (subscriber.schoolId !== event.schoolId || subscriber.schoolYearId !== event.schoolYearId) {
        return false;
    }
    if (subscriber.facultyId === null) {
        return true;
    }
    if (event.audience === 'PRIVILEGED') {
        return false;
    }
    if (event.audience === 'ALL') {
        return true;
    }
    if (event.facultyId === null && !event.facultyIds?.length) {
        return true;
    }
    if (event.facultyId === subscriber.facultyId) {
        return true;
    }
    return Array.isArray(event.facultyIds) && event.facultyIds.includes(subscriber.facultyId);
}
export function publishNotificationEvent(event) {
    const resolved = {
        id: nextEventId++,
        timestamp: event.timestamp ?? new Date().toISOString(),
        ...event,
    };
    buffer.push(resolved);
    if (buffer.length > MAX_BUFFER) {
        buffer.splice(0, buffer.length - MAX_BUFFER);
    }
    for (const subscriber of subscribers) {
        if (canReceive(subscriber, resolved)) {
            subscriber.send(resolved);
        }
    }
    return resolved;
}
export function subscribeNotificationEvents(params) {
    const subscriber = {
        schoolId: params.schoolId,
        schoolYearId: params.schoolYearId,
        facultyId: params.facultyId ?? null,
        send: params.send,
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
}
export function getNotificationEventsSince(eventId, scope) {
    const gate = {
        schoolId: scope.schoolId,
        schoolYearId: scope.schoolYearId,
        facultyId: scope.facultyId ?? null,
        send: () => { },
    };
    return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
function preferenceSeverity(event) {
    if (event.type === 'PREFERENCE_REVIEWED' || event.type === 'PREFERENCE_SUBMITTED')
        return 'success';
    if (event.type === 'PREFERENCE_REMINDER_SENT' || event.type === 'PREFERENCE_LOCKED')
        return 'warning';
    return 'info';
}
function roomPreferenceSeverity(event) {
    if (event.type === 'ROOM_REQUEST_REVIEWED' || event.type === 'ROOM_REQUEST_SYNC_COMPLETED')
        return 'success';
    if (event.type === 'ROOM_REQUEST_DELETED')
        return 'warning';
    return 'info';
}
function timetableSeverity(event) {
    if (event.type === 'TIMETABLE_REVERTED')
        return 'warning';
    return 'success';
}
function publishedScheduleSeverity(event) {
    if (event.type === 'SCHEDULE_REVISED')
        return 'warning';
    return 'success';
}
export function initializeNotificationEventBridges() {
    if (bridgesInitialized)
        return;
    bridgesInitialized = true;
    disposeBridges = [
        onPreferenceEvent((event) => {
            publishNotificationEvent({
                type: event.type,
                domain: 'preference',
                severity: preferenceSeverity(event),
                audience: event.facultyId == null ? 'PRIVILEGED' : 'FACULTY',
                schoolId: event.schoolId,
                schoolYearId: event.schoolYearId,
                facultyId: event.facultyId,
                message: event.message,
                metadata: {
                    preferenceId: event.preferenceId,
                    ...(event.metadata ?? {}),
                },
                sourceEventId: event.id,
                sourceEventType: event.type,
            });
        }),
        onRoomPreferenceEvent((event) => {
            publishNotificationEvent({
                type: event.type,
                domain: 'room-request',
                severity: roomPreferenceSeverity(event),
                audience: event.facultyId == null ? 'PRIVILEGED' : 'FACULTY',
                schoolId: event.schoolId,
                schoolYearId: event.schoolYearId,
                facultyId: event.facultyId,
                message: event.message,
                metadata: {
                    runId: event.runId,
                    requestId: event.requestId,
                    entryId: event.entryId,
                    ...(event.metadata ?? {}),
                },
                sourceEventId: event.id,
                sourceEventType: event.type,
            });
        }),
        onTimetableEvent((event) => {
            publishNotificationEvent({
                type: event.type,
                domain: 'timetable',
                severity: timetableSeverity(event),
                audience: 'PRIVILEGED',
                schoolId: event.schoolId,
                schoolYearId: event.schoolYearId,
                facultyId: null,
                message: event.message,
                metadata: {
                    runId: event.runId,
                    actorId: event.actorId,
                    ...(event.metadata ?? {}),
                },
                sourceEventId: event.id,
                sourceEventType: event.type,
            });
        }),
        onPublishedScheduleEvent((event) => {
            const affectedFacultyIds = Array.isArray(event.metadata?.affectedFacultyIds)
                ? event.metadata.affectedFacultyIds.filter((value) => Number.isInteger(value))
                : undefined;
            publishNotificationEvent({
                type: event.type,
                domain: 'published-schedule',
                severity: publishedScheduleSeverity(event),
                audience: affectedFacultyIds?.length ? 'FACULTY' : 'ALL',
                schoolId: event.schoolId,
                schoolYearId: event.schoolYearId,
                facultyId: null,
                facultyIds: affectedFacultyIds,
                message: event.message,
                metadata: event.metadata,
                sourceEventId: event.id,
                sourceEventType: event.type,
            });
        }),
    ];
}
export function disposeNotificationEventBridges() {
    for (const dispose of disposeBridges) {
        dispose();
    }
    disposeBridges = [];
    bridgesInitialized = false;
}
//# sourceMappingURL=notification-events.service.js.map