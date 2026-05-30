import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, DoorOpen, MapPinned, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { BuildingView, type RoomSectionMetadata } from '@/components/BuildingView';
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

export function CampusReadinessCard({
	loading,
	buildings,
	campusImageUrl,
	teachingRoomCount: totalTeachingRooms,
	totalRoomCount,
	setupStatus,
}: CampusReadinessCardProps) {
	const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
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
		setSelectedRoom(null);
	};

	return (
		<Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
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
						<div className="bg-stone-50 p-4 lg:p-5">
							<CampusMapCanvasPreview
								buildings={buildings}
								campusImageUrl={campusImageUrl}
								selectedBuildingId={selectedBuilding?.id ?? null}
								onSelectBuilding={handleSelectBuilding}
								height={520}
								interactive
								showToolbar
							/>
						</div>

						<div className="flex flex-col gap-5 p-6">
							<div>
								<div className="flex items-center gap-2">
									<div className="rounded-xl bg-primary/10 p-2.5 text-primary">
										<MapPinned className="size-5" />
									</div>
									<div>
										<p className="text-[0.7rem] font-bold uppercase text-primary">Campus readiness</p>
										<h3 className="text-lg font-bold text-slate-900">Buildings and rooms</h3>
									</div>
								</div>
								<p className="mt-3 text-sm leading-relaxed text-slate-500">
									Select a building, inspect rooms, and open the latest room schedule without leaving the dashboard.
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
									<Badge variant="outline" className={attentionBuildings.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}>
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
							</div>

							{selectedBuilding ? (
								<div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
									<BuildingView
										building={selectedBuilding}
										height={340}
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
								<div className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2">
									<p className="truncate text-sm font-semibold text-slate-900">{selectedRoom.name}</p>
									<p className="text-xs text-slate-500">
										{selectedRoomSchedule ? `${selectedRoomSchedule.summary.entryCount} classes scheduled` : scheduleLoading ? 'Loading latest room schedule...' : 'Latest room schedule unavailable'}
									</p>
								</div>
							) : null}

							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
								<Button asChild className="h-11 justify-between rounded-xl bg-primary font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90">
									<Link to="/map">
										Review campus map
										<ArrowRight className="size-4" />
									</Link>
								</Button>
								<Button asChild variant="outline" className="h-11 justify-between rounded-xl">
									<Link to="/map?mode=editor">
										Edit rooms
										<Pencil className="size-4" />
									</Link>
								</Button>
							</div>
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
			<Icon className="size-4 text-primary" />
			<p className="mt-2 text-[0.68rem] font-semibold uppercase text-slate-500">{label}</p>
			<p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
		</div>
	);
}
