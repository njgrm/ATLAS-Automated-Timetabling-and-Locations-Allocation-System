import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState, Profiler } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CalendarClock, ChevronLeft, Loader2, Lock, MapPin } from 'lucide-react';
import { onProfilerRender } from './ScheduleReviewWorkspace';

import { ClassProgramMatrixView } from '@/components/timetable/ClassProgramMatrixView';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import { buildUnassignedKey } from '@/lib/timetable-utils';
import { formatTime } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { ResizablePanel } from '@/ui/resizable';
import { ScrollArea } from '@/ui/scroll-area';

import type { CommitResult, ManualEditProposal, RoomType, TeachingLoadRepairChange, TeachingLoadRepairPreviewResult, UnassignedItem, Violation } from '@/types';

const CampusMap = lazy(() => import('@/components/CampusMap').then((module) => ({
	default: module.CampusMap,
})));
const ManualEditPanel = lazy(() => import('@/components/ManualEditPanel'));
const SchedulingPolicyPane = lazy(() => import('@/components/SchedulingPolicyPane'));
const BuildingView = lazy(() => import('@/components/BuildingView').then((module) => ({
	default: module.BuildingView,
})));
const TacticalSandboxDock = lazy(() => import('@/components/timetable/TacticalSandboxDock').then((module) => ({
	default: module.TacticalSandboxDock,
})));

const ROOM_COLORS: Record<RoomType, { bg: string; text: string }> = {
	CLASSROOM: { bg: 'bg-blue-50', text: 'text-blue-700' },
	LABORATORY: { bg: 'bg-violet-50', text: 'text-violet-700' },
	COMPUTER_LAB: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
	TLE_WORKSHOP: { bg: 'bg-orange-50', text: 'text-orange-700' },
	LIBRARY: { bg: 'bg-amber-50', text: 'text-amber-700' },
	GYMNASIUM: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
	FACULTY_ROOM: { bg: 'bg-rose-50', text: 'text-rose-700' },
	OFFICE: { bg: 'bg-gray-50', text: 'text-gray-600' },
	OTHER: { bg: 'bg-slate-50', text: 'text-slate-600' },
};

function AdvancedSurfaceFallback({ label }: { label: string }) {
	return (
		<div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
			<Loader2 className="mr-2 size-4 animate-spin text-primary" />
			{label}
		</div>
	);
}

function projectSandboxEntries(entries: any[], sandboxFacultyByEntryId: Map<string, number>): any[] {
	if (sandboxFacultyByEntryId.size === 0) return entries;
	return entries.map((entry) => {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
		return facultyId == null ? entry : { ...entry, facultyId };
	});
}

function buildSandboxChangedEntryIds(entries: any[], sandboxFacultyByEntryId: Map<string, number>): Set<string> {
	const changedEntryIds = new Set<string>();
	for (const entry of entries) {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
		if (facultyId != null && facultyId !== entry.facultyId) {
			changedEntryIds.add(entry.entryId);
		}
	}
	return changedEntryIds;
}

function buildSandboxTeacherConflictEntryIds(entries: any[], changedEntryIds: Set<string>): Set<string> {
	const conflictEntryIds = new Set<string>();
	const entriesBySlotAndFaculty = new Map<string, any[]>();
	for (const entry of entries) {
		if (entry.facultyId == null) continue;
		const key = `${entry.facultyId}:${entry.day}:${entry.startTime}:${entry.endTime}`;
		const slotEntries = entriesBySlotAndFaculty.get(key) ?? [];
		slotEntries.push(entry);
		entriesBySlotAndFaculty.set(key, slotEntries);
	}
	for (const slotEntries of entriesBySlotAndFaculty.values()) {
		if (slotEntries.length < 2) continue;
		if (!slotEntries.some((entry) => changedEntryIds.has(entry.entryId))) continue;
		for (const entry of slotEntries) conflictEntryIds.add(entry.entryId);
	}
	return conflictEntryIds;
}

