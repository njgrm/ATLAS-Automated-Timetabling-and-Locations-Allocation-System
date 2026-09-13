import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	deriveRedoAfterRevert,
	isRedoVersionCurrent,
	takeRedoForDispatch,
} from '../../components/timetable/timetableUndoRedoState';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

// --- R4 bounded authoritative Redo state machine ---

test('R4 a successful revert arms a redo target at the new run version', () => {
	const state = deriveRedoAfterRevert({ editId: 912, newVersion: 44 }, 'Reverted edit');
	assert.deepEqual(state, { operationId: 912, expectedVersion: 44, label: 'Reverted edit' });
	assert.equal(isRedoVersionCurrent(state, 44), true);
});

test('R4 a stale redo target dispatches nothing and is cleared', () => {
	const state = deriveRedoAfterRevert({ editId: 912, newVersion: 44 }, 'Reverted edit');
	// Another operator advanced the run after the undo.
	const { target, next } = takeRedoForDispatch(state, 45);
	assert.equal(target, null, 'stale redo must not dispatch');
	assert.equal(next, null, 'stale redo target must be cleared');
});

test('R4 a current redo target is consumed before dispatch', () => {
	const state = deriveRedoAfterRevert({ editId: 912, newVersion: 44 }, 'Reverted edit');
	const { target, next } = takeRedoForDispatch(state, 44);
	assert.deepEqual(target, state);
	assert.equal(next, null, 'target is consumed so a retry cannot replay it');
});

test('R4 no redo state dispatches nothing', () => {
	const { target } = takeRedoForDispatch(null, 44);
	assert.equal(target, null);
	assert.equal(isRedoVersionCurrent(null, 44), false);
});

// --- R4 production wiring ---

test('R4 the hook re-dispatches the same revert endpoint with a fresh CAS', () => {
	const hook = source('src/hooks/useTimetableMutations.ts');
	assert.match(hook, /runAuthoritativeRevert/);
	assert.match(hook, /\$\{apiBase\}\/revert/);
	assert.match(hook, /takeRedoForDispatch/);
	assert.match(hook, /deriveRedoAfterRevert/);
	// A failed CAS is a typed Version-stale state, never a client-only replay.
	assert.match(hook, /UNDO_CONFLICT/);
	assert.match(hook, /setRedoVersionStale\(true\)/);
});

test('R4 Advanced and Simple both render a visible Undo/Redo/History control', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const control = source('src/components/timetable/TimetableUndoRedoControl.tsx');
	assert.match(workspace, /TimetableUndoRedoControl/);
	assert.match(control, /data-testid="timetable-visible-undo"/);
	assert.match(control, /data-testid="timetable-visible-redo"/);
	assert.match(control, /data-testid="timetable-version-stale"/);
	assert.match(control, /data-testid="timetable-visible-history"/);
});

test('R4 history shows actor/time/type/counts with a per-row revert affordance', () => {	const dialogs = source('src/components/timetable/modals/TimetableAssignmentDialogs.tsx');
	assert.match(dialogs, /edit\.actorId/);
	assert.match(dialogs, /edit\.editType/);
	assert.match(dialogs, /new Date\(edit\.createdAt\)/);
	assert.match(dialogs, /hardCount/);
	assert.match(dialogs, /timetable-edit-history-revert/);
	// Only the head edit can be reverted; the server CAS rejects older ones.
	assert.match(dialogs, /Only the latest edit can be reverted/);
});

test('R4 pre-generation placement undo arms the same operation-bound route', () => {
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	// The pre-gen placement commit captures the operation id + resulting version.
	assert.match(state, /wrappedCommitPreGenPending/);
	assert.match(state, /setLastAutoSaveUndo\(\{/);
	assert.match(state, /editId: result\.operationId/);
	assert.match(state, /newVersion: result\.resultingVersion/);
	// The shared strip reverts that exact operation with its CAS version.
	assert.match(workspace, /revertEditById\(state\.lastAutoSaveUndo!\.editId, state\.lastAutoSaveUndo!\.newVersion\)/);
});
