import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';

import { AppShell } from './components/AppShell';
import { Skeleton } from './ui/skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapEditor = lazy(() => import('./pages/MapEditor'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Faculty = lazy(() => import('./pages/Faculty'));
const FacultyAssignments = lazy(() => import('./pages/FacultyAssignments'));
const Sections = lazy(() => import('./pages/Sections'));
const FacultyPreferences = lazy(() => import('./pages/FacultyPreferences'));
const OfficerPreferences = lazy(() => import('./pages/OfficerPreferences'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const RoomSchedules = lazy(() => import('./pages/RoomSchedules'));
const ScheduleReview = lazy(() => import('./pages/ScheduleReview'));

const router = createBrowserRouter([
	{
		path: '/',
		element: <AppShell />,
		children: [
			{
				index: true,
				element: <Dashboard />,
			},
			{
				path: 'subjects',
				element: <Subjects />,
			},
			{
				path: 'faculty',
				element: <Faculty />,
			},
			{
				path: 'assignments',
				element: <FacultyAssignments />,
			},
			{
				path: 'sections',
				element: <Sections />,
			},
			{
				path: 'faculty/preferences',
				element: <OfficerPreferences />,
			},
			{
				path: 'my/preferences',
				element: <FacultyPreferences />,
			},
			{
				path: 'timetable',
				element: <ScheduleReview />,
			},
			{
				path: 'room-schedules',
				element: <RoomSchedules />,
			},
			{
				path: 'map',
				element: <MapEditor />,
			},
			{ path: '*', element: <Navigate to="/" replace /> },
		],
	},
]);

export function App() {
	return (
		<>
			<RouterProvider router={router} />
			<Toaster richColors position="bottom-right" closeButton />
		</>
	);
}
