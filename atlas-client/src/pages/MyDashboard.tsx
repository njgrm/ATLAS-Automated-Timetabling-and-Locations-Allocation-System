import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { buildFacultyCacheKey, isLikelyOfflineError, readFacultySnapshot, writeFacultySnapshot } from '@/lib/faculty-offline-cache';
import type { FacultyRoomPreferenceEntry } from '@/types';
import type { FacultyTeachingAssignmentIdentity } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import FacultyGlobalHeader from '@/components/faculty-shared/FacultyGlobalHeader';
import MobileDashboardLayout from '@/components/faculty-dashboard/MobileDashboardLayout';
import DesktopDashboardLayout from '@/components/faculty-dashboard/DesktopDashboardLayout';

const DEFAULT_SCHOOL_ID = 1;
const DASHBOARD_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
	teachingAssignments: FacultyTeachingAssignmentIdentity[];
	statuses: {
		requestStatusLabel: string;
		reviewStatusLabel: string;
	};
};

import { CheckCircle2, XCircle, Eye, Clock, FileEdit } from 'lucide-react';

// ... (keep resolveSchoolYearContext)

function entryOutcomeBadge(entry: FacultyRoomPreferenceEntry) {
	if (entry.decisionStatus === 'APPROVED') return <Badge variant='success' className='text-xs h-5 px-1.5 gap-1'><CheckCircle2 className="size-3" /> Approved</Badge>;
	if (entry.decisionStatus === 'REJECTED') return <Badge variant='destructive' className='text-xs h-5 px-1.5 gap-1'><XCircle className="size-3" /> Rejected</Badge>;
	if (entry.status === 'SUBMITTED') return <Badge variant='secondary' className='text-xs h-5 px-1.5 gap-1'><Clock className="size-3" /> Review</Badge>;
	if (entry.requestedRoomId) return <Badge variant='outline' className='text-xs h-5 px-1.5 gap-1'><FileEdit className="size-3" /> Draft</Badge>;
	return <Badge variant='outline' className='text-xs h-5 px-1.5 text-muted-foreground/60 gap-1'><Eye className="size-3" /> Live</Badge>;
}

