# Packet A7-C2-EXEC addendum 1 — the 5-hour hang, diagnosed. READ THIS FIRST.

Planner A7, 2026-09-29 05:30. The c2 executor hung for ~5 hours on
`atlas-server/src/__tests__/runtime-router-archive-school-year-a7c2.test.ts`; Lane C killed the tree. That file
is the only thing it left behind. **Do not run that test the way it is written. Fix the handles first.**

## Why it never exits (my read of the file; confirm it, then fix it)

Four things combine:

1. **`await import('../lib/prisma.js')` constructs a REAL `PrismaClient`.** Prisma spawns its query engine as a
   child process on construction. `$disconnect()` in the `finally` is necessary but only runs *if control
   reaches the `finally`*.
2. **Cleanup lives in the parent test's `finally`, not in `t.after()`.** `node:test` runs a parent test's body
   and its subtests in one async flow. If **any** subtest never settles — a `fetch` that never resolves because
   the server was closed underneath it, an assertion that throws inside `t.test`, a route that awaits a service
   call that hangs — the `finally` is never reached, and then **the two `http.Server` handles, every keep-alive
   socket and the Prisma engine child all stay alive forever.** This is the 5-hour hang, and the rule that names
   it ("a test that never exits usually leaves a DB pool or server open") is exactly this.
3. **A 120 s `WaitForExit` plus `Kill` does not stop a `tsx` grandchild** — the child's own process tree
   survives. Only `taskkill /T /F /PID <pid>` ends the tree. Never conclude from "I killed it" that it stopped.
4. Nothing in the file bounds a subtest, so a single unsettled await hangs the whole file indefinitely.

## The fix, in order

1. **Do not construct a real PrismaClient at all.** Use the repo's existing module-mock mechanism —
   `node --experimental-test-module-mocks --import tsx --test` — and `mock.module('../lib/prisma.js', …)` with
   the instrumented surface, **before** any dynamic import of the router. The repo already does this in several
   gates (`test:a3-c4-tl-truth`, `test:ux-a2-c12-310fix`, `test:a3-c6-concerns-truthfulness`). With no real
   client there is no pool, no engine child, and nothing to leak. If you keep the real import instead, you must
   prove the engine process is gone at the end of the run — and I do not want that argument in this file.
2. **Move every cleanup into `t.after(...)`, never a parent `finally`.** `t.after` runs when the test finishes
   *however* it finishes, including when a subtest fails. This is the single change that makes the next hang
   impossible rather than merely unlikely.
3. **Unref and close both HTTP servers in that same `t.after`**: `server.closeAllConnections()` then
   `await new Promise(r => server.close(() => r()))`, and `server.unref()` immediately after `listen` so a
   surviving handle can never hold the loop open.
4. **Bound every request.** Wrap each `fetch` in `Promise.race` against a ~10 s timer that rejects with the
   request path, so a route that hangs fails the test instead of hanging the file. An unsettled subtest must be
   a **red test**, never a stuck one.
5. **Never run a server or a watcher in the foreground**, and never leave one for the harness to clean up.

## The rule you must follow to run any test in this cycle (`.opencode/agents/atlas-planner.md`, "A shell call must return")

Every test command you run goes through a **bounded launcher**, and no exceptions — a 5-hour hang is not an
acceptable cost for a red test:

- Start it detached with `Start-Process -WindowStyle Hidden` and **redirect stdout/stderr to a file**. No
  `-PassThru` on anything that waits, and no foreground `npm`/`npx`/`tsx` command that can block.
- Poll for exit with `WaitForExit`, bounded to **120 s maximum**.
- **On timeout, the tree dies:** `taskkill /T /F /PID <pid>`, then confirm no `node.exe` whose command line
  contains your worktree path is left alive. A killed-but-alive grandchild is the failure that cost this lane
  five hours.
- Report every gate with the literal command **including the launcher and the cap**, so a reader can reproduce
  it and see the bound.

## Still true from the main packet

The four RULINGS (R3–R6) stand unchanged. Items 1–4 of the main packet are still the work. `E:` is at
**25.04 GiB** (it recovered after the kill, and it is still at or just above the §3 25 GiB warning line) — so
**still no `npm ci`, no install, no build.** `node_modules` is present in both packages.

## Order of work — commit early, because the last cycle's candidate never existed

1. Fix the test handles (this addendum) and **prove it**: run the file, let it go red on the real assertions,
   and show it **exits** with a number. A test that never exits is not a test.
2. Then the rest of the slice. **Commit a checkpoint as soon as the new route files exist and typecheck** — a
   committed checkpoint is what a step limit resumes from, and the last cycle produced no commit at all.
3. Failing-first records for items 1–4 before each fix.
