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
