/**
 * A5 C3 (2026-09-29) — THE shared filter-picker chrome.
 *
 * `AGENTS.md` §8 "One look per control" (operator, 2026-09-29): *"Every picker (Section,
 * Teacher, Subject, Room, Term, Year) is the same `@/ui` primitive with the same trigger size,
 * border, placeholder style and search behaviour… No page-local `className` overrides that change
 * a primitive's look. Before adding a control, find the existing one and reuse it; if it truly
 * needs a new variant, add the variant to `@/ui` so every page gets it."*
 *
 * Before this file the five filter rows in the sweep each carried their own width, height,
 * radius, border and case treatment — `w-40/w-24/w-28/w-36/w-28`, `h-10 text-sm`,
 * `w-45 h-10 uppercase tracking-tight`, `min-h-11`, a page-local `CONTROL_CHROME`. That is the
 * "Subjects filters as pills beside rectangular pickers" defect in `AGENTS.md` §11's preamble.
 * These tokens are the one place those decisions now live, so a page cannot restate them.
 *
 * WHAT IS AND IS NOT IN HERE. Deliberately this is a small set of TOKENS, not a re-implementation
 * of the trigger's chrome: the visual surface still comes from `@/ui/button variant="outline"`,
 * which is what the Section and Teacher pickers already look like (the operator's own frame,
 * `docs/handoffs/lane-c-to-a2.md` 2026-09-29 00:15). This file only fixes the three dimensions a
 * filter bar is allowed to vary — height, width, and case — so that a page picking "medium" gets
 * the same rectangle as every other page picking "medium".
 */

/**
 * The ONE height token every filter trigger and the search input beside it share.
 *
 * R1 A1/J3: the search box and the filter triggers must be the same height, and they must share
 * the token rather than two hand-matched literals — a `h-9` here and a `h-9` typed in a page is
 * exactly the pair that silently drifts. `AGENTS.md` §8 forbids a page-local override that
 * changes a primitive's look, and a second `h-*` on a trigger is such an override.
 */
export const PICKER_CONTROL_HEIGHT_CLASS = 'h-9';

/**
 * The ONE set of trigger widths. `AGENTS.md` §8: a control's size is a variant, and a variant
 * belongs in `@/ui` so every page gets it.
 *
 * - `sm` — a narrow filter, or a control sharing a line with a longer sibling.
 * - `md` — the default, and the width the `/subjects` cluster's arithmetic turns on (A5 C3 R3
 *   §1): 5 × 128 + 4 cluster gaps + Reset + the 240px search box + its gap = **1010px against
 *   ~1062px available at 1366**, i.e. 52px of slack and no wrap. It is sized to hold the
 *   operator's own example `Program: All` with room to spare at `text-xs`, which is what the
 *   planner's `scrollWidth <= clientWidth` rendered row measures. The next step up (`w-36`) does
 *   NOT fit, and inventing a fourth width to force it is exactly what R3 §1 forbids.
 * - `fill` — for a control that must occupy a layout slot (a grid cell, a flex child) rather
 *   than claim a fixed width of its own.
 */
export const PICKER_TRIGGER_WIDTH_CLASS = {
	sm: 'w-28',
	md: 'w-32',
	fill: 'w-full',
} as const;

export type PickerTriggerWidth = keyof typeof PICKER_TRIGGER_WIDTH_CLASS;

/**
 * The case treatment every filter trigger carries.
 *
 * `normal-case tracking-normal` is not decoration: it makes the look-changing override
 * structurally impossible. `/teaching-load`'s filter bar applied `font-bold uppercase
 * tracking-tight` to four triggers and to ~20 of their option rows; R1 B4 requires that override
 * gone rather than restyled. Pinning sentence case in the shared class means a caller cannot
 * reintroduce the shout without a reviewer seeing a duplicate token, and the visible label an
 * older scheduler reads stays sentence case on every page.
 *
 * `font-normal` also settles a real inconsistency: `@/ui/button` ships `font-semibold` and
 * `SearchableSelect` re-applies `font-normal`; stating it here keeps the winner unambiguous
 * regardless of merge order.
 */
export const PICKER_TRIGGER_TYPE_CLASS = 'font-normal normal-case tracking-normal';

/**
 * R2-5 — the option count above which a filter list earns a search box.
 *
 * A search box in a popover that lists five grades costs a scheduler a second thing to aim at
 * and gives them nothing: the whole list is already visible. The box is worth its place on the
 * long lists (a teacher roster, a year list) and not on the short ones, so the rule is ONE named
 * number in `@/ui` and not a literal at any call site — and not a per-page judgement.
 *
 * The boundary is exclusive: 8 items shows no box, 9 does. `FilterPicker` applies it;
 * `SearchableSelect`'s own default is unchanged, so `/timetable`'s entity picker keeps its box.
 */
export const SEARCHABLE_OPTION_THRESHOLD = 8;

/** The composed trigger class. Call sites pass a `width`; they never pass a class string. */
export function pickerTriggerClass(width: PickerTriggerWidth = 'md'): string {
	return [
		PICKER_CONTROL_HEIGHT_CLASS,
		PICKER_TRIGGER_WIDTH_CLASS[width],
		'shrink-0 px-3 text-xs',
		PICKER_TRIGGER_TYPE_CLASS,
	].join(' ');
}
