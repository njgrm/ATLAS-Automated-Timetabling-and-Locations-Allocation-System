# TEST-GATE-COVERAGE-C01R — make `test:server-db` a green, honest gate

**Status:** `PREPARED`. **Risk:** LOW (test infrastructure + `package.json`; no product source).
**Owner:** Lane A (Planner B is not working; `atlas-server/package.json` is free).
**Worktree:** `E:/ATLAS-worktrees/test-gate-coverage-c01r`, branch `work/test-gate-coverage-c01r`.
**Base:** `89975442`.

## 0. Why — the measured baseline (2026-09-22)

`TEST-GATE-COVERAGE-C01` (server half, `f9c0f3cb`) gated all 53 DB-backed server suites but the gate
is **red**. This packet makes it green **honestly** — by fixing the harness, not by dropping files.

Measurements taken at review (full runtime env; disposable database; `prisma db push`):

| Method | Result |
| --- | --- |
| All 53 in one `tsx --test` run, one shared DB | **250 tests, 239 pass, 10 fail** |
| Each file against **its own** fresh DB, DB named `atlas_srv_gate_run` | **45 / 53 files green** |
| Same, but DB named per the repo convention `atlas_restore_drill_<yyyymmdd>_<suffix>` | **46 / 53 files green** |

Two root causes are already proven:

1. **Cross-suite interference.** The suites were written to run against **their own** disposable
   database. Running them as one batch breaks isolation — e.g. `class-template-authority-c07.test.ts`
   **passes alone** and fails in the batch.
2. **The database-name guard.** The repo convention is
   `atlas_restore_drill_<yyyymmdd>_<suffix>` (asserted at e.g.
   `src/__tests__/tt-tl-modules-contract.test.ts`, `publication-contract-postgres-concurrency.test.ts:21`,
   `export-presentation-schema-guard-c06b.test.ts:128`). A DB named anything else is refused — that
   alone turned `tt-tl-modules-contract.test.ts` green.

**The 7 files that still fail in isolation** (each measured alone, fresh convention-named DB):

| File | Observed failure |
| --- | --- |
| `department-authority-gates.test.ts` | `[FAIL] sidecar carries the exact byte SHA of the artifact file` (81/82 pass) |
| `derived-demand-correction-c01r2.test.ts` | 6 pass / 1 fail — `TypeError: Cannot read properties of undefined (reading 'split')` |
| `enrollpro-rollover-automation.test.ts` | `Tick skips when drift is aligned — expected skipped, got error` |
| `publication-contract-postgres-concurrency.test.ts` | `AssertionError` (detail not yet captured) |
| `teaching-load-reconciliation.test.ts` | `[FAIL] mechanical demand count (2 subjects x 2 sections) (expected 4, got 0)` |
| `teaching-load-reconciliation-route.test.ts` | `[FAIL] first apply executes writes (expected false, got true)` |
| `teaching-load-summary-zero-write-route.test.ts` | `[FAIL] active non-archived school year resolves (found 0)` |

## 1. Deliverables

**D1 — make `test:server-db` isolate per file.** Replace the single `tsx --test <53 files>`
invocation with a small committed runner (e.g. `atlas-server/scripts/run-db-suite.mjs`) that, for
each file:
1. creates a **fresh** database named `atlas_restore_drill_<yyyymmdd>_<suffix>` from a prepared
   template (build the template once per run with `prisma db push`; `CREATE DATABASE … TEMPLATE …` per
   file so the run stays fast),
2. runs that one file with `tsx --test`,
3. drops the database,
4. aggregates a per-file tally and exits non-zero if any file fails.

Keep `test:server-db` as the single entry point. Document the prerequisites (a disposable
`DATABASE_URL`, `JWT_SECRET`, `ATLAS_SYSTEM_TOKEN`) in the runner's header comment.

**D2 — resolve the 7 failures.** For each, root-cause it and then:
- **fix test-only** where the cause is a stale fixture, a missing seed row, or a harness assumption
  (several look like missing seed data, e.g. `active non-archived school year resolves (found 0)`),
  keeping every existing assertion; or
- if a fix is not bounded or the suite is genuinely superseded, **retire** the file and list the
  deletion for approval; or
- if the failure is a **product** defect, stop and report it `BLOCKING` — do not fix product code.
Report each of the 7 with its root cause and disposition.

**D3 — the gate must end GREEN.** After D2, `test:server-db` must exit 0. If any file genuinely
cannot be made green within this packet, it must **not** be silently dropped: record it in a **dated
`KNOWN_RED` list** carried by the runner (file + root cause + date), and have the run report those as
`skipped-known-red` rather than passing them. The list must not grow silently — state the rule in the
runner's header.

**D4 — keep the reachability guard honest.** `src/__tests__/gate-reachability.test.ts` asserts every
server test file is named by a `test:*` script. Keep it passing; if D2 retires a file, remove it from
the gate in the same commit and say so.

**D5 — failing-first control.** Show `test:server-db` red before D1/D2 and green after, with literal
tallies. If you use a `KNOWN_RED` entry, show the runner reporting it as skipped (not passed).

## 2. Boundaries — do not break

- **Writable:** `atlas-server/package.json`, `atlas-server/scripts/**` (the new runner),
  `atlas-server/src/__tests__/**` (only the files resolved in D2 + the guard if D4 requires).
- **Do NOT touch product source** (`src/services/**`, `src/routes/**`, `src/middleware/**`, …). A
  product defect is reported, not fixed.
- Do not touch `atlas-client/**`, `docs/**`, `CHANGELOG.md`, or any companion repo.
- Do not delete or weaken an existing assertion to make a suite pass.
- **Never** point `DATABASE_URL` at `atlas_recovery_clean_rebuild_20260905`, and never drop a
  database that is not yours. Verify the runner's drop step targets only databases it created
  (name-prefixed) — a wrong drop is an incident.

## 3. Gates (run and paste literal results)

1. `npm run test:server-db` — must exit 0, with the per-file tally.
2. `npm run test:server-suite` — must stay **275/275**.
3. The guard's own script.
4. One preservation suite (e.g. `npm run test:warning-readability`).
5. `npm run build`
6. `git diff --check`

## 4. Return (one page)

Base SHA · candidate SHA · exact changed paths · the before/after tallies (per-file green count,
`KNOWN_RED` entries if any) · per-file root cause + disposition for the 7 · the D5 failing-first
evidence · the runner's database-lifecycle proof (it creates and drops only its own prefixed
databases) · gate results · confirmation no product source changed · risks marked
`BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
