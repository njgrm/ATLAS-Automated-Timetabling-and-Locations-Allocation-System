import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

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
import { describeSchoolYearSource, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { cacheFacultyIdentity, readCachedFacultyIdentity } from '@/lib/faculty-identity-cache';
import { buildFacultyCacheKey, isLikelyOfflineError, readLatestFacultySnapshotByPrefix, removeFacultySnapshotsByPrefix, writeFacultySnapshot } from '@/lib/faculty-offline-cache';
import { buildRoomBootstrapCacheMarker } from '@/lib/faculty-room-preference-cache-key';
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
	FacultyTeachingAssignmentIdentity,
	RoomPreferenceSummaryItem,
	GenerationGateStatus,
	PreviewResult,
	Room,
	RoomPreferenceActionType as RequestActionType,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	TutorialStep,
} from '@/types';
import { TutorialOverlay, useTutorial } from '@/components/TutorialOverlay';
import FacultyGlobalHeader from '@/components/faculty-shared/FacultyGlobalHeader';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Switch } from '@/ui/switch';
import DesktopRoomRequestLayout from '@/components/faculty-room-preferences/DesktopRoomRequestLayout';
import MobileRoomRequestLayout from '@/components/faculty-room-preferences/MobileRoomRequestLayout';
import RoomRequestSheet from '@/components/faculty-room-preferences/RoomRequestSheet';
import { RoomRequestErrorState, RoomRequestLoadingState } from '@/components/faculty-room-preferences/RoomRequestPageStates';
import { buildRoomRequestAdvisory } from '@/components/faculty-room-preferences/room-request-advisory';
import {
	ACTION_LABELS,
	DAYS,
	FACULTY_ROOM_TUTORIAL_STEPS,
	applyRoomSelection,
	isEntryDirty,
	slotKey,
	statusBadge,
	type RoomOption,
} from '@/components/faculty-room-preferences/room-request-helpers';
import { useMobileConflictPreview } from '@/hooks/useMobileConflictPreview';

const DEFAULT_SCHOOL_ID = 1;
const ROOM_BOOTSTRAP_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

type FacultyRoomBootstrapSnapshot = {
	facultyId: number;
	rooms: RoomOption[];
	buildings: Building[];
	campusImageUrl: string | null;
	state: FacultyRoomPreferenceState;
};

type FacultyPortalObjectiveLookup = {
	teachingAssignments: FacultyTeachingAssignmentIdentity[];
};

