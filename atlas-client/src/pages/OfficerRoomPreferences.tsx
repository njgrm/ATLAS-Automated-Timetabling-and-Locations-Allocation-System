import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchPublicSettings } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type {
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

	const filteredRequests = useMemo(() => {
		const requests = summary?.requests ?? [];
		if (!searchQuery.trim()) return requests;
		const query = searchQuery.toLowerCase();
		return requests.filter((request) =>
			`${request.facultyName} ${request.subjectCode} ${request.sectionName} ${request.requestedRoomName}`.toLowerCase().includes(query),
		);
	}, [searchQuery, summary?.requests]);

	const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId) ?? null;

	const openPreview = useCallback(async (request: RoomPreferenceSummaryItem) => {
		if (!activeSchoolYearId) return;
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

	const reviewRequest = async (decisionStatus: 'APPROVED' | 'REJECTED') => {
		if (!activeSchoolYearId || !previewState || !summary) return;
		setSavingDecision(true);
		try {
			await atlasApi.patch(
				`/room-preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/${previewState.request.runId}/requests/${previewState.request.id}/review`,
				{
					decisionStatus,
					reviewerNotes: reviewerNotes || null,
					expectedRunVersion: summary.runVersion,
					requestVersion: previewState.request.version,
				},
			);
			toast.success(decisionStatus === 'APPROVED' ? 'Room request approved.' : 'Room request rejected.');
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
		<div className='flex h-[calc(100svh-3.5rem)] flex-col'>
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
				</div>

				<div className='flex flex-wrap items-center gap-3'>
					<div className='flex min-w-[220px] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2'>
						<Search className='size-4 text-muted-foreground' />
						<Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder='Search faculty, subject, section, or room' className='border-0 bg-transparent px-0 shadow-none focus-visible:ring-0' />
					</div>
					<Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | RoomPreferenceStatus)}>
						<SelectTrigger className='w-[180px]'><SelectValue placeholder='Submission status' /></SelectTrigger>
						<SelectContent>
							<SelectItem value='ALL'>All submissions</SelectItem>
							<SelectItem value='DRAFT'>Draft</SelectItem>
							<SelectItem value='SUBMITTED'>Submitted</SelectItem>
						</SelectContent>
					</Select>
					<Select value={decisionFilter} onValueChange={(value) => setDecisionFilter(value as 'ALL' | RoomPreferenceDecisionStatus)}>
						<SelectTrigger className='w-[180px]'><SelectValue placeholder='Decision status' /></SelectTrigger>
						<SelectContent>
							<SelectItem value='ALL'>All decisions</SelectItem>
							<SelectItem value='PENDING'>Pending</SelectItem>
							<SelectItem value='APPROVED'>Approved</SelectItem>
							<SelectItem value='REJECTED'>Rejected</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className='flex-1 min-h-0 overflow-auto px-6 pb-6'>
				<div className='space-y-3'>
					{filteredRequests.map((request) => (
						<button
							type='button'
							key={request.id}
							onClick={() => void openPreview(request)}
							className='w-full rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:border-primary/40'
						>
							<div className='flex flex-wrap items-start justify-between gap-3'>
								<div className='space-y-2'>
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='outline'>{request.subjectCode}</Badge>
										{decisionBadge(request.decisionStatus)}
									</div>
									<p className='font-semibold text-foreground'>{request.facultyName}</p>
									<p className='text-sm text-muted-foreground'>{request.sectionName} • {request.day.slice(0, 3)} • {formatTime(request.startTime)} - {formatTime(request.endTime)}</p>
								</div>
								<div className='space-y-1 text-right text-xs text-muted-foreground'>
									<p>{request.currentRoomName}</p>
									<p className='text-primary'>→ {request.requestedRoomName}</p>
								</div>
							</div>
							{request.rationale && <p className='mt-3 text-sm text-muted-foreground'>{request.rationale}</p>}
						</button>
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

					{!previewLoading && previewState && (
						<div className='mt-6 space-y-4'>
							<div className='rounded-2xl border border-border bg-card p-4'>
								<div className='flex flex-wrap items-center gap-2'>
									<Badge variant='outline'>{previewState.request.subjectCode}</Badge>
									{decisionBadge(previewState.request.decisionStatus)}
								</div>
								<p className='mt-3 font-semibold text-foreground'>{previewState.request.facultyName}</p>
								<p className='text-sm text-muted-foreground'>{previewState.request.sectionName} • {previewState.request.day.slice(0, 3)} • {formatTime(previewState.request.startTime)} - {formatTime(previewState.request.endTime)}</p>
								<p className='mt-3 text-sm text-muted-foreground'>Current room: {previewState.request.currentRoomName}</p>
								<p className='text-sm text-primary'>Requested room: {previewState.request.requestedRoomName}</p>
								{previewState.request.rationale && <p className='mt-3 text-sm text-muted-foreground'>{previewState.request.rationale}</p>}
							</div>

							<div className='grid gap-3 sm:grid-cols-4'>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Allowed</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{previewState.preview.allowed ? 'Yes' : 'No'}</p>
								</div>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Hard Δ</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{previewState.preview.violationDelta.hardBefore} → {previewState.preview.violationDelta.hardAfter}</p>
								</div>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Soft Δ</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{previewState.preview.violationDelta.softBefore} → {previewState.preview.violationDelta.softAfter}</p>
								</div>
								<div className='rounded-2xl border border-border bg-card p-4'>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>Affected</p>
									<p className='mt-2 text-lg font-semibold text-foreground'>{previewState.preview.affectedEntries.length}</p>
								</div>
							</div>

							<div className='rounded-2xl border border-border bg-card p-4'>
								<p className='font-semibold text-foreground'>Conflict Summary</p>
								<div className='mt-3 space-y-2'>
									{previewState.preview.humanConflicts.length > 0 ? previewState.preview.humanConflicts.map((conflict) => (
										<div key={`${conflict.code}-${conflict.humanTitle}`} className='rounded-xl border border-border px-3 py-2 text-sm'>
											<p className='font-medium text-foreground'>{conflict.humanTitle}</p>
											<p className='mt-1 text-muted-foreground'>{conflict.humanDetail}</p>
										</div>
									)) : <p className='text-sm text-muted-foreground'>No human-readable conflicts were detected for this room change.</p>}
								</div>
							</div>

							<Textarea value={reviewerNotes} onChange={(event) => setReviewerNotes(event.target.value)} placeholder='Add an officer note for the faculty member or review log.' className='min-h-28' />

							<div className='flex flex-wrap items-center justify-end gap-2'>
								<Button variant='outline' onClick={() => void reviewRequest('REJECTED')} disabled={savingDecision}>
									{savingDecision ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <XCircle className='mr-1.5 size-4' />} Reject
								</Button>
								<Button onClick={() => void reviewRequest('APPROVED')} disabled={savingDecision || !previewState.preview.allowed}>
									{savingDecision ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <CheckCircle2 className='mr-1.5 size-4' />} Approve
								</Button>
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