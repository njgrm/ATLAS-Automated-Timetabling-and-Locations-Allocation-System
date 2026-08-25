import assert from 'node:assert/strict';
import test from 'node:test';
import {
	publishNotificationEvent,
	subscribeNotificationEvents,
	disposeNotificationEventBridges,
	initializeNotificationEventBridges,
	type NotificationEvent,
} from '../services/notification-events.service.js';
import { publishPublishedScheduleEvent } from '../services/published-schedule-events.service.js';
import { publishTimetableEvent } from '../services/timetable-events.service.js';

let pass = 0;
let fail = 0;

function check(condition: boolean, label: string) {
	if (condition) {
		pass++;
		console.log(`  ✓ ${label}`);
	} else {
		fail++;
		console.error(`  ✗ ${label}`);
	}
}

function setup() {
	disposeNotificationEventBridges();
	initializeNotificationEventBridges();
	const events: NotificationEvent[] = [];
	const stop = subscribeNotificationEvents({
		schoolId: 1,
		schoolYearId: 55,
		facultyId: null,
		send: (e) => events.push(e),
	});
	return { events, stop };
}

function teardown(stop: () => void) {
	stop();
	disposeNotificationEventBridges();
}

// ─── Test 1: Generation service emitter includes termCounts ───

test('publishNotificationEvent passes through metadata for generation completion', () => {
	const { events, stop } = setup();

	publishNotificationEvent({
		type: 'GENERATION_RUN_COMPLETED',
		domain: 'generation',
		severity: 'success',
		audience: 'PRIVILEGED',
		schoolId: 1,
		schoolYearId: 55,
		facultyId: null,
		message: 'Test generation.',
		metadata: {
			runId: 100,
			termCounts: { term1: 50, term2: 30, term3: 25 },
		},
	});

	const event = events.at(-1);
	check(event?.type === 'GENERATION_RUN_COMPLETED', 'Event type is GENERATION_RUN_COMPLETED');
	check((event?.metadata as any)?.termCounts?.term1 === 50, 'termCounts.term1 = 50');
	check((event?.metadata as any)?.termCounts?.term2 === 30, 'termCounts.term2 = 30');
	check((event?.metadata as any)?.termCounts?.term3 === 25, 'termCounts.term3 = 25');
	teardown(stop);
});

// ─── Test 2: Publish service emitter includes termCounts ───

test('publishPublishedScheduleEvent passes through metadata for schedule publish', () => {
	const { events, stop } = setup();

	publishPublishedScheduleEvent({
		type: 'SCHEDULE_PUBLISHED',
		schoolId: 1,
		schoolYearId: 55,
		message: 'Test publish.',
		metadata: {
			runId: 100,
			termCounts: { term1: 50, term2: 30, term3: 25 },
		},
	});

	const event = events.at(-1);
	check(event?.type === 'SCHEDULE_PUBLISHED', 'Event type is SCHEDULE_PUBLISHED');
	check((event?.metadata as any)?.termCounts?.term1 === 50, 'termCounts.term1 = 50');
	teardown(stop);
});

// ─── Test 3: Revision service emitter includes affectedTermIndices ───

test('publishPublishedScheduleEvent passes through metadata for schedule revision', () => {
	const { events, stop } = setup();

	publishPublishedScheduleEvent({
		type: 'SCHEDULE_REVISED',
		schoolId: 1,
		schoolYearId: 55,
		message: 'Test revision.',
		metadata: {
			revisionId: 1,
			affectedTermIndices: [1, 2],
		},
	});

	const event = events.at(-1);
	check(event?.type === 'SCHEDULE_REVISED', 'Event type is SCHEDULE_REVISED');
	check(Array.isArray((event?.metadata as any)?.affectedTermIndices), 'affectedTermIndices is array');
	check((event?.metadata as any)?.affectedTermIndices?.includes(1), 'affectedTermIndices includes 1');
	check((event?.metadata as any)?.affectedTermIndices?.includes(2), 'affectedTermIndices includes 2');
	teardown(stop);
});

// ─── Test 4: Single edit emitter includes termIndex ───

