import { DndContext, DragOverlay, pointerWithin, useDndContext } from '@dnd-kit/core';
import { useScheduleReviewWorkspaceState } from '@/hooks/useScheduleReviewWorkspaceState';
import { ScheduleReviewWorkspaceHeader } from '@/components/timetable/ScheduleReviewWorkspaceHeader';
import { TimetableSimpleHeader } from '@/components/timetable/TimetableSimpleHeader';
import { ScheduleReviewWorkspaceBody } from '@/components/timetable/ScheduleReviewWorkspaceBody';
import { ScheduleReviewWorkspaceOverlays } from '@/components/timetable/ScheduleReviewWorkspaceOverlays';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import { Button } from '@/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { AlertCircle, ArrowRightLeft, BookOpen, Clock, DoorOpen, GraduationCap, MoreHorizontal, Move, RefreshCw, Undo2, UserRoundX } from 'lucide-react';
import { lazy, Profiler, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ScheduledEntry } from '@/types';

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
			<p className="mt-0.5 text-[0.68rem] text-muted-foreground">Release on a highlighted cell to review move or swap.</p>
		</div>
	);
}

export default function ScheduleReviewWorkspace() {
	const state = useScheduleReviewWorkspaceState();
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

	const isDraftPublished = useMemo(() => {
		const summary = state.draft?.summary;
		if (!summary || typeof summary !== 'object') return false;
		const candidate = summary as Record<string, unknown>;
		if (candidate.isPublished === true) return true;
		if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0) return true;
		return typeof candidate.publishedBy === 'number';
	}, [state.draft?.summary]);

	if (state.loading && !state.draft) {
		return <TimetableSkeleton />;
	}

	if (state.error) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)] items-center justify-center gap-4">
				<div className="flex items-center gap-2 text-destructive">
					<AlertCircle className="size-5" />
					<span className="text-sm font-medium">{state.error}</span>
				</div>
				<Button variant="outline" size="sm" onClick={() => state.loadAll()}>
					<RefreshCw className="size-3.5 mr-1.5" />
					Retry
				</Button>
			</div>
		);
	}
	if (!state.headerContext || !state.leftRailContentContext || !state.centerWorkspaceContext || !state.rightPanelContext || !state.overlaysContext) {
		return <TimetableSkeleton />;
	}

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

	const selectedPrimaryAction = activeSimpleTask === 'swap-sessions'
		? {
			label: 'Swap',
			icon: ArrowRightLeft,
			onClick: () => setActiveSimpleTask('swap-sessions'),
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
		<div className="flex flex-col h-[calc(100svh-3.5rem)] relative">
			{state.loading && state.draft && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px] transition-all duration-150">
					<div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
						<RefreshCw className="size-8 animate-spin text-primary" />
						<div className="text-sm font-medium text-muted-foreground">Loading run data...</div>
					</div>
				</div>
			)}
			<div className={`h-0.5 shrink-0 bg-emerald-500 transition-opacity duration-150 ${state.showTopLoadingStrip ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
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
								const ok = await state.revertEditById(state.lastAutoSaveUndo!.editId, state.lastAutoSaveUndo!.newVersion);
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
			{state.selectedEntry ? (
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
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); openTeacherDepartureRecovery(state.selectedEntry?.facultyId ?? null); }} data-testid="teacher-departure-selected-action">
									<UserRoundX className="mr-2 size-3.5" aria-hidden="true" />
									Change teacher
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); startMoveSelectedEntry(); }}>
									<Move className="mr-2 size-3.5" aria-hidden="true" />
									Move
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); setActiveSimpleTask('swap-sessions'); }} data-testid="timetable-simple-selected-swap-action">
									<ArrowRightLeft className="mr-2 size-3.5" aria-hidden="true" />
									Swap
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => { event.preventDefault(); openSimpleSelectedDetails(); }} data-testid="timetable-simple-selected-details-action">
									<BookOpen className="mr-2 size-3.5" aria-hidden="true" />
									Details
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={(event) => {
									event.preventDefault();
									setLayoutMode('advanced');
									window.requestAnimationFrame(() => state.rightPanelContext?.rightPanelRef?.current?.expand());
								}}>
									<GraduationCap className="mr-2 size-3.5" aria-hidden="true" />
									Advanced details
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			) : null}
			<DndContext sensors={state.sensors} collisionDetection={pointerWithin} onDragStart={state.handleGlobalDragStart} onDragMove={state.handleGlobalDragMove} onDragOver={state.handleGlobalDragOver} onDragEnd={state.handleGlobalDragEnd} onDragCancel={state.handleGlobalDragCancel}>
				{layoutMode === 'simple' ? (
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
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="absolute right-3 top-3 z-20 h-11 border border-border bg-background/95 px-3 text-xs shadow-sm"
							onClick={() => setLayoutMode('simple')}
							data-testid="timetable-layout-toggle"
							aria-label="Switch to simple timetable view"
						>
							Simple view
						</Button>
					</div>
				)}
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
						softCount: state.headerContext.softCount,
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
						schoolId={1}
						schoolYearId={state.centerWorkspaceContext.schoolYearId}
						runId={state.draft?.runId ?? null}
						onHighlightEntries={setTeacherDepartureFocusedEntryIds}
						onJumpToEntry={jumpToTeacherDepartureEntry}
					/>
				</Suspense>
			) : null}
			<Sheet open={simpleDetailsOpen && layoutMode === 'simple' && !!state.selectedEntry} onOpenChange={setSimpleDetailsOpen}>
				<SheetContent side="bottom" className="max-h-[86svh] rounded-t-2xl p-4" data-testid="timetable-simple-details-sheet">
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
								<div className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-3">
									<span className="rounded-lg bg-muted px-2 py-1">Move: choose new slot</span>
									<span className="rounded-lg bg-muted px-2 py-1">Swap: choose another class</span>
									<span className="rounded-lg bg-muted px-2 py-1">Reassign: use Teaching Load</span>
								</div>
							</div>
							<SheetFooter className="gap-2 sm:gap-0">
								<Button type="button" variant="outline" onClick={() => setSimpleDetailsOpen(false)}>Close</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setSimpleDetailsOpen(false);
										openTeacherDepartureRecovery(state.selectedEntry?.facultyId ?? null);
									}}
								>
									<UserRoundX className="mr-1.5 size-3.5" aria-hidden="true" />
									Reassign teacher
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setSimpleDetailsOpen(false);
										setActiveSimpleTask('swap-sessions');
									}}
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
									Advanced details
								</Button>
							</SheetFooter>
						</div>
					) : null}
				</SheetContent>
			</Sheet>
			<ScheduleReviewWorkspaceOverlays context={state.overlaysContext} />
		</div>
	);
}
