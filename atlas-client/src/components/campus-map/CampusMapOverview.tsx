import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Building2,
	CheckCircle2,
	DoorOpen,
	MapPinned,
	Pencil,
	Search,
	TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { type RoomSectionMetadata } from '@/components/BuildingView';
import { ROOM_TYPE_LABELS } from '@/lib/room-type-labels';
import { RoomScheduleOverlay } from '@/components/RoomScheduleOverlay';
import { RoomReadinessList } from '@/components/campus-map/RoomReadinessList';
import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { pivotDraftToView } from '@/lib/schedule-pivot';
import { parseGradeFromSectionName } from '@/components/GradeLevelBadge';
import type { Building, DraftReport, Room, RoomScheduleView, SectionSummaryResponse, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

const CampusMapCanvasPreview = lazy(() => import('@/components/campus-map/CampusMapCanvasPreview').then((module) => ({ default: module.CampusMapCanvasPreview })));
const BuildingView = lazy(() => import('@/components/BuildingView').then((module) => ({ default: module.BuildingView })));

export type CampusMapOverviewProps = {
	buildings: Building[];
	campusImageUrl: string | null;
};

type SectionScheduleInfo = {
	name: string;
	gradeLevel: number | null;
	programCode?: string | null;
};

const DEFAULT_SCHOOL_ID = 1;
const DAY_RANK: Record<string, number> = {
	MONDAY: 1,
	TUESDAY: 2,
	WEDNESDAY: 3,
	THURSDAY: 4,
	FRIDAY: 5,
};

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function withFallback<T>(request: () => Promise<{ data: T }>, fallback: T, timeoutMs = 4000): Promise<{ data: T }> {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		let timer: number | null = null;
		try {
			const timeout = new Promise<never>((_, reject) => {
				timer = window.setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
			});
			const result = await Promise.race([request(), timeout]);
			if (timer) window.clearTimeout(timer);
			return result;
		} catch {
			if (timer) window.clearTimeout(timer);
			if (attempt === 0) await wait(250);
		}
	}

	return { data: fallback };
}

async function fetchVersionedApi<T>(path: string): Promise<{ data: T }> {
	const token = getPreferredAccessToken();
	const response = await fetch(`/api/v1${path}`, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	});
	if (!response.ok) throw new Error(`Request failed: ${response.status}`);
	return { data: await response.json() as T };
}

function teachingRoomCount(building: Building): number {
	return (building.rooms ?? []).filter((room) => room.isTeachingSpace).length;
}

function buildingStatus(building: Building): 'ready' | 'attention' {
	return teachingRoomCount(building) > 0 ? 'ready' : 'attention';
}

function getUtilizationColor(pct: number): string {
	const clamped = Math.max(0, Math.min(100, pct));
	if (clamped <= 50) {
		const ratio = clamped / 50;
		const r = Math.round(34 + (234 - 34) * ratio);
		const g = Math.round(197 + (179 - 197) * ratio);
		const b = Math.round(94 + (8 - 94) * ratio);
		return `rgb(${r},${g},${b})`;
	} else {
		const ratio = (clamped - 50) / 50;
		const r = Math.round(234 + (220 - 234) * ratio);
		const g = Math.round(179 + (38 - 179) * ratio);
		const b = Math.round(8 + (38 - 8) * ratio);
		return `rgb(${r},${g},${b})`;
	}
}

