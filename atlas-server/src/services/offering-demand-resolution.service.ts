/**
 * Prompt 03B — Offering demand resolution (SHADOW MODULE, read-only).
 *
 * This module resolves DEMAND from a persisted SchoolYearOffering candidate
 * model WITHOUT touching runtime generation authority. It is consumed only by:
 *  - unit tests locking the Prompt 03 offering contracts (Phase 10),
 *  - read-only artifact generators (shadow-demand comparison, capacity impact).
 *
 * Runtime switching of `computeDemand`/readiness to offering authority is a
 * separate, explicitly authorized rollout stage (see compatibility rollout
 * manifest). Nothing in this module writes to the database.
 *
 * Term semantics (Phase 4 decision):
 *  - ALL_TERMS                — subject runs every term of the school year;
 *  - SINGLE_TERM              — subject runs in exactly one term (activeTerm);
 *  - ROTATING_FAMILY_MEMBER   — member of an ordered rotating family; it runs
 *                               only during its own term(s) (termApplicability);
 *  - SELECTED_TERMS           — subject active in a non-contiguous subset;
 *  - EMPTY_SCOPE              — scope intentionally offers nothing (explicit);
 *  - UNKNOWN                  — term structure missing/incomplete → BLOCK.
 *
 * Total terms, term identities, order and family membership ALWAYS come from
 * the caller-supplied persisted configuration (termConfig), never from
 * hardcoded three-term assumptions.
 */

export type OfferingClassification = 'CORE' | 'SPECIALIZATION' | 'EXPLORATORY' | 'OTHER';

export type TermBehavior =
	| 'ALL_TERMS'
	| 'SINGLE_TERM'
	| 'ROTATING_FAMILY_MEMBER'
	| 'SELECTED_TERMS'
	| 'EMPTY_SCOPE'
	| 'UNKNOWN';

export interface OfferingTermConfig {
	totalTerms: number;
	termIds: number[]; // ordered term identities, e.g. [1,2,3]
}

export interface OfferingCandidateRow {
	/** canonical key of the proposed row — idempotence identity */
	key: string;
	schoolId: number;
	schoolYearId: number;
	subjectId: number;
	subjectCode: string;
	gradeLevel: number;
	programType: string;
	/** section scope: SectionMirror external id when section-scoped, else null */
	sectionId: number | null;
	cohortCode: string | null;
	classification: OfferingClassification;
	weeklyMinutes: number;
	/** ordered term applicability; null term list + allTerms=true → ALL_TERMS */
	allTerms: boolean;
	termIds: number[] | null;
	rotationFamily: string | null;
	rotationOrder: number | null;
	/** explicit operator/evidence provenance label */
	provenance: string;
	intendedEmptyScope?: boolean;
}

export interface OfferingDemandRow {
	key: string;
	sectionId: number;
	subjectId: number;
	subjectCode: string;
	classification: OfferingClassification;
	/** sessions per week the section must schedule for this offering */
	sessionsPerWeek: number;
	/** term this offering's sessions charge, or 'ALL' for every term */
	term: number | 'ALL';
	rotationFamily: string | null;
	rotationOrder: number | null;
	periodLengthMinutes: number;
}

export interface OfferingReadinessVerdict {
	ready: boolean;
	blockers: Array<{ code: string; scopeKey: string; message: string }>;
}

/**
 * Phase 4 — resolve the persisted term behavior of one offering row.
 * term_applicability = {} (null termIds, not allTerms) is NEVER ambiguous:
 * it resolves to UNKNOWN and blocks readiness.
 */
export function resolveTermBehavior(
	row: Pick<OfferingCandidateRow, 'allTerms' | 'termIds' | 'rotationFamily' | 'rotationOrder' | 'intendedEmptyScope'>,
	termConfig: OfferingTermConfig,
): TermBehavior {
	if (row.intendedEmptyScope) return 'EMPTY_SCOPE';
	if (row.allTerms && (row.termIds === null || row.termIds.length === 0)) return 'ALL_TERMS';
	if (row.allTerms && row.termIds !== null && row.termIds.length > 0) return 'SELECTED_TERMS';
	if (!row.allTerms) {
		if (row.termIds === null || row.termIds.length === 0) return 'UNKNOWN';
		if (row.rotationFamily !== null) return 'ROTATING_FAMILY_MEMBER';
		if (row.termIds.length === 1) return 'SINGLE_TERM';
		return 'SELECTED_TERMS';
	}
	if (termConfig.termIds.length === 0) return 'UNKNOWN';
	return 'ALL_TERMS';
}

export function validateRowTerms(
	row: Pick<OfferingCandidateRow, 'allTerms' | 'termIds'>,
	termConfig: OfferingTermConfig,
): { valid: boolean; reason?: string } {
	if (!row.allTerms) {
		if (row.termIds === null || row.termIds.length === 0) {
			return { valid: false, reason: 'term_applicability empty and not all-terms — ambiguous term structure' };
		}
		for (const termId of row.termIds) {
			if (!termConfig.termIds.includes(termId)) {
				return { valid: false, reason: `term ${termId} not in configured term identities ${JSON.stringify(termConfig.termIds)}` };
			}
		}
	}
	return { valid: true };
}

