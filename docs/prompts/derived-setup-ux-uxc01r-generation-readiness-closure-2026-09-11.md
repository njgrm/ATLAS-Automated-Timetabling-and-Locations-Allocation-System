# UX-C01R — Generation Readiness and Formal QA Closure

## Objective

Preserve UX-C01's successful retirement of the manual Curriculum Requirements
workflow, while correcting the remaining split between “derived demand exists”
and “generation is actually allowed.” The operator must see one honest final
readiness decision that includes Teaching Load ownership, canonical timetable
shape, policy, and validator blockers before any generation action appears.

## Immutable boundary

- Reuse `D:/ATLAS-worktrees/ux-c01-derived-setup` on
  `work/ux-c01-derived-setup`.
- Start only if the worktree is clean and HEAD is exactly
  `91d327e34d28f8a1c02ee41391b9323c89ed4362`.
- Original base: `89440321260a9c4902cc20b7c5a642f47a74e35f`.
- Add correction commits only. Do not amend, rebase, merge, or push.
- Own the UX-C01 client readiness adapter/presentation, its new read-only
  derived-demand route and Dashboard aggregation, focused tests, ledger/handoff
  docs, and `CHANGELOG.md`.
- Do not edit GEN-C02R1 generation/preflight services, Teaching Load write or
  carry-forward paths, migrations/schema, publication, auth middleware, or
  companion repositories.
- No live generation, publication, Teaching Load apply, migration, deployment,
  shared-runtime restart, or live-data mutation.

GEN-C02R1 owns the server generation-readiness contract. Its stable interface
must expose actor school/year, `generateAllowed`, derived-demand/source
revisions, blocker categories/codes/messages/repair ownership, term structure,
demand totals, Teaching Load coverage, shape validation, and zero-write truth.
UX-C01R may implement and test the client adapter against that pinned contract
in parallel, but final combined acceptance waits for both candidates.

## Finding 1 — derived readiness is not generation readiness

The current candidate calls:

`GET /api/v1/derived-demand/:schoolId/:schoolYearId/readiness`

and converts `data.ready` directly into the Timetable generation capability.
That proves only year/term/Subject demand derivation. It does not include exact
Teaching Load ownership, canonical schedule-shape capacity, retained-placement
freshness, policy/window/template readiness, or hard validator blockers.

Correct the real Timetable path:

1. Use the mounted GEN-C02 diagnostic contract as the sole generation gate:
   `GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic`.
2. Preserve actor-school/no-fallback behavior and clear prior readiness whenever
   school or year changes.
3. Keep the exact derived revision/source revisions, `generateAllowed`, blocker
   list, repair target, term structure, demand totals, Teaching Load totals, and
   zero-write result in the client readiness state. Do not collapse it to a
   boolean plus first message.
4. Generation is enabled only when scope is resolved, the diagnostic is
   available/current, `generateAllowed === true`, zero-write proof is true, and
   there are no blocking items.
5. A derived-ready response with any Teaching Load, canonical-shape, stale
   source, policy/template/window, or hard-validator blocker must remain visibly
   blocked and expose exactly one smallest repair action.
6. Failed/unavailable reads must never reuse the previous school/year's ready
   result or expose Generate/Retry Generate.

Add failing-first client tests showing the old raw-derived endpoint and boolean
mapping would enable generation for a fixture that is derived-ready but has a
Teaching Load or shape blocker.

## Finding 2 — Dashboard must not overclaim final readiness

The Dashboard may use derived-demand data to explain EnrollPro terms, Subject
metadata, and expected demand. It must not turn that narrower result into
“Setup is complete. Run the generator.”

- Label derived-demand completion as an input milestone, not final generation
  approval.
- When demand inputs are ready but complete generation readiness has not been
  verified, the primary action is `Check generation readiness` and opens the
  Timetable. It must not say `Generate the timetable` or claim zero blockers.
- Teaching Load language must distinguish subject-level qualification/coverage
  from exact derived subject-section ownership. Do not display “Every subject
  has a teacher” as sufficient generation authority.
- If the server response exposes exact Teaching Load pair coverage, show its
  demanded/owned/unresolved counts. Otherwise direct the operator to the
  Timetable final check without guessing readiness.
- Preserve one primary action, progressive disclosure, mobile readability, and
  the previously verified retired-route redirects.

Add negative controls for derived-ready plus missing exact owner, derived-ready
plus shape blocker, and stale prior-school readiness.

## Finding 3 — complete the missing formal production-path proof

The browser report is useful rendered evidence but is not formal commit-range
QA: it did not bind the complete 29-path candidate, and its live backend did
not contain the new derived-demand route.

Add a mounted-route test for the UX-C01 read-only endpoint proving:

- missing/invalid auth, non-privileged role, unresolved actor school,
  cross-school scope, and malformed IDs fail with the typed status before
  authority service invocation;
- exact actor school/year ready and typed-blocked responses preserve the
  revision/blockers/totals without mutation;
- unclassified dependency/database failures remain unavailable/errors rather
  than being converted into a ready or synthetic-zero response;
- read/write instrumentation proves zero writes, with a rolled-back positive
  control demonstrating sensitivity.

Also prove through the real client hook/capability path that the mounted
generation diagnostic controls every visible generation trigger. Source scans
alone are not decisive evidence.

## Browser verification

Preserve the completed Tailnet redirect/navigation/mobile evidence. For the
new positive diagnostic behavior, use an isolated candidate server and client;
`localhost` is explicitly authorized for this isolated verification because
the shared Tailnet backend must not be restarted. Do not represent this as a
live deployment.

At 1280×720 and 390×844 prove:

- a fully ready diagnostic presents one clear generation action;
- each blocker category presents no generation action and one accurate repair;
- technical identifiers are disclosed progressively rather than placed in the
  primary copy;
- no retired requirements request occurs; no non-login mutation request occurs;
- no overflow, mojibake, dead action, or stale cross-scope readiness.

Restore all temporary processes, ports, dependency junctions, and browser state
in `finally` and leave the worktree clean.

## Focused gates and QA

- UX-C01 derived setup, Dashboard lifecycle/resilience, Timetable operator UX,
  capability, runtime-truth, and route-intent suites.
- New mounted derived-demand route test and client diagnostic-gate tests.
- Server/client `tsc --noEmit`, both production builds, built server route-load
  check, and complete `89440321...<new-tip>` diff-check.
- Fresh independent QA must review the complete immutable range and all changed
  paths. It must classify this candidate as dependent on the GEN-C02R1 contract
  until combined integration gates pass.

## Return contract

Commit the additive correction and return `REVIEW_REQUIRED` with:

- original base, prior candidate, new tip, exact complete changed paths, and
  clean worktree proof;
- before/after generation-readiness flow and every visible trigger consuming it;
- mounted-route auth/scope/zero-write results;
- derived-ready-but-generation-blocked negative controls;
- Dashboard wording/decision evidence;
- isolated browser matrix and restoration proof;
- focused test/type/build/diff results and fresh QA verdict;
- explicit GEN-C02R1 dependency and zero live mutation statement.
