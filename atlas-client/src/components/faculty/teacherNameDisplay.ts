/**
 * Teacher display-name casing — ONE convention for the Teachers and Teaching
 * Load surfaces (Fix 22).
 *
 * SCOPE: DISPLAY ONLY. `firstName` / `lastName` are read and returned exactly
 * as stored. Nothing here mutates, normalises, trims, re-cases, or reorders a
 * persisted value; the only transformation is the `Last, First` presentation
 * order plus collapsing redundant whitespace. Class Schedule name rendering is
 * A2's and does not use this helper.
 *
 * Why: the same teacher was rendered three different ways across this stream —
 *   - `Last, First` wrapped in a CSS `uppercase` transform (WorkloadInspector,
 *     TeacherGridMode), which shouts Filipino given names and is the hardest
 *     thing on the page to read;
 *   - `First Last` with no transform (FacultyProfileSheet);
 *   - `Last, First` with no transform (FacultyRow).
 * One helper, one convention: `Last, First`, stored casing preserved.
 */
import type { FacultySummary } from '@/types';

type NameLike = {
	firstName?: string | null;
	lastName?: string | null;
};

/** Collapse runs of whitespace and trim. Never changes letter casing. */
function tidy(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Canonical Teachers/Teaching Load display name: `Last, First`.
 * Falls back to whichever part exists, so a partially-entered placeholder
 * teacher still renders something rather than a stray comma.
 */
export function formatFacultyDisplayName(faculty: NameLike | null | undefined): string {
	const last = tidy(faculty?.lastName);
	const first = tidy(faculty?.firstName);
	if (last && first) return `${last}, ${first}`;
	return last || first || 'Unnamed teacher';
}

/** Convenience overload for the common `FacultySummary` call site. */
export function formatFacultySummaryName(faculty: FacultySummary | null | undefined): string {
	return formatFacultyDisplayName(faculty);
}