export default function FacultyRoomPreferences() {
	const [searchParams] = useSearchParams();
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
	const [usingCachedBootstrap, setUsingCachedBootstrap] = useState(false);
	const [cachedBootstrapAt, setCachedBootstrapAt] = useState<string | null>(null);
	const [initialEntries, setInitialEntries] = useState<FacultyRoomPreferenceEntry[]>([]);
	const [entries, setEntries] = useState<FacultyRoomPreferenceEntry[]>([]);
	const [globalEntries, setGlobalEntries] = useState<FacultyGlobalDraftEntry[]>([]);
	const [teachingAssignments, setTeachingAssignments] = useState<FacultyTeachingAssignmentIdentity[]>([]);
	const [recentRequests, setRecentRequests] = useState<RoomPreferenceSummaryItem[]>([]);
	const [selectedSourceEntryId, setSelectedSourceEntryId] = useState<string | null>(null);
	const [targetSlot, setTargetSlot] = useState<SlotTarget | null>(null);
	const [requestSheetOpen, setRequestSheetOpen] = useState(false);
	const [actionType, setActionType] = useState<RequestActionType>('MOVE_TO_EMPTY_SLOT');
	const [requestedRoomId, setRequestedRoomId] = useState<string>('');
	const [requestRoomSearch, setRequestRoomSearch] = useState('');
	const [reason, setReason] = useState('');
	const [requestPreview, setRequestPreview] = useState<PreviewResult | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [showFullScheduleContext, setShowFullScheduleContext] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [roomSearch, setRoomSearch] = useState('');
	const [rooms, setRooms] = useState<RoomOption[]>([]);
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [presence, setPresence] = useState<CollaborationPresence[]>([]);
	const [remoteSelections, setRemoteSelections] = useState<Record<string, CollaborationSelection>>({});
	const [collaborationConnected, setCollaborationConnected] = useState(false);
	const [collaborationLastError, setCollaborationLastError] = useState<string | null>(null);
	const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
	const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
	const lastEventIdRef = useRef<number>(0);
	const collaborationRef = useRef<ReturnType<typeof createRoomPreferenceCollaborationSocket> | null>(null);
	const selfConnectionIdRef = useRef<string | null>(null);
	const tutorial = useTutorial('atlas_faculty_room_preferences_tour_v1');
	const mobilePreview = useMobileConflictPreview({
		schoolId: DEFAULT_SCHOOL_ID,
		activeSchoolYearId,
		runId,
		facultyId,
		runVersion,
		selectedEntry: entries.find((entry) => entry.entryId === selectedSourceEntryId) ?? null,
	});

	const applyServerState = useCallback((state: FacultyRoomPreferenceState) => {
		setRunId(state.runId);
		setRunVersion(state.runVersion);
		setRunGeneratedAt(state.runGeneratedAt);
		setInitialEntries(state.entries);
		setEntries(state.entries);
		setGlobalEntries(state.globalEntries ?? []);
		setTeachingAssignments(state.teachingAssignments ?? []);
		setRecentRequests(state.recentRequests ?? []);
		
		const entryIdParam = searchParams.get('entryId');
		if (entryIdParam && state.entries.some(e => e.entryId === entryIdParam)) {
			setSelectedSourceEntryId(entryIdParam);
			if (isMobileViewport) setMobileStep(2);
		} else {
			if (isMobileViewport) {
				setSelectedSourceEntryId(null);
				setMobileStep(1);
			} else {
				setSelectedSourceEntryId((current) => (current && state.entries.some((entry) => entry.entryId === current) ? current : state.entries[0]?.entryId ?? null));
			}
		}
	}, [searchParams, isMobileViewport]);

	const loadBootstrap = useCallback(async () => {
		setLoading(true);
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
			const schoolYearId = schoolYearContext.activeSchoolYearId;
			setActiveSchoolYearId(schoolYearId);
			setSchoolYearNotice(describeSchoolYearSource(schoolYearContext));

			let resolvedFacultyId: number;
			try {
				const { data: facultyMe } = await atlasApi.get<{ faculty: FacultyMirror }>(`/faculty/me`, {
					params: { schoolId: DEFAULT_SCHOOL_ID },
				});
				const facultyMatch = facultyMe.faculty;
				if (!facultyMatch?.id) {
					setError('Your account is not linked to a teacher record in this school.');
					return;
				}
				resolvedFacultyId = facultyMatch.id;
				cacheFacultyIdentity(DEFAULT_SCHOOL_ID, facultyMatch.id);
			} catch (facultyError) {
				const cachedIdentity = readCachedFacultyIdentity(DEFAULT_SCHOOL_ID);
				if (cachedIdentity && isLikelyOfflineError(facultyError)) {
					resolvedFacultyId = cachedIdentity.facultyId;
					setSchoolYearNotice((current) => current ?? 'Working from your saved account while offline.');
				} else {
					throw facultyError;
				}
			}

			setFacultyId(resolvedFacultyId);
			const cachePrefix = buildFacultyCacheKey('room-preferences-bootstrap', DEFAULT_SCHOOL_ID, schoolYearId, resolvedFacultyId);
			const cachedSnapshot = readLatestFacultySnapshotByPrefix<FacultyRoomBootstrapSnapshot>(cachePrefix, {
				maxAgeMs: ROOM_BOOTSTRAP_CACHE_MAX_AGE_MS,
				validate: (value): value is FacultyRoomBootstrapSnapshot => {
					if (!value || typeof value !== 'object') return false;
					const candidate = value as Partial<FacultyRoomBootstrapSnapshot>;
					return (
						typeof candidate.facultyId === 'number'
						&& Array.isArray(candidate.rooms)
						&& Array.isArray(candidate.buildings)
						&& Boolean(candidate.state)
					);
				},
			});

			try {
				const [roomState, buildingsResponse, campusImageResponse] = await Promise.all([
					atlasApi.get<FacultyRoomPreferenceState & { facultyId?: number }>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/latest/me`),
					atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
					atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`),
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
				setBuildings(buildingsResponse.data.buildings);
				setCampusImageUrl(campusImageResponse.data.campusImageUrl ?? null);
				applyServerState(roomState.data);
				setGate(null);
				setUsingCachedBootstrap(false);
				setCachedBootstrapAt(null);
				setError(null);

				removeFacultySnapshotsByPrefix(cachePrefix);
				writeFacultySnapshot(`${cachePrefix}:${buildRoomBootstrapCacheMarker(roomState.data)}`, {
					facultyId: resolvedFacultyId,
					rooms: nextRooms,
					buildings: buildingsResponse.data.buildings,
					campusImageUrl: campusImageResponse.data.campusImageUrl ?? null,
					state: roomState.data,
				});
			} catch (err) {
				if (cachedSnapshot && isLikelyOfflineError(err)) {
					setRooms(cachedSnapshot.data.rooms);
					setBuildings(cachedSnapshot.data.buildings);
					setCampusImageUrl(cachedSnapshot.data.campusImageUrl);
					applyServerState(cachedSnapshot.data.state);
					setGate(null);
					setUsingCachedBootstrap(true);
					setCachedBootstrapAt(cachedSnapshot.cachedAt);
					setError(null);
					return;
				}

				const responseData = (err as { response?: { data?: { code?: string; message?: string; actionHint?: string } } })?.response?.data;
				let objectiveMessage: string | null = null;
				if (responseData?.code === 'NO_ACTIVE_DRAFT') {
					try {
						const { data: objectiveLookup } = await atlasApi.get<FacultyPortalObjectiveLookup>(`/faculty-portal/${DEFAULT_SCHOOL_ID}/${schoolYearId}/dashboard`);
						setTeachingAssignments(objectiveLookup.teachingAssignments ?? []);
						objectiveMessage = (objectiveLookup.teachingAssignments?.length ?? 0) > 0
							? 'Your teaching load is linked, but no review draft has been generated for room requests yet.'
							: 'No teaching load is linked to your account yet. Ask the scheduling officer to check your teaching load before room requests open.';
					} catch {
						objectiveMessage = null;
					}
				}
				const noDraftMessage = responseData?.code === 'NO_ACTIVE_DRAFT'
					? objectiveMessage ?? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
					: null;
				const staleMessage = responseData?.code === 'STALE_RUN_DATA'
					? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
					: null;
				setUsingCachedBootstrap(false);
				setCachedBootstrapAt(null);
				setError(noDraftMessage ?? staleMessage ?? responseData?.message ?? "Your schedule isn't ready yet. Please wait for the scheduler to generate the draft.");
			}
		} catch {
			setError("We couldn't load room-request bootstrap details. Please tap Retry.");
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

			const feedback: OutboxSyncFeedback[] = [];
			const resultByAction = new Map(data.results.map((r) => [r.actionId, r]));
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
					if (payload.type === 'ROOM_REQUEST_REVIEWED') {
						toast.success(payload.message);
					} else {
						toast.info(payload.message);
					}
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
		source.addEventListener('ROOM_REQUEST_SYNC_COMPLETED', handleEvent as EventListener);

		return () => {
			source.close();
		};
	}, [activeSchoolYearId, facultyId, loadBootstrap]);

	const initialMap = useMemo(() => new Map(initialEntries.map((entry) => [entry.entryId, entry])), [initialEntries]);
	const selectedEntry = entries.find((entry) => entry.entryId === selectedSourceEntryId) ?? null;
	const dirtyEntries = entries.filter((entry) => isEntryDirty(entry, initialMap.get(entry.entryId)));
	const dirtyCount = dirtyEntries.length;
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
	const presenceLabelByConnection = useMemo(() => {
		return new Map(presence.map((item) => [item.connectionId, item.email ?? item.role ?? 'Another user']));
	}, [presence]);
	const slotSelectionDetails = useMemo(() => {
		const details = new Map<string, { count: number; actors: string[] }>();
		for (const [connectionId, selection] of Object.entries(remoteSelections)) {
			if (!selection.day || !selection.startTime || !selection.endTime) continue;
			const key = slotKey(selection.day, selection.startTime, selection.endTime);
			const current = details.get(key) ?? { count: 0, actors: [] };
			current.count += 1;
			current.actors.push(presenceLabelByConnection.get(connectionId) ?? 'Another user');
			details.set(key, current);
		}
		return details;
	}, [presenceLabelByConnection, remoteSelections]);
	const entrySelectionDetails = useMemo(() => {
		const details = new Map<string, { count: number; actors: string[] }>();
		for (const [connectionId, selection] of Object.entries(remoteSelections)) {
			if (!selection.entryId) continue;
			const current = details.get(selection.entryId) ?? { count: 0, actors: [] };
			current.count += 1;
			current.actors.push(presenceLabelByConnection.get(connectionId) ?? 'Another user');
			details.set(selection.entryId, current);
		}
		return details;
	}, [presenceLabelByConnection, remoteSelections]);
	const selectionCountBySlot = useMemo(() => {
		return new Map([...slotSelectionDetails.entries()].map(([key, details]) => [key, details.count]));
	}, [slotSelectionDetails]);
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
		if (usingCachedBootstrap) return 'failed' as const;
		if (syncingOutbox || outboxStatusCounts.syncing > 0) return 'syncing' as const;
		if (outboxStatusCounts.failed > 0) return 'failed' as const;
		if (outboxStatusCounts.queued > 0) return 'queued' as const;
		if (lastSyncedFeedback) return 'synced' as const;
		return 'idle' as const;
	}, [lastSyncedFeedback, online, outboxStatusCounts.failed, outboxStatusCounts.queued, outboxStatusCounts.syncing, syncingOutbox, usingCachedBootstrap]);
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
					occupiedLabel: occupant
						? showFullScheduleContext
							? `${occupant.subjectDisplayLabel ?? occupant.subjectCode} â€¢ ${occupant.sectionName}`
							: 'Occupied by another class'
						: null,
				});
			}
		}
		return targets;
	}, [globalBySlot, showFullScheduleContext, timeSlots]);
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

	const advisory = useMemo(() => buildRoomRequestAdvisory({
		cachedBootstrapAt,
		gate,
		online,
		outboxCount,
		usingCachedBootstrap,
	}), [cachedBootstrapAt, gate, online, outboxCount, usingCachedBootstrap]);

	if (loading) {
		return <RoomRequestLoadingState />;
	}

	if (error) {
		return <RoomRequestErrorState error={error} onRetry={() => void loadBootstrap()} />;
	}

	return (
		<div className='flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden bg-muted/30'>
			<FacultyGlobalHeader
				title='Room requests'
				eyebrow='Faculty'
				subtitle={currentStep === 1 ? 'Pick the class you want to move.' : currentStep === 2 ? 'Pick the new time slot.' : 'Review the check and submit.'}
				steps={[
					{ id: 1, label: 'Class' },
					{ id: 2, label: 'Target' },
					{ id: 3, label: 'Submit' },
				]}
				activeStep={currentStep}
				online={online}
				syncState={syncLifecycleState}
				queuedCount={outboxCount}
				failedCount={outboxStatusCounts.failed}
				lastSyncedAt={lastSyncedFeedback?.at ?? null}
				liveViewers={compactPresence.visible.length + compactPresence.hiddenCount}
				realtimeConnected={collaborationConnected}
				advisory={advisory}
				onRetryFailed={usingCachedBootstrap ? () => void loadBootstrap() : retryFailedOutboxActions}
				rightSlot={(
					<Button variant='outline' size='sm' className='h-9 rounded-full' onClick={() => void loadBootstrap()}>
						<RefreshCcw className='mr-2 size-4' />
						Check for updates
					</Button>
				)}
			>
				<div className='flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-[12px]'>
					<span className='font-semibold text-foreground'>{entries.length} class{entries.length === 1 ? '' : 'es'}</span>
					<span className='text-muted-foreground'>·</span>
					<span className='text-muted-foreground'>{submittedCount} pending</span>
					{outboxCount > 0 && <Badge variant='warning' className='h-5 px-1.5 text-[10px]'>{outboxCount} request{outboxCount === 1 ? '' : 's'} waiting to send</Badge>}
					{entries.length === 0 && teachingAssignments.length > 0 && <Badge variant='warning' className='h-5 px-1.5 text-[10px]'>Teaching load linked</Badge>}
					{dirtyCount > 0 && <Badge variant='warning' className='h-5 px-1.5 text-[10px]'>Unsaved</Badge>}
					<div className='flex-1' />
					<div className='flex items-center gap-2' data-tutorial='context-toggle'>
						<Switch
							checked={showFullScheduleContext}
							onCheckedChange={setShowFullScheduleContext}
							className='scale-75'
						/>
						<span className='text-[11px] font-medium text-muted-foreground'>Full context</span>
					</div>
				</div>
				{schoolYearNotice && (
					<p className='text-[11px] text-muted-foreground'>{schoolYearNotice}</p>
				)}
			</FacultyGlobalHeader>

			<div className="flex flex-1 min-h-0 overflow-hidden">
				<MobileRoomRequestLayout
					mobileStep={mobileStep}
					entries={entries}
					teachingAssignments={teachingAssignments}
					selectedSourceEntryId={selectedSourceEntryId}
					selectedEntry={selectedEntry}
					mobileTargets={mobileTargets}
					recentRequests={recentRequests}
					showFullScheduleContext={showFullScheduleContext}
					previewSlot={mobilePreview.previewSlot}
					inlinePreview={mobilePreview.preview}
					inlinePreviewLoading={mobilePreview.previewLoading}
					onSelectSourceEntry={(entryId) => {
						setSelectedSourceEntryId(entryId);
						mobilePreview.clearPreview();
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
						void mobilePreview.selectTarget(target);
					}}
					onContinueToReview={() => {
						if (mobilePreview.previewSlot) openRequestSheet(mobilePreview.previewSlot);
					}}
					onClearPreviewTarget={mobilePreview.clearPreview}
					onStepBack={() => {
						mobilePreview.clearPreview();
						setMobileStep((s) => Math.max(1, s - 1) as 1 | 2 | 3);
					}}
					onStepForward={() => selectedSourceEntryId && setMobileStep(2)}
					renderStatusBadge={statusBadge}
				/>

				<DesktopRoomRequestLayout
					days={DAYS}
					timeSlots={timeSlots}
					globalBySlot={globalBySlot}
					showFullScheduleContext={showFullScheduleContext}
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
					entries={entries}
					teachingAssignments={teachingAssignments}
				/>
			</div>

			<RoomRequestSheet
				open={requestSheetOpen}
				onOpenChange={(open) => {
					setRequestSheetOpen(open);
					if (!open) mobilePreview.clearPreview();
				}}
				selectedEntry={selectedEntry}
				targetSlot={targetSlot}
				actionType={actionType}
				onActionTypeChange={(value) => setActionType(value as RequestActionType)}
				requestedRoomId={requestedRoomId}
				onRequestedRoomIdChange={setRequestedRoomId}
				requestRoomSearch={requestRoomSearch}
				onRequestRoomSearchChange={setRequestRoomSearch}
				requestRoomOptions={requestRoomOptions}
				buildings={buildings}
				campusImageUrl={campusImageUrl}
				reason={reason}
				onReasonChange={setReason}
				reasonRequired={reasonRequired}
				previewLoading={previewLoading}
				requestPreview={requestPreview}
				submitting={submitting}
				onSubmit={() => void submitCurrentRequest()}
			/>

			<TutorialOverlay
				steps={FACULTY_ROOM_TUTORIAL_STEPS}
				active={tutorial.active}
				onComplete={tutorial.complete}
			/>
		</div>
	);
}
