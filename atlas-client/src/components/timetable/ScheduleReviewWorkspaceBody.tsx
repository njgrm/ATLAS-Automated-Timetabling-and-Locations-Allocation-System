import { memo, Profiler } from 'react';
import { ResizableHandle, ResizablePanelGroup } from '@/ui/resizable';

import { CenterWorkspace } from '@/components/timetable/CenterWorkspace';
import { LeftRail } from '@/components/timetable/LeftRail';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { RightPanel } from '@/components/timetable/RightPanel';
import { TimetableTaskDrawer } from '@/components/timetable/TimetableTaskDrawer';
import type { ScheduleReviewWorkspaceBodyContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import { onProfilerRender } from './ScheduleReviewWorkspace';

type ScheduleReviewWorkspaceBodyProps = {
	context: ScheduleReviewWorkspaceBodyContext;
	layoutMode?: TimetableLayoutMode;
	activeSimpleTask?: TimetableSimpleTask | null;
	onSimpleTaskChange?: (task: TimetableSimpleTask | null) => void;
	teacherDepartureEntryIds?: Set<string>;
	onReassignTeacher?: (entry: any) => void;
};

function ScheduleReviewWorkspaceBodyImpl({
	context,
	layoutMode = 'advanced',
	activeSimpleTask = null,
	onSimpleTaskChange,
	teacherDepartureEntryIds,
	onReassignTeacher,
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
		softCount,
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
						<CenterWorkspace {...centerWorkspaceContext} teacherDepartureEntryIds={teacherDepartureEntryIds} onReassignTeacher={onReassignTeacher} simpleMode />
					</Profiler>
				</ResizablePanelGroup>
				<TimetableTaskDrawer
					task={activeSimpleTask}
					onTaskChange={onSimpleTaskChange ?? (() => undefined)}
					leftRailContentContext={leftRailContentContext}
					hardCount={hardCount}
					softCount={softCount}
					unassignedCount={summary?.unassignedCount ?? 0}
					isPreGenerationWorkspace={isPreGenerationWorkspace}
					onPublish={openPublishDialog}
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
				<CenterWorkspace {...centerWorkspaceContext} teacherDepartureEntryIds={teacherDepartureEntryIds} onReassignTeacher={onReassignTeacher} />
			</Profiler>

			<RightPanel {...rightPanelContext} />
		</ResizablePanelGroup>
	);
}

function arePropsEqual(prevProps: ScheduleReviewWorkspaceBodyProps, nextProps: ScheduleReviewWorkspaceBodyProps) {
	if (prevProps.layoutMode !== nextProps.layoutMode) return false;
	if (prevProps.activeSimpleTask !== nextProps.activeSimpleTask) return false;
	if (prevProps.onSimpleTaskChange !== nextProps.onSimpleTaskChange) return false;
	if (prevProps.teacherDepartureEntryIds !== nextProps.teacherDepartureEntryIds) return false;
	if (prevProps.onReassignTeacher !== nextProps.onReassignTeacher) return false;
	if (!prevProps.context || !nextProps.context) return prevProps.context === nextProps.context;
	const prevKeys = Object.keys(prevProps.context);
	const nextKeys = Object.keys(nextProps.context);
	if (prevKeys.length !== nextKeys.length) return false;
	for (const key of prevKeys) {
		if ((prevProps.context as any)[key] !== (nextProps.context as any)[key]) return false;
	}
	return true;
}

export const ScheduleReviewWorkspaceBody = memo(ScheduleReviewWorkspaceBodyImpl, arePropsEqual);
