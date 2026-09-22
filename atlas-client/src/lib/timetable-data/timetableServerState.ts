/**
 * UX-P01 (R1/R2/R4) — the imperative bridge between the Timetable React hook
 * and the TanStack Query cache.
 *
 * The hook keeps its existing per-mount React state, but every transport read
 * now flows through this module's scoped query keys. That gives the route:
 *   - one cache with `(schoolId, schoolYearId, runId, termIndex)` identity,
 *   - `staleTime`/`gcTime` freshness instead of a hand-rolled TTL map,
 *   - a warm snapshot the route can rehydrate from on revisit (R4).
 */
import { getPreferredAccessToken } from '@/lib/auth';
import { TIMETABLE_STALE_MS, timetableQueryClient } from './timetableQueryClient';
import {
	buildTimetableScopeKey,
	isResolvedTimetableScope,
	timetableDraftBoardQueryKey,
	timetableFollowUpsQueryKey,
	timetableGradeWindowsQueryKey,
	timetablePolicySpecialEventsQueryKey,
	timetableReadinessQueryKey,
	timetableReferenceQueryKey,
	timetableRoomRequestQueryKey,
	timetableRunBundleBaseQueryKey,
	timetableRunBundleQueryKey,
	timetableRunsQueryKey,
	timetableSectionsSummaryQueryKey,
	type ResolvedTimetableScope,
	type TimetableScope,
} from './timetableQueryKeys';
import {
	fetchTimetableDraftBoard,
	fetchTimetableFollowUpEntryIds,
	fetchTimetableGradeWindows,
	fetchTimetablePolicySpecialEvents,
	fetchTimetableReadiness,
	fetchTimetableReferenceData,
	fetchTimetableRoomRequestSummary,
	fetchTimetableRunBundle,
	fetchTimetableRuns,
	fetchTimetableSectionsSummary,
	type TimetableReferenceData,
	type TimetableRunBundle,
} from './timetableDataSources';
import type {
	DraftBoardState,
	GenerationRun,
	GradeShiftWindow,
	PolicySpecialEvent,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	SectionSummaryResponse,
} from '@/types';

type EnsureOptions = { force?: boolean };

async function ensureQuery<T>(
	queryKey: ReadonlyArray<string | number>,
	queryFn: () => Promise<T>,
	{ force = false }: EnsureOptions = {},
): Promise<T> {
	if (force) {
		// Mark stale without notifying observers; the fetch below owns the update.
		await timetableQueryClient.invalidateQueries({ queryKey, refetchType: 'none' });
	}
	return timetableQueryClient.fetchQuery({
		queryKey,
		queryFn,
		staleTime: force ? 0 : TIMETABLE_STALE_MS,
	});
}

/** Builds the resolved scope or throws, so an unresolved scope never dispatches. */
function requireScope(scope: TimetableScope): ResolvedTimetableScope {
	if (!isResolvedTimetableScope(scope)) {
		throw new Error('Authenticated school scope is unavailable.');
	}
	return scope;
}

export async function ensureTimetableRuns(
	scope: TimetableScope,
	options?: EnsureOptions,
): Promise<GenerationRun[]> {
	const resolved = requireScope(scope);
	return ensureQuery(
		timetableRunsQueryKey(resolved),
		() => fetchTimetableRuns(resolved.schoolId, resolved.schoolYearId),
		options,
	);
}

export async function ensureTimetableReadiness(
	scope: TimetableScope,
	options?: EnsureOptions,
): Promise<unknown> {
	const resolved = requireScope(scope);
	return ensureQuery(
		timetableReadinessQueryKey(resolved),
		() => fetchTimetableReadiness(resolved.schoolId, resolved.schoolYearId),
		options,
	);
}

/**
 * Fetches the run bundle into the term-independent base entry. The four-part
 * run-scoped key is populated by the reactive `useQuery` in the hook from this
 * same entry, so a term switch is a cache hit and never a new request.
 */
export async function ensureTimetableRunBundle(
	scope: TimetableScope,
	options?: EnsureOptions,
): Promise<TimetableRunBundle> {
	const resolved = requireScope(scope);
	const bundle = await ensureQuery(
		timetableRunBundleBaseQueryKey(resolved),
		() => fetchTimetableRunBundle(resolved.schoolId, resolved.schoolYearId, resolved.runId ?? 'latest'),
		options,
	);
	// Keep the four-part term-scoped entry the reactive hook reads in step with
	// the base entry (notably after a forced refresh) without re-issuing HTTP.
	timetableQueryClient.setQueryData(timetableRunBundleQueryKey(resolved), bundle);
	return bundle;
}

export function readTimetableRunBundle(scope: TimetableScope): TimetableRunBundle | undefined {
	if (!isResolvedTimetableScope(scope)) return undefined;
	return timetableQueryClient.getQueryData<TimetableRunBundle>(timetableRunBundleBaseQueryKey(scope));
}

export async function ensureTimetableFollowUps(
	scope: TimetableScope,
	numericRunId: number,
): Promise<string[]> {
	const resolved = requireScope(scope);
	return ensureQuery(
		timetableFollowUpsQueryKey(resolved),
		() => fetchTimetableFollowUpEntryIds(resolved.schoolId, resolved.schoolYearId, numericRunId),
	);
}

