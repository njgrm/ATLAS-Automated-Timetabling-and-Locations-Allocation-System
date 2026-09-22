# TEST-GATE-COVERAGE-C01 (client half) — make every client test file reachable from a gate

**Status:** `PREPARED`. **Risk:** LOW (test-only + `package.json` script entry; no product source).
**Owner:** Lane A. Executor worktree provisioned by the planner:
`E:/ATLAS-worktrees/test-gate-coverage-c01`, branch `work/test-gate-coverage-c01`.

## 0. Why — measured, not asserted (2026-09-22, base `98d0b665`)

`AGENTS.md` §11: *"A test no gate runs is not evidence."* Today that is true of most of the suite.

- **92 client test files exist; 37 are named by a committed `test:*` script; 55 are not.**
- Those **55 orphaned suites were run together** on the base commit: **481 tests, 481 pass, 0 fail,
  exit 0, 10.5 s.** They are healthy and fast — they are simply unreachable, so nothing runs them and
  nothing fails when they rot.
- The existing guard `atlas-client/src/lib/__tests__/gate-reachability.test.ts` checks only
  **scripts → files** (a script naming a deleted file). Nothing checks **files → scripts**.
- The gap is **ongoing, not historical**: `atlas-client/src/lib/__tests__/timetable-scheduler-simplicity-c01.test.ts`
  (110 lines, added 2026-09-22 by the timetable stream) is already an orphan.
- Related prior work, so it is **not** re-done here: `TEST-GATE-REACHABILITY-C01` (`f4462374`,
  Planner B) removed 32 `atlas-server` scripts that pointed at absent files; `0758075e` added the
  scripts→files guard. Both are the **opposite** direction and are integrated.

**Contract delivered:** no client test file that no gate runs — and a gate that keeps it that way.

## 1. Deliverables

**D1 — an aggregate client gate.** In `atlas-client/package.json`, add
`"test:client-suite"` running **every** client test file (`src/**/*.test.ts` and `src/**/*.test.tsx`)
as an explicit list. Do **not** remove, rename or reorder any existing script, and do not change any
existing script's contents.

**D2 — the inverse reachability guard.** Extend
`atlas-client/src/lib/__tests__/gate-reachability.test.ts` with a second `test(...)` that asserts the
inverse of the existing one: **every `src/**/*.test.ts(x)` file in the package is named by at least
one `test:*` script.** On failure the message must list the unreachable files (so the fix is obvious).
Keep the existing scripts→files test exactly as it is — this is an addition beside it, never a
replacement.

**D3 — prove the guard discriminates (failing-first control).** Demonstrate, with literal output:
1. the new assertion **passes** after D1;
2. create a temporary test file not named by any script, run the guard, show it **fails** and names
   that file;
3. **delete the temporary file** and re-run, showing it passes again.
The temporary file must not be committed — verify with `git status --short` at the end.

## 2. Boundaries — do not break

- **Changed paths are exactly two:** `atlas-client/package.json` and
  `atlas-client/src/lib/__tests__/gate-reachability.test.ts`.
- **Do NOT touch `atlas-server/package.json`** — it is another planner's file. The server half
  (80 unreachable files) is a separate, explicitly-scoped follow-up; report it, do not act on it.
- Do not touch any product source, any other test file, `docs/**`, `CHANGELOG.md`, or a companion repo.
- Do not delete or weaken any existing script or assertion; corrections are additive.
- Do not "fix" a failing orphan by editing product code — if a suite fails, report it as a typed
  blocker with the literal failure instead.

## 3. Gates (run and paste literal results)

From `E:/ATLAS-worktrees/test-gate-coverage-c01/atlas-client`:

1. `npm run test:client-suite` — expect the full client suite green (≈ 900+ tests; the 55 orphans
   alone are 481).
2. `npm run test:ux-guardrails` — this runs `gate-reachability.test.ts`, so it is the guard's own gate.
3. `npm run typecheck`
4. `npm run build` with `$env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'`
5. One preservation suite of your choice from the existing scripts (e.g. `npm run test:timetable-ux-rehaul`)
6. `git diff --check`

## 4. Return (one page)

Base SHA · candidate SHA · exact changed paths · the measured before/after numbers (orphan count,
suite size, wall time) · the D3 failing-first evidence with literal output · the gate results ·
confirmation that `atlas-server/**` is untouched · the server-side orphan count you observed ·
risks marked `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
