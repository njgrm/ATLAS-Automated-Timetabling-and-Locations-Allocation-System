import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	AlertTriangle,
	CalendarX,
	DoorOpen,
	Info,
	Layers3,
	RefreshCw,
	ServerOff,
	Users,
	Wrench,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { pivotDraftToView } from '@/lib/schedule-pivot';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { ConflictInspectorSheet, type ConflictInspectorData } from '@/components/ConflictInspectorSheet';
import { OccupancyTemplatePreview } from '@/components/room-schedules/OccupancyTemplatePreview';
import { ScheduleTimetableGrid } from '@/components/room-schedules/ScheduleTimetableGrid';
import { ScheduleMobileCards } from '@/components/room-schedules/ScheduleMobileCards';
import { exportScheduleToCsv } from '@/components/room-schedules/schedule-export';
import { SmartHelpTrigger, SmartSourceStatusChip } from '@/components/smart/SmartPageShell';
import type { Building, Room, Subject, FacultyMirror, RoomScheduleView, SectionSummaryResponse, DraftReport } from '@/types';
import type { ViewMode, SectionInfo } from '@/components/room-schedules/schedule-types';

const DEFAULT_SCHOOL_ID = 1;

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

type SourceMode = 'latest' | 'run';

type FetchState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ok'; data: RoomScheduleView }
	| { status: 'empty'; message: string }
	| { status: 'error'; message: string };

