/**
 * C11 slice 1 — the centre PANE, extracted verbatim out of `CenterWorkspace.tsx`.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 *
 * Two reasons, and the second is a QA finding rather than housekeeping.
 *
 * 1. `CenterWorkspace.tsx` was at 965 physical lines against the 1000-line
 *    component cap (AGENTS.md §8) with no room for the M1 correction, the M3
 *    target highlight, or any further arm. The pane chain is the bulk of the file
 *    and it is one cohesive unit, so it moved out whole rather than being split.
 *
 * 2. C11 F4 (BLOCKING): "M1 and M3 have no rendered row of the production
 *    surface, which is why a 20/20 green gate shipped F1." The M1 rows rendered a
 *    test-LOCAL `PaneUnderTest` fixture — the real `resolveCenterPane` and the real
 *    `AnimatePresence`, but a synthetic `<div>` arm, never `CenterWorkspace`. That
 *    fixture is structurally incapable of detecting the regression, because it
 *    could not express the input F1 is about. The test now drives THIS component —
 *    the same component the product renders, with the same decision, the same
 *    `AnimatePresence mode="wait"` arrangement, the same pending-map bypass, and
 *    the real `TimetableGrid` / `CenterWorkspaceManualEditEmpty` / `ManualEditPanel`
 *    arms.
 *
 * NOTHING about the rendered output changed: this is a move. The arms, their keys,
 * their order, their classes and the pending-map bypass are byte-for-byte the ones
 * that were in `CenterWorkspace.tsx`.
 *
 * ── THE C11 M1 CORRECTION (F1) LIVES HERE ────────────────────────────────────
 *
 * `resolveCenterPane` is called with `routeAppliedPathname` — the pathname the
 * route sync has actually applied — so the route override fires ONLY in the
 * one-render lag window after a URL move, and never on an in-app entry that never
 * changed the URL. See `MapRouteTransitionIntent` for the full trace.
 */
import { lazy, Suspense, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Building2, CalendarClock, ChevronLeft, Loader2, Lock, MapPin } from 'lucide-react';

