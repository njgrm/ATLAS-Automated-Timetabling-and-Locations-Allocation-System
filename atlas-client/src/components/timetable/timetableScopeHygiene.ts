/**
 * TT-DYNAMIC-WORKSPACE-C04 (R5) — the scope-key decision that gates clearing of
 * every component-local timetable state on school/year/run/term change.
 *
 * The production effect uses {@link shouldClearForScopeChange} and only then
 * runs {@link clearScopeState}; no scoped request may be dispatched before the
 * clearers run.
 */

export function buildScopeKey(parts: {
	schoolId: number | null | undefined;
	schoolYearId: number | null | undefined;
	runId: number | null | undefined;
	termFilter: 'all' | number | null | undefined;
}): string {
	return [
		`school:${parts.schoolId ?? 'none'}`,
		`year:${parts.schoolYearId ?? 'none'}`,
		`run:${parts.runId ?? 'none'}`,
		`term:${parts.termFilter ?? 'all'}`,
	].join('|');
}

/**
 * The first observed key is not a change (initial mount). A null previous key
 * never clears. Only a real, non-null change clears.
 */
export function shouldClearForScopeChange(previousKey: string | null, nextKey: string): boolean {
	if (previousKey === null) return false;
	return previousKey !== nextKey;
}

export function clearScopeState(clearers: ReadonlyArray<() => void>): void {
	for (const clear of clearers) clear();
}
