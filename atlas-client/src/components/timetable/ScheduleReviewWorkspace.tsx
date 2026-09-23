import { DndContext, DragOverlay, pointerWithin, useDndContext } from '@dnd-kit/core';
import { useScheduleReviewWorkspaceState } from '@/hooks/useScheduleReviewWorkspaceState';
import { ScheduleReviewWorkspaceHeader } from '@/components/timetable/ScheduleReviewWorkspaceHeader';
import { TimetableSimpleHeader } from '@/components/timetable/TimetableSimpleHeader';
import { TimetableSubNav } from '@/components/timetable/TimetableSubNav';
import { ScheduleReviewWorkspaceBody } from '@/components/timetable/ScheduleReviewWorkspaceBody';
import { ScheduleReviewWorkspaceOverlays } from '@/components/timetable/ScheduleReviewWorkspaceOverlays';
import { TimetableFacultyIssuePivotDialog } from '@/components/timetable/TimetableFacultyIssuePivotDialog';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import { InlinePlacementPreview } from '@/components/timetable/InlinePlacementPreview';
import { isTimetableSchedulerView, TimetableRouteViewSync } from '@/components/timetable/TimetableRouteViewSync';
import { TimetableRouteLoadingState } from '@/components/timetable/TimetableRouteLoadingState';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { AlertCircle, ArrowRight, ArrowRightLeft, BookOpen, Clock, DoorOpen, GraduationCap, MoreHorizontal, Move, Redo2, RefreshCw, Undo2, UserRoundX } from 'lucide-react';
import { lazy, Profiler, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ScheduledEntry } from '@/types';
import { isDraftPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { TimetableUndoRedoControl } from '@/components/timetable/TimetableUndoRedoControl';
import { dispatchUndoByLedger } from '@/components/timetable/timetableUndoRedoState';
import { createSwapArmHandler } from '@/components/timetable/timetableSwapArming';
import { buildScopeKey, clearScopeState, shouldClearForScopeChange } from '@/components/timetable/timetableScopeHygiene';
import { YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';

const TeacherDepartureRecoverySheet = lazy(() => import('@/components/timetable/TeacherDepartureRecoverySheet').then((module) => ({
	default: module.TeacherDepartureRecoverySheet,
})));

export const onProfilerRender = (id: string, phase: string, actualDuration: number, baseDuration: number) => {
	if (typeof window !== 'undefined') {
		const win = window as any;
		win.__reactProfilerLogs = win.__reactProfilerLogs || [];
		win.__reactProfilerLogs.push({ id, phase, actualDuration, baseDuration, timestamp: Date.now() });
	}
};

function TimetableDragOverlay({
	subjectLabel,
	sectionLabel,
}: {
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
}) {
	const { active } = useDndContext();
	const source = active?.data.current as any;
	if (!source?.type) return null;
	const label = source.type === 'entry'
		? subjectLabel(source.entry.subjectId)
		: source.type === 'draftQueue'
			? `${source.item.subjectCode} · ${source.item.sectionName}`
			: source.type === 'draftPlacement'
				? `Draft · ${subjectLabel(source.placement?.subjectId ?? source.entry?.subjectId)}`
				: `${subjectLabel(source.item.subjectId)} · ${sectionLabel(source.item.sectionId)}`;
	return (
		<div className="rounded border border-primary/60 bg-card px-2.5 py-1.5 text-xs shadow-md pointer-events-none select-none">
			<p className="font-medium">{label}</p>
			<p className="mt-0.5 text-xs text-muted-foreground">Release on a highlighted cell to review move or swap.</p>
		</div>
	);
}

export default function ScheduleReviewWorkspace() {
	const state = useScheduleReviewWorkspaceState();
	const location = useLocation();
	const navigate = useNavigate();
	const [layoutMode, setLayoutModeState] = useState<TimetableLayoutMode>(() => {
		if (typeof window === 'undefined') return 'simple';
		return window.localStorage.getItem('atlas_timetable_layout_mode') === 'advanced' ? 'advanced' : 'simple';
	});
	const [activeSimpleTask, setActiveSimpleTask] = useState<TimetableSimpleTask | null>(null);
	const [repairOrigin, setRepairOrigin] = useState<RepairOrigin | null>(null);
	const [readinessSheetOpen, setReadinessSheetOpen] = useState(false);
	const [teacherDepartureOpen, setTeacherDepartureOpen] = useState(false);
	const [teacherDepartureFacultyId, setTeacherDepartureFacultyId] = useState<number | null>(null);
	const [teacherDepartureFocusedEntryIds, setTeacherDepartureFocusedEntryIds] = useState<Set<string> | undefined>(undefined);
	const [simpleDetailsOpen, setSimpleDetailsOpen] = useState(false);

	const setLayoutMode = (mode: TimetableLayoutMode) => {
		setLayoutModeState(mode);
		if (mode === 'advanced') setActiveSimpleTask(null);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('atlas_timetable_layout_mode', mode);
		}
	};

	useEffect(() => {
		if (layoutMode === 'advanced') {
			setActiveSimpleTask(null);
			setRepairOrigin(null);
		}
	}, [layoutMode]);

	useEffect(() => {
		if (activeSimpleTask !== 'place-unresolved') {
			setRepairOrigin(null);
		}
	}, [activeSimpleTask]);

	useEffect(() => {
		if (!state.selectedEntry) setSimpleDetailsOpen(false);
	}, [state.selectedEntry]);

	// R5 (finding A-08; ordered-term invariant 6): every component-local sheet,
	// task, selection, and swap state is scope-bound. When school, school year,
	// run, or selected term changes, clear it before any dispatch can occur so a
	// stale object from the previous scope is never actionable.
	const scopeKey = buildScopeKey({
		schoolId: state.headerContext?.schoolId ?? null,
		schoolYearId: state.centerWorkspaceContext?.schoolYearId ?? null,
		runId: state.draft?.runId ?? null,
		termFilter: state.headerContext?.termFilter ?? null,
	});
	const lastScopeKeyRef = useRef<string | null>(null);
	useEffect(() => {
		if (!shouldClearForScopeChange(lastScopeKeyRef.current, scopeKey)) {
			lastScopeKeyRef.current = scopeKey;
			return;
		}
		lastScopeKeyRef.current = scopeKey;
		// No scoped request may dispatch before these clearers run.
		clearScopeState([
			() => setActiveSimpleTask(null),
			() => setRepairOrigin(null),
			() => setReadinessSheetOpen(false),
			() => setTeacherDepartureOpen(false),
			() => setTeacherDepartureFacultyId(null),
			() => setTeacherDepartureFocusedEntryIds(undefined),
			() => setSimpleDetailsOpen(false),
			() => state.setSwapClassTimesMode?.(null),
			() => state.setSwapClassAEntryId?.(null),
			() => state.setSwapClassBEntryId?.(null),
			() => state.setLastAutoSaveUndo?.(null),
			// B1 — a preview bound to the previous scope must never stay actionable.
			() => state.cancelInlinePlacement?.(),
		]);
	}, [
		scopeKey,
		state.setSwapClassTimesMode,
		state.setSwapClassAEntryId,
		state.setSwapClassBEntryId,
		state.setLastAutoSaveUndo,
		state.cancelInlinePlacement,
	]);

	const openTeacherDepartureRecovery = (facultyId?: number | null) => {
		setTeacherDepartureFacultyId(facultyId ?? state.selectedEntry?.facultyId ?? null);
		setTeacherDepartureFocusedEntryIds(undefined);
		setTeacherDepartureOpen(true);
	};
	const openTeacherDepartureForEntry = useCallback((entry: ScheduledEntry) => {
		state.centerWorkspaceContext?.handleEntryClick(entry);
		setTeacherDepartureFacultyId(entry.facultyId ?? null);
		setTeacherDepartureFocusedEntryIds(new Set([entry.entryId]));
		setTeacherDepartureOpen(true);
	}, [state.centerWorkspaceContext]);

	const allTeacherDepartureEntryIds = useMemo(() => {
		if (!teacherDepartureOpen || teacherDepartureFacultyId == null || !state.draft) return undefined;
		const affected = state.draft.entries
			.filter((entry: ScheduledEntry) => entry.facultyId === teacherDepartureFacultyId)
			.map((entry: ScheduledEntry) => entry.entryId);
		return new Set<string>(affected);
	}, [state.draft, teacherDepartureFacultyId, teacherDepartureOpen]);
	const teacherDepartureEntryIds = teacherDepartureFocusedEntryIds ?? allTeacherDepartureEntryIds;

	const jumpToTeacherDepartureEntry = useCallback((entryId: string) => {
		if (typeof window === 'undefined') return;
		window.requestAnimationFrame(() => {
			const escaped = window.CSS?.escape ? window.CSS.escape(entryId) : entryId.replace(/"/g, '\\"');
			const direct = document.querySelector<HTMLElement>(`[data-timetable-entry-id="${escaped}"]`);
			const cell = direct?.closest<HTMLElement>('td[data-day][data-start-time][data-end-time]')
				?? document.querySelector<HTMLElement>(`td[data-cell-entry-ids~="${escaped}"]`);
			const trigger = document.querySelector<HTMLElement>(`[data-overflow-entry-ids~="${escaped}"]`);
			(cell ?? trigger ?? direct)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
			(cell ?? trigger ?? direct)?.classList.add('ring-2', 'ring-violet-500', 'ring-offset-2');
			window.setTimeout(() => (cell ?? trigger ?? direct)?.classList.remove('ring-2', 'ring-violet-500', 'ring-offset-2'), 1600);
		});
	}, []);

	// R3: the selected-class Swap affordances must arm the same two-class swap
	// workflow the Simple task path arms. Setting `activeSimpleTask` alone was a
	// state-only no-op (finding A-05).
	//
	// CLIENT-QUALITY-C01 (#310): this hook MUST be declared before the component's
	// early returns below. When it sat after the loading-skeleton early return,
	// the loading->loaded transition rendered fewer hooks than the previous render
	// and React threw the canonical #310 error.
	// Declaration order only; the dependency array is unchanged.
	const armSwapSessions = useCallback(() => {
		createSwapArmHandler({
			setTask: setActiveSimpleTask,
			setMode: (mode) => state.setSwapClassTimesMode?.(mode),
			setEntryIdA: (id) => state.setSwapClassAEntryId?.(id),
			setEntryIdB: (id) => state.setSwapClassBEntryId?.(id),
			setStatus: (status) => state.setInlineActionStatus(status),
		})();
	}, [state.setSwapClassTimesMode, state.setSwapClassAEntryId, state.setSwapClassBEntryId, state.setInlineActionStatus]);

	const isDraftPublished = isDraftPublishedStrict(state.draft);

	if (state.loading && !state.draft) {
		const routeIntent = resolveTimetableLoadingIntent(location.pathname);
		if (routeIntent) return <TimetableRouteLoadingState intent={routeIntent} />;
		return <TimetableSkeleton />;
	}

	if (state.error) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)] items-center justify-center gap-4">
				<div className="flex items-center gap-2 text-destructive">
					<AlertCircle className="size-5" />
					<span className="text-sm font-medium">{state.error}</span>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => state.loadAll()}>
						<RefreshCw className="size-3.5 mr-1.5" />
						Retry
					</Button>
					{/* R9/A-10: a missing/invalid active year must offer the real Year Setup repair. */}
					<Button asChild variant="outline" size="sm">
						<Link to={YEAR_SETUP_HREF} data-testid="timetable-error-year-setup">
							Open Year Setup
							<ArrowRight className="size-3.5 ml-1.5" />
						</Link>
					</Button>
				</div>
			</div>
		);
	}
	if (!state.headerContext || !state.leftRailContentContext || !state.centerWorkspaceContext || !state.rightPanelContext || !state.overlaysContext) {
		return <TimetableSkeleton />;
	}
	const showSchedulerChrome = isTimetableSchedulerView(state.headerContext.centerView);

	const startMoveSelectedEntry = () => {
		if (!state.selectedEntry) return;
		state.headerContext.setKbSelectedSource({ type: 'entry', entry: state.selectedEntry });
		state.setInlineActionStatus({
			tone: 'loading',
			message: 'Select an available slot on the grid to preview this move.',
		});
	};

	const openSimpleSelectedDetails = () => {
		if (layoutMode === 'simple') {
			setSimpleDetailsOpen(true);
			return;
		}
		state.rightPanelContext?.rightPanelRef?.current?.expand();
	};

	// R3: selected-class room repair in Simple mode, routed through the same
	// manual-edit surface Advanced uses for Change Room.
	const openSelectedChangeRoom = () => {
		if (!state.selectedEntry) return;
		state.headerContext.enterManualEditView('CHANGE_ROOM');
	};

	// R3: Teaching Load owner repair deep-links to the exact subject/section/
	// teacher context instead of masquerading as the bulk teacher-leaving flow.
	const openSelectedOwnerRepair = () => {
		const entry = state.selectedEntry;
		if (!entry) return;
		const params = new URLSearchParams();
		if (entry.facultyId != null) params.set('facultyId', String(entry.facultyId));
		if (entry.sectionId != null) params.set('sectionId', String(entry.sectionId));
		if (entry.subjectId != null) params.set('subjectId', String(entry.subjectId));
		params.set('task', 'missing-load');
		navigate(`/teaching-load?${params.toString()}`);
	};

	const selectedPrimaryAction = activeSimpleTask === 'swap-sessions'
		? {
			label: 'Swap',
			icon: ArrowRightLeft,
			onClick: armSwapSessions,
		}
		: activeSimpleTask === 'place-unresolved'
			? {
				label: 'Move',
				icon: Move,
				onClick: startMoveSelectedEntry,
			}
			: {
				label: 'Move',
				icon: Move,
				onClick: startMoveSelectedEntry,
			};
	const SelectedPrimaryIcon = selectedPrimaryAction.icon;

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)] relative" data-timetable-year-binding="runtime-active-only">
		{/* UX-R03a — the nested timetable URL drives the existing centerView
		    state through the guarded setter. Renders nothing.
		    UX-R03b — the four new route entries are plain guarded view
		    setters (no fetch, no draft side effect); they only ever run
		    inside switchCenterViewWithGuard, so the guard stays the sole
		    view setter. Richer in-app entries stay on their buttons.
		    UX-R03b correction — the pre-generation route entry also establishes
		    the Draft queue tab, mirroring the in-app entry (which sets the tab
		    before the view). Without it a URL entry lands on a half-initialized
		    pane: the Violations tab is hidden in pre-generation mode, so the
		    rail falls through to Room Requests. The whole pair still runs
		    inside the guarded setter. */}
		<TimetableRouteViewSync
			centerView={state.headerContext.centerView}
			switchCenterViewWithGuard={state.headerContext.switchCenterViewWithGuard}
			enterPolicyView={state.headerContext.enterPolicyView}
			exitPolicyView={state.headerContext.exitPolicyView}
			enterPreGenerationView={() => {
				state.setLeftTab('unassigned');
				state.centerWorkspaceContext.setCenterView('pre-generation');
			}}
				enterMapView={() => state.centerWorkspaceContext.setCenterView('map')}
				enterManualEditView={() => state.centerWorkspaceContext.setCenterView('manual-edit')}
				enterBuildingView={() => state.centerWorkspaceContext.setCenterView('building')}
				enterExportsView={() => state.centerWorkspaceContext.setCenterView('exports')}
				enterRunsView={() => state.centerWorkspaceContext.setCenterView('runs')}
				enterSetupView={() => state.centerWorkspaceContext.setCenterView('setup')}
				leaveDialogOpen={state.dialogContext.showLeavePreGenDialog}
			/>
			{state.loading && state.draft && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px] transition-all duration-150">
					<div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
						<RefreshCw className="size-8 animate-spin text-primary" />
						<div className="text-sm font-medium text-muted-foreground">Loading run data...</div>
					</div>
				</div>
			)}
			<div className={`h-0.5 shrink-0 bg-emerald-500 transition-opacity duration-150 ${state.showTopLoadingStrip ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
		{/* C01R D1 — persistent sub-nav on every /timetable* route (index included).
		    Links only: the nested children are element-less, so this never
		    remounts the workspace or refetches the grid. */}
		<TimetableSubNav />
			{state.inlineActionStatus ? (
				<div
					role="status"
					aria-live="polite"
					className={`border-b px-3 py-1 text-xs ${
						state.inlineActionStatus.tone === 'error'
							? 'border-destructive/40 bg-destructive/10 text-destructive'
							: state.inlineActionStatus.tone === 'warning'
								? 'border-amber-400/40 bg-amber-50 text-amber-700'
								: state.inlineActionStatus.tone === 'success'
									? 'border-emerald-400/40 bg-emerald-50 text-emerald-700'
									: 'border-border bg-muted/30 text-muted-foreground'
					}`}
				>
					{state.inlineActionStatus.message}
				</div>
			) : null}
			{/* B1 — universal inline preview-before-save. Never a modal: the grid
			    stays usable and exactly one Confirm commits the placement. */}
			{state.inlinePlacementPending ? (
				<InlinePlacementPreview
					pending={state.inlinePlacementPending.preview}
					roomId={state.inlinePlacementPending.roomId}
					roomOptions={state.inlinePlacementRoomOptions}
					saving={state.inlinePlacementSaving}
					roomChanging={state.inlinePlacementRoomChanging}
					onRoomChange={(value) => void state.changeInlinePlacementRoom(value)}
					onConfirm={() => void state.confirmInlinePlacement()}
					onCancel={state.cancelInlinePlacement}
				/>
			) : null}
			{state.lastAutoSaveUndo ? (
				<div
					role="status"
					aria-live="polite"
					data-testid="timetable-auto-save-undo-strip"
					className="border-b border-emerald-400/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
				>
					<div className="flex items-center justify-between gap-2">
						<p className="truncate">
							<span className="font-semibold">{state.lastAutoSaveUndo.subjectLabel}</span>
							{' '}saved to {state.lastAutoSaveUndo.day} {state.lastAutoSaveUndo.startTime}–{state.lastAutoSaveUndo.endTime}
							{state.lastAutoSaveUndo.roomLabel ? ` · ${state.lastAutoSaveUndo.roomLabel}` : ''}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-11 shrink-0 gap-1.5 text-sm"
							data-testid="timetable-auto-save-undo"
							onClick={async () => {
								// C11 — a pre-generation draft placement lives in the draft
								// ledger, so its Undo must revert that ledger; genuine run
								// manual edits keep the run manual-edits revert.
								const target = state.lastAutoSaveUndo!;
								const ok = await dispatchUndoByLedger(target, {
									revertRunEdit: state.revertEditById,
									revertDraftEdit: state.revertDraftEditById,
								});
								if (ok) {
									state.setLastAutoSaveUndo(null);
									state.setInlineActionStatus({ tone: 'success', message: 'Edit reverted.' });
								}
							}}
						>
							<Undo2 className="size-4" aria-hidden="true" />
							Undo
						</Button>
					</div>
				</div>
			) : null}
			{/* A-13 — Simple owns the single selected-class strip. Advanced keeps the
			    RightPanel selected-class surface, so the duplicate strip is collapsed
			    there instead of rendering two divergent flows. */}
			{showSchedulerChrome && state.selectedEntry && layoutMode === 'simple' ? (
				<div
					role="status"
					aria-live="polite"
					data-testid="timetable-selection-strip"
					className="pointer-events-auto fixed inset-x-3 bottom-3 z-40 mx-auto flex max-h-[112px] max-w-2xl flex-col items-stretch justify-between gap-2 overflow-hidden rounded-xl border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-3 [@media(max-height:500px)]:max-h-[72px] [@media(max-height:500px)]:py-1.5"
				>
					<div className="min-w-0 flex-1">
						<p className="truncate font-semibold text-foreground">
							Selected {state.subjectLabel(state.selectedEntry.subjectId)} - {state.sectionLabel(state.selectedEntry.sectionId)}
						</p>
						<p className="truncate text-muted-foreground [@media(max-height:500px)]:hidden">
							{state.entryContextLabel(state.selectedEntry)}. Choose another occupied slot to review a swap.
						</p>
					</div>
					<div className="flex shrink-0 items-center justify-end gap-2">
						<Button
							type="button"
							variant="default"
							size="sm"
							className="h-8 text-xs"
							data-testid="simple-selected-primary-action"
							aria-label={selectedPrimaryAction.label === 'Move' ? 'Move timeslot' : `${selectedPrimaryAction.label} selected class`}
							onClick={selectedPrimaryAction.onClick}
						>
							<SelectedPrimaryIcon className="mr-1.5 size-3.5" aria-hidden="true" />
							{selectedPrimaryAction.label}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="simple-selected-more-actions" aria-label="More actions for selected class">
									<MoreHorizontal className="size-3.5" aria-hidden="true" />
									<span className="hidden sm:inline">More</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-64">
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); startMoveSelectedEntry(); }}>
									<Move className="mr-2 size-3.5" aria-hidden="true" />
									Move time
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); openSelectedChangeRoom(); }} data-testid="timetable-simple-selected-change-room-action">
									<DoorOpen className="mr-2 size-3.5" aria-hidden="true" />
									Change room
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); armSwapSessions(); }} data-testid="timetable-simple-selected-swap-action">
									<ArrowRightLeft className="mr-2 size-3.5" aria-hidden="true" />
									Swap sessions
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); openSimpleSelectedDetails(); }} data-testid="timetable-simple-selected-details-action">
									<BookOpen className="mr-2 size-3.5" aria-hidden="true" />
									View class details
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); openSelectedOwnerRepair(); }} data-testid="timetable-simple-selected-owner-repair-action">
									<GraduationCap className="mr-2 size-3.5" aria-hidden="true" />
									<span className="flex flex-col">
										<span>Change Teaching Load owner</span>
										<span className="text-xs text-muted-foreground">Opens Teaching Load for this subject, section, and teacher</span>
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); openTeacherDepartureRecovery(state.selectedEntry?.facultyId ?? null); }} data-testid="teacher-departure-selected-action">
									<UserRoundX className="mr-2 size-3.5" aria-hidden="true" />
									<span className="flex flex-col">
										<span>Teacher leaving (all classes)</span>
										<span className="text-xs text-muted-foreground">Bulk repair for every class this teacher handles</span>
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => {
									event.preventDefault();
									setLayoutMode('advanced');
									window.requestAnimationFrame(() => state.rightPanelContext?.rightPanelRef?.current?.expand());
								}}>
									<GraduationCap className="mr-2 size-3.5" aria-hidden="true" />
									Expert details
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			) : null}
			<DndContext sensors={state.sensors} collisionDetection={pointerWithin} onDragStart={state.handleGlobalDragStart} onDragMove={state.handleGlobalDragMove} onDragOver={state.handleGlobalDragOver} onDragEnd={state.handleGlobalDragEnd} onDragCancel={state.handleGlobalDragCancel}>
				{showSchedulerChrome ? (layoutMode === 'simple' ? (
					<TimetableSimpleHeader
						context={state.headerContext}
						layoutMode={layoutMode}
						onLayoutModeChange={setLayoutMode}
						activeTask={activeSimpleTask}
						onTaskChange={setActiveSimpleTask}
						onOpenTeacherDeparture={() => openTeacherDepartureRecovery()}
						onSetRepairOrigin={setRepairOrigin}
						readinessSheetOpen={readinessSheetOpen}
						onReadinessSheetOpenChange={setReadinessSheetOpen}
						swapClassTimesMode={state.swapClassTimesMode}
						onSwapClassTimesStart={() => {
							state.setSwapClassTimesMode('select-first');
							state.setSwapClassAEntryId(null);
							state.setSwapClassBEntryId(null);
						}}
						onSwapClassTimesCancel={() => {
							state.setSwapClassTimesMode(null);
							state.setSwapClassAEntryId(null);
							state.setSwapClassBEntryId(null);
						}}
					/>
				) : (
					<div className="relative shrink-0">
						<ScheduleReviewWorkspaceHeader context={state.headerContext} />
						{/* R4 — Advanced gets the same visible Undo / Redo / History control as Simple. */}
						<div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								className="h-11 border border-border bg-background/95 px-3 text-xs shadow-sm"
								onClick={() => setLayoutMode('simple')}
								data-testid="timetable-layout-toggle"
								aria-label="Switch to simple timetable view"
							>
								Simple view
							</Button>
							<div className="rounded-lg border border-border bg-background/95 px-1.5 py-1 shadow-sm">
								<TimetableUndoRedoControl
									editHistoryCount={state.headerContext.editHistoryCount}
									revertLoading={state.headerContext.revertLoading}
									revertLastEdit={state.headerContext.revertLastEdit}
									redoState={state.redoState ?? null}
									redoVersionStale={state.redoVersionStale ?? false}
									redoLastEdit={async () => { await state.redoLastEdit?.(); }}
									clearRedo={() => state.clearRedo?.()}
									setShowEditHistory={state.headerContext.setShowEditHistory}
								/>
							</div>
						</div>
					</div>
				)) : null}
				<ScheduleReviewWorkspaceBody
					layoutMode={layoutMode}
					activeSimpleTask={activeSimpleTask}
					onSimpleTaskChange={setActiveSimpleTask}
					teacherDepartureEntryIds={teacherDepartureEntryIds}
					onReassignTeacher={openTeacherDepartureForEntry}
					repairOrigin={repairOrigin}
					onBackToBlockerSummary={() => {
						setRepairOrigin(null);
						setActiveSimpleTask(null);
						setReadinessSheetOpen(true);
					}}
					onSetupSetRepairOrigin={setRepairOrigin}
					context={{
						leftPanelRef: state.leftPanelRef,
						setIsLeftCollapsed: state.setIsLeftCollapsed,
						isLeftCollapsed: state.isLeftCollapsed,
						isDesktop: state.isDesktop,
						isPreGenerationWorkspace: state.isPreGenerationWorkspace,
						leftTab: state.leftTab,
						setLeftTab: state.setLeftTab,
						violations: state.violations,
						hardCount: state.headerContext.hardCount,
						blockingHardCount: state.headerContext.blockingHardCount,
						softCount: state.headerContext.softCount,
						violationScopeLabel: typeof state.headerContext.termFilter === 'number'
							? (state.headerContext.termOptions?.find((option) => String(option.value) === String(state.headerContext.termFilter))?.label
								?? `Term ${state.headerContext.termFilter}`)
							: 'All terms',
						summary: state.summary,
						roomRequestSummary: state.roomRequestSummary,
					openPublishDialog: () => {
						state.headerContext.setPublishAcknowledged(false);
						state.headerContext.setShowPublishDialog(true);
					},
					activeGeneratedRunId: state.headerContext.activeGeneratedRunId,
					sectionLabel: state.centerWorkspaceContext.sectionLabel,
					subjectLabel: state.centerWorkspaceContext.subjectLabel,
					facultyLabel: state.centerWorkspaceContext.facultyLabel,
						leftRailContentContext: state.leftRailContentContext,
						centerWorkspaceContext: state.centerWorkspaceContext,
						rightPanelContext: state.rightPanelContext,
					}}
				/>
				<DragOverlay dropAnimation={null}>
					<TimetableDragOverlay subjectLabel={state.subjectLabel} sectionLabel={state.sectionLabel} />
				</DragOverlay>
			</DndContext>
			{teacherDepartureOpen ? (
				<Suspense fallback={null}>
					<TeacherDepartureRecoverySheet
						open={teacherDepartureOpen}
						onOpenChange={setTeacherDepartureOpen}
						initialFacultyId={teacherDepartureFacultyId}
						draft={state.draft}
						facultyMap={state.facultyMap}
						subjectLabel={state.subjectLabel}
						sectionLabel={state.sectionLabel}
						facultyLabel={state.headerContext ? state.centerWorkspaceContext.facultyLabel : () => 'Teacher'}
						previewTeachingLoadRepair={state.previewTeachingLoadRepair}
						commitTeachingLoadRepair={state.commitTeachingLoadRepair}
						onSaved={state.handleRefresh}
						isPublished={isDraftPublished}
						schoolId={state.headerContext.schoolId}
						schoolYearId={state.centerWorkspaceContext.schoolYearId}
						runId={state.draft?.runId ?? null}
						onHighlightEntries={setTeacherDepartureFocusedEntryIds}
						onJumpToEntry={jumpToTeacherDepartureEntry}
					/>
				</Suspense>
			) : null}
			<Sheet open={simpleDetailsOpen && layoutMode === 'simple' && !!state.selectedEntry} onOpenChange={setSimpleDetailsOpen}>
				<SheetContent side="bottom" className="max-h-[86svh] rounded-t-2xl p-4" data-testid="timetable-simple-details-sheet">
			{state.redoState || state.redoVersionStale ? (
				<div
					role="status"
					aria-live="polite"
					data-testid="timetable-redo-strip"
					className={`border-b px-3 py-2 text-sm ${state.redoVersionStale ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-sky-400/40 bg-sky-50 text-sky-900'}`}
				>
					<div className="flex items-center justify-between gap-2">
						{state.redoVersionStale ? (
							<p className="truncate">Version-stale — the schedule changed. Refresh and re-preview before redoing. Nothing was changed.</p>
						) : (
							<p className="truncate">Undo applied. Redo re-applies the same server edit with a fresh version check.</p>
						)}
						{!state.redoVersionStale && state.redoState ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-11 shrink-0 gap-1.5 text-sm"
								data-testid="timetable-redo"
								disabled={state.revertLoading}
								onClick={() => { void state.redoLastEdit?.(); }}
							>
								<Redo2 className="size-4" aria-hidden="true" />
								Redo
							</Button>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-11 shrink-0 text-sm"
							data-testid="timetable-redo-dismiss"
							onClick={() => state.clearRedo?.()}
						>
							Dismiss
						</Button>
					</div>
				</div>
			) : null}
			{state.selectedEntry ? (
						<div className="flex max-h-[78svh] flex-col gap-3">
							<SheetHeader>
								<SheetTitle className="text-base">
									{state.subjectLabel(state.selectedEntry.subjectId)}
								</SheetTitle>
								<SheetDescription>
									Simple class summary. Use More actions for repairs.
								</SheetDescription>
							</SheetHeader>
							<div className="grid gap-2 text-sm sm:grid-cols-2">
								<div className="rounded-xl border border-border bg-muted/20 p-3" data-testid="simple-details-summary-card">
									<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
										<BookOpen className="size-3.5" aria-hidden="true" />
										Class
									</p>
									<p className="mt-1 font-semibold text-foreground">{state.sectionLabel(state.selectedEntry.sectionId)}</p>
								</div>
								<div className="rounded-xl border border-border bg-muted/20 p-3" data-testid="simple-details-summary-card">
									<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
										<UserRoundX className="size-3.5" aria-hidden="true" />
										Teacher
									</p>
									<p className="mt-1 font-semibold text-foreground">
										{state.selectedEntry.facultyId ? state.centerWorkspaceContext.facultyLabel(state.selectedEntry.facultyId) : 'No teacher assigned'}
									</p>
								</div>
								<div className="rounded-xl border border-border bg-muted/20 p-3" data-testid="simple-details-summary-card">
									<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
										<DoorOpen className="size-3.5" aria-hidden="true" />
										Room
									</p>
									<p className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
										{state.selectedEntry.roomId ? state.centerWorkspaceContext.roomLabelShort(state.selectedEntry.roomId) : 'No room assigned'}
									</p>
								</div>
								<div className="rounded-xl border border-border bg-muted/20 p-3" data-testid="simple-details-summary-card">
									<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
										<Clock className="size-3.5" aria-hidden="true" />
										Time
									</p>
									<p className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
										{state.headerContext.VIEW_MODE_LABELS[state.headerContext.viewMode]} view · {state.entryContextLabel(state.selectedEntry)}
									</p>
								</div>
							</div>
							<div className="rounded-xl border border-border bg-background p-3" data-testid="simple-details-summary-card">
								<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Actions</p>
								<div className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
									<span className="rounded-lg bg-muted px-2 py-1">Move time: choose a new slot</span>
									<span className="rounded-lg bg-muted px-2 py-1">Change room: pick another room</span>
									<span className="rounded-lg bg-muted px-2 py-1">Swap sessions: choose another class</span>
									<span className="rounded-lg bg-muted px-2 py-1">Owner repair: opens Teaching Load</span>
								</div>
							</div>
							<SheetFooter className="gap-2 sm:gap-0">
								<Button type="button" variant="outline" onClick={() => setSimpleDetailsOpen(false)}>Close</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setSimpleDetailsOpen(false);
										openSelectedChangeRoom();
									}}
									data-testid="timetable-simple-details-change-room"
								>
									<DoorOpen className="mr-1.5 size-3.5" aria-hidden="true" />
									Change room
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setSimpleDetailsOpen(false);
										openSelectedOwnerRepair();
									}}
									data-testid="timetable-simple-details-owner-repair"
								>
									<GraduationCap className="mr-1.5 size-3.5" aria-hidden="true" />
									Change owner
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setSimpleDetailsOpen(false);
										armSwapSessions();
									}}
									data-testid="timetable-simple-details-swap"
								>
									<ArrowRightLeft className="mr-1.5 size-3.5" aria-hidden="true" />
									Swap
								</Button>
								<Button
									type="button"
									onClick={() => {
										setSimpleDetailsOpen(false);
										setLayoutMode('advanced');
										window.requestAnimationFrame(() => state.rightPanelContext?.rightPanelRef?.current?.expand());
									}}
								>
									<GraduationCap className="mr-1.5 size-3.5" aria-hidden="true" />
									Expert details
								</Button>
							</SheetFooter>
						</div>
					) : null}
				</SheetContent>
			</Sheet>
			<TimetableFacultyIssuePivotDialog
				open={state.pendingFacultyIssuePivot != null}
				teacherLabel={state.pendingFacultyIssuePivot?.teacherLabel ?? null}
				onOpenChange={(open) => { if (!open) state.setPendingFacultyIssuePivot(null); }}
				onCancel={() => state.setPendingFacultyIssuePivot(null)}
				onConfirm={state.confirmFacultyIssuePivot}
			/>
			<ScheduleReviewWorkspaceOverlays context={state.overlaysContext} />
		</div>
	);
}
