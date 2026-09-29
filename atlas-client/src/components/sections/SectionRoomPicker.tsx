import * as React from 'react';
import { ChevronsUpDown, Search, Check, Map as MapIcon, X, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import { SectionRoomMapModal } from './SectionRoomMapModal';

/* ══════════════════════════ A3 C10 — width model (FIX-03) ══════════════════════════ */

/**
 * FIX-03: the body was a FIXED `w-[min(22rem,calc(100vw-1.5rem))]`, so a short
 * list was 22rem of empty gutter and a long occupant name was still elided. The
 * brief asks for "trigger-matched or content-appropriate width with a sensible
 * min/max instead of a narrow fixed width".
 *
 * The width is now MEASURED from the listbox's own natural (`max-content`)
 * width and then clamped. These three constants are the whole clamp, and they
 * are exported so the committed CSS floor/ceiling below and this function
 * cannot drift apart — a control asserts they are the same numbers.
 *
 *  - MIN 18rem / 288px: the narrowest body that still fits a search field, a
 *    two-line room name and the trailing "Used by …" badge without collision.
 *  - MAX 30rem / 480px: past this the list stops being a picker and starts being
 *    a page. Also the committed `max-w-*` cap on the body, so a stale inline
 *    value can never paint wider than this.
 *  - GUTTER 1.5rem / 24px: the committed `100vw-1.5rem` viewport margin.
 */
export const PICKER_MIN_WIDTH_PX = 288;
export const PICKER_MAX_WIDTH_PX = 480;
export const PICKER_VIEWPORT_GUTTER_PX = 24;

/**
 * The clamp itself, kept pure so it is testable with real numbers (jsdom runs
 * no layout, so the browser path below cannot be measured here).
 *
 * Order matters: the VIEWPORT bound is applied last, so on a narrow laptop the
 * picker shrinks below MIN rather than overflowing the window. A non-finite or
 * zero measurement (an unmeasurable layout, e.g. a hidden popover) falls back
 * to the floor rather than collapsing to zero.
 */
export function clampPickerWidth(measuredPx: number, viewportPx: number): number {
	const ceiling = Math.min(
		PICKER_MAX_WIDTH_PX,
		Math.max(0, viewportPx - PICKER_VIEWPORT_GUTTER_PX),
	);
	const floor = Math.min(PICKER_MIN_WIDTH_PX, ceiling);
	const measured = Number.isFinite(measuredPx) && measuredPx > 0 ? measuredPx : floor;
	return Math.round(Math.min(Math.max(measured, floor), ceiling));
}

/* ══════════════════════════ A3 C10 — row geometry (FIX-11) ══════════════════════════ */

/**
 * A3 C9 (packet item 6) — the ONE geometry every option row uses.
 *
 * The recorded defect (Lane C, 2026-09-28, live `a1db27d5`) was MIXED ROW
 * HEIGHTS: a vacant option measured ~37.6px and an occupied one ~53.6px, so
 * scanning the list read as the list jumping. The cause was `h-auto` plus a
 * `flex flex-col` block whose occupied branch appended two extra lines, so the
 * row took its height from its content.
 *
 * ── A3 C10: the height is no longer the enemy of the name ───────────────────
 * C9 resolved that conflict by forcing every row to ONE LINE (`h-12` plus
 * `truncate` on the name), which is exactly what left FIX-11 unproven — Lane C
 * measured `'Makakal…'` (Makakalikasan) elided on one line in the G8 Room 103
 * card, and the brief asks for "up to two lines for meaningful room/facility
 * names".
 *
 * Both hold at once because uniform height and a two-line name are only in
 * conflict if the height is content-derived. It is not: the row carries a fixed
 * height token and the name's line count is bounded by a clamp. So the height
 * is raised to the value that ALWAYS accommodates the worst case — two name
 * lines plus the one type line — and the worst case therefore stops being a
 * special case. No row is taller or shorter than another regardless of what it
 * contains, which is the C9 invariant preserved verbatim.
 *
 *   model: 2 name lines (2 x 16px) + 2px gap + 1 type line (16px) = 50px
 *   h-16  = 64px  → 14px of slack, and never zero.
 *
 * Content-derived height stays banned: no `h-auto`, no vertical padding token.
 *
 * WHICH LINE KEEPS ITS LINE — the decision the brief asks to be recorded: the
 * NAME keeps the two lines, because it is the identity the operator reads. The
 * room TYPE is the line that stays single-line and truncates; it is a
 * qualifier, not an identifier. Neither can change the row's height, because
 * the height is a token on the row and the name is clamped at two lines.
 *
 * `items-center` survives: it is cross-axis centring, so a three-line block is
 * centred inside the fixed height rather than stretched by it.
 *
 * `group` is part of this constant on purpose: the occupant badge and both
 * label lines key their hover colours off it, so the row's hover treatment
 * cannot diverge between the vacant and occupied variants either.
 */
const OPTION_ROW_CLASS =
	'w-full h-16 shrink-0 items-center px-2 text-xs transition-all rounded-md outline-none group';

/**
 * A single `text-xs` line box, in px. Tailwind's `text-xs` is a 0.75rem font
 * size on a 1rem line box, so one line is 16px. The row-height control below
 * models the stack from this rather than from a hard-coded expectation, so the
 * constant cannot rot if the type scale moves.
 */
const TEXT_XS_LINE_PX = 16;
const NAME_BLOCK_GAP_PX = 2; // gap-0.5

/**
 * The deterministic height model the row-height control checks against.
 *
 * jsdom performs no layout, so no pixel height can be measured in this stream
 * and none is invented. What CAN be decided without a browser is the
 * arithmetic: a row that stacks `nameLines` name lines and one type line needs
 * `nameLines * 16 + 2 + 16` px, and the committed height token must be at least
 * that for the WORST case the component permits (two name lines). Exported so
 * the control reads the same numbers the comment above claims.
 */
export function roomOptionStackPx(nameLines: number): number {
	return nameLines * TEXT_XS_LINE_PX + NAME_BLOCK_GAP_PX + TEXT_XS_LINE_PX;
}

/* ═══════════════════ A9 C7 R1 — the popover height, MEASURED (item 46) ═══════════════════ */

/**
 * WHY A CSS-ONLY CAP ON `--radix-popover-content-available-height` IS CIRCULAR —
 * and why this must not be "simplified" back into one. The recorded render
 * (planner, 2026-09-29, real staging roster on the loopback preview at 1366x768,
 * evidence in `docs/reviews/a9-c7-home-room-picker-20260929/`):
 *
 *  - row 1 (`Aguinaldo`, trigger bottom y=352) rendered `data-side="bottom"`,
 *    popover 356 → 756, height 400, no overlap. The CSS cap worked there.
 *  - row 3 (`Luna`, trigger 503 → 539) rendered `data-side="top"`, popover
 *    99 → 499, height 400 — covering the `NEED ROOMS 19` chip, the
 *    "Give 19 sections a home room" button and "Sync sections".
 *
 * On that flipped row the wrapper carried `--radix-popper-available-height:
 * 487.48px` while the content computed `max-height: 400px`. 487px is the space
 * available **on the side floating-ui had already flipped to**. Radix publishes
 * that variable as a CONSEQUENCE of the flip decision, and the flip decision
 * compares the content's MEASURED height against the space below. So
 *
 *     max-height: min(400px, var(--radix-popover-content-available-height))
 *
 * is a fixed point: at measure time the content is 400px against ~213px below,
 * so it flips; after the flip the variable is large, so the cap is inert. A cap
 * expressed in that variable can never keep the popover down. (`ui/
 * searchable-select.tsx` gets away with the same class only because its content
 * is short enough that the flip question never arises.)
 *
 * THE FIX is therefore a number computed BEFORE Radix measures anything, from
 * the trigger's own rect and the window, and applied as an inline
 * `max-height`. React writes the style in the mutation phase, which runs before
 * floating-ui's positioning layout effect, so `flip` compares a content that is
 * already capped and leaves it on `bottom`. The committed class string stays
 * byte-for-byte as the no-measurement fallback (jsdom, first paint before the
 * handler runs) and is what keeps the body bounded when there is no layout.
 */
export const POPOVER_MAX_PX = 400;
/** Below this the list is a useless strip, so the trigger is scrolled to centre first. */
export const POPOVER_MIN_USABLE_PX = 192;
export const POPOVER_SIDE_OFFSET_PX = 4;
export const POPOVER_COLLISION_PX = 12;
/** A last pixel or two, so the body never lands exactly on the window edge. */
export const POPOVER_SAFETY_PX = 4;

/**
 * The cap, as arithmetic, so a test and a reviewer read the same numbers the
 * component uses instead of re-deriving them.
 *
 *   space below = viewportHeight − triggerBottom − sideOffset − collisionPadding − safety
 *   cap         = min(400, max(0, space below))
 *
 * `triggerBottomPx` and `viewportHeightPx` are the only inputs, so this is
 * testable with real numbers in a harness that has no layout engine.
 */
export function popoverMaxHeightPx(triggerBottomPx: number, viewportHeightPx: number): number {
	const spaceBelow =
		viewportHeightPx - triggerBottomPx - POPOVER_SIDE_OFFSET_PX - POPOVER_COLLISION_PX - POPOVER_SAFETY_PX;
	return Math.min(POPOVER_MAX_PX, Math.max(0, Math.round(spaceBelow)));
}

/**
 * THE BOTTOM-ROW CASE, and why `scrollIntoView` alone could not fix it.
 * Measured on real staging data (QA, 2026-09-29, 1366x768, list scrolled to its
 * end at `scrollTop 1511`, bottom-most row `Silver`, trigger bottom 662):
 *
 *   popoverMaxHeightPx(662, 768) = 86px   → body 86px, side=bottom, 666→752
 *   scroll viewport                clientHeight 0   scrollHeight 5448
 *
 * The chrome is `header 41 + footer 45 = 86px`, so a body of exactly 86px is
 * consumed entirely by the two `shrink-0` rows: the popover opened showing a
 * search box, a `BROWSE INTERACTIVE MAP` footer, and **no room at all**. R1's
 * `scrollIntoView({ block: 'center' })` could not rescue it, because the trigger
 * is the last row of an ALREADY bottom-scrolled list — there is nothing further
 * down to move, so centring is a no-op and the re-read returns 86 again.
 *
 * So the container is MOVED, by writing its own `scrollTop` — the same "write one
 * element's scrollTop, never walk ancestors" rule R2 applied to the option list.
 * The trigger's centre lands at `TRIGGER_CENTRE_FRACTION` of the window, and the
 * write is clamped to the container's real scroll range, so a container already
 * at either end simply stays where it is and the caller falls through to its
 * `scrollIntoView` fallback. For the measured row the container is written so
 * the trigger moves to ≈346, leaving ≈380px of list.
 *
 * Returns true when it moved the trigger, so the caller knows whether to re-read.
 *
 * AND WHEN IT CANNOT. If the container is already scrolled to its end, the write
 * is clamped to the same value, the helper reports no move, and the caller's
 * `POPOVER_MIN_USABLE_PX` floor is what stands between the operator and a 0px
 * list. That is exactly QA's measured case: list at `scrollTop 1511`, trigger
 * bottom 662, 86px below. The floor is the safety net for the rows the write
 * cannot reach; the write is what keeps an ordinary row from needing the floor.
 */
export const TRIGGER_CENTRE_FRACTION = 0.45;

/** The nearest ancestor that can actually be scrolled, or null. */
export function nearestScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
	for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
		// `scrollHeight > clientHeight` is the definition of "can scroll", and it
		// is decided by the element's own content — not by a class name, which a
		// change to a shared primitive could silently remove.
		if (node.scrollHeight > node.clientHeight) return node;
	}
	return null;
}

