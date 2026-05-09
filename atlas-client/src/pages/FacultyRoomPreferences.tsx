import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	AlertCircle,
	Loader2,
	Move,
	RotateCw,
	ScanSearch,
	Send,
	Shuffle,
	TimerReset,
	Wifi,
	WifiOff,
	Search,
} from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import {
	clearOutboxActions,
	type RoomPreferenceActionType,
	listOutboxActions,
	replaceOutboxActions,
	type RoomPreferenceOutboxAction,
} from '@/lib/roomPreferenceOutbox';
import { fetchPublicSettings, fetchSchoolYears, type SchoolYear } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type {
	Building,
	DayOfWeek,
	FacultyGlobalDraftEntry,
	FacultyMirror,
	FacultyRoomPreferenceEntry,
	FacultyRoomPreferenceState,
	GenerationGateStatus,
	PreviewResult,
	Room,
	RoomPreferenceActionType as RequestActionType,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Separator } from '@/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';

const DEFAULT_SCHOOL_ID = 1;
const FALLBACK_SCHOOL_YEAR_ID = 1;

function resolveSchoolYearContext(settingsActiveSchoolYearId: number | null, years: SchoolYear[]) {
	if (settingsActiveSchoolYearId) {
		return {
			schoolYearId: settingsActiveSchoolYearId,
			notice: null as string | null,
		};
	}

	const sortedYears = [...years].sort((left, right) => right.id - left.id);
	const inferredActive = sortedYears.find((year) => year.isActive || year.status?.toUpperCase() === 'ACTIVE');
	if (inferredActive) {
		return {
			schoolYearId: inferredActive.id,
			notice: `No active school year was provided by public settings. Showing inferred active school year ${inferredActive.yearLabel}.`,
		};
	}

	if (sortedYears[0]) {
		return {
			schoolYearId: sortedYears[0].id,
			notice: `No active school year was provided by public settings. Showing latest available school year ${sortedYears[0].yearLabel}.`,
		};
	}

	return {
		schoolYearId: FALLBACK_SCHOOL_YEAR_ID,
		notice: 'No school year metadata was available. Showing fallback school year context.',
	};
}

type RoomOption = Room & { buildingName: string };

type SlotTarget = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	targetEntryId: string | null;
};

const ACTION_LABELS: Record<RequestActionType, string> = {
	ROOM_CHANGE: 'Room change only',
	MOVE_TO_EMPTY_SLOT: 'Move to empty slot',
	SWAP_WITH_OCCUPIED: 'Swap with occupied slot',
	TIME_AND_ROOM_CHANGE: 'Time + room change',
};

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

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

function slotKey(day: string, startTime: string, endTime: string) {
	return `${day}|${startTime}|${endTime}`;
}

