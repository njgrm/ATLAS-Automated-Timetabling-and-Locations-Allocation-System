/**
 * A5 (2026-09-30) — rotation-aware subject counts (display-only).
 *
 * THE DEFECT. A term-rotating family is stored as one catalogue row PER TERM
 * slot (Science = `SCI_BIO` + `SCI_CHEM` + `SCI_ES`, all `termGroupId` `SCIENCE`;
 * TLE = `TLE_AFA_EXP` + `TLE_FCS_EXP` + `TLE_ICT_EXP`, all `termGroupId`
 * `TLE_EXPLORATORY`). Every user-facing count that iterated the catalogue with
 * `.length` therefore read a section teaching both rotations as SIX subjects
 * when the scheduler knows it teaches TWO.
 *
 * ONE RULE. A rotation group counts once; a standalone row (no `termGroupId`
 * and no `rotationFamily`) keeps counting individually. The fields are
 * authoritative — no `SCI_`/`TLE` code-prefix heuristic belongs here, because a
 * prefix guess drifts the moment a family is renamed while the persisted
 * `termGroupId` does not.
 *
 * WHY "ANY MEMBER" SEMANTICS. When a predicate is supplied, a group counts once
 * when ANY member satisfies it. That is deliberate and is the family-level
 * reading the operator asked for: a partly-staffed rotation family is ONE gap,
 * not one-per-term-row, and the `> 0` signal that means "something needs a
 * teacher here" is never hidden by averaging a family down to a fraction.
 *
 * PRECEDENCE mirrors the repository's existing style
 * (`faculty-assignment-helpers.ts` `resolveRotationTermMetadata`):
 * `termGroupId = rotationTermGroupId || termGroupId`. Here the persisted
 * `termGroupId` is the explicit rotation identity and `rotationFamily` is its
 * fallback, so `termGroupId` wins when both are present.
 *
 * Pure and React-free so every counting surface shares one definition and the
 * acceptance suite can drive it with controlled fixtures.
 */

export interface RotationSubjectLike {
	rotationFamily?: string | null;
	termGroupId?: string | null;
}

/** trim + toUpperCase; an empty result is `null`, never the empty string. */
function normalizeRotationKey(value: string | null | undefined): string | null {
	const normalized = (value ?? '').trim().toUpperCase();
	return normalized.length > 0 ? normalized : null;
}

/**
 * The rotation group a subject row belongs to, or `null` when it is a
 * standalone subject.
 *
 * Key = `normalize(termGroupId) || normalize(rotationFamily) || null`.
 */
export function subjectRotationGroupKey(row: RotationSubjectLike): string | null {
	return normalizeRotationKey(row.termGroupId) ?? normalizeRotationKey(row.rotationFamily);
}

/**
 * Rows grouped by rotation. Every returned group is one rotation family, so all
 * of its members describe the SAME taught subject across its term slots. A
 * `null`-key row is its own single-member group, so standalone subjects are
 * never merged.
 *
 * Group order follows first appearance, so the output is deterministic for a
 * given input order (important for the `distinct` representative below).
 */
export function groupSubjectsByRotation<T extends RotationSubjectLike>(rows: readonly T[]): T[][] {
	const groups: T[][] = [];
	const indexByKey = new Map<string, number>();
	for (const row of rows) {
		const key = subjectRotationGroupKey(row);
		if (key === null) {
			// Standalone: its own group, and never matched by another row.
			groups.push([row]);
			continue;
		}
		const existing = indexByKey.get(key);
		if (existing === undefined) {
			indexByKey.set(key, groups.length);
			groups.push([row]);
		} else {
			groups[existing].push(row);
		}
	}
	return groups;
}

/** One representative row per rotation group (for lists/headers). */
export function distinctSubjectsByRotation<T extends RotationSubjectLike>(rows: readonly T[]): T[] {
	return groupSubjectsByRotation(rows).map((group) => group[0]);
}

/**
 * Count subject groups; a rotation group counts once.
 *
 * With a predicate, a group counts once when ANY member satisfies it
 * (family-level semantics — one rotating subject with a problem is one problem).
 */
export function countSubjectGroups<T extends RotationSubjectLike>(
	rows: readonly T[],
	predicate?: (row: T) => boolean,
): number {
	const groups = groupSubjectsByRotation(rows);
	if (!predicate) return groups.length;
	return groups.filter((group) => group.some((row) => predicate(row))).length;
}
