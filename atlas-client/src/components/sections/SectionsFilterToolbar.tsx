/**
 * A5 C3 slice B (2026-09-29) — `/sections` grade / program / home-room filters, on the
 * one shared picker.
 *
 * BEFORE: three Radix `@/ui/select` triggers at `h-10 text-sm`. That is a TALLER, larger-type
 * control than every other filter in the product — the operator's roster looks like a different
 * application from the page she just left. `AGENTS.md` §8 "One look per control" settles it: the
 * same `@/ui` primitive, the same trigger size, the same search behaviour.
 *
 * WHAT IS AND IS NOT CHANGING. Only the primitive, the chrome and the self-naming. Every
 * option label is this page's own vocabulary and is untouched — `All Grades`, `All Programs`,
 * `All home-room states`, the `needs a home room` / `home room assigned` pair, and the
 * `program-code-legend` line beneath, which is where a scheduler actually reads what a program
 * code means. The `all` first option in each list is retained, and so is the `grid
 * sm:grid-cols-3` layout: three filters in three equal columns, which is a layout decision about
 * this page, not a control look.
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
	return (
		<>
			<div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
				<FilterPicker
					name="Grade"
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
					ariaLabel="Filter by program scope"
					value={programFilter}
					onValueChange={onProgramFilterChange}
					options={[
						{ value: 'all', label: 'All Programs' },
						{ value: 'REGULAR', label: 'Regular Program' },
						...availablePrograms.map((p) => ({ value: p, label: programShortLabel(p) })),
					]}
				/>
				<FilterPicker
					name="Home room"
					ariaLabel="Filter by home-room state"
					value={homeRoomFilter}
					onValueChange={onHomeRoomFilterChange}
					options={[
						{ value: 'all', label: 'All home-room states' },
						{ value: 'missing', label: 'Needs a home room' },
						{ value: 'assigned', label: 'Home room assigned' },
					]}
				/>
			</div>
			{availablePrograms.length > 0 ? (
				<p className="text-xs text-muted-foreground" data-testid="program-code-legend">
					<span className="font-semibold">Program codes:</span>{' '}
					{availablePrograms
						.map((p) => `${programShortLabel(p)} = ${programFullLabel(p)}`)
						.join('; ')}
				</p>
			) : null}
		</>
	);
}
