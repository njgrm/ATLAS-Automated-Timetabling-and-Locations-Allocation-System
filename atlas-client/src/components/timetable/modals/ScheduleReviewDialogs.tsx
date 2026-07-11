import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { TimetableAssignmentDialogs } from './TimetableAssignmentDialogs';
import { TimetablePlacementDialogs } from './TimetablePlacementDialogs';
import { TimetableWorkflowDialogs } from './TimetableWorkflowDialogs';

type ScheduleReviewDialogsProps = {
	context: ScheduleReviewDialogsContext;
};

export function ScheduleReviewDialogs({ context }: ScheduleReviewDialogsProps) {
	return (
		<>
			<TimetableWorkflowDialogs context={context} />
			<TimetablePlacementDialogs context={context} />
			<TimetableAssignmentDialogs context={context} />
		</>
	);
}