export default function RoomSchedules() {
	const [searchParams] = useSearchParams();
	const queryRoomId = searchParams.get('roomId');
	const querySource = searchParams.get('source');

	const [rooms, setRooms] = useState<(Room & { buildingName: string })[]>([]);
	const [facultyList, setFacultyList] = useState<FacultyMirror[]>([]);
	const [sectionList, setSectionList] = useState<{ id: number; name: string; gradeLevelName: string }[]>([]);
	const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, string>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, SectionInfo>>(new Map());
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [roomsLoading, setRoomsLoading] = useState(true);
	const [lookupError, setLookupError] = useState(false);

	const [viewMode, setViewMode] = useState<ViewMode>('rooms');
	const [selectedRoomId, setSelectedRoomId] = useState<string>('');
	const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
	const [selectedSectionId, setSelectedSectionId] = useState<string>('');
	const [sourceMode, setSourceMode] = useState<SourceMode>((querySource === 'latest' || querySource === 'run') ? querySource : 'latest');
	const [runIdInput, setRunIdInput] = useState('');
	const [presentationMode, setPresentationMode] = useState<'schedule' | 'occupancy'>('schedule');
	const [templateVariant, setTemplateVariant] = useState<'11x6' | '13x6'>('11x6');

	const [state, setState] = useState<FetchState>({ status: 'idle' });
	const [conflictData, setConflictData] = useState<ConflictInspectorData | null>(null);

	const sectionNameMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const [id, info] of sectionMap) m.set(id, info.name);
		return m;
	}, [sectionMap]);

	const roomMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const r of rooms) m.set(r.id, r.name);
		return m;
	}, [rooms]);

	const selectedEntityId =
		viewMode === 'rooms' ? selectedRoomId
			: viewMode === 'teachers' ? selectedTeacherId
				: selectedSectionId;
	const setSelectedEntityId =
		viewMode === 'rooms' ? setSelectedRoomId
			: viewMode === 'teachers' ? setSelectedTeacherId
				: setSelectedSectionId;

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

				if (activeSchoolYearId) {
					atlasApi.get<SectionSummaryResponse>(`/sections/summary/${activeSchoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`)
						.then((r) => {
							const secMap = new Map<number, SectionInfo>();
							const list: { id: number; name: string; gradeLevelName: string }[] = [];
							for (const s of r.data.sections) {
								const grade = s.gradeLevelName ? Number(s.gradeLevelName.replace(/\D/g, '')) || null : null;
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

	const [debouncedRunId, setDebouncedRunId] = useState('');
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => {
		debounceTimer.current = setTimeout(() => setDebouncedRunId(runIdInput), 300);
		return () => clearTimeout(debounceTimer.current);
	}, [runIdInput]);

	const isRunIdValid = sourceMode === 'latest' || (sourceMode === 'run' && /^[1-9]\d*$/.test(debouncedRunId));
	const runIdHasValidationError = sourceMode === 'run' && runIdInput.trim().length > 0 && !/^[1-9]\d*$/.test(runIdInput.trim());
	const runIdMissing = sourceMode === 'run' && runIdInput.trim().length === 0;
	const selectedModeCopy = MODE_COPY[viewMode];
	const SelectedModeIcon = selectedModeCopy.icon;

	const fetchSchedule = useCallback(async () => {
		if (!selectedEntityId || !schoolYearId) return;

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

	useEffect(() => {
		if (!selectedEntityId) {
			setState({ status: 'idle' });
		}
	}, [viewMode, selectedEntityId]);

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

	const teacherGroups = useMemo(() => {
		const byDept = new Map<string, { value: string; label: string }[]>();
		const sorted = [...facultyList].sort(
			(a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
		);
		for (const f of sorted) {
			const key = f.department || 'Unassigned';
			const list = byDept.get(key) ?? [];
			list.push({ value: String(f.id), label: `${f.lastName}, ${f.firstName}` });
			byDept.set(key, list);
		}
		return Array.from(byDept.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, items]) => ({ label, items }));
	}, [facultyList]);

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

	const activeSelector = useMemo(() => {
		if (viewMode === 'rooms') return { groups: roomGroups, placeholder: 'Select room…' };
		if (viewMode === 'teachers') return { groups: teacherGroups, placeholder: 'Select teacher…' };
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

	const selectedName = useMemo(() => {
		if (viewMode === 'rooms') {
			const r = rooms.find((x) => String(x.id) === selectedEntityId);
			return r?.name ?? 'room';
		}
		if (viewMode === 'teachers') {
			const f = facultyList.find((x) => String(x.id) === selectedEntityId);
			return f ? `${f.lastName}_${f.firstName}` : 'teacher';
		}
		const s = sectionList.find((x) => String(x.id) === selectedEntityId);
		return s?.name ?? 'section';
	}, [viewMode, selectedEntityId, rooms, facultyList, sectionList]);

	const handleExport = useCallback(() => {
		if (state.status !== 'ok') return;
		exportScheduleToCsv(state.data, viewMode, selectedName, subjectMap, facultyMap, sectionMap, roomMap);
	}, [state, viewMode, selectedName, subjectMap, facultyMap, sectionMap, roomMap]);

	const conflictHandler = useCallback((day: string, dayLabel: string, startTime: string, endTime: string, entries: Parameters<NonNullable<Parameters<typeof ScheduleTimetableGrid>[0]['onConflictClick']>>[4]) => {
		if (state.status !== 'ok') return;
		setConflictData({
			day,
			dayLabel,
			startTime,
			endTime,
			roomName: state.data.room.name,
			roomId: viewMode === 'rooms' ? Number(selectedEntityId) : 0,
			runId: state.data.source.runId ?? 0,
			runStatus: state.data.source.status,
			entries,
		});
	}, [state, viewMode, selectedEntityId]);

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col bg-primary/5">
			<div className="shrink-0 px-3 pt-2 lg:px-5">
				<header className="flex flex-col gap-1.5 rounded-xl border border-primary/10 bg-white px-3 py-2 shadow-soft sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider">
								Schedules
							</span>
							<SmartSourceStatusChip
								label={state.status === 'ok' ? 'Ready to review' : roomsLoading ? 'Loading names' : 'Choose schedule'}
								tone={state.status === 'ok' ? 'live' : roomsLoading ? 'checking' : 'neutral'}
								testId="schedules-readiness-chip"
							/>
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<SmartHelpTrigger
							title="How to browse schedules"
							description="Use this page to inspect the latest generated schedule by room, teacher, or section."
							steps={[
								{ title: 'Choose a view', body: 'Pick Rooms, Teachers, or Sections depending on what you need to inspect.', target: 'View buttons' },
								{ title: 'Pick one schedule', body: 'Use the searchable selector to choose the exact room, teacher, or section.', target: 'Schedule selector' },
								{ title: 'Review conflicts', body: 'Conflict badges explain which classes need attention.', target: 'Conflict labels' },
								{ title: 'Use expert tools only when needed', body: 'Run ID and occupancy preview are for troubleshooting.', target: 'Expert tools' },
							]}
						/>
						<Popover>
							<PopoverTrigger asChild>
								<Button type="button" variant="outline" size="sm" className="h-10 gap-2 bg-white" data-testid="schedules-tools-trigger">
									<Wrench className="size-4" />
									<span className="hidden sm:inline">Tools</span>
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-80 space-y-3 p-4">
								<div>
									<p className="text-sm font-semibold text-slate-900">Inspect a specific generation run</p>
									<p className="mt-1 text-xs leading-relaxed text-slate-500">Keep Latest selected for normal work. Use a Run ID only when troubleshooting a known historical run.</p>
								</div>
								<div className="flex gap-2">
									<Button type="button" onClick={() => setSourceMode('latest')} variant={sourceMode === 'latest' ? 'default' : 'outline'} size="sm">Latest</Button>
									<Button type="button" onClick={() => setSourceMode('run')} variant={sourceMode === 'run' ? 'default' : 'outline'} size="sm">Run ID</Button>
								</div>
								{sourceMode === 'run' && (
									<div className="space-y-1.5">
										<Input
											type="number"
											min={1}
											placeholder="Run ID"
											value={runIdInput}
											onChange={(event) => setRunIdInput(event.target.value)}
											aria-label="Generation run ID"
											aria-invalid={runIdHasValidationError}
										/>
										{runIdHasValidationError && <p className="text-xs font-medium text-destructive">Use a whole number above 0.</p>}
									</div>
								)}
							</PopoverContent>
						</Popover>
					</div>
				</header>

				<div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
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
								className={`h-10 shrink-0 justify-start gap-2 rounded-lg px-3 text-left shadow-sm ${viewMode === mode ? '' : 'border-primary/10 bg-white text-slate-700 hover:border-primary/30'}`}
							>
								<Icon className="size-4 shrink-0" />
								<span className="min-w-0">
									<span className="block text-xs font-bold">{copy.label}</span>
								</span>
							</Button>
						);
					})}
				</div>
			</div>

			<div className="shrink-0 px-3 pt-2 pb-2 flex flex-col gap-2 lg:px-5">
				<div className="flex flex-wrap items-center gap-2">
					<div className="min-w-0 flex-1" style={{ minWidth: 'clamp(160px, 40vw, 100%)' }} data-testid="schedule-browser-selector">
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
						<p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
							<Info className="size-3 text-primary" />
							{selectorStatus}
						</p>
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						{viewMode === 'rooms' && (
							<Button
								variant={presentationMode === 'occupancy' ? 'default' : 'outline'}
								size="sm"
								className="h-10 px-3 text-xs"
								onClick={() => setPresentationMode(presentationMode === 'occupancy' ? 'schedule' : 'occupancy')}
							>
								{presentationMode === 'occupancy' ? 'Schedule' : 'Occupancy'}
							</Button>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={fetchSchedule}
							disabled={!selectedEntityId || state.status === 'loading' || !isRunIdValid || runIdHasValidationError || runIdMissing}
							className="h-10 shrink-0 shadow-sm"
						>
							<RefreshCw className={`mr-1 size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
							Refresh
						</Button>
					</div>
				</div>
				<Button
					variant="default"
					size="sm"
					onClick={handleExport}
					disabled={state.status !== 'ok'}
					className="h-10 w-full shrink-0 shadow-sm text-xs"
					data-testid="schedules-export-current-view"
				>
					Export CSV
				</Button>
			</div>

			{state.status === 'ok' && (
				<div className="shrink-0 px-3 lg:px-5 pb-1">
					<div className="flex items-center gap-3 text-sm bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm overflow-x-auto whitespace-nowrap scrollbar-none">
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
				</div>
			)}

			{viewMode === 'rooms' && presentationMode === 'occupancy' && (
				<div className="shrink-0 px-3 lg:px-5 pb-1">
					<div className="flex items-center gap-1.5">
						<Button variant={templateVariant === '11x6' ? 'default' : 'outline'} size="sm" className="h-10 px-3 text-xs" onClick={() => setTemplateVariant('11x6')}>11x6</Button>
						<Button variant={templateVariant === '13x6' ? 'default' : 'outline'} size="sm" className="h-10 px-3 text-xs" onClick={() => setTemplateVariant('13x6')}>13x6</Button>
					</div>
				</div>
			)}

			<div className="flex-1 min-h-0 overflow-auto px-4 pb-4 pt-2 lg:px-5">
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
					<>
						<div className="hidden lg:block">
							<ScheduleTimetableGrid
								view={state.data}
								viewMode={viewMode}
								subjectMap={subjectMap}
								facultyMap={facultyMap}
								sectionMap={sectionMap}
								roomMap={roomMap}
								onConflictClick={conflictHandler}
							/>
						</div>
						<div className="lg:hidden">
							<ScheduleMobileCards
								view={state.data}
								viewMode={viewMode}
								subjectMap={subjectMap}
								facultyMap={facultyMap}
								sectionMap={sectionMap}
								roomMap={roomMap}
								onConflictClick={conflictHandler}
							/>
						</div>
					</>
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
