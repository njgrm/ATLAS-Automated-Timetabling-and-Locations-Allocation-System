import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { capturePublishedReturnState } from '../../../lib/timetable-published-return';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../../', path), 'utf8');

test('C05 direct Draft route preserves the prior published run, term, view, and entity for return', () => {
	const published = { runId: '317', termFilter: 2 as const, viewMode: 'faculty' as const, entityFilter: '12' };
	const captured = capturePublishedReturnState(null, { centerView: 'schedule', isPublished: true, ...published });
	assert.deepEqual(captured, published);
	assert.deepEqual(capturePublishedReturnState(captured, { centerView: 'pre-generation', isPublished: true, ...published }), published,
		'direct route entry retains the state-only snapshot while the published schedule is hidden');
	assert.match(source('hooks/useScheduleReviewWorkspaceState.ts'), /capturePublishedReturnState/,
		'the workspace captures published context independently of the Draft button callback');
});
