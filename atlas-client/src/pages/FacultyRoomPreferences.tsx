import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	AlertCircle,
	Loader2,
	Move,
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
import { scopePreviewToCandidate } from '@/lib/timetable-utils';
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
import DesktopRoomRequestLayout from '@/components/faculty-room-preferences/DesktopRoomRequestLayout';
import MobileRoomRequestLayout from '@/components/faculty-room-preferences/MobileRoomRequestLayout';
import RoomRequestHeader from '@/components/faculty-room-preferences/RoomRequestHeader';

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
			notice: `Showing School Year ${inferredActive.yearLabel}.`,
		};
	}

	if (sortedYears[0]) {
		return {
			schoolYearId: sortedYears[0].id,
			notice: `Showing School Year ${sortedYears[0].yearLabel}.`,
		};
	}

	return {
		schoolYearId: FALLBACK_SCHOOL_YEAR_ID,
		notice: 'Showing a fallback school year while setup is being completed.',
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
	const [requestRoomSearch, setRequestRoomSearch] = useState('');
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
	const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
	const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
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

			const [roomState, buildingsResponse] = await Promise.all([
				atlasApi.get<FacultyRoomPreferenceState>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/latest/faculty/${facultyMatch.id}`),
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
			setGate(null);
			setError(null);
		} catch (err) {
			const responseData = (err as { response?: { data?: { code?: string; message?: string; actionHint?: string } } })?.response?.data;
			const noDraftMessage = responseData?.code === 'NO_ACTIVE_DRAFT'
				? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
				: null;
			const staleMessage = responseData?.code === 'STALE_RUN_DATA'
				? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
				: null;
			setError(noDraftMessage ?? staleMessage ?? responseData?.message ?? "Your schedule isn't ready yet. Please wait for the scheduler to generate the draft.");
		} finally {
			setLoading(false);
		}
	}, [applyServerState]);

	useEffect(() => {
		void loadBootstrap();
	}, [loadBootstrap]);

	useEffect(() => {
		const media = window.matchMedia('(max-width: 1023px)');
		const onChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);
		setIsMobileViewport(media.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

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
		if (import.meta.env.VITE_ROOM_PREF_COLLAB !== 'true') return;
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
						schoolYearId: activeSchoolYearId ?? 0,
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
	const requestRoomOptions = rooms.filter((room) => `${room.name} ${room.buildingName}`.toLowerCase().includes(requestRoomSearch.toLowerCase()));
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
	const lastSyncedFeedback = useMemo(
		() => outboxFeedback.find((item) => item.status === 'SYNCED') ?? null,
		[outboxFeedback],
	);
	const reasonRequired = actionType === 'SWAP_WITH_OCCUPIED' && (requestPreview?.hardViolations.length ?? 0) > 0;
	const syncLifecycleState = useMemo(() => {
		if (!online) return 'queued-offline' as const;
		if (syncingOutbox || outboxStatusCounts.syncing > 0) return 'syncing' as const;
		if (outboxStatusCounts.failed > 0) return 'failed' as const;
		if (outboxStatusCounts.queued > 0) return 'queued' as const;
		if (lastSyncedFeedback) return 'synced' as const;
		return 'idle' as const;
	}, [lastSyncedFeedback, online, outboxStatusCounts.failed, outboxStatusCounts.queued, outboxStatusCounts.syncing, syncingOutbox]);
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
	const mobileTargets = useMemo(() => {
		const targets: Array<{ day: DayOfWeek; startTime: string; endTime: string; targetEntryId: string | null; occupiedLabel: string | null }> = [];
		for (const day of DAYS) {
			for (const slot of timeSlots) {
				const key = slotKey(day, slot.startTime, slot.endTime);
				const occupant = (globalBySlot.get(key) ?? [])[0] ?? null;
				targets.push({
					day,
					startTime: slot.startTime,
					endTime: slot.endTime,
					targetEntryId: occupant?.entryId ?? null,
					occupiedLabel: occupant ? `${occupant.subjectCode} • ${occupant.sectionName}` : null,
				});
			}
		}
		return targets;
	}, [globalBySlot, timeSlots]);
	const currentStep = useMemo<1 | 2 | 3>(() => {
		if (requestSheetOpen) return 3;
		if (!selectedSourceEntryId) return 1;
		return 2;
	}, [requestSheetOpen, selectedSourceEntryId]);

	useEffect(() => {
		if (!isMobileViewport) return;
		setMobileStep(currentStep);
	}, [currentStep, isMobileViewport]);

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
		setRequestRoomSearch('');
		setReason(selectedEntry.rationale ?? '');
		setRequestPreview(null);
		setRequestSheetOpen(true);
		setMobileStep(3);
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
				setRequestPreview(scopePreviewToCandidate(data.preview, {
					day: targetSlot.day,
					startTime: targetSlot.startTime,
					endTime: targetSlot.endTime,
				}));
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
		if (reasonRequired && !reason.trim()) {
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
			<div className='flex h-[calc(100svh-3.5rem)] flex-col px-4 py-4 sm:px-6 sm:py-6'>
				<div className='grid gap-3 md:grid-cols-[1.15fr_0.85fr]'>
					<Skeleton className='h-[72svh] rounded-2xl' />
					<Skeleton className='h-[72svh] rounded-2xl' />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-4 sm:p-6'>
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
		<div className='flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden'>
				<div className='shrink-0 space-y-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-6'>
					{schoolYearNotice && (
						<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
							{schoolYearNotice}
						</div>
					)}

					{/* Show local status banner for queue/sync lifecycle states. */}
					{(!online || syncingOutbox || outboxCount > 0 || outboxStatusCounts.failed > 0 || Boolean(lastSyncedFeedback)) && (
					<div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
						{online ? <Wifi className='size-4 shrink-0' /> : <WifiOff className='size-4 shrink-0' />}
						{syncLifecycleState === 'queued-offline' && (
							<span className='font-semibold'>Queued — You are offline. Waiting for connection before submitting.</span>
						)}
						{syncLifecycleState === 'syncing' && (
							<span className='font-semibold'>Syncing — Saving your queued room-request changes now.</span>
						)}
						{syncLifecycleState === 'queued' && (
							<span className='font-semibold'>Queued — {outboxCount} change{outboxCount !== 1 ? 's' : ''} waiting to sync.</span>
						)}
						{syncLifecycleState === 'synced' && lastSyncedFeedback && (
							<span className='font-semibold'>Synced — Last update saved at {new Date(lastSyncedFeedback.at).toLocaleTimeString()}.</span>
						)}
						{syncLifecycleState === 'failed' && (
							<>
								<span className='font-semibold text-amber-800'>Failed — {outboxStatusCounts.failed} change{outboxStatusCounts.failed !== 1 ? 's' : ''} could not be saved.</span>
								<Button size='sm' variant='outline' className='h-6 px-2 text-xs' onClick={retryFailedOutboxActions}>
									Retry
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
							)}

					<RoomRequestHeader
						isMobileViewport={isMobileViewport}
						mobileStep={mobileStep}
						currentStep={currentStep}
						entriesCount={entries.length}
						runGeneratedAt={runGeneratedAt}
						submittedCount={submittedCount}
						draftCount={draftCount}
						gate={gate}
						dirtyCount={dirtyEntries.length}
					/>
				</div>

				<MobileRoomRequestLayout
					mobileStep={mobileStep}
					entries={entries}
					selectedSourceEntryId={selectedSourceEntryId}
					selectedEntry={selectedEntry}
					mobileTargets={mobileTargets}
					onSelectSourceEntry={(entryId) => {
						setSelectedSourceEntryId(entryId);
						setMobileStep(2);
						collaborationRef.current?.sendSelection({
							schoolId: DEFAULT_SCHOOL_ID,
							schoolYearId: activeSchoolYearId ?? 0,
							runId: runId ?? 0,
							entryId,
							source: 'SESSION',
						});
					}}
					onSelectTargetSlot={(target) => {
						collaborationRef.current?.sendSelection({
							schoolId: DEFAULT_SCHOOL_ID,
							schoolYearId: activeSchoolYearId ?? 0,
							runId: runId ?? 0,
							day: target.day,
							startTime: target.startTime,
							endTime: target.endTime,
							entryId: target.targetEntryId ?? undefined,
							source: 'GRID_CELL',
						});
						openRequestSheet(target);
					}}
					onStepBack={() => setMobileStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
					onStepForward={() => selectedSourceEntryId && setMobileStep(2)}
					renderStatusBadge={statusBadge}
				/>

				<DesktopRoomRequestLayout
					days={DAYS}
					timeSlots={timeSlots}
					globalBySlot={globalBySlot}
					selectionCountBySlot={selectionCountBySlot}
					slotSelectionDetails={slotSelectionDetails}
					entrySelectionDetails={entrySelectionDetails}
					activeSchoolYearId={activeSchoolYearId}
					runId={runId}
					selectedSourceEntryId={selectedSourceEntryId}
					selectedEntry={selectedEntry}
					zoom={zoom}
					onZoomOut={() => setZoom((current) => Math.max(0.7, Number((current - 0.1).toFixed(2))))}
					onZoomIn={() => setZoom((current) => Math.min(1.5, Number((current + 0.1).toFixed(2))))}
					onZoomReset={() => setZoom(1)}
					roomSearch={roomSearch}
					onRoomSearchChange={setRoomSearch}
					filteredRooms={filteredRooms}
					onAssignRoomToEntry={assignRoomToEntry}
					onSelectSourceEntry={(entryId) => {
						setSelectedSourceEntryId(entryId);
					}}
					onSelectTargetFromGrid={(payload) => {
						collaborationRef.current?.sendSelection({
							schoolId: DEFAULT_SCHOOL_ID,
							schoolYearId: activeSchoolYearId ?? 0,
							runId: runId ?? 0,
							day: payload.day,
							startTime: payload.startTime,
							endTime: payload.endTime,
							entryId: payload.targetEntryId ?? undefined,
							source: 'GRID_CELL',
						});
						openRequestSheet(payload);
					}}
					onUpdateSelectedRationale={updateSelectedRationale}
					renderStatusBadge={statusBadge}
				/>

			<Sheet open={requestSheetOpen} onOpenChange={setRequestSheetOpen}>
				<SheetContent side='bottom' className='h-[88dvh] overflow-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]'>
					<SheetHeader>
						<SheetTitle>Request a Room Change</SheetTitle>
						<SheetDescription>Choose what you want to change, pick a room, and check for schedule conflicts before submitting.</SheetDescription>
					</SheetHeader>

					<div className='mt-4 space-y-4'>
						{selectedEntry && (
							<div className='rounded-xl border border-border bg-muted/30 p-3'>
								<p className='text-xs font-medium text-muted-foreground'>Selected session</p>
								<p className='mt-1 text-sm font-semibold text-foreground'>{selectedEntry.subjectCode} · {selectedEntry.sectionName}</p>
								<p className='text-xs text-muted-foreground'>{selectedEntry.day.slice(0, 3)} {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)} · {selectedEntry.currentRoomName}</p>
							</div>
						)}

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
								<div className='flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2'>
									<Search className='size-4 text-muted-foreground' />
									<Input
										value={requestRoomSearch}
										onChange={(event) => setRequestRoomSearch(event.target.value)}
										placeholder='Search room by name or building'
										className='h-8 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0'
									/>
								</div>
								<Select value={requestedRoomId} onValueChange={setRequestedRoomId}>
									<SelectTrigger><SelectValue placeholder='Keep current room' /></SelectTrigger>
									<SelectContent>
										{requestRoomOptions.map((room) => (
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

						{reasonRequired && (
							<Textarea
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder='Reason for this request — required because this swap creates a schedule conflict.'
								className='min-h-24'
							/>
						)}

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

						{reasonRequired && !reason.trim() && (
							<div className='rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
								Please enter a reason above to explain why you need this change — it helps the scheduling officer make a decision.
							</div>
						)}

						<div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
							<Button variant='outline' className='sm:w-auto' onClick={() => setRequestSheetOpen(false)}>Cancel</Button>
							<Button
								className='sm:w-auto'
								onClick={() => void submitCurrentRequest()}
								disabled={submitting || !selectedEntry || !targetSlot || (reasonRequired && !reason.trim())}
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
