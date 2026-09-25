/**
 * TT-DYNAMIC-WORKSPACE-C04 (R3) — the exact swap-arming transition used by the
 * selected-class strip, the More menu, and the details sheet.
 *
 * Production wiring calls {@link createSwapArmHandler} once; it must arm the
 * two-class swap (`select-first`) exactly once, clear any stale Class A/B
 * selection, mark the swap task active, and set the operator status — not a
 * state-only no-op (finding A-05).
 */

export type SwapArmingState = {
	mode: 'select-first' | 'select-second' | null;
	entryIdA: string | null;
	entryIdB: string | null;
};

export function armSwapSessions(): SwapArmingState {
	return { mode: 'select-first', entryIdA: null, entryIdB: null };
}

export function applySwapArming(
	setMode: (mode: 'select-first' | 'select-second' | null) => void,
	setEntryIdA: (id: string | null) => void,
	setEntryIdB: (id: string | null) => void,
): SwapArmingState {
	const next = armSwapSessions();
	setMode(next.mode);
	setEntryIdA(next.entryIdA);
	setEntryIdB(next.entryIdB);
	return next;
}

export const SWAP_ARMED_MESSAGE = 'Swap armed. Choose the first class on the grid, then the second.';
/** LANE-C C03 — arming from a class the user already selected. */
export const SWAP_ARMED_FROM_SELECTION_MESSAGE = 'Now choose the class to swap times with.';

export type SwapArmDeps = {
	setTask: (task: 'swap-sessions') => void;
	setMode: (mode: 'select-first' | 'select-second' | null) => void;
	setEntryIdA: (id: string | null) => void;
	setEntryIdB: (id: string | null) => void;
	setStatus: (status: { tone: 'loading'; message: string }) => void;
	/**
	 * LANE-C C03 — the class already selected on the grid, if any. The
	 * 2026-09-25 audit found "Swap with another class" on a selected class
	 * asking the user to pick that same class again as the first class.
	 */
	getSelectedEntryId?: () => string | null | undefined;
	/** Clears the grid selection once it has become the first swap class. */
	clearSelection?: () => void;
};

export function createSwapArmHandler(deps: SwapArmDeps): () => SwapArmingState {
	return () => {
		deps.setTask('swap-sessions');
		const selectedEntryId = deps.getSelectedEntryId?.() ?? null;
		if (selectedEntryId) {
			const next: SwapArmingState = { mode: 'select-second', entryIdA: selectedEntryId, entryIdB: null };
			deps.setMode(next.mode);
			deps.setEntryIdA(next.entryIdA);
			deps.setEntryIdB(null);
			deps.clearSelection?.();
			deps.setStatus({ tone: 'loading', message: SWAP_ARMED_FROM_SELECTION_MESSAGE });
			return next;
		}
		const next = applySwapArming(deps.setMode, deps.setEntryIdA, deps.setEntryIdB);
		deps.setStatus({
			tone: 'loading',
			message: SWAP_ARMED_MESSAGE,
		});
		return next;
	};
}
