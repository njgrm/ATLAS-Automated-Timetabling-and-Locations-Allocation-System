const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set();
const buffer = [];
const listeners = new Set();
function canReceive(subscriber, event) {
    return subscriber.schoolId === event.schoolId && subscriber.schoolYearId === event.schoolYearId;
}
export function publishTimetableEvent(event) {
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
export function onTimetableEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
export function subscribeTimetableEvents(params) {
    const subscriber = {
        schoolId: params.schoolId,
        schoolYearId: params.schoolYearId,
        send: params.send,
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
}
export function getTimetableEventsSince(eventId, scope) {
    const gate = {
        schoolId: scope.schoolId,
        schoolYearId: scope.schoolYearId,
        send: () => { },
    };
    return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
//# sourceMappingURL=timetable-events.service.js.map