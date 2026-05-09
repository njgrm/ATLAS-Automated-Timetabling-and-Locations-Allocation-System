import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { createRoomPreferenceCollaborationSocket } from '@/lib/roomPreferenceCollaboration';
import {
	clearOutboxActions,
	enqueueOutboxAction,
	type OutboxActionStatus,
	type RoomPreferenceActionType,
	listOutboxActions,
	replaceOutboxActions,
	type RoomPreferenceOutboxAction,
} from '@/lib/roomPreferenceOutbox';
import { fetchPublicSettings, fetchSchoolYears, type SchoolYear } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type {
	Building,
	CollaborationPresence,
	CollaborationSelection,
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

type OutboxSyncFeedback = {
	actionId: string;
	status: 'SYNCED' | 'FAILED';
	message: string;
	at: string;
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
	if (decision === 'REJECTED') return <Badge variant='destructive'>Rejected</Badge>;
	if (status === 'SUBMITTED') return <Badge variant='default'>Pending review</Badge>;
	if (status === 'DRAFT') return <Badge variant='secondary'>Draft (not submitted)</Badge>;
	return <Badge variant='outline'>No request</Badge>;
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
	const [outboxActions, setOutboxActions] = useState<RoomPreferenceOutboxAction[]>([]);
	const [syncingOutbox, setSyncingOutbox] = useState(false);
	const [outboxFeedback, setOutboxFeedback] = useState<OutboxSyncFeedback[]>([]);
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
	const [presence, setPresence] = useState<CollaborationPresence[]>([]);
	const [remoteSelections, setRemoteSelections] = useState<Record<string, CollaborationSelection>>({});
	const [collaborationConnected, setCollaborationConnected] = useState(false);
	const [collaborationLastError, setCollaborationLastError] = useState<string | null>(null);
	const lastEventIdRef = useRef<number>(0);
	const collaborationRef = useRef<ReturnType<typeof createRoomPreferenceCollaborationSocket> | null>(null);
	const selfConnectionIdRef = useRef<string | null>(null);

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
		setOutboxActions(queued);
		if (queued.length === 0) {
			setOutboxCount(0);
			return;
		}

		setSyncingOutbox(true);
		const attemptAt = new Date().toISOString();
		const syncingActions = queued.map((action) => ({
			...action,
			status: action.status === 'failed' ? action.status : 'syncing',
			lastAttemptAt: attemptAt,
		}));
		replaceOutboxActions(facultyId, runId, syncingActions);
		setOutboxActions(syncingActions);
		try {
			const { data } = await atlasApi.post<{
				results: Array<{ actionId: string; ok: boolean; error?: { message: string } }>;
				state: FacultyRoomPreferenceState;
			}>(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${runId}/faculty/${facultyId}/sync`,
				{ actions: syncingActions.map(({ queuedAt, ...action }) => action) },
			);

			const resultByAction = new Map(data.results.map((item) => [item.actionId, item]));
			const feedback: OutboxSyncFeedback[] = [];
			const remaining = syncingActions.flatMap((action) => {
				const result = resultByAction.get(action.actionId);
				if (result?.ok) {
					feedback.push({
						actionId: action.actionId,
						status: 'SYNCED',
						message: 'Synced successfully.',
						at: attemptAt,
					});
					return [];
				}

				const nextRetryCount = action.retryCount + 1;
				const nextStatus: OutboxActionStatus = nextRetryCount >= 5 ? 'failed' : 'queued';
				feedback.push({
					actionId: action.actionId,
					status: 'FAILED',
					message: result?.error?.message ?? 'Sync failed. Retry is required.',
					at: attemptAt,
				});

				return [{
					...action,
					retryCount: nextRetryCount,
					status: nextStatus,
					lastAttemptAt: attemptAt,
				}];
			});

			replaceOutboxActions(facultyId, runId, remaining);
			setOutboxActions(remaining);
			setOutboxCount(remaining.length);
			setOutboxFeedback((current) => [...feedback, ...current].slice(0, 12));

			if (remaining.some((action) => action.status === 'failed')) {
				toast.error('Some queued actions reached retry limits. Use Retry Failed to sync again.');
			} else if (remaining.length > 0) {
				toast.error(`${remaining.length} queued action(s) still pending sync.`);
			} else {
				clearOutboxActions(facultyId, runId);
				toast.success('Offline room-request actions were synced.');
			}

			applyServerState(data.state);
		} catch {
			const failedRetry = syncingActions.map((action) => ({
				...action,
				retryCount: action.retryCount + 1,
				status: action.retryCount + 1 >= 5 ? 'failed' : 'queued',
				lastAttemptAt: attemptAt,
			}));
			replaceOutboxActions(facultyId, runId, failedRetry);
			setOutboxActions(failedRetry);
			setOutboxCount(failedRetry.length);
			toast.error('Unable to sync queued room-request actions.');
		} finally {
			setSyncingOutbox(false);
		}
	}, [activeSchoolYearId, applyServerState, facultyId, online, runId]);

	const retryFailedOutboxActions = useCallback(() => {
		if (!facultyId || !runId) return;
		const queued = listOutboxActions(facultyId, runId);
		const retriable = queued.map((action) => (action.status === 'failed'
			? { ...action, status: 'queued' as OutboxActionStatus, lastAttemptAt: null }
			: action));
		replaceOutboxActions(facultyId, runId, retriable);
		setOutboxActions(retriable);
		setOutboxCount(retriable.length);
		if (online) {
			void flushOutbox();
		}
	}, [facultyId, flushOutbox, online, runId]);

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
		const actions = listOutboxActions(facultyId, runId);
		setOutboxActions(actions);
		setOutboxCount(actions.length);
	}, [facultyId, runId]);

	useEffect(() => {
		if (!activeSchoolYearId || !runId || !online) return;
		const token = getPreferredAccessToken();
		if (!token) return;

		const socket = createRoomPreferenceCollaborationSocket({
			accessToken: token,
			onEvent: (event) => {
				if (event.type === 'connected') {
					selfConnectionIdRef.current = event.payload.connectionId;
					setCollaborationLastError(null);
					return;
				}
				if (event.type === 'open') {
					setCollaborationConnected(true);
					setCollaborationLastError(null);
					socket.join({
						schoolId: DEFAULT_SCHOOL_ID,
						schoolYearId: activeSchoolYearId,
						runId,
						viewMode: 'FACULTY_ACTIVE_DRAFT',
					});
					return;
				}
				if (event.type === 'snapshot') {
					const selfId = selfConnectionIdRef.current;
					setPresence(event.payload.presence.filter((item) => item.connectionId !== selfId));
					setRemoteSelections({});
					return;
				}
				if (event.type === 'presence-upsert') {
					if (event.payload.connectionId === selfConnectionIdRef.current) return;
					setPresence((current) => {
						const next = current.filter((item) => item.connectionId !== event.payload.connectionId);
						next.push(event.payload);
						return next;
					});
					return;
				}
				if (event.type === 'presence-leave') {
					setPresence((current) => current.filter((item) => item.connectionId !== event.payload.connectionId));
					setRemoteSelections((current) => {
						const next = { ...current };
						delete next[event.payload.connectionId];
						return next;
					});
					return;
				}
				if (event.type === 'selection') {
					if (event.payload.presence.connectionId === selfConnectionIdRef.current) return;
					setRemoteSelections((current) => ({
						...current,
						[event.payload.presence.connectionId]: event.payload.selection,
					}));
					return;
				}
				if (event.type === 'room-request-event') {
					setLiveUpdateCount((count) => count + 1);
					void loadBootstrap();
					return;
				}
				if (event.type === 'error') {
					setCollaborationLastError(event.payload.message);
					toast.error(event.payload.message);
					return;
				}
				if (event.type === 'close') {
					setCollaborationConnected(false);
				}
			},
		});

		collaborationRef.current = socket;

		return () => {
			socket.close();
			if (collaborationRef.current === socket) {
				collaborationRef.current = null;
			}
			setCollaborationConnected(false);
			setPresence([]);
			setRemoteSelections({});
		};
	}, [activeSchoolYearId, loadBootstrap, online, runId]);

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
	const compactPresence = useMemo(() => {
		const sorted = [...presence].sort((left, right) => right.lastActive.localeCompare(left.lastActive));
		return {
			visible: sorted.slice(0, 3),
			hiddenCount: Math.max(0, sorted.length - 3),
		};
	}, [presence]);
	const presenceByConnection = useMemo(() => {
		return new Map(presence.map((person) => [person.connectionId, person]));
	}, [presence]);
	const selectionCountBySlot = useMemo(() => {
		const counts = new Map<string, number>();
		for (const selection of Object.values(remoteSelections)) {
			if (!selection.day || !selection.startTime || !selection.endTime) continue;
			const key = slotKey(selection.day, selection.startTime, selection.endTime);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	}, [remoteSelections]);
	const slotSelectionDetails = useMemo(() => {
		const details = new Map<string, { count: number; actors: string[] }>();
		for (const [connectionId, selection] of Object.entries(remoteSelections)) {
			if (!selection.day || !selection.startTime || !selection.endTime) continue;
			const key = slotKey(selection.day, selection.startTime, selection.endTime);
			const actor = presenceByConnection.get(connectionId)?.email ?? `User ${connectionId.slice(-4)}`;
			const current = details.get(key) ?? { count: 0, actors: [] };
			current.count += 1;
			if (!current.actors.includes(actor)) current.actors.push(actor);
			details.set(key, current);
		}
		return details;
	}, [presenceByConnection, remoteSelections]);
	const entrySelectionDetails = useMemo(() => {
		const details = new Map<string, { count: number; actors: string[] }>();
		for (const [connectionId, selection] of Object.entries(remoteSelections)) {
			if (!selection.entryId) continue;
			const actor = presenceByConnection.get(connectionId)?.email ?? `User ${connectionId.slice(-4)}`;
			const current = details.get(selection.entryId) ?? { count: 0, actors: [] };
			current.count += 1;
			if (!current.actors.includes(actor)) current.actors.push(actor);
			details.set(selection.entryId, current);
		}
		return details;
	}, [presenceByConnection, remoteSelections]);
	const outboxStatusCounts = useMemo(() => {
		return {
			queued: outboxActions.filter((action) => action.status === 'queued' || action.status === 'retried').length,
			syncing: outboxActions.filter((action) => action.status === 'syncing').length,
			failed: outboxActions.filter((action) => action.status === 'failed').length,
		};
	}, [outboxActions]);
	const recentFailedFeedback = useMemo(() => outboxFeedback.filter((item) => item.status === 'FAILED').slice(0, 3), [outboxFeedback]);
	const timeSlots = useMemo(() => {
		const unique = new Map<string, { startTime: string; endTime: string }>();
		for (const entry of globalEntries) {
			const timeKey = `${entry.startTime}-${entry.endTime}`;
			unique.set(timeKey, { startTime: entry.startTime, endTime: entry.endTime });
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
			const nextOutbox = enqueueOutboxAction(facultyId, runId, {
				actionId: `submit-${selectedEntry.entryId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				type: 'SUBMIT',
				entryId: selectedEntry.entryId,
				...payload,
			});
			setOutboxActions(nextOutbox);
			setOutboxCount(nextOutbox.length);
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
		<div className='flex min-h-[calc(100svh-3.5rem)] flex-col overflow-y-auto md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden'>
				<div className='shrink-0 space-y-4 px-6 pt-6 pb-3'>
					{schoolYearNotice && (
						<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
							{schoolYearNotice}
						</div>
					)}

					{/* ── Connection / sync status strip ── */}
					<div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
						{online ? <Wifi className='size-4 shrink-0' /> : <WifiOff className='size-4 shrink-0' />}
						{!online && (
							<span className='font-semibold'>You're offline — changes will be saved and sent when you reconnect.</span>
						)}
						{online && outboxCount === 0 && !syncingOutbox && (
							<span className='font-semibold'>Connected</span>
						)}
						{online && syncingOutbox && (
							<span className='font-semibold'>Saving your changes…</span>
						)}
						{online && !syncingOutbox && outboxCount > 0 && outboxStatusCounts.failed === 0 && (
							<span className='font-semibold'>{outboxCount} change{outboxCount !== 1 ? 's' : ''} queued — sending now…</span>
						)}
						{online && outboxStatusCounts.failed > 0 && (
							<>
								<span className='font-semibold text-amber-800'>{outboxStatusCounts.failed} change{outboxStatusCounts.failed !== 1 ? 's' : ''} could not be saved.</span>
								<Button size='sm' variant='outline' className='h-6 px-2 text-xs' onClick={retryFailedOutboxActions}>
									Try again
								</Button>
							</>
						)}
						{compactPresence.visible.length > 0 && (
							<>
								<span className='mx-1 text-muted-foreground/40'>|</span>
								<span className='text-muted-foreground'>{compactPresence.visible.length + compactPresence.hiddenCount} other{compactPresence.visible.length + compactPresence.hiddenCount !== 1 ? 's' : ''} viewing</span>
								<div className='flex items-center gap-1'>
									{compactPresence.visible.map((person) => {
										const label = person.email ?? `User`;
										const initials = label.slice(0, 2).toUpperCase();
										return (
											<span key={person.connectionId} className='inline-flex size-5 items-center justify-center rounded-full border border-current bg-white text-[0.55rem] font-semibold' title={label}>
												{initials}
											</span>
										);
									})}
									{compactPresence.hiddenCount > 0 && <span className='text-muted-foreground'>+{compactPresence.hiddenCount}</span>}
								</div>
							</>
						)}
					</div>

					<div className='flex flex-wrap items-center gap-3'>
						<div>
							<h1 className='text-2xl font-semibold tracking-tight'>Room Change Requests</h1>
							<p className='text-sm text-muted-foreground'>
								{!selectedSourceEntryId
									? 'Step 1 of 3 — Tap one of your classes (highlighted in blue) to select it.'
									: !requestSheetOpen
										? 'Step 2 of 3 — Tap any time slot to request a change for your selected class.'
										: 'Step 3 of 3 — Choose your preferred room, check for conflicts, then submit.'}
							</p>
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
						<span className='font-medium text-foreground'>{entries.length} class{entries.length !== 1 ? 'es' : ''} assigned to you</span>
						{runGeneratedAt && (
							<>
								<span className='text-border/60'>•</span>
								<span className='text-muted-foreground'>Schedule as of {new Date(runGeneratedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
							</>
						)}
						{submittedCount > 0 && (
							<>
								<span className='text-border/60'>•</span>
								<span className='text-muted-foreground'>{submittedCount} request{submittedCount !== 1 ? 's' : ''} pending review</span>
							</>
						)}
						{draftCount > 0 && (
							<>
								<span className='text-border/60'>•</span>
								<span className='text-muted-foreground'>{draftCount} draft request{draftCount !== 1 ? 's' : ''} (not yet submitted)</span>
							</>
						)}
						{gate?.blocked && (
							<Badge variant='warning'>Schedule update paused — {gate.openCount} request{gate.openCount !== 1 ? 's' : ''} awaiting decision</Badge>
						)}
						{dirtyEntries.length > 0 && <Badge variant='warning'>{dirtyEntries.length} unsaved change{dirtyEntries.length !== 1 ? 's' : ''}</Badge>}
					</div>
				</div>

				<div className='grid flex-1 min-h-0 gap-4 overflow-visible px-6 pb-6 lg:grid-cols-[1.3fr_0.7fr] md:overflow-hidden'>
					<div className='flex flex-col overflow-hidden rounded-2xl border border-border bg-card'>
						<div className='border-b border-border px-4 py-3'>
							<p className='text-sm font-semibold text-foreground'>Your Current Schedule</p>
							<p className='text-xs text-muted-foreground'>
								{selectedSourceEntryId
									? 'Class selected — now tap any time slot to request a change.'
									: 'Tap any of your classes (highlighted in blue) to start a request.'}
							</p>
						</div>
						<div className='flex-1 min-h-0 overflow-visible px-3 py-3 md:overflow-auto' style={{ touchAction: 'pan-x pan-y' }}>
							<div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '860px' }}>
								<div className='grid grid-cols-[9rem_repeat(5,minmax(10rem,1fr))] gap-2'>
									<div className='text-xs font-semibold text-muted-foreground px-2 py-2'>Time</div>
									{DAYS.map((day) => (
										<div key={day} className='text-xs font-semibold text-muted-foreground px-2 py-2'>{day.slice(0, 3)}</div>
									))}
									{timeSlots.map((slot) => (
										<Fragment key={`slot-row-${slot.startTime}-${slot.endTime}`}>
											<div key={`slot-${slot.startTime}-${slot.endTime}`} className='rounded-lg border border-border bg-muted/40 px-2 py-2 text-xs font-medium'>
												{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
											</div>
											{DAYS.map((day) => {
												const key = slotKey(day, slot.startTime, slot.endTime);
												const cellEntries = globalBySlot.get(key) ?? [];
												const slotLive = slotSelectionDetails.get(key);
												return (
													<button
														key={`${key}-${day}`}
														type='button'
														onClick={() => {
															const occupied = cellEntries[0] ?? null;
															collaborationRef.current?.sendSelection({
																schoolId: DEFAULT_SCHOOL_ID,
																schoolYearId: activeSchoolYearId,
																runId,
																day,
																startTime: slot.startTime,
																endTime: slot.endTime,
																entryId: occupied?.entryId,
																source: 'GRID_CELL',
															});
															openRequestSheet({
																day,
																startTime: slot.startTime,
																endTime: slot.endTime,
																targetEntryId: occupied?.entryId ?? null,
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
															{cellEntries.length === 0 && <p className='text-[0.68rem] text-muted-foreground'>Free — tap to move here</p>}
															{cellEntries.map((entry) => {
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
																				setSelectedSourceEntryId(entry.entryId);
																				collaborationRef.current?.sendSelection({
																					schoolId: DEFAULT_SCHOOL_ID,
																					schoolYearId: activeSchoolYearId,
																					runId,
																					day,
																					startTime: slot.startTime,
																					endTime: slot.endTime,
																					entryId: entry.entryId,
																					source: 'SESSION',
																				});
																				return;
																			}
																			openRequestSheet({ day, startTime: slot.startTime, endTime: slot.endTime, targetEntryId: entry.entryId });
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
						<div className='space-y-4 border-b border-border px-4 py-4'>
							<div className='flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2'>
								<Search className='size-4 text-muted-foreground' />
								<Input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder='Search rooms by name or building…' className='border-0 bg-transparent px-0 shadow-none focus-visible:ring-0' />
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
								<div className='rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground'>Tap one of your classes in the schedule to begin.</div>
							)}
						</div>

						<div className='flex-1 space-y-3 overflow-visible p-4 md:overflow-auto'>
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
						<SheetTitle>Request a Room Change</SheetTitle>
						<SheetDescription>Choose what you want to change, pick a room, and check for schedule conflicts before submitting.</SheetDescription>
					</SheetHeader>

					<div className='mt-4 space-y-4'>
						<div className='grid gap-3 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>What do you want to change?</Label>
								<Select value={actionType} onValueChange={(value) => setActionType(value as RequestActionType)}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value='MOVE_TO_EMPTY_SLOT'><Move className='mr-2 inline size-4' />Move my class to a free time slot</SelectItem>
										<SelectItem value='SWAP_WITH_OCCUPIED'><Shuffle className='mr-2 inline size-4' />Swap time slots with another class</SelectItem>
										<SelectItem value='ROOM_CHANGE'><TimerReset className='mr-2 inline size-4' />Change my classroom only</SelectItem>
										<SelectItem value='TIME_AND_ROOM_CHANGE'><Send className='mr-2 inline size-4' />Change both time and classroom</SelectItem>
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
							placeholder='Reason for this request — required if your change causes a schedule conflict.'
							className='min-h-24'
						/>

						<Separator />

						<div className='space-y-2'>
							<p className='text-sm font-semibold'>Schedule check</p>
							{previewLoading && <p className='text-xs text-muted-foreground'>Checking for conflicts…</p>}
							{!previewLoading && requestPreview && (
								<>
									{requestPreview.hardViolations.length === 0 && requestPreview.softViolations.length === 0 && (
										<p className='text-xs text-emerald-700 font-medium'>✓ No conflicts found. You can submit this request.</p>
									)}
									{requestPreview.hardViolations.length > 0 && (
										<p className='text-xs text-amber-800 font-medium'>This request causes {requestPreview.hardViolations.length} schedule conflict{requestPreview.hardViolations.length !== 1 ? 's' : ''}. Please explain your reason below and the scheduling officer will decide.</p>
									)}
									{requestPreview.softViolations.length > 0 && requestPreview.hardViolations.length === 0 && (
										<p className='text-xs text-muted-foreground'>{requestPreview.softViolations.length} minor scheduling note{requestPreview.softViolations.length !== 1 ? 's' : ''} — you can still submit.</p>
									)}
									<div className='space-y-2'>
										{requestPreview.humanConflicts.map((conflict, index) => (
											<div key={`${conflict.code}-${conflict.humanTitle}-${index}`} className='rounded-lg border border-border bg-background p-2'>
												<p className='text-xs font-semibold'>{conflict.humanTitle}</p>
												<p className='mt-1 text-xs text-muted-foreground'>{conflict.humanDetail}</p>
											</div>
										))}
									</div>
								</>
							)}
						</div>

						<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
							Minor scheduling notes are for your information only. Requests with conflicts will be reviewed and decided by the scheduling officer — they are not automatically rejected.
						</div>

						{actionType === 'SWAP_WITH_OCCUPIED' && (requestPreview?.hardViolations.length ?? 0) > 0 && !reason.trim() && (
							<div className='rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
								Please enter a reason above to explain why you need this change — it helps the scheduling officer make a decision.
							</div>
						)}

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