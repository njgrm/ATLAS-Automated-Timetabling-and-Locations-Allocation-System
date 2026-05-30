import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	AlertTriangle,
	CalendarX,
	DoorOpen,
	RefreshCw,
	ServerOff,
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
				/* rooms unavailable */
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
						name: f ? `${f.lastName}, ${f.firstName}` : `Teacher #${entityId}`,
						subtitle: f?.department ?? undefined,
					};
				} else {
					const s = sectionList.find((x) => x.id === entityId);
					entity = {
						id: entityId,
						name: s?.name ?? `Section #${entityId}`,
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
			const key = r.buildingName || 'Unknown';
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

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			{/* ── Toolbar row ── */}
			<div className="shrink-0 px-6 pt-4 pb-2 flex items-center gap-3 flex-wrap">
				{/* View mode toggle */}
				<div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1">
					<Button
						variant={viewMode === 'rooms' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-[11px]"
						onClick={() => {
							setViewMode('rooms');
							if (presentationMode === 'occupancy') setPresentationMode('schedule');
						}}
					>
						Rooms
					</Button>
					<Button
						variant={viewMode === 'teachers' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-[11px]"
						onClick={() => {
							setViewMode('teachers');
							setPresentationMode('schedule');
						}}
					>
						Teachers
					</Button>
					<Button
						variant={viewMode === 'sections' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-[11px]"
						onClick={() => {
							setViewMode('sections');
							setPresentationMode('schedule');
						}}
					>
						Sections
					</Button>
				</div>

				{/* Entity selector (rooms / teachers / sections) */}
				<div className="min-w-55">
					{roomsLoading ? (
						<Skeleton className="h-8 w-full" />
					) : (
						<SearchableSelect
							value={selectedEntityId}
							onValueChange={setSelectedEntityId}
							groups={activeSelector.groups}
							placeholder={activeSelector.placeholder}
							triggerClassName="h-8 text-sm w-full"
						/>
					)}
				</div>

				{/* Source pill toggles */}
				<div className="flex flex-wrap items-center gap-1.5">
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
								className="h-7 px-2.5 text-[11px]"
								onClick={() => setTemplateVariant('11x6')}
							>
								11x6
							</Button>
							<Button
								variant={templateVariant === '13x6' ? 'default' : 'outline'}
								size="sm"
								className="h-7 px-2.5 text-[11px]"
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
						<Input
							type="number"
							min={1}
							placeholder="#"
							value={runIdInput}
							onChange={(e) => setRunIdInput(e.target.value)}
							className="h-7 w-16 text-xs"
						/>
					)}
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
							<Badge variant="destructive" className="text-[11px]">
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
					disabled={!selectedEntityId || state.status === 'loading' || !isRunIdValid}
					className="h-8 ml-auto shrink-0 shadow-sm"
				>
					<RefreshCw className={`mr-1 size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			</div>

			{/* ── Main content ── */}
			<div className="flex-1 min-h-0 overflow-auto px-6 pb-4">
				{state.status === 'idle' && (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
						<DoorOpen className="mb-3 size-10 opacity-40" />
						<p className="text-sm">
							{viewMode === 'rooms' && 'Select a room to view its schedule'}
							{viewMode === 'teachers' && 'Select a teacher to view their schedule'}
							{viewMode === 'sections' && 'Select a section to view its schedule'}
						</p>
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
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
						<CalendarX className="mb-3 size-10 opacity-40" />
						<p className="text-sm font-medium mb-1">No Generation Runs</p>
						<p className="text-xs text-center max-w-sm">{state.message}</p>
						<p className="text-xs mt-3 opacity-70">Run a schedule generation first, then return here to view room timetables.</p>
					</div>
				)}

				{state.status === 'error' && (
					<div className="flex flex-col items-center justify-center h-full text-destructive">
						<ServerOff className="mb-3 size-10 opacity-60" />
						<p className="text-sm font-medium">{state.message}</p>
						<Button variant="outline" size="sm" className="mt-4" onClick={fetchSchedule}>
							<RefreshCw className="mr-1.5 size-3.5" /> Retry
						</Button>
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
												className="mt-0.5 text-[9px] px-1 py-0 cursor-pointer hover:bg-red-700 transition-colors"
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
	const sectionLabel = sectionInfo?.name ?? `Unknown Section (#${entry.sectionId})`;
	const facultyLabel = entry.facultyId != null
		? (facultyMap.get(entry.facultyId) ?? `Unknown Faculty (#${entry.facultyId})`)
		: 'Unassigned Faculty';
	const roomLabel = entry.roomId != null
		? (roomMap.get(entry.roomId) ?? `Room #${entry.roomId}`)
		: '—';

	return (
		<div className="px-1.5 py-1 text-[11px] leading-snug">
			<div className="font-semibold text-foreground truncate">
				{entry.subjectDisplayLabel ?? subjectMap.get(entry.subjectId) ?? `Unknown Subject (#${entry.subjectId})`}
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