type CenterWorkspaceProps = {
	centerView: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building';
	selectedEntry: any;
	selectedUnassigned: UnassignedItem | null;
	setSelectedUnassigned: (value: UnassignedItem | null) => void;
	violationIndex: Map<string, Violation[]>;
	followUps: Set<string>;
	toggleFollowUp: (entryId: string) => Promise<void>;
	exitPolicyView: () => void;
	handleRefresh: () => void;
	defaultSchoolId: number;
	schoolYearId: number | null;
	pendingAction: 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null;
	roomMap: Map<number, any>;
	facultyMap: Map<number, any>;
	subjectMap: Map<number, any>;
	draftEntries: any[];
	previewEdit: (proposal: any) => Promise<any>;
	commitEdit: (proposal: any, allowSoftOverride?: boolean) => Promise<void>;
	previewTeachingLoadRepair: (changes: TeachingLoadRepairChange[], placementProposal?: ManualEditProposal) => Promise<TeachingLoadRepairPreviewResult | null>;
	commitTeachingLoadRepair: (changes: TeachingLoadRepairChange[], allowSoftOverride?: boolean, placementProposal?: ManualEditProposal) => Promise<CommitResult | null>;
	previewLoading: boolean;
	commitLoading: boolean;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	roomLabel: (roomId: number) => string;
	isStaleRoom: (roomId: number) => boolean;
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	preGenOnboarding: boolean;
	setCenterView: (view: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building') => void;
	buildings: any[];
	mapBuildingId: number | null;
	setMapBuildingId: (id: number | null) => void;
	openBuildingWorkspace: (buildingId: number) => Promise<void>;
	selectedMapBuilding: any;
	selectedMapBuildingFloors: number[];
	mapRoomId: number | null;
	openRoomGridWorkspace: (roomId: number) => void;
	presentationMode: 'workflow' | 'matrix';
	draftBoard: any;
	draft: any;
	runs: any[];
	entityFilter: string;
	pivotLabel: (id: number) => string;
	viewMode: 'section' | 'faculty' | 'room';
	setPreGenOnboarding: (value: boolean) => void;
	gridEntries: any[];
	highlightedEntryIds: Set<string>;
	handleEntryClick: (entry: any) => void;
	entryContextLabel: (entry: any) => string;
	formatFacultyInitials: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	kbSelectedSource: any;
	handleKbPlace: (day: string, startTime: string, endTime: string) => Promise<void>;
	getCellConflict: any;
	getLiveCellConflict: any;
	navToFaculty: (id: number) => void;
	navToSection: (id: number) => void;
	navToRoom: (id: number) => void;
	preGenPending: any;
	preGenPreviewLoading: boolean;
	preGenPreviewError: string | null;
	preGenPreview: any;
	commitPreGenPending: () => Promise<void>;
	preGenSaving: boolean;
	setPreGenPending: (value: any) => void;
	setPreGenPreview: (value: any) => void;
	setPreGenPreviewError: (value: string | null) => void;
	setPreGenAllowSoftOverride: (value: boolean) => void;
	dayShort: Record<string, string>;
	tacticalSandboxOpen: boolean;
	setTacticalSandboxOpen: (v: boolean) => void;
};

export const CenterWorkspace = memo(function CenterWorkspace(props: CenterWorkspaceProps) {
	const {
		centerView,
		selectedEntry,
		selectedUnassigned,
		setSelectedUnassigned,
		violationIndex,
		followUps,
		toggleFollowUp,
		exitPolicyView,
		handleRefresh,
		defaultSchoolId,
		schoolYearId,
		pendingAction,
		roomMap,
		facultyMap,
		subjectMap,
		draftEntries,
		previewEdit,
		commitEdit,
		previewTeachingLoadRepair,
		commitTeachingLoadRepair,
		previewLoading,
		commitLoading,
		subjectLabel,
		facultyLabel,
		sectionLabel,
		gradeForSection,
		roomLabel,
		isStaleRoom,
		timeSlots,
		preGenOnboarding,
		setCenterView,
		buildings,
		mapBuildingId,
		setMapBuildingId,
		openBuildingWorkspace,
		selectedMapBuilding,
		selectedMapBuildingFloors,
		mapRoomId,
		openRoomGridWorkspace,
		presentationMode,
		draftBoard,
		draft,
		runs,
		entityFilter,
		pivotLabel,
		viewMode,
		setPreGenOnboarding,
		gridEntries,
		highlightedEntryIds,
		handleEntryClick,
		entryContextLabel,
		formatFacultyInitials,
		roomLabelShort,
		kbSelectedSource,
		handleKbPlace,
		getCellConflict,
		getLiveCellConflict,
		navToFaculty,
		navToSection,
		navToRoom,
		preGenPending,
		preGenPreviewLoading,
		preGenPreviewError,
		preGenPreview,
		commitPreGenPending,
		preGenSaving,
		setPreGenPending,
		setPreGenPreview,
		setPreGenPreviewError,
		setPreGenAllowSoftOverride,
		dayShort,
		tacticalSandboxOpen,
		setTacticalSandboxOpen,
	} = props;

	const [sandboxFacultyByEntryId, setSandboxFacultyByEntryId] = useState<Map<string, number>>(new Map());
	const [autoOpenedSandboxEntryId, setAutoOpenedSandboxEntryId] = useState<string | null>(null);
	const [suppressedSandboxEntryId, setSuppressedSandboxEntryId] = useState<string | null>(null);
	const [isCompactViewport, setIsCompactViewport] = useState(() => (
		typeof window !== 'undefined' ? window.innerWidth < 1024 : false
	));
	const selectedEntryId = selectedEntry?.entryId ?? null;
	const selectedUnassignedKey = selectedUnassigned ? buildUnassignedKey(selectedUnassigned) : null;
	const activeSandboxKey = selectedEntryId ?? selectedUnassignedKey;

	useEffect(() => {
		const syncViewport = () => setIsCompactViewport(window.innerWidth < 1024);
		syncViewport();
		window.addEventListener('resize', syncViewport);
		return () => window.removeEventListener('resize', syncViewport);
	}, []);

	useEffect(() => {
		setSandboxFacultyByEntryId(new Map());
		setTacticalSandboxOpen(false);
		setAutoOpenedSandboxEntryId(null);
		setSuppressedSandboxEntryId(null);
	}, [draft?.runId, draft?.version]);

	const handleTacticalSandboxOpenChange = useCallback((open: boolean) => {
		setTacticalSandboxOpen(open);
		if (open && activeSandboxKey) {
			setAutoOpenedSandboxEntryId(activeSandboxKey);
			setSuppressedSandboxEntryId(null);
		} else if (!open && activeSandboxKey) {
			setSuppressedSandboxEntryId(activeSandboxKey);
		}
	}, [activeSandboxKey]);

	const dismissTacticalSandboxForEntry = useCallback((entryId: string) => {
		setSuppressedSandboxEntryId(entryId);
		setTacticalSandboxOpen(false);
	}, []);
	const dismissTacticalSandboxForUnassigned = useCallback(() => {
		setSelectedUnassigned(null);
		setTacticalSandboxOpen(false);
		setAutoOpenedSandboxEntryId(null);
		setSuppressedSandboxEntryId(null);
	}, [setSelectedUnassigned]);

	const sandboxGridEntries = useMemo(
		() => centerView === 'schedule' ? projectSandboxEntries(gridEntries, sandboxFacultyByEntryId) : gridEntries,
		[centerView, gridEntries, sandboxFacultyByEntryId],
	);

	const sandboxDraftEntries = useMemo(
		() => centerView === 'schedule' ? projectSandboxEntries(draftEntries, sandboxFacultyByEntryId) : draftEntries,
		[centerView, draftEntries, sandboxFacultyByEntryId],
	);

	const localSandboxChangedEntryIds = useMemo(
		() => buildSandboxChangedEntryIds(draftEntries, sandboxFacultyByEntryId),
		[draftEntries, sandboxFacultyByEntryId],
	);

	const localSandboxConflictEntryIds = useMemo(
		() => buildSandboxTeacherConflictEntryIds(sandboxDraftEntries, localSandboxChangedEntryIds),
		[localSandboxChangedEntryIds, sandboxDraftEntries],
	);
	const shouldMountTacticalSandbox = tacticalSandboxOpen
		|| sandboxFacultyByEntryId.size > 0
		|| (centerView === 'schedule' && selectedUnassigned !== null);

	const applySandboxFaculty = useCallback((entryIds: string[], facultyId: number) => {
		setSandboxFacultyByEntryId((previous) => {
			const next = new Map(previous);
			const originalEntries = new Map(draftEntries.map((entry) => [entry.entryId, entry]));
			for (const entryId of entryIds) {
				const originalEntry = originalEntries.get(entryId);
				if (!originalEntry) continue;
				if (originalEntry.facultyId === facultyId) next.delete(entryId);
				else next.set(entryId, facultyId);
			}
			return next;
		});
	}, [draftEntries]);

	const resetTacticalSandbox = useCallback(() => {
		setSandboxFacultyByEntryId(new Map());
	}, []);

	const isDraftPublished = useMemo(() => {
		const summary = draft?.summary;
		if (!summary || typeof summary !== 'object') return false;
		const candidate = summary as Record<string, unknown>;
		if (candidate.isPublished === true) return true;
		if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0) return true;
		return typeof candidate.publishedBy === 'number';
	}, [draft?.summary]);

	return (
		<ResizablePanel id="center-panel" order={2} defaultSize={isCompactViewport ? 40 : 60} className="flex-1 min-w-0 flex flex-col min-h-0 relative bg-background" data-tutorial="center-grid">
			<AnimatePresence mode="wait">
				{centerView === 'policy' ? (
					<motion.div
						key="policy"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.18 }}
						className="flex flex-col min-h-0 h-full"
					>
						<Suspense fallback={<AdvancedSurfaceFallback label="Loading policy workspace..." />}>
							<SchedulingPolicyPane
								schoolId={defaultSchoolId}
								schoolYearId={schoolYearId}
								onBack={exitPolicyView}
								onPolicySaved={handleRefresh}
							/>
						</Suspense>
					</motion.div>
				) : centerView === 'manual-edit' && selectedEntry ? (
					<motion.div
						key="manual-edit"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.18 }}
						className="flex flex-col min-h-0 h-full"
					>
						<Suspense fallback={<AdvancedSurfaceFallback label="Loading manual edit tools..." />}>
							<ManualEditPanel
								entry={selectedEntry}
								violationIndex={violationIndex}
								followUps={followUps}
								onToggleFollowUp={toggleFollowUp}
								onClose={() => setCenterView('schedule')}
								subjectLabel={subjectLabel}
								facultyLabel={facultyLabel}
								sectionLabel={sectionLabel}
								gradeForSection={gradeForSection}
								roomLabel={roomLabel}
								isStaleRoom={isStaleRoom}
								timeSlots={timeSlots}
								roomMap={roomMap}
								facultyMap={facultyMap}
								subjectMap={subjectMap}
								draftEntries={draftEntries}
								onPreview={previewEdit}
								onCommit={commitEdit}
								previewLoading={previewLoading}
								commitLoading={commitLoading}
								initialAction={pendingAction}
								onForceOpen={() => {}}
							/>
						</Suspense>
					</motion.div>
				) : centerView === 'map' ? (
					<motion.div
						key="map-view"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0 p-3"
					>
						<div className="mb-2 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Badge variant="outline" className="h-5 px-1.5 text-xs uppercase">Map</Badge>
								<p className="text-xs text-muted-foreground">
									{preGenOnboarding ? 'Click a building then a room to pivot the timetable grid to that room.' : 'View-only map workspace. Editing remains in `/map-editor`.'}
								</p>
							</div>
							<Button variant="outline" size="sm" className="h-7 text-xs"
								onClick={() => preGenOnboarding ? setCenterView('pre-generation') : setCenterView('schedule')}>
								<ChevronLeft className="size-3.5" />
								{preGenOnboarding ? 'Back to Grid' : 'Back to Schedule'}
							</Button>
						</div>
						<Suspense fallback={<AdvancedSurfaceFallback label="Loading map workspace..." />}>
							<CampusMap
								buildings={buildings}
								activeBuildingId={mapBuildingId}
								onSelect={(buildingId) => {
									if (buildingId == null) {
										setMapBuildingId(null);
										return;
									}
									void openBuildingWorkspace(buildingId);
								}}
							/>
						</Suspense>
					</motion.div>
				) : centerView === 'building' && selectedMapBuilding ? (
					<motion.div
						key={`building-${selectedMapBuilding.id}`}
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0 p-3 gap-3"
					>
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCenterView('map')}>
									<ChevronLeft className="size-3.5" />
									Back to Map
								</Button>
								<Badge variant="outline" className="h-5 px-1.5 text-xs uppercase">Building View</Badge>
								<p className="text-xs font-medium">{selectedMapBuilding.name}</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={() => setCenterView('schedule')}
							>
								Back to Schedule
							</Button>
						</div>
						<div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
							<div className="col-span-8 min-h-0 rounded-lg border border-border bg-card p-2">
								<Suspense fallback={<AdvancedSurfaceFallback label="Loading building view..." />}>
									<BuildingView
										building={selectedMapBuilding}
										height={420}
										showToolbar
										selectedRoomId={mapRoomId}
										onRoomSelect={(room) => {
											if (!room) return;
											openRoomGridWorkspace(room.id);
										}}
									/>
								</Suspense>
							</div>
							<div className="col-span-4 min-h-0 rounded-lg border border-border bg-muted/20 p-3">
								<p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rooms</p>
								<div className="space-y-px overflow-auto rounded-lg border border-border bg-border max-h-104">
									{selectedMapBuildingFloors.map((floor) => {
										const rooms = selectedMapBuilding.rooms
											.filter((r: any) => r.floor === floor)
											.sort((a: any, b: any) => a.floorPosition - b.floorPosition);
										return (
											<div key={floor} className="flex bg-background">
												<div className="flex w-7 shrink-0 items-center justify-center border-r border-border bg-muted/50">
											<span className="rotate-180 text-xs font-bold text-muted-foreground [writing-mode:vertical-lr]">
														F{floor}
													</span>
												</div>
												<div className="flex flex-1 gap-px bg-border min-h-10">
													{rooms.length === 0 ? (
														<div className="flex flex-1 items-center justify-center bg-background px-2">
													<span className="text-xs italic text-muted-foreground/50">Empty</span>
														</div>
													) : (
														rooms.map((room: any) => {
															const roomType = (room.type in ROOM_COLORS ? room.type : 'OTHER') as keyof typeof ROOM_COLORS;
															const colors = ROOM_COLORS[roomType];
															return (
																<Button
																	key={room.id}
																	type="button"
																	variant="ghost"
																	onClick={() => openRoomGridWorkspace(room.id)}
																	className={`h-auto flex-1 flex-col items-center justify-center rounded-none px-1 py-1 text-left transition-all ${colors.bg} hover:brightness-95`}
																>
															<span className={`w-full truncate text-center text-xs font-semibold ${colors.text}`}>
																		{room.name}
																	</span>
															<span className="w-full truncate text-center text-xs text-muted-foreground">
																		{ROOM_TYPE_LABELS[roomType]}
																	</span>
																</Button>
															);
														})
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</motion.div>
				) : presentationMode === 'matrix' && (centerView === 'schedule' || centerView === 'pre-generation') && (centerView === 'pre-generation' ? draftBoard != null : draft != null) ? (
					<motion.div
						key={centerView === 'pre-generation' ? 'pre-generation-matrix' : 'schedule-matrix'}
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0"
					>
						<ClassProgramMatrixView
							entries={sandboxGridEntries as any}
							sectionLabel={sectionLabel}
							gradeForSection={gradeForSection}
							subjectLabel={subjectLabel}
							roomLabelShort={roomLabelShort}
							entryContextLabel={entryContextLabel}
							onEntryClick={handleEntryClick}
							selectedEntryId={selectedEntry?.entryId ?? null}
							header={<Badge variant="secondary" className="h-5 px-1.5 text-xs">{centerView === 'pre-generation' ? 'Pre-Generation Matrix' : 'Generated Matrix'}</Badge>}
						/>
					</motion.div>
				) : (
					<motion.div
						key={centerView === 'pre-generation' ? 'pre-generation-grid' : 'schedule-grid'}
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0"
					>
						<ScrollArea className="flex-1 min-h-0">
							{(centerView === 'pre-generation' ? draftBoard != null : draft != null) ? (
								<div className="p-4">
									{centerView === 'pre-generation' ? (
										<div className="mb-3 flex items-center gap-2 flex-wrap">
											{entityFilter && entityFilter !== 'all' ? (
												<Badge
													variant="secondary"
												className={`h-5 max-w-36 truncate px-2 text-xs ${
														viewMode === 'faculty' ? 'bg-purple-50 text-purple-700 border-purple-200' :
														viewMode === 'room' ? 'bg-blue-50 text-blue-700 border-blue-200' :
														'bg-muted text-muted-foreground'
															}`}
												>
													{viewMode === 'faculty' ? 'Teacher' : viewMode === 'room' ? 'Room' : 'Section'}: {pivotLabel(Number(entityFilter))}
												</Badge>
											) : null}
										<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => { setCenterView('map'); setPreGenOnboarding(true); }}>
												<MapPin className="size-3" />
												Map
											</Button>
										</div>
									) : null}
									<TimetableGrid
										entries={sandboxGridEntries}
										timeSlots={timeSlots}
										violationIndex={violationIndex}
										highlightedEntryIds={highlightedEntryIds}
										localSandboxChangedEntryIds={localSandboxChangedEntryIds}
										localSandboxConflictEntryIds={localSandboxConflictEntryIds}
										selectedEntry={selectedEntry}
										followUps={followUps}
										onEntryClick={handleEntryClick}
										subjectLabel={subjectLabel}
										sectionLabel={sectionLabel}
										gradeForSection={gradeForSection}
										entryContextLabel={entryContextLabel}
										formatFacultyInitials={formatFacultyInitials}
										facultyLabel={facultyLabel}
										viewMode={viewMode}
										showTeacherDetails={viewMode !== 'section'}
										pivotLabel={pivotLabel}
										roomLabelShort={roomLabelShort}
										kbSelectedSource={kbSelectedSource}
										onKbPlace={handleKbPlace}
										getCellConflict={getCellConflict}
										getLiveCellConflict={getLiveCellConflict}
										onNavToFaculty={navToFaculty}
										onNavToSection={navToSection}
										onNavToRoom={navToRoom}
									/>
								</div>
							) : (
								<div className="flex min-h-56 items-center justify-center p-4">
									<div className="text-center space-y-2">
										<CalendarClock className="mx-auto size-10 text-muted-foreground/30" />
										<p className="text-sm text-muted-foreground">
											{centerView === 'pre-generation'
												? 'Pre-generation draft is empty. Drag sources from the left panel into this grid.'
												: runs.length === 0
												? 'Start with Pre-Generation Draft on the left, then Generate when ready.'
												: 'No draft entries in this run'}
										</p>
									</div>
								</div>
							)}
						</ScrollArea>
						{centerView === 'pre-generation' && preGenPending && (
							<div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2 space-y-1.5">
								<div className="flex flex-wrap items-center gap-2 text-xs">
									<Lock className="size-3 text-primary shrink-0" />
									<span className="font-medium text-foreground truncate max-w-[16rem]">Pending: {preGenPending.sourceLabel}</span>
									{preGenPreviewLoading ? (
										<span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" />Checking…</span>
									) : preGenPreviewError ? (
										<span className="text-xs text-destructive">{preGenPreviewError}</span>
									) : preGenPreview ? (
										<span className={preGenPreview.allowed ? 'text-emerald-700' : 'text-red-700'}>
											{preGenPreview.allowed ? '✓ No hard conflicts' : '✗ Hard conflict'}
										</span>
									) : null}
								</div>
								{preGenPreview?.humanConflicts.slice(0, 2).map((conflict: any) => (
									<div key={`${conflict.code}-${conflict.humanDetail}`} className={`rounded border px-2 py-1 text-xs ${conflict.severity === 'HARD' ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
										<span className="font-medium">{conflict.humanTitle}</span> — {conflict.humanDetail}
									</div>
								))}
						{preGenPending && getCellConflict?.(`${preGenPending.day}-${preGenPending.startTime}-${preGenPending.endTime}`)?.kind === 'hard' && (
									<div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
										<AlertTriangle className="size-3 shrink-0 mt-0.5" />
										<span>Slot occupied — choose another slot or use the switch review before saving.</span>
									</div>
								)}
								{preGenPreview?.softViolations.length ? (<div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"><AlertTriangle className="size-3 shrink-0 mt-0.5" /><span>{preGenPreview.softViolations.length} soft warning(s) — informational only.</span></div>) : null}
								<div className="flex items-center gap-2">
									<Button
										id="pre-gen-pending-save-anchor"
										data-testid="pre-gen-pending-save-anchor"
										size="sm"
										className="h-7 text-xs"
										disabled={preGenSaving || preGenPreviewLoading || !preGenPreview || (preGenPreview.hardViolations?.length ?? 0) > 0}
										onClick={() => void commitPreGenPending()}
									>
										{preGenSaving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Lock className="mr-1 size-3" />}
										Save placement
									</Button>
									<Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setPreGenPending(null); setPreGenPreview(null); setPreGenPreviewError(null); setPreGenAllowSoftOverride(false); }}>
										Cancel
									</Button>
								</div>
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>
			{shouldMountTacticalSandbox ? (
				<Suspense fallback={null}>
					<Profiler id="Tactical Sandbox" onRender={onProfilerRender}>
						<TacticalSandboxDock
							open={tacticalSandboxOpen}
							onOpenChange={handleTacticalSandboxOpenChange}
							selectedEntry={centerView === 'schedule' ? selectedEntry : null}
							selectedUnassigned={centerView === 'schedule' ? selectedUnassigned : null}
							draftEntries={draftEntries}
							schoolId={defaultSchoolId}
							runId={draft?.runId ?? null}
							facultyMap={facultyMap}
							subjectMap={subjectMap}
							roomMap={roomMap}
							schoolYearId={schoolYearId}
							sandboxFacultyByEntryId={sandboxFacultyByEntryId}
							onApplyFaculty={applySandboxFaculty}
							onPreviewTeachingLoadRepair={previewTeachingLoadRepair}
							onCommitTeachingLoadRepair={commitTeachingLoadRepair}
							onRevisionCreated={handleRefresh}
							onResetSandbox={resetTacticalSandbox}
							onDismissSelectedEntry={dismissTacticalSandboxForEntry}
							onDismissSelectedUnassigned={dismissTacticalSandboxForUnassigned}
							isPublished={isDraftPublished}
							subjectLabel={subjectLabel}
							sectionLabel={sectionLabel}
							facultyLabel={facultyLabel}
						/>
					</Profiler>
				</Suspense>
			) : null}
		</ResizablePanel>
	);
});
