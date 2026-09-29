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
import { PageHeader } from '@/components/app-shell/PageHeader';
import atlasApi from '@/lib/api';
import { getPreferredAccessToken } from '@/lib/auth';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { isVerifiedOrderedActiveTerm } from '@/lib/academic-term';
import { UNVERIFIED_TERM_BODY, UNVERIFIED_TERM_TITLE } from '@/lib/room-schedule-term-copy';
import {
	ROOM_UTILIZATION_UNKNOWN_LABEL,
	buildingScheduleState,
	isRoomUtilizationKnown,
	roomUtilizationBarPercent,
	roomUtilizationColor,
	roomUtilizationLabel,
} from '@/lib/room-utilization-display';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { pivotDraftToView } from '@/lib/schedule-pivot';
import { parseGradeFromSectionName } from '@/components/GradeLevelBadge';
import { cn } from '@/lib/utils';
import type { Building, DraftReport, GenerationRun, Room, RoomScheduleView, SectionSummaryResponse, Subject } from '@/types';
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
	/** A9 m1 — the stored background placement, or null for a school that never
	 *  chose one. 
ull renders the same 'fit whole image, locked' default the
	 *  editor starts from, so no viewer needs a special case. */
	campusMapPlacement?: unknown;
};

type SectionScheduleInfo = {
	name: string;
	gradeLevel: number | null;
	programCode?: string | null;
};

type LatestRunMetadataResponse = {
	run: Pick<GenerationRun, 'id' | 'status' | 'schoolYearId'> | null;
};

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

/** A3: the body moved verbatim to `@/lib/room-utilization-display`, which now
 *  owns it for all three duplicated map components. Thresholds, interpolation
 *  and signature unchanged. */
const getUtilizationColor = roomUtilizationColor;

