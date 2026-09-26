import { createBrowserRouter, Navigate, RouterProvider, useLocation, useSearchParams, type RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';

import { AppShell } from './components/AppShell';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { PageHeader } from './components/app-shell/PageHeader';
import { resolveRouteChrome } from './components/app-shell/navigation';
import { Card, CardContent } from './ui/card';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapEditor = lazy(() => import('./pages/MapEditor'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Faculty = lazy(() => import('./pages/Faculty'));
const TeachingLoad = lazy(() => import('./pages/TeachingLoad'));
const TeachingLoadHistory = lazy(() => import('./components/faculty-assignments/TeachingLoadHistoryView'));
const Sections = lazy(() => import('./pages/Sections'));
const OfficerPreferences = lazy(() => import('./pages/OfficerPreferences'));
const OfficerRoomPreferences = lazy(() => import('./pages/OfficerRoomPreferences'));
const TeacherConcerns = lazy(() => import('./pages/TeacherConcerns'));
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
 * Operator instruction 2026-09-26 — the `/my` faculty portal is retired and
 * must not be reachable. The route declaration is deliberately KEPT (the same
 * tombstone idea as `RetiredRequirementsRedirect`) because `/my` is the
 * faculty landing destination in five places: `pages/Login.tsx`,
 * `components/AppShell.tsx` (both the session-verification landing and the
 * portal-route guard), `components/app-shell/FacultyMobileBottomNav.tsx`, and
 * `lib/auth.ts` (`FACULTY_PORTAL_ROUTES`, kept so the guard does not
 * redirect-loop against this tombstone). Removing the registration would drop
 * faculty on an unmatched URL; redirecting to `/` would drop them on the
 * OPERATOR setup surface in `pages/Dashboard.tsx`.
 *
 * This component therefore renders only a truthful retirement notice: it
 * mounts no dashboard, dispatches no `/faculty-portal/<school>/<year>/dashboard`
 * or any other faculty-portal request, and reads no state. Its title and
 * breadcrumb group come from `resolveRouteChrome` so the tombstone satisfies
 * the shared-chrome contract (`lib/__tests__/ux-r01-shared-chrome.test.tsx`)
 * instead of inventing a second title.
 *
 * The retirement is reversible "until further notice", so the parked
 * implementation stays on disk at `pages/MyDashboard.tsx` with its exported
 * `loadMyDashboardScoped`; only the route wiring is commented out of reach.
 */
export function RetiredFacultyPortalNotice() {
	const location = useLocation();
	const { title, breadcrumbs } = resolveRouteChrome(location.pathname);

	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden'>
			<div className='flex-1 min-h-0 overflow-auto px-4 py-5 sm:px-6'>
				<div className='mx-auto w-full max-w-6xl space-y-4'>
					<PageHeader
						title={title}
						eyebrow={breadcrumbs.length > 1 ? breadcrumbs[0] : undefined}
						subtitle='Retired on 26 September 2026. This page stays reachable so older bookmarks and sign-in landings do not break.'
					/>

					<Card className='rounded-2xl' data-testid='retired-faculty-portal-notice'>
						<CardContent className='py-6'>
							<p className='text-sm font-semibold leading-snug text-foreground'>
								This faculty portal is retired.
							</p>
							<p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
								Teacher self-service is handled in SMART. Nothing on this page loads your dashboard,
								schedule, teaching assignments, or room requests.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
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

export const appRoutes: RouteObject[] = [
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
				// Operator instruction 2026-09-26 — the faculty portal is retired.
				// The path stays registered (see RetiredFacultyPortalNotice); the
				// dashboard element is deliberately NOT mounted here.
				path: 'my',
				element: <RetiredFacultyPortalNotice />,
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
				path: 'faculty/concerns',
				element: <TeacherConcerns />,
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
];

const router = createBrowserRouter(appRoutes);

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
