/**
 * C11 D, CORRECTION 2 (QA-B2) — where the three draft actions LIVE once the
 * draft strip stopped rendering buttons of its own.
 *
 * ── THE DEFECT THIS FILE EXISTS TO CLOSE ──────────────────────────────────────
 *
 * The first cut gave `TimetableDraftStateStrip` three buttons (Edit · Discard
 * draft · Publish). Fresh independent QA measured the consequence on the REAL
 * Simple header at 1366 px: it went from the accepted SIX visible controls to
 * NINE, and it put TWO publication controls on screen at once — the strip's
 * `Publish` and the header's existing one. For a scheduler that is the
 * operator-facing form of "one derivation, two renderers": the same verb, twice,
 * on the same screen.
 *
 * So the strip keeps exactly what the packet asked for — a persistent,
 * always-visible state SENTENCE, derived once from `describeRunState` — and the
 * three actions resolved onto controls the headers ALREADY have:
 *
 *   - `Edit`    → Simple: the EXISTING `More` menu, beside `Discard draft`
 *                 (`SimpleEditDraftAction`); Expert: the `More tools` menu, beside
 *                 the actions it belongs with. DRAFT-UX-C01 (operator,
 *                 2026-09-25) keeps the Simple header's ONE solid primary as
 *                 `Publish schedule` once a run exists, so the draft's own verb
 *                 is a menu entry and the primary is not traded for it.
 *   - `Publish` → each header's own publication control. Exactly ONE is ever on
 *                 screen: Simple shows it in the primary slot or in More, never
 *                 both, and Expert's is `TimetableExpertPublishControl`.
 *   - `Discard` → the existing `More` menu, with a VISIBLE reason when disabled.
 *
 * ── WHY THE GATES LIVE HERE AND NOT IN EITHER MENU ────────────────────────────
 *
 * Each header already owns ONE `resolveDraftStripProps` derivation, and the
 * rendered rows prove the menu entries cannot disagree with the primary about
 * whether an action is available. A menu that re-derived its own gate would be
 * the second-renderer defect this correction exists to remove, so the resolvers
 * below are PURE: they take the header's decision and return what to render.
 * `SimpleMoreMenuContent` renders exactly what `resolveSimpleDraftMenuActions`
 * returned, and `TimetableExpertDraftActions` renders exactly what
 * `resolveExpertDraftMenuActions` returned.
 *
 * Every reason below is VISIBLE TEXT beside the control it explains — never a
 * `title`, never hover-only (AGENTS.md §8).
 */
