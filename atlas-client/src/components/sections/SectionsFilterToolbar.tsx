/**
 * A5 C3 slice B (2026-09-29) — `/sections` grade / program / home-room filters, on the
 * one shared picker.
 *
 * BEFORE: three Radix `@/ui/select` triggers at `h-10 text-sm`. That is a TALLER, larger-type
 * control than every other filter in the product — the operator's roster looks like a different
 * application from the page she just left. `AGENTS.md` §8 "One look per control" settles it: the
 * same `@/ui` primitive, the same trigger size, the same search behaviour.
 *
 * WHAT IS AND IS NOT CHANGING. Only the primitive, the chrome, the self-naming and — in
 * A5 c8 — the ROW. Every option label is this page's own vocabulary and is untouched —
 * `All Grades`, `All Programs`, `All home-room states`, the `needs a home room` /
 * `home room assigned` pair, and the `Regular Program` entry. The `all` first option in
 * each list is retained.
 *
 * THE `grid sm:grid-cols-3` LAYOUT IS GONE (A5 c8, 2026-09-29). Three equal columns was
 * this page's own decision, and it is the decision Lane C's walk rejected: spread across
 * the full width with large gaps, the three rectangles read as three unrelated
 * questions. The three pickers are now `width="auto"` siblings in the one wrapping
 * `FilterBar` row, left-aligned, in the same order. The `program-code-legend` line
 * beneath the bar moved onto the `Program` picker as a `hint`, which is a `@/ui`
 * Tooltip, and kept its `data-testid` on the tooltip's trigger wrapper so committed rows
 * that read it still read the same words.
 *
 * THE LABELS ARE THE PAGE'S, the trigger text follows R3-1 (`{ShortName}: {ShortValue}`), and
 * the accessible name keeps the long form so a screen reader is not worse off than before.
 * R2-5 applies through `FilterPicker`: none of these three lists reaches eight options, so none
 * earns a search box and all three open straight onto their options — one fewer thing to aim at
 * on a three-row list.
 */
import { FilterPicker } from '@/ui/filter-picker';
import { programShortLabel, programFullLabel } from '@/lib/deped-glossary';

type SectionsFilterToolbarProps = {
	gradeFilter: string;
	onGradeFilterChange: (value: string) => void;
	availableGrades: string[];
	programFilter: string;
	onProgramFilterChange: (value: string) => void;
	availablePrograms: string[];
	homeRoomFilter: string;
	onHomeRoomFilterChange: (value: string) => void;
};

export function SectionsFilterToolbar({
	gradeFilter,
	onGradeFilterChange,
	availableGrades,
	programFilter,
	onProgramFilterChange,
	availablePrograms,
	homeRoomFilter,
	onHomeRoomFilterChange,
}: SectionsFilterToolbarProps) {
	/* A5 c8 (2026-09-29) — THE LAYOUT NOTE, BEFORE THE JSX.
	 *
	 * WHAT WAS WRONG, from Lane C's walk of this page:
	 *   1. The three pickers sat behind a disclosure, so `Grade`, `Program` and
	 *      `Home room` cost a click to reach (the sweep's MAJOR).
	 *   2. They were `grid-cols-3` on `sm:`, so they were spread across the full
	 *      width with large gaps between them — three rectangles reading as three
	 *      separate questions rather than one filter row.
	 *   3. The program-code legend was a fourth line of text between the filters
	 *      and the list, and it only appeared once the disclosure was open.
	 *   4. `Home room: Home room assigned` ran past its own select's border, because
	 *      the variant carried `whitespace-nowrap` and the face had nowhere to wrap.
	 *
	 * WHAT STAYS .... all three pickers, in this order (Grade, Program, Home room),
	 *                with this page's own option labels and this page's own
	 *                `All Grades` / `All Programs` / `All home-room states` first
	 *                options, and the `Regular Program` entry the page already had.
	 * WHAT GOES .... the `grid sm:grid-cols-3` wrapper (the bar is one wrapping
	 *                row now), the `grid-cols-1` fallback, and the legend `<p>`.
	 * WHAT MOVES .. the legend's WORDS move onto the `Program` picker through
	 *                `FilterPicker`'s `hint`, which is a `@/ui` Tooltip — no
	 *                `title`, no raw `<details>` (`AGENTS.md` §8). The
	 *                `data-testid="program-code-legend"` follows the sentence onto
	 *                the tooltip's trigger wrapper, so every committed row that
	 *                reads it still reads the same text.
	 * WHAT WIDENS . all three take `width="auto"`, which A5 c8 made BOUNDED
	 *                (`min-w-32 max-w-[22rem]`) and which now lets a long face WRAP
	 *                inside its own box instead of escaping it. That is defect 4
	 *                above, fixed in `@/ui` for every page at once.
	 *
	 * NOTHING ELSE MOVES. No option list, no value, no `ariaLabel`, no predicate.
	 * If an edit here changes WHICH SECTIONS a value selects, it has stopped being
	 * this change.
	 */
	const programHint = availablePrograms.length > 0
		? `Program codes: ${availablePrograms.map((p) => `${programShortLabel(p)} = ${programFullLabel(p)}`).join('; ')}`
		: undefined;

	return (
		<>
			<FilterPicker
				name="Grade"
				width="auto"
				ariaLabel="Filter by grade level"
				value={gradeFilter}
				onValueChange={onGradeFilterChange}
				options={[
					{ value: 'all', label: 'All Grades' },
					...availableGrades.map((g) => ({ value: g, label: `Grade ${g}` })),
				]}
			/>
			<FilterPicker
				name="Program"
				width="auto"
				ariaLabel="Filter by program scope"
				value={programFilter}
				onValueChange={onProgramFilterChange}
				options={[
					{ value: 'all', label: 'All Programs' },
					{ value: 'REGULAR', label: 'Regular Program' },
					...availablePrograms.map((p) => ({ value: p, label: programShortLabel(p) })),
				]}
				/* A5 c8: the legend the page used to print UNDER the bar. Same words,
				   same order, now on the control they explain and gone from the page. */
				hint={programHint}
				hintTestId="program-code-legend"
			/>
			<FilterPicker
				name="Home room"
				width="auto"
				ariaLabel="Filter by home-room state"
				value={homeRoomFilter}
				onValueChange={onHomeRoomFilterChange}
				options={[
					{ value: 'all', label: 'All home-room states' },
					{ value: 'missing', label: 'Needs a home room' },
					{ value: 'assigned', label: 'Home room assigned' },
				]}
			/>
		</>
	);
}
