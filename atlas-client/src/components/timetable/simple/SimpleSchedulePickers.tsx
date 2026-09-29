import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { SearchableSelect } from '@/ui/searchable-select';
import { SELECT_TRIGGER_PICKER_CLASS } from '@/ui/select';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';

/**
 * A7 c12b — the Simple header's row-2 schedule pickers, extracted from
 * `SimpleHeaderHelpers.tsx` so that module stays inside the §8 1000-physical-line
 * component cap. This is a MOVE, not a rewrite: the bodies are byte-identical and
 * `SimpleHeaderHelpers` re-exports every export below, so `TimetableSimpleHeader`
 * and every existing importer keep their current import path unchanged.
 */
type SimpleViewMode = ScheduleReviewWorkspaceHeaderContext['viewMode'];

export type { SimpleViewMode };

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
