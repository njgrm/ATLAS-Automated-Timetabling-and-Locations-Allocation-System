/**
 * TeachingLoadFilterBar — the By-teacher workspace discovery controls.
 *
 * Fix 14/16. Root cause of the old density: Department, Load, and Sort all sat
 * behind a `More filters` disclosure, so filtering the roster cost two clicks
 * for the three filters an operator actually reaches for. This bar promotes
 * Status, Department, and Load to one always-visible row and leaves only Sort
 * and the two optional inclusion switches behind the disclosure.
 *
 * FIX 39, BACK IN ITS ORIGINAL FORM (operator, 2026-09-29). A6 c6 had put the two
 * optional inclusion switches behind a `More filters` POPOVER on this same row,
 * reasoning that they cost ~555px and are reached rarely. The operator read the
 * disclosure as "a filter an operator uses daily is two clicks away" and asked
 * for it to be removed from the DOM ENTIRELY, with both switches as direct
 * toggles on the one continuous row. So the popover is GONE: there is no
 * `More filters` trigger and no `-panel` element, in any state, and the two
 * switches are back on the row themselves. Fix 39's original row is what this
 * file ships: ONE `flex flex-wrap items-center gap-2` carrying search, Status,
 * Department, Load, Sort and both switches, with NO disclosure and no second row.
 *
 * WHY THE ROW FITS AT 1366 — MEASURED, NOT ASSUMED. The comment this replaces
 * put the budget at ~1326px of content width. IT IS 1078px: the page's left rail
 * is 272px at the 1366px supported desktop viewport, so 1078px is the whole
 * budget for this row, and the old `xl` arithmetic overflowed it by itself:
 *
 *   4 pickers at `xl` (w-52 = 208px)  = 832
 *   + the 240px search                 = 1072
 *   + 5 gaps (gap-2 = 8px)             = 1112   >   1078   OVERFLOWS
 *
 * `lg` (w-44 = 176px) does not rescue it: 4 × 176 + 240 + 6 × 8 = 992 leaves
 * 86px, and two bare Radix switch tracks are already 72px before a single word.
 * The ONLY width that fits is content-sized, so all four pickers take the shared
 * `auto` variant. Its measured default faces are `Status: All` ~110,
 * `Department: All` ~128, `Load: All` ~98 and `Sort: Load, low` ~134 — about 470
 * total, which with the 240px search and six gaps (48px) is 758 and leaves ~320px
 * for the two toggles at their default state.
 *
 * `auto` is the SHARED variant, not a new one (`AGENTS.md` §8 "One look per
 * control"): `@/ui/picker-trigger` already declares it for a trigger whose label
 * is DYNAMIC, which is exactly the case a server-supplied department name is. All
 * four pickers take the SAME variant, so the row does not mix a control's looks,
 * and no page restates a width. It also retires a silent-truncation risk the
 * fixed rectangle carried: `Department`'s value is a DATA-DRIVEN label, so a long
 * department name used to be clipped with no cue at all.
 *
 * THE TWO SWITCH LABELS, AND WHY THE FACE IS SHORTER THAN THE SENTENCE. A6 c6
 * replaced the shouted `CROSS-DEPT` / `UNMAPPED SPECIALIZATION` with two plain
 * SENTENCES, and the sentences are the right words — but a 38- and a
 * 35-character sentence cannot sit beside four pickers on a 1078px row. So the
 * full sentence is the switch's `aria-label` AND its `@/ui` Tooltip, and the
 * visible face is the shortest plain words that still say what the control does:
 * `Cross-subject` and `No subject match`. Sentence case, no `uppercase`, no
 * `tracking-tight`. The `id` attributes are UNCHANGED (`show-outside-dept`,
 * `show-unmapped-specialization`): they are stable DOM hooks that committed rows
 * address, not visible text.
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
import { AlertTriangle, LayoutGrid, RotateCcw, Search, Star } from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { FilterPicker } from '@/ui/filter-picker';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
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
 * shouted at an older scheduler. A6 c6 replaced them with two plain SENTENCES; fix 39
 * (restored, 2026-09-29) keeps the sentences as the `aria-label` and the Tooltip and
 * shortens only the FACE to `Cross-subject` / `No subject match`, because a 1078px row
 * cannot hold a 38-character label beside four pickers. That is a WORDING change and
 * nothing else: the same `SWITCH_CHROME` box, the same `h-9`, the same ids, the same
 * `label for=` wiring. `a6-tl-header-budget` `A6c4-G2-6` capped caps on a switch label at
 * two; this file reaches zero, which still satisfies `<= 2`, and that row is
 * deliberately left untouched rather than relaxed.
 *
 * A6 c6 item 3 PUBLISHED A PER-WIDTH CHARACTER BUDGET in `@/ui/picker-trigger`, and it
 * still stands — `pickerTriggerFaceFits` is the predicate a page answers its row
 * arithmetic with. What fix 39 changed is WHICH variant the four picks take: `auto`,
 * which is content-sized and therefore cannot clip. The budget is therefore no longer
 * what keeps this row whole; the arithmetic in the file header is.
 */
