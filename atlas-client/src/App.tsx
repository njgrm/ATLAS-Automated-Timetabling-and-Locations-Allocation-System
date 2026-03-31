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
const ComingSoon = lazy(() => import('./pages/ComingSoon'));

function Fallback() {
	return (
		<div className="p-6">
			<Skeleton className="h-[400px] w-full rounded-lg" />
		</div>
	);
}

function Lazy({ children }: { children: React.ReactNode }) {
	return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}

const router = createBrowserRouter([
	{
		path: '/',
		element: <AppShell />,
		children: [
			{
				index: true,
				element: <Lazy><Dashboard /></Lazy>,
			},
			{
				path: 'subjects',
				element: <Lazy><Subjects /></Lazy>,
			},
			{
				path: 'faculty',
				element: <Lazy><Faculty /></Lazy>,
			},
			{
				path: 'faculty/assignments',
				element: <Lazy><FacultyAssignments /></Lazy>,
			},
			{
				path: 'sections',
				element: <Lazy><Sections /></Lazy>,
			},
			{
				path: 'timetable',
				element: <Lazy><ComingSoon /></Lazy>,
			},
			{
				path: 'map',
				element: <Lazy><MapEditor /></Lazy>,
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
