/**
 * TeachingLoadFilterBar — the By-teacher workspace discovery controls.
 *
 * Fix 14/16. Root cause of the old density: Department, Load, and Sort all sat
 * behind a `More filters` disclosure, so filtering the roster cost two clicks
 * for the three filters an operator actually reaches for. This bar promotes
 * Status, Department, and Load to one always-visible row and leaves only Sort
 * and the two optional inclusion switches behind the disclosure.
 *
 * FIX 39 (operator, 2026-09-28) — THE DISCLOSURE IS GONE ENTIRELY. The
 * operator's row is one continuous `flex flex-wrap items-center gap-2` carrying
 * all seven controls, in this exact order: search, status, department, load,
 * sort, cross-dept, unmapped-specialization. There is no `More filters` button
 * and there is no second row. The reasoning is the original criterion, not a
 * preference: a filter an operator uses daily was two clicks away, and the
 * second row was a `rounded-xl border bg-background/80 p-2 shadow-sm` card that
 * claimed its own box in a header already measured in single-digit pixels of
 * headroom.
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
import type { ReactNode } from 'react';
import { AlertTriangle, LayoutGrid, ListFilter, RotateCcw, Search, Star } from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { FilterPicker } from '@/ui/filter-picker';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
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
 * The two switch LABELS keep their `uppercase tracking-tight`. R1 B4's target was the pickers'
 * chrome and their option rows; a Switch label is a different control, and restyling it would be
 * a change the sweep was not asked to make. Recorded here rather than left implicit.
 */
const SWITCH_CHROME = 'flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 transition-colors hover:bg-muted/40';

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
				    (Excess, At standard, Below standard). Flagged for the
				    reviewer's judgement as layout-note D1. */}

				<FilterPicker
					name="Status"
					ariaLabel="Filter by status"
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
					value={loadFilter}
					onValueChange={(value) => onLoadFilterChange(value as TeachingLoadLoadFilter)}
					options={[
						{ value: 'all', label: 'All loads' },
						{ value: 'excess', label: `${EXCESS_LOAD_LABEL} (${policyReady ? (loadFacetCounts.excess ?? 0) : '—'})`, disabled: !policyReady || (loadFacetCounts.excess ?? 0) === 0 },
						{ value: 'at-standard', label: `${AT_STANDARD_LABEL} (${policyReady ? (loadFacetCounts['at-standard'] ?? 0) : '—'})`, disabled: !policyReady || (loadFacetCounts['at-standard'] ?? 0) === 0 },
						{ value: 'below-standard', label: `${BELOW_STANDARD_LABEL} (${policyReady ? (loadFacetCounts['below-standard'] ?? 0) : '—'})`, disabled: !policyReady || (loadFacetCounts['below-standard'] ?? 0) === 0 },
					]}
				/>

				{/* 5 — sort order. The most-recently-hidden control, promoted. */}
				<FilterPicker
					name="Sort"
					ariaLabel="Sort teachers"
					value={sortOrder}
					onValueChange={onSortOrderChange}
					options={[
						{ value: 'load-desc', label: 'Highest load' },
						{ value: 'load-asc', label: 'Lowest load' },
					]}
				/>

				{/* 6 and 7 — the optional-inclusion switches. Both are made
				    compact by CHROME (h-9, px-2.5, tracking-tight, nowrap), not
				    by shortening the operator's words: at 1366 the seven
				    controls total ~1289px with gaps, inside a ~1326px
				    content width, so the full `Unmapped Specialization` label
				    closes the row without wrapping. `flex-wrap` is the
				    backstop below that. */}
					<div className={SWITCH_CHROME}>
					<Switch
						id="show-outside-dept"
						checked={showOutsideDept}
						onCheckedChange={onToggleOutsideDept}
					/>
					<Label htmlFor="show-outside-dept" className="cursor-pointer whitespace-nowrap text-xs font-semibold uppercase tracking-tight text-muted-foreground">
						Cross-Dept
					</Label>
				</div>

					<div className={SWITCH_CHROME}>
					<Switch
						id="show-unmapped-specialization"
						checked={showUnmappedSpecialization}
						onCheckedChange={onShowUnmappedSpecializationChange}
					/>
					<Label htmlFor="show-unmapped-specialization" className="cursor-pointer whitespace-nowrap text-xs font-semibold uppercase tracking-tight text-muted-foreground">
						Unmapped Specialization
					</Label>
				</div>

				{/* FIX 40: the draft group. `ml-auto` pushes it right, so the seven
				    filters stay left-aligned and the actions sit at the end of
				    the same line. */}
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
			 * here. Its two children — the `Sort teachers` select and the two
			 * inclusion switches — are now on the primary row above, and its
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
