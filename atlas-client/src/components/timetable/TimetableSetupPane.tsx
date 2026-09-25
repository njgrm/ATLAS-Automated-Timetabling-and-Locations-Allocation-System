/**
 * UX-R03e (setup) — the `/timetable/setup` center view.
 *
 * A composed setup-truth surface built from the controls that already exist on
 * the Simple timetable, with zero behaviour change to any of them:
 *
 * - `SimpleDriftBanner` rendered directly — it owns `timetable-simple-sync-setup`,
 *   `timetable-simple-input-drift`, and the room-repair affordances, and its sync
 *   dispatches through the shared `runSyncSetup` / `createSyncSetupInFlightGuard`
 *   unit. No second `handleSyncSetup` exists here.
 * - `SimpleReadinessChip` — the one shared chip implementation the Simple header
 *   also renders (same `readinessLabel` / `publishBlocked` derivation).
 * - `RefreshSetupNamesButton` — the one shared setup-name refresh the More menu
 *   also renders (same refresh call).
 * - `SimplePublishReadinessSheet` — the same sheet with the same content inputs
 *   and the one shared repair dispatch the header sheet uses.
 *
 * Every existing entry point keeps working where it is; this route is an
 * additional place to land. This component dispatches no data requests of its
 * own — sync, repair, refresh, and readiness all run through the shared units.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ListChecks, Settings2 } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { SimpleDriftBanner } from '@/components/timetable/simple/SimpleDriftBanner';
import {
	RefreshSetupNamesButton,
	resolveSimpleReadiness,
	SimpleReadinessChip,
} from '@/components/timetable/simple/SimpleSetupSharedControls';
import { dispatchSimpleReadinessRepair } from '@/components/timetable/TimetableSimpleHeader';
import { SimplePublishReadinessSheet } from '@/components/timetable/SimplePublishReadinessSheet';
import { SimpleGenerationBlockerSheet } from '@/components/timetable/simple/SimpleGenerationBlockerSheet';
import { isRunPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { deriveTimetableCapabilities } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness, type TimetableCurriculumReadinessState } from '@/lib/timetable-generation-readiness';
import type { RolloverStatus } from '@/lib/settings';
import type { SeverityFilter } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/simple/SimpleTaskDrawerHelpers';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { DraftReport, Violation } from '@/types';

export type TimetableSetupPaneInputs = {
	schoolId: number;
	schoolYearId: number | null;
	activeGeneratedRunId: number | null;
	onStartRevision: () => void;
	draft: DraftReport | null;
	isPreGenerationWorkspace: boolean;
	loading: boolean;
	generating: boolean;
	onRefresh: () => void;
	onRefreshSetupNames: () => void;
	curriculumReadiness: TimetableCurriculumReadinessState;
	hasSelectedEntry: boolean;
	requestPendingCount: number;
	blockingHardCount: number;
	softCount: number;
	summary: ScheduleReviewWorkspaceHeaderContext['summary'];
	violations: Violation[];
	schoolYearContext: ScheduleReviewWorkspaceHeaderContext['schoolYearContext'];
	/** Latest-run status for the failed-run lifecycle (mirrors the header's `latestRunFailed`). */
	latestRunStatus?: string | null;
	setLeftTab: ScheduleReviewWorkspaceHeaderContext['setLeftTab'];
	setPresentationMode: ScheduleReviewWorkspaceHeaderContext['setPresentationMode'];
	setUnassignedReasonFilter: ScheduleReviewWorkspaceHeaderContext['setUnassignedReasonFilter'];
	setSelectedViolation: ScheduleReviewWorkspaceHeaderContext['setSelectedViolation'];
	setSeverityFilter: (value: SeverityFilter) => void;
};

type TimetableSetupPaneProps = {
	/** Null renders a truthful unavailable state instead of invented setup data. */
	inputs: TimetableSetupPaneInputs | null;
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	/** The workspace task starter (same `setActiveSimpleTask` the header uses). */
	onStartSimpleTask: (task: TimetableSimpleTask | null) => void;
	onSetRepairOrigin?: ((origin: RepairOrigin | null) => void) | null;
};

/**
 * C2-b — the guidance under the Setup badge.
 *
 * The `blocked` copy used to say "Open Review readiness to see what to check",
 * but that entry opened `SimplePublishReadinessSheet` — the PUBLICATION
 * readiness sheet, which for a year with no generated run answers "No timetable
 * generated yet" and cannot say why a timetable cannot be made. It now points
 * at the real generation blockers, which are the thing the scheduler needs.
 *
 * `blockerCount` keeps the two blocked sub-cases honest: with a real count the
 * copy names the real list; with none (the check itself did not finish) it says
 * so instead of pointing at a list that does not exist.
 */
