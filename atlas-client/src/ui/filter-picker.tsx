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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	PICKER_TRIGGER_TYPE_CLASS,
	SEARCHABLE_OPTION_THRESHOLD,
	pickerTriggerClass,
	type PickerTriggerWidth,
} from '@/ui/picker-trigger';

export type FilterPickerOption = { value: string; label: string; disabled?: boolean };

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
	 *
	 * A5 C3 slice B: a caller whose empty state is NOT a member of its own list passes
	 * its own value. `TeachingLoadHistoryView`'s archived-year filter has no `all`
	 * option — an empty value is "no year chosen" and the first real option is a real
	 * year — so it passes `''`. Without this it would have read `Archived year: all` on
	 * a control that offers no such choice. Default `'all'` is unchanged.
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
	/**
	 * A5 c8 (2026-09-29) — ONE optional sentence, shown in a `@/ui` Tooltip on the
	 * trigger. It exists because `/sections` used to print the program-code legend
	 * as a `<p>` UNDER the filter bar, which made a three-picker row four rows deep
	 * and put a second, quieter line of text between the controls and the list.
	 * Moving that same sentence onto the control it explains is subtraction: the
	 * line is gone and the words are still reachable, on hover and on focus.
	 *
	 * It is a Tooltip and not a `title` attribute and not a raw `<details>` —
	 * `AGENTS.md` §8 forbids both. Absent `hint` renders byte-for-byte what it
	 * rendered before this prop existed, which is what keeps every other call site
	 * unchanged. The picker's own `aria-label` is untouched: the tooltip is visual
	 * and hover-reachable, not a second accessible name for the same control.
	 */
	hint?: string;
	/** `data-testid` for the tooltip TRIGGER wrapper, so a relocated testid can follow the sentence. */
	hintTestId?: string;
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
	hint,
	hintTestId,
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
	 * with no short label falls back to its full label rather than rendering nothing.
	 *
	 * A5 C3 slice B CORRECTION ROUND 1 (B2) — the UNSET case is different, and this comment
	 * is where it went wrong. `All` is only the right thing to show when the caller's list
	 * actually HAS an "all" member, because a list that does not is offering a choice it
	 * cannot deliver. `TeachingLoadHistoryView`'s archived-year filter is exactly that: no
	 * `all` option, so `allValue=""`, so `shortValue` was always the literal `All` and the
	 * `placeholder` this caller spent words on — `Choose an archived year`, and
	 * `Loading archived years…` while it loaded — could never render. The trigger lied, and
	 * the inventory's "Preserved" claim for that control was false while it did.
	 *
	 * So: no value chosen means show `All` when the list really HAS that choice, and the
	 * PLACEHOLDER when it does not. On every swept filter but the archived-year picker there
	 * is an `all` member, so those thirteen visible faces are unchanged — `Grade: All` still
	 * reads `Grade: All` — which is the point of deriving it from the list instead of writing
	 * it thirteen times. The rule is stated once, in `@/ui`, not left to call sites.
	 *
	 * The first attempt at this fix was wrong in exactly the way worth recording: it made the
	 * placeholder win whenever the value was empty, and every swept filter's placeholder
	 * defaults to its first option's FULL label — so `Grade: All` became `Grade: All grades`
	 * on twelve controls to fix one. `A5-C3-B2b` is the row that caught it. */
	const selected = list.find((o) => o.value === value);
	const isUnset = value === '' || value === allValue;
	const offersAll = list.some((o) => o.value === allValue);
	const shortValue = isUnset
		? (offersAll ? 'All' : placeholder ?? fallbackPlaceholder)
		: shortLabels?.[value] ?? selected?.label ?? value;
	/* A DISABLED picker must not show a value it cannot offer. The primitive's accessible
	 * name already says `disabledReason` (or `No options available`) when the whole control is
	 * disabled; the visible face has to say the same thing or the two disagree and the screen
	 * carries two statuses for one fact. */
	const visibleValue = disabled
		? (disabledReason ?? 'No options available')
		: shortValue;

	const picker = (
		<SearchableSelect
			items={list}
			value={value}
			onValueChange={onValueChange}
			placeholder={placeholder ?? fallbackPlaceholder}
			ariaLabel={ariaLabel ?? name}
			triggerLabelPrefix={name}
			triggerLabelValue={visibleValue}
			triggerId={triggerId}
			triggerTestId={dataTestId}
			triggerClassName={pickerTriggerClass(width)}
			showSearch={showSearch}
			disabled={disabled}
			disabledReason={disabledReason}
			className={contentClassName}
		/>
	);

	/* `TooltipTrigger asChild` needs a SINGLE child that forwards a ref and a DOM prop.
	 * `SearchableSelect` returns the trigger button inside a `PopoverTrigger`, so the
	 * wrapper is a `<span>` carrying only `display: contents`-free flex-none geometry:
	 * it must not become a flex item of the bar, or it would sit beside the trigger
	 * instead of around it. `shrink-0` + `inline-flex` keeps the pair one control-sized
	 * block on the wrapping row. */
	if (!hint) return picker;

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex shrink-0" data-testid={hintTestId}>
						{picker}
					</span>
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-80">
					{hint}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export { PICKER_TRIGGER_TYPE_CLASS, SEARCHABLE_OPTION_THRESHOLD, pickerTriggerClass };
export type { PickerTriggerWidth };
