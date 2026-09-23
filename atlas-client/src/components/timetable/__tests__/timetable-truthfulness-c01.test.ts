/**
 * TIMETABLE-TRUTHFULNESS-C01 — D4 header source-line wording.
 *
 * The Simple header rendered "Using cached school year · 2031-2032" while the
 * resolved school-year context was fresh (`stale:false`), so the word "cached"
 * read as staleness for data that was current. The source line must name the
 * authority and the freshness state instead of the storage mechanism.
 *
 * Run: `npx tsx --test src/components/timetable/__tests__/timetable-truthfulness-c01.test.ts`
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { sourceLabel } from '../simple/SimpleHeaderHelpers';
import type { ScheduleReviewWorkspaceHeaderContext } from '../buildScheduleReviewWorkspaceContexts';

function context(schoolYearContext: unknown): ScheduleReviewWorkspaceHeaderContext {
	return { schoolYearContext } as unknown as ScheduleReviewWorkspaceHeaderContext;
}

test('D4 — a fresh school-year context never reads as a cache or as staleness', () => {
	const label = sourceLabel(context({
		source: 'cache',
		stale: false,
		activeSchoolYearLabel: '2031-2032',
		activeTerm: null,
	}));
	assert.doesNotMatch(label, /cached/i, 'the source line must not say "cached"');
	assert.doesNotMatch(label, /stale/i, 'the source line must not imply staleness');
	assert.match(label, /school year/i, 'the line still names what it is about');
	assert.match(label, /ATLAS/, 'the line names the authority the value came from');
	assert.match(label, /up to date/i, 'a fresh context states its freshness plainly');
});

test('D4 — an older saved school-year context says so plainly', () => {
	const label = sourceLabel(context({
		source: 'cache',
		stale: true,
		activeSchoolYearLabel: '2031-2032',
		activeTerm: null,
	}));
	assert.doesNotMatch(label, /cached/i);
	assert.match(label, /rechecking/i, 'a stale context is truthful that it is being rechecked');
});

test('D4 — verified and non-cache labels are unchanged', () => {
	assert.equal(sourceLabel(context({ source: 'enrollpro-verified', stale: false })), 'Verified with EnrollPro');
	assert.equal(sourceLabel(context({ source: 'enrollpro', stale: false })), 'Using EnrollPro settings');
	assert.equal(sourceLabel(context({ source: 'atlas-persisted', stale: false })), 'Using saved ATLAS data');
	assert.equal(sourceLabel(context(null)), 'Checking source');
});
