# TL-UX-C01R2 — Executor Handoff (EXTERNAL_QA_BUNDLE)

## Status

`REVIEW_REQUIRED` — not GO. QA role is read-only and must not merge or push.

## Immutable Git identity

- Worktree: `D:/ATLAS-worktrees/teaching-load-ux-c01r2`
- Branch: `work/teaching-load-ux-c01r2`
- Base SHA: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6` (origin/main)
- Candidate SHA: the single commit that adds this handoff (see `git log -1` on the branch); range reviewed is `base...candidate`.
- Worktree was clean at base and contains only the changed paths below.

## Governing prompt

`docs/prompts/teaching-load-ux-suggestion-authority-correction-tluxc01r2-2026-09-11.md` (F1, F2, F3).

## Exact changed paths

- `atlas-server/src/services/teaching-load-suggestion-proposal.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/workload-policy.service.ts`
- `atlas-server/src/__tests__/teaching-load-suggestion-authority.test.ts` (new)
- `atlas-server/src/__tests__/teaching-load-distribution-plan.test.ts`
- `atlas-server/src/__tests__/teaching-load-write-authority.test.ts`
- `docs/progress/teaching-load-ux-c01r2-2026-09-11-progress.md`
- `docs/handoffs/tl-ux-c01r2-executor.md`

No schema/migration, client source, term/demand/generation/publication, or companion-repo changes.

## What changed

### F1 — unreviewed distribution moves cannot be applied
`applyTeachingLoadSuggestionProposal` now requires BOTH the stored (reviewed) preview and the refreshed preview to carry a complete, evaluated distribution contract whose summary reports `distributionEvaluated === true` and whose `policy` binding is finite. Missing, malformed, unevaluated, or asymmetric contracts throw `409 TEACHING_LOAD_PROPOSAL_STALE` before any insert or move. The plan signature binds subject, section, faculty-subject identity, minutes, receiver qualification tier/authority, the effective policy revision, and deterministic ordering (plus every insert), not only `ownershipId/from/to`.

### F2 — preview/apply cap semantics match the persisted effective policy
- New `getEffectiveWorkloadPolicyFromClient(client, schoolId, schoolYearId)` resolves the persisted policy through a supplied client; `getEffectiveWorkloadPolicy` delegates to it.
- `previewOrApplyOverCapRebalance` resolves the effective policy and reports it (`policy`, `evaluated`); overload/above-standard is measured from actual teaching minutes under the effective teaching standard, hard-cap breaches from actual teaching minutes under the effective hard cap, and receiver capacity is `min(maxHours*60, effective standard)`. Advisory/ancillary credit is neutral: it never creates an overload and never reduces receiver capacity.
- The apply path no longer imports `WORKLOAD_DEFAULTS.teachingStandardMinutes`; it resolves the effective policy inside the Serializable transaction and binds the plan to `policy.revision` (via `workloadPolicyRevision`). Unconfigured/changed policy → `TEACHING_LOAD_PROPOSAL_STALE`, zero writes.

### F3 — full in-transaction revalidation
Inside the existing Serializable transaction, using only the transaction client, the reviewed plan is revalidated before writes:
- effective policy via `getEffectiveWorkloadPolicyFromClient(tx, ...)` and revision equality;
- exact ownership identity (`facultyId`, `subjectId`, `sectionId`, `facultySubjectId`);
- receiver activity + qualification tier/authority via the shared `resolveTeachingLoadQualification` (department, alias, specialization, special-program authority);
- current subject scheduling metadata/minutes (stale `move.minutes` never trusted);
- resulting receiver capacity from actual teaching minutes.
Any mismatch throws `TEACHING_LOAD_PROPOSAL_STALE`; the transaction writes nothing. No silent retry changes the reviewed plan.

Deterministic ordering added to the evaluator (`orderBy` on ownerships, explicit tie-breaks) so stored and refreshed signatures are stable.

## Decisive evidence

| Gate | Command | Result |
|------|---------|--------|
| New authority suite | `npx tsx src/__tests__/teaching-load-suggestion-authority.test.ts` | 61 passed, 0 failed; fixture cleaned with zero residue |
| Distribution plan suite | `npx tsx src/__tests__/teaching-load-distribution-plan.test.ts` | 13 passed, 0 failed |
| Write-authority suite | `npx tsx src/__tests__/teaching-load-write-authority.test.ts` | PASS |
| Effective workload policy | `npx tsx src/__tests__/teaching-load-effective-workload-policy.test.ts` | 56 passed, 0 failed |
| Generation passive guards | `npx tsx src/__tests__/generation-passive-teaching-load.test.ts` | PASS |
| Reconciliation route | `npx tsx src/__tests__/teaching-load-reconciliation-route.test.ts` | 54 passed, 0 failed |
| Summary zero-write route | `npx tsx src/__tests__/teaching-load-summary-zero-write-route.test.ts` | 12 passed, 0 failed |
| Reconciliation fixture | `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` | 168 passed, 0 failed |
| Server typecheck | `npx tsc --noEmit` (atlas-server) | clean |
| Client typecheck | `npx tsc --noEmit` (atlas-client) | clean |
| Server build | `npm run build` (atlas-server) | exit 0 |
| Client build | `npm run build` (atlas-client) | exit 0, built |
| Built-module import proof | `node --input-type=module -e "await import('./dist/services/teaching-load-suggestion-proposal.service.js') …"` | `BUILT IMPORT OK` |
| Client UX guardrails | `npx tsx --test ux-guardrails public-schedule-grade useTeachingLoadRouteIntent` | 21 passed, 0 failed |
| Client distribution/ownership/canonical/reconciliation UI | `npx tsx --test …` | 51 passed, 0 failed |
| Whitespace | `git diff --check` | clean |

### Suite coverage (9 required cases)
B2 rolled-back positive control (write detector + zero residue); B3 advisory neutrality for overload and receiver capacity; B4 determinism + never-falsely-balanced; B5 legacy contract rejection; B6 missing/unevaluated refreshed contract; B7 policy change and policy removal (no default fallback); B8 receiver department/authority change; B9 subject-minutes change; B10 concurrent ownership change with zero partial writes; B11 valid unchanged plan applies atomically through the mounted route; B12 idempotent replay with zero additional writes.

## Remaining risks (classified)

- NON_BLOCKING: `autoFill` coverage still models every subject as demanded by every section (pre-existing demand modeling outside this prompt's boundary), so a reviewed plan may contain multiple coverage inserts. They are bound by the plan signature, applied atomically, and rolled back on any move mismatch. Not changed by this correction.
- NON_BLOCKING: the PostgreSQL-backed suite is local-probe evidence against the configured local database; no live Tailnet runtime write was performed (explicitly out of scope).
- No BLOCKING findings.

## Boundaries honored

No merge, push, deploy, migration, live Teaching Load mutation, generation, publication, rollover, runtime restart, port-5001 action, or companion-system edit. EnrollPro/AIMS/SMART untouched.

## Next action for planner/QA

Fresh independent QA of `base...candidate` (EXTERNAL_QA_BUNDLE): confirm the F1 completeness/signature gate runs before writes, the F2 tx policy binding and teaching-minute semantics, and the F3 in-transaction revalidation; independently rerun the new suite and the distribution-plan suite. Then return to the primary planner for integration decision.
