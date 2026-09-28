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

	// Phase 1.4: stop suppressing Radix's natural focus management so the
	// search input becomes the first focus target on open (keyboard users
	// land where they expect). The active-option scroll-into-view still
	// runs after focus to bring the current room into view.
	React.useEffect(() => {
		if (open) {
			setTimeout(() => {
				if (activeItemRef.current) {
					activeItemRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
				} else if (inputRef.current) {
					inputRef.current.focus();
				}
			}, 50);
		}
	}, [open]);

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						id={triggerId}
						variant="outline"
						role="combobox"
						aria-expanded={open}
						aria-controls={listboxId}
						aria-haspopup="listbox"
						disabled={disabled || isSaving}
						className={cn(
							'h-9 w-full justify-between px-3 rounded-lg border-muted-foreground/20 hover:bg-muted/50 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 transition-all text-xs',
							isSaving && 'opacity-70 grayscale bg-muted/30 cursor-wait',
							!value && 'text-muted-foreground italic',
						)}
					>
						<span className="flex items-center gap-2 truncate">
							{isSaving ? (
								<span className="flex items-center gap-2 font-bold text-sm text-muted-foreground">
									<Clock className="size-3 animate-spin" />
									Saving...
								</span>
							) : selectedRoom ? (
								<>
									<span className="font-semibold text-foreground">{selectedRoom.name}</span>
									<span className="text-xs text-muted-foreground hidden sm:inline">
										- {selectedRoom.buildingName}
									</span>
								</>
							) : (
								'Choose home room'
							)}
						</span>
						<ChevronsUpDown className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
					 * laptop, and `h-100` still caps the body so the list — not the page — scrolls. */
					className="w-[min(18rem,calc(100vw-1.5rem))] max-w-[min(30rem,calc(100vw-1.5rem))] p-0 shadow-xl border-border/40 flex flex-col h-100"
					align="start"
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
