# TL-UX-C01R2 — Suggestion Apply Authority Correction (progress ledger)

- Authoritative prompt: `docs/prompts/teaching-load-ux-suggestion-authority-correction-tluxc01r2-2026-09-11.md`
- Worktree: `D:/ATLAS-worktrees/teaching-load-ux-c01r2`
- Branch: `work/teaching-load-ux-c01r2`
- Base SHA: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6` (origin/main)
- Risk: MEDIUM source with HIGH interaction guardrails; no live Teaching Load mutation.
- State: `REVIEW_REQUIRED` (EXTERNAL_QA_BUNDLE enabled).

## Task status

| Task | Status | Evidence |
|------|--------|----------|
| F1 complete/evaluated distribution contract on both stored + refreshed previews | DONE | `isCompleteEvaluatedDistribution`, `distributionPlanSignature`; B5/B6 stale cases |
| F2 effective persisted policy via tx client; actual teaching minutes for overload/capacity | DONE | `getEffectiveWorkloadPolicyFromClient`, evaluator teaching-minute overload, tx policy binding; B3/B7 |
| F3 full in-transaction plan revalidation | DONE | `applyTeachingLoadSuggestionProposal` tx move loop; B8/B9/B10 |
| Failing-first PostgreSQL-backed suite | DONE | `atlas-server/src/__tests__/teaching-load-suggestion-authority.test.ts` (61 passed, 0 failed) |
| Focused gates | DONE | see handoff evidence table |
| Executor handoff + commit | DONE | this ledger + `docs/handoffs/tl-ux-c01r2-executor.md` |

## Changed paths

- `atlas-server/src/services/teaching-load-suggestion-proposal.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/workload-policy.service.ts`
- `atlas-server/src/__tests__/teaching-load-suggestion-authority.test.ts` (new)
- `atlas-server/src/__tests__/teaching-load-distribution-plan.test.ts`
- `atlas-server/src/__tests__/teaching-load-write-authority.test.ts`
- `docs/handoffs/tl-ux-c01r2-executor.md`

## Decisions

- Stored and refreshed plans must BOTH be complete, evaluated, policy-bound contracts before any insert/move; missing/malformed/unevaluated/asymmetric → `409 TEACHING_LOAD_PROPOSAL_STALE`, zero writes.
- The plan signature binds `ownershipId`, `facultySubjectId`, `subjectId`, `sectionId`, `fromFacultyId`, `toFacultyId`, `minutes`, `toQualificationTier`, `toQualificationAuthority`, the policy revision, and inserts.
- Inserts and moves applied are the reviewed plan's structured actions (from `distribution.inserts` / `distribution.moves`), never re-derived from the recomputed preview.
- Overload/above-standard and receiver capacity use actual teaching minutes under the effective persisted standard/hard cap; advisory/ancillary credit is neutral.
- The apply resolves the effective policy through the transaction client and rejects on unconfigured/changed policy with no default fallback.
- Deterministic ordering added to the rebalance evaluator (`orderBy id`, tie-breaks) so preview/apply signatures are stable.

## Remaining risks (for QA)

- NON_BLOCKING: `autoFill` coverage still treats every subject as demanded by every section (pre-existing demand modeling outside this prompt's boundary), so a plan can contain multiple coverage inserts. Verified atomic and reviewed-bound; not changed.
- NON_BLOCKING: DB-backed suite is local-probe evidence against the configured local PostgreSQL target; no live Tailnet runtime write was performed (out of scope).
- BLOCKING-free: no unresolved findings.