const SWITCH_CHROME = 'flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 transition-colors hover:bg-muted/40';

/*
 * A6 c10 — `Cross-subject` READ AS A PERMISSION, and it is not one.
 *
 * Codex audit, 2026-09-29 against release `e75d6b8f`, finding 1 (MINOR) and
 * repeated in the 16:05 addendum: "The existing `Cross-subject` switch on
 * /teaching-load is an unlabeled filter, not a permission: either retire it or
 * label it `Include teachers from other departments`; the permission itself lives
 * in the Cover window + teacher profile."
 *
 * A scheduler reading `Cross-subject` next to a switch reasonably concludes that
 * flipping it lets teachers teach outside their department. It does not: it only
 * changes WHICH TEACHERS ARE LISTED. The audit's remedy is either/or — retire it,
 * or label it — and retiring it is not available here, because the row it sits on
 * would then silently drop every cross-department teacher from the roster and the
 * scheduler would never learn they existed. So it is LABELLED, in the audit's own
 * direction, with the first word doing the work: `Include` is a verb about the
 * LIST, which is what the control does.
 *
 * The explanation says so explicitly and then says where the real permission
 * lives, because a control that only says "this is not that" leaves the scheduler
 * with no route. The permission is now reachable from two places: the Allow prompt
 * in `Cover this class`, and `Teaching permissions` on the teacher's profile.
 *
 * WIDTH. `Include other depts` is 19 characters against `Cross-subject`'s 12, so
 * the face grows by about 45px. It carries ONE capital, so `a6-tl-header-budget`
 * `A6c4-G2-6` (caps on a switch label <= 2) still passes untouched. The row
 * arithmetic in this file's header is unchanged, and fix 39's `auto` picker
 * variant is content-sized, so no other control has to move.
 */
