/**
 * EVAL-C01 — Dashboard client decision-path negative controls (hermetic).
 *
 * Exercises the REAL client decision functions (no mocks, no network):
 * actor-scope gating, cleared domain state on actor change, the single
 * next-action decision, and the degraded/publication rules.
 *
 * Run: `npx tsx --test src/hooks/__tests__/dashboard-lifecycle-truth.test.ts`
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
	initialDashboardDomainState,
	resolveDashboardRequestScope,
} from '../useDashboardData';
import { pickNextStep } from '../../pages/Dashboard';

test('unresolved actor school => scope not ready (zero domain requests)', () => {
	for (const actor of [null, undefined, 0, -1, 1.5, Number.NaN]) {
		const scope = resolveDashboardRequestScope(actor);
		assert.equal(scope.ready, false, `actor ${String(actor)} must not dispatch`);
		if (!scope.ready) assert.equal(scope.schoolId, null);
	}
});

test('resolved actor school binds requests to that exact school', () => {
	const one = resolveDashboardRequestScope(1);
	assert.equal(one.ready, true);
	if (one.ready) assert.equal(one.schoolId, 1);

	const two = resolveDashboardRequestScope(2);
	assert.equal(two.ready, true);
	if (two.ready) assert.equal(two.schoolId, 2);
});

test('cleared domain state carries no stale run, publication, or year identity', () => {
	const cleared = initialDashboardDomainState();
	assert.deepEqual(cleared.buildings, []);
	assert.equal(cleared.campusImageUrl, null);
	assert.equal(cleared.subjectCount, null);
	assert.equal(cleared.facultyCount, null);
	assert.equal(cleared.sectionCount, null);
	assert.equal(cleared.unassignedSubjectCount, null);
	assert.equal(cleared.missingCoverageSubjectIds, null);
	assert.equal(cleared.latestRunStatus, 'NONE');
	assert.equal(cleared.latestRunId, null);
	assert.equal(cleared.violationCount, null);
	assert.equal(cleared.assignedCount, null);
	assert.equal(cleared.unassignedCount, null);
	assert.equal(cleared.hardViolationCount, null);
	assert.equal(cleared.curriculum, null);
	assert.equal(cleared.activeSchoolYearId, null);
	assert.equal(cleared.activeSchoolYearLabel, null);
});

test('missing Curriculum Requirements => setup repair action (never publish)', () => {
	const next = pickNextStep({
		phase: 'SETUP',
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 1,
		missingCoverageSubjectIds: null,
		buildingsDone: true,
		latestRunStatus: 'NONE',
		violationCount: null,
		curriculumMissing: true,
		degraded: false,
	});
	assert.equal(next.href, '/subjects/requirements');
	assert.match(next.title, /Curriculum Requirements/);
});

test('degraded snapshot => recheck action (never publish)', () => {
	const next = pickNextStep({
		phase: 'REVIEW',
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		missingCoverageSubjectIds: [],
		buildingsDone: true,
		latestRunStatus: 'COMPLETED',
		violationCount: 0,
		curriculumMissing: false,
		degraded: true,
	});
	assert.doesNotMatch(next.title, /published/i);
	assert.ok(next.warn);
});

test('published phase => single published next action', () => {
	const next = pickNextStep({
		phase: 'PUBLISHED',
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		missingCoverageSubjectIds: [],
		buildingsDone: true,
		latestRunStatus: 'COMPLETED',
		violationCount: 0,
		curriculumMissing: false,
		degraded: false,
	});
	assert.equal(next.title, 'Schedule is published');
	assert.equal(next.href, '/schedules');
});

test('review with violations => audit action with blocker count', () => {
	const next = pickNextStep({
		phase: 'REVIEW',
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		missingCoverageSubjectIds: [],
		buildingsDone: true,
		latestRunStatus: 'COMPLETED',
		violationCount: 3,
		curriculumMissing: false,
		degraded: false,
	});
	assert.equal(next.href, '/audit?focus=timetable');
	assert.ok(next.warn);
});
