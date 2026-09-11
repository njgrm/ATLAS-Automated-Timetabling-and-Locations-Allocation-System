/**
 * DEMAND-C01R2 — Client ordered-term contract helpers.
 *
 * Academic terms are a bounded numeric index driven by the verified runtime
 * EnrollPro contract, never a static `1 | 2 | 3` union. Exact labels come from
 * EnrollPro; `T1`/`T2`/... is only the explicit fail-closed fallback when no
 * authoritative label exists.
 */

export type AcademicTermIndex = number;

/** Highest index the current supported contract family (`TRIMESTER`/`QUARTERS`) can name. */
export const MAX_ACADEMIC_TERM_INDEX = 4;

export type OrderedAcademicTerm = {
	identity: string;
	displayLabel: string;
	order: number;
};

export type AcademicTermOption = {
	value: string;
	label: string;
};

export function academicTermFallbackLabel(index: number): string {
	return `T${index}`;
}

export function academicTermDisplayLabel(terms: ReadonlyArray<OrderedAcademicTerm> | null | undefined, index: number): string {
	const term = terms?.find((entry) => entry.order === index);
	const label = term?.displayLabel?.trim();
	return label && label.length > 0 ? label : academicTermFallbackLabel(index);
}

export function isTermIndexWithinTerms(index: number, terms: ReadonlyArray<OrderedAcademicTerm> | null | undefined): boolean {
	if (!Number.isInteger(index) || index < 1) return false;
	if (!terms || terms.length === 0) return index <= MAX_ACADEMIC_TERM_INDEX;
	return terms.some((term) => term.order === index);
}

/**
 * Build the ordered term filter options. The list is bounded by the verified
 * contract; no term is clamped, cycled, or invented.
 */
export function buildAcademicTermOptions(
	terms: ReadonlyArray<OrderedAcademicTerm> | null | undefined,
	activeTermIndex: number | null | undefined,
): AcademicTermOption[] {
	const options: AcademicTermOption[] = [{ value: 'all', label: 'All terms' }];
	const ordered = terms && terms.length > 0
		? [...terms].sort((a, b) => a.order - b.order)
		: Array.from({ length: MAX_ACADEMIC_TERM_INDEX }, (_, index) => ({ identity: '', displayLabel: '', order: index + 1 }));
	for (const term of ordered) {
		options.push({
			value: String(term.order),
			label: academicTermDisplayLabel(ordered, term.order),
		});
	}
	return options;
}

/**
 * Repair a selected term filter after a school/year/contract change. A value
 * absent from the new contract resolves to `'all'` so no request is dispatched
 * for a term the contract does not contain.
 */
export function repairTermFilter(
	value: 'all' | number,
	terms: ReadonlyArray<OrderedAcademicTerm> | null | undefined,
): 'all' | number {
	if (value === 'all') return 'all';
	return isTermIndexWithinTerms(value, terms) ? value : 'all';
}
