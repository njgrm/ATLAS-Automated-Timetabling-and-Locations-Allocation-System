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

/* ─── A2 move-swap — a swap must never hang ────────────────────────────────────
 *
 * The recorded defect: "Swap with another class … sticks on Checking swap
 * options. with the Swap sessions button disabled." The server-side cost that
 * made the preview slow was already cut down (mc R2 item 6), but the CLIENT had
 * no bound at all: `openRegularSwapPrompt` set `loading = true` and cleared it
 * only when the request settled, so a request that never settles — a dropped
 * socket, a stalled proxy — left a spinner and a disabled control standing
 * forever.
 *
 * These two are the whole fix: a named bound (a few seconds, not minutes) and a
 * wrapper that rejects with a plain-words error when it elapses. The bound is
 * the time the operator waits before ATLAS says what happened; it is NOT a
 * server-side cancellation, so the one action stays honest.
 */
export const SWAP_COMMIT_BOUND_MS = 8000;

/** Thrown by {@link withBoundedWait}. Its `message` is operator-facing. */
export class BoundedRequestTimeout extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BoundedRequestTimeout';
	}
}

/**
 * Resolve with `promise`, or reject with a {@link BoundedRequestTimeout} once
 * `ms` have passed. The timer is always cleared, so a fast request never leaves
 * a pending timer behind.
 */
export function withBoundedWait<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new BoundedRequestTimeout(message)), ms);
		promise.then(
			(value) => { clearTimeout(timer); resolve(value); },
			(error) => { clearTimeout(timer); reject(error); },
		);
	});
}

export const SWAP_PREVIEW_TIMEOUT_MESSAGE = 'ATLAS could not check this swap in time. Nothing changed. Try again, or choose a different class.';
export const SWAP_SAVE_TIMEOUT_MESSAGE = 'ATLAS could not save this swap in time. Nothing changed. Try again.';

/* ─── C11 M4 — ONE reset, and every exit path runs it ──────────────────────────
 *
 * The recorded defect (`report.md` defect 5): the swap review reported
 * `Must fix: …`, and closing or cancelling it left the workspace back in an
 * in-progress swap that then required a hard reload to clear.
 *
 * The cause, read off the shipped code rather than assumed. The three pieces of
 * swap state are `swapClassTimesMode` / `swapClassAEntryId` / `swapClassBEntryId`.
 * Before C11 the clearing of those three was open-coded at FOUR call sites — the
 * banner Cancel, the view-change effect, the scope-change effect, and the
 * concurrent-commit cancel — and the review dialog's own close
 * (`closeGeneratedSwap` in `TimetablePlacementDialogs.tsx`) cleared NONE of them,
 * because that dialog was written against a different piece of state
 * (`regularSwapPending`) and the armed state was simply not in its scope.
 *
 * So the reset had no single owner: an exit path that was not one of the four
 * silently left the armed state standing. This function gives the reset one
 * owner and one definition of "fully reset", and each exit path calls it.
 */
export type SwapClassTimesSetters = {
	setMode: (mode: 'select-first' | 'select-second' | null) => void;
	setEntryIdA: (id: string | null) => void;
	setEntryIdB: (id: string | null) => void;
};

/**
 * The single definition of "the swap workflow is over".
 *
 * All THREE fields are cleared, because the banner and the grid both read them:
 * clearing only the mode hides the banner while leaving a stale Class A/B behind
 * to be re-adopted the next time the swap is armed, which is the "needs a reload"
 * symptom. The returned value is the canonical disarmed state, so a caller can
 * assert on it without re-reading three setters.
 */
export function resetSwapClassTimes(setters: SwapClassTimesSetters): SwapArmingState {
	setters.setMode(null);
	setters.setEntryIdA(null);
	setters.setEntryIdB(null);
	return { mode: null, entryIdA: null, entryIdB: null };
}

/** True only when every piece of swap state is clear — the "no reload needed" property. */
export function isSwapClassTimesDisarmed(state: SwapArmingState): boolean {
	return state.mode === null && state.entryIdA === null && state.entryIdB === null;
}

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
