/**
 * LANE-C DRAFT-UX-C01 — the Simple header's relaxed action set.
 *
 * Operator decision (2026-09-25): at ≥1280 px the header shows at most six
 * controls — Term · View · schedule picker · ONE merged warnings control ·
 * ONE primary action · More. The primary is `Generate` while the school
 * year/term has no generated run and `Publish schedule` once a run exists; the
 * other one, `Download schedules`, `School information`, and every former
 * lifecycle next step move into a labelled More group. Placement changes only:
 * each moved action keeps its gate, its disabled reason and its dispatch.
 *
 * The Simple layout has no left rail, so the unassigned sessions entry also
 * lives here ("Unassigned sessions (N)"), counted for the selected term only
 * (invariant 2: a missing term is never Term 1).
 */
import type { ReactNode } from 'react';
import { CalendarClock, ClipboardList, Download, Play, RefreshCw, Settings2, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { BUILD_NEW_DRAFT_LABEL, PUBLISHED_SCHEDULE_STAYS_IN_USE } from '@/lib/timetable-plain-language';
import { Button } from '@/ui/button';
import { DropdownMenuItem, DropdownMenuLabel } from '@/ui/dropdown-menu';
import type { SimpleLifecycleKind } from '@/lib/simple-timetable-state';

/* ------------------------------------------------------------------ *
 * Pure decisions
 * ------------------------------------------------------------------ */

export type SimpleHeaderPrimary = 'generate' | 'publish' | 'published' | 'none';

/**
 * The one visible primary. `Generate` with no generated run; `Publish schedule`
 * once a run exists; the `Published` status surface when the run is already
 * published. A published run viewed from the working draft shows no primary,
 * exactly as before.
 *
 * ── DRAFT-UX-C01 (operator, 2026-09-25) — THE DECISION THIS SLOT OBEYS ─────────
 *
 * DRAFT-UX-C01 fixes the Simple header at AT MOST SIX visible controls at
 * ≥1280 px with exactly ONE solid primary: `Generate` while the school
 * year/term has no generated run, and `Publish schedule` once a run exists.
 * Fifteen test files were re-pinned to implement it.
 *
 * The C11 correction briefly traded that primary for the draft's own verb: when a
 * run existed and was not published, the one solid control said `Edit draft` and
 * `Publish` moved into the More menu. That reversed an accepted operator
 * decision, so it is reverted — `Publish` is the solid primary once a run exists.
 *
 * The control-count arithmetic that motivated the swap is still satisfied, and it
 * is satisfied WITHOUT moving the primary: the draft state strip renders a
 * SENTENCE and no control, and the draft's own actions live in the More menu
 * beside `Discard draft`. So the header still shows six controls, still has one
 * solid action, and still has exactly ONE publication control on screen in every
 * state.
 *
 * This is one pure function precisely so the next slice can flip the
 * primary ↔ More split without touching the header.
 */
export function resolveSimpleHeaderPrimary(input: {
	hasGeneratedRun: boolean;
	isRunPublished: boolean;
	isPreGenerationWorkspace: boolean;
}): SimpleHeaderPrimary {
	if (!input.hasGeneratedRun) return 'generate';
	if (!input.isRunPublished) return 'publish';
	return input.isPreGenerationWorkspace ? 'none' : 'published';
}

export type SimpleWarningsDispatch = 'generation-blockers' | 'readiness-sheet' | 'review-issues' | 'none';

/**
 * The merged warnings control does what the former count badge + lifecycle
 * primary pair did: `Fix blockers` opened the readiness sheet, `Review
 * warnings` started the review-issues task (behind the issue-review gate).
 *
 * C2-a adds a third dispatch, `generation-blockers`. When generation itself is
 * blocked, this control is otherwise DISABLED (a blocked school year has no
 * generated run to review), so it was a dead control in the one state where
 * the scheduler most needs a way in. Pointing it at the real blocker list
 * closes the dead end and adds NO header control: the cap is unchanged, and
 * `Review issues` is not lost because it returns to the More menu.
 */
export function resolveWarningsControlDispatch(input: {
	lifecycleKind: SimpleLifecycleKind;
	issueReviewEnabled: boolean;
	/**
	 * C2-a: how many generation blockers the canonical diagnostic reports. Only a
	 * real count opens the list, so a blocked state whose own check did not
	 * finish never claims to show items it cannot list.
	 */
	generationBlockerCount?: number;
}): SimpleWarningsDispatch {
	if ((input.generationBlockerCount ?? 0) > 0) return 'generation-blockers';
	if (input.lifecycleKind === 'fix-blockers') return 'readiness-sheet';
	if (input.issueReviewEnabled) return 'review-issues';
	return 'none';
}

/**
 * Former lifecycle next steps that neither the visible primary nor the
 * warnings control owns keep one More entry, so no action becomes unreachable.
 */
export function lifecycleStepNeedsMoreEntry(kind: SimpleLifecycleKind): boolean {
	return kind === 'fix-setup'
		|| kind === 'retry-readiness'
		|| kind === 'retry-generate'
		|| kind === 'start-draft'
		|| kind === 'review-follow-ups';
}

type TermScopedItem = { termIndex?: number | null };

/**
 * Unassigned sessions of the selected term only. `all` counts every item; an
 * unknown or missing selection counts nothing (never Term 1 by default).
 */
export function countUnassignedForSelectedTerm(items: readonly TermScopedItem[] | null | undefined, termFilter: number | 'all' | null | undefined): number {
	if (!items || items.length === 0) return 0;
	if (termFilter === 'all') return items.length;
	if (typeof termFilter !== 'number' || !Number.isInteger(termFilter)) return 0;
	return items.filter((item) => item.termIndex === termFilter).length;
}

/* ------------------------------------------------------------------ *
 * The merged warnings control
 * ------------------------------------------------------------------ */

/**
 * The count badge and `Review warnings` as ONE control: the shared readiness
 * chip (`SimpleReadinessChip`, the same implementation the setup pane shows)
 * becomes the button face, and the click does what the removed lifecycle
 * primary did in the warning states. With nothing to review it stays a
 * visible, disabled status (never hidden).
 */
export function SimpleWarningsControl({
	readiness,
	dispatch,
	onClick,
	children,
}: {
	readiness: string;
	dispatch: SimpleWarningsDispatch;
	onClick: () => void;
	/** The readiness chip rendered as the control's face. */
	children: ReactNode;
}) {
	const actionName = dispatch === 'generation-blockers'
		? 'See what to fix'
		// LANE-C-PLAIN-LANGUAGE-C03 (J1) — this action name used to say
		// "Fix blockers" while the count beside it said "Must fix", so the one
		// merged control still carried two names for one idea. The dispatch value
		// ('readiness-sheet') and the destination are unchanged; only the words are.
		: dispatch === 'readiness-sheet' ? 'Fix must-fix problems' : 'Review warnings';
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="h-auto min-w-0 shrink rounded-full p-0 hover:bg-transparent hover:opacity-90 disabled:opacity-100"
			disabled={dispatch === 'none'}
			aria-label={dispatch === 'none' ? readiness : `${actionName}: ${readiness}`}
			onClick={onClick}
			data-testid="timetable-simple-warnings-control"
			data-warnings-dispatch={dispatch}
		>
			{children}
		</Button>
	);
}

