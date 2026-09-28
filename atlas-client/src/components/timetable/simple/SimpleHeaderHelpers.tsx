import { useMemo } from 'react';
import { ArrowRightLeft, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, GraduationCap, ListChecks, Play, Send, SlidersHorizontal, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { BUILD_NEW_DRAFT_LABEL, mustFixCountLabel, PUBLISHED_SCHEDULE_STAYS_IN_USE } from '@/lib/timetable-plain-language';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { SearchableSelect } from '@/ui/searchable-select';
import { SELECT_TRIGGER_PICKER_CLASS } from '@/ui/select';
import type { TimetableCapabilities } from '@/lib/timetable-capabilities';
import type { SimpleLifecycleKind } from '@/lib/simple-timetable-state';
import { formatCheckedAtAge } from '@/components/timetable/timetableWorkspaceTruth';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
/* ROW 37 / A2-UX-MENU-C2 — the tutorial moved to its own module so this file
 * stays inside the 1000-line component budget. Both exports are re-exported here
 * so `TimetableSimpleHeader`, the committed source contracts and every existing
 * importer keep their current import path unchanged. */
export { SimpleTutorialControl, simpleTutorialSteps } from '@/components/timetable/simple/SimpleTutorial';

type SimpleTaskDefinition = {
	id: TimetableSimpleTask;
	label: string;
	primaryLabel: string;
	helper: string;
	icon: LucideIcon;
	badge?: string;
	disabled?: boolean;
	href?: string;
};

type SimpleViewMode = ScheduleReviewWorkspaceHeaderContext['viewMode'];

export type { SimpleViewMode };

/** Simple mode always starts with the complete schedule; Expert review keeps
 * its independent filters and can reapply them deliberately. */
export function resetSimpleWorkspaceFilters(context: Pick<ScheduleReviewWorkspaceHeaderContext,
	'programFilter' | 'entryKindFilter' | 'severityFilter' | 'setProgramFilter' | 'setEntryKindFilter' | 'setSeverityFilter'>) {
	if (context.programFilter !== 'all') context.setProgramFilter('all');
	if (context.entryKindFilter !== 'all') context.setEntryKindFilter('all');
	if (context.severityFilter !== 'all') context.setSeverityFilter('all');
}

export function taskCount(count: number, noun: string) {
	if (count <= 0) return undefined;
	return count > 99 ? `99+ ${noun}` : `${count} ${noun}`;
}

export function sourceLabel(context: ScheduleReviewWorkspaceHeaderContext) {
	const sourceContext = context.schoolYearContext;
	if (!sourceContext) return 'Checking source';
	if (sourceContext.source === 'enrollpro-verified') return 'Verified with EnrollPro';
	if (sourceContext.source === 'enrollpro') return 'Using EnrollPro settings';
	if (sourceContext.source === 'cache') {
		// D4 (TIMETABLE-TRUTHFULNESS-C01) — the Simple header used to describe
		// the school year by its storage mechanism, which reads as staleness
		// even when the value on screen is fresh (`stale:false`) and was
		// confirmed upstream. Name the authority, what the value is, and when
		// it was last checked instead of the storage mechanism; when the copy
		// is older and a background recheck is in flight, say that plainly.
		if (sourceContext.stale) return 'School year from ATLAS, rechecking';
		const checkedAge = formatCheckedAtAge(sourceContext.cachedAt);
		return checkedAge
			? `School year from ATLAS, ${checkedAge}`
			: 'School year from ATLAS, up to date';
	}
	return 'Using saved ATLAS data';
}

export function readinessLabel(context: ScheduleReviewWorkspaceHeaderContext) {
	const yearLabel = context.schoolYearContext?.activeSchoolYearLabel;
	if (context.isPreGenerationWorkspace) {
		if (context.curriculumReadiness?.state === 'loading') return 'Checking schedule information…';
		if (context.curriculumReadiness?.state === 'failed' || context.curriculumReadiness?.state === 'unavailable') {
			return 'Schedule check needs retry';
		}
		return 'Working schedule draft';
	}
	if (!context.draft) return yearLabel ? `No ${yearLabel} timetable yet` : 'No current-year timetable yet';
	const summaryRaw = context.draft.summary as unknown as Record<string, unknown> | null;
	const isPublished = summaryRaw?.isPublished === true;
	if (isPublished) {
		/* A2 HEADER-BUDGET, CORRECTION 2 (F3, 2026-09-29) — THE FOLLOW-UP COUNT IS
		 * STATED ONCE, and this chip is the surface that stops naming it.
		 *
		 * THE DEFECT, measured on the rendered 1366×768 published state: a small
		 * pill reading `Published with 2 follow-up items`, and 30 px to its right
		 * the green primary surface reading `Published schedule — 2 follow-up
		 * items remain`. The count twice, side by side, in one row. §11's design
		 * gate fails that on "one status per fact", and a header that states a
		 * number twice reads as the system disagreeing with itself — a worse
		 * feeling for this audience than the crowding it replaced.
		 *
		 * WHICH SURFACE KEEPS THE COUNT, AND WHY IT IS NOT THIS ONE. The count
		 * belongs to `SimplePublishedState`, for three reasons that all point the
		 * same way:
		 *   1. It is the DOMINANT object in the state — `h-11`, emerald, and the
		 *      lifecycle PRIMARY slot (`resolveSimpleHeaderPrimary` returns
		 *      `'published'` for exactly the runs whose `summary.isPublished` is
		 *      true, which is the very predicate this branch reads). A scheduler
		 *      reads the big green surface first, so the number the scheduler acts
		 *      on has to be on it.
		 *   2. It is the surface that says the state. A STATUS CHIP that says
		 *      "Published" and the primary that says "Published schedule" are one
		 *      fact in one role each; a chip that also carries the count is a
		 *      second summary of the sentence beside it.
		 *   3. Nothing is lost. `isRunPublishedStrict` (`timetableWorkspaceTruth.ts:26`)
		 *      is `summary.isPublished === true`, the same test this branch uses,
		 *      and this branch is only reached when `context.draft` exists, which
		 *      is `hasGeneratedRun`. So the published primary surface is on screen
		 *      in EVERY state whose chip reaches this line — the count cannot
		 *      appear without somewhere for it to appear.
		 *
		 * This is a DUPLICATE removed, not a fact removed: before, the follow-up
		 * count was correct and said twice; now it is correct and said once. The
		 * pinning row in `timetable-operator-workflow-state.test.ts` is marked
		 * SUPERSEDED in place, with the claim it used to make retained beside its
		 * replacement (AGENTS.md §16 forbids closing a finding by editing the row
		 * that found it). */
		return 'Published';
	}
	/* C11 S2 (item 2) — the chip shows SEVERITY, not one number. It used to
	 * return at the first branch that had a number, so a run with 3 must-fix AND
	 * 145 advisories printed only "3 Must fix" and the 145 were invisible — the
	 * bare-count shape the requirement names. The split reads
	 * "3 Must fix, 145 advisories".
	 *
	 * DELIBERATELY NARROW. A zero clause is never spoken, and a run with only ONE
	 * severity keeps its existing word, so:
	 *   hard only -> "3 Must fix"        (unchanged)
	 *   soft only -> "194 warnings"      (unchanged — the DRAFT-UX-C01
	 *                                      soft-only measurement stays exact)
	 *   both      -> "3 Must fix, 145 advisories"  (the new split)
	 * The requirement is that both severities are VISIBLE when both exist; it is
	 * not that a single-severity run gains a zero, and "advisories" appears only
	 * where the two severities are being contrasted. */
	if (context.blockingHardCount > 0) {
		return context.softCount > 0
			? `${mustFixCountLabel(context.blockingHardCount)}, ${advisoryCountLabel(context.softCount)}`
			: mustFixCountLabel(context.blockingHardCount);
	}
	// Unresolved sessions block publish exactly like hard blockers: individual
	// previewability is not joint feasibility, so never report ready while any
	// session still needs fixing.
	const unassigned = context.summary?.unassignedCount ?? 0;
	if (unassigned > 0) return `${unassigned} unresolved`;
	if (context.softCount > 0) return `${context.softCount} warning${context.softCount === 1 ? '' : 's'}`;
	return 'Ready to publish';
}

/**
 * `advisoryCountLabel(145)` -> `"145 advisories"`.
 *
 * C11 S2 (item 2): used only inside the two-severity chip, where the reader is
 * comparing "Must fix" against the other class of finding and needs the two nouns
 * to be distinguishable. A soft-only run keeps "warnings", the word the grid cell
 * and the warnings list already use for that count.
 */
export function advisoryCountLabel(count: number): string {
	return `${count} advisor${count === 1 ? 'y' : 'ies'}`;
}

export function firstPivotValue(context: ScheduleReviewWorkspaceHeaderContext) {
	for (const group of context.groupedPivotEntities) {
		const firstId = group.ids[0];
		if (firstId != null) return String(firstId);
	}
	return '';
}

export function hasPivotValue(context: ScheduleReviewWorkspaceHeaderContext, value: string | undefined) {
	if (!value || value === 'all') return false;
	return context.groupedPivotEntities.some((group) => group.ids.some((id) => String(id) === value));
}

export function pivotEntityGroups(context: ScheduleReviewWorkspaceHeaderContext) {
	return context.groupedPivotEntities.map((group) => ({
		label: group.label,
		items: group.ids.map((id) => ({ value: String(id), label: context.pivotLabel(id) })),
	}));
}

export function SimpleScheduleControls({
	context,
	lastEntityByMode,
	onViewModeChange,
	onEntityChange,
}: {
	context: ScheduleReviewWorkspaceHeaderContext;
	lastEntityByMode: Partial<Record<SimpleViewMode, string>>;
	onViewModeChange: (value: string) => void;
	onEntityChange: (value: string) => void;
}) {
	const groups = useMemo(() => pivotEntityGroups(context), [context]);
	const entityOptionsAvailable = groups.some((group) => group.items.length > 0);
	const selectedLabel = hasPivotValue(context, context.entityFilter)
		? context.pivotLabel(Number(context.entityFilter))
		: 'Choose schedule';
	const rememberedLabel = lastEntityByMode[context.viewMode] && hasPivotValue(context, lastEntityByMode[context.viewMode])
		? context.pivotLabel(Number(lastEntityByMode[context.viewMode]))
		: selectedLabel;

	return (
		<div
			className="flex shrink-0 items-center gap-1.5"
			data-testid="timetable-simple-schedule-switcher"
			role="group"
			aria-label="Choose timetable view and entity"
			data-view-mode={context.viewMode}
			data-entity-filter={context.entityFilter}
			/* ROW 37: a tutorial step points at this control, and a plain <div>
			 * cannot take programmatic focus, so "Show me" scrolled and did
			 * nothing visible. Focusable programmatically, still not a tab stop. */
			tabIndex={-1}
		>
		{/* LANE-C-PLAIN-LANGUAGE-C03 (J5) — the two highest-traffic controls get
		    plain visible labels again, as NON-INTERACTIVE <span>s. DRAFT-UX-C01
		    (S2) removed them to satisfy the ≤6 visible-control cap; a span is
		    not a control, so that cap and the one-solid-primary contract are
		    both unchanged, and the aria-labels below are unchanged. The words
		    describe the destination in the scheduler's own vocabulary.

		    A2 HEADER-BUDGET — the two selects and the `Schedule for` combobox
		    below are now row 2 of the Simple header, and §8's new "One look per
		    control" rule applies to all three: they carry the ONE shared
		    `SELECT_TRIGGER_PICKER_CLASS` from `@/ui` and nothing page-local. The
		    group box around them is gone too — it was the `rounded-lg border
		    border-border bg-muted/20 px-2 py-1` frame the operator saw as a
		    third, differently-styled band. The wrapper keeps its testid, its
		    group role and its label, and keeps `tabIndex={-1}` so the tutorial
		    can still point at it. */}
		<span className="shrink-0 text-xs font-medium text-muted-foreground" data-testid="timetable-simple-view-mode-label">
			Show
		</span>
		<Select value={context.viewMode} onValueChange={onViewModeChange}>
			<SelectTrigger
				/* Width is the picker rule for THIS control and stays; the LOOK is the
				 * shared constant's, per §8. */
				className={`${SELECT_TRIGGER_PICKER_CLASS} w-[7.25rem] shrink-0`}
				aria-label="View type"
				data-testid="timetable-simple-view-mode-select"
			>
				<SelectValue placeholder="View by" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="section">Section</SelectItem>
				<SelectItem value="faculty">Teacher</SelectItem>
				<SelectItem value="room">Room</SelectItem>
			</SelectContent>
		</Select>
		<span className="shrink-0 text-xs font-medium text-muted-foreground" data-testid="timetable-simple-entity-label">
			Schedule for
		</span>
		<div className="min-w-[9rem] flex-1" data-testid="timetable-simple-entity-select">
			<SearchableSelect
				value={context.entityFilter}
				onValueChange={onEntityChange}
				/* A2 HEADER-BUDGET — the trailing `...` is GONE. §8 forbids a sentence cut
				 * off with an ellipsis, and this placeholder is the only remaining
				 * three-dot string inside the header box. The words say the same thing
				 * without it: the visible `Schedule for` label beside the trigger already
				 * names the control, so the placeholder only has to say what to do. */
				placeholder={`Choose ${context.VIEW_MODE_LABELS[context.viewMode] ?? 'schedule'}`}
				/* A2 HEADER-BUDGET — §8 requires the same search BEHAVIOUR for the
				 * same control, so this stays a `SearchableSelect`; §8 also requires
				 * the same LOOK, so its trigger carries the same shared chrome and
				 * the same `h-9` height as the two `Select` triggers beside it. The
				 * `w-full min-w-[9rem] max-w-[18rem]` width rule is the control's
				 * own and stays. */
				triggerClassName={`${SELECT_TRIGGER_PICKER_CLASS} w-full min-w-[9rem] max-w-[18rem]`}
				className="w-[min(24rem,calc(100vw-2rem))]"
				groups={groups}
				disabled={!entityOptionsAvailable}
				disabledReason="No schedule options are available yet. Generate or load a timetable first."
				/* A2 C12 / ITEM 3 — THE NAMED COMBOBOX. This call site passed NO
				 * `ariaLabel`, and `SearchableSelect` composes `aria-label` from it
				 * (and from `triggerId`, also absent here), so the rendered trigger
				 * carried `aria-label={undefined}`: an EMPTY accessible name. Its
				 * visible label is a non-interactive `<span>Schedule for</span>` that
				 * no `for`/`aria-labelledby` points at, and the neighbouring
				 * `<span class="sr-only">Showing …</span>` belongs to the GROUP, not
				 * to this button — so a screen reader announced the entity picker as
				 * an unlabelled combobox, and the header's one schedule picker was
				 * the one control nobody could tell apart from the view-type
				 * dropdown beside it.
				 *
				 * `Schedule for` is the operator's OWN visible label for this control
				 * (the span three lines up), so the accessible name and the visible
				 * label can never drift — the LANE-C C03 (B11) rule.
				 *
				 * The wording deliberately does NOT depend on the selected value,
				 * because the name has to be non-empty in EVERY state and the value
				 * is the empty string in the `all` default (see
				 * `searchable-select.tsx`'s `selectedLabel`). */
				ariaLabel="Schedule for"
			/>
		</div>
		<span className="sr-only">Showing {context.VIEW_MODE_LABELS[context.viewMode]} schedule: {rememberedLabel}</span>
	</div>
	);
}

export function SimpleScheduleSheet({
	context,
	lastEntityByMode,
	onViewModeChange,
	onEntityChange,
}: {
	context: ScheduleReviewWorkspaceHeaderContext;
	lastEntityByMode: Partial<Record<SimpleViewMode, string>>;
	onViewModeChange: (value: string) => void;
	onEntityChange: (value: string) => void;
}) {
	const selectedLabel = hasPivotValue(context, context.entityFilter)
		? context.pivotLabel(Number(context.entityFilter))
		: 'Choose schedule';

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					/* The compact sheet is reserved for touch-sized layouts. Desktop
					   keeps the view-type and searchable entity chooser visible in the
					   header at every desktop breakpoint. */
					className="h-8 min-h-11 min-w-11 max-w-[28vw] gap-1.5 px-1.5 text-xs sm:px-2 lg:hidden"
					data-testid="timetable-simple-schedule-sheet-trigger"
					aria-label={`Showing ${context.VIEW_MODE_LABELS[context.viewMode]} schedule: ${selectedLabel}`}
				>
					{/* A2 HEADER-BUDGET — `truncate` is GONE from this span. It is the one
					    remaining ellipsis-producing span inside the header box, and §8
					    forbids a sentence cut off with an ellipsis. `max-w-[20vw]` still
					    bounds the compact trigger; the selected label is a short entity
					    name, so there is nothing to cut. */}
					<span className="hidden min-[420px]:inline max-w-[20vw] sm:max-w-none">{selectedLabel}</span>
					<ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="bottom"
				className="flex max-h-[82svh] flex-col gap-3 rounded-t-2xl p-4"
				data-testid="timetable-simple-schedule-sheet"
			>
				<SheetHeader>
					<SheetTitle className="text-base">Choose schedule view</SheetTitle>
					<SheetDescription>
						Switch between section, teacher, and room schedules without opening Expert view.
					</SheetDescription>
				</SheetHeader>
				<SimpleScheduleControls
					context={context}
					lastEntityByMode={lastEntityByMode}
					onViewModeChange={onViewModeChange}
					onEntityChange={onEntityChange}
				/>
			</SheetContent>
		</Sheet>
	);
}

