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
 *                 (a `DropdownMenuItem` in `SimpleMoreMenuContent`; see the note
 *                 above `ExpertDraftMenuActions` for why it is not defined here);
 *                 Expert: the `More tools` menu, beside
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
import {
	DraftActionButton,
	DRAFT_DISCARD_REASON_NEEDS_DRAFT,
	DRAFT_DISCARD_UNAVAILABLE,
	DRAFT_EDIT_NEEDS_SELECTION,
	DRAFT_EDIT_UNAVAILABLE,
	DRAFT_PUBLISH_UNAVAILABLE,
	type DraftMenuAction,
	type DraftStripResolvedProps,
} from '@/components/timetable/TimetableDraftStateStrip';
import type { SimpleHeaderPrimary } from '@/components/timetable/simple/SimpleHeaderActions';

/**
 * One action a surface may render: `visible` is whether the control is on screen
 * at all, and `enabled` is the conjunction the F2 invariant is about — the caller
 * PERMITS the action AND supplied a handler. There is no combination in which
 * `enabled` is true and the control does nothing.
 *
 * A2 C12 / ITEM 4 — the type and the CONTROL that renders it now live in
 * `TimetableDraftStateStrip` (`DraftMenuAction`, `DraftActionButton`), because the
 * draft strip shows the same two actions VISIBLY beside the state sentence. The
 * type is re-exported here so every existing importer keeps its current import
 * path, and so `DraftMenuRow` below and the strip are demonstrably the same
 * control rather than two renderers of one idea.
 */
export type { DraftMenuAction };

/**
 * The three resolved draft actions.
 *
 * A2 C12 / ITEM 4 — its `{ edit, discard }` half is `DraftStripActionPair`,
 * exported from `TimetableDraftStateStrip` because that is where the strip's
 * visible controls are defined. A caller that renders the strip passes
 * `simpleDraftMenuActions` straight through; it does not re-shape the object.
 */
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
 * C11 D, CORRECTION 4 (F1) — `SimpleEditDraftAction` is GONE, and this comment is
 * the record of why.
 *
 * It rendered `Edit draft` as a bare `<Button>` inside `DropdownMenuContent`, so the
 * row carried `role=null` and no `tabindex`: Radix roving focus skipped the draft's
 * own verb, a keyboard user could not reach it while the menu was open, and — unlike
 * both its siblings in the same group — it never called `onClose()`, so clicking it
 * left the More menu open. The reviewer measured exactly that on the rendered Simple
 * header: 15 sibling rows with `role="menuitem"`, this one with `role=null`.
 *
 * The row now lives in `SimpleMoreMenuContent` as a real `DropdownMenuItem`, beside
 * `Publish schedule` and `Discard draft`, and `SimpleMoreMenuContent` is its ONLY
 * renderer — which is also why the dead `primary` prop could go with it: it was the
 * vestige of the reverted primary-swap design, its only caller passed
 * `primary={false}`, and inside a menu row it has no variant to choose. One
 * definition, one renderer; the alternative would have been a second, divergent
 * definition of the same verb.
 *
 * The blocked reason did not move with the element: `SimpleMoreMenuContent` prints
 * it as VISIBLE TEXT inside the row, which is where `Publish schedule` and
 * `Discard draft` already print theirs (AGENTS.md §8 — never a `title`, never
 * hover-only).
 */
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
	/* A2 C12 / ITEM 4 — the SHARED control. This was a second, private copy of the
	 * markup the draft strip now renders for the same two actions; it is
	 * `DraftActionButton`, so the two surfaces cannot drift on their variant, their
	 * height, their icon, their disabled rule or the position of their visible
	 * reason. */
	return <DraftActionButton action={action} icon={icon} label={label} testId={testId} />;
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
			<DraftMenuRow action={actions.edit} icon="edit" label="Edit" testId="timetable-expert-edit-draft" />
			<DraftMenuRow action={actions.discard} icon="discard" label="Discard" testId="timetable-expert-discard-draft" />
		</>
	);
}
