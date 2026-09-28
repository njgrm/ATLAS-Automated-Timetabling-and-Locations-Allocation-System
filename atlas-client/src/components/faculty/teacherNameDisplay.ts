/**
 * Teacher display-name casing — ONE convention for the Teachers, Teaching Load
 * and Teacher-detail surfaces (Fix 22).
 *
 * SCOPE: DISPLAY ONLY. `firstName` / `lastName` are read exactly as stored and
 * are never written, normalised, trimmed, re-cased or reordered by this module.
 * The only transformations are (a) the `Last, First` presentation order,
 * (b) collapsing redundant whitespace, and (c) UPPERCASING FOR DISPLAY.
 *
 * WHY UPPERCASE, and why it is a *display* transform.
 *
 * The root cause of the mixed-casing defect is the DATA, not the renderer:
 * some teachers are persisted uppercase and some are persisted Title Case, so
 * any renderer that preserves stored casing necessarily shows both. Lane C
 * observed exactly that on one screen at 1366x768: "AGUILAR, CARLO MIGUEL"
 * beside "Alcantara, Roberto".
 *
 * The original Fix 22 acceptance criterion is explicit — "Teacher names render
 * consistently uppercase in targeted UI" — and its recommended implementation
 * says to prefer "a display-layer standard (`uppercase` class or centralized
 * formatter) over mutating persisted person-name data".
 *
 * HISTORY, recorded because it is a correction. An earlier cycle in this same
 * stream deliberately REMOVED a CSS `uppercase` transform and preserved stored
 * casing, reasoning that "uppercase shouts Filipino given names". That was a
 * narrowing rewrite AGAINST the acceptance criterion, and it left the live
 * symptom in place. Cycle c10 re-issued the original criterion and the
 * narrowing is overruled. A centralized formatter (this file) is used in
 * preference to per-element CSS classes because two of its consumers —
 * `components/faculty-assignments/WorkloadInspector.tsx` and
 * `components/faculty-assignments/TeacherGridMode.tsx` — are owned by a
 * parallel lane this one must not edit, and the formatter standardises them
 * without a single cross-directory edit.
 *
 * SEARCH / SORT SAFETY (acceptance criterion 2). Because the transform lives
 * here and NOT in the data, every consumer that needs the true underlying value
 * calls `formatFacultyStoredName` / `teacherNameSortKey` below, and the roster's
 * own search and sort read the raw `firstName` / `lastName` fields. A visible
 * uppercase / stored-original split therefore cannot change what a search for
 * "alcantara" matches, and cannot change sort order.
 *
 * NOT A DATABASE REWRITE (acceptance criterion 3). Nothing in ATLAS mutates a
 * persisted person name. There is no `toUpperCase()` on any write path in this
 * stream; if such a change is ever wanted it needs separate approval.
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
 * The UNDERLYING, stored-cased person name in `Last, First` order.
 *
 * This is the value search, sort and filtering must use. It is deliberately
 * NOT uppercased: it is the byte-preserved record of what EnrollPro holds. Use
 * `formatFacultyDisplayName` for anything a person reads.
 */
export function formatFacultyStoredName(faculty: NameLike | null | undefined): string {
	const last = tidy(faculty?.lastName);
	const first = tidy(faculty?.firstName);
	if (last && first) return `${last}, ${first}`;
	return last || first || 'Unnamed teacher';
}

/**
 * The sort/search key for a teacher: stored casing, `Last First` (no comma) so
 * it compares directly against a lower-cased query token.
 *
 * A name is UPPERCASE here for the same reason the roster lower-cases the query
 * before comparing: casing must not influence matching order. It is derived from
 * the STORED fields, so it matches the stored value, not the displayed one.
 */
export function teacherNameSortKey(faculty: NameLike | null | undefined): string {
	return `${tidy(faculty?.lastName)} ${tidy(faculty?.firstName)}`.trim();
}

/**
 * Canonical Teachers/Teaching Load/Teacher-detail DISPLAY name: `LAST, FIRST`
 * in UPPERCASE (Fix 22).
 *
 * Falls back to whichever part exists, so a partially-entered placeholder
 * teacher still renders something rather than a stray comma.
 */
export function formatFacultyDisplayName(faculty: NameLike | null | undefined): string {
	return formatFacultyStoredName(faculty).toUpperCase();
}

/** Convenience overload for the common `FacultySummary` call site. */
export function formatFacultySummaryName(faculty: FacultySummary | null | undefined): string {
	return formatFacultyDisplayName(faculty);
}

/**
 * Uppercased avatar initials for a teacher, e.g. `AM` for
 * "Alcantara, Roberto" (Fix 22 "badges/avatars" audit row).
 *
 * Reads the stored fields and uppercases the two first characters. Never
 * mutates the input, and never returns a stray comma or digit when a name part
 * is missing.
 */
export function formatFacultyInitials(faculty: NameLike | null | undefined): string {
	const first = tidy(faculty?.firstName).charAt(0);
	const last = tidy(faculty?.lastName).charAt(0);
	return `${first}${last}`.toUpperCase();
}
