import * as React from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import {
	Map as MapIcon,
	Building2,
	CheckCircle2,
	ChevronRight,
	AlertCircle,
	X,
	Users,
	ChevronLeft,
	DoorOpen,
} from 'lucide-react';
import atlasApi from '@/lib/api';
import type { Building, Room } from '@/types';
import { Skeleton } from '@/ui/skeleton';
import { ScrollArea } from '@/ui/scroll-area';
import { CampusMap } from '@/components/CampusMap';
import { BuildingView } from '@/components/BuildingView';
import { cn } from '@/lib/utils';

interface SectionRoomMapModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sectionName: string;
	sectionId: number;
	currentRoomId: number | null;
	onSelect: (roomId: number | null) => void;
	schoolId: number;
	roomOccupancy?: Map<number, string>; // roomId -> sectionName
	roomSectionData?: Map<number, import('@/components/BuildingView').RoomSectionMetadata>;
	buildingOccupancy?: Map<number, number>;
}

export function SectionRoomMapModal({
	open,
	onOpenChange,
	sectionName,
	sectionId,
	currentRoomId,
	onSelect,
	schoolId,
	roomOccupancy,
	roomSectionData,
	buildingOccupancy,
}: SectionRoomMapModalProps) {
	const [buildings, setBuildings] = React.useState<Building[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [activeBuildingId, setActiveBuildingId] = React.useState<number | null>(null);
	const [selectedRoomId, setSelectedRoomId] = React.useState<number | null>(currentRoomId);
	const [viewMode, setViewMode] = React.useState<'campus' | 'building'>('campus');
	const scrollAreaRef = React.useRef<HTMLDivElement>(null);
	const activeRoomRef = React.useRef<HTMLButtonElement>(null);

	// Load campus data
	const loadMapData = React.useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ buildings: Building[] }>(`/map/schools/${schoolId}/buildings`);
			const sortedBuildings = [...data.buildings].sort((a, b) => {
				const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0', 10);
				const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0', 10);
				if (aNum !== bNum) return aNum - bNum;
				return a.name.localeCompare(b.name);
			});
			setBuildings(sortedBuildings);

			// Auto-select building if room is assigned
			if (currentRoomId) {
				const bld = sortedBuildings.find((b) => b.rooms.some((r) => r.id === currentRoomId));
				if (bld) {
					setActiveBuildingId(bld.id);
					setViewMode('building');
				}
			} else if (sortedBuildings.length > 0 && activeBuildingId === null) {
				setActiveBuildingId(sortedBuildings[0].id);
			}
		} catch (err) {
			console.error('Failed to load map data:', err);
		} finally {
			setLoading(false);
		}
	}, [schoolId, currentRoomId]);

	React.useEffect(() => {
		if (open) {
			loadMapData();
			setSelectedRoomId(currentRoomId);
		}
	}, [open, loadMapData, currentRoomId]);

	// Auto-scroll to selected room when building opens or selectedRoomId changes
	React.useEffect(() => {
		if (viewMode === 'building' && activeRoomRef.current) {
			activeRoomRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [viewMode, activeBuildingId, selectedRoomId]);

	const activeBuilding = React.useMemo(
		() => buildings.find((b) => b.id === activeBuildingId) ?? null,
		[buildings, activeBuildingId],
	);

	const selectedRoom = React.useMemo(() => {
		if (selectedRoomId === null) return null;
		for (const b of buildings) {
			const r = b.rooms.find((room) => room.id === selectedRoomId);
			if (r) return { ...r, buildingName: b.name };
		}
		return null;
	}, [buildings, selectedRoomId]);

	const handleConfirm = () => {
		onSelect(selectedRoomId);
		onOpenChange(false);
	};

	const handleBuildingToggle = (id: number) => {
		if (activeBuildingId === id) {
			setActiveBuildingId(null);
			setViewMode('campus');
		} else {
			setActiveBuildingId(id);
			setViewMode('building');
		}
	};

	const handleRoomSelectFromMap = (room: Room | null) => {
		setSelectedRoomId(room?.id ?? null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden border-border/40 shadow-2xl">
				<div className="flex-1 flex flex-col min-h-0">
					{/* Header area */}
					<div className="shrink-0 border-b bg-muted/30 px-6 py-4">
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<DialogTitle className="text-xl font-bold tracking-tight">Assign Home Room</DialogTitle>
									<Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-wider text-[10px]">
										Interactive Map
									</Badge>
								</div>
								<DialogDescription className="text-sm font-medium">
									Selecting for section <span className="text-foreground font-bold">{sectionName}</span>
								</DialogDescription>
							</div>
							<div className="flex items-center gap-3 mr-12">
								<Button variant="outline" size="sm" onClick={() => setSelectedRoomId(null)} disabled={selectedRoomId === null} className="h-9 gap-2 font-bold uppercase text-[10px] tracking-widest border-muted-foreground/20 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30">
									<X className="size-3.5" /> Clear Selection
								</Button>
								<Button size="sm" onClick={handleConfirm} className="h-9 gap-2 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
									<CheckCircle2 className="size-3.5" /> Confirm Assignment
								</Button>
							</div>
						</div>
					</div>

					<div className="flex-1 flex min-h-0">
						{/* Sidebar Room List */}
						<div className="w-80 shrink-0 border-r flex flex-col bg-card">
							{/* Active Selection Sidebar Component */}
							<div className="p-4 border-b bg-muted/20">
								<p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">Active Selection</p>
								{selectedRoom ? (
									<div className="flex items-start gap-3 p-3 rounded-xl border-2 bg-primary/5 border-primary/20 animate-in fade-in zoom-in-95 duration-200">
										<div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
											<CheckCircle2 className="size-5 text-primary" />
										</div>
										<div className="min-w-0">
											<p className="font-bold text-foreground leading-tight truncate">{selectedRoom.name}</p>
											<p className="text-xs text-muted-foreground truncate">{selectedRoom.buildingName}</p>
											
											{roomOccupancy?.has(selectedRoomId!) && (
												<div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
													<Users className="size-2.5" />
													Used by: {roomOccupancy.get(selectedRoomId!)}
												</div>
											)}

											<Badge variant="secondary" className="mt-1.5 h-4 text-[9px] font-black uppercase tracking-tighter">
												{selectedRoom.type.replace('_', ' ')}
											</Badge>
										</div>
									</div>
								) : (
									<div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/5">
										<div className="size-10 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center border border-border">
											<AlertCircle className="size-5 text-muted-foreground/40" />
										</div>
										<p className="text-xs font-semibold text-muted-foreground italic">No room selected</p>
									</div>
								)}
							</div>

							<div className="p-4 border-b bg-muted/5">
								<h3 className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground/80 flex items-center gap-2">
									<Building2 className="size-4" />
									Building Explorer
								</h3>
							</div>
							
							<ScrollArea className="flex-1" ref={scrollAreaRef}>
								<div className="p-2 space-y-4">
									{loading ? (
										Array.from({ length: 4 }).map((_, i) => (
											<div key={i} className="space-y-2 p-2">
												<Skeleton className="h-4 w-32" />
												<div className="grid grid-cols-2 gap-2">
													<Skeleton className="h-10 w-full" />
													<Skeleton className="h-10 w-full" />
												</div>
											</div>
										))
									) : (
										buildings.map((b) => (
											<div key={b.id} className="space-y-1">
												<button
													onClick={() => handleBuildingToggle(b.id)}
													className={cn(
														"w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all",
														activeBuildingId === b.id 
															? "bg-primary/5 text-primary font-bold shadow-sm" 
															: "hover:bg-muted text-muted-foreground font-medium"
													)}
												>
													<span className="text-xs">{b.name}</span>
													<ChevronRight className={cn("size-3.5 transition-transform", activeBuildingId === b.id && "rotate-90")} />
												</button>
												
												{activeBuildingId === b.id && (
													<div className="grid grid-cols-1 gap-1 px-1 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
														{b.rooms.length === 0 ? (
															<p className="text-[10px] text-center py-4 italic text-muted-foreground">No rooms in this building.</p>
														) : (
															b.rooms.map((r) => {
																const occupying = roomOccupancy?.get(r.id);
																const isSelected = selectedRoomId === r.id;
																return (
																	<button
																		key={r.id}
																		ref={isSelected ? activeRoomRef : null}
																		onClick={() => {
																			setSelectedRoomId(r.id);
																			setViewMode('building');
																		}}
																		className={cn(
																			"group relative flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
																			isSelected
																				? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02] z-10"
																				: "bg-background border-border/50 hover:border-primary/50 hover:shadow-md"
																		)}
																	>
																		<div className={cn(
																			"size-7 shrink-0 rounded-md flex items-center justify-center border",
																			isSelected 
																				? "bg-white/20 border-white/30" 
																				: "bg-muted border-border/40 group-hover:bg-primary/10 group-hover:border-primary/20"
																		)}>
																			<span className="text-[10px] font-black uppercase">
																				{r.name.slice(0, 2)}
																			</span>
																		</div>
																		<div className="min-w-0 flex-1">
																			<div className="flex items-center gap-2">
																				<p className="text-xs font-bold truncate leading-none">{r.name}</p>
																				{occupying && (
																					<Badge variant="outline" className={cn(
																						"h-3.5 px-1 text-[8px] font-bold border-opacity-50",
																						isSelected ? "bg-white/10 text-white border-white/20" : "bg-amber-50 text-amber-600 border-amber-200"
																					)}>
																						{occupying}
																					</Badge>
																				)}
																			</div>
																			<div className="flex items-center gap-1.5 mt-1">
																				<p className={cn(
																					"text-[9px] uppercase tracking-tighter font-medium",
																					isSelected ? "text-primary-foreground/70" : "text-muted-foreground/60"
																				)}>
																					{r.type.replace('_', ' ')}
																				</p>
																				{occupying && (
																					<span className={cn(
																						"text-[9px] font-bold",
																						isSelected ? "text-white/60" : "text-amber-600/80"
																					)}>
																						• OCCUPIED
																					</span>
																				)}
																			</div>
																		</div>
																		{isSelected && (
																			<CheckCircle2 className="size-3.5 ml-auto text-primary-foreground" />
																		)}
																	</button>
																);
															})
														)}
													</div>
												)}
											</div>
										))
									)}
								</div>
							</ScrollArea>
						</div>

						{/* Main Map/Building View */}
						<div className="flex-1 bg-muted/10 p-6 flex flex-col overflow-hidden">
							{loading ? (
								<div className="flex-1 flex flex-col gap-4">
									<Skeleton className="h-8 w-64" />
									<Skeleton className="flex-1 w-full rounded-xl" />
								</div>
							) : buildings.length === 0 ? (
								<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-12 border-2 border-dashed rounded-2xl">
									<MapIcon className="size-12 opacity-20 mb-4" />
									<p className="font-bold">No buildings found on campus map.</p>
									<p className="text-sm max-w-xs mt-1">Visit the Map Editor to define your school layout before assigning home rooms.</p>
								</div>
							) : viewMode === 'campus' ? (
								<div className="flex-1 flex flex-col min-h-0 relative">
									<div className="shrink-0 mb-4 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<MapIcon className="size-5 text-primary" />
											<h3 className="font-bold text-lg">Campus Map View</h3>
										</div>
										<p className="text-xs text-muted-foreground">Select a building to view its rooms</p>
									</div>
									<div className="flex-1 border rounded-2xl bg-background shadow-inner overflow-hidden">
										<CampusMap 
											buildings={buildings} 
											activeBuildingId={activeBuildingId} 
											onSelect={(id) => {
												if (id) {
													setActiveBuildingId(id);
													setViewMode('building');
												}
											}} 
											buildingOccupancy={buildingOccupancy}
										/>
									</div>
								</div>
							) : (
								<div className="flex-1 flex flex-col min-h-0">
									<div className="shrink-0 mb-4 flex items-center justify-between">
										<Button variant="ghost" size="sm" onClick={() => { setActiveBuildingId(null); setViewMode('campus'); }} className="h-9 gap-2 font-bold uppercase text-[10px] tracking-widest text-primary hover:bg-primary/5 rounded-xl border border-primary/10">
											<ChevronLeft className="size-4" /> Back to Campus
										</Button>
										<div className="flex flex-col items-end">
											<h3 className="font-bold text-xl text-foreground">{activeBuilding?.name}</h3>
											<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Building Interior View</p>
										</div>
									</div>
									
									<div className="flex-1 border rounded-3xl bg-background/50 shadow-inner overflow-hidden">
										{activeBuilding ? (
											<BuildingView
												building={activeBuilding}
												selectedRoomId={selectedRoomId}
												onRoomSelect={handleRoomSelectFromMap}
												height={500}
												roomOccupancy={roomOccupancy}
												roomSectionData={roomSectionData}
											/>
										) : (
											<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 h-full">
												<Building2 className="size-12 mb-4" />
												<p className="font-bold">No building selected.</p>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
