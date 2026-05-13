/**
 * Pass 3 — Data repair: legacy duplicate ownership & malformed scopes.
 *
 * What this script does:
 *  1. Detects duplicate ownership tuples (same subjectId+sectionId owned by
 *     multiple faculty in the DB) that bypassed the transaction guardrails.
 *  2. Resolves each conflict deterministically: earliest `assignedAt` wins;
 *     tiebreak is lower `facultyId`. The loser's sectionId is removed from
 *     their sectionIds array.
 *  3. Normalises every FacultySubject row's `gradeLevels` to match what the
 *     current sectionIds derive to via SectionMirror (scope = section-based
 *     source-of-truth).
 *  4. Handles legacy rows where sectionIds=[] but gradeLevels is populated:
 *     expands sectionIds from the most-recent school year's SectionMirror
 *     sections at those grade levels, then re-derives gradeLevels.
 *  5. Deletes rows that become empty after all removals (and cannot be expanded).
 *  6. Writes a JSON conflict ledger to qa-artifacts/.
 *  7. Runs post-repair validation and prints a summary.
 *
 * Safety flags:
 *   --dry-run   (default) — produce ledger, make no DB changes.
 *   --apply     — commit all repair ops in a serializable transaction.
 *   --schoolId=N
 *   --output=path
 */
export {};
