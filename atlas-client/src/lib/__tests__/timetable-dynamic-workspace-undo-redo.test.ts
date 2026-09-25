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
	assert.match(hook, /dispatchRedo/);
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

/*
 * ADDITIVE CORRECTION (LANE-C C1, 2026-09-26) — the row above is RETAINED
 * UNCHANGED per AGENTS.md §16 (never delete an assertion to close a finding);
 * it is marked SUPERSEDED IN PART, not deleted.
 *
 * Why: the test NAME claims "Advanced and Simple both render a visible
 * Undo/Redo/History control", but its only workspace assertion is
 * `assert.match(workspace, /TimetableUndoRedoControl/)` — a source-string
 * presence check. In `ScheduleReviewWorkspace.tsx` the control is rendered
 * INSIDE the `layoutMode === 'advanced'` branch (the ternary that ends around
 * line 610), and `layoutMode` defaults to `'simple'` unless localStorage holds
 * `'advanced'` (lines 74-77). Simple therefore never renders it. A test whose
 * name claims more than it asserts is itself the defect.
 *
 * Audit finding: `docs/reviews/timetable-ux-audit-20260926/audit.md` finding 10
 * (test integrity) and its "Systemic" section — the dominant pattern in this
 * area is source-text assertion, which cannot detect an unmounted component.
 *
 * Owed by: the successor cycle that owns the Simple Undo/Redo surface. Until
 * that control is mounted for Simple (or the accepted contract is formally
 * narrowed to Advanced), this row is the honest statement of what renders.
 * Simple's post-save Undo is a DIFFERENT surface and is already covered by the
 * `B1: the rendered preview offers exactly one Confirm…` row in
 * `timetable-relaxed-main-b02.test.tsx` (`timetable-auto-save-undo`).
 */
test('R4 replacement: the visible Undo/Redo/History control is mounted for Advanced only, not Simple', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');

	// The default layout is Simple, so a control rendered only under the
	// advanced branch is unreachable for the persona this lane serves.
	assert.match(
		workspace,
		/atlas_timetable_layout_mode'\)\s*===\s*'advanced'\s*\?\s*'advanced'\s*:\s*'simple'/,
		'Simple is the default layout mode',
	);

	// Locate the single TimetableUndoRedoControl mount and the advanced guard
	// that encloses it, so this row fails if the branch ever changes.
	const mount = workspace.indexOf('<TimetableUndoRedoControl');
	assert.ok(mount >= 0, 'the control is mounted in the workspace');
	const branchStart = workspace.lastIndexOf("layoutMode === 'advanced'", mount);
	assert.ok(branchStart >= 0 && branchStart < mount, 'the mount is inside the advanced-layout branch');
	// The ternary that owns the branch closes before the workspace body, so no
	// Simple-path element between the branch and the mount can be the guard.
	assert.doesNotMatch(
		workspace.slice(branchStart, mount),
		/^\s*\)\s*:\s*null\s*\)\}/m,
		'the control is not behind a Simple fallback that could also render it',
	);

	// The honest, layout-mode-parameterised statement: which modes render it.
	const rendersIn = (mode: 'advanced' | 'simple') => mode === 'advanced';
	assert.equal(rendersIn('advanced'), true, 'Advanced renders the visible Undo/Redo/History control');
	assert.equal(
		rendersIn('simple'),
		false,
		'Simple does NOT render the visible Undo/Redo/History control; the control is advanced-only today',
	);
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
	// The shared strip reverts that exact operation with its CAS version, routed to
	// the ledger that owns it: C11 sends a pre-generation draft placement to the
	// draft-ledger revert and keeps genuine run manual edits on the run revert.
	assert.match(workspace, /const target = state\.lastAutoSaveUndo!;/);
	assert.match(workspace, /dispatchUndoByLedger\(target,/);
	assert.match(workspace, /revertDraftEdit: state\.revertDraftEditById/);
	assert.match(workspace, /revertRunEdit: state\.revertEditById/);
});
