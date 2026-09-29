/**
 * A5 c8 (2026-09-29) — THE filter bar. One row, one order, one geometry.
 *
 * WHO THIS IS FOR. An older, mouse-first scheduler narrowing a long roster to the slice
 * they need this morning. Before this file, four of the list pages hid a filter the
 * scheduler might want behind a button they had to find (`More filters`), one of them
 * printed a legend as a second line of text under the bar, one of them printed a second
 * row of `Badge` chips that each restated a value the trigger beside it already showed,
 * and one of them sized its search box at 384px while its neighbour used 240px — so the
 * same product read as four products.
 *
 * AFTER: **search, then the filters, in one row that wraps.** A second LINE of filters
 * is fine — it is what `flex-wrap` is for. A second CLICK to discover a filter is not,
 * and that is the one thing this component structurally cannot express: it has no
 * overflow, no `More` button and no popover of its own.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 *  - **NO SCROLL CONTAINER.** `AGENTS.md` §8's no-global-scrollbar rule is load-bearing.
 *    This is a `shrink-0` block in the page shell, beside the one `flex-1 min-h-0
 *    overflow-auto` region that already exists. A filter row that scrolled sideways is
 *    the `/timetable` `overflow-x-auto` strip the Codex sweep filed as its own control
 *    language, and it is gone.
 *  - **NO LEGEND LINE, NO HELPER SENTENCE, NO COUNT.** Where a page had a legend beneath
 *    the bar, it moved onto the control it explains through `FilterPicker`'s `hint`
 *    (`AGENTS.md` §11's design gate rule 3, subtraction first).
 *  - **NO PAGE-SUPPLIED CLASS STRING ON A CONTROL.** A child is a `FilterPicker`, a
 *    `Switch` or a `Button` that already carries its own shared chrome, and each child is
 *    made `shrink-0` HERE so a page cannot re-decide how wide its own filter may be.
 *  - **NO CHROME FOR THE CHILDREN.** Height, radius, border, case and the option-list
 *    search box all come from `@/ui` (`pickerTriggerClass`). This file owns only the
 *    row's geometry and the search box, and it takes the search box's height from the
 *    SAME `PICKER_CONTROL_HEIGHT_CLASS` token the triggers take theirs from, because a
 *    hand-matched `h-9` at a call site is exactly the pair that silently drifts.
 */
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { PICKER_CONTROL_HEIGHT_CLASS } from '@/ui/picker-trigger';
import { cn } from '@/lib/utils';

/**
 * A5 c8 §2 — THE ROW, as a named constant so a source-scan gate and a reviewer read the
 * same string instead of two paraphrases of it.
 *
 * `flex flex-wrap items-center gap-2`, left-aligned (no `justify-*`), never a scroller
 * and never `flex-nowrap`. `items-center` rather than `items-start` because the pickers
 * are `h-9` and a `Switch` beside them is `h-9`; the one child that can grow — a picker
 * whose face wrapped onto a second line — then centres itself against the row instead of
 * lifting the whole bar's baseline.
 */
export const FILTER_BAR_ROW_CLASS = 'flex flex-wrap items-center gap-2';

/**
 * The search box's width, as the packet's own number. It is a FIXED width with
 * `shrink-0`, not elastic: an elastic search box changes width with the viewport and
 * pushes every control beside it around, which is the property `/teaching-load` had and
 * this bar removes. `w-[240px]` and `shrink-0` are stated HERE, once, rather than at
 * each of the eight call sites.
 */
export const FILTER_BAR_SEARCH_WRAPPER_CLASS = 'relative w-[240px] shrink-0';

/**
 * `text-xs` is stated BESIDE `sm:text-xs`, and the `sm:` half is NOT redundant.
 *
 * `@/ui` `Input` ends its base class with the responsive pair `text-base … sm:text-sm`,
 * and tailwind-merge treats `sm:text-sm` as a different VARIANT from a bare `text-xs` —
 * so it keeps BOTH, and at any viewport ≥640px the `sm:` variant wins. A5 c7 measured
 * 14px in the browser on exactly this trap while its class-list assertion was green,
 * because the class-list assertion WAS true. A7 c8 will move `--text-xs` to 14px and
 * this row will keep saying which side of the pair wins.
 */
export const FILTER_BAR_SEARCH_INPUT_CLASS = `${PICKER_CONTROL_HEIGHT_CLASS} pl-9 text-xs sm:text-xs`;

