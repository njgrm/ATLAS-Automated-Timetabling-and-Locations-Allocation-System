import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	BookOpen,
	CalendarDays,
	Clock3,
	MapPin,
	RefreshCcw,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { cacheFacultyIdentity, readCachedFacultyIdentity } from '@/lib/faculty-identity-cache';
import { buildFacultyCacheKey, isLikelyOfflineError, readFacultySnapshot, writeFacultySnapshot } from '@/lib/faculty-offline-cache';
import FacultyGlobalHeader from '@/components/faculty-shared/FacultyGlobalHeader';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;
const SCHEDULE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
};

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

function formatShortTime(time: string): string {
	const [rawHour, rawMinute] = time.split(':').map(Number);
	if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return time;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 || 12;
	const minute = String(rawMinute).padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

function formatTimestamp(value: string | null): string {
	if (!value) return 'Not available';
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleString();
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
			const schoolYearContext = await resolveActiveSchoolYearContext({
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			const schoolYearId = schoolYearContext.activeSchoolYearId;
			setSchoolYearNotice(
				schoolYearContext.source === 'atlas' && !schoolYearContext.stale
					? null
					: schoolYearContext.activeSchoolYearLabel
					? `Working from saved ATLAS school-year context (${schoolYearContext.activeSchoolYearLabel}).`
					: 'Working from saved ATLAS school-year context.',
			);

			let resolvedFacultyId: number;
			try {
				const { data } = await atlasApi.get<{ faculty: { id: number } }>('/faculty/me', {
					params: { schoolId: DEFAULT_SCHOOL_ID },
				});
				if (!data?.faculty?.id) {
					setError('Your account is not linked to a faculty record in this school.');
					setSchedule(null);
					return;
				}
				resolvedFacultyId = data.faculty.id;
				cacheFacultyIdentity(DEFAULT_SCHOOL_ID, resolvedFacultyId);
			} catch (facultyError) {
				const cachedIdentity = readCachedFacultyIdentity(DEFAULT_SCHOOL_ID);
				if (cachedIdentity && isLikelyOfflineError(facultyError)) {
					resolvedFacultyId = cachedIdentity.facultyId;
					setSchoolYearNotice((current) => current ?? 'Using your last saved faculty account link while offline.');
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
				const { data } = await atlasApi.get<PublishedFacultySchedulePayload>(
					`/schools/${DEFAULT_SCHOOL_ID}/schedules/published/${schoolYearId}/faculty/${resolvedFacultyId}`,
				);
				setSchedule(data);
				setError(null);
				setUsingCachedSchedule(false);
				setCachedScheduleAt(null);
				writeFacultySnapshot(cacheKey, {
					facultyId: resolvedFacultyId,
					payload: data,
				});
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

	const groupedEntries = useMemo(() => {
		const group = new Map<string, PublishedFacultyScheduleEntry[]>();
		for (const day of DAY_ORDER) {
			group.set(day, []);
		}
		for (const entry of schedule?.entries ?? []) {
			const dayKey = DAY_ORDER.includes(entry.day as (typeof DAY_ORDER)[number])
				? entry.day
				: String(entry.day).toUpperCase();
			const rows = group.get(dayKey) ?? [];
			rows.push(entry);
			group.set(dayKey, rows);
		}
		for (const rows of group.values()) {
			rows.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));
		}
		return group;
	}, [schedule?.entries]);

	const summary = useMemo(() => {
		const entries = schedule?.entries ?? [];
		const sectionNames = new Set(entries.map((entry) => entry.section.name));
		const buildingNames = new Set(entries.map((entry) => entry.room.buildingName).filter(Boolean));
		return {
			classCount: entries.length,
			sectionCount: sectionNames.size,
			buildingCount: buildingNames.size,
		};
	}, [schedule?.entries]);

	const advisory = useMemo(() => {
		if (usingCachedSchedule) {
			const savedAt = cachedScheduleAt ? new Date(cachedScheduleAt).toLocaleString() : null;
			return {
				title: 'Saved published schedule',
				message: savedAt
					? `Live published schedule is unavailable. Showing your last saved copy from ${savedAt}.`
					: 'Live published schedule is unavailable. Showing your last saved copy.',
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
						<Skeleton className="h-72 w-full rounded-2xl" />
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
				subtitle="Review the timetable that students and faculty can already see."
				online={online}
				syncState={usingCachedSchedule ? 'failed' : online ? 'idle' : 'queued-offline'}
				realtimeConnected={false}
				advisory={advisory}
				onRetryFailed={usingCachedSchedule ? () => void loadSchedule() : undefined}
			>
				{schoolYearNotice && (
					<div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-900 uppercase tracking-tight">
						{schoolYearNotice}
					</div>
				)}
			</FacultyGlobalHeader>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
				<div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-3">
					<Card className="rounded-2xl border-border/70">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-semibold text-muted-foreground">Published Run</CardTitle>
						</CardHeader>
						<CardContent className="space-y-1">
							<p className="text-xl font-bold">#{schedule?.source.runId ?? 'N/A'}</p>
							<p className="text-xs text-muted-foreground">Published: {formatTimestamp(schedule?.source.publishedAt ?? null)}</p>
						</CardContent>
					</Card>
					<Card className="rounded-2xl border-border/70">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-semibold text-muted-foreground">Classes This Week</CardTitle>
						</CardHeader>
						<CardContent className="space-y-1">
							<p className="text-xl font-bold">{summary.classCount}</p>
							<p className="text-xs text-muted-foreground">Across {summary.sectionCount} section(s)</p>
						</CardContent>
					</Card>
					<Card className="rounded-2xl border-border/70">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-semibold text-muted-foreground">Campus Coverage</CardTitle>
						</CardHeader>
						<CardContent className="space-y-1">
							<p className="text-xl font-bold">{summary.buildingCount}</p>
							<p className="text-xs text-muted-foreground">Building zone(s) in this schedule</p>
						</CardContent>
					</Card>
				</div>

				<div className="mx-auto mt-5 w-full max-w-7xl space-y-4">
					{DAY_ORDER.map((day) => {
						const entries = groupedEntries.get(day) ?? [];
						return (
							<Card key={day} className="rounded-2xl border-border/70">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center gap-2 text-base">
										<CalendarDays className="size-4 text-primary" />
										{DAY_LABELS[day]}
										<Badge variant="outline" className="ml-auto text-xs">{entries.length} class(es)</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent>
									{entries.length === 0 ? (
										<p className="text-sm text-muted-foreground">No published classes on this day.</p>
									) : (
										<div className="space-y-2">
											{entries.map((entry) => (
												<div
													key={entry.entryId}
													className="rounded-xl border border-border/70 bg-card px-3 py-2"
												>
													<div className="flex flex-wrap items-center gap-2">
														<Badge variant="secondary" className="text-xs">
															<Clock3 className="mr-1 size-3" />
															{formatShortTime(entry.startTime)} - {formatShortTime(entry.endTime)}
														</Badge>
														<span className="text-sm font-semibold">{entry.subject.name}</span>
														<Badge variant="outline" className="text-[10px]">{entry.subject.code}</Badge>
													</div>
													<div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
														<span className="inline-flex items-center gap-1">
															<BookOpen className="size-3" />
															{entry.section.name}
														</span>
														<span className="inline-flex items-center gap-1">
															<MapPin className="size-3" />
															{entry.room.name}
															{entry.room.buildingName ? ` (${entry.room.buildingName})` : ''}
														</span>
													</div>
												</div>
											))}
										</div>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			</div>
		</div>
	);
}
