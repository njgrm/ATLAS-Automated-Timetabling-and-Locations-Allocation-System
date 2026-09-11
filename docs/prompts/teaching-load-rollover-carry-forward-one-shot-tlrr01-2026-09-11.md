# TL-RR01 — Teaching Load Rollover Carry-Forward One-Shot

## Objective

Deliver a complete, optional, audited carry-forward workflow that lets an
officer reuse compatible assignments from one same-school archived year into
an empty or partially prepared sole active year. The default is preview only;
historical Teaching Load remains immutable and no live apply is authorized.

## Git and safety boundary

- Work from a fresh isolated worktree/neutral branch based on current
  `origin/main`; record base SHA and clean status.
- Commit an immutable candidate; do not amend, rebase, merge, push, deploy,
  restart, reconcile/apply live Teaching Load, generate, publish, migrate, or
  edit companion repositories.
- Own new carry-forward service/router/tests, archived Teaching Load selection,
  Year Setup/Teaching Load preview UX, focused docs, and `CHANGELOG.md`.
- Do not alter derived-demand semantics, generation algorithms, publication,
  Dashboard, timetable workspace, schema, or migrations.

## Required workflow

1. Privileged actor-school authority only. Resolve exactly one active,
   non-archived target year and a same-school archived source year; reject
   missing, current, cross-school, ambiguous, or unarchived years typed.
2. Source reads are immutable. Match faculty only by stable external identity.
   Match sections by canonical grade + program + normalized section name,
   never by old database/external IDs alone.
3. Intersect source assignments with current `DERIVED_DEMAND_V2` Teaching Load
   pair identities. Exclude reference-only Subjects and obsolete demand.
4. Re-resolve current faculty activity, school, qualification authority,
   specialization/department mapping, subject minutes, workload policy, actual
   teaching minutes, and hard caps. Advisory credit is neutral and cannot hide
   overload.
5. Fill-empty-only by default: preserve every occupied target pair. Classify
   each source row as exact carry, already occupied, missing faculty, missing
   section, no current demand, unqualified, cap blocked, ambiguous, or other
   explicit typed reason.
6. Preview is set-based and zero-write. Show source/target years, carried and
   skipped totals, before/after actual teaching distribution, overload changes,
   adviser coverage, reasons, and a compact per-department review. Never call a
   skipped row “carried”.
7. Bind the preview fingerprint to actor school, both year authorities,
   derived-demand revision, source archived Teaching Load revision/cycle,
   target Teaching Load cycle/ownership revision, faculty/section/Subject
   semantics, workload policy, exact plan, and confirmation text.
8. Implement but do not invoke a privileged apply endpoint. It must require the
   exact fingerprint/revisions/confirmation, revalidate everything inside one
   Serializable transaction, abort atomically on drift/conflict, write only
   empty target ownership/pair projections, refresh the target cycle once,
   create exactly one actor audit, and return an idempotent replay receipt.
9. Apply must never update the archived source, occupied target pairs,
   department authority, curriculum/derived metadata, generation, publication,
   or catalog rows. Record exact rollback identities; do not execute rollback.
10. UX belongs in Year Setup and the Teaching Load transition guidance, not as
    a competing daily-page split-brain action. Explain “Start from last year”
    as optional and always require preview/review before any future approval.

## Required controls and QA

- Disposable PostgreSQL fixtures for exact matches, renamed/re-ID sections,
  inactive/cross-school faculty, qualification/cap drift, occupied targets,
  duplicate canonical matches, source immutability, stale revisions, concurrent
  apply, replay, audit/cycle cardinality, rollback identities, and zero residue.
- Mounted-route JWT/role/school/year/strict-body validation with zero reads on
  malformed input and zero writes on every rejection.
- Failing-first mutant proving ID-only matching or overwrite-nonempty logic
  would produce an incorrect plan.
- Client decision helpers and isolated Playwright at 1280x720 and 390x844 for
  source selection, preview/reason review, cancel, error, empty, partial-target,
  and no-live-apply states.
- Existing archived-history, Teaching Load authority/reconciliation,
  distribution/policy, server/client TypeScript, builds, and diff-check.
- One fresh independent review; material fixes require additive commits and
  fresh QA.

Return `REVIEW_REQUIRED`, the immutable range, exact paths, preview/apply call
path, mapping/reason matrix, transaction/replay evidence, UI evidence, and an
explicit statement that no live Teaching Load apply occurred. Do not offer an
approval sentence or perform a live preview until the new runtime is deployed
and the year-9 term snapshot is explicitly synchronized.
