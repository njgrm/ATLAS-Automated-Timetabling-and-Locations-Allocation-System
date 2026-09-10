# TERM-SUBJ-C01 — EnrollPro Term and Subject Scheduling Authority

Status: `READY_FOR_EXECUTION`  
Risk: `MEDIUM` source plus migration candidate; live migration remains `HIGH`

## Objective

Make EnrollPro the sole term-structure authority and make the ATLAS Subject
catalog the reusable scheduling-metadata authority. This cycle establishes the
replacement contract for manual Curriculum Requirements; it does not yet
switch all demand consumers or remove the legacy pages.

## Git boundary

Create `D:\ATLAS-worktrees\term-subject-c01` on
`work/term-subject-c01` from freshly fetched `origin/main`. Record the clean
base SHA. Commit one review candidate; do not merge, rebase, amend, or push.

## Required implementation

1. Normalize EnrollPro school-year and active-term responses into one verified
   contract: school/year identity, term format, ordered term identities,
   display labels, dates when supplied, active term, verification state, and a
   semantic revision hash.
2. Support at least TRIMESTER and QUARTERS without a hardcoded T1-T3 ceiling.
   Unknown formats, duplicates, mismatched years, and active terms outside the
   ordered contract fail closed.
3. Cache only a year-bound verified term contract for degraded use. Display
   saved-data status when used; block when no matching cache exists.
4. Add `Subject.schedulingDisposition` with
   `SCHEDULED_TEACHING | REFERENCE_ONLY`. Default existing subjects to scheduled
   teaching and backfill Homeroom Guidance to reference only.
5. Ordinary Subject CRUD may edit disposition but may never edit EnrollPro term
   count, identities, labels, or dates. Protect bootstrap-only metadata.
6. Resolve Subject rotation order against the current verified term contract.
   Missing, duplicate, or out-of-range family order becomes an actionable
   Subject issue, not an inferred default.
7. Expose the verified term contract and scheduling disposition on the Subject
   scheduling view. HG/reference-only remains visible but clearly states that
   it creates neither timetable demand nor Teaching Load.
8. Replace Subject-code HG checks inside the changed authority path with the
   explicit disposition. Do not broaden into generation or Teaching Load yet.

## Source boundary

Allowed likely paths:

- `prisma/schema.prisma` and one new migration;
- a new EnrollPro term-contract service;
- section/active-term adapters and focused routes/tests;
- Subject service/router/types/constants/form/payload/page and focused tests;
- one progress document, runtime source map, and changelog.

Do not edit AppShell, Year Setup, notification client, Teaching Load,
generation, allocation, timetable demand, Dashboard, Curriculum Requirements
UI, or any companion repository. Do not pull or modify EnrollPro.

## Migration safety

Author the migration and prove it only in a disposable PostgreSQL database.
Do not apply it to the live Tailnet database. If the enum/backfill cannot be
implemented without rewriting unrelated migration history, stop with
`PLANNER_DECISION_REQUIRED`.

## Acceptance gates

- Real adapter fixtures prove 3-term and 4-term ordered contracts.
- Term labels/format from EnrollPro are preserved rather than discarded.
- Active-term/year mismatch, duplicates, unknown format, and invalid rotation
  order return typed fail-closed outcomes.
- Matching cached fallback is explicitly degraded; stale/cross-year cache blocks.
- Subject create/patch validation covers scheduling disposition and rejects
  attempts to write EnrollPro term authority.
- Disposable migration proof backfills HG only to reference-only and leaves
  all other active subjects scheduled; rollback/rebuild path is documented.
- HG/reference-only produces zero rows in a focused pure demand projection
  test; no live data is mutated.
- Server and client production entry points use the new contract.
- Focused tests, both TypeScript checks/builds, built-server smoke, and
  `git diff --check` pass.

## Return

Return `REVIEW_REQUIRED` with base/candidate SHAs, exact paths, migration proof,
contract examples, decisive tests, known risks, and collision proof. No live
migration, demand materialization, Teaching Load apply, generation, publication,
merge, or push.

