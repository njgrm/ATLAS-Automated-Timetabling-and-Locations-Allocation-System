/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — row 2's DRAFT ACTIONS, extracted.
 *
 * WHY A SUB-COMPONENT: `TimetableSimpleHeader.tsx` stood at exactly 1000 physical
 * lines, the AGENTS.md §8 cap, before this change took on the two-row header. §8's
 * answer for that is to EXTRACT a sub-component and never to delete a record
 * comment to make room, and this block is the natural unit: it is one coherent
 * group of row-2 controls, it owns no state and no handler, and every value it
 * needs is already derived one layer up.
 *
 * WHAT IT IS: §8's "Header budget" rule, the second half — "row 2 = the pickers,
 * plus only the actions that still have something to act on". The two draft
 * actions are right-aligned on row 2, each is absent when it has nothing to act
 * on, and a disabled control states its reason in a `@/ui` Tooltip rather than
 * as a sentence printed beneath it.
 *
 * WHAT IT DELIBERATELY IS NOT: a second gate. It renders the ALREADY-RESOLVED
 * `DraftStripActionPair` the header derived once from `resolveSimpleDraftMenuActions`
 * — the very object the `More` menu renders, so "one derivation, two renderers"
 * still holds and the two surfaces cannot disagree about whether an action is
 * available. The two `hide*` props and `reasonPresentation="tooltip"` are
 * presentation decisions the caller makes, not gates it re-derives; the header
 * passes `actions.hasDraft` by handing over the pair it already resolved, where
 * `hasDraft` IS `draftStrip.discardEnabled` — the very fact `resolveDraftStripProps`
 * defines as "there is a draft". See `TimetableDraftStateStrip` for why each
 * control reads the signal its own committed row requires.
 */
import { TimetableDraftStateStrip, type DraftStripActionPair } from '@/components/timetable/TimetableDraftStateStrip';

export function SimpleHeaderDraftActions({ actions }: { actions: DraftStripActionPair }) {
	return (
		<div className="ml-auto flex shrink-0 items-center gap-1.5">
			<TimetableDraftStateStrip
				/* `null`: the persistent draft-vs-published SENTENCE is not on row 2.
				 * It is the run-identity half of the trailing status band, which reads the
				 * same `describeRunState` result. Rendering it here as well would put the
				 * one fact about this screen in two places. */
				visibility={null}
				actions={actions}
				reasonPresentation="tooltip"
				hideDiscardWhenAbsent
				/* A2 HEADER-BUDGET correction 2 (F4, 2026-09-29) — THE MISSING HALF OF
				 * THE RULE. `hideDiscardWhenAbsent` alone left the reviewer's state-A
				 * render exactly as it was: a greyed `Edit draft` alone on the right of an
				 * otherwise empty row, the half of the old control pair the header budget
				 * deleted the sentence from but kept the button of. The signal is
				 * `actions.hasDraft`, handed across by the header and not re-derived here —
				 * `edit.enabled` would also hide a reachable control in state B. */
				hideEditWhenAbsent
			/>
		</div>
	);
}
