import assert from 'node:assert/strict';
import test from 'node:test';

import { createSwapArmHandler } from '../../components/timetable/timetableSwapArming';
import { deriveRedoAfterRevert, dispatchRedo } from '../../components/timetable/timetableUndoRedoState';
import {
	buildScopeKey,
	clearScopeState,
	shouldClearForScopeChange,
} from '../../components/timetable/timetableScopeHygiene';
import { deriveTimetableCapabilities, type TimetableCapabilityInput } from '../timetable-capabilities';

// --- R3 swap arming is a real state transition, not a no-op ---

test('R3 arming the swap dispatches each setter exactly once with select-first', () => {
	const calls: string[] = [];
	const handler = createSwapArmHandler({
		setTask: (task) => calls.push(`task:${task}`),
		setMode: (mode) => calls.push(`mode:${mode}`),
		setEntryIdA: (id) => calls.push(`a:${id}`),
		setEntryIdB: (id) => calls.push(`b:${id}`),
		setStatus: (status) => calls.push(`status:${status.tone}`),
	});

	const result = handler();

	assert.deepEqual(result, { mode: 'select-first', entryIdA: null, entryIdB: null });
	assert.deepEqual(calls, ['task:swap-sessions', 'mode:select-first', 'a:null', 'b:null', 'status:loading']);
	// Exactly once per setter — no duplicate dispatch, and the mode is actually armed.
	assert.equal(calls.filter((call) => call.startsWith('mode:')).length, 1);
	assert.equal(calls.filter((call) => call.startsWith('task:')).length, 1);
});

// --- R4 authoritative redo route dispatch ---

test('R4 a fresh redo dispatches the same revert route once with its CAS', async () => {
	const dispatches: Array<[number, number]> = [];
	const state = deriveRedoAfterRevert({ editId: 912, newVersion: 44 }, 'Reverted edit');

	const outcome = await dispatchRedo(state, 44, async (operationId, expectedVersion) => {
		dispatches.push([operationId, expectedVersion]);
	});

	assert.deepEqual(dispatches, [[912, 44]]);
	assert.equal(outcome.dispatched, true);
	assert.equal(outcome.stale, false);
});

test('R4 a stale redo dispatches zero requests and reports Version-stale', async () => {
	const dispatches: unknown[] = [];
	const state = deriveRedoAfterRevert({ editId: 912, newVersion: 44 }, 'Reverted edit');

	// Another operator advanced the run after the undo.
	const outcome = await dispatchRedo(state, 45, async () => {
		dispatches.push('called');
	});

	assert.equal(dispatches.length, 0, 'a stale redo must not dispatch any request');
	assert.equal(outcome.dispatched, false);
	assert.equal(outcome.stale, true);
});

test('R4 a missing redo dispatches nothing and is not stale', async () => {
	let called = false;
	const outcome = await dispatchRedo(null, 44, async () => { called = true; });
	assert.equal(called, false);
	assert.equal(outcome.dispatched, false);
	assert.equal(outcome.stale, false);
});

// --- R5 scope change clears before any dispatch ---

const SCOPE = { schoolId: 1, schoolYearId: 9, runId: 42, termFilter: 'all' as const };

test('R5 a changed scope clears every bound local state before dispatch', () => {
	const cleared: string[] = [];
	let dispatched = 0;
	// A scope-bound request captured before the change. Production drops it by
	// clearing the state it reads before any dispatch can run.
	let captured: (() => void) | null = () => { dispatched++; };
	const previous = buildScopeKey(SCOPE);
	const next = buildScopeKey({ ...SCOPE, termFilter: 1 });

	if (shouldClearForScopeChange(previous, next)) {
		clearScopeState([
			() => { cleared.push('task'); captured = null; },
			() => cleared.push('repair'),
			() => cleared.push('readiness'),
			() => cleared.push('departure'),
			() => cleared.push('details'),
			() => cleared.push('swap'),
			() => cleared.push('undo'),
		]);
	}
	captured?.();

	assert.equal(dispatched, 0, 'the cleared scope must not dispatch the captured stale request');
	assert.deepEqual(cleared, ['task', 'repair', 'readiness', 'departure', 'details', 'swap', 'undo']);
});

test('R5 an unchanged scope performs no clear, so the scoped request still dispatches', () => {
	const cleared: string[] = [];
	let dispatched = 0;
	const captured = () => { dispatched++; };
	const key = buildScopeKey(SCOPE);

	if (shouldClearForScopeChange(key, key)) {
		clearScopeState([() => cleared.push('task')]);
	} else {
		captured();
	}

	assert.equal(cleared.length, 0, 'an unchanged scope must not clear');
	assert.equal(dispatched, 1, 'the scoped request is not cancelled when the scope is unchanged');
});

test('R5 an unchanged scope does not clear', () => {
	const key = buildScopeKey(SCOPE);
	assert.equal(shouldClearForScopeChange(key, key), false);
});

test('R5 the initial mount does not clear', () => {
	assert.equal(shouldClearForScopeChange(null, buildScopeKey(SCOPE)), false);
});

test('R5 each scope dimension produces a distinct key', () => {
	const base = buildScopeKey(SCOPE);
	assert.notEqual(base, buildScopeKey({ ...SCOPE, schoolId: 2 }));
	assert.notEqual(base, buildScopeKey({ ...SCOPE, schoolYearId: 10 }));
	assert.notEqual(base, buildScopeKey({ ...SCOPE, runId: 43 }));
	assert.notEqual(base, buildScopeKey({ ...SCOPE, termFilter: 2 }));
});

// --- R7 every gate derives from the shared capability model ---

function caps(overrides: Partial<TimetableCapabilityInput> = {}) {
	return deriveTimetableCapabilities({
		scopeResolved: true,
		curriculumState: 'ready',
		generating: false,
		isPreGeneration: false,
		hasGeneratedRun: true,
		isPublished: false,
		latestRunFailed: false,
		hardCount: 0,
		unassignedCount: 0,
		softCount: 0,
		hasSelectedEntry: false,
		requestPendingCount: 0,
		...overrides,
	});
}

test('R7 publication is denied by the shared gate when blockers or unassigned remain', () => {
	assert.equal(caps({ hardCount: 1 }).gates.publication.enabled, false);
	assert.equal(caps({ unassignedCount: 2 }).gates.publication.enabled, false);
	assert.equal(caps({ isPublished: true }).gates.publication.enabled, false);
	assert.equal(caps().gates.publication.enabled, true);
});

test('R7 run-only actions are denied until a run exists', () => {
	const noRun = caps({ hasGeneratedRun: false });
	assert.equal(noRun.gates.swap.enabled, false);
	assert.equal(noRun.gates.roomRequests.enabled, false);
	assert.equal(noRun.gates.issueReview.enabled, false);
	assert.equal(noRun.gates.ownerRepair.enabled, false);

	const withRun = caps();
	assert.equal(withRun.gates.swap.enabled, true);
	assert.equal(withRun.gates.roomRequests.enabled, true);
	assert.equal(withRun.gates.issueReview.enabled, true);
	assert.equal(withRun.gates.ownerRepair.enabled, true);
});

test('R7 move/change-room gates require a selected entry', () => {
	assert.equal(caps({ hasSelectedEntry: false }).gates.move.enabled, false);
	assert.equal(caps({ hasSelectedEntry: true }).gates.move.enabled, true);
	assert.equal(caps({ hasSelectedEntry: true }).gates.changeRoom.enabled, true);
});
