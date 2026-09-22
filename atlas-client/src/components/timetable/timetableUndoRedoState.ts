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
