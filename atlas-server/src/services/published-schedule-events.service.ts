/**
 * Published schedule events service — SSE updates for schedule publication and revisions.
 */

export type PublishedScheduleEventType =
	| 'SCHEDULE_PUBLISHED'
	| 'SCHEDULE_REVISED';

export type PublishedScheduleEvent = {
	id: number;
	type: PublishedScheduleEventType;
	timestamp: string;
	schoolId: number;
	schoolYearId: number;
	message: string;
	metadata?: Record<string, unknown>;
};

type Subscriber = {
	schoolId: number;
	schoolYearId: number;
	/** null = subscribe to all schedule updates (admin/officer view). */
	facultyId: number | null;
	send: (event: PublishedScheduleEvent) => void;
};

const MAX_BUFFER = 300;
let nextEventId = 1;
const subscribers = new Set<Subscriber>();
const buffer: PublishedScheduleEvent[] = [];

function canReceive(subscriber: Subscriber, event: PublishedScheduleEvent): boolean {
	if (subscriber.schoolId !== event.schoolId || subscriber.schoolYearId !== event.schoolYearId) {
		return false;
	}
	// Officer/Admin subscribers (facultyId = null) receive all published schedule events.
	if (subscriber.facultyId === null) return true;

	// For general broadcasts (e.g., global publish), everyone gets them.
	if (!event.metadata || !('affectedFacultyIds' in event.metadata)) return true;

	// For revisions, check if the subscriber faculty is affected.
	const affected = event.metadata.affectedFacultyIds;
	if (Array.isArray(affected)) {
		return affected.includes(subscriber.facultyId);
	}
	return true;
}

export function publishPublishedScheduleEvent(
	event: Omit<PublishedScheduleEvent, 'id' | 'timestamp'>,
): PublishedScheduleEvent {
	const resolved: PublishedScheduleEvent = {
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

export function subscribePublishedScheduleEvents(params: {
	schoolId: number;
	schoolYearId: number;
	facultyId?: number | null;
	send: (event: PublishedScheduleEvent) => void;
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

export function getPublishedScheduleEventsSince(
	eventId: number,
	scope: { schoolId: number; schoolYearId: number; facultyId?: number | null },
): PublishedScheduleEvent[] {
	const gate: Subscriber = {
		schoolId: scope.schoolId,
		schoolYearId: scope.schoolYearId,
		facultyId: scope.facultyId ?? null,
		send: () => {},
	};
	return buffer.filter((event) => event.id > eventId && canReceive(gate, event));
}
