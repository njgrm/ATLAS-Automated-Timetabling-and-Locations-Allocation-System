/**
 * A2 mc, S5 — ONE derivation of the sentence a committed timetable edit speaks.
 *
 * The recorded defect (packet item 5): after a committed move the inline status
 * said `Moved to MONDAY 07:00–08:00. Undo below.` It named neither WHICH class,
 * nor where it came FROM, nor whether the change made anything worse. The soft
 * branch said `Move applied with 3 soft warning(s).` — a count, not a sentence.
 * The Schedule history dialog used different words again and named no class at
 * all, so the same change read as three different things on one screen.
 *
 * This module is the single place that composes that sentence, and BOTH surfaces
 * render it:
 *   - the inline status (`useScheduleReviewWorkspaceState` move + place paths,
 *     `useTimetableMutations` swap path), and
 *   - the Schedule history rows (`TimetableAssignmentDialogs`).
 *
 * PURE BY DESIGN: no React, no fetch, no store. Everything it prints is a
 * function of its arguments, so a receipt cannot describe a change the
 * committed record does not carry. Every caller passes the values it got BACK
 * from the commit (`CommitResult` / the committed `DraftReport`), never the
 * optimistic proposal, so the sentence cannot claim a change that never landed.
 *
 * THE RULES (packet §7):
 *   - name the class (and the section when it resolves), so "which class" is
 *     answered;
 *   - `from`/`to` in `Mon 6:00` form: short day, no seconds, never the raw
 *     `MONDAY` enum;
 *   - the problem clause is ALWAYS present and states the DELTA honestly;
 *   - no ellipsis, no truncation, no raw engine code, no raw id.
 *
 * `short` is the same sentence with the problem clause dropped, for the history
 * row, where the surrounding badges already state the outcome shape.
 */

import { DAY_SHORT } from '@/components/manual-edit/manual-edit-foundation';

export type ReceiptSlot = {
	day: string;
	startTime: string;
};

export type ReceiptProblems = {
	/** Problems that exist NOW on the run after the edit committed. */
	now: number;
	/** Problems that existed BEFORE the edit. `null` means "not measured". */
	before?: number | null;
	/** The first new problem, in the operator's words. Never a code. */
	firstNewSentence?: string | null;
};

export type EditReceiptInput = {
	editType: string;
	/** The class, already resolved by the caller's own label resolver. */
	classLabel?: string | null;
	from?: ReceiptSlot | null;
	to?: ReceiptSlot | null;
	problems?: ReceiptProblems | null;
	/** Appended after the problem clause (e.g. "Undo below."). */
	trailing?: string | null;
};

export type EditReceiptTone = 'success' | 'warning';

export type EditReceipt = {
	/** The full sentence for the inline status. */
	sentence: string;
	/** The same sentence without the problem clause, for a history row. */
	short: string;
	tone: EditReceiptTone;
};

/* ─── Plain words ─── */

const ACTION_WORDS: Record<string, string> = {
	MOVE_ENTRY: 'Moved',
	CHANGE_TIMESLOT: 'Moved',
	PLACE_UNASSIGNED: 'Placed',
	CHANGE_ROOM: 'Moved to a different room',
	CHANGE_FACULTY: 'Gave this class to a different teacher',
	SWAP_ENTRIES: 'Swapped',
	REVERT: 'Undid a change',
};

/**
 * `06:00` -> `6:00`, `13:30` -> `1:30 PM`.
 *
 * The packet's target shape is `Mon 6:00`, so the meridiem is printed ONLY where
 * dropping it would be a lie (an afternoon hour reduced to 1–6). Seconds are
 * never printed, and the raw `07:00:00` never reaches the operator.
 */
export function shortClockTime(hhmm: string): string {
	const raw = String(hhmm ?? '').trim();
	const parts = raw.split(':');
	const h = Number(parts[0]);
	const m = parts.length > 1 ? Number(parts[1]) : 0;
	if (!Number.isFinite(h)) return '';
	const minute = Number.isFinite(m) ? String(m).padStart(2, '0') : '00';
	const twelve = h % 12 === 0 ? 12 : h % 12;
	const meridiem = h < 12 ? '' : ' PM';
	return `${twelve}:${minute}${meridiem}`;
}

