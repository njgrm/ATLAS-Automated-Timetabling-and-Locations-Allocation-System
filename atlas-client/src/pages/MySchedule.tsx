import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Clock3, MapPin, Printer, RefreshCcw, Users } from 'lucide-react';

import atlasApi from '@/lib/api';
import { describeSchoolYearSource, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { cacheFacultyIdentity, readCachedFacultyIdentity } from '@/lib/faculty-identity-cache';
import { buildFacultyCacheKey, isLikelyOfflineError, readLatestFacultySnapshotByPrefix, removeFacultySnapshotsByPrefix, writeFacultySnapshot } from '@/lib/faculty-offline-cache';
import { getActionableApiError } from '@/lib/actionable-api-error';
import { buildPublishedScheduleCacheMarker, resolvePublishedScheduleRequestDate } from '@/lib/published-schedule-cache-key';
import FacultyGlobalHeader from '@/components/faculty-shared/FacultyGlobalHeader';
import { PublishedTimetableMatrix, formatShortTime, type PublishedScheduleMatrixEntry } from '@/components/published-schedule/PublishedTimetableMatrix';
import { SmartHelpTrigger, SmartNextStepCard } from '@/components/smart/SmartPageShell';
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
		requestedDate?: string | null;
		resolvedForDate?: string | null;
		activeRevisionId?: number | null;
		activeRevisionEffectiveDate?: string | null;
		revisionMarker?: string | null;
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

function formatRevisionReference(source: PublishedFacultySchedulePayload['source'] | undefined): string {
	if (!source?.activeRevisionId) return 'Base published schedule';
	return `Includes approved changes effective ${formatTimestamp(source.activeRevisionEffectiveDate ?? null)}`;
}

export default function MySchedule() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);
	const [schoolYearNotice, setSchoolYearNotice] = useState<string | null>(null);
	const [schedule, setSchedule] = useState<PublishedFacultySchedulePayload | null>(null);
	const [usingCachedSchedule, setUsingCachedSchedule] = useState(false);
	const [cachedScheduleAt, setCachedScheduleAt] = useState<string | null>(null);
	const [checkingForUpdates, setCheckingForUpdates] = useState(false);

	const loadSchedule = useCallback(async () => {
		setLoading(true);
		setCheckingForUpdates(true);
		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({ forceRefresh: true, verifyUpstream: true, allowStaleOnError: true, allowEnrollProFallback: false });
			const schoolYearId = schoolYearContext.activeSchoolYearId;
			setSchoolYearNotice(describeSchoolYearSource(schoolYearContext));

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

			const requestDate = resolvePublishedScheduleRequestDate();
			const cachePrefix = buildFacultyCacheKey('published-schedule', DEFAULT_SCHOOL_ID, schoolYearId, resolvedFacultyId, 'date', requestDate);
			const cachedSnapshot = readLatestFacultySnapshotByPrefix<PublishedScheduleSnapshot>(cachePrefix, {
				maxAgeMs: SCHEDULE_CACHE_MAX_AGE_MS,
				validate: isPublishedScheduleSnapshot,
			});

			try {
				const { data } = await atlasApi.get<PublishedFacultySchedulePayload>(`/schools/${DEFAULT_SCHOOL_ID}/school-years/${schoolYearId}/schedules/published/faculty/${resolvedFacultyId}`, {
					params: { date: requestDate },
				});
				setSchedule(data);
				setError(null);
				setUsingCachedSchedule(false);
				setCachedScheduleAt(null);
				removeFacultySnapshotsByPrefix(cachePrefix);
				writeFacultySnapshot(`${cachePrefix}:${buildPublishedScheduleCacheMarker(data.source)}`, { facultyId: resolvedFacultyId, payload: data });
			} catch (requestError) {
				if (cachedSnapshot && isLikelyOfflineError(requestError)) {
					setSchedule(cachedSnapshot.data.payload);
					setError(null);
					setUsingCachedSchedule(true);
					setCachedScheduleAt(cachedSnapshot.cachedAt);
					return;
				}

				const responseData = (requestError as { response?: { data?: { code?: string; message?: string; actionHint?: string } } })?.response?.data;
				if (responseData?.code === 'PUBLISHED_RUN_NOT_FOUND') {
					setSchedule(null);
					setUsingCachedSchedule(false);
					setCachedScheduleAt(null);
					setError('Your published schedule is not available yet. Please wait for the scheduler to publish.');
					return;
				}

				if (responseData?.code === 'TERM_FILTER_NOT_READY') {
					setSchedule(null);
					setUsingCachedSchedule(false);
					setCachedScheduleAt(null);
					setError('Term data is not ready yet. Your published schedule will be available once the active term is confirmed by the enrollment system.');
					return;
				}

				setSchedule(null);
				setUsingCachedSchedule(false);
				setCachedScheduleAt(null);
				setError(getActionableApiError(requestError, 'Unable to load your published schedule. Please tap Retry.'));
			}
		} catch {
			setSchedule(null);
			setUsingCachedSchedule(false);
			setCachedScheduleAt(null);
			setError("We couldn't load your schedule context from ATLAS. Please try again.");
		} finally {
			setLoading(false);
			setCheckingForUpdates(false);
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

	const matrixEntries = useMemo<PublishedScheduleMatrixEntry[]>(() => (
		(schedule?.entries ?? []).map((entry) => ({
			entryId: entry.entryId,
			day: entry.day,
			startTime: entry.startTime,
			endTime: entry.endTime,
			durationMinutes: entry.durationMinutes,
			subject: entry.subject,
			section: {
				name: entry.section.name,
				gradeLevelName: null,
				programName: null,
			},
			faculty: entry.faculty,
			room: {
				name: entry.room.name,
				buildingName: entry.room.buildingName,
			},
		}))
	), [schedule?.entries]);

	const advisory = useMemo(() => {
		if (usingCachedSchedule) {
			const savedAt = cachedScheduleAt ? new Date(cachedScheduleAt).toLocaleString() : null;
			return {
				title: 'Showing latest saved schedule',
				message: savedAt ? `Waiting for connection. Showing the schedule saved on this device from ${savedAt}.` : 'Waiting for connection. Showing the schedule saved on this device.',
				variant: 'warning' as const,
			};
		}

		if (checkingForUpdates) {
			return {
				title: 'Checking for updates',
				message: 'We are checking whether your published schedule has changed.',
				variant: 'info' as const,
			};
		}

		if (schedule && schedule.entries.length === 0) {
			return {
				title: 'No classes assigned',
				message: 'A published schedule exists, but no classes are currently assigned to your account.',
				variant: 'info' as const,
			};
		}

		return {
			title: 'Showing latest saved schedule',
			message: 'This page shows your approved published timetable for today.',
			variant: 'success' as const,
		};
	}, [cachedScheduleAt, checkingForUpdates, schedule, usingCachedSchedule]);

	if (loading) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6">
					<div className="space-y-3">
						<Skeleton className="h-20 w-full rounded-2xl" />
						<Skeleton className="h-24 w-full rounded-2xl" />
						<Skeleton className="h-144 w-full rounded-2xl" />
					</div>
				</div>
			</div>
		);
	}

	if (error && !schedule) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6">
					<div className="mx-auto max-w-2xl">
						<div className="rounded-2xl border border-destructive/20 bg-card px-6 py-8 text-center shadow-sm">
							<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
								<AlertCircle className="size-6" />
							</div>
							<p className="text-lg font-bold text-destructive">Schedule unavailable</p>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-md mx-auto">{error}</p>
							<Button variant="outline" size="sm" className="mt-5 h-9 rounded-xl" onClick={() => void loadSchedule()}>
								<RefreshCcw className="mr-2 size-4" /> Retry
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-muted/30">
			<FacultyGlobalHeader
				title="My schedule"
				eyebrow="Teacher"
				subtitle={schedule ? 'Your approved published timetable.' : 'No official schedule has been published yet.'}
				online={online}
				syncState={usingCachedSchedule ? 'failed' : online ? 'idle' : 'queued-offline'}
				realtimeConnected={false}
				advisory={advisory}
				onRetryFailed={usingCachedSchedule ? () => void loadSchedule() : undefined}
				rightSlot={(
					<div className="flex flex-wrap gap-2">
						<SmartHelpTrigger
							title="How to use your schedule"
							description="Use this page to check your published teaching day."
							steps={[
								{ title: 'Check the status', body: 'Online means ATLAS is checking the latest published copy.', target: 'Status' },
								{ title: 'Read by day', body: 'On phones, your classes are grouped by day so you can scan one day at a time.', target: 'Day cards' },
								{ title: 'Find room and time', body: 'Each class card shows the subject, section, time, and room.', target: 'Class card' },
								{ title: 'Refresh if unsure', body: 'Tap Refresh schedule to check for approved changes.', target: 'Refresh schedule' },
							]}
						/>
						<Button variant="outline" size="sm" className="h-9 rounded-full print:hidden" onClick={() => window.print()}>
							<Printer className="mr-2 size-4" />
							Print Schedule
						</Button>
						<Button variant="outline" size="sm" className="h-9 rounded-full print:hidden" onClick={() => void loadSchedule()} disabled={checkingForUpdates}>
							<RefreshCcw className={`mr-2 size-4 ${checkingForUpdates ? 'animate-spin' : ''}`} />
							{checkingForUpdates ? 'Checking' : 'Refresh schedule'}
						</Button>
					</div>
				)}
				belowSlot={(
					<SmartNextStepCard
						title={schedule && schedule.entries.length > 0 ? 'Review today by day' : 'Wait for the official published schedule'}
						body={schedule && schedule.entries.length > 0 ? 'Check each class time and room before the school day starts.' : 'The scheduler must publish the timetable before classes appear here.'}
						tone={usingCachedSchedule ? 'warning' : schedule ? 'live' : 'neutral'}
						testId="faculty-schedule-next-step"
					/>
				)}
			/>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-5 sm:px-6 sm:py-6 pb-20 lg:pb-8">
				<div className="mx-auto w-full max-w-7xl space-y-4">
					{schoolYearNotice && (
						<p className="text-xs text-muted-foreground">{schoolYearNotice}</p>
					)}

					{/* Quick stats */}
					<div className="grid grid-cols-3 gap-2 sm:gap-3">
						<div className="rounded-xl border border-border/60 bg-card px-3 py-2.5 sm:px-4 sm:py-3">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classes</p>
							<p className="mt-0.5 text-xl font-bold text-foreground sm:text-2xl">{summary.classCount}</p>
						</div>
						<div className="rounded-xl border border-border/60 bg-card px-3 py-2.5 sm:px-4 sm:py-3">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</p>
							<p className="mt-0.5 text-xl font-bold text-foreground sm:text-2xl">{summary.sectionCount}</p>
						</div>
						<div className="rounded-xl border border-border/60 bg-card px-3 py-2.5 sm:px-4 sm:py-3">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buildings</p>
							<p className="mt-0.5 text-xl font-bold text-foreground sm:text-2xl">{summary.buildingCount}</p>
						</div>
					</div>

					{/* Mobile: day list */}
					<div className="lg:hidden space-y-3">
						{DAY_ORDER.map((day) => {
							const dayEntries = (schedule?.entries ?? [])
								.filter((e) => e.day === day)
								.sort((a, b) => a.startTime.localeCompare(b.startTime));
							if (dayEntries.length === 0) return null;
							return (
								<section key={day}>
									<div className="sticky top-0 z-10 -mx-4 mb-2 bg-muted/30 px-4 py-1.5 backdrop-blur">
										<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											{day.charAt(0) + day.slice(1).toLowerCase()}
										</h2>
									</div>
									<div className="space-y-2">
										{dayEntries.map((entry) => (
											<Card key={entry.entryId} className="rounded-2xl border-border/60 shadow-sm">
												<CardContent className="p-3.5">
													<div className="flex items-start justify-between gap-3">
														<div className="min-w-0">
															<p className="truncate text-sm font-semibold leading-tight text-foreground">{entry.subject.name || entry.subject.code}</p>
															<p className="mt-0.5 text-xs text-muted-foreground">{entry.section.name}</p>
														</div>
														<span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
															{formatShortTime(entry.startTime)}–{formatShortTime(entry.endTime)}
														</span>
													</div>
													<div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
														<MapPin className="size-3.5 shrink-0" />
														<span className="truncate">
															{entry.room.name}{entry.room.buildingName ? ` · ${entry.room.buildingName}` : ''}
														</span>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</section>
							);
						})}
						{(!schedule || schedule.entries.length === 0) && (
							<Card className="rounded-2xl border-dashed border-border bg-card">
								<CardContent className="px-4 py-8 text-center">
									<p className="text-sm font-semibold text-foreground">No classes assigned</p>
									<p className="mt-1 text-xs text-muted-foreground">A published schedule exists, but no classes are linked to you.</p>
								</CardContent>
							</Card>
						)}
					</div>

					{/* Desktop: matrix */}
					<Card className="hidden rounded-2xl border-border/60 shadow-sm lg:block">
						<CardContent className="py-5">
							<PublishedTimetableMatrix
								entries={matrixEntries}
								emptyMessage="A published schedule exists, but no classes are currently assigned to your account."
								renderEntryDetails={(entry) => (
									<>
										<p className="flex items-center gap-1.5"><Clock3 className="size-3.5 shrink-0" /> {formatShortTime(entry.startTime)} - {formatShortTime(entry.endTime)}</p>
										{entry.section && <p className="flex items-center gap-1.5"><BookOpen className="size-3.5 shrink-0" /> {entry.section.name}</p>}
										{entry.room && <p className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" /> {entry.room.name}{entry.room.buildingName ? ` (${entry.room.buildingName})` : ''}</p>}
									</>
								)}
							/>
						</CardContent>
					</Card>

					<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
						<span>Schedule version #{schedule?.source.runId ?? '—'} · {formatRevisionReference(schedule?.source)} · Published {formatTimestamp(schedule?.source.publishedAt ?? null)}</span>
						{usingCachedSchedule ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Saved schedule</Badge> : <Badge variant="outline">Up to date</Badge>}
					</div>
				</div>
			</div>
		</div>
	);
}
