import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

import atlasApi from '@/lib/api';
import { fetchPublicSettings, fetchSchoolYears, type SchoolYear } from '@/lib/settings';
import type { FacultyRoomPreferenceEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import PlainLanguageNotice from '@/components/faculty-shared/PlainLanguageNotice';
import StatusRail from '@/components/faculty-shared/StatusRail';
import StepFlowHeader from '@/components/faculty-shared/StepFlowHeader';
import MobileDashboardLayout from '@/components/faculty-dashboard/MobileDashboardLayout';
import DesktopDashboardLayout from '@/components/faculty-dashboard/DesktopDashboardLayout';

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
	if (entry.decisionStatus === 'APPROVED') return <Badge variant='success' className='text-[9px] h-4 px-1'>Approved</Badge>;
	if (entry.decisionStatus === 'REJECTED') return <Badge variant='destructive' className='text-[9px] h-4 px-1'>Rejected</Badge>;
	if (entry.status === 'SUBMITTED') return <Badge variant='secondary' className='text-[9px] h-4 px-1'>Review</Badge>;
	if (entry.requestedRoomId) return <Badge variant='outline' className='text-[9px] h-4 px-1'>Draft</Badge>;
	return <Badge variant='outline' className='text-[9px] h-4 px-1 opacity-50'>Live</Badge>;
}

export default function MyDashboard() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dashboard, setDashboard] = useState<MyDashboardResponse | null>(null);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);
	const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);

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

	const plainLanguageBanner = useMemo(() => {
		if (!dashboard) return null;
		if (dashboard.runContext.state === 'NO_ACTIVE_DRAFT') {
			return {
				title: 'Your schedule is still being prepared.',
				whatHappened: 'The scheduler has not released a review draft for your classes yet.',
				whatNow: 'Check back later. If this takes too long, ask your scheduling officer for an update.',
				whoToContact: 'Your scheduling officer or school IT admin.',
			};
		}

		return {
			title: 'This schedule is still being reviewed.',
			whatHappened: 'You are viewing a review draft while the scheduler finalizes the timetable.',
			whatNow: 'You can submit room requests now. Final schedule will be shared after scheduler approval.',
			whoToContact: 'Your scheduling officer if anything looks incorrect.',
		};
	}, [dashboard]);

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

	const banners = (
		<div className='space-y-4'>
			{plainLanguageBanner && (
				<PlainLanguageNotice
					title={plainLanguageBanner.title}
					whatHappened={plainLanguageBanner.whatHappened}
					whatNow={plainLanguageBanner.whatNow}
					whoToContact={plainLanguageBanner.whoToContact}
				/>
			)}

			{dashboard.fallbackBanner.show && (
				<PlainLanguageNotice
					variant='warning'
					title='Limited data visibility'
					whatHappened={dashboard.fallbackBanner.message}
					whatNow='Some sections of your dashboard might be incomplete until the next sync.'
					whoToContact='School IT Support'
				/>
			)}
		</div>
	);

	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background'>
			{/* Top Nav/Header Area */}
			<div className='shrink-0 px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
				<div className='max-w-7xl mx-auto space-y-4'>
					<StepFlowHeader
						title='Faculty Portal'
						subtitle='Track your class assignments and request room changes.'
						steps={[
							{ id: 1, label: '1 Review' },
							{ id: 2, label: '2 Request' },
							{ id: 3, label: '3 Decision' },
						]}
						activeStep={dashboardStep}
					/>
					<StatusRail
						online={online}
						syncState={online ? 'idle' : 'queued-offline'}
						realtimeConnected={true}
					/>
					{schoolYearNotice && (
						<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-900 uppercase tracking-tight'>
							{schoolYearNotice}
						</div>
					)}
				</div>
			</div>

			{/* Main Layout Workspace */}
			<div className='flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6 sm:py-8'>
				<div className='max-w-7xl mx-auto h-full'>
					{isMobile ? (
						<MobileDashboardLayout
							facultyName={dashboard.faculty.name}
							phaseMessage={dashboard.phaseMessage}
							counts={dashboard.schedulePreview.counts}
							schedulePreview={dashboard.schedulePreview.entries}
							renderEntryBadge={entryOutcomeBadge}
							banners={banners}
						/>
					) : (
						<DesktopDashboardLayout
							facultyName={dashboard.faculty.name}
							phaseMessage={dashboard.phaseMessage}
							counts={dashboard.schedulePreview.counts}
							entries={dashboard.schedulePreview.entries}
							renderEntryBadge={entryOutcomeBadge}
							banners={banners}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

