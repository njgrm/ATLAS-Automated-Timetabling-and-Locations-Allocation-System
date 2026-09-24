# SERVER-TIMING-C01 handoff (Lane C)

- **Base:** `b6687fee` · **Candidate:** `26fbfe57` on `work/lane-c-server-timing` · **Tier:** MEDIUM
  (production server wiring, observability only — no route behaviour, schema, auth or data change)
- **Changed paths:** `atlas-server/src/lib/request-timing.ts` (new), `atlas-server/src/__tests__/request-timing.test.ts`
  (new), `atlas-server/src/app.ts`, `atlas-server/src/server.ts`, `atlas-server/package.json`

## What and why

Audit finding 5 (`docs/reviews/ux-audit-class-schedule-2026-09-25.md`): on live `066da7a7`, 6–7 unrelated
`/timetable` requests finished within ~10 ms of each other ~8 s after page start — a shared server stall the
browser cannot attribute. This candidate adds two supervisor-log lines to name it:

- `[slow-request] GET /api/v1/.../:n 500 1681ms inFlight=0` for requests ≥ 1 s;
- `[event-loop-stall] blocked ~Nms; active: …` for event-loop lag ≥ 200 ms, listing requests running or finished
  inside the blocked window, or `none (background work)` (e.g. rollover automation).

Middleware is first in `app.ts`; the monitor starts in `server.ts` on listen (unref-ed timer, stopped on close), so
importing `app` in tests starts nothing. Paths come from `originalUrl` with numeric ids and long segments masked;
query strings, bodies, headers and tokens are never logged.

## Commands run

- `npm run test:request-timing` — **5/5 pass** (T1–T6; T6 failing-first on the error-handler path).
- `gate-reachability.test.ts` — 1/1 pass. `npm run build` — exit 0.
- Real start (§5): built `dist/server.js` on isolated port 5199 with an unreachable `DATABASE_URL` (zero-write by
  construction; startup DB check fails, so rollover automation never starts) → health 200, and a DB-failing
  `/api/v1/subjects` logged `[slow-request] GET /api/v1/subjects 500 1681ms inFlight=0`. Process stopped; port
  closed. This check is what found the T6 defect (the first label read `GET /`).
- `npm run test:server-suite` — 318/323; the 5 failures are pre-existing on the base, not in this range: 4
  `class-program` export rows (known `tt-output-c03r`) and `teacher-lunch-policy-s6` E1, which asserts copy in
  `atlas-client/src/components/SchedulingPolicyPane.tsx` changed by `64c53f31`.

## Risks

- NON_BLOCKING: per-request cost is one `Map` insert/delete and a 64-entry ring buffer; the monitor ticks every
  100 ms.
- NON_BLOCKING: `console.warn` lines land in the supervisor log; volume is bounded to slow requests and real stalls.
- NON_BLOCKING (owner: Lane A/B): `teacher-lunch-policy-s6` E1 is red on `main` since `64c53f31`.

## For the reviewer

Review `b6687fee...26fbfe57`. Decisive checks: T3/T6 in the test file, `maskedPath` never emits a query string, and
the built server starts. After deployment, one `/timetable` load should put the stall's cause in
`<sourceDir>/ops/runtime/logs/atlas-supervisor.log`.

**Worktree disposition:** `KEEP_ACTIVE` until integrated, then `RETIRE_AFTER_INTEGRATION`.
