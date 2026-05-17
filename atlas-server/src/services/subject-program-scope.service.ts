/**
 * Subject Program Scope Service
 *
 * Resolves which program types (REGULAR, STE, SPA, etc.) a subject belongs to.
 *
 * Priority:
 *  1. Stored programScopes from Subject record (explicit, data-driven)
 *  2. Heuristic inference from subject code/name (legacy fallback only)
 *
 * For new subjects, always set programScopes explicitly.
 * Heuristic inference is preserved only for backward compatibility with
 * subjects seeded before programScopes was introduced.
 */

export type SubjectProgramScope = 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'OTHER';

// Legacy heuristic — used only when a subject has no stored programScopes
const STE_SUBJECT_CODES = new Set([
	'ENV_SCI',
	'RESEARCH_I',
	'BASIC_STATISTICS',
	'RESEARCH_II',
	'ADVANCED_STATISTICS',
	'BIOTECHNOLOGY',
	'RESEARCH_III',
	'ADVANCED_PHYSICS',
	'ADVANCED_CHEMISTRY',
	'ELECTRONICS',
]);

function normalizeProgramCode(raw: string | null | undefined): string {
	if (!raw) return 'REGULAR';
	return raw.trim().toUpperCase();
}

/** Heuristic inference — fallback only, not for new data. */
export function inferSubjectProgramScopes(subjectCode: string, subjectName?: string): SubjectProgramScope[] {
	const code = subjectCode.trim().toUpperCase();
	const name = (subjectName ?? '').trim().toUpperCase();

	if (STE_SUBJECT_CODES.has(code) || code.startsWith('STE_') || name.includes('[STE]')) {
		return ['STE'];
	}

	if (code.startsWith('SPA_') || name.includes('[SPA]')) {
		return ['SPA'];
	}

	if (code.startsWith('SPS_') || name.includes('[SPS]')) {
		return ['SPS'];
	}

	return ['REGULAR'];
}

/**
 * Determine whether a subject is allowed for a given section's program type.
 *
 * @param subjectCode      - Subject code string
 * @param sectionProgramCode - Section's program type code (e.g. 'STE', 'SPA', 'REGULAR')
 * @param storedScopes     - Explicit programScopes from the Subject DB record (preferred)
 */
export function isSubjectAllowedForSectionProgram(
	subjectCode: string,
	sectionProgramCode: string | null | undefined,
	storedScopes?: string[] | null,
): boolean {
	// Use stored scopes when available; fall back to heuristic
	const scopes: string[] = (storedScopes && storedScopes.length > 0)
		? storedScopes
		: inferSubjectProgramScopes(subjectCode);

	const sectionProgram = normalizeProgramCode(sectionProgramCode);

	if (sectionProgram === 'STE') {
		// STE sections get subjects scoped to REGULAR or STE; never SPA-only
		if (scopes.includes('SPA') && !scopes.includes('REGULAR') && !scopes.includes('STE')) return false;
		return scopes.includes('REGULAR') || scopes.includes('STE');
	}

	if (sectionProgram === 'SPA') {
		// SPA sections get subjects scoped to REGULAR or SPA; never STE-only
		if (scopes.includes('STE') && !scopes.includes('REGULAR') && !scopes.includes('SPA')) return false;
		return scopes.includes('REGULAR') || scopes.includes('SPA');
	}

	if (sectionProgram === 'SPS') {
		// SPS sections get subjects scoped to REGULAR or SPS; never STE/SPA-only.
		if ((scopes.includes('STE') || scopes.includes('SPA')) && !scopes.includes('REGULAR') && !scopes.includes('SPS')) return false;
		return scopes.includes('REGULAR') || scopes.includes('SPS');
	}

	if (sectionProgram === 'OTHER') {
		return scopes.includes('REGULAR') || scopes.includes('OTHER');
	}

	// REGULAR and all other programs: only REGULAR-scoped subjects
	return scopes.includes('REGULAR');
}
