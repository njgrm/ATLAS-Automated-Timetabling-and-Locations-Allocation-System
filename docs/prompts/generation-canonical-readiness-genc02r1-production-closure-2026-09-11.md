# GEN-C02R1 — Production Preflight and Shape-Proof Closure

## Objective

Complete only the four requirements that remain materially unproven after
GEN-C02R. Make the real generation trigger consume the same complete passive
preflight as readiness before any write, and prove the 2026–2027 stakeholder
shape and rotating-demand contracts through production paths rather than
helper-only assertions.

## Immutable boundary

- Reuse `D:/ATLAS-worktrees/integration-term-consume-c02` on
  `integration/readiness-20260911`.
- Start only if the worktree is clean and HEAD is exactly
  `3ecb041986415715de670433fce48c3471144ff5`.
- Preserve the linear history beginning at base
  `6f7b3c52c8454678ae6df804a2740863aca09901` and prior candidate
  `900ea7ff6f7aa5c636d34f0fcb86c33c3c75e620`.
- Add correction commits only. Do not amend, rebase, merge, or push.
- Do not edit UX-C01 client files, Teaching Load suggestion/carry-forward
  files, Dashboard, publication, migrations/schema, auth middleware, or any
  companion repository.
- No live generation, publication, Teaching Load apply, deployment/restart,
  migration, or live-data write.

The current candidate is `CORRECTION_REQUIRED`. Passing its existing tests is
not sufficient because the missing requirements concern production wiring and
adversarial coverage.

## Finding F1 — one complete passive assembly before all writes

`triggerGenerationRun()` currently creates a QUEUED run, changes it to RUNNING,
and publishes `GENERATION_RUN_STARTED` before resolving canonical derived
demand and the complete scheduler inputs. It also calls write-capable setup
helpers after those writes.

Implement one shared read-only generation preflight/assembly used by both the
readiness service and the real trigger. It shall resolve and bind:

- actor-authorized school and sole active year;
- verified ordered term contract and derived-demand revision;
- active sections, exact `SubjectSectionOwnership` owners and matching
  `FacultySubject` scope;
- subjects, rooms/building scope, persisted scheduling policy, persisted grade
  windows, persisted class-program/template rows, special events, retained
  placements/drafts, and current occupancy;
- scheduler input, canonical shape contracts, validator context, and every
  freshness/source revision needed by the eventual write.

The trigger must complete this preflight and return the same typed blockers as
readiness before creating/updating a `GenerationRun`, emitting an event, writing
an audit, consuming a draft, or performing any other mutation. Generation must
not call `syncSectionsFromExternal`, `ensureDefaultTemplates`,
`ensureTemplatesForProgramTypes`, `ensurePhase3GradeWindows`,
`getOrCreatePolicy`, canonical-slot creation, or another setup-healing writer.
Missing persisted setup must be a typed blocker owned by an explicit
setup/rollover surface.

Immediately before the first authorized generation write, revalidate the
assembly's bound revisions. Drift must return a typed stale-preflight error with
zero writes rather than silently rebuilding from different inputs. Once the
first write occurs, preserve the existing failed-run recording behavior for
genuine scheduler/runtime failures; this requirement concerns prerequisite and
freshness failures before a run legitimately starts.

Add a test that invokes the real `triggerGenerationRun()` entry point with
write-attempt instrumentation. It must prove:

1. missing setup, blocked authority, and stale revisions create no run, audit,
   notification, consumed draft, lock, policy, window, template, slot, section,
   ownership, or cycle write;
2. readiness and trigger preflight expose equal revisions, term identities,
   demand identities/totals, exact owners, shapes, and validator policy;
3. a mutation between readiness and trigger is rejected stale with zero writes;
4. the old create-run-first ordering would be detected by the control.

Helper invocation alone is not production-path proof.

## Findings F2 and F3 — executable stakeholder-shape contract

Keep the accepted stakeholder sources read-only. Upgrade
`generation-stakeholder-shape-genc02r.test.ts` (or replace it with an equivalent
focused suite) so its decisive assertions execute the production readiness
assembly, scheduler, and validator/export-display resolvers—not only
`getExpectedCanonicalSlots()`.

