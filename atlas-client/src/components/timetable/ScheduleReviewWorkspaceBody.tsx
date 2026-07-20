import { memo, Profiler } from 'react';
import { ResizableHandle, ResizablePanelGroup } from '@/ui/resizable';

import { CenterWorkspace } from '@/components/timetable/CenterWorkspace';
import { LeftRail } from '@/components/timetable/LeftRail';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { RightPanel } from '@/components/timetable/RightPanel';
import type { ScheduleReviewWorkspaceBodyContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import { onProfilerRender } from './ScheduleReviewWorkspace';

type ScheduleReviewWorkspaceBodyProps = {
	context: ScheduleReviewWorkspaceBodyContext;
};

function ScheduleReviewWorkspaceBodyImpl({ context }: ScheduleReviewWorkspaceBodyProps) {
	const {
		leftPanelRef,
		setIsLeftCollapsed,
		isLeftCollapsed,
		isDesktop,
		isPreGenerationWorkspace,
		leftTab,
		setLeftTab,
		violations,
		summary,
		roomRequestSummary,
		leftRailContentContext,
		centerWorkspaceContext,
		rightPanelContext,
	} = context;

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

			{(isDesktop || !isLeftCollapsed) && <ResizableHandle withHandle />}

			<Profiler id="Center/Grid" onRender={onProfilerRender}>
				<CenterWorkspace {...centerWorkspaceContext} />
			</Profiler>

			<RightPanel {...rightPanelContext} />
		</ResizablePanelGroup>
	);
}

function arePropsEqual(prevProps: ScheduleReviewWorkspaceBodyProps, nextProps: ScheduleReviewWorkspaceBodyProps) {
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
