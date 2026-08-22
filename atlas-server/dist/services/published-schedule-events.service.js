/**
 * Published schedule events service — SSE updates for schedule publication and revisions.
 */
const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set();
const buffer = [];
const listeners = new Set();
function canReceive(subscriber, event) {
    if (subscriber.schoolId !== event.schoolId || subscriber.schoolYearId !== event.schoolYearId) {
        return false;
    }
    // Officer/Admin subscribers (facultyId = null) receive all published schedule events.
    if (subscriber.facultyId === null)
        return true;
    // For general broadcasts (e.g., global publish), everyone gets them.
    if (!event.metadata || !('affectedFacultyIds' in event.metadata))
        return true;
    // For revisions, check if the subscriber faculty is affected.
    const affected = event.metadata.affectedFacultyIds;
    if (Array.isArray(affected)) {
        return affected.includes(subscriber.facultyId);
    }
    return true;
}
export function publishPublishedScheduleEvent(event) {
    const resolved = {
        id: nextEventId++,
        timestamp: new Date().toISOString(),
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
    for (const listener of listeners) {
        listener(resolved);
    }
    return resolved;
}
export function onPublishedScheduleEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
export function subscribePublishedScheduleEvents(params) {
    const subscriber = {
        schoolId: params.schoolId,
        schoolYearId: params.schoolYearId,
        facultyId: params.facultyId ?? null,
        send: params.send,
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
}
export function getPublishedScheduleEventsSince(eventId, scope) {
    const gate = {
        schoolId: scope.schoolId,
        schoolYearId: scope.schoolYearId,
        facultyId: scope.facultyId ?? null,
        send: () => { },
    };
    return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
//# sourceMappingURL=published-schedule-events.service.js.map