import { ClassProgramMatrixView } from '@/components/timetable/ClassProgramMatrixView';
import { isDraftPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { GridScrollMemory } from '@/components/timetable/GridScrollMemory';
import { MapRouteTransitionFrame, resolveCenterPane } from '@/components/timetable/MapRouteTransitionIntent';
import { CenterWorkspaceManualEditEmpty } from '@/components/timetable/CenterWorkspaceManualEditEmpty';
import { PreferenceAdherenceLine } from '@/components/timetable/PreferenceAdherenceLine';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import type { RoomType, ScheduledEntry, Violation } from '@/types';
import type { TimetableSetupPaneInputs } from '@/components/timetable/TimetableSetupPane';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/simple/SimpleTaskDrawerHelpers';

const CampusMap = lazy(() => import('@/components/CampusMap').then((module) => ({
	default: module.CampusMap,
})));
const ManualEditPanel = lazy(() => import('@/components/ManualEditPanel'));
const SchedulingPolicyPane = lazy(() => import('@/components/SchedulingPolicyPane'));
const TimetableRunsPane = lazy(() => import('@/components/timetable/TimetableRunsPane').then((module) => ({
	default: module.TimetableRunsPane,
})));
const TimetableSetupPane = lazy(() => import('@/components/timetable/TimetableSetupPane').then((module) => ({
	default: module.TimetableSetupPane,
})));
const BuildingView = lazy(() => import('@/components/BuildingView').then((module) => ({
	default: module.BuildingView,
})));

const NO_SANDBOX_OVERRIDES: ReadonlyMap<string, number> = new Map();

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

function projectSandboxEntries(entries: any[], sandboxFacultyByEntryId: ReadonlyMap<string, number>): any[] {
	if (sandboxFacultyByEntryId.size === 0) return entries;
	return entries.map((entry) => {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
		return facultyId == null ? entry : { ...entry, facultyId };
	});
}

function buildSandboxChangedEntryIds(entries: any[], sandboxFacultyByEntryId: ReadonlyMap<string, number>): Set<string> {
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

export type CenterPaneView =
	| 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building' | 'runs' | 'setup';

export type CenterWorkspacePaneSurfaceProps = {
	centerView: CenterPaneView;
	/**
	 * C11 M1 CORRECTION (F1) — the pathname `TimetableRouteViewSync` has applied to
	 * `centerView`, or `null`/absent before it has applied any. That unapplied state
	 * (direct URL entry, or the one-render lag after a URL move) is the ONLY state in
	 * which the route may override a selection-dependent view. Optional so the
	 * workspace context builder is unchanged; `undefined` means unapplied.
	 */
	routeAppliedPathname?: string | null;
	selectedEntry: any;
	violationIndex: Map<string, Violation[]>;
	formatWarningMessage?: (message: string, violation?: Violation) => string;
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
	/** The tactical sandbox's in-progress faculty re-assignments, owned by `CenterWorkspace`. Empty map = no sandbox overrides. */
	sandboxFacultyByEntryId?: Map<string, number>;
	previewEdit: (proposal: any) => Promise<any>;
	commitEdit: (proposal: any, allowSoftOverride?: boolean) => Promise<boolean>;
	previewLoading: boolean;
	commitLoading: boolean;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (id: number) => number | null;
	roomLabel: (roomId: number) => string;
	isStaleRoom: (roomId: number) => boolean;
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	preGenOnboarding: boolean;
	setCenterView: (view: CenterPaneView) => void;
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
	newDraftLoading: boolean;
	entityFilter: string;
	pivotLabel: (id: number) => string;
	viewMode: 'section' | 'faculty' | 'room';
	termFilter: 'all' | number;
	termOptions?: ReadonlyArray<{ value: string; label: string }>;
	reviewEntryIds?: ReadonlySet<string>;
	setPreGenOnboarding: (value: boolean) => void;
	gridEntries: any[];
	highlightedEntryIds: Set<string>;
	swapClassAEntryId?: string | null;
	swapClassBEntryId?: string | null;
	teacherDepartureEntryIds?: Set<string>;
	onReassignTeacher?: (entry: any) => void;
	handleEntryClick: (entry: any) => void;
	entryContextLabel: (entry: any) => string;
	formatFacultyInitials: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	kbSelectedSource: any;
	handleKbPlace: (day: string, startTime: string, endTime: string) => Promise<void>;
	handleKbPlaceStart?: () => void;
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
	simpleMode?: boolean;
	onWarningEntrySelect?: () => void;
	policyRecord?: any;
	policyRefreshToken?: number;
	refreshPolicy?: () => void;
	runsSelectedId?: string;
	onRunsSelect?: (value: string) => void;
	formatRunTimestamp?: (value: string | null) => string;
	formatRunDuration?: (value: number | null) => string;
	runsPending: boolean;
	runsUnavailableReason: string | null;
	setupInputs?: TimetableSetupPaneInputs | null;
	setupOnStartTask?: (task: TimetableSimpleTask | null) => void;
	setupOnSetRepairOrigin?: ((origin: RepairOrigin | null) => void) | null;
	/**
	 * C11 M3 (F3) — the legal move-target slot keys for the CURRENT view, as the
	 * ONE `describeMoveTargets` derivation produced. Threaded to `TimetableGrid` so
	 * the highlighted cells are exactly the keys the status sentence counts; the
	 * grid and the banner cannot disagree because neither derives the list.
	 */
	moveTargetSlotKeys?: ReadonlySet<string>;
};

/**
 * The centre pane exactly as `CenterWorkspace` renders it: the pending-map bypass
 * OUTSIDE `AnimatePresence`, then the animated chain keyed off the RESOLVED view.
 */
export function CenterWorkspacePaneSurface(props: CenterWorkspacePaneSurfaceProps) {
	const {
		centerView,
		routeAppliedPathname = null,
		selectedEntry,
		violationIndex,
		formatWarningMessage,
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
		sandboxFacultyByEntryId = NO_SANDBOX_OVERRIDES,
		previewEdit,
		commitEdit,
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
		newDraftLoading,
		entityFilter,
		pivotLabel,
		viewMode,
		termFilter,
		termOptions = [],
		reviewEntryIds,
		setPreGenOnboarding,
		gridEntries,
		highlightedEntryIds,
		swapClassAEntryId,
		swapClassBEntryId,
		teacherDepartureEntryIds,
		onReassignTeacher,
		handleEntryClick,
		entryContextLabel,
		formatFacultyInitials,
		roomLabelShort,
		kbSelectedSource,
		handleKbPlace,
		handleKbPlaceStart,
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
		simpleMode = false,
		onWarningEntrySelect,
		policyRecord = null,
		policyRefreshToken = 0,
		refreshPolicy,
		runsSelectedId = 'latest',
		onRunsSelect = () => {},
		formatRunTimestamp = (value) => value ?? '',
		formatRunDuration = (value) => value == null ? '—' : `${(value / 1000).toFixed(1)}s`,
		runsPending,
		runsUnavailableReason,
		setupInputs = null,
		setupOnStartTask = () => {},
		setupOnSetRepairOrigin = null,
		moveTargetSlotKeys,
	} = props;

	const { pathname } = useLocation();
	// A7 — this surface is rendered at ONE position in `CenterWorkspace`, so a ref
	// declared here survives every sub-page swap for the same reason the original
	// did: the centre panel is never unmounted between centre views.
	const gridScrollTopRef = useRef(0);

	const sandboxGridEntries = (centerView === 'schedule' ? projectSandboxEntries(gridEntries, sandboxFacultyByEntryId) : gridEntries);
	const sandboxDraftEntries = (centerView === 'schedule' ? projectSandboxEntries(draftEntries, sandboxFacultyByEntryId) : draftEntries);
	const localSandboxChangedEntryIds = buildSandboxChangedEntryIds(draftEntries, sandboxFacultyByEntryId);
	const localSandboxConflictEntryIds = buildSandboxTeacherConflictEntryIds(sandboxDraftEntries, localSandboxChangedEntryIds);

	// A2 C5 item 2 (M2-A) — the pending map route BYPASSES the animated chain. With
	// `mode="wait"`, AnimatePresence keeps the exiting child mounted and defers the
	// incoming one, so an in-chain branch would leave the previous section's class
	// cells in the DOM for the exit duration. No exit animation is started here, so
	// nothing lingers. See `MapRouteTransitionIntent` for the recorded cause.
	const centerPane = resolveCenterPane(pathname, centerView, routeAppliedPathname);
	// C11 M1 (F1 correction) — every arm of the chain below keys off THIS, not off
	// `centerView`: the route→view sync moves `centerView` in an effect, so for one
	// render after a URL move the URL and the view disagree, and keying off the
	// decision means the disagreeing render cannot paint a stale
	// selection-dependent pane over the grid. `routeAppliedPathname` keeps that
	// override inside the lag window only, so an in-app entry still reaches its pane.
	const paneView = centerPane.kind === 'center-view' ? centerPane.view : centerView;

	return (
		<>
		{centerPane.kind === 'pending-map-intent' ? (
			<MapRouteTransitionFrame pathname={pathname} />
		) : (
		<AnimatePresence mode="wait">
			{paneView === 'policy' ? (
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
							scopeRunId={draft?.runId ?? null}
							scopeTermIndex={termFilter}
							onBack={exitPolicyView}
							onPolicySaved={handleRefresh}
							policyRecord={policyRecord}
							policyRefreshToken={policyRefreshToken}
							onPolicyRefetch={refreshPolicy}
						/>
					</Suspense>
				</motion.div>
			) : paneView === 'runs' ? (
				<motion.div
					key="runs"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 8 }}
					transition={{ duration: 0.18 }}
					className="flex flex-col min-h-0 h-full"
				>
					<Suspense fallback={<AdvancedSurfaceFallback label="Loading runs..." />}>
						<TimetableRunsPane
							runs={runs}
							runsPending={runsPending}
							runsUnavailableReason={runsUnavailableReason}
							selectedRunId={runsSelectedId}
							onSelectRun={onRunsSelect}
							formatTimestamp={formatRunTimestamp}
							formatDuration={formatRunDuration}
						/>
					</Suspense>
				</motion.div>
			) : paneView === 'setup' ? (
				<motion.div
					key="setup"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 8 }}
					transition={{ duration: 0.18 }}
					className="flex flex-col min-h-0 h-full"
				>
					<Suspense fallback={<AdvancedSurfaceFallback label="Loading setup..." />}>
						<TimetableSetupPane
							inputs={setupInputs}
							sectionLabel={sectionLabel}
							subjectLabel={subjectLabel}
							facultyLabel={facultyLabel}
							onStartSimpleTask={setupOnStartTask}
							onSetRepairOrigin={setupOnSetRepairOrigin}
						/>
					</Suspense>
				</motion.div>
			) : paneView === 'manual-edit' && selectedEntry ? (
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
							entry={selectedEntry as ScheduledEntry}
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
			) : paneView === 'manual-edit' ? (
				// C11 M1 — the empty arm. Extracted to
				// `CenterWorkspaceManualEditEmpty.tsx` by the first cut of this slice
				// for the 1000-line cap; the rendered result is one honest state with
				// a way back to the grid, never a blank surface and never an
				// invented selection.
				<motion.div
					key="manual-edit-empty"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 8 }}
					transition={{ duration: 0.18 }}
					className="flex flex-col min-h-0 h-full"
				>
					<CenterWorkspaceManualEditEmpty isDraftPublished={isDraftPublishedStrict(draft)} />
				</motion.div>
			) : paneView === 'map' ? (
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
								{preGenOnboarding ? 'Click a building then a room to pivot the timetable grid to that room.' : 'View-only map workspace. Editing remains in `/map?mode=editor`.'}
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
			) : paneView === 'building' && selectedMapBuilding ? (
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
									onRoomSelect={(room: any) => {
										if (!room) return;
										openRoomGridWorkspace(room.id);
									}}
								/>
							</Suspense>
						</div>
						<div className="col-span-4 min-h-0 rounded-lg border border-border bg-muted/20 p-3">
							<p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rooms</p>
							<div className="space-y-px overflow-auto scrollbar-thin rounded-lg border border-border bg-border max-h-104">
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
			) : paneView === 'building' ? (
				// UX-R03b — selection-dependent honesty: entered without a
				// selected building (e.g. direct URL entry to
				// /timetable/building). Never a blank center surface and
				// never a fabricated building: name how to reach the pane.
				<motion.div
					key="building-empty"
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.18 }}
					className="flex flex-col min-h-0 h-full"
				>
					<div className="flex min-h-0 flex-1 items-center justify-center p-4">
						<div className="max-w-md space-y-3 text-center" data-testid="timetable-building-empty-state">
							<Building2 className="mx-auto size-10 text-muted-foreground/30" />
							<p className="text-sm font-medium">No building selected</p>
							<p className="text-xs text-muted-foreground">
								Open the map and select a building to view its floors and rooms here.
							</p>
							{/* UX-R03b correction: navigate instead of setting view state,
							    so the URL always matches the shown view; the route→view
							    sync then drives the guarded transition. */}
							<Button asChild variant="outline" size="sm" className="h-7 text-xs">
								<Link to="/timetable/map">
									<ChevronLeft className="size-3.5" />
									Back to Map
								</Link>
							</Button>
						</div>
					</div>
				</motion.div>
			) : presentationMode === 'matrix' && (paneView === 'schedule' || paneView === 'pre-generation') && (paneView === 'pre-generation' ? draftBoard != null : draft != null) ? (
				<motion.div
					key={paneView === 'pre-generation' ? 'pre-generation-matrix' : 'schedule-matrix'}
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
						formatFacultyInitials={formatFacultyInitials}
						entryContextLabel={entryContextLabel}
						onEntryClick={handleEntryClick}
						selectedEntryId={selectedEntry?.entryId ?? null}
						header={<Badge variant="secondary" className="h-5 px-1.5 text-xs">{paneView === 'pre-generation' ? 'Pre-Generation Matrix' : 'Generated Matrix'}</Badge>}
					/>
				</motion.div>
			) : (
				<motion.div
					key={paneView === 'pre-generation' ? 'pre-generation-grid' : 'schedule-grid'}
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.18 }}
					className="flex-1 min-w-0 flex flex-col min-h-0"
				>
					<GridScrollMemory scrollTopRef={gridScrollTopRef} className="flex-1 min-h-0">
						{(paneView === 'pre-generation' ? draftBoard != null : draft != null) ? (
							<div className="p-4">
								{/* A2 C17 — "were teacher preferences kept?", on the run summary
								    strip above the grid. This is the workspace BODY, not the
								    header: the packet's named anchor (`runStateSentence` /
								    `runUnplacedSentence`) actually renders in the two headers, and
								    §8 caps a header at two calm rows that row 1 already is. This
								    position is also the only one that is automatically right for
								    BOTH required views — the draft view and the published view of a
								    run are this same grid arm, because publication is a state of the
								    run rather than a different pane.

								    It renders NOTHING when there is nothing to say (the
								    component's own `hasAny` gate), so a year where no teacher has
								    reviewed preferences gains no pixels here at all. That is the
								    subtraction the packet asks for: the region had no chrome of
								    its own to remove, so the line pays for itself by being absent
								    in the common case rather than by displacing something.

								    `termFilter` is `'all' | number`; availability is term-scoped, so
								    `'all'` resolves explicitly to the active term rather than
								    silently to Term 1. */}
								{paneView !== 'pre-generation' ? (
									<PreferenceAdherenceLine
										runId={draft?.runId ?? null}
										/* F6: passed plainly. `defaultSchoolId` is `number` here,
										 * so `?? null` was dead code AND the `??` token is the
										 * exact shape in the open "parseSchoolId defaults to school 1"
										 * defect backlog — a later reader could copy it. */
										schoolId={defaultSchoolId}
										schoolYearId={schoolYearId}
										termIndex={typeof termFilter === 'number' ? termFilter : 'active'}
									/>
								) : null}
								{paneView === 'pre-generation' ? (
									<div className="mb-3 flex min-w-0 items-center gap-2">
										{entityFilter && entityFilter !== 'all' ? (
											<TooltipProvider delayDuration={300}>
												<Tooltip>
													<TooltipTrigger asChild>
														<Badge
															variant="secondary"
															aria-label={`${viewMode === 'faculty' ? 'Teacher' : viewMode === 'room' ? 'Room' : 'Section'}: ${pivotLabel(Number(entityFilter))}`}
															tabIndex={0}
															data-testid="timetable-current-context-badge"
															className={`min-w-0 max-w-[min(32rem,calc(100vw-8rem))] flex-1 cursor-default justify-start overflow-hidden px-2 text-xs ${
																viewMode === 'faculty' ? 'bg-purple-50 text-purple-700 border-purple-200' :
																viewMode === 'room' ? 'bg-blue-50 text-blue-700 border-blue-200' :
																'bg-muted text-muted-foreground'
															}`}
														>
															<span className="shrink-0">
																{viewMode === 'faculty' ? 'Teacher' : viewMode === 'room' ? 'Room' : 'Section'}:
															</span>
															<span className="min-w-0 truncate">{pivotLabel(Number(entityFilter))}</span>
														</Badge>
													</TooltipTrigger>
													<TooltipContent side="bottom" className="max-w-[min(32rem,calc(100vw-2rem))]">
														{viewMode === 'faculty' ? 'Teacher' : viewMode === 'room' ? 'Room' : 'Section'}: {pivotLabel(Number(entityFilter))}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										) : null}
										<Button variant="outline" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => { setCenterView('map'); setPreGenOnboarding(true); }}>
											<MapPin className="size-3" />
											Map
										</Button>
									</div>
								) : null}
								{/* LANE-C C03 (B9) — an empty draft grid said nothing, so it read
								    as the published schedule vanishing. Say what this view is. */}
								{paneView === 'pre-generation' && sandboxGridEntries.length === 0 ? (
									<p className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground" data-testid="timetable-draft-empty-note">
										Draft · nothing placed yet. Place classes from the list on the left, or Generate a draft.
									</p>
								) : null}
								<TimetableGrid
									entries={sandboxGridEntries}
									timeSlots={timeSlots}
									violationIndex={violationIndex}
									highlightedEntryIds={highlightedEntryIds}
									swapClassAEntryId={swapClassAEntryId}
									swapClassBEntryId={swapClassBEntryId}
									teacherDepartureEntryIds={teacherDepartureEntryIds}
									localSandboxChangedEntryIds={localSandboxChangedEntryIds}
									localSandboxConflictEntryIds={localSandboxConflictEntryIds}
									selectedEntry={selectedEntry}
									followUps={followUps}
									moveTargetSlotKeys={moveTargetSlotKeys}
									onEntryClick={(entry) => {
										handleEntryClick(entry);
										if ((violationIndex.get(entry.entryId)?.length ?? 0) > 0) onWarningEntrySelect?.();
									}}
									subjectLabel={subjectLabel}
									sectionLabel={sectionLabel}
									gradeForSection={gradeForSection}
									entryContextLabel={entryContextLabel}
									formatFacultyInitials={formatFacultyInitials}
									facultyLabel={facultyLabel}
									viewMode={viewMode}
									termFilter={termFilter}
									termOptions={termOptions}
									reviewEntryIds={reviewEntryIds}
									formatWarningMessage={formatWarningMessage}
									showTeacherDetails
									pivotLabel={pivotLabel}
									roomLabelShort={roomLabelShort}
									kbSelectedSource={kbSelectedSource}
									onKbPlace={handleKbPlace}
									onKbPlaceStart={handleKbPlaceStart}
									getCellConflict={getCellConflict}
									getLiveCellConflict={getLiveCellConflict}
									onNavToFaculty={navToFaculty}
									onNavToSection={navToSection}
									onNavToRoom={navToRoom}
									onReassignTeacher={onReassignTeacher}
									simpleMode={simpleMode}
								/>
							</div>
						) : (
							<div className="flex min-h-56 items-center justify-center p-4">
								<div className="max-w-md text-center space-y-3">
									<CalendarClock className="mx-auto size-10 text-muted-foreground/30" />
									<p className="text-sm text-muted-foreground" data-testid="timetable-empty-state-message">
										{paneView === 'pre-generation'
											? (newDraftLoading
												// LANE-C C03 (B9) — while the draft loads, say so instead of "empty".
												? 'Loading the draft…'
												: 'Pre-generation draft is empty. Drag sources from the left panel into this grid.')
											: runs.length === 0
											? 'No draft yet. Generate one to begin.'
											: 'No draft entries in this run'}
									</p>
								</div>
							</div>
						)}
					</GridScrollMemory>
					{paneView === 'pre-generation' && preGenPending && (
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
		)}
		</>
	);
}