/**
 * Move `trigger` down the screen by writing its nearest scrollable ancestor's
 * `scrollTop`, so the space BELOW it grows. Never asks the browser to walk
 * ancestors. Returns true when the trigger was moved.
 */
export function centreTriggerForPopover(trigger: HTMLElement | null, viewportHeightPx: number): boolean {
	if (!trigger) return false;
	const container = nearestScrollableAncestor(trigger);
	// No scrollable ancestor: nothing to write, and the caller falls back to
	// `scrollIntoView` where one exists.
	if (!container) return false;
	const before = trigger.getBoundingClientRect();
	const targetCentre = viewportHeightPx * TRIGGER_CENTRE_FRACTION;
	// How far the trigger's centre is BELOW the target line. Scrolling a
	// container down moves its content up the screen, so a positive delta is
	// added to `scrollTop` to lift the trigger toward the target: the write
	// below is `scrollTop + delta`, which is what raises the trigger (measured:
	// container 1050 -> 1256, trigger bottom 713 -> lifted to a centre of 489).
	const delta = (before.top + before.height / 2) - targetCentre;
	if (delta === 0) return false;
	const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
	const next = Math.min(maxScrollTop, Math.max(0, container.scrollTop + delta));
	if (next === container.scrollTop) return false;
	container.scrollTop = next;
	return true;
}

