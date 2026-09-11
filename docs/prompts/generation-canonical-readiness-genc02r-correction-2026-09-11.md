# GEN-C02R — Stakeholder Shape and Mounted Zero-Write Correction

## Objective

Correct the two remaining GEN-C02 server evidence gaps without duplicating the
parallel UX-C01 client work. Preserve the accepted legacy-demand closure and
readiness architecture, add executable 2026–2027 stakeholder-shape parity, and
prove the mounted readiness diagnostic is zero-write against a disposable
PostgreSQL ATLAS fixture.

## Immutable Git boundary

- Reuse `D:/ATLAS-worktrees/integration-term-consume-c02` on
  `integration/readiness-20260911`.
- Verify the worktree is clean and HEAD is exactly
  `900ea7ff6f7aa5c636d34f0fcb86c33c3c75e620`.
- The correct original base is
  `6f7b3c52c8454678ae6df804a2740863aca09901`, which is the direct parent of
  `900ea7ff`. Report and review
  `6f7b3c52...<new-candidate>`; do not use `89440321` as the implementation
  boundary.
- Add correction commits only. Do not amend, rebase, merge, or push.
- Do not edit `atlas-client/src/hooks/useTimetableData.ts` or other UX-C01-owned
  client paths. Candidate `91d327e3` on `work/ux-c01-derived-setup` owns the
  Simple Timetable derived-readiness wiring and requires separate QA.
- Stay within GEN-C02 server production/test paths, its progress/handoff docs,
  runtime source map, and `CHANGELOG.md`.

No live generation, publication, Teaching Load/carry-forward apply, deployment,
runtime restart, migration, live-data write, or companion-repository edit.

## Preserve the accepted GEN-C02 work

Do not regress:

- current-year legacy `computeDemand()` closure across pre-generation draft,
  quick-place, timetable sync/setup, and generation assembly;
- shared derived-demand revision and exact pair/line parity;
- shared `buildRunTimetableShapeContracts` use by readiness and the real trigger;
- deterministic read-only scheduler execution and owned typed blockers;
- privileged mounted readiness route and fail-closed `generateAllowed` result.

## Correction 1 — executable stakeholder-shape parity

Inspect the sources read-only from the main workspace because `stakeholderFiles`
is intentionally untracked and absent from this worktree:

- `D:/ATLAS/stakeholderFiles/aral-prog_G7_Class-Program_SY2026-2027docx.docx`;
- `D:/ATLAS/stakeholderFiles/DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx`;
- `D:/ATLAS/docs/verification/class-program-policy-baseline-2026-08-29.md`;
- the committed canonical class-program and shift-window implementation/tests.

Do not edit, copy, stage, or commit the stakeholder files. Add failing-first
tests through the real readiness/shape/validator production path proving:

1. Grade 7 and Grade 8 entries use only the accepted morning frame beginning at
   `06:00` and never use Grade 9/10 afternoon-only rows.
2. Grade 9 and Grade 10 entries use only `09:45–18:30` and never use Grade 7/8
   morning rows.
3. Every active REGULAR/STE/SPA/SPS grade-program scope uses its canonical base
   and specialization rows, with stable ordering.
4. Lunch and health breaks are unavailable for class placement. The duplicated
   `12:15–13:00` Lunch versus Flag/HG/TLE source row remains blocked lunch; HG
   remains reference-only and unscheduled.
5. Export/display shape matches the canonical scheduler rows.
6. A cross-shift or fallback-slot mutant fails the test.
7. “Zero hard blockers” is false whenever a scheduled entry violates its
   canonical shift/class-program shape, even if the generic validator reports
   no other hard violation.

The Friday ARAL/TLE note remains an explicit unresolved stakeholder decision.
Do not silently encode it, remove it from evidence, or let it block unrelated
shape validation. Report it as a decision note in the readiness result.

## Correction 2 — mounted disposable-PostgreSQL zero-write proof

Replace the in-memory recorder as the decisive zero-write evidence with a real
mounted-route test against a newly provisioned disposable ATLAS database whose
name matches the repository's disposable-target guard (for example
`atlas_restore_drill_genc02_<unique>`).

- Never point this test at `atlas_recovery_clean_rebuild_20260905` or another
  persistent/live-like database.
- Provision/apply the canonical schema only inside the disposable database.
- Seed the smallest school/year/verified term/Subject/section/Teaching Load/
  room/policy/template fixture needed to execute the authenticated privileged
  readiness route and real scheduler path.
- Capture before/after counts and stable signatures for every writable domain:
  generation runs, draft/locked sessions, audits, notifications, Teaching Load
  ownership/cycle, derived authority inputs, publication/revisions, and any
  route-adjacent model.
- Invoke the mounted endpoint, assert the expected derived revision/totals and
  `zeroWrite:true`, and prove all signatures unchanged.
- Include a rolled-back positive control showing the recorder/signature census
  detects a write.
- Use `try/finally`; remove all fixture rows and drop the disposable database.
  Assert zero residue even after a failing assertion.
- Do not weaken the existing publication concurrency target-name guard.

## UX-C01 integration dependency

GEN-C02R owns the server contract only. It must keep a stable typed readiness
payload containing the exact derived revision, `generateAllowed`, blocker
groups, counts, and repair targets required by the operator surface. Add a
server contract/source guard that would fail if the mounted route stops
exposing those fields.

Do not implement competing client wiring here. Final integration acceptance
will combine this candidate with separately accepted UX-C01 and verify that
the Simple Timetable consumes this endpoint rather than
`/curriculum-requirements/:year/readiness`. Until UX-C01 is accepted, report
this dependency honestly; do not claim the complete operator workflow closed.

## Focused gates

- GEN-C02 and GEN-C02R readiness/shape/mounted-route suites.
- Existing class-program, schedule-constructor shift/event, program-template,
  derived-demand C01/R/R2, pre-generation draft, quick-place, timetable sync,
  generation passive-Teaching-Load, and snapshot regressions affected by the
  correction.
- Disposable PostgreSQL test with exact cleanup and zero residue.
- Server `tsc --noEmit`, production build, complete-range `git diff --check`,
  and isolated built-server health/route mount with rollover automation
  disabled.
- No client gate is required in this correction because UX-C01 owns that path.

Obtain one fresh independent changed-scope review over
`6f7b3c52...<new-candidate>`. Fix material findings with additive commits and
fresh QA.

## Return contract

Return `REVIEW_REQUIRED` and, if canonical dry-run hard blockers remain, also
`GENERATION_BLOCKED`. Include:

- correct base, prior candidate, and new candidate SHAs;
- exact correction and complete-range changed paths;
- stakeholder source-to-assertion trace and grade/program shape matrix;
- mounted route, disposable target, before/after signatures, positive control,
  cleanup, and zero-residue evidence;
- preserved legacy-demand/parity/readiness gates;
- the explicit UX-C01 dependency;
- all remaining blockers/decisions;
- confirmation of zero live generation, publication, Teaching Load apply,
  deployment/restart, migration, and companion edit.
