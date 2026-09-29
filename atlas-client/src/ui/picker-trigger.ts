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
 *   §1): 5 × 128 + 4 cluster gaps + Reset + the 240px search box + its gap = **1020px against
 *   ~1062px available at 1366**, i.e. 42px of slack and no wrap. It is sized to hold the
 *   operator's own example `Program: All` with room to spare at `text-xs`, which is what the
 *   planner's `scrollWidth <= clientWidth` rendered row measures. The next step up (`w-36`) does
 *   NOT fit, and inventing a fourth width to force it is exactly what R3 §1 forbids.
 * - `lg` — A6 c6 item 3. `md` can hold 12 characters of composed face, and
 *   `/teaching-load` composes `Sort: Lowest load` (17), `Department: All` (15) and
 *   `Status: No teaching load (3)` (27), so `md` clipped three controls on a row a
 *   scheduler reads at a glance. This is a CLASS of defect, not three strings, so
 *   the width became a variant every page can name and the budget below became a
 *   number every page can be held to. The width is the one the budget is derived
 *   from, so the two cannot drift.
 * - `xl` — the same ruling, one step further, and the variant `/teaching-load`
 *   actually ships. A facet COUNT is the one part of an option that the popover,
 *   which has room, can carry for free; the trigger is a fixed rectangle and a
 *   count on it is a number an older scheduler does not read off a filter face.
 *   With the count moved to the popover, `Department: Mathematics` (23) is the
 *   longest face the row composes — and it needs a declared budget to say so.
 *   §8 "One look per control" is about a ROW not mixing a control's looks, so a
 *   row that needs this width takes it on all of its pickers.
 * - `fill` — for a control that must occupy a layout slot (a grid cell, a flex child) rather
 *   than claim a fixed width of its own.
 */
export const PICKER_TRIGGER_WIDTH_CLASS = {
	sm: 'w-28',
	md: 'w-32',
	lg: 'w-44',
	xl: 'w-52',
	fill: 'w-full',
} as const;

export type PickerTriggerWidth = keyof typeof PICKER_TRIGGER_WIDTH_CLASS;

/**
 * A6 c6 item 3 — the DECLARED CHARACTER BUDGET of a trigger's composed face.
 *
 * A trigger is a fixed rectangle that composes `<name>: <value>`, so it clips at a
 * character count, not at a word boundary. Nobody could see that number, so every
 * page guessed and three of `/teaching-load`'s four pickers were silently cut at
 * 1366. This is the number, published once, next to the width token it comes from.
 *
 * `PICKER_TRIGGER_TEXT_ADVANCE_PX` is the SAME declared method
 * `a6-tl-header-budget` `A6c4-G2-7` already publishes and reuses: a deliberately
 * CONSERVATIVE advance for 12px sans (0.55em), so every budget below is an
 * OVER-estimate of what actually fits and a reword fails early rather than late.
 * JSDOM performs no layout, so this is declared, not measured; the rendered-pixel
 * confirmation is the separate loopback capture.
 */
export const PICKER_TRIGGER_TEXT_ADVANCE_PX = 6.6;

/** The trigger's own horizontal padding (`px-3`, 12px) on EACH side. */
const PICKER_TRIGGER_PAD_X_PX = 12;
/** The `ChevronsUpDown` glyph (`size-3` = 12px) plus its `ml-1` (4px) and 4px of slack. */
const PICKER_TRIGGER_CHEVRON_PX = 20;

/** `w-*` -> px, on Tailwind's 0.25rem-per-unit scale. The only width table in `@/ui`. */
const PICKER_TRIGGER_WIDTH_PX: Record<Exclude<PickerTriggerWidth, 'fill'>, number> = { sm: 112, md: 128, lg: 176, xl: 208 };

/**
 * floor((widthPx - 2 * PICKER_TRIGGER_PAD_X_PX - PICKER_TRIGGER_CHEVRON_PX) / PICKER_TRIGGER_TEXT_ADVANCE_PX)
 *
 *   sm  w-28 = 112px -> (112 - 24 - 20) / 6.6 = 10.30 -> 10
 *   md  w-32 = 128px -> (128 - 24 - 20) / 6.6 = 12.72 -> 12
 *   lg  w-44 = 176px -> (176 - 24 - 20) / 6.6 = 20.00 -> 20
 *   xl  w-52 = 208px -> (208 - 24 - 20) / 6.6 = 24.84 -> 24
 *
 * WRITTEN OUT HERE so the derivation is auditable, and DERIVED IN CODE so it
 * cannot drift from `PICKER_TRIGGER_WIDTH_CLASS`.
 *
 * ONE DISCREPANCY THE PACKET ACCEPTED, recorded rather than papered over. The A6
 * c6 packet first published this table as `{ sm: 12, md: 12, lg: 20 }`. Applying
 * the packet's OWN stated formula to the packet's OWN width token gives `sm: 10` —
 * 12 is what the same formula yields at `md`. The derived value is published
 * instead, because a budget LARGER than the physical maximum is precisely the
 * false pass the row that reads it exists to prevent: it would green a face that
 * clips. The planner ruled on 2026-09-29 that the derived value governs; the
 * other entries match the packet exactly.
 */
