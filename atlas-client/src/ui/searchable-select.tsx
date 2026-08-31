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
}

export function SearchableSelect({
	items,
	groups,
	value,
	onValueChange,
	placeholder = 'Select…',
	className,
	triggerClassName,
}: SearchableSelectProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const inputRef = React.useRef<HTMLInputElement>(null);

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

	// Find selected label
	const selectedLabel = React.useMemo(() => {
		for (const g of allGroups) {
			const item = g.items.find((i) => i.value === value);
			if (item) return item.label;
		}
		return '';
	}, [allGroups, value]);

	return (
		<Popover
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) setQuery('');
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
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
						placeholder="Search…"
						aria-label="Search schedule options"
						className="flex h-9 w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
					/>
				</div>
				{/* List */}
				<div className="max-h-[min(15rem,calc(var(--radix-popover-content-available-height)-2.5rem))] overflow-y-auto p-1">
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
							{group.items.map((item) => (
								<Button
									key={item.value}
									type="button"
									variant="ghost"
									role="option"
									aria-selected={value === item.value}
									onClick={() => {
										onValueChange(item.value);
										setOpen(false);
										setQuery('');
									}}
									className={cn(
										'relative flex h-auto min-h-10 w-full cursor-pointer select-none items-center justify-start rounded-md px-2.5 py-2 text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground',
										value === item.value && 'bg-accent/50',
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
							))}
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
