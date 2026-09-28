/**
 * C11 D — the persistent draft-state line, and the ONE publication plan both
 * headers read.
 *
 * The recorded walk (`docs/reviews/codex-timetable-walk-20260928/report.md`)
 * found no visible way to tell a draft from a published schedule (defect 3), no
 * Undo in the default Simple view at all (defect 6), and no Undo anywhere near
 * the place a manual edit lands.
 *
 * ── C11 CORRECTION 2 (QA-B2) — THIS COMPONENT IS NOW TEXT, AND ONLY TEXT ──────
 *
 * The first cut gave the strip three buttons of its own (Edit · Discard draft ·
 * Publish). Fresh independent QA measured the consequence on the real header at
 * 1366 px: the Simple view went from the accepted SIX visible controls to NINE,
 * and it put TWO publication controls on screen at once — this strip's `Publish`
 * and the header's existing `timetable-simple-publish-action`. For a scheduler
 * that is the operator-facing form of "one derivation, two renderers": the same
 * verb, twice, on the same screen.
 *
 * So the strip keeps exactly the thing the packet asked for — a PERSISTENT,
 * ALWAYS-VISIBLE state SENTENCE ("Draft — not visible to teachers until you
 * publish" / "Published"), derived once from `describeRunState` — and stops
 * contributing any control of its own. The three D actions did not disappear;
 * they resolved onto controls the headers ALREADY have, in the one-primary +
 * one-secondary shape DRAFT-UX-C01 established:
 *
 *   - `Edit`      → the header's own PRIMARY action slot when a draft exists
 *                   ("Edit draft"), replacing that state's primary verb;
 *   - `Publish`   → the header's own publication control, exactly one on screen;
 *   - `Discard`   → the existing More menu, with a visible reason when disabled.
 *
 * Every reason below is still VISIBLE TEXT beside the control it explains, never a
 * `title` and never hover-only (AGENTS.md §8). A reason is no longer rendered
 * HERE, because the control it explains is no longer here.
 *
 * ── WHY THE PUBLICATION RULE LIVES HERE AND NOT IN THE STRIP ─────────────────
 *
 * `TimetableSimpleHeader` carried the publication dispatch inline
 * (`handlePublishClick`): skip when the run is published, route to the publish
 * task when the capability gate is open, otherwise open the readiness sheet. That
 * body is the canonical gate. If the strip re-implemented it, the strip would be
 * a SECOND publication path with its own idea of when publishing is allowed —
 * precisely the "do not add a second publication path, do not weaken
 * `capabilities`" boundary. So the rule is extracted here, exactly once, and
 * `TimetableSimpleHeader` now calls this same function. There is one rule and two
 * callers; the strip has no authority of its own.
 */
import { describeRunState } from '@/components/timetable/RunStateBadge';

export type DraftStripPublishPlan =
	| { readonly kind: 'disabled'; readonly reason: string }
	| { readonly kind: 'readiness-sheet' }
	| { readonly kind: 'publish-task' };

/** Shown on a Publish control that cannot act, without needing a hover. */
export const PUBLISH_WHEN_ALREADY_PUBLISHED = 'This schedule is already published.';
export const PUBLISH_GATE_CLOSED = 'Publishing is not available for this school right now.';

/**
 * The one publication rule.
 *
 * Deliberately in the same order as the code it replaces, and it asserts only
 * what the caller can prove:
 *  - a published run cannot be published again (its own state, not a count);
 *  - an open publication gate routes to the publish task, which is the readiness
 *    surface that renders the checklist;
 *  - otherwise the readiness sheet opens, which is the gate's own dialog.
 *
 * The closed-gate case is REFUSED rather than falling through to the readiness
 * sheet: a closed capability gate must not be a control that opens a dialog the
 * operator can then try to confirm through.
 */
export function resolveDraftStripPublishPlan(input: {
	isPublished: boolean;
	publicationGateEnabled: boolean;
}): DraftStripPublishPlan {
	if (input.isPublished) return { kind: 'disabled', reason: PUBLISH_WHEN_ALREADY_PUBLISHED };
	if (!input.publicationGateEnabled) return { kind: 'disabled', reason: PUBLISH_GATE_CLOSED };
	return { kind: 'publish-task' };
}

/**
 * The persistent state line: one derivation of draft-vs-published, and NOTHING
 * else.
 *
 * The visibility sentence is NOT derived here. It comes from
 * `describeRunState` in `RunStateBadge`, which is already the single derivation
 * the two headers use for the run's identity, so the badge, the run line and this
 * strip cannot disagree about the run on screen. A second
 * `isPublished ? ... : ...` in this file would reintroduce exactly the drift
 * A2-C6-TRUTH was written to remove.
 *
 * It renders a `<span>`, not a block, because the two headers place it INSIDE the
 * status row they already have (QA-B2: the strip must not add a header row — the
 * next slice owns header row count).
 */
