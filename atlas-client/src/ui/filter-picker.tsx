/**
 * A5 C3 (2026-09-29) — THE filter picker, and the only way a page builds one.
 *
 * `AGENTS.md` §8 "One look per control": every picker is the same `@/ui` primitive with the same
 * trigger size, border, placeholder style and search behaviour. This wrapper is that contract
 * made unrepeatable:
 *
 *  1. **It has no `className` prop.** A caller cannot restate the trigger's chrome, because
 *     there is no argument to restate it in. R1 J2: "A page that keeps its own width/border/
 *     padding string instead of the shared one fails the guard in §5" — here it cannot even be
 *     written.
 *  2. **It has no `items`-shaped escape hatch.** Options are `{ value, label }[]`, flat only.
 *     A filter has no groups; a grouped list is a different component with a different job.
 *  3. **It names itself.** `name` is the filter's own name in the operator's words, and it is
 *     composed into BOTH the visible trigger text (`Grade: All grades`) and the accessible name
 *     (`aria-label="Grade: All grades"`), so the two can never drift apart. R1 A1: the trigger's
 *     composed accessible name and its visible label must read the same, never a bare `All…`.
 *     This is the LANE-C C03 (B11) rule, and it is the fix for the operator's "two filters read
 *     only `All...` — nobody can tell what they filter".
 *
 * WHY NOT `@/ui/select`. Five rows in the sweep built their filter from Radix `@/ui/select` with
 * a bespoke `SelectTrigger` class, and that bespoke class is the whole defect (R1 J1). The
 * primitive is `@/ui/searchable-select`, as `/timetable` already uses it.
 */
import { SearchableSelect } from '@/ui/searchable-select';
import {
	PICKER_TRIGGER_TYPE_CLASS,
	SEARCHABLE_OPTION_THRESHOLD,
	pickerTriggerClass,
	type PickerTriggerWidth,
} from '@/ui/picker-trigger';

export type FilterPickerOption = { value: string; label: string };

export type FilterPickerProps = {
	/** The filter's own name, in the operator's words: `Grade`, `Room`, `Roster state`. */
	name: string;
	/**
	 * The filter's LONG name, used only for the ACCESSIBLE NAME. A5 C3 R3 §1: a screen
	 * reader has no width limit, so it gets the full form — `Filter by grade level` composed
	 * with the full option label — while the visible trigger shows the short `Grade: All`.
	 * Defaults to `name`, which is right for a page whose filters are named plainly; a page
	 * with existing `aria-label`s passes them here so the sweep preserves them (R1 B2).
	 */
	ariaLabel?: string;
	value: string;
	onValueChange: (value: string) => void;
	options: FilterPickerOption[];
	/**
	 * Width variant from `@/ui`. Default `'md'`. A page names a variant; it never writes a
	 * width class.
	 */
	width?: PickerTriggerWidth;
	/**
	 * Whether the option list shows its search box.
	 *
	 * Omitted (the default) applies R2-5's rule: the box appears only when the list is longer
	 * than `SEARCHABLE_OPTION_THRESHOLD`. Pass `true` or `false` only to override a decision the
	 * rule would otherwise make for a list whose length is not the real signal.
	 */
	searchable?: boolean;
	/** The value shown before anything is chosen. Defaults to the first option's label. */
	placeholder?: string;
	/**
	 * The option value that means "no filter chosen". A5 C3 R3 §1: the trigger's short
	 * value is the single word `All` for this one, whatever the option list calls it
	 * (`All grades`, `All programs`, `All terms`).
	 */
	allValue?: string;
	/**
	 * Short labels for the options, by value, used ONLY on the trigger face.
	 *
	 * A5 C3 R3 §1, from the operator's own words: *"each filter shows its name (e.g.
	 * `Grade: All`, `Program: All`) untruncated at 1366 wide."* The trigger is a fixed
	 * rectangle shared by every filter, so what it can hold is a short value (`GR7`,
	 * `STE`, `Classroom`, `Term 1`) — while the popover, which has the room, keeps the
	 * FULL labels, and the accessible name keeps the long form
	 * (`Filter by grade level: Science, Technology, and Engineering`).
	 *
	 * This is `/timetable`'s entity picker, unchanged: a compact trigger that shows a short
	 * entity name over a list of long ones. Copying what works (R2-6 rule 5) rather than
	 * inventing a local variant.
	 */
	shortLabels?: Record<string, string>;
	disabled?: boolean;
	disabledReason?: string;
	triggerId?: string;
	/** Existing `data-testid`s are preserved through the sweep (R1 B2). */
	dataTestId?: string;
	/** Width of the popover panel. Defaults to the trigger width. */
	contentClassName?: string;
};

