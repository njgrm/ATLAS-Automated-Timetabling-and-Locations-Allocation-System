export type RoomPreferenceEventType =
	| 'ROOM_REQUEST_DRAFT_SAVED'
	| 'ROOM_REQUEST_SUBMITTED'
	| 'ROOM_REQUEST_DELETED'
	| 'ROOM_REQUEST_REVIEWED'
	| 'ROOM_REQUEST_SYNC_COMPLETED';

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

type Subscriber = {
	schoolId: number;
	schoolYearId: number;
	facultyId: number | null;
	send: (event: RoomPreferenceEvent) => void;
};

const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set<Subscriber>();
const buffer: RoomPreferenceEvent[] = [];
const listeners = new Set<(event: RoomPreferenceEvent) => void>();

function canReceive(subscriber: Subscriber, event: RoomPreferenceEvent): boolean {
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

export function publishRoomPreferenceEvent(event: Omit<RoomPreferenceEvent, 'id' | 'timestamp'>): RoomPreferenceEvent {
	const resolved: RoomPreferenceEvent = {
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

export function onRoomPreferenceEvent(listener: (event: RoomPreferenceEvent) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function subscribeRoomPreferenceEvents(params: {
	schoolId: number;
	schoolYearId: number;
	facultyId?: number | null;
	send: (event: RoomPreferenceEvent) => void;
}): () => void {
	const subscriber: Subscriber = {
		schoolId: params.schoolId,
		schoolYearId: params.schoolYearId,
		facultyId: params.facultyId ?? null,
		send: params.send,
	};
	subscribers.add(subscriber);
	return () => subscribers.delete(subscriber);
}

export function getRoomPreferenceEventsSince(eventId: number, scope: {
	schoolId: number;
	schoolYearId: number;
	facultyId?: number | null;
}): RoomPreferenceEvent[] {
	const gate: Subscriber = {
		schoolId: scope.schoolId,
		schoolYearId: scope.schoolYearId,
		facultyId: scope.facultyId ?? null,
		send: () => {},
	};
	return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