export default function MyDashboard() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dashboard, setDashboard] = useState<MyDashboardResponse | null>(null);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [usingCachedDashboard, setUsingCachedDashboard] = useState(false);
	const [cachedDashboardAt, setCachedDashboardAt] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);
	const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);

	const loadDashboard = async () => {
		setLoading(true);
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
			const schoolYearId = schoolYearContext.activeSchoolYearId;
			const cacheKey = buildFacultyCacheKey('dashboard', DEFAULT_SCHOOL_ID, schoolYearId);
			const cachedSnapshot = readFacultySnapshot<MyDashboardResponse>(cacheKey, {
				maxAgeMs: DASHBOARD_CACHE_MAX_AGE_MS,
				validate: (value): value is MyDashboardResponse => {
					if (!value || typeof value !== 'object') return false;
					const candidate = value as Partial<MyDashboardResponse>;
					return Boolean(candidate.faculty && typeof candidate.phaseMessage === 'string' && candidate.schedulePreview);
				},
			});
			setSchoolYearNotice(
				schoolYearContext.source === 'atlas' && !schoolYearContext.stale
					? null
					: schoolYearContext.activeSchoolYearLabel
					? `Working from saved ATLAS school-year context (${schoolYearContext.activeSchoolYearLabel}).`
					: 'Working from saved ATLAS school-year context.',
			);

			try {
				const { data } = await atlasApi.get<MyDashboardResponse>(`/faculty-portal/${DEFAULT_SCHOOL_ID}/${schoolYearId}/dashboard`);
				setDashboard(data);
				setUsingCachedDashboard(false);
				setCachedDashboardAt(null);
				writeFacultySnapshot(cacheKey, data);
				setError(null);
			} catch (err) {
				if (cachedSnapshot && isLikelyOfflineError(err)) {
					setDashboard(cachedSnapshot.data);
					setUsingCachedDashboard(true);
					setCachedDashboardAt(cachedSnapshot.cachedAt);
					setError(null);
					return;
				}

				const payload = (err as { response?: { data?: { message?: string; actionHint?: string } } })?.response?.data;
				const message = [payload?.message, payload?.actionHint].filter(Boolean).join(' ');
				setError(message ?? 'Unable to load your faculty dashboard.');
			}
		} catch (err) {
			const payload = (err as { response?: { data?: { message?: string; actionHint?: string } } })?.response?.data;
			const message = [payload?.message, payload?.actionHint].filter(Boolean).join(' ');
			setError(message ?? "We couldn't load your school-year context from ATLAS.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadDashboard();
	}, []);

	useEffect(() => {
		const updateOnline = () => setOnline(navigator.onLine);
		const media = window.matchMedia('(max-width: 1023px)');
		const updateMedia = (e: MediaQueryListEvent) => setIsMobile(e.matches);

		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		media.addEventListener('change', updateMedia);

		return () => {
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
			media.removeEventListener('change', updateMedia);
		};
	}, []);

	const advisory = useMemo(() => {
		if (!dashboard) return undefined;

		if (usingCachedDashboard) {
			const savedAt = cachedDashboardAt ? new Date(cachedDashboardAt).toLocaleString() : null;
			return {
				title: 'Saved dashboard view',
				message: savedAt
					? `Live dashboard is unavailable. Showing your last saved data from ${savedAt}.`
					: 'Live dashboard is unavailable. Showing your last saved data.',
				variant: 'warning' as const,
			};
		}
		
		if (dashboard.fallbackBanner.show) {
			return {
				title: 'Limited visibility',
				message: dashboard.fallbackBanner.message,
				variant: 'warning' as const
			};
		}

		if (dashboard.runContext.state === 'NO_ACTIVE_DRAFT') {
			return {
				title: 'Schedule preparing',
				message: 'The scheduler has not released a review draft yet. Check back later.',
				variant: 'info' as const
			};
		}

		return {
			title: 'Review in progress',
			message: 'You are viewing a review draft. You can submit room requests now.',
			variant: 'warning' as const
		};
	}, [cachedDashboardAt, dashboard, usingCachedDashboard]);

	const dashboardStep = useMemo(() => {
		if (!dashboard) return 1;
		if (dashboard.runContext.state === 'NO_ACTIVE_DRAFT') return 1;
		if (dashboard.schedulePreview.counts.pending > 0) return 3;
		return 2;
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
					<Card className='rounded-2xl border-destructive/20'>
						<CardContent className='flex items-start gap-4 py-8'>
							<AlertTriangle className='mt-1 size-6 text-destructive shrink-0' />
							<div className='flex-1 min-w-0'>
								<p className='text-lg font-bold text-destructive'>Dashboard unavailable</p>
								<p className='mt-1 text-sm text-muted-foreground leading-relaxed'>{error ?? 'Unexpected error occurred while loading your data.'}</p>
								<Button variant='outline' size='sm' className='mt-4 rounded-xl' onClick={() => void loadDashboard()}>
									<RefreshCcw className='mr-2 size-4' /> Retry Loading
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background'>
			<FacultyGlobalHeader
				title='Faculty Portal'
				subtitle='Track your class assignments and request room changes.'
				steps={[
					{ id: 1, label: '1 Review' },
					{ id: 2, label: '2 Request' },
					{ id: 3, label: '3 Decision' },
				]}
				activeStep={dashboardStep}
				online={online}
				syncState={usingCachedDashboard ? 'failed' : online ? 'idle' : 'queued-offline'}
				realtimeConnected={true}
				advisory={advisory}
				onRetryFailed={usingCachedDashboard ? () => void loadDashboard() : undefined}
			>
				{schoolYearNotice && (
					<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-900 uppercase tracking-tight'>
						{schoolYearNotice}
					</div>
				)}
			</FacultyGlobalHeader>

			<div className='flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6 sm:py-8'>
				<div className='max-w-7xl mx-auto h-full'>
					{isMobile ? (
						<MobileDashboardLayout
							facultyName={dashboard.faculty.name}
							phaseMessage={dashboard.phaseMessage}
							counts={dashboard.schedulePreview.counts}
							schedulePreview={dashboard.schedulePreview.entries}
							teachingAssignments={dashboard.teachingAssignments}
							renderEntryBadge={entryOutcomeBadge}
						/>
					) : (
						<DesktopDashboardLayout
							facultyName={dashboard.faculty.name}
							phaseMessage={dashboard.phaseMessage}
							counts={dashboard.schedulePreview.counts}
							entries={dashboard.schedulePreview.entries}
							teachingAssignments={dashboard.teachingAssignments}
							renderEntryBadge={entryOutcomeBadge}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
