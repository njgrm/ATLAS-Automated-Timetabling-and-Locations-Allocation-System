import { ALL_ROOM_TYPES, GRADE_OPTIONS, PROGRAM_SCOPE_OPTIONS, ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import { FilterPicker } from '@/ui/filter-picker';
import { FilterBar } from '@/ui/filter-bar';
import { TERM_FILTER_ALL, type TermFilterOption } from './subject-term-filter';
import { gradeLabel } from '@/lib/grade-labels';
import type { RoomType } from '@/types';

/**
 * A5 (operator items 9.1 + 41): ONE status-looking control instead of two.
 *
 * The row used to render `statusFilter` ("All Status": `all | active |
 * inactive`) AND `attentionFilter` ("All statuses": `all | missing-coverage |
 * room-constrained`). Two dropdowns that both answered "status", one of them
 * lowercase-plural, is what the operator reported as a duplicate.
 *
 * They are two different AXES, so merging them into one dropdown must not drop
 * either: one value now selects across both, and the page maps it back onto the
 * two existing predicates (`Subjects.tsx`), which is why the filtering pipeline
 * downstream is untouched. Every option that used to be reachable is still
 * reachable; the label the operator wrote, `All Status`, is what renders.
 */
export type SubjectStatusFilter =
	| 'all'
	| 'active'
	| 'inactive'
	| 'missing-coverage'
	| 'room-constrained';

type Props = {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	hasActiveFilters: boolean;
	/** A5: the one merged status control — subject lifecycle AND coverage attention. */
	subjectStatusFilter: SubjectStatusFilter;
	onSubjectStatusFilterChange: (value: SubjectStatusFilter) => void;
	roomTypeFilter: string;
	onRoomTypeFilterChange: (value: string) => void;
	gradeLevelFilter: number | 'all';
	onGradeLevelFilterChange: (value: number | 'all') => void;
	programScopeFilter: string;
	onProgramScopeFilterChange: (value: string) => void;
	/** A3-C9: the term filter. Options are derived from the real subject data. */
	termFilter: string;
	onTermFilterChange: (value: string) => void;
	termOptions: TermFilterOption[];
	onResetFilters: () => void;
};

/**
 * A5 C3 R3 §1 — the room types' SHORT trigger labels.
 *
 * The popover option list keeps `ROOM_TYPE_LABELS` exactly (`Science Laboratory`,
 * `ICT / Computer Lab`) because that list has the room and that is where a scheduler reads
 * the choices. Only the trigger's fixed rectangle is compact, so the value shown there is the
 * same room in the short words an office already uses. No room type is renamed in either place;
 * these are two lengths of the same nine names.
 *
 * EXPORTED since A5 C7, and the export is the point rather than an accident. The
 * room row is the one picker whose trigger face this page SHORTENS from its own map,
 * so the map is real surface a test needs to read: `AGENTS.md` §11 ("a control's
 * fixture must come from the real surface, and a computed artifact's byte
 * serialization must be recorded") rejected the invented-label fixture that A5 C3
 * round 1 was caught using, and a test that re-declared these nine strings would be
 * the same mistake one layer out. Reading the exported map is how the longest Room
 * face is measured against `@/ui`'s real character budget.
 */
export const ROOM_TYPE_SHORT_LABELS: Record<string, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Laboratory',
	COMPUTER_LAB: 'Computer lab',
	TLE_WORKSHOP: 'Workshop',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gymnasium',
	FACULTY_ROOM: 'Faculty room',
	OFFICE: 'Office',
	OTHER: 'Other',
};

/**
 * A5 C3 (2026-09-29) — THE TRIGGER DIMENSIONS ARE NO LONGER DECLARED HERE.
 *
 * The five filters were five `@/ui/select` (Radix) triggers carrying a page-local
 * `COMPACT_SELECT` string and five different widths — `w-40`/`w-24`/`w-28`/`w-36`/`w-28`
 * (160/96/112/144/112px). That is the "filters are pills beside rectangular pickers, widths are
 * uneven" defect the operator screenshotted on 2026-09-29, and `AGENTS.md` §8 "One look per
 * control" settles it: the trigger's size, border, placeholder style and search behaviour belong
 * to `@/ui`, not to a page.
 *
 * So this file now names a filter and supplies its options. Height, width, radius, border, case
 * and the option-list search box all come from `@/ui/filter-picker` + `@/ui/picker-trigger`.
 * A future divergence is a guard failure, not a decision someone makes twice.
 */

