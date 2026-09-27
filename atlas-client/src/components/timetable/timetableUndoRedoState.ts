/**
 * TT-DYNAMIC-WORKSPACE-C04 (R4) — pure, testable state machine for the bounded
 * authoritative Redo contract.
 *
 * Redo is never a client-only replay: the server records the inverse edit on
 * Undo, and Redo re-dispatches the same `/manual-edits/revert` endpoint against
 * that new head with a fresh version CAS. The target is consumed before dispatch
 * so a stale CAS can never replay, and a target whose version is no longer
 * current is dropped without any dispatch.
 */

export type RedoState = {
	operationId: number;
	expectedVersion: number;
	label: string;
};

export function deriveRedoAfterRevert(
	result: { editId: number; newVersion: number },
	label: string,
): RedoState {
	return { operationId: result.editId, expectedVersion: result.newVersion, label };
}

export function isRedoVersionCurrent(state: RedoState | null, currentVersion: number | null): boolean {
	if (!state) return false;
	if (currentVersion == null) return false;
	return state.expectedVersion === currentVersion;
}

/**
 * Consume the redo target before dispatch. Returns `target: null` and a cleared
 * `next` when there is no eligible target (null state or stale version), so the
 * caller dispatches nothing.
 */
export function takeRedoForDispatch(
	state: RedoState | null,
	currentVersion: number | null,
): { target: RedoState | null; next: RedoState | null } {
	if (!isRedoVersionCurrent(state, currentVersion)) {
		return { target: null, next: null };
	}
	return { target: state, next: null };
}

export type RedoDispatchOutcome = {
	/** True only when the authoritative revert route was actually called. */
	dispatched: boolean;
	/** True when a redo existed but its CAS version was no longer current. */
	stale: boolean;
};

/**
 * R4 — dispatch the real redo route with a fresh CAS. A stale target performs
 * zero dispatch. The target is consumed (never retried) before the call.
 */
export async function dispatchRedo(
	state: RedoState | null,
	currentVersion: number | null,
	revert: (operationId: number, expectedVersion: number) => Promise<unknown>,
): Promise<RedoDispatchOutcome> {
	const { target } = takeRedoForDispatch(state, currentVersion);
	if (!target) {
		return { dispatched: false, stale: state != null };
	}
	await revert(target.operationId, target.expectedVersion);
	return { dispatched: true, stale: false };
}

/**
 * C11 — which ledger owns an Undo target. Pre-generation draft placements are
 * authored in the draft ledger (`lockedSessionAction`) and their commit returns
 * the draft-ledger action id as both `operationId` and `resultingVersion`.
 * Dispatching that id to the run manual-edits revert CASes against
 * `run.version` and always 409s (`UNDO_CONFLICT`), so the draft target must go
 * to the draft-ledger undo endpoint. Genuine run manual edits keep the run
 * manual-edits revert.
 */
export type UndoLedger = 'run' | 'draft';

export type UndoTarget = {
	ledger?: UndoLedger;
	editId: number;
	newVersion: number;
};

export type UndoDispatchHandlers = {
	revertRunEdit: (operationId: number, expectedVersion: number) => Promise<boolean>;
	revertDraftEdit: (operationId: number, expectedVersion: number) => Promise<boolean>;
};

/**
 * Route an Undo by the ledger that owns the operation. A target with no explicit
 * ledger predates C11 and is the only ledger that existed then: a run edit.
 */
export function dispatchUndoByLedger(target: UndoTarget, handlers: UndoDispatchHandlers): Promise<boolean> {
	if (target.ledger === 'draft') {
		return handlers.revertDraftEdit(target.editId, target.newVersion);
	}
	return handlers.revertRunEdit(target.editId, target.newVersion);
}

