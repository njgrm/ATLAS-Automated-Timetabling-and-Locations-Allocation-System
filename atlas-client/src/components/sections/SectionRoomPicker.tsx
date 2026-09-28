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

/**
 * A3 C9 (packet item 6) — the ONE geometry every option row uses.
 *
 * The recorded defect (Lane C, 2026-09-28, live `a1db27d5`) was MIXED ROW
 * HEIGHTS: a vacant option measured ~37.6px and an occupied one ~53.6px, so
 * scanning the list read as the list jumping. The cause was `h-auto` plus a
 * `flex flex-col` block whose occupied branch appended two extra lines, so the
 * row took its height from its content.
 *
 * The cure is structural, not a content-length hope: a single fixed height
 * (`h-12`), no vertical padding token that could add to it, content centred on
 * one line, and no element inside the row allowed to wrap. Vacant, occupied
 * and "Unassigned" all render this identical class, so the uniform height is
 * an invariant of the component rather than of a particular room set.
 *
 * `group` is part of this constant on purpose: the occupant badge and both
 * label lines key their hover colours off it, so the row's hover treatment
 * cannot diverge between the vacant and occupied variants either.
 */
const OPTION_ROW_CLASS =
	'w-full h-12 shrink-0 items-center px-2 text-xs transition-all rounded-md outline-none group';

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
					/* A3 fix 03 — the body was a fixed w-70 (17.5rem), so content
					 * was clipped on the right instead of reflowing. This is a
					 * viewport-relative cap, not a fixed width: the popover is at
					 * least 22rem and never wider than the window. The occupant
					 * label is now a single truncated line (A3 C9), and the full
					 * name is recovered through a Tooltip and the focus hint. */
					className="w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] p-0 shadow-xl border-border/40 flex flex-col h-100"
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
						<div id={listboxId} className="p-1.5" role="listbox" aria-labelledby={triggerId}>

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
													{/* The room's own identity: two lines, both single-line and
													 * truncating, so neither can grow the row. */}
													<div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
														<span className="w-full truncate group-hover:text-primary-foreground">{item.name}</span>
														<span className="w-full truncate text-xs text-muted-foreground/70 uppercase font-medium group-hover:text-primary-foreground/70">{item.type.replace('_', ' ')}</span>
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
