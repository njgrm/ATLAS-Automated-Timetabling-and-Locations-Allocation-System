/**
 * facultyInitials — the ONE avatar-initials derivation used by the Teaching
 * Load inspector surfaces in this fence.
 *
 * WHY A LOCAL HELPER AND NOT `@/components/faculty/teacherNameDisplay`.
 *
 * A4 note (Executor S4, `components/faculty/**`, in parallel, NOT merged at the
 * time this file was written) reports that `WorkloadInspector.tsx:95` and
 * `:152` rendered initials inline as `{selected.firstName[0]}{selected.lastName[0]}`,
 * bypassing the `formatFacultyInitials` helper S4 added to
 * `components/faculty/teacherNameDisplay.ts`. That helper DOES NOT EXIST in
 * this worktree — it is unmerged parallel work — and `components/faculty/**` is
 * outside this stream's edit fence, so importing it would not compile today and
 * editing that module to add it would be an unapproved cross-lane write.
 *
 * This file is therefore the local equivalent, in the same
 * `faculty-assignments/**` fence, with ONE behaviour: it is used by
 * `WorkloadInspector` and by the new audit-summary row avatar, so the two can
 * never render different initials for the same teacher.
 *
 * DELETE-ON-S4-MERGE: when S4's `formatFacultyInitials` lands, this module is
 * deleted and both call sites switch to the shared import. It is a temporary
 * stand-in, not a second convention, and is recorded here so the swap cannot be
 * forgotten. This comment is the record; nothing asserts the helper's absence.
 */

type NameLike = {
	firstName?: string | null;
	lastName?: string | null;
};

/** The first character of the first word, uppercased, or `''` when there is none. */
function initialOf(value: string | null | undefined): string {
	const firstWord = (value ?? '').replace(/\s+/g, ' ').trim();
	return firstWord ? firstWord.charAt(0).toUpperCase() : '';
}

/**
 * Avatar initials for a faculty row: one letter from the given name, one from
 * the family name, both uppercased.
 *
 * Handles what the inline `{firstName[0]}{lastName[0]}` did not: a missing or
 * whitespace-only part contributes nothing instead of a stray separator, and a
 * multi-word given name uses the real first character rather than an empty one.
 */
export function formatTeacherWorkloadInitials(faculty: NameLike | null | undefined): string {
	return `${initialOf(faculty?.firstName)}${initialOf(faculty?.lastName)}`;
}