/* ------------------------------------------------------------------ *
 * More → "Schedule actions"
 * ------------------------------------------------------------------ */

/*
 * C11 S2 (T3b) — ONE verb for this action, everywhere it is named.
 *
 * The recorded defect: the More row said "Generate" while the dialog that row
 * opens says "Build a new draft". An older scheduler saw two names for one action
 * and had to guess whether the second one was a different action.
 *
 * `PUBLISHED_GENERATE_LABEL` IS `BUILD_NEW_DRAFT_LABEL` (#56 collapsed the
 * published branch onto it), so the remaining branch was the only one still saying
 * "Generate" — and it was saying it in the state a scheduler spends most of their
 * time in: a draft run, not yet published.
 *
 * The aria-label carried the same split ("Generate schedule" beside "Build a new
 * draft"), which is worse than the visible text: the accessible name and the label
 * the scheduler reads could differ for one control. Both now read the constant.
 *
 * Three source-regex rows pinned the old wording
 * (`timetable-header-collapse-c01`, `ux-audit-findings-c01`,
 * `schedule-clarity-c03`). They are marked superseded in place; the intent each
 * encoded — a published run is never offered a destructive-sounding verb — is now
 * carried by the single constant and asserted RENDERED on the real More menu in
 * `a2-c11-s2-header-banners.test.tsx`.
 */

export type SimpleMoreScheduleActionsProps = {
	onClose: () => void;
	/** Download schedules — only once a generated run exists (unchanged). */
	downloadAvailable: boolean;
	onOpenDownloadSchedules: () => void;
	/** `School information` / `Check school information` (drift). */
	schoolInformationLabel: string;
	/** The non-visible primary: Generate once a run exists. */
	generate: { visible: boolean; disabled: boolean; reason: string | null; published: boolean; onSelect: () => void };
	/** Preview demand (generation ready, no run yet) — unchanged gate. */
	previewDemand: { visible: boolean; disabled: boolean; onSelect: () => void };
	/** Return to the published schedule from the working draft — unchanged gate. */
	returnToPublished: { visible: boolean; onSelect: () => void };
	/** A former lifecycle next step that no visible control owns. */
	nextStep: { label: string; disabled: boolean; href: string | null; onSelect: () => void } | null;
};

