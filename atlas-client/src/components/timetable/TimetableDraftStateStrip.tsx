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
 *   - `Edit`      → the `More` menu each header ALREADY has, beside `Discard draft`
 *                   (NOT the primary slot — see the note on `TimetableDraftStateStrip`
 *                   below);
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
import { PencilLine, Trash2 } from 'lucide-react';

import { Button } from '@/ui/button';
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
 *
 * A2 C12 / ITEM 1 — the sentence is the ELASTIC part of the status region at
 * 1366 px, so `shrink-0` is withdrawn from `lg` up and the sentence truncates
 * instead. Below `lg` nothing changes.
 */
export function DraftVisibilityState({
	visibility,
}: {
	visibility: string | null;
}) {
	if (visibility === null) return null;
	return (
		<span
			className="shrink-0 text-xs font-semibold text-foreground lg:min-w-0 lg:shrink lg:truncate"
			data-testid="timetable-draft-visibility"
		>
			{visibility}
		</span>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * A2 C12 / ITEM 4 — `Edit draft` and `Discard draft` are VISIBLE, IN THE STRIP.
 *
 * Lane C's ruling, 2026-09-28, after the C11 correction-2 measurement: the strip
 * may keep its persistent state sentence, but a draft whose two own actions are
 * only reachable through a `More` menu is not something a mouse-first scheduler
 * can act on. This is the acceptance decision, and it is deliberately
 * ADDITIVE — the `More` entries stay, and they are now rendered from the SAME
 * resolved actions, so the two surfaces cannot drift.
 *
 * `DraftMenuAction` and `DraftActionButton` therefore live HERE, not in
 * `TimetableDraftActionsSurface`, because that file already imports from this one:
 * declaring the shape here keeps the dependency pointing one way and gives the
 * strip and the menu ONE definition of an action and ONE definition of the
 * control that renders it. `TimetableDraftActionsSurface` re-exports the type, so
 * every existing importer keeps its current import path unchanged.
 *
 * FOUR PROMISES, each enforced by a rendered row in
 * `__tests__/a2-c12-header-rows2.test.tsx`:
 *
 *   1. NEVER A SECOND SOLID PRIMARY. `variant="outline"`, exactly as the
 *      `More tools` rows already are. DRAFT-UX-C01 (operator, 2026-09-25) fixes
 *      the ONE `bg-primary` in this header as `Publish schedule` once a run
 *      exists, and that is not negotiable here.
 *   2. A DISABLED CONTROL STATES ITS REASON IN VISIBLE TEXT, never in a `title`
 *      and never hover-only (AGENTS.md §8). The reasons are the existing ones —
 *      `DRAFT_EDIT_NEEDS_SELECTION`, `DRAFT_DISCARD_REASON_NEEDS_DRAFT`,
 *      `DRAFT_EDIT_UNAVAILABLE`, `DRAFT_DISCARD_UNAVAILABLE` — and their truth
 *      conditions are the header's, not this file's: the caller passes the
 *      already-resolved `DraftMenuAction`s, so no previously-disabled action
 *      becomes enabled and no new gate is invented.
 *   3. THE SAME HANDLERS AS THE `More` ROWS. Both surfaces are handed the SAME
 *      objects, so "Edit draft" in the strip and "Edit draft" in the menu are one
 *      decision with one `onSelect`, not two copies of the behaviour.
 *   4. THIS SUPERSEDES THE ACCEPTED "≤6 VISIBLE CONTROLS" CAP ROW, which
 *      `draft-ux-c01` and `a2-c12-header-two-rows` still assert. Those rows are
 *      left EXACTLY as they are (AGENTS.md §16 forbids closing a finding by
 *      editing the row that found it) and their new failure is reported to the
 *      planner for adjudication rather than quietly relaxed here.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One action a surface may render.
 *
 * `visible` is whether the control is on screen at all; `enabled` is the
 * conjunction the F2 invariant is about — the caller PERMITS the action AND
 * supplied a handler. There is no combination in which `enabled` is true and the
 * control does nothing.
 */
export type DraftMenuAction = {
	visible: boolean;
	enabled: boolean;
	/** Always a sentence, so a disabled control never greys out silently. */
	reason: string;
	onSelect: () => void;
};

/** The two C11 D actions, in the order the strip and the menu both show them. */
export type DraftStripActionPair = {
	edit: DraftMenuAction;
	discard: DraftMenuAction;
};

/**
 * ONE control for one action, wherever it is rendered.
 *
 * The `More` rows and the strip's controls are the same control: same variant, same
 * height, same icon, same disabled rule, same VISIBLE reason. It is exported so
 * `TimetableDraftActionsSurface`'s `DraftMenuRow` renders this instead of keeping
 * a second copy of the same markup — the "one derivation, two renderers" defect
 * the C11 correction-2 file was written against.
 */
export function DraftActionButton({
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
		<span className="flex shrink-0 flex-col items-start gap-0.5">
			<Button
				type="button"
				/* `outline`, never `default`: the ONE solid primary in this header is
				 * `Publish schedule` (DRAFT-UX-C01), and this surface must not add a
				 * second `bg-primary`. */
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
				<span className="max-w-[16rem] text-xs text-muted-foreground" data-testid={`${testId}-reason`}>
					{action.reason}
				</span>
			)}
		</span>
	);
}

/**
 * The two visible draft actions, for the strip.
 *
 * A thin wrapper over `DraftActionButton` so the strip's callers name the two
 * controls and nothing else, and so the two `data-testid`s live with the strip
 * rather than at each call site.
 */
