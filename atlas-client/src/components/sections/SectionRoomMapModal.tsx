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
	WifiOff,
	RefreshCw,
	Users,
	ChevronLeft,
	DoorOpen,
} from 'lucide-react';
import atlasApi from '@/lib/api';
import type { Building, Room } from '@/types';
import { Skeleton } from '@/ui/skeleton';
import { ScrollArea } from '@/ui/scroll-area';
import { CampusMap } from '@/components/CampusMap';
import { fetchCampusBackground } from '@/lib/campus-background-api';
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
	/**
	 * A3 c11 FIX-12 — can this pick be written at all? The owner of the write
	 * (`pages/Sections.tsx`) decides, and passes its own not-saved sentence, so
	 * the header can make the control visibly unavailable instead of accepting a
	 * click that would be dropped without a word.
	 */
	canWrite?: boolean;
	writeBlockedReason?: string | null;
}

/**
 * ACTOR-SCOPE-C01 — fail-closed loader for the section room map.
 *
 * A missing/invalid actor school (`0`, negative, fractional, NaN) dispatches
 * NOTHING and returns `null`. This is the single production loader the modal
 * uses, so a `schoolId` that is not a strict positive integer can never reach
 * the map-buildings request.
 */
export async function fetchSectionRoomMapBuildings(schoolId: number): Promise<Building[] | null> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) return null;
	const { data } = await atlasApi.get<{ buildings: Building[] }>(`/map/schools/${schoolId}/buildings`);
	return data.buildings ?? [];
}

/**
 * A3 c11 FIX-12 — the one wording for "we could not reach ATLAS", kept out of
 * the render so the pane and the sidebar cannot word it differently.
 *
 * The recorded defect: going Offline made this dialog claim "No buildings found
 * on campus map" — a false statement about the school's inventory, produced by
 * a request that never reached the server. An empty result the SERVER reported
 * and a result the DEVICE could not fetch are different facts, and they now
 * have different sentences.
 */
export const ROOM_MAP_OFFLINE_MESSAGE =
	'ATLAS could not reach the server to load buildings. Nothing is wrong with your school layout — this is a connection problem.';
export const ROOM_MAP_OFFLINE_HINT = 'Reconnect and try again. The room list will load once ATLAS is back online.';