/**
 * Resolve one offering into concrete per-term demand rows.
 * A rotating-family member only produces demand in its own term(s): it never
 * becomes simultaneous weekly demand in other terms.
 */
export function offeringToDemandRows(
	row: OfferingCandidateRow,
	termConfig: OfferingTermConfig,
	periodLengthMinutes: number,
): OfferingDemandRow[] {
	const behavior = resolveTermBehavior(row, termConfig);
	if (behavior === 'UNKNOWN' || behavior === 'EMPTY_SCOPE') return [];
	const sectionId = row.sectionId;
	if (sectionId === null) return [];
	const sessionsPerWeek = Math.max(1, Math.ceil(row.weeklyMinutes / periodLengthMinutes));
	const terms: Array<number | 'ALL'> = behavior === 'ALL_TERMS'
		? ['ALL']
		: (row.termIds ?? []).filter((termId) => termConfig.termIds.includes(termId)).sort((a, b) => a - b);

	return terms.map((term) => ({
		key: `${row.key}@term=${term}`,
		sectionId,
		subjectId: row.subjectId,
		subjectCode: row.subjectCode,
		classification: row.classification,
		sessionsPerWeek,
		term,
		rotationFamily: row.rotationFamily,
		rotationOrder: row.rotationOrder,
		periodLengthMinutes,
	}));
}

/**
 * Phase 3/7 — readiness verdict over the full offering set of one school year.
 * Missing, stale, conflicting or incomplete offering truth BLOCKS; it never
 * falls back to catalog-active subjects. An explicitly empty scope does NOT
 * block (it is distinguishable from missing truth).
 */
export function evaluateOfferingReadiness(
	rowsByScopeKey: Map<string, OfferingCandidateRow[]>,
	requiredScopeKeys: string[],
	termConfig: OfferingTermConfig,
): OfferingReadinessVerdict {
	const blockers: OfferingReadinessVerdict['blockers'] = [];
	if (termConfig.termIds.length === 0 || termConfig.totalTerms <= 0) {
		blockers.push({ code: 'OFFERING_TERM_TRUTH_MISSING', scopeKey: '*', message: 'No persisted school-year term configuration — total terms and term identities are unresolved.' });
	}
	for (const scopeKey of requiredScopeKeys) {
		const rows = rowsByScopeKey.get(scopeKey);
		if (!rows || rows.length === 0) {
			blockers.push({ code: 'OFFERING_TRUTH_MISSING', scopeKey, message: `No offering rows exist for active scope ${scopeKey}.` });
			continue;
		}
		const explicitEmpty = rows.every((row) => resolveTermBehavior(row, termConfig) === 'EMPTY_SCOPE');
		if (explicitEmpty) continue; // intentional empty scope — distinguishable, not blocking
		for (const row of rows) {
			const behavior = resolveTermBehavior(row, termConfig);
			if (behavior === 'UNKNOWN') {
				blockers.push({ code: 'OFFERING_TERM_TRUTH_MISSING', scopeKey, message: `Offering ${row.subjectCode} has ambiguous term applicability.` });
			}
			const termCheck = validateRowTerms(row, termConfig);
			if (!termCheck.valid) {
				blockers.push({ code: 'OFFERING_TERM_TRUTH_MISSING', scopeKey, message: `Offering ${row.subjectCode}: ${termCheck.reason}.` });
			}
		}
	}
	return { ready: blockers.length === 0, blockers };
}

/**
 * Phase 5 — classification vocabulary. The allowed vocabulary comes from
 * persisted/configurable configuration, never from a hardcoded school map.
 * Rows whose classification is outside the vocabulary are flagged invalid.
 */
export function validateClassifications(
	rows: OfferingCandidateRow[],
	vocabulary: OfferingClassification[],
): Array<{ key: string; subjectCode: string; classification: OfferingClassification; valid: boolean; reason?: string }> {
	return rows.map((row) => {
		const valid = vocabulary.includes(row.classification);
		return { key: row.key, subjectCode: row.subjectCode, classification: row.classification, valid, reason: valid ? undefined : `classification ${row.classification} not in configured vocabulary ${JSON.stringify(vocabulary)}` };
	});
}

/** Phase 11 — shadow-demand comparison: per-section subject demand keys. */
export function demandKeyOf(row: Pick<OfferingDemandRow, 'sectionId' | 'subjectCode' | 'term'>): string {
	return `${row.sectionId}:${row.subjectCode}@${row.term === 'ALL' ? 'all' : `term${row.term}`}`;
}

export function compareShadowDemand(
	offeringDemand: OfferingDemandRow[],
	currentDemandKeys: string[],
): { onlyInOfferings: string[]; onlyInCurrent: string[]; intersection: string[] } {
	const offeringKeys = new Set(offeringDemand.map(demandKeyOf));
	const currentSet = new Set(currentDemandKeys);
	const intersection = [...offeringKeys].filter((key) => currentSet.has(key)).sort();
	const onlyInOfferings = [...offeringKeys].filter((key) => !currentSet.has(key)).sort();
	const onlyInCurrent = [...currentSet].filter((key) => !offeringKeys.has(key)).sort();
	return { onlyInOfferings, onlyInCurrent, intersection };
}
