import { memo } from 'react';
import { ExplainabilityDrawer } from '@/components/ExplainabilityDrawer';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { HardBlockerDialog } from '@/components/timetable/modals/HardBlockerDialog';
import { ScheduleReviewDialogs } from '@/components/timetable/modals/ScheduleReviewDialogs';
import type { ScheduleReviewWorkspaceOverlaysContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';

type ScheduleReviewWorkspaceOverlaysProps = {
	context: ScheduleReviewWorkspaceOverlaysContext;
};

function ScheduleReviewWorkspaceOverlaysImpl({ context }: ScheduleReviewWorkspaceOverlaysProps) {
	const {
		dialogContext,
		tutorial,
		TUTORIAL_STEPS,
		blockerModalData,
		setBlockerModalData,
		showExplainDrawer,
		setDrawerViolation,
		setDrawerUnassigned,
		drawerViolation,
		drawerUnassigned,
	} = context;

	return (
		<>
			<ScheduleReviewDialogs context={dialogContext} />
			<TutorialOverlay
				steps={TUTORIAL_STEPS}
				active={tutorial.active}
				onComplete={tutorial.complete}
			/>
			<HardBlockerDialog
				open={!!blockerModalData}
				items={blockerModalData ?? []}
				onClose={() => setBlockerModalData(null)}
			/>
			<ExplainabilityDrawer
				open={showExplainDrawer}
				onClose={() => { setDrawerViolation(null); setDrawerUnassigned(null); }}
				violation={drawerViolation ?? undefined}
				unassignedItem={drawerUnassigned ?? undefined}
			/>
		</>
	);
}

export const ScheduleReviewWorkspaceOverlays = memo(ScheduleReviewWorkspaceOverlaysImpl);