/* ═══════════════ A9 C7 R2 — bring the current room into view, INSIDE the list ═══════════════ */

/** The picker's own scroll region. Row 01 pins that exactly one exists. */
const LIST_SCROLL_SELECTOR = '[data-radix-scroll-area-viewport]';

/**
 * The scroll `Element.scrollIntoView` used to do, confined to the picker's own
 * list. Returns the `scrollTop` it wrote, or `null` when there was nothing to do
 * (no scroll region, no layout to compare, or the option is already in view).
 *
 * WHY NOT `scrollIntoView` — the recorded measurement is in the open effect's
 * note above: it walks every scrollable ancestor, the popover is portalled to
 * `document.body`, and one click sent a hand-scrolled sections list from
 * `scrollTop = 400` back to 0. Writing one element's `scrollTop` cannot do that;
 * it is confined to that element by construction.
 *
 * `block: 'center'` is preserved as centring WITHIN the viewport, which is what
 * it meant here: the current room lands in the middle of the list the operator is
 * already looking at, not in the middle of the page.
 */
export function centerOptionInPickerList(option: HTMLElement | null): number | null {
	if (!option) return null;
	const list = option.closest(LIST_SCROLL_SELECTOR) as HTMLElement | null;
	if (!list) return null;
	const listRect = list.getBoundingClientRect();
	const optionRect = option.getBoundingClientRect();
	// No layout (jsdom, or a hidden popover): every rect is 0×0, so there is
	// nothing to centre and nothing is written. A zero-size list is not a list.
	if (listRect.height <= 0 || optionRect.height <= 0) return null;
	const current = list.scrollTop;
	// The offset of the option's top from the list's top, plus half of each
	// height's slack, is the delta that puts the option's middle on the list's
	// middle.
	const delta = optionRect.top - listRect.top - (listRect.height - optionRect.height) / 2;
	const next = current + delta;
	if (next === current) return null;
	list.scrollTop = next;
	return next;
}

export type RoomOption = {
	id: number;
	name: string;
	buildingName: string;
	type: string;
};

interface SectionRoomPickerProps {
	sectionId: number;
	sectionName: string;
	value: number | null;
	options: RoomOption[];
	onSelect: (roomId: number | null) => void;
	disabled?: boolean;
	isSaving?: boolean;
	schoolId: number;
	roomOccupancy?: Map<number, string>;
}

