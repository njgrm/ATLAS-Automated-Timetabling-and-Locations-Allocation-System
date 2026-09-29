/**
 * A5 (2026-09-30) — rotation-aware subject counts on the SERVER (display-only).
 *
 * The Dashboard "Subjects" tile is fed by `dashboard-readiness.service.ts`, which
 * counted `prisma.subject.count(...)`. A term-rotating family is stored as one
 * catalogue row per term slot, so that raw row count over-reported a Science +
 * TLE school year the same way the client tiles did.
 *
 * This module is the server-side twin of
 * `atlas-client/src/lib/rotation-subject-count.ts`. The two are intentionally
 * duplicated because the server and client are separate TypeScript programs (the
 * server sets `rootDir: src`, so it cannot import client source); a cross-layer
 * parity test pins the same fixture to the same answer on both, so drift is
 * caught rather than assumed absent.
 *
 * Dependency-free on purpose: it must be importable by a test without pulling in
 * Prisma or the rest of the readiness graph.
 */

/** One active subject, projected to just what the count needs. */
export interface SubjectRotationCountRow {
	rotationFamily: string | null;
	termGroupId: string | null;
	/** True when the subject has at least one `facultySubjects` row. */
	hasFacultySubject: boolean;
}

/** trim + toUpperCase; an empty result is `null`, never the empty string. */
export function normalizeSubjectRotationGroupKey(value: string | null | undefined): string | null {
	const normalized = (value ?? '').trim().toUpperCase();
	return normalized.length > 0 ? normalized : null;
}

/**
 * The rotation group a subject belongs to, or `null` when it is standalone.
 * Key = `normalize(termGroupId) || normalize(rotationFamily) || null`.
 */
export function subjectRotationGroupKey(
	row: Pick<SubjectRotationCountRow, 'rotationFamily' | 'termGroupId'>,
): string | null {
	return normalizeSubjectRotationGroupKey(row.termGroupId) ?? normalizeSubjectRotationGroupKey(row.rotationFamily);
}

/** Groups, preserving first-appearance order; a `null` key is its own group. */
function groupRows(rows: readonly SubjectRotationCountRow[]): SubjectRotationCountRow[][] {
	const groups: SubjectRotationCountRow[][] = [];
	const indexByKey = new Map<string, number>();
	for (const row of rows) {
		const key = subjectRotationGroupKey(row);
		if (key === null) {
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

/**
 * Rotation-aware Dashboard counts.
 *
 * - `subjectCount` = distinct rotation groups among the active subjects.
 * - `unassignedSubjectCount` = distinct rotation groups having AT LEAST ONE
 *   active member with no `facultySubjects` row (family-level; a partly-staffed
 *   family is one gap, so the `> 0` "a gap exists" signal is preserved).
 */
export function countRotationSubjectGroups(rows: readonly SubjectRotationCountRow[]): {
	subjectCount: number;
	unassignedSubjectCount: number;
} {
	const groups = groupRows(rows);
	return {
		subjectCount: groups.length,
		unassignedSubjectCount: groups.filter((group) => group.some((row) => !row.hasFacultySubject)).length,
	};
}
