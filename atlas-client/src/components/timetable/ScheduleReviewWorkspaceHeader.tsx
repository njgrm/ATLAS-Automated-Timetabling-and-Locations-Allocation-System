import { memo, Profiler, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowRightLeft, CalendarClock, CircleCheck, CircleDashed, ClipboardCheck, ClipboardList, Crosshair, GraduationCap, History, Hourglass, Lightbulb, ListChecks, Loader2, MoreHorizontal, PencilLine, Play, RefreshCw, RotateCw, SearchCheck, Send, Settings2, Undo2, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import type { RolloverStatus } from '@/lib/settings';
import { MUST_FIX_LABEL, runAnchorLabel, runStateBadgeLabel, runStateSentence } from '@/lib/timetable-plain-language';
import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { QuickPlaceSummaryModal } from '@/components/timetable/QuickPlaceSummaryModal';
import {
	SetupImpactDialog,
	SyncTimetableConfirmDialog,
} from '@/components/timetable/ScheduleReviewWorkspaceDialogs';
import { FilterChip } from '@/components/timetable/TimetableShared';
import { ScheduleReviewWorkspaceSummaryStats } from '@/components/timetable/ScheduleReviewWorkspaceSummaryStats';
import {
	ScheduleReviewWorkspaceTaskModes,
	type TimetableTaskMode,
} from '@/components/timetable/ScheduleReviewWorkspaceTaskModes';
import { TimetableToolbar } from '@/components/timetable/TimetableToolbar';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { EntryKindFilter, ProgramFilter } from '@/lib/schedule-review-helpers';
import { onProfilerRender } from '@/components/timetable/ScheduleReviewWorkspace';
import { isDraftPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
// A2-C6-TRUTH (T3a): the run identity, shared with Simple view.
import { describeRunState, RunStateBadge } from '@/components/timetable/RunStateBadge';
import { resolveExpertPublishGate, TimetableExpertPublishControl } from '@/components/timetable/TimetableExpertPublishControl';
import { resolveDraftStripPublishPlan } from '@/components/timetable/TimetableDraftStateStrip';
import { SimpleHeaderOrientationRow } from '@/components/timetable/simple/SimpleHeaderStatusStrip';
import { useRunChangeNotice } from '@/components/timetable/simple/SimpleHeaderChangeNoticeSlot';
import { ExpertGenerationControl } from '@/components/timetable/ExpertGenerationControl';
import { TimetableExpertDraftActions } from '@/components/timetable/TimetableDraftActionsSurface';
import { ScheduleReviewInputStateBanner } from '@/components/timetable/ScheduleReviewInputStateBanner';
import { TimetableAdvancedHeaderHelp } from '@/components/timetable/TimetableAdvancedHeaderHelp';
import { deriveTimetableCapabilities, YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness } from '@/lib/timetable-generation-readiness';
import { createSyncSetupInFlightGuard, runSyncSetup } from '@/lib/timetable-sync-setup';
import { resolveTermAuthorityNotice } from '@/hooks/useTimetableData';
import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';

type ScheduleReviewWorkspaceHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	/** C11 D — the workspace's existing manual-edit entry for the selected class. */
	onEditDraft?: () => void;
	/** C11 D — the workspace's EXISTING reset-draft confirmation. */
	onDiscardDraft?: () => void;
	/**
	 * C11 F2 — the ONE existing `TimetableUndoRedoControl` instance, handed to the
	 * strip exactly as the Simple header receives it. The first cut removed the
	 * Expert-only Undo toolbar but rendered this strip with no child, so `advanced`
	 * had NO Undo; one instance through BOTH strips keeps one Undo with one
	 * accessible name (A2-TIMETABLE-CUSTODY single-surface).
	 */
	undoRedoControl?: React.ReactNode;
};

function formatTaskCount(count: number, label: string): string {
	if (count > 99) return `99+ ${label}`;
	return `${count} ${label}`;
}

const INPUT_DOMAIN_LABELS: Record<string, string> = {
	teachingLoad: 'Teaching Load',
	policy: 'Policy',
	rooms: 'Rooms',
	sections: 'Sections',
	subjects: 'Subjects',
};

function formatChangedDomains(domains: string[] | undefined): string[] {
	if (!domains || domains.length === 0) return ['Comparison details are unavailable'];
	return domains.map((domain) => INPUT_DOMAIN_LABELS[domain] ?? domain);
}

/* A2-UX-STATUS-C2 / U1 + U5, CLOSED at the integration boundary (2026-09-28).
 *
 * This file previously defined its OWN `runStateLine` because the lib's
 * `runStateSentence` was built around the `Run <n> ·` prefix U1 removes, and the
 * executor correctly reported the duplication as a DEPENDENCY rather than
 * silently forking the string. Two definitions of one operator-visible line is
 * the exact hazard §16 names, so the local copy is gone and the header consumes
 * the single exported source: the pre-generation branch now reads
 * "No schedule made yet." (U5) instead of "Planning draft - no generated run
 * yet", which had survived here while the lib was already fixed.
 *
 * `null` still means "nothing to name" and the cell is still omitted, so the
 * empty state prints no placeholder (asserted by `timetable-run-identity-a2`).
 */

/**
 * A2-UX-STATUS-C2 / U2 + #51 — one icon, one tone and one sign token per state.
 *
 * The pre-candidate badge had exactly two appearances, chosen by
 * `isPreGenerationWorkspace` — a LAYOUT/surface flag. That is why Draft and
 * Published were indistinguishable, and it is #51 in a different costume: the
 * run's real publication state never reached the styling.
 *
 * Three channels, so colour is never load-bearing on its own: the icon shape (a
 * settling check vs an in-progress stroke), the tone, and the label that
 * `runStateBadgeLabel` already reads from the run. The key is derived from the
 * RUN (`draft.runId` + `isDraftPublishedStrict`), never from the layout mode.
 *
 * A2-C6-TRUTH (T3a) then moved the presentation map, the state key and BOTH
 * renderers into `RunStateBadge`, because Simple view is the DEFAULT view and it
 * was printing no run identity at all while Expert printed it here. Two headers
 * rendering one run's identity from one derivation is the only way "which
 * schedule is this" cannot differ between the two views of the same run — which is
 * why the block below is a note on that shared renderer, not a second badge.
 */
function ScheduleReviewWorkspaceHeaderImpl({ context, onEditDraft, onDiscardDraft, undoRedoControl }: ScheduleReviewWorkspaceHeaderProps) {
	const [showImpactPreview, setShowImpactPreview] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [showSyncConfirm, setShowSyncConfirm] = useState(false);
	const [showQuickPlaceConfirm, setShowQuickPlaceConfirm] = useState(false);
	const [quickPlacePlaced, setQuickPlacePlaced] = useState<any[]>([]);
	const [quickPlaceUnplaced, setQuickPlaceUnplaced] = useState<any[]>([]);
	const [quickPlaceLoading, setQuickPlaceLoading] = useState(false);
	const [syncResult, setSyncResult] = useState<any | null>(null);
	const [showPostSyncOffer, setShowPostSyncOffer] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const [rolloverStatus, setRolloverStatus] = useState<RolloverStatus | null>(null);
	const syncGuardRef = useRef(createSyncSetupInFlightGuard());

	const {
		isPreGenerationWorkspace,
		activeGeneratedRunId,
		leftTab,
		leftPanelRef,
		presentationMode,
		setPresentationMode,
		selectedRunId,
		handleRunChange,
		runs,
		schoolId,
		centerView,
		newDraftLoading,
		schoolYearId,
		handleStartNewPreGenerationDraft,
		draftPlacementCount,
		openPreGenerationWorkspace,
		returnToGeneratedRun,
		generating,
		loading,
		handleTriggerGenerate,
		draft,
		hardCount,
		blockingHardCount,
		setPublishAcknowledged,
		setShowPublishDialog,
		exitPolicyView,
		switchCenterViewWithGuard,
		enterPolicyView,
		openMapWorkspace,
		handleRefresh,
		editHistoryCount,
		// A2-C6-TRUTH (T1b): a count earned by a completed read, not a cleared one.
		editHistoryReadState,
		setShowEditHistory,
		tutorial,
		summary,
		requestPendingCount,
		statusColor,
		formatDuration,
		formatTimestamp,
		VIEW_MODE_LABELS,
		viewMode,
		setViewMode,
		setEntityFilter,
		hasSelectedEntry,
		setSelectedEntry,
		setSelectedViolation,
		setPreGenKbSource,
		setKbSelectedSource,
		entityFilter,
		groupedPivotEntities,
		pivotLabel,
		programFilter,
		setProgramFilter,
		PROGRAM_FILTER_OPTIONS,
		entryKindFilter,
		setEntryKindFilter,
		ENTRY_KIND_FILTER_OPTIONS,
		termFilter,
		onTermFilterChange,
		termOptions,
		activeTermIndex,
		violations,
		severityFilter,
		setSeverityFilter,
		setLeftTab,
		softCount,
		WELLBEING_CODES,
		CONFLICT_CODES,
	} = context;

	const handleSyncSetup = async () => {
		if (!schoolYearId || activeGeneratedRunId == null) return;
		setSyncing(true);
		try {
			const outcome = await runSyncSetup({
				schoolId,
				schoolYearId,
				runId: activeGeneratedRunId,
				draftVersion: draft?.version,
				guard: syncGuardRef.current,
			});
			if (outcome.status === 'COMMITTED') {
				const data = outcome.data;
				setSyncResult(data);
				if ((data.displacedEntriesCount ?? 0) > 0 || (data.addedUnassignedCount ?? 0) > 0) {
					setShowPostSyncOffer(true);
				} else {
					const retainedReviewedCount = data.retainedFacultyPinCount ?? 0;
					const retainedCopy = retainedReviewedCount > 0
						? `, retained ${retainedReviewedCount} reviewed teacher assignment(s)`
						: '';
					toast.success(
						`Timetable synced successfully: updated ${data.updatedFacultyCount ?? 0} teacher assignments, ` +
						`displaced ${data.displacedEntriesCount ?? 0} entries, added ${data.addedUnassignedCount ?? 0} unassigned sessions` +
						`${retainedCopy}.`
					);
				}
				handleRefresh();
			} else if (outcome.status === 'REPLAYED') {
				toast.success(`${CLASS_SCHEDULE_LABEL} setup already matches the current run. Nothing to change.`);
				handleRefresh();
			} else if (outcome.status === 'FAILED') {
				toast.error(outcome.error.message);
			}
			// SKIPPED_IN_FLIGHT: a sync is already running; do nothing.
		} finally {
			setSyncing(false);
			setShowSyncConfirm(false);
		}
	};

	const handleTriggerQuickPlacePreview = async () => {
		if (!schoolYearId || activeGeneratedRunId == null) return;
		setQuickPlaceLoading(true);
		setShowPostSyncOffer(false);
		try {
			const { data } = await atlasApi.post(
				`/generation/${schoolId}/${schoolYearId}/runs/${activeGeneratedRunId}/quick-place/preview`
			);
			setQuickPlacePlaced(data.placed);
			setQuickPlaceUnplaced(data.unplaced);
			setShowQuickPlaceConfirm(true);
		} catch (err: any) {
			toast.error(err.response?.data?.message || err.message || 'Quick place preview failed.');
		} finally {
			setQuickPlaceLoading(false);
		}
	};

	const handleCommitQuickPlace = async () => {
		if (!schoolYearId || activeGeneratedRunId == null || !draft) return;
		setQuickPlaceLoading(true);
		try {
			const { data } = await atlasApi.post(
				`/generation/${schoolId}/${schoolYearId}/runs/${activeGeneratedRunId}/quick-place/apply`,
				{ expectedRunVersion: draft.version }
			);
			toast.success(`Successfully placed ${data.placedCount} sessions!`);
			setShowQuickPlaceConfirm(false);
			handleRefresh();
		} catch (err: any) {
			toast.error(err.response?.data?.message || err.message || 'Failed to apply quick placements.');
		} finally {
			setQuickPlaceLoading(false);
		}
	};
	const inputState = draft?.inputState;
	const showInputStateBanner = Boolean(inputState && inputState.status !== 'FRESH' && !isPreGenerationWorkspace);
	const changedDomainLabels = formatChangedDomains(inputState?.changedDomains);
	const runOptions = runs ?? [];
	const visibleViolations = violations ?? [];
	const unassignedCount = summary?.unassignedCount ?? 0;
	const generationBlockedByDrift = rolloverStatus?.drift.status === 'atlas-stale' || rolloverStatus?.drift.status === 'mapping-conflict';

	// R1: Advanced consumes the exact same generation decision as Simple. No
	// separate readiness boolean may gate a generation trigger.
	const scopeResolved = Number.isInteger(schoolId) && schoolId > 0
		&& Number.isInteger(schoolYearId) && (schoolYearId ?? 0) > 0;
	const isRunPublished = isDraftPublishedStrict(draft);

	/**
	 * C11 D — the ONE publication gate for this header, shared with the draft strip's
	 * Publish control. Derived from the same fields the previous inline `disabled`
	 * expression and tooltip ternary read, so no clause was dropped or reordered.
	 */
	const expertPublishGate = resolveExpertPublishGate({
		hasDraft: draft != null,
		isRunPublished,
		blockingHardCount,
		unassignedCount,
		isPreGenerationView: centerView === 'pre-generation',
	});
	const latestRunFailed = !draft && runOptions[0]?.status === 'FAILED';
	const capabilities = deriveTimetableCapabilities({
		scopeResolved,
		curriculumState: context.curriculumReadiness?.state ?? 'unavailable',
		generating,
		isPreGeneration: isPreGenerationWorkspace,
		hasGeneratedRun: Boolean(draft),
		isPublished: isRunPublished,
		latestRunFailed,
		// F2 — the publication gate uses the allowlist-filtered blocking count.
		hardCount: blockingHardCount,
		unassignedCount,
		softCount,
		hasSelectedEntry,
		requestPendingCount,
		driftBlocked: generationBlockedByDrift,
		driftMessage: rolloverStatus?.drift.message ?? null,
		generationDiagnostic: summarizeGenerationReadiness(context.curriculumReadiness),
		readinessRepair: context.curriculumReadiness?.state === 'blocked' ? context.curriculumReadiness.repair : null,
	});
	const generationGate = capabilities.generation;
	const generationRepairHref = generationGate.repair.kind === 'navigate' ? generationGate.repair.href : null;
	const generationRepairLabel = generationGate.repair.label ?? 'Fix setup';
	const handleGenerationTrigger = () => {
		if (generationGate.enabled) {
			handleTriggerGenerate();
			return;
		}
		if (generationGate.repair.kind === 'retry') {
			handleRefresh();
		}
	};
	const expandLeftPanelForTask = () => {
		leftPanelRef.current?.expand();
		if (typeof window !== 'undefined' && window.innerWidth < 1024) {
			leftPanelRef.current?.resize(72);
		}
	};
	const openLeftTask = (tab: 'violations' | 'unassigned' | 'requests') => {
		expandLeftPanelForTask();
		setLeftTab(tab);
		setPresentationMode('workflow');
	};
	const openDraftPlannerTask = async () => {
		await handleStartNewPreGenerationDraft();
		setLeftTab('unassigned');
		expandLeftPanelForTask();
		setPresentationMode('workflow');
	};
	const taskModes: TimetableTaskMode[] = [
		{
			id: 'review',
			label: 'Review schedule',
			helper: hardCount > 0 ? `Start with the “${MUST_FIX_LABEL}” problems before publishing.` : 'Check the generated timetable and publish when clean.',
			icon: ListChecks,
			active: !isPreGenerationWorkspace && leftTab === 'violations' && !hasSelectedEntry,
			onClick: () => {
				openLeftTask('violations');
			},
			badge: hardCount > 0 ? formatTaskCount(hardCount, 'blocked') : undefined,
		},
		{
			id: 'place',
			label: 'Place unassigned',
			helper: 'Open the queue, choose a session, then choose where it should go.',
			icon: ClipboardCheck,
			active: !isPreGenerationWorkspace && leftTab === 'unassigned',
			onClick: () => {
				openLeftTask('unassigned');
			},
			badge: unassignedCount > 0 ? formatTaskCount(unassignedCount, 'to place') : undefined,
		},
		{
			id: 'switch',
			label: 'Switch sessions',
			helper: hasSelectedEntry ? 'Choose another occupied slot to review the switch.' : 'Select one class on the grid, then choose another class to switch with it.',
			icon: ArrowRightLeft,
			active: !isPreGenerationWorkspace && hasSelectedEntry,
			onClick: () => {
				openLeftTask('violations');
			},
		},
		{
			id: 'plan',
			label: isPreGenerationWorkspace ? 'Planning draft' : 'Draft planner',
			helper: isPreGenerationWorkspace ? 'Use the draft queue and grid before generating a new run.' : 'Open the pre-generation draft queue and place sessions before generating.',
			icon: CalendarClock,
			active: isPreGenerationWorkspace,
			disabled: newDraftLoading || !schoolYearId,
			onClick: () => {
				void openDraftPlannerTask();
			},
			badge: draftPlacementCount > 0 ? formatTaskCount(draftPlacementCount, 'draft') : undefined,
		},
		{
			id: 'requests',
			label: 'Review room requests',
			helper: 'Open teacher room requests and approve, deny, or preview them.',
			icon: ClipboardList,
			active: leftTab === 'requests',
			onClick: () => {
				openLeftTask('requests');
			},
			badge: requestPendingCount > 0 ? formatTaskCount(requestPendingCount, 'request') : undefined,
		},
	];
	const activeTask = taskModes.find((task) => task.active)
		?? (unassignedCount > 0 ? taskModes[1] : requestPendingCount > 0 ? taskModes[4] : taskModes[0]);
	const ActiveTaskIcon = activeTask.icon;
	const sourceContext = context.schoolYearContext;
	const activeTermContext = sourceContext?.activeTerm ?? null;
	const verifiedOrderedTerm = activeTermContext?.verified === true
		&& activeTermContext.termIndex != null
		&& Boolean(activeTermContext.orderedTerms?.some((term) => term.order === activeTermContext.termIndex));
	const activeTermLabel = verifiedOrderedTerm
		? (activeTermContext?.orderedTerms?.find((term) => term.order === activeTermContext.termIndex)?.displayLabel ?? `Term ${activeTermContext?.termIndex}`)
		: null;
	const latestRunCandidate = runOptions[0] ?? null;
	const newerFailedRunNotice = selectedRunId === 'latest'
		&& draft?.runId != null
		&& latestRunCandidate?.id != null
		&& latestRunCandidate.id !== draft.runId
		&& latestRunCandidate.status !== 'COMPLETED'
			? `Grid uses completed run #${draft.runId}; newer run #${latestRunCandidate.id} is ${latestRunCandidate.status ?? 'not completed'}.`
			: null;
	// TIMETABLE-TERM-GATE-C01 (D3) — the explicit-scope fallback is visible: an
	// unverified authority with data on screen means the timetable loaded one
	// explicit term instead of dead-ending. A blocked page (no data) keeps the
	// setup message instead.
	const termAuthorityNotice = resolveTermAuthorityNotice(
		sourceContext,
		context.draft != null || context.runs.length > 0,
	);
	const nextActionLabel = isPreGenerationWorkspace
		? 'Review the draft before generating'
		: blockingHardCount > 0
			? 'Resolve the highlighted blockers'
			: unassignedCount > 0
				? 'Place the sessions needing attention'
				: 'Review the schedule, then publish when ready';
	const selectedDurationMs = draft
		? runOptions.find((r) => String(r.id) === selectedRunId || (selectedRunId === 'latest' && r.id === runOptions[0]?.id))?.durationMs ?? null
		: null;

	// A2-TIMETABLE-CUSTODY (#41/#51) — the orientation strip names the RUN and
	// its state. `runOnScreenId` is `draft.runId`, NEVER `activeGeneratedRunId`:
	// `isRunPublished` is `isDraftPublishedStrict(draft)`, i.e. the state of
	// `draft.runId`, while `activeGeneratedRunId` resolves under
	// `selectedRunId === 'latest'` to `runs[0]?.id` — the newest run whether or
	// not it finished. The two can name different runs, and this file's own
	// `newerFailedRunNotice` exists for exactly that case. Reading
	// `activeGeneratedRunId` here also rendered a state over a workspace with no
	// schedule on it when the only run had FAILED. The full trace is in
	// `__tests__/timetable-run-identity-a2.test.tsx`; `activeGeneratedRunId` is
	// left untouched for the quick-place/sync request targets, which are a
	// separate question from what this line prints.
	const runOnScreenId = draft?.runId ?? null;
	// U2/#51 and A2-C6-TRUTH (T3a): the key, the badge label and the sentence all
	// come from `RunStateBadge`, so this header and Simple view cannot name the
	// same run two different ways.
	const runStateDescription = describeRunState({
		isPreGeneration: isPreGenerationWorkspace,
		runId: runOnScreenId,
		isPublished: isRunPublished,
	});
	const runStateKey = runStateDescription.key;

	return (
		<Profiler id="Header" onRender={onProfilerRender}>
			<div className="shrink-0 border-b border-border bg-background">
			{/* C11 S2 (item 2) — the orientation row is extracted to
			    `SimpleHeaderOrientationRow` because this file stood at 999 lines, two
			    under the §8 cap, and the change notice had to be added to BOTH layouts.
			    The same component carries the change notice, so the Expert and Simple
			    layouts cannot drift onto two different banners. */}
			<SimpleHeaderOrientationRow
				activeTermLabel={activeTermLabel}
				scopeLabel={termFilter === 'all' ? 'All terms' : (termOptions.find((option) => option.value === String(termFilter))?.label ?? 'Selected term')}
				visibility={runStateDescription.visibility}
				isPreGenerationWorkspace={isPreGenerationWorkspace}
				runOnScreenId={runOnScreenId}
				isPublished={isRunPublished}
				nextActionLabel={nextActionLabel}
				/* C11 S2 (item 1/2) — the change notice comes from the ONE shared gate,
				 * so the Expert layout cannot drift onto a different banner (or, as it
				 * did, onto no banner at all) and T3c's timing rule lives in one place. */
				changeNotice={useRunChangeNotice({
					context, capabilities, isPublished: isRunPublished,
					generationEnabled: generationGate.enabled,
					onRegenerate: context.handleTriggerGenerate,
				}).node}
			/>
			<div className="flex items-center gap-2 overflow-x-auto scrollbar-thin px-4 pt-2 pb-1.5 [@media(max-height:500px)]:pt-1 [@media(max-height:500px)]:pb-1">
				{/* U2/#51 — the appearance follows the RUN, and A2-C6-TRUTH (T3a) made
				 * the renderer shared with Simple view, so the two views of one run
				 * cannot disagree about its number or its Draft/Published word. */}
				<RunStateBadge
					isPreGeneration={isPreGenerationWorkspace}
					runId={runOnScreenId}
					isPublished={isRunPublished}
				/>

				{newerFailedRunNotice && (
					<Badge variant="outline" data-testid="timetable-newer-run-failed" className="h-7 shrink-0 px-2 text-xs font-semibold border-amber-200 bg-amber-50 text-amber-950">
						A newer run failed; showing the last completed schedule.
					</Badge>
				)}

				{termAuthorityNotice && (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge
									variant="outline"
									data-testid="timetable-term-authority-unverified"
									className={cn('h-7 max-w-[34vw] shrink-0 gap-1.5 px-2 text-xs font-semibold', 'border-amber-200 bg-amber-50 text-amber-950')}
								>
									<AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">
										{termAuthorityNotice}
									</span>
								</Badge>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs text-xs" data-testid="timetable-term-authority-unverified-disclosure">
								{termAuthorityNotice}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}

				<div data-tutorial="run-selector" className="shrink-0">
					<Select value={selectedRunId} onValueChange={handleRunChange} disabled={runOptions.length === 0 || centerView === 'pre-generation'}>
						<SelectTrigger className="h-8 w-44 text-xs">
							<SelectValue placeholder={runOptions.length === 0 ? 'No generated run yet' : 'Select run'} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest" disabled={runOptions.length === 0}>Latest Run</SelectItem>
						{runOptions.map((r) => (
							<SelectItem key={r.id} value={String(r.id)}>
								{/* J2 (P3): the run number stays — it is the one internal id a
								 * scheduler can quote — but it is a quiet suffix behind the
								 * run's own timestamp instead of being the label. A run with
								 * no timestamp falls back to the plain phrase. */}
								{runAnchorLabel(r.id, r.createdAt ? formatTimestamp(r.createdAt) : null)}
							</SelectItem>
						))}
						</SelectContent>
					</Select>
				</div>

				<Button
					variant="outline"
					size="sm"
					className="h-8 shrink-0 gap-1.5"
					onClick={handleRefresh}
					disabled={loading}
				>
					<RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
					<span className="hidden sm:inline">Refresh schedule</span>
					<span className="sr-only sm:hidden">Refresh schedule</span>
				</Button>

				{/* C11 D — extracted to `TimetableExpertPublishControl.tsx`: this file was at
				    961 physical lines against the 1000-line cap (AGENTS.md §8) and had to take
				    the persistent draft strip. The gate is unchanged, in one place, so the
				    header's Publish and the strip's Publish cannot disagree. */}
				<TimetableExpertPublishControl
					gate={expertPublishGate}
					onPublish={() => {
						setPublishAcknowledged(false);
						setShowPublishDialog(true);
					}}
				/>

				{/* C11 M5 (F2), correction 2 (QA-B2) — the single Undo instance, back in the
				    toolbar, because the strip is a sentence now. What must not change is that
				    there is exactly ONE (`A2-TIMETABLE-CUSTODY`), shared by both headers. */}
				{undoRedoControl}

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={isPreGenerationWorkspace ? 'default' : 'outline'}
								size="sm"
								className="h-8 shrink-0 gap-1.5"
								disabled={newDraftLoading || !schoolYearId}
								onClick={() => void openDraftPlannerTask()}
							>
								{newDraftLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
								{newDraftLoading ? 'Opening draft…' : 'Plan before generating'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open the draft grid so you can place unassigned sessions before generating.</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{draftPlacementCount > 0 && !isPreGenerationWorkspace && (
					<Button
						variant="secondary"
						size="sm"
						className="h-8 shrink-0 gap-1.5 border border-primary/30"
						onClick={() => void openPreGenerationWorkspace(false).then(() => {
							setLeftTab('unassigned');
							expandLeftPanelForTask();
							setPresentationMode('workflow');
						})}
					>
						<CalendarClock className="size-3.5" />
						Continue draft
					</Button>
				)}
				{isPreGenerationWorkspace && context.hasPublishedReturnState && (
					<Button
						variant="outline"
						size="sm"
						className="h-8 shrink-0 gap-1.5"
						onClick={returnToGeneratedRun}
						data-testid="timetable-return-to-published"
					>
						<Undo2 className="size-3.5" />
						Return to published schedule
					</Button>
				)}

					<DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" data-testid="timetable-advanced-more-tools">
							<MoreHorizontal className="size-3.5" />
							More tools
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-72 p-2">
						<div className="grid gap-1" onClick={() => setMoreOpen(false)}>
				<ExpertGenerationControl
					repairHref={generationRepairHref}
					repairLabel={generationRepairLabel}
					enabled={generationGate.enabled}
					blockedReason={generationGate.reason ?? 'Generation is not available yet.'}
					generating={generating}
					loading={loading}
					onTrigger={handleGenerationTrigger}
				/>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								data-tutorial="policy-btn"
								variant={centerView === 'policy' ? 'default' : 'outline'}
								size="sm"
								className="h-8 gap-1.5"
								disabled={!schoolYearId}
								onClick={() => centerView === 'policy' ? exitPolicyView() : switchCenterViewWithGuard(enterPolicyView)}
							>
								<Settings2 className="size-3.5" />
								{centerView === 'policy' ? 'Close Policy' : 'Policy'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Configure scheduling policy and soft-constraint weights</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={centerView === 'map' || centerView === 'building' ? 'default' : 'outline'}
								size="sm"
								className="h-8 gap-1.5"
								disabled={!schoolYearId}
								onClick={() => { void openMapWorkspace(); }}
							>
								<Crosshair className="size-3.5" />
								{centerView === 'map' || centerView === 'building' ? 'Map Workspace' : 'Map View'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Navigate buildings and rooms without leaving the editable grid</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
								<Link to="/faculty/concerns" data-testid="timetable-teacher-concerns-link">
									<ClipboardList className="size-3.5" />
									Teachers you have talked to
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open each teacher&apos;s concerns — when they can teach, the rooms they need, and your notes</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								onClick={() => openLeftTask('requests')}
								data-testid="timetable-advanced-requests"
							>
								<ClipboardList className="size-3.5" />
								Requests
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open the room requests queue inside {CLASS_SCHEDULE_LABEL}</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								onClick={() => setShowSyncConfirm(true)}
								disabled={loading || syncing || isPreGenerationWorkspace || activeGeneratedRunId == null}
								aria-label="Sync with Setup"
							>
								{syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
								Sync with Setup
							</Button>
						</TooltipTrigger>
						<TooltipContent>Sync teacher assignments and curriculum setup from database</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={editHistoryCount === 0}
								onClick={() => setShowEditHistory(true)}
							>
								<History className="size-3.5" />
								{/* A2-C6-TRUTH (T1b): the digit is a claim about the run. A
								    cleared-but-unread ledger and a failed read both render 0, so
								    the control shows the read state instead of a number it has
								    not earned. */}
								<span className="text-xs" data-testid="timetable-history-count" data-history-read-state={editHistoryReadState}>
									{editHistoryReadState === 'ready' ? editHistoryCount : '—'}
								</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{editHistoryReadState === 'ready' ? 'View manual edit history' : 'Reading manual edit history…'}</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 gap-1.5"
								onClick={tutorial.start}
							>
								<GraduationCap className="size-3.5" />
								Tour
							</Button>
						</TooltipTrigger>
						<TooltipContent>Start guided tour of the schedule review page</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<Link to="/timetabling/how-it-works" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-colors">
						<Lightbulb className="size-3.5" />
						How It Works
					</Link>
				{/* C11 D, correction 2 (QA-B2) — `Edit draft` / `Discard draft` in the menu this
				    header already has; without them the two props are unreferenced and Expert
				    has NO way to enter or discard a draft. `Publish` is not here: the toolbar's
				    own `TimetableExpertPublishControl` is the publication control. */}
					<TimetableExpertDraftActions
						hasSelectedClass={hasSelectedEntry}
						hasDraft={draft != null}
						onEdit={onEditDraft ?? null}
						onDiscard={onDiscardDraft ?? null}
					/>
					</div>
					</DropdownMenuContent>
				</DropdownMenu>

				{summary && (
					<ScheduleReviewWorkspaceSummaryStats
						summary={summary}
						presence={context.presence}
						statusColor={statusColor}
						draftStatus={draft?.status ?? '—'}
						durationMs={selectedDurationMs}
						formatDuration={formatDuration}
					/>
				)}
			</div>

			<div className="px-4 pb-1.5">
				{Number.isInteger(schoolId) && schoolId > 0 ? (
					<RolloverGuidanceCard compact schoolId={schoolId} onStatus={setRolloverStatus} onApplied={() => handleRefresh()} />
				) : null}
			</div>

			<div
				data-testid="timetable-task-guide"
				className="relative mx-2 mb-1 rounded-lg border border-border bg-muted/20 px-2 py-0.5 shadow-sm sm:mx-4 xl:px-3 [@media(max-height:500px)]:mb-0 [@media(max-height:500px)]:py-0"
			>
				<div className="flex min-w-0 items-center justify-between gap-1.5">
					<div className="sr-only">
						<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-primary shadow-sm ring-1 ring-border">
							<ActiveTaskIcon className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next task</p>
							<p className="truncate text-sm font-semibold text-foreground">{activeTask.label}</p>
						</div>
					</div>

					<ScheduleReviewWorkspaceTaskModes taskModes={taskModes} />
				</div>
				{/* B2 — the plain-language guidance is visible to sighted users here,
				    not only to screen readers. See TimetableAdvancedHeaderHelp.

				    A2-TIMETABLE-CUSTODY (Lane C finding #63): this bar no longer
				    renders an Undo of its own. The one Undo on the Expert screen is
				    the workspace toolbar control (`TimetableUndoRedoControl`,
				    `ScheduleReviewWorkspace.tsx`), which sits beside `Redo` and
				    `History`, carries a unique accessible name, and states a blocked
				    reason visibly instead of only on hover. */}
				<TimetableAdvancedHeaderHelp
					mode={isPreGenerationWorkspace ? 'draft' : 'schedule'}
					activeTaskHelper={activeTask.helper}
				/>
			</div>

			{showInputStateBanner && (
				<ScheduleReviewInputStateBanner
					inputState={inputState}
					changedDomainLabels={changedDomainLabels}
					loading={loading}
					syncing={syncing}
					hasSelectedEntry={hasSelectedEntry}
					generationEnabled={generationGate.enabled}
					onPreviewImpact={() => setShowImpactPreview(true)}
					onSync={() => setShowSyncConfirm(true)}
					onManualRepair={() => context.enterManualEditView('CHANGE_FACULTY')}
					onRegenerate={handleGenerationTrigger}
				/>
			)}

			<SyncTimetableConfirmDialog
				open={showSyncConfirm}
				onOpenChange={setShowSyncConfirm}
				syncing={syncing}
				onSyncNow={handleSyncSetup}
			/>
			<SetupImpactDialog
				open={showImpactPreview}
				onOpenChange={setShowImpactPreview}
				inputState={inputState}
				changedDomainLabels={changedDomainLabels}
			/>

			<TimetableToolbar
				viewMode={viewMode}
				viewModeLabels={VIEW_MODE_LABELS}
				onViewModeChange={(value) => {
					setViewMode(value as 'section' | 'faculty' | 'room');
					setEntityFilter('');
					setSelectedEntry(null);
					setSelectedViolation(null);
					setPreGenKbSource(null);
					setKbSelectedSource(null);
				}}
				entityFilter={entityFilter}
				onEntityFilterChange={(value) => {
					setEntityFilter(value);
					setSelectedEntry(null);
					setSelectedViolation(null);
					setPreGenKbSource(null);
					setKbSelectedSource(null);
				}}
				groupedPivotEntities={groupedPivotEntities}
				pivotLabel={pivotLabel}
				programFilter={programFilter}
				onProgramFilterChange={(value) => setProgramFilter(value as ProgramFilter)}
				programFilterOptions={PROGRAM_FILTER_OPTIONS}
				entryKindFilter={entryKindFilter}
				onEntryKindFilterChange={(value) => setEntryKindFilter(value as EntryKindFilter)}
				entryKindFilterOptions={ENTRY_KIND_FILTER_OPTIONS}
				termFilter={termFilter}
				onTermFilterChange={onTermFilterChange}
				termOptions={termOptions}
				activeTermIndex={activeTermIndex}
			>
				<div className="flex items-center gap-1">
					<Button
						variant={presentationMode === 'workflow' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-xs"
						onClick={() => setPresentationMode('workflow')}
					>
						Schedule review
					</Button>
					<Button
						variant={presentationMode === 'matrix' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-xs"
						onClick={() => setPresentationMode('matrix')}
					>
						Grid view
					</Button>
				</div>
				<div className="h-4 w-px bg-border mx-0.5" />
				<FilterChip
					label="All"
					count={visibleViolations.length}
					active={severityFilter === 'all'}
					onClick={() => setSeverityFilter('all')}
				/>
				<FilterChip
					label={MUST_FIX_LABEL}
					count={hardCount}
					active={severityFilter === 'hard'}
					onClick={() => setSeverityFilter('hard')}
					variant="destructive"
				/>
				<FilterChip
					label="Warning"
					count={softCount}
					active={severityFilter === 'soft'}
					onClick={() => setSeverityFilter('soft')}
					variant="warning"
				/>
				<FilterChip
					label="Conflicts"
					count={visibleViolations.filter((v) => CONFLICT_CODES.has(v.code)).length}
					active={severityFilter === 'conflicts'}
					onClick={() => setSeverityFilter('conflicts')}
				/>
				<FilterChip
					label="Well-being"
					count={visibleViolations.filter((v) => WELLBEING_CODES.has(v.code)).length}
					active={severityFilter === 'wellbeing'}
					onClick={() => setSeverityFilter('wellbeing')}
				/>
			</TimetableToolbar>

			<ConfirmationModal
				open={showPostSyncOffer}
				onOpenChange={setShowPostSyncOffer}
				{...{ title: 'Place available sessions?' }}
				description={`Setup sync updated ${syncResult?.updatedFacultyCount} teacher assignments, moved ${syncResult?.displacedEntriesCount} sessions to Needs attention, and found ${syncResult?.addedUnassignedCount} new sessions. Review the sessions ATLAS can place now.`}
				onConfirm={handleTriggerQuickPlacePreview}
				confirmText="Review placements"
				variant="success"
			/>

			<QuickPlaceSummaryModal
				open={showQuickPlaceConfirm}
				onOpenChange={setShowQuickPlaceConfirm}
				placed={quickPlacePlaced}
				unplaced={quickPlaceUnplaced}
				onConfirm={handleCommitQuickPlace}
				loading={quickPlaceLoading}
			/>
			</div>
		</Profiler>
	);
}

/*
 * The orphaned comment that stood here described a test fixture and attached to no
 * declaration. It is now also FALSE: `onEditDraft` / `onDiscardDraft` are the two
 * actions wired into "More tools" above, and a fixture that omits them gets both
 * rows rendered and DISABLED with a visible reason.
 */
export const ScheduleReviewWorkspaceHeader = memo(ScheduleReviewWorkspaceHeaderImpl);
