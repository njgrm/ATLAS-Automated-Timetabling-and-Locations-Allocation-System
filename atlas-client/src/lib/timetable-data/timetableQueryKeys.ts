/**
 * UX-P01 (R2) — the single scope identity for every TanStack Query cache entry
 * that the Timetable data layer owns.
 *
 * A cache entry is keyed by `(schoolId, schoolYearId, runId, termIndex)`. A
 * change to any part of that tuple MUST produce a different query key, so a
 * scope change can never be served another scope's cached data. The four-part
 * identity is also serialized by {@link buildTimetableScopeKey} and is what the
 * warm-snapshot handoff (R4) pins, so a stale scope can never rehydrate the
 * grid.
 */

export const TIMETABLE_QUERY_ROOT = 'timetable';

export type TimetableScope = {
	schoolId: number | null | undefined;
	schoolYearId: number | null | undefined;
	runId: string | number | null | undefined;
	termIndex: 'all' | number | null | undefined;
};

export type ResolvedTimetableScope = {
	schoolId: number;
	schoolYearId: number;
	runId: string | number | null;
	termIndex: 'all' | number;
};

/** Strict positive-integer check: actor/tenant scope is never inferred. */
function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * The minimal resolved scope required to dispatch any school/year-scoped read.
 * Unresolved actor school or year fails closed: no query key is derived and no
 * request is dispatched.
 */
export function isResolvedTimetableScope(
	scope: TimetableScope,
): scope is ResolvedTimetableScope {
	return isPositiveInteger(scope.schoolId) && isPositiveInteger(scope.schoolYearId);
}

function scopeRunPart(runId: string | number | null | undefined): string | number {
	return runId ?? 'none';
}

function scopeTermPart(termIndex: 'all' | number | null | undefined): string | number {
	return termIndex ?? 'all';
}

/** Human-readable identity of the complete four-part scope. */
export function buildTimetableScopeKey(scope: TimetableScope): string {
	return [
		`school:${scope.schoolId ?? 'none'}`,
		`year:${scope.schoolYearId ?? 'none'}`,
		`run:${scopeRunPart(scope.runId)}`,
		`term:${scopeTermPart(scope.termIndex)}`,
	].join('|');
}

function baseScopeKey(scope: TimetableScope): Array<string | number> {
	return [
		TIMETABLE_QUERY_ROOT,
		scope.schoolId ?? 'none',
		scope.schoolYearId ?? 'none',
	];
}

/** School/year-scoped reads whose payload does not vary by run or term. */
export function timetableRunsQueryKey(scope: TimetableScope): Array<string | number> {
	return [...baseScopeKey(scope), 'runs'];
}

export function timetableReferenceQueryKey(scope: TimetableScope): Array<string | number> {
	return [...baseScopeKey(scope), 'reference'];
}

export function timetableDraftBoardQueryKey(scope: TimetableScope): Array<string | number> {
	return [...baseScopeKey(scope), 'pre-generation-drafts'];
}

export function timetableReadinessQueryKey(scope: TimetableScope): Array<string | number> {
	return [...baseScopeKey(scope), 'readiness-diagnostic'];
}

export function timetableRoomRequestQueryKey(
	scope: TimetableScope,
	statusFilter: string,
	decisionFilter: string,
): Array<string | number> {
	return [...baseScopeKey(scope), 'room-requests', statusFilter, decisionFilter];
}

/**
 * The canonical term-independent identity of a run bundle. The server payload
 * already carries every ordered term, so the transport read is shared across
 * term selections while the term-scoped key below remains the entry the UI
 * reads. This keeps a term switch from re-issuing HTTP while still guaranteeing
 * that a different `(schoolId, schoolYearId, runId)` can never reuse it.
 */
export function timetableRunBundleBaseQueryKey(scope: TimetableScope): Array<string | number> {
	return [...baseScopeKey(scope), 'run', scopeRunPart(scope.runId), 'base'];
}

/**
 * The four-part run-scoped key. `termIndex` participates in the identity per the
 * R2 contract; the query function delegates to the term-independent base entry
 * so a term change is a cache hit rather than a new request.
 */
export function timetableRunBundleQueryKey(scope: TimetableScope): Array<string | number> {
	return [
		...baseScopeKey(scope),
		'run',
		scopeRunPart(scope.runId),
		'term',
		scopeTermPart(scope.termIndex),
	];
}

export function timetableFollowUpsQueryKey(scope: TimetableScope): Array<string | number> {
	return [...baseScopeKey(scope), 'run', scopeRunPart(scope.runId), 'follow-ups'];
}

/**
 * C2 (TIMETABLE-RELAXED-MAIN-C01) — the sub-page pane's policy reads.
 *
 * These payloads are school/year-scoped and run/term-invariant, but the key
 * embeds {@link buildTimetableScopeKey}, so the complete four-part identity
 * (school, year, run, term) is carried and any scope change invalidates. An
 * unresolved scope never derives a key: the loader fails closed first.
 */
function policyAuxiliaryQueryKey(scope: TimetableScope, endpoint: string): Array<string | number> {
	return [TIMETABLE_QUERY_ROOT, 'policy', endpoint, buildTimetableScopeKey(scope)];
}

export function timetableGradeWindowsQueryKey(scope: TimetableScope): Array<string | number> {
	return policyAuxiliaryQueryKey(scope, 'grade-windows');
}

export function timetableSectionsSummaryQueryKey(scope: TimetableScope): Array<string | number> {
	return policyAuxiliaryQueryKey(scope, 'sections-summary');
}

export function timetablePolicySpecialEventsQueryKey(scope: TimetableScope): Array<string | number> {
	return policyAuxiliaryQueryKey(scope, 'special-events');
}