import { PencilLine, Trash2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { GatedAction } from '@/components/timetable/simple/SimpleHeaderHelpers';
import {
	DRAFT_DISCARD_REASON_NEEDS_DRAFT,
	DRAFT_DISCARD_UNAVAILABLE,
	DRAFT_EDIT_NEEDS_SELECTION,
	DRAFT_EDIT_UNAVAILABLE,
	DRAFT_PUBLISH_UNAVAILABLE,
	type DraftStripResolvedProps,
} from '@/components/timetable/TimetableDraftStateStrip';
import type { SimpleHeaderPrimary } from '@/components/timetable/simple/SimpleHeaderActions';

/**
 * One action a menu may render. `visible` is whether the ROW is on screen at all
 * (a duplicate of the header's own control is not rendered twice); `enabled` is
 * the conjunction the F2 invariant is about — the caller PERMITS the action AND
 * supplied a handler. There is no combination in which `enabled` is true and the
 * row does nothing.
 */
export type DraftMenuAction = {
	visible: boolean;
	enabled: boolean;
	/** Always a sentence, so a disabled row never greys out silently. */
	reason: string;
	onSelect: () => void;
};

export type SimpleDraftMenuActions = {
	/** `null` when the header's own primary IS the publication control. */
	publish: DraftMenuAction | null;
	edit: DraftMenuAction;
	discard: DraftMenuAction;
};

/**
 * The Simple header's More-menu draft entries: `Edit draft` · `Discard draft`
 * (plus `Publish` while the primary slot is not the publication control).
 *
 * `Edit draft` is here because DRAFT-UX-C01 (operator, 2026-09-25) fixes the
 * Simple header's ONE solid primary as `Publish schedule` once a run exists. The
 * draft's own verb is a real action, so it is not lost — it moves into the menu
 * that is already on screen, next to `Discard draft`, adding no header control.
 *
 * `Publish` is `null` — i.e. the row is not rendered — whenever the header's
 * primary slot already IS a publication control (`publish`) or the run is already
 * published (`published`). That single condition is the fix for "two publication
 * controls on screen at once": the two surfaces are mutually exclusive by
 * construction, and both read the same `headerPrimary`.
 */
export function resolveSimpleDraftMenuActions(input: {
	headerPrimary: SimpleHeaderPrimary;
	draftStrip: DraftStripResolvedProps;
	onPublish: () => void;
	onEdit: (() => void) | null;
	onDiscard: (() => void) | null;
}): SimpleDraftMenuActions {
	return {
		publish: input.headerPrimary === 'publish' || input.headerPrimary === 'published'
			? null
			: {
				visible: true,
				enabled: input.draftStrip.publishEnabled,
				reason: input.draftStrip.publishBlockedReason ?? DRAFT_PUBLISH_UNAVAILABLE,
				onSelect: input.onPublish,
			},
		// The SAME gate the More-menu `Manual edit` entry and Expert's `Edit draft`
		// row read: a manual edit needs a selected class, and a surface that offers
		// no handler renders it disabled. There is no state in which the row is
		// enabled and inert.
		edit: {
			visible: true,
			enabled: input.draftStrip.editEnabled && input.onEdit !== null,
			reason: input.onEdit !== null
				? input.draftStrip.editBlockedReason ?? DRAFT_EDIT_NEEDS_SELECTION
				: DRAFT_EDIT_UNAVAILABLE,
			onSelect: () => input.onEdit?.(),
		},
		discard: {
			visible: true,
			enabled: input.draftStrip.discardEnabled && input.onDiscard !== null,
			reason: input.onDiscard !== null
				? DRAFT_DISCARD_REASON_NEEDS_DRAFT
				: DRAFT_DISCARD_UNAVAILABLE,
			onSelect: () => input.onDiscard?.(),
		},
	};
}

/**
 * C11 D, correction 2 (QA-B2) — the draft's own verb: `Edit draft`.
 *
 * This control MOVED here from the Simple header's ONE primary slot, which
 * reversed DRAFT-UX-C01 (operator, 2026-09-25) — see
 * `resolveSimpleHeaderPrimary`, which now keeps `Publish schedule` as the solid
 * primary once a run exists. It is MOVED, not rewritten: this is the only
 * definition of the control in the workspace, now rendered as an entry of the
 * More menu that is already on screen, beside `Discard draft`.
 *
 * Its blocked reason is printed BESIDE the control, not only on hover or in a
 * `title` (AGENTS.md §8) — the same shape `SimplePublishAction` and the
 * `Discard draft` entry use.
 */
export function SimpleEditDraftAction({
	enabled,
	disabledReason,
	primary,
	onClick,
}: {
	enabled: boolean;
	disabledReason: string | null;
	primary: boolean;
	onClick: () => void;
}) {
	const reason = enabled ? null : disabledReason;
	return (
		<span className="flex min-w-0 flex-col items-start gap-0.5">
			<GatedAction disabled={!enabled} reason={reason}>
				<Button
					type="button"
					variant={primary ? 'default' : 'outline'}
					size="sm"
					className="h-11 gap-1.5 px-3 text-sm"
					disabled={!enabled}
					aria-label={reason ? `Edit draft — ${reason}` : 'Edit draft'}
					onClick={onClick}
					data-testid="timetable-simple-edit-draft-action"
				>
					<PencilLine className="size-3.5" aria-hidden="true" />
					<span>Edit draft</span>
				</Button>
			</GatedAction>
			{reason ? (
				<p className="max-w-[22rem] text-xs font-medium text-muted-foreground" data-testid="timetable-edit-draft-blocked-reason">
					{reason}
				</p>
			) : null}
		</span>
	);
}

export type ExpertDraftMenuActions = {
	edit: DraftMenuAction;
	discard: DraftMenuAction;
};

/**
 * The Expert header's two `More tools` entries.
 *
 * `Edit` is gated on the SAME fact Simple's `Edit draft` primary and the
 * More-menu `Manual edit` entry read — `hasSelectedEntry` — because a manual
 * edit needs a selected class. `Discard` is gated on a draft existing, which is
 * the workspace's EXISTING reset-draft confirmation, unchanged.
 *
 * `ExpertDraftMenuActions` is exported separately from the resolver so a test can
 * render the real entries without mounting the 990-line header; the rendered rows
 * still drive the resolver, never a test-local copy of the gate.
 */
export function resolveExpertDraftMenuActions(input: {
	hasSelectedClass: boolean;
	hasDraft: boolean;
	onEdit: (() => void) | null;
	onDiscard: (() => void) | null;
}): ExpertDraftMenuActions {
	return {
		edit: {
			visible: true,
			enabled: input.hasSelectedClass && input.onEdit !== null,
			reason: input.onEdit !== null ? DRAFT_EDIT_NEEDS_SELECTION : DRAFT_EDIT_UNAVAILABLE,
			onSelect: () => input.onEdit?.(),
		},
		discard: {
			visible: true,
			enabled: input.hasDraft && input.onDiscard !== null,
			reason: input.onDiscard !== null ? DRAFT_DISCARD_REASON_NEEDS_DRAFT : DRAFT_DISCARD_UNAVAILABLE,
			onSelect: () => input.onDiscard?.(),
		},
	};
}

/** One menu row: the control, and — when it cannot act — the sentence beside it. */
function DraftMenuRow({
	action,
	icon,
	label,
	testId,
}: {
	action: DraftMenuAction;
	icon: 'edit' | 'discard';
	label: string;
	testId: string;
}) {
	if (!action.visible) return null;
	const Icon = icon === 'edit' ? PencilLine : Trash2;
	return (
		<span className="flex flex-col items-start gap-0.5">
			<Button
				variant="outline"
				size="sm"
				className="h-8 shrink-0 gap-1.5"
				disabled={!action.enabled}
				onClick={action.onSelect}
				aria-label={action.enabled ? label : `${label} — ${action.reason}`}
				data-testid={testId}
			>
				<Icon className="size-3.5" aria-hidden="true" />
				{label}
			</Button>
			{action.enabled ? null : (
				<span className="text-xs text-muted-foreground" data-testid={`${testId}-reason`}>
					{action.reason}
				</span>
			)}
		</span>
	);
}

/**
 * The two C11 D actions in the Expert header's EXISTING `More tools` menu.
 *
 * Extracted from `ScheduleReviewWorkspaceHeader` (990 physical lines against the
 * 1000-line cap, AGENTS.md §8) for the same reason the strip's own derivation was
 * extracted: the header was already at its budget before these two entries landed.
 *
 * The rows carry the same `variant="outline" size="sm" h-8` shape as the rest of
 * that menu, so the menu keeps one row rhythm, and the menu itself is the control
 * that is already on screen — nothing is added to the header's control count.
 */
export function TimetableExpertDraftActions({
	hasSelectedClass,
	hasDraft,
	onEdit,
	onDiscard,
}: {
	hasSelectedClass: boolean;
	hasDraft: boolean;
	onEdit: (() => void) | null;
	onDiscard: (() => void) | null;
}) {
	const actions = resolveExpertDraftMenuActions({ hasSelectedClass, hasDraft, onEdit, onDiscard });
	return (
		<>
			<DraftMenuRow action={actions.edit} icon="edit" label="Edit draft" testId="timetable-expert-edit-draft" />
			<DraftMenuRow action={actions.discard} icon="discard" label="Discard draft" testId="timetable-expert-discard-draft" />
		</>
	);
}