export function DraftStripActions({
	actions,
	editTestId,
	discardTestId,
}: {
	actions: DraftStripActionPair;
	editTestId: string;
	discardTestId: string;
}) {
	return (
		<>
			<DraftActionButton action={actions.edit} icon="edit" label="Edit draft" testId={editTestId} />
			<DraftActionButton action={actions.discard} icon="discard" label="Discard draft" testId={discardTestId} />
		</>
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
 * Correction 2 (QA-B2) moved the buttons onto controls the headers already had,
 * so each reason travelled with the control it explains. A2 C12 / ITEM 4 puts
 * `Edit draft` and `Discard draft` back on screen BESIDE the state sentence, and
 * they state the SAME sentences, from the SAME `DraftMenuAction.reason` values,
 * in the same visible-text position (below the control, never a `title`, never
 * hover-only — AGENTS.md §8). `Publish` is still not on this surface, so
 * `DRAFT_PUBLISH_UNAVAILABLE` still belongs to the header's own publication
 * control and its More-menu row.
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
 * The persistent draft-state line, and — since A2 C12 / ITEM 4 — the two VISIBLE
 * draft actions beside it.
 *
 * ── WHAT ITEM 4 CHANGED, AND WHAT IT DELIBERATELY DID NOT ─────────────────────
 *
 * C11 CORRECTION 2 (QA-B2) removed this component's three buttons on a real
 * measurement: they took the Simple header from the accepted SIX visible controls
 * to NINE, and they put TWO publication controls on screen — this strip's
 * `Publish` and the header's existing `timetable-simple-publish-action`. The
 * 2026-09-28 Lane C ruling keeps that measurement's conclusion for the ONE solid
 * primary and for the publication control (which stays the header's own), and
 * reverses the other half: a draft whose `Edit draft` and `Discard draft` live only
 * inside a `More` menu is not actionable for a mouse-first scheduler, and the
 * scheduler reached them.
 *
 * So this component now renders the SENTENCE and, beside it, THOSE TWO actions —
 * and only those two. `Publish` is still NOT here, and this file's header comment's
 * accounting still holds.
 *
 * ── WHY THE ACTIONS ARE SIBLINGS OF THE SENTENCE ELEMENT ─────────────────────
 * `data-testid="timetable-draft-state-strip"` is the SENTENCE's addressable
 * element, and a committed row reads its `textContent` and requires it to be
 * exactly the state word (`a2-c11-s2-header-labels.test.tsx`, the published-run
 * precondition: `=== 'Published'`). Rendering the controls inside that element
 * would have changed an accepted contract to serve this one. Rendering them as
 * SIBLINGS of it — the same component, the same row, immediately after the
 * sentence — keeps that contract byte-exact AND is the better layout: as flex
 * children of the status row the two controls are `shrink-0` and the sentence
 * truncates beside them (A2 C12 item 1), instead of the sentence being boxed
 * inside a wrapper that would have to compete with them for width.
 *
 * `children` is DEAD and is kept only for one more correction cycle, so this
 * correction stays additive: NEITHER header passes it (`TimetableSimpleHeader` and
 * `ScheduleReviewWorkspaceHeader` both render `<TimetableDraftStateStrip
 * visibility={…} />` with no children — the single Undo / Redo / History control is
 * the header's own toolbar control, the one instance the M5 single-surface rule
 * counts). It is retained solely so the pre-existing `M5` row in
 * `a2-c11-draft-actions.test.tsx`, which constructs the strip WITH children, keeps
 * running; that row is marked SUPERSEDED beside its replacement, which renders the
 * REAL header. Remove the prop and that row together — do not remove the prop alone,
 * and do not let a dead prop keep a JSDoc claim about the layout.
 *
 * This JSDoc previously claimed two things the code stopped doing: that `children`
 * was "the single Undo … handed to both headers", and that `Edit` occupies "the
 * header's own PRIMARY action slot". Both were true of the pre-correction design
 * and were reverted: `Edit draft` is NOT the primary — it is `outline`, beside the
 * state sentence and in the More menu — and the ONE solid primary is
 * `Publish schedule` (DRAFT-UX-C01, operator, 2026-09-25).
 */
export function TimetableDraftStateStrip({
	visibility,
	actions,
	children,
}: {
	visibility: string | null;
	/**
	 * A2 C12 / ITEM 4 — the ALREADY-RESOLVED `Edit draft` / `Discard draft` actions,
	 * or `null` for a surface that does not offer them (the Expert orientation row,
	 * which keeps its own `More tools` rows, and every caller with no run on screen).
	 * The caller owns the gates; this component renders the decision.
	 */
	actions?: DraftStripActionPair | null;
	/**
	 * DEAD: no production caller passes it (see the note above). Kept only so the
	 * superseded `M5` row still compiles and runs.
	 */
	children?: React.ReactNode;
}) {
	return (
		<>
			<span
				/* A2 C12 / ITEM 1 — the sentence is the elastic part of the status row at
				 * 1366 px, so the strip does not wrap its own children from `lg` up. The
				 * two actions beside it are `shrink-0` (in `DraftActionButton`), so it is
				 * the SENTENCE that gives up width, never a control. */
				className="inline-flex min-w-0 flex-wrap items-center gap-1.5 lg:flex-nowrap"
				data-testid="timetable-draft-state-strip"
			>
				<DraftVisibilityState visibility={visibility} />
				{children}
			</span>
			{/* A2 C12 / ITEM 4 — Lane C's ruling. Same handlers, same guards, same
			 * results as the `More` menu rows: both surfaces are handed the SAME
			 * resolved `DraftMenuAction` objects by the header. */}
			{actions ? (
				<DraftStripActions
					actions={actions}
					editTestId="timetable-draft-strip-edit"
					discardTestId="timetable-draft-strip-discard"
				/>
			) : null}
		</>
	);
}
