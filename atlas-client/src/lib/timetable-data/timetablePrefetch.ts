/**
 * UX-P01 (R3) — hover/focus prefetch for the Timetable entry points.
 *
 * The navigation affordances that lead into `/timetable` warm two things on
 * hover/focus: the lazy route chunk and the scoped server-state queries. Both
 * are read-only. When the route finally mounts, the chunk is already parsed and
 * the first render can read the cached snapshot instead of the network.
 */
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { isVerifiedOrderedActiveTerm } from '@/lib/academic-term';
import { resolveActorSchoolId } from '@/lib/settings';
import { TIMETABLE_STALE_MS, timetableQueryClient } from './timetableQueryClient';
import {
	isResolvedTimetableScope,
	timetableDraftBoardQueryKey,
	timetableReferenceQueryKey,
	timetableRunBundleBaseQueryKey,
	timetableRunsQueryKey,
	type TimetableScope,
} from './timetableQueryKeys';
import {
	fetchTimetableDraftBoard,
	fetchTimetableReferenceData,
	fetchTimetableRunBundle,
	fetchTimetableRuns,
} from './timetableDataSources';
import { readTimetableWarmScope } from './timetableServerState';

// ─── Lazy route chunk prefetch ───

const lazyRouteLoaders: Record<string, () => Promise<unknown>> = {
	'/': () => import('@/pages/Dashboard'),
	'/subjects': () => import('@/pages/Subjects'),
	'/teachers': () => import('@/pages/Faculty'),
	'/teaching-load': () => import('@/pages/TeachingLoad'),
	'/sections': () => import('@/pages/Sections'),
	'/timetable': () => import('@/pages/ScheduleReview'),
	'/schedules': () => import('@/pages/RoomSchedules'),
	'/map': () => import('@/pages/MapEditor'),
	'/audit': () => import('@/pages/Audit'),
	'/admin/year-setup': () => import('@/pages/AdminYearSetup'),
};

const prefetchedRoutePaths = new Set<string>();

export function resolveVerifiedActiveTermIndex(
	activeTerm: Awaited<ReturnType<typeof resolveActiveSchoolYearContext>>['activeTerm'] | null | undefined,
): number | null {
	if (!isVerifiedOrderedActiveTerm(activeTerm) || activeTerm.termIndex == null) return null;
	return activeTerm.termIndex;
}

/** Prefetch the route-level chunk for a known navigation path. */
export function prefetchLazyRouteChunk(path: string): void {
	if (prefetchedRoutePaths.has(path)) return;
	const loader = lazyRouteLoaders[path];
	if (!loader) return;
	prefetchedRoutePaths.add(path);
	void loader().catch(() => {
		// A failed prefetch is best-effort; the real navigation retries it.
		prefetchedRoutePaths.delete(path);
	});
}

/**
 * The `/timetable` route is a page chunk that lazily loads the heavy workspace
 * chunk. Prefetch both so a hover is enough to have the whole route in memory.
 */
export function prefetchTimetableRoute(): void {
	prefetchLazyRouteChunk('/timetable');
	void import('@/components/timetable/ScheduleReviewWorkspace').catch(() => {
		// Best-effort; the route's own Suspense boundary still resolves it.
	});
}

// ─── Scoped server-state prefetch ───

/** Prefetch the school/year-scoped reads for an already-resolved scope. */
export function prefetchTimetableScopeData(scope: TimetableScope, runId?: string | number): void {
	// Prefetch must never invent an all-term scope. The mounted route may opt
	// into All terms after authority resolves, but hover/focus prefetch always
	// warms the verified active numeric term only.
	if (!isResolvedTimetableScope(scope) || typeof scope.termIndex !== 'number') return;
	const resolved = { ...scope, runId: runId ?? scope.runId ?? 'latest' };
	void timetableQueryClient.prefetchQuery({
		queryKey: timetableRunsQueryKey(resolved),
		queryFn: () => fetchTimetableRuns(resolved.schoolId, resolved.schoolYearId),
		staleTime: TIMETABLE_STALE_MS,
	});
	void timetableQueryClient.prefetchQuery({
		queryKey: timetableReferenceQueryKey(resolved),
		queryFn: () => fetchTimetableReferenceData(resolved.schoolId, resolved.schoolYearId),
		staleTime: TIMETABLE_STALE_MS,
	});
	void timetableQueryClient.prefetchQuery({
		queryKey: timetableDraftBoardQueryKey(resolved),
		queryFn: () => fetchTimetableDraftBoard(resolved.schoolId, resolved.schoolYearId),
		staleTime: TIMETABLE_STALE_MS,
	});
	void timetableQueryClient.prefetchQuery({
		queryKey: timetableRunBundleBaseQueryKey(resolved),
		queryFn: () => fetchTimetableRunBundle(resolved.schoolId, resolved.schoolYearId, resolved.runId ?? 'latest'),
		staleTime: TIMETABLE_STALE_MS,
	});
}

/**
 * The single handler a Timetable nav affordance calls on hover/focus. It always
 * prefetches the chunk; when a warm scope is already known it also warms the
 * data, and otherwise it warms the actor school / active year bootstrap so the
 * route's first load is a cache hit.
 */
export function prefetchTimetableEntryPoint(): void {
	prefetchTimetableRoute();
	const warmScope = readTimetableWarmScope();
	void (async () => {
		try {
			const schoolId = warmScope?.schoolId ?? await resolveActorSchoolId();
			if (!schoolId) return;
			const context = await resolveActiveSchoolYearContext({
				schoolId,
				preferCache: true,
				backgroundRefresh: true,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			const verifiedActiveTerm = resolveVerifiedActiveTermIndex(context.activeTerm);
			if (!context.activeSchoolYearId || verifiedActiveTerm == null) return;
			prefetchTimetableScopeData({
				schoolId,
				schoolYearId: context.activeSchoolYearId,
				runId: 'latest',
				termIndex: verifiedActiveTerm,
			});
		} catch {
			// Prefetch is best-effort and must never surface an error to the user.
		}
	})();
}

/**
 * The one function every navigation affordance calls. It routes the Timetable
 * destination through the full entry-point warm-up and every other destination
 * through the generic lazy chunk prefetch.
 */
export function prefetchNavDestination(to: string): void {
	if (to === '/timetable') {
		prefetchTimetableEntryPoint();
		return;
	}
	prefetchLazyRouteChunk(to);
}
