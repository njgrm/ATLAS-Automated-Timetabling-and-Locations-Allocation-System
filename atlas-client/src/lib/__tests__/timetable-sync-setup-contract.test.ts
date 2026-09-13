/**
 * TT-SYNC-TERM-C03R4 — client contract for the mounted "Sync timetable setup"
 * action. Proves the exact request body (`{ expectedRunVersion: draft.version }`),
 * typed error surfacing, the duplicate-click single-flight guard, and the
 * refresh-only-on-commit/replay rule, each through the exported module the
 * component actually imports.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	buildSyncSetupBody,
	buildSyncSetupPath,
	classifySyncSetupError,
	createSyncSetupInFlightGuard,
	runSyncSetup,
} from '@/lib/timetable-sync-setup';

const BASE = { schoolId: 2, schoolYearId: 9, runId: 42 };

test('the request body binds the reviewed draft version exactly', () => {
	assert.deepEqual(buildSyncSetupBody(7), { expectedRunVersion: 7 });
	for (const invalid of [undefined, null, 0, -1, 1.5, '3', true, Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.throws(() => buildSyncSetupBody(invalid as never), /reviewable version/, `rejects ${String(invalid)}`);
	}
});

test('the path is the mounted sync-setup route', () => {
	assert.equal(buildSyncSetupPath(2, 9, 42), '/generation/2/9/runs/42/sync-setup');
});

test('typed server errors surface without silent retry or version substitution', () => {
	const cases: Array<[unknown, string, string]> = [
		[{ response: { data: { code: 'RUN_VERSION_STALE', message: 'stale run' } } }, 'RUN_VERSION_STALE', 'STALE'],
		[{ response: { data: { code: 'DERIVED_DEMAND_BLOCKED', message: 'blocked demand' } } }, 'DERIVED_DEMAND_BLOCKED', 'AUTHORITY'],
		[{ response: { data: { code: 'SOURCE_AUTHORITY_STALE', message: 'stale authority' } } }, 'SOURCE_AUTHORITY_STALE', 'AUTHORITY'],
		[{ response: { data: { code: 'CROSS_SCHOOL_DENIED', message: 'cross school' } } }, 'CROSS_SCHOOL_DENIED', 'FORBIDDEN'],
		[{ response: { data: { code: 'INVALID_TERM_IDENTITY', message: 'bad term' } } }, 'INVALID_TERM_IDENTITY', 'AUTHORITY'],
		[{ code: 'RUN_VERSION_STALE', message: 'service stale' }, 'RUN_VERSION_STALE', 'STALE'],
	];
	for (const [error, code, kind] of cases) {
		const classification = classifySyncSetupError(error);
		assert.equal(classification.code, code);
		assert.equal(classification.kind, kind);
	}
	assert.equal(classifySyncSetupError(new Error('plain failure')).kind, 'UNKNOWN');
	assert.equal(classifySyncSetupError(null).kind, 'UNKNOWN');
});

test('runSyncSetup posts the exact body and refreshes only on commit or verified replay', async () => {
	const guard = createSyncSetupInFlightGuard();
	let observed: { path: string; body: unknown } | null = null;

	const committed = await runSyncSetup({
		...BASE,
		draftVersion: 7,
		guard,
		post: async (path, body) => {
			observed = { path, body };
			return { data: { runId: 42, version: 8, replayed: false } };
		},
	});
	assert.deepEqual(observed, { path: '/generation/2/9/runs/42/sync-setup', body: { expectedRunVersion: 7 } });
	assert.equal(committed.status, 'COMMITTED');
	assert.equal(committed.refresh, true);
	assert.equal(guard.isInFlight(), false, 'the guard is released after a commit');

	const replayed = await runSyncSetup({
		...BASE,
		draftVersion: 8,
		guard,
		post: async () => ({ data: { runId: 42, version: 8, replayed: true, noChange: true } }),
	});
	assert.equal(replayed.status, 'REPLAYED');
	assert.equal(replayed.refresh, true, 'a verified replay still refreshes the run');

	const failed = await runSyncSetup({
		...BASE,
		draftVersion: 8,
		guard,
		post: async () => { throw { response: { data: { code: 'RUN_VERSION_STALE', message: 'stale run' } } }; },
	});
	assert.equal(failed.status, 'FAILED');
	assert.equal(failed.refresh, false, 'a failure never refreshes');
	if (failed.status === 'FAILED') {
		assert.equal(failed.error.code, 'RUN_VERSION_STALE');
	}
	assert.equal(guard.isInFlight(), false, 'the guard is released after a failure');
});

test('duplicate concurrent clicks are single-flight', async () => {
	const guard = createSyncSetupInFlightGuard();
	let releaseFirst: (value: unknown) => void = () => {};
	const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
	let postCalls = 0;
	const post = async () => {
		postCalls += 1;
		await firstGate;
		return { data: { runId: 42, version: 2, replayed: false } };
	};

	const first = runSyncSetup({ ...BASE, draftVersion: 1, guard, post });
	const second = await runSyncSetup({ ...BASE, draftVersion: 1, guard, post });
	assert.equal(second.status, 'SKIPPED_IN_FLIGHT');
	assert.equal(second.refresh, false);

	releaseFirst(null);
	assert.equal((await first).status, 'COMMITTED');
	assert.equal(postCalls, 1, 'the second click never dispatched a request');

	const third = await runSyncSetup({ ...BASE, draftVersion: 2, guard, post: async () => ({ data: { runId: 42, version: 3 } }) });
	assert.equal(third.status, 'COMMITTED', 'the guard releases after the in-flight request settles');
});

test('a missing draft version fails before any request or guard acquisition', async () => {
	const guard = createSyncSetupInFlightGuard();
	const outcome = await runSyncSetup({
		...BASE,
		draftVersion: undefined,
		guard,
		post: async () => { throw new Error('must not dispatch'); },
	});
	assert.equal(outcome.status, 'FAILED');
	assert.equal(outcome.refresh, false);
	if (outcome.status === 'FAILED') {
		assert.equal(outcome.error.code, 'DRAFT_VERSION_UNAVAILABLE');
	}
	assert.equal(guard.isInFlight(), false);
});