function deriveFaceBudget(width: Exclude<PickerTriggerWidth, 'fill'>): number {
	return Math.floor((PICKER_TRIGGER_WIDTH_PX[width] - 2 * PICKER_TRIGGER_PAD_X_PX - PICKER_TRIGGER_CHEVRON_PX) / PICKER_TRIGGER_TEXT_ADVANCE_PX);
}

/**
 * The per-width character budget of a composed `<name>: <value>` face.
 *
 * `fill` is deliberately absent: a control that claims a slot's width has no width
 * of its own, so it has no budget of its own either. A caller that wants a promise
 * for a `fill` control declares the width it actually means.
 */
export const PICKER_TRIGGER_FACE_BUDGET_CHARS = {
	sm: deriveFaceBudget('sm'),
	md: deriveFaceBudget('md'),
	lg: deriveFaceBudget('lg'),
	xl: deriveFaceBudget('xl'),
} as const;

/**
 * Does `<name>: <value>` fit this width's trigger face?
 *
 * The composed face is what `SearchableSelect` renders (`triggerLabelPrefix` +
 * `triggerLabelValue`), so this is the question a page actually has to answer
 * when it shortens a label, and answering it with a number keeps the decision out
 * of prose. It is deliberately the same string the primitive composes, so a caller
 * cannot pass the value and measure a different face.
 */
export function pickerTriggerFaceFits(width: PickerTriggerWidth, name: string, value: string): boolean {
	const budget = PICKER_TRIGGER_FACE_BUDGET_CHARS[width as keyof typeof PICKER_TRIGGER_FACE_BUDGET_CHARS];
	if (budget === undefined) return false;
	return `${name}: ${value}`.length <= budget;
}

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

/**
 * A6 c6 item 3 — the ONE height/padding/type treatment every control in a picker
 * row shares, for a page that needs a NON-picker control that must still look
 * like part of the row.
 *
 * WHY IT EXISTS AND WHY IT IS NOT A NEW VARIANT. `/teaching-load`'s `More
 * filters` trigger is a `Popover` trigger, not a `FilterPicker`: it has no
 * `<name>: <value>` face to compose, so `PICKER_TRIGGER_WIDTH_CLASS` and the
 * character budget below do not apply to it. What DOES apply is that it must
 * stand in the same row as four pickers and be indistinguishable from them. Before
 * this token the page reached for `PICKER_CONTROL_HEIGHT_CLASS` and spelled the
 * rest out, which is two things at once wrong: a page re-declaring a shared
 * variant, and `A5-C3-P3-3` — the repo-wide guard that exists for exactly this —
 * correctly rejecting it. A variant belongs in `@/ui` so every page gets it
 * (`AGENTS.md` §8), so it lives here.
 *
 * WHAT IT DELIBERATELY DOES NOT INCLUDE: a width, or `min-w-0`. A disclosure
 * trigger is sized by its own words — `More filters (2 on)` — and giving it a
 * picker's fixed width would clip it. The height, the padding and the type
 * treatment are the three dimensions a row may not vary, and those are the three
 * this token carries.
 *
 * IT IS DECLARED BELOW `PICKER_TRIGGER_TYPE_CLASS` ON PURPOSE: it composes that
 * constant, and a module-level `const` composed from a later `const` throws a
 * temporal-dead-zone `ReferenceError` at import time. Every consumer of
 * `@/ui/picker-trigger` failed to load when it was declared above.
 */
export const PICKER_ROW_CONTROL_CLASS = [
	PICKER_CONTROL_HEIGHT_CLASS,
	'shrink-0 px-3 text-xs',
	PICKER_TRIGGER_TYPE_CLASS,
].join(' ');

/** The composed trigger class. Call sites pass a `width`; they never pass a class string. */
export function pickerTriggerClass(width: PickerTriggerWidth = 'md'): string {
	return [
		PICKER_CONTROL_HEIGHT_CLASS,
		PICKER_TRIGGER_WIDTH_CLASS[width],
		/* A5 C3 CORRECTION ROUND 1 (B5): `min-w-0` is stated HERE, in the shared
		 * variant, and not left to the page. `min-w-*` and `w-*` are different
		 * tailwind-merge groups, so a floor declared anywhere alongside the width
		 * silently wins over it in CSS and the width variant becomes decorative —
		 * which is exactly what `min-w-[160px]` did to every trigger in the first
		 * place. Stating the neutral floor next to the width makes "this width
		 * governs" an explicit part of the variant every page gets, and a variant
		 * that genuinely needs a floor (a grid cell that must not collapse below
		 * two words, say) declares it here rather than at a call site. */
		'min-w-0',
		'shrink-0 px-3 text-xs',
		PICKER_TRIGGER_TYPE_CLASS,
	].join(' ');
}
