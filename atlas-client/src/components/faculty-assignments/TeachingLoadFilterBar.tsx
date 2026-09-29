/**
 * TeachingLoadFilterBar — the By-teacher workspace discovery controls.
 *
 * Fix 14/16. Root cause of the old density: Department, Load, and Sort all sat
 * behind a `More filters` disclosure, so filtering the roster cost two clicks
 * for the three filters an operator actually reaches for. This bar promotes
 * Status, Department, and Load to one always-visible row and leaves only Sort
 * and the two optional inclusion switches behind the disclosure.
 *
 * FIX 39 (operator, 2026-09-28) — the `More filters` DISCLOSURE IS GONE ENTIRELY,
 * superseded again by A6 c6 item 3 in a narrower, better form. Fix 39's row was
 * one continuous `flex flex-wrap items-center gap-2` carrying all seven controls,
 * with NO disclosure. A6 c6 changes WHAT is on that row, not the row itself: it
 * is still one continuous wrapping flex row with no second row, and it now
 * carries search, Status, Department, Load, Sort and a `More filters` trigger
 * whose popover holds the two optional inclusion switches.
 *
 * WHY THAT IS A SUBTRACTION AND NOT A REVERSAL, because it reads like one. The
 * two switches cost ~555px of the ~1326px content width at 1366 and sit on a row
 * a scheduler reads at a glance, to reach two special cases. The `More filters`
 * trigger costs 123px and states on its own face how many switches are on, so
 * nothing is hidden and nothing is narrowed silently: net −432px and one fewer
 * control. Fix 39's complaint — "a filter an operator uses daily was two clicks
 * away" — is about the four PICKS, and all four are still on the row.
 *
 * A6 c6 item 1 also reworded the two switch labels into plain sentences
 * (`Cross-Dept` -> `Show teachers outside their subject area`,
 * `Unmapped Specialization` -> `Show teachers with no matched subject`) and
 * removed their `uppercase tracking-tight`. The `id` attributes are UNCHANGED:
 * they are stable DOM hooks that committed rows address, not visible text.
 *
 * WHY THE SEARCH BOX LOST ITS `flex-1`.
 * It was `flex-1 min-w-44 max-w-xs` — elastic, so its width changed with the
 * viewport and pushed the controls beside it around. The operator's `w-[240px]`
 * is a fixed width with `shrink-0`, so the row's content is the same at 1920 as
 * at 1280 and the seven controls keep their order. `flex-wrap` still applies, so
 * a narrow viewport wraps the row rather than clipping it.
 *
 * The no-scroll architecture is untouched and load-bearing: this component adds
 * NO scroll container. It is a `shrink-0` block above the existing
 * `flex-1 overflow-auto` roster region in the Teaching Load shell, so the
 * workspace still never produces a global browser scrollbar
 * (`h-[calc(100svh-3.5rem)]` -> `flex-1 min-h-0` -> `overflow-y-auto`).
 *
 * FIX 40 — the page's draft controls arrive as `draftControls` and are rendered
 * at the END of this row, so the Undo / Redo / Discard / Save group is
 * right-aligned on the same line and the bottom sticky footer could be deleted.
 *
 * Density is asserted structurally by
 * `src/components/faculty-assignments/__tests__/a3-teachers-load-a3.test.tsx`:
 * JSDOM performs no layout, so the control proves the reachable-in-one-row
 * contract and the absence of any new scroll container rather than pixels. The
 * header stack above this row is controlled by
 * `__tests__/a3-c10-tl-header-density.test.ts`.
 */
import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, LayoutGrid, ListFilter, RotateCcw, Search, Star } from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { FilterPicker } from '@/ui/filter-picker';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { PICKER_ROW_CONTROL_CLASS } from '@/ui/picker-trigger';
import {
	type TeachingLoadStatusFilter,
	type TeachingLoadLoadFilter,
	type TeachingLoadFacet,
} from '@/lib/faculty-assignment-helpers';
import { AT_STANDARD_LABEL, BELOW_STANDARD_LABEL, EXCESS_LOAD_LABEL } from '@/lib/teaching-load-labels';

