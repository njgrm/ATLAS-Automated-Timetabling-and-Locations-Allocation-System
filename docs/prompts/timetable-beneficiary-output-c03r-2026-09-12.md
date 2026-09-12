# TT-OUTPUT-C03R — Close beneficiary weekday output parity

Role: `EXECUTOR`

Status: `READY_FOR_CORRECTION`

## Immutable starting boundary

- Worktree: `D:\ATLAS-worktrees\tt-output-c03`
- Branch: `work/tt-output-c03`
- Base: `4e5ef1f60193a8225af7bceac13a34a4c126152d`
- Existing candidate: `378a1f710e913837cc79f0e2424939fa145ac8aa`
- Worktree is clean. Preserve the four existing additive commits; do not amend,
  rebase, squash, reset, merge, or push.

The existing candidate correctly improves day-aware client/room projections,
Monday-only flag handling, published teacher normalization, HG/ARAL exclusion,
numeric DOCX ordering, revision-effective workbook sourcing, requested-run
binding, and term fail-closed behavior. Preserve those corrections.

## Planner decision

The official DNO Monday-through-Friday class-program layout is in scope. The
conditional advisory acceptance is therefore rejected. A grade/section-by-time
table that collapses weekdays is not beneficiary-output parity.

## Objective

Make the real class-program workbook and matrix paths preserve the complete
identity `(termIndex, day, interval, section, subject, faculty, room)` and emit
beneficiary-readable schedules shaped like the supplied 2026–2027 class and
teacher programs.

Terms remain separate schedule authorities selected by an ordered-term
switcher/export parameter. Do not add term badges to cells or merge three terms
into one weekly schedule.

## Required corrections

1. `workbook-export.service.ts::buildEntryGrid` must include weekday in its key.
   No Monday entry may populate Tuesday–Friday, and same-time entries on
   different days must coexist.
2. `exportClassProgramWorkbook()` must provide a per-section beneficiary view
   with time/minutes, Monday, Tuesday, Wednesday, Thursday, Friday, and teacher
   information. It may retain a separate grade-monitoring summary, but that
   internal matrix must not masquerade as the official class program.
3. `class-program-matrix.service.ts` and its mounted route must preserve weekday
   cells rather than selecting the first entry by interval. Remove the fallback
   that returns a stale-faculty run. Bind the requested/effective source run and
   term consistently with the reviewed workbook route, or fail closed with a
   typed empty/stale-source result.
4. Generate distinct section, teacher, and room outputs from one effective run
   and selected ordered term. Each projection must have parity with that source
   while using the appropriate beneficiary layout.
5. Morning G7/G8 and afternoon/special G9/G10 windows must remain configurable
   persisted shapes. Validate the current 2026–2027 shapes without hardcoding
   them as universal school rules.
6. Flag/HGP is Monday-only and shares the underlying first-period boundary; it
   must not consume a five-day block or ordinary teaching load. Breaks are
   non-demand rows. HG and ARAL are excluded from ordinary timetable cells and
   workload. AP/Araling Panlipunan remains an ordinary subject.
7. Rotating subjects and teacher/room changes are resolved per selected term.
   The current Science rotation may keep one teacher, but tests must permit a
   different qualified teacher or room in another term.
8. Keep actor-school/year authorization, run-id binding, effective published
   revisions, stable ordering, memory-sensitive latest-run selection, and no
   heavy all-run payload scans.

## Required failing-first evidence

- A Monday and Tuesday session with the same section/interval but different
  subjects must occupy different weekday cells; the old key must fail.
- A Monday-only flag event appears only in Monday, with Tuesday's first-period
  teaching cell still available.
- A five-weekday section workbook contains the expected weekday headings and
  exact per-day subject/teacher cells.
- G7/G8 morning and G9/G10 afternoon/special fixtures respect their persisted
  windows and breaks; a cross-shift placement fails.
- Term 1/2/3 exports select the matching rotating subject, teacher, and room
  without mixing terms. Include a negative missing/invalid term case.
- Section, teacher, and room projections have identical source-entry identities
  after normalization.
- Stale-faculty or wrong-run fallback is rejected rather than silently shown.
- HG/ARAL never appear as ordinary demand cells; AP remains present.
- Workbook inspection must read the generated XLSX cells and assert layout and
  values, not merely inspect source helpers.

Also add or restore a committed mounted test for the real
`/:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx` and
`/:schoolId/:schoolYearId/class-program-matrix` routes. Use fixture/in-memory
data with zero writes. Do not generate or publish a live schedule.

## Verification and boundaries

Run focused output/export, stakeholder-shape, canonical-readiness, route,
client projection, server/client type checks, production builds, built-module
imports where relevant, and `git diff --check`. Browser QA is not required for
this source/export correction; later live runtime acceptance owns rendered
download verification.

No live generation, publication, deployment, restart, Teaching Load mutation,
database/schema/migration change, or companion-repository edit. Commit only
additive corrections and return `REVIEW_REQUIRED`; do not merge or push and do
not commission duplicate general advisory review.

## Return contract

Return the exact complete range and correction range, changed paths, production
routes, generated-workbook cell assertions, mandatory tally, tests/builds,
remaining risks, and zero-mutation statement. The single next action is fresh
primary-planner QA of the exact final range.

Suggested commit:

```text
fix(timetable): preserve weekdays in beneficiary outputs
```
