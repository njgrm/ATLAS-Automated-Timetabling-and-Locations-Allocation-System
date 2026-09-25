import * as React from 'react';
import { ChevronsUpDown, Search, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export interface SearchableSelectGroup {
	label: string;
	items: { value: string; label: string }[];
}

interface SearchableSelectProps {
	/** Flat items (no groups). Use `groups` for grouped list. */
	items?: { value: string; label: string }[];
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
}

type FlatOption = { value: string; label: string; index: number };

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
		setActiveIndex(0);
	}, [query, open]);

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
		return '';
	}, [allGroups, value]);

	const choose = (next: string) => {
		onValueChange(next);
		setOpen(false);
		setQuery('');
	};

	// LANE-C C03 (B11) — typing a name and pressing Enter selects the highlighted
	// match (the first one by default); arrow keys move the highlight.
	const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (flatOptions.length === 0) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActiveIndex((index) => Math.min(index + 1, flatOptions.length - 1));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const option = flatOptions[Math.min(activeIndex, flatOptions.length - 1)];
			if (option) choose(option.value);
		}
	};

	const optionId = (index: number) => `${listId}-option-${index}`;
	const indexByValue = new Map(flatOptions.map((option) => [option.value, option.index]));
	const triggerLabel = disabled
		? (disabledReason ?? 'No options available')
		: ariaLabel
			? `${ariaLabel}: ${value ? selectedLabel : placeholder}`
			: undefined;

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
				<Button
					id={triggerId}
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-haspopup="listbox"
					disabled={disabled}
					aria-disabled={disabled}
					aria-label={triggerLabel}
					className={cn('min-w-[160px] justify-between font-normal', triggerClassName)}
				>
					<span className="truncate">{value ? selectedLabel : placeholder}</span>
					<ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn('w-[var(--radix-popover-trigger-width)] min-w-[200px] max-h-[var(--radix-popover-content-available-height)] overflow-hidden p-0', className)}
				collisionPadding={8}
				onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
			>
				{/* Search input */}
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
										data-active={active ? 'true' : undefined}
										onClick={() => choose(item.value)}
										onMouseEnter={() => setActiveIndex(index)}
										className={cn(
											'relative flex h-auto min-h-10 w-full cursor-pointer select-none items-center justify-start rounded-md px-2.5 py-2 text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground hover:[&_*]:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:[&_*]:text-accent-foreground',
											value === item.value && 'bg-accent text-accent-foreground [&_*]:text-accent-foreground',
											active && 'ring-1 ring-inset ring-primary/60',
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