/* ─── A2-TIMETABLE-CUSTODY-R2 — the undo/redo truthfulness gate ────────────────
 *
 * A truthful Redo is a NEW server operation that re-applies the reverted edit's
 * `afterPayload`. Nothing in the contract does that, and the existing route
 * cannot be bent into one:
 *
 *   - `revertLastEdit` returns `editId: editRecord.id` (`manual-edit.service.ts:1914`),
 *     and `editRecord` is the REVERT row it just created (`:1857-1871`, `editType:
 *     'REVERT'` at `:1863`), so the id a revert hands back names a REVERT row.
 *   - that route selects its target with `editType: { not: 'REVERT' }` (`:1675`), so
 *     the row resolves to `null`;
 *   - `assertUndoHead` then compares a real `requestingActorId` against
 *     `operationActorId: null` (`timetable-undo-contract.ts:24`) and throws, and
 *     `:1690` throws `UNDO_CONFLICT` again regardless. A redo that re-dispatches the
 *     returned id is a GUARANTEED 409 on every successful revert.
 *   - and it is not fixable by choosing a different id: `assertUndoHead` requires
 *     the target to BE the head (`:22`), and after a revert the head IS the REVERT row.
 *
 * So the honest client contract is: arm a redo only when the ledger row the target
 * names is one the server can actually revert, and otherwise SAY THAT PLAINLY. The
 * accepted predecessor removed the misleading affordance from the history row for
 * exactly this reason (`TimetableAssignmentDialogs.tsx:24-32`).
 */

/** The edit type the server writes for every undo it records. */
export const REVERT_EDIT_TYPE = 'REVERT';

/**
 * Stated on a history row the ledger records as ALREADY UNDONE, in place of the
 * "Revert this edit" it can no longer honour.
 *
 * It is deliberately NOT `UNDO_CANNOT_BE_REDONE`. That sentence is about the undo row
 * itself ("this undo cannot be undone"); this one is about the row the undo names
 * ("this change has already been undone"). They are different facts about different
 * rows, and a scheduler reading the pair must be able to tell them apart — one sentence
 * for both would blur exactly the distinction the history exists to record.
 *
 * Every claim here is traceable: the row is named by an undo the ledger recorded, and
 * the server refuses to revert it — `assertUndoHead` requires the target to BE the head
 * (`timetable-undo-contract.ts:22`) and the `headEdit` query carries no `editType`
 * filter (`manual-edit.service.ts:1676`), so after any revert the head IS the undo row.
 */
export const ALREADY_UNDONE_EDIT_MESSAGE = 'This change has already been undone, so there is nothing left to revert here.';

/**
 * Read the id an undo row names, or `null` when it names none.
 *
 * `ManualEditRecord.id` is a `number` (`types.ts:1578`) and the value the server wrote
 * is a Prisma `Int`, which serialises as a JSON number — so the only safe comparison is
 * number to number, and a value of any other shape is NOT an identity.
 *
 * This is deliberately stricter than a `typeof === 'number'` probe, which admits `46.5`,
 * `NaN` and `Infinity`: an id that cannot be an `Int` is not an id. It is also
 * deliberately strict rather than loose, because a loose `==` would let the string
 * `"46"` mark a LIVE row undone and strip a control that still works — the worse
 * direction of the two errors, since the action being hidden is real and reachable.
 */
export function readRevertedEditId(validationSummary: unknown): number | null {
	if (validationSummary == null || typeof validationSummary !== 'object' || Array.isArray(validationSummary)) return null;
	const value = (validationSummary as Record<string, unknown>).revertedEditId;
	if (typeof value !== 'number' || !Number.isInteger(value)) return null;
	return value;
}

/** The ledger fields this derivation reads, narrowed so no caller may widen the contract. */
export type UndoLedgerRow = { id: number; editType: string; validationSummary: unknown };

/**
 * Whether the ledger records this edit as already undone — the client mirror of the
 * server's OWN refusal test, not an approximation of it.
 *
 * `revertLastEdit` refuses a target when a `REVERT` row in the same run already records
 * `revertedEditId === operationId` (`manual-edit.service.ts:1677-1679`, `priorRevert`
 * into `assertUndoHead({ alreadyReverted })`), and refuses again when the target is not
 * the head. The list the history dialog renders IS that run's complete ledger:
 * `listManualEdits` is a `findMany` with no `take` (`:1936-1939`) and returns
 * `validationSummary` verbatim (`:1948`), and both server paths that write an undo row
 * record the id they undid (`:1711` fixture, `:1866-1869` real). So the set this
 * predicate derives is the set the server refuses.
 *
 * Two deliberate limits:
 *
 *   - ORDER-INDEPENDENT. The claim is a fact about the ledger, not about row position,
 *     so it survives a re-order and never depends on the undo sorting above its target.
 *   - FALSE WHEN THE PROOF IS ABSENT. An undo row outside the fetched list, a summary
 *     that is not an object, or an id of the wrong shape all read as "not proven", and
 *     the control stays. Hiding a control that still works is the worse error.
 */
