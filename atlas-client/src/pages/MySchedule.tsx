import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Clock3, MapPin, RefreshCcw, School, Users } from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { cacheFacultyIdentity, readCachedFacultyIdentity } from '@/lib/faculty-identity-cache';
import { buildFacultyCacheKey, isLikelyOfflineError, readFacultySnapshot, writeFacultySnapshot } from '@/lib/faculty-offline-cache';
import FacultyGlobalHeader from '@/components/faculty-shared/FacultyGlobalHeader';
import { PublishedTimetableMatrix, formatShortTime } from '@/components/published-schedule/PublishedTimetableMatrix';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;
const SCHEDULE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

type PublishedFacultyScheduleEntry = {
	entryId: string;
	day: (typeof DAY_ORDER)[number] | string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	subject: {
		id: number;
		code: string;
		name: string;
	};
	section: {
		id: number;
		name: string;
	};
	faculty: {
		id: number | null;
		name: string;
	};
	room: {
		id: number;
		name: string;
		type: string;
		floor: number | null;
		buildingId: number | null;
		buildingName: string | null;
	};
};

type PublishedFacultySchedulePayload = {
	source: {
		runId: number;
		schoolId: number;
		schoolYearId: number;
		publishedAt: string | null;
		generatedAt: string | null;
	};
	entries: PublishedFacultyScheduleEntry[];
};

type PublishedScheduleSnapshot = {
	facultyId: number;
	payload: PublishedFacultySchedulePayload;
};

function isPublishedScheduleSnapshot(value: unknown): value is PublishedScheduleSnapshot {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<PublishedScheduleSnapshot>;
	return typeof candidate.facultyId === 'number' && Boolean(candidate.payload) && Array.isArray(candidate.payload?.entries);
}

function formatTimestamp(value: string | null): string {
	if (!value) return 'Not available';
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleString();
}

function buildSummary(entries: PublishedFacultyScheduleEntry[]) {
	const sectionNames = new Set(entries.map((entry) => entry.section.name));
	const buildingNames = new Set(entries.map((entry) => entry.room.buildingName).filter(Boolean));
	return {
		classCount: entries.length,
		sectionCount: sectionNames.size,
		buildingCount: buildingNames.size,
	};
}

