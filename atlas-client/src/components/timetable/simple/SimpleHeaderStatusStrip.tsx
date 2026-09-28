/**
 * A2 C11 S2 (item 2) — the header's ONE status strip, extracted from
 * `TimetableSimpleHeader`.
 *
 * WHY IT IS EXTRACTED: `TimetableSimpleHeader.tsx` stood at 998 physical lines,
 * two under the §8 1000-line cap, so the change notice could not be added
 * without deleting a comment. §8 says extract a sub-component, do not shrink the
 * record. The status region is the natural unit: it is one row of the two-row
 * header, it owns no behaviour of its own, and every prop it needs is already
 * computed one layer up.
 *
 * WHAT THE HEADER IS AFTER THIS: at 1366×768, TWO rows.
 *   row 1  this strip — the persistent draft/published state sentence, the run
 *          identity, the term line, the capped notices, and (A2 C12 item 4) the
 *          VISIBLE `Edit draft` / `Discard draft` the strip owns.
 *   row 2  the control row — Term · View · picker · warnings · primary · More,
 *          with the change notice as part of that same row rather than a row of
 *          its own (it is rendered by `SimpleHeaderControlRow`'s caller through
 *          the `changeNotice` slot).
 *
 * Nothing here decides a fact. The visibility sentence, the run identity, the
 * term line, the notice list and the two draft actions all arrive already
 * derived, so this component cannot become a second authority for any of them.
 */

import type { ReactNode } from 'react';

import { RunStateBadge, RunIdentityLine } from '@/components/timetable/RunStateBadge';
import { TimetableDraftStateStrip, type DraftStripActionPair } from '@/components/timetable/TimetableDraftStateStrip';
import { SimpleHeaderMessageList, type SimpleHeaderMessage } from '@/components/timetable/simple/SimpleHeaderMessages';
import { SimpleTermScopeLine } from '@/components/timetable/simple/SimpleTermScopeLine';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';

export type SimpleHeaderStatusStripProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	/** The ONE draft-state derivation, already resolved by the caller. */
	visibility: string | null;
	/** The strict published predicate for the run on screen. */
	isPublished: boolean;
	/** The viewed term's own words, so the line and the selector cannot disagree. */
	viewingTermLabel: string;
	/** The unresolved-term notice, or null. Rendered only when no change notice is up. */
	termAuthorityNotice: string | null;
	/** A change notice IS on the control row, so the term notice yields to it. */
	changeNoticeActive: boolean;
	/** The capped notice list, in its existing priority order. */
	messages: readonly SimpleHeaderMessage[];
	/**
	 * C11 T3a — WHICH run is on screen. The badge used to read only "Draft
	 * schedule", so an older reader could not say which schedule they were
	 * looking at. It now carries the run number from the ONE derivation.
	 */
	includeRunNumber?: boolean;
	/**
	 * A2 C12 / ITEM 4 — the ALREADY-RESOLVED `Edit draft` / `Discard draft` actions
	 * the draft strip shows VISIBLY, or `null` for a surface that does not offer
	 * them. The header passes the very object its `More` menu renders, so the two
	 * surfaces are one decision and cannot drift; the strip renders it and decides
	 * nothing.
	 */
	/**
	 * A2 HEADER-BUDGET correction 2 (F4, 2026-09-29) — the strip's own pair type,
	 * not a hand-written `{ edit, discard }` subset. `DraftStripActionPair` gained
	 * `hasDraft` (the caller's own "there is a draft on screen" fact) in this
	 * correction, and a structural subset here could no longer be passed to
	 * `TimetableDraftStateStrip` at all. Naming the shared type keeps this dead
	 * surface honest about the shape the live one takes, with no caller to update
	 * and nothing fabricated at the call boundary.
	 */
	draftActions?: DraftStripActionPair | null;
};

/**
 * Row 1. The persistent draft/published sentence is FIRST and unconditional for a
 * run: it is the one fact about this screen that never changes while the operator
 * works, so it is the strip's reason for existing. Everything else here is
 * subordinate to it.
 */
