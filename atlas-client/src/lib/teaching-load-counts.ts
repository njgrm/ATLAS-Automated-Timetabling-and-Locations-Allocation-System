/**
 * LANE-C TEACHING-LOAD-CLARITY-C02 — the number of different sections a teacher
 * teaches. The teacher list used to add up each subject's section count, so a
 * section taught Chemistry in Term 2 and Earth Science in Term 3 counted twice
 * (2026-09-25 audit A1: Karen Tolentino showed "5 sections" for 3 sections).
 */
export function countDistinctSections(assignments: ReadonlyArray<{ sectionIds: ReadonlyArray<number> }> | null | undefined): number {
	if (!assignments) return 0;
	const sections = new Set<number>();
	for (const assignment of assignments) {
		for (const sectionId of assignment.sectionIds) sections.add(sectionId);
	}
	return sections.size;
}

/**
 * A6 c9 (fix-1.2 16.2) ΓÇö the number of SUBJECTS a teacher is given load in.
 *
 * Beside `countDistinctSections`, and for the same reason: a subject whose
 * `sectionIds` are empty is a record with no teaching in it, so it must not be
 * counted as a subject the teacher carries. c6 removed the row's `Subjects`
 * figure as density; the operator's fix-1.2 16.2 asks for it back as a
 * straight, fixed-width column, and this is its one derivation ΓÇö the row does
 * not add it up itself.
 */
export function countDistinctSubjects(assignments: ReadonlyArray<{ subjectId: number; sectionIds: ReadonlyArray<number> }> | null | undefined): number {
	if (!assignments) return 0;
	const subjects = new Set<number>();
	for (const assignment of assignments) {
		if (assignment.sectionIds.length > 0) subjects.add(assignment.subjectId);
	}
	return subjects.size;
}