export function CampusMapOverview({ buildings, campusImageUrl }: CampusMapOverviewProps) {
	const [activeView, setActiveView] = useState<'map' | 'building'>('map');
	const [showExplorer, setShowExplorer] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [focusedRoomId, setFocusedRoomId] = useState<number | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
	
	const [roomSearch, setRoomSearch] = useState('');
	const [roomTypeFilter, setRoomTypeFilter] = useState('all');

	const [scheduleLoading, setScheduleLoading] = useState(true);
	const [scheduleReport, setScheduleReport] = useState<DraftReport | null>(null);
	const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, string>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, SectionScheduleInfo>>(new Map());

	const teachingBuildings = buildings.filter((building) => building.isTeachingBuilding !== false);
	const totalRooms = buildings.reduce((acc, building) => acc + (building.rooms?.length ?? 0), 0);
	const teachingRooms = buildings.reduce((acc, building) => acc + teachingRoomCount(building), 0);
	const readyCount = buildings.filter((building) => buildingStatus(building) === 'ready').length;
	const attentionCount = buildings.length - readyCount;
	
	const selectedBuilding = buildings.find((building) => building.id === selectedId)
		?? teachingBuildings.find((building) => buildingStatus(building) === 'attention')
		?? teachingBuildings[0]
		?? buildings[0]
		?? null;

	const selectedTeachingRooms = selectedBuilding ? teachingRoomCount(selectedBuilding) : 0;
	const selectedTotalRooms = selectedBuilding?.rooms?.length ?? 0;
	const selectedFloors = selectedBuilding?.floorCount ?? 0;
	const selectedStatus = selectedBuilding ? buildingStatus(selectedBuilding) : 'attention';
	
	const sectionLabelMap = useMemo(
		() => new Map([...sectionMap].map(([id, section]) => [id, section.name])),
		[sectionMap],
	);
	
	const overlaySectionMap = useMemo(
		() => new Map([...sectionMap].map(([id, section]) => [id, { name: section.name, gradeLevel: section.gradeLevel }])),
		[sectionMap],
	);

	useEffect(() => {
		let cancelled = false;
		setScheduleLoading(true);

		(async () => {
			const context = await resolveActiveSchoolYearContext({ allowStaleOnError: true, preferCache: true, backgroundRefresh: true });
			const activeSchoolYearId = context.activeSchoolYearId;
			if (!activeSchoolYearId) {
				if (!cancelled) setScheduleLoading(false);
				return;
			}

			const [subjectsRes, facultyRes, sectionsRes, reportRes] = await Promise.all([
				withFallback(() => atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`), { subjects: [] as Subject[] }),
				withFallback(() => atlasApi.get<{ faculty: Array<{ id: number; firstName: string; lastName: string }> }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`), { faculty: [] }),
				withFallback(() => fetchVersionedApi<SectionSummaryResponse>(`/sections/summary/${activeSchoolYearId}?schoolId=${DEFAULT_SCHOOL_ID}`), { sections: [] } as unknown as SectionSummaryResponse),
				withFallback(() => atlasApi.get<DraftReport>(`/generation/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/runs/latest/timetable`), null as DraftReport | null, 6000),
			]);

			if (cancelled) return;

			setSubjectMap(
				new Map(
					(subjectsRes.data.subjects ?? []).map((subject) => [
						subject.id,
						subject.displayCode ?? subject.code ?? subject.name,
					]),
				),
			);
			setFacultyMap(
				new Map(
					(facultyRes.data.faculty ?? []).map((faculty) => [
						faculty.id,
						`${faculty.lastName}, ${faculty.firstName}`,
					]),
				),
			);
			setSectionMap(
				new Map(
					(sectionsRes.data.sections ?? []).map((section) => [
						section.id,
						{
							name: section.name,
							gradeLevel: parseGradeFromSectionName(section.gradeLevelName) ?? parseGradeFromSectionName(section.name),
							programCode: section.programCode,
						},
					]),
				),
			);
			setScheduleReport(reportRes.data);
			setScheduleLoading(false);
		})().catch(() => {
			if (!cancelled) {
				setScheduleReport(null);
				setScheduleLoading(false);
			}
		});

		return () => {
			cancelled = true;
		};
	}, []);

	const roomUtilization = useMemo(() => {
		const utilization = new Map<number, number>();
		if (!scheduleReport) return utilization;

		for (const building of buildings) {
			for (const room of building.rooms ?? []) {
				if (!room.isTeachingSpace) continue;
				const schedule = pivotDraftToView(
					scheduleReport,
					'rooms',
					room.id,
					{ id: room.id, name: room.name, subtitle: building.name },
					subjectMap,
				);
				utilization.set(room.id, Math.min(100, schedule.summary.utilizationPercent));
			}
		}

		return utilization;
	}, [buildings, scheduleReport, subjectMap]);

	const selectedHasSchedule = Boolean(selectedBuilding?.rooms?.some((room) => (roomUtilization.get(room.id) ?? 0) > 0));

	const roomScheduleIndicators = useMemo(() => {
		const occupancy = new Map<number, string>();
		const sectionData = new Map<number, RoomSectionMetadata>();
		if (!scheduleReport) return { occupancy, sectionData };

		const sortedEntries = [...scheduleReport.entries].sort((left, right) => {
			const dayDelta = (DAY_RANK[left.day] ?? 99) - (DAY_RANK[right.day] ?? 99);
			return dayDelta || left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime);
		});

		for (const entry of sortedEntries) {
			if (sectionData.has(entry.roomId)) continue;
			const section = sectionMap.get(entry.sectionId);
			const sectionName = section?.name ?? entry.cohortName ?? 'Assigned section';
			const gradeLevel = section?.gradeLevel ?? parseGradeFromSectionName(sectionName);
			const programCode = entry.programCode ?? section?.programCode ?? undefined;
			occupancy.set(entry.roomId, sectionName);
			sectionData.set(entry.roomId, {
				sectionName,
				gradeKey: gradeLevel ? String(gradeLevel) : '',
				programCode: programCode ?? undefined,
			});
		}

		return { occupancy, sectionData };
	}, [scheduleReport, sectionMap]);

	const selectedRoomSchedule = useMemo<RoomScheduleView | null>(() => {
		if (!scheduleReport || !selectedRoom) return null;
		const parentBuilding = buildings.find((building) => (building.rooms ?? []).some((room) => room.id === selectedRoom.id));
		return pivotDraftToView(
			scheduleReport,
			'rooms',
			selectedRoom.id,
			{ id: selectedRoom.id, name: selectedRoom.name, subtitle: parentBuilding?.name },
			subjectMap,
			sectionLabelMap,
			facultyMap,
		);
	}, [buildings, facultyMap, scheduleReport, sectionLabelMap, selectedRoom, subjectMap]);

	const selectBuilding = (buildingId: number) => {
		setSelectedId(buildingId);
		setFocusedRoomId(null);
	};

	const filteredRooms = useMemo(() => {
		if (!selectedBuilding) return [];
		return (selectedBuilding.rooms ?? []).filter((room) => {
			const matchesSearch = room.name.toLowerCase().includes(roomSearch.toLowerCase());
			const matchesType = roomTypeFilter === 'all' || room.type === roomTypeFilter;
			return matchesSearch && matchesType;
		});
	}, [selectedBuilding, roomSearch, roomTypeFilter]);

	const focusedRoom = useMemo(() => {
		if (focusedRoomId === null || !selectedBuilding) return null;
		return (selectedBuilding.rooms ?? []).find((r) => r.id === focusedRoomId) ?? null;
	}, [focusedRoomId, selectedBuilding]);
	const sourceState = buildings.length > 0 ? 'verified-live' : 'no-saved-data';
	const sourceCopy = buildings.length > 0 ? 'Rooms loaded' : 'No saved room data';
	const nextAction = attentionCount > 0 ? 'Fix rooms first' : 'Open map editor';

	return (
		<div className="h-[calc(100svh-3.5rem)] overflow-auto bg-primary/5 scrollbar-thin">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 lg:px-5">
				<header className="flex shrink-0 flex-col gap-2 rounded-2xl border border-primary/10 bg-white px-3 py-2.5 shadow-soft lg:flex-row lg:items-center lg:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-xl font-bold text-slate-900">Campus and rooms</h1>
							<Badge
								data-source-state={sourceState}
								variant="outline"
								className={buildings.length > 0 ? 'h-7 rounded-full border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700' : 'h-7 rounded-full border-amber-200 bg-amber-50 text-xs font-bold text-amber-700'}
							>
								{sourceCopy}
							</Badge>
							<Badge variant="outline" className={attentionCount > 0 ? 'h-7 rounded-full border-amber-200 bg-amber-50 text-xs font-bold text-amber-700' : 'h-7 rounded-full border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700'}>
								{nextAction}
							</Badge>
						</div>
						<p className="mt-1 truncate text-xs font-medium text-slate-500">
							Check room readiness first. Open the map only when you need room details.
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button type="button" variant="outline" size="sm" className="h-9 gap-2 font-bold" onClick={() => setShowExplorer((value) => !value)}>
							<MapPinned className="size-4" />
							{showExplorer ? 'Hide map' : 'Open map'}
						</Button>
						<Button asChild size="sm" className="h-9 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90">
							<Link to="/map?mode=editor">
								<Pencil className="size-4" />
								Edit rooms
							</Link>
						</Button>
					</div>
				</header>

				<RoomReadinessList buildings={buildings} roomOccupancy={scheduleReport ? roomScheduleIndicators.occupancy : undefined} />

				{!showExplorer ? (
					<Card className="rounded-2xl border-0 bg-white p-0 shadow-soft">
						<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<p className="text-sm font-bold text-slate-900">Map is available when needed</p>
								<p className="mt-1 text-xs leading-relaxed text-slate-500">Most scheduling setup starts with readiness above. Open the map when you need to inspect a building or room.</p>
							</div>
							<Button type="button" variant="outline" className="h-10 shrink-0 gap-2 font-bold" onClick={() => setShowExplorer(true)}>
								<MapPinned className="size-4" />
								Show campus explorer
							</Button>
						</CardContent>
					</Card>
				) : (
				<section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.5fr)]">
					{/* Campus Map & Rooms Card */}
					<Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
						<div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
							<div>
								<h2 className="text-sm font-bold text-slate-900">Campus Explorer</h2>
							</div>
							{selectedBuilding && (
								<div className="flex items-center gap-1 rounded-lg border bg-background p-0.5" role="tablist">
									<Button
										variant={activeView === 'map' ? 'default' : 'ghost'}
										size="sm"
										className="h-7 text-xs gap-1.5"
										onClick={() => setActiveView('map')}
									>
										<MapPinned className="size-3.5" />
										Map View
									</Button>
									<Button
										variant={activeView === 'building' ? 'default' : 'ghost'}
										size="sm"
										className="h-7 text-xs gap-1.5"
										onClick={() => setActiveView('building')}
									>
										<Building2 className="size-3.5" />
										Building Details
									</Button>
								</div>
							)}
						</div>

						<div className="bg-stone-50 p-4 lg:p-5 flex flex-col justify-center min-h-[560px]">
							<Suspense fallback={<div className="flex min-h-[520px] items-center justify-center text-sm text-slate-500">Loading the campus view…</div>}>
							{activeView === 'map' ? (
								<CampusMapCanvasPreview
									buildings={buildings}
									campusImageUrl={campusImageUrl}
									selectedBuildingId={selectedBuilding?.id ?? null}
									onSelectBuilding={(buildingId) => {
										selectBuilding(buildingId);
										setActiveView('building');
									}}
									height={560}
									interactive
									showToolbar
								/>
							) : selectedBuilding ? (
								<div className="space-y-4 flex flex-col h-full min-h-0">
									<div className="flex items-center justify-between shrink-0">
										<div className="flex items-center gap-2">
											<Button
												variant="ghost"
												size="sm"
												className="h-8 gap-1 pl-1 text-slate-500 hover:text-slate-900"
												onClick={() => setActiveView('map')}
											>
												<ArrowLeft className="size-4" />
												Back to Map
											</Button>
											<span className="text-slate-300">|</span>
											<h4 className="text-sm font-bold text-slate-800">{selectedBuilding.name}</h4>
										</div>
										<Badge variant="outline" className="h-5 text-xs text-muted-foreground">
											{selectedTeachingRooms} rooms / {selectedBuilding.floorCount} floors
										</Badge>
									</div>
									<div className="overflow-hidden rounded-xl border border-slate-200 bg-background flex-1 min-h-[500px]">
										<BuildingView
											building={selectedBuilding}
											height={500}
											showToolbar
											selectedRoomId={focusedRoomId}
											onRoomSelect={(room) => setFocusedRoomId(room?.id ?? null)}
											roomUtilization={roomUtilization}
											roomOccupancy={roomScheduleIndicators.occupancy}
											roomSectionData={roomScheduleIndicators.sectionData}
										/>
									</div>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
									<Building2 className="size-12 opacity-35 animate-pulse" />
								<p className="mt-2 text-sm">Select a building on the map to begin.</p>
								</div>
							)}
							</Suspense>
						</div>
					</Card>

					{/* Sidebar Panel */}
					<div className="flex flex-col gap-4 max-h-[640px]">
						{activeView === 'map' ? (
							<div className="flex min-h-0 flex-col gap-4 h-full">
								<div className="grid grid-cols-2 gap-3 shrink-0">
									<SummaryStat label="Buildings" value={buildings.length.toString()} icon={Building2} />
									<SummaryStat label="Teaching rooms" value={`${teachingRooms}/${totalRooms}`} icon={DoorOpen} />
								</div>

								<Card className="rounded-2xl border-0 bg-white p-0 shadow-soft-xl flex-1 overflow-auto">
									<CardContent className="p-5">
										<div className="flex items-center justify-between gap-2">
											<p className="text-xs font-semibold uppercase text-slate-500">Selected building</p>
											{selectedBuilding ? (
												<Badge variant="outline" className={selectedStatus === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
													{selectedStatus === 'ready' ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
													{selectedStatus === 'ready' ? 'Ready' : 'Needs rooms'}
												</Badge>
											) : null}
										</div>
										<h3 className="mt-2 truncate text-xl font-bold text-slate-900">{selectedBuilding?.name ?? 'No building selected'}</h3>
										<p className="mt-2 text-sm text-slate-500">
											{selectedBuilding
												? `${selectedTeachingRooms} teaching room${selectedTeachingRooms === 1 ? '' : 's'} out of ${selectedTotalRooms} total rooms.`
												: 'Open editor mode to draw buildings and add rooms.'}
										</p>

										{selectedBuilding ? (
											<div className="mt-3 grid grid-cols-3 gap-2 text-center">
												<ReadinessChip label="Teaching rooms" value={`${selectedTeachingRooms}/${selectedTotalRooms}`} />
												<ReadinessChip label="Floors" value={selectedFloors.toString()} />
												<ReadinessChip label="Schedules" value={selectedHasSchedule ? 'Available' : scheduleLoading ? 'Checking' : 'No latest run'} />
											</div>
										) : null}

										{selectedBuilding && (
											<Button
												className="mt-4 w-full h-10 gap-1.5 font-semibold"
												onClick={() => setActiveView('building')}
											>
												Inspect Rooms
												<ArrowRight className="size-4" />
											</Button>
										)}

										{selectedBuilding ? (
											<Button asChild variant="outline" className="mt-2 h-10 w-full justify-between rounded-xl">
												<Link to={`/map?mode=editor&buildingId=${selectedBuilding.id}`}>
													Review rooms in editor
													<ArrowRight className="size-4" />
												</Link>
											</Button>
										) : null}
									</CardContent>
								</Card>

								<div className="flex flex-wrap gap-1.5 shrink-0">
									<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
										<CheckCircle2 className="size-3" />
										{readyCount} ready
									</Badge>
									<Badge variant="outline" className={attentionCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
										<AlertTriangle className="size-3" />
										{attentionCount} need attention
									</Badge>
								</div>
							</div>
						) : selectedBuilding ? (
							<Card className="rounded-2xl border-0 bg-white p-0 shadow-soft-xl flex-1 flex flex-col min-h-0">
								<CardContent className="p-5 flex flex-col h-full min-h-0">
									<div className="mb-3 shrink-0">
										<h3 className="text-sm font-bold text-slate-900">Room Directory</h3>
										<p className="text-xs text-slate-500 truncate mt-0.5">{selectedBuilding.name} · {selectedTeachingRooms} Teaching Rooms</p>
									</div>

									{/* Search & Filters */}
									<div className="flex flex-col gap-2 mb-3 shrink-0">
										<div className="relative">
											<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
											<Input
												placeholder="Search rooms..."
												value={roomSearch}
												onChange={(e) => setRoomSearch(e.target.value)}
												className="h-8 pl-8 text-xs"
											/>
										</div>
										<Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue placeholder="Filter by Room Type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All Room Types</SelectItem>
												{Object.entries(ROOM_TYPE_LABELS).map(([type, label]) => (
													<SelectItem key={type} value={type}>{label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* Room List Roster */}
									<ScrollArea className="flex-1 min-h-0 pr-1 -mr-2">
										<div className="space-y-1.5 pb-2">
											{filteredRooms.length === 0 ? (
												<div className="text-center py-8 text-xs text-slate-400 border border-dashed rounded-xl">
													No rooms match filters.
												</div>
											) : (
												filteredRooms.map((room) => {
													const utilization = roomUtilization?.get(room.id) ?? 0;
													const sectionData = roomScheduleIndicators.sectionData.get(room.id);
													const occupancy = sectionData?.sectionName ?? roomScheduleIndicators.occupancy.get(room.id);
													const isFocused = focusedRoomId === room.id;
													
													let gradeClass = '';
													if (sectionData) {
														const g = sectionData.gradeKey;
														if (g === '7') gradeClass = 'bg-green-50 text-green-700 border-green-200';
														else if (g === '8') gradeClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';
														else if (g === '9') gradeClass = 'bg-red-50 text-red-700 border-red-200';
														else if (g === '10') gradeClass = 'bg-blue-50 text-blue-700 border-blue-200';
													}

													return (
												<Button
													key={room.id}
													variant="ghost"
													onClick={() => setFocusedRoomId(isFocused ? null : room.id)}
													className={`h-auto w-full items-stretch justify-start rounded-lg border p-2.5 text-left transition-all flex flex-col gap-1.5 ${
																isFocused 
																	? 'border-primary bg-primary/5 ring-1 ring-primary' 
																	: 'border-slate-100 bg-card hover:bg-slate-50'
															}`}
														>
															<div className="flex items-center justify-between w-full">
																<div className="min-w-0">
																	<span className="font-bold text-xs text-slate-800 truncate block">{room.name}</span>
															<span className="text-xs text-slate-500">{ROOM_TYPE_LABELS[room.type] ?? room.type}</span>
																</div>
														<Badge variant="secondary" className="h-5 shrink-0 px-1.5 py-0 text-xs">
																	Cap: {room.capacity ?? '—'}
																</Badge>
															</div>

															{room.isTeachingSpace && (
																<div className="w-full space-y-0.5">
													<div className="flex items-center justify-between text-xs font-semibold text-slate-500">
																		<span className="flex items-center gap-0.5">
																			<TrendingUp className="size-2.5" />
																			Utilization
																		</span>
																		<span className="tabular-nums">{Math.round(utilization)}%</span>
																	</div>
																	<div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
																		<div 
																			className="h-full transition-all duration-300"
																			style={{ 
																				width: `${utilization}%`, 
																				backgroundColor: getUtilizationColor(utilization) 
																			}} 
																		/>
																	</div>
																</div>
															)}

															{occupancy && (
																<div className="flex flex-wrap gap-1 mt-0.5">
														<span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold border uppercase ${gradeClass || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
																		{occupancy}
																	</span>
																	{sectionData?.programCode && (
															<span className="inline-flex items-center rounded bg-slate-100 px-1 py-0.5 text-xs font-bold text-slate-600">
																			{sectionData.programCode}
																		</span>
																	)}
																</div>
															)}
												</Button>
													);
												})
											)}
										</div>
									</ScrollArea>

									{/* Focused Room detail display */}
									<div className="mt-3 shrink-0 pt-3 border-t border-slate-100">
										{focusedRoom ? (
											<div className="space-y-2">
												<div className="rounded-xl border border-primary/10 bg-primary/5 p-2.5 flex flex-col gap-1">
													<div className="flex items-center justify-between">
														<h5 className="font-bold text-xs text-slate-800">{focusedRoom.name}</h5>
												<Badge className="h-5 bg-primary/20 text-xs text-primary hover:bg-primary/20">{ROOM_TYPE_LABELS[focusedRoom.type]}</Badge>
													</div>
											<div className="space-y-0.5 text-xs text-slate-600">
														<p>Capacity: <strong className="text-slate-800">{focusedRoom.capacity ?? '—'} students</strong></p>
														{focusedRoom.isTeachingSpace ? (
															<p>Weekly Utilization: <strong className="text-slate-800">{Math.round(roomUtilization?.get(focusedRoom.id) ?? 0)}%</strong></p>
														) : (
															<p className="text-amber-600 font-medium">Non-teaching space</p>
														)}
													</div>
												</div>
												<Button
													className="w-full h-8.5 text-xs font-semibold gap-1.5"
													onClick={() => setSelectedRoom(focusedRoom)}
												>
													<DoorOpen className="size-3.5" />
													View Weekly Schedule
												</Button>
											</div>
										) : (
										<p className="py-1.5 text-center text-xs text-slate-500">
												Select a room to view weekly schedule.
											</p>
										)}
									</div>
								</CardContent>
							</Card>
						) : null}
					</div>
				</section>
				)}
			</div>
			
			<RoomScheduleOverlay
				open={selectedRoom !== null}
				onClose={() => setSelectedRoom(null)}
				roomName={selectedRoom?.name ?? 'Room'}
				roomId={selectedRoom?.id ?? 0}
				schedule={selectedRoomSchedule}
				loading={scheduleLoading}
				subjectMap={subjectMap}
				facultyMap={facultyMap}
				sectionMap={overlaySectionMap}
			/>
		</div>
	);
}

function SummaryStat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
	return (
		<div className="rounded-2xl bg-white p-4 shadow-soft">
			<Icon className="size-4 text-primary animate-pulse" />
			<p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
			<p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
		</div>
	);
}

function ReadinessChip({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2">
			<p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
			<p className="mt-1 truncate text-xs font-bold text-slate-900">{value}</p>
		</div>
	);
}
