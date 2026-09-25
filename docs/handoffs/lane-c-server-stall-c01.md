# Lane C — SERVER-STALL-C01 handoff (2026-09-25)

**Base** `ff87b06b` (`origin/main`) · **candidate** `c198cd9` on `work/epic-galileo-cw0swp` (cloud staging branch) · tier **MEDIUM**
(server diagnostics in production wiring; no route, Prisma, migration or data change).

**Changed paths:** `atlas-server/src/lib/request-timing.ts`, `atlas-server/src/__tests__/request-timing.test.ts`
(already in `test:request-timing` and `test:server-suite`).

## Reading the evidence (`docs/handoffs/lane-a-to-lane-c-stall-evidence-2026-09-25.md`)

| Hypothesis | Verdict, 2026-09-25 | Proof |
|---|---|---|
| Event loop blocked by synchronous work | **Confirmed**, culprit not yet named | 49 stall lines on `89295c27`, peak `blocked ~7668ms`; `readiness/diagnostic`, `sections/summary`, `room-preferences/…/summary` all finish ≤ 0.2 s after it. The blocking request was hidden: the line lists 8 open notification SSE streams, then `+7 more`. |
| Prisma pool exhausted | **Ruled out as the ~8 s cause** | 0 `P2024`/`pool`/`P1001`; a pool wait does not block the loop, and the loop was blocked. `inFlight=14–18` counted ~15 open SSE streams as work. |
| Shared lock/await in middleware | Ruled out (unchanged) | — |
| **New: GC pressure** | Open | Multi-second stalls on the ~6.7 h-old `89295c27` process; only `~384ms` on the fresh `e8553752`. Consistent with heap growth; unproven. |

**Separate cause — `runtime/context` 4127/4221 ms at `inFlight=2`, no stall line:** an upstream wait, not a
block. It matches the 4000 ms `AbortSignal.timeout` on the EnrollPro `integration/v1/school-year` and
`integration/v1/active-term` fetches (`atlas-server/src/services/section-adapter.ts:24`,
`atlas-server/src/services/active-term-adapter.service.ts`) that `resolveRuntimeContext` awaits when the
client asks `verifyUpstream=true`. A read-only host check decides it: time one call to each endpoint.

**SSE streams are not proven leaked.** 15 open streams ≈ 7–8 open tabs (two streams each); cleanup is
registered on `req`/`res` close. Their hours-long durations are connection lifetimes.

## What changed and why

The instrument hid its own answer. Open `text/event-stream` responses are now reported as `streams=N`, never
listed as active work, never counted in `inFlight`, and never logged as a `[slow-request]` when they close.
Stall lines add `heap=<used>/<limit>MB` so a GC pause can be told from handler CPU work:

```
[event-loop-stall] blocked ~562ms heap=39/8240MB; active: none (background work); streams=1
[slow-request] GET /api/v1/generation/:n/:n/readiness/diagnostic 200 321ms inFlight=0 streams=9
```

The root-cause fix is deliberately **not** in this candidate: the evidence names no culprit, and guessing one
would ship an untested theory. This release makes the next stall line decisive.

## Commands run (cloud container, isolated)

- Failing-first: new T7/T8/T9 against the base `request-timing.ts` → **fail** (stall line listed 7 SSE streams
  and `+2 more`); on the candidate → **pass**. `npx tsx --test src/__tests__/request-timing.test.ts` 6/6, three runs.
- `npm run build` (after `prisma generate --schema ../prisma/schema.prisma`) → exit 0.
- §5: `node --import <scratch one-shot 600 ms block> dist/server.js` on isolated **5911**; `/api/v1/health` 200;
  an admin-JWT SSE stream to `/api/v1/notifications/1/events` received `retry: 2000`; log line above; the
  stream closed after 6 s with **no** slow-request line; process stopped. DB unreachable by design (no DB here).

## Risks

- `NON_BLOCKING` — a stream that errors *before* `Content-Type` is set is logged as an ordinary request
  (correct: it is one).
- `NON_BLOCKING` — `heap=` reads `v8.getHeapStatistics()` once per stall line only.
- **Deployment acceptance (host, not a source row):** after the next release carrying `c198cd9` has run ≥ 2 h
  with `/timetable` in use, run the planner handoff's `Select-String` command and read the `active:` list and
  `heap=`. Owner: **Lane A** (holds the host).

**Independent QA (2026-09-25, fresh reviewer, `ff87b06b...c198cd9`): `ACCEPT_READY` 5/0/0** — failing-first
reproduced on base (7 streams + `+2 more`, no `heap=`/`streams=`); `test:request-timing` 6/6 ×3 and in
`test:server-suite`; build exit 0; all four SSE routes (`notification`, `published-schedule`, `room-preference`,
`preference`) set `text/event-stream` before `flushHeaders()` with no await between; Node on isolated 5912: health
200, 3 s SSE stream produced 0 slow-request lines, port clear after stop. `NON_BLOCKING`: a future route that sets
`text/event-stream` and then sends a JSON error would be hidden from diagnostics (none does today); the stall test
uses real timers (stable ×3).

**Verdict:** `ACCEPT_READY` → integrate to `main` → ship with the next release. Worktree: cloud
session, `RETIRE_AFTER_INTEGRATION`.