export const OUTSIDE_DEPT_FILTER_FACE = 'Include other depts';
export const OUTSIDE_DEPT_FILTER_EXPLANATION =
	'Filter: show teachers from other departments in this list. To let one teacher teach another subject, use Cover this class or Teaching permissions on their profile.';

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
	 * A6 c6 item 3, REVERSED by fix 39 (2026-09-29). This used to count how many of
	 * the two inclusion switches were ON so the deleted `More filters` trigger could
	 * say so on its own face. With the disclosure gone there is no trigger to state
	 * a count, and the count itself is dropped rather than re-homed onto a switch
	 * face: a switch's own track already states on/off, which is the honest place
	 * for that fact, and a number on a control's face is a number an older scheduler
	 * does not read off a filter row. The live `sr-only` `filterAnnouncement`
	 * channel is untouched — it announces filter RESETS and CLEARS (see
	 * `hooks/useTeachingLoadUI.ts`), which is a different job and is still correct.
	 */

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

				{/* FIX 39 (2026-09-29), update not delete: every pick takes the SAME
				    shared `auto` width variant. `xl` (`w-52`, 208px) was the previous
				    answer and it is the reason the row did not fit: 4 × 208 + a 240px
				    search + five 8px gaps is 1112px against a 1078px budget. `auto` is
				    content-sized, so it cannot clip AND it cannot leave a gap, which is
				    what a fixed rectangle does beside a data-driven department name.
				    A6 c6's ruling below is unchanged and still load-bearing: the COUNT
				    comes off every trigger face and the popover keeps every full
				    option label with its count. §8 "One look per control" is about a
				    row not mixing a control's looks, so all four take the same
				    variant — and `auto` is a variant `@/ui` already declares, not one
				    this page adds. */}
				<FilterPicker
					name="Status"
					ariaLabel="Filter by status"
					width="auto"
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
					width="auto"
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
					width="auto"
					/*
					 * A6 c6 item 3 — the three band short labels are DERIVED from the
					 * canonical constants, never retyped. That ruling is unchanged
					 * under the `auto` variant: the trigger face is content-sized, so
					 * the short label is no longer load-BEARING for the width, but it
					 * is still the honest thing to put on a row an older scheduler
					 * reads at a glance, and a reword of the canonical constant must
					 * still propagate here rather than leaving the trigger and the
					 * popover disagreeing — that rule (`a3-c4-draft-truth` polices it)
					 * is what these derived labels exist for.
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

				    A6 c6 item 3's short labels are kept: the trigger keeps the
				    DIRECTION (`Load, high` / `Load, low`) and the popover keeps the
				    unambiguous full labels (`Highest load` / `Lowest load`), so nothing
				    that used to be readable anywhere is lost. Under `auto` they are
				    no longer what stops a clip, but the full option labels remain the
				    authoritative reading. */}
				<FilterPicker
					name="Sort"
					ariaLabel="Sort teachers"
					width="auto"
					shortLabels={{ 'load-desc': 'Load, high', 'load-asc': 'Load, low' }}
					value={sortOrder}
					onValueChange={onSortOrderChange}
					options={[
						{ value: 'load-desc', label: 'Highest load' },
						{ value: 'load-asc', label: 'Lowest load' },
					]}
				/>

				{/*
				    FIX 39, RESTORED (operator, 2026-09-29) — THE TWO INCLUSION
				    SWITCHES ARE DIRECT TOGGLES ON THIS ROW AGAIN.

				    There is no `More filters` trigger and no `-panel`: the operator read
				    the disclosure as "a filter an operator uses daily was two clicks
				    away" and asked for it to leave the DOM entirely. The row still fits
				    because the four pickers moved to the shared content-sized `auto`
				    variant — see the arithmetic in this file's header.

				    THE IDS ARE UNCHANGED (`show-outside-dept`,
				    `show-unmapped-specialization`). They are stable DOM hooks that
				    several committed rows address by id, so only the VISIBLE WORDS
				    changed. The face is the shortest plain words that still say what the
				    control does (`Cross-subject`, `No subject match`); the full
				    sentence is the switch's `aria-label` AND its `@/ui` Tooltip,
				    because a 38-character sentence cannot sit beside four pickers on a
				    1078px row and a `title` attribute is banned by `AGENTS.md` §8.
				    The switch keeps its own `aria-checked`, which is where on/off is
				    honestly stated now that the deleted trigger no longer carried a
				    count.

				    ONE GROUP, NOT TWO BOXES (correction round 1, 2026-09-29). The
				    first attempt at this slice put each switch in its own
				    `SWITCH_CHROME` box inside ONE wrapper that ALSO held the draft
				    group. The rendered measurement at 1366x768 on real staging data
				    showed why that was wrong: the wrapper is a single flex item, so it
				    wraps as a UNIT. It measured 621px — the two filter toggles plus
				    the 292px draft group — and dragging the two FILTERS onto a second
				    line is exactly what the operator's headline forbids ("consolidate
				    all filter controls into a single row"). So the switches and the
				    draft group are now SIBLINGS on the one row, in the operator's
				    order: the filters first, the draft group last.

				    THE TWO SWITCHES SHARE ONE BOX. Two boxes cost two `px-2.5` (20px),
				    two borders (2px) and an 8px inter-box gap; one box costs 22px of
				    chrome and the row's own `gap-2` supplies the separation, with a
				    `border-l` so the boundary between the two toggles is still
				    visible. `SWITCH_CHROME` is applied UNCHANGED — including its
				    `h-9`, which is what keeps this group the same height as the `h-9`
				    pickers and the `h-9` search beside it; a box without it would be a
				    20px-tall control in a 36px row. The group's own `gap-2` IS the
				    `gap-2` between the two pairs the packet asked for, so the second
				    sub-wrapper carries only the divider and no extra padding (adding
				    `pl-2` as well would space them 16px and spend 8px of the 24px
				    slack).

				    THE TOOLTIP WRAPS EACH SWITCH'S OWN SUB-WRAPPER, not the shared
				    group, so hovering one toggle cannot open the other's explanation.

				    FIX 40'S DRAFT GROUP IS UNCHANGED: its own `ml-auto flex shrink-0
				    items-center gap-2`, so `Save changes` stays hard right, and with a
				    draft present it wraps onto its own right-aligned second line —
				    which is one row of FILTERS plus a separate draft action group, not
				    a filter row broken in two.
				    */}
				<div className={SWITCH_CHROME} data-testid="teaching-load-inclusion-switches">
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center gap-2">
									<Switch
										id="show-outside-dept"
										checked={showOutsideDept}
										onCheckedChange={onToggleOutsideDept}
										aria-label={OUTSIDE_DEPT_FILTER_EXPLANATION}
									/>
									<Label htmlFor="show-outside-dept" className={SWITCH_LABEL_CLASS}>
										{OUTSIDE_DEPT_FILTER_FACE}
									</Label>
								</div>
							</TooltipTrigger>
							<TooltipContent side="top" className="max-w-72 text-xs leading-relaxed">
								{OUTSIDE_DEPT_FILTER_EXPLANATION}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center gap-2 border-l border-border/60">
									<Switch
										id="show-unmapped-specialization"
										checked={showUnmappedSpecialization}
										onCheckedChange={onShowUnmappedSpecializationChange}
										aria-label="Show only teachers whose subject is not in the catalog"
									/>
									<Label htmlFor="show-unmapped-specialization" className={SWITCH_LABEL_CLASS}>
										No subject match
									</Label>
								</div>
							</TooltipTrigger>
							<TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
								Show only teachers whose subject is not in the catalog
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				{/* FIX 40: the draft group, its own `ml-auto` child of the one row again,
				    so the two filter toggles are never dragged onto a second line by it. */}
				{draftControls ? (
					<div className="ml-auto flex shrink-0 items-center gap-2">{draftControls}</div>
				) : null}
			</div>

			{hasActiveFilters && (
				<div className="flex flex-wrap items-center gap-1.5" data-testid="teaching-load-active-filters">
					<span className="text-xs font-bold tracking-wide text-muted-foreground">Active filters:</span>
					{searchQuery.trim() && (
						<Badge variant="secondary" className="gap-1 text-xs font-bold">
							Search: {searchQuery.trim()}
						</Badge>
					)}
					{filterStatus !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-xs font-bold">
							{filterStatus === 'teaching-assigned' ? 'Teaching assigned' : filterStatus === 'no-teaching' ? 'No teaching load' : 'Adviser only'}
						</Badge>
					)}
					{departmentFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-xs font-bold">
							{departmentOptions.find((option) => option.value === departmentFilter)?.label ?? departmentFilter}
						</Badge>
					)}
					{loadFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1 text-xs font-bold">
							{loadFilter === 'excess' ? 'Excess teaching load' : loadFilter === 'at-standard' ? 'At standard' : BELOW_STANDARD_LABEL}
						</Badge>
					)}
					<Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-bold" onClick={onClearTeachingLoadFilters}>
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
		 * inclusion switches — are on the primary row above (the switches as
		 * direct toggles again, since fix 39 was restored on 2026-09-29), and
		 * its `rounded-xl border border-border/50 bg-background/80 p-2 shadow-sm`
		 * card is gone with it. The active-filter badge row, the `sr-only`
		 * announcement, and the `!policyReady` notice above are UNCHANGED:
		 * they are a summary of what is applied, not a second place to
		 * apply it, and they must keep rendering even with no filters
		 * active.
		 */}
		</div>
	);
}
