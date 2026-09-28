/**
 * A2-C6-TRUTH (T1/T2) — what the schedule-history ledger is allowed to claim.
 *
 * Two independent falsehoods lived on this surface, and both are decided here so
 * the menu, the dialog and the hook cannot drift:
 *
 *   T1 — the ledger was CLEARED by a term change and never refetched, so a run
 *        holding four recorded changes rendered "Nothing to show yet: no class
 *        has been moved, swapped or given a new room in this schedule." That
 *        sentence is a claim about the run, so it is now reachable only from a
 *        `ready` read of zero rows. A read that never ran, or that failed, has
 *        its own sentence and can never borrow this one.
 *
 *   T2 — a `SWAP_ENTRIES` row whose strategy relocated a class BEYOND the two
 *        classes' exchange read exactly like a plain two-class swap. The move
 *        was in `afterPayload`, which no user could reach. The plain words are
 *        derived from the recorded slots, never from a re-derivation of the
 *        schedule, so the row says what was committed even if the run has since
 *        changed.
 */

import type { ManualEditRecord } from '@/types';

/**
 * What the client actually knows about the last ledger read.
 *
 * `idle`    — no read has been attempted for the run on screen.
 * `loading` — a read is in flight; the previous rows are NOT yet known stale-safe.
 * `ready`   — the server answered, and the answer is the row list. Only here may
 *             a zero-row claim be printed.
 * `error`   — the read failed. A failure is not an empty run.
 */
export type EditHistoryReadState = 'idle' | 'loading' | 'ready' | 'error';

/** The empty-state sentence. Reachable ONLY from a `ready` read of zero rows. */
export const EDIT_HISTORY_EMPTY_MESSAGE =
	'Nothing to show yet: no class has been moved, swapped or given a new room in this schedule.';

/** Shown while the ledger is being re-read after a scope or term change. */
export const EDIT_HISTORY_LOADING_MESSAGE = 'Checking this schedule for recorded changes…';

/**
 * Shown when the read failed.
 *
 * This exists because `fetchEditHistory` swallowed every failure and returned
 * `[]` (T1c), which made a network failure indistinguishable from a run that
 * nobody ever edited. It names the failure and states the honest consequence —
 * the run's history is UNKNOWN, not empty. It deliberately promises no retry the
 * surface does not offer.
 */
export const EDIT_HISTORY_ERROR_MESSAGE =
	'Could not read the schedule history. This schedule may still have recorded changes.';

/**
 * The sentence the surface may print for a given read state and row count.
 *
 * The only path to `EDIT_HISTORY_EMPTY_MESSAGE` is `ready` with zero rows, which
 * is exactly the condition under which the sentence is true. Callers that pass
 * a count with a non-`ready` state get the state sentence instead, so a stale
 * zero can never print a claim about the run.
 */
export function editHistoryEmptyStateMessage(
	readState: EditHistoryReadState,
	rowCount: number,
): string {
	if (readState === 'loading') return EDIT_HISTORY_LOADING_MESSAGE;
	if (readState === 'error') return EDIT_HISTORY_ERROR_MESSAGE;
	if (readState === 'ready' && rowCount === 0) return EDIT_HISTORY_EMPTY_MESSAGE;
	if (readState === 'ready') return '';
	// `idle`, or rows that have not been re-read yet. Both are "not known", and
	// neither may assert that the run holds nothing.
	return EDIT_HISTORY_LOADING_MESSAGE;
}

/** True only when the surface may claim the run has no recorded changes. */
export function mayClaimEmptyHistory(readState: EditHistoryReadState, rowCount: number): boolean {
	return readState === 'ready' && rowCount === 0;
}

/* ------------------------------------------------------------------ *
 * T2 — the auto-move a swap committed behind the operator's back
 * ------------------------------------------------------------------ */

type SwapSlot = { day?: unknown; startTime?: unknown; endTime?: unknown } | null | undefined;

type SwapPayload = {
	strategy?: unknown;
	entryIdA?: unknown;
	entryIdB?: unknown;
	entryA?: SwapSlot;
	entryB?: SwapSlot;
};

function asPayload(value: unknown): SwapPayload | null {
	return value && typeof value === 'object' ? (value as SwapPayload) : null;
}

function slotKey(slot: SwapSlot): string | null {
	if (!slot || typeof slot !== 'object') return null;
	const { day, startTime, endTime } = slot;
	if (typeof day !== 'string' || typeof startTime !== 'string' || typeof endTime !== 'string') return null;
	return `${day}|${startTime}|${endTime}`;
}

export type EditAutoMove = {
	/** Which of the two classes the auto-fix relocated beyond the exchange. */
	which: 'A' | 'B';
	/** The slot it was moved TO, as recorded. */
	to: { day: string; startTime: string; endTime: string };
	/** The slot it was moved FROM, as recorded. */
	from: { day: string; startTime: string; endTime: string };
};

