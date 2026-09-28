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

export type DraftStripActions = {
	/** Edit — enters the draft's manual-edit affordances for the current run. */
	onEdit: () => void;
	/** Discard draft — the workspace's existing reset-draft confirmation. */
	onDiscardDraft: () => void;
	/** Publish — the workspace's existing canonical publication dispatch. */
	onPublish: () => void;
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
	onEdit: () => void;
	onDiscardDraft: () => void;
	onPublish: () => void;
}) {
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
			    precedent for the header Undo). */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 gap-1.5 px-2 text-xs"
				disabled={!editEnabled}
				onClick={onEdit}
				data-testid="timetable-draft-strip-edit"
				aria-label={editEnabled ? 'Edit the draft schedule' : `Edit the draft schedule. ${editBlockedReason ?? ''}`}
			>
				<PencilLine className="size-3.5" aria-hidden="true" />
				Edit
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 gap-1.5 px-2 text-xs"
				disabled={!discardEnabled}
				onClick={onDiscardDraft}
				data-testid="timetable-draft-strip-discard"
			>
				<Trash2 className="size-3.5" aria-hidden="true" />
				Discard draft
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 gap-1.5 px-2 text-xs"
				disabled={!publishEnabled}
				onClick={onPublish}
				data-testid="timetable-draft-strip-publish"
				aria-label={publishEnabled ? 'Publish the schedule' : `Publish the schedule. ${publishBlockedReason ?? ''}`}
			>
				<Send className="size-3.5" aria-hidden="true" />
				Publish
			</Button>
			{editBlockedReason && !editEnabled ? (
				<span role="status" data-testid="timetable-draft-strip-edit-reason" className="text-xs text-muted-foreground">
					{editBlockedReason}
				</span>
			) : null}
			{publishBlockedReason && !publishEnabled ? (
				<span role="status" data-testid="timetable-draft-strip-publish-reason" className="text-xs text-muted-foreground">
					{publishBlockedReason}
				</span>
			) : null}
			{children}
		</div>
	);
}
