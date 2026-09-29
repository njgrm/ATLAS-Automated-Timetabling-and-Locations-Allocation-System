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
 * - `auto` — A5 C4 CORRECTION ROUND 1 (F2, 2026-09-29). For a trigger whose LABEL IS
 *   DYNAMIC, so a fixed rectangle would either clip it or leave a gap beside it. The one
 *   such control today is `/subjects`' `More filters` disclosure, which reads `More
 *   filters` or `More filters (2)` depending on how many filters are set — a label whose
 *   width is not known until runtime.
 *
 *   WHY A VARIANT AND NOT A CALL-SITE `w-auto`. `AGENTS.md` §8: *"if it truly needs a new
 *   variant, add the variant to `@/ui` so every page gets it"*, and `pickerTriggerClass`'s
 *   own contract here says *"Call sites pass a `width`; they never pass a class string."* The
 *   F2 finding was precisely a call site hand-restating `h-9`, `shrink-0`, `px-3`, `text-xs`,
 *   `font-normal` and `normal-case` — and omitting `tracking-normal` and `min-w-0`, which is
 *   how the one control with a DYNAMIC label came to letter-space differently from the
 *   fixed-label pickers beside it. A variant declared here carries the whole shared look by
 *   construction, so that class of drift is not expressible.
 *
 *   `whitespace-nowrap` was here from A5 C4 and is GONE (A5 c8, 2026-09-29). It was the
 *   class that let a face run PAST its own border: Lane C measured `Home room: Home
 *   room assigned` spilling outside its select on `/sections`, and a nowrap label inside
 *   a max-width box is exactly how a face spills. A long face now WRAPS inside its box
 *   (`h-auto min-h-9` below), so the trigger grows a second line rather than escaping,
 *   and `AGENTS.md` §8's "no sentence is cut off with an ellipsis" holds for a face as
 *   well as for a page.
 *
 * - `auto`, A5 c8 — A FLOOR AND A CEILING. `w-auto` alone is not enough on either side:
 *   a two-word filter (`Grade: All`) came out narrower than the search box beside it and
 *   the row read as uneven, while a data-driven face (a department name, an archived
 *   year — the case Lane C measured at 128px with a 186px scroll width on
 *   `/teaching-load/history`) ran on until it hit something else. `min-w-32` (8rem) and
 *   `max-w-[22rem]` are the packet's own numbers, and together they make `auto` a BOUNDED
 *   content size rather than an unbounded one. `min-w-*` and `w-*` are different
 *   tailwind-merge groups, so the floor is stated IN the variant and the builder composes
 *   it AFTER the neutral `min-w-0` — that ordering is load-bearing, and `A5-C8-B5` is the
 *   row that fails if it is ever reversed (the same class of bug as the retired
 *   `min-w-[160px]`).
 */
export const PICKER_TRIGGER_WIDTH_CLASS = {
	sm: 'w-28',
	md: 'w-32',
	lg: 'w-44',
	xl: 'w-52',
	fill: 'w-full',
	auto: 'w-auto min-w-32 max-w-[22rem] h-auto min-h-9 items-center py-1',
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
const PICKER_TRIGGER_WIDTH_PX: Record<Exclude<PickerTriggerWidth, 'fill' | 'auto'>, number> = { sm: 112, md: 128, lg: 176, xl: 208 };

/**
 * A width that is NOT a fixed rectangle, and therefore has no px and no character
 * budget. `fill` claims a slot; `auto` (A5 C4's disclosure trigger) claims its own
 * content. Neither can clip its face, which is the property this file's budget
 * exists to promise.
 */
type UnbudgetedPickerTriggerWidth = 'fill' | 'auto';

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
function deriveFaceBudget(width: Exclude<PickerTriggerWidth, UnbudgetedPickerTriggerWidth>): number {
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
 *
 * A WIDTH THAT IS NOT A FIXED RECTANGLE ALWAYS FITS, and that is the load-bearing
 * line. `fill` takes a slot's width and `auto` (A5 C4) takes its own content, so
 * neither has a face to clip — and returning `false` for them, as this function
 * did when A5's `auto` landed, reports a FALSE FAILURE: a caller shortening a
 * label for an `auto` trigger would be told its face does not fit when it
 * physically cannot not. A guard that cries wolf on the width that is safest is
 * how a guard gets deleted, so `true` here is the correct answer and the one that
 * keeps every `auto` call site from inventing a second mechanism to route around
 * it. The unbounded widths are enumerated by type, not by a truthiness test, so a
 * future `max-*` variant is forced to declare itself here.
 */
export function pickerTriggerFaceFits(width: PickerTriggerWidth, name: string, value: string): boolean {
	if (width === 'fill' || width === 'auto') return true;
	const budget = PICKER_TRIGGER_FACE_BUDGET_CHARS[width];
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
 * A6 c6 item 3 — SETTLED AGAINST ITSELF, 2026-09-29, and the settlement is A5's.
 *
 * This file previously exported `PICKER_ROW_CONTROL_CLASS`, a height/padding/type
 * token added by A6 c6 for `/teaching-load`'s `More filters` trigger — a `@/ui`
 * `Button`, not a `SearchableSelect`, so it composes no `<name>: <value>` face and
 * `pickerTriggerClass` had no width for it. The reasoning was sound: a page must
 * not re-declare the shared look.
 *
 * Then A5 C4 (`133ce9fe`) landed the SAME fix in THIS SAME FILE for the SAME
 * problem — `/subjects`' `More filters` disclosure, also a dynamic label — as a
 * WIDTH variant, `auto: 'w-auto whitespace-nowrap'`, for the same stated reason
 * ("if it truly needs a new variant, add the variant to `@/ui` so every page gets
 * it"). Two lanes, one file, one week, one problem, two mechanisms.
 *
 * A5's is the better shape and it is adopted: a `More filters` trigger is
 * content-sized by definition, so "content-sized" is a WIDTH, and `pickerTriggerClass('auto')`
 * already composes the height, `min-w-0`, `shrink-0 px-3 text-xs` and the type
 * treatment — everything `PICKER_ROW_CONTROL_CLASS` carried, plus the `whitespace-nowrap`
 * that stops the label wrapping mid-word. One mechanism in `@/ui` beats two that a
 * future reader has to reconcile, and `AGENTS.md` §8 is a statement about there
 * being ONE look per control, not about there being one way to ask for it.
 *
 * `PICKER_ROW_CONTROL_CLASS` is therefore RETIRED, not renamed: it is the one
 * thing A5's `auto` already does, and leaving it exported would invite the next
 * lane to pick whichever of the two it found first. `A6C6-1c` is the row that
 * holds the line.
 */

/**
 * A5 c8 (2026-09-29) — THE HEIGHT A CONTENT-SIZED TRIGGER MAY GROW FROM.
 *
 * `h-9` is the MINIMUM, not a cap. `h-auto min-h-9` is one line when the composed
 * face fits the variant's width and two lines when it does not, and `py-1` keeps the
 * wrapped line from touching the border. The alternative — a fixed `h-9` with no floor
 * growth — has exactly two bad endings and no good one: the text either spills out of
 * the box (the `/sections` defect) or is cut off (an ellipsis, which `AGENTS.md` §8
 * forbids outright).
 *
 * IT IS STATED IN THE `auto` VARIANT AND NOWHERE ELSE, on purpose. A FIXED width is
 * budget-bound: `PICKER_TRIGGER_FACE_BUDGET_CHARS` is the declared promise of what
 * fits, and a caller that exceeds it has a bug to fix, not a trigger to grow. Giving
 * every variant the growth behaviour would let a fixed rectangle quietly become a
 * two-line box and break the one-row arithmetic three other suites measure.
 *
 * The bare `PICKER_CONTROL_HEIGHT_CLASS` stays the ONE token the search input and the
 * fixed-width triggers take, so `h-9` is still stated once and never retyped at a
 * call site. `h-auto` is composed AFTER it, so tailwind-merge resolves the growth
 * for `auto` and leaves the fixed variants at exactly 36px.
 */

/** The composed trigger class. Call sites pass a `width`; they never pass a class string. */
export function pickerTriggerClass(width: PickerTriggerWidth = 'md'): string {
	return [
		PICKER_CONTROL_HEIGHT_CLASS,
		/* A5 C3 CORRECTION ROUND 1 (B5): `min-w-0` is stated HERE, in the shared
		 * variant, and not left to the page. `min-w-*` and `w-*` are different
		 * tailwind-merge groups, so a floor declared anywhere alongside the width
		 * silently wins over it in CSS and the width variant becomes decorative —
		 * which is exactly what `min-w-[160px]` did to every trigger in the first
		 * place. Stating the neutral floor next to the width makes "this width
		 * governs" an explicit part of the variant every page gets, and a variant
		 * that genuinely needs a floor (A5 c8's `auto`, which is `min-w-32`) declares
		 * it here rather than at a call site.
		 *
		 * A5 c8 — ORDER IS LOAD-BEARING. `min-w-0` must be composed BEFORE the width
		 * variant so that a variant which declares its own floor (`auto`'s `min-w-32`)
		 * wins the merge. Reversing the two lines would silently reinstate exactly the
		 * "declared floor beats the width" bug B5 was written to close. */
		'min-w-0',
		PICKER_TRIGGER_WIDTH_CLASS[width],
		'shrink-0 px-3 text-xs',
		PICKER_TRIGGER_TYPE_CLASS,
	].join(' ');
}
