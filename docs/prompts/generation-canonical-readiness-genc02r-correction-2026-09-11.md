# GEN-C02R — Stakeholder Shape and Mounted Zero-Write Correction

## Objective

Correct every independently reproduced GEN-C02 production blocker without
duplicating the parallel UX-C01 client work. Preserve the accepted
legacy-demand closure, add executable 2026–2027 stakeholder-shape parity,
enforce exact actor/current-year/Teaching-Load authority, make readiness and
generation consume one passive assembly, and prove the mounted diagnostic is
zero-write against a disposable PostgreSQL ATLAS fixture.

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

## Correction 3 — actor-school authority on both entry points

The candidate added a privileged-role check but did not bind either the new
diagnostic or the existing generation trigger to the authenticated actor's
school. Correct this in `generation.router.ts` without editing authentication
middleware:

- unresolved actor school must return a typed 403 before service invocation;
- a school mismatch must return a typed 403 before service invocation;
- a matching actor school may proceed;
- cover both `GET .../readiness/diagnostic` and `POST .../runs` through the
  mounted router;
- assert zero reads/writes/service calls for rejected scope.

`SYSTEM_ADMIN` is not an implicit cross-school bypass. If a cross-school system
operation is needed later, it requires a separately designed integration
contract rather than a URL parameter.

## Correction 4 — return blocked readiness instead of throwing

The live read-only year-9 probe currently reaches the expected
`TERM_STRUCTURE_UNAVAILABLE` authority gap, then `consumeDraftPlacementsForRun`
throws `DERIVED_DEMAND_BLOCKED`; the diagnostic therefore fails instead of
returning its structured blocker result.

- If derived demand or term authority is unavailable, return `status=BLOCKED`,
  `generateAllowed=false`, and the typed authority blocker list.
- Do not call downstream draft/scheduler paths that require resolved demand.
- Convert other expected read-only prerequisite failures into the corresponding
  deterministic blocker. Do not swallow programming errors or database faults.
- Add a mounted missing-term case proving HTTP 200 structured blocked readiness,
  exact repair ownership, and zero writes.

## Correction 5 — one passive pre-write assembly for readiness and generation

The candidate shares only timetable-shape construction. It still duplicates
most input reads, Teaching Load mapping, scheduler input construction, and
validator context between `generation-readiness.service.ts` and
`generation.service.ts`. The production trigger also creates a QUEUED/RUNNING
run and emits a notification before canonical demand is resolved, then invokes
write-capable setup helpers (`syncSectionsFromExternal`, default/template/window
ensures, and get-or-create policy behavior).

- Extract one read-only canonical input assembly used by both readiness and the
  real trigger: active-year authority, verified ordered terms, derived demand,
  section snapshot, exact Teaching Load ownership, subjects, rooms, persisted
  policy/windows/templates, retained placements, scheduler input, validator
  context, and freshness revisions.
- Generation must be a passive consumer of those authorities. It must not sync
  sections, create/heal defaults, create policy/windows/templates, or otherwise
  repair setup implicitly. Those actions belong to explicit setup/rollover
  workflows.
- Resolve and validate the complete immutable assembly before creating a
  GenerationRun, audit/event, or other write. A blocked or stale preflight must
  produce the same typed blocker contract as readiness and create no failed or
  placeholder run.
- Once preflight succeeds, the HIGH generation action may persist its run using
  that exact assembly; revalidate its source revisions before the first write or
  fail stale with zero writes.
- Prove through real entry points that readiness and trigger receive equal
  revisions, demand identities/totals, shapes, Teaching Load candidates, and
  validator policy. A source mutation between preview and trigger must fail
  stale rather than silently rebuild from different inputs.

Do not import or cherry-pick an obsolete unreviewed branch wholesale. Reuse any
sound existing helper design only after reconciling it with current
`origin/main` and this candidate.

## Correction 6 — correct grade and window authority domains

Two similarly named values must not be interchanged:

- `SectionMirror.gradeLevelId` is the EnrollPro internal grade identity and must
  be normalized with the internal-ID mapping. `displayOrder` is presentation
  ordering and must not determine curriculum demand.
- `GradeShiftWindow.gradeLevel` and canonical slot grade levels are already
  actual grades 7–10. They must not be passed through an internal-ID normalizer
  that maps `7→9` or `8→10`.

Add mutants proving demand is unchanged when only section `displayOrder`
changes, while changing the authoritative grade identity changes scope; and
prove Grade 7/8 windows cannot match Grade 9/10 contracts or vice versa. Pin the
live-compatible 17–20 → 7–10 mapping without school-specific assumptions.

## Correction 7 — exact Teaching Load owner is the scheduler authority

Current readiness counts `SubjectSectionOwnership`, but the scheduler candidate
pool is built from broad `FacultySubject.sectionIds` and may choose a different
qualified teacher, especially when flexible assignment is enabled. That would
make a schedule disagree with the reconciled Teaching Load.

- For every derived subject/section pair, resolve exactly one active canonical
  `SubjectSectionOwnership` owner and its matching `FacultySubject` scope.
- Missing, duplicate/conflicting, inactive/stale, or scope-mismatched ownership
  is a typed Teaching Load blocker with the exact pair and term identities.
- The scheduler candidate set for ordinary pair demand must be the canonical
  owner, not every broadly qualified faculty member. Flexible qualification may
  inform a repair suggestion but must not silently override approved ownership.
- Retained placements naming a different faculty member must be rejected stale.
- Prove a mutant where two same-department faculty have FacultySubject scope but
  only one owns the pair; readiness and the generated candidate must use only
  the owner. Prove that toggling flexible assignment cannot change this.
- Preserve explicit cohort behavior only when the cohort has a separately
  authoritative owner contract; otherwise fail closed rather than unioning
  unrelated pair owners.

## Correction 8 — readiness truth must include shape and zero-write truth

- `generateAllowed` must be false if the diagnostic's before/after evidence is
  not identical. Compute and bind zero-write truth before the final status.
- Generic hard-constraint validation is insufficient. Validate every scheduled
  entry against its exact grade/program canonical CLASS rows, term, break/event
  exclusions, and shift frame; shape violations are HARD readiness blockers and
  prevent generation.
- Preserve exact `termIdentity`/term order on unassigned and hard blockers. Do
  not return `termIdentity:null` when the scheduler item identifies a term.
- Strengthen canonical-template coverage so duplicates, missing rows, wrong
  ordering, wrong row kind, or cross-grade/program substitution cannot pass via
  set de-duplication.
- Add negative controls for an injected write, a wrong-shift entry with zero
  generic validator violations, a duplicate canonical row, and an unassigned
  rotation line whose returned blocker names the correct term.

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
- Mounted actor-school negative controls and passive-trigger pre-write controls.
- Exact Teaching Load owner-selection and grade/window-domain mutants.

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
