import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	AlertTriangle,
	CalendarDays,
	CalendarX,
	DoorOpen,
	Info,
	Layers3,
	RefreshCw,
	ServerOff,
	Users,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { formatTime } from '@/lib/utils';
import { pivotDraftToView, type PivotEntityKind } from '@/lib/schedule-pivot';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { ConflictInspectorSheet, type ConflictInspectorData } from '@/components/ConflictInspectorSheet';
import { OccupancyTemplatePreview } from '@/components/room-schedules/OccupancyTemplatePreview';
import { GradeLevelBadge, parseGradeFromSectionName } from '@/components/GradeLevelBadge';
import type { Building, Room, Subject, FacultyMirror, RoomScheduleView, RoomScheduleEntry, SectionSummaryResponse, DraftReport } from '@/types';

type SectionInfo = { name: string; gradeLevel: number | null };

// ─── Constants ───

const DEFAULT_SCHOOL_ID = 1;

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

// ─── Types ───

type SourceMode = 'latest' | 'run';
type ViewMode = 'rooms' | 'teachers' | 'sections';

const MODE_COPY: Record<ViewMode, { label: string; description: string; emptyTitle: string; emptyBody: string; icon: typeof DoorOpen }> = {
	rooms: {
		label: 'Rooms',
		description: 'Inspect room use and conflicts',
		emptyTitle: 'Choose a room',
		emptyBody: 'Pick a teaching room to see how the latest schedule uses that space and whether any conflicts need review.',
		icon: DoorOpen,
	},
	teachers: {
		label: 'Teachers',
		description: 'Inspect teacher daily load',
		emptyTitle: 'Choose a teacher',
		emptyBody: 'Pick a teacher to review daily teaching blocks, room movement, and possible schedule conflicts.',
		icon: Users,
	},
	sections: {
		label: 'Sections',
		description: 'Inspect section timetable',
		emptyTitle: 'Choose a section',
		emptyBody: 'Pick a section to review the student-facing timetable before review or publish decisions.',
		icon: Layers3,
	},
};

type FetchState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ok'; data: RoomScheduleView }
	| { status: 'empty'; message: string }
	| { status: 'error'; message: string };

// ─── Page ───