export function SimpleHeaderStatusStrip({
	context,
	visibility,
	isPublished,
	viewingTermLabel,
	termAuthorityNotice,
	changeNoticeActive,
	messages,
	includeRunNumber = true,
	draftActions = null,
}: SimpleHeaderStatusStripProps): ReactNode {
	return (
		<section data-testid="timetable-simple-status-region" role="region" aria-label="Timetable status" className="min-w-0 px-3">
			{/* A2 C12 / ITEM 1 — ONE LINE AT 1366. This is the status half of the
			    two-row header, and `flex-wrap` is what let it spill onto a second
			    visual line. From `lg` up it does not wrap, and the elastic children
			    give way instead: the draft sentence (`DraftVisibilityState`), the term
			    line's unverified-authority notice (`SimpleTermScopeLine`) and the
			    capped notice rows (`SimpleHeaderMessageRow`). The run badge stays
			    `shrink-0` — it is short, and a run number that truncates is useless. */}
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:flex-nowrap">
				<TimetableDraftStateStrip visibility={visibility} actions={draftActions} />
				{/* A2-C6-TRUTH (T3a/T3b/T3c) — WHICH schedule, and which term, in one
				    place. Simple is the DEFAULT view and it printed neither: the run
				    number and Draft/Published word existed only in the Expert header
				    (a surface move, not a regression — see `RunStateBadge`), and the
				    app shell carried a separate `Active Term:` chip that could not see
				    the term authority the timetable actually filters on. Both now come
				    from one shared derivation. */}
				<RunStateBadge
					isPreGeneration={context.isPreGenerationWorkspace}
					runId={context.draft?.runId ?? null}
					isPublished={isPublished}
					includeRunNumber={includeRunNumber}
					className="h-6 shrink-0 gap-1 px-2 text-xs font-semibold"
				/>
				<SimpleTermScopeLine
					context={context}
					termFilter={context.termFilter}
					termOptions={context.termOptions}
					viewingLabel={viewingTermLabel}
					hasScheduleOnScreen={context.draft != null}
				/>
				{/* Only actionable drift and unresolved-term states belong in the
				    ordinary header. Routine provenance remains in Expert diagnostics.
				    The drift notice itself now lives on the CONTROL row, so this
				    region yields the term line's notice to it rather than printing two
				    competing notices. */}
				{!changeNoticeActive && termAuthorityNotice ? (
					<p className="min-w-0 flex-1 truncate text-xs font-medium text-amber-800" data-testid="timetable-term-authority-unverified">{termAuthorityNotice}</p>
				) : null}
				{/* A2-C6-TRUTH (T3f) — the remaining notices, capped at three with an
				    honest remainder count. Their conditions, wording, priority order
				    and testids are unchanged; only how many render at once moved. */}
				<SimpleHeaderMessageList messages={messages} />
			</div>
		</section>
	);
}

/**
 * The EXPERT layout's row 1, extracted for the same reason (§8 cap) and so the two
 * layouts cannot drift onto two different banners.
 *
 * Lane C's spec: "The Expert header gets the same one-sentence banner shape. Do not
 * let the two layouts drift onto two different banners." The banner itself is
 * `SimpleDriftBanner` → `SimpleChangeNotice`, ONE implementation; this row decides
 * only WHERE it sits. The drift gate below is the SAME derivation the Simple
 * header uses, including the run's own timing, so "nothing the run depends on has
 * changed" means the same thing in both layouts.
 */
export function SimpleHeaderOrientationRow({
	activeTermLabel,
	scopeLabel,
	visibility,
	isPreGenerationWorkspace,
	runOnScreenId,
	isPublished,
	nextActionLabel,
	changeNotice,
}: {
	activeTermLabel: string | null;
	scopeLabel: string;
	visibility: string | null;
	isPreGenerationWorkspace: boolean;
	runOnScreenId: number | null;
	isPublished: boolean;
	nextActionLabel: string;
	/** The change notice node, or null when nothing has changed. */
	changeNotice: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/60 bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground" data-testid="timetable-scheduler-orientation">
			<span><span className="font-semibold text-foreground">Term:</span> {activeTermLabel ?? 'Term setup required'}</span>
			<span><span className="font-semibold text-foreground">Scope:</span> {scopeLabel}</span>
			<RunIdentityLine isPreGeneration={isPreGenerationWorkspace} runId={runOnScreenId} isPublished={isPublished} className="text-xs text-muted-foreground" />
			{/* C11 D, correction 2 (QA-B2) — the SAME persistent draft-state SENTENCE the
			    Simple header renders, in the orientation row this header already has, so
			    the two views of one run cannot disagree about whether it is a draft. The
			    strip's three buttons were what took Simple from six visible controls to
			    nine and put two publication controls on screen; the actions resolve onto
			    controls this header already has — `Publish` is
			    `TimetableExpertPublishControl` below, and Edit/Discard are in "More
			    tools" beside them. */}
			<TimetableDraftStateStrip visibility={visibility} />
			<span><span className="font-semibold text-foreground">Next:</span> {nextActionLabel}</span>
			{/* C11 S2 (item 1/2) — the SAME one-sentence change notice Simple shows, on
			    this layout's single status row. It is a `notice`, so it is the last
			    thing in the row and never displaces Term, Scope or the run state. */}
			{changeNotice}
		</div>
	);
}
