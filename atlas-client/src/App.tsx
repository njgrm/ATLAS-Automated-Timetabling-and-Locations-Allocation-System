import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';

import { AppShell } from './components/AppShell';
import { Skeleton } from './ui/skeleton';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapEditor = lazy(() => import('./pages/MapEditor'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Faculty = lazy(() => import('./pages/Faculty'));
const FacultyAssignments = lazy(() => import('./pages/FacultyAssignments'));
const Sections = lazy(() => import('./pages/Sections'));
const FacultyPreferences = lazy(() => import('./pages/FacultyPreferences'));
const FacultyRoomPreferences = lazy(() => import('./pages/FacultyRoomPreferences'));
const MyDashboard = lazy(() => import('./pages/MyDashboard'));
const OfficerPreferences = lazy(() => import('./pages/OfficerPreferences'));
const OfficerRoomPreferences = lazy(() => import('./pages/OfficerRoomPreferences'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const RoomSchedules = lazy(() => import('./pages/RoomSchedules'));
const ScheduleReview = lazy(() => import('./pages/ScheduleReview'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Audit = lazy(() => import('./pages/Audit'));

function LegacyRouteRedirect({ to }: { to: string }) {
	const location = useLocation();
	return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

const router = createBrowserRouter([
	{
		path: '/login',
		element: <Login />,
	},
	{
		path: '/',
		element: <AppShell />,
		children: [
			{
				index: true,
				element: <Dashboard />,
			},
			{
				path: 'my',
				element: <MyDashboard />,
			},
			{
				path: 'subjects',
				element: <Subjects />,
			},
			{
				path: 'teachers',
				element: <Faculty />,
			},
			{
				path: 'teaching-load',
				element: <FacultyAssignments />,
			},
			{
				path: 'faculty',
				element: <LegacyRouteRedirect to="/teachers" />,
			},
			{
				path: 'assignments',
				element: <LegacyRouteRedirect to="/teaching-load" />,
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
				path: 'my/room-preferences',
				element: <FacultyRoomPreferences />,
			},
			{
				path: 'timetable',
				element: <ScheduleReview />,
			},
			{
				path: 'timetabling/how-it-works',
				element: <HowItWorks />,
			},
			{
				path: 'room-schedules',
				element: <RoomSchedules />,
			},
			{
				path: 'faculty/room-preferences',
				element: <OfficerRoomPreferences />,
			},
			{
				path: 'map',
				element: <MapEditor />,
			},
			{
				path: 'audit',
				element: <Audit />,
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