export default function FacultyRoomPreferences() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [facultyId, setFacultyId] = useState<number | null>(null);
	const [runId, setRunId] = useState<number | null>(null);
	const [runVersion, setRunVersion] = useState<number>(1);
	const [runGeneratedAt, setRunGeneratedAt] = useState<string | null>(null);
	const [gate, setGate] = useState<GenerationGateStatus | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);
	const [outboxCount, setOutboxCount] = useState<number>(0);
	const [syncingOutbox, setSyncingOutbox] = useState(false);
	const [liveUpdateCount, setLiveUpdateCount] = useState(0);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [initialEntries, setInitialEntries] = useState<FacultyRoomPreferenceEntry[]>([]);
	const [entries, setEntries] = useState<FacultyRoomPreferenceEntry[]>([]);
	const [globalEntries, setGlobalEntries] = useState<FacultyGlobalDraftEntry[]>([]);
	const [selectedSourceEntryId, setSelectedSourceEntryId] = useState<string | null>(null);
	const [targetSlot, setTargetSlot] = useState<SlotTarget | null>(null);
	const [requestSheetOpen, setRequestSheetOpen] = useState(false);
	const [actionType, setActionType] = useState<RequestActionType>('MOVE_TO_EMPTY_SLOT');
	const [requestedRoomId, setRequestedRoomId] = useState<string>('');
	const [reason, setReason] = useState('');
	const [requestPreview, setRequestPreview] = useState<PreviewResult | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [roomSearch, setRoomSearch] = useState('');
	const [rooms, setRooms] = useState<RoomOption[]>([]);
	const lastEventIdRef = useRef<number>(0);

	const applyServerState = useCallback((state: FacultyRoomPreferenceState) => {
		setRunId(state.runId);
		setRunVersion(state.runVersion);
		setRunGeneratedAt(state.runGeneratedAt);
		setInitialEntries(state.entries);
		setEntries(state.entries);
		setGlobalEntries(state.globalEntries ?? []);
		setSelectedSourceEntryId((current) => (current && state.entries.some((entry) => entry.entryId === current) ? current : state.entries[0]?.entryId ?? null));
	}, []);

	const loadBootstrap = useCallback(async () => {
		setLoading(true);
		try {
			const [settings, years] = await Promise.all([fetchPublicSettings(), fetchSchoolYears()]);
			const schoolYearContext = resolveSchoolYearContext(settings.activeSchoolYearId, years);
			const schoolYearId = schoolYearContext.schoolYearId;
			setActiveSchoolYearId(schoolYearId);
			setSchoolYearNotice(schoolYearContext.notice);

			const { data: facultyMe } = await atlasApi.get<{ faculty: FacultyMirror }>(`/faculty/me`, {
				params: { schoolId: DEFAULT_SCHOOL_ID },
			});
			const facultyMatch = facultyMe.faculty;
			if (!facultyMatch?.id) {
				setError('Your account is not linked to a faculty record in this school.');
				return;
			}
			setFacultyId(facultyMatch.id);

			const [roomState, buildingsResponse, gateResponse] = await Promise.all([
				atlasApi.get<FacultyRoomPreferenceState>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/latest/faculty/${facultyMatch.id}`),
				atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
				atlasApi.get<GenerationGateStatus>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/gate`).catch(() => ({
					data: { blocked: false, openCount: 0, runId: null } as GenerationGateStatus,
				})),
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
			setGate(gateResponse.data ?? null);
			setError(null);
		} catch (err) {
			const responseData = (err as { response?: { data?: { code?: string; message?: string; actionHint?: string } } })?.response?.data;
			const noDraftMessage = responseData?.code === 'NO_ACTIVE_DRAFT'
				? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
				: null;
			const staleMessage = responseData?.code === 'STALE_RUN_DATA'
				? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
				: null;
			setError(noDraftMessage ?? staleMessage ?? responseData?.message ?? 'No active draft run is available for room requests yet.');
		} finally {
			setLoading(false);
		}
	}, [applyServerState]);

	useEffect(() => {
		void loadBootstrap();
	}, [loadBootstrap]);

	const flushOutbox = useCallback(async () => {
		if (!online || !runId || !activeSchoolYearId || !facultyId) return;
		const queued = listOutboxActions(facultyId, runId);
		if (queued.length === 0) {
			setOutboxCount(0);
			return;
		}

		setSyncingOutbox(true);
		try {
			const { data } = await atlasApi.post<{
				results: Array<{ actionId: string; ok: boolean; error?: { message: string } }>;
				state: FacultyRoomPreferenceState;
			}>(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/sync`,
				{ actions: queued.map(({ queuedAt, ...action }) => action) },
			);

			const failed = new Set(data.results.filter((item) => !item.ok).map((item) => item.actionId));
			if (failed.size > 0) {
				replaceOutboxActions(facultyId, runId, queued.filter((item) => failed.has(item.actionId)));
				setOutboxCount(failed.size);
				toast.error(`${failed.size} queued action(s) need retry.`);
			} else {
				clearOutboxActions(facultyId, runId);
				setOutboxCount(0);
				toast.success('Offline room-request actions were synced.');
			}

			applyServerState(data.state);
		} catch {
			setOutboxCount(queued.length);
			toast.error('Unable to sync queued room-request actions.');
		} finally {
			setSyncingOutbox(false);
		}
	}, [activeSchoolYearId, applyServerState, facultyId, online, runId]);

	useEffect(() => {
		const updateOnline = () => setOnline(navigator.onLine);
		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		return () => {
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
		};
	}, []);

	useEffect(() => {
		void flushOutbox();
	}, [flushOutbox, online]);

	useEffect(() => {
		if (!runId || !facultyId) return;
		setOutboxCount(listOutboxActions(facultyId, runId).length);
	}, [facultyId, runId]);

	useEffect(() => {
		if (!activeSchoolYearId) return;
		const token = getPreferredAccessToken();
		if (!token) return;

		const streamUrl = `${import.meta.env.VITE_ATLAS_API ?? '/api/v1'}/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/events?accessToken=${encodeURIComponent(token)}`;
		const source = new EventSource(streamUrl);

		source.onmessage = () => {
			// No default events are emitted; typed events are used below.
		};

		const handleEvent = (event: MessageEvent<string>) => {
			try {
				const payload = JSON.parse(event.data) as { id: number; facultyId: number | null; type?: string; message?: string };
				if (payload.id) {
					lastEventIdRef.current = payload.id;
				}
				if (facultyId && payload.facultyId != null && payload.facultyId !== facultyId) {
					return;
				}
				setLiveUpdateCount((count) => count + 1);
				if (payload.message) {
					toast.info(payload.message);
				}
				void loadBootstrap();
			} catch {
				void loadBootstrap();
			}
		};

		source.addEventListener('ROOM_REQUEST_DRAFT_SAVED', handleEvent as EventListener);
		source.addEventListener('ROOM_REQUEST_SUBMITTED', handleEvent as EventListener);
		source.addEventListener('ROOM_REQUEST_DELETED', handleEvent as EventListener);
		source.addEventListener('ROOM_REQUEST_REVIEWED', handleEvent as EventListener);

		return () => {
			source.close();
		};
	}, [activeSchoolYearId, facultyId, loadBootstrap]);

	const initialMap = useMemo(() => new Map(initialEntries.map((entry) => [entry.entryId, entry])), [initialEntries]);
	const selectedEntry = entries.find((entry) => entry.entryId === selectedSourceEntryId) ?? null;
	const dirtyEntries = entries.filter((entry) => isEntryDirty(entry, initialMap.get(entry.entryId)));
	const filteredRooms = rooms.filter((room) => `${room.name} ${room.buildingName}`.toLowerCase().includes(roomSearch.toLowerCase()));
	const draftCount = entries.filter((entry) => entry.status === 'DRAFT').length;
	const submittedCount = entries.filter((entry) => entry.status === 'SUBMITTED').length;
	const timeSlots = useMemo(() => {
		const unique = new Map<string, { startTime: string; endTime: string }>();
		for (const entry of globalEntries) {
			unique.set(slotKey(entry.day, entry.startTime, entry.endTime), { startTime: entry.startTime, endTime: entry.endTime });
		}
		return [...unique.values()].sort((left, right) => left.startTime.localeCompare(right.startTime));
	}, [globalEntries]);
	const globalBySlot = useMemo(() => {
		const map = new Map<string, FacultyGlobalDraftEntry[]>();
		for (const entry of globalEntries) {
			const key = slotKey(entry.day, entry.startTime, entry.endTime);
			const rows = map.get(key) ?? [];
			rows.push(entry);
			map.set(key, rows);
		}
		for (const rows of map.values()) {
			rows.sort((left, right) => Number(right.owned) - Number(left.owned) || left.sectionName.localeCompare(right.sectionName));
		}
		return map;
	}, [globalEntries]);

	const assignRoomToEntry = useCallback((entryId: string, roomId: number) => {
		const room = rooms.find((item) => item.id === roomId);
		if (!room) return;
		setEntries((current) => applyRoomSelection(current, entryId, room));
		setSelectedSourceEntryId(entryId);
	}, [rooms]);

	const updateSelectedRationale = (nextValue: string) => {
		if (!selectedEntry) return;
		setEntries((current) => current.map((entry) => entry.entryId === selectedEntry.entryId ? { ...entry, rationale: nextValue } : entry));
	};

	const openRequestSheet = useCallback((slot: SlotTarget) => {
		if (!selectedEntry) {
			toast.info('Select one of your own sessions first.');
			return;
		}
		setTargetSlot(slot);
		setActionType(slot.targetEntryId ? 'SWAP_WITH_OCCUPIED' : 'MOVE_TO_EMPTY_SLOT');
		setRequestedRoomId(String(selectedEntry.currentRoomId));
		setReason(selectedEntry.rationale ?? '');
		setRequestPreview(null);
		setRequestSheetOpen(true);
	}, [selectedEntry]);

	useEffect(() => {
		if (!requestSheetOpen || !selectedEntry || !targetSlot || !runId || !activeSchoolYearId || !facultyId) return;
		const roomId = requestedRoomId ? Number(requestedRoomId) : undefined;
		if ((actionType === 'ROOM_CHANGE' || actionType === 'TIME_AND_ROOM_CHANGE') && !roomId) return;

		const runPreview = async () => {
			setPreviewLoading(true);
			try {
				const { data } = await atlasApi.post<{ preview: PreviewResult }>(
					`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/entries/${selectedEntry.entryId}/preview`,
					{
						actionType,
						requestedRoomId: roomId,
						targetDay: targetSlot.day,
						targetStartTime: targetSlot.startTime,
						targetEndTime: targetSlot.endTime,
						targetEntryId: targetSlot.targetEntryId,
						expectedRunVersion: runVersion,
					},
				);
				setRequestPreview(data.preview);
			} catch {
				setRequestPreview(null);
			} finally {
				setPreviewLoading(false);
			}
		};

		void runPreview();
	}, [requestSheetOpen, selectedEntry, targetSlot, runId, activeSchoolYearId, facultyId, actionType, requestedRoomId, runVersion]);

	const submitCurrentRequest = async () => {
		if (!selectedEntry || !targetSlot || !runId || !activeSchoolYearId || !facultyId) return;
		const roomId = requestedRoomId ? Number(requestedRoomId) : undefined;
		if ((actionType === 'ROOM_CHANGE' || actionType === 'TIME_AND_ROOM_CHANGE') && !roomId) {
			toast.error('Select a room for this request type.');
			return;
		}
		const swapNeedsReason = actionType === 'SWAP_WITH_OCCUPIED' && (requestPreview?.hardViolations.length ?? 0) > 0;
		if (swapNeedsReason && !reason.trim()) {
			toast.error('A reason is required for conflict-causing swap requests.');
			return;
		}

		const payload = {
			actionType,
			requestedRoomId: roomId,
			targetDay: targetSlot.day,
			targetStartTime: targetSlot.startTime,
			targetEndTime: targetSlot.endTime,
			targetEntryId: targetSlot.targetEntryId,
			rationale: reason.trim() || null,
			expectedRunVersion: runVersion,
			requestVersion: selectedEntry.version,
		};

		if (!online) {
			enqueueOutboxAction(facultyId, runId, {
				actionId: `submit-${selectedEntry.entryId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				type: 'SUBMIT',
				entryId: selectedEntry.entryId,
				...payload,
			});
			setOutboxCount((count) => count + 1);
			toast.info('Waiting for connection before submitting.');
			setRequestSheetOpen(false);
			return;
		}

		setSubmitting(true);
		try {
			const { data } = await atlasApi.post<FacultyRoomPreferenceState>(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/entries/${selectedEntry.entryId}/submit`,
				payload,
			);
			applyServerState(data);
			setRequestSheetOpen(false);
			toast.success('Request submitted for scheduler decision.');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to submit request.');
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
		<div className='flex h-[calc(100svh-3.5rem)] flex-col'>
				<div className='shrink-0 space-y-4 px-6 pt-6 pb-3'>
					{schoolYearNotice && (
						<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
							{schoolYearNotice}
						</div>
					)}

					<div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
						{online ? <Wifi className='size-4' /> : <WifiOff className='size-4' />}
						<span className='font-semibold'>{online ? 'Online' : 'Offline mode'}</span>
						{outboxCount > 0 && (
							<>
								<span>•</span>
								<span>{outboxCount} queued action(s)</span>
								{syncingOutbox && <span>• syncing...</span>}
							</>
						)}
						{liveUpdateCount > 0 && (
							<>
								<span>•</span>
								<span>{liveUpdateCount} live update(s)</span>
							</>
						)}
					</div>

					<div className='flex flex-wrap items-center gap-3'>
						<div>
							<h1 className='text-2xl font-semibold tracking-tight'>Faculty Room Requests</h1>
							<p className='text-sm text-muted-foreground'>Tap one of your sessions, then tap a target slot to open the request sheet with conflict inspection.</p>
						</div>
						<div className='ml-auto flex flex-wrap items-center gap-2'>
							<Button variant='outline' size='sm' onClick={() => setZoom((current) => Math.max(0.7, Number((current - 0.1).toFixed(2))))}>
								<Move className='mr-1.5 size-4' /> Zoom out
							</Button>
							<Button variant='outline' size='sm' onClick={() => setZoom((current) => Math.min(1.5, Number((current + 0.1).toFixed(2))))}>
								<ScanSearch className='mr-1.5 size-4' /> Zoom in
							</Button>
							<Button variant='outline' size='sm' onClick={() => setZoom(1)}>
								<RotateCw className='mr-1.5 size-4' /> Reset
							</Button>
						</div>
					</div>

					<div className='flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm'>
						<span className='font-medium text-foreground'>Run #{runId}</span>
						<span className='text-muted-foreground'>Version {runVersion}</span>
						{runGeneratedAt && (
							<>
								<span className='text-border/60'>•</span>
								<span className='text-muted-foreground'>Generated {new Date(runGeneratedAt).toLocaleString()}</span>
							</>
						)}
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{entries.length} assigned sessions</span>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{draftCount} draft</span>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{submittedCount} submitted</span>
						{gate?.blocked && (
							<Badge variant='warning'>Generation blocked: {gate.openCount} undecided request(s)</Badge>
						)}
						{dirtyEntries.length > 0 && <Badge variant='warning'>{dirtyEntries.length} unsaved</Badge>}
					</div>
				</div>

				<div className='grid flex-1 min-h-0 gap-4 overflow-hidden px-6 pb-6 lg:grid-cols-[1.3fr_0.7fr]'>
					<div className='flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card'>
						<div className='border-b border-border px-4 py-3'>
							<p className='text-sm font-semibold text-foreground'>Active Draft Schedule</p>
							<p className='text-xs text-muted-foreground'>Owned sessions are selectable as source. Non-owned sessions are read-only and can be swap targets.</p>
						</div>
						<div className='flex-1 min-h-0 overflow-auto px-3 py-3' style={{ touchAction: 'pan-x pan-y' }}>
							<div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '860px' }}>
								<div className='grid grid-cols-[9rem_repeat(5,minmax(10rem,1fr))] gap-2'>
									<div className='text-xs font-semibold text-muted-foreground px-2 py-2'>Time</div>
									{DAYS.map((day) => (
										<div key={day} className='text-xs font-semibold text-muted-foreground px-2 py-2'>{day.slice(0, 3)}</div>
									))}
									{timeSlots.map((slot) => (
										<>
											<div key={`slot-${slot.startTime}-${slot.endTime}`} className='rounded-lg border border-border bg-muted/40 px-2 py-2 text-xs font-medium'>
												{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
											</div>
											{DAYS.map((day) => {
												const key = slotKey(day, slot.startTime, slot.endTime);
												const cellEntries = globalBySlot.get(key) ?? [];
												return (
													<button
														key={`${key}-${day}`}
														type='button'
														onClick={() => {
															const occupied = cellEntries[0] ?? null;
															openRequestSheet({
																day,
																startTime: slot.startTime,
																endTime: slot.endTime,
																targetEntryId: occupied?.entryId ?? null,
															});
														}}
														className='min-h-24 rounded-lg border border-border bg-background p-2 text-left hover:border-primary/40'
													>
														<div className='space-y-1'>
															{cellEntries.length === 0 && <p className='text-[0.68rem] text-muted-foreground'>Empty slot</p>}
															{cellEntries.map((entry) => {
																const ownedEntry = entry.owned;
																const sourceSelected = selectedSourceEntryId === entry.entryId;
																return (
																	<div
																		key={entry.entryId}
																		onClick={(event) => {
																			event.stopPropagation();
																			if (!ownedEntry && !selectedEntry) return;
																			if (ownedEntry) {
																				setSelectedSourceEntryId(entry.entryId);
																				return;
																			}
																			openRequestSheet({ day, startTime: slot.startTime, endTime: slot.endTime, targetEntryId: entry.entryId });
																		}}
																		className={`rounded-md border px-2 py-1 text-[0.68rem] ${ownedEntry ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'} ${sourceSelected ? 'ring-2 ring-primary/40' : ''}`}
																	>
																		<p className='font-semibold'>{entry.subjectCode}</p>
																		<p>{entry.sectionName}</p>
																	</div>
																);
															})}
														</div>
													</button>
												);
											})}
										</>
									))}
								</div>
							</div>
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
									<Textarea value={selectedEntry.rationale ?? ''} onChange={(event) => updateSelectedRationale(event.target.value)} placeholder='Optional context for your next request.' className='min-h-24' />
									{selectedEntry.reviewerNotes && (
										<div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>Reviewer note: {selectedEntry.reviewerNotes}</div>
									)}
								</div>
							) : (
								<div className='rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground'>Tap one of your sessions from the grid to set your source.</div>
							)}
						</div>

						<div className='flex-1 space-y-3 overflow-auto p-4'>
							{filteredRooms.map((room) => (
								<button
									type='button'
									key={room.id}
									onClick={() => selectedEntry && assignRoomToEntry(selectedEntry.entryId, room.id)}
									className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedEntry?.requestedRoomId === room.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
								>
									<div className='flex items-start justify-between gap-3'>
										<div>
											<p className='font-semibold text-foreground'>{room.name}</p>
											<p className='mt-1 text-xs text-muted-foreground'>{room.buildingName} • Floor {room.floor}</p>
										</div>
										{room.capacity != null && <Badge variant='outline'>Cap {room.capacity}</Badge>}
									</div>
								</button>
							))}
							{filteredRooms.length === 0 && (
								<div className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>No rooms match this filter.</div>
							)}
						</div>
					</div>
				</div>

			<Sheet open={requestSheetOpen} onOpenChange={setRequestSheetOpen}>
				<SheetContent side='bottom' className='h-[88svh] overflow-auto rounded-t-2xl'>
					<SheetHeader>
						<SheetTitle>Request Change on Active Draft</SheetTitle>
						<SheetDescription>Conflict inspector uses the same pre-generation semantics as scheduler preview.</SheetDescription>
					</SheetHeader>

					<div className='mt-4 space-y-4'>
						<div className='grid gap-3 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Action type</Label>
								<Select value={actionType} onValueChange={(value) => setActionType(value as RequestActionType)}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value='MOVE_TO_EMPTY_SLOT'><Move className='mr-2 inline size-4' />Move to empty slot</SelectItem>
										<SelectItem value='SWAP_WITH_OCCUPIED'><Shuffle className='mr-2 inline size-4' />Swap with occupied slot</SelectItem>
										<SelectItem value='ROOM_CHANGE'><TimerReset className='mr-2 inline size-4' />Room change</SelectItem>
										<SelectItem value='TIME_AND_ROOM_CHANGE'><Send className='mr-2 inline size-4' />Time + room change</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className='space-y-2'>
								<Label>Target room</Label>
								<Select value={requestedRoomId} onValueChange={setRequestedRoomId}>
									<SelectTrigger><SelectValue placeholder='Keep current room' /></SelectTrigger>
									<SelectContent>
										{filteredRooms.map((room) => (
											<SelectItem key={room.id} value={String(room.id)}>{room.name} · {room.buildingName}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className='rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground'>
							{targetSlot
								? `Target slot: ${targetSlot.day.slice(0, 3)} ${formatTime(targetSlot.startTime)} - ${formatTime(targetSlot.endTime)} ${targetSlot.targetEntryId ? '(occupied)' : '(empty)'}`
								: 'Select a target slot from the schedule grid.'}
						</div>

						<Textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder='Reason for this request (required only for conflict-causing swaps).'
							className='min-h-24'
						/>

						<Separator />

						<div className='space-y-2'>
							<p className='text-sm font-semibold'>Conflict inspector</p>
							{previewLoading && <p className='text-xs text-muted-foreground'>Loading conflict analysis...</p>}
							{!previewLoading && requestPreview && (
								<>
									<div className='flex flex-wrap items-center gap-2 text-xs'>
										<Badge variant={requestPreview.hardViolations.length > 0 ? 'warning' : 'success'}>Hard: {requestPreview.hardViolations.length}</Badge>
										<Badge variant='outline'>Soft: {requestPreview.softViolations.length}</Badge>
										<Badge variant='outline'>Allowed: {requestPreview.allowed ? 'Yes' : 'No'}</Badge>
									</div>
									<div className='space-y-2'>
										{requestPreview.humanConflicts.length === 0 && <p className='text-xs text-muted-foreground'>No conflicts detected.</p>}
										{requestPreview.humanConflicts.map((conflict) => (
											<div key={`${conflict.code}-${conflict.humanTitle}`} className='rounded-lg border border-border bg-background p-2'>
												<p className='text-xs font-semibold'>{conflict.humanTitle}</p>
												<p className='mt-1 text-xs text-muted-foreground'>{conflict.humanDetail}</p>
											</div>
										))}
									</div>
								</>
							)}
						</div>

						<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
							Soft policy conflicts are warnings only. Hard conflicts route through scheduler decision workflow.
						</div>

						<div className='flex justify-end gap-2'>
							<Button variant='outline' onClick={() => setRequestSheetOpen(false)}>Cancel</Button>
							<Button
								onClick={() => void submitCurrentRequest()}
								disabled={submitting || !selectedEntry || !targetSlot || (actionType === 'SWAP_WITH_OCCUPIED' && (requestPreview?.hardViolations.length ?? 0) > 0 && !reason.trim())}
							>
								{submitting ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <Send className='mr-1.5 size-4' />}
								Submit request
							</Button>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}