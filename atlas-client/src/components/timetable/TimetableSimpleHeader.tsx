import { memo, useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { deriveSimpleLifecycleAction } from '@/lib/simple-timetable-state';
import { deriveTimetableCapabilities, describeSetupState, YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness, generationBlockedOperatorSentence, readReadinessAttempts } from '@/lib/timetable-generation-readiness';
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
	resetSimpleWorkspaceFilters,
	resolvePublishBlockTruth,
	useSimpleTasks,
} from '@/components/timetable/simple/SimpleHeaderHelpers';
import {
	resolveSimpleReadiness,
	SimpleReadinessChip,
} from '@/components/timetable/simple/SimpleSetupSharedControls';
import type { SimpleViewMode } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { SimpleTermSwitcher } from '@/components/timetable/simple/SimpleBeneficiaryControls';
// A2-C6-TRUTH (T3a/T3b/T3c/T3f): the shared run identity, the one term line, and
// the capped status region.
import { resolveDraftStripProps, resolveDraftStripPublishPlan } from '@/components/timetable/TimetableDraftStateStrip';
/* A2 HEADER-BUDGET — the title/tabs row (row 1), the ONE `describeRunState`
   derivation, and row 2's extracted draft actions + task dispatcher.
   A7 c14 (operator, 2026-09-30 08:15) — the header's ONE control row now renders
   `TimetablePageHeading` (the same `<h1>`, no tabs) and the five section links
   moved into `More` (`TimetableSubNavLinks variant="menu"`), so the tab row is
   no longer on screen above the grid. */
import { TimetablePageHeading } from '@/components/timetable/TimetableSubNav';
import { describeRunState } from '@/components/timetable/RunStateBadge';
import { SimpleHeaderStatusLine } from '@/components/timetable/simple/SimpleHeaderStatusLine';
import { createSimpleTaskStarter } from '@/components/timetable/simple/SimpleHeaderTasks';
// A2 C12 / ITEM H — the armed-swap band and the generation-blocker sheet now
// render as SIBLINGS of the `<header>` element, not as children of it. The banner
// is still rendered, unchanged, whenever a swap is armed.
import { SimpleHeaderTrailingSurfaces } from '@/components/timetable/simple/SimpleHeaderTrailingSurfaces';
import { buildSimpleHeaderMessages } from '@/components/timetable/simple/SimpleHeaderMessages';
import {
	countUnassignedForSelectedTerm,
	lifecycleStepNeedsMoreEntry,
	resolveSimpleHeaderPrimary,
	resolveWarningsControlDispatch,
	SimpleMoreScheduleActions,
	SimpleUnassignedSessionsItem,
	SimpleWarningsControl,
} from '@/components/timetable/simple/SimpleHeaderActions';
import { resolveSimpleDraftMenuActions } from '@/components/timetable/TimetableDraftActionsSurface';
import { useRunChangeNotice } from '@/components/timetable/simple/SimpleHeaderChangeNoticeSlot';
import { SimpleMoreMenuContent, SimpleMoreScrollRegion } from '@/components/timetable/simple/SimpleMoreMenuContent';
import { resolveTermAuthorityNotice } from '@/hooks/useTimetableData';
import { ExportPresentationSettingsDialog } from '@/components/timetable/simple/ExportPresentationSettingsDialog';
import { SchedulerPrintDialog } from '@/components/timetable/simple/SchedulerPrintDialog';
import { fetchRolloverStatus, type RolloverStatus } from '@/lib/settings';
import { readRolloverAwarenessNotice } from '@/lib/rollover-awareness';
import { dispatchSimpleReadinessRepair as dispatchReadinessRepair } from '@/components/timetable/simple/SimpleReadinessRepairDispatch';
import { planningStateSentence } from '@/lib/timetable-plain-language';

/* A2 C13 — the prop shape moved to `simple/SimpleHeaderReadinessTypes.ts` for the
   same reason the two types below moved there under A2 HEADER-BUDGET: this file sat
   at 999 physical lines and §8 says to EXTRACT a block, never to delete a comment
   to make room. It is pure data, re-exported below, so the component signature and
   every importer path are unchanged. */
