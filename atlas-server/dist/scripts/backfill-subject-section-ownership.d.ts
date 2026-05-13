/**
 * Pass 4A — Backfill: subject_section_ownerships from FacultySubject.sectionIds
 *
 * Reads every FacultySubject row and inserts one SubjectSectionOwnership row per
 * sectionId in the array. This populates the new normalized table from the existing
 * denormalized array column so it is ready for the service-layer guardrail added in
 * Pass 4B.
 *
 * Design decisions
 * ──────────────────────────────────────────────────────────────────────────────
 * - Skip-duplicates mode is the default: if a (schoolId, subjectId, sectionId)
 *   triple already exists in the table (from a previous partial backfill run) the
 *   row is silently skipped. This makes the script safe to re-run idempotently.
 *
 * - Conflict detection: after insertion, the script checks whether the unique
 *   constraint would have been violated by looking for triples that appear in MORE
 *   than one FacultySubject row. Any such collision is reported in the ledger as a
 *   "DB conflict" (the earlier-assigned row wins because INSERT order is sorted by
 *   assignedAt ASC; the skipped duplicates are logged).
 *
 * - Faculty subjects with sectionIds=[] are legitimately skipped (nothing to index).
 *
 * CLI flags
 * ──────────────────────────────────────────────────────────────────────────────
 *   --schoolId=N     (default: 1) scope to a single school
 *   --all-schools    process every school in the DB
 *   --dry-run        (default) show what would be inserted; no DB changes
 *   --apply          commit inserts
 *   --output=path    ledger output path (default: qa-artifacts/...)
 */
export {};
