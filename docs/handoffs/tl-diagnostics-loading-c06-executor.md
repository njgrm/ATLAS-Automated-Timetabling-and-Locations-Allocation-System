# TL-DIAGNOSTICS-LOADING-C06 — executor handoff

- Cycle: `WF-SEED-TERM-CACHE-TL-C06-20260916`, lane B (`TL-DIAGNOSTICS-LOADING-C06`)
- Role: EXECUTOR · Risk: MEDIUM (ordinary source/test correction) · Reasoning: high
- Worktree: `E:/ATLAS-worktrees/tl-diagnostics-loading-c06`
- Branch: `work/tl-diagnostics-loading-c06`
- Base SHA (immutable): `46d9499d8bc3993e522d7008ef7a08534ed2badb`
- Candidate: this commit (single bounded commit on the branch; no amend/rebase/push)
- Return: `REVIEW_REQUIRED`

## Objective

Remove the Teaching Load authority-diagnostics loading-state orphan ("Checking
source" forever) **without** weakening dispatch precedence, scope currency, or
actor-school/year protection.

## Defect (planner-traced, re-verified against source)

1. `loadAuthorityDiagnosticsForScope` called `setLoading(true)` unconditionally
   and cleared it only on the terminal path reached while the invocation was
   still current. The discard paths returned `'discarded'` without clearing.
2. `fetchData` engaged the diagnostics loader only under `if (isLatestDispatch())`
   and its `try/catch/finally` only ever cleared the MAIN workspace `loading`
   flag.
3. Therefore: an older dispatch set `authorityDiagnosticsLoading = true`; a newer
   dispatch superseded it but aborted **before** the diagnostics read (unresolved
   actor school or active year); the older reply was correctly discarded and no
   dispatch owned the clear.

Diagnosis confirmed; no correction to the planner's diagnosis was needed.

## Fix (smallest coherent ownership mechanism)

`atlas-client/src/hooks/useTeachingLoadData.ts`

- **New production primitive** `DiagnosticsLoadingOwnership` /
  `createDiagnosticsLoadingOwnership()` — the loading flag is a resource with
  exactly one owner (the dispatch id that set it). `claim(id)` /
  `release(id)` (refused unless `id` still owns) / `releaseAll()`.
- **New production terminal handoff** `terminateDiagnosticsLoadingForLatestDispatch()`
  — the newest dispatch terminates an inherited claim; a superseded invocation
  returns without touching a newer active claim.
- **Loader** now REQUIRES `loadingOwnership` + `loadingOwnerId`, claims on entry,
  and releases on **every** exit path (single `finally`), so a discarded
  superseded reply terminates its own in-flight read.
- **Hook** keeps one `diagnosticsLoadingOwnershipRef` per instance, passes
  `dispatchScope.dispatchId` at the call site, terminates an inherited claim in
  `fetchData`'s `finally`, and releases on scope reset and on unmount.
- Every C-6 / C-6R / C-6R2 guard is preserved verbatim: `createDispatchPrecedence`,
  `createFetchDispatchScope`, `openDiagnosticsScope`, the
  `isLatestDispatch() && isScopeCurrent(binding)` `isCurrent` predicate,
  precedence-before-scope-currency discard ordering, and the
  `scopeBindingIsCurrent()` guards at the catch/finally. No effective-load
  arithmetic, no ancillary-work policy, and no server file was touched.

`atlas-client/src/lib/__tests__/tl-authority-diagnostics-cold-load.test.ts`

- Extended with 8 C-6R3 real-lifecycle controls. The pre-existing 9 tests and all
  52 pre-existing assertions are preserved verbatim; the only deleted line in the
  whole file is the single-line import statement now expanded to a multi-line
  import. 10 existing loader call sites gained the two new REQUIRED deps.

## Trace table

| # | Requirement | Production path | Negative control | Verification command | Result |
|---|---|---|---|---|---|
| 1 | Loading ownership is dispatch-scoped | `createDiagnosticsLoadingOwnership` + loader claim/release on every exit | mutant `if (isCurrent() && release(...))` (release only when current) | `npx tsx --test src/lib/__tests__/tl-authority-diagnostics-cold-load.test.ts` | PASS |
| 2 | Stale dispatch cannot clear a newer active claim | loader `finally` `if (release(loadingOwnerId)) setLoading(false)` | "an older completion cannot clear a newer active request loading" (ownership stays `d2`, commits `[true,true]`) | same suite | PASS |
| 3 | Newest dispatch that aborts before request binding terminates/transfers ownership | `terminateDiagnosticsLoadingForLatestDispatch` in `fetchData` `finally` + loader release-on-discard | C-6R3 defect control; base failing-first probe | same suite + base probe (below) | PASS |
| 4 | Newest success and newest typed failure clear exactly once | single claim + single `finally` release | commit-trace assertions `[true,false]` for success and for `'cleared'` failure | same suite | PASS |
| 5 | Same-scope and cross-scope supersession stay fail-closed | precedence + `isScopeCurrent` unchanged | C-6R2 same-scope + C-6R3 cross-scope controls | same suite, `tl-dispatch-precedence-overlap` 8/8 | PASS |
| 6 | Stale replies cannot update payload/errors/readiness/loading | loader discard ordering (precedence before scope currency) | C-6R3 cross-scope replacement (obsolete reply commits nothing; `rev-B` survives) | same suite | PASS |
| 7 | Scope reset / logout / unmount leave no orphan | scope-reset effect + unmount effect `releaseAll()` | "scope reset and unmount terminate the outstanding claim" (idempotent, no spurious clear) | same suite | PASS |
| 8 | Preserve ALL C-6 / C-6R / C-6R2 guards | guards unchanged in source | existing precedence/scope/epoch suites | `tl-dispatch-precedence-overlap` 8/8, `tl-scope-epoch-sibling-feeds` 7/7, `tl-operator-workspace-c05` 35/35, `-r3-truth` 16/16 | PASS |
| 9 | Ancillary-work policy / effective-load arithmetic unchanged | no arithmetic file touched | parity + canonical workload suites | `teaching-load-effective-load-parity` 5/5, `teaching-load-canonical-workload` 33/33 | PASS |
| 10 | < 1000 physical lines + strict conventions | hook is 933 lines | whole-file line count | `(Get-Content ...).Count` = 933 | PASS |

Rows 1–10 all PASS. No row is BLOCKED or DEFERRED for source; the only
environment limitation is recorded under risks.

## Gates (exact commands and observed results)

1. **Failing-first on base (stash-free).** Base hook materialized from
   `46d9499d:atlas-client/src/hooks/useTeachingLoadData.ts` (blob `551a208b6d75a826dbf3f8ea817986ea1a50012d`, sha256 `6E9B5856…`).
   - Extended suite against base:
     `SyntaxError: The requested module '@/hooks/useTeachingLoadData' does not provide an export named 'createDiagnosticsLoadingOwnership'` → `tests 1 / pass 0 / fail 1`, exit 1.
   - Canonical failing-first probe (asserts the DESIRED behaviour, API-compatible
     with both revisions) against base:
     `AssertionError [ERR_ASSERTION]: the loading flag must not stay orphaned after the discard  —  true !== false`, exit 1.
   - Same probe against the candidate: `tests 1 / pass 1 / fail 0`, exit 0.
     (Probe was a temporary untracked file; deleted before commit; `git status` clean of it.)
2. **Focused affected suites** (`npx tsx --test <file>`, from `atlas-client`):
   `tl-dispatch-precedence-overlap` 8/8 · `tl-authority-diagnostics-cold-load` 17/17 ·
   `tl-scope-epoch-sibling-feeds` 7/7 · `teaching-load-effective-load-parity` 5/5 ·
   `teaching-load-canonical-workload` 33/33 — all fail 0, exit 0.
3. **Full new control suite:** `tl-authority-diagnostics-cold-load` 17 tests /
   17 pass / 0 fail, exit 0 (9 pre-existing + 8 new C-6R3 controls covering all
   ten required lifecycle controls).
4. **Mutant control.** Mutated the `finally` to the pre-fix discard behaviour
   (`if (isCurrent() && loadingOwnership.release(loadingOwnerId)) setLoading(false);`):
   `tl-authority-diagnostics-cold-load` → `tests 17 / pass 15 / fail 2`, exit 1.
   Failing: `C-6R3 the discarded older reply releases its own claim when the newest
   never reaches the loader` (`the discarded reply drops its own claim`) and the
   hook-wiring assertion for the `finally` release. Restored from the byte backup:
   sha256 `D9E2DD764CE8CCD5EFB8636B7F53EC2F2526DA004D57A287DBBC61A2C0F0B1D1` (identical to pre-mutation), mutant marker absent, `git status --short` shows only the two intended files, and the suite is green again.
5. `npx tsc --noEmit` (from `atlas-client`) — exit 0.
6. `npm run build` (from `atlas-client`) — `✓ built in 25.40s`, exit 0.
7. `git diff --check` — clean (exit 0).
8. Exact changed-path attribution after commit: `git diff --name-only <base>...HEAD` lists
   only the three owned paths (hook, cold-load suite, this handoff).
9. **Assertion delta:** cold-load suite `assert.` calls 52 → 108, `test(` declarations
   9 → 17; the single deleted line in the whole test diff is the import statement
   (`-import { createDispatchPrecedence } from '@/hooks/useTeachingLoadData';`).
   **No existing assertion was removed or weakened.**

Server gates were not run: no server file was touched.

## Known risks and residual observations

- `NON_BLOCKING (environment)`: `atlas-client` has no DOM/test-renderer dependency
  (deps frozen; `package.json` has no jsdom/happy-dom/@testing-library/
  react-test-renderer) and the hook needs `useSearchParams`. The C-6R3 controls
  therefore execute the **production loader and the production ownership
  primitives** directly — the same seam `fetchData` uses — plus source-shape
  assertions for the hook wiring. This is the same documented harness limitation
  already recorded in the pre-existing C-5 cold-load suite. No browser/real-DOM
  claim is made.
- `NON_BLOCKING (UX truthfulness)`: the scope-reset release is unconditional and
  can clear a just-claimed new-scope loading flag. The truth panel ORs
  `data.loading || data.authorityDiagnosticsLoading` (`TeachingLoad.tsx:684`), so
  the loading affordance is preserved for the whole scope-change fetch and the
  terminal flag state is correct.
- `NON_BLOCKING (environment)`: this worktree had no dependency tree. A
  `node_modules` junction was created for `atlas-client` pointing at
  `D:\ATLAS\atlas-client\node_modules`, reused read-only after verifying the
  `atlas-client/package-lock.json` sha256 `CE1AE84ED088BE75F27542CB039ABF338395ECE1C9E9A5D2139C2C65CF3B9F1E`
  is identical in both checkouts. No install/update was run and nothing was
  installed through the junction.

## Mutation statement

No machine registry, generated register, historical prose register, `CHANGELOG.md`,
receipt, runtime source-of-truth map, `.opencode/**`, `atlas-server/**`, `ops/**`,
or `.wf-specs/**` file was touched. No worktree was created, moved, or retired.
No merge, rebase, reset, stash, amend, or push was performed. No packages were
installed. No API call, login, database, runtime, generation, or publication
action occurred.

## Commit message suggestion

```
fix(teaching-load): make authority-diagnostics loading ownership dispatch-scoped
```
