import * as React from 'react';
import { ChevronsUpDown, Search, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
	value: string;
	label: string;
	/**
	 * A5 C3 slice B: an option the operator may read but not choose.
	 *
	 * `SearchableSelect` grew this because `/teaching-load`'s facet counts genuinely
	 * produce options that are currently empty — `Teaching assigned (0)`, an
	 * `Adviser only (0, subset)`, a policy band that is not ready yet. Those were
	 * `disabled` on a Radix `SelectItem`; converting the row without carrying that
	 * across would have made a zero-count option SELECTABLE, which is a behaviour
	 * regression dressed as a refactor. The fix belongs in the shared primitive
	 * under `AGENTS.md` 8 — every page that needs a disabled option gets it, and no
	 * page has to reach for a different primitive to express it.
	 */
	disabled?: boolean;
}

export interface SearchableSelectGroup {
	label: string;
	items: SearchableSelectOption[];
}

interface SearchableSelectProps {
	/** Flat items (no groups). Use `groups` for grouped list. */
	items?: SearchableSelectOption[];
	/** Grouped items. Takes precedence over `items`. */
	groups?: SearchableSelectGroup[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	triggerClassName?: string;
	disabled?: boolean;
	disabledReason?: string;
	/**
	 * LANE-C C03 (B11) — the picker's accessible name. The 2026-09-25 audit
	 * found the Teacher-leaving picker announced unnamed, because its visible
	 * label pointed at a wrapper, not at this button. Pass `ariaLabel`, or
	 * `triggerId` so a `<label htmlFor>` names it.
	 */
	ariaLabel?: string;
	triggerId?: string;
	/** Accessible name of the search box; defaults to "Search" + `ariaLabel`. */
	searchLabel?: string;
	/**
	 * A5 C3 — the filter's own NAME, composed into the visible trigger text as
	 * `<prefix>: <selected>` so the control reads `Grade: All grades` rather than a bare
	 * `All grades`.
	 *
	 * Additive and default-off (`undefined` renders exactly the previous text). `ariaLabel`
	 * already composes the same pair into the accessible name, so passing both keeps the visible
	 * label and the accessible name from ever disagreeing — the LANE-C C03 (B11) rule. This
	 * primitive deliberately has no opinion about whether a picker wants a prefix; the policy
	 * lives in `@/ui/filter-picker`, which is where every page builds its filters.
	 */
	triggerLabelPrefix?: string;
	/**
	 * A5 C3 R3 §1 — the SHORT value to compose into the visible trigger text, when the
	 * caller's own vocabulary for a chosen option is shorter than its full label
	 * (`GR7`, `STE`, `Classroom`). Additive and default-off: omitted, the trigger shows the
	 * selected option's full label exactly as before, so `/timetable` is unaffected. The
	 * POPOVER and the ACCESSIBLE NAME always use the full label — the popover has the room
	 * for it, and a screen reader has no width limit.
	 */
	triggerLabelValue?: string;
	/**
	 * A5 C3 / R2-5 — whether the option list shows its search box. Defaults to `true`, which is
	 * this primitive's own behaviour and is unchanged, so `/timetable`'s entity picker (a long
	 * list that must keep its box) is untouched. `@/ui/filter-picker` is what decides the rule.
	 */
	showSearch?: boolean;
	/** A5 C3 — a `data-testid` for the trigger button, so existing test handles survive the sweep. */
	triggerTestId?: string;
}

/** A5 C3 slice B: `disabled` is carried through to the flat list, because the keyboard walk
 * reads it (B1). An option that is only disabled on the rendered button is still choosable from
 * the keyboard, which is the regression this type change exists to make impossible. */
type FlatOption = { value: string; label: string; index: number; disabled?: boolean };

export function SearchableSelect({
	items,
	groups,
	value,
	onValueChange,
	placeholder = 'Select…',
	className,
	triggerClassName,
	disabled = false,
	disabledReason,
	ariaLabel,
	triggerId,
	searchLabel,
	triggerLabelPrefix,
	triggerLabelValue,
	showSearch = true,
	triggerTestId,
}: SearchableSelectProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const [activeIndex, setActiveIndex] = React.useState(0);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const listId = React.useId();

	// Normalize to groups
	const allGroups: SearchableSelectGroup[] = React.useMemo(() => {
		if (groups) return groups;
		if (items) return [{ label: '', items }];
		return [];
	}, [groups, items]);

	// Filter
	const filtered = React.useMemo(() => {
		if (!query) return allGroups;
		const q = query.toLowerCase();
		return allGroups
			.map((g) => ({
				...g,
				items: g.items.filter(
					(i) => i.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q),
				),
			}))
			.filter((g) => g.items.length > 0);
	}, [allGroups, query]);

