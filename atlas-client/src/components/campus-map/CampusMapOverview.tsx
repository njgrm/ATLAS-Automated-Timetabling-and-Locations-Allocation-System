import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, DoorOpen, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { BuildingView, type RoomSectionMetadata } from '@/components/BuildingView';
import { GradeLevelBadge, parseGradeFromSectionName } from '@/components/GradeLevelBadge';
import { RoomScheduleOverlay } from '@/components/RoomScheduleOverlay';
import { CampusMapCanvasPreview } from '@/components/campus-map/CampusMapCanvasPreview';
import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { pivotDraftToView } from '@/lib/schedule-pivot';
import type { Building, DraftReport, Room, RoomScheduleView, SectionSummaryResponse, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';

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
		let timer: ReturnType<typeof window.setTimeout> | null = null;
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

export function CampusMapOverview({ buildings, campusImageUrl }: CampusMapOverviewProps) {
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
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

	const selectBuilding = (buildingId: number) => {
		setSelectedId(buildingId);
		setSelectedRoom(null);
	};

	return (
		<div className="h-[calc(100svh-3.5rem)] overflow-auto bg-primary/5 scrollbar-thin">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-7 lg:px-8">
				<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-[0.72rem] font-bold uppercase text-primary">Scheduling Portal</p>
						<h1 className="mt-1 text-3xl font-bold text-slate-900">Campus and rooms</h1>
						<p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
							Review buildings, teaching rooms, and room readiness before generation.
						</p>
					</div>
					<Button asChild className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90">
						<Link to="/map?mode=editor">
							<Pencil className="size-4" />
							Edit campus map
						</Link>
					</Button>
				</header>

				<section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.5fr)]">
					<Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
						<CardContent className="p-0">
							<div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
								<div>
									<h2 className="text-lg font-bold text-slate-900">Campus map</h2>
									<p className="text-xs text-slate-500">Select a building to review its rooms.</p>
								</div>
								<Badge className="border-0 bg-primary/10 text-primary hover:bg-primary/10">Overview</Badge>
							</div>
							<div className="bg-stone-50 p-4">
								<CampusMapCanvasPreview
									buildings={buildings}
									campusImageUrl={campusImageUrl}
									selectedBuildingId={selectedBuilding?.id ?? null}
									onSelectBuilding={selectBuilding}
									height={560}
									interactive
									showToolbar
								/>
							</div>
						</CardContent>
					</Card>

					<div className="flex min-h-0 flex-col gap-4">
						<div className="grid grid-cols-2 gap-3">
							<SummaryStat label="Buildings" value={buildings.length.toString()} icon={Building2} />
							<SummaryStat label="Teaching rooms" value={`${teachingRooms}/${totalRooms}`} icon={DoorOpen} />
						</div>

						<Card className="rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
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
										? `${selectedTeachingRooms} teaching room${selectedTeachingRooms === 1 ? '' : 's'} out of ${selectedBuilding.rooms?.length ?? 0} total rooms.`
										: 'Open editor mode to draw buildings and add rooms.'}
								</p>

								{selectedBuilding ? (
									<div className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
										<BuildingView
											building={selectedBuilding}
											height={360}
											showToolbar
											selectedRoomId={selectedRoom?.id ?? null}
											onRoomSelect={setSelectedRoom}
											roomUtilization={roomUtilization}
											roomOccupancy={roomScheduleIndicators.occupancy}
											roomSectionData={roomScheduleIndicators.sectionData}
										/>
									</div>
								) : null}

								{selectedRoom ? (
									<div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900">{selectedRoom.name}</p>
											<p className="text-xs text-slate-500">
												{selectedRoomSchedule ? `${selectedRoomSchedule.summary.entryCount} classes scheduled` : scheduleLoading ? 'Loading latest room schedule...' : 'Latest room schedule unavailable'}
											</p>
										</div>
										<GradeLevelBadge grade={roomScheduleIndicators.sectionData.get(selectedRoom.id)?.gradeKey ? Number(roomScheduleIndicators.sectionData.get(selectedRoom.id)?.gradeKey) : null} size="xs" />
									</div>
								) : null}

								{selectedBuilding ? (
									<Button asChild variant="outline" className="mt-4 h-10 w-full justify-between rounded-xl">
										<Link to={`/map?mode=editor&buildingId=${selectedBuilding.id}`}>
											Review rooms
											<ArrowRight className="size-4" />
										</Link>
									</Button>
								) : null}
							</CardContent>
						</Card>

						<div className="flex flex-wrap gap-1.5">
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
				</section>

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
		</div>
	);
}

function SummaryStat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
	return (
		<div className="rounded-2xl bg-white p-4 shadow-soft">
			<Icon className="size-4 text-primary" />
			<p className="mt-2 text-[0.68rem] font-semibold uppercase text-slate-500">{label}</p>
			<p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
		</div>
	);
}
