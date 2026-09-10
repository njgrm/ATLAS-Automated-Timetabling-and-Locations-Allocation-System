import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	SourceRevisionStaleError,
	buildRevisionCreatePayload,
	isSourceRevisionStaleError,
	parseLatestRevisionToken,
} from '@/lib/published-revision-client';

const readContract = {
	revisions: [{ id: 700 }, { id: 701 }],
	count: 2,
	baseRevisionId: 700,
	latestRevisionId: 701,
};

test('read contract exposes the authoritative latest revision token', () => {
	assert.equal(parseLatestRevisionToken(readContract), 701);
});

test('a read contract without an exposed latest revision token is stale (never substitutes)', () => {
	for (const data of [
		undefined,
		null,
		{ revisions: [], count: 0 },
		{ revisions: [], count: 0, latestRevisionId: 0 },
		{ revisions: [], count: 0, latestRevisionId: -1 },
		{ revisions: [], count: 0, latestRevisionId: 701.5 },
		{ revisions: [], count: 0, latestRevisionId: '701' },
	]) {
		assert.throws(() => parseLatestRevisionToken(data as never), SourceRevisionStaleError, `reject missing/invalid token: ${JSON.stringify(data)}`);
	}
});

test('revision create payload binds the fetched latest revision token as sourceRevisionId', () => {
	const payload = buildRevisionCreatePayload({
		effectiveDate: '2030-01-03',
		reason: 'teacher reassignment',
		sourceRevisionId: 701,
		changes: [{ entryId: 'e-1', changeType: 'CHANGE_FACULTY', previous: { facultyId: 20 }, next: { facultyId: 21 } }],
		changeSummary: { changeCount: 1, entryIds: ['e-1'] },
		metadata: { source: 'TACTICAL_SANDBOX_DOCK' },
	});
	assert.equal(payload.sourceRevisionId, 701);
	assert.deepEqual(payload.changes[0].next, { facultyId: 21 });
	assert.equal(payload.changeSummary?.changeCount, 1);
});

test('SOURCE_REVISION_STALE is recognized from service and transport errors without silent retry', () => {
	assert.equal(isSourceRevisionStaleError({ code: 'SOURCE_REVISION_STALE' }), true);
	assert.equal(isSourceRevisionStaleError({ response: { data: { code: 'SOURCE_REVISION_STALE' } } }), true);
	assert.equal(isSourceRevisionStaleError(new Error('plain failure')), false);
	assert.equal(isSourceRevisionStaleError({ response: { data: { code: 'REVISION_PREVIOUS_VALUES_STALE' } } }), false);
	assert.equal(isSourceRevisionStaleError(null), false);
});