	// The visible options in order, for keyboard selection.
	const flatOptions: FlatOption[] = React.useMemo(() => {
		const list: FlatOption[] = [];
		for (const group of filtered) {
			for (const item of group.items) list.push({ ...item, index: list.length });
		}
		return list;
	}, [filtered]);

	React.useEffect(() => {
		/* B1: the search field can narrow the list to a first match that is DISABLED, and
		 * the highlight would then sit on a row that cannot be chosen. Land on the first
		 * option that can be, so a typed query never produces a dead highlight. */
		const first = flatOptions.findIndex((option) => !option.disabled);
		setActiveIndex(first === -1 ? 0 : first);
	}, [query, open, flatOptions]);

	React.useEffect(() => {
		if (!open || typeof document === 'undefined') return;
		document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
	}, [activeIndex, listId, open]);

	// Find selected label
	const selectedLabel = React.useMemo(() => {
		for (const g of allGroups) {
			const item = g.items.find((i) => i.value === value);
			if (item) return item.label;
		}
		/* A2 C12 (item 3) — a `value` that matches no option resolves to the EMPTY
		 * STRING here, and an empty string is the whole defect: the trigger's label
		 * span renders nothing, and the composed accessible name becomes
		 * `"<label>: "` — a name with a colon and no value, i.e. no name in the state
		 * a scheduler first meets the picker in (the Simple header's `all` default,
		 * before the first entity is chosen).
		 *
		 * The placeholder is the SAME honest "nothing chosen yet" the visible face
		 * already shows when `value` is empty, so the two can never disagree, and a
		 * caller that passes no `ariaLabel` is unaffected: the label span is what a
		 * user reads, and it is no longer blank.
		 *
		 * This is a value FALLBACK, not a contract change: no prop signature, no
		 * caller, and no reachable option-label changes. */
		return placeholder;
	}, [allGroups, value, placeholder]);

	const choose = (next: string) => {
		onValueChange(next);
		setOpen(false);
		setQuery('');
	};

	/**
	 * A5 C3 slice B CORRECTION ROUND 1 (B1) — the next HIGHLIGHTABLE option from `from`,
	 * skipping any that is `disabled`, and wrapping at both ends.
	 *
	 * A `disabled` option is readable on purpose — the count beside a zero is information a
	 * scheduler wants — which is exactly why the highlight must not LAND on it. Arrowing onto
	 * a greyed row and having Enter do nothing is a control that looks alive and is not, and
	 * the walk now never produces that state.
	 *
	 * This matters in the swept pages: `/teaching-load`'s Department filter and the Teaching
	 * Load history's archived-year filter both earn R2-5's search box above eight options (a
	 * school with nine or more departments, nine or more archived years), and both carry
	 * `disabled` options — a department at count zero, a year with no Teaching Load cycle.
	 * Before this slice those were Radix `SelectItem disabled` and the keyboard could not
	 * reach them. Migrating to this primitive reintroduced the path, and only the MOUSE branch
	 * was guarded, so Enter could still choose one.
	 */
	const nextSelectableIndex = (from: number, step: 1 | -1): number => {
		const count = flatOptions.length;
		for (let step_ = 1; step_ <= count; step_ += 1) {
			// `(from + step * step_)` is wrapped into range first so the walk cycles.
			const candidate = (((from + step * step_) % count) + count) % count;
			if (!flatOptions[candidate].disabled) return candidate;
		}
		// Every option is disabled: there is nowhere to go, so stay put.
		return from;
	};