export function SimpleMoreScheduleActions({
	onClose,
	downloadAvailable,
	onOpenDownloadSchedules,
	schoolInformationLabel,
	generate,
	previewDemand,
	returnToPublished,
	nextStep,
}: SimpleMoreScheduleActionsProps) {
	return (
		<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-schedule-actions">
			<DropdownMenuLabel className="px-0 py-0 text-xs">Schedule actions</DropdownMenuLabel>
			{nextStep ? (
				nextStep.href ? (
					<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-next-step">
						<Link to={nextStep.href} onClick={onClose}>
							<Settings2 className="size-3.5" aria-hidden="true" />
							Next step: {nextStep.label}
						</Link>
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem
						className="h-9 gap-2 text-xs"
						disabled={nextStep.disabled}
						onSelect={(event) => { event.preventDefault(); onClose(); nextStep.onSelect(); }}
						data-testid="timetable-more-next-step"
					>
						<RefreshCw className="size-3.5" aria-hidden="true" />
						Next step: {nextStep.label}
					</DropdownMenuItem>
				)
			) : null}
			{generate.visible ? (
				<DropdownMenuItem
					className={cn('gap-2 text-xs', generate.disabled ? 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100' : 'h-9')}
					disabled={generate.disabled}
					onSelect={(event) => { event.preventDefault(); onClose(); generate.onSelect(); }}
					aria-label={generate.reason ? `${BUILD_NEW_DRAFT_LABEL} — ${generate.reason}` : undefined}
					data-testid="timetable-more-generate"
				>
					<Play className={cn('size-3.5', generate.disabled && 'mt-0.5 text-muted-foreground')} aria-hidden="true" />
					{generate.disabled && generate.reason ? (
						<span className="flex flex-col">
							<span className="text-muted-foreground">{BUILD_NEW_DRAFT_LABEL}</span>
							<span className="text-xs text-muted-foreground" data-testid="timetable-more-generate-reason">{generate.reason}</span>
						</span>
					) : generate.published ? (
						/* #56 — the label now names a DRAFT, so the row also says, in
						 * words next to it, that the schedule in use is untouched.
						 * That is the whole point of the rename: "New version" could be
						 * read as editing the published one. */
						<span className="flex flex-col">
							<span>{BUILD_NEW_DRAFT_LABEL}</span>
							<span className="text-xs text-muted-foreground" data-testid="timetable-more-generate-published-note">
								{PUBLISHED_SCHEDULE_STAYS_IN_USE}
							</span>
						</span>
					) : (
						<span>{BUILD_NEW_DRAFT_LABEL}</span>
					)}
				</DropdownMenuItem>
			) : null}
			{previewDemand.visible ? (
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={previewDemand.disabled}
					onSelect={(event) => { event.preventDefault(); onClose(); previewDemand.onSelect(); }}
					data-testid="timetable-unassigned-insertion-action"
				>
					<CalendarClock className="size-3.5" aria-hidden="true" />
					Preview demand
				</DropdownMenuItem>
			) : null}
			{returnToPublished.visible ? (
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => { event.preventDefault(); onClose(); returnToPublished.onSelect(); }}
					data-testid="timetable-return-to-published"
				>
					<Undo2 className="size-3.5" aria-hidden="true" />
					Return to published
				</DropdownMenuItem>
			) : null}
			{downloadAvailable ? (
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => { event.preventDefault(); onClose(); onOpenDownloadSchedules(); }}
					data-testid="timetable-open-download-schedules"
				>
					<Download className="size-3.5" aria-hidden="true" />
					Download schedules
				</DropdownMenuItem>
			) : null}
			<DropdownMenuItem asChild className="h-9 gap-2 text-xs">
				<Link to="/timetable/setup" onClick={onClose} data-testid="timetable-simple-review-setup">
					<Settings2 className="size-3.5" aria-hidden="true" />
					{schoolInformationLabel}
				</Link>
			</DropdownMenuItem>
		</div>
	);
}

/**
 * "Unassigned sessions (N)" — the Simple layout's path to the unassigned list.
 * Disabled with its reason at 0; never hidden, so a non-zero count is never
 * silently lost.
 */
export function SimpleUnassignedSessionsItem({
	count,
	termLabel,
	unavailableReason,
	onClose,
	onOpen,
}: {
	count: number;
	termLabel: string;
	/** A reason the list cannot open even with items (e.g. no generated run). */
	unavailableReason: string | null;
	onClose: () => void;
	onOpen: () => void;
}) {
	const reason = unavailableReason ?? (count === 0 ? `No unassigned sessions in ${termLabel}.` : null);
	const disabled = reason != null;
	return (
		<DropdownMenuItem
			className={cn('gap-2 text-xs', disabled ? 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100' : 'h-9')}
			disabled={disabled}
			onSelect={(event) => { event.preventDefault(); onClose(); onOpen(); }}
			data-testid="timetable-more-unassigned-sessions"
			data-unassigned-count={count}
		>
			<ClipboardList className={cn('size-3.5', disabled && 'mt-0.5 text-muted-foreground')} aria-hidden="true" />
			{disabled ? (
				<span className="flex flex-col">
					<span className="text-muted-foreground">Unassigned sessions ({count})</span>
					<span className="text-xs text-muted-foreground" data-testid="timetable-more-unassigned-sessions-reason">{reason}</span>
				</span>
			) : (
				<span>Unassigned sessions ({count})</span>
			)}
		</DropdownMenuItem>
	);
}