export function SubjectFilterToolbar({
	searchQuery,
	onSearchChange,
	hasActiveFilters,
	subjectStatusFilter,
	onSubjectStatusFilterChange,
	roomTypeFilter,
	onRoomTypeFilterChange,
	gradeLevelFilter,
	onGradeLevelFilterChange,
	programScopeFilter,
	onProgramScopeFilterChange,
	termFilter,
	onTermFilterChange,
	termOptions,
	onResetFilters,
}: Props) {
	// A5 C7 (2026-09-29) — THE LAYOUT NOTE, BEFORE THE JSX.
	//
	// WHAT THE OPERATOR NOW WANTS. Lane C's walk filed two items in opposite
	// directions and only one of them is a preference. A5 C4 read the Codex line
	// "keep Grade and Program visible and put the other filters under `More
	// filters`" as authority and shipped the disclosure. The operator then used
	// the page and filed the disclosure itself (fix-3 item 43): a scheduler has to
	// CLICK A BUTTON to find out that the page is filtered, and the button that
	// counts the filters is a number an older, mouse-first scheduler does not read
	// off a filter bar. Item 43 supersedes A5 C4. Codex's own note — no
	// truncation, one line at 1366 — is the reason this is affordable.
	//
	//   WHAT STAYS IN THE ROW .... everything. The search box, `Grade`, `Program`,
	//                              `Status`, `Room`, `Term`, and `Reset` while a
	//                              filter is set.
	//   WHAT GOES ............... the `More filters` trigger, the popover behind
	//                              it, its `Refine the subjects shown` heading, the
	//                              `(n)` count and the `SlidersHorizontal` icon.
	//                              One control out, zero in. This is §11 rule 3
	//                              subtraction with nothing added back: no chip, no
	//                              "N filters applied", no summary line, no helper
	//                              sentence.
	//   WHAT IT COSTS ............ nothing but reachability of three controls,
	//                              which is exactly what item 43 was filed about.
//   THE WIDTH, AND WHY IT IS `auto` NOT `md` (A5 C7 CORRECTION ROUND 1).
	//
	//   Round 0 shipped all five pickers on the shared `md` variant (`w-32`,
	//   128px) and I recorded a measured overflow: with `Room: Laboratory` set,
	//   that trigger reported `scrollWidth − clientWidth = 10px`. `@/ui` removed
	//   `truncate` deliberately (§8 forbids a cut-off sentence) and the trigger
	//   carries no overflow handling, so the face genuinely ran past its border.
	//   Fourteen faces across the five filters exceed `md`'s published
	//   12-character budget, and every SET value on `Status` does — `md` leaves a
	//   value only `12 − name.length − 2` characters, and for `Status` that is 4
	//   against a shortest real value of `Active` (6).
	//
	//   The three available answers, and why two of them are worse than the
	//   defect:
	//     - `lg` (176px): +48px × 5 = +240px, against 140px of measured slack.
	//       It does not fit, and §8's own words are that a row needing a wider
	//       control takes it on ALL of its pickers, so a partial widening is not
	//       an option either.
	//     - SHORTEN THE VALUES (`R-con`, `No cov`): this is the "too literal, no
	//       thought" failure §11's design judgement gate exists to prevent, and it
	//       makes the page worse for the older, mouse-first scheduler the whole
	//       packet is written for.
	//     - `auto` (`w-auto whitespace-nowrap`): the codebase's OWN published
	//       answer to exactly this shape, and the one A5 C4 added to `@/ui` FOR
	//       THIS PAGE when the deleted `More filters` button had the same problem.
	//
	//   `auto` is not a workaround; it is the variant for this case:
	//     - `picker-trigger.ts`'s own guard says a width that is not a fixed
	//       rectangle ALWAYS FITS, and calls that "the load-bearing line" —
	//       "`pickerTriggerFaceFits` returns `false` for them … reports a FALSE
	//       FAILURE … a guard that cries wolf on the width that is safest is how
	//       a guard gets deleted". A page whose faces do not fit a fixed
	//       rectangle is not misusing `md`; it is what `auto` exists for.
	//     - It SUBTRACTS. No chip, no count, no label, no helper sentence, no
	//       control. It removes a whole failure class rather than hiding it.
	//     - The row gets NARROWER in the common case, which is the case that
	//       matters: with nothing set every face is short (`Grade: All` is 10
	//       characters, `Program: All` and `Status: All` 12), so five `auto`
	//       triggers occupy less width than five 128px rectangles. The extra
	//       width is spent only on the specific filter that is actually set.
	//
	//   ALL FIVE take `auto`, so §8 "One look per control" is untouched: the
	//   height (`h-9`), radius, border, case treatment, `px-3`, `text-xs` and the
	//   option-list search box all still come from `pickerTriggerClass`, and the
	//   five remain ONE variant. What changes is only that the rectangle stops
	//   being a fixed 128px that the content does not fit inside.
	//
	//   A WORD ON `@/ui`'s OWN COMMENT, which I did NOT edit. `auto`'s doc block
	//   says it exists for "a trigger whose LABEL IS DYNAMIC", naming the
	//   `More filters` button this change deleted. These five labels are static;
	//   it is their LONGEST VALUE that does not fit a fixed rectangle. The variant
	//   is the same one and the shape is the same — "a label the control must size
	//   itself to" — but `picker-trigger.ts` is shared `@/ui` owned by another
	//   lane, so widening its wording is a follow-up for that owner rather than an
	//   edit smuggled into a layout ticket.
	//
	//   THE BUDGET, worst case. `auto` cannot be budgeted from a class name the
	//   way a fixed variant can, so the worst case is measured in the browser
	//   rather than computed: all five filters set to their longest face
	//   (`Status: Room-constrained`, `Term: Rotates by term`, `Room: Faculty
	//   room`, `Program: Other`, `Grade: GR7`) with `Reset` showing. See
	//   `docs/reviews/a5-c7-subjects-20260929/` for the measured numbers and
	//   whether that state still holds one line. `flex-wrap` is kept, so a state
	//   that cannot fit degrades by wrapping onto a second row rather than
	//   overflowing the page (§8's no-scrollbar rule).
	//   WHAT IS NOT CHANGED ..... every picker below is still the SAME
	//                              `@/ui/filter-picker` with the same
	//                              self-naming trigger, its own
	//                              `ariaLabel` and its own `dataTestId`; the
	//                              merged `SubjectStatusFilter` axis, its
	//                              `shortLabels`, `ROOM_TYPE_SHORT_LABELS`,
	//                              `gradeLabel(g)` and `TERM_FILTER_ALL` are all
	//                              untouched. This is a layout change. If an edit
	//                              here ever changes WHICH SUBJECTS a value
	//                              selects, it has stopped being a layout change.
	//
	// A5 C4, SUPERSEDED VERBATIM: its note argued the disclosure was subtraction
	// ("three rectangles leave the row, one button arrives"). Kept here as the
	// record of why the argument was wrong — the button it added was a thing a
	// scheduler had to open, and §11 rule 4 counts controls a scheduler must
	// find, not controls on screen.
	//
	// A5 C7's INERT-PROPS PARAGRAPH IS GONE WITH THE PROPS IT DESCRIBED (A5 c8,
	// 2026-09-29). It recorded why `filtersOpen={false}` and `onToggleFilters={() => {}}`
	// were passed to `AdminSearchFilterToolbar` to keep ITS disclosure from
	// rendering. That component is deleted, so there is nothing left to keep off and
	// the paragraph would have been an instruction to re-add a lie. The rule it
	// reached for still holds and is now satisfied structurally rather than by
	// argument: there is one bar implementation in the codebase, and it has no
	// disclosure to switch off.
	//
	// A5 c8 (2026-09-29) — THE LAYOUT NOTE, BEFORE THE JSX. It supersedes the
	// A5 C7 note above only where it described a workaround; the reasoning about
	// `auto` below is unchanged and still load-bearing.
	//
	//   WHAT THE OPERATOR WANTS NOW. Lane C's sweep filed a MAJOR against this
	//   page's `More filters` disclosure, and the operator's own ruling is
	//   "we want filters to be shown instantly". A5 C7 had already moved the three
	//   concealed filters into the row; what remained was the SHELL — a second
	//   filter-bar implementation (`AdminSearchFilterToolbar`) plus two required
	//   props that existed only to keep ITS disclosure from rendering, passed
	//   inert, with a comment explaining why the lie was safe.
	//
	//   WHAT STAYS IN THE ROW .... everything. The search box, `Grade`, `Program`,
	//                              `Status`, `Room`, `Term`, and `Reset` while a
	//                              filter is set.
	//   WHAT GOES ............... `AdminSearchFilterToolbar` and the two inert
	//                              props (`filtersOpen`, `onToggleFilters`) plus the
	//                              `primaryFilterCount={1}` that kept its overflow
	//                              list empty. The shared row is now
	//                              `@/ui/filter-bar`, so this page cannot drift from
	//                              `/teachers` or `/teaching-load` again.
	//   WHAT MOVES .............. the `subjects-filter-cluster` `data-testid` onto
	//                              the bar's own container, and the `Reset` button
	//                              onto `FilterBar`'s `onReset`. Both are the same
	//                              control in the same place; the hook follows the
	//                              control so the committed suites keep reaching it.
	//
	//   THE WIDTH, AND WHY IT IS `auto` NOT `md` (A5 C7, unchanged).
	//
	//   `picker-trigger.ts`'s own guard says a width that is not a fixed
	//   rectangle ALWAYS FITS — and A5 c8 is why that stays true rather than
	//   becoming a false failure: `auto` is now BOUNDED (`min-w-32 max-w-[22rem]`)
	//   and its face WRAPS inside that box (`h-auto min-h-9`) instead of running
	//   past its own border, which is the `/sections` spill Lane C measured. Fourteen
	//   faces across the five filters exceed `md`'s published 12-character budget,
	//   and every SET value on `Status` does, so a fixed rectangle is not available
	//   to this row at any honest width.
	//
	//   ALL FIVE take `auto`, so §8 "One look per control" is untouched: the
	//   height (`min-h-9`), radius, border, case treatment, `px-3`, `text-xs` and the
	//   option-list search box all still come from `pickerTriggerClass`, and the
	//   five remain ONE variant. What changes is only that the rectangle stops
	//   being a fixed 128px that the content does not fit inside.
	//
	//   `flex-wrap` in `FilterBar` keeps a state that cannot fit degrading by
	//   wrapping onto a second row rather than overflowing the page (§8's
	//   no-scrollbar rule).
	//
	//   WHAT IS NOT CHANGED ..... every picker below is still the SAME
	//                              `@/ui/filter-picker` with the same
	//                              self-naming trigger, its own
	//                              `ariaLabel` and its own `dataTestId`; the
	//                              merged `SubjectStatusFilter` axis, its
	//                              `shortLabels`, `ROOM_TYPE_SHORT_LABELS`,
	//                              `gradeLabel(g)` and `TERM_FILTER_ALL` are all
	//                              untouched. This is a layout change. If an edit
	//                              here ever changes WHICH SUBJECTS a value
	//                              selects, it has stopped being a layout change.
	return (
		<FilterBar
			dataTestId="subjects-filter-cluster"
			search={{
				value: searchQuery,
				onChange: onSearchChange,
				placeholder: 'Search name or code...',
				ariaLabel: 'Search subjects by name or code',
			}}
			onReset={hasActiveFilters ? onResetFilters : undefined}
			resetTestId="subjects-reset-filters"
		>
			{/* R3 §1: the operator's own words are `Grade: All`, `Program: All` — the
			    TRIGGER shows the filter's short name and a short value, the POPOVER keeps
			    the full labels, and the ACCESSIBLE NAME keeps the long form composed from
			    `ariaLabel`. R1 A1's `Grade: All grades` was the packet's own lengthening of
			    that example, and it is what forced the cluster to wrap. This is
			    `/timetable`'s entity picker unchanged: a compact trigger over a list of
			    long options (R2-6 rule 5). */}
			<FilterPicker
				name="Grade"
				width="auto"
				ariaLabel="Filter by grade level"
				value={String(gradeLevelFilter)}
				onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}
				options={[
					{ value: 'all', label: 'All grades' },
					...GRADE_OPTIONS.map((g) => ({
						value: String(g),
						/* The shared compact grade form (`GR7`), the same one
						   the grade chips and the coverage dialog use — not
						   `Grade 7`, and not a second spelling. */
						label: gradeLabel(g),
					})),
				]}
			/>
			<FilterPicker
				name="Program"
				width="auto"
				ariaLabel="Filter by program scope"
				value={programScopeFilter}
				onValueChange={(v) => onProgramScopeFilterChange(v)}
				options={[
					{ value: 'all', label: 'All programs' },
					...PROGRAM_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
				]}
				dataTestId="subjects-program-filter"
			/>

			{/* A5 C7: THE THREE THAT SAT BEHIND the disclosure, now IN the row.
			 *
			 * Their order is unchanged from the popover they came out of, and
			 * every option list, `shortLabels` map, `ariaLabel` and
			 * `dataTestId` is what it was. This is a MOVE, not a rewrite: the
			 * A5 C4 QA that wrote most of these comments — that no filter may
			 * claim `All` for a list with no `all` member, that the trigger is
			 * compact while the list keeps the full label, that `gradeLabel`
			 * is the one shared grade spelling — decided about the CONTROL,
			 * and none of it depends on where the control sits. */}
			<FilterPicker
				name="Status"
				width="auto"
				ariaLabel="Filter by subject status"
				value={subjectStatusFilter}
				onValueChange={(v) => onSubjectStatusFilterChange(v as SubjectStatusFilter)}
				options={[
					{ value: 'all', label: 'All statuses' },
					{ value: 'active', label: 'Active' },
					{ value: 'inactive', label: 'Archived' },
					/* The coverage-attention axis, folded into the one status
					   control rather than dropped (see `SubjectStatusFilter`). */
					{ value: 'missing-coverage', label: 'Missing teacher coverage' },
					{ value: 'room-constrained', label: 'Room-constrained subjects' },
				]}
				shortLabels={{
					active: 'Active',
					inactive: 'Archived',
					'missing-coverage': 'No coverage',
					'room-constrained': 'Room-constrained',
				}}
				dataTestId="subjects-status-filter"
			/>
			<FilterPicker
				name="Room"
				width="auto"
				ariaLabel="Filter by room type"
				value={roomTypeFilter}
				onValueChange={(v) => onRoomTypeFilterChange(v)}
				options={[
					{ value: 'all', label: 'All room types' },
					...ALL_ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] })),
				]}
				/* R3 §1: the popover keeps the full labels (`Science Laboratory`,
				   `ICT / Computer Lab`); only the trigger's rectangle is compact. */
				shortLabels={ROOM_TYPE_SHORT_LABELS}
				dataTestId="subjects-room-type-filter"
			/>
			<FilterPicker
				name="Term"
				width="auto"
				ariaLabel="Filter by rotation term"
				value={termFilter}
				onValueChange={onTermFilterChange}
				options={termOptions.map((option) => ({ value: option.value, label: option.label }))}
			/>
		</FilterBar>
	);
}

/** Re-exported so a caller can compare a stored value against the default. */
export { TERM_FILTER_ALL };
