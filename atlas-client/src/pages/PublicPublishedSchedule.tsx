import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import {
	AlertCircle,
	BookOpen,
	CalendarDays,
	Clock3,
	MapPin,
	RefreshCcw,
	Search,
	Wifi,
	WifiOff,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import {
	buildPublicScheduleCacheKey,
	isLikelyOfflinePublicError,
	readPublicScheduleSnapshot,
	writePublicScheduleSnapshot,
} from '@/lib/public-schedule-cache';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;
const PUBLIC_SCHEDULE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
type DayKey = (typeof DAY_ORDER)[number];

const DAY_LABELS: Record<DayKey, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
};

type PublishedScheduleEntry = {
	entryId: string;
	day: string;
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
		gradeLevel: number | null;
		gradeLevelName: string | null;
		programType: string | null;
		programCode: string | null;
		programName: string | null;
	};
	faculty: {
		id: number | null;
		name: string;
	};
	room: {
		id: number;
		name: string;
		buildingName: string | null;
	};
};

type PublishedSchedulePayload = {
	source: {
		runId: number;
		schoolId: number;
		schoolYearId: number;
		publishedAt: string | null;
		generatedAt: string | null;
	};
	entries: PublishedScheduleEntry[];
};

type PublicScheduleSnapshot = {
	payload: PublishedSchedulePayload;
};

type SourceMode = 'live' | 'saved' | 'none';

type SectionBrowseItem = {
	id: number;
	name: string;
	gradeLevel: number | null;
	gradeLabel: string | null;
	programType: string | null;
	programLabel: string | null;
	entryCount: number;
};

function parsePositiveInt(raw: string | null): number | null {
	if (!raw) return null;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1) return null;
	return parsed;
}

function isPublishedSchedulePayload(value: unknown): value is PublicScheduleSnapshot {
	if (!value || typeof value !== 'object') return false;
	const payload = value as Partial<PublicScheduleSnapshot>;
	return (
		Boolean(payload.payload) &&
		typeof payload.payload?.source?.runId === 'number' &&
		Array.isArray(payload.payload?.entries)
	);
}