/** `MONDAY` + `06:00` -> `Mon 6:00`. Unknown days keep their own text, never the enum. */
export function receiptSlotLabel(slot: ReceiptSlot | null | undefined): string {
	if (!slot) return '';
	const shortDay = DAY_SHORT[String(slot.day ?? '').toUpperCase()] ?? String(slot.day ?? '');
	const time = shortClockTime(String(slot.startTime ?? ''));
	if (!shortDay) return time;
	return time ? `${shortDay} ${time}` : shortDay;
}

/** The plain subject of the sentence: `Moved`, `Placed`, … Never a raw enum. */
export function receiptActionWord(editType: string): string {
	return ACTION_WORDS[editType] ?? 'Changed';
}

function pluralProblemWord(count: number): string {
	return count === 1 ? 'problem' : 'problems';
}

/**
 * The class a receipt names, in the packet's own shape: `TLE for 7-Rizal`.
 *
 * Both labels come from the CALLER's resolvers — this module never resolves an
 * id and never prints one. When only one resolves, that one is used alone;
 * when neither resolves the receipt names no class, which is honest, rather than
 * borrowing a neighbour's name.
 */
export function receiptClassLabel(input: {
	sectionLabel?: string | null;
	subjectLabel?: string | null;
}): string {
	const subject = (input.subjectLabel ?? '').trim();
	const section = (input.sectionLabel ?? '').trim();
	if (subject && section) return `${subject} for ${section}`;
	return subject || section;
}

/**
 * The honest problem clause.
 *
 *  - `now <= 0` -> `No new problems.` (the run is clean after the edit)
 *  - a measurable `before` -> states the TOTAL now and the DELTA, because "3
 *    problems now; 1 was already there" is the sentence an operator needs when
 *    the run was not clean before they touched it.
 *  - otherwise -> `2 new problems: <first one, in words>.` Naming the first is
 *    what makes the sentence actionable; a bare count is the defect.
 */
export function receiptProblemClause(problems: ReceiptProblems | null | undefined): string {
	if (!problems) return 'No new problems.';
	const now = Number.isFinite(problems.now) ? Math.max(0, Math.trunc(problems.now)) : 0;
	if (now === 0) return 'No new problems.';
	const first = (problems.firstNewSentence ?? '').trim();
	if (first && !/[.!?]$/.test(first)) return `${now} new ${pluralProblemWord(now)}: ${first}.`;
	if (first) return `${now} new ${pluralProblemWord(now)}: ${first}`;
	if (typeof problems.before === 'number' && Number.isFinite(problems.before)) {
		const before = Math.max(0, Math.trunc(problems.before));
		if (before >= now) {
			const already = before - now;
			return `${now} ${pluralProblemWord(now)} now; ${already} ${already === 1 ? 'was' : 'were'} already there.`;
		}
	}
	return `${now} new ${pluralProblemWord(now)}.`;
}

/**
 * The ONE receipt derivation.
 *
 * Every committed move, swap and place on the real surface composes its status
 * here, and the Schedule history row composes its short form from the same call,
 * so the two can never describe one change in two ways.
 */
export function buildEditReceipt(input: EditReceiptInput): EditReceipt {
	const action = receiptActionWord(input.editType);
	const who = (input.classLabel ?? '').trim();
	const from = receiptSlotLabel(input.from);
	const to = receiptSlotLabel(input.to);

	const subject = who ? ` ${who}` : '';
	const where = from && to
		? ` from ${from} to ${to}`
		: to
			? ` to ${to}`
			: from
				? ` from ${from}`
				: '';

	const short = `${action}${subject}${where}.`;
	const clause = receiptProblemClause(input.problems);
	const trailing = (input.trailing ?? '').trim();

	const problemsPresent = (() => {
		const now = input.problems?.now ?? 0;
		return Number.isFinite(now) && now > 0;
	})();

	const sentence = `${short} ${clause}${trailing ? ` ${trailing}` : ''}`;

	return {
		sentence,
		short,
		tone: problemsPresent ? 'warning' : 'success',
	};
}

/**
 * The SHORT form used by a history row: same words, problem clause dropped.
 * A row beside a type badge already states the shape of the record; what it did
 * NOT state was WHICH class moved and WHERE it went, which is exactly `short`.
 */
export function buildEditReceiptShort(input: EditReceiptInput): string {
	return buildEditReceipt(input).short;
}
