import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { Move, RotateCw, ScanSearch, Search, Flame } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import type {
	DayOfWeek,
	FacultyGlobalDraftEntry,
	FacultyRoomPreferenceEntry,
	FacultyTeachingAssignmentIdentity,
	Room,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { Switch } from '@/ui/switch';

type TimeSlot = { startTime: string; endTime: string };

type DesktopRoomRequestLayoutProps = {
	days: DayOfWeek[];
	timeSlots: TimeSlot[];
	globalBySlot: Map<string, FacultyGlobalDraftEntry[]>;
	showFullScheduleContext: boolean;
	selectionCountBySlot: Map<string, number>;
	slotSelectionDetails: Map<string, { count: number; actors: string[] }>;
	entrySelectionDetails: Map<string, { count: number; actors: string[] }>;
	activeSchoolYearId: number | null;
	runId: number | null;
	selectedSourceEntryId: string | null;
	selectedEntry: FacultyRoomPreferenceEntry | null;
	zoom: number;
	onZoomOut: () => void;
	onZoomIn: () => void;
	onZoomReset: () => void;
	roomSearch: string;
	onRoomSearchChange: (value: string) => void;
	filteredRooms: Array<Room & { buildingName: string }>;
	onAssignRoomToEntry: (entryId: string, roomId: number) => void;
	onSelectSourceEntry: (entryId: string) => void;
	onSelectTargetFromGrid: (payload: { day: DayOfWeek; startTime: string; endTime: string; targetEntryId: string | null }) => void;
	onUpdateSelectedRationale: (value: string) => void;
	renderStatusBadge: (status: RoomPreferenceStatus | null, decision: RoomPreferenceDecisionStatus | null) => ReactNode;
	entries: FacultyRoomPreferenceEntry[];
	teachingAssignments: FacultyTeachingAssignmentIdentity[];
};

function slotKey(day: string, startTime: string, endTime: string) {
	return `${day}|${startTime}|${endTime}`;
}

export default function DesktopRoomRequestLayout({
	days,
	timeSlots,
	globalBySlot,
	showFullScheduleContext,
	selectionCountBySlot,
	slotSelectionDetails,
	entrySelectionDetails,
	selectedSourceEntryId,
	selectedEntry,
	zoom,
	onZoomOut,
	onZoomIn,
	onZoomReset,
	roomSearch,
	onRoomSearchChange,
	filteredRooms,
	onAssignRoomToEntry,
	onSelectSourceEntry,
	onSelectTargetFromGrid,
	onUpdateSelectedRationale,
	renderStatusBadge,
	entries,
	teachingAssignments,
}: DesktopRoomRequestLayoutProps) {
	const gridScrollRef = useRef<HTMLDivElement>(null);
	const [heatmapMode, setHeatmapMode] = useState(false);

	// Auto-Zoom and Center effect
	useEffect(() => {
		if (selectedEntry && gridScrollRef.current) {
			const targetId = `slot-${selectedEntry.day}-${selectedEntry.startTime}`;
			const element = document.getElementById(targetId);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
				// Subtle visual pulse to highlight
				element.animate([
					{ boxShadow: '0 0 0 0 rgba(var(--primary), 0)' },
					{ boxShadow: '0 0 0 10px rgba(var(--primary), 0.2)' },
					{ boxShadow: '0 0 0 0 rgba(var(--primary), 0)' }
				], { duration: 1000, iterations: 2 });
			}
		}
	}, [selectedEntry?.entryId]);

	return (
		<div className='hidden flex-1 min-h-0 gap-6 overflow-hidden px-6 pb-6 lg:grid lg:grid-cols-[1fr_420px]'>
			{/* Left Workspace: Large Grid Area */}
			<div className='flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm'>
				<div className='border-b border-border px-6 py-4 bg-muted/30' data-tutorial='target-slot-map'>
					<div className='flex items-center justify-between gap-4'>
						<div>
							<h3 className='text-sm font-bold text-foreground flex items-center gap-2'>
								Target Schedule Map
								{heatmapMode && <Badge variant='warning' className='h-5 gap-1'><Flame className='size-3'/> Heatmap</Badge>}
							</h3>
							<p className='text-xs text-muted-foreground mt-0.5'>
								{selectedSourceEntryId
									? 'Click a free slot or another class to request a swap.'
									: 'Select your class first from the list on the right.'}
							</p>
						</div>
						<div className='flex items-center gap-3'>
							<div className='flex items-center gap-2 mr-2 border-r pr-4 border-border'>
								<Switch id='heatmap' checked={heatmapMode} onCheckedChange={setHeatmapMode} />
								<Label htmlFor='heatmap' className='text-xs font-bold cursor-pointer'>Heatmap</Label>
							</div>
							<div className='flex items-center gap-1 bg-background rounded-xl border border-border p-1'>
								<Button variant='ghost' size='icon' className='size-8 rounded-lg' onClick={onZoomOut} title='Zoom Out'>
									<Move className='size-4' />
								</Button>
								<div className='px-2 text-[10px] font-bold text-muted-foreground'>{Math.round(zoom * 100)}%</div>
								<Button variant='ghost' size='icon' className='size-8 rounded-lg' onClick={onZoomIn} title='Zoom In'>
									<ScanSearch className='size-4' />
								</Button>
								<Button variant='ghost' size='icon' className='size-8 rounded-lg' onClick={onZoomReset} title='Reset'>
									<RotateCw className='size-4' />
								</Button>
							</div>
						</div>
					</div>
				</div>

				<div 
					ref={gridScrollRef}
					className='flex-1 min-h-0 overflow-auto p-4' 
					style={{ touchAction: 'pan-x pan-y' }}
				>
					<div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '960px' }}>
						<div className='grid grid-cols-[100px_repeat(5,1fr)] gap-3'>
							<div className='px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>Time</div>
							{days.map((day) => (
								<div key={day} className='px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-center text-muted-foreground'>
									{day.slice(0, 3)}
								</div>
							))}
							
							{timeSlots.map((slot, slotIndex) => (
								<Fragment key={`slot-row-${slot.startTime}-${slot.endTime}-${slotIndex}`}>
									<div className='flex flex-col justify-center items-center rounded-2xl border border-border bg-muted/40 p-2 text-[10px] font-bold'>
										<span className='text-foreground'>{formatTime(slot.startTime)}</span>
										<span className='text-muted-foreground opacity-60'>{formatTime(slot.endTime)}</span>
									</div>
									
									{days.map((day) => {
										const key = slotKey(day, slot.startTime, slot.endTime);
										const cellEntries = globalBySlot.get(key) ?? [];
										const ownedEntries = cellEntries.filter((entry) => entry.owned);
										const nonOwnedEntries = cellEntries.filter((entry) => !entry.owned);
										const visibleEntries = showFullScheduleContext ? cellEntries : ownedEntries;
										
										const isOccupied = cellEntries.length > 0;
										const isHighCongestion = cellEntries.length > 2;
										const slotId = `slot-${day}-${slot.startTime}`;

										return (
											<button
												id={slotId}
												key={`${key}-${day}`}
												type='button'
												onClick={() => {
													onSelectTargetFromGrid({
														day,
														startTime: slot.startTime,
														endTime: slot.endTime,
														targetEntryId: nonOwnedEntries[0]?.entryId ?? cellEntries[0]?.entryId ?? null,
													});
												}}
												className={`group min-h-25 rounded-2xl border-2 p-2 text-left transition-all ${
													heatmapMode
														? isHighCongestion ? 'border-rose-200 bg-rose-50/50' : isOccupied ? 'border-amber-100 bg-amber-50/30' : 'border-emerald-100 bg-emerald-50/20'
														: 'border-border bg-background hover:border-primary/40'
												}`}
											>
												<div className='space-y-1.5'>
													{cellEntries.length === 0 && (
														<p className='text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity'>
															+ Move Here
														</p>
													)}
													
													{visibleEntries.map((entry) => {
														const isSourceSelected = selectedSourceEntryId === entry.entryId;
														return (
															<div
																key={entry.entryId}
																onClick={(event) => {
																	event.stopPropagation();
																	if (entry.owned) {
																		onSelectSourceEntry(entry.entryId);
																	} else {
																		onSelectTargetFromGrid({
																			day,
																			startTime: slot.startTime,
																			endTime: slot.endTime,
																			targetEntryId: entry.entryId,
																		});
																	}
																}}
																className={`rounded-xl border p-2 text-[10px] transition-all ${
																	entry.owned 
																		? isSourceSelected 
																			? 'border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/10' 
																			: 'border-primary/20 bg-primary/5 text-primary-foreground'
																		: 'border-border bg-muted/50 text-muted-foreground'
																}`}
															>
																<div className='flex justify-between items-start'>
																	<span className='font-bold'>{entry.subjectDisplayLabel ?? entry.subjectCode}</span>
																	{entry.owned && <div className='size-1.5 rounded-full bg-primary-foreground' />}
																</div>
																<p className='truncate mt-0.5 opacity-80'>{entry.sectionName}</p>
																<p className='mt-1 font-medium truncate'>{entry.roomName}</p>
															</div>
														);
													})}
												</div>
											</button>
										);
									})}
								</Fragment>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Right Column: Dynamic Request Builder Pane */}
			<div className='flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm'>
				<div className='border-b border-border px-6 py-4 bg-muted/30'>
					<h3 className='text-sm font-bold text-foreground'>Request Details</h3>
						<p className='text-xs text-muted-foreground mt-0.5'>Configure and review your room change.</p>
				</div>

				<div className='flex-1 overflow-auto p-6 space-y-6'>
					{/* Selection Area */}
					<div className='space-y-4'>
						<p className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>Selected Class</p>
						<div className='grid gap-3'>
							{entries.length === 0 ? (
								<div className='rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center'>
									<p className='text-sm font-bold text-foreground'>
										{teachingAssignments.length > 0 ? 'Classes not plotted for requests yet' : 'No teaching load linked yet'}
									</p>
									<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
										{teachingAssignments.length > 0
											? 'Your teaching load exists, but the review draft has not placed classes for room-request review yet.'
											: 'Ask the scheduling officer to check your teaching load before room requests open.'}
									</p>
								</div>
							) : entries.map((entry) => (
								<button
									key={entry.entryId}
									onClick={() => onSelectSourceEntry(entry.entryId)}
									className={`text-left p-4 rounded-2xl border-2 transition-all ${
										selectedSourceEntryId === entry.entryId 
											? 'border-primary bg-primary/5 shadow-sm' 
											: 'border-border hover:border-primary/20 bg-background'
									}`}
								>
									<div className='flex justify-between items-start gap-2'>
										<div className='min-w-0'>
											<p className='text-xs font-bold truncate'>{entry.subjectDisplayLabel ?? entry.subjectCode}</p>
											<p className='text-[11px] font-medium text-muted-foreground truncate'>{entry.sectionName}</p>
										</div>
										{renderStatusBadge(entry.status, entry.decisionStatus)}
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Room Search / Quick Pick */}
					<div className='space-y-4 pt-4 border-t border-border'>
						<div className='flex items-center justify-between'>
							<p className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>Available Rooms</p>
							<div className='flex items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1'>
								<Search className='size-3 text-muted-foreground' />
								<input 
									value={roomSearch}
									onChange={(e) => onRoomSearchChange(e.target.value)}
									placeholder='Filter...'
									className='bg-transparent border-0 text-[10px] focus:ring-0 w-20'
								/>
							</div>
						</div>
						
						<div className='grid gap-2 max-h-60 overflow-auto pr-2'>
							{filteredRooms.map((room) => (
								<button
									key={room.id}
									onClick={() => selectedEntry && onAssignRoomToEntry(selectedEntry.entryId, room.id)}
									className={`p-3 rounded-xl border transition-all text-left ${
										selectedEntry?.requestedRoomId === room.id 
											? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
											: 'border-border bg-background hover:bg-muted/30'
									}`}
								>
									<p className='text-xs font-bold'>{room.name}</p>
									<p className='text-[10px] text-muted-foreground'>{room.buildingName} â€¢ Floor {room.floor}</p>
								</button>
							))}
						</div>
					</div>

					{/* Rationale Area */}
					{selectedEntry && (
						<div className='space-y-4 pt-4 border-t border-border'>
							<p className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>Reason for Change</p>
							<Textarea
								value={selectedEntry.rationale ?? ''}
								onChange={(e) => onUpdateSelectedRationale(e.target.value)}
								placeholder='Add a note for the scheduling officer...'
								className='min-h-25 text-xs rounded-2xl p-4 bg-muted/10 border-border/50 resize-none focus:bg-background transition-colors'
							/>
						</div>
					)}
				</div>
				
				{/* Submit Preview Indicator */}
				{selectedEntry && (
					<div className='p-6 border-t border-border bg-muted/20'>
						<div className='flex items-center justify-between gap-4'>
							<div className='min-w-0'>
								<p className='text-[10px] font-bold text-muted-foreground uppercase'>Next Step</p>
								<p className='text-xs font-bold truncate'>Click target slot on grid</p>
							</div>
							<Badge variant='outline' className='bg-background'>Step 2/3</Badge>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