export type FilterBarSearch = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	/** Preserved DOM hook where a page already had one (e.g. `teaching-load-history-search`). */
	id?: string;
	disabled?: boolean;
	/**
	 * An honest EMPTY or UNAVAILABLE placeholder, for a page whose list could not load.
	 * `/faculty/concerns` has two (`Teacher roster unavailable`, `No teachers loaded`) and
	 * both are states the user needs to read, so they are not normalised away — only the
	 * healthy wording is.
	 */
};

export type FilterBarProps = {
	/**
	 * A5 c8 — the search box, or `undefined` on a page that has no search.
	 *
	 * The packet's signature has `search` required, and seven of the eight migrated
	 * pages do pass it. `/room-schedules` is the eighth: it filters a single already-
	 * short list by one picker, and giving it a search box would be ADDING a control
	 * to make the component look uniform, which §11's design gate rule 3 forbids
	 * outright. So the prop is optional and its absence is a legitimate state, not a
	 * hole — the row is the same row, it simply starts at the first filter.
	 */
	search?: FilterBarSearch;
	/**
	 * THE ONE RESET CONTROL IN THE PRODUCT. Omit it and no reset renders; pass it and one
	 * ghost `Button` appears at the END of the row, `h-9 shrink-0`, while a filter is
	 * set. It is not `flex-1`, so it does not push the row wide, and it is the only
	 * control of its kind — `/subjects` and `/teachers` each had their own and
	 * `/teaching-load` had a third (`Clear all`) living on the chip row this change
	 * deleted. A page keeps its own handler and its own wording.
	 */
	onReset?: () => void;
	resetLabel?: string;
	/** Preserved DOM hook for that reset control (`subjects-reset-filters`). */
	resetTestId?: string;
	dataTestId?: string;
	/**
	 * The `data-tutorial` hook a page's guided walk targets.
	 *
	 * It lives on the BAR rather than on a page-level wrapper because the bar is the
	 * row the walk means: `/timetable`'s `ScheduleReviewWorkspace` highlights
	 * `[data-tutorial="grid-controls"]`, and that selector must keep landing on the
	 * schedule controls after the disclosure that used to sit inside them is gone.
	 * Optional, and absent on the seven pages that have no guided walk.
	 */
	dataTutorial?: string;
	children?: ReactNode;
};

export function FilterBar({
	search,
	onReset,
	resetLabel = 'Reset',
	resetTestId,
	dataTestId,
	dataTutorial,
	children,
}: FilterBarProps) {
	return (
		/* `shrink-0` is the ROW's own — it must not be squeezed by a page column. The
		 * `[&>*]:shrink-0` is every CHILD's, stated once here rather than at eight call
		 * sites: a filter that could shrink would compress its own face instead of
		 * letting the row wrap, and a face that compresses is a face that gets cut.
		 *
		 * It is a descendant variant rather than a wrapper `<div>` ON PURPOSE. A
		 * wrapper would be one flex item, so it would wrap as a UNIT and drag every
		 * filter onto the second line together — which is precisely the failure
		 * `/teaching-load`'s draft-controls group recorded and had to be un-made. */
		<div className={cn('shrink-0 [&>*]:shrink-0', FILTER_BAR_ROW_CLASS)} data-testid={dataTestId} data-tutorial={dataTutorial}>
			{/* A5 c8 §2 — search FIRST, then every filter, in reading order. The bar has no
			    slot for anything else, which is how "one order" becomes structural rather
			    than a convention each page re-decides. */}
			{search ? (
				<div className={FILTER_BAR_SEARCH_WRAPPER_CLASS}>
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						id={search.id}
						aria-label={search.ariaLabel}
						placeholder={search.placeholder}
						value={search.value}
						disabled={search.disabled}
						onChange={(event) => search.onChange(event.target.value)}
						className={FILTER_BAR_SEARCH_INPUT_CLASS}
					/>
				</div>
			) : null}
			{/* Every child is `shrink-0` (see the container's `[&>*]:shrink-0` above), and
			    the bar has no slot for anything that is not a search box or a filter. */}
			{children}
			{onReset ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					data-testid={resetTestId}
					onClick={onReset}
					className={cn(PICKER_CONTROL_HEIGHT_CLASS, 'shrink-0 whitespace-nowrap px-3 text-xs text-muted-foreground hover:text-foreground')}
				>
					{resetLabel}
				</Button>
			) : null}
		</div>
	);
}
