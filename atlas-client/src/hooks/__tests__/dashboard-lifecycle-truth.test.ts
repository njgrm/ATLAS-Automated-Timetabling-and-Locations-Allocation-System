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
	classifyDashboardLoadError,
	initialDashboardDomainState,
	resolveDashboardLoadFailure,
	resolveDashboardRequestScope,
	unavailableDomainAvailability,
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
	// DASH-RESILIENCE-C01: unknown is null, never a synthetic NONE.
	assert.equal(cleared.latestRunStatus, null);
	assert.equal(cleared.latestRunId, null);
	assert.equal(cleared.violationCount, null);
	assert.equal(cleared.assignedCount, null);
	assert.equal(cleared.unassignedCount, null);
	assert.equal(cleared.hardViolationCount, null);
	assert.equal(cleared.derivedDemand, null);
	assert.equal(cleared.activeSchoolYearId, null);
	assert.equal(cleared.activeSchoolYearLabel, null);
	assert.deepEqual(cleared.domainAvailability, unavailableDomainAvailability());
	assert.deepEqual(cleared.domainAvailability, {
		campus: false, subjects: false, faculty: false, sections: false, generation: false, derivedDemand: false,
	});
});

test('DASH-RESILIENCE-C01: load errors classify 401 as auth, 403 as scope, everything else as transient', () => {
	assert.equal(classifyDashboardLoadError(401), 'auth');
	assert.equal(classifyDashboardLoadError(403), 'scope');
	assert.equal(classifyDashboardLoadError(500), 'unavailable');
	assert.equal(classifyDashboardLoadError(0), 'unavailable');
	assert.equal(classifyDashboardLoadError(null), 'unavailable');
	assert.equal(classifyDashboardLoadError(undefined), 'unavailable');
});

test('DASH-RESILIENCE-C01: 401 clears data, dispatches nothing, and routes to the session-expired path', () => {
	const decision = resolveDashboardLoadFailure({ errorKind: 'auth', requestSchoolId: 5, lastSuccessSchoolId: 5 });
	assert.equal(decision.retainSnapshot, false);
	assert.equal(decision.resetDomainState, true);
	assert.equal(decision.blocked, true);
	assert.equal(decision.expireSession, true);
	assert.equal(decision.sourceState, 'no_saved_data');
	assert.match(decision.sourceMessage, /session expired|sign in/i);
});

test('DASH-RESILIENCE-C01: 403 is a scope rejection with no fallback school and no session expiry', () => {
	const decision = resolveDashboardLoadFailure({ errorKind: 'scope', requestSchoolId: 5, lastSuccessSchoolId: 5 });
	assert.equal(decision.retainSnapshot, false);
	assert.equal(decision.resetDomainState, true);
	assert.equal(decision.blocked, true);
	assert.equal(decision.expireSession, false);
	assert.match(decision.blockedMessage ?? '', /rejected this school request/i);
});

test('DASH-RESILIENCE-C01: a transient same-school refresh failure retains the last snapshot', () => {
	const decision = resolveDashboardLoadFailure({ errorKind: 'unavailable', requestSchoolId: 5, lastSuccessSchoolId: 5 });
	assert.equal(decision.retainSnapshot, true);
	assert.equal(decision.resetDomainState, false);
	assert.equal(decision.blocked, false);
	assert.equal(decision.expireSession, false);
	assert.equal(decision.sourceState, 'partial_degraded');
	assert.match(decision.sourceMessage, /saved data/i);
});

test('DASH-RESILIENCE-C01: a transient failure with no same-school snapshot clears to unavailable placeholders', () => {
	const firstLoad = resolveDashboardLoadFailure({ errorKind: 'unavailable', requestSchoolId: 5, lastSuccessSchoolId: null });
	assert.equal(firstLoad.retainSnapshot, false);
	assert.equal(firstLoad.resetDomainState, true);

	const otherSchool = resolveDashboardLoadFailure({ errorKind: 'unavailable', requestSchoolId: 6, lastSuccessSchoolId: 5 });
	assert.equal(otherSchool.retainSnapshot, false, 'snapshots never cross a school scope');
	assert.equal(otherSchool.resetDomainState, true);
});

test('missing EnrollPro year/terms => Year Setup repair (never publish, never retired page)', () => {
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
		derivedDemand: {
			available: true,
			ready: false,
			yearLabel: '2030-2031',
			revision: null,
			termStructure: null,
			blockers: [{ code: 'TERM_STRUCTURE_UNAVAILABLE', message: 'No verified ordered term structure is available for the active year.' }],
			subjectMetadataExceptions: [],
			totals: null,
			blockerCode: 'TERM_STRUCTURE_UNAVAILABLE',
			blockerMessage: 'No verified ordered term structure is available for the active year.',
			error: null,
		},
		degraded: false,
	});
	assert.equal(next.href, '/admin/year-setup');
	assert.doesNotMatch(next.href, /subjects\/requirements/);
});

test('subject metadata exception => Subjects repair naming the subject (never publish)', () => {
	const next = pickNextStep({
		phase: 'SETUP',
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		missingCoverageSubjectIds: [],
		buildingsDone: true,
		latestRunStatus: 'NONE',
		violationCount: null,
		derivedDemand: {
			available: true,
			ready: false,
			yearLabel: '2030-2031',
			revision: null,
			termStructure: { format: 'QUARTERS', terms: [{ identity: 'Q1', displayLabel: 'Quarter 1', order: 1 }] },
			blockers: [{ code: 'ROTATION_ORDER_MISSING', message: 'Rotation family TLE needs an explicit integer term order for TLE-7.', subjectId: 7, subjectCode: 'TLE-7', rotationFamily: 'TLE' }],
			subjectMetadataExceptions: [{ code: 'ROTATION_ORDER_MISSING', message: 'Rotation family TLE needs an explicit integer term order for TLE-7.', subjectId: 7, subjectCode: 'TLE-7', rotationFamily: 'TLE' }],
			totals: null,
			blockerCode: 'ROTATION_ORDER_MISSING',
			blockerMessage: 'Rotation family TLE needs an explicit integer term order for TLE-7.',
			error: null,
		},
		degraded: false,
	});
	assert.equal(next.href, '/subjects');
	assert.match(next.body, /TLE-7/);
	assert.doesNotMatch(next.body, /Curriculum Requirements/);
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
		derivedDemand: null,
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
		derivedDemand: null,
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
		derivedDemand: null,
		degraded: false,
	});
	assert.equal(next.href, '/audit?focus=timetable');
	assert.ok(next.warn);
});
