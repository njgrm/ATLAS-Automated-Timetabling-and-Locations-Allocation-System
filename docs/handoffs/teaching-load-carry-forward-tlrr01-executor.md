# TL-RR01 Executor Handoff — Teaching Load Carry-Forward

- Stream: `TL-RR01`
- Branch: `work/teaching-load-carry-forward-tlrr01`
- Base SHA: `89440321260a9c4902cc20b7c5a642f47a74e35f` (`origin/main`)
- Candidate SHA: `PENDING_COMMIT`
- Verdict: `REVIEW_REQUIRED`
- Live apply performed: **NO**

## Scope delivered

A complete, optional, audited carry-forward workflow: read-only preview UX in
Year Setup, a zero-write preview endpoint, and an implemented-but-not-invoked
privileged apply endpoint that is transaction-safe. Archived Teaching Load
remains immutable. No deployment, generation, publication, migration, or live
data apply occurred.

## Changed paths

```
atlas-server/src/services/teaching-load-carry-forward.service.ts     (new)
atlas-server/src/routes/teaching-load-carry-forward.router.ts        (new)
atlas-server/src/app.ts                                              (mount)
atlas-server/src/__tests__/teaching-load-carry-forward-authority.test.ts   (new)
atlas-server/src/__tests__/teaching-load-carry-forward-postgres.test.ts    (new)
atlas-client/src/lib/teaching-load-carry-forward-helpers.ts          (new)
atlas-client/src/lib/__tests__/teaching-load-carry-forward-helpers.test.ts (new)
atlas-client/src/components/runtime/CarryForwardReviewPanel.tsx      (new)
atlas-client/src/pages/AdminYearSetup.tsx                            (wire panel)
atlas-client/src/lib/faculty-assignment-helpers.ts                   (guidance copy)
qa-artifacts/playwright/specs/teaching-load-carry-forward.spec.ts    (new)
playwright.carry-forward.config.ts                                    (new)
package.json                                                          (script)
docs/progress/teaching-load-rollover-carry-forward-tlrr01-2026-09-11-progress.md (new)
docs/handoffs/teaching-load-carry-forward-tlrr01-executor.md         (new)
CHANGELOG.md
docs/reference/atlas-runtime-source-of-truth-map.md
```

## Preview / apply call path

- Preview: `POST /api/v1/teaching-load/carry-forward/preview`
  - body: `{ schoolId, targetSchoolYearId, sourceSchoolYearId }` (strict; unknown fields 400)
  - auth: `authenticate` (JWT) + `requirePrivilegedRole`; actor school must match
  - service: `previewTeachingLoadCarryForward()`
- Apply (implemented, not invoked): `POST /api/v1/teaching-load/carry-forward/apply`
  - body adds `expectedFingerprint`, `expectedSourceRevision`,
    `expectedTargetRevision`, `confirmationText`
  - service: `applyTeachingLoadCarryForward()`

## Invariants

- Source reads immutable; faculty matched by `FacultyMirror.externalId`; sections
  by canonical `grade + program + normalized name`.
- Demand authority is `DERIVED_DEMAND_V2`; reference-only/obsolete pairs excluded.
- Fill-empty-only; occupied target pairs preserved.
- Qualified/active/hard-cap re-resolved on current data; advisory credit neutral.
- Apply writes only empty target projections, refreshes the cycle once, writes
  exactly one audit, is idempotent on replay, aborts atomically on drift.

## Decisive checks

- Hermetic + mutant: 8/8 (`teaching-load-carry-forward-authority.test.ts`).
- Disposable PostgreSQL + mounted route: 60/60
  (`teaching-load-carry-forward-postgres.test.ts`) — exact carry, renamed/re-ID
  section, inactive/stale faculty, unqualified, cap blocked, occupied target,
  duplicate canonical matches, source immutability, stale revision, concurrent
  apply, replay, audit/cycle cardinality, rollback identities, zero residue.
- Client decision helpers: 11/11.
- Isolated Playwright: 5/5 at 1280x720 and 390x844 (source selection,
  preview/reason review, cancel, error, empty, partial target, no-live-apply).
- Server `tsc` + build + runtime health 200 with the built server alive.
- Client `tsc` + `vite build`.
- Existing TL/archived-history suites pass except the pre-existing
  `teaching-load-reconciliation-route.test.ts` failure reproduced unchanged on
  the clean base.

## Review focus

1. Confirm the preview is zero-write and the apply is never reachable from the
   client.
2. Confirm fill-empty-only and the typed reason ordering in
   `classifyCarryForwardRow`.
3. Confirm the Serializable apply revalidates source/target revisions and
   fingerprint, and that replay performs zero writes.
4. Confirm no archived source row or non-carry target pair is mutated.

## Coordination

- No live apply, generation, publication, migration, or deployment performed.
- Formal independent review is requested. After acceptance, the planner owns
  integration; deployment and explicit year-9 term sync remain separate.
