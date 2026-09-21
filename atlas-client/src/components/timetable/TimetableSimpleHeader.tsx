import { memo, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ArrowRightLeft,
	BookOpen,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	ClipboardCheck,
	History,
	Info,
	ListChecks,
	Loader2,
	MoreHorizontal,
	Play,
	GraduationCap,
	RefreshCw,
	Settings2,
	UserRoundX,
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
import { SimpleDayOptions } from '@/components/timetable/simple/SimpleDayOptions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import { TimetableStatusLegend } from '@/components/timetable/TimetableStatusLegend';
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
	sourceLabel,
	useSimpleTasks,
} from '@/components/timetable/simple/SimpleHeaderHelpers';
import {
	resolveSimpleReadiness,
	SimpleReadinessChip,
} from '@/components/timetable/simple/SimpleSetupSharedControls';
import { SimpleActiveFilterChips, SimpleFilterControls } from '@/components/timetable/simple/SimpleFilterControls';
import type { SimpleViewMode } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { SimpleExportErrorBanner, SimpleExportMenu, SimpleTermSwitcher } from '@/components/timetable/simple/SimpleBeneficiaryControls';
import { useSimpleExportSurface } from '@/components/timetable/simple/useSimpleExportSurface';
import type { SimpleExportKind } from '@/components/timetable/simple/simpleExportRequests';
import { SimpleDriftBanner } from '@/components/timetable/simple/SimpleDriftBanner';
import { SimpleMoreMenuContent } from '@/components/timetable/simple/SimpleMoreMenuContent';
import { ExportPresentationSettingsDialog } from '@/components/timetable/simple/ExportPresentationSettingsDialog';
import type { RolloverStatus } from '@/lib/settings';

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
	const readinessSheetOpen = readinessSheetOpenProp ?? readinessSheetOpenLocal;
	const setReadinessSheetOpen = onReadinessSheetOpenChange ?? setReadinessSheetOpenLocal;
	const [blockerReasonFilter, setBlockerReasonFilter] = useState<string | null>(null);
