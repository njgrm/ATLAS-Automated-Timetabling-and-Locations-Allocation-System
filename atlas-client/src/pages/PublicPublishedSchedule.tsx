import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Clock3, RefreshCcw, Search } from 'lucide-react';

import atlasApi from '@/lib/api';
import { buildPublishedScheduleCacheMarker, resolvePublishedScheduleRequestDate } from '@/lib/published-schedule-cache-key';
import { buildPublicScheduleCacheKey, isLikelyOfflinePublicError, readLatestPublicScheduleSnapshotByPrefix, writePublicScheduleSnapshot } from '@/lib/public-schedule-cache';
import { resolvePublicSectionGrade } from '@/lib/public-schedule-grade';
import { PublishedTimetableMatrix, DAY_ORDER, type DayKey, type PublishedScheduleMatrixEntry, formatShortTime, humanizeProgram } from '@/components/published-schedule/PublishedTimetableMatrix';
import { GradeLevelBadge } from '@/components/GradeLevelBadge';
import { SmartCommandBar, SmartNextStepCard, SmartSourceStatusChip } from '@/components/smart/SmartPageShell';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton } from '@/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';

const DEFAULT_SCHOOL_ID = 1;
const PUBLIC_SCHEDULE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type ScheduleMode = 'sections' | 'teachers' | 'rooms';

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
		requestedDate?: string | null;
		resolvedForDate?: string | null;
		activeRevisionId?: number | null;
		activeRevisionEffectiveDate?: string | null;
		revisionMarker?: string | null;
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

type FacultyBrowseItem = { id: number; name: string; entryCount: number };
type RoomBrowseItem = { id: number; name: string; buildingName: string | null; entryCount: number };

