import { memo, Profiler } from 'react';
import { ResizableHandle, ResizablePanelGroup } from '@/ui/resizable';

import { CenterWorkspace } from '@/components/timetable/CenterWorkspace';
import { LeftRail } from '@/components/timetable/LeftRail';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { RightPanel } from '@/components/timetable/RightPanel';
import { TimetableTaskDrawer } from '@/components/timetable/TimetableTaskDrawer';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import type { ScheduleReviewWorkspaceBodyContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import { onProfilerRender } from './ScheduleReviewWorkspace';

export type ScheduleReviewWorkspaceBodyProps = {
	context: ScheduleReviewWorkspaceBodyContext;
	layoutMode?: TimetableLayoutMode;
	activeSimpleTask?: TimetableSimpleTask | null;
	onSimpleTaskChange?: (task: TimetableSimpleTask | null) => void;
	teacherDepartureEntryIds?: Set<string>;
	onReassignTeacher?: (entry: any) => void;
	repairOrigin?: RepairOrigin | null;
	onBackToBlockerSummary?: () => void;
	/**
	 * UX-R03e (setup) — the workspace repair-origin setter for the setup pane's
	 * readiness sheet (same `setRepairOrigin` the Simple header sheet uses).
	 * The task starter reuses `onSimpleTaskChange` above; no second task path.
	 */
	onSetupSetRepairOrigin?: (origin: RepairOrigin | null) => void;
	onWarningEntrySelect?: () => void;
	/**
	 * C11 M1 CORRECTION (F1) — the pathname the route→view sync has applied, or
	 * `null` before it applied any. Forwarded to both `CenterWorkspace` renders, so
	 * the centre-pane override applies only in the one-render lag after a URL move
	 * and an in-app entry still reaches its own pane.
	 */
	routeAppliedPathname?: string | null;
	/**
	 * C11 M3 (F3) — the legal move-target slot keys for the current view, from the
	 * one `describeMoveTargets` derivation, shown only while a move is armed.
	 */
	moveTargetSlotKeys?: ReadonlySet<string>;
};

function ScheduleReviewWorkspaceBodyImpl({
	context,
	layoutMode = 'advanced',
	activeSimpleTask = null,
	onSimpleTaskChange,
	teacherDepartureEntryIds,
	onReassignTeacher,
	repairOrigin,
	onBackToBlockerSummary,
	onSetupSetRepairOrigin,
	onWarningEntrySelect,
	routeAppliedPathname = null,
	moveTargetSlotKeys,
}: ScheduleReviewWorkspaceBodyProps) {
	const {
		leftPanelRef,
		setIsLeftCollapsed,
		isLeftCollapsed,
		isDesktop,
		isPreGenerationWorkspace,
		leftTab,
		setLeftTab,
		violations,
		hardCount,
		blockingHardCount,
		softCount,
		violationScopeLabel,
		summary,
		roomRequestSummary,
		openPublishDialog,
		leftRailContentContext,
		centerWorkspaceContext,
		rightPanelContext,
	} = context;

	if (layoutMode === 'simple') {
		return (
			<div className="relative flex flex-1 min-h-0 overflow-hidden" data-testid="timetable-simple-body">
				<ResizablePanelGroup direction="horizontal" className="flex flex-1 min-h-0">
					<Profiler id="Center/Grid" onRender={onProfilerRender}>
						<CenterWorkspace {...centerWorkspaceContext} formatWarningMessage={rightPanelContext.formatConstraintMessage} teacherDepartureEntryIds={teacherDepartureEntryIds} onReassignTeacher={onReassignTeacher} simpleMode onWarningEntrySelect={onWarningEntrySelect} routeAppliedPathname={routeAppliedPathname} moveTargetSlotKeys={moveTargetSlotKeys} setupOnStartTask={onSimpleTaskChange} setupOnSetRepairOrigin={onSetupSetRepairOrigin ?? null} />
					</Profiler>
				</ResizablePanelGroup>
				<TimetableTaskDrawer
					task={activeSimpleTask}
					onTaskChange={onSimpleTaskChange ?? (() => undefined)}
					leftRailContentContext={leftRailContentContext}
					hardCount={hardCount}
					blockingHardCount={blockingHardCount}
					softCount={softCount}
					violationScopeLabel={violationScopeLabel}
					unassignedCount={summary?.unassignedCount ?? 0}
					assignedCount={summary?.assignedCount ?? 0}
					runId={context.activeGeneratedRunId ?? null}
					isPreGenerationWorkspace={isPreGenerationWorkspace}
					onPublish={openPublishDialog}
					violations={context.violations as any}
					sectionLabel={context.sectionLabel}
					subjectLabel={context.subjectLabel}
					facultyLabel={context.facultyLabel}
					repairOrigin={repairOrigin}
					onBackToBlockerSummary={onBackToBlockerSummary}
				/>
			</div>
		);
	}

	return (
		<ResizablePanelGroup direction="horizontal" className="flex flex-1 min-h-0">
			<LeftRail
				panelRef={leftPanelRef}
				onCollapseChange={setIsLeftCollapsed}
				isCollapsed={isLeftCollapsed}
				isDesktop={isDesktop}
				isPreGenerationWorkspace={isPreGenerationWorkspace}
				leftTab={leftTab}
				setLeftTab={setLeftTab}
				violationsCount={violations.length}
				unassignedCount={summary?.unassignedCount ?? 0}
				pendingRequestCount={roomRequestSummary?.counts?.pending ?? 0}
			>
				<LeftRailContent context={leftRailContentContext} />
			</LeftRail>

			<ResizableHandle withHandle className={!isDesktop && isLeftCollapsed ? 'hidden' : undefined} />

			<Profiler id="Center/Grid" onRender={onProfilerRender}>
				<CenterWorkspace {...centerWorkspaceContext} formatWarningMessage={rightPanelContext.formatConstraintMessage} teacherDepartureEntryIds={teacherDepartureEntryIds} onReassignTeacher={onReassignTeacher} routeAppliedPathname={routeAppliedPathname} moveTargetSlotKeys={moveTargetSlotKeys} setupOnStartTask={onSimpleTaskChange} setupOnSetRepairOrigin={onSetupSetRepairOrigin ?? null} />
			</Profiler>

			<RightPanel {...rightPanelContext} />
		</ResizablePanelGroup>
	);
}

/**
 * A2-C12 ITEM P (P3): the context keys this body's comparator watches.
 *
 * The comparator used to call `Object.keys` on both context objects on every
 * comparison, allocating two key arrays on every render of the body, and then
 * scan every key. The list is hoisted here so no array is allocated per render.
 *
 * It is NOT shrunk. `ScheduleReviewWorkspaceBodyImpl` reads ALL TWENTY-TWO keys
 * of `ScheduleReviewWorkspaceBodyContext`: eighteen in the destructure at the
 * top of the component, plus `activeGeneratedRunId`, `sectionLabel`,
 * `subjectLabel` and `facultyLabel` in the simple-mode task drawer, plus
 * `violations` again at the drawer. There is no key the body does not read, so
 * "the subset the body reads" IS the full key set and shrinking it would buy
 * nothing while risking a skipped key. The exhaustive check below makes that
 * claim a compile error rather than a comment if the type ever grows.
 */
const CONTEXT_COMPARED_KEYS = [
	'leftPanelRef',
	'setIsLeftCollapsed',
	'isLeftCollapsed',
	'isDesktop',
	'isPreGenerationWorkspace',
	'leftTab',
	'setLeftTab',
	'violations',
	'hardCount',
	'blockingHardCount',
	'softCount',
	'violationScopeLabel',
	'summary',
	'roomRequestSummary',
	'openPublishDialog',
	'activeGeneratedRunId',
	'sectionLabel',
	'subjectLabel',
	'facultyLabel',
	'leftRailContentContext',
	'centerWorkspaceContext',
	'rightPanelContext',
] as const satisfies readonly (keyof ScheduleReviewWorkspaceBodyContext)[];

/**
 * Exhaustive by construction: every key of the context type is watched, so
 * adding a key to the type without adding it to the list above fails `tsc`
 * instead of silently falling outside the comparator. `noUnusedLocals` is not
 * enabled, but the reference keeps the intent readable.
 */
type UnwatchedContextKey = Exclude<keyof ScheduleReviewWorkspaceBodyContext, (typeof CONTEXT_COMPARED_KEYS)[number]>;
const CONTEXT_COMPARISON_IS_EXHAUSTIVE: UnwatchedContextKey extends never ? true : false = true;
void CONTEXT_COMPARISON_IS_EXHAUSTIVE;

/** The watched key set, exported so a test can pin it. */
export const SCHEDULE_REVIEW_WORKSPACE_BODY_COMPARED_KEYS = CONTEXT_COMPARED_KEYS;

/** Exported so the comparator itself is directly testable. */
export function areScheduleReviewWorkspaceBodyPropsEqual(
	prevProps: ScheduleReviewWorkspaceBodyProps,
	nextProps: ScheduleReviewWorkspaceBodyProps,
) {
	if (prevProps.layoutMode !== nextProps.layoutMode) return false;
	if (prevProps.activeSimpleTask !== nextProps.activeSimpleTask) return false;
	if (prevProps.onSimpleTaskChange !== nextProps.onSimpleTaskChange) return false;
	if (prevProps.teacherDepartureEntryIds !== nextProps.teacherDepartureEntryIds) return false;
	if (prevProps.onReassignTeacher !== nextProps.onReassignTeacher) return false;
	if (prevProps.repairOrigin !== nextProps.repairOrigin) return false;
	if (prevProps.onBackToBlockerSummary !== nextProps.onBackToBlockerSummary) return false;
	if (prevProps.onSetupSetRepairOrigin !== nextProps.onSetupSetRepairOrigin) return false;
	if (prevProps.onWarningEntrySelect !== nextProps.onWarningEntrySelect) return false;
	if (!prevProps.context || !nextProps.context) return prevProps.context === nextProps.context;
	// Fixed-length scan over a module constant: no `Object.keys` allocation, and
	// a key missing on either side reads as `undefined` and fails toward a
	// re-render, which is the safe direction.
	for (const key of CONTEXT_COMPARED_KEYS) {
		if (prevProps.context[key] !== nextProps.context[key]) return false;
	}
	return true;
}

export const ScheduleReviewWorkspaceBody = memo(ScheduleReviewWorkspaceBodyImpl, areScheduleReviewWorkspaceBodyPropsEqual);