export function DraftVisibilityState({
	visibility,
}: {
	visibility: string | null;
}) {
	if (visibility === null) return null;
	return (
		<span
			className="shrink-0 text-xs font-semibold text-foreground"
			data-testid="timetable-draft-visibility"
		>
			{visibility}
		</span>
	);
}

export type DraftStripResolvedProps = {
	visibility: string | null;
	editEnabled: boolean;
	editBlockedReason: string | null;
	discardEnabled: boolean;
	publishEnabled: boolean;
	publishBlockedReason: string | null;
};

/**
 * Resolve every action input from the run, in one place.
 *
 * This exists for two reasons. The single-source rule: the visibility sentence is
 * read from `describeRunState`, never re-derived here, so the badge, the run
 * identity line and the strip cannot disagree. And the size budget:
 * `TimetableSimpleHeader` was at 1006 physical lines after taking the strip, over
 * the 1000-line cap (AGENTS.md §8), so the derivation lives here instead of
 * growing that header.
 *
 * `hasSelectedClass` is the single fact both the primary `Edit draft` action and
 * the More menu's `Manual edit` read, so those two surfaces cannot disagree about
 * whether a manual edit is currently possible.
 */
export function resolveDraftStripProps(input: {
	isPreGeneration: boolean;
	runId: number | null;
	isPublished: boolean;
	publicationGateEnabled: boolean;
	hasSelectedClass: boolean;
	hasDraft: boolean;
}): DraftStripResolvedProps {
	const publishPlan = resolveDraftStripPublishPlan({
		isPublished: input.isPublished,
		publicationGateEnabled: input.publicationGateEnabled,
	});
	return {
		visibility: describeRunState({
			isPreGeneration: input.isPreGeneration,
			runId: input.runId,
			isPublished: input.isPublished,
		}).visibility,
		editEnabled: input.hasSelectedClass,
		editBlockedReason: input.hasSelectedClass ? null : DRAFT_EDIT_NEEDS_SELECTION,
		discardEnabled: input.hasDraft,
		publishEnabled: publishPlan.kind !== 'disabled',
		publishBlockedReason: publishPlan.kind === 'disabled' ? publishPlan.reason : null,
	};
}

/** One sentence, shared by the two headers and the More menu. */
export const DRAFT_EDIT_NEEDS_SELECTION = 'Pick a class on the grid first, then choose Edit.';

/**
 * The VISIBLE reasons for an action a surface cannot perform right now.
 *
 * These used to be rendered beside this strip's own buttons. Correction 2 (QA-B2)
 * moved the buttons onto controls the headers already have, so each reason now
 * travels with the control it explains — the primary `Edit draft` states the
 * selection reason, the More-menu `Discard draft` states its own, and the
 * publication control states the publication reason. They remain visible TEXT
 * (AGENTS.md §8: never a `title`, never hover-only), never tooltips.
 *
 * A surface that has no action to offer at all passes no handler; the control it
 * renders is disabled and states one of these sentences beside itself, so a
 * scheduler is never shown an enabled control whose handler does nothing.
 */
export const DRAFT_EDIT_UNAVAILABLE = 'Edit is not available on this schedule surface.';
export const DRAFT_DISCARD_UNAVAILABLE = 'Discarding the draft is not available on this schedule surface.';
export const DRAFT_PUBLISH_UNAVAILABLE = 'Publishing is not available on this schedule surface.';
/** C11 correction 2 (QA-B2) — the More-menu `Discard draft` entry's own reason. */
export const DRAFT_DISCARD_REASON_NEEDS_DRAFT = 'There is no draft on this schedule to discard.';

/**
 * The persistent draft-state line.
 *
 * C11 CORRECTION 2 (QA-B2) — it renders NO control. It is a sentence, so it
 * cannot push the accepted six-control cap over, and it cannot be a second
 * renderer of an action the header already offers. The three D actions are
 * resolved by each header onto its OWN controls (see this file's header comment);
 * what remains here is the one thing neither header had: a draft state that is
 * always on screen, from the one shared derivation.
 *
 * `children` is the single Undo / Redo / History control (M5) — the ONE instance
 * in the whole workspace, handed to both headers by
 * `ScheduleReviewWorkspace`. It is still a child of this component so the two
 * layouts can never drift onto two Undo surfaces, but the strip itself adds no
 * control of its own.
 */
export function TimetableDraftStateStrip({
	visibility,
	children,
}: {
	visibility: string | null;
	/** The single existing Undo / Redo / History control (M5). */
	children?: React.ReactNode;
}) {
	return (
		<span
			className="inline-flex min-w-0 flex-wrap items-center gap-1.5"
			data-testid="timetable-draft-state-strip"
		>
			<DraftVisibilityState visibility={visibility} />
			{children}
		</span>
	);
}