export function SimpleFiltersContent({ context }: { context: ScheduleReviewWorkspaceHeaderContext }) {
	return (
		<div className="space-y-3" data-testid="timetable-simple-filters-popover">
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Program</p>
				<Select value={context.programFilter} onValueChange={context.setProgramFilter}>
					<SelectTrigger className="h-9 text-xs" aria-label="Filter by program">
						<SelectValue placeholder="Program" />
					</SelectTrigger>
					<SelectContent>
						{context.PROGRAM_FILTER_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entry type</p>
				<Select value={context.entryKindFilter} onValueChange={context.setEntryKindFilter}>
					<SelectTrigger className="h-9 text-xs" aria-label="Filter by entry type">
						<SelectValue placeholder="Entry type" />
					</SelectTrigger>
					<SelectContent>
						{context.ENTRY_KIND_FILTER_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attention</p>
				<Select value={context.severityFilter} onValueChange={(value) => context.setSeverityFilter(value as ScheduleReviewWorkspaceHeaderContext['severityFilter'])}>
					<SelectTrigger className="h-9 text-xs" aria-label="Filter by attention type">
						<SelectValue placeholder="Attention" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All issues</SelectItem>
						<SelectItem value="hard">Hard blockers</SelectItem>
						<SelectItem value="soft">Warnings</SelectItem>
						<SelectItem value="conflicts">Conflicts</SelectItem>
						<SelectItem value="wellbeing">Well-being</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<p className="text-xs leading-relaxed text-muted-foreground">
				These refinements only affect what appears in the grid. Timetable assignments and publish readiness stay unchanged.
			</p>
		</div>
	);
}

/**
 * UX-QUICKFIX-C01 — the Simple header action cluster.
 *
 * Generate and Publish were previously reachable only through the More menu
 * (Generate) or as the single dynamic primary button (Publish). They are now
 * first-class, always-visible controls in the header action row. Every control
 * reads the SAME capability gate the More menu and the lifecycle dispatcher use,
 * so a closed gate renders a disabled control with a truthful tooltip and can
 * never dispatch a request.
 */
/**
 * A2 HEADER-BUDGET — the gated-action wrapper moved to a neutral module and is
 * RE-EXPORTED here, so every existing importer of this path is unchanged.
 *
 * `DraftActionButton` in `TimetableDraftStateStrip.tsx` needs the same wrapper
 * (a disabled control states its reason in a `@/ui` Tooltip, never as a sentence
 * printed under the button), and it must not reach into this module — that is the
 * import-cycle risk §8's budget rule creates. The body is byte-identical and now
 * lives in `./GatedAction`.
 */
export { GatedAction } from '@/components/timetable/simple/GatedAction';

import { GatedAction } from '@/components/timetable/simple/GatedAction';

/**
 * TIMETABLE-HEADER-COLLAPSE-C01 (D3) — the visible Generate control, demoted.
 *
 * UX-QUICKFIX-C01 introduced Generate as a first-class header control; the
 * published-state review then found it rendered at the same `h-11 / text-sm`
 * size as the lifecycle primary, so it competed for dominance even when it was
 * not the next action. The row owns exactly one dominant control — the
 * lifecycle primary, or the published status surface — so Generate is now a
 * compact secondary control (`h-8 / text-xs`) in EVERY state. It stays present
 * in the header render (two committed contracts require it), keeps its label,
 * its gate-derived disabled state, its truthful aria-label, and the
 * `shouldDispatchSimpleGenerate` guard ahead of dispatch.
 */
/**
 * #56 — ONE verb, from the copy module, for "make a new schedule from a
 * published one".
 *
 * It was `'New version'` here and `'Build a new version'` in the header
 * aria-label while the dialog the item opens already asked "Build a new
 * draft?" and warned that the published schedule stays in use. Three names for
 * one action on one screen, and the two shortest implied an edit to the LIVE
 * schedule. Both the constant and the sentence are now DERIVED from
 * `timetable-plain-language`, so a future rename in the copy module cannot
 * leave this surface behind — and the exported name is kept because
 * `SimpleHeaderActions` and the committed label contract both import it.
 */
export const PUBLISHED_GENERATE_LABEL = BUILD_NEW_DRAFT_LABEL;
export const PUBLISHED_GENERATE_DESCRIPTION = `${BUILD_NEW_DRAFT_LABEL}. ${PUBLISHED_SCHEDULE_STAYS_IN_USE}`;

export function SimpleGenerateAction({
	disabled,
	disabledReason,
	onClick,
	published = false,
	primary = false,
}: {
	disabled: boolean;
	disabledReason: string | null;
	onClick: () => void;
	/**
	 * #56 — on a published schedule a bare "Generate" beside the published chip
	 * read as "regenerate what teachers see". It builds a new DRAFT instead, and
	 * the label and the aria-label both say so, in the one verb the dialog uses.
	 */
	published?: boolean;
	/**
	 * DRAFT-UX-C01 (operator, 2026-09-25) — Generate is the header's one solid
	 * primary while the school year/term has no generated run. Once a run
	 * exists, Publish owns the primary slot and Generate moves into More.
	 */
	primary?: boolean;
}) {
	const reason = disabled ? (disabledReason ?? 'Generation is not available for this school year yet.') : null;
	const name = published ? PUBLISHED_GENERATE_DESCRIPTION : 'Generate schedule';
	return (
		<GatedAction disabled={disabled} reason={reason}>
			<Button
				type="button"
				variant={primary ? 'default' : 'outline'}
				size="sm"
				className={primary ? 'h-11 min-w-28 gap-1.5 px-3 text-sm' : 'h-8 gap-1.5 px-2.5 text-xs'}
				disabled={disabled}
				aria-label={reason ? `${published ? BUILD_NEW_DRAFT_LABEL : 'Generate schedule'} — ${reason}` : name}
				onClick={onClick}
				data-testid="timetable-simple-generate-action"
			>
				<Play className="size-3.5" aria-hidden="true" />
				<span>{published ? PUBLISHED_GENERATE_LABEL : 'Generate'}</span>
			</Button>
		</GatedAction>
	);
}

/**
 * C11 D, correction 2 (QA-B2) — the draft's own verb, `Edit draft`.
 *
 * MOVED to `TimetableDraftActionsSurface` (rendered by the More menu beside
 * `Discard draft`). It used to occupy the header's ONE primary slot, which
 * reversed DRAFT-UX-C01 (operator, 2026-09-25) — see
 * `resolveSimpleHeaderPrimary`. It is moved, not duplicated: exactly one
 * definition of this control exists in the workspace.
 */
export function SimplePublishAction({
	enabled,
	disabledReason,
	primary,
	onClick,
}: {
	enabled: boolean;
	disabledReason: string | null;
	/** C01R C1 — the solid primary exactly when the lifecycle primary is
	    suppressed for the publish slot; secondary/outline otherwise, so the
	    header never shows two solid actions or two publish controls. */
	primary: boolean;
	onClick: () => void;
}) {
	const reason = enabled ? null : (disabledReason ?? 'Publishing is not available for this run yet.');
	return (
		/* A2-C6-TRUTH (T3g) made this reason VISIBLE under the control, and its
		 * accepted rendered row asserted `data-testid="timetable-publish-blocked-reason"`.
		 *
		 * A2 HEADER-BUDGET (operator, 2026-09-29) — **THAT ROW IS SUPERSEDED.** §8's
		 * new "Header budget" rule is explicit: "disabled actions with nothing to do
		 * … no helper sentence under a button (put it in a `Tooltip`)". The operator
		 * reported this exact sentence in the screenshot as part of the "regressed /
		 * messy" header. The reason is NOT lost, and the state is still never a red
		 * button that looks broken with no explanation:
		 *   - `GatedAction` puts it in a `@/ui` Tooltip on a FOCUSABLE wrapper, so a
		 *     disabled button's reason is reachable by pointer AND keyboard
		 *     (Radix will not fire from a disabled button itself);
		 *   - the control's `aria-label` still carries the sentence verbatim, so
		 *     nothing depends on a hover being available (AGENTS.md §8: never
		 *     hover-only, never a raw `title`).
		 * The row is marked SUPERSEDED in place, with this behaviour as its
		 * replacement — it is NOT deleted (AGENTS.md §16).
		 */
		<GatedAction disabled={!enabled} reason={reason}>
			<Button
				type="button"
				variant={primary ? 'default' : 'outline'}
				size="sm"
				className="h-11 gap-1.5 px-3 text-sm"
				disabled={!enabled}
				aria-label={reason ? `Publish schedule — ${reason}` : 'Publish schedule'}
				onClick={onClick}
				data-testid="timetable-simple-publish-action"
			>
				<Send className="size-3.5" aria-hidden="true" />
				<span>Publish schedule</span>
			</Button>
		</GatedAction>
	);
}

/**
 * TIMETABLE-HEADER-COLLAPSE-C01 (D2) — the published run's dominant lifecycle
 * surface.
 *
 * A published schedule is read-only history, so the published state *is* the
 * lifecycle primary for that state: it sits where the primary sits, and it must
 * out-rank the adjacent controls. Before this correction it was a light
 * `border-emerald-200 / bg-emerald-50` chip the same height as the full-size
 * outline Generate beside it, so Generate read as the largest control on the
 * row. It now keeps the `h-11 / text-sm font-semibold` lifecycle sizing, with a
 * strengthened emerald outline, so it is the one dominant element while
 * Generate is demoted below it.
 *
 * It stays a status surface, never an action: the committed "a published run
 * renders no solid action" contract holds (no `<button>`, no `bg-primary`), and
 * the copy is unchanged and honest (`read only`, or the follow-up count). The
 * published run offers no publish affordance, and re-generating remains the
 * adjacent Generate control.
 */
/** LANE-C C03 (B4) — what a published schedule allows, in one line. */
export const PUBLISHED_CHANGE_HINT = 'Changes start on a date you choose';

export function SimplePublishedState({ followUpCount }: { followUpCount: number }) {
	// LANE-C C03 (B4) — SUPERSEDED: 'Published schedule — view only'. The chip
	// sat beside Swap and Teacher leaving, which do change a published schedule
	// (as dated changes), so "view only" was untrue. The chip now says what a
	// change does instead.
	const label = followUpCount > 0
		? `Published schedule — ${followUpCount} follow-up item${followUpCount === 1 ? '' : 's'} remain`
		: 'Published schedule';
	return (
		<div
			className="flex h-11 min-w-28 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900"
			data-testid="timetable-simple-published-state"
			data-published-follow-ups={followUpCount}
			role="status"
			aria-label={`${label}. ${PUBLISHED_CHANGE_HINT}.`}
		>
			<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
			{/* A2 HEADER-BUDGET, correction 1 (QA-BLOCKING, 2026-09-29) — BOTH
			    `truncate` classes are OUT of the published state. The reason is a
			    layout fact, and the two obvious alternatives were each ruled out by
			    a committed row rather than by taste.

			    (1) "LET THE COPY WRAP ONTO ITS OWN LINE" — RULED OUT by the two-row
			    budget. This box carries exactly one `h-*` class, `h-11` (44 px), and
			    `timetable-header-collapse-c01`'s D2 and D3 rows MEASURE it
			    (`heightPx` reads the class list and fails unless there is exactly one
			    `h-*` token, equal to `h-11`). The label and the hint already occupy
			    34 of those 44 px, so a third line cannot exist here without failing a
			    committed sizing row. A wrap is not available.
			    (2) "SHORTEN THE COPY SO IT FITS" — RULED OUT because three committed
			    rows pin the sentences: `schedule-clarity-c03` asserts
			    `>Published schedule<` AND the exact
			    `aria-label="Published schedule. Changes start on a date you choose."`;
			    `ux-quickfix-c01-header-actions` asserts `/2 follow-up items remain/`.
			    The copy stays exactly as LANE-C C03 wrote it.
			    (3) SO THE ELLIPSIS WAS NEVER DOING ANY WORK. `truncate` can only
			    paint when an element is laid out NARROWER than its text, and this
			    surface is `shrink-0`: a flex item that never shrinks is always given
			    its max-content width, so neither span can be narrower than its own
			    sentence. Real Chromium at 1366x768
			    (docs/reviews/a2-header-budget/README.md): the surface claims 370 px
			    with 12 follow-ups and 381 px with 250, both spans report
			    `scrollWidth === clientWidth`, and the header box is 87 px before and
			    after. The classes bought nothing and cost the §8 guarantee Lane C
			    and the planner were told was BUILT.

			    THE TRADE, RECORDED RATHER THAN LEFT SILENT: with (1) and (2) both
			    closed, the no-cut guarantee rests on the surface keeping BOTH
			    `shrink-0` and its full content width from the row. `shrink-0` is
			    load-bearing and stays. If a future layout ever makes this surface
			    elastic, the copy WRAPS (default `whitespace`) and a third line WILL
			    exceed the pinned 44 px — fix that then by giving the box a real
			    height, not by putting `truncate` back. H3 state C in
			    `a2-header-budget-2026-09-29.test.tsx` asserts the guarantee. */}
			<span className="flex min-w-0 flex-col leading-tight">
				<span>{label}</span>
				<span className="text-xs font-normal text-emerald-800" data-testid="timetable-simple-published-hint">{PUBLISHED_CHANGE_HINT}</span>
			</span>
		</div>
	);
}

export function useSimpleTasks(
	context: ScheduleReviewWorkspaceHeaderContext,
	gates: TimetableCapabilities['gates'],
): SimpleTaskDefinition[] {
	return useMemo(() => {
		const unassignedCount = context.summary?.unassignedCount ?? 0;
		const noCurrentTimetable = !context.draft && !context.isPreGenerationWorkspace;
		const yearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? 'current school year';
		// C1-b — the task badge reads the same single authority as the
		// recommended task and the lifecycle next step. It previously counted
		// every HARD violation and labelled it "blocked", so a run the publish
		// gate called ready showed "3 blocked" on its own review task.
		const publishTruth = resolvePublishBlockTruth(context);
		return [
			{
				id: 'place-unresolved',
				label: 'Place unresolved',
				primaryLabel: 'Start placing',
				helper: 'Choose one unresolved session, then choose a green slot on the grid. No dragging required.',
				icon: ClipboardCheck,
				badge: taskCount(unassignedCount, 'to place'),
				disabled: context.isPreGenerationWorkspace,
			},
			{
				id: 'swap-sessions',
				label: 'Swap class times',
				primaryLabel: 'Start swapping',
				helper: gates.swap.enabled
					? 'Choose one class on the grid, then choose another class to switch with it. Each teacher stays with their class.'
					: (gates.swap.reason ?? 'Swapping is not available for this run yet.'),
				icon: ArrowRightLeft,
				disabled: !gates.swap.enabled,
			},
			{
				id: 'review-issues',
				label: 'Review issues',
				primaryLabel: 'Review issues',
				helper: 'See the most important blockers and warnings without opening the full diagnostics wall.',
				icon: ListChecks,
				badge: taskCount(
					publishTruth.blockingHardCount || context.softCount,
					publishTruth.blockingHardCount > 0 ? 'blocked' : 'warnings',
				),
				disabled: context.isPreGenerationWorkspace || !gates.issueReview.enabled,
			},
			{
				id: 'plan-draft',
				label: noCurrentTimetable ? 'Build Teaching Load' : context.isPreGenerationWorkspace ? 'Continue draft' : 'Plan draft',
				primaryLabel: noCurrentTimetable ? 'Open Teaching Load' : context.isPreGenerationWorkspace ? 'Continue draft' : 'Plan before generating',
				helper: noCurrentTimetable
					? `No ${yearLabel} timetable yet. Build Teaching Load before creating the first timetable.`
					: 'Open the pre-generation draft queue and place sessions before generating a new run.',
				icon: noCurrentTimetable ? GraduationCap : CalendarClock,
				badge: taskCount(context.draftPlacementCount, 'draft'),
				disabled: context.newDraftLoading || !context.schoolYearId,
				href: noCurrentTimetable ? '/teaching-load' : undefined,
			},
			{
				id: 'publish',
				label: 'Publish',
				primaryLabel: 'Publish schedule',
				helper: gates.publication.enabled
					? 'Publish when the schedule is clean.'
					: (gates.publication.reason ?? 'Publishing is not available for this run yet.'),
				icon: Send,
				disabled: !gates.publication.enabled,
			},
		];
	}, [
		context.draft,
		context.draftPlacementCount,
		context.blockingHardCount,
		context.hardCount,
		context.isPreGenerationWorkspace,
		context.newDraftLoading,
		context.schoolYearContext?.activeSchoolYearLabel,
		context.schoolYearId,
		context.softCount,
		context.summary?.unassignedCount,
		gates.swap.enabled,
		gates.swap.reason,
		gates.issueReview.enabled,
		gates.publication.enabled,
		gates.publication.reason,
	]);
}

/**
 * C1-b — the ONE predicate for "what must I fix before this can be published".
 *
 * `hardCount` is every HARD violation the run reports. `blockingHardCount` is
 * the allowlist-filtered, publication-relevant subset — the count the publish
 * gate, the readiness chip, the readiness sheet, and `deriveSimpleLifecycleAction`
 * already agree on. The Simple header's *recommended task* used to read
 * `hardCount` instead, so with `hardCount = 3, blockingHardCount = 0` the header
 * recommended "Review issues" while the same header reported "Ready to publish".
 *
 * Every surface now reads this single derivation, so that state is unreachable.
 * The HARD violations that do not block publication are real, so they are not
 * hidden either: `nonBlockingHardCount` is stated on the header in plain words.
 */
export type SimplePublishBlockTruth = {
	/** The one count that decides what must be fixed before this can be published. */
	blockingHardCount: number;
	/** HARD rule breaks that do not stop publishing; still worth stating plainly. */
	nonBlockingHardCount: number;
};

export function resolvePublishBlockTruth(context: { hardCount: number; blockingHardCount: number }): SimplePublishBlockTruth {
	return {
		blockingHardCount: context.blockingHardCount,
		nonBlockingHardCount: Math.max(0, context.hardCount - context.blockingHardCount),
	};
}

export function chooseRecommendedTask(tasks: SimpleTaskDefinition[], context: ScheduleReviewWorkspaceHeaderContext) {
	const unassignedCount = context.summary?.unassignedCount ?? 0;
	if (context.isPreGenerationWorkspace) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (!context.draft) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (unassignedCount > 0) return tasks.find((task) => task.id === 'place-unresolved') ?? tasks[0];
	// C1-b — `blockingHardCount`, the same count the lifecycle next step and the
	// publish gate read. Reading `hardCount` here is what let the header
	// recommend "Review issues" beside its own "Ready to publish".
	if (context.blockingHardCount > 0 || context.softCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
	if (context.requestPendingCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
	return tasks.find((task) => task.id === 'publish') ?? tasks[0];
}

/**
 * C07B/F2 — where the `publish` task must land.
 *
 * The publish task is a real publish-readiness surface, not a dead branch:
 *  - gate open  → `publish-task`: the task drawer renders `PublishChecklistContent`
 *    (run-wide gate + grouped blockers + the Publish action);
 *  - gate closed → `readiness-sheet`: the read-only `SimplePublishReadinessSheet`
 *    explains why publishing is unavailable.
 *
 * The candidate never armed the task (the old dispatcher opened the publish
 * dialog directly), which left the corrected checklist component unreachable.
 */
export type PublishTaskDispatch = 'publish-task' | 'readiness-sheet';

export function resolvePublishTaskDispatch(publicationEnabled: boolean): PublishTaskDispatch {
	return publicationEnabled ? 'publish-task' : 'readiness-sheet';
}

/**
 * C7 — does the header's single primary action already dispatch the
 * review-issues task?
 *
 * The audit contract is one primary action and no action reachable from both
 * the header primary and `More`. The primary dispatches `startTask('review-issues')`
 * in exactly two states: an armed `review-issues` task, or the lifecycle
 * `review-warnings` next step. In both, `More` must not offer the same action a
 * second time. Every other state keeps the `More` entry, because there the
 * primary owns a different action and removing it would strand the review.
 */
export function primaryDispatchesReviewIssues(input: {
	activeTaskId: TimetableSimpleTask | null;
	lifecycleKind: SimpleLifecycleKind;
}): boolean {
	if (input.activeTaskId != null) return input.activeTaskId === 'review-issues';
	return input.lifecycleKind === 'review-warnings';
}

/* ------------------------------------------------------------------ *
 * UX-QUICKFIX-C01 — visible Generate/Publish dispatch guards
 * ------------------------------------------------------------------ */

export type SimpleHeaderActionState = {
	disabled: boolean;
	reason: string | null;
};

/**
 * The single guard behind the visible Generate control. A closed generation
 * gate must dispatch zero requests, so the click handler reads this decision
 * before it calls `context.handleTriggerGenerate()`.
 */
export function shouldDispatchSimpleGenerate(canPlanOrGenerate: boolean): boolean {
	return canPlanOrGenerate;
}

/**
 * The single guard behind the visible Publish control. A closed publication
 * gate (including an already-published run) must dispatch zero requests.
 */
export function shouldDispatchSimplePublish(publicationEnabled: boolean, isRunPublished: boolean): boolean {
	return publicationEnabled && !isRunPublished;
}

export function resolveSimpleGenerateActionState(input: {
	canPlanOrGenerate: boolean;
	loading: boolean;
	generating: boolean;
	gateReason: string | null;
}): SimpleHeaderActionState {
	if (input.canPlanOrGenerate) return { disabled: false, reason: null };
	if (input.generating) return { disabled: true, reason: 'A generation run is already in progress.' };
	if (input.loading) return { disabled: true, reason: 'The timetable is still loading.' };
	return { disabled: true, reason: input.gateReason ?? 'Generation is not available for this school year yet.' };
}

export function resolveSimplePublishActionState(input: {
	publicationEnabled: boolean;
	isRunPublished: boolean;
	gateReason: string | null;
}): SimpleHeaderActionState {
	if (input.isRunPublished) return { disabled: true, reason: 'This timetable is already published.' };
	if (input.publicationEnabled) return { disabled: false, reason: null };
	return { disabled: true, reason: input.gateReason ?? 'Publishing is not available for this run yet.' };
}
