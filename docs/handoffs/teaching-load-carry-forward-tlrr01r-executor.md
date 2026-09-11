# TL-RR01R Executor Handoff — Teaching Load Carry-Forward Correction

- Stream: `TL-RR01R`
- Branch: `work/teaching-load-carry-forward-tlrr01r`
- Base SHA: `95ceedf9e3633e431a50990e988339987529e40e` (`origin/main`)
- Candidate SHA: the branch tip of `work/teaching-load-carry-forward-tlrr01r`; the
  immutable review range is `95ceedf9...<branch-tip>` (a handoff committed inside
  its own candidate cannot name its own SHA — the planner records the exact tip).
- Verdict: `REVIEW_REQUIRED`
- Live apply performed: **NO**

## Scope delivered

Correction of the integrated TL-RR01 carry-forward workflow. Additive commits on
top of `origin/main`; no integrated commit was reverted or rewritten.

1. **Grade authority** now comes from `SectionMirror.gradeLevelId` through the
   established `normalizeGradeLevelSync` EnrollPro normalization.
   `displayOrder` is never used as grade truth (source and target snapshots plus
   both revision payloads bind the resolved grade).
2. **Unconfigured workload policy fails closed.** Preview returns a typed `409
   WORKLOAD_POLICY_UNCONFIGURED` before any write; apply revalidates the policy
   inside the existing Serializable transaction before drift/plan checks; the plan
   builder refuses to substitute an infinite hard cap.
3. **Strict positive authenticated `userId`** is required before the apply service
   is invoked. Missing, zero, negative, fractional, or wrong-type ids return a
   typed `403 ACTOR_USER_REQUIRED` and perform zero reads/writes (router checks
   before body parsing; the service re-checks before opening its transaction).
4. **Playwright spec is durable** (`git add -f`) and the TL-RR01 handoff's
   self-referential `PENDING_COMMIT` wording is corrected.
5. Fill-empty-only, archived-source immutability, fingerprint/revision checks,
   concurrency handling, replay, and the client's preview-only boundary are
   preserved.

## Changed paths (correction commit)

```
atlas-server/src/services/teaching-load-carry-forward.service.ts
atlas-server/src/routes/teaching-load-carry-forward.router.ts
atlas-server/src/__tests__/teaching-load-carry-forward-authority.test.ts
atlas-server/src/__tests__/teaching-load-carry-forward-postgres.test.ts
qa-artifacts/playwright/specs/teaching-load-carry-forward.spec.ts   (force-added)
docs/handoffs/teaching-load-carry-forward-tlrr01-executor.md
docs/handoffs/teaching-load-carry-forward-tlrr01r-executor.md       (new)
docs/progress/teaching-load-rollover-carry-forward-tlrr01r-2026-09-11-progress.md (new)
CHANGELOG.md
docs/reference/atlas-runtime-source-of-truth-map.md
```

## Preview / apply call path

- Preview: `POST /api/v1/teaching-load/carry-forward/preview` → `previewTeachingLoadCarryForward`
- Apply (implemented, not invoked): `POST /api/v1/teaching-load/carry-forward/apply` → `applyTeachingLoadCarryForward`

## Review focus

1. Grades resolve from `gradeLevelId`; prove the displayOrder mutants fail first.
2. Unconfigured policy is a typed blocker in preview and inside the apply transaction.
3. Bad actor ids are rejected with zero reads/writes.
4. No regression to fill-empty-only, immutability, fingerprint, concurrency, replay.
