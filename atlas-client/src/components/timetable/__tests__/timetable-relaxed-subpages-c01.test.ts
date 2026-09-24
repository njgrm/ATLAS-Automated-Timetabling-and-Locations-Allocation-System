import assert from 'node:assert/strict';
import test from 'node:test';

import { isTimetableSchedulerView } from '../TimetableRouteViewSync';

test('TIMETABLE-RELAXED-SUBPAGES-C01: only schedule and pre-generation retain scheduler chrome', () => {
	assert.equal(isTimetableSchedulerView('schedule'), true);
	assert.equal(isTimetableSchedulerView('pre-generation'), true);

	for (const view of ['policy', 'map', 'manual-edit', 'building', 'runs', 'setup']) {
		assert.equal(isTimetableSchedulerView(view), false, `${view} must use its own relaxed sub-page shell`);
	}
});

test('TIMETABLE-RELAXED-SUBPAGES-C01: workspace gates full scheduler header and selection strip', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const workspace = readFileSync(resolve(import.meta.dirname, '..', 'ScheduleReviewWorkspace.tsx'), 'utf8');

	assert.match(workspace, /isTimetableSchedulerView\(state\.headerContext\.centerView\)/);
	assert.match(workspace, /showSchedulerChrome && state\.selectedEntry && layoutMode === 'simple'/);
	assert.match(workspace, /showSchedulerChrome \? \(layoutMode === 'simple' \?/);

	const center = readFileSync(resolve(import.meta.dirname, '..', 'CenterWorkspace.tsx'), 'utf8');
	for (const view of ['policy', 'runs', 'setup']) {
		assert.match(center, new RegExp(`centerView === '${view}'`), `${view} must have an explicit non-grid branch`);
	}
	assert.match(center, /<TimetableGrid/);
});