/** `MONDAY 06:00` — the scheduler's own day/time words, no ids. */
function readSlot(slot: SwapSlot): { day: string; startTime: string; endTime: string } | null {
	if (!slot || typeof slot !== 'object') return null;
	const { day, startTime, endTime } = slot;
	if (typeof day !== 'string' || typeof startTime !== 'string' || typeof endTime !== 'string') return null;
	return { day, startTime, endTime };
}

/**
 * The class a committed `SWAP_ENTRIES` edit relocated beyond the two classes'
 * exchange, or `null` when it relocated nothing.
 *
 * DERIVED FROM THE RECORDED PAYLOAD ONLY. A plain two-class swap puts A in B's
 * old slot and B in A's old slot, so both "after" slots equal the other side's
 * "before" slot and neither reads as relocated. An auto-fix parks one class on
 * the other's slot and pushes the THIRD session somewhere neither had been —
 * that session is the one the operator's control never mentioned, and it is the
 * one this function names.
 *
 * `null` is the fail-closed answer for a payload of the wrong shape: a row that
 * cannot resolve its own move must not invent one.
 */
export function readEditAutoMove(edit: ManualEditRecord): EditAutoMove | null {
	if (edit.editType !== 'SWAP_ENTRIES') return null;
	const before = asPayload(edit.beforePayload);
	const after = asPayload(edit.afterPayload);
	if (!before || !after) return null;

	const strategy = after.strategy;
	if (strategy !== 'AUTO_FIX_MOVE_SOURCE' && strategy !== 'AUTO_FIX_MOVE_BLOCKING') return null;

	const beforeA = readSlot(before.entryA);
	const beforeB = readSlot(before.entryB);
	const afterA = readSlot(after.entryA);
	const afterB = readSlot(after.entryB);
	if (!beforeA || !beforeB || !afterA || !afterB) return null;

	const keyBeforeA = slotKey(beforeA);
	const keyBeforeB = slotKey(beforeB);
	const keyAfterA = slotKey(afterA);
	const keyAfterB = slotKey(afterB);
	if (!keyBeforeA || !keyBeforeB || !keyAfterA || !keyAfterB) return null;

	// The class the strategy claims to relocate.
	if (strategy === 'AUTO_FIX_MOVE_SOURCE') {
		// A took B's old slot -> a direct swap, nothing relocated.
		if (keyAfterA === keyBeforeB) return null;
		if (keyAfterA === keyBeforeA) return null;
		return { which: 'A', to: afterA, from: beforeA };
	}
	// AUTO_FIX_MOVE_BLOCKING relocates B. Symmetric, same two exclusions.
	if (keyAfterB === keyBeforeA) return null;
	if (keyAfterB === keyBeforeB) return null;
	return { which: 'B', to: afterB, from: beforeB };
}

/** `Monday 6:00 AM–6:45 AM` — plain words, the same shape the grid prints. */
export function formatEditAutoMoveSlot(slot: { day: string; startTime: string; endTime: string }): string {
	// The payload stores the day upper-cased (`MONDAY`); the grid prints it
	// title-cased, so the ledger row matches the surface the operator is
	// comparing against instead of shouting a different casing at them.
	const day = slot.day
		.toLowerCase()
		.replace(/(^|[\s-])(\p{L})/gu, (_match, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
	const format = (value: string) => {
		const [hoursText, minutesText] = value.split(':');
		const hours = Number(hoursText);
		if (!Number.isFinite(hours) || !Number.isFinite(Number(minutesText))) return value;
		const suffix = hours >= 12 ? 'PM' : 'AM';
		const twelve = hours % 12 === 0 ? 12 : hours % 12;
		return `${twelve}:${minutesText} ${suffix}`;
	};
	return `${day} ${format(slot.startTime)}–${format(slot.endTime)}`;
}

/**
 * The sentence a swap row prints when the commit moved a class the operator's
 * control never named, or `null` when it moved nothing.
 *
 * The wording deliberately mirrors the post-commit inline status
 * (`useTimetableMutations.ts` "ATLAS also moved the source session to the
 * nearest valid slot") so the dialog and the toast describe one event in one
 * register. It carries no entry id and no raw `HH:MM`, because a bare id is
 * forbidden on this surface and `06:00` is not a time an older reader can use.
 */
export function describeEditAutoMove(edit: ManualEditRecord): string | null {
	const move = readEditAutoMove(edit);
	if (!move) return null;
	return move.which === 'A'
		? `Also moved Class A to ${formatEditAutoMoveSlot(move.to)}.`
		: `Also moved Class B to ${formatEditAutoMoveSlot(move.to)}.`;
}
