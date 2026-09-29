/**
 * A9 c5 (2026-09-30) — the section-details `UNASSIGNED CLASSES` list, grouped by term.
 *
 * Operator (`section.docx` item 2): *"after making it as a modal, notice the unassigned classes.
 * Improve the UI. Maybe do it per term instead of per subject if that is better."* On the operator's
 * screenshot the list was flat — one row per subject, `MAPEH` printed twice (name over code), then
 * `SCIENCE`/`TERM 2`, `SCIENCE`/`TERM 3`, `TLE_ROTATION`/`TERM 2`, `TLE_ROTATION`/`TERM 3` as violet
 * pills, each with `225 min` right-aligned.
 *
 * WHAT THIS MODULE DECIDES, and why it is pure. Both the GROUPING and the one-line subject identity
 * are data transforms, not markup, so putting them here lets a control call them directly and assert
 * the return value — the same split `home-room-review-copy.ts` uses, and for the same `AGENTS.md` §11
 * reason: a source-text assertion is not evidence for a user-facing change. The component keeps only
 * the rendering.
 *
 * TERM ORDER. Rows that carry a rotation term are grouped under `Term N` ascending; the classes that
 * run all year (no rotation term) form one `All year` group, placed last because it is the base case
 * rather than a term. A row whose term cannot be read from either `rotationTermLabel` or
 * `rotationTermRank` degrades to the `All year` group rather than inventing a term — a truthful
 * fallback, never a fabricated `Term 1`.
 */

/** The minimum a row needs for this grouping; `SectionUnassignedExpectedClassRow` satisfies it. */
export type UnassignedTermInput = {
	rotationFamily?: string | null;
	rotationTermLabel?: string | null;
	rotationTermRank?: number | null;
};

/** The heading used for classes that are not tied to a rotation term. */
export const ALL_YEAR_HEADING = 'All year';

/**
 * The term label a row carries, or `null`. Kept here (moved out of the sheet in A9 c5) so the
 * grouping and the rendering read the SAME resolution — a term cannot be `Term 2` in one place and
 * `null` in the other.
 */
export function resolveRotationTermLabel(
	input: { rotationTermLabel?: string | null; rotationTermRank?: number | null },
): string | null {
	const explicitLabel = (input.rotationTermLabel ?? '').trim();
	if (explicitLabel.length > 0) {
		const rankMatch = explicitLabel.match(/(\d+)/);
		if (rankMatch) {
			const parsed = Number(rankMatch[1]);
			if (Number.isInteger(parsed) && parsed > 0) {
				return `Term ${parsed}`;
			}
		}
		return explicitLabel;
	}
	if (
		typeof input.rotationTermRank === 'number' &&
		Number.isInteger(input.rotationTermRank) &&
		input.rotationTermRank > 0
	) {
		return `Term ${input.rotationTermRank}`;
	}
	return null;
}

/**
 * The integer rank of a row's term, for ordering; `null` when the row is not term-bound.
 *
 * The rank comes from the resolved label's digit when there is one (`TERM 3`), and otherwise from
 * the row's own `rotationTermRank` — so a label with no digit (`Second Term`) still sorts into its
 * term rather than dropping to the all-year group.
 */
export function unassignedTermRank(input: UnassignedTermInput): number | null {
	const label = resolveRotationTermLabel(input);
	const match = label?.match(/(\d+)/);
	if (match) {
		const parsed = Number(match[1]);
		if (Number.isInteger(parsed) && parsed > 0) return parsed;
	}
	if (
		typeof input.rotationTermRank === 'number' &&
		Number.isInteger(input.rotationTermRank) &&
		input.rotationTermRank > 0
	) {
		return input.rotationTermRank;
	}
	return null;
}

/**
 * ONE line for a subject's identity, so the operator's `MAPEH` over `MAPEH` duplication is gone.
 *
 * The code is dropped only when it IS the name (case-insensitive exact equality) — the operator's
 * `MAPEH` over `MAPEH`. An abbreviation that merely appears inside a longer name is NOT redundant
 * (`Mathematics` + `MATH` keeps the code), because collapsing on a substring would delete a real
 * code from every subject whose name happens to contain it.
 */
export function subjectIdentityLabel(
	name: string | null | undefined,
	code: string | null | undefined,
): { primary: string; secondary: string | null } {
	const primary = (name ?? '').trim() || (code ?? '').trim();
	const trimmedCode = (code ?? '').trim();
	if (!trimmedCode || !primary) return { primary, secondary: null };
	if (trimmedCode.toLowerCase() === primary.toLowerCase()) return { primary, secondary: null };
	return { primary, secondary: trimmedCode };
}

export type UnassignedTermGroup<T> = {
	/** A stable React key: the term label, or `__all_year__`. */
	key: string;
	/** The rendered heading: `Term N`, or `All year`. */
	heading: string;
	/** The term rank, or `null` for the all-year group (sorted last). */
	rank: number | null;
	rows: T[];
};

/**
 * Group unassigned expected classes by term, term groups ascending, `All year` last.
 *
 * Order inside a group is the input order, so the server's own ordering is preserved.
 */
export function groupUnassignedByTerm<T extends UnassignedTermInput>(
	rows: readonly T[],
): UnassignedTermGroup<T>[] {
	const groups = new Map<string, UnassignedTermGroup<T>>();
	for (const row of rows) {
		const label = resolveRotationTermLabel(row);
		const rank = unassignedTermRank(row);
		const key = label ?? '__all_year__';
		let group = groups.get(key);
		if (!group) {
			group = { key, heading: label ?? ALL_YEAR_HEADING, rank, rows: [] };
			groups.set(key, group);
		}
		if (group.rank == null && rank != null) group.rank = rank;
		group.rows.push(row);
	}
	return [...groups.values()].sort((a, b) => {
		const aRank = a.rank ?? Number.POSITIVE_INFINITY;
		const bRank = b.rank ?? Number.POSITIVE_INFINITY;
		if (aRank !== bRank) return aRank - bRank;
		return a.heading.localeCompare(b.heading);
	});
}
