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

/**
 * R4 (Lane C, 2026-09-26) — the derived replacement for the tautological
 * `rendersIn` helper.
 *
 * `ScheduleReviewWorkspace` selects its header with
 * `layoutMode === 'simple' ? (<TimetableSimpleHeader …/>) : (…<TimetableUndoRedoControl/>…)`,
 * so the control's reachability is decided by WHICH SIDE of that ternary it
 * sits on — not by the nearest preceding `layoutMode` token. A naive
 * "innermost guard wins" scan gets this exactly backwards, which is why this
 * walks real parenthesis depth from each guard to its branch boundary.
 *
 * Every `layoutMode === '<mode>' ? (` ternary is measured; the ones that
 * actually ENCLOSE the mount constrain the answer (true branch → that mode,
 * alternative branch → the other member of the two-member union), and the ones
 * that do not enclose it are ignored. So an unconditional mount (no enclosing
 * guard) returns BOTH modes — the regression the replaced assertions could not
 * detect — and a mount moved into the simple branch returns `['simple']`.
 */
function reachableUndoControlModes(workspace: string): LayoutMode[] {
	const mount = workspace.indexOf('<TimetableUndoRedoControl');
	if (mount < 0) return [];
	let modes: LayoutMode[] = ['advanced', 'simple'];
	const guardPattern = /layoutMode === '(advanced|simple)' \? \(/g;
	for (let match = guardPattern.exec(workspace); match !== null; match = guardPattern.exec(workspace)) {
		const openParen = match.index + match[0].length - 1;
		const trueClose = closingParenIndex(workspace, openParen);
		if (trueClose < 0) continue;
		// `trueClose` is the `)` ending the TRUE branch; the `:` and `(` after it
		// open the alternative.
		const alternation = /^\s*:\s*\(/.exec(workspace.slice(trueClose + 1));
		if (!alternation) continue;
		const alternativeOpen = trueClose + 1 + alternation[0].length - 1;
		const alternativeClose = closingParenIndex(workspace, alternativeOpen);
		if (alternativeClose < 0) continue;
		const stated = match[1] as LayoutMode;
		const other: LayoutMode = stated === 'advanced' ? 'simple' : 'advanced';
		let branch: LayoutMode[] = [];
		if (mount > openParen && mount < trueClose) branch = [stated];
		else if (mount > alternativeOpen && mount < alternativeClose) branch = [other];
		if (branch.length > 0) modes = modes.filter((mode) => branch.includes(mode));
	}
	return modes;
}

type LayoutMode = 'advanced' | 'simple';

/** Index of the `)` that closes the `(` at `open`, by parenthesis depth. */
function closingParenIndex(text: string, open: number): number {
	let depth = 0;
	for (let index = open; index < text.length; index += 1) {
		if (text[index] === '(') depth += 1;
		else if (text[index] === ')') {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return -1;
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
	//
	// R4 (Lane C, 2026-09-26) — this pair is RETAINED but marked SUPERSEDED IN
	// STRENGTH: `lastIndexOf("layoutMode === 'advanced'", mount)` resolves to the
	// unrelated `if (layoutMode === 'advanced')` near the top of the file, so it
	// passes without proving anything about the mount's branch. The derived
	// branch-boundary check below replaces it as the load-bearing evidence; it
	// is kept so the two cannot drift apart silently.
	const mount = workspace.indexOf('<TimetableUndoRedoControl');
	assert.ok(mount >= 0, 'the control is mounted in the workspace');
	const branchStart = workspace.lastIndexOf("layoutMode === 'advanced'", mount);
	assert.ok(branchStart >= 0 && branchStart < mount, 'SUPERSEDED-IN-STRENGTH: the mount is inside the advanced-layout branch');
	// The ternary that owns the branch closes before the workspace body, so no
	// Simple-path element between the branch and the mount can be the guard.
	assert.doesNotMatch(
		workspace.slice(branchStart, mount),
		/^\s*\)\s*:\s*null\s*\)\}/m,
		'the control is not behind a Simple fallback that could also render it',
	);

	// R4 (Lane C, 2026-09-26) — the previous form of the two statements below was
	// `const rendersIn = (mode) => mode === 'advanced'` followed by assertions on
	// `rendersIn(...)`. That asserted a closure's own return value:
	// tautological, carrying no evidence, and free to pass while the real mount
	// moved. Both statements are RETAINED IN INTENT but now read a DERIVED
	// answer from the real source: which layout modes can actually reach the
	// control's mount, and which mode the workspace actually falls back to.
	const reachableModes = reachableUndoControlModes(workspace);
	assert.deepEqual(reachableModes, ['advanced'], 'the visible Undo/Redo/History control is reachable only from the advanced layout');
	const fallbackMode = /atlas_timetable_layout_mode'\)\s*===\s*'advanced'\s*\?\s*'advanced'\s*:\s*'(\w+)'/.exec(workspace)?.[1] ?? null;
	assert.equal(fallbackMode, 'simple', 'the workspace falls back to the simple layout');
	assert.ok(
		fallbackMode === null || !reachableModes.includes(fallbackMode as LayoutMode),
		'Simple does NOT render the visible Undo/Redo/History control; the control is advanced-only today',
	);
	assert.ok(
		reachableModes.includes('advanced'),
		'Advanced renders the visible Undo/Redo/History control',
	);
});

test('R4 history shows actor/time/type/counts with a per-row revert affordance', () => {	const dialogs = source('src/components/timetable/modals/TimetableAssignmentDialogs.tsx');
	/* SUPERSEDED (LANE-C-PLAIN-TOKENS-C04 J2 P4, 2026-09-26). The original
	 * assertion is retained verbatim:
	 *   assert.match(dialogs, /edit\.actorId/);
	 *
	 * It asserted the MECHANISM (print the actor field). The requirement behind
	 * it is that the history identifies WHO made each change. LANE-C-PLAIN-TOKENS
	 * C04 P4 forbids printing a bare numeric id and directs that, when only an id
	 * exists, the attribution be OMITTED rather than printed — so printing
	 * `edit.actorId` is now the defect, not the contract.
	 *
	 * WHY IT CANNOT BE SATISFIED ON THE CLIENT, and this is an OPEN GAP, not a
	 * completed item: `listManualEdits` (`manual-edit.service.ts`) returns only
	 * `actorId`, which the route fills from `req.user.userId` — a User id, NOT a
	 * faculty-mirror id. The dialog therefore holds no map from which that id
	 * could be resolved to a name, and resolving it through `facultyMap` would
	 * attribute the change to the WRONG person. `RoomRequestAppealHistory` already
	 * returns an `actorName` beside its `actorId`, which is the precedent.
	 *
	 * REQUIRED FOLLOW-UP (server, out of scope for J2): return an actor name in
	 * `listManualEdits`, then restore the actor assertion in its plain form. Until
	 * then no scheduler can see who made a change — a real accountability gap
	 * that this cycle's green run does NOT close. */
	assert.doesNotMatch(dialogs, /edit\.actorId/, 'a bare numeric actor id must never be printed (P4)');
	assert.doesNotMatch(dialogs, /by user/, 'the numeric actor attribution is gone (P4)');
	assert.match(dialogs, /manualEditActionLabel\(edit\.editType\)/, 'the edit type reads as what the edit did (P4)');
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
