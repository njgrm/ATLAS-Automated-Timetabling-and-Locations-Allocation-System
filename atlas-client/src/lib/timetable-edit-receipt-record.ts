/**
 * A2 mc, S5c — the Schedule-history row composes its sentence from the SAME
 * module the inline status uses.
 *
 * BEFORE THIS SLICE the two surfaces described one change in two vocabularies:
 * the inline status said `Moved to MONDAY 07:00–08:00. Undo below.` and the
 * history row said nothing at all about which class moved or where it went. This
 * module closes that gap by deriving the row's sentence from
 * `buildEditReceipt`, so the two cannot drift.
 *
 * ── WHY THE ROW USES THE SHORT FORM ──────────────────────────────────────────
 *
 * `validationSummary.hardCount` is `hardAfter.length` at COMMIT time — every
 * HARD the whole-year run held then, not the selected-term figure the header
 * shows and not the publication-blocking subset. A2-C6-TRUTH (D2) already
 * REMOVED those counts from this row because a row reading 241 beside a header
 * reading 69 was a falsehood, and the `?? 0` default fabricated "warnings: 0".
 *
 * So this row prints the SHORT form: what was done, to which class, from which
 * slot, to which slot — and NO problem clause at all. Printing "No new problems"
 * from a row that holds no measurement would be exactly the kind of invented
 * reassurance D2 removed, so the clause is absent rather than false.
 *
 * The `Changed by a signed-in account. This record does not show which person.`
 * sentence below is untouched: the actor-name gap is an owed server follow-up.
 */

import type { ManualEditRecord } from '@/types';
import { buildEditReceipt, type ReceiptSlot } from '@/lib/timetable-edit-receipt';

type Payload = Record<string, unknown>;

function asPayload(value: unknown): Payload | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Payload) : null;
}

function readSlot(value: unknown): ReceiptSlot | null {
	const payload = asPayload(value);
	if (!payload) return null;
	const day = typeof payload.day === 'string' ? payload.day : null;
	const startTime = typeof payload.startTime === 'string' ? payload.startTime : null;
	if (!day || !startTime) return null;
	return { day, startTime };
}

/**
 * The slots a recorded edit moved between.
 *
 * `MOVE_ENTRY` / `CHANGE_TIMESLOT` / `CHANGE_ROOM` / `CHANGE_FACULTY` record the
 * whole entry on both sides. `SWAP_ENTRIES` records `{ entryA, entryB }`, and the
 * exchange is A's old slot against B's old slot — which is what the operator's
 * own control named.
 */
function readSlots(edit: ManualEditRecord): { from: ReceiptSlot | null; to: ReceiptSlot | null } {
	const before = asPayload(edit.beforePayload);
	const after = asPayload(edit.afterPayload);
	if (!before || !after) return { from: null, to: null };

	const directFrom = readSlot(before) ?? readSlot(before.entry) ?? null;
	const directTo = readSlot(after) ?? readSlot(after.entry) ?? null;
	if (directFrom || directTo) return { from: directFrom, to: directTo };

	const beforeA = readSlot(before.entryA);
	const beforeB = readSlot(before.entryB);
	if (beforeA || beforeB) return { from: beforeA, to: beforeB };
	return { from: null, to: null };
}

/** The entry id a recorded edit is about, for the caller's class resolver. */
export function readEditReceiptEntryId(edit: ManualEditRecord): string | null {
	const after = asPayload(edit.afterPayload);
	const before = asPayload(edit.beforePayload);
	for (const payload of [after, before]) {
		if (!payload) continue;
		for (const key of ['entryId', 'entryIdA']) {
			const value = payload[key];
			if (typeof value === 'string' && value.trim()) return value;
		}
	}
	return null;
}

/**
 * The short receipt for one history row, or `null` when the ledger holds nothing
 * to say.
 *
 * `null` is the fail-closed answer: a row that can resolve neither a class nor a
 * slot must NOT print a bare `Moved.`, which reads as a claim the record does not
 * carry. The row then keeps its badge and its actor sentence and adds nothing.
 */
export function historyEditReceiptSentence(
	edit: ManualEditRecord,
	resolveClassName?: (entryId: string) => string | null,
): string | null {
	const { from, to } = readSlots(edit);
	const entryId = readEditReceiptEntryId(edit);
	const classLabel = entryId && resolveClassName ? (resolveClassName(entryId) ?? '').trim() : '';
	if (!classLabel && !from && !to) return null;

	const short = buildEditReceipt({
		editType: edit.editType,
		classLabel: classLabel || null,
		from,
		to,
	}).short;
	return short === '' ? null : short;
}
