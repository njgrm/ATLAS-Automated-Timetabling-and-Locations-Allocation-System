# DEMAND-C01 — Canonical Derived Demand Authority

## Objective

Replace current-year `SchoolYearOffering` / Curriculum Requirements authority
with one deterministic, read-only demand contract derived from:

1. the sole active, non-archived EnrollPro school year and its verified ordered
   term structure;
2. active ATLAS section mirrors; and
3. ATLAS Subject scheduling metadata.

Teaching Load reconciliation, Timetable demand, and generation input assembly
must consume the same demand identities and semantic source revision. This is
source work only: do not reconcile Teaching Load, generate, or publish.

## Git and role boundary

- Fetch origin and create a fresh clean worktree from current `origin/main` on
  `work/derived-demand-c01`. Record the exact base SHA.
- Commit one immutable candidate and return `REVIEW_REQUIRED` with base,
  candidate, exact paths, decisive checks, and remaining risks.
- Do not merge, rebase, amend, or push. QA is read-only and must return control
  to the primary planner.

## Authority contract

- Resolve actor school and the sole active, non-archived year dynamically.
- Use the verified/cached EnrollPro ordered term structure introduced by
  TERM-CONSUME-C02. A legitimately unresolved current active term does not
  invalidate the ordered structure.
- Build demand set-wise from active sections and Subjects whose
  `schedulingDisposition` is `SCHEDULED_TEACHING`.
- `REFERENCE_ONLY` Subjects, including canonical HG, create no timetable demand
  and no Teaching Load pair.
- Apply Subject grade/program scope exactly. Do not infer missing scope from
  names, codes, ownerships, old requirements, or historical schedules.
- Non-rotating teaching Subjects occur in every ordered term.
- Rotating-family members occur only in the term selected by their validated
  rotation order. Reject missing, duplicate, out-of-range, or incomplete
  rotation metadata with a typed blocker; do not invent or silently cycle a
  mapping.
- A timetable demand identity is school/year/term/subject/section. A Teaching
  Load demand identity is the unique school/year/subject/section pair across
  terms.
- Bind school/year, ordered term structure, active sections, and every semantic
  Subject field used by derivation into one canonical semantic revision.
  Counts and timestamps are diagnostic only.
- Current-year reads must ignore manually authored `SchoolYearOffering`,
  `OfferingTermAssignment`, and `SchoolYearTermConfig` rows as authority. They
  may be compared read-only as transition diagnostics, never selected as truth.
- Every passive preview/read is zero-write.

## Production consumers

Create one service such as `derived-demand.service.ts`, then wire these existing
read paths to it rather than reimplementing derivation:

- `teaching-load-reconciliation.service.ts` demand snapshot/preview;
- `timetable-demand.service.ts` summary and preview;
- generation input assembly / `generation.service.ts`, using the scheduler's
  demand override so the canonical scheduler receives term-aware demand.

Keep controllers transport-only. Runtime server imports must be ESM-safe with
`.js` endings. Do not retain a fallback to `computeDemand()` or persisted
offering authority when derived inputs are missing; return a typed blocker.

## Parallel collision boundary

Do not edit:

- `teaching-load-automation.service.ts`;
- `teaching-load-suggestion-proposal.service.ts`;
- Teaching Load suggestion/apply tests or UI;
- Dashboard files;
- `atlas-migrate.ts` or migration-guard tests;
- Curriculum Requirements/Decision Workspace client UI;
- schema or migrations.

If correct production wiring requires one of those files, stop with
`PLANNER_DECISION_REQUIRED` and name the exact collision. Do not widen scope.

## Required failing-first evidence

Add focused hermetic and disposable-PostgreSQL controls proving:

1. ALL demand appears in every ordered term with stable ordering.
2. Science/TLE rotation follows ordered term identities and rotation order.
3. REFERENCE_ONLY/HG produces zero timetable lines and zero Teaching Load pairs.
4. grade/program scope is exact; inactive/cross-school sections are excluded.
5. malformed/incomplete rotation and missing term structure fail closed.
6. same-count changes to a semantic Subject, section, or term field change the
   revision; read-order permutations do not.
7. persisted offering rows can be contradictory or absent without changing the
   derived result; a mutant that reads them as authority fails.
8. all three consumers return the same revision and agree on timetable-line and
   unique Teaching Load-pair totals.
9. the real generation assembly receives the derived demand override and does
   not call legacy `computeDemand()` for the current-year path.
10. all previews perform zero writes, with a write-recorder positive control.

Use disposable schools/years and exact cleanup. Do not touch the live school.

## Focused gates

- New derived-demand and consumer-integration suites.
- Existing Teaching Load reconciliation, TT-C02 demand/insertion, generation
  passive-authority, and term-contract C02 suites affected by the wiring.
- Server `tsc --noEmit`, server production build, built-server health and route
  mount on an isolated port with rollover automation disabled.
- `git diff --check` on the committed range.

No client build is required unless client files change; client files are not
expected in this stream.

## Completion contract

Return `REVIEW_REQUIRED`, never `GO`. Report exact derived line/pair totals for
a disposable fixture and a read-only live preview, but do not persist demand,
reconcile Teaching Load, generate, publish, restart port 5001, or deploy.