export default function MySchedule() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [schedule, setSchedule] = useState<PublishedFacultySchedulePayload | null>(null);
	const [usingCachedSchedule, setUsingCachedSchedule] = useState(false);
	const [cachedScheduleAt, setCachedScheduleAt] = useState<string | null>(null);

	const loadSchedule = useCallback(async () => {
		setLoading(true);
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
			const schoolYearId = schoolYearContext.activeSchoolYearId;
			setSchoolYearNotice(
				schoolYearContext.source === 'enrollpro'
					? `Verified with EnrollPro (${schoolYearContext.activeSchoolYearLabel}).`
					: schoolYearContext.source === 'atlas' && !schoolYearContext.stale
						? null
						: schoolYearContext.activeSchoolYearLabel
							? `Working from saved data (${schoolYearContext.activeSchoolYearLabel}).`
							: 'Working from saved data.',
				);

			let resolvedFacultyId: number;
			try {
				const { data } = await atlasApi.get<{ faculty: { id: number } }>('/faculty/me', { params: { schoolId: DEFAULT_SCHOOL_ID } });
				if (!data?.faculty?.id) {
					setError('Your account is not linked to a teacher record in this school.');
					setSchedule(null);
					return;
				}
				resolvedFacultyId = data.faculty.id;
				cacheFacultyIdentity(DEFAULT_SCHOOL_ID, resolvedFacultyId);
			} catch (facultyError) {
				const cachedIdentity = readCachedFacultyIdentity(DEFAULT_SCHOOL_ID);
				if (cachedIdentity && isLikelyOfflineError(facultyError)) {
					resolvedFacultyId = cachedIdentity.facultyId;
					setSchoolYearNotice((current) => current ?? 'Working from your saved account while offline.');
				} else {
					throw facultyError;
				}
			}

			const cacheKey = buildFacultyCacheKey('published-schedule', DEFAULT_SCHOOL_ID, schoolYearId, resolvedFacultyId);
			const cachedSnapshot = readFacultySnapshot<PublishedScheduleSnapshot>(cacheKey, {
				maxAgeMs: SCHEDULE_CACHE_MAX_AGE_MS,
				validate: isPublishedScheduleSnapshot,
			});

			try {
				const { data } = await atlasApi.get<PublishedFacultySchedulePayload>(`/schools/${DEFAULT_SCHOOL_ID}/schedules/published/${schoolYearId}/faculty/${resolvedFacultyId}`);
				setSchedule(data);
				setError(null);
				setUsingCachedSchedule(false);
				setCachedScheduleAt(null);
				writeFacultySnapshot(cacheKey, { facultyId: resolvedFacultyId, payload: data });
			} catch (requestError) {
				if (cachedSnapshot && isLikelyOfflineError(requestError)) {
					setSchedule(cachedSnapshot.data.payload);
					setError(null);
					setUsingCachedSchedule(true);
					setCachedScheduleAt(cachedSnapshot.cachedAt);
					return;
				}

				const responseData = (requestError as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
				if (responseData?.code === 'PUBLISHED_RUN_NOT_FOUND') {
					setSchedule(null);
					setUsingCachedSchedule(false);
					setCachedScheduleAt(null);
					setError('Your published schedule is not available yet. Please wait for the scheduler to publish.');
					return;
				}

				setSchedule(null);
				setUsingCachedSchedule(false);
				setCachedScheduleAt(null);
				setError(responseData?.message ?? 'Unable to load your published schedule.');
			}
		} catch {
			setSchedule(null);
			setUsingCachedSchedule(false);
			setCachedScheduleAt(null);
			setError("We couldn't load your schedule context from ATLAS. Please try again.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSchedule();
	}, [loadSchedule]);

	useEffect(() => {
		const updateOnline = () => setOnline(navigator.onLine);
		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		return () => {
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
		};
	}, []);

	const summary = useMemo(() => buildSummary(schedule?.entries ?? []), [schedule?.entries]);

	const advisory = useMemo(() => {
		if (usingCachedSchedule) {
			const savedAt = cachedScheduleAt ? new Date(cachedScheduleAt).toLocaleString() : null;
			return {
				title: 'Your saved schedule',
				message: savedAt ? `Unable to reach EnrollPro. Showing your saved schedule from ${savedAt}.` : 'Unable to reach EnrollPro. Showing your saved schedule.',
				variant: 'warning' as const,
			};
		}

		if (schedule && schedule.entries.length === 0) {
			return {
				title: 'No classes assigned',
				message: 'A published run exists, but no classes are currently assigned to your account.',
				variant: 'info' as const,
			};
		}

		return {
			title: 'Published schedule view',
			message: 'This page shows your approved published timetable only.',
			variant: 'success' as const,
		};
	}, [cachedScheduleAt, schedule, usingCachedSchedule]);

	if (loading) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6">
					<div className="space-y-3">
						<Skeleton className="h-20 w-full rounded-2xl" />
						<Skeleton className="h-24 w-full rounded-2xl" />
						<Skeleton className="h-[36rem] w-full rounded-2xl" />
					</div>
				</div>
			</div>
		);
	}

	if (error && !schedule) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6">
					<Card className="rounded-2xl border-destructive/20">
						<CardContent className="flex items-start gap-4 py-8">
							<AlertCircle className="mt-1 size-6 text-destructive shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="text-lg font-bold text-destructive">Published schedule unavailable</p>
								<p className="mt-1 text-sm text-muted-foreground leading-relaxed">{error}</p>
								<Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => void loadSchedule()}>
									<RefreshCcw className="mr-2 size-4" /> Retry Loading
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background">
			<FacultyGlobalHeader
				title="My Published Schedule"
				subtitle="Review the timetable that students and teachers can already see."
				online={online}
				syncState={usingCachedSchedule ? 'failed' : online ? 'idle' : 'queued-offline'}
				realtimeConnected={false}
				advisory={advisory}
				onRetryFailed={usingCachedSchedule ? () => void loadSchedule() : undefined}
			>
				{schoolYearNotice && (
					<div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-amber-900">
						{schoolYearNotice}
					</div>
				)}
			</FacultyGlobalHeader>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
				<div className="mx-auto w-full max-w-7xl space-y-4">
					<Card className="rounded-2xl border-border/70">
						<CardContent className="flex flex-wrap items-center gap-3 py-4">
							<div className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
								<CalendarDays className="size-4 text-primary" />
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Published run</p>
									<p className="text-sm font-semibold text-foreground">#{schedule?.source.runId ?? 'N/A'}</p>
								</div>
							</div>
							<div className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
								<School className="size-4 text-primary" />
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">School year</p>
									<p className="text-sm font-semibold text-foreground">S.Y. {schedule?.source.schoolYearId ?? '...'}</p>
								</div>
							</div>
							<div className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
								<Users className="size-4 text-primary" />
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sections</p>
									<p className="text-sm font-semibold text-foreground">{summary.sectionCount}</p>
								</div>
							</div>
							<div className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
								<MapPin className="size-4 text-primary" />
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Buildings</p>
									<p className="text-sm font-semibold text-foreground">{summary.buildingCount}</p>
								</div>
							</div>
							<div className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
								<Clock3 className="size-4 text-primary" />
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Published at</p>
									<p className="text-sm font-semibold text-foreground">{formatTimestamp(schedule?.source.publishedAt ?? null)}</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-2xl border-border/70">
						<CardContent className="py-5">
							<PublishedTimetableMatrix
								entries={schedule?.entries ?? []}
								emptyMessage="A published run exists, but no classes are currently assigned to your account."
								renderEntryDetails={(entry) => (
									<>
										<p className="flex items-center gap-1.5"><Clock3 className="size-3.5 shrink-0" /> {formatShortTime(entry.startTime)} - {formatShortTime(entry.endTime)}</p>
										<p className="flex items-center gap-1.5"><BookOpen className="size-3.5 shrink-0" /> {entry.section.name}</p>
										<p className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" /> {entry.room.name}{entry.room.buildingName ? ` (${entry.room.buildingName})` : ''}</p>
									</>
								)}
							/>
						</CardContent>
					</Card>

					<div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
						<p>Published schedule view</p>
						{usingCachedSchedule ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Saved snapshot</Badge> : <Badge variant="outline">Live publish</Badge>}
					</div>
				</div>
			</div>
		</div>
	);
}
