# TL-UX-C01R2 — Suggestion Apply Authority Correction

## Objective

Correct the Teaching Load suggestion workflow already integrated on `origin/main`
so an operator can never apply distribution moves that were not present in the
reviewed preview, and so preview/apply use the same current persisted workload
and qualification authority.

This is a narrow correction to the integrated TL-UX-C01/C01R work. It does not
authorize a live Teaching Load apply.

## Git workflow

1. Fetch `origin` and create a fresh clean worktree and neutral branch from the
   current `origin/main`, for example `work/teaching-load-ux-c01r2`.
2. Record the exact base SHA before editing.
3. Do not amend, rebase, merge, or push prior executor branches.
4. Commit one bounded candidate and return `REVIEW_REQUIRED` with the base SHA,
   candidate SHA, exact changed paths, decisive gates, and remaining risks.
5. Do not merge or push. Only the primary planner/integration owner may do so
   after independent QA.

## Confirmed defects to correct

### F1 — Unreviewed distribution moves can be applied

`applyTeachingLoadSuggestionProposal` compares plans only when both the stored
preview and refreshed preview contain `distribution`. A proposal created before
the distribution contract can therefore omit the reviewed plan while the
refreshed preview supplies moves; those moves are then applied without operator
review.

- Require a complete, evaluated distribution contract in both stored and
  refreshed previews before any insert or move.
- Missing, malformed, unevaluated, or asymmetric distribution contracts shall
  return typed `409 TEACHING_LOAD_PROPOSAL_STALE` with zero writes.
- Bind all semantic move fields, not only `ownershipId/from/to`: subject,
  section, faculty-subject identity, minutes, qualification tier/authority,
  applicable policy revision, and deterministic ordering.

### F2 — Preview/apply cap semantics diverge from ATLAS policy

The apply path imports `WORKLOAD_DEFAULTS.teachingStandardMinutes`, while the
accepted Teaching Load contract is driven by current persisted effective policy.
The rebalance evaluator also mixes advisory/ancillary credit into overload
status even though the Teaching Load UI and status contract use actual teaching
minutes for utilization, remaining teaching capacity, and excess.

- Resolve the current persisted effective workload policy through the supplied
  transaction client. Do not use a module-level default as write authority.
- Determine overload and receiver teaching capacity from actual teaching
  minutes under the effective teaching standard/hard cap.
- Keep valid advisory credit visible as neutral credited workload; it must not
  independently make a teacher over the teaching standard or reduce the
  receiver's teaching capacity.
- Preserve the bounded adviser preference only after department,
  qualification, scope, uniqueness, and capacity gates pass.

### F3 — Partial in-transaction revalidation leaves TOCTOU gaps

The refreshed plan is computed outside the Serializable transaction. The
transaction rechecks owner and receiver activity/capacity, but does not recheck
the complete qualification/department/alias/subject/policy authority and trusts
stale `move.minutes`.

- Revalidate the complete reviewed plan inside the existing Serializable
  transaction using only the transaction client.
- Recheck receiver qualification and department authority, subject scheduling
  metadata/minutes, exact owner/pair identity, current effective policy, and the
  resulting receiver capacity before any write.
- If any semantic input changes after preview, return
  `TEACHING_LOAD_PROPOSAL_STALE` and write nothing.
- Do not add a retry that silently changes the operator-reviewed plan.

## Required failing-first tests

Add a disposable PostgreSQL-backed mounted-route/service suite. It must clean up
in `finally` and prove its write detector with a rolled-back positive control.

1. A legacy/stored proposal without `distribution` plus a refreshed plan with a
   move is rejected with zero ownership, `FacultySubject`, cycle, proposal,
   faculty-version, and audit writes.
2. Missing or unevaluated refreshed distribution is rejected with zero writes.
3. A policy standard change after preview invalidates apply; no default-policy
   fallback is accepted.
4. Advisory credit alone does not classify a teacher as over the teaching
   standard and does not reduce teaching-capacity eligibility.
5. A receiver department, qualification alias, specialization, or subject
   authority change between preview and apply is rejected inside the
   transaction.
6. A subject-minutes change between preview and apply is rejected; stale
   `move.minutes` is never trusted.
7. A concurrent ownership or receiver-load change is rejected with zero partial
   writes.
8. A valid unchanged reviewed plan applies exact inserts/moves atomically,
   preserves `FacultySubject.sectionIds/gradeLevels`, bumps only affected
   versions, refreshes the cycle once, writes one audit, and replays
   idempotently with zero additional writes.
9. The existing year-9 read-only plan remains deterministic and reports no
   false balanced state.

## Focused gates

- New PostgreSQL-backed suggestion-authority suite.
- Existing `teaching-load-distribution-plan` suite.
- Existing Teaching Load ownership, canonical workload, distribution UI,
  route-intent, and UX guardrail suites.
- Server and client `tsc --noEmit`.
- Server and client production builds.
- Complete base-to-candidate `git diff --check`.
- One fresh independent QA review of the immutable commit range. The QA role is
  read-only and must not merge or push.

## Boundaries

- ATLAS source/tests/docs only.
- EnrollPro, AIMS, and SMART are READ_ONLY and must not be contacted or edited.
- No schema/migration change unless a proven blocker is returned to the primary
  planner.
- No live Teaching Load mutation, rollover, generation, publication, runtime
  restart, or port-5001 action.
- Do not touch TERM-CONSUME-C02, Dashboard, Timetable, demand, generation, or
  publication files.

## Completion contract

Return `REVIEW_REQUIRED`, never `GO`, with the immutable range and evidence.
If the correction cannot stay inside this boundary, return
`PLANNER_DECISION_REQUIRED` with the smallest concrete blocker.