function parsePositiveInt(raw: string | null): number | null {
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDay(day: string): string {
	return String(day ?? '').trim().toUpperCase();
}

function isPublishedSchedulePayload(value: unknown): value is PublicScheduleSnapshot {
	if (!value || typeof value !== 'object') return false;
	const payload = value as Partial<PublicScheduleSnapshot>;
	return Boolean(payload.payload) && typeof payload.payload?.source?.runId === 'number' && Array.isArray(payload.payload?.entries);
}

function formatTimestamp(value: string | null): string {
	if (!value) return 'Not available';
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function modeLabel(mode: ScheduleMode): string {
	if (mode === 'teachers') return 'Teachers';
	if (mode === 'rooms') return 'Rooms';
	return 'Sections';
}

function modeDescription(mode: ScheduleMode): string {
	if (mode === 'teachers') return 'Browse the published timetable by teacher.';
	if (mode === 'rooms') return 'Browse the published timetable by room.';
	return 'Browse the published timetable by section.';
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

	const schoolId = useMemo(() => parsePositiveInt(searchParams.get('schoolId')) ?? DEFAULT_SCHOOL_ID, [searchParams]);
	const requestedDate = useMemo(() => resolvePublishedScheduleRequestDate(searchParams.get('date') ?? searchParams.get('asOfDate')), [searchParams]);
	// Public view is intentionally restricted to section schedules. Teachers and rooms
	// are admin-only surfaces; never exposed to unauthenticated students. We cast to the
	// wider ScheduleMode union so the dead-but-defensive branches below still type-check.
	const mode = 'sections' as ScheduleMode;
	const entityQuery = (searchParams.get('q') ?? '').trim();
	const gradeFilter = searchParams.get('grade') ?? 'all';
	const programFilter = searchParams.get('program') ?? 'all';
	const requestedDay = normalizeDay(searchParams.get('day') ?? 'all');
	const dayFilter: DayKey | 'all' = DAY_ORDER.includes(requestedDay as DayKey) ? (requestedDay as DayKey) : 'all';
	const selectedSectionId = parsePositiveInt(searchParams.get('sectionId'));
	const selectedFacultyId = parsePositiveInt(searchParams.get('facultyId'));
	const selectedRoomId = parsePositiveInt(searchParams.get('roomId'));

	const updateSearchParams = useCallback((updates: Record<string, string | null>) => {
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
		if (changed) setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	const loadPublishedSchedule = useCallback(async () => {
		setLoading(true);
		setError(null);
		const cachePrefix = buildPublicScheduleCacheKey(schoolId, requestedDate);
		const cachedSnapshot = readLatestPublicScheduleSnapshotByPrefix<PublicScheduleSnapshot>(cachePrefix, {
			maxAgeMs: PUBLIC_SCHEDULE_CACHE_MAX_AGE_MS,
			validate: isPublishedSchedulePayload,
		});

		try {
			const { data } = await atlasApi.get<PublishedSchedulePayload>(`/schools/${schoolId}/schedules/published`, {
				params: { date: requestedDate },
			});
			setPayload(data);
			setSourceMode('live');
			setSavedAt(null);
			setSavedIsStale(false);
			writePublicScheduleSnapshot(buildPublicScheduleCacheKey(schoolId, requestedDate, buildPublishedScheduleCacheMarker(data.source)), { payload: data });
		} catch (fetchError) {
			const status = isAxiosError(fetchError) ? fetchError.response?.status : undefined;
			const responseData = isAxiosError(fetchError) ? (fetchError.response?.data as { code?: string; message?: string } | undefined) : undefined;
			const canUseSaved = Boolean(cachedSnapshot) && (isLikelyOfflinePublicError(fetchError) || (typeof status === 'number' && status >= 500));

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
	}, [requestedDate, schoolId]);

	useEffect(() => { void loadPublishedSchedule(); }, [loadPublishedSchedule]);
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
			const gradeLevel = resolvePublicSectionGrade(entry.section.gradeLevel, entry.section.gradeLevelName, entry.section.name);
			const gradeLabel = gradeLevel ? `Grade ${gradeLevel}` : entry.section.gradeLevelName;
			const programLabel = entry.section.programName ?? entry.section.programCode ?? (entry.section.programType ? humanizeProgram(entry.section.programType) : null);
			const existing = byId.get(entry.section.id);
			if (existing) {
				existing.entryCount += 1;
				continue;
			}
			byId.set(entry.section.id, { id: entry.section.id, name: entry.section.name, gradeLevel, gradeLabel, programType: entry.section.programType, programLabel, entryCount: 1 });
		}
		return [...byId.values()].sort((left, right) => (left.gradeLevel ?? Number.MAX_SAFE_INTEGER) - (right.gradeLevel ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name));
	}, [payload?.entries]);

	const faculty = useMemo<FacultyBrowseItem[]>(() => {
		const byId = new Map<number, FacultyBrowseItem>();
		for (const entry of payload?.entries ?? []) {
			if (!entry.faculty.id) continue;
			const existing = byId.get(entry.faculty.id);
			if (existing) {
				existing.entryCount += 1;
				continue;
			}
			byId.set(entry.faculty.id, { id: entry.faculty.id, name: entry.faculty.name, entryCount: 1 });
		}
		return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
	}, [payload?.entries]);

	const rooms = useMemo<RoomBrowseItem[]>(() => {
		const byId = new Map<number, RoomBrowseItem>();
		for (const entry of payload?.entries ?? []) {
			const existing = byId.get(entry.room.id);
			if (existing) {
				existing.entryCount += 1;
				continue;
			}
			byId.set(entry.room.id, { id: entry.room.id, name: entry.room.name, buildingName: entry.room.buildingName, entryCount: 1 });
		}
		return [...byId.values()].sort((left, right) => (left.buildingName ?? '').localeCompare(right.buildingName ?? '') || left.name.localeCompare(right.name));
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
		const normalizedQuery = entityQuery.toLowerCase();
		return sections.filter((section) => {
			const matchesQuery = normalizedQuery.length === 0 || section.name.toLowerCase().includes(normalizedQuery) || (section.gradeLabel ?? '').toLowerCase().includes(normalizedQuery) || (section.programLabel ?? '').toLowerCase().includes(normalizedQuery);
			const matchesGrade = gradeFilter === 'all' || (section.gradeLevel !== null && String(section.gradeLevel) === gradeFilter);
			const matchesProgram = programFilter === 'all' || (section.programType !== null && section.programType === programFilter);
			return matchesQuery && matchesGrade && matchesProgram;
		});
	}, [gradeFilter, programFilter, entityQuery, sections]);

	const filteredFaculty = useMemo(() => {
		const normalizedQuery = entityQuery.toLowerCase();
		return faculty.filter((item) => normalizedQuery.length === 0 || item.name.toLowerCase().includes(normalizedQuery));
	}, [entityQuery, faculty]);

	const filteredRooms = useMemo(() => {
		const normalizedQuery = entityQuery.toLowerCase();
		return rooms.filter((item) => normalizedQuery.length === 0 || item.name.toLowerCase().includes(normalizedQuery) || (item.buildingName ?? '').toLowerCase().includes(normalizedQuery));
	}, [entityQuery, rooms]);

	useEffect(() => {
		if (loading || !payload) return;
		if (mode === 'sections') {
			if (filteredSections.length === 0) {
				if (selectedSectionId !== null) updateSearchParams({ sectionId: null });
				return;
			}
			const selectedExists = selectedSectionId !== null && filteredSections.some((section) => section.id === selectedSectionId);
			if (!selectedExists) updateSearchParams({ sectionId: String(filteredSections[0].id) });
			return;
		}
		if (mode === 'teachers') {
			if (filteredFaculty.length === 0) {
				if (selectedFacultyId !== null) updateSearchParams({ facultyId: null });
				return;
			}
			const selectedExists = selectedFacultyId !== null && filteredFaculty.some((item) => item.id === selectedFacultyId);
			if (!selectedExists) updateSearchParams({ facultyId: String(filteredFaculty[0].id) });
			return;
		}
		if (filteredRooms.length === 0) {
			if (selectedRoomId !== null) updateSearchParams({ roomId: null });
			return;
		}
		const selectedExists = selectedRoomId !== null && filteredRooms.some((item) => item.id === selectedRoomId);
		if (!selectedExists) updateSearchParams({ roomId: String(filteredRooms[0].id) });
	}, [filteredFaculty, filteredRooms, filteredSections, loading, mode, payload, selectedFacultyId, selectedRoomId, selectedSectionId, updateSearchParams]);

	const selectedSection = useMemo(() => (selectedSectionId === null ? null : filteredSections.find((section) => section.id === selectedSectionId) ?? null), [filteredSections, selectedSectionId]);
	const selectedFaculty = useMemo(() => (selectedFacultyId === null ? null : filteredFaculty.find((item) => item.id === selectedFacultyId) ?? null), [filteredFaculty, selectedFacultyId]);
	const selectedRoom = useMemo(() => (selectedRoomId === null ? null : filteredRooms.find((item) => item.id === selectedRoomId) ?? null), [filteredRooms, selectedRoomId]);

	const selectedEntries = useMemo(() => {
		if (!payload) return [];
		const selectedId = mode === 'teachers' ? selectedFacultyId : mode === 'rooms' ? selectedRoomId : selectedSectionId;
		if (selectedId === null) return [];
		return payload.entries
			.filter((entry) => {
				if (mode === 'teachers') return entry.faculty.id === selectedId;
				if (mode === 'rooms') return entry.room.id === selectedId;
				return entry.section.id === selectedId;
			})
			.filter((entry) => dayFilter === 'all' || normalizeDay(entry.day) === dayFilter)
			.sort((left, right) => DAY_ORDER.indexOf(normalizeDay(left.day) as DayKey) - DAY_ORDER.indexOf(normalizeDay(right.day) as DayKey) || left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));
	}, [dayFilter, mode, payload, selectedFacultyId, selectedRoomId, selectedSectionId]);

	const summary = useMemo(() => {
		const entries = payload?.entries ?? [];
		return {
			classCount: entries.length,
			sectionCount: new Set(entries.map((entry) => entry.section.name)).size,
			facultyCount: new Set(entries.map((entry) => entry.faculty.name).filter(Boolean)).size,
			roomCount: new Set(entries.map((entry) => entry.room.name)).size,
		};
	}, [payload?.entries]);

	const renderSelectedEntryDetails = useCallback((entry: PublishedScheduleMatrixEntry) => {
		// Public sections view: never expose faculty, room, or building info.
		// Students see only subject (header) + time (row label).
		return (
			<p className="flex items-center gap-1.5"><Clock3 className="size-3.5 shrink-0" /> {formatShortTime(entry.startTime)} - {formatShortTime(entry.endTime)}</p>
		);
	}, []);

	const renderSelectedEntryBadges = useCallback((entry: PublishedScheduleMatrixEntry) => {
		const section = entry.section;
		const grade = resolvePublicSectionGrade(section?.gradeLevel, section?.gradeLevelName, section?.name);
		return <GradeLevelBadge grade={grade} size="xs" />;
	}, []);

	if (loading) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6">
					<div className="mx-auto w-full max-w-7xl space-y-3">
						<Skeleton className="h-24 w-full rounded-2xl" />
						<Skeleton className="h-24 w-full rounded-2xl" />
						<Skeleton className="h-144 w-full rounded-2xl" />
					</div>
				</div>
			</div>
		);
	}

	if (error && !payload) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6">
					<div className="mx-auto w-full max-w-4xl">
						<Card className="rounded-2xl border-destructive/20">
							<CardContent className="flex items-start gap-4 py-8">
								<AlertCircle className="mt-1 size-6 shrink-0 text-destructive" />
								<div className="flex-1 min-w-0 space-y-2">
									<p className="text-lg font-bold text-destructive">Unable to load public schedule</p>
									<p className="text-sm text-muted-foreground">{error}</p>
									<Button variant="outline" size="sm" className="rounded-xl" onClick={() => void loadPublishedSchedule()}>
										<RefreshCcw className="mr-2 size-4" /> Try again
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	if (!payload) {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background">
				<div className="flex-1 min-h-0 overflow-auto px-4 py-6 sm:px-6">
					<div className="mx-auto w-full max-w-4xl">
						<Card className="rounded-2xl border-border/70">
							<CardContent className="py-10">
								<p className="text-lg font-semibold">No official schedule has been published yet</p>
								<p className="mt-2 text-sm text-muted-foreground">Once the school publishes the term schedule, you will see your class timetable here.</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	const selectedTitle = mode === 'teachers' ? selectedFaculty?.name ?? 'Select a teacher' : mode === 'rooms' ? (selectedRoom ? `${selectedRoom.name}${selectedRoom.buildingName ? ` (${selectedRoom.buildingName})` : ''}` : 'Select a room') : selectedSection?.name ?? 'Select a section';
	const selectedSubtitle = mode === 'teachers'
		? selectedFaculty ? `${selectedEntries.length} class${selectedEntries.length === 1 ? '' : 'es'} in the published timetable.` : 'Choose a teacher from the list.'
		: mode === 'rooms'
			? selectedRoom ? `${selectedEntries.length} class${selectedEntries.length === 1 ? '' : 'es'} in the published timetable.` : 'Choose a room from the list.'
			: selectedSection ? `${selectedEntries.length} class${selectedEntries.length === 1 ? '' : 'es'} in the published timetable.` : 'Choose a section from the list.';
	const listEmptyMessage = mode === 'teachers' ? 'No teachers matched your search.' : mode === 'rooms' ? 'No rooms matched your search.' : 'No sections matched your search.';
	const sourceTone = sourceMode === 'live' ? 'live' : sourceMode === 'saved' ? 'warning' : 'neutral';

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background">
			<div className="flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6 sm:py-6">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
					<SmartCommandBar
						title="Find your class schedule"
						eyebrow="Public schedule"
						subtitle="Search by section, then read the official timetable for your school."
						source={(
							<div className="flex flex-wrap items-center gap-2">
								<SmartSourceStatusChip label={online ? 'Online' : 'Offline'} tone={online ? 'live' : 'warning'} />
								<SmartSourceStatusChip
									label={sourceMode === 'live' ? 'Official schedule' : sourceMode === 'saved' ? 'Last saved copy' : 'No schedule yet'}
									tone={sourceTone}
									testId="public-schedule-source-status"
								/>
							</div>
						)}
						nextAction={(
							<SmartNextStepCard
								title={selectedSection ? `Review ${selectedSection.name}` : 'Choose a section'}
								body={selectedSection ? `${selectedEntries.length} published classes are shown.` : 'Use the section list below to pick the schedule you need.'}
								tone={sourceTone}
								testId="public-schedule-next-step"
							/>
						)}
						primaryAction={(
							<Button variant="default" size="sm" className="h-9 rounded-xl print:hidden" onClick={() => void loadPublishedSchedule()}>
								<RefreshCcw className="mr-2 size-4" /> Refresh
							</Button>
						)}
						help={{
							title: 'How to read this schedule',
							description: 'Use these steps to find one section and read its official published classes.',
							steps: [
								{ title: 'Search section', body: 'Type the section name or choose from the list.', target: 'Sections' },
								{ title: 'Filter if needed', body: 'Use grade or program filters only when the list is long.', target: 'Grade filter' },
								{ title: 'Read the timetable', body: 'The selected section schedule appears on the right or below on phone screens.', target: 'Schedule' },
								{ title: 'Refresh or print', body: 'Use More for print, sign in, or update checks.', target: 'More' },
							],
						}}
						moreGroups={[
							{
								label: 'Schedule tools',
								items: [
									{ label: 'Print schedule', onSelect: () => window.print(), description: 'Open the browser print dialog.' },
									{ label: 'Sign in to ATLAS', href: '/login', description: 'Open staff and scheduler tools.' },
								],
							},
							{
								label: 'Schedule facts',
								items: [
									{ label: `${summary.classCount} classes`, disabled: true },
									{ label: `${summary.sectionCount} sections`, disabled: true },
									{ label: `Updated ${formatTimestamp(payload.source.publishedAt)}`, disabled: true },
								],
							},
						]}
						testId="public-schedule-command-bar"
					/>

					{sourceMode === 'saved' && savedAt && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
							Showing the last saved copy from {formatTimestamp(savedAt)}{savedIsStale ? '. This saved copy may be out of date. Tap Refresh when online.' : '.'}
						</div>
					)}

					<div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
						<Card className="rounded-2xl border-border/70">
							<CardHeader className="pb-3">
								<div className="space-y-2">
									<CardTitle className="text-base font-semibold">Sections</CardTitle>
									<CardDescription>Browse the published timetable by section.</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-1.5">
									<Label htmlFor="public-schedule-search">Search {modeLabel(mode).toLowerCase()}</Label>
									<div className="relative">
										<Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
										<Input id="public-schedule-search" value={entityQuery} onChange={(event) => updateSearchParams({ q: event.target.value || null })} placeholder={`Search ${modeLabel(mode).toLowerCase()}`} className="pl-9" />
									</div>
								</div>

								{mode === 'sections' && (
									<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
										<div className="space-y-1.5">
											<Label>Grade filter</Label>
											<Select value={gradeFilter} onValueChange={(value) => updateSearchParams({ grade: value, sectionId: null })}>
												<SelectTrigger><SelectValue placeholder="Any grade" /></SelectTrigger>
												<SelectContent>
													<SelectItem value="all">Any grade</SelectItem>
													{gradeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label>Program filter</Label>
											<Select value={programFilter} onValueChange={(value) => updateSearchParams({ program: value, sectionId: null })}>
												<SelectTrigger><SelectValue placeholder="Any program" /></SelectTrigger>
												<SelectContent>
													<SelectItem value="all">Any program</SelectItem>
													{programOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
												</SelectContent>
											</Select>
										</div>
									</div>
								)}

								<Button variant="ghost" size="sm" className="w-fit rounded-xl" onClick={() => updateSearchParams({ q: null, grade: null, program: null, sectionId: null, facultyId: null, roomId: null })}>Clear filters</Button>

								<div className="overflow-hidden rounded-xl border border-border/70">
									<div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
										<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{modeLabel(mode)}</p>
										<Badge variant="outline" className="text-xs">{mode === 'teachers' ? filteredFaculty.length : mode === 'rooms' ? filteredRooms.length : filteredSections.length}</Badge>
									</div>
									<ScrollArea className="h-72">
										<div className="space-y-1 p-2">
											{mode === 'teachers' && filteredFaculty.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">{listEmptyMessage}</p>}
											{mode === 'rooms' && filteredRooms.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">{listEmptyMessage}</p>}
											{mode === 'sections' && filteredSections.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">{listEmptyMessage}</p>}

											{mode === 'teachers' && filteredFaculty.map((item) => {
												const isActive = selectedFaculty?.id === item.id;
												return <Button key={item.id} variant={isActive ? 'secondary' : 'ghost'} onClick={() => updateSearchParams({ facultyId: String(item.id) })} className="h-auto w-full items-start justify-start rounded-lg px-2 py-2 text-left"><div className="space-y-1"><p className="text-sm font-semibold leading-tight">{item.name}</p><div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{item.entryCount} class{item.entryCount === 1 ? '' : 'es'}</span></div></div></Button>;
											})}

											{mode === 'rooms' && filteredRooms.map((item) => {
												const isActive = selectedRoom?.id === item.id;
												return <Button key={item.id} variant={isActive ? 'secondary' : 'ghost'} onClick={() => updateSearchParams({ roomId: String(item.id) })} className="h-auto w-full items-start justify-start rounded-lg px-2 py-2 text-left"><div className="space-y-1"><p className="text-sm font-semibold leading-tight">{item.name}</p><div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{item.buildingName && <Badge variant="outline" className="text-xs">{item.buildingName}</Badge>}<span>{item.entryCount} class{item.entryCount === 1 ? '' : 'es'}</span></div></div></Button>;
											})}

											{mode === 'sections' && filteredSections.map((section) => {
								const isActive = selectedSection?.id === section.id;
								return <Button key={section.id} variant={isActive ? 'secondary' : 'ghost'} onClick={() => updateSearchParams({ sectionId: String(section.id) })} className="h-auto w-full items-start justify-start rounded-lg px-2 py-2 text-left"><div className="space-y-1"><div className="flex items-center gap-1.5"><p className="text-sm font-semibold leading-tight">{section.name}</p><GradeLevelBadge grade={section.gradeLevel} size="xs" /></div><div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{section.entryCount} class{section.entryCount === 1 ? '' : 'es'}</span>{section.programLabel && <Badge variant="outline" className="text-xs">{section.programLabel}</Badge>}</div></div></Button>;
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
										<CardTitle className="text-lg font-semibold">{selectedTitle}</CardTitle>
										<CardDescription>{selectedSubtitle}</CardDescription>
										<div className="mt-1 flex flex-wrap items-center gap-1.5">
											<Badge variant="outline">Section</Badge>
											<GradeLevelBadge grade={selectedSection?.gradeLevel} size="sm" />
											{selectedSection?.programLabel && <Badge variant="outline">{selectedSection.programLabel}</Badge>}
										</div>
									</div>
									<div className="w-full sm:w-48">
										<Label className="mb-1.5 inline-block">Day view</Label>
										<Select value={dayFilter} onValueChange={(value) => updateSearchParams({ day: value === 'all' ? null : value })}>
											<SelectTrigger><SelectValue placeholder="All days" /></SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All days</SelectItem>
												{DAY_ORDER.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}
											</SelectContent>
										</Select>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{mode === 'sections' && !selectedSection && <p className="text-sm text-muted-foreground">Select a section to view its published timetable.</p>}
								{mode === 'teachers' && !selectedFaculty && <p className="text-sm text-muted-foreground">Select a teacher to view their published timetable.</p>}
								{mode === 'rooms' && !selectedRoom && <p className="text-sm text-muted-foreground">Select a room to view its published timetable.</p>}
								{selectedEntries.length === 0 && (selectedSection || selectedFaculty || selectedRoom) && <p className="text-sm text-muted-foreground">No published classes were found for this view in the current day filter.</p>}
								{selectedEntries.length > 0 && (
									<>
										<div className="hidden lg:block">
											<PublishedTimetableMatrix
												entries={selectedEntries}
												dayFilter={dayFilter}
												emptyMessage="No published classes were found for this view."
												renderEntryDetails={renderSelectedEntryDetails}
												renderEntryBadges={renderSelectedEntryBadges}
											/>
										</div>
										<div className="lg:hidden space-y-3">
											{DAY_ORDER.map((day) => {
												const dayEntries = selectedEntries
													.filter((e) => e.day === day && (dayFilter === 'all' || dayFilter === day))
													.sort((a, b) => a.startTime.localeCompare(b.startTime));
												if (dayEntries.length === 0) return null;
												return (
													<section key={day} className="space-y-2">
														<div className="sticky top-0 z-10 -mx-4 mb-2 bg-muted/40 px-4 py-1 backdrop-blur-md border-y border-border/20">
															<h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
																{day.charAt(0) + day.slice(1).toLowerCase()}
															</h2>
														</div>
														<div className="space-y-2">
															{dayEntries.map((entry) => (
																<Card key={entry.entryId} className="rounded-2xl border-border/60 shadow-sm">
																	<CardContent className="p-3.5">
																		<div className="flex items-start justify-between gap-3">
																			<div className="min-w-0">
																				<p className="truncate text-sm font-semibold leading-tight text-foreground">{entry.subject.name}</p>
																				<p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{entry.subject.code}</p>
																			</div>
																			{renderSelectedEntryBadges && (
																				<div className="shrink-0 flex items-center gap-1.5">
																					{renderSelectedEntryBadges(entry)}
																				</div>
																			)}
																		</div>
																		<div className="mt-2 space-y-1 text-xs text-muted-foreground">
																			{renderSelectedEntryDetails(entry)}
																		</div>
																	</CardContent>
																</Card>
															))}
														</div>
													</section>
												);
											})}
										</div>
									</>
								)}
						</CardContent>
					</Card>
				</div>

				<div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
					<p>Published schedule view</p>
					{sourceMode === 'saved' ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Saved snapshot</Badge> : <Badge variant="outline">Live publish</Badge>}
				</div>
			</div>
		</div>
		</div>
	);
}