/** The genuine empty state, which this change must not alter. */
export const ROOM_MAP_EMPTY_TITLE = 'No buildings found on campus map.';

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
	canWrite = true,
	writeBlockedReason = null,
}: SectionRoomMapModalProps) {
	const [buildings, setBuildings] = React.useState<Building[]>([]);
	const [loading, setLoading] = React.useState(true);
	/**
	 * A3 c11 FIX-12 — `null` means "the server answered". A string means the
	 * request never produced an answer, which is a different fact from an empty
	 * campus and gets its own sentence. The base code collapsed both into
	 * `buildings.length === 0`, so a connection failure announced itself as
	 * "No buildings found on campus map."
	 */
	const [loadFailure, setLoadFailure] = React.useState<string | null>(null);
	const [activeBuildingId, setActiveBuildingId] = React.useState<number | null>(null);
	const [selectedRoomId, setSelectedRoomId] = React.useState<number | null>(currentRoomId);
	const [viewMode, setViewMode] = React.useState<'campus' | 'building'>('campus');
	// A9 m1 - the photo and its placement, read through the SHARED client seam so
	// this room map frames the campus the same way the editor and the overview do.
	// A load failure leaves both null, which renders the same no-background view this
	// modal has always shown rather than a half-placed photo.
	const [campusImageUrl, setCampusImageUrl] = React.useState<string | null>(null);
	const [campusMapPlacement, setCampusMapPlacement] = React.useState<unknown>(null);
	const scrollAreaRef = React.useRef<HTMLDivElement>(null);
	const activeRoomRef = React.useRef<HTMLButtonElement>(null);

	// Load campus data
	const loadMapData = React.useCallback(async () => {
		setLoading(true);
		setLoadFailure(null);
		try {
			const [loadedBuildings, background] = await Promise.all([
				fetchSectionRoomMapBuildings(schoolId),
				fetchCampusBackground(schoolId).catch(() => ({ campusImageUrl: null, campusMapPlacement: null })),
			]);
			setCampusImageUrl(background.campusImageUrl);
			setCampusMapPlacement(background.campusMapPlacement);
			if (loadedBuildings == null) {
				// Unresolved/invalid actor school — never dispatch or render stale
				// buildings from a previous scope.
				setBuildings([]);
				return;
			}
			const sortedBuildings = [...loadedBuildings].sort((a, b) => {
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
			// A3 c11 FIX-12: the request failed, so ATLAS knows NOTHING about this
			// campus. The old handler logged and left `buildings` empty, and the
			// pane then stated that no buildings exist.
			console.error('Failed to load map data:', err);
			setBuildings([]);
			setLoadFailure(ROOM_MAP_OFFLINE_MESSAGE);
		} finally {
			setLoading(false);
		}
	}, [schoolId, currentRoomId]);

	React.useEffect(() => {
		if (open && Number.isInteger(schoolId) && schoolId > 0) {
			loadMapData();
			setSelectedRoomId(currentRoomId);
		}
	}, [open, loadMapData, currentRoomId, schoolId]);

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

	/**
	 * A3 c11 FIX-08 — Option C, decided by Planner A3 and recorded here so the
	 * choice is not re-litigated in review:
	 *
	 *  - The base header carried a `Clear Selection` button that only reset
	 *    LOCAL staged state. The review found it ambiguous ("does this mean local
	 *    deselection or permanent unassignment?") and the reviewer was forbidden
	 *    from implementing both readings, so exactly ONE branch ships:
	 *    `Unassign Room` — the destructive, confirmed, PERSISTED action — plus a
	 *    Confirm control that is disabled unless a real change is staged.
	 *    Option A (remove the ambiguity by removing the control) and Option B
	 *    (rename it `Deselect Room`) are therefore both deliberately NOT
	 *    shipped, because shipping either alongside C would be the prohibited
	 *    "both branches".
	 *  - Option C is the only branch that keeps the product's ONLY unassign
	 *    capability: `pages/Sections.tsx` reaches `intent.kind === 'unassign'`
	 *    only through `handleHomeRoomChange(section, null)`, so dropping the path
	 *    would delete unassignment entirely.
	 *  - Local deselection is no longer needed as a control at all: Cancel
	 *    discards the staged pick, and picking another room replaces it.
	 */
	const hasCurrentRoom = currentRoomId !== null && currentRoomId !== undefined;
	/** A staged pick is only a change if it exists and differs from what is saved. */
	const isStagedChange = selectedRoomId !== null && selectedRoomId !== currentRoomId;
	const confirmDisabledReason = !canWrite
		? (writeBlockedReason ?? 'Home-room changes cannot be saved right now.')
		: selectedRoomId === null
			? 'Pick a room on the map to assign it.'
			: selectedRoomId === currentRoomId
				? 'That is the room already assigned. Pick a different room to change it.'
				: null;

	const handleConfirm = () => {
		// The guard is repeated in code, not only in `disabled`: a header that
		// offers a destructive-looking primary action must not be able to fire
		// one, and a null selection must never be read as "unassign".
		if (!canWrite || !isStagedChange) return;
		onSelect(selectedRoomId);
		onOpenChange(false);
	};

	/**
	 * The unassign request. It does NOT write: it hands `null` to the page's own
	 * `onSelect`, which routes it through the existing `resolveHomeRoomIntent`
	 * and the existing `UnassignConfirmationModal`. A second confirmation
	 * component, or a write from here, would be the ambiguity this fix removes.
	 */
	const handleUnassignRequest = () => {
		if (!canWrite) return;
		// The staged pick is not part of an unassign; drop it so the control
		// cannot read as "this room will be assigned" while it is being removed.
		setSelectedRoomId(currentRoomId);
		onSelect(null);
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
		// A3 c11 FIX-08: `BuildingView` reports a click on the ALREADY-selected
		// room as `null` (its inspect toggle). Acting on that would reintroduce
		// the ambiguous deselect this fix removes, so a null pick is ignored and
		// a real pick replaces the staged one.
		if (!room) return;
		setSelectedRoomId(room.id);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				/*
				 * A5 item 23.2 — "Assign Home Room", target 4 of 5. A DATA surface
				 * (a room picker over a map), so it takes the shared dialog's default
				 * `resizable` handling. The only bounds kept here are its own:
				 * `w-[95vw] h-[90vh]`, its `p-0` shell and its own scroll. The drag
				 * handles and the clamps now arrive from `@/ui/dialog` instead of
				 * being this page's private idea of resizing.
				 */
				resizable
				className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden border-border/40 shadow-2xl"
			>
				<div className="flex-1 flex flex-col min-h-0">
					{/* Header area */}
					<div className="shrink-0 border-b bg-muted/30 px-6 py-4">
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<DialogTitle className="text-xl font-bold tracking-tight">Assign Home Room</DialogTitle>
									<Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-wider text-xs">
										Interactive Map
									</Badge>
								</div>
								<DialogDescription className="text-sm font-medium">
									Selecting for section <span className="text-foreground font-bold">{sectionName}</span>
								</DialogDescription>
							</div>
						<div className="flex items-center gap-3 mr-12">
							{/* A3 c11 FIX-08 (Option C): the ONLY removal control, and it
							 * is rendered only when there is something to remove. It
							 * uses the repository's destructive pattern — a
							 * destructive-foreground outline button with the warning
							 * icon the unassign confirmation itself uses — and it asks
							 * for confirmation through the EXISTING
							 * `UnassignConfirmationModal`; it never writes. */}
							{hasCurrentRoom && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleUnassignRequest}
									disabled={!canWrite}
									data-testid="room-map-unassign"
									className="h-9 gap-2 rounded-xl font-bold uppercase text-xs tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
								>
									<AlertCircle className="size-3.5" /> Unassign Room
								</Button>
							)}
							<Button
								type="button"
								size="sm"
								onClick={handleConfirm}
								disabled={confirmDisabledReason !== null}
								data-testid="room-map-confirm"
								aria-describedby={confirmDisabledReason ? 'room-map-confirm-reason' : undefined}
								className="h-9 gap-2 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-primary/20"
							>
								<CheckCircle2 className="size-3.5" /> Confirm Assignment
							</Button>
						</div>
					</div>
					{/* The reason travels with the control, not on a raw `title`
					 * (AGENTS.md §8), so a disabled primary action is never inert
					 * without saying why. It is a live region because a change of
					 * reason is information, not decoration. */}
					{confirmDisabledReason && (
						<p
							id="room-map-confirm-reason"
							data-testid="room-map-confirm-reason"
							role="status"
							aria-live="polite"
							className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-destructive"
						>
							<AlertCircle className="mt-px size-3.5 shrink-0" />
							<span>{confirmDisabledReason}</span>
						</p>
					)}
				</div>


					<div className="flex-1 flex min-h-0">
						{/* Sidebar Room List */}
						<div className="w-80 shrink-0 border-r flex flex-col bg-card">
							{/* Active Selection Sidebar Component */}
							<div className="p-4 border-b bg-muted/20">
								<p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Active Selection</p>
								{selectedRoom ? (
									<div className="flex items-start gap-3 p-3 rounded-xl border-2 bg-primary/5 border-primary/20 animate-in fade-in zoom-in-95 duration-200">
										<div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
											<CheckCircle2 className="size-5 text-primary" />
										</div>
										<div className="min-w-0">
											<p className="font-bold text-foreground leading-tight break-words">{selectedRoom.name}</p>
											<p className="text-xs text-muted-foreground break-words">{selectedRoom.buildingName}</p>
											
											{roomOccupancy?.has(selectedRoomId!) && (
												<div className="mt-2 flex items-start gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100">
													<Users className="size-3.5 mt-0.5 shrink-0" />
													<span className="break-words">Used by: {roomOccupancy.get(selectedRoomId!)}</span>
												</div>
											)}

											<Badge variant="secondary" className="mt-1.5 h-5 text-xs font-bold uppercase">
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
								{/* A3 c11 fix 10.1 — the list was the smallest,
								 * lightest type in the dialog: `text-xs` inside a
								 * muted idle state, on `space-y-4` rows, so a building
								 * name read as less important than the room badges
								 * nested under it. The operator's own request is
								 * `text-sm` (14px), medium-or-stronger, dark, on a
								 * `py-2.5 px-3` row that feels solid, with the
								 * chevron vertically centred — all applied here, and
								 * the selected parent KEEPS that weight and size so
								 * the expanded state does not read as a different
								 * control from the collapsed one. */}
							</div>

							<ScrollArea className="flex-1" ref={scrollAreaRef}>
								{/* `space-y-1` replaces `space-y-4`: the operator named
								 * the "excessive vertical padding and empty white
								 * space around each row" as part of the defect, and the
								 * tighter gap is what lets 14px type sit on a
								 * `py-2.5` row without the list growing past the
								 * pane. */}
								<div className="p-2 space-y-1">
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
									) : loadFailure ? (
										/* A3 c11 FIX-12: the list must not read as empty
										 * when ATLAS never got an answer. Same recovery as
										 * the pane: say what failed and offer the retry. */
										<div role="alert" data-testid="room-map-sidebar-load-failure" className="m-2 flex flex-col items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
											<span className="flex items-start gap-1.5">
												<WifiOff className="mt-px size-3.5 shrink-0" />
												<span>{loadFailure}</span>
											</span>
											<Button type="button" size="sm" variant="outline" onClick={() => { void loadMapData(); }} data-testid="room-map-sidebar-retry" className="h-7 gap-1.5 rounded-lg border-destructive/40 font-bold text-destructive hover:bg-destructive/10">
												<RefreshCw className="size-3" /> Try again
											</Button>
										</div>
									) : (
									buildings.map((b) => (
										<div key={b.id} className="space-y-1">
											<Button
												type="button"
												variant="ghost"
												onClick={() => handleBuildingToggle(b.id)}
												aria-expanded={activeBuildingId === b.id}
												className={cn(
													"group w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
													activeBuildingId === b.id
														? "bg-primary/10 text-slate-900 shadow-sm"
														: "text-slate-800 hover:bg-slate-100/70 hover:text-slate-900"
												)}
											>
												{/* fix 10.1: `text-sm` (14px) with `font-medium`,
												 * `font-semibold` while expanded, and a dark
												 * `text-slate-800` idle colour instead of the
												 * washed-out muted grey. `min-w-0` +
												 * `break-words` keeps a long building name
												 * wrapping INSIDE the row rather than pushing
												 * the chevron out of the trigger. */}
												<span className={cn(
													"min-w-0 text-sm break-words",
													activeBuildingId === b.id ? "font-semibold" : "font-medium"
												)}>
													{b.name}
												</span>
												<ChevronRight className={cn("size-4 shrink-0 text-slate-500 transition-transform", activeBuildingId === b.id && "rotate-90")} />
											</Button>
												
												{activeBuildingId === b.id && (
													<div className="grid grid-cols-1 gap-1 px-1 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
													{b.rooms.length === 0 ? (
														<p className="text-xs text-center py-4 italic text-muted-foreground">No rooms in this building.</p>
													) : (
														b.rooms.map((r) => {
															const occupying = roomOccupancy?.get(r.id);
															const isSelected = selectedRoomId === r.id;
															return (
																<Button
																	key={r.id}
																	ref={isSelected ? activeRoomRef : null}
																	type="button"
																	variant="ghost"
																	onClick={() => {
																		setSelectedRoomId(r.id);
																		setViewMode('building');
																	}}
																	className={cn(
																		"group relative w-full justify-start gap-3 px-3 py-2.5 h-auto rounded-lg border text-left transition-all",
																		isSelected
																			? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02] z-10"
																			: "bg-background border-border/50 hover:border-primary/50 hover:shadow-md"
																	)}
																>
																	<div className={cn(
																		"size-8 shrink-0 rounded-md flex items-center justify-center border",
																		isSelected
																			? "bg-white/20 border-white/30"
																			: "bg-muted border-border/40 group-hover:bg-primary/10 group-hover:border-primary/20"
																	)}>
																		<span className="text-xs font-bold uppercase">
																			{r.name.slice(0, 2)}
																		</span>
																	</div>
																	<div className="min-w-0 flex-1">
																		<div className="flex flex-col items-start gap-1">
																			<p className="text-sm font-bold leading-tight break-words">{r.name}</p>
																			{occupying && (
																				<Badge variant="outline" className={cn(
																					"h-5 max-w-full px-1.5 text-xs font-bold whitespace-normal break-words text-left",
																					isSelected ? "bg-white/10 text-white border-white/20" : "bg-amber-50 text-amber-700 border-amber-200"
																				)}>
																					Used by {occupying}
																				</Badge>
																			)}
																		</div>
																		<div className="flex flex-wrap items-center gap-1.5 mt-1">
																			<p className={cn(
																				"text-xs uppercase tracking-wide font-medium",
																				isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
																			)}>
																				{r.type.replace('_', ' ')}
																			</p>
																			{occupying && (
																				<span className={cn(
																					"text-xs font-bold",
																					isSelected ? "text-white/80" : "text-amber-700"
																				)}>
																					Already assigned
																				</span>
																			)}
																		</div>
																	</div>

																		{isSelected && (
																			<CheckCircle2 className="size-3.5 ml-auto text-primary-foreground" />
																		)}
																	</Button>
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
						) : loadFailure ? (
							/* A3 c11 FIX-12 — the recorded staging failure. Going
							 * Offline made this pane claim "No buildings found on
							 * campus map", a statement about the school's inventory
							 * that ATLAS had no way to know. The genuine empty state
							 * below is unchanged; only the unreachable case is new,
							 * and it names the connection problem and offers the
							 * retry that actually clears it. */
							<div
								role="alert"
								data-testid="room-map-load-failure"
								className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-2xl border-destructive/40 bg-destructive/5"
							>
								<WifiOff className="size-12 opacity-40 mb-4 text-destructive" />
								<p className="font-bold text-destructive">{loadFailure}</p>
								<p className="text-sm max-w-sm mt-1">{ROOM_MAP_OFFLINE_HINT}</p>
								<Button type="button" size="sm" variant="outline" onClick={() => { void loadMapData(); }} data-testid="room-map-retry" className="mt-4 h-9 gap-2 rounded-xl border-destructive/40 font-bold text-destructive hover:bg-destructive/10">
									<RefreshCw className="size-3.5" /> Try again
								</Button>
							</div>
						) : buildings.length === 0 ? (
							<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-12 border-2 border-dashed rounded-2xl">
								<MapIcon className="size-12 opacity-20 mb-4" />
								<p className="font-bold" data-testid="room-map-empty">{ROOM_MAP_EMPTY_TITLE}</p>
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
										campusImageUrl={campusImageUrl}
										campusMapPlacement={campusMapPlacement}
									/>

									</div>
								</div>
							) : (
								<div className="flex-1 flex flex-col min-h-0">
									<div className="shrink-0 mb-4 flex items-center justify-between">
									<Button variant="ghost" size="sm" onClick={() => { setActiveBuildingId(null); setViewMode('campus'); }} className="h-9 gap-2 font-bold uppercase text-xs tracking-widest text-primary hover:bg-primary/5 rounded-xl border border-primary/10">
										<ChevronLeft className="size-4" /> Back to Campus
									</Button>
									<div className="flex flex-col items-end">
										<h3 className="font-bold text-xl text-foreground">{activeBuilding?.name}</h3>
										<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Building Interior View</p>
									</div>
								</div>

								<div className="flex-1 min-h-0 border rounded-3xl bg-background/50 shadow-inner overflow-hidden">
									{activeBuilding ? (
									/* A3 fix 06 — the canvas tracks this pane's height.
									 * Measured at 1366x768: the pane's inner HEIGHT is
									 * 497.2px (its inner WIDTH is 929.7px) and
									 * BuildingView's toolbar takes 36px, leaving 461.2px
									 * for the stage, so the previous hardcoded
									 * height={500} overflowed by 38.8px and the pane's
									 * overflow-hidden clipped the bottom-most floor with
									 * no scrollbar. fillAvailableHeight measures the pane
									 * instead. Pan/zoom/clamp are unchanged. */
										<BuildingView
											building={activeBuilding}
											fillAvailableHeight
											selectedRoomId={selectedRoomId}
											onRoomSelect={handleRoomSelectFromMap}
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
