export type TimetableEventType =
	| 'TIMETABLE_EDIT_COMMITTED'
	| 'TIMETABLE_REVERTED';

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

type Subscriber = {
	schoolId: number;
	schoolYearId: number;
	send: (event: TimetableEvent) => void;
};

const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set<Subscriber>();
const buffer: TimetableEvent[] = [];
const listeners = new Set<(event: TimetableEvent) => void>();

function canReceive(subscriber: Subscriber, event: TimetableEvent): boolean {
	return subscriber.schoolId === event.schoolId && subscriber.schoolYearId === event.schoolYearId;
}

export function publishTimetableEvent(event: Omit<TimetableEvent, 'id' | 'timestamp'>): TimetableEvent {
	const resolved: TimetableEvent = {
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

export function onTimetableEvent(listener: (event: TimetableEvent) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function subscribeTimetableEvents(params: {
	schoolId: number;
	schoolYearId: number;
	send: (event: TimetableEvent) => void;
}): () => void {
	const subscriber: Subscriber = {
		schoolId: params.schoolId,
		schoolYearId: params.schoolYearId,
		send: params.send,
	};
	subscribers.add(subscriber);
	return () => subscribers.delete(subscriber);
}

export function getTimetableEventsSince(eventId: number, scope: {
	schoolId: number;
	schoolYearId: number;
}): TimetableEvent[] {
	const gate: Subscriber = {
		schoolId: scope.schoolId,
		schoolYearId: scope.schoolYearId,
		send: () => {},
	};
	return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
