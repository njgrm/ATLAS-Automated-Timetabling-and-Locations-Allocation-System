# TL-SUGGESTION-C03R2 — Bind suggestions to canonical derived demand

Role: `PLANNER` orchestrating one bounded executor, fresh independent QA, and
one final completion audit. Do not act as the product executor yourself.

Status: `READY_TO_DISPATCH`

## Immutable starting boundary

- Create a clean worktree `D:\ATLAS-worktrees\tl-suggestion-c03r2` on branch
  `work/tl-suggestion-c03r2` from refreshed `origin/main`.
- At packet authoring, `origin/main` is
  `a8fe0dfa`; refresh before dispatch and report the actual base.
- Canonical directive: `D:/ATLAS/AGENTS.md`, LF-normalized SHA-256
  `29C1BD0600937B18C9B387B7F0A71A464E7EE8F7BC15D8A12B14AEE9CB41F81E`.
  Recompute and obey the current canonical file if it legitimately advanced.
- Read `docs/reference/atlas-runtime-source-of-truth-map.md` and
  `docs/plans/atlas-active-delivery-streams.md` before work.

Preserve existing history. Do not amend, rebase, reset, squash, merge, or push
from the executor worktree. This is source/test work only.

## Objective

Make canonical derived demand the sole current-year pair authority for Teaching
Load suggestions, staffing-needs reports, over-cap redistribution, proposal
fingerprinting, and apply-time revalidation. A subject or section that does not
create canonical timetable demand must not create suggested Teaching Load.

This correction must preserve qualified zero-load faculty discovery and the
already-reviewed persisted qualification, workload-policy, actor-school,
active-year, proposal-freshness, and Serializable apply protections.

## Production defects to close

1. Remove independent active-subject x active-section demand construction from
   `teaching-load-automation.service.ts`. Suggestion paths shall consume
   `buildDerivedDemand` and its canonical pair identities through the supplied
   data client.
2. Include only `SCHEDULED_TEACHING` demand. Every `REFERENCE_ONLY` subject,
   including a non-HG/non-ARAL code, shall create no suggestion, staffing gap,
   overload move target, ordinary teaching minutes, or proposal mutation.
3. Respect canonical grade/program scope and ordered-term rotation semantics.
   A rotation family may change subject, teacher, or room by term without
   multiplying annual Teaching Load ownership or distributing a weekly load
   across terms incorrectly.
4. Carry the exact derived-demand revision and canonical pair set into the
   suggestion preview/proposal signature. Apply shall re-resolve the authority
   inside its existing Serializable transaction through the transaction client.
5. If term authority, derived demand, pair scope, subject disposition, section
   scope, or revision changes between preview and apply, fail closed with the
   existing typed derived-demand/proposal-stale contract and zero ownership,
   FacultySubject, cycle, audit, or notification writes.
6. Existing ownership outside canonical demand shall be reported as stale or
   outside-demand authority; it shall not silently create suggestion demand or
   ordinary teaching minutes.
7. No global Prisma read, EnrollPro network read, or cache mutation may escape
   the supplied-client/transaction boundary. Passive preview remains zero-write.
8. Preserve deterministic receiver ordering, persisted-only qualification,
   actual-teaching-minute caps, adviser behavior, cross-department permission,
   actor-school authority, and qualified zero-load Filipino/ESP visibility.

## Required failing-first production-path controls

- A non-HG/non-ARAL `REFERENCE_ONLY` subject that the old query would include
  produces zero suggested ownership, zero staffing need, and zero apply writes.
- A scheduled subject scoped to only one grade/program produces canonical pairs
  only for matching active sections; the former Cartesian product mutant fails.
- Three ordered terms with one year-long subject and one rotating family produce
  the canonical ownership pair set without tripling annual ownership or splitting
  weekly sessions across terms.
- Qualified zero-load Filipino and ESP faculty remain visible and eligible when
  their canonical demanded pairs exist.
- Missing, stale, zero-active, ambiguous, and changed term/derived-demand
  authority fail closed in preview and in the real apply transaction.
- Change `schedulingDisposition`, program scope, ordered terms, or section scope
  between preview and apply; each returns the typed stale/blocker result with
  byte-identical protected tables and zero notification dispatch.
- A legacy ownership row outside canonical demand is diagnosed and excluded from
  ordinary workload/suggestion demand.
- Mutants must prove the canonical pair filter, derived-demand revision binding,
  and transaction-client revalidation are load-bearing.

Exercise the real `autoFill`, staffing-needs, over-cap preview, proposal preview,
and proposal apply entry points plus mounted routes. Helper-only evidence is not
sufficient. Use hermetic clients and a pre-provisioned disposable PostgreSQL
fixture only; never point a cleanup-risk test at the shared live database.

## Verification

Run the new C03R2 suites and preserve all existing C03/C03R authority and apply
parity assertions, Teaching Load reconciliation/derived-demand regressions,
server and client `tsc --noEmit`, server and client production builds, built
server route-mount smoke with rollover automation disabled, and `git diff
--check`. No live browser or shared-runtime test is required for this source
correction.

Freeze one additive candidate and return `REVIEW_REQUIRED`. Fresh QA shall
review the exact immutable range, independently rerun the decisive controls,
inspect every suggestion-demand producer/consumer, and return only
`ACCEPT_READY`, `CORRECTION_REQUIRED`, or `PLANNER_DECISION_REQUIRED`. The
planner may issue one bounded correction round, then must return unresolved
product decisions to the head planner. Integration and push are not authorized
by this packet.

## Forbidden actions

No live Teaching Load preview/apply, carry-forward, generation, publication,
rollover or term-cache apply, deployment, restart, migration, schema change,
shared-database write, companion-repository edit, merge, or push.

## Final return

Return the exact base/candidate SHAs, changed paths, canonical-pair and
reference-only control totals, QA tally, remaining risks, integration status,
single next action, safe parallel work, locked successors, and
`RETURN_TO_HEAD_PLANNER`.

Suggested commit:

```text
fix(teaching-load): bind suggestions to canonical derived demand
```