export function simpleSetupGuidance(
	readiness: Pick<TimetableCurriculumReadinessState, 'state'> | null | undefined,
	blockerCount = 0,
) {
	switch (readiness?.state ?? 'unavailable') {
		case 'loading':
			return 'ATLAS is checking schedule information. Nothing is changed by this check.';
		case 'blocked':
			return blockerCount > 0
				? `ATLAS cannot make a timetable yet. Open See what to fix to see each of the ${blockerCount} setup ${blockerCount === 1 ? 'item' : 'items'} and the place to fix it.`
				: 'ATLAS cannot make a timetable yet, and the schedule check did not finish, so there is no list to show. Retry the schedule check to see where it stands.';
		case 'failed':
		case 'unavailable':
			return 'ATLAS could not finish the schedule check. Retry schedule check; timetable generation stays unavailable until it completes.';
		case 'ready':
			return 'ATLAS checked the schedule information. Review any warnings before publishing.';
	}
}

export function TimetableSetupPane({
	inputs,
	sectionLabel,
	subjectLabel,
	facultyLabel,
	onStartSimpleTask,
	onSetRepairOrigin,
}: TimetableSetupPaneProps) {
	const navigate = useNavigate();
	const [sheetOpen, setSheetOpen] = useState(false);
	// C2-b — the generation-blocker disclosure is a different surface from the
	// publication readiness sheet, and this route must open the right one.
	const [blockerSheetOpen, setBlockerSheetOpen] = useState(false);
	const [, setBlockerReasonFilter] = useState<string | null>(null);
	const [rolloverStatus, setRolloverStatus] = useState<RolloverStatus | null>(null);

	if (inputs == null) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4" data-testid="timetable-setup-pane">
				<div className="max-w-md space-y-3 text-center" data-testid="timetable-setup-unavailable">
					<Settings2 className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
					<p className="text-sm font-medium">Setup details are unavailable</p>
					<p className="text-xs text-muted-foreground">
						The setup surface could not be bound to the current school year. Refresh the schedule and try again.
					</p>
					<Button asChild variant="outline" size="sm" className="h-7 text-xs">
						<Link to="/timetable">
							<ChevronLeft className="size-3.5" />
							Back to Schedule
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	const hasGeneratedRun = inputs.draft != null;
	const isRunPublished = isRunPublishedStrict(inputs.draft?.summary);
	const scopeResolved = Number.isInteger(inputs.schoolId) && inputs.schoolId > 0
		&& Number.isInteger(inputs.schoolYearId) && (inputs.schoolYearId ?? 0) > 0;
	const latestRunFailed = !hasGeneratedRun && inputs.latestRunStatus === 'FAILED';
	const capabilities = deriveTimetableCapabilities({
		scopeResolved,
		curriculumState: inputs.curriculumReadiness?.state ?? 'unavailable',
		generating: inputs.generating,
		isPreGeneration: inputs.isPreGenerationWorkspace,
		hasGeneratedRun,
		isPublished: isRunPublished,
		latestRunFailed,
		hardCount: inputs.blockingHardCount,
		unassignedCount: inputs.summary?.unassignedCount ?? 0,
		softCount: inputs.softCount,
		hasSelectedEntry: inputs.hasSelectedEntry,
		requestPendingCount: inputs.requestPendingCount,
		generationDiagnostic: summarizeGenerationReadiness(inputs.curriculumReadiness),
		readinessRepair: inputs.curriculumReadiness?.state === 'blocked' ? inputs.curriculumReadiness.repair : null,
		driftBlocked: rolloverStatus?.drift.status === 'atlas-stale' || rolloverStatus?.drift.status === 'mapping-conflict',
		driftMessage: rolloverStatus?.drift.message ?? null,
	});
	const { readiness, publishBlocked, publishBlockedReason } = resolveSimpleReadiness({
		draft: inputs.draft,
		blockingHardCount: inputs.blockingHardCount,
		summary: inputs.summary,
		softCount: inputs.softCount,
		isPreGenerationWorkspace: inputs.isPreGenerationWorkspace,
		schoolYearContext: inputs.schoolYearContext,
		hasGeneratedRun,
		isRunPublished,
	});

	const startPlaceUnresolvedTask = () => {
		inputs.setLeftTab('unassigned');
		inputs.setPresentationMode('workflow');
		onStartSimpleTask('place-unresolved');
	};
	const startReviewIssuesTask = () => {
		if (!capabilities.gates.issueReview.enabled) return;
		inputs.setLeftTab('violations');
		inputs.setPresentationMode('workflow');
		onStartSimpleTask('review-issues');
	};

	// C2-b — a scheduler told a schedule cannot be GENERATED must not be sent to a
	// publication panel about a schedule that does not exist. When the canonical
	// diagnostic reports real generation blockers, this entry opens the real
	// blocker list; otherwise it keeps its publication-readiness meaning.
	const generationBlocked = inputs.curriculumReadiness?.state === 'blocked'
		&& inputs.curriculumReadiness.diagnostic.blockers.length > 0;
	const generationBlockerCount = inputs.curriculumReadiness?.state === 'blocked'
		? inputs.curriculumReadiness.diagnostic.blockers.length
		: 0;
	const openReadinessEntry = () => {
		if (generationBlocked) {
			setBlockerSheetOpen(true);
			return;
		}
		setSheetOpen(true);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="timetable-setup-pane">
			<SimpleDriftBanner
				schoolId={inputs.schoolId}
				schoolYearId={inputs.schoolYearId}
				activeGeneratedRunId={inputs.activeGeneratedRunId}
				draft={inputs.draft}
				isPreGenerationWorkspace={inputs.isPreGenerationWorkspace}
				loading={inputs.loading}
				onRefresh={inputs.onRefresh}
				onRolloverStatus={setRolloverStatus}
				capabilities={capabilities}
				isPublished={isRunPublished}
				onStartRevision={inputs?.onStartRevision}
			/>
			<ScrollArea className="min-h-0 flex-1">
				<div className="mx-auto w-full max-w-2xl space-y-3 p-4">
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="h-5 px-1.5 text-xs uppercase">Setup</Badge>
					<p className="text-xs text-muted-foreground" data-testid="timetable-setup-guidance">
						{simpleSetupGuidance(inputs.curriculumReadiness, generationBlockerCount)}
					</p>
					</div>
					<section aria-label={generationBlocked ? 'Schedule readiness' : 'Publish readiness'} className="space-y-2 rounded-lg border border-border bg-card p-3">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<SimpleReadinessChip
								readiness={readiness}
								publishBlocked={publishBlocked}
								publishBlockedReason={publishBlockedReason}
								blockingHardCount={inputs.blockingHardCount}
							/>
							<span className="min-w-0 flex-1" />
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={openReadinessEntry}
								data-testid="timetable-setup-review-readiness"
								data-readiness-target={generationBlocked ? 'generation-blockers' : 'publish-readiness'}
							>
								<ListChecks className="size-3.5" aria-hidden="true" />
								{generationBlocked ? 'See what to fix' : 'Review readiness'}
							</Button>
						</div>
						{publishBlocked ? (
							<p className="text-xs text-muted-foreground" data-testid="timetable-setup-readiness-reason">
								{publishBlockedReason}
							</p>
						) : null}
					</section>
					<section aria-label="Setup names" className="space-y-2 rounded-lg border border-border bg-card p-3">
						<p className="text-sm font-medium">Reference names</p>
						<p className="text-xs text-muted-foreground">
							Refresh the cached teacher, section, and room names used across the schedule surface.
						</p>
						<div>
							<RefreshSetupNamesButton onRefreshNames={inputs.onRefreshSetupNames} />
						</div>
					</section>
					<div className="flex justify-center">
						<Button asChild variant="outline" size="sm" className="h-7 text-xs">
							<Link to="/timetable">
								<ChevronLeft className="size-3.5" />
								Back to Schedule
							</Link>
						</Button>
					</div>
				</div>
			</ScrollArea>
			<SimpleGenerationBlockerSheet
				open={blockerSheetOpen}
				onOpenChange={setBlockerSheetOpen}
				diagnostic={inputs.curriculumReadiness?.state === 'blocked' ? inputs.curriculumReadiness.diagnostic : null}
				onRetry={inputs.onRefresh}
				labelForSection={sectionLabel}
				labelForSubject={subjectLabel}
			/>
			<SimplePublishReadinessSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				draft={inputs.draft}
				violations={inputs.violations}
				sectionLabel={sectionLabel}
				subjectLabel={subjectLabel}
				facultyLabel={facultyLabel}
				runWide={{
					blockingHardCount: inputs.blockingHardCount,
					unassignedCount: inputs.summary?.unassignedCount ?? 0,
					softCount: inputs.softCount,
				}}
				onNavigateToRepair={(href, reason, identity) => {
					setSheetOpen(false);
					dispatchSimpleReadinessRepair({
						href,
						reason,
						identity,
						navigate,
						violations: inputs.violations,
						setUnassignedReasonFilter: inputs.setUnassignedReasonFilter,
						setBlockerReasonFilter,
						startPlaceUnresolvedTask,
						startReviewIssuesTask,
						setSelectedViolation: inputs.setSelectedViolation,
						setSeverityFilter: inputs.setSeverityFilter,
						issueReviewEnabled: capabilities.gates.issueReview.enabled,
						onSetRepairOrigin,
					});
				}}
			/>
		</div>
	);
}
