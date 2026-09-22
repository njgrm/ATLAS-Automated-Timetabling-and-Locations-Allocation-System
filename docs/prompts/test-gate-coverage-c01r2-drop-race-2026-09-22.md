# TEST-GATE-COVERAGE-C01R2 — fix the disposable-database drop race behind the DB-gate flake

**Status:** `PREPARED`. **Risk:** LOW (test-only; no product source).
**Owner:** Lane A. **Worktree:** `E:/ATLAS-worktrees/test-gate-c01r2`, branch `work/test-gate-c01r2`.

## 0. Root cause — found, not guessed

The `test:server-db` flake is **not** flaky assertions. From the captured failing run
(`c01r-db4.txt`, full gate, 51 pass / 2 fail):

```
AssertionError [ERR_ASSERTION]: the disposable database must be dropped (zero residue)
    at src/__tests__/term-cache-catchup-rrtc01.test.ts:465
```

The teardown in these suites is:

```ts
if (disposableCreated) {
  try { psql([... `DROP DATABASE ${disposableName} WITH (FORCE)`]); } catch {}
  assert.equal(psql([... `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`]),
    '0', 'the disposable database must be dropped (zero residue)');
}
```

**The drop is attempted once, its failure is swallowed, and the zero-residue assertion then fails** —
so the file exits 1 with every real assertion passing. Dropping a database immediately after a
suite's server/Prisma client closes is a race; when it loses, the whole file is reported red.

The same race hit the **runner's** own per-file drop in an earlier run
(`curriculum-decision-candidates.test.ts` → `DROP-FAILED`), which is already fixed with a bounded
retry (`atlas-server/scripts/run-db-suite.mjs`, `dropDb`).

**Seven suites share the vulnerable pattern** (all of them also assert zero residue):

```
src/__tests__/generation-authority-realism-c07-availability.test.ts
src/__tests__/generation-readiness-disposable-genc02r.test.ts
src/__tests__/runtime-router-actor-scope.test.ts
src/__tests__/teaching-load-suggestion-derived-demand-c03r2.test.ts
src/__tests__/term-cache-catchup-rrtc01.test.ts
src/__tests__/timetable-sync-setup.test.ts
src/__tests__/uxc01r-derived-demand-route.test.ts
```

Since the C01R drop-retry fix and the removal of accumulated stray databases, the gate has run
**5 consecutive times green (53 pass / 0 fail / 0 skipped, exit 0)** — consistent with this cause,
but the underlying race is still latent in all seven teardowns and must be fixed, not left to luck.

## 1. Deliverables

**D1 — make the teardown drop robust, in one place.** Add a shared test helper (e.g.
`atlas-server/src/__tests__/helpers/drop-disposable-database.ts`) that drops a named database with a
**bounded retry and a short delay between attempts** and returns whether it is gone. Use it in all
**seven** suites above, replacing the single-attempt `try { … } catch {}` drop. Keep each suite's
final zero-residue assertion exactly as it is — residue must still fail; only the *race* is removed.

**D2 — do not mask residue.** If the retries are exhausted the suite must still fail loudly with the
same message. Do not weaken, delete, or `catch`-and-continue past the assertion, and do not widen the
check to "eventually ignore".

**D3 — prove the fix discriminates (failing-first).** Demonstrate with literal output that:
1. the old single-attempt teardown fails when the drop's first attempt does not succeed, and
2. the new helper succeeds under the same condition,
3. and a genuinely stuck database still fails the assertion.
If you cannot reproduce the race on demand, simulate the first-attempt failure deterministically
(e.g. a test-local seam or a forced first-attempt error) — say exactly how you did it.

**D4 — stability evidence.** Run `npm run test:server-db` **three consecutive times** on the
disposable database and paste the three tallies; all three must be `53 pass, 0 fail, 0 skipped`,
exit 0.

## 2. Boundaries — do not break

- **Writable:** the seven suites listed in §0, the new helper, and nothing else.
- **No product source**, no `atlas-client/**`, no `docs/**`, `CHANGELOG.md`, or companion repo.
- Do not touch `atlas-server/package.json` or `scripts/run-db-suite.mjs` (already fixed in C01R)
  unless a change is strictly required — say why if it is.
- Never point `DATABASE_URL` at `atlas_recovery_clean_rebuild_20260905`, and never drop a database
  that is not prefixed `atlas_restore_drill_`.

## 3. Running the gate

The runner needs a disposable base connection:
```
$env:DATABASE_URL = (Get-Content "$env:TEMP\atlas-disposable-db.url" -Raw).Trim()
$env:JWT_SECRET = '<test secret>'; $env:ATLAS_SYSTEM_TOKEN = '<test token>'
npm run test:server-db
```

## 4. Gates (run and paste literal results)

1. `npm run test:server-db` ×3 — all three green.
2. `npm run test:server-suite` — must stay **275/275**.
3. The guard script (`gate-reachability.test.ts`).
4. One preservation suite (e.g. `npm run test:warning-readability`).
5. `npm run build`
6. `git diff --check`

## 5. Return (one page)

Base SHA · candidate SHA · exact changed paths · the D3 failing-first evidence with literal output ·
the three D4 tallies · gate results · confirmation no product source changed and that the zero-residue
assertion is intact in all seven suites · risks marked `BLOCKING`/`NON_BLOCKING` · verdict
`REVIEW_REQUIRED`.
