import { memo, useEffect, useMemo, useState } from 'react';
import {
	BookOpen,
	CalendarClock,
	Loader2,
	MoreHorizontal,
	RefreshCw,
	Settings2,
	type LucideIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { deriveSimpleLifecycleAction } from '@/lib/simple-timetable-state';
import { deriveTimetableCapabilities, describeSetupState, YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness } from '@/lib/timetable-generation-readiness';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import { isRunPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { SimplePublishReadinessSheet } from '@/components/timetable/SimplePublishReadinessSheet';
import { resolveBlockerDestination, resolvePlacementReasonFilter } from '@/components/timetable/simplePublishReadiness';
import type { SeverityFilter } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import type { UnassignedReason, Violation } from '@/types';
import { UnassignedInsertionWorkflow } from '@/components/timetable/UnassignedInsertionWorkflow';
import {
	chooseRecommendedTask,
	hasPivotValue,
	firstPivotValue,
	primaryDispatchesReviewIssues,
	resolvePublishTaskDispatch,
	resolveSimpleGenerateActionState,
	resolveSimplePublishActionState,
	shouldDispatchSimpleGenerate,
	shouldDispatchSimplePublish,
	SimpleGenerateAction,
	SimplePublishAction,
	SimplePublishedState,
	SimpleScheduleControls,
	SimpleScheduleSheet,
	SimpleTutorialControl,
	resetSimpleWorkspaceFilters,
	useSimpleTasks,
} from '@/components/timetable/simple/SimpleHeaderHelpers';
import {
	resolveSimpleReadiness,
	SimpleReadinessChip,
} from '@/components/timetable/simple/SimpleSetupSharedControls';
import type { SimpleViewMode } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { SimpleExportMenu, SimpleTermSwitcher } from '@/components/timetable/simple/SimpleBeneficiaryControls';
import { SimpleDriftBanner } from '@/components/timetable/simple/SimpleDriftBanner';
import { describeRunInputDrift } from '@/components/timetable/timetableDriftRouting';
import { SimpleMoreMenuContent } from '@/components/timetable/simple/SimpleMoreMenuContent';
import { resolveTermAuthorityNotice } from '@/hooks/useTimetableData';
import { ExportPresentationSettingsDialog } from '@/components/timetable/simple/ExportPresentationSettingsDialog';
import { SchedulerPrintDialog } from '@/components/timetable/simple/SchedulerPrintDialog';
import { TimetablePublishedReturnAction } from '@/components/timetable/TimetablePublishedReturnAction';
import { fetchRolloverStatus, type RolloverStatus } from '@/lib/settings';

type TimetableSimpleHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	layoutMode: TimetableLayoutMode;
	onLayoutModeChange: (mode: TimetableLayoutMode) => void;
	activeTask: TimetableSimpleTask | null;
	onTaskChange: (task: TimetableSimpleTask | null) => void;
	onOpenTeacherDeparture?: () => void;
	onSetRepairOrigin?: (origin: RepairOrigin | null) => void;
	readinessSheetOpen?: boolean;
	onReadinessSheetOpenChange?: (open: boolean) => void;
	swapClassTimesMode?: 'select-first' | 'select-second' | null;
	onSwapClassTimesStart?: () => void;
	onSwapClassTimesCancel?: () => void;
};

export type SimpleReadinessRepairIdentity = {
	sectionId: number | null;
	subjectId: number | null;
	facultyId: number | null;
};

export type SimpleReadinessRepairDeps = {
	href: string;
	reason?: string;
	identity?: SimpleReadinessRepairIdentity | null;
	navigate: (to: string) => void;
	violations: Violation[];
	setUnassignedReasonFilter: (value: 'all' | UnassignedReason) => void;
	setBlockerReasonFilter: (value: string | null) => void;
	startPlaceUnresolvedTask: () => void;
	startReviewIssuesTask: () => void;
	setSelectedViolation: (violation: Violation | null) => void;
	setSeverityFilter: (value: SeverityFilter) => void;
	issueReviewEnabled: boolean;
	onSetRepairOrigin?: ((origin: RepairOrigin | null) => void) | null;
};

/**
 * The `SimplePublishReadinessSheet` repair dispatch. Canonical home is this
 * module (the pre-existing header-source contracts pin it here); the
 * `/timetable/setup` pane imports and shares this exact implementation, so
 * there is still only one. Sheet-close stays with the caller. Every
 * destination is real: Teaching Load deep links keep identity, room blockers
 * go to `/map`, placement blockers honor the exact unresolved reason, and
 * review blockers select the violation in the review rail.
 */
export function dispatchSimpleReadinessRepair(context: SimpleReadinessRepairDeps): void {
	const {
		href,
		reason,
		identity,
		navigate,
		violations,
		setBlockerReasonFilter,
		startPlaceUnresolvedTask,
		startReviewIssuesTask,
		setSelectedViolation,
		setSeverityFilter,
		issueReviewEnabled,
		onSetRepairOrigin,
	} = context;
	const plainReason = reason === 'NO_AVAILABLE_SLOT' ? 'No available slot'
		: reason === 'FACULTY_OVERLOADED' ? 'Teachers are overloaded'
		: reason === 'NO_QUALIFIED_FACULTY' ? 'No qualified teacher'
		: reason === 'NO_COMPATIBLE_ROOM' ? 'No compatible room'
		: reason === 'ROOM_CAPACITY_EXCEEDED' ? 'Room capacity exceeded'
		: reason ? reason.replace(/_/g, ' ').toLowerCase() : 'Unknown issue';
	onSetRepairOrigin?.({ reason: reason ?? 'UNKNOWN', plainReason, groupCount: 0 });
	// B3 — one shared destination resolver; every blocker action is real.
	const destination = resolveBlockerDestination(reason, href);
	if (destination.kind === 'teaching-load') {
		// R9/A-18: preserve teacher/section/subject identity on the
		// Teaching Load repair deep link.
		const params = new URLSearchParams();
		if (identity?.facultyId != null) params.set('facultyId', String(identity.facultyId));
		if (identity?.sectionId != null) params.set('sectionId', String(identity.sectionId));
		if (identity?.subjectId != null) params.set('subjectId', String(identity.subjectId));
		params.set('task', 'missing-load');
		navigate(`/teaching-load?${params.toString()}`);
		return;
	}
	if (destination.kind === 'rooms') {
		// R8/A-03: room configuration lives at /map; the legacy room path is
		// unmounted. The resolver maps every room blocker reason to /map.
		navigate('/map');
		return;
	}
	if (destination.kind === 'placement') {
		// C07B/F5 — honor the exact unresolved reason the resolver carried
		// (`UNASSIGNED_SECTION` vs `NO_AVAILABLE_SLOT`) so the queue is never
		// filtered down to a reason that hides the affected sessions.
		const reasonFilter = resolvePlacementReasonFilter(destination);
		context.setUnassignedReasonFilter(reasonFilter);
		setBlockerReasonFilter(reasonFilter);
		startPlaceUnresolvedTask();
		return;
	}
	// review: select the exact violation in the review rail.
	const match = destination.code
		? violations.find((v) => v.code === destination.code && v.severity === 'HARD')
			?? violations.find((v) => v.code === destination.code)
		: undefined;
	if (match) setSelectedViolation(match);
	setSeverityFilter('hard');
	if (issueReviewEnabled) {
		startReviewIssuesTask();
	} else if (destination.href) {
		navigate(destination.href);
	}
}

function TimetableSimpleHeaderImpl({
	context,
	layoutMode,
	onLayoutModeChange,
	activeTask,
	onTaskChange,
	onOpenTeacherDeparture,
	onSetRepairOrigin,
	readinessSheetOpen: readinessSheetOpenProp,
	onReadinessSheetOpenChange,
	swapClassTimesMode,
	onSwapClassTimesStart,
	onSwapClassTimesCancel,
}: TimetableSimpleHeaderProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);
	const [tutorialOpen, setTutorialOpen] = useState(false);
	const [readinessSheetOpenLocal, setReadinessSheetOpenLocal] = useState(false);
	const [presentationSettingsOpen, setPresentationSettingsOpen] = useState(false);
	const printPanelOpen = new URLSearchParams(location.search).get('print') === '1';
	const setPrintPanelOpen = (open: boolean) => {
		const params = new URLSearchParams(location.search);
		if (open) params.set('print', '1');
		else params.delete('print');
		const search = params.toString();
		navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
	};
	const readinessSheetOpen = readinessSheetOpenProp ?? readinessSheetOpenLocal;
	const setReadinessSheetOpen = onReadinessSheetOpenChange ?? setReadinessSheetOpenLocal;
	const [blockerReasonFilter, setBlockerReasonFilter] = useState<string | null>(null);
const [insertionOpen, setInsertionOpen] = useState(false);
	// R6/R7 — Simple consumes the same rollover/term-authority status Advanced
	// does, and that drift blocks generation exactly as it does in Advanced.
	const [rolloverStatus, setRolloverStatus] = useState<RolloverStatus | null>(null);
	// A3 — the rollover guidance card moved to `/timetable/setup`; the header
	// keeps the same canonical status subscription so the generation gate still
	// blocks on rollover drift. Authority is relocated, never weakened.
	useEffect(() => {
		if (!context.schoolId) return;
		let cancelled = false;
		void fetchRolloverStatus(context.schoolId)
			.then((status) => { if (!cancelled) setRolloverStatus(status); })
			.catch(() => { /* keep the last known state; the setup pane shows the detail */ });
		return () => { cancelled = true; };
	}, [context.schoolId]);
	const [lastEntityByMode, setLastEntityByMode] = useState<Partial<Record<SimpleViewMode, string>>>({});
	useEffect(() => {
		if (layoutMode === 'simple') resetSimpleWorkspaceFilters(context);
	// Clear stale filters when entering Simple, not on every filter state update:
	// readiness repairs intentionally set the severity filter to `hard`.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [layoutMode]);
	const visibleRunId = context.draft?.runId ?? null;
	// TIMETABLE-TERM-GATE-C01 (D3) — same explicit-scope fallback notice as
	// Advanced: an unverified authority with data on screen means the timetable
	// loaded one explicit term instead of dead-ending.
	const termAuthorityNotice = resolveTermAuthorityNotice(
		context.schoolYearContext,
		context.draft != null || (context.runs?.length ?? 0) > 0,
	);
	// A4 — one authority state. The drift comparison is derived from the same
	// canonical helper the drift banner uses, so the header decides precedence
	// without a second source of truth.
	const driftSummary = useMemo(
		() => describeRunInputDrift(context.draft?.inputState ?? null),
		[context.draft?.inputState],
	);
	const showDriftState = !context.isPreGenerationWorkspace && context.draft != null && driftSummary.status !== 'FRESH';
	const setupState = describeSetupState(context.curriculumReadiness);
	const scopeResolved = Number.isInteger(context.schoolId) && context.schoolId > 0
		&& Number.isInteger(context.schoolYearId) && (context.schoolYearId ?? 0) > 0;

	// A failed or invalidated run is history, not a timetable that can be reviewed or published.
	const hasGeneratedRun = Boolean(context.draft);
	// Run-scoped daily tools are only meaningful once a schedule or draft exists.
	const runToolsAvailable = hasGeneratedRun || context.isPreGenerationWorkspace;
	// Newest run failed while nothing reviewable exists: name it explicitly so
	// operators do not read this as "nothing ever happened".
	const latestRunFailed = !hasGeneratedRun && (context.runs?.[0]?.status === 'FAILED');
	const draftSummaryRaw = context.draft?.summary as unknown as Record<string, unknown> | null;
	// R6/CP-2: the single strict predicate. Loose `publishedAt`/`publishedBy`
	// markers on a superseded run must never render published affordances.
	const isRunPublished = isRunPublishedStrict(draftSummaryRaw);

	// One shared capability and generation decision for Simple and Advanced.
	const capabilities = deriveTimetableCapabilities({
		scopeResolved,
		curriculumState: context.curriculumReadiness?.state ?? 'unavailable',
		generating: context.generating,
		isPreGeneration: context.isPreGenerationWorkspace,
		hasGeneratedRun,
		isPublished: isRunPublished,
		latestRunFailed,
		hardCount: context.blockingHardCount,
		unassignedCount: context.summary?.unassignedCount ?? 0,
		softCount: context.softCount,
		hasSelectedEntry: context.hasSelectedEntry,
		requestPendingCount: context.requestPendingCount,
		generationDiagnostic: summarizeGenerationReadiness(context.curriculumReadiness),
		readinessRepair: context.curriculumReadiness?.state === 'blocked' ? context.curriculumReadiness.repair : null,
		driftBlocked: rolloverStatus?.drift.status === 'atlas-stale' || rolloverStatus?.drift.status === 'mapping-conflict',
		driftMessage: rolloverStatus?.drift.message ?? null,
	});
	const generationGate = capabilities.generation;
	const generationReady = generationGate.enabled;
	// Keep every real generation repair (navigate OR retry); only fall back to
	// the setup-state repair when the generation gate offers no repair at all.
	const setupRepair = generationGate.repair.kind !== 'none' ? generationGate.repair : setupState.repair;
	// F3 — a repair target equal to the current route is a dead control ("Review
	// timetable" while already on /timetable). It must never be suppressed into
	// an absent primary action: a self-route or retry repair is served by a real
	// in-place action (re-run the readiness check) instead of a dead link.
	const setupRepairTargetsCurrentRoute = setupRepair.kind === 'navigate'
		&& setupRepair.href != null
		&& setupRepair.href.split('?')[0] === location.pathname;
	const setupRepairIsInPlace = setupRepair.kind === 'retry' || setupRepairTargetsCurrentRoute;
	// F2 — a blocked readiness message is a raw engine diagnostic (entity ·
	// subject · term · session reason). Keep the operator sentence short and
	// expose the technical detail behind a tooltip for support.
	const setupBlockedDiagnostic = context.curriculumReadiness?.state === 'blocked' ? setupState.message : null;
	const setupOperatorMessage = 'ATLAS found schedule information to check before a timetable can be made. Review the item shown, then check again.';
	const canPlanOrGenerate = scopeResolved && generationReady && !context.loading;
	// R7 — the shared capability model is the production guard for every Simple
	// task action (publish/swap/review), not just generation.
	const tasks = useSimpleTasks(context, capabilities.gates);
	const recommendedTask = chooseRecommendedTask(tasks, context);
	const activeTaskDefinition = tasks.find((task) => task.id === activeTask) ?? recommendedTask;
	const currentEntityIsValid = hasPivotValue(context, context.entityFilter);

	useEffect(() => {
		if (!currentEntityIsValid) return;
		setLastEntityByMode((previous) => {
			if (previous[context.viewMode] === context.entityFilter) return previous;
			return { ...previous, [context.viewMode]: context.entityFilter };
		});
	}, [context.entityFilter, context.viewMode, currentEntityIsValid]);

	useEffect(() => {
		if (currentEntityIsValid || context.sectionFocusId != null) return;
		const remembered = lastEntityByMode[context.viewMode];
		const nextValue = hasPivotValue(context, remembered) ? remembered! : firstPivotValue(context);
		if (nextValue && nextValue !== context.entityFilter) {
			context.setEntityFilter(nextValue);
		}
	}, [context, currentEntityIsValid, lastEntityByMode]);

	useEffect(() => {
		if (activeTask !== 'place-unresolved' && blockerReasonFilter) {
			setBlockerReasonFilter(null);
			context.setUnassignedReasonFilter('all');
		}
	}, [activeTask, blockerReasonFilter, context]);

	// UX-R03e (setup) — the readiness triple is shared with the
	// `/timetable/setup` center view through one implementation (same label,
	// same predicate, same reason). The header keeps its own entry points.
	const { readiness, publishBlocked, publishBlockedReason } = resolveSimpleReadiness({
		draft: context.draft,
		blockingHardCount: context.blockingHardCount,
		summary: context.summary,
		softCount: context.softCount,
		isPreGenerationWorkspace: context.isPreGenerationWorkspace,
		schoolYearContext: context.schoolYearContext,
		hasGeneratedRun,
		isRunPublished,
	});
	const lifecycleAction = deriveSimpleLifecycleAction({
		hasGeneratedRun,
		isPreGeneration: context.isPreGenerationWorkspace,
		generating: context.generating,
		hardCount: context.blockingHardCount,
		unassignedCount: context.summary?.unassignedCount ?? 0,
		softCount: context.softCount,
		isPublished: isRunPublished,
		scopeResolved,
		curriculumState: context.curriculumReadiness?.state ?? 'unavailable',
		latestRunFailed,
	});

	// UX-QUICKFIX-C01 — Generate and Publish are now first-class, always-visible
	// controls in the action row. Their disabled/reason state is derived from the
	// SAME shared capability gates the More menu and lifecycle dispatcher use.
	const generateActionState = resolveSimpleGenerateActionState({
		canPlanOrGenerate,
		loading: context.loading,
		generating: context.generating,
		gateReason: generationGate.reason,
	});
	const publishActionState = resolveSimplePublishActionState({
		publicationEnabled: capabilities.gates.publication.enabled,
		isRunPublished,
		gateReason: capabilities.gates.publication.reason,
	});
	const showPublishAction = hasGeneratedRun && !isRunPublished;
	// C01R C1 — one publish control per state. The dynamic primary is
	// suppressed while the dedicated publish control owns the publish slot;
	// the dedicated control is the solid primary exactly then. For every other
	// next step the lifecycle primary stays the single filled action.
	const primaryRendersPublish = activeTask
		? activeTaskDefinition.id === 'publish'
		: lifecycleAction.kind === 'publish';
	const primaryIsPublished = activeTask
		? (activeTaskDefinition.id === 'publish' && isRunPublished)
		: lifecycleAction.kind === 'published';
	const suppressPrimaryAction = primaryRendersPublish || primaryIsPublished;
	// C7 — one action is never reachable from both the header primary and More.
	// The primary owns the review-issues dispatch in the review-warnings state
	// (and while a review task is armed); More drops its duplicate entry then.
	const moreHidesReviewIssues = primaryDispatchesReviewIssues({
		activeTaskId: activeTask,
		lifecycleKind: lifecycleAction.kind,
	});

	const handlePublishClick = () => {
		if (isRunPublished) return;
		// R7 — the shared capability model is the production guard, not a local count.
		// C07B/F2 — with the gate open the publish task is a real readiness surface:
		// the task drawer renders the publish checklist (run-wide gate + grouped
		// blockers + the Publish action) instead of leaving that component dead.
		if (resolvePublishTaskDispatch(capabilities.gates.publication.enabled) === 'publish-task') {
			context.setPresentationMode('workflow');
			context.setPublishAcknowledged(false);
			onTaskChange('publish');
			return;
		}
		setReadinessSheetOpen(true);
	};

	// UX-QUICKFIX-C01 — every visible action reads its gate before it dispatches,
	// so a closed gate dispatches zero requests even if the disabled control is
	// activated programmatically.
	const handleGenerateClick = () => {
		if (!shouldDispatchSimpleGenerate(canPlanOrGenerate)) return;
		context.handleTriggerGenerate();
	};

	const handlePublishActionClick = () => {
		if (!shouldDispatchSimplePublish(capabilities.gates.publication.enabled, isRunPublished)) return;
		handlePublishClick();
	};

	const handleLifecycleAction = () => {
		switch (lifecycleAction.kind) {
			case 'resolve-scope': break;
			case 'fix-setup': navigate(YEAR_SETUP_HREF); break;
			case 'start-draft': void startTask('plan-draft'); break;
			case 'generate':
				if (generationReady) context.handleTriggerGenerate();
				break;
			case 'retry-generate': context.handleTriggerGenerate(); break;
			case 'retry-readiness': context.handleRefresh(); break;
			case 'fix-blockers': setReadinessSheetOpen(true); break;
			case 'review-warnings': void startTask('review-issues'); break;
			case 'publish': handlePublishClick(); break;
			case 'review-follow-ups': void startTask('place-unresolved'); break;
			case 'generating':
			case 'published': break;
		}
	};

	const exportRunId = context.draft?.runId ?? context.activeGeneratedRunId ?? null;
	const exportYearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? null;

	const clearGridSelection = () => {
		context.setSelectedEntry(null);
		context.setSelectedViolation(null);
		context.setPreGenKbSource(null);
		context.setKbSelectedSource(null);
	};

	const handleViewModeChange = (value: string) => {
		const nextMode = value as SimpleViewMode;
		if (currentEntityIsValid) {
			setLastEntityByMode((previous) => ({ ...previous, [context.viewMode]: context.entityFilter }));
		}
		context.setViewMode(nextMode);
		context.setEntityFilter(lastEntityByMode[nextMode] ?? '');
		clearGridSelection();
	};

	const handleEntityChange = (value: string) => {
		context.setEntityFilter(value);
		setLastEntityByMode((previous) => ({ ...previous, [context.viewMode]: value }));
		clearGridSelection();
	};

	const startTask = async (task: TimetableSimpleTask) => {
		if (task === 'place-unresolved') {
			context.setLeftTab('unassigned');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'review-issues') {
			if (!capabilities.gates.issueReview.enabled) return;
			context.setLeftTab('violations');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'swap-sessions') {
			if (!capabilities.gates.swap.enabled) return;
			context.setPresentationMode('workflow');
			onTaskChange(task);
			onSwapClassTimesStart?.();
			return;
		}
		if (task === 'plan-draft') {
			if (!context.isPreGenerationWorkspace) {
				await context.handleStartNewPreGenerationDraft();
			}
			context.setLeftTab('unassigned');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'publish') {
			// R7 — one shared publication gate for the task action too.
			// C07B/F2 — one dispatcher: the task and the lifecycle action land on the
			// same readiness surface.
			handlePublishClick();
		}
	};

	const openTeacherDeparture = () => {
		onOpenTeacherDeparture?.();
		setMoreOpen(false);
	};

	// R7 — room-request review is reachable from Simple when requests are
	// pending. It reuses the canonical requests rail; no second authority.
	const openRequestsTask = () => {
		context.leftPanelRef.current?.expand();
		context.setLeftTab('requests');
		context.setPresentationMode('workflow');
	};

	return (
		<header className="shrink-0 border-b border-border bg-background" data-testid="timetable-simple-header">
			{/* The status and action areas intentionally wrap at every desktop width;
			    this keeps every control visible without turning the header into a
			    horizontally scrolling strip. The conditional export/swap banners
			    remain full-width strips outside these rows.
			    A3/C5 — the region is still ONE status region, rendered as a compact
			    single-line strip: the readiness chip, the single coherent authority
			    state, and the one labelled way to the setup repairs. A4 — the
			    ordered-term notice, the run-input drift message, or the source
			    authority line renders here, never two at once. C5 — the region
			    no longer carries its own bordered band (margins + vertical
			    padding) and the redundant `Next step:` line is gone: the single
			    primary action already names the next step, so the header keeps
			    exactly one status region and one visually dominant primary. The
			    setup-input repairs (Fix rooms / Preview impact / Sync with
			    setup) and the rollover guidance live on `/timetable/setup`. */}
			<div
				className="flex min-w-0 flex-col gap-1.5"
				data-testid="timetable-simple-header-row"
			>
			<section data-testid="timetable-simple-status-region" role="region" aria-label="Timetable status" className="min-w-0 px-3">
			<div className="flex min-w-0 flex-wrap items-center gap-1.5">
				<SimpleReadinessChip
					readiness={readiness}
					publishBlocked={publishBlocked}
					blockingHardCount={context.blockingHardCount}
				/>
				{/* Only actionable drift and unresolved-term states belong in the
				    ordinary header. Routine provenance remains in Expert diagnostics. */}
				{showDriftState ? (
					<SimpleDriftBanner
						schoolId={context.schoolId}
						schoolYearId={context.schoolYearId}
						activeGeneratedRunId={context.draft?.runId ?? context.activeGeneratedRunId ?? null}
						draft={context.draft ?? null}
						isPreGenerationWorkspace={context.isPreGenerationWorkspace}
						loading={context.loading}
						onRefresh={context.handleRefresh}
						onRolloverStatus={setRolloverStatus}
						capabilities={capabilities}
						isPublished={isRunPublished}
						layout="inline"
						showActions={false}
						showRolloverGuidance={false}
						onRegenerate={context.handleTriggerGenerate}
						regenerationEnabled={generationReady}
						regenerating={context.generating}
					/>
				) : termAuthorityNotice ? (
					<p className="min-w-0 flex-1 truncate text-xs font-medium text-amber-800" data-testid="timetable-term-authority-unverified">{termAuthorityNotice}</p>
				) : null}
				{latestRunFailed ? (
					<p className="min-w-0 text-xs font-medium text-red-700" data-testid="timetable-last-generation-failed-message">
						The last schedule build did not finish. Check schedule information, then try again.
					</p>
				) : null}
				{setupBlockedDiagnostic ? (
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<p
									className="min-w-0 break-words text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
									data-testid="timetable-curriculum-readiness-message"
									tabIndex={0}
								>
									{setupOperatorMessage}
								</p>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
								<span className="block font-semibold">Technical detail</span>
								<span className="mt-1 block">{setupBlockedDiagnostic}</span>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : null}
				{/* A3 — one labelled way to the setup repairs. */}
				<Button asChild type="button" variant="outline" size="sm" className="h-6 shrink-0 gap-1 px-2 text-xs" data-testid="timetable-simple-review-setup">
					<Link to="/timetable/setup">
						<Settings2 className="size-3" aria-hidden="true" />
						Check schedule information
					</Link>
				</Button>
			</div>
			</section>

			{/* A3/C5 — ONE action row: term, schedule, downloads, and the
			    single primary action. Everything else is one click away in More.
			    C5 — the row no longer adds its own bottom band padding, so the
			    header is one compact block (status strip + control row) instead
			    of two padded bands. */}
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3">
				<SimpleTermSwitcher context={context} />

				<div className="hidden min-w-0 flex-1 lg:flex lg:shrink-0 lg:min-w-[24rem]">
					<SimpleScheduleControls
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
				</div>

				<SimpleScheduleSheet
					context={context}
					lastEntityByMode={lastEntityByMode}
					onViewModeChange={handleViewModeChange}
					onEntityChange={handleEntityChange}
				/>
				{hasGeneratedRun ? (
					<SimpleExportMenu
						onOpenDownloadSchedules={() => setPrintPanelOpen(true)}
					/>
				) : null}

				{/* A3/C6 — the single action cluster: one lifecycle-derived primary,
				    the secondary Generate, and the More disclosure. C6 — on the
				    narrow scrollable strip the primary leads (order-first) so it is
				    visible without scrolling; at lg it returns to its inline order. */}
				<div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:ml-auto lg:justify-end">
					<TimetablePublishedReturnAction
						visible={context.isPreGenerationWorkspace && Boolean(context.hasPublishedReturnState)}
						onReturn={context.returnToGeneratedRun}
					/>
					<SimpleGenerateAction
						disabled={generateActionState.disabled}
						disabledReason={generateActionState.reason}
						onClick={handleGenerateClick}
					/>
					{isRunPublished ? (
						<SimplePublishedState followUpCount={context.summary?.unassignedCount ?? 0} />
					) : showPublishAction ? (
						<SimplePublishAction
							enabled={!publishActionState.disabled}
							disabledReason={publishActionState.reason}
							primary={primaryRendersPublish}
							onClick={handlePublishActionClick}
						/>
					) : null}
					{generationReady && !hasGeneratedRun ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-11 gap-1.5 px-3 text-sm"
							disabled={!canPlanOrGenerate}
							onClick={() => setInsertionOpen(true)}
							data-testid="timetable-unassigned-insertion-action"
						>
							<CalendarClock className="size-3.5" aria-hidden="true" />
							<span>Preview demand</span>
						</Button>
					) : null}
					{suppressPrimaryAction ? null : setupRepairIsInPlace ? (
						<Button
							type="button"
							size="sm"
							className="order-first h-11 gap-1.5 px-3 text-sm lg:order-none"
							disabled={lifecycleAction.disabled || context.loading}
							onClick={() => context.handleRefresh()}
							data-testid="timetable-simple-primary-action"
						>
							<RefreshCw className="size-3.5" aria-hidden="true" />
							<span>{setupRepair.label ?? lifecycleAction.label}</span>
						</Button>
					) : lifecycleAction.kind === 'fix-setup' && setupRepair.kind === 'navigate' ? (
						<Button asChild type="button" size="sm" className="order-first h-11 gap-1.5 px-3 text-sm lg:order-none" data-testid="timetable-simple-primary-action">
							<Link to={setupRepair.href ?? YEAR_SETUP_HREF}>
								<BookOpen className="size-3.5" aria-hidden="true" />
								{setupRepair.label ?? lifecycleAction.label}
							</Link>
						</Button>
					) : activeTask && activeTaskDefinition.href ? (
						<Button
							asChild
							size="sm"
							className="order-first h-11 min-w-28 gap-1.5 px-3 text-sm lg:order-none"
							disabled={activeTaskDefinition.disabled}
							data-testid="timetable-simple-primary-action"
						>
							<Link to={activeTaskDefinition.href}>
								{activeTaskDefinition.primaryLabel}
							</Link>
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							className="order-first h-11 min-w-28 gap-1.5 px-3 text-sm lg:order-none"
							disabled={activeTask ? activeTaskDefinition.disabled : lifecycleAction.disabled}
							onClick={() => activeTask ? void startTask(activeTaskDefinition.id) : handleLifecycleAction()}
							data-testid="timetable-simple-primary-action"
						>
							{lifecycleAction.kind === 'generating' || (lifecycleAction.kind === 'retry-readiness' && lifecycleAction.disabled)
								? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
								: lifecycleAction.kind === 'retry-generate' || lifecycleAction.kind === 'retry-readiness'
									? <RefreshCw className="size-3.5" aria-hidden="true" />
									: <CalendarClock className="size-3.5" aria-hidden="true" />}
							<span>{activeTask ? activeTaskDefinition.primaryLabel : lifecycleAction.label}</span>
						</Button>
					)}

					<DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 min-h-11 min-w-11 shrink gap-1 px-1.5 text-xs sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-2.5"
								aria-label="More"
								data-testid="timetable-simple-more-trigger"
							>
								<MoreHorizontal className="size-3.5" aria-hidden="true" />
								<span className="hidden sm:inline">More</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="max-h-[min(82svh,32rem)] w-80 overflow-y-auto scrollbar-thin p-2">
							<SimpleMoreMenuContent
								context={context}
								runToolsAvailable={runToolsAvailable}
								canPlanOrGenerate={canPlanOrGenerate}
								hideReviewIssues={moreHidesReviewIssues}
								onClose={() => setMoreOpen(false)}
								onStartTask={startTask}
								onOpenTeacherDeparture={openTeacherDeparture}
								onOpenRequests={openRequestsTask}
								onLayoutModeChange={onLayoutModeChange}
								onOpenTutorial={() => { setMoreOpen(false); setTutorialOpen(true); }}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			</div>
			{/* ── end of the one row band (TIMETABLE-HEADER-COLLAPSE-C01 D1) ── */}

			<SchedulerPrintDialog
				open={printPanelOpen}
				onOpenChange={setPrintPanelOpen}
				schoolId={context.schoolId}
				schoolYearId={context.schoolYearId}
				runId={exportRunId}
				termIndex={context.termFilter}
				yearLabel={exportYearLabel}
				viewMode={context.viewMode}
				entityFilter={context.entityFilter}
				onOpenPresentationSettings={() => setPresentationSettingsOpen(true)}
			/>

			{hasGeneratedRun ? (
				<ExportPresentationSettingsDialog
					schoolId={context.schoolId}
					schoolYearId={context.schoolYearId}
					yearLabel={exportYearLabel}
					open={presentationSettingsOpen}
					onOpenChange={setPresentationSettingsOpen}
				/>
			) : null}

			{/* A3 — day-start visibility now lives in the More menu, not the header row. */}

			{context.schoolYearId ? (
				<UnassignedInsertionWorkflow
					open={insertionOpen}
					onOpenChange={setInsertionOpen}
					schoolId={context.schoolId}
					schoolYearId={context.schoolYearId}
				/>
			) : null}

			{/* A3 — the NEXT STEP and the single action cluster live in the status
			    region and the action row above; the old stacked task-prompt bands
			    (with a second Generate/Publish/primary cluster) are removed so the
			    header has exactly one status region and one action row. */}
			{/* A3 — the tutorial dialog is opened from More; render it without an
			    inline trigger so the header keeps one action row. */}
			<SimpleTutorialControl triggerless open={tutorialOpen} onOpenChange={setTutorialOpen} lifecycle={capabilities.lifecycle} />

			<SimplePublishReadinessSheet
				open={readinessSheetOpen}
				onOpenChange={setReadinessSheetOpen}
				draft={context.draft}
				violations={context.violations}
				sectionLabel={context.sectionLabel}
				subjectLabel={context.subjectLabel}
				facultyLabel={context.facultyLabel}
				runWide={{
					blockingHardCount: context.blockingHardCount,
					unassignedCount: context.summary?.unassignedCount ?? 0,
					softCount: context.softCount,
				}}
			onNavigateToRepair={(href, reason, identity) => {
				setReadinessSheetOpen(false);
				// UX-R03e (setup) — one shared repair dispatch with the
				// `/timetable/setup` pane; the sheet-close stays here.
				dispatchSimpleReadinessRepair({
					href,
					reason,
					identity,
					navigate,
					violations: context.violations,
					setUnassignedReasonFilter: context.setUnassignedReasonFilter,
					setBlockerReasonFilter,
					startPlaceUnresolvedTask: () => { void startTask('place-unresolved'); },
					startReviewIssuesTask: () => { void startTask('review-issues'); },
					setSelectedViolation: context.setSelectedViolation,
					setSeverityFilter: context.setSeverityFilter,
					issueReviewEnabled: capabilities.gates.issueReview.enabled,
					onSetRepairOrigin,
				});
			}}
			/>
			{swapClassTimesMode != null ? (
				<div
					role="status"
					aria-live="polite"
					data-testid="timetable-swap-class-times-banner"
					className="border-b border-blue-200 bg-blue-50/80 px-3 py-2 text-sm"
				>
					<div className="flex items-center justify-between gap-2">
						<p className="min-w-0 truncate">
							{swapClassTimesMode === 'select-first' ? (
								<span className="text-blue-900"><span className="font-bold">Swap class times:</span> choose Class A on the grid.</span>
							) : (
								<span className="text-blue-900"><span className="font-bold">Swap class times:</span> Class A selected. Choose Class B on the grid.</span>
							)}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-11 shrink-0 gap-1.5 px-3 text-sm"
							data-testid="timetable-swap-class-times-cancel"
							onClick={() => onSwapClassTimesCancel?.()}
						>
							Cancel
						</Button>
					</div>
				</div>
			) : null}
		</header>
	);
}

export const TimetableSimpleHeader = memo(TimetableSimpleHeaderImpl);