const [insertionOpen, setInsertionOpen] = useState(false);
	// R6/R7 — Simple consumes the same rollover/term-authority status Advanced
	// does, and that drift blocks generation exactly as it does in Advanced.
	const [rolloverStatus, setRolloverStatus] = useState<RolloverStatus | null>(null);
	const [lastEntityByMode, setLastEntityByMode] = useState<Partial<Record<SimpleViewMode, string>>>({});
	const visibleRunId = context.draft?.runId ?? null;
	const visibleYearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? (context.schoolYearId ? `SY #${context.schoolYearId}` : null);
	const source = sourceLabel(context);
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
	const setupOperatorMessage = 'Setup needs attention before ATLAS can generate a timetable. Review the reported setup item, then check readiness again.';
	const canPlanOrGenerate = scopeResolved && generationReady && !context.loading;
	// R7 — the shared capability model is the production guard for every Simple
	// task action (publish/swap/review), not just generation.
	const tasks = useSimpleTasks(context, capabilities.gates);
	const recommendedTask = chooseRecommendedTask(tasks, context);
	const activeTaskDefinition = tasks.find((task) => task.id === activeTask) ?? recommendedTask;
	const ActiveIcon = activeTaskDefinition.icon;
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

	// Official beneficiary downloads are bound to exactly one selected ordered
	// term. "All terms" resolves to no request so nothing mixed-term is exported.
	// UX-R03c — the descriptors and the single-flight dispatch live in the shared
	// export surface hook (also consumed by the /timetable/exports center view);
	// the header control below is untouched.
	const exportRunId = context.draft?.runId ?? context.activeGeneratedRunId ?? null;
	const exportFacultyId = context.viewMode === 'faculty' && context.entityFilter ? Number(context.entityFilter) : null;
	// C05 T9/M18 — the persisted school-year label keeps client filenames
	// byte-identical to the server `Content-Disposition` identity.
	const exportYearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? null;
	// UX-R03c — the header consumes resolveSimpleExportRequest('summary-teacher-schedule'),
	// resolveSimpleExportRequest('class-program') and resolveSimpleExportRequest('teacher-program')
	// plus await dispatchSimpleExport(descriptor) through useSimpleExportSurface (shared with the
	// /timetable/exports center view). The menu/dialog JSX and the M17 re-entry gate stay here untouched.
	const {
		summaryExport,
		classProgramExport,
		teacherProgramExport,
		exportingKind,
		exportError,
		setExportError,
		handleSimpleExport: dispatchExport,
	} = useSimpleExportSurface({
		schoolId: context.schoolId,
		schoolYearId: context.schoolYearId,
		runId: exportRunId,
		termFilter: context.termFilter,
		facultyId: exportFacultyId,
		yearLabel: exportYearLabel,
	});

	const handleSimpleExport = (kind: SimpleExportKind) => {
		// M17 pins this re-entry gate in the header source; the shared surface
		// owns the identical single-flight guard for every consumer.
		if (exportingKind !== null) return;
		void dispatchExport(kind);
	};

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
			{/* C01R C3 — one status surface: this card is the header's only status
			    strip. The drift message renders here as its message line (inline,
			    no sibling amber strip), the hidden-row controls live in the Day
			    options popover below, and the two mutually exclusive task-prompt
			    blocks are the region's two states (never collapsed into one).
			    Disclosure stays on @/ui Popover/Tooltip; every repair action
			    keeps its testid and dispatch. The source/readiness/filter/action
			    row follows outside the region. */}
			<section data-testid="timetable-simple-status-region" role="region" aria-label="Timetable status" className="mx-3 mb-1 mt-1 min-w-0 rounded-lg border border-border bg-muted/20 px-2 py-1 shadow-sm sm:px-3">
			{/* R6 — run input freshness, ordered-term authority, and rollover drift are
			    visible in Simple before publish or sync, with routed repairs. */}
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
			/>
			{/* Keep source, readiness, schedule choice, and actions in one non-overlapping row. */}
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-x-auto overflow-y-visible px-3 py-1.5 lg:flex-nowrap lg:overflow-hidden [&>*]:min-w-0">
				<Badge
					variant="outline"
					className={cn(
						'h-6 min-w-0 max-w-[28vw] shrink gap-1.5 truncate px-2 text-xs font-semibold sm:max-w-[30rem]',
						context.schoolYearContext?.source === 'enrollpro-verified'
							? 'border-emerald-200 bg-emerald-50 text-emerald-800'
							: 'border-amber-200 bg-amber-50 text-amber-900',
					)}
					data-testid="timetable-simple-source-chip"
				>
					<Info className="size-3.5 shrink-0" aria-hidden="true" />
					<span className="truncate">{source}</span>
					{visibleYearLabel ? <span className="hidden sm:inline">· {visibleYearLabel}</span> : null}
					{visibleRunId ? <span className="hidden sm:inline">· Run #{visibleRunId}</span> : null}
				</Badge>

			{/* UX-R03e (setup) — one shared chip implementation with the `/timetable/setup` pane. */}
			<SimpleReadinessChip
				readiness={readiness}
				publishBlocked={publishBlocked}
				blockingHardCount={context.blockingHardCount}
			/>
				<Badge
					variant="outline"
					className={cn(
							'h-6 shrink-0 gap-1.5 px-2 text-xs font-semibold hidden 2xl:inline-flex',
						context.referenceLookupStatus.state === 'ready'
							? 'border-emerald-200 bg-emerald-50 text-emerald-800'
							: context.referenceLookupStatus.state === 'needs-refresh'
								? 'border-amber-200 bg-amber-50 text-amber-900'
								: 'border-border bg-muted text-muted-foreground',
					)}
					data-testid="timetable-lookup-status"
				>
					{context.referenceLookupStatus.label}
				</Badge>

				<div className="hidden min-w-0 flex-1 lg:flex lg:shrink-0 lg:min-w-[24rem]">
					<SimpleScheduleControls
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
				</div>

				<div className="order-last flex w-full min-w-0 shrink-0 items-center justify-start gap-1.5 overflow-x-auto lg:order-none lg:ml-auto lg:w-auto lg:max-w-[48vw] lg:justify-end">
					<SimpleTermSwitcher context={context} />
					<SimpleFilterControls context={context} renderActiveFilters={false} />
					<SimpleScheduleSheet
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
					<SimpleTutorialControl open={tutorialOpen} onOpenChange={setTutorialOpen} lifecycle={capabilities.lifecycle} />
					{hasGeneratedRun ? (
						<SimpleExportMenu
							summary={summaryExport}
							classProgram={classProgramExport}
							teacherProgram={teacherProgramExport}
							showTeacherProgram={context.viewMode === 'faculty' && Boolean(context.entityFilter)}
							needsTerm={context.termFilter === 'all'}
							exportingKind={exportingKind}
							onExport={(kind) => { void handleSimpleExport(kind); }}
							onOpenPresentationSettings={() => setPresentationSettingsOpen(true)}
						/>
					) : null}

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
						<DropdownMenuContent align="end" className="max-h-[min(82svh,32rem)] w-80 overflow-y-auto p-2">
							<SimpleMoreMenuContent
								context={context}
								runToolsAvailable={runToolsAvailable}
								canPlanOrGenerate={canPlanOrGenerate}
								onClose={() => setMoreOpen(false)}
								onStartTask={startTask}
								onOpenTeacherDeparture={openTeacherDeparture}
								onOpenRequests={openRequestsTask}
								onLayoutModeChange={onLayoutModeChange}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<SimpleActiveFilterChips context={context} />
			</div>

			<SimpleExportErrorBanner
				error={exportError}
				onRetry={(kind) => { void handleSimpleExport(kind); }}
				onDismiss={() => setExportError(null)}
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

			{/* C01R C3 — day-start visibility is disclosed through the Day options
			    popover (one implementation in `simple/SimpleDayOptions`) instead
			    of a sibling strip. */}
			{(context.policyAlignmentWarning || context.hiddenRowCount > 0) && (
				<SimpleDayOptions
					policyAlignmentWarning={context.policyAlignmentWarning}
					hiddenRowCount={context.hiddenRowCount}
					showFullDay={context.showFullDay}
					onToggleFullDay={() => context.setShowFullDay(!context.showFullDay)}
				/>
			)}

			{context.schoolYearId ? (
				<UnassignedInsertionWorkflow
					open={insertionOpen}
					onOpenChange={setInsertionOpen}
					schoolId={context.schoolId}
					schoolYearId={context.schoolYearId}
				/>
			) : null}

			{!hasGeneratedRun && !context.isPreGenerationWorkspace ? (
				<div
					className="flex min-w-0 items-center justify-between gap-2 py-0.5"
					data-testid="timetable-simple-task-prompt"
					aria-label="Timetable next step"
				>
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border sm:size-6">
							<CalendarClock className="size-4 sm:size-4.5" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="hidden text-xs font-bold uppercase tracking-wide text-muted-foreground sm:block">Get started</p>
							<p className="truncate text-sm font-semibold text-foreground" data-testid="timetable-simple-next-action">
								No timetable exists for {visibleYearLabel ?? 'the active school year'}
							</p>
							{setupBlockedDiagnostic ? (
								<TooltipProvider delayDuration={200}>
									<Tooltip>
										<TooltipTrigger asChild>
											<p
												className="break-words text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
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
							) : (
								<p className="break-words text-xs text-muted-foreground" data-testid="timetable-curriculum-readiness-message">
									{setupState.message}
								</p>
							)}
							{setupRepair.kind === 'navigate' && !setupRepairTargetsCurrentRoute && (
								<p className="text-xs text-muted-foreground" data-testid="timetable-setup-repair-hint">
									{setupRepair.label ? `Fix this in ${setupRepair.label}.` : 'Finish setup before generating.'}
								</p>
							)}
							{latestRunFailed && (
								<p className="break-words text-xs font-medium text-red-700" data-testid="timetable-last-generation-failed-message">
									The last generation run failed. Review setup, then try generating again.
								</p>
							)}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
						<TimetableStatusLegend compact />
						{/* UX-QUICKFIX-C01 — Generate stays visible before a run exists,
						    gated by the same readiness decision as the lifecycle action. */}
						<SimpleGenerateAction
							disabled={generateActionState.disabled}
							disabledReason={generateActionState.reason}
							onClick={handleGenerateClick}
						/>
						{setupRepairIsInPlace ? (
							<Button
								type="button"
								size="sm"
								className="h-11 gap-1.5 px-3 text-sm"
								disabled={lifecycleAction.disabled || context.loading}
								onClick={() => context.handleRefresh()}
								data-testid="timetable-simple-primary-action"
							>
								<RefreshCw className="size-3.5" aria-hidden="true" />
								<span>{setupRepair.label ?? lifecycleAction.label}</span>
							</Button>
						) : lifecycleAction.kind === 'fix-setup' && setupRepair.kind === 'navigate' ? (
							<Button asChild type="button" size="sm" className="h-11 gap-1.5 px-3 text-sm" data-testid="timetable-simple-primary-action">
								<Link to={setupRepair.href ?? YEAR_SETUP_HREF}>
									<BookOpen className="size-3.5" aria-hidden="true" />
									{setupRepair.label ?? lifecycleAction.label}
								</Link>
							</Button>
						) : (
							<Button
								type="button"
								size="sm"
								className="h-11 gap-1.5 px-3 text-sm"
								disabled={lifecycleAction.disabled}
								onClick={handleLifecycleAction}
								data-testid="timetable-simple-primary-action"
							>
								{lifecycleAction.kind === 'generating' || (lifecycleAction.kind === 'retry-readiness' && lifecycleAction.disabled)
									? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
									: lifecycleAction.kind === 'retry-generate' || lifecycleAction.kind === 'retry-readiness'
										? <RefreshCw className="size-3.5" aria-hidden="true" />
										: <CalendarClock className="size-3.5" aria-hidden="true" />}
								<span>{lifecycleAction.label}</span>
							</Button>
						)}
						{generationReady && (
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
						)}
					</div>
				</div>
			) : (
				<div
					className="flex min-w-0 items-center justify-between gap-2 py-0.5"
					data-testid="timetable-simple-task-prompt"
					aria-label="Timetable next step"
				>
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border sm:size-6">
							<ActiveIcon className="size-4 sm:size-4.5" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="hidden text-xs font-bold uppercase tracking-wide text-muted-foreground sm:block">Next step</p>
							<p className="truncate text-sm font-semibold text-foreground" data-testid="timetable-simple-next-action">
								{activeTask ? activeTaskDefinition.label : lifecycleAction.label}
							</p>
							<p className="hidden text-sm text-muted-foreground sm:block">{activeTask ? activeTaskDefinition.helper : readiness}</p>
						</div>
					</div>

					{publishBlocked && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="hidden min-w-0 items-center gap-1.5 border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 sm:flex"
							data-testid="timetable-publish-readiness-summary"
							onClick={() => setReadinessSheetOpen(true)}
						>
							<span className="truncate">{publishBlockedReason}</span>
							<ChevronRight className="size-3 shrink-0" aria-hidden="true" />
						</Button>
					)}
					{isRunPublished && !publishBlocked && (context.summary?.unassignedCount ?? 0) > 0 && (
						<div
							className="hidden min-w-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 sm:flex"
							data-testid="timetable-publish-readiness-summary"
						>
							<CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
							<span className="truncate">Published — {context.summary?.unassignedCount} follow-up item{(context.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} remain</span>
						</div>
					)}

					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
					<TimetableStatusLegend compact />
					{/* UX-QUICKFIX-C01 — Generate and Publish are always reachable without
					    opening More. Generate is gated on the readiness decision; Publish
					    is gated on the shared publication capability. A published run
					    shows the published state instead of a dead disabled Publish. */}
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
					{suppressPrimaryAction ? null : activeTask && activeTaskDefinition.href ? (
						<Button
							asChild
							size="sm"
							className="h-11 min-w-28 gap-1.5 px-3 text-sm"
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
							className="h-11 min-w-28 gap-1.5 px-3 text-sm"
							disabled={activeTask ? activeTaskDefinition.disabled : lifecycleAction.disabled}
							onClick={() => activeTask ? void startTask(activeTaskDefinition.id) : handleLifecycleAction()}
							data-testid="timetable-simple-primary-action"
						>
							{activeTask ? activeTaskDefinition.primaryLabel : lifecycleAction.label}
						</Button>
					)}
				</div>
			</div>
			)}
			</section>

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