For REGULAR, STE, SPA, and SPS across Grades 7–10, prove:

- G7/G8 scheduled entries use only the accepted morning rows beginning at
  `06:00`; G9/G10 use only the accepted `09:45–18:30` afternoon rows;
- every emitted entry belongs to the exact grade/program canonical CLASS set;
- lunch, health breaks, special events, wrong term, and wrong row-kind slots
  cannot host a class;
- the effective rows consumed by timetable display and export are equal to the
  generated canonical rows, including stable term/order semantics;
- HG remains reference-only and unscheduled;
- the Friday ARAL/TLE note remains an explicit unresolved decision note and is
  not silently encoded.

Add the required adversarial case: inject one wrong-shift scheduled entry for
which the generic hard-constraint validator reports zero violations. The
canonical shape validator/readiness result must still produce a typed HARD
shape blocker, `generateAllowed=false`, and the exact grade/program/term/row
explanation. Include a control proving the old helper-only test would not catch
this injected entry.

## Finding F4 — exact nonuniform rotation totals

Existing coverage demonstrates a fail-closed trimester case but does not prove
the required unequal-member quarter contract or expose the old max-collapse
loophole.

Add both TRIMESTER and QUARTERS fixtures whose rotating-family members have
unequal weekly minutes and session counts. Through the shared production
assembly and scheduler projection, assert per term:

- exact term identity/order and subject member;
- exact weekly minutes and session count;
- exact canonical owner and room requirements;
- no duplicate or dropped effective sessions;
- changing one member changes only that term's projection and source revision.

If the production scheduler intentionally cannot support nonuniform rotating
members, it may fail closed with `ROTATION_DEMAND_INCONSISTENT`, but the tests
must cover both three- and four-term contracts and prove zero preflight writes.
Add a negative-control implementation/projection showing that the former family
maximum plus identity-only comparison passes identity coverage while producing
wrong per-term totals; the corrected assertion must fail that mutant.

The live school currently has three terms. QUARTERS is a portability regression
contract, not a claim about the current live configuration.

## Preserve already accepted GEN-C02R behavior

Do not regress actor-school gates, structured blocked readiness, exact Teaching
Load owner authority, grade/window identity separation, canonical-capacity
fail-closed behavior, derived-demand freshness, or the disposable PostgreSQL
zero-write route proof. Do not duplicate UX-C01 client wiring.

## Verification

Run only the focused affected gates plus their direct regressions:

- GEN-C02/GEN-C02R/R1 readiness, stakeholder-shape, production-trigger, and
  rotation suites;
- derived-demand, schedule-constructor shape/event, canonical slot/template,
  pre-generation draft, exact-owner, and generation passive-write regressions;
- the existing disposable-PostgreSQL mounted readiness suite with exact
  cleanup and zero residue;
- server `tsc --noEmit`, server production build, built-module/server startup
  check with rollover disabled, and complete-range `git diff --check`.

Obtain a fresh independent QA review over
`6f7b3c52c8454678ae6df804a2740863aca09901...<new-tip>`. The reviewer must
inspect the real trigger ordering and production call graph, not accept source
guards or helper-only tests as substitutes. Fix material findings additively
and obtain fresh QA for the corrected tip.

## Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` (and
`GENERATION_BLOCKED` if a canonical dry-run still has hard blockers), including:

- original base, prior candidates, new tip, exact changed paths, and clean
  worktree proof;
- a before/after trigger call graph identifying the first write;
- readiness-versus-trigger assembly parity and stale-preflight zero-write proof;
- production stakeholder shape matrix, wrong-shift/generic-zero mutant, and
  export/display parity;
- trimester and quarter nonuniform rotation totals plus max-collapse mutant;
- focused test counts, PostgreSQL target/cleanup evidence, type/build/startup/
  diff results, fresh QA verdict, and all remaining blockers;
- explicit confirmation that no live generation, publication, Teaching Load
  apply, deployment/restart, migration, or companion edit occurred.
