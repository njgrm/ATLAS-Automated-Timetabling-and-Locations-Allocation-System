/**
 * QF-CELL-INFO — Per-term teacher resolution for a timetable cell.
 *
 * An academic term is the authoritative scope of a schedule. Canonical
 * run/draft entries are already resolved per ordered term (one entry per term,
 * each with its own `termIndex` and `facultyId`), so the entry's own teacher is
 * the per-term teacher. A compact legacy modular lane keeps its per-term
 * teachers in `metadata.modularAssignments`; when a single term is selected, that
 * term's assignment teacher is used so the term switcher changes the displayed
 * teacher instead of reusing a stale/default one.
 *
 * A compact lane that does not name the selected term resolves to `null` — it
 * never falls back to another term's teacher. In all-term review each entry is
 * rendered independently, so terms are never merged onto one cell teacher.
 */

import type { ScheduledEntry } from '@/types';

/** The term-scoped teacher id for a cell entry, or null when genuinely unassigned. */
export function resolveTermFacultyId(
	entry: Pick<ScheduledEntry, 'facultyId' | 'metadata'>,
	termFilter: 'all' | number,
): number | null {
	const modular = entry.metadata?.modularAssignments;
	if (Array.isArray(modular) && modular.length > 0 && typeof termFilter === 'number') {
		const assignment = modular.find((row) => row.termIndex === termFilter);
		return assignment && typeof assignment.facultyId === 'number' ? assignment.facultyId : null;
	}
	return typeof entry.facultyId === 'number' ? entry.facultyId : null;
}

/**
 * The compact teacher label for a cell. Uses the provided initials formatter so
 * an unknown id degrades gracefully instead of rendering a loading placeholder.
 */
export function resolveCellTeacherText(
	entry: Pick<ScheduledEntry, 'facultyId' | 'metadata'>,
	termFilter: 'all' | number,
	formatFacultyInitials: (id: number) => string,
): string {
	const facultyId = resolveTermFacultyId(entry, termFilter);
	return facultyId == null ? 'No teacher' : formatFacultyInitials(facultyId);
}
