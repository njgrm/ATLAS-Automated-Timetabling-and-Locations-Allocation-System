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

export type SwapArmDeps = {
	setTask: (task: 'swap-sessions') => void;
	setMode: (mode: 'select-first' | 'select-second' | null) => void;
	setEntryIdA: (id: string | null) => void;
	setEntryIdB: (id: string | null) => void;
	setStatus: (status: { tone: 'loading'; message: string }) => void;
};

export function createSwapArmHandler(deps: SwapArmDeps): () => SwapArmingState {
	return () => {
		deps.setTask('swap-sessions');
		const next = applySwapArming(deps.setMode, deps.setEntryIdA, deps.setEntryIdB);
		deps.setStatus({
			tone: 'loading',
			message: 'Swap armed. Choose the first class on the grid, then the second.',
		});
		return next;
	};
}
