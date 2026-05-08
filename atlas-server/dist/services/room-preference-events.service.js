const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set();
const buffer = [];
function canReceive(subscriber, event) {
    if (subscriber.schoolId !== event.schoolId || subscriber.schoolYearId !== event.schoolYearId) {
        return false;
    }
    if (subscriber.facultyId == null) {
        return true;
    }
    if (event.facultyId == null) {
        return true;
    }
    return subscriber.facultyId === event.facultyId;
}
export function publishRoomPreferenceEvent(event) {
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
    return resolved;
}
export function subscribeRoomPreferenceEvents(params) {
    const subscriber = {
        schoolId: params.schoolId,
        schoolYearId: params.schoolYearId,
        facultyId: params.facultyId ?? null,
        send: params.send,
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
}
export function getRoomPreferenceEventsSince(eventId, scope) {
    const gate = {
        schoolId: scope.schoolId,
        schoolYearId: scope.schoolYearId,
        facultyId: scope.facultyId ?? null,
        send: () => { },
    };
    return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
//# sourceMappingURL=room-preference-events.service.js.map