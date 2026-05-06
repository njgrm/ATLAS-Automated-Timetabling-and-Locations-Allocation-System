import { lazy, Suspense } from 'react';

import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';

const ScheduleReviewWorkspace = lazy(() => import('@/components/timetable/ScheduleReviewWorkspace'));

export default function ScheduleReview() {
	return (
		<Suspense fallback={<TimetableSkeleton />}>
			<ScheduleReviewWorkspace />
		</Suspense>
	);
}