test('publishTimetableEvent passes through metadata for single edit', () => {
	const { events, stop } = setup();

	publishTimetableEvent({
		type: 'TIMETABLE_EDIT_COMMITTED',
		schoolId: 1,
		schoolYearId: 55,
		runId: 100,
		actorId: 1,
		message: 'Test single edit.',
		metadata: {
			editId: 1,
			editType: 'MOVE_ENTRY',
			termIndex: 1,
		},
	});

	const event = events.at(-1);
	check(event?.type === 'TIMETABLE_EDIT_COMMITTED', 'Event type is TIMETABLE_EDIT_COMMITTED');
	check((event?.metadata as any)?.termIndex === 1, 'termIndex = 1');
	teardown(stop);
});

// ─── Test 5: Batch edit emitter includes affectedTermIndices ───

test('publishTimetableEvent passes through metadata for batch edit', () => {
	const { events, stop } = setup();

	publishTimetableEvent({
		type: 'TIMETABLE_EDIT_COMMITTED',
		schoolId: 1,
		schoolYearId: 55,
		runId: 100,
		actorId: 1,
		message: 'Test batch edit.',
		metadata: {
			editIds: [1, 2, 3],
			batchSize: 3,
			affectedTermIndices: [1, 3],
		},
	});

	const event = events.at(-1);
	check(event?.type === 'TIMETABLE_EDIT_COMMITTED', 'Event type is TIMETABLE_EDIT_COMMITTED');
	check(Array.isArray((event?.metadata as any)?.affectedTermIndices), 'affectedTermIndices is array');
	check((event?.metadata as any)?.affectedTermIndices?.includes(1), 'affectedTermIndices includes 1');
	check((event?.metadata as any)?.affectedTermIndices?.includes(3), 'affectedTermIndices includes 3');
	teardown(stop);
});

// ─── Test 6: Revert emitter includes termIndex ───

test('publishTimetableEvent passes through metadata for revert', () => {
	const { events, stop } = setup();

	publishTimetableEvent({
		type: 'TIMETABLE_REVERTED',
		schoolId: 1,
		schoolYearId: 55,
		runId: 100,
		actorId: 1,
		message: 'Test revert.',
		metadata: {
			revertedEditId: 1,
			newEditId: 2,
			termIndex: 2,
		},
	});

	const event = events.at(-1);
	check(event?.type === 'TIMETABLE_REVERTED', 'Event type is TIMETABLE_REVERTED');
	check((event?.metadata as any)?.termIndex === 2, 'termIndex = 2');
	teardown(stop);
});

// ─── Test 7: Backward compatibility — no term metadata ───

test('publishTimetableEvent works without term metadata (backward compatible)', () => {
	const { events, stop } = setup();

	publishTimetableEvent({
		type: 'TIMETABLE_EDIT_COMMITTED',
		schoolId: 1,
		schoolYearId: 55,
		runId: 100,
		actorId: 1,
		message: 'Test no-term edit.',
		metadata: {
			editId: 99,
			editType: 'PLACE_UNASSIGNED',
		},
	});

	const event = events.at(-1);
	check(event?.type === 'TIMETABLE_EDIT_COMMITTED', 'Event type is TIMETABLE_EDIT_COMMITTED');
	check((event?.metadata as any)?.termIndex === undefined, 'termIndex is undefined');
	check((event?.metadata as any)?.affectedTermIndices === undefined, 'affectedTermIndices is undefined');
	teardown(stop);
});

// ─── Test 8: Swap emitter includes affectedTermIndices ───

test('publishTimetableEvent passes through metadata for swap', () => {
	const { events, stop } = setup();

	publishTimetableEvent({
		type: 'TIMETABLE_EDIT_COMMITTED',
		schoolId: 1,
		schoolYearId: 55,
		runId: 100,
		actorId: 1,
		message: 'Test swap.',
		metadata: {
			editId: 10,
			strategy: 'DIRECT',
			entryIdA: 'entry-1',
			entryIdB: 'entry-2',
			affectedTermIndices: [1],
		},
	});

	const event = events.at(-1);
	check(event?.type === 'TIMETABLE_EDIT_COMMITTED', 'Event type is TIMETABLE_EDIT_COMMITTED');
	check(Array.isArray((event?.metadata as any)?.affectedTermIndices), 'affectedTermIndices is array');
	check((event?.metadata as any)?.affectedTermIndices?.length === 1, 'affectedTermIndices has 1 entry');
	check((event?.metadata as any)?.affectedTermIndices?.includes(1), 'affectedTermIndices includes term 1');
	teardown(stop);
});

console.log(`\n═══ Active-term notification metadata tests ═══`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
