/**
 * Preference events service — bilateral SSE for time-slot and well-being preferences.
 * Faculty actions → scheduler view; scheduler decisions → faculty view.
 */

export type PreferenceEventType =
	| 'PREFERENCE_DRAFT_SAVED'
	| 'PREFERENCE_SUBMITTED'
	| 'PREFERENCE_REVIEWED'
	| 'PREFERENCE_REMINDER_SENT'
	| 'PREFERENCE_LOCKED';

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

type Subscriber = {
	schoolId: number;
	schoolYearId: number;
	/** null = subscribe to all faculty in scope (officer view). */
	facultyId: number | null;
	send: (event: PreferenceEvent) => void;
};

const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set<Subscriber>();
const buffer: PreferenceEvent[] = [];

function canReceive(subscriber: Subscriber, event: PreferenceEvent): boolean {
	if (subscriber.schoolId !== event.schoolId || subscriber.schoolYearId !== event.schoolYearId) {
		return false;
	}
	// Officer subscribers (facultyId=null) receive all events for the scope.
	if (subscriber.facultyId === null) return true;
	// Faculty subscribers only receive events scoped to them or broadcast (null) events.
	if (event.facultyId === null) return true;
	return subscriber.facultyId === event.facultyId;
}

export function publishPreferenceEvent(
	event: Omit<PreferenceEvent, 'id' | 'timestamp'>,
): PreferenceEvent {
	const resolved: PreferenceEvent = {
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

export function subscribePreferenceEvents(params: {
	schoolId: number;
	schoolYearId: number;
	facultyId?: number | null;
	send: (event: PreferenceEvent) => void;
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

export function getPreferenceEventsSince(
	eventId: number,
	scope: { schoolId: number; schoolYearId: number; facultyId?: number | null },
): PreferenceEvent[] {
	const gate: Subscriber = {
		schoolId: scope.schoolId,
		schoolYearId: scope.schoolYearId,
		facultyId: scope.facultyId ?? null,
		send: () => {},
	};
	return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
