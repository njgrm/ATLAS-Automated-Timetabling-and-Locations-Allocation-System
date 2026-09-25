# READINESS-STALL-C01 — executor handoff (Lane C)

**Base SHA:** `6d5d3e2ad47626cba2368ea20533c46bbef69e38`
**Candidate SHA:** recorded at commit time below (branch `fix/readiness-stall`)
**Risk tier:** MEDIUM (production wiring, no schema/migration/DB write, no runtime/deploy action)

## Changed paths

- `atlas-server/src/services/timetable-candidate-domain.ts` — bounded memo for `timeToCandidateMinutes`.
- `atlas-server/src/services/generation-readiness.service.ts` — bounded readiness-only scheduler-result cache; `scheduler.cached` field.
- `atlas-server/src/__tests__/readiness-stall-c01.test.ts` — new, failing-first.
- `atlas-server/package.json` — `test:readiness-stall` script; new test file appended to `test:server-suite`.
- `docs/handoffs/lane-c-readiness-stall-c01.md` — this handoff.

## What changed and why

`GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic` fires on every `/timetable`
load and blocks the whole event loop (~3.1 s offline, ~7 s live, measured 2026-09-25 against
school 1 / year 10) because `buildGenerationReadinessWithContext` runs the full
`runHybridScheduler` synchronously. Profiling pinned self time to
`timeToCandidateMinutes` (`timetable-candidate-domain.ts`), re-parsing "HH:MM" strings with a
regex + string split millions of times from `OccupancyTracker.isOccupied` /
`intervalsOverlap` inside `constructBaseline` (`schedule-constructor.ts`).

**Change 1 — cheap time parsing.** `timeToCandidateMinutes` now consults a bounded
(`TIME_TO_MINUTES_CACHE_LIMIT = 2000`, full-clear-on-overflow) module-level `Map<string, number
| null>` before doing the regex/parse. Real callers only ever see a few dozen distinct "HH:MM"
strings (period/policy boundaries), so the bound is a safety net, not an expected hot path. Return
value and `null`-for-invalid semantics are byte-identical to the old implementation (proven by T1).

**Change 2 — readiness scheduler result cache.** `generation-readiness.service.ts` now has
`runHybridSchedulerCached(constructorInput)`: a bounded (`SCHEDULER_RESULT_CACHE_LIMIT = 8`,
evict-oldest), process-local cache keyed by `sha256(canonicalStringify(constructorInput))` (the
module's existing `sha256`/`canonicalStringify` helpers, already used for the zero-write
signature). A hit returns `structuredClone(cachedResult)` — proven safe against mutation by a
future careless caller even though the current downstream consumers
(`resolvePerTermScheduleEntries` / `resolvePerTermUnassignedItems`) only spread items into new
objects and never mutate the input arrays. Everything else in readiness (preflight DB reads,
blockers, hard-validator run, shape/rotation checks, zero-write signature, status) still executes
on every request — only the scheduler's own decision is reused. `generation.service.ts` (the real,
writing generation path) calls `runHybridScheduler` directly and is untouched; only the readiness
path uses the cache.

`scheduler.runtimeMs` stays truthful — it reports THIS call's own measured duration (small on a
cache hit), and a new additive `scheduler.cached: boolean` field reports whether this call reused
a prior result. The `atlas-client` parser
(`atlas-client/src/lib/timetable-generation-readiness.ts`) reads specific fields only
(`schedulerExecuted`, `generateAllowed`, `zeroWrite`, `blockers`, …) and never asserts an exact key
set, so the additive field is contract-compatible; it does not read `scheduler.runtimeMs` at all.

**Determinism check (required before caching):** grepped `hybrid-scheduler.ts` and
`schedule-constructor.ts` for `Math.random`/`Date.now`/unordered iteration. No `Math.random`
anywhere; the only `Date.now()` uses are `runtimeMs` bookkeeping (not a decision input). Every
`Set`/`Map` is built by iterating an array in the input's own order and is iterated back in
insertion order (JS spec guarantee) or only used for `.has()` membership tests, never iteration
order that could vary run-to-run — so `runHybridScheduler` is deterministic for identical input.
This matches the codebase's own existing test (`generation-canonical-readiness-genc02.test.ts`
test 4, "identical inputs produce deterministic readiness output"), which still passes unchanged.