export function isEditUndoneInHistory(editId: number, editHistory: readonly UndoLedgerRow[]): boolean {
	if (typeof editId !== 'number' || !Number.isInteger(editId)) return false;
	return editHistory.some(
		(row) => row.editType === REVERT_EDIT_TYPE && readRevertedEditId(row.validationSummary) === editId,
	);
}

/**
 * The one place an undo/redo refusal is worded. Shared by the hook's BOTH
 * `UNDO_CONFLICT` mappers and by every surface that renders the state, so the
 * same 409 cannot reappear under a second label.
 *
 * It claims only what is true for EVERY cause `assertUndoHead` raises: the undo
 * does not apply, and it wrote nothing. It deliberately does NOT claim the version
 * moved, because three of the five causes move no version — most sharply the
 * traced redo case, where the target is unresolvable and the ledger is untouched.
 */
export const UNDO_CONFLICT_MESSAGE = 'This undo no longer applies: the latest change is a different one, or this change was already undone. Nothing was changed.';

/**
 * Stated after a successful revert. Same wording the accepted history-row fix uses
 * (`TimetableAssignmentDialogs.tsx:161`), so the two surfaces cannot drift.
 */
export const UNDO_CANNOT_BE_REDONE = 'This undo cannot be undone.';

/** Stated when the newest ledger row is itself an undo, so there is nothing to undo. */
export const UNDO_HEAD_IS_UNDO_MESSAGE = 'The last change to this schedule was itself an undo, so there is nothing left to undo.';

/**
 * Whether the server can revert a ledger row at all. `editType: { not: 'REVERT' }`
 * (`manual-edit.service.ts:1675`) is the whole rule; a `REVERT` row is invisible to
 * the target selection and can never be the operand.
 *
 * An unknown edit type is NOT treated as undoable: `fetchEditHistory` swallows a
 * failed read (`useTimetableMutations.ts:922-924`), so a missing row means the
 * client cannot prove the target is legal, and offering the action anyway is the
 * failure this gate exists to prevent.
 */
export function isUndoableEditType(editType: string | null | undefined): boolean {
	return typeof editType === 'string' && editType !== REVERT_EDIT_TYPE;
}

export type RedoAfterRevertAssessment =
	| { kind: 'performable'; target: RedoState }
	| { kind: 'not-performable'; reason: string };

/**
 * Decide whether the id a revert just returned is a redo the server can perform.
 *
 * `returnedRowEditType` is the `editType` the REFRESHED ledger records for that
 * id — read from the server's own history, not assumed. Two-sided on purpose: a
 * gate that only ever refuses would pass every refusal row while arming nothing
 * that works, which is the opposite defect.
 */
export function assessRedoAfterRevert(
	result: { editId: number; newVersion: number },
	label: string,
	returnedRowEditType: string | null | undefined,
): RedoAfterRevertAssessment {
	if (!isUndoableEditType(returnedRowEditType)) {
		return { kind: 'not-performable', reason: UNDO_CANNOT_BE_REDONE };
	}
	return { kind: 'performable', target: deriveRedoAfterRevert(result, label) };
}

export type HeaderUndoDecision =
	| { kind: 'dispatch'; operationId: number; expectedVersion: number }
	| { kind: 'blocked'; reason: 'head-is-undo' | 'no-edits' | 'no-draft' };

/**
 * Whether the header Undo may dispatch, and why not when it may not.
 *
 * The header Undo targets `editHistory[0]`, the newest ledger row. With a REVERT
 * at the head that id is unresolvable for the server (`manual-edit.service.ts:1675`)
 * and can only 409, so it is refused here — in the shared handler, which is the
 * one place all three header Undo surfaces (the `TimetableUndoRedoControl` button,
 * `ScheduleReviewWorkspaceHeader.tsx:668`, and `TimetableAdvancedHeaderHelp`) reach.
 * Each blocked reason is named so no surface can refuse silently.
 */
export function decideHeaderUndo(
	head: { id: number; editType: string } | null | undefined,
	runVersion: number | null,
): HeaderUndoDecision {
	if (head == null) return { kind: 'blocked', reason: 'no-edits' };
	if (runVersion == null) return { kind: 'blocked', reason: 'no-draft' };
	if (!isUndoableEditType(head.editType)) return { kind: 'blocked', reason: 'head-is-undo' };
	return { kind: 'dispatch', operationId: head.id, expectedVersion: runVersion };
}
