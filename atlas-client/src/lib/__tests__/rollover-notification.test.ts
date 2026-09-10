import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	createEventDeduper,
	isRolloverCompletionEvent,
	parseSseFrames,
	type NotificationStreamEvent,
} from '@/hooks/useNotificationStream';

const COMPLETION_TYPES = [
	'ROLLOVER_SYNC_COMPLETED',
	'ROLLOVER_AUTO_SYNC_COMPLETED',
	'ROLLOVER_ARCHIVE_SYNC_COMPLETED',
	'TEST_YEAR_RECOVERY_COMPLETED',
	'DUMMY_YEAR_RESET_COMPLETED',
];

test('rollover completion detection only accepts integration-domain completion events', () => {
	for (const type of COMPLETION_TYPES) {
		assert.equal(isRolloverCompletionEvent({ type, domain: 'integration' }), true, `${type} is a rollover completion`);
	}
	assert.equal(isRolloverCompletionEvent({ type: 'ROLLOVER_SYNC_COMPLETED', domain: 'generation' }), false);
	assert.equal(isRolloverCompletionEvent({ type: 'SCHOOL_YEAR_ARCHIVED', domain: 'integration' }), false, 'archive start is not a completion');
	assert.equal(isRolloverCompletionEvent({ type: 'ROLLOVER_ATTENTION_REQUIRED', domain: 'integration' }), false);
	assert.equal(isRolloverCompletionEvent({ type: 'GENERATION_RUN_COMPLETED', domain: 'generation' }), false);
});

test('parseSseFrames extracts the rollover event and preserves an incomplete frame', () => {
	const buffer = [
		'retry: 2000',
		'',
		'id: 42',
		'event: ROLLOVER_SYNC_COMPLETED',
		'data: {"id":42,"type":"ROLLOVER_SYNC_COMPLETED","domain":"integration","schoolId":7,"schoolYearId":20}',
		'',
		'id: 43',
		'event: ROLLOVER_SYNC_COMPLETED',
		'data: {"id":43',
	].join('\n');

	const { events, remainder } = parseSseFrames(buffer);
	assert.equal(events.length, 1);
	assert.equal(events[0].id, 42);
	assert.equal(events[0].event, 'ROLLOVER_SYNC_COMPLETED');
	const parsed = JSON.parse(events[0].data) as NotificationStreamEvent;
	assert.equal(parsed.schoolId, 7);
	assert.equal(parsed.schoolYearId, 20);
	assert.match(remainder, /"id":43/);
});

test('delivery deduper delivers each school event once and isolates schools', () => {
	const deduper = createEventDeduper(500);
	assert.equal(deduper.shouldDeliver({ schoolId: 7, id: 1 }), true);
	assert.equal(deduper.shouldDeliver({ schoolId: 7, id: 1 }), false, 'same event from year+school streams is delivered once');
	assert.equal(deduper.shouldDeliver({ schoolId: 8, id: 1 }), true, 'the same id in another school is a distinct event');
	assert.equal(deduper.shouldDeliver({ schoolId: 7, id: 2 }), true);
	assert.equal(deduper.size(), 3);
});