export default function RoomSchedules() {
	const [searchParams] = useSearchParams();
	const queryRoomId = searchParams.get('roomId');
	const querySource = searchParams.get('source');

	/* Lookup data */
	const [rooms, setRooms] = useState<(Room & { buildingName: string })[]>([]);
	const [facultyList, setFacultyList] = useState<FacultyMirror[]>([]);
	const [sectionList, setSectionList] = useState<{ id: number; name: string; gradeLevelName: string }[]>([]);
	const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, string>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, SectionInfo>>(new Map());
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [roomsLoading, setRoomsLoading] = useState(true);
	const [lookupError, setLookupError] = useState(false);

	/* Selections */
	const [viewMode, setViewMode] = useState<ViewMode>('rooms');
	const [selectedRoomId, setSelectedRoomId] = useState<string>('');
	const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
	const [selectedSectionId, setSelectedSectionId] = useState<string>('');
	const [sourceMode, setSourceMode] = useState<SourceMode>((querySource === 'latest' || querySource === 'run') ? querySource : 'latest');
	const [runIdInput, setRunIdInput] = useState('');
	const [presentationMode, setPresentationMode] = useState<'schedule' | 'occupancy'>('schedule');
	const [templateVariant, setTemplateVariant] = useState<'11x6' | '13x6'>('11x6');

	/* Schedule data */
	const [state, setState] = useState<FetchState>({ status: 'idle' });

	/* Conflict inspector */
	const [conflictData, setConflictData] = useState<ConflictInspectorData | null>(null);

	/* Derive a name-only sectionMap for legacy consumers that don't need grade info. */
	const sectionNameMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const [id, info] of sectionMap) m.set(id, info.name);
		return m;
	}, [sectionMap]);

	/* Derive a roomMap (id -> label) for non-room views */
	const roomMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const r of rooms) m.set(r.id, r.name);
		return m;
	}, [rooms]);

	/* Current selection id based on viewMode */
	const selectedEntityId =
		viewMode === 'rooms' ? selectedRoomId
			: viewMode === 'teachers' ? selectedTeacherId
				: selectedSectionId;
	const setSelectedEntityId =
		viewMode === 'rooms' ? setSelectedRoomId
			: viewMode === 'teachers' ? setSelectedTeacherId
				: setSelectedSectionId;

	/* Load lookup data on mount */
	useEffect(() => {
		(async () => {
			try {
				setLookupError(false);
				const yearContext = await resolveActiveSchoolYearContext({ allowStaleOnError: true });
				const activeSchoolYearId = yearContext.activeSchoolYearId;

				const [buildingsRes, subjectsRes, facultyRes] = await Promise.all([
					atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
					atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { subjects: [] as Subject[] } })),
					atlasApi.get<{ faculty: FacultyMirror[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { faculty: [] as FacultyMirror[] } })),
				]);

				setSchoolYearId(activeSchoolYearId);

				// Fetch section names
				if (activeSchoolYearId) {
					atlasApi.get<SectionSummaryResponse>(`/sections/summary/${activeSchoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`)
						.then((r) => {
							const secMap = new Map<number, SectionInfo>();
							const list: { id: number; name: string; gradeLevelName: string }[] = [];
							for (const s of r.data.sections) {
								const grade = parseGradeFromSectionName(s.gradeLevelName) ?? parseGradeFromSectionName(s.name);
								secMap.set(s.id, { name: s.name, gradeLevel: grade });
								list.push({ id: s.id, name: s.name, gradeLevelName: s.gradeLevelName });
							}
							setSectionMap(secMap);
							setSectionList(list);
						})
						.catch(() => { /* best-effort */ });
				}

				const allRooms: (Room & { buildingName: string })[] = [];
				for (const b of buildingsRes.data.buildings) {
					for (const r of b.rooms ?? []) {
						if (r.isTeachingSpace) allRooms.push({ ...r, buildingName: b.name });
					}
				}
				allRooms.sort((a, b) => a.name.localeCompare(b.name));
				setRooms(allRooms);

				// Auto-select room from query param
				if (queryRoomId && allRooms.some((r) => String(r.id) === queryRoomId)) {
					setSelectedRoomId(queryRoomId);
				}

				const sMap = new Map<number, string>();
				for (const s of subjectsRes.data.subjects) {
					sMap.set(s.id, s.displayCode ?? s.code ?? s.name);
				}
				setSubjectMap(sMap);

				const fMap = new Map<number, string>();
				const activeFaculty: FacultyMirror[] = [];
				for (const f of facultyRes.data.faculty) {
					fMap.set(f.id, `${f.lastName}, ${f.firstName.charAt(0)}.`);
					if (f.isActiveForScheduling !== false) activeFaculty.push(f);
				}
				setFacultyMap(fMap);
				setFacultyList(activeFaculty);
			} catch {
				setLookupError(true);
			} finally {
				setRoomsLoading(false);
			}
		})();
	}, []);

	/* Fetch room schedule */
	/* Debounced runId — avoids request spam while typing */
	const [debouncedRunId, setDebouncedRunId] = useState('');
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => {
		debounceTimer.current = setTimeout(() => setDebouncedRunId(runIdInput), 300);
		return () => clearTimeout(debounceTimer.current);
	}, [runIdInput]);

	/* Derived: is the current source config valid for fetching? */
	const isRunIdValid = sourceMode === 'latest' || (sourceMode === 'run' && /^[1-9]\d*$/.test(debouncedRunId));
	const runIdHasValidationError = sourceMode === 'run' && runIdInput.trim().length > 0 && !/^[1-9]\d*$/.test(runIdInput.trim());
	const runIdMissing = sourceMode === 'run' && runIdInput.trim().length === 0;
	const selectedModeCopy = MODE_COPY[viewMode];
	const SelectedModeIcon = selectedModeCopy.icon;
	const sourceSummary = state.status === 'ok'
		? `${sourceMode === 'latest' ? 'Latest completed run' : 'Run ID'} #${state.data.source.runId} · ${state.data.source.status}`
		: sourceMode === 'latest'
			? 'Latest means the newest completed generation run.'
			: runIdInput.trim()
				? `Run ID ${runIdInput.trim()} is used for troubleshooting a specific generation run.`
				: 'Run ID means inspect a specific generation run for troubleshooting.';

	const fetchSchedule = useCallback(async () => {
		if (!selectedEntityId || !schoolYearId) return;

		// Client-side guard: prevent 400 for missing/invalid runId
		if (sourceMode === 'run' && !/^[1-9]\d*$/.test(debouncedRunId)) {
			setState({ status: 'empty', message: 'Enter a valid Run ID to view this source.' });
			return;
		}

		setState({ status: 'loading' });
		try {
			if (viewMode === 'rooms') {
				const params = new URLSearchParams({ source: sourceMode });
				if (sourceMode === 'run') params.set('runId', debouncedRunId);

				const { data } = await atlasApi.get<RoomScheduleView>(
					`/room-schedules/${DEFAULT_SCHOOL_ID}/${schoolYearId}/rooms/${selectedEntityId}?${params}`,
				);
				setState({ status: 'ok', data });
			} else {
				// Teachers / Sections: pivot the latest (or specific run) timetable client-side
				const url = sourceMode === 'latest'
					? `/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/latest/timetable`
					: `/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${debouncedRunId}/timetable`;

				const { data: report } = await atlasApi.get<DraftReport>(url);

				const entityId = Number(selectedEntityId);
				let entity: { id: number; name: string; subtitle?: string };
				if (viewMode === 'teachers') {
					const f = facultyList.find((x) => x.id === entityId);
					entity = {
						id: entityId,
						name: f ? `${f.lastName}, ${f.firstName}` : 'Teacher not listed',
						subtitle: f?.department ?? undefined,
					};
				} else {
					const s = sectionList.find((x) => x.id === entityId);
					entity = {
						id: entityId,
						name: s?.name ?? 'Section not listed',
						subtitle: s?.gradeLevelName,
					};
				}

				const view = pivotDraftToView(report, viewMode, entityId, entity, subjectMap);
				setState({ status: 'ok', data: view });
			}
		} catch (e: unknown) {
			const resp = (e as { response?: { data?: { code?: string; message?: string } } })?.response;
			const code = resp?.data?.code;
			const msg = resp?.data?.message ?? 'Failed to load schedule.';
			if (code === 'NO_RUNS') {
				setState({ status: 'empty', message: msg });
			} else {
				setState({ status: 'error', message: msg });
			}
		}
	}, [viewMode, selectedEntityId, schoolYearId, sourceMode, debouncedRunId, facultyList, sectionList, subjectMap]);

	/* Auto-fetch when selection, view mode, source mode, or valid runId changes */
	useEffect(() => {
		if (!selectedEntityId || !schoolYearId) return;
		if (sourceMode === 'run' && !/^[1-9]\d*$/.test(debouncedRunId)) {
			if (debouncedRunId !== '') {
				setState({ status: 'empty', message: 'Enter a valid Run ID to view this source.' });
			}
			return;
		}
		fetchSchedule();
	}, [selectedEntityId, schoolYearId, sourceMode, debouncedRunId, fetchSchedule]);

	/* Reset state when switching view modes if no current selection */
	useEffect(() => {
		if (!selectedEntityId) {
			setState({ status: 'idle' });
		}
	}, [viewMode, selectedEntityId]);

	/* Grouped rooms for searchable selector */
	const roomGroups = useMemo(() => {
		const byBuilding = new Map<string, { value: string; label: string }[]>();
		for (const r of rooms) {
				const key = r.buildingName || 'Building not listed';
			const list = byBuilding.get(key) ?? [];
			list.push({ value: String(r.id), label: `${r.name} (F${r.floor})` });
			byBuilding.set(key, list);
		}
		return Array.from(byBuilding.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [rooms]);

	/* Grouped teachers by department */
	const teacherGroups = useMemo(() => {
		const byDept = new Map<string, { value: string; label: string }[]>();
		const sorted = [...facultyList].sort(
			(a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
		);
		for (const f of sorted) {
			const key = f.department || 'Unassigned';
			const list = byDept.get(key) ?? [];
			list.push({
				value: String(f.id),
				label: `${f.lastName}, ${f.firstName}`,
			});
			byDept.set(key, list);
		}
		return Array.from(byDept.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [facultyList]);

	/* Grouped sections by grade level */
	const sectionGroups = useMemo(() => {
		const byGrade = new Map<string, { value: string; label: string }[]>();
		const sorted = [...sectionList].sort(
			(a, b) => a.gradeLevelName.localeCompare(b.gradeLevelName) || a.name.localeCompare(b.name),
		);
		for (const s of sorted) {
			const key = s.gradeLevelName || 'Other';
			const list = byGrade.get(key) ?? [];
			list.push({ value: String(s.id), label: s.name });
			byGrade.set(key, list);
		}
		return Array.from(byGrade.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [sectionList]);

	/* Active selector config */
	const activeSelector = useMemo(() => {
		if (viewMode === 'rooms') {
			return { groups: roomGroups, placeholder: 'Select room…' };
		}
		if (viewMode === 'teachers') {
			return { groups: teacherGroups, placeholder: 'Select teacher…' };
		}
		return { groups: sectionGroups, placeholder: 'Select section…' };
	}, [viewMode, roomGroups, teacherGroups, sectionGroups]);
	const activeSelectorCount = activeSelector.groups.reduce((count, group) => count + group.items.length, 0);
	const selectorStatus = roomsLoading
		? 'Loading schedule references.'
		: lookupError
			? 'Schedule references are unavailable right now.'
		: activeSelectorCount === 0
			? `No ${selectedModeCopy.label.toLowerCase()} are available yet.`
			: `${activeSelectorCount} ${selectedModeCopy.label.toLowerCase()} available.`;

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col bg-primary/5">
			<div className="shrink-0 px-6 pt-5 lg:px-8">
				<header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-primary">Review and publish</p>
						<h1 className="mt-1 text-3xl font-bold text-slate-900">Schedules</h1>
						<p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
							Browse the latest room, teacher, and section schedules.
						</p>
					</div>
					<div className="rounded-2xl border border-primary/10 bg-white px-4 py-3 shadow-soft">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
							<CalendarDays className="size-4 text-primary" />
							Source
						</div>
						<p className="mt-1 text-sm font-semibold text-slate-900">{sourceSummary}</p>
					</div>
				</header>

				<div className="mt-4 grid gap-3 md:grid-cols-3">
					{(['rooms', 'teachers', 'sections'] as ViewMode[]).map((mode) => {
						const copy = MODE_COPY[mode];
						const Icon = copy.icon;
						return (
							<Button
								key={mode}
								type="button"
								variant={viewMode === mode ? 'default' : 'outline'}
								onClick={() => {
									setViewMode(mode);
									if (mode !== 'rooms' || presentationMode === 'occupancy') setPresentationMode('schedule');
								}}
								className={`h-auto justify-start gap-3 rounded-2xl px-4 py-3 text-left shadow-soft ${viewMode === mode ? '' : 'border-primary/10 bg-white text-slate-700 hover:border-primary/30'}`}
							>
								<Icon className="size-5 shrink-0" />
								<span className="min-w-0">
									<span className="block text-sm font-bold">{copy.label}</span>
									<span className="block truncate text-xs opacity-80">{copy.description}</span>
								</span>
							</Button>
						);
					})}
				</div>
			</div>
			{/* ── Toolbar row ── */}
			<div className="shrink-0 px-6 pt-4 pb-2 flex items-center gap-3 flex-wrap lg:px-8">
				<div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white px-3 py-2 shadow-sm">
					<SelectedModeIcon className="size-4 text-primary" />
					<div>
						<p className="text-xs font-semibold text-slate-900">Browsing {selectedModeCopy.label.toLowerCase()}</p>
						<p className="text-xs text-slate-500">{selectedModeCopy.description}</p>
					</div>
				</div>

				{/* Entity selector (rooms / teachers / sections) */}
				<div className="min-w-72 flex-1 max-w-xl">
					{roomsLoading ? (
						<Skeleton className="h-10 w-full rounded-xl" />
					) : (
						<SearchableSelect
							value={selectedEntityId}
							onValueChange={setSelectedEntityId}
							groups={activeSelector.groups}
							placeholder={activeSelector.placeholder}
							triggerClassName="h-10 text-sm w-full rounded-xl bg-white shadow-sm"
						/>
					)}
					<p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
						<Info className="size-3 text-primary" />
						{selectorStatus}
					</p>
				</div>

				{/* Source pill toggles */}
				<div className="flex flex-wrap items-start gap-1.5 rounded-xl border border-slate-100 bg-white px-2 py-2 shadow-sm">
					<Button
						variant={presentationMode === 'schedule' ? 'default' : 'outline'}
						size="sm"
						className="h-8 px-3 text-xs"
						onClick={() => setPresentationMode('schedule')}
					>
						Schedule
					</Button>
					{viewMode === 'rooms' && (
						<Button
							variant={presentationMode === 'occupancy' ? 'default' : 'outline'}
							size="sm"
							className="h-8 px-3 text-xs"
							onClick={() => setPresentationMode('occupancy')}
						>
							Occupancy Preview
						</Button>
					)}
					{viewMode === 'rooms' && presentationMode === 'occupancy' && (
						<div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1">
							<Button
								variant={templateVariant === '11x6' ? 'default' : 'outline'}
								size="sm"
								className="h-7 px-2.5 text-xs"
								onClick={() => setTemplateVariant('11x6')}
							>
								11x6
							</Button>
							<Button
								variant={templateVariant === '13x6' ? 'default' : 'outline'}
								size="sm"
								className="h-7 px-2.5 text-xs"
								onClick={() => setTemplateVariant('13x6')}
							>
								13x6
							</Button>
						</div>
					)}
					<Button
						onClick={() => setSourceMode('latest')}
						variant={sourceMode === 'latest' ? 'default' : 'outline'}
						size="sm"
						className="h-8 px-3 text-xs"
					>
						Latest
					</Button>
					<Button
						onClick={() => setSourceMode('run')}
						variant={sourceMode === 'run' ? 'default' : 'outline'}
						size="sm"
						className="h-8 px-3 text-xs"
					>
						Run ID
					</Button>
					{sourceMode === 'run' && (
						<div className="space-y-1">
							<Input
								type="number"
								min={1}
								placeholder="Run ID"
								value={runIdInput}
								onChange={(e) => setRunIdInput(e.target.value)}
								aria-invalid={runIdHasValidationError}
								className="h-7 w-24 text-xs"
							/>
							{runIdHasValidationError && <p className="text-xs font-medium text-destructive">Use a whole number above 0.</p>}
						</div>
					)}
					<p className="basis-full text-xs leading-relaxed text-slate-500">{sourceMode === 'latest' ? 'Latest means the newest completed generation run.' : 'Run ID inspects one specific generation run for troubleshooting.'}</p>
				</div>

				{/* Inline stat banner */}
				{state.status === 'ok' && (
					<div className="flex items-center gap-4 text-sm bg-card border border-border rounded-md px-4 py-1.5 shadow-sm overflow-x-auto whitespace-nowrap scrollbar-none">
						<span className="font-semibold text-foreground">
							Utilization: <span className="text-muted-foreground font-normal">{state.data.summary.utilizationPercent}%</span>
						</span>
						<span className="text-border/60">•</span>
						<span className="font-semibold text-foreground">
							Occupied: <span className="text-muted-foreground font-normal">{state.data.summary.occupiedMinutes}/{state.data.summary.availableMinutes} min</span>
						</span>
						<span className="text-border/60">•</span>
						{state.data.summary.conflictCount > 0 ? (
							<Badge variant="destructive" className="text-xs">
								<AlertTriangle className="mr-1 size-3" />
								{state.data.summary.conflictCount} conflict{state.data.summary.conflictCount !== 1 ? 's' : ''}
							</Badge>
						) : (
							<span className="font-semibold text-foreground">
								Conflicts: <span className="text-green-600 font-normal">0</span>
							</span>
						)}
						<span className="text-border/60">•</span>
						<span className="text-muted-foreground text-xs">
							Run #{state.data.source.runId} · {state.data.source.status}
						</span>
					</div>
				)}

				{/* Refresh */}
				<Button
					variant="outline"
					size="sm"
					onClick={fetchSchedule}
					disabled={!selectedEntityId || state.status === 'loading' || !isRunIdValid || runIdHasValidationError || runIdMissing}
					className="h-8 ml-auto shrink-0 shadow-sm"
				>
					<RefreshCw className={`mr-1 size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			</div>

			{/* ── Main content ── */}
			<div className="flex-1 min-h-0 overflow-auto px-6 pb-4 pt-2 lg:px-8">
				{state.status === 'idle' && (
					<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-white p-8 text-center text-muted-foreground shadow-soft">
						<div className="max-w-md">
							<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<SelectedModeIcon className="size-7" />
							</div>
							<p className="text-base font-bold text-slate-900">{lookupError ? 'Schedule references unavailable' : selectedModeCopy.emptyTitle}</p>
							<p className="mt-2 text-sm leading-relaxed text-slate-500">
								{lookupError ? 'ATLAS could not load the active school year or reference lists. Refresh when the connection is stable.' : selectedModeCopy.emptyBody}
							</p>
							<p className="mt-3 text-xs text-slate-400">
								{lookupError ? 'The page will keep actions disabled until references load.' : 'Use the selector above, then keep Latest selected unless you are checking a known Run ID.'}
							</p>
						</div>
					</div>
				)}

				{state.status === 'loading' && (
					<div className="space-y-1 pt-2">
						<Skeleton className="h-10 w-full rounded" />
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-14 w-full rounded" />
						))}
					</div>
				)}

				{state.status === 'empty' && (
					<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-muted-foreground shadow-soft">
						<div className="max-w-md">
							<CalendarX className="mx-auto mb-3 size-10 text-slate-300" />
							<p className="text-base font-bold text-slate-900">Schedule not available</p>
							<p className="mt-2 text-sm leading-relaxed text-slate-500">{state.message}</p>
							<p className="mt-3 text-xs text-slate-400">
								{sourceMode === 'run'
									? 'Check the Run ID or switch back to Latest.'
									: 'Generate a timetable first, then return here to browse rooms, teachers, and sections.'}
							</p>
						</div>
					</div>
				)}

				{state.status === 'error' && (
					<div className="flex h-full items-center justify-center rounded-2xl border border-destructive/20 bg-white p-8 text-center text-destructive shadow-soft">
						<div className="max-w-md">
							<ServerOff className="mx-auto mb-3 size-10 opacity-60" />
							<p className="text-base font-bold">Schedule source unavailable</p>
							<p className="mt-2 text-sm leading-relaxed text-destructive/80">{state.message}</p>
							<Button variant="outline" size="sm" className="mt-4" onClick={fetchSchedule}>
								<RefreshCw className="mr-1.5 size-3.5" /> Retry
							</Button>
						</div>
					</div>
				)}

				{state.status === 'ok' && presentationMode === 'schedule' && (
					<TimetableGrid
						view={state.data}
						viewMode={viewMode}
						subjectMap={subjectMap}
						facultyMap={facultyMap}
						sectionMap={sectionMap}
						roomMap={roomMap}
						onConflictClick={(day, dayLabel, startTime, endTime, entries) => {
							const contextLabel = state.data.room.name;
							setConflictData({
								day,
								dayLabel,
								startTime,
								endTime,
								roomName: contextLabel,
								roomId: viewMode === 'rooms' ? Number(selectedEntityId) : 0,
								runId: state.data.source.runId ?? 0,
								runStatus: state.data.source.status,
								entries,
							});
						}}
					/>
				)}

				{state.status === 'ok' && presentationMode === 'occupancy' && viewMode === 'rooms' && (
					<OccupancyTemplatePreview
						view={state.data}
						variant={templateVariant}
						subjectMap={subjectMap}
						facultyMap={facultyMap}
						sectionMap={sectionNameMap}
						onPrint={() => window.print()}
					/>
				)}
			</div>

			{/* Conflict Inspector Sheet */}
			<ConflictInspectorSheet
				open={!!conflictData}
				data={conflictData}
				onClose={() => setConflictData(null)}
				subjectMap={subjectMap}
				facultyMap={facultyMap}
				sectionMap={sectionNameMap}
			/>
		</div>
	);
}

// ─── Timetable grid with rowSpan logic ───

type CellRender = {
	entries: RoomScheduleEntry[];
	conflict: boolean;
	rowSpan: number;
} | null; // null = cell is covered by a rowSpan from above

function computeSpanData(view: RoomScheduleView): CellRender[][] {
	const { grid, days } = view;
	const rowCount = grid.length;
	const dayCount = days.length;

	// result[rowIdx][dayIdx]
	const result: CellRender[][] = Array.from({ length: rowCount }, () =>
		Array(dayCount).fill(null) as CellRender[],
	);

	for (let dayIdx = 0; dayIdx < dayCount; dayIdx++) {
		let skipUntilRow = -1;

		for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
			// Already covered by a span from above
			if (rowIdx < skipUntilRow) {
				result[rowIdx][dayIdx] = null;
				continue;
			}

			const cell = grid[rowIdx].cells[dayIdx];

			if (!cell.occupied) {
				result[rowIdx][dayIdx] = { entries: [], conflict: false, rowSpan: 1 };
				continue;
			}

			// Determine rowSpan: how many consecutive rows share the exact same entries?
			const entryIds = new Set(cell.entries.map((e) => e.entryId));
			let span = 1;

			for (let nextRow = rowIdx + 1; nextRow < rowCount; nextRow++) {
				const nextCell = grid[nextRow].cells[dayIdx];
				if (!nextCell.occupied) break;
				const nextIds = nextCell.entries.map((e) => e.entryId);
				if (nextIds.length !== entryIds.size) break;
				if (!nextIds.every((id) => entryIds.has(id))) break;
				span++;
			}

			result[rowIdx][dayIdx] = {
				entries: cell.entries,
				conflict: cell.conflict,
				rowSpan: span,
			};

			if (span > 1) skipUntilRow = rowIdx + span;
		}
	}

	return result;
}

function TimetableGrid({
	view,
	viewMode,
	subjectMap,
	facultyMap,
	sectionMap,
	roomMap,
	onConflictClick,
}: {
	view: RoomScheduleView;
	viewMode: ViewMode;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, SectionInfo>;
	roomMap: Map<number, string>;
	onConflictClick?: (day: string, dayLabel: string, startTime: string, endTime: string, entries: RoomScheduleEntry[]) => void;
}) {
	const spanData = useMemo(() => computeSpanData(view), [view]);

	return (
		<table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
			<colgroup>
				<col className="w-24" />
				{view.days.map((d) => (
					<col key={d} />
				))}
			</colgroup>
			<thead className="sticky top-0 z-10 bg-background">
				<tr>
					<th className="sticky left-0 z-20 bg-background border-b-2 border-r px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Time
					</th>
					{view.days.map((d) => (
						<th
							key={d}
							className="border-b-2 px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
						>
							{DAY_SHORT[d] ?? d}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{view.grid.map((row, rowIdx) => (
						<tr key={rowIdx}>
							{/* Sticky time column */}
							<td className="sticky left-0 z-5 bg-background border-r border-b px-2 py-3 align-middle w-24">
								{row.timeSlot.eventLabel ? (
									<div className="text-xs font-bold text-foreground">
										{row.timeSlot.eventLabel}
									</div>
								) : (
									<div className="text-xs font-semibold text-foreground">
										{formatTime(row.timeSlot.startTime)}–{formatTime(row.timeSlot.endTime)}
									</div>
								)}
							</td>

							{/* Day cells */}
							{spanData[rowIdx].map((cellData, dayIdx) => {
								if (cellData === null) return null; // covered by rowSpan above

								if (cellData.entries.length === 0) {
									return (
										<td
											key={dayIdx}
											rowSpan={cellData.rowSpan}
											className="border-b border-r last:border-r-0 px-1 py-1"
										/>
									);
								}

								const firstGrade = cellData.entries.length > 0
									? sectionMap.get(cellData.entries[0].sectionId)?.gradeLevel ?? null
									: null;
								let baseCellClass = 'bg-primary/5 border-primary/20';
								if (firstGrade === 7) baseCellClass = 'bg-green-50 border-green-200';
								else if (firstGrade === 8) baseCellClass = 'bg-yellow-50 border-yellow-200';
								else if (firstGrade === 9) baseCellClass = 'bg-red-50 border-red-200';
								else if (firstGrade === 10) baseCellClass = 'bg-blue-50 border-blue-200';

								return (
									<td
										key={dayIdx}
										rowSpan={cellData.rowSpan}
										className={`border-b border-r last:border-r-0 px-1 py-0.5 align-top transition-colors ${
											cellData.conflict
												? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100'
												: baseCellClass
										}`}
										onClick={cellData.conflict && onConflictClick ? () => {
											const timeSlot = view.grid[rowIdx].timeSlot;
											onConflictClick(
												view.days[dayIdx],
												DAY_SHORT[view.days[dayIdx]] ?? view.days[dayIdx],
												timeSlot.startTime,
												timeSlot.endTime,
												cellData.entries,
											);
										} : undefined}
									>
										{cellData.entries.map((entry) => (
											<EntryCell
												key={entry.entryId}
												entry={entry}
												viewMode={viewMode}
												subjectMap={subjectMap}
												facultyMap={facultyMap}
												sectionMap={sectionMap}
												roomMap={roomMap}
											/>
										))}
										{cellData.conflict && (
											<Badge
												variant="destructive"
												className="mt-0.5 text-xs px-1 py-0 cursor-pointer hover:bg-red-700 transition-colors"
												role="button"
												tabIndex={0}
												aria-label="Inspect conflict"
											>
												<AlertTriangle className="mr-0.5 size-2.5" />
												Conflict — Click to inspect
											</Badge>
										)}
									</td>
								);
							})}
						</tr>
				))}
			</tbody>
		</table>
	);
}

function EntryCell({
	entry,
	viewMode,
	subjectMap,
	facultyMap,
	sectionMap,
	roomMap,
}: {
	entry: RoomScheduleEntry;
	viewMode: ViewMode;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, SectionInfo>;
	roomMap: Map<number, string>;
}) {
	const sectionInfo = sectionMap.get(entry.sectionId);
	const sectionLabel = sectionInfo?.name ?? 'Section not listed';
	const facultyLabel = entry.facultyId != null
		? (facultyMap.get(entry.facultyId) ?? 'Teacher not listed')
		: 'Unassigned teacher';
	const roomLabel = entry.roomId != null
		? (roomMap.get(entry.roomId) ?? 'Room not listed')
		: '—';

	return (
		<div className="px-1.5 py-1 text-xs leading-snug">
			<div className="font-semibold text-foreground truncate">
				{entry.subjectDisplayLabel ?? subjectMap.get(entry.subjectId) ?? 'Subject not listed'}
			</div>
			{viewMode === 'rooms' && (
				<>
					<div className="flex items-center gap-1 min-w-0">
						<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
						<span className="text-muted-foreground truncate">{sectionLabel}</span>
					</div>
					<div className="text-muted-foreground/80 truncate">{facultyLabel}</div>
				</>
			)}
			{viewMode === 'teachers' && (
				<>
					<div className="flex items-center gap-1 min-w-0">
						<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
						<span className="text-muted-foreground truncate">{sectionLabel}</span>
					</div>
					<div className="text-muted-foreground/80 truncate">{roomLabel}</div>
				</>
			)}
			{viewMode === 'sections' && (
				<>
					<div className="text-muted-foreground truncate">{facultyLabel}</div>
					<div className="text-muted-foreground/80 truncate">{roomLabel}</div>
				</>
			)}
		</div>
	);
}