/**
 * A5 C3 slice B (B4): this string used to be `CONTROL_CHROME`, "the operator's shared control
 * chrome for this row, verbatim", applied to all seven controls so they read as one instrument.
 * That was the right instinct and the wrong mechanism: it made a PAGE-LOCAL string the chrome of
 * a shared control, which `AGENTS.md` §8 "One look per control" forbids, and it is why
 * `/teaching-load`'s filters looked like no other filter in the product.
 *
 * The four PICKS no longer use this or anything like it — they take their chrome from
 * `@/ui/picker-trigger` through `FilterPicker`, which is the point of the sweep. What remains
 * are the two optional-inclusion SWITCHES, which are not pickers and are not part of the shared
 * primitive; they keep the same height, radius, border and hover so the row still reads as one
 * instrument, and they are named for what they actually are.
 *
 * A6 c6 item 1 CHANGED THE LABELS, NOT THE CHROME. They used to be `Cross-Dept` and
 * `Unmapped Specialization`, printed in `uppercase tracking-tight` — internal vocabulary
 * shouted at an older scheduler. They now read `Show teachers outside their subject area`
 * and `Show teachers with no matched subject`, in sentence case. That is a WORDING change
 * and nothing else: the same `SWITCH_CHROME` box, the same `h-9`, the same ids, the same
 * `label for=` wiring. `a6-tl-header-budget` `A6c4-G2-6` capped caps on a switch label at
 * two; this slice reaches zero, which still satisfies `<= 2`, and that row is deliberately
 * left untouched rather than relaxed.
 *
 * A6 c6 item 3 REPLACED THE LABEL LENGTH PROBLEM WITH A DECLARED BUDGET. The old comment
 * here argued that the full `Unmapped Specialization` wording "closes the row without
 * wrapping". That argument is retired: the fix is a published per-width character budget in
 * `@/ui/picker-trigger` plus short labels on the four picks, and the two switches left the
 * always-on row altogether — which is what bought the 555px that made the budget affordable.
 */
const SWITCH_CHROME = 'flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 transition-colors hover:bg-muted/40';

/** The shared switch-LABEL class. Sentence case: it is read, not shouted. */
const SWITCH_LABEL_CLASS = 'cursor-pointer whitespace-nowrap text-xs font-semibold text-muted-foreground';

type TeachingLoadFilterBarProps = {
	searchQuery: string;
	onSearchQueryChange: (q: string) => void;
	filterStatus: TeachingLoadStatusFilter;
	onFilterStatusChange: (s: TeachingLoadStatusFilter) => void;
	statusFacetCounts: Record<TeachingLoadFacet, number>;
	loadFilter: TeachingLoadLoadFilter;
	loadFacetCounts: Record<'below-standard' | 'at-standard' | 'excess', number>;
	onLoadFilterChange: (s: TeachingLoadLoadFilter) => void;
	departmentFilter: string;
	onDepartmentFilterChange: (d: string) => void;
	departmentOptions: { value: string; label: string; count: number }[];
	filterAnnouncement: string;
	onClearTeachingLoadFilters: () => void;
	sortOrder: string;
	onSortOrderChange: (o: any) => void;
	/**
	 * FIX 39 — retained in the signature but no longer rendered. `pages/
	 * TeachingLoad.tsx`, `TeacherGridMode` and the committed controls all still
	 * pass both, and the optional-inclusion switches that used to answer to them
	 * are now permanently visible, so there is nothing left to toggle. The props
	 * are kept rather than removed so a caller that still sends them compiles and
	 * so the removal is a visible, single-file diff when it happens.
	 */
	showFilters: boolean;
	onToggleFilters: () => void;
	showOutsideDept: boolean;
	onToggleOutsideDept: (s: boolean) => void;
	showUnmappedSpecialization: boolean;
	onShowUnmappedSpecializationChange: (s: boolean) => void;
	policyReady: boolean;
	/** FIX 40 — the page's draft controls, right-aligned on this row. */
	draftControls?: ReactNode;
};