export function CampusMapOverview({ buildings, campusImageUrl, campusMapPlacement }: CampusMapOverviewProps) {
	const [activeView, setActiveView] = useState<'map' | 'building'>('map');
	// A3 c11 fix 37 — `showExplorer` is GONE. The operator's request is "Remove
	// the `[Open map]` / `[Hide map]` button … Remove the collapsible state logic
	// that hides or toggles the campus map", and the live audit recorded the
	// consequence: "the interactive map (`Campus Explorer`) is currently hidden
	// behind an `[Open map]` button, pushing the primary visual layout below a
	// large list of rooms."
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [focusedRoomId, setFocusedRoomId] = useState<number | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
	
	const [roomSearch, setRoomSearch] = useState('');
	const [roomTypeFilter, setRoomTypeFilter] = useState('all');

	const [scheduleLoading, setScheduleLoading] = useState(true);
	const [scheduleReport, setScheduleReport] = useState<DraftReport | null>(null);
// ROOM-SCHEDULES-TERM-C01 — the ONE verified term every figure below is scoped
// to. Null means "not proven", which renders no figure rather than a merged one.
const [verifiedTermIndex, setVerifiedTermIndex] = useState<number | null>(null);
	const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<string | null>(null);
	const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, string>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, SectionScheduleInfo>>(new Map());

	const teachingBuildings = buildings.filter((building) => building.isTeachingBuilding !== false);
	const teachingRooms = buildings.reduce((acc, building) => acc + teachingRoomCount(building), 0);
	/**
	 * A9 C3: the numerator of the inline banner, and the definition is the one stated at the
	 * banner itself — a room the page can prove can hold a class. It is deliberately NOT
	 * `buildingStatus(building) === 'ready'` (the removed "N ready" badge), which called a
	 * building ready for holding ONE teaching room out of twenty; a building that cannot seat
	 * a class is not ready, and the banner must not inherit that weaker claim.
	 *
	 * `type !== 'OTHER'` is the same persisted room-type signal
	 * `home-room-auto-assign.service.ts` filters on (`type: 'CLASSROOM'`), so a room the
	 * banner calls ready is a room the home-room step can actually assign.
	 */
	const readyTeachingRooms = buildings.reduce(
		(acc, building) => acc + (building.rooms ?? []).filter((room) => room.isTeachingSpace && room.capacity && room.capacity > 0 && room.type !== 'OTHER').length,
		0,
	);
	const attentionCount = buildings.filter((building) => buildingStatus(building) === 'attention').length;
	
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

	const { actorSchoolId } = useActorSchoolScope();

	useEffect(() => {
		if (actorSchoolId == null) {
			setScheduleLoading(false);
			return;
		}
		const scopedSchoolId = actorSchoolId;
		let cancelled = false;
		setScheduleLoading(true);

		(async () => {
			const context = await resolveActiveSchoolYearContext({ schoolId: scopedSchoolId, allowStaleOnError: true, preferCache: true, backgroundRefresh: true , verifyUpstream: true });
			const activeSchoolYearId = context.activeSchoolYearId;
			if (!cancelled) setActiveSchoolYearLabel(context.activeSchoolYearLabel ?? null);

			// ROOM-SCHEDULES-TERM-C01 — capture the term authority already being
			// fetched here and discarded. The map's per-room utilisation and its
			// selected-room grid are single-term measurements; summed across three
			// terms a utilisation figure describes no term, and a merged grid
			// invents room conflicts. Unverified means NO figure.
			const activeTerm = context.activeTerm ?? null;
			if (!cancelled) setVerifiedTermIndex(isVerifiedOrderedActiveTerm(activeTerm) ? activeTerm?.termIndex ?? null : null);
			if (!isVerifiedOrderedActiveTerm(activeTerm)) {
				if (!cancelled) { setScheduleReport(null); setScheduleLoading(false); }
				return;
			}

			if (!activeSchoolYearId) {
				if (!cancelled) setScheduleLoading(false);
				return;
			}

			const reportRequest = async (): Promise<{ data: DraftReport | null }> => {
				const latestRunRes = await withFallback<LatestRunMetadataResponse>(
					() => atlasApi.get<LatestRunMetadataResponse>(`/generation/${scopedSchoolId}/${activeSchoolYearId}/runs/latest`),
					{ run: null },
					3000,
				);

				if (!latestRunRes.data.run) {
					return { data: null };
				}

				return withFallback(
					() => atlasApi.get<DraftReport>(`/generation/${scopedSchoolId}/${activeSchoolYearId}/runs/latest/timetable`),
					null as DraftReport | null,
					6000,
				);
			};

			const [subjectsRes, facultyRes, sectionsRes, reportRes] = await Promise.all([
				withFallback(() => atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${scopedSchoolId}`), { subjects: [] as Subject[] }),
				withFallback(() => atlasApi.get<{ faculty: Array<{ id: number; firstName: string; lastName: string }> }>(`/faculty?schoolId=${scopedSchoolId}`), { faculty: [] }),
				withFallback(() => fetchVersionedApi<SectionSummaryResponse>(`/sections/summary/${activeSchoolYearId}?schoolId=${scopedSchoolId}`), { sections: [] } as unknown as SectionSummaryResponse),
				reportRequest(),
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
				setActiveSchoolYearLabel(null);
				setScheduleReport(null);
				setScheduleLoading(false);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [actorSchoolId]);

	const roomUtilization = useMemo(() => {
		const utilization = new Map<number, number>();
		if (!scheduleReport || verifiedTermIndex == null) return utilization;

		for (const building of buildings) {
			for (const room of building.rooms ?? []) {
				if (!room.isTeachingSpace) continue;
				const result = pivotDraftToView(
					scheduleReport,
					'rooms',
					room.id,
					{ id: room.id, name: room.name, subtitle: building.name },
					verifiedTermIndex,
					subjectMap,
				);
				// ROOM-SCHEDULES-TERM-C01 — a refusal means the draft has no term
				// identity for this room, so there is no honest single-term
				// percentage. Omit it rather than sum across terms.
				if (!result.ok) continue;
				utilization.set(room.id, Math.min(100, result.view.summary.utilizationPercent));
			}
		}

		return utilization;
	}, [buildings, scheduleReport, subjectMap, verifiedTermIndex]);

	// A3: the pre-fix test here defaulted every absent reading to zero and asked
	// whether it was above zero, which folded "no measurement exists" into "no
	// timetable" — so an unresolved term or a missing report, the exact state the
	// memo returns an empty map for, announced "No <year> timetable yet".
	// Tri-state now: only a measured zero may claim the empty state.
	const selectedScheduleState = buildingScheduleState(
		roomUtilization,
		(selectedBuilding?.rooms ?? []).map((room) => room.id),
	);
	const scheduleEmptyLabel = activeSchoolYearLabel
		? `No ${activeSchoolYearLabel} timetable yet`
		: 'No current-year timetable yet';
	const scheduleUnknownLabel = ROOM_UTILIZATION_UNKNOWN_LABEL;

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
		if (!scheduleReport || !selectedRoom || verifiedTermIndex == null) return null;
		const parentBuilding = buildings.find((building) => (building.rooms ?? []).some((room) => room.id === selectedRoom.id));
		const result = pivotDraftToView(
			scheduleReport,
			'rooms',
			selectedRoom.id,
			{ id: selectedRoom.id, name: selectedRoom.name, subtitle: parentBuilding?.name },
			verifiedTermIndex,
			subjectMap,
			sectionLabelMap,
			facultyMap,
		);
		return result.ok ? result.view : null;
	}, [buildings, facultyMap, scheduleReport, sectionLabelMap, selectedRoom, subjectMap, verifiedTermIndex]);

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
				<PageHeader
					title='Campus & Rooms'
					// A9 c4, fix 37 — the subtitle is REMOVED, not reworded and not
					// moved. A3 c11 added this sentence because fix-2.docx item 3
					// asked for it; the operator has since asked for it gone, and
					// AGENTS.md §8's header budget and the subtract-first rule decide
					// the same thing: the page direction is already visible from the
					// map above the readiness card, and a sentence that only narrates
					// the layout is the first thing to go, not the last.
					source={(
						<>
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
						</>
					)}
					// A3 c11 fix 37 — ONE action in the header, and it is the editor.
					// The operator: "The top-right header action row should cleanly
					// contain only the primary action button: `[Edit maps]`". The
					// `secondaryActions` slot that carried `Open map` is not passed at
					// all, so there is no second control left to render.
					primaryAction={(
						<Button asChild size="sm" className="h-9 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-primary-glow hover:bg-primary/90">
							<Link to="/map?mode=editor">
								<Pencil className="size-4" />
								Edit maps
							</Link>
						</Button>
					)}
					className="shrink-0"
				/>

				{/* A3 c11 fix 37 — MAP FIRST. The explorer section renders
				    unconditionally, directly beneath the page header, exactly where
				    the operator asked for it, and the readiness card moves BELOW it. */}
				<section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.5fr)]">
					{/* Campus Map & Rooms Card */}
					<Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-soft-xl">
						<div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
							<div>
								<h2 className="text-sm font-bold text-foreground">Campus Explorer</h2>
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
							<Suspense fallback={<div className="flex min-h-[520px] items-center justify-center text-sm text-muted-foreground">Loading the campus view…</div>}>
							{activeView === 'map' ? (
								<CampusMapCanvasPreview
									buildings={buildings}
									campusImageUrl={campusImageUrl}
									campusMapPlacement={campusMapPlacement}
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
												className="h-8 gap-1 pl-1 text-muted-foreground hover:text-foreground"
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
								<div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
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
							{/* A9 C3 (2026-09-29): "78/103" WAS NOT A READINESS NUMBER, AND IT WAS
							    A METRIC CARD.

							    The old pair of `SummaryStat` cards rendered
							    `${teachingRooms}/${totalRooms}` under the label "Teaching rooms" — 78
							    teaching rooms out of 103 rooms in the school. It read as "78 of 103
							    rooms are ready", it was two large cards (~90px) for one figure, and
							    their icons carried `animate-pulse`, which on a page that is not
							    loading says "something is happening" forever.

							    `AGENTS.md` §8 requires inline stat banners for key figures, not
							    massive metric Cards, so both cards are gone (with the last use of
							    the local `SummaryStat` component) and the figure is one quiet line.

							    WHICH "READY" IS PRINTED, stated here because it is the whole risk of
							    the sentence: a teaching room (persisted `isTeachingSpace`) that has a
							    seat count and a real room type — i.e. one that CAN hold a class. Both
							    ends of the fraction come from the same room list, per the A3-C4 rule
							    that a fraction across two populations is a fabrication the moment they
							    diverge.

							    The `needs-section` state is deliberately NOT in this figure. It depends
							    on the latest generated draft, so including it would make a header
							    figure swing every time a draft loads or the term authority resolves
							    — and a headline that changes while nobody acted is worse than a
							    narrower true one. Rooms that are fine but not yet in a timetable are
							    reported where that fact lives: the problems region below, under
							    "have no section yet". Nothing is hidden by the omission, and the
							    problems region's own denominators are per-building, so the two never
							    claim to be measuring the same thing. */}
							<p
								className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
								data-testid="campus-teaching-rooms-banner"
							>
								<DoorOpen className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
								{readyTeachingRooms > 0 ? (
									<span>
										<span className="font-bold tabular-nums text-foreground">{readyTeachingRooms} of {teachingRooms} teaching rooms</span>
										{' '}are ready to be used for classes.
									</span>
								) : teachingRooms > 0 ? (
									<span>None of the {teachingRooms} teaching rooms can hold a class yet.</span>
								) : (
									<span>No rooms are marked as teaching classrooms yet.</span>
								)}
							</p>

								<Card className="rounded-2xl border-0 bg-white p-0 shadow-soft-xl flex-1 overflow-auto">
									<CardContent className="p-5">
										<div className="flex items-center justify-between gap-2">
											<p className="text-xs font-semibold uppercase text-muted-foreground">Selected building</p>
											{selectedBuilding ? (
												<Badge variant="outline" className={selectedStatus === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
													{selectedStatus === 'ready' ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
													{selectedStatus === 'ready' ? 'Ready' : 'Needs rooms'}
												</Badge>
											) : null}
										</div>
									<h3 className="mt-2 truncate text-xl font-bold text-foreground">{selectedBuilding?.name ?? 'No building selected'}</h3>
									<p className="mt-2 text-sm text-muted-foreground">
										{selectedBuilding
											? /* A9 C3: this sentence used to read "0 teaching rooms out of 20
											 * total rooms", which states a ratio and no consequence. A
											 * building with no teaching room is DEAD — no section can be
											 * placed there and the scheduler has to know that before she
											 * builds a timetable — so the zero case now says so, and the
											 * non-zero case keeps the count. The fix for it is the one
											 * action already below this card, so no second action was added. */
												selectedTeachingRooms === 0
													? `None of its ${selectedTotalRooms} ${selectedTotalRooms === 1 ? 'room is' : 'rooms are'} marked as a teaching classroom, so no class can be held there.`
													: `${selectedTeachingRooms} of ${selectedTotalRooms} ${selectedTotalRooms === 1 ? 'room is' : 'rooms are'} used for classes.`
											: 'Open editor mode to draw buildings and add rooms.'}
									</p>

									{selectedBuilding ? (
										/* A9 C3: the "Teaching rooms N/M" chip is GONE. It printed the
										 * same figure as the banner two regions above, and §8 forbids two
										 * chips saying the same thing — worse here, because one of them
										 * was a fraction of a DIFFERENT population (this building's rooms,
										 * not the school's), so the two numbers could disagree with no
										 * visible reason. The floors and schedule chips are the two facts this
										 * card is uniquely about, and the grid is two wide because of it. */
										<div className="mt-3 grid grid-cols-2 gap-2 text-center">
											<ReadinessChip label="Floors" value={selectedFloors.toString()} />
											<ReadinessChip label="Schedules" value={verifiedTermIndex == null
												? UNVERIFIED_TERM_TITLE
												: selectedScheduleState === 'scheduled' ? 'Available' : scheduleLoading ? 'Checking' : selectedScheduleState === 'empty' ? scheduleEmptyLabel : scheduleUnknownLabel} />
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
							{/* A9 C3: the "N ready" / "N need attention" badge pair is GONE from
							    here. It counted BUILDINGS using the page's own `buildingStatus`
							    (a building is "ready" if it has any teaching room at all), which is
							    a weaker claim than the banner's and than the problems region's —
							    so the same screen carried three different readiness opinions, two
							    of them as bare numbers with no consequence and no action. The
							    problems region below now states the fact per building, with the
							    consequence and the one fix, and a building with nothing wrong is
							    not listed at all. The `attentionCount` this row consumed still
							    drives the header's single "Fix rooms first" chip above. */}
						</div>
					) : selectedBuilding ? (
							<Card className="rounded-2xl border-0 bg-white p-0 shadow-soft-xl flex-1 flex flex-col min-h-0">
								<CardContent className="p-5 flex flex-col h-full min-h-0">
									<div className="mb-3 shrink-0">
										<h3 className="text-sm font-bold text-foreground">Room Directory</h3>
										<p className="text-xs text-muted-foreground truncate mt-0.5">{selectedBuilding.name} · {selectedTeachingRooms} Teaching Rooms</p>
									</div>

									{/* Search & Filters */}
									<div className="flex flex-col gap-2 mb-3 shrink-0">
										<div className="relative">
											<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
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
												<div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-xl">
													No rooms match filters.
												</div>
											) : (
											filteredRooms.map((room) => {
												// A3: the unknown case keeps its own readout instead of
												// being drawn as a measured 0%. `utilization` is bar
												// geometry only; the label is what the user reads.
												const utilizationKnown = isRoomUtilizationKnown(roomUtilization, room.id);
												const utilization = roomUtilizationBarPercent(roomUtilization, room.id);
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
																	{/* A9 C6, fix 1.2 item 10.2: the room NAME WRAPS instead of
																	    truncating. `min-w-0` above is what lets this shrink as a flex
																	    child, and the row is `h-auto`, so a second line grows the card
																	    rather than clipping it. The `Cap:` badge stays `shrink-0` so the
																	    number is never the thing that disappears. */}
																	<span className="block break-words font-bold text-xs text-slate-800">{room.name}</span>
																	<span className="text-xs text-muted-foreground">{ROOM_TYPE_LABELS[room.type] ?? room.type}</span>
																</div>
														<Badge variant="secondary" className="h-5 shrink-0 px-1.5 py-0 text-xs">
																	Cap: {room.capacity ?? '—'}
																</Badge>
															</div>

											{room.isTeachingSpace && (
												<div className="w-full space-y-0.5" data-utilization={utilizationKnown ? 'measured' : 'unknown'}>
													<div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
														<span className="flex items-center gap-0.5">
															<TrendingUp className="size-2.5" />
															Utilization
														</span>
														<span
															className={cn('tabular-nums', !utilizationKnown && 'italic text-muted-foreground')}
															aria-label={utilizationKnown ? undefined : 'Weekly utilization not available'}
														>
															{roomUtilizationLabel(roomUtilization, room.id)}
														</span>
													</div>
													{/* A3: an unknown track is striped, so an empty bar is never
													 * read as a measured zero. The geometry is unchanged. */}
													<div
														className={cn(
															'h-1 w-full rounded-full overflow-hidden',
															utilizationKnown ? 'bg-slate-100' : 'bg-[repeating-linear-gradient(45deg,#e2e8f0_0_3px,#f8fafc_3px_6px)]',
														)}
														aria-hidden="true"
													>
														{utilizationKnown && (
															<div
																className="h-full transition-all duration-300"
																style={{
																	width: `${utilization}%`,
																	backgroundColor: getUtilizationColor(utilization)
																}}
															/>
														)}
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
														<p data-utilization={isRoomUtilizationKnown(roomUtilization, focusedRoom.id) ? 'measured' : 'unknown'}>
															Weekly Utilization: <strong className="text-slate-800">{roomUtilizationLabel(roomUtilization, focusedRoom.id)}</strong>
														</p>
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
										<p className="py-1.5 text-center text-xs text-muted-foreground">
												Select a room to view weekly schedule.
											</p>
										)}
									</div>
								</CardContent>
							</Card>
						) : null}
					</div>
				</section>

				{/* A3 c11 fix 37 — READINESS BELOW. The operator inverted the page:
				    "Bottom Section: Render the `Room readiness` card container
				    directly underneath the `Campus Explorer` section." */}
				<RoomReadinessList
					buildings={buildings}
					roomOccupancy={scheduleReport ? roomScheduleIndicators.occupancy : undefined}
				/>
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
				emptyTitle={verifiedTermIndex == null ? UNVERIFIED_TERM_TITLE : scheduleEmptyLabel}
				emptyDescription={verifiedTermIndex == null
					? UNVERIFIED_TERM_BODY
					: 'Build Teaching Load before creating the first timetable.'}
			/>
		</div>
	);
}

function ReadinessChip({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2">
			<p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
			<p className="mt-1 truncate text-xs font-bold text-foreground">{value}</p>
		</div>
	);
}