**Serialization safety for the cache key:** `ConstructorInput`'s fields
(`buildPreflightConstructorInput`, `generation-preflight.service.ts`) are plain
arrays/objects/`Record`s — no `Map`/`Set` instances reach it. The one pass-through Prisma row
(`policy: { ...assembly.policyRow, ... }`) has no `Decimal` columns (`prisma/schema.prisma`'s
`SchedulingPolicy` model is `Int`/`Boolean`/`String` only — grepped, zero `Decimal` matches in the
whole schema), and any `Date` field is handled by `canonicalStringify`
(`lib/canonical-json.ts` converts `Date` via `.toISOString()`). So `canonicalStringify` is a safe,
deterministic cache-key input for a given logical `constructorInput`.

## Decisive commands and results

### T1–T3 (failing-first for T2, `atlas-server/`)

```
npx tsc --noEmit -p tsconfig.json                    # clean, both before and after implementing
```

Failing-first for T2 (stash-free — swapped the two service files for their base-SHA content via
`git show <base>:<path>`, ran the new test file, then restored the candidate files from a
scratchpad backup):

```
$ npx tsx --test src/__tests__/readiness-stall-c01.test.ts     # against BASE service files
SyntaxError: The requested module '../services/generation-readiness.service.js' does not
provide an export named 'SCHEDULER_RESULT_CACHE_LIMIT'
✖ fail 1
```

After restoring the candidate implementation:

```
$ npx tsx --test src/__tests__/readiness-stall-c01.test.ts
✔ T1: timeToCandidateMinutes matches the pre-change implementation for every fixture string
✔ T1b: repeated calls with the same string are stable
✔ T2a: an identical input hits the cache on the second call (scheduler runs once)
✔ T2b: any changed field re-runs the scheduler (new cache key)
✔ T2c: returned results are not shared-mutable across cache hits
✔ T2d: the cache is bounded — evict-oldest holds at capacity
✔ T3: runHybridScheduler is deterministic, and the cache wrapper is deep-equal to a direct call
ℹ tests 7  ℹ pass 7  ℹ fail 0
```

`git diff --stat` for the two edited service files was identical (103 insertions / 6 deletions
total) before and after this swap-and-restore, confirming no candidate content was lost.

### Suites

```
npm run test:server-suite     # 341 tests, 337 pass, 4 fail
npm run test:request-timing   # 6 tests, 6 pass
```

The 4 `test:server-suite` failures are all in `tt-output-c03r.test.ts` (workbook column-header
text / merge-range assertions unrelated to this change — em-dash / "TEACHER" column text and an
`A1:H` vs `A1:G29` merge range). Confirmed pre-existing on base by the same swap-and-restore
technique: running `npx tsx --test src/__tests__/tt-output-c03r.test.ts` against the base service
files gives the identical `tests 17 / pass 13 / fail 4`.

```
npm run build                 # tsc, clean
```

### P1 — parity (base dist vs candidate dist), read-only against the live DB

Probe script: `C:/Users/njgro/AppData/Local/Temp/claude/D--ATLAS/75ee3215-8c2c-49ec-b6df-9c2cfb29e881/scratchpad/readiness-stall-c01-p1-p2.mjs` (not committed to the repo). Run:

```
node --env-file=D:/ATLAS-runtime-config/atlas-server.env readiness-stall-c01-p1-p2.mjs
```

Imports `buildGenerationReadiness` from
`E:/ATLAS-runtime-supervised-c5e167d7-20260925/atlas-server/dist/services/generation-readiness.service.js`
(base) and from this worktree's freshly built
`atlas-server/dist/services/generation-readiness.service.js` (candidate), calls both for school 1 /
year 10, and deep-equals the two results after stripping `scheduler.runtimeMs` and
`scheduler.cached` (the two fields this change intentionally makes non-identical / newly present).

