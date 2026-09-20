import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';

const ScheduleReviewWorkspace = lazy(() => import('@/components/timetable/ScheduleReviewWorkspace'));

export default function ScheduleReview() {
	return (
		<Suspense fallback={<TimetableSkeleton />}>
			<ScheduleReviewWorkspace />
			{/* UX-R03a — nested timetable routes render here. The children are
			    element-less today (the URL only drives centerView state), so this
			    Outlet renders nothing while keeping the workspace shell above
			    mounted across child navigations. */}
			<Outlet />
		</Suspense>
	);
}
