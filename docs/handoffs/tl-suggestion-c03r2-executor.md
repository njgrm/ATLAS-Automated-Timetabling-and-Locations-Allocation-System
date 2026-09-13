# TL-SUGGESTION-C03R2 — executor handoff

Status: `REVIEW_REQUIRED`

- Worktree: `D:\ATLAS-worktrees\tl-suggestion-c03r2`
- Branch: `work/tl-suggestion-c03r2`
- Base: `e0a10ebcd8efa0d4fa248b2c5948ed53a6c33c54` (current `origin/main`)
- Governing prompt: `docs/prompts/teaching-load-suggestion-derived-demand-c03r2-2026-09-13.md`

## Objective

Make canonical `buildDerivedDemand` the sole current-year pair authority for
Teaching Load suggestions, staffing need, over-cap move targets, and reviewed
proposal fingerprinting / apply-time revalidation; fail closed when ordered-term
or canonical authority is missing or changed.

## Changed paths

- `atlas-server/src/services/teaching-load-automation.service.ts` (canonical pair authority)
- `atlas-server/src/services/teaching-load-suggestion-proposal.service.ts` (tx-client revision binding)
- `atlas-server/src/__tests__/teaching-load-suggestion-derived-demand-c03r2.test.ts` (new)
- `atlas-server/src/__tests__/teaching-load-suggestion-authority-c03.test.ts` (additive fixture)
- `atlas-server/src/__tests__/teaching-load-suggestion-apply-parity.test.ts` (additive fixture/dependency)
- `atlas-server/src/__tests__/teaching-load-write-authority.test.ts` (additive fixture/dependency)
- `docs/handoffs/tl-suggestion-c03r2-executor.md` (this handoff)

## Trace table

| Requirement | Production path | Negative control | Verification command | Status |
|---|---|---|---|---|
| Suggestions consume canonical derived demand, not a Cartesian subject x section product | `autoFill` work queue built from `deriveCanonicalDemand`/`buildDerivedDemand` pairs | grade-8-scoped subject + grade-7 section forms no pair; widening scope exposes it | `npx tsx src/__tests__/teaching-load-suggestion-derived-demand-c03r2.test.ts` | PASS |
| Only `SCHEDULED_TEACHING` demand; REFERENCE_ONLY creates no suggestion/staffing/move | `buildDerivedDemand` disposition filter + HG/ARAL code guard + over-cap REFERENCE_ONLY exclusion | reference-only `ROBOTICS` excluded; flipping disposition exposes hidden pairs | new C03R2 suite controls A | PASS |
| Respect ordered-term rotation without tripling/splitting | `deriveCanonicalDemand` rotation lanes | 1 ALL + 3 rotating members = 4 pairs / 6 lines; each member one term | new C03R2 suite control C | PASS |
| Carry revision/pair set into proposal; re-resolve in apply tx | `autoFill` result fields + `applyTeachingLoadSuggestionProposal` tx `resolveDerivedDemand` | tx-client disposition/scope/minutes/section/term change → `TEACHING_LOAD_PROPOSAL_STALE` | new C03R2 suite controls F/G/I | PASS |
| Fail closed on missing/stale/zero-active/ambiguous authority | `resolveSuggestionDerivedDemand` typed 409 | missing term cache and ambiguous active year | new C03R2 suite control E | PASS |
| Ownership outside canonical demand diagnosed and excluded | `outsideDemandOwnershipCount` + `canonicalOwnershipRows` capacity/minute filter | legacy reference-only ownership | new C03R2 suite control A | PASS |
| No global read/cache mutation escapes the supplied/tx client; preview zero-write | bound `buildDerivedDemand({ client })`; tx re-resolution | in-memory client throws on writes; tx view differs from global | new C03R2 suite controls A/G | PASS |
| Preserve qualification/caps/adviser/cross-dept/zero-load visibility | unchanged evaluator + new canonical pair source | zero-load FIL/ESP accepted | C03 64/64 + new C03R2 control D | PASS |
| Reviewed suites stay green | — | — | C03 64/64; parity 34/34; distribution 13/13; workload policy 56/56; write-authority PASS | PASS |

## Decisive evidence

- New C03R2 suite: 74/74 (hermetic + one disposable `atlas_restore_drill_*` PostgreSQL fixture).
- Preserved C03 authority: 64/64. C03R apply parity: 34/34. Distribution: 13/13. Workload policy: 56/56. Write authority: PASS. `generation-passive-teaching-load`: PASS.
- Derived demand: `derived-demand-authority` 10/10; `derived-demand-correction-c01r` 10/10; `derived-demand-correction-c01r2` 7/7 (incl. disposable PostgreSQL).
- Server `tsc --noEmit` and production build: exit 0. Client `tsc --noEmit` and `vite build`: exit 0.
- Built-server smoke (isolated port 5392, `ROLLOVER_AUTO_SYNC_ENABLED=false`): `/api/v1/health` 200; `/api/v1/faculty-assignments/report/staffing-needs` unauthenticated 401. No shared 5001/5174 runtime touched.
- `git diff --check`: clean.
- Disposable PostgreSQL stale matrix: schedulingDisposition, program scope, weekly minutes, grade scope, section scope, and ordered-term structure each return `TEACHING_LOAD_PROPOSAL_STALE` with byte-identical ownership/FacultySubject/audit tables.

## Mutant proofs

- Canonical pair filter: a REFERENCE_ONLY subject predicted by the old Cartesian construction produces zero rows; flipping it to SCHEDULED_TEACHING reintroduces the pairs (filter is load-bearing).
- Derived-demand revision binding: changing disposition/program/grade/minutes/section/term between preview and apply is rejected as stale; an unchanged control applies.
- Transaction-client revalidation: the tx view flips a subject to REFERENCE_ONLY while the global client does not; the apply is rejected as stale (a global-client read would have proceeded).

## Known risks / residuals

1. The reviewed C03 authority and C03R apply-parity suites required additive fixture updates (term snapshot, internal grade key, pinned derived authority) because canonical demand is now mandatory. Assertion counts and semantics are unchanged (64/64, 34/34).
2. `teaching-load-write-authority.test.ts` also required additive fixture/dependency updates; all its assertions remain.
3. Two DB-backed suites (`teaching-load-suggestion-authority.test.ts`, `teaching-load-reconciliation.test.ts` Part B) use the configured database fixture pattern and were NOT run under this packet's "never write the configured database" rule. The reconciliation hermetic A1–A14 controls pass; its Part B fixture failures are in a service graph untouched by this candidate (`teaching-load-reconciliation.service.ts` does not import the changed automation/proposal services).
4. `isProgramScopeCompatible` was removed from the automation service because its only caller was the deleted Cartesian construction; the equivalent canonical scope check lives in `derived-demand.service.ts` / `qualification-evaluator.service.ts`.

## Mutation boundary

Source and focused tests only. No push, merge, rebase, amend, migration, live
database write, generation, publication, deployment, login, or shared-runtime
action was performed.
