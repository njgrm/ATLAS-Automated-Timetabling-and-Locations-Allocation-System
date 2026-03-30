import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { AppShell } from './components/AppShell';
import { Skeleton } from './ui/skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapView = lazy(() => import('./pages/MapView'));
const MapEditor = lazy(() => import('./pages/MapEditor'));

function Fallback() {
	return (
		<div className="p-6">
			<Skeleton className="h-[400px] w-full rounded-lg" />
		</div>
	);
}

const router = createBrowserRouter([
	{
		path: '/',
		element: <AppShell />,
		children: [
			{
				index: true,
				element: (
					<Suspense fallback={<Fallback />}>
						<Dashboard />
					</Suspense>
				),
			},
			{
				path: 'map',
				element: (
					<Suspense fallback={<Fallback />}>
						<MapView />
					</Suspense>
				),
			},
			{
				path: 'map/editor',
				element: (
					<Suspense fallback={<Fallback />}>
						<MapEditor />
					</Suspense>
				),
			},
			{ path: '*', element: <Navigate to="/" replace /> },
		],
	},
]);

export function App() {
	return <RouterProvider router={router} />;
}
