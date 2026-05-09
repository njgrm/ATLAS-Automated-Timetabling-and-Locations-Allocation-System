import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, MapPin, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

import atlasApi from '@/lib/api';
import { fetchPublicSettings, fetchSchoolYears, type SchoolYear } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type { FacultyRoomPreferenceEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

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

type MyDashboardResponse = {
	faculty: {
		id: number;
		name: string;
	};
	phase: string;
	phaseMessage: string;
	runContext: {
		state: 'ACTIVE_DRAFT' | 'NO_ACTIVE_DRAFT';
		runId: number | null;
		runVersion: number | null;
		generatedAt: string | null;
		reason: string | null;
		recoveryHint: string | null;
	};
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
		generatedAt: string | null;
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
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);

	const loadDashboard = async () => {
		setLoading(true);
		try {
			const [settings, years] = await Promise.all([fetchPublicSettings(), fetchSchoolYears()]);
			const schoolYearContext = resolveSchoolYearContext(settings.activeSchoolYearId, years);
			const schoolYearId = schoolYearContext.schoolYearId;
			setSchoolYearNotice(schoolYearContext.notice);
			const { data } = await atlasApi.get<MyDashboardResponse>(`/faculty-portal/${DEFAULT_SCHOOL_ID}/${schoolYearId}/dashboard`);
			setDashboard(data);
			setError(null);
		} catch (err) {
			const payload = (err as { response?: { data?: { message?: string; actionHint?: string } } })?.response?.data;
			const message = [payload?.message, payload?.actionHint].filter(Boolean).join(' ');
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
					{schoolYearNotice && (
						<div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
							Showing School Year {schoolYearNotice.match(/school year ([^\s.]+)/i)?.[1] ?? '—'}. {schoolYearNotice.includes('No active') ? 'Contact your scheduling officer if this looks wrong.' : ''}
						</div>
					)}

					{/* ── Hero greeting + primary CTA ── */}
					<div className='rounded-2xl border border-border bg-card px-4 py-5 shadow-sm'>
						<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>My Portal</p>
						<h1 className='mt-1.5 text-xl font-semibold tracking-tight'>Hello, {dashboard.faculty.name} 👋</h1>
						<p className='mt-1 text-sm text-muted-foreground'>{dashboard.phaseMessage}</p>
						<Link
							to='/my/room-preferences'
							className='mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors'
						>
							<MapPin className='size-4' />
							Manage My Room Requests
							<ArrowRight className='size-4 ml-auto' />
						</Link>
					</div>

					{dashboard.fallbackBanner.show && (
						<div className='rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4'>
							<div className='flex items-start gap-3'>
								<AlertTriangle className='mt-0.5 size-5 text-amber-700 shrink-0' />
								<div>
									<p className='font-semibold text-amber-900'>{dashboard.runContext.state === 'NO_ACTIVE_DRAFT' ? 'Your schedule is not ready yet' : dashboard.fallbackBanner.title}</p>
									<p className='mt-1 text-sm text-amber-800'>{dashboard.runContext.state === 'NO_ACTIVE_DRAFT' ? "Your schedule isn't ready yet. Please wait for the scheduler to generate the draft." : dashboard.fallbackBanner.message}</p>
									{dashboard.runContext.state === 'NO_ACTIVE_DRAFT' && dashboard.runContext.recoveryHint && (
										<p className='mt-2 text-xs text-amber-900'>{dashboard.runContext.recoveryHint}</p>
									)}
								</div>
							</div>
						</div>
					)}

					{/* ── Compact stats inline ── */}
					{dashboard.schedulePreview.counts.total > 0 && (
						<div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
							<div className='rounded-xl border border-border bg-card px-3 py-3 text-center'>
								<p className='text-2xl font-semibold'>{dashboard.schedulePreview.counts.total}</p>
								<p className='mt-0.5 text-xs text-muted-foreground'>Classes</p>
							</div>
							<div className='rounded-xl border border-border bg-card px-3 py-3 text-center'>
								<p className='text-2xl font-semibold'>{dashboard.schedulePreview.counts.pending}</p>
								<p className='mt-0.5 text-xs text-muted-foreground'>Awaiting decision</p>
							</div>
							<div className='rounded-xl border border-border bg-card px-3 py-3 text-center'>
								<p className='text-2xl font-semibold text-emerald-700'>{dashboard.schedulePreview.counts.approved}</p>
								<p className='mt-0.5 text-xs text-muted-foreground'>Approved</p>
							</div>
							<div className='rounded-xl border border-border bg-card px-3 py-3 text-center'>
								<p className='text-2xl font-semibold text-amber-700'>{dashboard.schedulePreview.counts.rejected}</p>
								<p className='mt-0.5 text-xs text-muted-foreground'>Not approved</p>
							</div>
						</div>
					)}

					{/* ── Simplified schedule preview ── */}
					{previewEntries.length > 0 && (
						<Card className='rounded-2xl'>
							<CardHeader className='pb-2 pt-4 px-4'>
								<CardTitle className='text-base'>Your Classes</CardTitle>
							</CardHeader>
							<CardContent className='px-4 pb-4 space-y-2'>
								{previewEntries.map((entry) => (
									<div key={entry.entryId} className='flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm'>
										<div className='flex-1 min-w-0'>
											<span className='font-semibold text-foreground'>{entry.sectionName}</span>
											<span className='mx-1.5 text-muted-foreground/50'>·</span>
											<span className='text-muted-foreground'>{entry.subjectCode}</span>
											<span className='mx-1.5 text-muted-foreground/50'>·</span>
											<span className='text-xs text-muted-foreground'>{entry.day.slice(0, 3)} {formatTime(entry.startTime)}</span>
										</div>
										{entryOutcomeBadge(entry)}
										{entry.reviewerNotes && (
											<p className='w-full text-xs text-amber-700 mt-1'>Note from officer: {entry.reviewerNotes}</p>
										)}
									</div>
								))}
								<Button asChild variant='outline' size='sm' className='w-full mt-2'>
									<Link to='/my/room-preferences'>
										View full schedule and manage requests <ArrowRight className='ml-1.5 size-4' />
									</Link>
								</Button>
							</CardContent>
						</Card>
					)}

					{previewEntries.length === 0 && (
						<div className='rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
							<CalendarClock className='mx-auto mb-2 size-8 text-muted-foreground/40' />
							<p className='font-medium'>No schedule yet</p>
							<p className='mt-1 text-xs'>Your schedule will appear here once the scheduling officer generates a timetable.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
