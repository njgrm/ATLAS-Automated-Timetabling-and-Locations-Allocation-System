import { Fragment, type ReactNode } from 'react';
import { Move, RotateCw, ScanSearch, Search } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import type {
	DayOfWeek,
	FacultyGlobalDraftEntry,
	FacultyRoomPreferenceEntry,
	Room,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';

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
}: DesktopRoomRequestLayoutProps) {
	return (
		<div className='hidden flex-1 min-h-0 gap-4 overflow-hidden px-6 pb-6 lg:grid lg:grid-cols-[1.3fr_0.7fr]'>
			<div className='flex flex-col overflow-hidden rounded-2xl border border-border bg-card'>
				<div className='border-b border-border px-4 py-3' data-tutorial='target-slot-map'>
					<div className='flex items-center justify-between gap-2'>
						<div>
							<p className='text-sm font-semibold text-foreground'>Choose Your Target Time</p>
							<p className='text-xs text-muted-foreground'>
								{selectedSourceEntryId
									? 'Your class is selected. Click a time slot to continue.'
									: 'Start by selecting one of your classes in the panel on the right.'}
							</p>
							{!showFullScheduleContext && (
								<p className='mt-1 text-[11px] text-muted-foreground'>
									Showing the simple view first. Turn on full context if you want to inspect other classes.
								</p>
							)}
						</div>
						<div className='flex flex-wrap items-center gap-2'>
							<Button variant='outline' size='sm' onClick={onZoomOut}>
								<Move className='mr-1.5 size-4' /> Zoom out
							</Button>
							<Button variant='outline' size='sm' onClick={onZoomIn}>
								<ScanSearch className='mr-1.5 size-4' /> Zoom in
							</Button>
							<Button variant='outline' size='sm' onClick={onZoomReset}>
								<RotateCw className='mr-1.5 size-4' /> Reset
							</Button>
						</div>
					</div>
				</div>
				<div className='flex-1 min-h-0 overflow-auto px-3 py-3' style={{ touchAction: 'pan-x pan-y' }}>
					<div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '860px' }}>
						<div className='grid grid-cols-[9rem_repeat(5,minmax(10rem,1fr))] gap-2'>
							<div className='px-2 py-2 text-xs font-semibold text-muted-foreground'>Time</div>
							{days.map((day) => (
								<div key={day} className='px-2 py-2 text-xs font-semibold text-muted-foreground'>
									{day.slice(0, 3)}
								</div>
							))}
							{timeSlots.map((slot, slotIndex) => (
								<Fragment key={`slot-row-${slot.startTime}-${slot.endTime}-${slotIndex}`}>
									<div className='rounded-lg border border-border bg-muted/40 px-2 py-2 text-xs font-medium'>
										{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
									</div>
									{days.map((day) => {
										const key = slotKey(day, slot.startTime, slot.endTime);
										const cellEntries = globalBySlot.get(key) ?? [];
										const ownedEntries = cellEntries.filter((entry) => entry.owned);
										const nonOwnedEntries = cellEntries.filter((entry) => !entry.owned);
										const visibleEntries = showFullScheduleContext ? cellEntries : ownedEntries;
										const slotLive = slotSelectionDetails.get(key);
										const targetOccupant = nonOwnedEntries[0] ?? cellEntries[0] ?? null;
										return (
											<button
												key={`${key}-${day}`}
												type='button'
												onClick={() => {
													onSelectTargetFromGrid({
														day,
														startTime: slot.startTime,
														endTime: slot.endTime,
														targetEntryId: targetOccupant?.entryId ?? null,
													});
												}}
												className='min-h-24 rounded-lg border border-border bg-background p-2 text-left hover:border-primary/40'
											>
												{(selectionCountBySlot.get(key) ?? 0) > 0 && (
													<div className='mb-1 flex justify-end'>
														<Badge variant='outline'>Live {selectionCountBySlot.get(key)}</Badge>
													</div>
												)}
												{slotLive && (
													<p className='mb-1 text-[0.65rem] text-amber-700'>
														Viewing: {slotLive.actors.slice(0, 2).join(', ')}{slotLive.actors.length > 2 ? ` +${slotLive.actors.length - 2}` : ''}
													</p>
												)}
												<div className='space-y-1'>
													{cellEntries.length === 0 && <p className='text-[0.68rem] text-emerald-700'>Free slot - click to move here</p>}
													{!showFullScheduleContext && nonOwnedEntries.length > 0 && (
														<p className='text-[0.68rem] text-amber-700'>Occupied by another class - click to request a swap</p>
													)}
													{visibleEntries.map((entry) => {
														const ownedEntry = entry.owned;
														const sourceSelected = selectedSourceEntryId === entry.entryId;
														const entryLive = entrySelectionDetails.get(entry.entryId);
														return (
															<div
																key={entry.entryId}
																onClick={(event) => {
																	event.stopPropagation();
																	if (!ownedEntry && !selectedEntry) return;
																	if (ownedEntry) {
																		onSelectSourceEntry(entry.entryId);
																		return;
																	}
																	onSelectTargetFromGrid({
																		day,
																		startTime: slot.startTime,
																		endTime: slot.endTime,
																		targetEntryId: entry.entryId,
																	});
																}}
																className={`rounded-md border px-2 py-1 text-[0.68rem] ${ownedEntry ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'} ${sourceSelected ? 'ring-2 ring-primary/40' : ''} ${entryLive ? 'ring-2 ring-amber-300/80' : ''}`}
															>
																<p className='font-semibold'>{entry.subjectCode}</p>
																<p>{entry.sectionName}</p>
																{entryLive && (
																	<p className='mt-1 text-[0.62rem] text-amber-700'>
																		Focused by {entryLive.actors.slice(0, 2).join(', ')}{entryLive.actors.length > 2 ? ` +${entryLive.actors.length - 2}` : ''}
																	</p>
																)}
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

			<div className='flex flex-col overflow-hidden rounded-2xl border border-border bg-card'>
				<div className='space-y-3 border-b border-border px-4 py-4' data-tutorial='my-classes-panel'>
					<p className='text-sm font-semibold text-foreground'>Request Builder</p>
					<div className='flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2'>
						<Search className='size-4 text-muted-foreground' />
						<Input
							value={roomSearch}
							onChange={(event) => onRoomSearchChange(event.target.value)}
							placeholder='Search rooms by name or building...'
							className='border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
						/>
					</div>

					{selectedEntry ? (
						<div className='space-y-3 rounded-xl border border-border bg-background p-4'>
							<div className='flex flex-wrap items-center gap-2'>
								<Badge variant='outline'>{selectedEntry.subjectCode}</Badge>
								{renderStatusBadge(selectedEntry.status, selectedEntry.decisionStatus)}
							</div>
							<div>
								<p className='font-semibold text-foreground'>{selectedEntry.sectionName}</p>
								<p className='text-xs text-muted-foreground'>
									{selectedEntry.day.slice(0, 3)} - {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)}
								</p>
							</div>
							<div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-2'>
								<div className='rounded-lg border border-border bg-card px-3 py-2'>Current: {selectedEntry.currentRoomName}</div>
								<div className='rounded-lg border border-border bg-card px-3 py-2'>Requested: {selectedEntry.requestedRoomName ?? 'None selected'}</div>
							</div>
							<Textarea
								value={selectedEntry.rationale ?? ''}
								onChange={(event) => onUpdateSelectedRationale(event.target.value)}
								placeholder='Optional context for your next request.'
								className='min-h-24'
							/>
							{selectedEntry.reviewerNotes && (
								<div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
									Reviewer note: {selectedEntry.reviewerNotes}
								</div>
							)}
						</div>
					) : (
						<div className='rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground'>
							Select one of your classes, then click a target time on the left.
						</div>
					)}
				</div>

				<div className='flex-1 space-y-3 overflow-auto p-4'>
					{filteredRooms.map((room) => (
						<button
							type='button'
							key={room.id}
							onClick={() => selectedEntry && onAssignRoomToEntry(selectedEntry.entryId, room.id)}
							className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedEntry?.requestedRoomId === room.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
						>
							<div className='flex items-start justify-between gap-3'>
								<div>
									<p className='font-semibold text-foreground'>{room.name}</p>
									<p className='mt-1 text-xs text-muted-foreground'>
										{room.buildingName} - Floor {room.floor}
									</p>
								</div>
								{room.capacity != null && <Badge variant='outline'>Cap {room.capacity}</Badge>}
							</div>
						</button>
					))}
					{filteredRooms.length === 0 && (
						<div className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
							No rooms match this filter.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