Result: **`P1 PARITY: base and candidate readiness output are deep-equal (excluding
scheduler.runtimeMs/scheduler.cached).`** No other field differed — `status`, `generateAllowed`,
`blockers`, `violations`, `totals`, `teachingLoadCoverage`, `databaseSignature`,
`scheduler.assignedCount/unassignedCount/policyBlockedCount/classesProcessed/selectedProfileId`
all matched exactly.

### P2 — event-loop stall timing, same-process before/after

50 ms loop-lag monitor, first call and a second identical call, one process per side:

| | wallMs | max event-loop lag (ms) |
|---|---|---|
| base call #1 | 4476.8 | 4313.9 |
| base call #2 | 4265.6 | 4161.0 |
| candidate call #1 (P1 section, scheduler cache cold, time-parse memo warm) | 1700.3 | 1174.8 |
| candidate call #2/#3 (P2 section, scheduler cache warm) | 221.1 / 232.6 | 112.9 / 128.5 |

Two effects are visible and worth separating: (a) the time-parsing memo alone cuts the
**first, cold-cache** call's max stall from ~4.3 s to ~1.2 s (base call vs candidate's own first
call in the P1 section); (b) the scheduler-result cache then cuts every **subsequent identical**
call's max stall to ~0.1–0.13 s — a further ~10x on top of (a), ~35x versus the base's repeat call.
Base shows **no such improvement on repeat calls** (4313.9 ms → 4161.0 ms, i.e. it re-blocks every
time), confirming the base has no caching and the candidate's improvement is the change under
test, not measurement noise.

### P3 — startup, isolated port 5198

```
$ PORT=5198 node --env-file=D:/ATLAS-runtime-config/atlas-server.env dist/server.js &
$ curl -s -o /dev/null -w "health status=%{http_code}\n" http://localhost:5198/api/v1/health
health status=200
$ taskkill /F /PID 86772
SUCCESS: The process with PID 86772 has been terminated.
$ netstat -ano | grep ":5198"
  TCP    127.0.0.1:53692        127.0.0.1:5198         TIME_WAIT       0   # no LISTENING entry — port clear
```

No interaction with the supervised runtime (port 5001/5174 untouched; isolated port used per
AGENTS.md §6/§14).

## Risks

- **NON_BLOCKING** — the scheduler-result cache is bounded at 8 entries and process-local; a
  future multi-instance deployment would not share it (each instance would independently cache),
  which is fine for a readiness-only latency optimization and does not affect correctness.
- **NON_BLOCKING** — `scheduler.cached` is a new field. Confirmed the `atlas-client` readiness
  parser (`atlas-client/src/lib/timetable-generation-readiness.ts`) reads only named fields and
  does not assert an exact key set, so this is additive and non-breaking. No client change made or
  needed.
- **NON_BLOCKING** — the P1/P2 probe script lives only in the scratchpad
  (`C:/Users/njgro/AppData/Local/Temp/claude/...`), not in the repo, per the packet's own
  instruction; it is not reproducible from a committed path, only from this handoff's transcript.
- **BLOCKING (informational, not this candidate's scope)** — `tt-output-c03r.test.ts` has 4
  pre-existing failures on base, unrelated to timetable readiness/scheduling caching (workbook
  header text / merge-range assertions). Confirmed pre-existing via the same base-swap technique
  used for T2's failing-first proof; not touched or masked by this change.

## Verdict

Both changes are behaviour-identical (T1, T3, P1) and deliver the intended latency fix (P2):
first-call max event-loop stall drops ~4.3 s → ~1.2 s from the time-parse memo alone, and every
repeat call for unchanged input drops to ~0.1 s from the scheduler-result cache, versus the base's
unchanged ~4.2–4.5 s on every call. Zero-write and generation-path isolation are preserved.
Recommend **ACCEPT** subject to independent QA per AGENTS.md §11 MEDIUM tier
(`executor → one fresh QA → planner integration`).
