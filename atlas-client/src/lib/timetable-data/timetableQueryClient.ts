/**
 * UX-P01 (R2) — the shared TanStack Query client for Timetable server state.
 *
 * One singleton client is used by the QueryClientProvider (main.tsx), the
 * imperative data-layer bridge, and the hover/focus prefetch handlers. Sharing
 * one client is what makes a prefetched read an instant cache hit when the
 * Timetable route mounts.
 */
import { QueryClient } from '@tanstack/react-query';

/** Revisits within this window render the cached snapshot without a refetch. */
export const TIMETABLE_STALE_MS = 60_000;

/** How long an unmounted route's snapshot stays available for instant rehydrate. */
export const TIMETABLE_GC_MS = 5 * 60_000;

export function createTimetableQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: TIMETABLE_STALE_MS,
				gcTime: TIMETABLE_GC_MS,
				refetchOnWindowFocus: false,
				retry: 1,
			},
		},
	});
}

export const timetableQueryClient = createTimetableQueryClient();