export function SectionRoomPicker({
	sectionId,
	sectionName,
	value,
	options,
	onSelect,
	disabled = false,
	isSaving = false,
	schoolId,
	roomOccupancy,
}: SectionRoomPickerProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const [mapModalOpen, setMapModalOpen] = React.useState(false);
	const [focusedRoomId, setFocusedRoomId] = React.useState<number | null>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const activeItemRef = React.useRef<HTMLButtonElement>(null);
	// A9 C7 R1: the trigger's own rect is the input to the popover's height cap,
	// read BEFORE Radix measures anything. See popoverMaxHeightPx above for why a
	// CSS-only cap cannot do this.
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const [openMaxHeight, setOpenMaxHeight] = React.useState<number | undefined>(undefined);
	// FIX-01: the popover body and the listbox, so an outside scroll can be told
	// apart from a scroll inside the picker's own list.
	const contentRef = React.useRef<HTMLDivElement>(null);
	const listRef = React.useRef<HTMLDivElement>(null);
	// Phase 1.4: stable ids so aria-controls/aria-labelledby link the trigger
	// to the listbox.
	const listboxId = React.useId();
	const triggerId = React.useId();

	const selectedRoom = React.useMemo(() => options.find((opt) => opt.id === value), [options, value]);
	// Phase 1.1: when the user is about to pick an occupied room, surface a
	// hint so the swap escalation in the parent is no longer a surprise.
	const focusedOccupant = focusedRoomId !== null ? roomOccupancy?.get(focusedRoomId) : undefined;
	const hasFocusedOccupant = Boolean(focusedOccupant);

	const filteredOptions = React.useMemo(() => {
		if (!query) return options;
		const low = query.toLowerCase();
		return options.filter(
			(opt) => opt.name.toLowerCase().includes(low) || opt.buildingName.toLowerCase().includes(low),
		);
	}, [options, query]);

	const groups = React.useMemo(() => {
		const g = new Map<string, typeof options>();
		filteredOptions.forEach((opt) => {
			const list = g.get(opt.buildingName) || [];
			list.push(opt);
			g.set(opt.buildingName, list);
		});
		return Array.from(g.entries())
			.map(([label, items]) => ({ label, items }))
			.sort((a, b) => {
				const aNum = parseInt(a.label.match(/\d+/)?.[0] || '0', 10);
				const bNum = parseInt(b.label.match(/\d+/)?.[0] || '0', 10);
				if (aNum !== bNum) return aNum - bNum;
				return a.label.localeCompare(b.label);
			});
	}, [filteredOptions]);
	/* ─────────────── FIX-01 — the anchor may not outlive its alignment ───────────────
	 *
	 * ROOT CAUSE (verified from source, not assumed). The body is portalled out
	 * of the trigger's scroll tree: `src/ui/popover.tsx` wraps the content in
	 * `<PopoverPrimitive.Portal>`, so it is appended to `document.body`, while
	 * the trigger lives inside the details sheet's own `overflow-y-auto`
	 * region (`SectionDetailsSheet.tsx:157`). The two are therefore in DIFFERENT
	 * scroll trees — the same fact Lane C's probe found when it could not make a
	 * scroll event reach the popover. Nothing about that is a bug on its own;
	 * the bug is that the picker had NO containment for it, so when the trigger
	 * moved out from under a fixed-positioned body the body simply stayed where
	 * it was, frozen at y≈175 over the rows beneath it.
	 *
	 * I read the shared primitive to check the other candidate cause — a
	 * primitive that disables Radix's `autoUpdate`. It does not: `popover.tsx`
	 * passes no `on*` reposition hooks and no `disableUpdateOnLayoutShift`, so
	 * repositioning is intact and the primitive is NOT the root cause. (Reported
	 * as a finding; the primitive is not edited here, another lane may own it.)
	 *
	 * CHOSEN MECHANISM, and why this one: of the two directions the brief
	 * allows — reposition continuously, or close when the anchor can no longer
	 * be kept aligned — the component cannot implement the first. Only the
	 * shared primitive owns the Radix popper, and the position is recomputed
	 * from a portalled body against a trigger in another scroll tree. So this
	 * takes the second direction, which the brief explicitly allows, and does it
	 * in the CAPTURE phase on `document` so it sees the scroll before anything
	 * can act on it.
	 *
	 * The one thing that must survive the containment is scrolling the option
	 * list itself, so the event target is tested against the popover body: a
	 * scroll whose target is inside the body is the list scrolling and the
	 * picker stays open; anything else — the sheet, a page, any ancestor — is
	 * the trigger moving and the picker closes.
	 *
	 * Closing this way goes through Radix's normal `onOpenChange`, so its
	 * default `onCloseAutoFocus` returns focus to the combobox trigger and the
	 * keyboard is never dumped on <body>. The listener is removed on close and
	 * on unmount by the effect's own cleanup; no listener outlives the popover. */
	React.useEffect(() => {
		if (!open) return;
		const handleAncestorScroll = (event: Event) => {
			const target = event.target as Node | null;
			// A scroll INSIDE the picker — its own ScrollArea list — is the
			// one scroll the brief requires to keep working.
			if (target && contentRef.current?.contains(target)) return;
			setOpen(false);
		};
		document.addEventListener('scroll', handleAncestorScroll, true);
		return () => document.removeEventListener('scroll', handleAncestorScroll, true);
	}, [open]);

	/* ─────────────── A9 C7 R1 — measure the popover's height BEFORE Radix does ─────────────── */

	/**
	 * Read the cap from the trigger's rect, moving the trigger down the screen
	 * first when the space below is too small to be usable, and re-reading
	 * afterwards. The move happens BEFORE the popover mounts, so it cannot be seen
	 * as a jump, and the re-read is what the cap is computed from — moving and then
	 * using the stale number would be the bug, not the fix.
	 *
	 * A9 C7 R4 — `centreTriggerForPopover` replaced the bare `scrollIntoView` here.
	 * Measured on the bottom-most row of a bottom-scrolled list (trigger bottom
	 * 662, viewport 768) `scrollIntoView({ block: 'center' })` was a NO-OP: the
	 * list was already at its end, so the re-read returned the same 86px and the
	 * popover opened with a 0px room list. Writing the container's own `scrollTop`
	 * moves the trigger UP out of that corner; `scrollIntoView` is kept only as
	 * the fallback for a trigger with no scrollable ancestor, where there is
	 * nothing to write.
	 *
	 * The floor is a safety net, not the mechanism: on an ordinary viewport the
	 * centring write does the work and the floor never binds. It exists because a
	 * picker with ZERO rooms in it is never acceptable — a body that overhangs the
	 * window edge is merely ugly, a body with an empty list is unusable — and
	 * because the window itself can be shorter than the chrome plus one row.
	 */
	const measureOpenMaxHeight = React.useCallback((): number | undefined => {
		const trigger = triggerRef.current;
		if (!trigger) return undefined;
		const read = () => popoverMaxHeightPx(trigger.getBoundingClientRect().bottom, window.innerHeight);
		let next = read();
		if (next < POPOVER_MIN_USABLE_PX) {
			if (centreTriggerForPopover(trigger, window.innerHeight)) {
				// The trigger moved, so the rect is stale and MUST be re-read.
				next = read();
			} else if (typeof trigger.scrollIntoView === 'function') {
				// No scrollable ancestor to write (or the container was already at
				// its limit): ask the browser, and re-read either way.
				trigger.scrollIntoView({ block: 'center', behavior: 'auto' });
				next = read();
			}
		}
		return Math.max(next, POPOVER_MIN_USABLE_PX);
	}, []);

	/**
	 * The cap is computed here, in the event, rather than in an effect keyed on
	 * `open`: React applies the new style in the MUTATION phase and floating-ui
	 * positions in a LAYOUT effect, so a value committed with the state is on the
	 * element before `flip` ever compares heights.
	 */
	const handleOpenChange = React.useCallback(
		(nextOpen: boolean) => {
			setOpenMaxHeight(nextOpen ? measureOpenMaxHeight() : undefined);
			setOpen(nextOpen);
		},
		[measureOpenMaxHeight],
	);

	// A number computed once goes stale the moment the window changes, and a stale
	// number lets the body hang off the bottom edge. Both listeners live only while
	// the popover is open. The scroll one recomputes the same figure the FIX-01
	// capture handler acts on; both run, and the cheap one losing the race to a
	// close is harmless.
	React.useEffect(() => {
		if (!open) return;
		const remeasure = () => {
			const next = measureOpenMaxHeight();
			setOpenMaxHeight((prev) => (prev === next ? prev : next));
		};
		window.addEventListener('resize', remeasure);
		window.addEventListener('scroll', remeasure, true);
		return () => {
			window.removeEventListener('resize', remeasure);
			window.removeEventListener('scroll', remeasure, true);
		};
	}, [open, measureOpenMaxHeight]);

	/* ─────────────── FIX-03 — content-adaptive width, measured then clamped ───────────────
	 *
	 * A deterministic measure-then-set, not a ResizeObserver: the width is
	 * derived from the listbox's own natural width, which is known once the
	 * popover mounts and whenever the visible option set changes (`groups`), and
	 * an observer would re-fire against the width it just set. Two properties
	 * matter. (1) No oscillation: the resting width is set from a MEASURED
	 * natural width, never from the width already on screen. (2) The measurement
	 * runs with the viewport/MAX cap lifted for exactly one synchronous read, so
	 * an over-long name is measured at its true size instead of being measured
	 * already-capped — otherwise a very long list would measure the cap and the
	 * content would never be allowed to exceed MIN.
	 *
	 * The width is applied imperatively, not through a `style` prop, so the
	 * measurement write and the resting write are the same property and React
	 * reconciliation cannot restore a stale value between them. The class floor
	 * (`w-[min(18rem,calc(100vw-1.5rem))]`) and cap are the pre-measurement
	 * state and the outer bound; the measured value sits between them. */
	const measureRef = React.useRef<() => void>(() => {});

	/**
	 * Measure and apply. See the FIX-03 note above for the two-step shape.
	 */
	const measureAndApplyWidth = React.useCallback(() => {
		const content = contentRef.current;
		const list = listRef.current;
		if (!content || !list) return;
		const previousMaxWidth = content.style.maxWidth;
		content.style.maxWidth = 'none';
		content.style.width = 'max-content';
		const naturalWidth = list.getBoundingClientRect().width;
		content.style.maxWidth = previousMaxWidth;
		content.style.width = `${clampPickerWidth(naturalWidth, window.innerWidth)}px`;
	}, []);
	// Read by the stable attach callback below, which must not be re-created when
	// the measurement closure changes or the ref would detach and re-attach.
	measureRef.current = measureAndApplyWidth;

	/**
	 * WHY THE MEASUREMENT IS TRIGGERED FROM A REF CALLBACK AND NOT ONLY FROM AN
	 * EFFECT — found by instrumenting the component, not guessed.
	 *
	 * Radix's `Portal` renders `null` until its own `mounted` flag is set in ITS
	 * layout effect, so the popover body is attached in a commit AFTER the render
	 * that opened the picker. The parent therefore observes `open === true` while
	 * `contentRef.current` is still `null`, and an effect keyed on `open` alone
	 * never re-runs (the body mounts on the Portal's state update, which does not
	 * re-render this component). The effect below is kept for the case it does
	 * cover — the visible option set changing while the body is already attached
	 * (a search keystroke) — and the attach callback covers the mount itself, which
	 * is the only place the body first exists.
	 *
	 * The callback is stable on purpose: an unstable ref would detach and re-attach
	 * on every render and re-measure each time.
	 */
	const attachContentNode = React.useCallback((node: HTMLDivElement | null) => {
		contentRef.current = node;
		if (node) measureRef.current();
	}, []);

	React.useLayoutEffect(() => {
		if (!open) return;
		measureAndApplyWidth();
	}, [open, groups, measureAndApplyWidth]);

	/* Phase 1.4: the search input is the first focus target on open (keyboard
	 * users land where they expect), and the current room is brought into view
	 * inside the list afterwards.
	 *
	 * A9 C7 R2 — WHY NEITHER STEP MAY SCROLL THE PAGE. Both of the calls this
	 * effect used to make walk EVERY scrollable ancestor, and the popover is
	 * portalled into `document.body`, so the browser scrolled the sections list
	 * to "reveal" a node that was not in it. Measured on real staging data
	 * (planner, 2026-09-29, preview :5262, 1366x768): with the list scrolled to
	 * `scrollTop = 400` by hand, ONE click on a row's picker sent it to 0 — on
	 * row 2 (unassigned, the `focus()` path) and on row 1 (assigned, the
	 * `scrollIntoView` path) alike. The operator clicks row 17, the list jumps to
	 * row 1, and the row they were working on leaves the screen. That is the
	 * opposite of "no flicker".
	 *
	 * The effect is pre-existing, but A9 C3 removed this control from the table,
	 * so `/sections` could not reach it until the binding 15:55 addendum put it
	 * back; the mobile card and the guided dialog always could. Both fixes are in
	 * the PRIMITIVE, so all three surfaces are correct at once (AGENTS.md §8):
	 *
	 *  - `focus({ preventScroll: true })` keeps the focus and stops the ancestor
	 *    walk. The input is inside the popover Radix has just positioned; there
	 *    is nothing to reveal.
	 *  - the active option is scrolled by adding a DELTA to the picker's own
	 *    `[data-radix-scroll-area-viewport]`'s `scrollTop` — the single scroll
	 *    region row 01 already pins. That is the same "the current room comes
	 *    into view" result, confined to the list, with `block: 'center'` kept as
	 *    centring WITHIN the viewport rather than within the page.
	 *
	 * Moving the TRIGGER is a different act from revealing the selection, and it
	 * happens before the popover exists. Since R4 that move is
	 * `centreTriggerForPopover` (it writes the nearest scrollable ancestor's
	 * `scrollTop`); `scrollIntoView` is only its no-ancestor fallback. It fires
	 * when the space below is under `POPOVER_MIN_USABLE_PX`, and on the bottom-most
	 * row of a list already scrolled to its end it cannot move the trigger at all —
	 * which is why the measured cap is floored (see `popoverMaxHeightPx`). */
	React.useEffect(() => {
		if (!open) return;
		const id = setTimeout(() => {
			if (activeItemRef.current) {
				centerOptionInPickerList(activeItemRef.current);
			} else if (inputRef.current) {
				inputRef.current.focus({ preventScroll: true });
			}
		}, 50);
		return () => clearTimeout(id);
	}, [open]);

	return (
		<>
			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<Button
						id={triggerId}
						ref={triggerRef}
						variant="outline"
						role="combobox"
						aria-expanded={open}
						aria-controls={listboxId}
						aria-haspopup="listbox"
						disabled={disabled || isSaving}
						className={cn(
							'h-9 w-full justify-between gap-0 px-2 rounded-lg border-muted-foreground/20 hover:bg-muted/50 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 transition-all text-xs',
							isSaving && 'opacity-70 grayscale bg-muted/30 cursor-wait',
							!value && 'text-muted-foreground italic',
						)}
					>
						{/* A9 c2 R2 (2026-09-30): the label WRAPS to a second line in the 200px
						    home-room cap; `whitespace-normal` beats the shared Button's
						    `whitespace-nowrap`. SUPERSEDED: the one-line `truncate`. */}
						<span className="min-w-0 flex-1 whitespace-normal text-left line-clamp-2 break-words">
							{isSaving ? (
								<span className="flex items-center gap-2 font-bold text-sm text-muted-foreground">
									<Clock className="size-3 animate-spin" />
									Saving...
								</span>
							) : selectedRoom ? (
								<>
									<span className="font-semibold text-foreground">{selectedRoom.name}</span>
									{' '}
									<span className="text-xs text-muted-foreground hidden sm:inline">- {selectedRoom.buildingName}</span>
								</>
							) : (
								'Choose home room'
							)}
						</span>
						<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					ref={attachContentNode}
					data-testid="room-picker-popover-content"
					/* FIX-03 (A3 C10) — the width is MEASURED, not declared.
					 *
					 * It was a fixed `w-[min(22rem,calc(100vw-1.5rem))]`, which Lane C measured as
					 * "fixed ≈350px (not content-adaptive)". A fixed width cannot be both
					 * narrow enough for a short list and wide enough for a long occupant
					 * name, so it is now derived: the `w-*` below is the PRE-MEASUREMENT
					 * floor and the `max-w-*` is the outer ceiling, and the measured value is
					 * applied inline between them (see measureAndApplyWidth).
					 *
					 * Both rem values are the exported PICKER_MIN_WIDTH_PX / PICKER_MAX_WIDTH_PX
					 * constants, and a control fails if the CSS and the JS clamp ever disagree.
					 * The viewport bound is the outer one, so the picker stays inside a narrow
					 * laptop, and the height cap below still makes the list — not the page —
					 * scroll. */
					className="w-[min(18rem,calc(100vw-1.5rem))] max-w-[min(30rem,calc(100vw-1.5rem))] p-0 shadow-xl border-border/40 flex flex-col overflow-hidden max-h-[min(25rem,var(--radix-popover-content-available-height))]"
					/* A9 C7 — item 46 (Lane C, 2026-09-29): the body was a FIXED
					 * `h-100` (400px) and Radix's collision handling, so a row near
					 * the TOP of the roster had its popover pushed UP, over the sticky
					 * toolbar and the Auto-assign / Sync buttons the operator is
					 * reaching for next.
					 *
					 * Two changes, and only two:
					 *  - `side="bottom"` states the preference, so the list opens
					 *    UNDERNEATH the row it belongs to; `collisionPadding` keeps it
					 *    off the window edge. If there is genuinely no room below, Radix
					 *    still flips — that is the correct last resort, and it is now
					 *    rare instead of the common case for the first rows.
					 *  - the fixed height became `max-h-[min(25rem,
					 *    var(--radix-popover-content-available-height))]`, the pattern
					 *    `ui/searchable-select.tsx` already uses in this repo, so the
					 *    body SHRINKS to the space below instead of overflowing and
					 *    flipping. `overflow-hidden` on the body keeps the
					 *    `shrink-0` header/footer rows intact while the one `ScrollArea`
					 *    absorbs the remainder, so the list still scrolls and the page
					 *    never does (AGENTS.md §8).
					 *
					 * 25rem is the old 400px ceiling, so the list is never SHORTER than
					 * it was on a tall window — only as tall as the space below allows.
					 *
					 * A9 C7 R1: that class is the FALLBACK ceiling, and it is kept
					 * byte-for-byte. Where a measurement is available the inline
					 * cap below wins over it — see popoverMaxHeightPx for the
					 * circularity that makes the variable alone unable to do this.
					 *
					 * A9 C7 R3 — WHY THE INLINE CAP IS A `height` AND NOT ONLY A
					 * `maxHeight`. R1 replaced this body's definite `h-100` with a
					 * MAXIMUM, and a maximum is not a height: it leaves the
					 * container's height indefinite FOR ITS CHILDREN, so `flex-1` on
					 * the ScrollArea root has nothing to resolve against, the root
					 * takes its full content height, and the viewport inside it
					 * never becomes smaller than the 79 options. Measured on real
					 * staging data (planner, 2026-09-29, preview :5262, 79 options):
					 *
					 *   popover body     400px   (248px on a mid-panel row at 1366x768)
					 *   room list        312px   ← the definite-height outcome
					 *   scroll viewport  clientHeight 312   scrollHeight 5448   scrollTop 0
					 *
					 * With only a maximum, the same body gave a viewport of
					 * `clientHeight 5448  scrollHeight 5448`: it is the VIEWPORT that
					 * becomes as tall as every option, so it has nothing to scroll,
					 * and the ScrollArea root's `overflow-hidden` cuts the list off —
					 * the operator saw "Unassigned" plus one or two rooms of 78 and
					 * could not reach the rest. (The root's own rect stays small
					 * throughout; a note here once said "root 160px, 240px of chrome",
					 * which was wrong — the chrome is the `shrink-0` header and footer,
					 * 86–88px, and the 312px above is the list.) One experiment on the
					 * same page and build settled it: setting `height: 400px` inline
					 * on the open popover dropped the viewport's `clientHeight` from
					 * 5448 to 160 and it then accepted `scrollTop = 500`.
					 *
					 * So the measured number is applied as BOTH a `height` and a
					 * `maxHeight`. The definite height is what lets the flex column
					 * resolve `flex-1`, collapse the viewport to the space that is
					 * actually there, and scroll (§8: the list scrolls, the page never
					 * does). The `maxHeight` is kept alongside it so the value can
					 * never exceed the space below the trigger even if a later change
					 * makes the height something other than the cap. A top row keeps
					 * the same 400px list it has always had; a mid-panel row gets
					 * 248px (224px at 1280x720) with the list scrolling inside it.
					 *
					 * Since R4 the value is also FLOORED at `POPOVER_MIN_USABLE_PX`.
					 * On the bottom-most row of an already-bottom-scrolled list there
					 * are only 86px below the trigger — exactly the chrome — so an
					 * unfloored cap gave the list a `clientHeight` of 0 and the
					 * popover opened with no rooms in it at all. That row now opens
					 * at 192px with `clientHeight 104` and two rooms on screen,
					 * upward, because there is no room beneath it; a picker with zero
					 * rooms in it is never acceptable, and it covers nothing.
					 *
					 * Do not "simplify" this back to a `maxHeight`: row 01 in
					 * `a3-room-picker-rows-01-02.test.tsx` asserts
					 * `viewport.clientHeight < viewport.scrollHeight`, which is the
					 * one property that separates a scrolling list from a clipped
					 * one, and it is exactly what a maximum breaks. */
				style={{ height: openMaxHeight ?? undefined, maxHeight: openMaxHeight ?? undefined }}
				side="bottom"
					align="start"
					sideOffset={4}
					collisionPadding={12}
				>

					{/* Header */}
					<div className="shrink-0 flex items-center border-b px-2 py-1.5 bg-muted/30">
						<Search className="ml-1 mr-2 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
						<Input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search room or building..."
							aria-label="Search rooms or buildings"
							className="h-7 w-full border-0 bg-transparent px-0 text-xs shadow-none outline-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
						/>
						{query ? (
							<Button
								variant="ghost"
								size="icon"
								className="size-6 -mr-1 text-muted-foreground hover:text-foreground"
								aria-label="Clear search"
								onClick={() => setQuery('')}
							>
								<X className="size-3" />
							</Button>
						) : null}
					</div>

					{/* Phase 1.1: occupied-room hint. Appears when the user is about
						to pick a room that already has a home section, so the swap
						escalation in the parent is no longer a surprise. */}
					{hasFocusedOccupant && focusedOccupant ? (
						<div
							role="status"
							aria-live="polite"
							data-testid="room-picker-occupied-hint"
							className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
						>
							<p className="font-semibold">Selecting this will move {focusedOccupant} out of this room.</p>
							<p className="mt-0.5 opacity-80">ATLAS will ask you to confirm before saving.</p>
						</div>
					) : null}

				{/* Phase 1.4 audit fix: the listbox div owns the id that the
					 * combobox trigger's aria-controls points to.
					 *
					 * A3 C9: the TooltipProvider wraps the list so every occupancy
					 * label shares ONE provider. The provider renders no DOM, so
					 * the picker still has exactly one popover layer (A3 fix 02)
					 * and exactly one scroll region (A3 fix 01) at rest. */}
					<TooltipProvider delayDuration={250}>
					<ScrollArea className="flex-1">
						<div ref={listRef} id={listboxId} className="p-1.5" role="listbox" aria-labelledby={triggerId}>

							<Button
								type="button"
								variant="ghost"
								role="option"
								aria-selected={value === null}
								onClick={() => {
									onSelect(null);
									setOpen(false);
								}}
								onFocus={() => setFocusedRoomId(null)}
								onMouseEnter={() => setFocusedRoomId(null)}
							className={cn(
								OPTION_ROW_CLASS,
								'justify-start gap-2',
								'hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
								value === null ? 'bg-accent/40 font-bold' : 'transparent'
							)}
						>
							<Check className={cn('size-3.5 shrink-0', value === null ? 'opacity-100' : 'opacity-0')} />
							<span className={cn('min-w-0 truncate italic transition-colors', value === null ? 'text-foreground' : 'text-muted-foreground', 'group-hover:text-primary-foreground')}>Unassigned</span>
						</Button>

							{groups.length === 0 && (
								<div className="py-8 text-center text-xs text-muted-foreground space-y-1">
									<p>No matching rooms found.</p>
									<p className="text-xs opacity-70">Try a different search term.</p>
								</div>
							)}

							{groups.map((group) => (
								<div key={group.label} className="mt-1">
									<div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center justify-between">
										{group.label}
										<Badge variant="outline" className="h-3.5 text-xs px-1 font-normal opacity-50 border-0">{group.items.length}</Badge>
									</div>
									<div className="grid gap-0.5 mt-0.5">
											{group.items.map((item) => {
												const occupying = roomOccupancy?.get(item.id);
												const isSelected = value === item.id;
													return (
													<Button
														key={item.id}
														ref={isSelected ? activeItemRef : null}
														type="button"
														variant="ghost"
														role="option"
														aria-selected={isSelected}
														data-occupied={occupying ? 'true' : undefined}
														onClick={() => {
															onSelect(item.id);
															setOpen(false);
														}}
														onFocus={() => setFocusedRoomId(item.id)}
														onMouseEnter={() => setFocusedRoomId(item.id)}
													className={cn(
														OPTION_ROW_CLASS,
														'justify-start gap-2',
														'hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
														isSelected ? 'bg-accent/60 font-bold' : 'transparent'
													)}
												>
													<Check className={cn('size-3.5 shrink-0 text-primary group-hover:text-primary-foreground', isSelected ? 'opacity-100' : 'opacity-0')} />
													{/* The room's own identity — FIX-11 (A3 C10).
													 *
													 * The NAME now takes up to TWO lines. C9 made it one truncated
													 * line, which is what left 'Makakal…' (Makakalikasan) elided in
													 * the G8 Room 103 card. The row height is the fixed
													 * OPTION_ROW_CLASS token (h-16) and the clamp bounds the line
													 * count, so allowing two lines here costs the uniform-height
													 * invariant nothing: a two-line name is no longer a taller row,
													 * it is a full row.
													 *
													 * A name longer than the clamp degrades to a two-line clamp
													 * rather than a one-line ellipsis, and the two EXISTING
													 * disclosures are untouched and still carry the whole string:
													 * the @/ui Tooltip on the occupancy badge and the
													 * 'room-picker-occupied-hint' live region. The name text itself
													 * is never shortened, so it stays in the option's accessible
													 * name.
													 *
													 * 'min-w-0' + 'flex-1' on the column is what keeps the trailing
													 * 'Used by …' badge in its own column beside the name block
													 * instead of overlapping it. */}
													<div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
														<span
															data-testid="room-option-name"
															className="w-full line-clamp-2 group-hover:text-primary-foreground"
														>
															{item.name}
														</span>
														{/* The TYPE line is the recorded sacrifice: it is the qualifier,
														 * not the identifier, so it stays one truncated line. */}
														<span
															data-testid="room-option-type"
															className="w-full truncate text-xs text-muted-foreground/70 uppercase font-medium group-hover:text-primary-foreground/70"
														>
															{item.type.replace('_', ' ')}
														</span>
													</div>
													{/* A3 C9 — occupancy, re-delivered on ONE right-aligned line.
													 *
													 * Fix 03 put the occupant on its own wrapping line so a long
													 * section name was readable. A uniform row height and a wrapping
													 * label are mutually exclusive, so the legibility is re-delivered
													 * on three legs instead of one:
													 *   1. truncation is CSS-only, so the FULL name stays in the
													 *      element's text and in the option's accessible name;
													 *   2. a @/ui Tooltip (never a raw `title`, AGENTS.md §8) shows
													 *      the full name to a pointer;
													 *   3. the picker's existing `room-picker-occupied-hint` live
													 *      region states the full name on focus/hover, so a keyboard
													 *      operator never loses it either.
													 *
													 * The second, duplicate "Room already has a home section"
													 * sentence is gone from the row — it was a line, and a line is
													 * exactly what this row may no longer have. The wording and the
													 * escalation it backed survive where they belong, in the swap
													 * confirmation dialog and in the focused-occupant hint above.
													 *
													 * The cue is a grade-free status signal in the measured
													 * `--warning` family (c8), not a solid amber block, and never
													 * the §8 G8 yellow. */}
													{occupying ? (
														<Tooltip>
															<TooltipTrigger asChild>
																<span
																	data-testid="room-option-occupant-full-trigger"
																	className="ml-auto flex min-w-0 max-w-[55%] shrink items-center"
																>
																	<span
																		data-testid="room-option-occupant"
																		className="min-w-0 truncate rounded border border-warning-border bg-warning-muted px-1.5 py-0.5 text-xs font-semibold text-warning-foreground transition-colors group-hover:border-primary-foreground/30 group-hover:bg-primary-foreground/15 group-hover:text-primary-foreground"
																	>
																		Used by {occupying}
																	</span>
																</span>
															</TooltipTrigger>
															<TooltipContent data-testid="room-option-occupant-full" className="max-w-xs">
																Used by {occupying}
															</TooltipContent>
														</Tooltip>
													) : null}
												</Button>

												);
											})}

									</div>
								</div>
							))}
						</div>
					</ScrollArea>
					</TooltipProvider>

					{/* Footer */}
					<div className="shrink-0 p-1.5 border-t bg-muted/20">
						<Button
							variant="outline"
							className="w-full h-8 text-xs font-bold uppercase tracking-wider gap-2 bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm"
							onClick={() => {
								setOpen(false);
								setMapModalOpen(true);
							}}
						>
							<MapIcon className="size-3.5" />
							Browse Interactive Map
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			{Number.isInteger(schoolId) && schoolId > 0 ? (
				<SectionRoomMapModal
					open={mapModalOpen}
					onOpenChange={setMapModalOpen}
					sectionName={sectionName}
					sectionId={sectionId}
					currentRoomId={value}
					onSelect={(roomId) => {
						onSelect(roomId);
					}}
					schoolId={schoolId}
					roomOccupancy={roomOccupancy}
				/>
			) : null}
		</>
	);
}