export function FilterPicker({
	name,
	ariaLabel,
	value,
	onValueChange,
	options,
	width = 'md',
	searchable,
	placeholder,
	allValue = 'all',
	shortLabels,
	disabled = false,
	disabledReason,
	triggerId,
	dataTestId,
	contentClassName,
}: FilterPickerProps) {
	// The `all` option is what a filter's own vocabulary calls "nothing chosen yet"; when a
	// A5 C3 CORRECTION ROUND 1 (B3): normalise the options ONCE, here, before
	// anything reads them.
	//
	// The planner's loopback render of `/subjects` produced an error boundary reading
	// "Cannot read properties of undefined (reading 'length')".
	//
	// THE CAUSE OF THAT BOUNDARY IS NOT ATTRIBUTED AND IS NOT THIS LINE. A5 C3 QA
	// round 2 disproved an earlier claim that it was, and named two sites that can
	// produce the recorded text on fixture-supplied objects instead:
	// `SubjectTermAuthorityBanner.tsx:56` (`rawMessage.length`) and
	// `SubjectTermContractPopover.tsx:58` (`contract.terms.length`). Neither is
	// confirmed — the difference was not isolated. What IS established is that the
	// candidate is not the cause, and that this line is a CRASH GUARD for a misuse
	// TypeScript already prevents — not a fix for a proven cause. It stays because a
	// filter handed a missing list during a partial load must degrade to an empty,
	// still-tappable control: a thrown render takes the whole page to an error
	// boundary and a scheduler sees "Reload page" instead of a catalogue. One
	// `?? []` at the top of the component is the right place; scattering optional
	// chaining at each read would leave the same trap for the next reader.
	//
	// The planner separately recorded that the subject table row stays UNPERFORMED
	// under a mocked surface because `pages/Subjects.tsx` only requests the catalogue
	// once `resolveActiveSchoolYearContext()` yields an active year. That gating is
	// pre-existing and outside this slice; this guard is not offered as its cause.
	const list = options ?? [];
	// The `all` option is what a filter's own vocabulary calls "nothing chosen yet"; when a
	// caller supplies no explicit placeholder the first option is that honest default rather
	// than a generic `Select…`.
	const fallbackPlaceholder = list[0]?.label ?? 'All';
	const showSearch = searchable ?? list.length > SEARCHABLE_OPTION_THRESHOLD;

	/* A5 C3 R3 §1 — the trigger shows the SHORT value, the popover shows the long one.
	 * `All` is one word for the unset state whatever the option list calls it, and a value
	 * with no short label falls back to its full label rather than rendering nothing. */
	const selected = list.find((o) => o.value === value);
	const shortValue = value === '' || value === allValue
		? 'All'
		: shortLabels?.[value] ?? selected?.label ?? value;

	return (
		<SearchableSelect
			items={list}
			value={value}
			onValueChange={onValueChange}
			placeholder={placeholder ?? fallbackPlaceholder}
			ariaLabel={ariaLabel ?? name}
			triggerLabelPrefix={name}
			triggerLabelValue={shortValue}
			triggerId={triggerId}
			triggerTestId={dataTestId}
			triggerClassName={pickerTriggerClass(width)}
			showSearch={showSearch}
			disabled={disabled}
			disabledReason={disabledReason}
			className={contentClassName}
		/>
	);
}

export { PICKER_TRIGGER_TYPE_CLASS, SEARCHABLE_OPTION_THRESHOLD, pickerTriggerClass };
export type { PickerTriggerWidth };
