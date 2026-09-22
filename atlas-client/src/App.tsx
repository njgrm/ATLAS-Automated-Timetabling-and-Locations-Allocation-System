import { createBrowserRouter, Navigate, RouterProvider, useLocation, useSearchParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';

import { AppShell } from './components/AppShell';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapEditor = lazy(() => import('./pages/MapEditor'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Faculty = lazy(() => import('./pages/Faculty'));
const TeachingLoad = lazy(() => import('./pages/TeachingLoad'));
const TeachingLoadHistory = lazy(() => import('./components/faculty-assignments/TeachingLoadHistoryView'));
const Sections = lazy(() => import('./pages/Sections'));
const FacultyPreferences = lazy(() => import('./pages/FacultyPreferences'));
const FacultyRoomPreferences = lazy(() => import('./pages/FacultyRoomPreferences'));
const MyDashboard = lazy(() => import('./pages/MyDashboard'));
const MySchedule = lazy(() => import('./pages/MySchedule'));
const OfficerPreferences = lazy(() => import('./pages/OfficerPreferences'));
const OfficerRoomPreferences = lazy(() => import('./pages/OfficerRoomPreferences'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const RoomSchedules = lazy(() => import('./pages/RoomSchedules'));
const ScheduleReview = lazy(() => import('./pages/ScheduleReview'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Audit = lazy(() => import('./pages/Audit'));
const AdminYearSetup = lazy(() => import('./pages/AdminYearSetup'));
const PublicPublishedSchedule = lazy(() => import('./pages/PublicPublishedSchedule'));
const SsoCallback = lazy(() => import('./pages/SsoCallback'));
const EnrollProAuthorize = lazy(() => import('./pages/EnrollProAuthorize'));

function LegacyRouteRedirect({ to }: { to: string }) {
	const location = useLocation();
	return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

/**
 * UX-C01 — the annual Curriculum Requirements / Decision Workspace surfaces
 * are retired. Historical deep links replace-redirect to the Subjects setup
 * view with concise context. They never mount legacy mutation UI or dispatch
 * legacy requirement requests.
 */
function RetiredRequirementsRedirect() {
	return <Navigate to='/subjects?context=derived-setup' replace />;
}

/**
 * `/teaching-load?view=history&schoolYearId=<id>` renders the read-only
 * archived view; plain `/teaching-load` renders the live workspace. The
 * dedicated `/teaching-load/history` route remains for direct links.
 */
function TeachingLoadRoute() {
	const [searchParams] = useSearchParams();
	return searchParams.get('view') === 'history' ? <TeachingLoadHistory /> : <TeachingLoad />;
}

const router = createBrowserRouter([
	{
		path: '/login',
		element: <Login />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/auth/sso/callback',
		element: <SsoCallback />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/auth/enrollpro/authorize',
		element: <EnrollProAuthorize />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/auth/smart/authorize',
		element: <EnrollProAuthorize peer='smart' />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/auth/aims/authorize',
		element: <EnrollProAuthorize peer='aims' />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/public/schedules',
		element: <PublicPublishedSchedule />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/public/schedule',
		element: <LegacyRouteRedirect to="/public/schedules" />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/',
		element: <AppShell />,
		errorElement: <RouteErrorBoundary />,
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
				path: 'my/schedule',
				element: <MySchedule />,
			},
			{
				path: 'subjects',
				element: <Subjects />,
			},
			{
				path: 'subjects/requirements',
				element: <RetiredRequirementsRedirect />,
			},
			{
				path: 'subjects/decision-workspace',
				element: <RetiredRequirementsRedirect />,
			},
			{
				path: 'teachers',
				element: <Faculty />,
			},
			{
				path: 'teaching-load/history',
				element: <TeachingLoadHistory />,
			},
			{
				path: 'teaching-load',
				element: <TeachingLoadRoute />,
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
				children: [
					// UX-R03a — index and policies share one mounted workspace shell
					// (ScheduleReview renders the workspace once plus an Outlet).
					// UX-R03b — the four remaining existing center views join the
					// same shell: pre-generation, map, manual-edit, building.
					// UX-R03c — the exports sub-page joins the same shell.
					// UX-R03e (runs) — the read-only run-history sub-page joins the same shell.
					// UX-R03e (setup) — the composed setup sub-page joins the same shell.
					// The URL only drives the existing centerView state through the
					// guarded setter (see TimetableRouteViewSync); the children below
					// render an explicit `null` element, so navigating between them
					// never unmounts the review workspace, the grid, or the query
					// cache and issues no fresh data requests. The explicit null (as
					// opposed to an element-less child) also clears React Router's
					// "Matched leaf route … does not have an element or Component"
					// warning for all nine `/timetable*` routes (A5).
					{ index: true, element: null },
					{ path: 'policies', element: null },
					{ path: 'pre-generation', element: null },
					{ path: 'map', element: null },
					{ path: 'manual-edit', element: null },
					{ path: 'building', element: null },
					{ path: 'exports', element: null },
					{ path: 'runs', element: null },
					{ path: 'setup', element: null },
					// Unknown children fall back to the index surface, never a blank center.
					{ path: '*', element: <Navigate to="/timetable" replace /> },
				],
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
				path: 'schedules',
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
		{
			path: 'admin/year-setup',
			element: <AdminYearSetup />,
		},
		{ path: '*', element: <Navigate to="/" replace /> },
		],
	},
]);

export function App() {
	return (
		<>
			<RouterProvider router={router} />
			<Toaster
				richColors
				position="bottom-center"
				offset={{ bottom: 24, right: 24, left: 24 }}
				mobileOffset={{ bottom: 16, right: 16, left: 16 }}
			/>
		</>
	);
}
