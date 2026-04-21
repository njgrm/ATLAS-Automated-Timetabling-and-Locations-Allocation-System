import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
	AlertCircle,
	CheckCircle2,
	GripVertical,
	Loader2,
	MapPinned,
	Save,
	Search,
	Send,
	Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type {
	Building,
	FacultyMirror,
	FacultyRoomPreferenceEntry,
	FacultyRoomPreferenceState,
	Room,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';

const DEFAULT_SCHOOL_ID = 1;

type RoomOption = Room & { buildingName: string };

function statusBadge(status: RoomPreferenceStatus | null, decision: RoomPreferenceDecisionStatus | null) {
	if (decision === 'APPROVED') return <Badge variant='success'>Approved</Badge>;
	if (decision === 'REJECTED') return <Badge variant='warning'>Rejected</Badge>;
	if (status === 'SUBMITTED') return <Badge variant='secondary'>Submitted</Badge>;
	if (status === 'DRAFT') return <Badge variant='outline'>Draft</Badge>;
	return <Badge variant='secondary'>No request</Badge>;
}

function isEntryDirty(current: FacultyRoomPreferenceEntry, initial?: FacultyRoomPreferenceEntry) {
	return (initial?.requestedRoomId ?? null) !== (current.requestedRoomId ?? null)
		|| (initial?.rationale ?? '') !== (current.rationale ?? '');
}

function applyRoomSelection(entries: FacultyRoomPreferenceEntry[], entryId: string, room: RoomOption) {
	return entries.map((entry) => entry.entryId === entryId
		? {
			...entry,
			requestedRoomId: room.id,
			requestedRoomName: `${room.name} · ${room.buildingName}`,
		}
		: entry);
}

function DraggableEntryCard({
	entry,
	selected,
	onSelect,
}: {
	entry: FacultyRoomPreferenceEntry;
	selected: boolean;
	onSelect: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `entry-${entry.entryId}` });
	const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

	return (
		<button
			type='button'
			ref={setNodeRef}
			style={style}
			onClick={onSelect}
			className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'} ${isDragging ? 'opacity-60' : ''}`}
		>
			<div className='flex items-start gap-3'>
				<div
					className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground'
					{...attributes}
					{...listeners}
				>
					<GripVertical className='size-4' />
				</div>
				<div className='min-w-0 flex-1'>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='font-semibold text-foreground'>{entry.subjectCode}</p>
						{statusBadge(entry.status, entry.decisionStatus)}
					</div>
					<p className='mt-1 text-sm text-foreground'>{entry.sectionName}</p>
					<p className='mt-1 text-xs text-muted-foreground'>
						{entry.day.slice(0, 3)} • {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
					</p>
					<p className='mt-1 text-xs text-muted-foreground'>Current room: {entry.currentRoomName}</p>
					{entry.requestedRoomName && (
						<p className='mt-1 text-xs text-primary'>Requested: {entry.requestedRoomName}</p>
					)}
				</div>
			</div>
		</button>
	);
}

function DroppableRoomCard({
	room,
	active,
	onAssign,
}: {
	room: RoomOption;
	active: boolean;
	onAssign: () => void;
}) {
	const { isOver, setNodeRef } = useDroppable({ id: `room-${room.id}` });
	return (
		<button
			type='button'
			ref={setNodeRef}
			onClick={onAssign}
			className={`w-full rounded-xl border px-4 py-3 text-left transition ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'} ${isOver ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40'}`}
		>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<p className='font-semibold text-foreground'>{room.name}</p>
					<p className='mt-1 text-xs text-muted-foreground'>{room.buildingName} • Floor {room.floor}</p>
					<p className='mt-1 text-xs text-muted-foreground'>{room.type.replaceAll('_', ' ')}</p>
				</div>
				{room.capacity != null && <Badge variant='outline'>Cap {room.capacity}</Badge>}
			</div>
		</button>
	);
}

export default function FacultyRoomPreferences() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [facultyId, setFacultyId] = useState<number | null>(null);
	const [runId, setRunId] = useState<number | null>(null);
	const [runVersion, setRunVersion] = useState<number>(1);
	const [initialEntries, setInitialEntries] = useState<FacultyRoomPreferenceEntry[]>([]);
	const [entries, setEntries] = useState<FacultyRoomPreferenceEntry[]>([]);
	const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
	const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
	const [roomSearch, setRoomSearch] = useState('');
	const [rooms, setRooms] = useState<RoomOption[]>([]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor),
	);

	const applyServerState = useCallback((state: FacultyRoomPreferenceState) => {
		setRunId(state.runId);
		setRunVersion(state.runVersion);
		setInitialEntries(state.entries);
		setEntries(state.entries);
		setSelectedEntryId((current) => (current && state.entries.some((entry) => entry.entryId === current) ? current : state.entries[0]?.entryId ?? null));
	}, []);

	const loadBootstrap = useCallback(async () => {
		setLoading(true);
		try {
			const settings = await fetchPublicSettings();
			if (!settings.activeSchoolYearId) {
				setError('No active school year configured.');
				return;
			}
			setActiveSchoolYearId(settings.activeSchoolYearId);

			const { data: me } = await atlasApi.get<{ user: { userId: number } }>('/auth/me');
			const { data: facultyResponse } = await atlasApi.get<{ faculty: FacultyMirror[] }>('/faculty', { params: { schoolId: DEFAULT_SCHOOL_ID } });
			const facultyMatch = facultyResponse.faculty.find((item) => item.externalId === me.user.userId);
			if (!facultyMatch) {
				setError('Your account is not linked to a faculty record in this school.');
				return;
			}
			setFacultyId(facultyMatch.id);

			const [roomState, buildingsResponse] = await Promise.all([
				atlasApi.get<FacultyRoomPreferenceState>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${settings.activeSchoolYearId}/latest/faculty/${facultyMatch.id}`),
				atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			]);

			const nextRooms: RoomOption[] = [];
			for (const building of buildingsResponse.data.buildings) {
				for (const room of building.rooms ?? []) {
					if (!room.isTeachingSpace) continue;
					nextRooms.push({ ...room, buildingName: building.shortCode || building.name });
				}
			}
			nextRooms.sort((left, right) => left.name.localeCompare(right.name) || left.floor - right.floor);
			setRooms(nextRooms);
			applyServerState(roomState.data);
			setError(null);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setError(message ?? 'No completed timetable run is available for room requests yet.');
		} finally {
			setLoading(false);
		}
	}, [applyServerState]);

	useEffect(() => {
		void loadBootstrap();
	}, [loadBootstrap]);

	const initialMap = useMemo(() => new Map(initialEntries.map((entry) => [entry.entryId, entry])), [initialEntries]);
	const selectedEntry = entries.find((entry) => entry.entryId === selectedEntryId) ?? null;
	const draggedEntry = entries.find((entry) => entry.entryId === draggedEntryId) ?? null;
	const dirtyEntries = entries.filter((entry) => isEntryDirty(entry, initialMap.get(entry.entryId)));
	const filteredRooms = rooms.filter((room) => `${room.name} ${room.buildingName}`.toLowerCase().includes(roomSearch.toLowerCase()));
	const draftCount = entries.filter((entry) => entry.status === 'DRAFT').length;
	const submittedCount = entries.filter((entry) => entry.status === 'SUBMITTED').length;

	const assignRoomToEntry = useCallback((entryId: string, roomId: number) => {
		const room = rooms.find((item) => item.id === roomId);
		if (!room) return;
		setEntries((current) => applyRoomSelection(current, entryId, room));
		setSelectedEntryId(entryId);
	}, [rooms]);

	const handleDragStart = (event: DragStartEvent) => {
		const entryId = String(event.active.id).replace('entry-', '');
		setDraggedEntryId(entryId);
		setSelectedEntryId(entryId);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const activeId = String(event.active.id);
		const overId = event.over ? String(event.over.id) : null;
		setDraggedEntryId(null);
		if (!overId || !activeId.startsWith('entry-') || !overId.startsWith('room-')) return;
		assignRoomToEntry(activeId.replace('entry-', ''), Number(overId.replace('room-', '')));
	};

	const updateSelectedRationale = (nextValue: string) => {
		if (!selectedEntry) return;
		setEntries((current) => current.map((entry) => entry.entryId === selectedEntry.entryId ? { ...entry, rationale: nextValue } : entry));
	};

	const clearSelectedRequest = async () => {
		if (!selectedEntry || !runId || !activeSchoolYearId || !facultyId) return;
		if (!selectedEntry.requestId) {
			setEntries((current) => current.map((entry) => entry.entryId === selectedEntry.entryId ? { ...entry, requestedRoomId: null, requestedRoomName: null, rationale: '' } : entry));
			return;
		}
		try {
			const { data } = await atlasApi.delete<FacultyRoomPreferenceState>(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/entries/${selectedEntry.entryId}`,
				{ data: { requestVersion: selectedEntry.version } },
			);
			applyServerState(data);
			toast.success('Room request cleared.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to clear room request.');
		}
	};

	const saveDrafts = async () => {
		if (!runId || !activeSchoolYearId || !facultyId) return;
		const entriesToSave = entries.filter((entry) => {
			const initial = initialMap.get(entry.entryId);
			return entry.requestedRoomId != null && isEntryDirty(entry, initial);
		});
		if (entriesToSave.length === 0) {
			toast.info('No room changes to save.');
			return;
		}
		setSaving(true);
		try {
			let latestState: FacultyRoomPreferenceState | null = null;
			for (const entry of entriesToSave) {
				const { data } = await atlasApi.put<FacultyRoomPreferenceState>(
					`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/entries/${entry.entryId}/draft`,
					{
						requestedRoomId: entry.requestedRoomId,
						rationale: entry.rationale || null,
						expectedRunVersion: runVersion,
						requestVersion: entry.version,
					},
				);
				latestState = data;
			}
			if (latestState) applyServerState(latestState);
			toast.success(`Saved ${entriesToSave.length} room request${entriesToSave.length === 1 ? '' : 's'} as draft.`);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to save room request drafts.');
			void loadBootstrap();
		} finally {
			setSaving(false);
		}
	};

	const submitRequests = async () => {
		if (!runId || !activeSchoolYearId || !facultyId) return;
		const entriesToSubmit = entries.filter((entry) => entry.requestedRoomId != null && entry.decisionStatus !== 'APPROVED');
		if (entriesToSubmit.length === 0) {
			toast.info('Choose at least one room before submitting.');
			return;
		}
		setSubmitting(true);
		try {
			let latestState: FacultyRoomPreferenceState | null = null;
			for (const entry of entriesToSubmit) {
				const { data } = await atlasApi.post<FacultyRoomPreferenceState>(
					`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/entries/${entry.entryId}/submit`,
					{
						requestedRoomId: entry.requestedRoomId,
						rationale: entry.rationale || null,
						expectedRunVersion: runVersion,
						requestVersion: entry.version,
					},
				);
				latestState = data;
			}
			if (latestState) applyServerState(latestState);
			toast.success(`Submitted ${entriesToSubmit.length} room request${entriesToSubmit.length === 1 ? '' : 's'} for review.`);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to submit room requests.');
			void loadBootstrap();
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className='flex h-[calc(100svh-3.5rem)] flex-col px-6 py-6'>
				<div className='grid gap-3 md:grid-cols-[1.15fr_0.85fr]'>
					<Skeleton className='h-[72svh] rounded-2xl' />
					<Skeleton className='h-[72svh] rounded-2xl' />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-6'>
				<Card>
					<CardContent className='flex items-center gap-3 py-8'>
						<AlertCircle className='size-5 text-destructive shrink-0' />
						<div>
							<p className='font-medium text-destructive'>Cannot load room requests</p>
							<p className='text-sm text-muted-foreground mt-1'>{error}</p>
						</div>
						<Button variant='outline' size='sm' className='ml-auto' onClick={() => void loadBootstrap()}>
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
			<div className='flex h-[calc(100svh-3.5rem)] flex-col'>
				<div className='shrink-0 space-y-4 px-6 pt-6 pb-3'>
					<div className='flex flex-wrap items-center gap-3'>
						<div>
							<h1 className='text-2xl font-semibold tracking-tight'>Faculty Room Requests</h1>
							<p className='text-sm text-muted-foreground'>Drag a teaching session onto a room to stage a request, then save or submit it for review.</p>
						</div>
						<div className='ml-auto flex flex-wrap items-center gap-2'>
							<Button variant='outline' size='sm' onClick={() => void clearSelectedRequest()} disabled={!selectedEntry || saving || submitting}>
								<Trash2 className='mr-1.5 size-4' /> Clear
							</Button>
							<Button variant='outline' size='sm' onClick={() => void saveDrafts()} disabled={saving || submitting || dirtyEntries.length === 0}>
								{saving ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <Save className='mr-1.5 size-4' />} Save Draft
							</Button>
							<Button size='sm' onClick={() => void submitRequests()} disabled={submitting || entries.every((entry) => entry.requestedRoomId == null)}>
								{submitting ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <Send className='mr-1.5 size-4' />} Submit
							</Button>
						</div>
					</div>

					<div className='flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm'>
						<span className='font-medium text-foreground'>Run #{runId}</span>
						<span className='text-muted-foreground'>Version {runVersion}</span>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{entries.length} assigned sessions</span>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{draftCount} draft</span>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{submittedCount} submitted</span>
						{dirtyEntries.length > 0 && <Badge variant='warning'>{dirtyEntries.length} unsaved</Badge>}
					</div>
				</div>

				<div className='grid flex-1 min-h-0 gap-4 overflow-hidden px-6 pb-6 md:grid-cols-[1.08fr_0.92fr]'>
					<div className='flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card'>
						<div className='border-b border-border px-4 py-3'>
							<p className='text-sm font-semibold text-foreground'>Assigned Sessions</p>
							<p className='text-xs text-muted-foreground'>Pick a session, then drag it onto a room or click a room to assign it.</p>
						</div>
						<div className='flex-1 space-y-3 overflow-auto p-4'>
							{entries.map((entry) => (
								<DraggableEntryCard
									key={entry.entryId}
									entry={entry}
									selected={selectedEntryId === entry.entryId}
									onSelect={() => setSelectedEntryId(entry.entryId)}
								/>
							))}
						</div>
					</div>

					<div className='flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card'>
						<div className='space-y-4 border-b border-border px-4 py-4'>
							<div className='flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2'>
								<Search className='size-4 text-muted-foreground' />
								<Input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder='Filter rooms by name or building' className='border-0 bg-transparent px-0 shadow-none focus-visible:ring-0' />
							</div>

							{selectedEntry ? (
								<div className='space-y-3 rounded-xl border border-border bg-background p-4'>
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='outline'>{selectedEntry.subjectCode}</Badge>
										{statusBadge(selectedEntry.status, selectedEntry.decisionStatus)}
									</div>
									<div>
										<p className='font-semibold text-foreground'>{selectedEntry.sectionName}</p>
										<p className='text-xs text-muted-foreground'>{selectedEntry.day.slice(0, 3)} • {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)}</p>
									</div>
									<div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-2'>
										<div className='rounded-lg border border-border bg-card px-3 py-2'>Current: {selectedEntry.currentRoomName}</div>
										<div className='rounded-lg border border-border bg-card px-3 py-2'>Requested: {selectedEntry.requestedRoomName ?? 'None selected'}</div>
									</div>
									<Textarea value={selectedEntry.rationale ?? ''} onChange={(event) => updateSelectedRationale(event.target.value)} placeholder='Why does this room fit better for this session?' className='min-h-24' />
									{selectedEntry.reviewerNotes && (
										<div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>Reviewer note: {selectedEntry.reviewerNotes}</div>
									)}
								</div>
							) : (
								<div className='rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground'>Select a session to add rationale or clear its request.</div>
							)}
						</div>

						<div className='flex-1 space-y-3 overflow-auto p-4'>
							{filteredRooms.map((room) => (
								<DroppableRoomCard
									key={room.id}
									room={room}
									active={selectedEntry?.requestedRoomId === room.id}
									onAssign={() => selectedEntry && assignRoomToEntry(selectedEntry.entryId, room.id)}
								/>
							))}
							{filteredRooms.length === 0 && (
								<div className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>No rooms match this filter.</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<DragOverlay>
				<AnimatePresence>
					{draggedEntry && (
						<motion.div initial={{ opacity: 0.85, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
							<div className='w-72 rounded-xl border border-primary bg-card px-4 py-3 shadow-xl'>
								<p className='font-semibold text-foreground'>{draggedEntry.subjectCode}</p>
								<p className='text-sm text-muted-foreground'>{draggedEntry.sectionName}</p>
								<p className='mt-1 text-xs text-primary'>Drop onto a room to stage this request.</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</DragOverlay>
		</DndContext>
	);
}