function normalizeDay(day: string): string {
	return String(day ?? '').trim().toUpperCase();
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

function humanizeProgram(value: string): string {
	return value
		.toLowerCase()
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export default function PublicPublishedSchedule() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [loading, setLoading] = useState(true);
	const [payload, setPayload] = useState<PublishedSchedulePayload | null>(null);
	const [sourceMode, setSourceMode] = useState<SourceMode>('none');
	const [savedAt, setSavedAt] = useState<string | null>(null);
	const [savedIsStale, setSavedIsStale] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean>(navigator.onLine);

	const schoolId = useMemo(() => {
		return parsePositiveInt(searchParams.get('schoolId')) ?? DEFAULT_SCHOOL_ID;
	}, [searchParams]);

	const sectionQuery = (searchParams.get('q') ?? '').trim();
	const gradeFilter = searchParams.get('grade') ?? 'all';
	const programFilter = searchParams.get('program') ?? 'all';
	const requestedDay = normalizeDay(searchParams.get('day') ?? 'all');
	const dayFilter: DayKey | 'all' = DAY_ORDER.includes(requestedDay as DayKey)
		? (requestedDay as DayKey)
		: 'all';
	const selectedSectionId = parsePositiveInt(searchParams.get('sectionId'));

	const updateSearchParams = useCallback(
		(updates: Record<string, string | null>) => {
			const next = new URLSearchParams(searchParams);
			let changed = false;
			for (const [key, value] of Object.entries(updates)) {
				const current = next.get(key);
				if (value === null || value.trim().length === 0) {
					if (current !== null) {
						next.delete(key);
						changed = true;
					}
					continue;
				}
				if (current !== value) {
					next.set(key, value);
					changed = true;
				}
			}

			if (!changed) return;
			setSearchParams(next, { replace: true });
		},
		[searchParams, setSearchParams],
	);

	const loadPublishedSchedule = useCallback(async () => {
		setLoading(true);
		setError(null);

		const cacheKey = buildPublicScheduleCacheKey(schoolId);
		const cachedSnapshot = readPublicScheduleSnapshot<PublicScheduleSnapshot>(cacheKey, {
			maxAgeMs: PUBLIC_SCHEDULE_CACHE_MAX_AGE_MS,
			validate: isPublishedSchedulePayload,
		});

		try {
			const { data } = await atlasApi.get<PublishedSchedulePayload>(`/schools/${schoolId}/schedules/published`);
			setPayload(data);
			setSourceMode('live');
			setSavedAt(null);
			setSavedIsStale(false);
			writePublicScheduleSnapshot(cacheKey, { payload: data });
		} catch (fetchError) {
			const status = isAxiosError(fetchError) ? fetchError.response?.status : undefined;
			const responseData = isAxiosError(fetchError)
				? (fetchError.response?.data as { code?: string; message?: string } | undefined)
				: undefined;
			const canUseSaved =
				Boolean(cachedSnapshot) &&
				(isLikelyOfflinePublicError(fetchError) || (typeof status === 'number' && status >= 500));

			if (canUseSaved && cachedSnapshot) {
				setPayload(cachedSnapshot.data.payload);
				setSourceMode('saved');
				setSavedAt(cachedSnapshot.cachedAt);
				setSavedIsStale(cachedSnapshot.stale);
				setError(null);
				setLoading(false);
				return;
			}

			if (responseData?.code === 'PUBLISHED_RUN_NOT_FOUND') {
				setPayload(null);
				setSourceMode('none');
				setSavedAt(null);
				setSavedIsStale(false);
				setError(null);
				setLoading(false);
				return;
			}

			setPayload(null);
			setSourceMode('none');
			setSavedAt(null);
			setSavedIsStale(false);
			setError(responseData?.message ?? 'Unable to load the published schedule right now.');
		}

		setLoading(false);
	}, [schoolId]);

	useEffect(() => {
		void loadPublishedSchedule();
	}, [loadPublishedSchedule]);

	useEffect(() => {
		const updateOnline = () => setOnline(navigator.onLine);
		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		return () => {
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
		};
	}, []);

	const sections = useMemo<SectionBrowseItem[]>(() => {
		const byId = new Map<number, SectionBrowseItem>();
		for (const entry of payload?.entries ?? []) {
			const gradeLabel =
				entry.section.gradeLevelName ??
				(entry.section.gradeLevel ? `Grade ${entry.section.gradeLevel}` : null);
			const programLabel =
				entry.section.programName ??
				entry.section.programCode ??
				(entry.section.programType ? humanizeProgram(entry.section.programType) : null);

			const existing = byId.get(entry.section.id);
			if (existing) {
				existing.entryCount += 1;
				continue;
			}

			byId.set(entry.section.id, {
				id: entry.section.id,
				name: entry.section.name,
				gradeLevel: entry.section.gradeLevel,
				gradeLabel,
				programType: entry.section.programType,
				programLabel,
				entryCount: 1,
			});
		}

		return [...byId.values()].sort((left, right) => {
			const leftGrade = left.gradeLevel ?? Number.MAX_SAFE_INTEGER;
			const rightGrade = right.gradeLevel ?? Number.MAX_SAFE_INTEGER;
			if (leftGrade !== rightGrade) return leftGrade - rightGrade;
			return left.name.localeCompare(right.name);
		});
	}, [payload?.entries]);

	const gradeOptions = useMemo(() => {
		const map = new Map<string, string>();
		for (const section of sections) {
			if (!section.gradeLevel) continue;
			map.set(String(section.gradeLevel), section.gradeLabel ?? `Grade ${section.gradeLevel}`);
		}
		return [...map.entries()].map(([value, label]) => ({ value, label }));
	}, [sections]);

	const programOptions = useMemo(() => {
		const map = new Map<string, string>();
		for (const section of sections) {
			if (!section.programType) continue;
			map.set(section.programType, section.programLabel ?? humanizeProgram(section.programType));
		}
		return [...map.entries()].map(([value, label]) => ({ value, label }));
	}, [sections]);

	const filteredSections = useMemo(() => {
		const normalizedQuery = sectionQuery.toLowerCase();
		return sections.filter((section) => {
			const matchesQuery =
				normalizedQuery.length === 0 ||
				section.name.toLowerCase().includes(normalizedQuery) ||
				(section.gradeLabel ?? '').toLowerCase().includes(normalizedQuery) ||
				(section.programLabel ?? '').toLowerCase().includes(normalizedQuery);
			const matchesGrade =
				gradeFilter === 'all' ||
				(section.gradeLevel !== null && String(section.gradeLevel) === gradeFilter);
			const matchesProgram =
				programFilter === 'all' ||
				(section.programType !== null && section.programType === programFilter);
			return matchesQuery && matchesGrade && matchesProgram;
		});
	}, [gradeFilter, programFilter, sectionQuery, sections]);

	useEffect(() => {
		if (loading || !payload) return;
		if (filteredSections.length === 0) {
			if (selectedSectionId !== null) {
				updateSearchParams({ sectionId: null });
			}
			return;
		}

		const selectedExists = selectedSectionId !== null && filteredSections.some((section) => section.id === selectedSectionId);
		if (!selectedExists) {
			updateSearchParams({ sectionId: String(filteredSections[0].id) });
		}
	}, [filteredSections, loading, payload, selectedSectionId, updateSearchParams]);

	const selectedSection = useMemo(() => {
		if (selectedSectionId === null) return null;
		return filteredSections.find((section) => section.id === selectedSectionId) ?? null;
	}, [filteredSections, selectedSectionId]);

	const sectionEntries = useMemo(() => {
		if (!selectedSection || !payload) return [];
		return payload.entries
			.filter((entry) => entry.section.id === selectedSection.id)
			.filter((entry) => dayFilter === 'all' || normalizeDay(entry.day) === dayFilter)
			.sort((left, right) => {
				const leftDay = DAY_ORDER.indexOf(normalizeDay(left.day) as DayKey);
				const rightDay = DAY_ORDER.indexOf(normalizeDay(right.day) as DayKey);
				if (leftDay !== rightDay) return leftDay - rightDay;
				return left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime);
			});
	}, [dayFilter, payload, selectedSection]);

	const daysToRender = useMemo<DayKey[]>(() => {
		if (dayFilter === 'all') return [...DAY_ORDER];
		return [dayFilter];
	}, [dayFilter]);

	const groupedEntries = useMemo(() => {
		const group = new Map<DayKey, PublishedScheduleEntry[]>();
		for (const day of daysToRender) {
			group.set(day, []);
		}
		for (const entry of sectionEntries) {
			const normalizedDay = normalizeDay(entry.day) as DayKey;
			if (!group.has(normalizedDay)) continue;
			group.get(normalizedDay)?.push(entry);
		}
		return group;
	}, [daysToRender, sectionEntries]);

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<Card className="rounded-2xl border-border/70">
					<CardHeader className="pb-3">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="space-y-1">
								<CardTitle className="text-2xl font-semibold tracking-tight">Student Schedule Lookup</CardTitle>
								<CardDescription>
									Browse the latest published class schedule by section. No sign in is required.
								</CardDescription>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Badge
									variant="outline"
									className={online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}
								>
									{online ? <Wifi className="mr-1 size-3" /> : <WifiOff className="mr-1 size-3" />}
									{online ? 'Online' : 'Offline'}
								</Badge>
								<Badge
									variant="outline"
									className={
										sourceMode === 'live'
											? 'border-sky-200 bg-sky-50 text-sky-700'
											: sourceMode === 'saved'
											? 'border-amber-200 bg-amber-50 text-amber-800'
											: 'border-muted bg-muted text-muted-foreground'
									}
								>
									{sourceMode === 'live' ? 'Live Published Data' : sourceMode === 'saved' ? 'Saved Published Data' : 'No Published Data'}
								</Badge>
								<Button variant="outline" size="sm" className="rounded-xl" onClick={() => void loadPublishedSchedule()}>
									<RefreshCcw className="mr-2 size-4" /> Refresh
								</Button>
								<Button asChild variant="ghost" size="sm" className="rounded-xl">
									<Link to="/login">Sign In</Link>
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
						<p>
							Latest published run: {payload ? `#${payload.source.runId}` : 'Not available'}
							{payload ? ` • School Year ${payload.source.schoolYearId}` : ''}
							 • School {schoolId}
						</p>
						{sourceMode === 'saved' && savedAt && (
							<p>
								Showing your saved published data from {formatTimestamp(savedAt)}
								{savedIsStale ? '. This saved copy may be out of date.' : '.'}
							</p>
						)}
						{sourceMode === 'live' && payload && (
							<p>Published at {formatTimestamp(payload.source.publishedAt)}.</p>
						)}
					</CardContent>
				</Card>

				{loading && (
					<div className="mt-4 space-y-3">
						<Skeleton className="h-28 w-full rounded-2xl" />
						<Skeleton className="h-96 w-full rounded-2xl" />
					</div>
				)}

				{!loading && error && !payload && (
					<Card className="mt-4 rounded-2xl border-destructive/20">
						<CardContent className="flex items-start gap-4 py-8">
							<AlertCircle className="mt-1 size-6 shrink-0 text-destructive" />
							<div className="space-y-2">
								<p className="text-lg font-semibold text-destructive">Unable to load public schedule</p>
								<p className="text-sm text-muted-foreground">{error}</p>
								<Button variant="outline" size="sm" className="rounded-xl" onClick={() => void loadPublishedSchedule()}>
									<RefreshCcw className="mr-2 size-4" /> Try again
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{!loading && !error && !payload && (
					<Card className="mt-4 rounded-2xl border-border/70">
						<CardContent className="py-10">
							<p className="text-lg font-semibold">No published schedule yet</p>
							<p className="mt-2 text-sm text-muted-foreground">
								The schedule is not published for this school yet. Students can view schedules here after the scheduling officer publishes a run.
							</p>
						</CardContent>
					</Card>
				)}

				{!loading && payload && (
					<div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
						<Card className="rounded-2xl border-border/70">
							<CardHeader className="pb-2">
								<CardTitle className="text-base font-semibold">Section-first browse</CardTitle>
								<CardDescription>Search a section, then open its published classes.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-1.5">
									<Label htmlFor="public-section-search">Search sections</Label>
									<div className="relative">
										<Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
										<Input
											id="public-section-search"
											value={sectionQuery}
											onChange={(event) => updateSearchParams({ q: event.target.value || null, sectionId: null })}
											placeholder="Search by section, grade, or program"
											className="pl-9"
										/>
									</div>
								</div>

								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
									<div className="space-y-1.5">
										<Label>Grade filter</Label>
										<Select value={gradeFilter} onValueChange={(value) => updateSearchParams({ grade: value, sectionId: null })}>
											<SelectTrigger>
												<SelectValue placeholder="Any grade" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Any grade</SelectItem>
												{gradeOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label>Program filter</Label>
										<Select value={programFilter} onValueChange={(value) => updateSearchParams({ program: value, sectionId: null })}>
											<SelectTrigger>
												<SelectValue placeholder="Any program" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Any program</SelectItem>
												{programOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<Button
									variant="ghost"
									size="sm"
									className="w-fit rounded-xl"
									onClick={() =>
										updateSearchParams({
											q: null,
											grade: null,
											program: null,
											sectionId: null,
										})
									}
								>
									Clear filters
								</Button>

								<div className="overflow-hidden rounded-xl border border-border/70">
									<div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
										<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sections</p>
										<Badge variant="outline" className="text-[10px]">{filteredSections.length}</Badge>
									</div>
									<ScrollArea className="h-72">
										<div className="space-y-1 p-2">
											{filteredSections.length === 0 && (
												<p className="px-2 py-4 text-sm text-muted-foreground">No sections matched your filters.</p>
											)}
											{filteredSections.map((section) => {
												const isActive = selectedSection?.id === section.id;
												return (
													<Button
														key={section.id}
														variant={isActive ? 'secondary' : 'ghost'}
														onClick={() => updateSearchParams({ sectionId: String(section.id) })}
														className="h-auto w-full items-start justify-start rounded-lg px-2 py-2 text-left"
													>
														<div className="space-y-1">
															<p className="text-sm font-semibold leading-tight">{section.name}</p>
															<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
																<span>{section.entryCount} class{section.entryCount === 1 ? '' : 'es'}</span>
																{section.gradeLabel && <Badge variant="outline" className="text-[10px]">{section.gradeLabel}</Badge>}
																{section.programLabel && <Badge variant="outline" className="text-[10px]">{section.programLabel}</Badge>}
															</div>
														</div>
													</Button>
												);
											})}
										</div>
									</ScrollArea>
								</div>
							</CardContent>
						</Card>

						<Card className="rounded-2xl border-border/70">
							<CardHeader className="pb-3">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="space-y-1">
										<CardTitle className="text-lg font-semibold">{selectedSection ? selectedSection.name : 'Select a section'}</CardTitle>
										<CardDescription>
											{selectedSection
												? 'Published classes for the selected section.'
												: 'Choose a section from the left panel to view the published timetable.'}
										</CardDescription>
										{selectedSection && (
											<div className="mt-1 flex flex-wrap items-center gap-1.5">
												{selectedSection.gradeLabel && <Badge variant="outline">{selectedSection.gradeLabel}</Badge>}
												{selectedSection.programLabel && <Badge variant="outline">{selectedSection.programLabel}</Badge>}
												<Badge variant="secondary">{sectionEntries.length} class{sectionEntries.length === 1 ? '' : 'es'}</Badge>
											</div>
										)}
									</div>
									<div className="w-full sm:w-48">
										<Label className="mb-1.5 inline-block">Day view</Label>
										<Select value={dayFilter} onValueChange={(value) => updateSearchParams({ day: value === 'all' ? null : value })}>
											<SelectTrigger>
												<SelectValue placeholder="All days" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All days</SelectItem>
												{DAY_ORDER.map((day) => (
													<SelectItem key={day} value={day}>{DAY_LABELS[day]}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{!selectedSection && (
									<p className="text-sm text-muted-foreground">Select a section to view its published classes.</p>
								)}
								{selectedSection && sectionEntries.length === 0 && (
									<p className="text-sm text-muted-foreground">
										No published classes were found for this section in the current day view.
									</p>
								)}
								{selectedSection && sectionEntries.length > 0 && (
									<div className="space-y-4">
										{daysToRender.map((day) => {
											const dayEntries = groupedEntries.get(day) ?? [];
											if (dayEntries.length === 0) return null;
											return (
												<div key={day} className="space-y-2">
													<div className="flex items-center gap-2">
														<CalendarDays className="size-4 text-primary" />
														<p className="text-sm font-bold">{DAY_LABELS[day]}</p>
														<Badge variant="outline" className="text-[10px]">{dayEntries.length} class(es)</Badge>
													</div>
													<div className="space-y-2">
														{dayEntries.map((entry) => (
															<div key={entry.entryId} className="rounded-xl border border-border/70 bg-card px-3 py-2">
																<div className="flex flex-wrap items-center gap-2">
																	<Badge variant="secondary" className="text-xs">
																		<Clock3 className="mr-1 size-3" />
																		{formatShortTime(entry.startTime)} - {formatShortTime(entry.endTime)}
																	</Badge>
																	<p className="text-sm font-semibold">{entry.subject.name}</p>
																	<Badge variant="outline" className="text-[10px]">{entry.subject.code}</Badge>
																</div>
																<div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
																	<span className="inline-flex items-center gap-1">
																		<MapPin className="size-3" />
																		{entry.room.name}{entry.room.buildingName ? ` (${entry.room.buildingName})` : ''}
																	</span>
																	<span className="inline-flex items-center gap-1">
																		<BookOpen className="size-3" />
																		{entry.faculty.name}
																	</span>
																</div>
															</div>
														))}
													</div>
												</div>
											);
										})}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}
			</div>
		</div>
	);
}
