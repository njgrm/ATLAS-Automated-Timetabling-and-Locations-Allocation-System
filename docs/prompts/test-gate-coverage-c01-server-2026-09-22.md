# TEST-GATE-COVERAGE-C01 (server half) — make every server test file reachable from a gate

**Status:** `PREPARED`. **Risk:** LOW (test-only + `package.json` script entries; no product source).
**Owner:** Lane A — **custody transfer**: the operator authorised Lane A to take
`atlas-server/package.json` for this stream while Planner B is on QA (read-only). Planner B remains
the owner afterwards; this packet records the transfer so the boundary stays provable.
**Worktree:** `E:/ATLAS-worktrees/test-gate-coverage-c01-server`, branch
`work/test-gate-coverage-c01-server`.

## 0. Why — measured, not asserted (2026-09-22, base `9e0539cc`)

The client half is done (`1ce9f4ad`). The server half is the **inverse** of Planner B's integrated
`TEST-GATE-REACHABILITY-C01` (`f4462374`, which removed scripts pointing at absent files) and of
`0758075e`'s scripts→files guard: nothing checks files → scripts.

- `atlas-server` has **94 test files**; only **14** are named by a committed `test:*` script.
- **80 files are unreachable** — nothing runs them, and nothing fails when they rot.
- Classification of the 80: **27 hermetic** (no `prisma`/`DATABASE_URL`) and **53 DB-backed**.
- **Hermetic run, all 27 together: 274 tests, 271 pass, 3 fail.** All three failures are in
  **one** file — `src/__tests__/derived-demand-correction-c01r.test.ts` (controls 5, 7 and 10) —
  with one root cause: `computeGenerationInputSnapshot`
  (`src/services/generation-input-snapshot.service.ts:208`) calls `.aggregate` on a model the suite's
  **hand-built prisma mock** does not provide. This is a silently-rotted test, which is exactly what
  this stream exists to surface.
- The DB-backed suites are runnable (sampled green) against a disposable database — recipe in §3.
- Median orphan size is **382 lines**; the smallest is 76. These are substantive suites, not stubs.

**Contract delivered:** no server test file that no gate runs — and a gate that keeps it that way.

## 1. Deliverables

**D1 — the hermetic aggregate gate.** Add `"test:server-suite"` to `atlas-server/package.json`
naming the **27 hermetic** orphan files explicitly. Leave every existing script byte-identical apart
from the comma the insertion requires.

**D2 — the DB-backed aggregate gate.** Add `"test:server-db"` naming the **53 DB-backed** orphan
files, with the prerequisites documented in the script's own name/comment context (a disposable
`DATABASE_URL` + `JWT_SECRET`; recipe in §3). Do **not** merge the two into one command — one
command cannot honestly run both, and pretending otherwise is the false-green failure this stream
exists to remove.

**D3 — resolve the one rotten suite.** `src/__tests__/derived-demand-correction-c01r.test.ts`
(controls 5, 7, 10) fails because its prisma mock lacks the model the snapshot service now
aggregates. Decide, and justify with evidence:
- **preferred:** fix the **test** (add the missing model's `aggregate` to the mock), keeping every
  existing assertion — it is a mock gap, not a product defect; confirm the model exists on the real
  client before you do; or
- if the suite is genuinely superseded by `derived-demand-correction-c01r2.test.ts`, **retire** it
  and list the deletion for approval.
Do not weaken an assertion to make it pass, and do not change product source. If you conclude the
failure is a **product** defect, stop and report it as `BLOCKING` instead.

**D4 — the inverse reachability guard.** Add a guard for `atlas-server` mirroring Lane A's client one
(`atlas-client/src/lib/__tests__/gate-reachability.test.ts`, second `test(...)`): every
`src/**/*.test.ts` must be named by at least one `test:*` script, failing with the list. Put it in
`atlas-server/src/__tests__/` and name it in a committed script so the guard is itself gated.

**D5 — failing-first control.** Show the new guard passing; create a temporary unreferenced test file
and show the guard **fails** and names it; delete it and show it passes. The probe must not be
committed.

**D6 — honest blockers.** If any orphan cannot be honestly gated (needs a live external service, a
credential, or a mounted runtime), do **not** force it into a script — report it with the reason and
leave it out, naming it as a typed blocker.

## 2. Boundaries — do not break

- **Writable:** `atlas-server/package.json`, `atlas-server/src/__tests__/` (the new guard, plus the
  one test file resolved in D3). Nothing else.
- **Do NOT touch any product source** (`src/services/**`, `src/routes/**`, …). If a suite fails for a
  product reason, report it — do not fix it.
- Do not touch `atlas-client/**` (the client half is already integrated), `docs/**`, `CHANGELOG.md`,
  or any companion repo.
- Do not delete or weaken any existing script or assertion; corrections are additive.
- Do not remove a failing file from a gate to make the gate green — that is the defect this stream
  exists to remove.

## 3. Running the DB-backed suites (disposable database — never the live one)

```
# from atlas-server, with $live = the DATABASE_URL in D:\ATLAS-runtime-config\atlas-server.env
psql $live -c 'DROP DATABASE IF EXISTS atlas_srv_gate_test;'
psql $live -c 'CREATE DATABASE atlas_srv_gate_test;'
$env:DATABASE_URL = ($live -replace '/atlas_recovery_clean_rebuild_20260905','/atlas_srv_gate_test')
npx prisma db push --schema ..\prisma\schema.prisma --skip-generate
$env:JWT_SECRET = '<a test secret>'
npm run test:server-db
```
**Never** point `DATABASE_URL` at `atlas_recovery_clean_rebuild_20260905`. Drop
`atlas_srv_gate_test` when done.

## 4. Gates (run and paste literal results)

1. `npm run test:server-suite` — expect 274 tests, and after D3 **274/274**.
2. `npm run test:server-db` — against the disposable database; report the literal tally.
3. The new guard's own gate (the script that runs it).
4. One preservation suite from the existing server scripts (e.g. `npm run test:warning-readability`).
5. `npm run build`
6. `git diff --check`

## 5. Return (one page)

Base SHA · candidate SHA · exact changed paths · the before/after numbers (orphans 80 → 0; per-gate
suite sizes) · the D3 decision with its root-cause evidence and literal before/after output · the D5
failing-first evidence · the gate results · any D6 blockers with reasons · confirmation that no
product source changed · risks marked `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
