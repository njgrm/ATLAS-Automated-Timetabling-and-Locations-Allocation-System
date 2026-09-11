# RR-TERM-CACHE-C01 — aligned-year term-authority catch-up

## Role and verdict

Execute one bounded source-and-test correction in a fresh worktree from the
accepted `origin/main` named by the planner at dispatch time. Commit the
candidate and return `REVIEW_REQUIRED`; do not merge or push.

This is an ordinary implementation candidate with a future HIGH apply boundary.
It authorizes no deployment, login, rollover apply, term-cache write against the
live database, Teaching Load mutation, generation, or publication.

## Objective

Remove the rollover split-brain exposed after Wave 1 deployment. ATLAS can report
that the active year is aligned and `recommendedAction: NONE` while the active
mirror has no persisted verified ordered-term snapshot. Canonical derived demand
then fails with `TERM_STRUCTURE_UNAVAILABLE`, and the current rollover card offers
no repair because it gates Sync on year drift alone.

Make year alignment and persisted term authority separate, truthful states. Give
the scheduler one understandable repair path when the year is already aligned but
the ordered terms still need to be saved. Prepare a stable, narrowly scoped,
fingerprinted term-cache preview/apply contract for a later separately approved
HIGH action.

## Production paths to trace

- `GET /api/v1/runtime/rollover-status`
- `POST /api/v1/runtime/rollover-sync/preview`
- the new or narrowed term-authority preview/apply routes under `/api/v1/runtime`
- `enrollpro-rollover.service.ts`
- `enrollpro-term-contract.service.ts`
- `RolloverGuidanceCard.tsx` as rendered in AppShell and Year Setup
- canonical `buildDerivedDemand()` persisted-cache read and
  `GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic`

## Required outcomes

1. Rollover status shall report year drift and term authority independently.
   The term result must distinguish at least: persisted-current, missing,
   persisted-stale/different semantic revision, upstream unavailable, and invalid
   upstream contract. Do not overload year-drift `recommendedAction` to imply
   downstream readiness.
2. For an aligned active year with a missing persisted term snapshot, the API and
   UI shall say plainly that the school year is current but its ordered terms have
   not yet been saved in ATLAS. It shall never say that no setup action is needed.
   Also stop presenting `teachingLoadResetRequired` as global rollover truth: it
   is derived from the dummy-year reset preview. Namespace or qualify it so an
   aligned populated year is not falsely described as needing a Teaching Load
   reset merely because current-year rows exist.
3. The rollover card shall expose exactly one primary repair action for this
   state. The action first opens or presents a zero-write preview; it must not
   silently invoke the broad faculty/section rollover apply.
4. Implement a dedicated term-cache preview/apply contract, or an equivalently
   narrow contract proven to write only the active mirror's
   `termContractCache`/`termContractCachedAt` plus one scoped audit record. Do not
   rerun faculty sync, section sync, Teaching Load initialization, generation, or
   publication merely to catch up term authority.
5. Preview shall fetch and validate the exact EnrollPro ordered term contract,
   return its semantic revision and rows, bind school, active year, mirror
   identity/current cache state, and return a stable fingerprint plus exact
   confirmation text. Preview is zero-write.
6. Apply shall require privileged actor-school authority, exact confirmation and
   fingerprint, re-fetch/revalidate the live EnrollPro contract, and revalidate
   the active mirror/current cache state before its narrow transaction. Drift or
   scope mismatch shall fail with a typed 4xx and zero writes. Identical replay
   shall be idempotent and create no second audit row.
7. A reachable `ACTIVE_TERM_UNRESOLVED` state shall not invalidate the ordered
   term structure. The three ordered year-9 terms remain valid even when today's
   date belongs to no term.
8. After a disposable-fixture apply, canonical derived demand and the real
   generation diagnostic entry point shall move past `TERM_STRUCTURE_UNAVAILABLE`
   without any helper injection of a term contract. Remaining blockers must be
   preserved and reported honestly; do not claim generation readiness unless the
   diagnostic proves it.
9. The UI shall use one concise visual status, a short explanation, and one repair
   action; no duplicate rollover cards, raw fingerprint wall, or internal
   reconciliation jargon. Verify desktop `1366x768` and mobile `390x844` against
   the live Tailnet origin only after source is deployed; for this undeployed
   candidate, use a rendered isolated harness and label it
   `ISOLATED_LOCAL_BROWSER`, then defer live Tailnet proof to deployment.

## Failing-first / adversarial controls

- Aligned year + null cache: old status returns `NONE` and old card has no Sync;
  new contract reports missing term authority and one preview action.
- Aligned year with existing current-year Teaching Load rows: do not surface a
  reset requirement unless the typed dummy/test-data reset path is actually
  applicable.
- Cached semantic revision differs from live ordered structure while year IDs and
  term count match: report stale; count-only comparison must fail the test.
- Preview followed by upstream term reorder/rename: apply rejects stale
  fingerprint and writes nothing.
- Cross-school actor, inactive/archived year, malformed confirmation, and forged
  fingerprint: typed 4xx; zero cache/audit writes.
- Concurrent identical apply: one cache mutation and one audit; the other is an
  idempotent replay or typed serialization conflict with safe retry behavior.
- Active-term 409 with a valid ordered structure: preview remains valid and binds
  the ordered contract.
- Mutation instrumentation must fail if preview writes, if the catch-up path
  touches faculty/sections/Teaching Load, or if UI calls the broad rollover apply.

## Owned paths

- `atlas-server/src/services/enrollpro-rollover.service.ts`
- `atlas-server/src/services/enrollpro-term-contract.service.ts`
- `atlas-server/src/routes/runtime.router.ts`
- focused server tests under `atlas-server/src/__tests__/`
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx`
- focused client tests under `atlas-client/src/**/__tests__/`
- one concise executor handoff under `docs/handoffs/`

Touch another ATLAS path only when the production trace proves it is necessary;
list and justify it before editing. Companion repositories are READ_ONLY.

## Decisive gates

- focused rollover lifecycle/automation and term-contract suites
- new mounted-route disposable-PostgreSQL suite with exact cleanup and positive
  write instrumentation
- canonical derived-demand plus generation-diagnostic regression
- focused client state/render tests proving one action and no broad-apply call
- server/client `tsc --noEmit` and production builds
- built Node server startup with rollover automation disabled
- `git diff --check <base>...<candidate>` and clean worktree
- one fresh independent immutable-range QA after the committed candidate

## Handoff

Return the exact base and candidate SHAs, changed paths, trace-table outcome,
status/repair matrix, preview/apply/replay receipts from disposable fixtures,
zero-residue proof, decisive gate counts, remaining risks, and
`REVIEW_REQUIRED`. Explicitly state that no live term-cache sync was performed
and provide the future HIGH approval package only after QA accepts the source.

Suggested commit:

```text
fix(rollover): expose and repair missing persisted term authority
```