export function TeachingLoadFilterBar(props: TeachingLoadFilterBarProps) {
	const {
		searchQuery,
		onSearchQueryChange,
		filterStatus,
		onFilterStatusChange,
		statusFacetCounts,
		loadFilter,
		loadFacetCounts,
		onLoadFilterChange,
		departmentFilter,
		onDepartmentFilterChange,
		departmentOptions,
		filterAnnouncement,
		onClearTeachingLoadFilters,
		sortOrder,
		onSortOrderChange,
		showOutsideDept,
		onToggleOutsideDept,
		showUnmappedSpecialization,
		onShowUnmappedSpecializationChange,
		policyReady,
		draftControls,
	} = props;
	// `showFilters` / `onToggleFilters` are intentionally NOT destructured: fix 39
	// removed the disclosure that consumed them. See the prop docs above.

	const hasActiveFilters = Boolean(
		searchQuery.trim()
		|| filterStatus !== 'all'
		|| departmentFilter !== 'all'
		|| loadFilter !== 'all',
	);

	/*
	 * A6 c6 item 3 — how many of the two inclusion switches are ON. The `More
	 * filters` trigger says so on its own face, because a disclosure that hides
	 * state without stating it is the same defect as a hidden control: the
	 * scheduler cannot tell whether anything is currently narrowed.
	 */
	const inclusionCount = (showOutsideDept ? 1 : 0) + (showUnmappedSpecialization ? 1 : 0);

	/*
	 * A6 c6 item 3 (planner ruling) — THE COUNT COMES OFF EVERY TRIGGER FACE.
	 *
	 * The popover has room and keeps every count; the trigger is a fixed rectangle
	 * and a count on it is a number an older scheduler does not read off a filter
	 * face — it is what made `Department: Mathematics (2)` (27 characters) and
	 * `Status: No teaching load (3)` (27) impossible to fit at any honest width.
	 *
	 * `Status` and `Load` name their values directly below. `Department`'s value is
	 * a DATA-DRIVEN server label, so its short form cannot be a hand-written map
	 * that would rot against a new department: it is built from the very
	 * `departmentOptions` the popover is built from, keyed by the same value, and it
	 * is the label WITHOUT the count — which is exactly what the count removal
	 * means. This is `FilterPicker`'s existing `shortLabels` contract, not a new
	 * mechanism, and a department the page does not offer has no entry and falls
	 * back to the full option label, which is the honest behaviour.
	 */
	const departmentShortLabels = useMemo<Record<string, string>>(() => {
		const map: Record<string, string> = {};
		for (const option of departmentOptions) {
			if (option?.value && option.label) map[option.value] = option.label;
		}
		return map;
	}, [departmentOptions]);

	return (
		<div className="space-y-1.5" data-testid="teaching-load-filter-bar">
			{/* FIX 39: ONE row, seven controls, in the operator's order. */}
			<div className="flex flex-wrap items-center gap-2" data-testid="teaching-load-primary-filters">
				<div className="relative w-[240px] shrink-0">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						aria-label="Search teachers"
						placeholder="Search teachers..."
						value={searchQuery}
						onChange={(e) => onSearchQueryChange(e.target.value)}
						className="h-9 rounded-xl border border-border/60 bg-background pl-10 text-xs transition-colors hover:bg-muted/40"
					/>
				</div>

								{/* A5 C3 slice B / B2 + B4: the four selects are now the ONE shared `@/ui` picker, and the
				    page-local `CONTROL_CHROME` string plus `font-bold uppercase tracking-tight` are GONE.
				    Those were a page-local look applied to a shared surface, which is exactly what
				    `AGENTS.md` section 8 "One look per control" forbids, and the reason this row shouted at an
				    older, mouse-first scheduler while every other filter in the product sat quietly beside
				    it. The chrome now comes from `@/ui/picker-trigger`, where every page gets it, and
				    sentence case is what the shared variant states. No page needed a different look, so no
				    new variant was added.

				    The `ListFilter` / `LayoutGrid` / `Star` glyphs inside the triggers are gone too: the
				    shared trigger carries its own chevron, and three different icons in three sibling
				    triggers is how one row stops reading as one instrument.

				    What did NOT change: all seven controls, their order, the two inclusion switches, the
				    draft controls, the facet counts, the disabled states (now carried through
				    `FilterPicker`'s `disabled` option flag, which `@/ui` owns), and every option label.

				    One honest subtraction, recorded rather than hidden: the three POLICY bands in the Load
				    list were also colour-coded (amber / emerald / sky) through a per-option class. Carrying
				    that would mean a look prop on the shared primitive for one page, which is the defect
				    this sweep exists to remove, so the colour is gone and the WORDS carry the same fact
				    (Excess, At standard, Under). The third was corrected in A6 c6: the canonical
				    constant `BELOW_STANDARD_LABEL` reads Under, and this note still named the
				    superseded wording, so the file was carrying two spellings of one policy band in
				    adjacent lines. Flagged for the
				    reviewer's judgement as layout-note D1. */}

				{/* A6 c6 item 3 (planner ruling): every pick takes the SAME `xl` width
				    variant, whose DECLARED character budget is 24. One size for the
				    whole row, because `AGENTS.md` §8 "One look per control" is about a
				    row not mixing a control's looks — a row that needs this width takes
				    it on all four. The short labels below are what make the faces fit;
				    the popover keeps every FULL option label and every count, and the
				    accessible name keeps the page's own full form. That is
				    `FilterPicker`'s existing `shortLabels` contract, used rather than a
				    mechanism invented here. */}
				<FilterPicker
					name="Status"
					ariaLabel="Filter by status"
					width="xl"
					shortLabels={{
						'teaching-assigned': 'Teaching',
						'no-teaching': 'No load',
						'adviser-only': 'Adviser',
					}}
					value={filterStatus}
					onValueChange={(value) => onFilterStatusChange(value as TeachingLoadStatusFilter)}
					options={[
						{ value: 'all', label: 'All status' },
						{ value: 'teaching-assigned', label: `Teaching assigned (${statusFacetCounts['teaching-assigned'] ?? 0})`, disabled: (statusFacetCounts['teaching-assigned'] ?? 0) === 0 },
						{ value: 'no-teaching', label: `No teaching load (${statusFacetCounts['no-teaching'] ?? 0})`, disabled: (statusFacetCounts['no-teaching'] ?? 0) === 0 },
						{ value: 'adviser-only', label: `Adviser only (${statusFacetCounts['adviser-only'] ?? 0}, subset)`, disabled: (statusFacetCounts['adviser-only'] ?? 0) === 0 },
					]}
				/>

				<FilterPicker
					name="Department"
					ariaLabel="Filter by department"
					width="xl"
					shortLabels={departmentShortLabels}
					value={departmentFilter}
					onValueChange={onDepartmentFilterChange}
					options={[
						{ value: 'all', label: 'All departments' },
						...departmentOptions.map((option) => ({
							value: option.value,
							label: `${option.label} (${option.count})`,
							disabled: option.count === 0,
						})),
					]}
				/>

				<FilterPicker
					name="Load"
					ariaLabel="Filter by load"
					width="xl"
					/*
					 * A6 c6 item 3 — the three band short labels are DERIVED from the
					 * canonical constants, never retyped.
					 *
					 * Two reasons, and the second is the load-bearing one. First,
					 * `EXCESS_LOAD_LABEL` ("Excess teaching load") is 20 characters and
					 * the trigger's `xl` face budget is 24, so `Load: Excess teaching
					 * load` clips at 25; its first word is the whole of what a trigger
					 * face needs, and the popover keeps the full label. Second — and
					 * this is the rule `a3-c4-draft-truth` polices — a second spelling
					 * of a policy band in this file would be a second authority for it,
					 * so a reword of the canonical constant propagates here for free
					 * instead of leaving the trigger and the popover disagreeing.
					 */
					shortLabels={{
						excess: EXCESS_LOAD_LABEL.split(' ')[0],
						'at-standard': AT_STANDARD_LABEL,
						'below-standard': BELOW_STANDARD_LABEL,
					}}
					value={loadFilter}
					onValueChange={(value) => onLoadFilterChange(value as TeachingLoadLoadFilter)}
					options={[
						{ value: 'all', label: 'All loads' },
						{ value: 'excess', label: `${EXCESS_LOAD_LABEL} (${policyReady ? (loadFacetCounts.excess ?? 0) : '—'})`, disabled: !policyReady || (loadFacetCounts.excess ?? 0) === 0 },
						{ value: 'at-standard', label: `${AT_STANDARD_LABEL} (${policyReady ? (loadFacetCounts['at-standard'] ?? 0) : '—'})`, disabled: !policyReady || (loadFacetCounts['at-standard'] ?? 0) === 0 },
						{ value: 'below-standard', label: `${BELOW_STANDARD_LABEL} (${policyReady ? (loadFacetCounts['below-standard'] ?? 0) : '—'})`, disabled: !policyReady || (loadFacetCounts['below-standard'] ?? 0) === 0 },
					]}
				/>

				{/* 5 — sort order. The most-recently-hidden control, promoted in fix 39.

				    A6 c6 item 3: `Sort: Lowest load` was 17 characters against a 12-char
				    `md` face, which is the clipped control Lane C photographed. The
				    short labels keep the DIRECTION on the trigger (`Load, high` /
				    `Load, low`) while the popover keeps the unambiguous full labels
				    (`Highest load` / `Lowest load`), so nothing that used to be readable
				    anywhere is lost. */}
				<FilterPicker
					name="Sort"
					ariaLabel="Sort teachers"
					width="xl"
					shortLabels={{ 'load-desc': 'Load, high', 'load-asc': 'Load, low' }}
					value={sortOrder}
					onValueChange={onSortOrderChange}
					options={[
						{ value: 'load-desc', label: 'Highest load' },
						{ value: 'load-asc', label: 'Lowest load' },
					]}
				/>

				{/*
				    A6 c6 item 1 + 3 — THE TWO INCLUSION SWITCHES MOVE OFF THE ROW.

				    THE SUBTRACTION, with the arithmetic: the two always-on switches cost
				    ~555px of the ~1326px content width at 1366 and cost a scheduler two
				    controls they reach rarely, in exchange for two that narrow the roster
				    to a special case. They now sit in one quiet popover on the SAME row,
				    behind a 123px trigger — net −432px and one fewer control, with no
				    second row and no new band.

				    THE IDS ARE UNCHANGED (`show-outside-dept`,
				    `show-unmapped-specialization`). They are stable DOM hooks that
				    several committed rows address by id, so only the VISIBLE WORDS moved
				    from `Cross-Dept` / `Unmapped Specialization` to two plain sentences
				    that say what the switch DOES. The trigger states how many are on, so
				    a narrowed roster is never narrowed silently.
				    */}
				<Popover>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							data-testid="teaching-load-more-filters"
							aria-label={inclusionCount > 0 ? `More filters, ${inclusionCount} on` : 'More filters'}
							className={`${PICKER_ROW_CONTROL_CLASS} gap-1.5`}
						>
							<ListFilter className="size-3.5" aria-hidden="true" />
							More filters{inclusionCount > 0 ? ` (${inclusionCount} on)` : ''}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-80 p-3" data-testid="teaching-load-more-filters-panel">
						<div className="flex flex-col gap-2">
							<div className={SWITCH_CHROME}>
								<Switch
									id="show-outside-dept"
									checked={showOutsideDept}
									onCheckedChange={onToggleOutsideDept}
								/>
								<Label htmlFor="show-outside-dept" className={SWITCH_LABEL_CLASS}>
									Show teachers outside their subject area
								</Label>
							</div>

							<div className={SWITCH_CHROME}>
								<Switch
									id="show-unmapped-specialization"
									checked={showUnmappedSpecialization}
									onCheckedChange={onShowUnmappedSpecializationChange}
								/>
								<Label htmlFor="show-unmapped-specialization" className={SWITCH_LABEL_CLASS}>
									Show teachers with no matched subject
								</Label>
							</div>
						</div>
					</PopoverContent>
				</Popover>

				{/* FIX 40: the draft group. `ml-auto` pushes it right, so the filters
				    stay left-aligned and the actions sit at the end of the same line. */}
				{draftControls ? (
					<div className="ml-auto flex shrink-0 items-center gap-2">{draftControls}</div>
				) : null}
			</div>

			{hasActiveFilters && (
				<div className="flex flex-wrap items-center gap-1.5" data-testid="teaching-load-active-filters">
					<span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Active filters:</span>
					{searchQuery.trim() && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							Search: {searchQuery.trim()}
						</Badge>
					)}
					{filterStatus !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							{filterStatus === 'teaching-assigned' ? 'Teaching assigned' : filterStatus === 'no-teaching' ? 'No teaching load' : 'Adviser only'}
						</Badge>
					)}
					{departmentFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							{departmentOptions.find((option) => option.value === departmentFilter)?.label ?? departmentFilter}
						</Badge>
					)}
					{loadFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-[11px] font-bold">
							{loadFilter === 'excess' ? 'Excess teaching load' : loadFilter === 'at-standard' ? 'At standard' : BELOW_STANDARD_LABEL}
						</Badge>
					)}
					<Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] font-bold uppercase" onClick={onClearTeachingLoadFilters}>
						<RotateCcw className="size-3.5" />
						Clear all
					</Button>
				</div>
			)}

			<p className="sr-only" role="status" aria-live="polite" data-testid="teaching-load-filter-announcement">
				{filterAnnouncement}
			</p>

			{!policyReady && (
				<div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-amber-900" data-testid="teaching-load-policy-readiness">
					<div className="flex items-start gap-3">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
						<div>
							<p className="text-sm font-semibold">Teaching standard not configured</p>
							<p className="text-xs font-medium text-amber-800/80">ATLAS has no persisted workload policy for this school year, so utilization, remaining, and excess figures are unavailable. Teaching assignments and department filters still work. Ask an administrator to configure the teaching standard before generating.</p>
						</div>
					</div>
				</div>
			)}

		{/*
		 * FIX 39 removed the `showFilters && …` secondary block that lived
		 * here. Its two children — the `Sort teachers` picker and the two
		 * inclusion switches — are on the primary row above (the switches
		 * inside that row's `More filters` popover since A6 c6), and its
		 * `rounded-xl border border-border/50 bg-background/80 p-2 shadow-sm`
		 * card is gone with it. The active-filter badge row, the `sr-only`
		 * announcement, and the `!policyReady` notice above are UNCHANGED:
		 * they are a summary of what is applied, not a second place to
		 * apply it, and they must keep rendering even with no filters
		 * active.
		 */}
		</div>
	);
}
