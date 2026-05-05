import { memo } from 'react';
import { ResizableHandle, ResizablePanelGroup } from '@/ui/resizable';

import { CenterWorkspace } from '@/components/timetable/CenterWorkspace';
import { LeftRail } from '@/components/timetable/LeftRail';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { RightPanel } from '@/components/timetable/RightPanel';
import type { ScheduleReviewWorkspaceBodyContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';

type ScheduleReviewWorkspaceBodyProps = {
	context: ScheduleReviewWorkspaceBodyContext;
};

function ScheduleReviewWorkspaceBodyImpl({ context }: ScheduleReviewWorkspaceBodyProps) {
	const {
		leftPanelRef,
		setIsLeftCollapsed,
		isLeftCollapsed,
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
				isPreGenerationWorkspace={isPreGenerationWorkspace}
				leftTab={leftTab}
				setLeftTab={setLeftTab}
				violationsCount={violations.length}
				unassignedCount={summary?.unassignedCount ?? 0}
				pendingRequestCount={roomRequestSummary?.counts?.pending ?? 0}
			>
				<LeftRailContent context={leftRailContentContext} />
			</LeftRail>

			<ResizableHandle withHandle />

			<CenterWorkspace {...centerWorkspaceContext} />

			<RightPanel {...rightPanelContext} />
		</ResizablePanelGroup>
	);
}

export const ScheduleReviewWorkspaceBody = memo(ScheduleReviewWorkspaceBodyImpl);
