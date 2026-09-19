import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPublicScheduleCacheKey } from '@/lib/public-schedule-cache';
import { buildPublishedScheduleCacheMarker } from '@/lib/published-schedule-cache-key';
import { buildPublicScheduleTermRequest, isExactPublishedTermPayload, PUBLIC_SCHEDULE_INVALID_TERM_MESSAGE, resolvePublicScheduleTermSelection } from '@/lib/public-schedule-term-scope';

test('missing URL term means verified active while malformed terms remain invalid, never numeric Term 1', () => {
	assert.equal(resolvePublicScheduleTermSelection(null), 'active');
	assert.equal(resolvePublicScheduleTermSelection(''), 'active');
	assert.equal(resolvePublicScheduleTermSelection('garbage'), 'invalid');
	assert.equal(resolvePublicScheduleTermSelection('0'), 'invalid');
	assert.equal(resolvePublicScheduleTermSelection('2'), 2);
});

test('invalid URL terms expose a selection error and dispatch zero public requests', () => {
	let requests = 0;
	const request = buildPublicScheduleTermRequest(resolvePublicScheduleTermSelection('unknown-term'));
	if (request) requests += 1;
	assert.equal(request, null);
	assert.equal(requests, 0);
	assert.match(PUBLIC_SCHEDULE_INVALID_TERM_MESSAGE, /invalid.*Choose/i);
	assert.deepEqual(buildPublicScheduleTermRequest(resolvePublicScheduleTermSelection(null)), { termIndex: 'active' });
	assert.deepEqual(buildPublicScheduleTermRequest(resolvePublicScheduleTermSelection('3')), { termIndex: 3 });
});

test('public cache identities are isolated by requested and resolved term', () => {
	const t1 = buildPublicScheduleCacheKey(1, '2031-09-19', 'revision-42', 1);
	const t2 = buildPublicScheduleCacheKey(1, '2031-09-19', 'revision-42', 2);
	const active = buildPublicScheduleCacheKey(1, '2031-09-19', 'revision-42', 'active');
	assert.notEqual(t1, t2);
	assert.notEqual(t1, active);
	assert.match(buildPublishedScheduleCacheMarker({ runId: 315, publishedAt: null, termIndex: 2 }), /term-2/);
});

test('a public payload is accepted only when every tuple belongs to its selected term', () => {
	const term2 = {
		source: { termIndex: 2, termScope: 'explicit' as const },
		entries: [{ termIndex: 2 }, { termIndex: 2 }],
	};
	assert.equal(isExactPublishedTermPayload(term2), true);
	assert.equal(isExactPublishedTermPayload({ ...term2, entries: [{ termIndex: 1 }, { termIndex: 2 }] }), false);
	assert.equal(isExactPublishedTermPayload({ ...term2, source: { ...term2.source, termIndex: 0 } }), false);
});
