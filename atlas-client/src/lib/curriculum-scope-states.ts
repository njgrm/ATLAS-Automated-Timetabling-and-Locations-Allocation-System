/**
 * SCA-02.2 — pure view-state helpers for the Curriculum Requirements surface.
 *
 * Kept free of React so the state machine (loading / error / empty /
 * configured, plus per-scope MISSING / EMPTY / CONFIGURED / STALE /
 * CONFLICTING) is unit-testable through the real derivation path.
 */

export type CurriculumScopeState = 'MISSING' | 'EMPTY' | 'CONFIGURED' | 'STALE' | 'CONFLICTING';

export interface CurriculumScopeStatus {
	scopeKey: string;
	gradeLevel: number | null;
	programType: string | null;
	sectionMirrorId: number | null;
	cohortId: number | null;
	state: CurriculumScopeState;
	requirementIds: number[];
	detail: string;
}

export interface CurriculumReadiness {
	ready: boolean;
	termConfigPresent: boolean;
	requirementCount: number;
	scopeStates: CurriculumScopeStatus[];
	blockers: Array<{ code: string; scopeKey: string; message: string }>;
}

export type CurriculumViewState = 'loading' | 'error' | 'missing-config' | 'empty' | 'configured';

export const SCOPE_STATE_LABELS: Record<CurriculumScopeState, string> = {
	MISSING: 'Missing',
	EMPTY: 'Explicitly empty',
	CONFIGURED: 'Configured',
	STALE: 'Stale',
	CONFLICTING: 'Conflicting',
};

export function deriveCurriculumViewState(args: {
	loading: boolean;
	error: string | null;
	termConfigPresent: boolean;
	requirementCount: number;
}): CurriculumViewState {
	if (args.loading) return 'loading';
	if (args.error) return 'error';
	if (!args.termConfigPresent) return 'missing-config';
	if (args.requirementCount === 0) return 'empty';
	return 'configured';
}

export function scopeDisplayName(scope: Pick<CurriculumScopeStatus, 'gradeLevel' | 'programType' | 'sectionMirrorId' | 'cohortId' | 'scopeKey'>): string {
	if (scope.scopeKey === '*') return 'Whole school year';
	const parts: string[] = [];
	if (scope.gradeLevel !== null) parts.push(`Grade ${scope.gradeLevel}`);
	if (scope.programType !== null) parts.push(scope.programType);
	if (scope.sectionMirrorId !== null) parts.push(`Section #${scope.sectionMirrorId}`);
	if (scope.cohortId !== null) parts.push(`Cohort #${scope.cohortId}`);
	return parts.length > 0 ? parts.join(' · ') : scope.scopeKey;
}

/** Filter requirements to one scope key; '*' (whole-year) disables filtering. */
export function filterRequirementsByScope<T extends { id: number }>(
	requirements: T[],
	scopeKey: string | null,
	idSets: Map<string, number[]>,
): T[] {
	if (!scopeKey || scopeKey === '*') return requirements;
	const ids = idSets.get(scopeKey);
	if (!ids) return [];
	const wanted = new Set(ids);
	return requirements.filter((r) => wanted.has(r.id));
}

export function buildScopeIdSets(scopes: CurriculumScopeStatus[]): Map<string, number[]> {
	const map = new Map<string, number[]>();
	for (const scope of scopes) {
		map.set(scope.scopeKey, scope.requirementIds);
	}
	return map;
}

export interface YearScopeContext {
	activeSchoolYearId: number | null;
	schoolId: number | null;
}

export type YearScopeVerdict =
	| { ok: true; schoolYearId: number }
	| { ok: false; reason: 'actor-unresolved' | 'year-unresolved' | 'school-mismatch' };

/**
 * SCA-02R: the client must obtain active-year context for the resolved
 * actor school and must never inherit a school-1 runtime default for
 * another actor. A context whose schoolId disagrees with the actor school
 * is unusable — the page must show an explicit scope state and issue no
 * year-scoped requests.
 */
export function resolveCurriculumYearScope(
	actorSchoolId: number | null,
	context: YearScopeContext | null,
): YearScopeVerdict {
	if (actorSchoolId == null) return { ok: false, reason: 'actor-unresolved' };
	if (context == null || context.activeSchoolYearId == null) return { ok: false, reason: 'year-unresolved' };
	if (context.schoolId != null && context.schoolId !== actorSchoolId) return { ok: false, reason: 'school-mismatch' };
	return { ok: true, schoolYearId: context.activeSchoolYearId };
}