	// LANE-C C03 (B11) — typing a name and pressing Enter selects the highlighted
	// match (the first one by default); arrow keys move the highlight.
	const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (flatOptions.length === 0) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActiveIndex((index) => nextSelectableIndex(index, 1));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActiveIndex((index) => nextSelectableIndex(index, -1));
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const option = flatOptions[Math.min(activeIndex, flatOptions.length - 1)];
			/* B1: refuse a disabled option even if the highlight somehow sits on one — the
			 * search field can put the initial highlight on a match, so the guard cannot
			 * live only in the arrow walk. */
			if (option && !option.disabled) choose(option.value);
		}
	};

	const optionId = (index: number) => `${listId}-option-${index}`;
	const indexByValue = new Map(flatOptions.map((option) => [option.value, option.index]));
	const triggerLabel = disabled
		? (disabledReason ?? 'No options available')
		: ariaLabel
			? `${ariaLabel}: ${value ? selectedLabel : placeholder}`
			: undefined;
	/* A5 C3: the visible face carries the same "<name>: <value>" pair the accessible name
	 * does. The prefix is omitted entirely when absent, so a picker that does not want one
	 * renders byte-for-byte what it rendered before. `triggerLabelValue` shortens only the
	 * VISIBLE value; the accessible name above still uses the full label. */
	const visibleValue = triggerLabelValue ?? (value ? selectedLabel : placeholder);
	const visibleLabel = triggerLabelPrefix
		? `${triggerLabelPrefix}: ${visibleValue}`
		: value
			? selectedLabel
			: placeholder;

	return (
		<Popover
			open={disabled ? false : open}
			onOpenChange={(o) => {
				if (disabled) return;
				setOpen(o);
				if (!o) setQuery('');
			}}
		>
			<PopoverTrigger asChild>
				{/*
				 * A5 C3 CORRECTION ROUND 1 (B5): the primitive's own `min-w-[160px]`
				 * floor is GONE, and that is the fix.
				 *
				 * `min-w-*` and `w-*` are DIFFERENT tailwind-merge groups, so that floor
				 * did not lose to a caller's `w-32` - it coexisted with it, and CSS
				 * `min-width` beats `width`. Every trigger rendered at 160px whatever
				 * width variant the page asked for: the `sm`/`md`/`fill` variants in
				 * `@/ui/picker-trigger` were inert, the Subjects suites were asserting a
				 * class the browser ignored, and the `/subjects` cluster's real content
				 * width was 5 x 160 = 800px rather than the 5 x 128 = 640px the ledger
				 * claimed.
				 *
				 * The floor is removed from the SHARED PRIMITIVE, which is the correct
				 * place under `AGENTS.md` section 8: a shared primitive is what silently
				 * overrode the shared variant, and a page-local `min-w-0` would have been
				 * exactly the page-local override of a shared surface that this whole
				 * change exists to remove. A variant that genuinely needs a floor states
				 * it in `@/ui/picker-trigger`, where every page gets it.
				 *
				 * `/timetable` is unchanged and provably so: its call site already passes
				 * its own `min-w-[9rem]`, `min-w-*` is one merge group, and the caller's
				 * floor has always won there, so removing the base floor changes nothing
				 * it was ever governing. `a5-c3-picker-contract.test.tsx` asserts both
				 * halves of that.
				 */}
				<Button
					id={triggerId}
					data-testid={triggerTestId}
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-haspopup="listbox"
					disabled={disabled}
					aria-disabled={disabled}
				aria-label={triggerLabel}
				className={cn('justify-between font-normal', triggerClassName)}
			>
				{/* A2 HEADER-BUDGET (operator, 2026-09-29) — `truncate` is GONE from this
				    span. This trigger is the `Schedule for` picker in the `/timetable`
				    header's row 2, and AGENTS.md §8 forbids a sentence cut off with an
				    ellipsis; the operator's own complaint list included exactly the kind
				    of truncated label this produced. The trigger still bounds its own
				    width (`min-w-[9rem] max-w-[18rem]` on the call site), and a selected
				    entity name is short, so there is nothing to cut.
				    NOTE FOR A5's cross-page picker sweep: this is a SHARED primitive, so
				    the change is visible on every page that uses `SearchableSelect`. That
				    is deliberate — §8's rule is not page-local — but it is the one
				    cross-page effect in this commit and is called out in the handoff.

				    INTEGRATION (A2, 2026-09-29, main d90e1dec): A5 C3 landed on `main`
				    first and is KEPT IN FULL here — its `triggerLabelPrefix` /
				    `triggerLabelValue` derivation is what supplies `visibleLabel`, and its
				    `min-w-[160px]` removal stands. This side's contribution is exactly one
				    thing: the `truncate` class, gone. Taking main's `visibleLabel` verbatim
				    is what keeps A5's prefix and value-shortening behaviour intact; the
				    discarded `value ? selectedLabel : placeholder` was this range's
				    pre-A5 reading of the same expression and would have silently undone
				    A5's work. Mechanical union, both sides' behaviour preserved. */}
				<span>{visibleLabel}</span>
					<ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn('w-[var(--radix-popover-trigger-width)] min-w-[200px] max-h-[var(--radix-popover-content-available-height)] overflow-hidden p-0', className)}
				collisionPadding={8}
				onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
			>
				{/* Search input. A5 C3 / R2-5: `showSearch` is false only when the CALLER
				    decided the list is too short to search (`@/ui/filter-picker`, > 8
				    options). The default is true, so this primitive's own behaviour — and
				    `/timetable`'s entity picker — is unchanged. The focus handoff is already
				    null-safe, so a list without a box opens straight onto its options. */}
				{showSearch ? (
					<div className="flex items-center border-b px-2">
						<Search className="mr-1 size-3 shrink-0 opacity-50" />
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleSearchKeyDown}
							placeholder="Search…"
							aria-label={searchLabel ?? (ariaLabel ? `Search ${ariaLabel.toLowerCase()}` : 'Search schedule options')}
							aria-controls={listId}
							aria-activedescendant={flatOptions.length > 0 ? optionId(Math.min(activeIndex, flatOptions.length - 1)) : undefined}
							className="flex h-9 w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>
				) : null}
				{/* List */}
				<div id={listId} role="listbox" aria-label={ariaLabel} className="max-h-[min(15rem,calc(var(--radix-popover-content-available-height)-2.5rem))] overflow-y-auto p-1">
					{filtered.length === 0 && (
						<p className="py-4 text-center text-sm text-muted-foreground">No results.</p>
					)}
					{filtered.map((group) => (
						<div key={group.label}>
							{group.label && (
								<div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
									{group.label}
								</div>
							)}
							{group.items.map((item) => {
								const index = indexByValue.get(item.value) ?? -1;
								const active = open && index === Math.min(activeIndex, flatOptions.length - 1);
								return (
									<Button
										key={item.value}
										id={optionId(index)}
										type="button"
										variant="ghost"
										role="option"
										aria-selected={value === item.value}
										aria-disabled={item.disabled || undefined}
										disabled={item.disabled}
										data-active={active ? 'true' : undefined}
										onClick={() => choose(item.value)}
										onMouseEnter={() => setActiveIndex(index)}
										className={cn(
											'relative flex h-auto min-h-10 w-full cursor-pointer select-none items-center justify-start rounded-md px-2.5 py-2 text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground hover:[&_*]:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:[&_*]:text-accent-foreground',
											value === item.value && 'bg-accent text-accent-foreground [&_*]:text-accent-foreground',
											active && 'ring-1 ring-inset ring-primary/60',
											/* A disabled option is still readable — the count beside a
											 * zero is information a scheduler wants — so it dims rather
											 * than disappears, and it cannot be clicked or arrowed to. */
											item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-inherit',
										)}
									>
										<Check
											className={cn(
												'mr-2 size-4 shrink-0',
												value === item.value ? 'opacity-100' : 'opacity-0',
											)}
										/>
										<span className="truncate">{item.label}</span>
									</Button>
								);
							})}
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
