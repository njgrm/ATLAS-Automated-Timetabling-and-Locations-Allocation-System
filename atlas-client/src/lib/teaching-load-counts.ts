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
