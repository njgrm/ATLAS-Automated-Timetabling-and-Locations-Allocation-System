import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	AlertCircle,
	CheckCircle2,
	ClipboardList,
	Loader2,
	RefreshCw,
	Search,
	XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { createRoomPreferenceCollaborationSocket } from '@/lib/roomPreferenceCollaboration';
import { fetchPublicSettings } from '@/lib/settings';
import { scopePreviewToCandidate } from '@/lib/timetable-utils';
import { formatTime } from '@/lib/utils';
import type {
	CollaborationPresence,
	CollaborationSelection,
	RoomPreferenceDecisionStatus,
	RoomPreferencePreviewResponse,
	RoomPreferenceStatus,
	RoomPreferenceSummaryItem,
	RoomPreferenceSummaryResponse,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';

const DEFAULT_SCHOOL_ID = 1;

function decisionBadge(status: RoomPreferenceDecisionStatus) {
	if (status === 'APPROVED') return <Badge variant='success'>Approved</Badge>;
	if (status === 'REJECTED') return <Badge variant='warning'>Rejected</Badge>;
	return <Badge variant='secondary'>Pending</Badge>;
}

export default function OfficerRoomPreferences() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [summary, setSummary] = useState<RoomPreferenceSummaryResponse | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<'ALL' | RoomPreferenceStatus>('SUBMITTED');
	const [decisionFilter, setDecisionFilter] = useState<'ALL' | RoomPreferenceDecisionStatus>('PENDING');
	const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
	const [previewState, setPreviewState] = useState<RoomPreferencePreviewResponse | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [reviewerNotes, setReviewerNotes] = useState('');
	const [savingDecision, setSavingDecision] = useState(false);
	const [presence, setPresence] = useState<CollaborationPresence[]>([]);
	const [remoteSelections, setRemoteSelections] = useState<Record<string, CollaborationSelection>>({});
	const [collaborationConnected, setCollaborationConnected] = useState(false);
	const [collaborationLastError, setCollaborationLastError] = useState<string | null>(null);
	const refreshTimeoutRef = useRef<number | null>(null);
	const collaborationRef = useRef<ReturnType<typeof createRoomPreferenceCollaborationSocket> | null>(null);
	const selfConnectionIdRef = useRef<string | null>(null);

	const loadSummary = useCallback(async (schoolYearId: number, nextStatus: 'ALL' | RoomPreferenceStatus, nextDecision: 'ALL' | RoomPreferenceDecisionStatus) => {
		setLoading(true);
		try {
			const params: Record<string, string> = {};
			if (nextStatus !== 'ALL') params.status = nextStatus;
			if (nextDecision !== 'ALL') params.decisionStatus = nextDecision;
			const { data } = await atlasApi.get<RoomPreferenceSummaryResponse>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${schoolYearId}/latest/summary`, { params });
			setSummary(data);
			setError(null);
		} catch (err) {
			const responseData = (err as { response?: { data?: { code?: string; message?: string; actionHint?: string } } })?.response?.data;
			const staleMessage = responseData?.code === 'STALE_RUN_DATA'
				? [responseData.message, responseData.actionHint].filter(Boolean).join(' ')
				: null;
			setError(staleMessage ?? responseData?.message ?? 'Failed to load room requests.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		(async () => {
			try {
				const settings = await fetchPublicSettings();
				if (!settings.activeSchoolYearId) {
					setError('No active school year configured.');
					setLoading(false);
					return;
				}
				setActiveSchoolYearId(settings.activeSchoolYearId);
				await loadSummary(settings.activeSchoolYearId, statusFilter, decisionFilter);
			} catch {
				setError('Failed to load school-year settings.');
				setLoading(false);
			}
		})();
	}, [decisionFilter, loadSummary, statusFilter]);

	useEffect(() => {
		if (!activeSchoolYearId) return;
		const token = getPreferredAccessToken();
		if (!token) return;

		const streamUrl = `${import.meta.env.VITE_ATLAS_API ?? '/api/v1'}/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/events?accessToken=${encodeURIComponent(token)}`;
		const source = new EventSource(streamUrl);

		const queueRefresh = () => {
			if (refreshTimeoutRef.current) {
				window.clearTimeout(refreshTimeoutRef.current);
			}
			refreshTimeoutRef.current = window.setTimeout(() => {
				void loadSummary(activeSchoolYearId, statusFilter, decisionFilter);
			}, 180);
		};

		source.addEventListener('ROOM_REQUEST_DRAFT_SAVED', queueRefresh as EventListener);
		source.addEventListener('ROOM_REQUEST_SUBMITTED', queueRefresh as EventListener);
		source.addEventListener('ROOM_REQUEST_DELETED', queueRefresh as EventListener);
		source.addEventListener('ROOM_REQUEST_REVIEWED', queueRefresh as EventListener);

		return () => {
			if (refreshTimeoutRef.current) {
				window.clearTimeout(refreshTimeoutRef.current);
			}
			source.close();
		};
	}, [activeSchoolYearId, decisionFilter, loadSummary, statusFilter]);

	useEffect(() => {
		if (!activeSchoolYearId || !summary?.runId) return;
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
						runId: summary.runId,
						viewMode: 'SCHEDULER_QUEUE',
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
					void loadSummary(activeSchoolYearId, statusFilter, decisionFilter);
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
	}, [activeSchoolYearId, decisionFilter, loadSummary, statusFilter, summary?.runId]);

	const filteredRequests = useMemo(() => {
		const requests = summary?.requests ?? [];
		if (!searchQuery.trim()) return requests;
		const query = searchQuery.toLowerCase();
		return requests.filter((request) =>
			`${request.facultyName} ${request.subjectCode} ${request.sectionName} ${request.requestedRoomName}`.toLowerCase().includes(query),
		);
	}, [searchQuery, summary?.requests]);
	const compactPresence = useMemo(() => {
		const sorted = [...presence].sort((left, right) => right.lastActive.localeCompare(left.lastActive));
		return {
			visible: sorted.slice(0, 3),
			hiddenCount: Math.max(0, sorted.length - 3),
		};
	}, [presence]);
	const presenceByConnection = useMemo(() => new Map(presence.map((person) => [person.connectionId, person])), [presence]);
	const remoteEntrySelectionCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const selection of Object.values(remoteSelections)) {
			if (!selection.entryId) continue;
			counts.set(selection.entryId, (counts.get(selection.entryId) ?? 0) + 1);
		}
		return counts;
	}, [remoteSelections]);
	const remoteEntrySelectionActors = useMemo(() => {
		const details = new Map<string, string[]>();
		for (const [connectionId, selection] of Object.entries(remoteSelections)) {
			if (!selection.entryId) continue;
			const actor = presenceByConnection.get(connectionId)?.email ?? `User ${connectionId.slice(-4)}`;
			const actors = details.get(selection.entryId) ?? [];
			if (!actors.includes(actor)) {
				actors.push(actor);
				details.set(selection.entryId, actors);
			}
		}
		return details;
	}, [presenceByConnection, remoteSelections]);

	const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId) ?? null;
	const scopedPreviewState = useMemo(() => {
		if (!previewState) return null;
		const request = previewState.request as RoomPreferenceSummaryItem & {
			targetDay?: string | null;
			targetStartTime?: string | null;
			targetEndTime?: string | null;
		};
		return {
			...previewState,
			preview: scopePreviewToCandidate(previewState.preview, {
				day: request.targetDay ?? request.day,
				startTime: request.targetStartTime ?? request.startTime,
				endTime: request.targetEndTime ?? request.endTime,
			}),
		};
	}, [previewState]);

	const openPreview = useCallback(async (request: RoomPreferenceSummaryItem) => {
		if (!activeSchoolYearId) return;
		collaborationRef.current?.sendSelection({
			schoolId: DEFAULT_SCHOOL_ID,
			schoolYearId: activeSchoolYearId,
			runId: request.runId,
			day: request.day,
			startTime: request.startTime,
			endTime: request.endTime,
			entryId: request.entryId,
			source: 'REQUEST_CARD',
		});
		setSelectedRequestId(request.id);
		setPreviewLoading(true);
		try {
			const { data } = await atlasApi.post<RoomPreferencePreviewResponse>(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${request.runId}/requests/${request.id}/preview`,
			);
			setPreviewState(data);
			setReviewerNotes(data.request.reviewerNotes ?? '');
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to load room request preview.');
			setSelectedRequestId(null);
			setPreviewState(null);
		} finally {
			setPreviewLoading(false);
		}
	}, [activeSchoolYearId]);

	const reviewRequest = async (decisionStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_FOLLOW_UP') => {
		if (!activeSchoolYearId || !scopedPreviewState || !summary) return;
		setSavingDecision(true);
		try {
			await atlasApi.patch(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${scopedPreviewState.request.runId}/requests/${scopedPreviewState.request.id}/review`,
				{
					decisionStatus,
					reviewerNotes: reviewerNotes || null,
					expectedRunVersion: summary.runVersion,
					requestVersion: scopedPreviewState.request.version,
				},
			);
			toast.success(decisionStatus === 'APPROVED'
				? 'Room request approved.'
				: decisionStatus === 'NEEDS_FOLLOW_UP'
					? 'Room request marked for follow-up.'
					: 'Room request rejected.');
			await loadSummary(activeSchoolYearId, statusFilter, decisionFilter);
			setSelectedRequestId(null);
			setPreviewState(null);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			toast.error(message ?? 'Failed to review room request.');
		} finally {
			setSavingDecision(false);
		}
	};

	if (loading && !summary) {
		return (
			<div className='p-6 space-y-4'>
				<Skeleton className='h-10 w-64' />
				<Skeleton className='h-16 w-full rounded-2xl' />
				{Array.from({ length: 5 }).map((_, index) => (
					<Skeleton key={index} className='h-24 w-full rounded-2xl' />
				))}
			</div>
		);
	}

	if (error && !summary) {
		return (
			<div className='p-6'>
				<Card>
					<CardContent className='flex items-center gap-3 py-8'>
						<AlertCircle className='size-5 text-destructive shrink-0' />
						<div>
							<p className='font-medium text-destructive'>Cannot load room requests</p>
							<p className='text-sm text-muted-foreground mt-1'>{error}</p>
						</div>
						<Button variant='outline' size='sm' className='ml-auto' onClick={() => activeSchoolYearId && void loadSummary(activeSchoolYearId, statusFilter, decisionFilter)}>
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
				<div className='flex flex-wrap items-center gap-3'>
					<div>
						<h1 className='text-2xl font-semibold tracking-tight'>Officer Room Request Queue</h1>
						<p className='text-sm text-muted-foreground'>Review faculty room requests against the draft timetable before committing room changes into the active run.</p>
					</div>
					<Button variant='outline' size='sm' className='ml-auto' onClick={() => activeSchoolYearId && void loadSummary(activeSchoolYearId, statusFilter, decisionFilter)}>
						<RefreshCw className='mr-1.5 size-4' /> Refresh
					</Button>
				</div>

				<div className='flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm'>
					<span className='font-medium text-foreground'>Run #{summary?.runId}</span>
					<span className='text-muted-foreground'>Version {summary?.runVersion}</span>
					<span className='text-border/60'>•</span>
					<span className='text-muted-foreground'>{summary?.counts.total ?? 0} requests</span>
					<span className='text-border/60'>•</span>
					<span className='text-muted-foreground'>{summary?.counts.pending ?? 0} pending</span>
					<span className='text-border/60'>•</span>
					<span className='text-muted-foreground'>{summary?.counts.approved ?? 0} approved</span>
					<span className='text-border/60'>•</span>
					<span className='text-muted-foreground'>{summary?.counts.rejected ?? 0} rejected</span>
					{collaborationConnected && compactPresence.visible.length === 0 && (
						<>
							<span className='text-border/60'>•</span>
							<span className='text-muted-foreground'>No active collaborators yet</span>
						</>
					)}
					{!collaborationConnected && (
						<>
							<span className='text-border/60'>•</span>
							<span className='text-muted-foreground'>Realtime disconnected; SSE updates remain active</span>
							{collaborationLastError && <span className='text-muted-foreground'>({collaborationLastError})</span>}
						</>
					)}
					{compactPresence.visible.length > 0 && (
						<>
							<span className='text-border/60'>•</span>
							<div className='flex items-center gap-1'>
								{compactPresence.visible.map((person) => {
									const label = person.email ?? `${person.role} #${person.userId}`;
									const initials = label.slice(0, 2).toUpperCase();
									return (
										<Badge key={person.connectionId} variant='outline' className='gap-1'>
											<span className='inline-flex size-4 items-center justify-center rounded-full border border-current text-[0.55rem]'>
												{initials}
											</span>
											{person.viewMode === 'FACULTY_ACTIVE_DRAFT' ? 'Draft' : 'Queue'}
										</Badge>
									);
								})}
								{compactPresence.hiddenCount > 0 && <Badge variant='outline'>+{compactPresence.hiddenCount}</Badge>}
							</div>
						</>
					)}
				</div>

				<div className='flex flex-wrap items-center gap-3'>
					<div className='flex min-w-55 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2'>
						<Search className='size-4 text-muted-foreground' />
						<Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder='Search faculty, subject, section, or room' className='border-0 bg-transparent px-0 shadow-none focus-visible:ring-0' />
					</div>
					<Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | RoomPreferenceStatus)}>
						<SelectTrigger className='w-45'><SelectValue placeholder='Submission status' /></SelectTrigger>
						<SelectContent>
							<SelectItem value='ALL'>All submissions</SelectItem>
							<SelectItem value='DRAFT'>Draft</SelectItem>
							<SelectItem value='SUBMITTED'>Submitted</SelectItem>
						</SelectContent>
					</Select>
					<Select value={decisionFilter} onValueChange={(value) => setDecisionFilter(value as 'ALL' | RoomPreferenceDecisionStatus)}>
						<SelectTrigger className='w-45'><SelectValue placeholder='Decision status' /></SelectTrigger>
						<SelectContent>
							<SelectItem value='ALL'>All decisions</SelectItem>
							<SelectItem value='PENDING'>Pending</SelectItem>
							<SelectItem value='APPROVED'>Approved</SelectItem>
							<SelectItem value='REJECTED'>Rejected</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className='flex-1 min-h-0 overflow-visible px-6 pb-6 md:overflow-auto'>
				<div className='space-y-3'>
					{filteredRequests.map((request) => (
						(() => {
							const liveActors = remoteEntrySelectionActors.get(request.entryId) ?? [];
							const liveCount = remoteEntrySelectionCounts.get(request.entryId) ?? 0;
							const hasLiveFocus = liveCount > 0;
							return (
						<button
							type='button'
							key={request.id}
							onClick={() => void openPreview(request)}
							className={`w-full rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:border-primary/40 ${hasLiveFocus ? 'ring-2 ring-amber-300/80 border-amber-300/80' : ''}`}
						>
							<div className='flex flex-wrap items-start justify-between gap-3'>
								<div className='space-y-2'>
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='outline'>{request.subjectCode}</Badge>
										{decisionBadge(request.decisionStatus)}
										{liveCount > 0 && (
											<Badge variant='outline'>Live {liveCount}</Badge>
										)}
									</div>
									<p className='font-semibold text-foreground'>{request.facultyName}</p>
									<p className='text-sm text-muted-foreground'>{request.sectionName} • {request.day.slice(0, 3)} • {formatTime(request.startTime)} - {formatTime(request.endTime)}</p>
									{liveActors.length > 0 && (
										<p className='text-xs text-amber-700'>
											Focused by {liveActors.slice(0, 2).join(', ')}{liveActors.length > 2 ? ` +${liveActors.length - 2}` : ''}
										</p>
									)}
								</div>
								<div className='space-y-1 text-right text-xs text-muted-foreground'>
									<p>{request.currentRoomName}</p>
									<p className='text-primary'>→ {request.requestedRoomName}</p>
								</div>
							</div>
							{request.rationale && <p className='mt-3 text-sm text-muted-foreground'>{request.rationale}</p>}
						</button>
							);
						})()
					))}
					{filteredRequests.length === 0 && (
						<div className='rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground'>No room requests match the current filters.</div>
					)}
				</div>
			</div>

			<Sheet open={selectedRequestId != null} onOpenChange={(open) => { if (!open) { setSelectedRequestId(null); setPreviewState(null); } }}>
				<SheetContent className='w-full sm:max-w-2xl'>
					<SheetHeader>
						<SheetTitle>Room Request Review</SheetTitle>
						<SheetDescription>Preview the exact room change before approving it into the active draft.</SheetDescription>
					</SheetHeader>

					{previewLoading && (
						<div className='mt-6 space-y-3'>
							<Skeleton className='h-20 w-full rounded-2xl' />
							<Skeleton className='h-40 w-full rounded-2xl' />
						</div>
					)}

					{!previewLoading && scopedPreviewState && (
						<div className='mt-6 space-y-4'>
							<div className='rounded-2xl border border-border bg-card p-4'>
								<div className='flex flex-wrap items-center gap-2'>
									<Badge variant='outline'>{scopedPreviewState.request.subjectCode}</Badge>
									{decisionBadge(scopedPreviewState.request.decisionStatus)}
								</div>
								<p className='mt-3 font-semibold text-foreground'>{scopedPreviewState.request.facultyName}</p>
								<p className='text-sm text-muted-foreground'>{scopedPreviewState.request.sectionName} • {scopedPreviewState.request.day.slice(0, 3)} • {formatTime(scopedPreviewState.request.startTime)} - {formatTime(scopedPreviewState.request.endTime)}</p>
								<p className='mt-3 text-sm text-muted-foreground'>Current room: {scopedPreviewState.request.currentRoomName}</p>
								<p className='text-sm text-primary'>Requested room: {scopedPreviewState.request.requestedRoomName}</p>
								{scopedPreviewState.request.rationale && <p className='mt-3 text-sm text-muted-foreground'>{scopedPreviewState.request.rationale}</p>}
							</div>

							<div className='rounded-2xl border border-border bg-card p-4'>
								<p className='text-xs uppercase tracking-wide text-muted-foreground'>Request visualization</p>
								<div className='mt-2 grid gap-2 sm:grid-cols-2'>
									<div className='rounded-lg border border-border bg-muted/30 px-3 py-2'>
										<p className='text-[0.7rem] font-medium text-muted-foreground'>Before</p>
										<p className='text-sm font-semibold text-foreground'>{scopedPreviewState.request.day.slice(0, 3)} {formatTime(scopedPreviewState.request.startTime)} - {formatTime(scopedPreviewState.request.endTime)}</p>
										<p className='text-xs text-muted-foreground'>{scopedPreviewState.request.currentRoomName}</p>
									</div>
									<div className='rounded-lg border border-primary/30 bg-primary/5 px-3 py-2'>
										<p className='text-[0.7rem] font-medium text-muted-foreground'>After request</p>
										<p className='text-sm font-semibold text-foreground'>{scopedPreviewState.request.day.slice(0, 3)} {formatTime(scopedPreviewState.request.startTime)} - {formatTime(scopedPreviewState.request.endTime)}</p>
										<p className='text-xs text-primary'>{scopedPreviewState.request.requestedRoomName}</p>
									</div>
								</div>
							</div>

							<div className='grid gap-3 sm:grid-cols-4'>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Allowed</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{scopedPreviewState.preview.allowed ? 'Yes' : 'No'}</p>
								</div>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Hard Δ</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{scopedPreviewState.preview.violationDelta.hardBefore} → {scopedPreviewState.preview.violationDelta.hardAfter}</p>
								</div>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Soft Δ</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{scopedPreviewState.preview.violationDelta.softBefore} → {scopedPreviewState.preview.violationDelta.softAfter}</p>
								</div>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Affected</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{scopedPreviewState.preview.affectedEntries.length}</p>
								</div>
							</div>

							<div className='rounded-2xl border border-border bg-card p-4'>
								<p className='font-semibold text-foreground'>Conflict Summary</p>
								<div className='mt-3 space-y-2'>
									{scopedPreviewState.preview.humanConflicts.length > 0 ? scopedPreviewState.preview.humanConflicts.map((conflict, index) => (
										<div key={`${conflict.code}-${conflict.humanTitle}-${index}`} className='rounded-xl border border-border px-3 py-2 text-sm'>
											<p className='font-medium text-foreground'>{conflict.humanTitle}</p>
											<p className='mt-1 text-muted-foreground'>{conflict.humanDetail}</p>
										</div>
									)) : <p className='text-sm text-muted-foreground'>No human-readable conflicts were detected for this room change.</p>}
								</div>
							</div>

							<div className='pb-24'>
								<Textarea value={reviewerNotes} onChange={(event) => setReviewerNotes(event.target.value)} placeholder='Add an officer note for the faculty member or review log.' className='min-h-28' />
							</div>

							<div className='sticky bottom-0 z-10 -mx-1 border-t border-border bg-background/95 px-1 py-3 backdrop-blur'>
								<div className='flex flex-wrap items-center justify-end gap-2'>
								<Button variant='outline' onClick={() => void reviewRequest('NEEDS_FOLLOW_UP')} disabled={savingDecision}>
									{savingDecision ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <ClipboardList className='mr-1.5 size-4' />} Needs follow-up
								</Button>
								<Button variant='outline' onClick={() => void reviewRequest('REJECTED')} disabled={savingDecision}>
									{savingDecision ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <XCircle className='mr-1.5 size-4' />} Reject
								</Button>
								<Button onClick={() => void reviewRequest('APPROVED')} disabled={savingDecision || !scopedPreviewState.preview.allowed}>
									{savingDecision ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <CheckCircle2 className='mr-1.5 size-4' />} Approve
								</Button>
								</div>
							</div>
						</div>
					)}

					{!previewLoading && !previewState && selectedRequest && (
						<div className='mt-6 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground'>
							<ClipboardList className='mx-auto mb-3 size-5' />
							Preview is unavailable for this request.
						</div>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}