import {
	SimpleReadinessRepairDeps,
	SimpleReadinessRepairIdentity,
	TimetableSimpleHeaderProps,
} from '@/components/timetable/simple/SimpleHeaderReadinessTypes';
export type { SimpleReadinessRepairDeps, SimpleReadinessRepairIdentity, TimetableSimpleHeaderProps };

/** Stable shared entry point for readiness repairs; implementation lives with the helper. */
export function dispatchSimpleReadinessRepair(context: SimpleReadinessRepairDeps): void {
	dispatchReadinessRepair(context);
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
	undoRedoControl,
	onDiscardDraft,
}: TimetableSimpleHeaderProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);
	const [tutorialOpen, setTutorialOpen] = useState(false);
	const [readinessSheetOpenLocal, setReadinessSheetOpenLocal] = useState(false);
	// C2-a — the generation-blocker disclosure. It is its own surface from the
	// publication readiness sheet: one answers "why can't I publish?" about a
	// run that exists, the other answers "why can't a timetable be made at all?".
	const [blockerSheetOpen, setBlockerSheetOpen] = useState(false);
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
	// Row 46 — "Refresh school names" has no visible effect, so the refresh is
	// acknowledged in the status region above the action row. It is cleared when
	// the run on screen changes, so the cue can never claim a refresh that
	// belongs to a different schedule.
	const [schoolNamesRefreshed, setSchoolNamesRefreshed] = useState(false);
	useEffect(() => {
		setSchoolNamesRefreshed(false);
	}, [context.draft?.runId]);
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
		// A8 C5 CORRECTION 2 (F4): the attempt FACT, so the Generate dialog never
		// claims two tries on the path where the scope guard refused before any read.
		curriculumReadinessAttempts: readReadinessAttempts(context.curriculumReadiness),
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
	/* C11 S2 (items 1/2) — ONE shared gate for the change notice, shared with the
	 * Expert layout and carrying the run's own timing (T3c). It used to be computed
	 * here with NO timing, so `deriveRunFreshness` kept the server's verdict and
	 * reported `trustworthy: true` for ANY comparison — which is why a notice
	 * appeared on a published run that had not changed since it was made. */
	const changeNotice = useRunChangeNotice({
		context,
		capabilities,
		isPublished: isRunPublished,
		generationEnabled: generationReady,
		/* A7 c14 (operator, 2026-09-30 08:15) — the status line carries the sentence
		 * and `See what changed`; `Update schedule` is mounted by the `More` menu off
		 * `changeNotice.regenerateAvailable`. `onRegenerate` is still handed over so
		 * the hook keeps ONE definition of "what applying a drift dispatches", but no
		 * apply control is rendered in the row/status line. */
		onRegenerate: () => context.handleTriggerGenerate(capabilities.generationStoppers),
		includeApplyAction: false,
	});
	const showDriftState = changeNotice.show;
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
	// C2-a — the operator sentence is the shared, count-true derivation, not a
	// hard-coded string. The old copy ("Review the item shown") promised an item
	// the client never rendered, which is what made a blocked generation a dead
	// end. This one states the consequence, the real count, and where the real
	// list is.
	// A8 C3 — this is the BLOCKING count, not `blockers.length`. A teacher gap is
	// a setup fact the run carries and names, so it must not make the chip say
	// "651 setup items to fix"; the gaps are reported by the readiness panel in
	// classes. A payload with no `blockerCount` falls back to the row count and
	// therefore fails closed.
	const setupBlockerCount = context.curriculumReadiness?.state === 'blocked'
		? context.curriculumReadiness.diagnostic.blockerCount
		: 0;
	const setupOperatorMessage = setupBlockedDiagnostic
		? generationBlockedOperatorSentence({ blockerCount: setupBlockerCount, setupLabel: setupState.label })
		: '';
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
	// C1-b — one derivation shared with `chooseRecommendedTask` and the task
	// badge. The recommended task and the lifecycle next step now read the same
	// `blockingHardCount`, so the header cannot recommend "Review issues" while
	// it also reports "Ready to publish". A HARD violation that does not block
	// publication is still real, so the difference is stated in plain words in
	// the existing status region below rather than implied away. It is a
	// paragraph, not a control, so the accepted ≤6 visible-control cap holds.
	const publishBlockTruth = resolvePublishBlockTruth(context);
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
		// A2 C13 — the gate's own short form, so the visible sentence beside the
		// disabled control comes from the same `denied()` call as its aria-label.
		gateShortReason: generationGate.shortReason,
	});
	const publishActionState = resolveSimplePublishActionState({
		publicationEnabled: capabilities.gates.publication.enabled,
		isRunPublished,
		gateReason: capabilities.gates.publication.reason,
		gateShortReason: capabilities.gates.publication.shortReason,
	});
	// C01R C1 — one publish control per state: while the publish slot owns its
	// lifecycle step, no More "Next step" entry is added either.
	const primaryRendersPublish = activeTask
		? activeTaskDefinition.id === 'publish'
		: lifecycleAction.kind === 'publish';
	const primaryIsPublished = activeTask
		? (activeTaskDefinition.id === 'publish' && isRunPublished)
		: lifecycleAction.kind === 'published';
	const suppressPrimaryAction = primaryRendersPublish || primaryIsPublished;

	// C11 D — the ONE derivation the More-menu `Edit draft` / `Discard draft` entries
	// read, so neither can disagree about whether an action is available.
	const draftStrip = resolveDraftStripProps({
		isPreGeneration: context.isPreGenerationWorkspace,
		runId: context.draft?.runId ?? null,
		isPublished: isRunPublished,
		publicationGateEnabled: capabilities.gates.publication.enabled,
		hasSelectedClass: context.hasSelectedEntry,
		hasDraft: context.draft != null,
	});
	/**
	 * C11 D — the ONE publication rule, now shared with
	 * `resolveDraftStripPublishPlan` so no surface can become a second publication
	 * path. The order and the two branches are unchanged from the inline body this
	 * replaced: R7 (the shared capability model is the guard, not a local count), and
	 * C07B/F2 (an open gate routes to the publish task, a real readiness surface that
	 * renders the checklist, instead of leaving that component dead).
	 */
	const handlePublishClick = () => {
		const plan = resolveDraftStripPublishPlan({
			isPublished: isRunPublished,
			publicationGateEnabled: capabilities.gates.publication.enabled,
		});
		if (plan.kind === 'disabled') return;
		if (resolvePublishTaskDispatch(plan.kind === 'publish-task' ? capabilities.gates.publication.enabled : false) === 'publish-task') {
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
		// A8-C5 S2.3 — the click hands over ITS OWN stoppers, so the Generate dialog
		// can name the same causes this header derives, drift included.
		context.handleTriggerGenerate(capabilities.generationStoppers);
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
				if (generationReady) context.handleTriggerGenerate(capabilities.generationStoppers);
				break;
			case 'retry-generate': context.handleTriggerGenerate(capabilities.generationStoppers); break;
			case 'retry-readiness': context.handleRefresh(); break;
			case 'fix-blockers': setReadinessSheetOpen(true); break;
			case 'review-warnings': void startTask('review-issues'); break;
			case 'publish': handlePublishClick(); break;
			case 'review-follow-ups': void startTask('place-unresolved'); break;
			case 'generating':
			case 'published': break;
		}
	};

	// DRAFT-UX-C01 (operator, 2026-09-25) — the relaxed header: at ≥1280 px at most
	// six visible controls, and ONE primary. See `resolveSimpleHeaderPrimary`.
	const headerPrimary = resolveSimpleHeaderPrimary({
		hasGeneratedRun,
		isRunPublished,
		isPreGenerationWorkspace: context.isPreGenerationWorkspace,
	});
	// C11 D, correction 2 (QA-B2) — the actions this header no longer renders as
	// buttons, resolved ONCE above: `Edit draft` and `Discard draft` in the More
	// menu, and `Publish` there only while the primary slot is not the publication
	// control. See `TimetableDraftActionsSurface`.
	const simpleDraftMenuActions = resolveSimpleDraftMenuActions({
		headerPrimary,
		draftStrip,
		onPublish: handlePublishActionClick,
		onEdit: typeof context.enterManualEditView === 'function'
			? () => context.enterManualEditView('CHANGE_TIMESLOT')
			: null,
		onDiscard: onDiscardDraft ?? null,
	});
	/* A7 c14 (operator, 2026-09-30 08:15) — `stripDraftActions` (the row-2 draft
	 * buttons) and `SimpleHeaderDraftActions` are REMOVED from the header: `Edit
	 * draft` / `Discard draft` render ONLY in the `More` menu, from the SAME
	 * `simpleDraftMenuActions` object resolved above. The row no longer carries a
	 * second renderer, which is what removes the `timetable-draft-strip-*` copies
	 * from the header DOM. */
	const runState = describeRunState({
		isPreGeneration: context.isPreGenerationWorkspace,
		runId: context.draft?.runId ?? null,
		isPublished: isRunPublished,
	});
	/* A7 c14 — the plain state word for the ONE status line when there is no run
	 * sentence to name (no draft yet, or a pre-generation workspace). It is
	 * presentation only: it does not decide anything, and it never joins the
	 * counted control budget because it is text, not a control. */
	const statusFallbackLabel = context.isPreGenerationWorkspace
		? planningStateSentence()
		: hasGeneratedRun
			? runState.badgeLabel
			: 'Ready to build a schedule';
	/* A7 c14 — the drift's ONE apply action, mounted in the `More` menu when (and
	 * only when) a trustworthy drift is claimed. `onSelect` is the SAME workspace
	 * generation trigger the drift banner's confirm uses, so there is still exactly
	 * ONE regeneration path. */
	const updateScheduleAction = changeNotice.regenerateAvailable
		? {
			visible: true,
			disabled: !generationReady || context.generating || context.loading,
			reason: context.generating
				? 'A schedule build is already running.'
				: context.loading
					? 'ATLAS is still checking schedule information.'
					: generationGate.shortReason,
			onSelect: () => context.handleTriggerGenerate(capabilities.generationStoppers),
		}
		: null;
	const warningsDispatch = resolveWarningsControlDispatch({
		lifecycleKind: lifecycleAction.kind,
		issueReviewEnabled: capabilities.gates.issueReview.enabled,
		// C2-a — a real count opens the real list. A blocked check that reported no
		// blockers never claims to have items to show.
		generationBlockerCount: setupBlockerCount,
	});
	const handleWarningsClick = () => {
		if (warningsDispatch === 'generation-blockers') {
			setBlockerSheetOpen(true);
			return;
		}
		if (warningsDispatch === 'readiness-sheet') {
			setReadinessSheetOpen(true);
			return;
		}
		if (warningsDispatch === 'review-issues') void startTask('review-issues');
	};
	// C7 — the review action is never offered twice: More drops its entry while
	// the merged warnings control (or an armed review task) owns it.
	/* A7 c12b / decision 8 (CORRECTION item 1) — the `Expert tools` group (and with
	 * it the More `Review issues` row) is deleted outright, so the C7 de-duplication
	 * decision is no longer needed at this call site. `primaryDispatchesReviewIssues`
	 * stays exported and unit-tested; the warnings control is still the one owner of
	 * the review action. */
	// The former lifecycle primary's remaining next steps keep one More entry.
	const moreNextStep = suppressPrimaryAction ? null
		: setupRepairIsInPlace
			? { label: setupRepair.label ?? lifecycleAction.label, disabled: lifecycleAction.disabled || context.loading, href: null, onSelect: () => context.handleRefresh() }
			: lifecycleAction.kind === 'fix-setup' && setupRepair.kind === 'navigate'
				? { label: setupRepair.label ?? lifecycleAction.label, disabled: false, href: setupRepair.href ?? YEAR_SETUP_HREF, onSelect: () => undefined }
				: lifecycleStepNeedsMoreEntry(lifecycleAction.kind)
					? { label: lifecycleAction.label, disabled: lifecycleAction.disabled, href: null, onSelect: handleLifecycleAction }
					: null;
	// S5 — the Simple layout's unassigned entry counts the selected term only.
	const selectedTermLabel = typeof context.termFilter === 'number' ? `Term ${context.termFilter}` : 'All terms';
	/* A2-C6-TRUTH (T3b/T3c) built a second `viewingTermLabel` for the term SCOPE LINE so
	 * the line and the selector could never name the term differently. That line is no
	 * longer rendered here — §8 forbids a truncated sentence and all of its spans were
	 * `lg:truncate`, which is where the operator saw `Term: Viewi…` and `school is i…`.
	 * The `Term` picker in row 2 is now the single place the viewed term is named.
	 * `SimpleTermScopeLine`/`termScopeLineParts` are NOT touched: they stay exported and
	 * asserted, and the Expert orientation row still renders the line. */
	const headerMessages = buildSimpleHeaderMessages({
		latestRunFailed,
		nonBlockingHardCount: publishBlockTruth.nonBlockingHardCount,
		schoolNamesRefreshed,
		setupBlockedDiagnostic,
		setupOperatorMessage,
	});
	// A2 HEADER-BUDGET — the trailing band's notices. The setup-blocked paragraph is
	// filtered out HERE, not in the band: §8 gives the header ONE status chip, its label
	// is the short `N setup items to fix`, and the long sentence it replaced is that
	// chip control's `@/ui` Tooltip. Every other id keeps element, wording and testid.
	const bandMessages = headerMessages.filter((message) => message.id !== 'timetable-curriculum-readiness-message');
	/* A5 (2026-09-30) — the panel title and this More-menu item read ONE source.
	 * The workspace hook derives the selected term's unplaced count once and
	 * hands it to both contexts; this is that field. The local derivation is only
	 * the fallback for a fixture that predates the field. */
	const unassignedForTerm = context.unassignedCountForSelectedTerm ?? countUnassignedForSelectedTerm(
		context.draft?.unassignedItems as Array<{ termIndex?: number | null }> | undefined,
		context.termFilter,
	);
	const unassignedUnavailable = context.isPreGenerationWorkspace
		? 'Classes needing a time slot belong to a generated schedule; this is the working draft.'
		: !hasGeneratedRun ? 'No schedule yet.' : null;

	const exportRunId = context.draft?.runId ?? context.activeGeneratedRunId ?? null;
	const exportYearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? null;

	/* A7 c12b (decision 8 / CORRECTION item 5) — `View past years` moved out of the
	 * year banner and into More, so the header reads the ONE persisted rollover
	 * notice (the same durable record the AppShell banner hydrates) and offers the
	 * previous year's history link only when a rollover actually happened. No second
	 * source of "is there a previous year" is invented. */
	const pastYearsHref = useMemo(() => {
		if (!context.schoolId) return null;
		const notice = readRolloverAwarenessNotice(context.schoolId);
		return notice ? `/teaching-load/history?schoolYearId=${notice.previousSchoolYearId}` : null;
	}, [context.schoolId]);

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

	const startTask = createSimpleTaskStarter({
		context,
		capabilities,
		onTaskChange,
		onSwapClassTimesStart,
		handlePublishClick,
	});

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

	/* ── A7 c14 (operator, 2026-09-30 08:15) — the header BOX is ONE control row
	 * plus ONE status line, and nothing else ───────────────────────────────────
	 *
	 * THE OPERATOR'S INSTRUCTION, verbatim: "above the grid only ONE row: Term,
	 * Show (Section / Teacher / Room), Schedule for, and on the right one primary
	 * action (Publish schedule when a draft is ready, else Build a new draft) plus
	 * More. Everything else … moves into More or a single status line under the
	 * row, in plain words." What that changed here:
	 *   - the title/tabs row and the picker row COLLAPSED into one
	 *     `timetable-simple-header-row`: the page heading (not a control), `Term`,
	 *     `Show`, `Schedule for`, the ONE primary and `More`;
	 *   - the five section links moved into `More`
	 *     (`TimetableSubNavLinks variant="menu"`), so `timetable-sub-nav` is no
	 *     longer on screen above the grid — see `ScheduleReviewWorkspace`, which
	 *     still skips the standalone band for the Simple chrome;
	 *   - `Edit draft` / `Discard draft` no longer render as row buttons (only in
	 *     `More`), and the change-row wrapper is gone;
	 *   - the second band is the ONE `SimpleHeaderStatusLine`
	 *     (`data-testid="timetable-simple-status-line"`), which carries the run
	 *     state, the readiness/warnings control, the change sentence +
	 *     `See what changed`, and the capped notices. `Update schedule` is a `More`
	 *     entry, not a status-line control.
	 *
	 * `SimpleHeaderTrailingSurfaces` below still renders the armed-swap banner and
	 * the portal-mounted blocker sheet as SIBLINGS of `</header>` (unchanged): the
	 * header box otherwise renders exactly the two bands above. NO state and NO
	 * handler moved; only their JSX position did. */
	return (
		<>
		<header className="shrink-0 border-b border-border bg-background" data-testid="timetable-simple-header">
			{/* A7 c14 — ONE control row, `lg:flex-nowrap` so it holds a single visual
			   line at 1366 px and wraps only below `lg`. */}
			<div
				className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-1.5 lg:flex-nowrap"
				data-testid="timetable-simple-header-row"
			>
				{/* The page title, not a control, from the ONE shared heading. */}
				<TimetablePageHeading />

				<SimpleTermSwitcher context={context} />

				{/* Desktop face of the Show/`Schedule for` pickers; the compact Sheet
				    trigger below is the touch-sized face (`lg:hidden`), never a second
				    desktop control. */}
				<div className="hidden min-w-0 lg:flex lg:shrink-0">
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

				<div className="flex min-w-0 flex-wrap items-center gap-1.5 pr-3 lg:ml-auto lg:flex-nowrap lg:justify-end">
					{/* DRAFT-UX-C01 (operator, 2026-09-25) — the ONE solid primary:
					    `Generate` with no generated run, `Publish schedule` once a run
					    exists. See `resolveSimpleHeaderPrimary`. */}
					{headerPrimary === 'generate' ? (
						<SimpleGenerateAction
							primary
							actionState={generateActionState}
							onClick={handleGenerateClick}
							published={false}
						/>
					) : headerPrimary === 'publish' ? (
						<SimplePublishAction
							actionState={publishActionState}
							primary
							onClick={handlePublishActionClick}
						/>
					) : headerPrimary === 'published' ? (
						<SimplePublishedState followUpCount={context.summary?.unassignedCount ?? 0} />
					) : null}

					{/* M5 — the single existing Undo / Redo / History control: the SAME component
					    the Expert toolbar rendered, and there is exactly one
					    (A2-TIMETABLE-CUSTODY). `hideWhenIdle` is the ONE new prop: the cluster
					    hides when nothing can act on it. The node is the workspace's — the
					    header builds no second one. */}
					{undoRedoControl}

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
					{/* #50 — the scroll region, its height and its overflow cue all live
					    in `SimpleMoreScrollRegion`, so the menu has one owner for "how
					    much of this list can the scheduler see". */}
					<DropdownMenuContent align="end" className="w-80 p-0">
						<SimpleMoreScrollRegion>
						<div className="space-y-2">
								<SimpleMoreScheduleActions
									onClose={() => setMoreOpen(false)}
									downloadAvailable={hasGeneratedRun}
									onOpenDownloadSchedules={() => setPrintPanelOpen(true)}
									schoolInformationLabel={showDriftState ? 'Check school information' : 'School information'}
									generate={{
										visible: headerPrimary !== 'generate',
										disabled: generateActionState.disabled,
										reason: generateActionState.reason,
										published: isRunPublished,
										onSelect: handleGenerateClick,
									}}
									previewDemand={{
										visible: generationReady && !hasGeneratedRun,
										disabled: !canPlanOrGenerate,
										onSelect: () => setInsertionOpen(true),
									}}
									returnToPublished={{
										visible: context.isPreGenerationWorkspace && Boolean(context.hasPublishedReturnState),
										onSelect: context.returnToGeneratedRun,
									}}
									pastYearsHref={pastYearsHref}
									nextStep={moreNextStep}
									/* A7 c14 — the drift's `Update schedule`, moved off the
									   header row/status line into this menu. */
									updateSchedule={updateScheduleAction}
								/>
								<SimpleMoreMenuContent
									context={context}
									runToolsAvailable={runToolsAvailable}
									/* C11 D, correction 2 (QA-B2) — `Edit draft` and `Discard draft`
									   render in this menu, and `Publish` renders here ONLY when the
									   primary slot is not the publication control. */
									draftActions={simpleDraftMenuActions}
									onClose={() => setMoreOpen(false)}
									onStartTask={startTask}
									onOpenTeacherDeparture={openTeacherDeparture}
									onOpenRequests={openRequestsTask}
									onOpenTutorial={() => { setMoreOpen(false); setTutorialOpen(true); }}
									onSchoolNamesRefreshed={() => setSchoolNamesRefreshed(true)}
									unassignedEntry={(
										<SimpleUnassignedSessionsItem
											count={unassignedForTerm}
											termLabel={selectedTermLabel}
											unavailableReason={unassignedUnavailable}
											onClose={() => setMoreOpen(false)}
											onOpen={() => { void startTask('unassigned-sessions'); }}
										/>
									)}
								/>
						</div>
						</SimpleMoreScrollRegion>
					</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			{/* A7 c14 (operator, 2026-09-30 08:15) — the ONE status line under the
			    control row: run state, the readiness/warnings control, the change
			    sentence + `See what changed`, and the capped notices. Nothing here is
			    clipped (`SimpleHeaderStatusLine` carries no `truncate`): long text wraps. */}
			<SimpleHeaderStatusLine
				runState={runState}
				stateFallback={statusFallbackLabel}
				warningsControl={(
					<SimpleWarningsControl
						readiness={readiness}
						dispatch={warningsDispatch}
						diagnostic={setupBlockedDiagnostic}
						onClick={handleWarningsClick}
					>
						<SimpleReadinessChip
							readiness={readiness}
							publishBlocked={publishBlocked}
							publishBlockedReason={publishBlockedReason}
							blockingHardCount={context.blockingHardCount}
							softCount={context.softCount}
							setupBlockerCount={setupBlockerCount}
						/>
					</SimpleWarningsControl>
				)}
				changeNotice={changeNotice.node}
				messages={bandMessages}
				termAuthorityNotice={termAuthorityNotice}
			/>
			{/* ── end of the ONE control row + ONE status line (A7 c14) ── */}

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
		onNavigateToRepair={(href, reason, identity, groupCount) => {
			setReadinessSheetOpen(false);
			// UX-R03e (setup) — one shared repair dispatch with the
			// `/timetable/setup` pane; the sheet-close stays here.
			dispatchSimpleReadinessRepair({
				href,
				reason,
				identity,
				groupCount,
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
		</header>
		{/* A2 C12 / ITEM H — out of the header box. See
		    `simple/SimpleHeaderTrailingSurfaces.tsx` for the full record: what
		    moved, what did not, and which band Lane C called the "blocker line".
		    The armed-swap band PAINTS, so it is the first of the two; the blocker
		    sheet is portal-mounted and paints nothing while closed.
		    A7 c14 — the status band is no longer a third sibling: it is the header's
		    own `timetable-simple-status-line`, so only these two enter here. */}
		<SimpleHeaderTrailingSurfaces
			swapClassTimesMode={swapClassTimesMode}
			onSwapClassTimesCancel={onSwapClassTimesCancel}
			blockerSheetOpen={blockerSheetOpen}
			onBlockerSheetOpenChange={setBlockerSheetOpen}
			diagnostic={context.curriculumReadiness?.state === 'blocked' ? context.curriculumReadiness.diagnostic : null}
			onRetry={context.handleRefresh}
			labelForSection={context.sectionLabel}
			labelForSubject={context.subjectLabel}
		/>
		</>
	);
}

/*
 * C11 CORRECTION 2 (QA N1) — the doc comment that stood here was ORPHANED: it sat
 * between the closing brace of the impl and this export, so it documented nothing.
 * It is not re-homed; the behaviour it described is asserted by RENDERED rows in
 * `a2-c11-draft-actions-correction.test.tsx` (F2R1/F2R2), which is the evidence §16
 * requires.
 */
export const TimetableSimpleHeader = memo(TimetableSimpleHeaderImpl);