export async function ensureTimetableDraftBoard(
	scope: TimetableScope,
	options?: EnsureOptions,
): Promise<DraftBoardState> {
	const resolved = requireScope(scope);
	return ensureQuery(
		timetableDraftBoardQueryKey(resolved),
		() => fetchTimetableDraftBoard(resolved.schoolId, resolved.schoolYearId),
		options,
	);
}

export async function ensureTimetableRoomRequestSummary(
	scope: TimetableScope,
	statusFilter: 'ALL' | RoomPreferenceStatus,
	decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
	options?: EnsureOptions,
): Promise<RoomPreferenceSummaryResponse> {
	const resolved = requireScope(scope);
	return ensureQuery(
		timetableRoomRequestQueryKey(resolved, statusFilter, decisionFilter),
		() => fetchTimetableRoomRequestSummary(resolved.schoolId, resolved.schoolYearId, statusFilter, decisionFilter),
		options,
	);
}

export async function ensureTimetableReferenceData(
	scope: TimetableScope,
	options?: EnsureOptions,
): Promise<TimetableReferenceData> {
	const resolved = requireScope(scope);
	return ensureQuery(
		timetableReferenceQueryKey(resolved),
		() => fetchTimetableReferenceData(resolved.schoolId, resolved.schoolYearId),
		options,
	);
}

export type TimetablePolicyAuxiliary = {
	gradeWindows: GradeShiftWindow[];
	sectionsSummary: SectionSummaryResponse | null;
	specialEvents: PolicySpecialEvent[];
};

/**
 * C2 (TIMETABLE-RELAXED-MAIN-C01) — the sub-page policy pane's three reads
 * (grade windows, section summary, special events), resolved through the shared
 * scoped cache. A revisit within the same scope is a cache hit; each read keeps
 * the pane's existing per-endpoint fail-soft behaviour (a failed read yields the
 * empty/null fallback, never a thrown render). An unresolved scope throws before
 * any request is dispatched.
 */
export async function ensureTimetablePolicyAuxiliary(
	scope: TimetableScope,
	options?: EnsureOptions,
): Promise<TimetablePolicyAuxiliary> {
	const resolved = requireScope(scope);
	const [gradeWindows, sectionsSummary, specialEvents] = await Promise.all([
		ensureQuery(
			timetableGradeWindowsQueryKey(resolved),
			() => fetchTimetableGradeWindows(resolved.schoolId, resolved.schoolYearId),
			options,
		).catch(() => null),
		ensureQuery(
			timetableSectionsSummaryQueryKey(resolved),
			() => fetchTimetableSectionsSummary(resolved.schoolId, resolved.schoolYearId),
			options,
		).catch(() => null),
		ensureQuery(
			timetablePolicySpecialEventsQueryKey(resolved),
			() => fetchTimetablePolicySpecialEvents(resolved.schoolId, resolved.schoolYearId),
			options,
		).catch(() => null),
	]);
	return {
		gradeWindows: gradeWindows?.windows ?? [],
		sectionsSummary: sectionsSummary ?? null,
		specialEvents: specialEvents?.events ?? [],
	};
}

// ─── Warm snapshot (R4) ───
// The route's React state is per-mount; the query cache is not. To render the
// previous data instead of a skeleton on revisit, the last successfully loaded
// scope is remembered and its cached snapshot is read back synchronously. The
// snapshot is bound to the exact auth token epoch that produced it, so a
// logout / re-login / actor-school change can never rehydrate another scope.

let warmScope: ResolvedTimetableScope | null = null;
let warmTokenEpoch: string | null = null;

export function recordTimetableWarmScope(scope: TimetableScope): void {
	if (!isResolvedTimetableScope(scope)) return;
	const token = getPreferredAccessToken();
	if (!token) return;
	warmScope = scope;
	warmTokenEpoch = token;
}

export type TimetableWarmSnapshot = {
	scopeKey: string;
	scope: ResolvedTimetableScope;
	runs: GenerationRun[];
	bundle: TimetableRunBundle | null;
	reference: TimetableReferenceData | null;
	draftBoard: DraftBoardState | null;
};

/** The last successfully loaded scope for the current token epoch, if any. */
export function readTimetableWarmScope(): ResolvedTimetableScope | null {
	const token = getPreferredAccessToken();
	if (!token || !warmScope || token !== warmTokenEpoch) return null;
	return warmScope;
}

export function readTimetableWarmSnapshot(): TimetableWarmSnapshot | null {
	const token = getPreferredAccessToken();
	if (!token || !warmScope || token !== warmTokenEpoch) return null;
	const scope = warmScope;
	const runs = timetableQueryClient.getQueryData<GenerationRun[]>(timetableRunsQueryKey(scope));
	if (!runs) return null;
	return {
		scopeKey: buildTimetableScopeKey(scope),
		scope,
		runs,
		bundle: readTimetableRunBundle(scope) ?? null,
		reference: timetableQueryClient.getQueryData<TimetableReferenceData>(timetableReferenceQueryKey(scope)) ?? null,
		draftBoard: timetableQueryClient.getQueryData<DraftBoardState>(timetableDraftBoardQueryKey(scope)) ?? null,
	};
}

/** Test/scope-hygiene helper: drop the remembered warm scope. */
export function resetTimetableWarmScope(): void {
	warmScope = null;
	warmTokenEpoch = null;
}
