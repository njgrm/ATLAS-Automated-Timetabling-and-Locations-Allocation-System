/**
 * C11 D + M5 — the persistent draft-state strip, and the ONE publication plan
 * both the strip and the headers read.
 *
 * The recorded walk (`docs/reviews/codex-timetable-walk-20260928/report.md`)
 * found no visible way to tell a draft from a published schedule (defect 3), no
 * Undo in the default Simple view at all (defect 6), and no Undo anywhere near
 * the place a manual edit lands.
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
 * callers; the strip has no authority of its own and takes its actions as props.
 */
import { PencilLine, Send, Trash2 } from 'lucide-react';

import { describeRunState } from '@/components/timetable/RunStateBadge';
import { Button } from '@/ui/button';

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
 * C11 F2 — the three actions a surface may hand the strip.
 *
 * All three are OPTIONAL. A surface with no action to offer passes nothing and the
 * strip renders that control disabled with a visible reason; it must never pass a
 * module-level no-op, which produced the "visible, enabled, silent" Edit and
 * Discard draft the correction removed.
 */
export type DraftStripActions = {
	/** Edit — enters the draft's manual-edit affordances for the current run. */
	onEdit?: (() => void) | undefined;
	/** Discard draft — the workspace's existing reset-draft confirmation. */
	onDiscardDraft?: (() => void) | undefined;
	/** Publish — the workspace's existing canonical publication dispatch. */
	onPublish?: (() => void) | undefined;
};

/**
 * The persistent strip: one derivation of draft-vs-published, and the actions
 * that belong to it.
 *
 * The visibility sentence is NOT derived here. It comes from
 * `describeRunState` in `RunStateBadge`, which is already the single derivation
 * the two headers use for the run's identity, so the badge, the run line and this
 * strip cannot disagree about the run on screen. A second
 * `isPublished ? ... : ...` in this file would reintroduce exactly the drift
 * A2-C6-TRUTH was written to remove.
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
 * Resolve every strip input from the run, in one place.
 *
 * This exists for two reasons. The single-source rule: the visibility sentence is
 * read from `describeRunState`, never re-derived here, so the badge, the run
 * identity line and the strip cannot disagree. And the size budget:
 * `TimetableSimpleHeader` was at 1006 physical lines after taking the strip, over
 * the 1000-line cap (AGENTS.md §8), so the derivation lives here instead of
 * growing that header.
 *
 * `hasSelectedClass` is the single fact both the strip's `Edit` and the More
 * menu's `Manual edit` read, so those two surfaces cannot disagree about whether
 * a manual edit is currently possible.
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
 * C11 F2 — a control with no handler is DISABLED, and says so in the open.
 *
 * The first cut of this slice had both headers pass module-level `() => {}`
 * fall-throughs for the actions they did not receive, so `Edit` and
 * `Discard draft` rendered ENABLED, said nothing, and did nothing — the exact
 * "visible, enabled, silent" control the packet forbids. These are the visible
 * reasons for a missing handler, one per control, so an operator who cannot
 * complete an action is told which one and why without hovering anything
 * (AGENTS.md §8: a blocked reason must be visible, not hover-only).
 */
export const DRAFT_EDIT_UNAVAILABLE = 'Edit is not available on this schedule surface.';
export const DRAFT_DISCARD_UNAVAILABLE = 'Discarding the draft is not available on this schedule surface.';
export const DRAFT_PUBLISH_UNAVAILABLE = 'Publishing is not available on this schedule surface.';

export function TimetableDraftStateStrip({
	visibility,
	editEnabled,
	editBlockedReason,
	discardEnabled,
	publishEnabled,
	publishBlockedReason,
	children,
	onEdit,
	onDiscardDraft,
	onPublish,
}: {
	visibility: string | null;
	editEnabled: boolean;
	editBlockedReason: string | null;
	discardEnabled: boolean;
	publishEnabled: boolean;
	publishBlockedReason: string | null;
	/** The single existing Undo / Redo / History control (M5). */
	children?: React.ReactNode;
	// C11 F2 — the three actions are OPTIONAL. A surface that has no action to
	// offer passes nothing, and the control renders disabled with a visible reason
	// instead of falling through to a module-level no-op.
	onEdit?: (() => void) | undefined;
	onDiscardDraft?: (() => void) | undefined;
	onPublish?: (() => void) | undefined;
}) {
	// C11 F2 — a control is live only when the caller both permits it AND supplied
	// a handler. `disabled` is the conjunction, so an enabled control can never be
	// one whose handler does nothing.
	const editLive = editEnabled && typeof onEdit === 'function';
	const discardLive = discardEnabled && typeof onDiscardDraft === 'function';
	const publishLive = publishEnabled && typeof onPublish === 'function';
	const editReason = editLive ? null : (editBlockedReason ?? DRAFT_EDIT_UNAVAILABLE);
	const discardReason = discardLive ? null : DRAFT_DISCARD_UNAVAILABLE;
	const publishReason = publishLive ? null : (publishBlockedReason ?? DRAFT_PUBLISH_UNAVAILABLE);

	return (
		<div
			role="region"
			aria-label="Schedule draft state"
			data-testid="timetable-draft-state-strip"
			className="flex min-w-0 flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-3 py-1.5"
		>
			<DraftVisibilityState visibility={visibility} />
			{/* AGENTS.md §8 — no raw `title`. A disabled control states its reason in
			    the visible line beside it, not only in a tooltip, so a keyboard or
			    touch operator gets the same information (the A2-TIMETABLE-CUSTODY-R2
			    precedent for the header Undo). C11 F2 extends that to a control that
			    has no handler at all. */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 gap-1.5 px-2 text-xs"
				disabled={!editLive}
				onClick={onEdit}
				data-testid="timetable-draft-strip-edit"
				aria-label={editLive ? 'Edit the draft schedule' : `Edit the draft schedule. ${editReason ?? ''}`}
			>
				<PencilLine className="size-3.5" aria-hidden="true" />
				Edit
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 gap-1.5 px-2 text-xs"
				disabled={!discardLive}
				onClick={onDiscardDraft}
				data-testid="timetable-draft-strip-discard"
				aria-label={discardLive ? 'Discard the draft' : `Discard the draft. ${discardReason ?? ''}`}
			>
				<Trash2 className="size-3.5" aria-hidden="true" />
				Discard draft
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 gap-1.5 px-2 text-xs"
				disabled={!publishLive}
				onClick={onPublish}
				data-testid="timetable-draft-strip-publish"
				aria-label={publishLive ? 'Publish the schedule' : `Publish the schedule. ${publishReason ?? ''}`}
			>
				<Send className="size-3.5" aria-hidden="true" />
				Publish
			</Button>
			{editReason && !editLive ? (
				<span role="status" data-testid="timetable-draft-strip-edit-reason" className="text-xs text-muted-foreground">
					{editReason}
				</span>
			) : null}
			{discardReason && !discardLive ? (
				<span role="status" data-testid="timetable-draft-strip-discard-reason" className="text-xs text-muted-foreground">
					{discardReason}
				</span>
			) : null}
			{publishReason && !publishLive ? (
				<span role="status" data-testid="timetable-draft-strip-publish-reason" className="text-xs text-muted-foreground">
					{publishReason}
				</span>
			) : null}
			{children}
		</div>
	);
}
