import { memo, useEffect, useMemo, useState } from 'react';
import {
	MoreHorizontal,
	type LucideIcon,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { UNLABELLED_RULE_SENTENCE } from '@/lib/timetable-plain-language';
import { deriveSimpleLifecycleAction } from '@/lib/simple-timetable-state';
import { deriveTimetableCapabilities, describeSetupState, YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness, generationBlockedOperatorSentence } from '@/lib/timetable-generation-readiness';
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
   derivation, and row 2's extracted draft actions + task dispatcher. */
import { TimetableSubNavRow } from '@/components/timetable/TimetableSubNav';
import { describeRunState } from '@/components/timetable/RunStateBadge';
import { SimpleHeaderDraftActions } from '@/components/timetable/simple/SimpleHeaderDraftActions';
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

/* A2 HEADER-BUDGET — the repair DISPATCHER stays here: `ux-r03e-timetable-runs-setup`
   pins `export function dispatchSimpleReadinessRepair`, `resolveBlockerDestination(reason, href)`
   and `dispatchSimpleReadinessRepair({` in THIS file, and TimetableSetupPane imports it
   from this exact path. */

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
		groupCount,
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
	/* J2 (P5): the fallback used to de-snake-case the reason into "no available
	 * slot" — the reason's own token, lower-cased, which reads as a typo rather
	 * than a sentence. It now degrades to the ONE shared plain sentence, the same
	 * one the readiness warning groups use, so the C1 blocker banner and the
	 * generation blocker sheet cannot disagree. The branch structure, the repair
	 * resolution and every destination are untouched. */
	const plainReason = reason === 'NO_AVAILABLE_SLOT' ? 'No available slot'
		: reason === 'FACULTY_OVERLOADED' ? 'Teachers are overloaded'
		: reason === 'NO_QUALIFIED_FACULTY' ? 'No qualified teacher'
		: reason === 'NO_COMPATIBLE_ROOM' ? 'No compatible room'
		: reason === 'ROOM_CAPACITY_EXCEEDED' ? 'Room capacity exceeded'
		: reason ? UNLABELLED_RULE_SENTENCE : 'Unknown issue';
	// C1-a — the real count from the followed blocker group. It was hard-coded to
	// `0` here, so every blocker repair banner claimed "0 sessions affected" while
	// the same sheet had just printed the true count one click away. An absent
	// count (the setup pane has no group) is carried through as `null` and the
	// banner omits the clause; it is never coerced to a number.
	onSetRepairOrigin?.({ reason: reason ?? 'UNKNOWN', plainReason, groupCount: groupCount ?? null });
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
		onRegenerate: context.handleTriggerGenerate,
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
	/* A2 HEADER-BUDGET — the two values the trailing status band needs, each the
	 * EXISTING derivation handed across, never recomputed there: `stripDraftActions`
	 * is the same resolved object the `More` menu renders (one derivation, two
	 * renderers) with only a VISIBILITY restated — and that visibility is
	 * `draftStrip.discardEnabled`, which `resolveDraftStripProps` already defines as
	 * "there is a draft"; `runState` is the ONE `describeRunState` result. Full
	 * record: SimpleHeaderTrailingSurfaces, SimpleSetupSharedControls, DraftActionButton. */
	const stripDraftActions = {
		edit: simpleDraftMenuActions.edit,
		discard: simpleDraftMenuActions.discard,
		/* correction 2 / F4: the same fact, named for the row-2 visibility decision. */
		hasDraft: draftStrip.discardEnabled,
	};
	const runState = describeRunState({
		isPreGeneration: context.isPreGenerationWorkspace,
		runId: context.draft?.runId ?? null,
		isPublished: isRunPublished,
	});
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
	const unassignedForTerm = countUnassignedForSelectedTerm(
		context.draft?.unassignedItems as Array<{ termIndex?: number | null }> | undefined,
		context.termFilter,
	);
	const unassignedUnavailable = context.isPreGenerationWorkspace
		? 'Unassigned sessions belong to a generated schedule; this is the working draft.'
		: !hasGeneratedRun ? 'No draft yet.' : null;

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

	/* ── A2 C12 / ITEM H — the header BOX is the two rows and nothing else ─────
	 *
	 * Lane C measured this header in a real browser at 1366×768 in the operator's
	 * own state (a resolved run, 3 must-fix, 145 advisories, term authority
	 * unverified) and found SEVEN text bands / 204 px, against an accepted target
	 * of at most TWO rows. The structural work was already done (`SimpleHeaderStatusStrip`
	 * plus one control row in `timetable-simple-header-row`); the surplus came from
	 * two surfaces still rendered INSIDE the `<header>` element.
	 *
	 * THE OPERATOR'S INSTRUCTION, verbatim: "move blocker sheet and swap banner out
	 * of the header box". `SimpleHeaderTrailingSurfaces` below now renders both,
	 * immediately after `</header>`, as siblings. Its doc comment is the record of
	 * what moved, what deliberately did not, which band Lane C called the "blocker
	 * line", and why a JSDOM row is DOM-shape rather than a 1366×768 pixel count.
	 *
	 * It is a sub-component rather than an in-file move because this file stood at
	 * 971 physical lines and the move leaves it at 993 — under the §8 1000-line cap,
	 * but with seven lines of headroom, and a record this size does not belong in
	 * those last seven. §8's answer is to EXTRACT, never to delete a comment. NO state
	 * and NO handler moved: `blockerSheetOpen`, `setBlockerSheetOpen`,
	 * `swapClassTimesMode` and `onSwapClassTimesCancel` stay here, so this component
	 * remains the logical owner of both surfaces and only their JSX position
	 * changed. The fragment wrapper is what makes them siblings of the `<header>`
	 * rather than children. */
	return (
		<>
		<header className="shrink-0 border-b border-border bg-background" data-testid="timetable-simple-header">
			{/* A2 HEADER-BUDGET (operator, 2026-09-29) — THE HEADER IS TWO ROWS. The
			   operator: the header "has regressed … messy … we need a less is more
			   approach and relaxed view". §8 names the shape: row 1 = title, tabs, ONE
			   status chip, the primary action, `More`; row 2 = `Term` · `Show` ·
			   `Schedule for` plus only the actions with something to act on. OUT OF THE
			   BOX, and why: the title/tabs band (`TimetableSubNavRow` is now HERE, and
			   `ScheduleReviewWorkspace` skips the standalone `TimetableSubNav` exactly
			   when this header shows them, so they are never on screen twice); the status
			   strip with its SECOND chip `RunStateBadge`, its `SimpleTermScopeLine`
			   (`Term: Viewi…`, `school is i…` — all `lg:truncate`, which §8 forbids) and
			   its notices, now a SIBLING of `</header>`; and the long
			   `timetable-curriculum-readiness-message` paragraph, now the chip's short
			   `N setup items to fix` label with the diagnostic behind a `@/ui` Tooltip.
			   `RunStateBadge`/`runIdentityBadgeLabel` are untouched and still serve the
			   Expert header. UNCHANGED: the change notice is the first child of the
			   control row (C11 S2), and the primary action, the chip's
			   `generation-blockers` dispatch and the `More` menu are as they were. */}
			<div
				className="flex min-w-0 flex-col gap-0"
				data-testid="timetable-simple-header-row"
			>
			{/* A2 C12 / ITEM 1 — `lg:flex-nowrap` holds this row to ONE visual line at
			    1366 px. The base `flex-wrap` is RETAINED for narrow/390 px layouts. */}
			<div
				className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap"
				data-testid="timetable-simple-header-row-1"
			>
				{/* The title and the tabs, in row 1, from the ONE extraction. */}
				<TimetableSubNavRow />

				{/* A2 C12 / ITEM 1 — no wrap from `lg` up, so the status / primary /
				    Undo / More cluster stays on this row's single line. */}
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 pr-3 lg:ml-auto lg:flex-nowrap lg:justify-end">
					{/* A2 HEADER-BUDGET — the ONE status chip. Its face is unchanged
					    (`SimpleReadinessChip` in `SimpleWarningsControl`); the setup-blocked
					    LABEL is the short `N setup items to fix`, and the long
					    `setupBlockedDiagnostic` it replaced is the control's tooltip. */}
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

					{/* DRAFT-UX-C01 (operator, 2026-09-25) — the ONE solid primary:
					    `Generate` with no generated run, `Publish schedule` once a run
					    exists. The draft's own verb is NOT traded for it; it is an entry
					    of the More menu beside `Discard draft`. See
					    `resolveSimpleHeaderPrimary`. */}
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
			{/* ROW 2 — the pickers, and only the actions with something to act on.
			    A2 HEADER-BUDGET: all three pickers carry the ONE shared `@/ui` chrome,
			    so all three look like Teaching Load's. */}
			<div
				className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 pb-1.5 lg:flex-nowrap"
				data-testid="timetable-simple-header-row-2"
			>
				{/* The change notice: ONE sentence, ONE primary action, one secondary,
				    and part of THIS row rather than a row of its own (C11 S2 item 2). */}
				{changeNotice.node}
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

				{/* A2 HEADER-BUDGET — the draft actions, right-aligned, ONLY when they have
				    something to act on; a disabled one states its reason in a `@/ui`
				    Tooltip, never as a sentence beneath it. The SAME already-resolved
				    `simpleDraftMenuActions` the `More` menu renders — one derivation, two
				    renderers, so the two cannot disagree. Extracted for §8's line cap. */}
				<SimpleHeaderDraftActions actions={stripDraftActions} />
			</div>
			</div>
			{/* ── end of the two-row band (A2 HEADER-BUDGET) ── */}

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
		    sheet is portal-mounted and paints nothing while closed. */}
		<SimpleHeaderTrailingSurfaces
			swapClassTimesMode={swapClassTimesMode}
			onSwapClassTimesCancel={onSwapClassTimesCancel}
			blockerSheetOpen={blockerSheetOpen}
			onBlockerSheetOpenChange={setBlockerSheetOpen}
			diagnostic={context.curriculumReadiness?.state === 'blocked' ? context.curriculumReadiness.diagnostic : null}
			onRetry={context.handleRefresh}
			labelForSection={context.sectionLabel}
			labelForSubject={context.subjectLabel}
			/* A2 HEADER-BUDGET — the ONE `describeRunState` result and the exceptional
			   notices, handed over rather than re-derived across the boundary; the
			   setup-blocked paragraph is filtered out because the chip carries that fact. */
			runState={runState}
			messages={bandMessages}
			termAuthorityNotice={termAuthorityNotice}
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
