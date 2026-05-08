import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, MapPin, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type { FacultyRoomPreferenceEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;

type MyDashboardResponse = {
	faculty: {
		id: number;
		name: string;
	};
	phase: string;
	phaseMessage: string;
	fallbackBanner: {
		show: boolean;
		title: string;
		message: string;
		runId?: number;
		generatedAt?: string | null;
	};
	schedulePreview: {
		runId: number | null;
		runVersion: number | null;
		entries: FacultyRoomPreferenceEntry[];
		counts: {
			total: number;
			pending: number;
			approved: number;
			rejected: number;
			unchanged: number;
		};
	};
	statuses: {
		requestStatusLabel: string;
		reviewStatusLabel: string;
	};
};

function entryOutcomeBadge(entry: FacultyRoomPreferenceEntry) {
	if (entry.decisionStatus === 'APPROVED') return <Badge variant='success'>Final approved</Badge>;
	if (entry.decisionStatus === 'REJECTED') return <Badge variant='warning'>Final rejected</Badge>;
	if (entry.status === 'SUBMITTED') return <Badge variant='secondary'>Pending review</Badge>;
	if (entry.requestedRoomId) return <Badge variant='outline'>Draft request</Badge>;
	return <Badge variant='secondary'>Current assigned</Badge>;
}

export default function MyDashboard() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dashboard, setDashboard] = useState<MyDashboardResponse | null>(null);

	const loadDashboard = async () => {
		setLoading(true);
		try {
			const settings = await fetchPublicSettings();
			if (!settings.activeSchoolYearId) {
				setError('No active school year configured.');
				setLoading(false);
				return;
			}
			const { data } = await atlasApi.get<MyDashboardResponse>(`/faculty-portal/${DEFAULT_SCHOOL_ID}/${settings.activeSchoolYearId}/dashboard`);
			setDashboard(data);
			setError(null);
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setError(message ?? 'Unable to load your faculty dashboard.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadDashboard();
	}, []);

	const previewEntries = useMemo(() => {
		if (!dashboard) return [];
		return dashboard.schedulePreview.entries.slice(0, 10);
	}, [dashboard]);

	if (loading) {
		return (
			<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden'>
				<div className='flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6'>
					<div className='space-y-3'>
						<Skeleton className='h-20 w-full rounded-2xl' />
						<Skeleton className='h-24 w-full rounded-2xl' />
						<Skeleton className='h-72 w-full rounded-2xl' />
					</div>
				</div>
			</div>
		);
	}

	if (error || !dashboard) {
		return (
			<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden'>
				<div className='flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6'>
					<Card className='rounded-2xl'>
						<CardContent className='flex items-start gap-3 py-6'>
							<AlertTriangle className='mt-0.5 size-5 text-destructive shrink-0' />
							<div className='min-w-0'>
								<p className='font-semibold text-destructive'>My Dashboard unavailable</p>
								<p className='mt-1 text-sm text-muted-foreground'>{error ?? 'Unexpected error.'}</p>
							</div>
							<Button variant='outline' size='sm' className='ml-auto' onClick={() => void loadDashboard()}>
								<RefreshCcw className='mr-1.5 size-4' /> Retry
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden'>
			<div className='flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6'>
				<div className='mx-auto w-full max-w-4xl space-y-4'>
					<div className='rounded-2xl border border-border bg-card px-4 py-4 shadow-sm'>
						<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>My Portal</p>
						<h1 className='mt-2 text-xl font-semibold tracking-tight'>Hello, {dashboard.faculty.name}</h1>
						<p className='mt-1 text-sm text-muted-foreground'>{dashboard.phaseMessage}</p>
					</div>

					{dashboard.fallbackBanner.show && (
						<div className='rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4'>
							<div className='flex items-start gap-3'>
								<AlertTriangle className='mt-0.5 size-5 text-amber-700 shrink-0' />
								<div>
									<p className='font-semibold text-amber-900'>{dashboard.fallbackBanner.title}</p>
									<p className='mt-1 text-sm text-amber-800'>{dashboard.fallbackBanner.message}</p>
									{dashboard.fallbackBanner.runId && (
										<p className='mt-2 text-xs text-amber-800'>
											Run #{dashboard.fallbackBanner.runId}
											{dashboard.fallbackBanner.generatedAt ? ` • Generated ${new Date(dashboard.fallbackBanner.generatedAt).toLocaleString()}` : ''}
										</p>
									)}
								</div>
							</div>
						</div>
					)}

					<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
						<Card className='rounded-2xl'>
							<CardContent className='py-4'>
								<p className='text-xs text-muted-foreground'>Scheduled Classes</p>
								<p className='mt-2 text-2xl font-semibold'>{dashboard.schedulePreview.counts.total}</p>
							</CardContent>
						</Card>
						<Card className='rounded-2xl'>
							<CardContent className='py-4'>
								<p className='text-xs text-muted-foreground'>Pending Requests</p>
								<p className='mt-2 text-2xl font-semibold'>{dashboard.schedulePreview.counts.pending}</p>
							</CardContent>
						</Card>
						<Card className='rounded-2xl'>
							<CardContent className='py-4'>
								<p className='text-xs text-muted-foreground'>Approved</p>
								<p className='mt-2 text-2xl font-semibold text-emerald-700'>{dashboard.schedulePreview.counts.approved}</p>
							</CardContent>
						</Card>
						<Card className='rounded-2xl'>
							<CardContent className='py-4'>
								<p className='text-xs text-muted-foreground'>Rejected</p>
								<p className='mt-2 text-2xl font-semibold text-amber-700'>{dashboard.schedulePreview.counts.rejected}</p>
							</CardContent>
						</Card>
					</div>

					<Card className='rounded-2xl'>
						<CardHeader className='pb-3'>
							<div className='flex items-center justify-between gap-2'>
								<div>
									<CardTitle className='text-lg'>Schedule Preview</CardTitle>
									<p className='mt-1 text-sm text-muted-foreground'>
										View your current room assignment, pending request overlay, and final review result.
									</p>
								</div>
								<Button asChild size='sm'>
									<Link to='/my/room-preferences'>
										Manage room requests <ArrowRight className='ml-1.5 size-4' />
									</Link>
								</Button>
							</div>
						</CardHeader>
						<CardContent className='space-y-3'>
							{previewEntries.length === 0 && (
								<div className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
									No generated entries are available yet.
								</div>
							)}
							{previewEntries.map((entry) => (
								<div key={entry.entryId} className='rounded-xl border border-border px-3 py-3'>
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='outline'>{entry.subjectCode}</Badge>
										{entryOutcomeBadge(entry)}
									</div>
									<p className='mt-2 text-sm font-semibold text-foreground'>{entry.sectionName}</p>
									<p className='mt-1 text-xs text-muted-foreground flex items-center gap-1.5'>
										<CalendarClock className='size-3.5' />
										{entry.day.slice(0, 3)} • {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
									</p>
									<div className='mt-2 grid gap-2 text-xs sm:grid-cols-3'>
										<div className='rounded-lg bg-muted/40 px-2 py-2'>
											<p className='font-semibold text-muted-foreground'>Current assigned</p>
											<p className='mt-1 text-foreground'>{entry.currentRoomName}</p>
										</div>
										<div className='rounded-lg bg-primary/5 px-2 py-2'>
											<p className='font-semibold text-primary'>Pending request</p>
											<p className='mt-1 text-foreground'>{entry.requestedRoomName ?? 'No pending room change'}</p>
										</div>
										<div className='rounded-lg bg-emerald-50 px-2 py-2'>
											<p className='font-semibold text-emerald-700'>Final review</p>
											<p className='mt-1 text-foreground'>
												{entry.decisionStatus === 'APPROVED'
													? entry.requestedRoomName ?? 'Approved'
													: entry.decisionStatus === 'REJECTED'
														? entry.currentRoomName
														: 'Awaiting review'}
											</p>
										</div>
									</div>
									{entry.reviewerNotes && (
										<p className='mt-2 text-xs text-muted-foreground'>Reviewer note: {entry.reviewerNotes}</p>
									)}
								</div>
							))}
						</CardContent>
					</Card>

					<div className='grid gap-3 sm:grid-cols-2'>
						<Card className='rounded-2xl'>
							<CardContent className='py-4'>
								<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Request Status</p>
								<p className='mt-2 text-sm font-medium'>{dashboard.statuses.requestStatusLabel}</p>
							</CardContent>
						</Card>
						<Card className='rounded-2xl'>
							<CardContent className='py-4'>
								<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Review Status</p>
								<p className='mt-2 text-sm font-medium'>{dashboard.statuses.reviewStatusLabel}</p>
							</CardContent>
						</Card>
					</div>

					<div className='rounded-2xl border border-border bg-card px-4 py-4'>
						<div className='flex flex-wrap items-center justify-between gap-2'>
							<div className='min-w-0'>
								<p className='text-sm font-semibold text-foreground'>Next step</p>
								<p className='text-xs text-muted-foreground'>Submit or update room preference requests from My Room Requests.</p>
							</div>
							<Button asChild variant='outline' size='sm'>
								<Link to='/my/room-preferences'>
									<MapPin className='mr-1.5 size-4' /> Go to room requests
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
