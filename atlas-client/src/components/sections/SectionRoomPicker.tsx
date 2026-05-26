import * as React from 'react';
import { ChevronsUpDown, Search, Check, Map as MapIcon, X, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { ScrollArea } from '@/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { RoomOption } from '@/components/sections/SectionRow';
import { SectionRoomMapModal } from './SectionRoomMapModal';

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
	const inputRef = React.useRef<HTMLInputElement>(null);
	const activeItemRef = React.useRef<HTMLButtonElement>(null);

	const selectedRoom = React.useMemo(() => options.find((opt) => opt.id === value), [options, value]);

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

	// Auto-focus and scroll to active room when opening
	React.useEffect(() => {
		if (open) {
			// Small timeout to allow popover to render
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
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled || isSaving}
						className={cn(
							'h-9 w-full justify-between px-3 rounded-lg border-muted-foreground/20 hover:bg-muted/50 hover:border-muted-foreground/30 transition-all text-xs',
							isSaving && 'opacity-70 grayscale bg-muted/30 cursor-wait',
							!value && 'text-muted-foreground italic'
						)}
					>
						<span className="flex items-center gap-2 truncate">
							{isSaving ? (
								<span className="flex items-center gap-2 font-bold animate-pulse text-[10px] uppercase tracking-wider text-muted-foreground">
									<Clock className="size-3 animate-spin" />
									Saving...
								</span>
							) : selectedRoom ? (
								<>
									<span className="font-semibold text-foreground">{selectedRoom.name}</span>
									<span className="text-[0.65rem] text-muted-foreground/70 uppercase tracking-tighter hidden sm:inline">
										• {selectedRoom.buildingName}
									</span>
								</>
							) : (
								'Unassigned'
							)}
						</span>
						<ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-40" />
					</Button>
				</PopoverTrigger>
				<PopoverContent 
					className="w-[280px] p-0 shadow-xl border-border/40 flex flex-col h-[400px]" 
					align="start"
					onOpenAutoFocus={(e) => { e.preventDefault(); }}
				>
					{/* Header */}
					<div className="shrink-0 flex items-center border-b px-2 py-1.5 bg-muted/30">
						<Search className="ml-1 mr-2 size-3.5 shrink-0 text-muted-foreground/60" />
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search room or building..."
							className="h-7 w-full border-0 bg-transparent text-xs focus-visible:ring-0 px-0 outline-none placeholder:text-muted-foreground/50"
						/>
						{query && (
							<Button 
								variant="ghost" 
								size="icon" 
								className="size-6 -mr-1 text-muted-foreground hover:text-foreground" 
								onClick={() => setQuery('')}
							>
								<X className="size-3" />
							</Button>
						)}
					</div>

					{/* Options List */}
					<ScrollArea className="flex-1">
						<div className="p-1.5">
							<button
								type="button"
								onClick={() => {
									onSelect(null);
									setOpen(false);
								}}
								className={cn(
									'flex w-full items-center justify-start px-2 py-2.5 h-auto text-xs transition-all rounded-md outline-none',
									'hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground group',
									value === null ? 'bg-accent/40 font-bold' : 'transparent'
								)}
							>
								<Check className={cn('mr-2 size-3.5 shrink-0', value === null ? 'opacity-100' : 'opacity-0')} />
								<span className={cn('italic transition-colors', value === null ? 'text-foreground' : 'text-muted-foreground', 'group-hover:text-primary-foreground')}>Unassigned</span>
							</button>
							
							{groups.length === 0 && (
								<div className="py-8 text-center text-xs text-muted-foreground space-y-1">
									<p>No matching rooms found.</p>
									<p className="text-[0.65rem] opacity-70">Try a different search term.</p>
								</div>
							)}
							
							{groups.map((group) => (
								<div key={group.label} className="mt-1">
									<div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-2 py-1.5 text-[0.625rem] font-black uppercase tracking-[0.12em] text-muted-foreground/80 flex items-center justify-between">
										{group.label}
										<Badge variant="outline" className="h-3.5 text-[0.6rem] px-1 font-normal opacity-50 border-0">{group.items.length}</Badge>
									</div>
									<div className="grid gap-0.5 mt-0.5">
										{group.items.map((item) => {
											const occupying = roomOccupancy?.get(item.id);
											const isSelected = value === item.id;
											return (
												<button
													key={item.id}
													ref={isSelected ? activeItemRef : null}
													type="button"
													onClick={() => {
														onSelect(item.id);
														setOpen(false);
													}}
													className={cn(
														'flex w-full items-center justify-start px-2 py-2 h-auto text-xs transition-all rounded-md outline-none',
														'hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground group',
														isSelected ? 'bg-accent/60 font-bold' : 'transparent'
													)}
												>
													<Check className={cn('mr-2 size-3.5 shrink-0 text-primary group-hover:text-primary-foreground', isSelected ? 'opacity-100' : 'opacity-0')} />
													<div className="flex flex-col items-start min-w-0 flex-1">
														<div className="flex items-center gap-2 w-full">
															<span className="truncate group-hover:text-primary-foreground">{item.name}</span>
															{occupying && (
																<Badge variant="outline" className={cn(
																	"ml-auto h-4 px-1 text-[8px] font-black uppercase border-opacity-50",
																	isSelected ? "bg-white/10 text-white border-white/20" : "bg-amber-50 text-amber-600 border-amber-200"
																)}>
																	{occupying}
																</Badge>
															)}
														</div>
														<div className="flex items-center gap-1.5 mt-0.5">
															<span className="text-[0.6rem] text-muted-foreground/60 uppercase font-medium group-hover:text-primary-foreground/70">{item.type.replace('_', ' ')}</span>
															{occupying && <span className="text-[0.6rem] font-bold text-amber-600/80 group-hover:text-primary-foreground/60">• OCCUPIED</span>}
														</div>
													</div>
												</button>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</ScrollArea>

					{/* Footer */}
					<div className="shrink-0 p-1.5 border-t bg-muted/20">
						<Button 
							variant="outline" 
							className="w-full h-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm"
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
		</>
	);
}
