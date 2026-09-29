/**
 * A6 c6 item 5 — THE DEGRADED-SOURCE COPY, in one place.
 *
 * WHY THIS IS A FILE AND NOT FOUR MEMOS IN `WorkspaceToolbar`. The toolbar grew
 * past the `AGENTS.md` §8 1000-physical-line cap while these four derivations
 * lived in it, and the committed `a3-c10-tl-density` row that polices the cap
 * went red. Extracting is the rule, and this is the right seam rather than an
 * arbitrary one: all four are the SAME subject — what this page says when the
 * Teaching Load source is not verified — and all four read the same two inputs
 * (`dataSource`, `isOnline`). They came out of the toolbar together because they
 * are one decision, and they left it with their reasoning attached.
 *
 * WHAT LANE C ASKED FOR, verbatim, and where each answer now lives:
 *
 *   item 4  `Unverified — EnrollPro is not reachable, so this figure is
 *           withheld.` — 68 characters, a product name, and a word a scheduler
 *           cannot act on.        -> `teachingLoadUnverifiedStatus`, in
 *           `WorkspaceToolbar`, because `useTeachingLoadRepairQueue` imports it
 *           and the repair queue's own status must not be a second string.
 *
 *   item 5  `Using the last saved data — EnrollPro not reachable` "gives no
 *           clear next step or person to call; say what is unavailable and offer
 *           one safe retry."
 *           -> `lead` below: the visible pill, plain, per state, with no product
 *              name and no timestamp on its face.
 *           -> `detail` below: the `@/ui` Tooltip, which keeps every fact the
 *              old sentence carried — the cause clause, the source state, and
 *              `Saved <time>` ONLY when the page proved a time.
 *           -> `helpStep` below: the one new `Help` step, which adds the thing a
 *              hover cannot — that WAITING WILL NOT HELP while ATLAS is offline.
 *
 * NOTHING HERE IS A SECOND AUTHORITY. The cause clause is
 * `teachingLoadUnverifiedReason`, imported from the toolbar, so the Tooltip and
 * the Help step can never disagree with the repair queue about WHY a number is
 * unavailable. The saved-at clause is the page's real `savedAtLabel` field or
 * nothing at all: a synthesised clock beside an unverified number is exactly the
 * class of claim the `savedAtLabel` prop doc forbids, and that rule is unchanged.
 */
import { teachingLoadUnverifiedReason } from '@/components/faculty-assignments/WorkspaceToolbar';

export type TeachingLoadDegradedCopyInput = {
	dataSource: 'live' | 'cached' | 'refreshing' | 'none';
	isOnline: boolean;
	/** Whether this toolbar is showing a degraded notice at all. */
	degraded: boolean;
	/** The PAGE's real `fetchedAt` display string, or `null`. Never synthesised. */
	savedAtLabel?: string | null;
};

export type TeachingLoadDegradedCopy = {
	/** The visible pill: what is unavailable, in one plain sentence, or nothing. */
	lead: string | null;
	/** The Tooltip: the technical cause, the source state, and a real saved time. */
	detail: string | null;
	/** The one new `Help` step, for the state as it is right now. */
	helpStep: { title: string; body: string };
};

export const TEACHING_LOAD_DEGRADED_HELP_TITLE = 'Why the numbers may be from the last saved roster';

export function teachingLoadDegradedCopy(input: TeachingLoadDegradedCopyInput): TeachingLoadDegradedCopy {
	const { dataSource, isOnline, degraded, savedAtLabel } = input;

	// THE VISIBLE LEAD. Four states, four plain sentences, and nothing else on
	// the face: no product name, no timestamp, no "withheld".
	const lead = (() => {
		if (!degraded) return null;
		if (!isOnline) return 'You are offline, so ATLAS is showing the last saved roster.';
		if (dataSource === 'refreshing') return 'ATLAS is checking the live roster now.';
		if (dataSource === 'none') return 'There is no live roster to load, so ATLAS is showing the last saved one.';
		return 'ATLAS is showing the last saved roster, not the current one.';
	})();

	// THE HOVER'S DETAIL. `Saved <time>` only from a real field; the clause is
	// dropped rather than invented, which is the `savedAtLabel` prop's own rule.
	const savedAtClause = (() => {
		if (!savedAtLabel) return null;
		const parsed = new Date(savedAtLabel);
		return `Saved ${Number.isNaN(parsed.getTime()) ? savedAtLabel : parsed.toLocaleString()}`;
	})();

	const detail = degraded
		? [
			teachingLoadUnverifiedReason({ dataSource, isOnline }),
			`Source: ${dataSource}`,
			savedAtClause,
		]
			.filter(Boolean)
			.join(' · ')
		: null;

	// THE HELP STEP. Same cause clause as the Tooltip, so the two can never
	// disagree, plus the one sentence a hover cannot carry: while ATLAS is
	// offline, waiting is not the next step, reconnecting is.
	const helpStep = {
		title: TEACHING_LOAD_DEGRADED_HELP_TITLE,
		body: isOnline
			? `ATLAS was trying to reach the live roster and got: ${teachingLoadUnverifiedReason({ dataSource, isOnline })}. Nothing is wrong with your changes; the figures on screen are simply not confirmed yet, and they update on their own once the source answers.`
			: `ATLAS was trying to reach the live roster and got: ${teachingLoadUnverifiedReason({ dataSource, isOnline })}. Waiting will not help while ATLAS is offline — reconnect, then use Retry source.`,
	};

	return { lead, detail, helpStep };
}
