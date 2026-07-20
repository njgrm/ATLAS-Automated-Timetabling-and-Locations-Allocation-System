import { useEffect, useMemo, useState } from 'react';
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

import { BuildingView, type RoomSectionMetadata } from '@/components/BuildingView';
import { ROOM_TYPE_LABELS } from '@/components/BuildingView';
import { RoomScheduleOverlay } from '@/components/RoomScheduleOverlay';
import { CampusMapCanvasPreview } from '@/components/campus-map/CampusMapCanvasPreview';
import type { BuildingSetupStatus } from '@/hooks/useDashboardData';
import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { pivotDraftToView } from '@/lib/schedule-pivot';
import { parseGradeFromSectionName } from '@/components/GradeLevelBadge';
import type { Building, DraftReport, Room, RoomScheduleView, SectionSummaryResponse, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

export type CampusReadinessCardProps = {
	loading: boolean;
	buildings: Building[];
	campusImageUrl?: string | null;
	teachingRoomCount: number;
	totalRoomCount: number;
	setupStatus: BuildingSetupStatus;
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

export function CampusReadinessCard({
	loading,
	buildings,
	campusImageUrl,
	teachingRoomCount: totalTeachingRooms,
	totalRoomCount,
	setupStatus,
}: CampusReadinessCardProps) {
	const [activeView, setActiveView] = useState<'map' | 'building'>('map');
	const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
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
	const attentionBuildings = teachingBuildings.filter((building) => teachingRoomCount(building) === 0);
	
	const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId)
		?? attentionBuildings[0]
		?? teachingBuildings[0]
		?? buildings[0]
		?? null;

	const selectedTeachingRooms = selectedBuilding ? teachingRoomCount(selectedBuilding) : 0;
	const readyCount = teachingBuildings.length - attentionBuildings.length;
	
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
			const sectionName = section?.name ?? entry.cohortName ?? `Section #${entry.sectionId}`;
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

	const handleSelectBuilding = (buildingId: number) => {
		setSelectedBuildingId(buildingId);
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

	return (
		<Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
			{/* Unified Toolbar Header */}
			<div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 bg-slate-50/50 shrink-0">
				<div className="flex items-center gap-1.5">
					<Building2 className="size-4 text-primary animate-pulse" />
					<span className="text-sm font-bold text-slate-800">Campus Map & Rooms</span>
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

			<CardContent className="p-0">
				{loading ? (
					<div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
						<Skeleton className="h-128 rounded-2xl" />
						<div className="space-y-3">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-72" />
							<Skeleton className="h-80 rounded-2xl" />
							<Skeleton className="h-9 w-44" />
						</div>
					</div>
				) : (
					<div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.55fr)]">
						{/* Left main view area */}
						<div className="bg-stone-50 p-4 lg:p-5 flex flex-col justify-center min-h-[520px]">
							{activeView === 'map' ? (
								<CampusMapCanvasPreview
									buildings={buildings}
									campusImageUrl={campusImageUrl}
									selectedBuildingId={selectedBuilding?.id ?? null}
									onSelectBuilding={(buildingId) => {
										handleSelectBuilding(buildingId);
										setActiveView('building');
									}}
									height={520}
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
									<div className="overflow-hidden rounded-xl border border-slate-200 bg-background flex-1 min-h-[480px]">
										<BuildingView
											building={selectedBuilding}
											height={480}
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
						</div>

						{/* Right sidebar area */}
						<div className="flex flex-col border-l border-slate-100 bg-white p-6 max-h-[580px]">
							{activeView === 'map' ? (
								<div className="flex flex-col gap-5 h-full justify-between">
									<div className="space-y-5">
										<div>
											<div className="flex items-center gap-2">
												<div className="rounded-xl bg-primary/10 p-2.5 text-primary">
													<MapPinned className="size-5" />
												</div>
												<div>
											<p className="text-xs font-bold uppercase text-primary">Campus readiness</p>
													<h3 className="text-lg font-bold text-slate-900">Buildings and rooms</h3>
												</div>
											</div>
											<p className="mt-3 text-sm leading-relaxed text-slate-500">
												Select a building, inspect rooms, and view the latest room schedules without leaving the dashboard.
											</p>
											<div className="mt-4 grid grid-cols-2 gap-3">
												<MiniStat icon={Building2} label="Buildings" value={teachingBuildings.length.toString()} />
												<MiniStat icon={DoorOpen} label="Teaching rooms" value={`${totalTeachingRooms}/${totalRoomCount}`} />
											</div>
											<div className="mt-4 flex flex-wrap gap-1.5">
												<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
													<CheckCircle2 className="size-3" />
													{readyCount} ready
												</Badge>
												<Badge variant="outline" className={attentionBuildings.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
													<AlertTriangle className="size-3" />
													{setupStatus.done ? 'No room blockers' : setupStatus.subMessage ?? 'Needs review'}
												</Badge>
											</div>
										</div>

										<div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
											<p className="text-xs font-semibold text-slate-500">Selected building</p>
											<p className="mt-1 truncate text-base font-bold text-slate-900">{selectedBuilding?.name ?? 'No building selected'}</p>
											<p className="mt-1 text-xs text-slate-500">
												{selectedBuilding ? `${selectedTeachingRooms} teaching room${selectedTeachingRooms === 1 ? '' : 's'} ready` : 'Open the map editor to draw buildings.'}
											</p>
											{selectedBuilding && (
												<Button
													size="sm"
													className="mt-3 h-8 w-full gap-1.5 font-semibold"
													onClick={() => setActiveView('building')}
												>
													Inspect Rooms
													<ArrowRight className="size-3.5" />
												</Button>
											)}
										</div>
									</div>

									<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 pt-4 border-t">
										<Button asChild className="h-10 justify-between rounded-xl bg-primary font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90">
											<Link to="/map">
												Review campus map
												<ArrowRight className="size-4" />
											</Link>
										</Button>
										<Button asChild variant="outline" className="h-10 justify-between rounded-xl">
											<Link to="/map?mode=editor">
												Edit rooms
												<Pencil className="size-4" />
											</Link>
										</Button>
									</div>
								</div>
							) : selectedBuilding ? (
								<div className="flex flex-col h-full min-h-0">
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
								</div>
							) : null}
						</div>
					</div>
				)}
			</CardContent>
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
		</Card>
	);
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
	return (
		<div className="rounded-xl border border-slate-100 bg-white p-3">
			<Icon className="size-4 text-primary animate-pulse" />
			<p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
			<p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
		</div>
	);
}
